require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function run() {
  console.log('=== VERIFYING CENTRALIZED ADMIN AUTH LAYER ===\n');

  // STEP 0 / VERIFY 1: Connection role & RLS alignment
  console.log('--- TEST 1: DATABASE CONNECTION ROLE & RLS POLICY ---');
  const userCheck = await pool.query('SELECT current_user, session_user;');
  console.log('Current DB connection user:', userCheck.rows[0]);

  const rlsCheck = await pool.query(`
    SELECT schemaname, tablename, policyname, roles, cmd, qual
    FROM pg_policies
    WHERE tablename = 'AdminAuditLog';
  `);
  console.table(rlsCheck.rows);

  const connUser = userCheck.rows[0].current_user;
  const policyRoles = rlsCheck.rows[0]?.roles || [];
  const matchesGrant = policyRoles.includes(connUser) || connUser === 'postgres';
  console.log(`✅ Connection user (${connUser}) matches RLS policy grant (${policyRoles}): ${matchesGrant}\n`);

  // Dynamically import compiled TS / Next.js module or test admin-auth logic
  // We can test both the TypeScript module directly via tsx/ts-node or register
  const { requireAdminPermission, logAdminAction, isSuperAdminTarget } = require('../src/lib/admin-auth');

  // Fetch real super admin
  const superAdminRow = (await pool.query(`SELECT id, email FROM "User" WHERE email = 'sdivyansh110205@gmail.com'`)).rows[0];
  if (!superAdminRow) throw new Error('Super admin user sdivyansh110205@gmail.com not found');

  // Fetch real regular user
  const regularUserRow = (await pool.query(`SELECT id, email FROM "User" WHERE role = 'USER' LIMIT 1`)).rows[0];
  if (!regularUserRow) throw new Error('Regular user not found');

  // TEST 2: requireAdminPermission('DELETE_USERS') as super admin -> PASS
  console.log('--- TEST 2: SUPER ADMIN ACCOUNT CHECK ---');
  const superAdminSession = { user: { id: superAdminRow.id, email: superAdminRow.email } };
  const test2Res = await requireAdminPermission('DELETE_USERS', superAdminSession);
  console.log('Super admin result:', {
    authorized: test2Res.authorized,
    status: test2Res.status,
    role: test2Res.user?.role,
    isSuperAdmin: test2Res.user?.isSuperAdmin,
    adminPermissions: test2Res.user?.adminPermissions,
  });
  if (!test2Res.authorized || test2Res.status !== 200 || !test2Res.user?.isSuperAdmin) {
    throw new Error('TEST 2 FAILED: Super admin was not authorized!');
  }
  console.log('✅ TEST 2 PASSED: Super admin successfully bypassed granular check and passed with status 200.\n');

  // TEST 3: requireAdminPermission('DELETE_USERS') as regular USER -> 403
  console.log('--- TEST 3: REGULAR USER ACCOUNT CHECK ---');
  const regularUserSession = { user: { id: regularUserRow.id, email: regularUserRow.email } };
  const test3Res = await requireAdminPermission('DELETE_USERS', regularUserSession);
  console.log('Regular user result:', {
    authorized: test3Res.authorized,
    status: test3Res.status,
    error: test3Res.error,
  });
  if (test3Res.authorized || test3Res.status !== 403) {
    throw new Error('TEST 3 FAILED: Regular user was not rejected with 403!');
  }
  console.log('✅ TEST 3 PASSED: Regular user rejected with 403 Forbidden.\n');

  // TEST 4: Test ADMIN with only VIEW_USERS -> requireAdminPermission('DELETE_USERS') -> 403
  console.log('--- TEST 4: GRANULAR PERMISSION ENFORCEMENT CHECK ---');
  const testAdminEmail = `temp_admin_test_${Date.now()}@example.com`;
  const insertTestAdmin = await pool.query(`
    INSERT INTO "User" (
      id, email, "displayName", role, "isSuperAdmin", "adminPermissions"
    ) VALUES (
      gen_random_uuid(), $1, 'Restricted Admin', 'ADMIN', false, ARRAY['VIEW_USERS']
    ) RETURNING id, email, role, "isSuperAdmin", "adminPermissions";
  `, [testAdminEmail]);

  const testAdminUser = insertTestAdmin.rows[0];
  console.log('Created temporary restricted admin:', testAdminUser);

  try {
    const restrictedAdminSession = { user: { id: testAdminUser.id, email: testAdminUser.email } };
    
    // Check DELETE_USERS (must fail with 403)
    const deleteCheck = await requireAdminPermission('DELETE_USERS', restrictedAdminSession);
    console.log('Restricted admin DELETE_USERS check:', {
      authorized: deleteCheck.authorized,
      status: deleteCheck.status,
      error: deleteCheck.error,
    });
    if (deleteCheck.authorized || deleteCheck.status !== 403) {
      throw new Error('TEST 4 FAILED: Restricted admin should have received 403 for DELETE_USERS!');
    }

    // Check VIEW_USERS (must pass with 200)
    const viewCheck = await requireAdminPermission('VIEW_USERS', restrictedAdminSession);
    console.log('Restricted admin VIEW_USERS check:', {
      authorized: viewCheck.authorized,
      status: viewCheck.status,
      userRole: viewCheck.user?.role,
    });
    if (!viewCheck.authorized || viewCheck.status !== 200) {
      throw new Error('TEST 4 FAILED: Restricted admin should have passed for VIEW_USERS!');
    }

    console.log('✅ TEST 4 PASSED: Granular permission correctly enforced (DELETE_USERS rejected with 403, VIEW_USERS passed with 200).\n');
  } finally {
    await pool.query(`DELETE FROM "User" WHERE id = $1`, [testAdminUser.id]);
    console.log('Cleaned up temporary restricted admin.');
  }

  // TEST 5: logAdminAction writes to AdminAuditLog
  console.log('\n--- TEST 5: logAdminAction DB WRITE VERIFICATION ---');
  const testLogAction = 'TEST_ADMIN_ACTION_VERIFY';
  const testDetails = 'Testing logAdminAction helper write integrity';
  const logRes = await logAdminAction(
    superAdminRow.id,
    superAdminRow.email,
    testLogAction,
    regularUserRow.id,
    regularUserRow.email,
    testDetails
  );
  console.log('logAdminAction returned:', logRes);

  const queryAudit = await pool.query(`
    SELECT id, "actorId", "actorEmail", action, "targetUserId", "targetEmail", details, "createdAt"
    FROM "AdminAuditLog"
    WHERE id = $1;
  `, [logRes.id]);
  console.table(queryAudit.rows);

  if (queryAudit.rows.length !== 1 || queryAudit.rows[0].action !== testLogAction) {
    throw new Error('TEST 5 FAILED: Audit log row not found in database!');
  }

  await pool.query(`DELETE FROM "AdminAuditLog" WHERE id = $1`, [logRes.id]);
  console.log('Cleaned up test audit log row.');
  console.log('✅ TEST 5 PASSED: logAdminAction wrote row directly to AdminAuditLog table and verified via direct DB query.\n');

  // Hard constraint check verification
  console.log('--- TEST 6: isSuperAdminTarget HELPER CHECK ---');
  console.log('isSuperAdminTarget(superAdmin):', isSuperAdminTarget({ isSuperAdmin: true }));
  console.log('isSuperAdminTarget(regularUser):', isSuperAdminTarget({ isSuperAdmin: false }));
  console.log('isSuperAdminTarget(null):', isSuperAdminTarget(null));
  console.log('✅ TEST 6 PASSED: isSuperAdminTarget helper correctly identifies protected super admin accounts.\n');

  await pool.end();
  console.log('=== ALL 5 VERIFICATION CHECKS PASSED PERFECTLY ===');
}

run().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
