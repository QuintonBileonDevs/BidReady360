import 'dotenv/config';
import { query } from '../server/db/client';
import { hashPassword } from '../server/utils/crypto';

const BASE_URL = 'http://localhost:3000';

async function runTests() {
  console.log('--- STARTING AUTHENTICATION VERIFICATION SUITE ---');

  // Setup test users in PostgreSQL
  const testVerifiedEmail = `test.verified.${Date.now()}@bidready.test`;
  const testPendingEmail = `test.pending.${Date.now()}@bidready.test`;
  const bruteEmail = `brute.test.${Date.now()}@bidready.test`;
  const validPassword = 'SecurePassword123!';
  const hashedPassword = await hashPassword(validPassword);

  // 1. Create verified user with supplier membership
  const verifiedUserRes = await query<{ id: string }>(
    `INSERT INTO users (email, password_hash, full_name, status, email_verified_at)
     VALUES ($1, $2, 'Verified Supplier', 'active', NOW())
     RETURNING id`,
    [testVerifiedEmail, hashedPassword]
  );
  const verifiedUserId = verifiedUserRes.rows[0].id;

  const supplierRes = await query<{ id: string }>(
    `INSERT INTO suppliers (legal_name, trading_name, cipa_uin, email, country_code, status, compliance_status)
     VALUES ('Test Verified Enterprises', 'Test Verified', $1, $2, 'BW', 'active', 'Fully compliant')
     RETURNING id`,
    [`BW-TEST-${Date.now()}`, testVerifiedEmail]
  );
  const supplierId = supplierRes.rows[0].id;

  const roleRes = await query<{ id: string }>(
    `SELECT id FROM roles WHERE scope = 'supplier' AND is_system = TRUE LIMIT 1`
  );
  await query(
    `INSERT INTO supplier_members (supplier_id, user_id, role_id, is_owner, status)
     VALUES ($1, $2, $3, TRUE, 'active')`,
    [supplierId, verifiedUserId, roleRes.rows[0].id]
  );

  // 2. Create unverified user
  await query(
    `INSERT INTO users (email, password_hash, full_name, status, email_verified_at)
     VALUES ($1, $2, 'Unverified Supplier', 'pending', NULL)`,
    [testPendingEmail, hashedPassword]
  );

  // 3. Create user for brute-force test
  await query(
    `INSERT INTO users (email, password_hash, full_name, status, email_verified_at)
     VALUES ($1, $2, 'Brute Test', 'active', NOW())`,
    [bruteEmail, hashedPassword]
  );

  let passedCount = 0;

  // TEST 1: Right password signs in
  console.log('\n[TEST 1] Right password signs in...');
  const res1 = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' },
    body: JSON.stringify({ email: testVerifiedEmail, password: validPassword }),
  });
  const data1 = await res1.json();
  const cookieHeader = res1.headers.get('set-cookie') || '';
  const tokenMatch = cookieHeader.match(/session_token=([^;]+)/);
  const sessionToken = data1.token || (tokenMatch ? tokenMatch[1] : null);

  if (res1.status === 200 && data1.user && sessionToken) {
    console.log('✅ TEST 1 PASSED: Right password signs in successfully (HTTP 200) and session cookie set.');
    passedCount++;
  } else {
    console.error('❌ TEST 1 FAILED:', res1.status, data1);
  }

  // TEST 2: Wrong password is refused
  console.log('\n[TEST 2] Wrong password is refused...');
  const res2 = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' },
    body: JSON.stringify({ email: testVerifiedEmail, password: 'WrongPassword123!' }),
  });
  const data2 = await res2.json();
  if (res2.status === 401 && data2.message === 'Email or password is incorrect.') {
    console.log('✅ TEST 2 PASSED: Wrong password refused with HTTP 401 "Email or password is incorrect."');
    passedCount++;
  } else {
    console.error('❌ TEST 2 FAILED:', res2.status, data2);
  }

  // TEST 3: Unknown email gives the exact same message
  console.log('\n[TEST 3] Unknown email gives the exact same message...');
  const res3 = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' },
    body: JSON.stringify({ email: `unknown.user.${Date.now()}@bidready.test`, password: 'SomePassword123!' }),
  });
  const data3 = await res3.json();
  if (res3.status === 401 && data3.message === 'Email or password is incorrect.') {
    console.log('✅ TEST 3 PASSED: Unknown email gives identical HTTP 401 "Email or password is incorrect."');
    passedCount++;
  } else {
    console.error('❌ TEST 3 FAILED:', res3.status, data3);
  }

  // TEST 4: Unverified user is refused
  console.log('\n[TEST 4] Unverified user is refused...');
  const res4 = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' },
    body: JSON.stringify({ email: testPendingEmail, password: validPassword }),
  });
  const data4 = await res4.json();
  if (res4.status === 403 && data4.message === 'Verify your email first.') {
    console.log('✅ TEST 4 PASSED: Unverified user refused with HTTP 403 "Verify your email first."');
    passedCount++;
  } else {
    console.error('❌ TEST 4 FAILED:', res4.status, data4);
  }

  // TEST 5: 6th wrong try returns 429
  console.log('\n[TEST 5] 6th wrong try returns 429...');
  for (let i = 1; i <= 5; i++) {
    await fetch(`${BASE_URL}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' },
      body: JSON.stringify({ email: bruteEmail, password: 'WrongPassword' + i }),
    });
  }
  const res5 = await fetch(`${BASE_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' },
    body: JSON.stringify({ email: bruteEmail, password: 'WrongPassword6' }),
  });
  const data5 = await res5.json();
  if (res5.status === 429 && data5.message?.includes('Too many attempts')) {
    console.log('✅ TEST 5 PASSED: 6th attempt blocked with HTTP 429 "Too many attempts. Try again in 15 minutes."');
    passedCount++;
  } else {
    console.error('❌ TEST 5 FAILED:', res5.status, data5);
  }

  // TEST 6: Supplier cannot open buyer route
  console.log('\n[TEST 6] Supplier cannot open a buyer page...');
  const res6 = await fetch(`${BASE_URL}/api/buyer/applications`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      Origin: 'http://localhost:3000',
    },
  });
  const data6 = await res6.json();
  if (res6.status === 403 && data6.error === 'INVALID_TENANT_TYPE') {
    console.log('✅ TEST 6 PASSED: Supplier blocked from buyer endpoint with HTTP 403 (INVALID_TENANT_TYPE).');
    passedCount++;
  } else {
    console.error('❌ TEST 6 FAILED:', res6.status, data6);
  }

  // TEST 7: Changing the email/tenant in a request does not change the profile
  console.log('\n[TEST 7] Changing email in request does not change profile (derived strictly from session)...');
  const res7 = await fetch(`${BASE_URL}/api/supplier/profile?email=attacker@spoofed.com&tenantId=spoofed-id`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      Origin: 'http://localhost:3000',
    },
  });
  const data7 = await res7.json();
  if (res7.status === 200 && data7.id === supplierId && data7.email === testVerifiedEmail) {
    console.log('✅ TEST 7 PASSED: Profile loaded strictly from session (supplierId = ' + data7.id + '), spoofed params ignored.');
    passedCount++;
  } else {
    console.error('❌ TEST 7 FAILED:', res7.status, data7);
  }

  // TEST 8: Logout then GET /api/auth/me returns 401
  console.log('\n[TEST 8] Logout then GET /api/auth/me returns 401...');
  const res8Logout = await fetch(`${BASE_URL}/api/auth/logout`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      Cookie: `session_token=${sessionToken}`,
      Origin: 'http://localhost:3000',
    },
  });
  const res8Me = await fetch(`${BASE_URL}/api/auth/me`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${sessionToken}`,
      Cookie: `session_token=${sessionToken}`,
      Origin: 'http://localhost:3000',
    },
  });
  const data8 = await res8Me.json();
  if (res8Me.status === 401 && data8.error === 'AUTHENTICATION_REQUIRED') {
    console.log('✅ TEST 8 PASSED: Session revoked on logout; subsequent GET /api/auth/me returned HTTP 401.');
    passedCount++;
  } else {
    console.error('❌ TEST 8 FAILED:', res8Me.status, data8);
  }

  // TEST 9: Reset link works once only
  console.log('\n[TEST 9] Reset link works once only...');
  // Request password reset
  const resetReqRes = await fetch(`${BASE_URL}/api/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' },
    body: JSON.stringify({ email: testVerifiedEmail }),
  });
  const resetReqData = await resetReqRes.json();
  const resetToken = resetReqData.resetToken;

  if (!resetToken) {
    console.error('❌ TEST 9 FAILED: Reset token was not returned.');
  } else {
    // First reset
    const res9First = await fetch(`${BASE_URL}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' },
      body: JSON.stringify({ token: resetToken, newPassword: 'BrandNewPassword123!' }),
    });
    const data9First = await res9First.json();

    // Second reset with same token
    const res9Second = await fetch(`${BASE_URL}/api/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'http://localhost:3000' },
      body: JSON.stringify({ token: resetToken, newPassword: 'AnotherPassword123!' }),
    });
    const data9Second = await res9Second.json();

    if (res9First.status === 200 && res9Second.status === 400 && data9Second.message?.includes('Invalid or expired')) {
      console.log('✅ TEST 9 PASSED: First reset succeeded (HTTP 200); second use rejected (HTTP 400 Single-use enforced).');
      passedCount++;
    } else {
      console.error('❌ TEST 9 FAILED:', { first: res9First.status, second: res9Second.status, data: data9Second });
    }
  }

  console.log(`\n========================================`);
  console.log(`SUMMARY: ${passedCount}/9 TESTS PASSED`);
  console.log(`========================================\n`);

  if (passedCount === 9) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('[FATAL TEST SUITE ERROR]', err);
  process.exit(1);
});
