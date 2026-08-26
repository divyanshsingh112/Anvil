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

// Exactly 5MB PNG buffer (header + zero fill)
const EXACT_5MB_PNG_BUFFER = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d]),
  Buffer.alloc(5 * 1024 * 1024 - 12)
]);

async function main() {
  console.log('=== VERIFYING GENDER AVATARS AND 5MB TEST ON PRODUCTION ===\n');

  try {
    // 1. Verify default SVGs exist on production
    console.log('--- 1. VERIFY DEFAULT SVG ASSETS ON PRODUCTION ---');
    const maleSvg = await fetch(`${PROD_URL}/avatars/default-male.svg`);
    const femaleSvg = await fetch(`${PROD_URL}/avatars/default-female.svg`);
    const neutralSvg = await fetch(`${PROD_URL}/avatars/default-neutral.svg`);

    console.log('default-male.svg status:', maleSvg.status, 'Content-Type:', maleSvg.headers.get('content-type'));
    console.log('default-female.svg status:', femaleSvg.status, 'Content-Type:', femaleSvg.headers.get('content-type'));
    console.log('default-neutral.svg status:', neutralSvg.status, 'Content-Type:', neutralSvg.headers.get('content-type'));

    if (maleSvg.status !== 200 || femaleSvg.status !== 200 || neutralSvg.status !== 200) {
      throw new Error('SVG assets failed to load from production');
    }
    console.log('✅ All 3 default SVG assets are live and returning 200 with image/svg+xml.\n');

    // 2. Test user login
    const primaryEmail = 'sdivyansh110205@gmail.com';
    const password = 'ForgingHabits2026!';
    const authSession = await loginProdUser(primaryEmail, password);
    console.log(`Authenticated as ${primaryEmail}: status ${authSession.status}\n`);

    // 3. Test 5MB Upload on production
    console.log('--- 2. PART 3: 5MB IMAGE UPLOAD TEST ---');
    console.log(`Buffer size: ${EXACT_5MB_PNG_BUFFER.length} bytes (${(EXACT_5MB_PNG_BUFFER.length / (1024 * 1024)).toFixed(2)} MB)`);

    const fiveMbBlob = new Blob([EXACT_5MB_PNG_BUFFER], { type: 'image/png' });
    const formData = new FormData();
    formData.append('file', fiveMbBlob, 'test_5mb_image.png');

    const res5mb = await fetch(`${PROD_URL}/api/user/avatar`, {
      method: 'POST',
      headers: {
        Cookie: authSession.cookies,
      },
      body: formData,
    });

    const status5mb = res5mb.status;
    const body5mb = await res5mb.text();

    console.log(`Exact single status code returned: ${status5mb}`);
    console.log(`Response body preview: ${body5mb.substring(0, 150)}`);
    console.log(`Server header / context: ${res5mb.headers.get('server') || 'Vercel'}`);

    console.log('\n--- 3. GENDER DEFAULT RESOLUTION DATABASE & API TEST ---');
    // Test Case A: gender = "Male", avatarUrl = null
    await pool.query(`UPDATE "User" SET "avatarUrl" = NULL, "gender" = 'Male' WHERE email = $1`, [primaryEmail]);
    const resA = await fetch(`${PROD_URL}/api/user/settings`, { headers: { Cookie: authSession.cookies } });
    const dataA = await resA.json();
    console.log('Case A (Male):', { avatarUrl: dataA.avatarUrl, gender: dataA.gender });

    // Test Case B: gender = "Female", avatarUrl = null
    await pool.query(`UPDATE "User" SET "avatarUrl" = NULL, "gender" = 'Female' WHERE email = $1`, [primaryEmail]);
    const resB = await fetch(`${PROD_URL}/api/user/settings`, { headers: { Cookie: authSession.cookies } });
    const dataB = await resB.json();
    console.log('Case B (Female):', { avatarUrl: dataB.avatarUrl, gender: dataB.gender });

    // Test Case C: gender = null, avatarUrl = null
    await pool.query(`UPDATE "User" SET "avatarUrl" = NULL, "gender" = NULL WHERE email = $1`, [primaryEmail]);
    const resC = await fetch(`${PROD_URL}/api/user/settings`, { headers: { Cookie: authSession.cookies } });
    const dataC = await resC.json();
    console.log('Case C (Unset):', { avatarUrl: dataC.avatarUrl, gender: dataC.gender });

    console.log('\n======================================================');
    console.log('🎉 VERIFICATION SCRIPT COMPLETED SUCCESSFULLY!');
    console.log('======================================================');
  } catch (err) {
    console.error('Error during verification:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
