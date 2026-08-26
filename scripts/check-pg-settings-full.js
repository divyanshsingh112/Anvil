require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function main() {
  const client = new Client({ connectionString: process.env.DIRECT_URL });
  await client.connect();

  const extensions = await client.query(`SELECT * FROM pg_extension`);
  console.log('Extensions:');
  console.table(extensions.rows);

  const customSettings = await client.query(`
    SELECT name, setting, category, source 
    FROM pg_settings 
    WHERE source NOT IN ('default', 'client')
  `);
  console.log('Non-default pg_settings:');
  console.table(customSettings.rows);

  await client.end();
}

main().catch(console.error);
