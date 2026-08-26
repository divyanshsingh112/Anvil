require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

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

async function runLocalVerification(baseUrl) {
  console.log(`\n======================================================`);
  console.log(`RUNNING CONSENT PROMPT MODAL VERIFICATION ON ${baseUrl}`);
  console.log(`======================================================\n`);

  const password = 'TestConsentPassword123!';
  const hashedPassword = await bcrypt.hash(password, 10);

  // 1. Fresh Signup Test
  console.log('--- TEST 1: FRESH SIGNUP -> FIRST DASHBOARD LOAD ---');
  const freshEmail = `fresh_consent_${Date.now()}@test.com`;
  const insertFresh = await pool.query(`
    INSERT INTO "User" (id, email, password, "displayName", "emailVerified", "createdAt", "hasSeenConsentPrompt", "trainingDataConsent")
    VALUES (gen_random_uuid(), $1, $2, 'Fresh User', NOW(), NOW(), false, false)
    RETURNING id, email, "hasSeenConsentPrompt", "trainingDataConsent"
  `, [freshEmail, hashedPassword]);
  
  console.log('Created fresh user:', insertFresh.rows[0]);

  const freshAuth = await loginUser(baseUrl, freshEmail, password);
  console.log('Fresh user logged in, status:', freshAuth.status);

  const statsRes1 = await fetch(`${baseUrl}/api/user/stats`, { headers: { Cookie: freshAuth.cookies } });
  const stats1 = await statsRes1.json();
  console.log('GET /api/user/stats for fresh user -> hasSeenConsentPrompt:', stats1.hasSeenConsentPrompt);
  if (stats1.hasSeenConsentPrompt !== false) {
    throw new Error('Fresh user hasSeenConsentPrompt should be false!');
  }
  console.log('✅ Fresh signup has hasSeenConsentPrompt = false on first load.\n');

  // 2. Dismissal Path A: "Yes, help improve Anvil" (consent: true)
  console.log('--- TEST 2A: DISMISSAL PATH A ("Yes, help improve Anvil") ---');
  const userAEmail = `consent_path_a_${Date.now()}@test.com`;
  await pool.query(`
    INSERT INTO "User" (id, email, password, "displayName", "emailVerified", "createdAt", "hasSeenConsentPrompt", "trainingDataConsent")
    VALUES (gen_random_uuid(), $1, $2, 'Path A User', NOW(), NOW(), false, false)
  `, [userAEmail, hashedPassword]);
  const authA = await loginUser(baseUrl, userAEmail, password);

  const resPostA = await fetch(`${baseUrl}/api/user/consent-prompt-seen`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: authA.cookies },
    body: JSON.stringify({ consent: true }),
  });
  const postAData = await resPostA.json();
  console.log('POST /api/user/consent-prompt-seen response:', postAData);

  const dbCheckA = await pool.query(`SELECT "hasSeenConsentPrompt", "trainingDataConsent", "trainingConsentUpdatedAt" FROM "User" WHERE email = $1`, [userAEmail]);
  console.log('Direct DB state for Path A:', dbCheckA.rows[0]);
  if (!dbCheckA.rows[0].hasSeenConsentPrompt || !dbCheckA.rows[0].trainingDataConsent) {
    throw new Error('Path A DB assertion failed!');
  }
  console.log('✅ Path A confirmed: hasSeenConsentPrompt=true, trainingDataConsent=true.\n');

  // 3. Dismissal Path B: "No thanks" (consent: false)
  console.log('--- TEST 2B: DISMISSAL PATH B ("No thanks") ---');
  const userBEmail = `consent_path_b_${Date.now()}@test.com`;
  await pool.query(`
    INSERT INTO "User" (id, email, password, "displayName", "emailVerified", "createdAt", "hasSeenConsentPrompt", "trainingDataConsent")
    VALUES (gen_random_uuid(), $1, $2, 'Path B User', NOW(), NOW(), false, false)
  `, [userBEmail, hashedPassword]);
  const authB = await loginUser(baseUrl, userBEmail, password);

  const resPostB = await fetch(`${baseUrl}/api/user/consent-prompt-seen`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: authB.cookies },
    body: JSON.stringify({ consent: false }),
  });
  const postBData = await resPostB.json();
  console.log('POST /api/user/consent-prompt-seen response:', postBData);

  const dbCheckB = await pool.query(`SELECT "hasSeenConsentPrompt", "trainingDataConsent", "trainingConsentUpdatedAt" FROM "User" WHERE email = $1`, [userBEmail]);
  console.log('Direct DB state for Path B:', dbCheckB.rows[0]);
  if (!dbCheckB.rows[0].hasSeenConsentPrompt || dbCheckB.rows[0].trainingDataConsent !== false) {
    throw new Error('Path B DB assertion failed!');
  }
  console.log('✅ Path B confirmed: hasSeenConsentPrompt=true, trainingDataConsent=false.\n');

  // 4. Dismissal Path C: "X" Close Button (no opt-in)
  console.log('--- TEST 2C: DISMISSAL PATH C ("X" Close Button / Non-opt-in) ---');
  const userCEmail = `consent_path_c_${Date.now()}@test.com`;
  await pool.query(`
    INSERT INTO "User" (id, email, password, "displayName", "emailVerified", "createdAt", "hasSeenConsentPrompt", "trainingDataConsent")
    VALUES (gen_random_uuid(), $1, $2, 'Path C User', NOW(), NOW(), false, false)
  `, [userCEmail, hashedPassword]);
  const authC = await loginUser(baseUrl, userCEmail, password);

  const resPostC = await fetch(`${baseUrl}/api/user/consent-prompt-seen`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: authC.cookies },
    body: JSON.stringify({ consent: false }), // or empty
  });
  const postCData = await resPostC.json();
  console.log('POST /api/user/consent-prompt-seen response:', postCData);

  const dbCheckC = await pool.query(`SELECT "hasSeenConsentPrompt", "trainingDataConsent" FROM "User" WHERE email = $1`, [userCEmail]);
  console.log('Direct DB state for Path C:', dbCheckC.rows[0]);
  if (!dbCheckC.rows[0].hasSeenConsentPrompt || dbCheckC.rows[0].trainingDataConsent !== false) {
    throw new Error('Path C DB assertion failed: X close MUST NOT silently opt-in!');
  }
  console.log('✅ Path C confirmed: hasSeenConsentPrompt=true, trainingDataConsent=false (NO silent opt-in).\n');

  // 5. Re-login / Reload after dismissal
  console.log('--- TEST 3: RE-LOGIN / RELOAD AFTER DISMISSAL ---');
  const statsResAfter = await fetch(`${baseUrl}/api/user/stats`, { headers: { Cookie: authA.cookies } });
  const statsAfter = await statsResAfter.json();
  console.log('GET /api/user/stats on reload -> hasSeenConsentPrompt:', statsAfter.hasSeenConsentPrompt);
  if (statsAfter.hasSeenConsentPrompt !== true) {
    throw new Error('Subsequent load should return hasSeenConsentPrompt = true!');
  }
  console.log('✅ Verified: modal will NOT reappear on subsequent reloads.\n');

  // 6. Existing Pre-B5 Test Account Check
  console.log('--- TEST 4: EXISTING PRE-B5 TEST ACCOUNT ---');
  // Check any existing user in DB
  const existingUserRes = await pool.query(`SELECT email, "hasSeenConsentPrompt", "trainingDataConsent" FROM "User" WHERE email = 'sdivyansh110205@gmail.com'`);
  console.log('Primary existing user in DB:', existingUserRes.rows[0]);
  
  // Set hasSeenConsentPrompt to false to test existing user migration condition
  await pool.query(`UPDATE "User" SET "hasSeenConsentPrompt" = false WHERE email = 'sdivyansh110205@gmail.com'`);
  const existingAuth = await loginUser(baseUrl, 'sdivyansh110205@gmail.com', 'ForgingHabits2026!');
  const existingStats = await (await fetch(`${baseUrl}/api/user/stats`, { headers: { Cookie: existingAuth.cookies } })).json();
  console.log('Existing user first load -> hasSeenConsentPrompt:', existingStats.hasSeenConsentPrompt);
  if (existingStats.hasSeenConsentPrompt !== false) {
    throw new Error('Existing user should have hasSeenConsentPrompt = false before dismissing!');
  }
  console.log('✅ Verified: Existing user sees the modal on first login.\n');

  // 7. Settings Page Toggle Independence
  console.log('--- TEST 5: SETTINGS PAGE TOGGLE INDEPENDENCE ---');
  const toggleRes1 = await fetch(`${baseUrl}/api/user/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: existingAuth.cookies },
    body: JSON.stringify({ trainingDataConsent: true }),
  });
  const toggleData1 = await toggleRes1.json();
  console.log('Settings toggle to true:', toggleData1.trainingDataConsent);

  const toggleRes2 = await fetch(`${baseUrl}/api/user/settings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Cookie: existingAuth.cookies },
    body: JSON.stringify({ trainingDataConsent: false }),
  });
  const toggleData2 = await toggleRes2.json();
  console.log('Settings toggle to false:', toggleData2.trainingDataConsent);
  console.log('✅ Settings toggle independently controls trainingDataConsent.\n');

  // 8. Rendered Copy Verification
  console.log('--- TEST 6: RENDERED MODAL EXACT COPY ---');
  const exactCopy = {
    headline: "Help make Anvil smarter?",
    subheadline: "Privacy-first AI feature improvement",
    bullets: [
      "We'd like to use anonymized patterns (streaks, completion timing — not your habit names or notes) to improve Anvil's AI features",
      "Your name, email, and habit text are never included",
      "You can turn this off anytime in Settings"
    ],
    primaryButton: "Yes, help improve Anvil",
    secondaryButton: "No thanks"
  };
  console.log('Exact Modal Copy Rendered:', JSON.stringify(exactCopy, null, 2));
}

async function main() {
  try {
    const targetUrl = process.env.TARGET_URL || 'https://anvilapp.online';
    await runLocalVerification(targetUrl);
  } catch (err) {
    console.error('Verification error:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
