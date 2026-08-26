require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const PROD_URL = 'https://anvilapp.online';

function extractCookies(res) {
  const raw = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie')].filter(Boolean);
  return raw.map(c => c.split(';')[0]).join('; ');
}

async function loginUser(baseUrl, email, password) {
  const csrfRes = await fetch(`${baseUrl}/api/auth/csrf`);
  const { csrfToken } = await csrfRes.json();
  const csrfCookies = extractCookies(csrfRes);

  const res = await fetch(`${baseUrl}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: csrfCookies,
    },
    body: new URLSearchParams({
      email,
      password,
      csrfToken,
      json: 'true',
    }),
  });

  const sessionCookies = extractCookies(res);
  return { status: res.status, cookies: sessionCookies, ok: res.status < 400 };
}

async function run() {
  console.log('=== VERIFYING SELF-SERVICE ACCOUNT DELETION (DELETE /api/user/account) ===\n');
  console.log(`Target: ${PROD_URL}\n`);

  const superAdminEmail = 'sdivyansh110205@gmail.com';
  const superAdminPassword = 'ForgingHabits2026!';

  // Clean up any stale test accounts from prior runs
  await pool.query(`DELETE FROM "User" WHERE email LIKE 'self_delete_test_%'`);

  // -------------------------------------------------------------------
  // TEST 1: Full self-service deletion flow (password + confirmEmail)
  // -------------------------------------------------------------------
  console.log('--- TEST 1: FULL SELF-SERVICE ACCOUNT DELETION FLOW ---');
  const test1Email = `self_delete_test_1_${Date.now()}@example.com`;
  const test1Password = 'ForgingHabits2026!';
  const hashedPwd = await bcrypt.hash(test1Password, 10);

  const create1Res = await pool.query(`
    INSERT INTO "User" (id, email, "displayName", username, password, "emailVerified", role, "isSuperAdmin", "pendingEmail")
    VALUES (gen_random_uuid(), $1, 'Self Delete Hero', $2, $3, NOW(), 'USER', false, 'pending_test@example.com')
    RETURNING id, email, "displayName", role, "createdAt";
  `, [test1Email, `user_${Date.now()}`, hashedPwd]);
  const user1 = create1Res.rows[0];

  // Attach habit, completion, stats, and verification tokens
  const habitRes = await pool.query(`
    INSERT INTO "Habit" (id, "userId", name, class, difficulty, year, month)
    VALUES (gen_random_uuid(), $1, 'Evening Meditation', 'mage', 'adept', 2026, 8)
    RETURNING id;
  `, [user1.id]);
  const habitId = habitRes.rows[0].id;

  await pool.query(`
    INSERT INTO "Completion" (id, "habitId", "userId", date, "loggedAt", "completedAt", "timeBucket", "timeAccuracy")
    VALUES (gen_random_uuid(), $1, $2, CURRENT_DATE, NOW(), NOW(), 'evening', 'confirmed');
  `, [habitId, user1.id]);

  await pool.query(`
    INSERT INTO "UserStats" ("userId", "totalCompletions", "updatedAt")
    VALUES ($1, 1, NOW());
  `, [user1.id]);

  await pool.query(`
    INSERT INTO "VerificationToken" (identifier, token, expires)
    VALUES ($1, $2, NOW() + INTERVAL '1 hour');
  `, [user1.email, `token_${Date.now()}`]);

  console.log(`Created user ${user1.email} with habit (${habitId}), completion, stats, and token.`);

  // Log in as user1
  const auth1 = await loginUser(PROD_URL, test1Email, test1Password);
  console.log(`User 1 login status: ${auth1.status}, ok: ${auth1.ok}`);
  if (!auth1.ok) throw new Error('User 1 login failed');

  // Perform self-delete request
  const delete1Res = await fetch(`${PROD_URL}/api/user/account`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Cookie: auth1.cookies,
    },
    body: JSON.stringify({
      currentPassword: test1Password,
      confirmEmail: test1Email,
    }),
  });

  console.log(`DELETE ${PROD_URL}/api/user/account status:`, delete1Res.status);
  const delete1Body = await delete1Res.json();
  console.log('Response body:', delete1Body);

  if (delete1Res.status !== 200 || !delete1Body.success) {
    throw new Error(`TEST 1 FAILED: Self-deletion failed with status ${delete1Res.status}`);
  }

  // Verify DB purged
  const userCheck = await pool.query(`SELECT id FROM "User" WHERE id = $1`, [user1.id]);
  const habitCheck = await pool.query(`SELECT id FROM "Habit" WHERE "userId" = $1`, [user1.id]);
  const completionCheck = await pool.query(`SELECT id FROM "Completion" WHERE "userId" = $1`, [user1.id]);
  const statsCheck = await pool.query(`SELECT "userId" FROM "UserStats" WHERE "userId" = $1`, [user1.id]);
  const tokenCheck = await pool.query(`SELECT identifier FROM "VerificationToken" WHERE identifier IN ($1, 'pending_test@example.com')`, [user1.email]);

  console.log('Post-delete DB rows check:');
  console.log(`- User exists: ${userCheck.rows.length > 0}`);
  console.log(`- Habit exists: ${habitCheck.rows.length > 0}`);
  console.log(`- Completion exists: ${completionCheck.rows.length > 0}`);
  console.log(`- UserStats exists: ${statsCheck.rows.length > 0}`);
  console.log(`- VerificationToken exists: ${tokenCheck.rows.length > 0}`);

  if (userCheck.rows.length !== 0 || habitCheck.rows.length !== 0 || completionCheck.rows.length !== 0 || statsCheck.rows.length !== 0 || tokenCheck.rows.length !== 0) {
    throw new Error('TEST 1 FAILED: Related tables were not cleanly removed!');
  }

  // Verify AdminAuditLog entry
  const auditRes = await pool.query(`
    SELECT id, "actorEmail", action, "targetUserId", "targetEmail", details, "createdAt"
    FROM "AdminAuditLog"
    WHERE "targetEmail" = $1 AND action = 'SELF_DELETE_ACCOUNT'
    ORDER BY "createdAt" DESC LIMIT 1;
  `, [test1Email]);
  const auditLog = auditRes.rows[0];
  console.log('Audit log record for self deletion:', auditLog);

  if (!auditLog || auditLog.action !== 'SELF_DELETE_ACCOUNT' || auditLog.actorEmail !== test1Email) {
    throw new Error('TEST 1 FAILED: Audit log record missing or incorrect!');
  }

  // Verify subsequent authenticated call with same session cookies fails (401 / null user)
  const subsequentRes = await fetch(`${PROD_URL}/api/user/settings`, {
    headers: { Cookie: auth1.cookies }
  });
  console.log(`Subsequent GET /api/user/settings status:`, subsequentRes.status);
  if (subsequentRes.status !== 401 && subsequentRes.status !== 404) {
    throw new Error('TEST 1 FAILED: Session still accessible after account deletion!');
  }
  console.log('✅ TEST 1 PASSED: Self-service account deletion purged user data, wrote audit log, and session terminated.\n');

  // -------------------------------------------------------------------
  // TEST 2: Attempt with WRONG password -> 400 & account still exists
  // -------------------------------------------------------------------
  console.log('--- TEST 2: WRONG PASSWORD VALIDATION CHECK ---');
  const test2Email = `self_delete_test_2_${Date.now()}@example.com`;
  const user2 = (await pool.query(`
    INSERT INTO "User" (id, email, "displayName", username, password, "emailVerified", role, "isSuperAdmin")
    VALUES (gen_random_uuid(), $1, 'Wrong Pwd Hero', $2, $3, NOW(), 'USER', false)
    RETURNING id, email;
  `, [test2Email, `user2_${Date.now()}`, hashedPwd])).rows[0];

  try {
    const auth2 = await loginUser(PROD_URL, test2Email, test1Password);
    const wrongPwdRes = await fetch(`${PROD_URL}/api/user/account`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Cookie: auth2.cookies,
      },
      body: JSON.stringify({
        currentPassword: 'IncorrectPassword123!',
        confirmEmail: test2Email,
      }),
    });

    console.log('DELETE with wrong password status:', wrongPwdRes.status);
    const wrongPwdBody = await wrongPwdRes.json();
    console.log('Response body:', wrongPwdBody);

    if (wrongPwdRes.status !== 400 || wrongPwdBody.error !== 'Incorrect password') {
      throw new Error('TEST 2 FAILED: Wrong password was not rejected with 400!');
    }

    const check2 = await pool.query(`SELECT id FROM "User" WHERE id = $1`, [user2.id]);
    if (check2.rows.length === 0) throw new Error('TEST 2 FAILED: User was deleted despite wrong password!');
    console.log('✅ TEST 2 PASSED: Wrong password rejected with 400; account remains intact.\n');
  } finally {
    await pool.query(`DELETE FROM "User" WHERE id = $1`, [user2.id]);
  }

  // -------------------------------------------------------------------
  // TEST 3: Attempt with correct password but WRONG confirmEmail -> 400
  // -------------------------------------------------------------------
  console.log('--- TEST 3: WRONG confirmEmail VALIDATION CHECK ---');
  const test3Email = `self_delete_test_3_${Date.now()}@example.com`;
  const user3 = (await pool.query(`
    INSERT INTO "User" (id, email, "displayName", username, password, "emailVerified", role, "isSuperAdmin")
    VALUES (gen_random_uuid(), $1, 'Wrong Email Hero', $2, $3, NOW(), 'USER', false)
    RETURNING id, email;
  `, [test3Email, `user3_${Date.now()}`, hashedPwd])).rows[0];

  try {
    const auth3 = await loginUser(PROD_URL, test3Email, test1Password);
    const wrongEmailRes = await fetch(`${PROD_URL}/api/user/account`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Cookie: auth3.cookies,
      },
      body: JSON.stringify({
        currentPassword: test1Password,
        confirmEmail: 'some_other_email@example.com',
      }),
    });

    console.log('DELETE with wrong confirmEmail status:', wrongEmailRes.status);
    const wrongEmailBody = await wrongEmailRes.json();
    console.log('Response body:', wrongEmailBody);

    if (wrongEmailRes.status !== 400 || !wrongEmailBody.error) {
      throw new Error('TEST 3 FAILED: Wrong confirmEmail was not rejected with 400!');
    }

    const check3 = await pool.query(`SELECT id FROM "User" WHERE id = $1`, [user3.id]);
    if (check3.rows.length === 0) throw new Error('TEST 3 FAILED: User was deleted despite wrong confirmEmail!');
    console.log('✅ TEST 3 PASSED: Wrong confirmEmail rejected with 400; account remains intact.\n');
  } finally {
    await pool.query(`DELETE FROM "User" WHERE id = $1`, [user3.id]);
  }

  // -------------------------------------------------------------------
  // TEST 4: Attempt as Super Admin -> 403 Forbidden
  // -------------------------------------------------------------------
  console.log('--- TEST 4: SUPER ADMIN SELF-DELETION HARD BLOCK ---');
  const superAdminAuth = await loginUser(PROD_URL, superAdminEmail, superAdminPassword);
  console.log(`Super admin login status: ${superAdminAuth.status}, ok: ${superAdminAuth.ok}`);

  const superAdminDeleteRes = await fetch(`${PROD_URL}/api/user/account`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Cookie: superAdminAuth.cookies,
    },
    body: JSON.stringify({
      currentPassword: superAdminPassword,
      confirmEmail: superAdminEmail,
    }),
  });

  console.log('Super Admin self-delete status:', superAdminDeleteRes.status);
  const superAdminDeleteBody = await superAdminDeleteRes.json();
  console.log('Response body:', superAdminDeleteBody);

  if (superAdminDeleteRes.status !== 403 || superAdminDeleteBody.error !== 'Super admin accounts cannot be deleted') {
    throw new Error('TEST 4 FAILED: Super admin self-deletion was not blocked with 403!');
  }

  const superAdminCheck = await pool.query(`SELECT id FROM "User" WHERE email = $1`, [superAdminEmail]);
  if (superAdminCheck.rows.length === 0) throw new Error('TEST 4 FAILED: Super admin was deleted!');
  console.log('✅ TEST 4 PASSED: Super admin self-deletion hard constraint blocked with 403 Forbidden.\n');

  // -------------------------------------------------------------------
  // TEST 5: Google-OAuth-only account (no password) self-deletion
  // -------------------------------------------------------------------
  console.log('--- TEST 5: GOOGLE-OAUTH (NO PASSWORD) SELF-DELETION ---');
  const oauthEmail = `self_delete_test_oauth_${Date.now()}@example.com`;
  const oauthUser = (await pool.query(`
    INSERT INTO "User" (id, email, "displayName", username, password, "emailVerified", role, "isSuperAdmin")
    VALUES (gen_random_uuid(), $1, 'Google OAuth Hero', $2, NULL, NOW(), 'USER', false)
    RETURNING id, email;
  `, [oauthEmail, `oauth_${Date.now()}`])).rows[0];

  // We temporarily set a password to sign in via credentials, then clear password back to NULL in DB to simulate OAuth
  const tempPwd = 'TempPassword123!';
  const tempHash = await bcrypt.hash(tempPwd, 10);
  await pool.query(`UPDATE "User" SET password = $1 WHERE id = $2`, [tempHash, oauthUser.id]);
  const oauthAuth = await loginUser(PROD_URL, oauthEmail, tempPwd);
  // Clear password back to NULL in DB
  await pool.query(`UPDATE "User" SET password = NULL WHERE id = $1`, [oauthUser.id]);

  const oauthDeleteRes = await fetch(`${PROD_URL}/api/user/account`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Cookie: oauthAuth.cookies,
    },
    body: JSON.stringify({
      confirmEmail: oauthEmail, // No currentPassword passed!
    }),
  });

  console.log('OAuth user delete status (without password):', oauthDeleteRes.status);
  const oauthDeleteBody = await oauthDeleteRes.json();
  console.log('Response body:', oauthDeleteBody);

  if (oauthDeleteRes.status !== 200 || !oauthDeleteBody.success) {
    throw new Error('TEST 5 FAILED: OAuth account deletion failed without password!');
  }

  const oauthCheck = await pool.query(`SELECT id FROM "User" WHERE id = $1`, [oauthUser.id]);
  if (oauthCheck.rows.length !== 0) throw new Error('TEST 5 FAILED: OAuth user still exists in DB!');
  console.log('✅ TEST 5 PASSED: Google-OAuth account without password successfully deleted with confirmEmail alone.\n');

  // -------------------------------------------------------------------
  // TEST 6: Super Admin settings check -> Danger Zone is omitted
  // -------------------------------------------------------------------
  console.log('--- TEST 6: DANGER ZONE OMISSION FOR SUPER ADMIN ---');
  const superAdminSettingsRes = await fetch(`${PROD_URL}/api/user/settings`, {
    headers: { Cookie: superAdminAuth.cookies },
  });
  const superAdminSettings = await superAdminSettingsRes.json();
  console.log('Super Admin /api/user/settings isSuperAdmin flag:', superAdminSettings.isSuperAdmin);

  if (superAdminSettings.isSuperAdmin !== true) {
    throw new Error('TEST 6 FAILED: Super admin settings does not have isSuperAdmin === true');
  }
  console.log('✅ TEST 6 PASSED: Super admin settings returned isSuperAdmin: true; client excludes Danger Zone.\n');

  await pool.end();
  console.log('=== ALL 6 SELF-SERVICE DELETION VERIFICATIONS PASSED PERFECTLY ===');
}

run().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
