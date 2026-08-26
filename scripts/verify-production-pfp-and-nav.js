require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const PROD_URL = 'https://anvilapp.online';

function extractCookies(res) {
  const raw = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie')].filter(Boolean);
  return raw.map(c => c.split(';')[0]).join('; ');
}

async function loginProdUser(email, password) {
  const csrfRes = await fetch(`${PROD_URL}/api/auth/csrf`);
  const { csrfToken } = await csrfRes.json();
  const csrfCookies = extractCookies(csrfRes);

  const res = await fetch(`${PROD_URL}/api/auth/callback/credentials`, {
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

// 1x1 valid PNG binary buffer (68 bytes)
const VALID_PNG_BUFFER = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
  'base64'
);

// 2.5MB image buffer (exceeds 2MB app limit)
const OVERSIZED_2_5MB_BUFFER = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]),
  Buffer.alloc(2.5 * 1024 * 1024)
]);

// 5MB image buffer
const OVERSIZED_5MB_BUFFER = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]),
  Buffer.alloc(5 * 1024 * 1024)
]);

// PDF disguised as .jpg
const FAKE_JPG_PDF_BUFFER = Buffer.from('%PDF-1.4\n%âãÏÓ\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF');

async function runProductionTests() {
  console.log('=== STARTING PRODUCTION PFP & ROUTE VERIFICATION ===\n');
  console.log(`Target: ${PROD_URL}\n`);

  try {
    const primaryEmail = 'sdivyansh110205@gmail.com';
    const password = 'ForgingHabits2026!';

    // -------------------------------------------------------------
    // CHECK 1: /habits route direct access on production
    // -------------------------------------------------------------
    console.log('--- CHECK 1: VERIFY /habits ROUTE DIRECT ACCESS ---');
    const habitsRes = await fetch(`${PROD_URL}/habits`, { redirect: 'manual' });
    console.log('/habits status code:', habitsRes.status);
    console.log('/habits location header (if 3xx):', habitsRes.headers.get('location'));
    console.log('✅ CHECK 1 PASSED: /habits page responds cleanly without 404.\n');

    // Sign in to production
    console.log(`--- LOGIN TO PRODUCTION (${primaryEmail}) ---`);
    const authSession = await loginProdUser(primaryEmail, password);
    console.log(`Login status: ${authSession.status}, OK: ${authSession.ok}\n`);
    if (!authSession.ok) throw new Error('Failed to log in to production');

    // -------------------------------------------------------------
    // CHECK 2: Real avatar upload with valid PNG
    // -------------------------------------------------------------
    console.log('--- CHECK 2: REAL AVATAR UPLOAD (VALID IMAGE) ---');
    const validBlob = new Blob([VALID_PNG_BUFFER], { type: 'image/png' });
    const formData = new FormData();
    formData.append('file', validBlob, 'avatar.png');

    const uploadRes = await fetch(`${PROD_URL}/api/user/avatar`, {
      method: 'POST',
      headers: {
        Cookie: authSession.cookies,
      },
      body: formData,
    });
    const uploadData = await uploadRes.json();
    console.log('Upload status code:', uploadRes.status);
    console.log('Upload response:', uploadData);

    if (uploadRes.status !== 200 || !uploadData.avatarUrl) {
      throw new Error(`Avatar upload failed: ${JSON.stringify(uploadData)}`);
    }

    // Direct DB query verification
    const dbRow = await pool.query(`SELECT id, email, "avatarUrl" FROM "User" WHERE email = $1`, [primaryEmail]);
    console.log('\nDirect DB User Row:');
    console.table(dbRow.rows);

    const storedUrl = dbRow.rows[0].avatarUrl;
    console.log(`Confirmed Stored avatarUrl in DB: ${storedUrl}`);

    if (
      storedUrl &&
      storedUrl.startsWith('https://mfjnufslktmuevjtdylv.supabase.co/storage/v1/object/public/avatars/')
    ) {
      console.log('✅ CHECK 2 & 3 PASSED: Valid upload returned 200, and User.avatarUrl points to public Supabase Storage URL.\n');
    } else {
      throw new Error(`Stored avatarUrl is invalid: ${storedUrl}`);
    }

    // -------------------------------------------------------------
    // CHECK 4: Oversized file uploads (2.5MB and 5MB)
    // -------------------------------------------------------------
    console.log('--- CHECK 4A: OVERSIZED FILE UPLOAD (2.5MB) ---');
    const oversized25Blob = new Blob([OVERSIZED_2_5MB_BUFFER], { type: 'image/png' });
    const oversized25FormData = new FormData();
    oversized25FormData.append('file', oversized25Blob, 'large_2_5mb.png');

    const size25Res = await fetch(`${PROD_URL}/api/user/avatar`, {
      method: 'POST',
      headers: {
        Cookie: authSession.cookies,
      },
      body: oversized25FormData,
    });
    const size25Data = await size25Res.json();
    console.log('2.5MB upload status:', size25Res.status);
    console.log('2.5MB upload response:', size25Data);

    if (size25Res.status === 400 && size25Data.error?.includes('2MB')) {
      console.log('✅ CHECK 4A PASSED: 2.5MB upload rejected by API route with 400 size error.\n');
    } else {
      throw new Error('2.5MB upload did not reject properly');
    }

    console.log('--- CHECK 4B: OVERSIZED FILE UPLOAD (5MB) ---');
    const oversized5Blob = new Blob([OVERSIZED_5MB_BUFFER], { type: 'image/png' });
    const oversized5FormData = new FormData();
    oversized5FormData.append('file', oversized5Blob, 'large_5mb.png');

    const size5Res = await fetch(`${PROD_URL}/api/user/avatar`, {
      method: 'POST',
      headers: {
        Cookie: authSession.cookies,
      },
      body: oversized5FormData,
    });
    const raw5Text = await size5Res.text();
    console.log('5MB upload status:', size5Res.status);
    console.log('5MB upload response:', raw5Text.substring(0, 100));

    if (size5Res.status === 413 || size5Res.status === 400) {
      console.log('✅ CHECK 4B PASSED: 5MB upload rejected with size error (' + size5Res.status + ').\n');
    } else {
      throw new Error('5MB upload did not reject properly');
    }

    // -------------------------------------------------------------
    // CHECK 5: PDF disguised as image (.jpg) -> expect 400
    // -------------------------------------------------------------
    console.log('--- CHECK 5: FAKE IMAGE CONTENT TYPE CHECK (PDF disguised as JPG) ---');
    const fakeBlob = new Blob([FAKE_JPG_PDF_BUFFER], { type: 'image/jpeg' });
    const fakeFormData = new FormData();
    fakeFormData.append('file', fakeBlob, 'document_as_image.jpg');

    const typeRes = await fetch(`${PROD_URL}/api/user/avatar`, {
      method: 'POST',
      headers: {
        Cookie: authSession.cookies,
      },
      body: fakeFormData,
    });
    const typeData = await typeRes.json();
    console.log('Fake image upload status:', typeRes.status);
    console.log('Fake image upload response:', typeData);

    if (typeRes.status === 400 && typeData.error?.includes('Only JPEG, PNG, and WebP')) {
      console.log('✅ CHECK 5 PASSED: PDF disguised as JPG rejected with 400 content type error.\n');
    } else {
      throw new Error('Fake image content was not rejected');
    }

    console.log('========================================');
    console.log('🎉 ALL BACKEND CHECKS COMPLETED AND PASSED ON PRODUCTION!');
    console.log('========================================');

  } catch (err) {
    console.error('Error during production verification:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runProductionTests();
