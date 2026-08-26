require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function main() {
  console.log('Connected using DATABASE_URL...');
  
  const usersRes = await pool.query(`
    SELECT id, email, "displayName", "createdAt", "emailVerified"
    FROM "User"
    WHERE email ILIKE '%sdivyansh%' OR email ILIKE '%alpha%' OR email ILIKE '%anvilapp.online%'
    ORDER BY "createdAt" DESC
  `);
  console.log('\n--- USERS MATCHING QUERY ---');
  console.table(usersRes.rows);

  const allUsersRes = await pool.query(`
    SELECT id, email, "displayName", "createdAt", "emailVerified"
    FROM "User"
    ORDER BY "createdAt" DESC
    LIMIT 20
  `);
  console.log('\n--- RECENT 20 USERS ---');
  console.table(allUsersRes.rows);

  const tokensRes = await pool.query(`
    SELECT identifier, token, expires
    FROM "VerificationToken"
    ORDER BY expires DESC
  `);
  console.log('\n--- ALL VERIFICATION TOKENS ---');
  console.table(tokensRes.rows);

  await pool.end();
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
