require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function main() {
  const client = new Client({ connectionString: process.env.DIRECT_URL });
  await client.connect();

  // Allow insert into storage.objects for avatars
  await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
          AND tablename = 'objects' 
          AND policyname = 'Allow Uploads to Avatars'
      ) THEN
        CREATE POLICY "Allow Uploads to Avatars"
        ON storage.objects FOR INSERT
        WITH CHECK (bucket_id = 'avatars');
      END IF;
    END $$;
  `);

  console.log('Upload policy configured.');

  // Also check if we can insert directly into storage.objects or upload via REST
  const testPath = `test-user/test-${Date.now()}.png`;
  const dummyBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]); // PNG magic header

  const restRes = await fetch(`https://mfjnufslktmuevjtdylv.supabase.co/storage/v1/object/avatars/${testPath}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'image/png',
    },
    body: dummyBuffer,
  });

  console.log('REST Upload Status (no auth header):', restRes.status);
  const restText = await restRes.text();
  console.log('REST Upload Response:', restText);

  await client.end();
}

main().catch(console.error);
