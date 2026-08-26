require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function main() {
  const client = new Client({ connectionString: process.env.DIRECT_URL });
  await client.connect();

  const triggers = await client.query(`
    SELECT trigger_name, event_manipulation, action_statement, action_timing
    FROM information_schema.triggers
    WHERE event_object_schema = 'storage' AND event_object_table = 'objects'
  `);
  console.log('triggers on storage.objects:');
  console.table(triggers.rows);

  await client.end();
}

main().catch(console.error);
