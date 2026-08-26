require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function main() {
  const client = new Client({ connectionString: process.env.DIRECT_URL });
  await client.connect();
  
  const res = await client.query(`
    SELECT name, setting 
    FROM pg_settings 
    WHERE name LIKE '%jwt%' OR name LIKE '%secret%' OR name LIKE '%supabase%'
  `);
  console.log('pg_settings:', res.rows);

  const authTables = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'auth'
  `);
  console.log('auth tables:', authTables.rows);

  const vaultTables = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'vault'
  `);
  console.log('vault tables:', vaultTables.rows);

  if (vaultTables.rows.some(r => r.table_name === 'decrypted_secrets')) {
    const secrets = await client.query(`SELECT * FROM vault.decrypted_secrets`);
    console.log('vault.decrypted_secrets:', secrets.rows);
  }

  await client.end();
}

main().catch(console.error);
