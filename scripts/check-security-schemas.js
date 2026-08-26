require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function main() {
  const client = new Client({ connectionString: process.env.DIRECT_URL });
  await client.connect();

  const instances = await client.query(`SELECT * FROM auth.instances`);
  console.log('auth.instances:', instances.rows);

  const schemaMigrations = await client.query(`SELECT * FROM auth.schema_migrations`);
  console.log('auth.schema_migrations:', schemaMigrations.rows.slice(-5));

  // Check all schemas in postgres
  const schemas = await client.query(`SELECT schema_name FROM information_schema.schemata`);
  console.log('schemas:', schemas.rows);

  // Check if there are any tables in pgsodium / vault / supabase
  const pgsodiumTables = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema IN ('pgsodium', 'vault', 'supabase_functions', 'extensions')`);
  console.log('tables in security schemas:', pgsodiumTables.rows);

  await client.end();
}

main().catch(console.error);
