require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function cleanupPhantomAvatars() {
  console.log('=== PART 2: CLEANING UP PHANTOM AVATAR URLS ===\n');

  // 1. Fetch all storage objects in 'avatars' bucket
  const objectsRes = await pool.query(`
    SELECT name FROM storage.objects WHERE bucket_id = 'avatars'
  `);
  const validObjectPaths = new Set(objectsRes.rows.map(r => r.name));
  console.log(`Found ${validObjectPaths.size} actual objects in storage.objects:`);
  validObjectPaths.forEach(p => console.log(` - ${p}`));

  // 2. Fetch all users with a supabase avatarUrl
  const usersRes = await pool.query(`
    SELECT id, email, "displayName", gender, "avatarUrl"
    FROM "User"
    WHERE "avatarUrl" LIKE '%supabase.co/storage/v1/object/public/avatars/%'
  `);

  console.log(`\nFound ${usersRes.rows.length} users with Supabase avatarUrl stored.`);

  const resetUsers = [];

  for (const user of usersRes.rows) {
    // Extract storage path from avatarUrl (e.g. userId/timestamp.ext)
    const match = user.avatarUrl.match(/\/storage\/v1\/object\/public\/avatars\/(.+)$/);
    const storagePath = match ? match[1] : null;

    const exists = storagePath && validObjectPaths.has(storagePath);
    console.log(`User: ${user.email} | Extracted Path: ${storagePath} | Exists in Storage: ${exists}`);

    if (!exists) {
      // Reset avatarUrl to null
      await pool.query(`
        UPDATE "User"
        SET "avatarUrl" = NULL
        WHERE id = $1
      `, [user.id]);

      resetUsers.push({
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        gender: user.gender,
        oldAvatarUrl: user.avatarUrl,
      });
    }
  }

  console.log('\n--- CLEANUP REPORT ---');
  console.log(`Total users with phantom avatar URLs reset to null: ${resetUsers.length}`);
  console.log(JSON.stringify(resetUsers, null, 2));

  await pool.end();
  return resetUsers;
}

cleanupPhantomAvatars().catch(err => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});
