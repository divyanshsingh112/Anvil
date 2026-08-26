require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function main() {
  const client = new Client({ connectionString: process.env.DIRECT_URL });
  await client.connect();

  const fileName = `test-user/avatar-${Date.now()}.png`;
  const insertRes = await client.query(`
    INSERT INTO storage.objects (bucket_id, name, metadata)
    VALUES ('avatars', $1, '{"size": 8, "mimetype": "image/png"}')
    RETURNING *
  `, [fileName]);

  console.log('Inserted storage object:', insertRes.rows[0]);

  // Now test public fetch from Supabase
  const publicUrl = `https://mfjnufslktmuevjtdylv.supabase.co/storage/v1/object/public/avatars/${fileName}`;
  console.log('Fetching public URL:', publicUrl);
  const fetchRes = await fetch(publicUrl);
  console.log('Public URL Status:', fetchRes.status);
  const text = await fetchRes.text();
  console.log('Public URL Response:', text);

  await client.end();
}

main().catch(console.error);
