require('dotenv').config({ path: '.env.local' });
const crypto = require('crypto');

function base64url(str) {
  return Buffer.from(str)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function signJwt(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(payload));
  const signature = crypto
    .createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

async function testSecret(name, secret) {
  const payload = {
    role: 'service_role',
    iss: 'supabase',
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + 3600 * 24 * 365,
  };
  const token = signJwt(payload, secret);
  const res = await fetch('https://mfjnufslktmuevjtdylv.supabase.co/storage/v1/bucket', {
    headers: {
      Authorization: `Bearer ${token}`,
      apikey: token,
    },
  });
  console.log(`Testing with ${name}: Status = ${res.status}`);
  const text = await res.text();
  console.log(`Response for ${name}:`, text);
}

async function main() {
  await testSecret('ANON_SYSTEM_SECRET', process.env.ANON_SYSTEM_SECRET);
  await testSecret('NEXTAUTH_SECRET', process.env.NEXTAUTH_SECRET);
  await testSecret('CRON_SECRET', process.env.CRON_SECRET);
  await testSecret('DB password', 'anvilbydivyansh');
}

main().catch(console.error);
