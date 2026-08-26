require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function main() {
  const client = new Client({ connectionString: process.env.DIRECT_URL });
  await client.connect();

  // Search all tables in all schemas for any columns named 'secret', 'key', 'token', 'jwt'
  const cols = await client.query(`
    SELECT table_schema, table_name, column_name 
    FROM information_schema.columns 
    WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
      AND (column_name LIKE '%secret%' OR column_name LIKE '%jwt%' OR column_name LIKE '%token%' OR column_name LIKE '%key%')
  `);
  console.log('Columns matching secret/jwt/key:');
  console.table(cols.rows);

  for (const row of cols.rows) {
    try {
      const data = await client.query(`SELECT "${row.column_name}" FROM "${row.table_schema}"."${row.table_name}" LIMIT 5`);
      if (data.rows.length > 0) {
        console.log(`Data in ${row.table_schema}.${row.table_name}.${row.column_name}:`, data.rows);
      }
    } catch (e) {
      // ignore
    }
  }

  await client.end();
}

main().catch(console.error);
