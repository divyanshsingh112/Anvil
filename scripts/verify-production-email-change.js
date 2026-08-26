require('dotenv').config({ path: '.env.local' });
const { Pool } = require('pg');
const { Resend } = require('resend');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const resend = new Resend(process.env.RESEND_API_KEY);

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

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function runProductionVerification() {
  console.log('=== STARTING PRODUCTION EMAIL CHANGE VERIFICATION ===\n');
  console.log(`Target Environment: ${PROD_URL}\n`);

  try {
    const primaryEmail = 'sdivyansh110205@gmail.com';
    const password = 'ForgingHabits2026!';
    const targetNewEmail = `sdivyansh110205+prodemail${Date.now()}@gmail.com`;

    // Step 1: Sign in on production
    console.log(`--- STEP 1: LOGIN TO PRODUCTION (${primaryEmail}) ---`);
    const loginResult = await loginProdUser(primaryEmail, password);
    console.log(`Production login status: ${loginResult.status}, OK: ${loginResult.ok}`);
    if (!loginResult.ok) {
      throw new Error(`Failed to log in to production with ${primaryEmail}`);
    }

    // Step 2: Request email change on production
    console.log(`\n--- STEP 2: REQUEST EMAIL CHANGE ON PRODUCTION ---`);
    console.log(`Target new email: ${targetNewEmail}`);
    const changeRes = await fetch(`${PROD_URL}/api/user/email-change`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: loginResult.cookies,
      },
      body: JSON.stringify({
        currentPassword: password,
        newEmail: targetNewEmail,
      }),
    });
    const changeData = await changeRes.json();
    console.log('Status code:', changeRes.status);
    console.log('Response body:', changeData);

    if (changeRes.status !== 200) {
      throw new Error(`Email change request failed: ${JSON.stringify(changeData)}`);
    }

    // Check DB state immediately
    const userInDb = await pool.query(`SELECT id, email, "pendingEmail" FROM "User" WHERE email = $1`, [primaryEmail]);
    console.log('DB User state after request:', userInDb.rows[0]);

    // Step 3: Query Resend and wait until "delivered" status
    console.log(`\n--- STEP 3: RESEND DELIVERY CONFIRMATION ---`);
    console.log('Polling Resend API for email delivery to ' + targetNewEmail + '...');
    
    let deliveredEmail = null;
    let attempts = 0;
    const maxAttempts = 15;

    while (attempts < maxAttempts) {
      attempts++;
      const listRes = await resend.emails.list({ limit: 10 });
      const found = listRes.data?.data?.find(e => e.to.includes(targetNewEmail));
      
      if (found) {
        // Fetch detailed email record to check delivery events
        const detail = await resend.emails.get(found.id);
        console.log(`Attempt ${attempts}: Email ID ${found.id} - last_event: "${detail.data.last_event}"`);
        
        if (detail.data.last_event === 'delivered') {
          deliveredEmail = detail.data;
          break;
        }
      } else {
        console.log(`Attempt ${attempts}: Email not yet listed in Resend...`);
      }
      
      await sleep(2000);
    }

    if (!deliveredEmail) {
      throw new Error('Email was not confirmed as delivered within timeout');
    }

    console.log('\n✅ CONFIRMED DELIVERED RECORD FROM RESEND:');
    console.log(JSON.stringify({
      id: deliveredEmail.id,
      to: deliveredEmail.to,
      from: deliveredEmail.from,
      subject: deliveredEmail.subject,
      created_at: deliveredEmail.created_at,
      last_event: deliveredEmail.last_event,
    }, null, 2));

    // Step 4: Open received email and extract token from body
    console.log(`\n--- STEP 4: EXTRACT TOKEN FROM DELIVERED EMAIL BODY ---`);
    console.log(`Explicitly: Token copied from received email at ${targetNewEmail}`);
    const emailBodyText = deliveredEmail.text || '';
    console.log('\n--- RECEIVED EMAIL TEXT PAYLOAD ---');
    console.log(emailBodyText);

    // Extract confirmation URL from the email body text
    const urlMatch = emailBodyText.match(/https:\/\/anvilapp\.online\/api\/auth\/confirm-email-change\?token=([a-f0-9]+)/);
    if (!urlMatch) {
      throw new Error('Could not find confirm-email-change URL in email body text');
    }

    const fullConfirmUrl = urlMatch[0];
    const extractedToken = urlMatch[1];
    console.log(`Extracted Confirmation URL: ${fullConfirmUrl}`);
    console.log(`Extracted Token: ${extractedToken}`);

    // Step 5: Execute GET confirm link against production
    console.log(`\n--- STEP 5: CLICK CONFIRMATION LINK ON PRODUCTION ---`);
    const confirmRes = await fetch(fullConfirmUrl, {
      redirect: 'manual',
    });
    console.log('Confirm status code:', confirmRes.status);
    console.log('Confirm Location header:', confirmRes.headers.get('location'));

    if (confirmRes.status !== 307 || !confirmRes.headers.get('location')?.includes('https://anvilapp.online/login?emailChanged=true')) {
      throw new Error(`Unexpected redirect response: ${confirmRes.status} -> ${confirmRes.headers.get('location')}`);
    }
    console.log('✅ Redirect matches https://anvilapp.online/login?emailChanged=true');

    // Step 6: Verify DB state post swap
    console.log(`\n--- STEP 6: DB VERIFICATION POST-SWAP ---`);
    const swappedUserRes = await pool.query(`SELECT id, email, "pendingEmail", "emailVerified" FROM "User" WHERE email = $1`, [targetNewEmail]);
    console.log('DB User Row post-swap:', swappedUserRes.rows[0]);

    const remainingTokens = await pool.query(`SELECT * FROM "VerificationToken" WHERE identifier = $1 OR token = $2`, [targetNewEmail, extractedToken]);
    console.log('Remaining tokens for target:', remainingTokens.rows);

    if (!swappedUserRes.rows[0] || swappedUserRes.rows[0].pendingEmail !== null || remainingTokens.rows.length !== 0) {
      throw new Error('Database state did not reflect clean email swap and token cleanup');
    }
    console.log('✅ DB shows User.email swapped, pendingEmail = null, and VerificationToken deleted');

    // Step 7: Test 6 Authentication check against production
    console.log(`\n--- STEP 7: PRODUCTION AUTHENTICATION CHECK (OLD vs NEW EMAIL) ---`);
    console.log(`Testing OLD email (${primaryEmail}) on production...`);
    const oldLogin = await loginProdUser(primaryEmail, password);
    console.log(`Old email login result: status = ${oldLogin.status}, OK = ${oldLogin.ok}`);

    console.log(`Testing NEW email (${targetNewEmail}) on production...`);
    const newLogin = await loginProdUser(targetNewEmail, password);
    console.log(`New email login result: status = ${newLogin.status}, OK = ${newLogin.ok}`);

    if (oldLogin.ok) {
      throw new Error('OLD email still logged in successfully! It should have failed.');
    }
    if (!newLogin.ok) {
      throw new Error('NEW email failed to log in!');
    }
    console.log('✅ TEST 6 ON PRODUCTION PASSED: Old email rejected (401), NEW email authenticated (200).');

    // Step 8: Clean up / Restore user's email back to primary address
    console.log(`\n--- STEP 8: RESTORING PRIMARY EMAIL ---`);
    await pool.query(`UPDATE "User" SET email = $1, "pendingEmail" = NULL WHERE email = $2`, [primaryEmail, targetNewEmail]);
    console.log(`Restored User.email back to ${primaryEmail}`);

    console.log('\n========================================');
    console.log('🎉 FULL PRODUCTION VERIFICATION SUCCESSFUL!');
    console.log('========================================');

  } catch (err) {
    console.error('\n❌ Production verification error:', err);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runProductionVerification();
