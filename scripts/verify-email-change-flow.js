require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const { Resend } = require('resend');
const bcrypt = require('bcryptjs');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const resend = new Resend(process.env.RESEND_API_KEY);

const BASE_URL = 'http://localhost:3000';

function extractCookies(res) {
  const raw = res.headers.getSetCookie ? res.headers.getSetCookie() : [res.headers.get('set-cookie')].filter(Boolean);
  return raw.map(c => c.split(';')[0]).join('; ');
}

async function loginUser(email, password) {
  const csrfRes = await fetch(`${BASE_URL}/api/auth/csrf`);
  const { csrfToken } = await csrfRes.json();
  const csrfCookies = extractCookies(csrfRes);

  const res = await fetch(`${BASE_URL}/api/auth/callback/credentials`, {
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

async function runTests() {
  console.log('=== STARTING EMAIL CHANGE FLOW VERIFICATION ===\n');

  try {
    // 0. Ensure base test users exist in DB
    const primaryTestEmail = 'sdivyansh110205@gmail.com';
    const testPassword = 'ForgingHabits2026!';
    const hashedPassword = await bcrypt.hash(testPassword, 10);

    // Ensure primary user exists and has password
    await pool.query(`
      INSERT INTO "User" (id, email, password, "displayName", "emailVerified", "createdAt", xp, level, coins, streak, "momentumScore", "activeTheme")
      VALUES (
        gen_random_uuid(),
        $1,
        $2,
        'Divyansh Test',
        NOW(),
        NOW(),
        0, 1, 0, 0, 100, 'Plain'
      )
      ON CONFLICT (email) DO UPDATE 
      SET password = $2, "emailVerified" = NOW(), "pendingEmail" = NULL
    `, [primaryTestEmail, hashedPassword]);

    // Ensure conflict target user exists
    const conflictEmail = 'alpha_closed_tester@anvilapp.online';
    await pool.query(`
      INSERT INTO "User" (id, email, password, "displayName", "emailVerified", "createdAt", xp, level, coins, streak, "momentumScore", "activeTheme")
      VALUES (
        gen_random_uuid(),
        $1,
        $2,
        'Alpha Tester',
        NOW(),
        NOW(),
        0, 1, 0, 0, 100, 'Plain'
      )
      ON CONFLICT (email) DO NOTHING
    `, [conflictEmail, hashedPassword]);

    // Ensure Google OAuth-only user (no password) exists
    const googleUserEmail = 'google_test_user_nopassword@anvilapp.online';
    await pool.query(`
      INSERT INTO "User" (id, email, password, "displayName", "emailVerified", "createdAt", xp, level, coins, streak, "momentumScore", "activeTheme")
      VALUES (
        gen_random_uuid(),
        $1,
        NULL,
        'Google OAuth User',
        NOW(),
        NOW(),
        0, 1, 0, 0, 100, 'Plain'
      )
      ON CONFLICT (email) DO UPDATE
      SET password = NULL, "pendingEmail" = NULL
    `, [googleUserEmail]);

    // 1. Authenticate as primary test user
    console.log('--- LOGGING IN PRIMARY TEST USER ---');
    const authSession = await loginUser(primaryTestEmail, testPassword);
    console.log(`Login status: ${authSession.status}, Session cookies acquired.`);

    // -------------------------------------------------------------
    // TEST 1: Attempt with WRONG password -> rejected, pendingEmail NOT set
    // -------------------------------------------------------------
    console.log('\n--- TEST 1: WRONG PASSWORD REJECTION ---');
    const wrongPassRes = await fetch(`${BASE_URL}/api/user/email-change`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: authSession.cookies,
      },
      body: JSON.stringify({
        currentPassword: 'WrongPassword123!',
        newEmail: 'sdivyansh110205+fail@gmail.com',
      }),
    });
    const wrongPassData = await wrongPassRes.json();
    console.log('Status code:', wrongPassRes.status);
    console.log('Response body:', wrongPassData);

    const userAfterWrongPass = await pool.query(`SELECT email, "pendingEmail" FROM "User" WHERE email = $1`, [primaryTestEmail]);
    console.log('DB pendingEmail state:', userAfterWrongPass.rows[0].pendingEmail);

    if (wrongPassRes.status === 400 && wrongPassData.error?.includes('Incorrect current password') && userAfterWrongPass.rows[0].pendingEmail === null) {
      console.log('✅ TEST 1 PASSED: Rejected wrong password and pendingEmail was NOT set.');
    } else {
      console.error('❌ TEST 1 FAILED');
    }

    // -------------------------------------------------------------
    // TEST 2: Attempt change to an already-registered email -> rejected
    // -------------------------------------------------------------
    console.log('\n--- TEST 2: CONFLICTING EMAIL REJECTION ---');
    const conflictRes = await fetch(`${BASE_URL}/api/user/email-change`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: authSession.cookies,
      },
      body: JSON.stringify({
        currentPassword: testPassword,
        newEmail: conflictEmail,
      }),
    });
    const conflictData = await conflictRes.json();
    console.log('Status code:', conflictRes.status);
    console.log('Response body:', conflictData);

    if (conflictRes.status === 409 && conflictData.error?.includes('already in use')) {
      console.log('✅ TEST 2 PASSED: Rejected change to existing email with 409 Conflict.');
    } else {
      console.error('❌ TEST 2 FAILED');
    }

    // -------------------------------------------------------------
    // TEST 3: Google-OAuth-only user change rejection (password = null)
    // -------------------------------------------------------------
    console.log('\n--- TEST 3: GOOGLE OAUTH-ONLY USER REJECTION ---');
    // Give temporary password to acquire NextAuth session token, then immediately strip password
    await pool.query(`UPDATE "User" SET password = $1 WHERE email = $2`, [hashedPassword, googleUserEmail]);
    const googleSession = await loginUser(googleUserEmail, testPassword);
    await pool.query(`UPDATE "User" SET password = NULL WHERE email = 'google_test_user_nopassword@anvilapp.online'`);

    const googleChangeRes = await fetch(`${BASE_URL}/api/user/email-change`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: googleSession.cookies,
      },
      body: JSON.stringify({
        currentPassword: testPassword,
        newEmail: 'google_new_email@anvilapp.online',
      }),
    });
    const googleChangeData = await googleChangeRes.json();
    console.log('Status code:', googleChangeRes.status);
    console.log('Response body:', googleChangeData);

    if (googleChangeRes.status === 400 && googleChangeData.error?.includes('Accounts created via Google sign-in cannot change email')) {
      console.log('✅ TEST 3 PASSED: Google-only user properly rejected with clear message without crash.');
    } else {
      console.error('❌ TEST 3 FAILED');
    }

    // -------------------------------------------------------------
    // TEST 4: Valid email change request -> pendingEmail set in DB & real email sent
    // -------------------------------------------------------------
    console.log('\n--- TEST 4: VALID EMAIL CHANGE REQUEST & REAL EMAIL SENDING ---');
    const newTargetEmail = `sdivyansh110205+emailchange${Date.now()}@gmail.com`;

    const changeRes = await fetch(`${BASE_URL}/api/user/email-change`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: authSession.cookies,
      },
      body: JSON.stringify({
        currentPassword: testPassword,
        newEmail: newTargetEmail,
      }),
    });
    const changeData = await changeRes.json();
    console.log('Status code:', changeRes.status);
    console.log('Response body:', changeData);

    // Verify DB state
    const userInDb = await pool.query(`SELECT id, email, "pendingEmail" FROM "User" WHERE email = $1`, [primaryTestEmail]);
    console.log('DB User State:', userInDb.rows[0]);

    const tokenInDb = await pool.query(`SELECT identifier, token, expires FROM "VerificationToken" WHERE identifier = $1`, [newTargetEmail]);
    console.log('DB VerificationToken State:', tokenInDb.rows[0]);

    // Query Resend for the dispatched email
    console.log('\nQuerying Resend API for dispatched email...');
    const emailList = await resend.emails.list({ limit: 5 });
    const latestEmail = emailList.data?.data?.find(e => e.to.includes(newTargetEmail));
    console.log('Resend Delivery Record:', JSON.stringify(latestEmail, null, 2));

    if (changeRes.status === 200 && userInDb.rows[0].pendingEmail === newTargetEmail && tokenInDb.rows.length > 0 && latestEmail) {
      console.log('✅ TEST 4 PASSED: pendingEmail set in DB, VerificationToken created, real email dispatched via Resend.');
    } else {
      console.error('❌ TEST 4 FAILED');
    }

    // -------------------------------------------------------------
    // TEST 5: Click real confirmation link -> email swaps, pendingEmail clears, token deleted
    // -------------------------------------------------------------
    console.log('\n--- TEST 5: CLICK CONFIRMATION LINK & EMAIL SWAP ---');
    const confirmToken = tokenInDb.rows[0].token;
    const confirmRes = await fetch(`${BASE_URL}/api/auth/confirm-email-change?token=${confirmToken}`, {
      redirect: 'manual',
    });
    console.log('Confirm status code:', confirmRes.status);
    console.log('Confirm redirect Location header:', confirmRes.headers.get('location'));

    // Check DB state post-confirmation
    const userPostSwap = await pool.query(`SELECT id, email, "pendingEmail", "emailVerified" FROM "User" WHERE email = $1 OR "pendingEmail" = $1`, [newTargetEmail]);
    console.log('DB User State post swap:', userPostSwap.rows[0]);

    const tokenPostSwap = await pool.query(`SELECT * FROM "VerificationToken" WHERE token = $1 OR identifier = $2`, [confirmToken, newTargetEmail]);
    console.log('Tokens remaining for target:', tokenPostSwap.rows);

    if (
      confirmRes.status === 307 &&
      confirmRes.headers.get('location')?.includes('/login?emailChanged=true') &&
      userPostSwap.rows[0]?.email === newTargetEmail &&
      userPostSwap.rows[0]?.pendingEmail === null &&
      tokenPostSwap.rows.length === 0
    ) {
      console.log('✅ TEST 5 PASSED: Email successfully swapped in DB, pendingEmail cleared, and token deleted.');
    } else {
      console.error('❌ TEST 5 FAILED');
    }

    // -------------------------------------------------------------
    // TEST 6: Login with NEW email works, OLD email no longer works
    // -------------------------------------------------------------
    console.log('\n--- TEST 6: AUTHENTICATION CHECK (OLD vs NEW EMAIL) ---');
    console.log('Attempting sign-in with OLD email (' + primaryTestEmail + ')...');
    const oldLogin = await loginUser(primaryTestEmail, testPassword);
    console.log('Old email login result ok:', oldLogin.ok, 'status:', oldLogin.status);

    console.log('Attempting sign-in with NEW email (' + newTargetEmail + ')...');
    const newLogin = await loginUser(newTargetEmail, testPassword);
    console.log('New email login result ok:', newLogin.ok, 'status:', newLogin.status);

    if (!oldLogin.ok && newLogin.ok) {
      console.log('✅ TEST 6 PASSED: Old email no longer authenticates, NEW email authenticates perfectly.');
    } else {
      console.error('❌ TEST 6 FAILED');
    }

    // -------------------------------------------------------------
    // TEST 7: Cancel pending email change (DELETE endpoint)
    // -------------------------------------------------------------
    console.log('\n--- TEST 7: CANCEL PENDING CHANGE (DELETE ENDPOINT) ---');
    const tempNewEmail = `sdivyansh110205+canceltest${Date.now()}@gmail.com`;
    // Request change
    await fetch(`${BASE_URL}/api/user/email-change`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: newLogin.cookies,
      },
      body: JSON.stringify({
        currentPassword: testPassword,
        newEmail: tempNewEmail,
      }),
    });

    const userWithPending = await pool.query(`SELECT email, "pendingEmail" FROM "User" WHERE email = $1`, [newTargetEmail]);
    console.log('Before cancel - pendingEmail:', userWithPending.rows[0].pendingEmail);

    const deleteRes = await fetch(`${BASE_URL}/api/user/email-change`, {
      method: 'DELETE',
      headers: { Cookie: newLogin.cookies },
    });
    const deleteData = await deleteRes.json();
    console.log('Delete status:', deleteRes.status, 'Response:', deleteData);

    const userAfterCancel = await pool.query(`SELECT email, "pendingEmail" FROM "User" WHERE email = $1`, [newTargetEmail]);
    console.log('After cancel - pendingEmail:', userAfterCancel.rows[0].pendingEmail);

    if (deleteRes.status === 200 && userAfterCancel.rows[0].pendingEmail === null) {
      console.log('✅ TEST 7 PASSED: Pending change cancelled successfully.');
    } else {
      console.error('❌ TEST 7 FAILED');
    }

    // Restore original email for cleanliness
    console.log('\nRestoring user email back to primary address...');
    await pool.query(`UPDATE "User" SET email = $1, "pendingEmail" = NULL WHERE email = $2`, [primaryTestEmail, newTargetEmail]);
    console.log('Restored.');

  } catch (err) {
    console.error('Test execution error:', err);
  } finally {
    await pool.end();
    console.log('\n=== ALL TESTS COMPLETE ===');
  }
}

runTests();
