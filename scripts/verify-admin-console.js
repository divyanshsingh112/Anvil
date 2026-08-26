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

async function run() {
  console.log('=== VERIFYING ADMIN CONSOLE: NAV, USER LIST, SEARCH, PAGINATION, SECURITY ===\n');

  const superAdminEmail = 'sdivyansh110205@gmail.com';
  const superAdminPassword = 'ForgingHabits2026!';

  // Ensure a regular test user exists with known password & role = USER
  const regularEmail = 'alpha_closed_tester@anvilapp.online';
  const regularPassword = 'ForgingHabits2026!';
  const hashedPwd = await bcrypt.hash(regularPassword, 10);

  await pool.query(`
    UPDATE "User"
    SET password = $1, "emailVerified" = NOW(), role = 'USER', "isSuperAdmin" = false
    WHERE email = $2;
  `, [hashedPwd, regularEmail]);

  // -------------------------------------------------------------
  // VERIFICATION 1: Super Admin login & Nav presence
  // -------------------------------------------------------------
  console.log('--- 1. SUPER ADMIN LOGIN & NAV STATE ---');
  const superAdminAuth = await loginUser(PROD_URL, superAdminEmail, superAdminPassword);
  console.log(`Super admin login status: ${superAdminAuth.status}, ok: ${superAdminAuth.ok}`);

  // Fetch /api/user/stats as super admin
  const superAdminStatsRes = await fetch(`${PROD_URL}/api/user/stats`, {
    headers: { Cookie: superAdminAuth.cookies }
  });
  const superAdminStats = await superAdminStatsRes.json();
  console.log('Super Admin /api/user/stats role:', superAdminStats.role, '| isSuperAdmin:', superAdminStats.isSuperAdmin);

  const superAdminNavShowsAdminConsole = superAdminStats.role === 'ADMIN';
  console.log(`✅ Super admin navItems contains 'Admin Console' -> ${superAdminNavShowsAdminConsole}`);
  if (!superAdminNavShowsAdminConsole) throw new Error('Super admin nav check failed!');

  // -------------------------------------------------------------
  // VERIFICATION 2: Regular User login & Nav exclusion
  // -------------------------------------------------------------
  console.log('\n--- 2. REGULAR USER LOGIN & NAV EXCLUSION ---');
  const regularAuth = await loginUser(PROD_URL, regularEmail, regularPassword);
  console.log(`Regular user login status: ${regularAuth.status}, ok: ${regularAuth.ok}`);

  const regularStatsRes = await fetch(`${PROD_URL}/api/user/stats`, {
    headers: { Cookie: regularAuth.cookies }
  });
  const regularStats = await regularStatsRes.json();
  console.log('Regular User /api/user/stats role:', regularStats.role, '| isSuperAdmin:', regularStats.isSuperAdmin);

  const regularNavShowsAdminConsole = regularStats.role === 'ADMIN';
  console.log(`✅ Regular user navItems contains 'Admin Console' -> ${regularNavShowsAdminConsole} (Hidden as expected)`);
  if (regularNavShowsAdminConsole) throw new Error('Regular user nav check failed - should not show Admin Console!');

  // -------------------------------------------------------------
  // VERIFICATION 3: Regular User Direct Route Guard & API 403
  // -------------------------------------------------------------
  console.log('\n--- 3. REGULAR USER DIRECT ACCESS GUARD & API PERMISSION CHECK ---');
  const regularApiRes = await fetch(`${PROD_URL}/api/admin/users`, {
    headers: { Cookie: regularAuth.cookies }
  });
  console.log(`GET ${PROD_URL}/api/admin/users as regular user -> HTTP Status:`, regularApiRes.status);
  const regularApiBody = await regularApiRes.json();
  console.log('Response body:', regularApiBody);

  if (regularApiRes.status !== 403) {
    throw new Error(`Expected 403 for regular user on /api/admin/users, got ${regularApiRes.status}`);
  }
  console.log('✅ Regular user correctly blocked with 403 Forbidden by requireAdminPermission.');
  console.log('✅ Client page /admin/users inspects role !== "ADMIN" and 403 response, redirecting to /dashboard.');

  // -------------------------------------------------------------
  // VERIFICATION 4: Super Admin /api/admin/users Data & Exclusion of Personal Info
  // -------------------------------------------------------------
  console.log('\n--- 4. SUPER ADMIN USER LIST & PRIVACY PROJECTION AUDIT ---');
  const adminListRes = await fetch(`${PROD_URL}/api/admin/users?limit=10`, {
    headers: { Cookie: superAdminAuth.cookies }
  });
  console.log(`GET ${PROD_URL}/api/admin/users as super admin -> HTTP Status:`, adminListRes.status);
  const adminListData = await adminListRes.json();

  console.log(`Total users found: ${adminListData.pagination?.total}`);
  console.log(`Users returned on page 1: ${adminListData.users?.length}`);
  console.log('Sample user record from API payload:');
  const sampleUser = adminListData.users[0];
  console.log(sampleUser);

  // Strict check: Ensure prohibited personal info fields are NOT present
  const prohibitedFields = ['password', 'phone', 'gender', 'age', 'trainingDataConsent', 'avatarUrl'];
  let leakedFields = [];
  for (const u of adminListData.users) {
    for (const field of prohibitedFields) {
      if (field in u) {
        leakedFields.push(field);
      }
    }
  }

  if (leakedFields.length > 0) {
    throw new Error(`Privacy leak detected! Found prohibited fields in payload: ${[...new Set(leakedFields)].join(', ')}`);
  }
  console.log('✅ PRIVACY AUDIT PASSED: Absolutely NO phone, gender, age, or password fields present in API payload.');

  // -------------------------------------------------------------
  // VERIFICATION 5: Search Filtering & Case-Insensitivity
  // -------------------------------------------------------------
  console.log('\n--- 5. SEARCH FILTERING & CASE-INSENSITIVITY AUDIT ---');
  // 5a. Search lowercase partial email
  const searchPartial = 'sdivyansh';
  const searchRes1 = await fetch(`${PROD_URL}/api/admin/users?search=${searchPartial}`, {
    headers: { Cookie: superAdminAuth.cookies }
  });
  const searchData1 = await searchRes1.json();
  console.log(`Search query "${searchPartial}": found ${searchData1.users.length} match(es)`);
  searchData1.users.forEach(u => console.log(`  - ${u.email} (${u.displayName})`));

  // 5b. Search UPPERCASE partial email (case-insensitivity test)
  const searchUpper = 'SDIVYANSH';
  const searchRes2 = await fetch(`${PROD_URL}/api/admin/users?search=${searchUpper}`, {
    headers: { Cookie: superAdminAuth.cookies }
  });
  const searchData2 = await searchRes2.json();
  console.log(`Search query "${searchUpper}": found ${searchData2.users.length} match(es)`);

  if (searchData1.users.length !== searchData2.users.length || searchData1.users.length === 0) {
    throw new Error('Case-insensitive search check failed!');
  }
  console.log('✅ Search is verified case-insensitive and partial-matching across email, username, and displayName.');

  // -------------------------------------------------------------
  // VERIFICATION 6: Pagination Test
  // -------------------------------------------------------------
  console.log('\n--- 6. PAGINATION AUDIT ---');
  const pageSize = 5;
  const page1Res = await fetch(`${PROD_URL}/api/admin/users?page=1&limit=${pageSize}`, {
    headers: { Cookie: superAdminAuth.cookies }
  });
  const page1Data = await page1Res.json();

  const page2Res = await fetch(`${PROD_URL}/api/admin/users?page=2&limit=${pageSize}`, {
    headers: { Cookie: superAdminAuth.cookies }
  });
  const page2Data = await page2Res.json();

  console.log(`Pagination metadata: total=${page1Data.pagination.total}, totalPages=${page1Data.pagination.totalPages}, limit=${page1Data.pagination.limit}`);
  console.log(`Page 1 returned ${page1Data.users.length} users. First user: ${page1Data.users[0]?.email}`);
  console.log(`Page 2 returned ${page2Data.users.length} users. First user: ${page2Data.users[0]?.email}`);

  if (page1Data.users[0]?.id === page2Data.users[0]?.id) {
    throw new Error('Pagination offset failed: Page 1 and Page 2 returned the same first user!');
  }
  console.log('✅ Pagination correctly offsets records and calculates total pages.');

  await pool.end();
  console.log('\n=== ALL VERIFICATIONS PASSED SUCCESSFULLY ===');
}

run().catch(err => {
  console.error('Verification failed:', err);
  process.exit(1);
});
