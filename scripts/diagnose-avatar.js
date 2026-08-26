require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function checkAvatars() {
  const res = await pool.query('SELECT id, email, "displayName", gender, "avatarUrl" FROM "User" WHERE "avatarUrl" IS NOT NULL');
  console.log(`Found ${res.rows.length} users with non-null avatarUrl:`);
  console.log(JSON.stringify(res.rows, null, 2));

  for (const user of res.rows) {
    console.log(`\nTesting avatarUrl for ${user.email}: ${user.avatarUrl}`);
    try {
      const fetchRes = await fetch(user.avatarUrl, { method: 'GET' });
      console.log(`HTTP Status: ${fetchRes.status} ${fetchRes.statusText}`);
      console.log(`Content-Type: ${fetchRes.headers.get('content-type')}`);
      console.log(`Content-Length: ${fetchRes.headers.get('content-length')}`);
      if (!fetchRes.ok) {
        const text = await fetchRes.text();
        console.log(`Response error body: ${text}`);
      }
    } catch (e) {
      console.error(`Fetch exception:`, e.message);
    }
  }

  // Also inspect storage bucket policies and storage.objects in Supabase if accessible
  console.log('\n--- Checking Supabase Storage Buckets & Policies ---');
  try {
    const buckets = await pool.query('SELECT id, name, public, "owner" FROM storage.buckets');
    console.log('storage.buckets:', buckets.rows);
  } catch (e) {
    console.log('Error querying storage.buckets:', e.message);
  }

  try {
    const policies = await pool.query(`
      SELECT polname, polcmd, polroles::regrole[], polqual, polwithcheck 
      FROM pg_policy 
      JOIN pg_class ON pg_policy.polrelid = pg_class.oid 
      JOIN pg_namespace ON pg_class.relnamespace = pg_namespace.oid 
      WHERE pg_namespace.nspname = 'storage' AND pg_class.relname = 'objects';
    `);
    console.log('storage.objects policies:', policies.rows);
  } catch (e) {
    console.log('Error querying storage policies:', e.message);
  }

  await pool.end();
}

checkAvatars().catch(console.error);
