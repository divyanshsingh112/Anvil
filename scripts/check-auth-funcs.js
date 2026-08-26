require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function main() {
  const client = new Client({ connectionString: process.env.DIRECT_URL });
  await client.connect();

  const authFuncs = await client.query(`
    SELECT proname, prosrc 
    FROM pg_proc 
    JOIN pg_namespace ON pg_proc.pronamespace = pg_namespace.oid 
    WHERE pg_namespace.nspname = 'auth'
  `);
  console.log('auth functions:', authFuncs.rows.map(r => ({ name: r.proname, src: r.prosrc?.substring(0, 100) })));

  await client.end();
}

main().catch(console.error);
