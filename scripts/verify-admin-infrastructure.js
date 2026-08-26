require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function runVerification() {
  console.log('=== VERIFYING ROLE-BASED ADMIN INFRASTRUCTURE ===\n');

  // 1. Column introspection for User table
  console.log('--- 1. SCHEMA INTROSPECTION (User columns) ---');
  const colsRes = await pool.query(`
    SELECT 
      column_name, 
      data_type, 
      udt_name,
      is_nullable, 
      column_default
    FROM information_schema.columns
    WHERE table_name = 'User'
      AND column_name IN ('role', 'adminPermissions', 'isSuperAdmin')
    ORDER BY column_name;
  `);
  console.table(colsRes.rows);

  // 2. Table introspection for AdminAuditLog
  console.log('\n--- 2. SCHEMA INTROSPECTION (AdminAuditLog table) ---');
  const auditCols = await pool.query(`
    SELECT 
      column_name, 
      data_type, 
      udt_name,
      is_nullable, 
      column_default
    FROM information_schema.columns
    WHERE table_name = 'AdminAuditLog'
    ORDER BY ordinal_position;
  `);
  console.table(auditCols.rows);

  // 3. Super Admin Bootstrap Check (sdivyansh110205@gmail.com)
  console.log('\n--- 3. BOOTSTRAPPED SUPER ADMIN RECORD ---');
  const adminRes = await pool.query(`
    SELECT 
      id, 
      email, 
      "displayName", 
      role, 
      "isSuperAdmin", 
      "adminPermissions"
    FROM "User"
    WHERE email = 'sdivyansh110205@gmail.com';
  `);
  console.table(adminRes.rows);

  const admin = adminRes.rows[0];
  if (!admin) {
    throw new Error('Super admin user sdivyansh110205@gmail.com not found!');
  }

  const expectedPerms = ['VIEW_USERS', 'DELETE_USERS', 'MANAGE_ADMINS'];
  const hasExpectedPerms = Array.isArray(admin.adminPermissions) &&
    admin.adminPermissions.length === expectedPerms.length &&
    expectedPerms.every(p => admin.adminPermissions.includes(p));

  console.log(`- role === 'ADMIN': ${admin.role === 'ADMIN'} (${admin.role})`);
  console.log(`- isSuperAdmin === true: ${admin.isSuperAdmin === true} (${admin.isSuperAdmin})`);
  console.log(`- adminPermissions matches ['VIEW_USERS','DELETE_USERS','MANAGE_ADMINS']: ${hasExpectedPerms} (${JSON.stringify(admin.adminPermissions)})`);

  if (admin.role !== 'ADMIN' || admin.isSuperAdmin !== true || !hasExpectedPerms) {
    throw new Error('Bootstrap verification failed for sdivyansh110205@gmail.com!');
  }

  // 4. Other Existing Users Check
  console.log('\n--- 4. OTHER EXISTING USERS CHECK ---');
  const otherUsersRes = await pool.query(`
    SELECT 
      id, 
      email, 
      role, 
      "isSuperAdmin", 
      "adminPermissions"
    FROM "User"
    WHERE email != 'sdivyansh110205@gmail.com';
  `);
  console.table(otherUsersRes.rows);

  let allOtherUsersValid = true;
  for (const u of otherUsersRes.rows) {
    const isRoleUser = u.role === 'USER';
    const isSuperAdminFalse = u.isSuperAdmin === false;
    const isPermsEmptyArray = Array.isArray(u.adminPermissions) && u.adminPermissions.length === 0;

    if (!isRoleUser || !isSuperAdminFalse || !isPermsEmptyArray) {
      console.error(`❌ User ${u.email} does not have default values: role=${u.role}, isSuperAdmin=${u.isSuperAdmin}, adminPermissions=${JSON.stringify(u.adminPermissions)}`);
      allOtherUsersValid = false;
    }
  }

  if (allOtherUsersValid) {
    console.log(`✅ All ${otherUsersRes.rows.length} other user(s) have role='USER', isSuperAdmin=false, adminPermissions=[] (empty array, not null).`);
  } else {
    throw new Error('Non-admin users verification failed!');
  }

  // 5. Test AdminAuditLog insertion & retrieval
  console.log('\n--- 5. ADMIN AUDIT LOG INSERTION TEST ---');
  const testInsert = await pool.query(`
    INSERT INTO "AdminAuditLog" ("id", "actorId", "actorEmail", "action", "targetUserId", "targetEmail", "details")
    VALUES (gen_random_uuid(), $1, $2, 'BOOTSTRAP_VERIFY_TEST', NULL, NULL, 'Self test')
    RETURNING *;
  `, [admin.id, admin.email]);
  console.log('Inserted test audit record:', testInsert.rows[0]);

  await pool.query(`DELETE FROM "AdminAuditLog" WHERE "action" = 'BOOTSTRAP_VERIFY_TEST'`);
  console.log('Cleaned up test audit record.');

  await pool.end();
  console.log('\n=== ALL VERIFICATIONS PASSED SUCCESSFULLY ===');
}

runVerification().catch(err => {
  console.error('Verification error:', err);
  process.exit(1);
});
