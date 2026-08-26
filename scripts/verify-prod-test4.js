require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
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

async function testProd() {
  console.log('=== TEST 4 RUN AGAINST PRODUCTION ===');
  console.log('Actual Request Host:', PROD_URL);
  
  const email = 'sdivyansh110205@gmail.com';
  const pwd = 'ForgingHabits2026!';
  
  // Reset hasSeenConsentPrompt to false in the shared database
  await pool.query(`UPDATE "User" SET "hasSeenConsentPrompt" = false WHERE email = $1`, [email]);
  
  const auth = await loginUser(PROD_URL, email, pwd);
  console.log(`Authenticated as ${email} on ${PROD_URL}: status ${auth.status}`);

  const statsRes = await fetch(`${PROD_URL}/api/user/stats`, {
    headers: { Cookie: auth.cookies }
  });
  console.log(`GET ${PROD_URL}/api/user/stats status:`, statsRes.status);
  const stats = await statsRes.json();
  console.log('Production /api/user/stats response payload:');
  console.log(JSON.stringify({
    xp: stats.xp,
    level: stats.level,
    coins: stats.coins,
    streak: stats.streak,
    hasSeenConsentPrompt: stats.hasSeenConsentPrompt,
    trainingDataConsent: stats.trainingDataConsent
  }, null, 2));

  console.log(`\nConfirming: stats.hasSeenConsentPrompt === false -> ${stats.hasSeenConsentPrompt === false}`);
  if (stats.hasSeenConsentPrompt === false) {
    console.log('✅ Existing pre-B5 user has hasSeenConsentPrompt=false on production -> modal will appear on first dashboard load.');
  }

  await pool.end();
}

testProd().catch(err => {
  console.error(err);
  process.exit(1);
});
