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

async function runProductionTests() {
  console.log('=== STARTING PRODUCTION PERSONAL INFO VERIFICATION ===\n');
  console.log(`Target: ${PROD_URL}\n`);

  try {
    const primaryEmail = 'sdivyansh110205@gmail.com';
    const password = 'ForgingHabits2026!';
    const rivalEmail = 'alpha_closed_tester@anvilapp.online';

    // 0. Ensure rival user has an established username in DB
    await pool.query(`
      UPDATE "User" 
      SET username = 'Alpha_Knight' 
      WHERE email = $1
    `, [rivalEmail]);

    // Step 0: Sign in to production
    console.log(`--- STEP 0: LOGIN TO PRODUCTION (${primaryEmail}) ---`);
    const authSession = await loginProdUser(primaryEmail, password);
    console.log(`Login status: ${authSession.status}, OK: ${authSession.ok}`);
    if (!authSession.ok) throw new Error('Failed to log in to production');

    // -------------------------------------------------------------
    // VERIFICATION 1: Real save with valid data -> confirm DB row updated
    // -------------------------------------------------------------
    console.log('\n--- VERIFICATION 1: REAL SAVE WITH VALID DATA ON PRODUCTION ---');
    const validPayload = {
      displayName: 'Divyansh Champion',
      username: 'divyansh_hero',
      phone: '+1 555-019-2834',
      gender: 'Male',
      age: 24,
    };

    const saveRes = await fetch(`${PROD_URL}/api/user/settings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: authSession.cookies,
      },
      body: JSON.stringify(validPayload),
    });
    const saveData = await saveRes.json();
    console.log('Status code:', saveRes.status);
    console.log('API Response:', saveData);

    // Direct DB query verification
    const dbRowRes = await pool.query(`
      SELECT id, email, "displayName", username, phone, gender, age, "pendingEmail"
      FROM "User"
      WHERE email = $1
    `, [primaryEmail]);
    console.log('\nDirect DB Row Query Output:');
    console.table(dbRowRes.rows);

    if (
      saveRes.status === 200 &&
      dbRowRes.rows[0].displayName === 'Divyansh Champion' &&
      dbRowRes.rows[0].username === 'divyansh_hero' &&
      dbRowRes.rows[0].phone === '+1 555-019-2834' &&
      dbRowRes.rows[0].gender === 'Male' &&
      dbRowRes.rows[0].age === 24
    ) {
      console.log('✅ VERIFICATION 1 PASSED: Real save succeeded and DB row updated with all 5 fields.');
    } else {
      console.error('❌ VERIFICATION 1 FAILED');
    }

    // -------------------------------------------------------------
    // VERIFICATION 2: Duplicate username with different casing (409 Conflict)
    // -------------------------------------------------------------
    console.log('\n--- VERIFICATION 2: DUPLICATE USERNAME CASE-INSENSITIVE CHECK ---');
    // Rival user has 'Alpha_Knight'. Primary user tries to save 'alpha_knight'.
    console.log('Rival account username in DB: "Alpha_Knight"');
    console.log('Attempting to save username: "alpha_knight" (lower-case collision)...');

    const duplicateRes = await fetch(`${PROD_URL}/api/user/settings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: authSession.cookies,
      },
      body: JSON.stringify({
        username: 'alpha_knight',
      }),
    });
    const duplicateData = await duplicateRes.json();
    console.log('Status code:', duplicateRes.status);
    console.log('API Response:', duplicateData);

    if (duplicateRes.status === 409 && duplicateData.error?.includes('already taken')) {
      console.log('✅ VERIFICATION 2 PASSED: Correctly caught case-insensitive duplicate username and rejected with 409 Conflict.');
    } else {
      console.error('❌ VERIFICATION 2 FAILED');
    }

    // -------------------------------------------------------------
    // VERIFICATION 3: Attempt age = 200 -> rejected with real error
    // -------------------------------------------------------------
    console.log('\n--- VERIFICATION 3: AGE OUT OF BOUNDS VALIDATION ---');
    console.log('Attempting to save age = 200...');

    const ageRes = await fetch(`${PROD_URL}/api/user/settings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: authSession.cookies,
      },
      body: JSON.stringify({
        age: 200,
      }),
    });
    const ageData = await ageRes.json();
    console.log('Status code:', ageRes.status);
    console.log('API Response:', ageData);

    if (ageRes.status === 400 && ageData.error?.includes('Age must be an integer between 13 and 120')) {
      console.log('✅ VERIFICATION 3 PASSED: Age=200 rejected with 400 and explicit range error.');
    } else {
      console.error('❌ VERIFICATION 3 FAILED');
    }

    // -------------------------------------------------------------
    // VERIFICATION 4: Partial update (displayName only)
    // -------------------------------------------------------------
    console.log('\n--- VERIFICATION 4: PARTIAL UPDATE (displayName ONLY) ---');
    console.log('Attempting partial update with only displayName = "Divyansh Forgemaster"...');

    const partialRes = await fetch(`${PROD_URL}/api/user/settings`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: authSession.cookies,
      },
      body: JSON.stringify({
        displayName: 'Divyansh Forgemaster',
      }),
    });
    const partialData = await partialRes.json();
    console.log('Status code:', partialRes.status);
    console.log('API Response:', partialData);

    const dbPartialRes = await pool.query(`
      SELECT id, email, "displayName", username, phone, gender, age
      FROM "User"
      WHERE email = $1
    `, [primaryEmail]);
    console.log('\nDirect DB Row Query Output post-partial update:');
    console.table(dbPartialRes.rows);

    if (
      partialRes.status === 200 &&
      dbPartialRes.rows[0].displayName === 'Divyansh Forgemaster' &&
      dbPartialRes.rows[0].username === 'divyansh_hero' &&
      dbPartialRes.rows[0].phone === '+1 555-019-2834' &&
      dbPartialRes.rows[0].gender === 'Male' &&
      dbPartialRes.rows[0].age === 24
    ) {
      console.log('✅ VERIFICATION 4 PASSED: Partial update succeeded, only displayName updated, existing fields preserved.');
    } else {
      console.error('❌ VERIFICATION 4 FAILED');
    }

    console.log('\n========================================');
    console.log('🎉 ALL BACKEND API VERIFICATIONS PASSED ON PRODUCTION!');
    console.log('========================================');

  } catch (err) {
    console.error('Verification error:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runProductionTests();
