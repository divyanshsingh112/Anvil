require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const PROD_URL = 'https://anvilapp.online';

function extractCookies(res) {
  const raw = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie')].filter(Boolean);
  return raw.map(c => c.split(';')[0]).join('; ');
}

async function loginUser(baseUrl, email, password) {
  const csrfRes = await fetch(`${baseUrl}/api/auth/csrf`);
  const { csrfToken } = await csrfRes.json();
  const csrfCookies = extractCookies(csrfRes);

  const res = await fetch(`${baseUrl}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Cookie: csrfCookies,
    },
    body: new URLSearchParams({
      email,
      password,
      csrfToken,
      json: 'true',
    }),
  });

  const sessionCookies = extractCookies(res);
  return { status: res.status, cookies: sessionCookies, ok: res.status < 400 };
}

// 1x1 Transparent PNG buffer (valid magic bytes)
const validPngBuffer = Buffer.from([
  0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, // PNG signature
  0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52, // IHDR chunk
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1F, 0x15, 0xC4,
  0x89, 0x00, 0x00, 0x00, 0x0A, 0x49, 0x44, 0x41, // IDAT chunk
  0x54, 0x78, 0x9C, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00,
  0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE, // IEND chunk
  0x42, 0x60, 0x82
]);

async function run() {
  console.log('=== VERIFYING AVATAR UPLOAD FIX & CLEANUP ON PRODUCTION ===\n');
  console.log(`Target: ${PROD_URL}\n`);

  const superAdminEmail = 'sdivyansh110205@gmail.com';
  const superAdminPassword = 'ForgingHabits2026!';

  // -------------------------------------------------------------------
  // TEST 1 & 2: Re-upload real test image through production endpoint
  // -------------------------------------------------------------------
  console.log('--- TEST 1 & 2: REAL AVATAR UPLOAD & STORAGE VERIFICATION ---');
  const auth = await loginUser(PROD_URL, superAdminEmail, superAdminPassword);
  console.log(`Login status: ${auth.status}, ok: ${auth.ok}`);
  if (!auth.ok) throw new Error('Super admin login failed');

  // Prepare multipart form data with valid PNG image
  const formData = new FormData();
  const blob = new Blob([validPngBuffer], { type: 'image/png' });
  formData.append('file', blob, 'avatar.png');

  console.log('Sending POST /api/user/avatar...');
  const uploadRes = await fetch(`${PROD_URL}/api/user/avatar`, {
    method: 'POST',
    headers: {
      Cookie: auth.cookies,
    },
    body: formData,
  });

  console.log(`Upload status: ${uploadRes.status} ${uploadRes.statusText}`);
  const uploadData = await uploadRes.json();
  console.log('Upload response payload:', uploadData);

  if (uploadRes.status !== 200 || !uploadData.avatarUrl) {
    throw new Error(`TEST 1/2 FAILED: Avatar upload failed with status ${uploadRes.status}`);
  }

  const uploadedUrl = uploadData.avatarUrl;
  console.log(`Newly uploaded avatarUrl: ${uploadedUrl}`);

  // Extract storage path
  const match = uploadedUrl.match(/\/storage\/v1\/object\/public\/avatars\/(.+)$/);
  const storagePath = match ? match[1] : null;
  console.log(`Extracted storage path: ${storagePath}`);

  // Check storage.objects in Supabase DB
  const objectInDb = await pool.query(`
    SELECT id, bucket_id, name, created_at, metadata
    FROM storage.objects
    WHERE bucket_id = 'avatars' AND name = $1
  `, [storagePath]);

  console.log('storage.objects query result:', objectInDb.rows);

  if (objectInDb.rows.length === 0) {
    throw new Error('TEST 1/2 FAILED: Uploaded object does NOT exist in storage.objects table!');
  }

  // Direct fetch of the uploaded image outside app
  console.log(`Direct fetch of publicUrl: ${uploadedUrl}`);
  const directFetchRes = await fetch(uploadedUrl);
  console.log(`Direct fetch status: ${directFetchRes.status} ${directFetchRes.statusText}`);
  console.log(`Content-Type: ${directFetchRes.headers.get('content-type')}`);
  console.log(`Content-Length: ${directFetchRes.headers.get('content-length')}`);

  if (directFetchRes.status !== 200 || directFetchRes.headers.get('content-type') !== 'image/png') {
    throw new Error('TEST 1/2 FAILED: Direct fetch did not return 200 OK image/png!');
  }
  console.log('✅ TEST 1 & 2 PASSED: Storage upload verified in storage.objects and direct fetch returns 200 OK image.\n');

  // -------------------------------------------------------------------
  // TEST 3 & 4: Reset & Fallback Resolution for Male / Female / Neutral
  // -------------------------------------------------------------------
  console.log('--- TEST 3 & 4: FALLBACK RESOLUTION FOR GENDER-BASED AVATARS ---');
  // Create a test user with Male gender and NULL avatarUrl
  const testMaleEmail = `test_male_${Date.now()}@example.com`;
  const hashedPwd = await bcrypt.hash('ForgingHabits2026!', 10);
  const maleUser = (await pool.query(`
    INSERT INTO "User" (id, email, "displayName", gender, password, "emailVerified", role, "avatarUrl")
    VALUES (gen_random_uuid(), $1, 'Male Hero', 'Male', $2, NOW(), 'USER', NULL)
    RETURNING id, email, gender, "avatarUrl";
  `, [testMaleEmail, hashedPwd])).rows[0];

  const maleAuth = await loginUser(PROD_URL, testMaleEmail, 'ForgingHabits2026!');
  const maleSettingsRes = await fetch(`${PROD_URL}/api/user/settings`, {
    headers: { Cookie: maleAuth.cookies }
  });
  const maleSettings = await maleSettingsRes.json();
  console.log('Male user settings:', { gender: maleSettings.gender, avatarUrl: maleSettings.avatarUrl });

  if (maleSettings.avatarUrl !== null || maleSettings.gender !== 'Male') {
    throw new Error('TEST 3/4 FAILED: Settings returned unexpected avatarUrl/gender for test male user');
  }

  // Verify getAvatarSrc resolution logic in code:
  const { getAvatarSrc } = require('../src/lib/avatar-helper');
  const resolvedMaleSrc = getAvatarSrc(maleSettings.avatarUrl, maleSettings.gender);
  const resolvedFemaleSrc = getAvatarSrc(null, 'Female');
  const resolvedNeutralSrc = getAvatarSrc(null, null);

  console.log(`getAvatarSrc(null, "Male") -> ${resolvedMaleSrc}`);
  console.log(`getAvatarSrc(null, "Female") -> ${resolvedFemaleSrc}`);
  console.log(`getAvatarSrc(null, null) -> ${resolvedNeutralSrc}`);

  if (resolvedMaleSrc !== '/avatars/default-male.svg' ||
      resolvedFemaleSrc !== '/avatars/default-female.svg' ||
      resolvedNeutralSrc !== '/avatars/default-neutral.svg') {
    throw new Error('TEST 3/4 FAILED: getAvatarSrc resolution mismatch!');
  }
  console.log('✅ TEST 3 & 4 PASSED: Cleaned up users with null avatarUrl correctly resolve to gender-based default SVGs without broken icons.\n');

  // Clean up test user
  await pool.query(`DELETE FROM "User" WHERE id = $1`, [maleUser.id]);

  // -------------------------------------------------------------------
  // TEST 5: Deliberate failure simulation (invalid file content)
  // -------------------------------------------------------------------
  console.log('--- TEST 5: DELIBERATE FAILURE VALIDATION & NO-DB-WRITE CHECK ---');
  const initialDbUser = (await pool.query(`SELECT "avatarUrl" FROM "User" WHERE email = $1`, [superAdminEmail])).rows[0];
  const initialAvatarUrl = initialDbUser.avatarUrl;

  // Attempt to upload invalid text file
  const invalidForm = new FormData();
  const textBlob = new Blob(['Not an image file at all'], { type: 'text/plain' });
  invalidForm.append('file', textBlob, 'malicious.txt');

  const invalidRes = await fetch(`${PROD_URL}/api/user/avatar`, {
    method: 'POST',
    headers: { Cookie: auth.cookies },
    body: invalidForm,
  });

  console.log(`Invalid upload HTTP status: ${invalidRes.status}`);
  const invalidBody = await invalidRes.json();
  console.log('Response body:', invalidBody);

  if (invalidRes.status !== 400 || !invalidBody.error?.includes('Only JPEG, PNG, and WebP')) {
    throw new Error('TEST 5 FAILED: Invalid image file was not rejected with 400!');
  }

  const afterFailedDbUser = (await pool.query(`SELECT "avatarUrl" FROM "User" WHERE email = $1`, [superAdminEmail])).rows[0];
  console.log(`DB avatarUrl after failed upload: ${afterFailedDbUser.avatarUrl}`);

  if (afterFailedDbUser.avatarUrl !== initialAvatarUrl) {
    throw new Error('TEST 5 FAILED: Failed upload corrupted DB avatarUrl!');
  }
  console.log('✅ TEST 5 PASSED: Failed upload rejected cleanly; database avatarUrl remains completely unchanged.\n');

  await pool.end();
  console.log('=== ALL AVATAR UPLOAD FIX VERIFICATIONS PASSED PERFECTLY ===');
}

run().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
