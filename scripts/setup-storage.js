require('dotenv').config({ path: '.env.local' });
const { Client } = require('pg');

async function main() {
  const client = new Client({ connectionString: process.env.DIRECT_URL });
  await client.connect();

  const res = await client.query(`
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES ('avatars', 'avatars', true, 2097152, ARRAY['image/jpeg', 'image/png', 'image/webp'])
    ON CONFLICT (id) DO UPDATE SET public = true
    RETURNING *
  `);
  console.log('Bucket in DB:', res.rows[0]);

  // Ensure public SELECT policy exists on storage.objects for avatars
  await client.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
          AND tablename = 'objects' 
          AND policyname = 'Public Access for Avatars'
      ) THEN
        CREATE POLICY "Public Access for Avatars"
        ON storage.objects FOR SELECT
        USING (bucket_id = 'avatars');
      END IF;
    END $$;
  `);

  console.log('Public select policy checked/created.');

  await client.end();
}

main().catch(console.error);
