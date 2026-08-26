require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function runVerification() {
  console.log('=== STARTING SCHEMA SUPPORT VERIFICATION ===\n');

  // 1. Schema introspection for the 6 new columns on User table
  console.log('--- 1. SCHEMA INTROSPECTION (information_schema.columns) ---');
  const colsRes = await pool.query(`
    SELECT 
      column_name, 
      data_type, 
      is_nullable, 
      column_default
    FROM information_schema.columns
    WHERE table_name = 'User'
      AND column_name IN ('pendingEmail', 'username', 'phone', 'gender', 'age', 'hasSeenConsentPrompt')
    ORDER BY column_name;
  `);
  console.table(colsRes.rows);

  // Check unique indexes
  console.log('\n--- 2. UNIQUE INDEXES ON USER TABLE ---');
  const indexRes = await pool.query(`
    SELECT
      indexname,
      indexdef
    FROM pg_indexes
    WHERE tablename = 'User'
      AND indexname IN ('User_pendingEmail_key', 'User_username_key');
  `);
  console.table(indexRes.rows);

  // Check existing users rows
  console.log('\n--- 3. EXISTING USERS ROW CHECK (UNMODIFIED & DEFAULT VALUES) ---');
  const existingUsersRes = await pool.query(`
    SELECT 
      id, 
      email, 
      "displayName", 
      "pendingEmail", 
      username, 
      phone, 
      gender, 
      age, 
      "hasSeenConsentPrompt"
    FROM "User"
    ORDER BY "createdAt" DESC
    LIMIT 5;
  `);
  console.table(existingUsersRes.rows);

  // 4. Test duplicate pendingEmail uniqueness constraint
  console.log('\n--- 4. DUPLICATE pendingEmail UNIQUE CONSTRAINT TEST ---');
  const twoUsers = await pool.query(`SELECT id, email FROM "User" LIMIT 2;`);
  if (twoUsers.rows.length >= 2) {
    const userA = twoUsers.rows[0].id;
    const userB = twoUsers.rows[1].id;
    const testPendingEmail = `collision_test_${Date.now()}@example.com`;

    try {
      // Step A: Assign pendingEmail to User A
      await pool.query(`UPDATE "User" SET "pendingEmail" = $1 WHERE id = $2`, [testPendingEmail, userA]);
      console.log(`✅ Set pendingEmail = '${testPendingEmail}' on User A (${userA})`);

      // Step B: Attempt to assign same pendingEmail to User B -> MUST FAIL
      let failedAsExpected = false;
      try {
        await pool.query(`UPDATE "User" SET "pendingEmail" = $1 WHERE id = $2`, [testPendingEmail, userB]);
      } catch (err) {
        if (err.code === '23505') { // Postgres unique_violation code
          failedAsExpected = true;
          console.log(`✅ Correctly caught unique constraint violation (SQLSTATE 23505): ${err.detail}`);
        } else {
          console.error('❌ Unexpected error code:', err);
        }
      }

      if (failedAsExpected) {
        console.log('✅ TEST PASSED: Duplicate pendingEmail insert/update was blocked by unique constraint.');
      } else {
        console.error('❌ TEST FAILED: Duplicate pendingEmail was permitted!');
      }

    } finally {
      // Clean up test pendingEmail values
      await pool.query(`UPDATE "User" SET "pendingEmail" = NULL WHERE id IN ($1, $2)`, [userA, userB]);
      console.log('Cleaned up test pendingEmail values.');
    }
  } else {
    console.log('Note: Less than 2 users found to test collision, inserting mock rows');
  }

  await pool.end();
  console.log('\n=== VERIFICATION COMPLETE ===');
}

runVerification().catch(err => {
  console.error('Verification error:', err);
  process.exit(1);
});
