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
  console.log('=== VERIFYING ADMIN ROLE & PERMISSION MANAGEMENT (MANAGE_ADMINS) ===\n');
  console.log(`Target: ${PROD_URL}\n`);

  const superAdminEmail = 'sdivyansh110205@gmail.com';
  const superAdminPassword = 'ForgingHabits2026!';

  const testUserEmail = 'alpha_closed_tester@anvilapp.online';
  const testUserPassword = 'ForgingHabits2026!';

  // Reset test user to regular USER first in DB
  const hashedPwd = await bcrypt.hash(testUserPassword, 10);
  await pool.query(`
    UPDATE "User"
    SET password = $1, "emailVerified" = NOW(), role = 'USER', "isSuperAdmin" = false, "adminPermissions" = ARRAY[]::TEXT[]
    WHERE email = $2;
  `, [hashedPwd, testUserEmail]);

  // Fetch IDs
  const superAdmin = (await pool.query(`SELECT id, email, role, "isSuperAdmin" FROM "User" WHERE email = $1`, [superAdminEmail])).rows[0];
  const testUser = (await pool.query(`SELECT id, email, role, "isSuperAdmin" FROM "User" WHERE email = $1`, [testUserEmail])).rows[0];

  // Sign in as super admin
  console.log('--- SIGNING IN AS SUPER ADMIN ---');
  const superAdminAuth = await loginUser(PROD_URL, superAdminEmail, superAdminPassword);
  console.log(`Super admin login status: ${superAdminAuth.status}, ok: ${superAdminAuth.ok}`);
  if (!superAdminAuth.ok) throw new Error('Super admin login failed');

  // -------------------------------------------------------------------
  // TEST 1: Super admin grants test user role=ADMIN with VIEW_USERS
  // -------------------------------------------------------------------
  console.log('\n--- TEST 1: GRANT ADMIN WITH VIEW_USERS TO TEST USER ---');
  const grantRes = await fetch(`${PROD_URL}/api/admin/users/${testUser.id}/role`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: superAdminAuth.cookies,
    },
    body: JSON.stringify({
      role: 'ADMIN',
      permissions: ['VIEW_USERS'],
    }),
  });

  console.log(`POST ${PROD_URL}/api/admin/users/${testUser.id}/role status:`, grantRes.status);
  const grantData = await grantRes.json();
  console.log('Grant response payload:', grantData);

  if (grantRes.status !== 200 || grantData.user?.role !== 'ADMIN') {
    throw new Error(`TEST 1 FAILED: Could not grant admin role! Status ${grantRes.status}`);
  }

  // Direct DB check for User and AdminAuditLog
  const dbUserAfterGrant = (await pool.query(`SELECT id, email, role, "isSuperAdmin", "adminPermissions" FROM "User" WHERE id = $1`, [testUser.id])).rows[0];
  console.log('Database row after grant:', dbUserAfterGrant);

  const dbAuditAfterGrant = (await pool.query(`
    SELECT id, "actorEmail", action, "targetEmail", details, "createdAt"
    FROM "AdminAuditLog"
    WHERE "targetUserId" = $1
    ORDER BY "createdAt" DESC LIMIT 1;
  `, [testUser.id])).rows[0];
  console.log('AdminAuditLog row after grant:', dbAuditAfterGrant);

  if (dbUserAfterGrant.role !== 'ADMIN' || !dbUserAfterGrant.adminPermissions.includes('VIEW_USERS') || dbAuditAfterGrant.action !== 'GRANT_ADMIN') {
    throw new Error('TEST 1 FAILED: DB or Audit log mismatch!');
  }
  console.log('✅ TEST 1 PASSED: User successfully granted ADMIN with VIEW_USERS; DB and AdminAuditLog updated.\n');

  // -------------------------------------------------------------------
  // TEST 2: Log in as newly promoted test admin -> verify read-only VIEW_USERS
  // -------------------------------------------------------------------
  console.log('--- TEST 2: TEST ADMIN ACCESS & PERMISSION BOUNDARIES ---');
  const testAdminAuth = await loginUser(PROD_URL, testUserEmail, testUserPassword);
  console.log(`Test admin login status: ${testAdminAuth.status}, ok: ${testAdminAuth.ok}`);

  // Test admin should be able to view user list
  const testAdminViewRes = await fetch(`${PROD_URL}/api/admin/users?limit=5`, {
    headers: { Cookie: testAdminAuth.cookies }
  });
  console.log(`GET ${PROD_URL}/api/admin/users as test admin status:`, testAdminViewRes.status);
  if (testAdminViewRes.status !== 200) {
    throw new Error(`TEST 2 FAILED: Test admin could not VIEW_USERS! Status ${testAdminViewRes.status}`);
  }

  // Test admin should NOT be able to grant/modify roles (lacks MANAGE_ADMINS)
  const anotherUser = (await pool.query(`SELECT id, email FROM "User" WHERE role = 'USER' LIMIT 1`)).rows[0];
  const testAdminManageRes = await fetch(`${PROD_URL}/api/admin/users/${anotherUser.id}/role`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: testAdminAuth.cookies,
    },
    body: JSON.stringify({
      role: 'ADMIN',
      permissions: ['VIEW_USERS'],
    }),
  });
  console.log(`POST ${PROD_URL}/api/admin/users/${anotherUser.id}/role as test admin (without MANAGE_ADMINS) status:`, testAdminManageRes.status);
  const testAdminManageBody = await testAdminManageRes.json();
  console.log('Response body:', testAdminManageBody);

  if (testAdminManageRes.status !== 403) {
    throw new Error(`TEST 2 FAILED: Test admin was able to modify roles without MANAGE_ADMINS! Status ${testAdminManageRes.status}`);
  }
  console.log('✅ TEST 2 PASSED: Test admin successfully used VIEW_USERS and was blocked (403) from MANAGE_ADMINS actions.\n');

  // -------------------------------------------------------------------
  // TEST 3: Attempt to modify super admin's row via direct API call -> 403
  // -------------------------------------------------------------------
  console.log('--- TEST 3: ATTEMPT TO MODIFY SUPER ADMIN VIA API ---');
  const modSuperAdminRes = await fetch(`${PROD_URL}/api/admin/users/${superAdmin.id}/role`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: superAdminAuth.cookies,
    },
    body: JSON.stringify({
      role: 'USER',
    }),
  });
  console.log(`POST ${PROD_URL}/api/admin/users/${superAdmin.id}/role (targeting Super Admin) status:`, modSuperAdminRes.status);
  const modSuperAdminBody = await modSuperAdminRes.json();
  console.log('Response body:', modSuperAdminBody);

  if (modSuperAdminRes.status !== 403) {
    throw new Error(`TEST 3 FAILED: Super admin target modification was not blocked! Status ${modSuperAdminRes.status}`);
  }
  console.log('✅ TEST 3 PASSED: Hard constraint isSuperAdminTarget() correctly rejected modification with 403.\n');

  // -------------------------------------------------------------------
  // TEST 4: Attempt self-modification via direct API call -> 403
  // -------------------------------------------------------------------
  console.log('--- TEST 4: SELF-MODIFICATION GUARD CHECK ---');
  const selfModRes = await fetch(`${PROD_URL}/api/admin/users/${testUser.id}/role`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: testAdminAuth.cookies,
    },
    body: JSON.stringify({
      role: 'ADMIN',
      permissions: ['VIEW_USERS', 'MANAGE_ADMINS'],
    }),
  });
  console.log(`POST ${PROD_URL}/api/admin/users/${testUser.id}/role (test admin targeting self) status:`, selfModRes.status);
  const selfModBody = await selfModRes.json();
  console.log('Response body:', selfModBody);

  if (selfModRes.status !== 403) {
    throw new Error(`TEST 4 FAILED: Self-modification was not blocked! Status ${selfModRes.status}`);
  }
  console.log('✅ TEST 4 PASSED: Self-modification attempt blocked with 403 Forbidden.\n');

  // -------------------------------------------------------------------
  // TEST 5: Revoke test admin back to USER
  // -------------------------------------------------------------------
  console.log('--- TEST 5: REVOKE ADMIN ROLE BACK TO USER ---');
  const revokeRes = await fetch(`${PROD_URL}/api/admin/users/${testUser.id}/role`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: superAdminAuth.cookies,
    },
    body: JSON.stringify({
      role: 'USER',
    }),
  });
  console.log(`POST ${PROD_URL}/api/admin/users/${testUser.id}/role status:`, revokeRes.status);
  const revokeData = await revokeRes.json();
  console.log('Revoke response payload:', revokeData);

  if (revokeRes.status !== 200 || revokeData.user?.role !== 'USER' || revokeData.user?.adminPermissions.length !== 0) {
    throw new Error(`TEST 5 FAILED: Failed to revoke admin role! Status ${revokeRes.status}`);
  }

  // Direct DB check
  const dbUserAfterRevoke = (await pool.query(`SELECT id, email, role, "isSuperAdmin", "adminPermissions" FROM "User" WHERE id = $1`, [testUser.id])).rows[0];
  console.log('Database row after revoke:', dbUserAfterRevoke);

  const dbAuditAfterRevoke = (await pool.query(`
    SELECT id, "actorEmail", action, "targetEmail", details, "createdAt"
    FROM "AdminAuditLog"
    WHERE "targetUserId" = $1
    ORDER BY "createdAt" DESC LIMIT 1;
  `, [testUser.id])).rows[0];
  console.log('AdminAuditLog row after revoke:', dbAuditAfterRevoke);

  if (dbUserAfterRevoke.role !== 'USER' || dbUserAfterRevoke.adminPermissions.length !== 0 || dbAuditAfterRevoke.action !== 'REVOKE_ADMIN') {
    throw new Error('TEST 5 FAILED: DB or Audit log mismatch on revoke!');
  }

  // Check nav stats for revoked user -> should show role === 'USER'
  const revokedStatsRes = await fetch(`${PROD_URL}/api/user/stats`, {
    headers: { Cookie: testAdminAuth.cookies }
  });
  const revokedStats = await revokedStatsRes.json();
  console.log('Revoked user /api/user/stats role:', revokedStats.role);
  if (revokedStats.role !== 'USER') {
    throw new Error('Revoked user still shows role !== USER in stats!');
  }
  console.log('✅ TEST 5 PASSED: Admin role revoked to USER; DB updated, audit log entry written, Admin Console nav hidden on next load.\n');

  // -------------------------------------------------------------------
  // TEST 6: Invalid permission string submission -> 400 Bad Request
  // -------------------------------------------------------------------
  console.log('--- TEST 6: INVALID PERMISSION STRING REJECTION ---');
  const invalidPermRes = await fetch(`${PROD_URL}/api/admin/users/${testUser.id}/role`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: superAdminAuth.cookies,
    },
    body: JSON.stringify({
      role: 'ADMIN',
      permissions: ['VIEW_USERS', 'DELETE_EVERYTHING', 'SUPER_HACK'],
    }),
  });
  console.log(`POST ${PROD_URL}/api/admin/users/${testUser.id}/role (with invalid permissions) status:`, invalidPermRes.status);
  const invalidPermBody = await invalidPermRes.json();
  console.log('Response body:', invalidPermBody);

  if (invalidPermRes.status !== 400 || !invalidPermBody.error?.includes('DELETE_EVERYTHING')) {
    throw new Error(`TEST 6 FAILED: Invalid permission was not rejected with 400! Status ${invalidPermRes.status}`);
  }
  console.log('✅ TEST 6 PASSED: Invalid permission string rejected with 400 Bad Request and descriptive error message.\n');

  await pool.end();
  console.log('=== ALL 6 PRODUCTION VERIFICATION TESTS PASSED PERFECTLY ===');
}

run().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
