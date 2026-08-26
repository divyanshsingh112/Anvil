require('dotenv').config({ path: '.env.local' });
const fs = require('fs');
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

async function main() {
  const primaryEmail = 'sdivyansh110205@gmail.com';
  const password = 'ForgingHabits2026!';

  const loginRes = await loginProdUser(primaryEmail, password);
  console.log('Login OK:', loginRes.ok);

  const imageBuffer = fs.readFileSync('screenshots/rival_duel.png');
  const blob = new Blob([imageBuffer], { type: 'image/png' });
  const formData = new FormData();
  formData.append('file', blob, 'rival_avatar.png');

  const uploadRes = await fetch(`${PROD_URL}/api/user/avatar`, {
    method: 'POST',
    headers: {
      Cookie: loginRes.cookies,
    },
    body: formData,
  });

  const uploadData = await uploadRes.json();
  console.log('Upload status:', uploadRes.status);
  console.log('Upload result:', uploadData);

  const dbRes = await pool.query(`SELECT id, email, "avatarUrl" FROM "User" WHERE email = $1`, [primaryEmail]);
  console.log('Updated DB avatarUrl:', dbRes.rows[0].avatarUrl);

  await pool.end();
}

main().catch(console.error);
