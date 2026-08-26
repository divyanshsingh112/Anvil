require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function main() {
  const client = new Client({ connectionString: process.env.DIRECT_URL });
  await client.connect();

  const policies = await client.query(`SELECT * FROM pg_policies WHERE schemaname = 'storage'`);
  console.log('--- STORAGE POLICIES ---');
  console.table(policies.rows);

  const funcs = await client.query(`
    SELECT proname 
    FROM pg_proc 
    JOIN pg_namespace ON pg_proc.pronamespace = pg_namespace.oid 
    WHERE pg_namespace.nspname = 'storage'
  `);
  console.log('--- STORAGE FUNCTIONS ---');
  console.table(funcs.rows);

  await client.end();
}

main().catch(console.error);
