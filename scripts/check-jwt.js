require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function main() {
  const client = new Client({ connectionString: process.env.DIRECT_URL });
  await client.connect();

  const appSettings = await client.query(`
    SELECT current_setting('app.settings.jwt_secret', true) as jwt_secret,
           current_setting('app.settings.service_role_key', true) as service_key,
           current_setting('app.settings.anon_key', true) as anon_key
  `);
  console.log('app settings:', appSettings.rows);

  const configRes = await client.query(`
    SELECT * FROM pg_settings WHERE name LIKE '%jwt%' OR name LIKE '%auth%'
  `);
  console.log('pg_settings config:', configRes.rows);

  await client.end();
}

main().catch(console.error);
