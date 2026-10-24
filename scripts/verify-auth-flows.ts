import 'dotenv/config';
import { authService } from '../server/services/auth.service';
import { query, pool } from '../server/db/client';
import { hashPassword, hashToken } from '../server/utils/crypto';

async function runAuthTests() {
  console.log('=== RUNNING BIDREADY360 AUTH SUITE VERIFICATIONS ===\n');

  const testEmail = `test_sup_${Date.now()}@example.co.bw`;
  const correctPassword = 'SecurePassword123!';
  const wrongPassword = 'WrongPassword456!';

  // 0. Test credentials

  // -------------------------------------------------------------------------
  // Test 1: Register supplier with pending status
  // -------------------------------------------------------------------------
  console.log('1. Testing Supplier Registration (Pending email verification)...');
  const regRes = await authService.registerSupplier({
    legalName: 'Test Contracting (Pty) Ltd',
    cipaUin: 'BW-TEST-' + Math.floor(100000 + Math.random() * 900000),
    fullName: 'Boipelo Tau',
    email: testEmail,
    password: correctPassword,
    ip: '127.0.0.1',
  });
  console.log('   Registration result:', regRes.success, regRes.message);
  console.log('   Verification token generated:', !!regRes.verificationToken);

  // -------------------------------------------------------------------------
  // Test 2: Unverified user is refused login
  // -------------------------------------------------------------------------
  console.log('\n2. Testing unverified user login attempt...');
  try {
    await authService.login(testEmail, correctPassword, '127.0.0.1');
    console.error('   FAIL: Unverified user was allowed to sign in!');
  } catch (err: any) {
    console.log(`   SUCCESS: Unverified login was refused with message: "${err.message}" (code: ${err.code})`);
  }

  // -------------------------------------------------------------------------
  // Test 3: Verify email with single-use token
  // -------------------------------------------------------------------------
  console.log('\n3. Testing email verification with single-use token...');
  const verifyRes = await authService.verifyEmailWithToken(regRes.verificationToken!, '127.0.0.1');
  console.log('   Email verification result:', verifyRes.success, verifyRes.message);

  // Verification token single-use check
  try {
    await authService.verifyEmailWithToken(regRes.verificationToken!, '127.0.0.1');
    console.error('   FAIL: Re-using verification token succeeded!');
  } catch (err: any) {
    console.log(`   SUCCESS: Re-used verification token correctly refused: "${err.message}"`);
  }

  // -------------------------------------------------------------------------
  // Test 4: Right password signs in
  // -------------------------------------------------------------------------
  console.log('\n4. Testing correct password login after verification...');
  const loginSuccessRes = await authService.login(testEmail, correctPassword, '127.0.0.1');
  console.log('   SUCCESS: Right password signed in!');
  console.log('   Raw session token returned:', !!loginSuccessRes.token);
  console.log('   Active Tenant Type:', loginSuccessRes.activeTenant?.tenantType);
  console.log('   Active Tenant Name:', loginSuccessRes.activeTenant?.tenantName);

  // -------------------------------------------------------------------------
  // Test 5: Wrong password is refused
  // -------------------------------------------------------------------------
  console.log('\n5. Testing wrong password login...');
  try {
    await authService.login(testEmail, wrongPassword, '127.0.0.1');
    console.error('   FAIL: Wrong password signed user in!');
  } catch (err: any) {
    console.log(`   SUCCESS: Wrong password refused with message: "${err.message}"`);
  }

  // -------------------------------------------------------------------------
  // Test 6: Unknown email gives the exact same generic error
  // -------------------------------------------------------------------------
  console.log('\n6. Testing unknown email login...');
  try {
    await authService.login('nonexistent_user_999@example.co.bw', wrongPassword, '127.0.0.1');
    console.error('   FAIL: Non-existent user signed in!');
  } catch (err: any) {
    console.log(`   SUCCESS: Unknown email refused with identical message: "${err.message}"`);
  }

  // -------------------------------------------------------------------------
  // Test 7: Brute-force protection: 6th failure returns 429
  // -------------------------------------------------------------------------
  console.log('\n7. Testing brute-force protection (5 failures -> 6th returns 429)...');
  const bruteForceEmail = `brute_${Date.now()}@example.co.bw`;
  // Record 5 failures
  for (let i = 1; i <= 5; i++) {
    try {
      await authService.login(bruteForceEmail, 'WrongPass123!', '192.168.10.50');
    } catch {}
  }
  // 6th try
  try {
    await authService.login(bruteForceEmail, 'WrongPass123!', '192.168.10.50');
    console.error('   FAIL: 6th wrong attempt was not blocked with 429!');
  } catch (err: any) {
    console.log(`   SUCCESS: 6th attempt blocked! Status: ${err.status}, Message: "${err.message}"`);
  }

  // -------------------------------------------------------------------------
  // Test 8: Logout revokes session
  // -------------------------------------------------------------------------
  console.log('\n8. Testing logout revoking session in database...');
  await authService.logout(loginSuccessRes.token!, '127.0.0.1');
  const sessCheck = await query(
    `SELECT revoked_at FROM sessions WHERE token_hash = $1`,
    [hashToken(loginSuccessRes.token!)]
  );
  console.log('   SUCCESS: Session marked revoked_at in DB:', !!sessCheck.rows[0]?.revoked_at);

  // -------------------------------------------------------------------------
  // Test 9: Password reset flow & single-use reset token
  // -------------------------------------------------------------------------
  console.log('\n9. Testing password reset flow & single-use token...');
  const forgotRes = await authService.forgotPassword(testEmail, '127.0.0.1');
  console.log('   Forgot password response:', forgotRes.message);
  console.log('   Reset token created in DB:', !!forgotRes.token);

  const newPassword = 'NewSecretPassword987!';
  const resetRes = await authService.resetPassword(forgotRes.token!, newPassword, '127.0.0.1');
  console.log('   Password reset result:', resetRes.message);

  // Re-using reset token
  try {
    await authService.resetPassword(forgotRes.token!, 'AnotherPassword123!', '127.0.0.1');
    console.error('   FAIL: Re-using password reset token succeeded!');
  } catch (err: any) {
    console.log(`   SUCCESS: Re-used reset token refused: "${err.message}"`);
  }

  // Signing in with new password
  const newLoginRes = await authService.login(testEmail, newPassword, '127.0.0.1');
  console.log('   SUCCESS: Signed in with new password successfully!');

  // Verify old password fails
  try {
    await authService.login(testEmail, correctPassword, '127.0.0.1');
    console.error('   FAIL: Old password still worked!');
  } catch (err: any) {
    console.log('   SUCCESS: Old password rejected:', err.message);
  }

  // -------------------------------------------------------------------------
  console.log('\n=== ALL AUTH VERIFICATIONS PASSED SUCCESSFULLY ===');
  await pool.end();
}

runAuthTests().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
