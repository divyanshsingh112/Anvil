require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function main() {
  const client = new Client({ connectionString: process.env.DIRECT_URL });
  await client.connect();

  const roles = await client.query(`SELECT rolname, rolconfig FROM pg_roles`);
  console.log('pg_roles configs:');
  for (const r of roles.rows) {
    if (r.rolconfig) console.log(r.rolname, r.rolconfig);
  }

  const descriptions = await client.query(`
    SELECT objoid::regclass, description 
    FROM pg_description 
    WHERE description LIKE '%jwt%' OR description LIKE '%secret%'
    LIMIT 20
  `);
  console.log('descriptions:', descriptions.rows);

  await client.end();
}

main().catch(console.error);
