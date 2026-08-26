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
  console.log('=== VERIFYING ADMIN USER DELETION FLOW (DELETE_USERS) ===\n');
  console.log(`Target: ${PROD_URL}\n`);

  const superAdminEmail = 'sdivyansh110205@gmail.com';
  const superAdminPassword = 'ForgingHabits2026!';

  // 1. Sign in as super admin
  console.log('--- SIGNING IN AS SUPER ADMIN ---');
  const superAdminAuth = await loginUser(PROD_URL, superAdminEmail, superAdminPassword);
  console.log(`Super admin login status: ${superAdminAuth.status}, ok: ${superAdminAuth.ok}`);
  if (!superAdminAuth.ok) throw new Error('Super admin login failed');

  const superAdmin = (await pool.query(`SELECT id, email, role, "isSuperAdmin" FROM "User" WHERE email = $1`, [superAdminEmail])).rows[0];

  // -------------------------------------------------------------------
  // TEST 1: Create disposable test user with habits/completions/stats & delete
  // -------------------------------------------------------------------
  console.log('\n--- TEST 1: FULL DELETION FLOW OF TEST USER & CASCADING DATA ---');
  // Clean up any stale disposable users from prior runs
  await pool.query(`DELETE FROM "User" WHERE email LIKE 'disposable_test_%' OR username = 'disposable_hero'`);

  const disposableEmail = `disposable_test_${Date.now()}@example.com`;
  const disposableUsername = `disp_hero_${Date.now()}`;
  const disposablePassword = 'ForgingHabits2026!';
  const hashedPwd = await bcrypt.hash(disposablePassword, 10);

  const createRes = await pool.query(`
    INSERT INTO "User" (id, email, "displayName", username, password, "emailVerified", role, "isSuperAdmin")
    VALUES (gen_random_uuid(), $1, 'Disposable Hero', $2, $3, NOW(), 'USER', false)
    RETURNING id, email, "displayName", role, "createdAt";
  `, [disposableEmail, disposableUsername, hashedPwd]);
  const disposableUser = createRes.rows[0];
  console.log('Created disposable user in DB:', disposableUser);

  // Insert associated records: habit, completion, userStats, inventory
  const habitRes = await pool.query(`
    INSERT INTO "Habit" (id, "userId", name, class, difficulty, year, month)
    VALUES (gen_random_uuid(), $1, 'Morning Iron Forging', 'warrior', 'novice', 2026, 8)
    RETURNING id;
  `, [disposableUser.id]);
  const habitId = habitRes.rows[0].id;

  await pool.query(`
    INSERT INTO "Completion" (id, "habitId", "userId", date, "loggedAt", "completedAt", "timeBucket", "timeAccuracy")
    VALUES (gen_random_uuid(), $1, $2, CURRENT_DATE, NOW(), NOW(), 'morning', 'confirmed');
  `, [habitId, disposableUser.id]);

  await pool.query(`
    INSERT INTO "UserStats" ("userId", "totalCompletions", "updatedAt")
    VALUES ($1, 1, NOW());
  `, [disposableUser.id]);

  console.log(`Attached habit (${habitId}), completion, and stats to disposable user.`);

  // Perform DELETE via production API with correct confirmEmail
  const deleteRes = await fetch(`${PROD_URL}/api/admin/users/${disposableUser.id}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Cookie: superAdminAuth.cookies,
    },
    body: JSON.stringify({
      confirmEmail: disposableEmail,
    }),
  });

  console.log(`DELETE ${PROD_URL}/api/admin/users/${disposableUser.id} status:`, deleteRes.status);
  const deleteData = await deleteRes.json();
  console.log('Delete response payload:', deleteData);

  if (deleteRes.status !== 200 || !deleteData.success) {
    throw new Error(`TEST 1 FAILED: User deletion request failed with status ${deleteRes.status}`);
  }

  // Verify user is gone from DB
  const userCheck = await pool.query(`SELECT id FROM "User" WHERE id = $1`, [disposableUser.id]);
  const habitCheck = await pool.query(`SELECT id FROM "Habit" WHERE "userId" = $1`, [disposableUser.id]);
  const completionCheck = await pool.query(`SELECT id FROM "Completion" WHERE "userId" = $1`, [disposableUser.id]);
  const statsCheck = await pool.query(`SELECT "userId" FROM "UserStats" WHERE "userId" = $1`, [disposableUser.id]);

  console.log('Post-delete DB rows check:');
  console.log(`- User exists: ${userCheck.rows.length > 0} (count: ${userCheck.rows.length})`);
  console.log(`- Habit exists: ${habitCheck.rows.length > 0} (count: ${habitCheck.rows.length})`);
  console.log(`- Completion exists: ${completionCheck.rows.length > 0} (count: ${completionCheck.rows.length})`);
  console.log(`- UserStats exists: ${statsCheck.rows.length > 0} (count: ${statsCheck.rows.length})`);

  if (userCheck.rows.length !== 0 || habitCheck.rows.length !== 0 || completionCheck.rows.length !== 0 || statsCheck.rows.length !== 0) {
    throw new Error('TEST 1 FAILED: Cascading deletion did not fully purge user records from database!');
  }

  // Verify AdminAuditLog entry
  const auditRes = await pool.query(`
    SELECT id, "actorEmail", action, "targetUserId", "targetEmail", details, "createdAt"
    FROM "AdminAuditLog"
    WHERE "targetEmail" = $1 AND action = 'DELETE_USER'
    ORDER BY "createdAt" DESC LIMIT 1;
  `, [disposableEmail]);
  const auditLog = auditRes.rows[0];
  console.log('Audit log record for deletion:', auditLog);

  if (!auditLog || auditLog.action !== 'DELETE_USER' || !auditLog.details.includes(disposableEmail)) {
    throw new Error('TEST 1 FAILED: Audit log entry for deletion missing or incomplete!');
  }
  console.log('✅ TEST 1 PASSED: Test user and all cascading data cleanly removed; AdminAuditLog recorded action.\n');

  // -------------------------------------------------------------------
  // TEST 2: Attempt delete with wrong confirmEmail -> 400 & user NOT deleted
  // -------------------------------------------------------------------
  console.log('--- TEST 2: WRONG confirmEmail SAFEGUARD CHECK ---');
  const survivorEmail = `survivor_test_${Date.now()}@example.com`;
  const survivorUser = (await pool.query(`
    INSERT INTO "User" (id, email, "displayName", password, "emailVerified", role, "isSuperAdmin")
    VALUES (gen_random_uuid(), $1, 'Survivor Hero', $2, NOW(), 'USER', false)
    RETURNING id, email;
  `, [survivorEmail, hashedPwd])).rows[0];

  try {
    const wrongEmailRes = await fetch(`${PROD_URL}/api/admin/users/${survivorUser.id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Cookie: superAdminAuth.cookies,
      },
      body: JSON.stringify({
        confirmEmail: 'wrong_email@example.com',
      }),
    });

    console.log(`DELETE with wrong email status:`, wrongEmailRes.status);
    const wrongEmailBody = await wrongEmailRes.json();
    console.log('Response body:', wrongEmailBody);

    if (wrongEmailRes.status !== 400 || !wrongEmailBody.error) {
      throw new Error('TEST 2 FAILED: Wrong confirmEmail was not rejected with 400!');
    }

    const checkStillExists = await pool.query(`SELECT id FROM "User" WHERE id = $1`, [survivorUser.id]);
    if (checkStillExists.rows.length === 0) {
      throw new Error('TEST 2 FAILED: User was deleted despite wrong confirmation email!');
    }
    console.log('✅ TEST 2 PASSED: Wrong confirmEmail rejected with 400; target user remains safely in DB.\n');
  } finally {
    await pool.query(`DELETE FROM "User" WHERE id = $1`, [survivorUser.id]);
  }

  // -------------------------------------------------------------------
  // TEST 3: Attempt to delete Super Admin directly via API -> 403
  // -------------------------------------------------------------------
  console.log('--- TEST 3: ATTEMPT TO DELETE SUPER ADMIN VIA API ---');
  const deleteSuperAdminRes = await fetch(`${PROD_URL}/api/admin/users/${superAdmin.id}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      Cookie: superAdminAuth.cookies,
    },
    body: JSON.stringify({
      confirmEmail: superAdminEmail,
    }),
  });

  console.log(`DELETE Super Admin status:`, deleteSuperAdminRes.status);
  const deleteSuperAdminBody = await deleteSuperAdminRes.json();
  console.log('Response body:', deleteSuperAdminBody);

  if (deleteSuperAdminRes.status !== 403) {
    throw new Error('TEST 3 FAILED: Deletion of Super Admin was not blocked with 403!');
  }

  const superAdminStillExists = await pool.query(`SELECT id FROM "User" WHERE id = $1`, [superAdmin.id]);
  if (superAdminStillExists.rows.length === 0) {
    throw new Error('TEST 3 FAILED: Super admin was deleted!');
  }
  console.log('✅ TEST 3 PASSED: isSuperAdminTarget() hard constraint blocked super admin deletion with 403.\n');

  // -------------------------------------------------------------------
  // TEST 4: Attempt self-deletion via API -> 403
  // -------------------------------------------------------------------
  console.log('--- TEST 4: SELF-DELETION GUARD CHECK ---');
  // Create an admin user with DELETE_USERS permission to test self-deletion
  const adminUserEmail = `delete_admin_${Date.now()}@example.com`;
  const adminUser = (await pool.query(`
    INSERT INTO "User" (id, email, "displayName", password, "emailVerified", role, "isSuperAdmin", "adminPermissions")
    VALUES (gen_random_uuid(), $1, 'Delete Admin', $2, NOW(), 'ADMIN', false, ARRAY['DELETE_USERS'])
    RETURNING id, email;
  `, [adminUserEmail, hashedPwd])).rows[0];

  try {
    const adminUserAuth = await loginUser(PROD_URL, adminUserEmail, disposablePassword);
    console.log(`Delete-admin login status: ${adminUserAuth.status}, ok: ${adminUserAuth.ok}`);

    const selfDeleteRes = await fetch(`${PROD_URL}/api/admin/users/${adminUser.id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Cookie: adminUserAuth.cookies,
      },
      body: JSON.stringify({
        confirmEmail: adminUserEmail,
      }),
    });

    console.log(`Self-delete status:`, selfDeleteRes.status);
    const selfDeleteBody = await selfDeleteRes.json();
    console.log('Response body:', selfDeleteBody);

    if (selfDeleteRes.status !== 403) {
      throw new Error('TEST 4 FAILED: Self-deletion attempt was not blocked with 403!');
    }
    console.log('✅ TEST 4 PASSED: Self-deletion blocked with 403 Forbidden.\n');
  } finally {
    await pool.query(`DELETE FROM "User" WHERE id = $1`, [adminUser.id]);
  }

  // -------------------------------------------------------------------
  // TEST 5: Admin WITHOUT DELETE_USERS permission attempts delete route -> 403
  // -------------------------------------------------------------------
  console.log('--- TEST 5: ADMIN WITHOUT DELETE_USERS PERMISSION CHECK ---');
  const viewOnlyAdminEmail = `viewonly_admin_${Date.now()}@example.com`;
  const viewOnlyAdmin = (await pool.query(`
    INSERT INTO "User" (id, email, "displayName", password, "emailVerified", role, "isSuperAdmin", "adminPermissions")
    VALUES (gen_random_uuid(), $1, 'View Only Admin', $2, NOW(), 'ADMIN', false, ARRAY['VIEW_USERS'])
    RETURNING id, email;
  `, [viewOnlyAdminEmail, hashedPwd])).rows[0];

  // Target victim user
  const victimEmail = `victim_${Date.now()}@example.com`;
  const victimUser = (await pool.query(`
    INSERT INTO "User" (id, email, "displayName", password, "emailVerified", role, "isSuperAdmin")
    VALUES (gen_random_uuid(), $1, 'Victim User', $2, NOW(), 'USER', false)
    RETURNING id, email;
  `, [victimEmail, hashedPwd])).rows[0];

  try {
    const viewOnlyAuth = await loginUser(PROD_URL, viewOnlyAdminEmail, disposablePassword);
    const unauthorizedDeleteRes = await fetch(`${PROD_URL}/api/admin/users/${victimUser.id}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        Cookie: viewOnlyAuth.cookies,
      },
      body: JSON.stringify({
        confirmEmail: victimEmail,
      }),
    });

    console.log(`Unauthorized delete status:`, unauthorizedDeleteRes.status);
    const unauthorizedBody = await unauthorizedDeleteRes.json();
    console.log('Response body:', unauthorizedBody);

    if (unauthorizedDeleteRes.status !== 403 || !unauthorizedBody.error?.includes('DELETE_USERS')) {
      throw new Error('TEST 5 FAILED: Admin without DELETE_USERS was not rejected with 403!');
    }
    console.log('✅ TEST 5 PASSED: Admin without DELETE_USERS blocked with 403 Forbidden.\n');
  } finally {
    await pool.query(`DELETE FROM "User" WHERE id IN ($1, $2)`, [viewOnlyAdmin.id, victimUser.id]);
  }

  // -------------------------------------------------------------------
  // TEST 6: Audit log reconstruction verification
  // -------------------------------------------------------------------
  console.log('--- TEST 6: AUDIT LOG DETAIL & RECONSTRUCTION CHECK ---');
  console.log('Audit Record Details for Test 1 Deletion:');
  console.log({
    id: auditLog.id,
    actorEmail: auditLog.actorEmail,
    action: auditLog.action,
    targetUserId: auditLog.targetUserId,
    targetEmail: auditLog.targetEmail,
    details: auditLog.details,
    createdAt: auditLog.createdAt,
  });

  const hasActor = auditLog.actorEmail === superAdminEmail;
  const hasTarget = auditLog.targetEmail === disposableEmail;
  const hasAction = auditLog.action === 'DELETE_USER';
  const hasReconstructionDetails = auditLog.details.includes('displayName') && auditLog.details.includes('role');

  if (!hasActor || !hasTarget || !hasAction || !hasReconstructionDetails) {
    throw new Error('TEST 6 FAILED: Audit log does not contain adequate reconstruction metadata!');
  }
  console.log('✅ TEST 6 PASSED: Audit log entry contains complete actor, target, timestamp, and account metadata.\n');

  await pool.end();
  console.log('=== ALL 6 USER DELETION VERIFICATIONS PASSED PERFECTLY ===');
}

run().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
