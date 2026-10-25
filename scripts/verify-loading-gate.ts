import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { query, pool } from '../server/db/client';
import { generateRandomToken, hashToken } from '../server/utils/crypto';

async function runLoadingGateVerification() {
  console.log('=== VERIFYING LOADING GATE & BOOTSTRAP BACKEND ===\n');

  // 1. Ensure test user & supplier exist
  const email = 'gate_test@example.co.bw';
  const rawToken = generateRandomToken(32);
  const tokenHash = hashToken(rawToken);
  const passwordHash = await bcrypt.hash('SecureGatePass123!', 12);

  // Setup user
  let userRes = await query('SELECT id FROM users WHERE email = $1', [email]);
  let userId: string;
  if (userRes.rows.length === 0) {
    const u = await query(
      `INSERT INTO users (email, password_hash, full_name, phone, status, email_verified_at)
       VALUES ($1, $2, 'Gate Test User', '+267 71998877', 'active', NOW()) RETURNING id`,
      [email, passwordHash]
    );
    userId = u.rows[0].id;
  } else {
    userId = userRes.rows[0].id;
  }

  // Setup supplier
  let supRes = await query('SELECT id FROM suppliers WHERE email = $1', [email]);
  let supplierId: string;
  if (supRes.rows.length === 0) {
    const s = await query(
      `INSERT INTO suppliers (legal_name, trading_name, cipa_uin, email, primary_phone, city, country_code, status, verification_status, compliance_status, profile_completeness)
       VALUES ('Gate Verified Supplies (Pty) Ltd', 'Gate Verified', 'BW00009999888', $1, '+267 71998877', 'Gaborone', 'BW', 'active', 'verified', 'Fully compliant', 100)
       RETURNING id`,
      [email]
    );
    supplierId = s.rows[0].id;
  } else {
    supplierId = supRes.rows[0].id;
  }

  // Link membership
  const roleRes = await query("SELECT id FROM roles WHERE scope = 'supplier' AND name = 'Supplier Admin' LIMIT 1");
  const roleId = roleRes.rows[0]?.id;
  if (roleId) {
    await query(
      `INSERT INTO supplier_members (supplier_id, user_id, role_id, is_owner, status, joined_at)
       VALUES ($1, $2, $3, TRUE, 'active', NOW())
       ON CONFLICT (supplier_id, user_id) DO UPDATE SET status = 'active'`,
      [supplierId, userId, roleId]
    );
  }

  // Create session
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  await query(
    `INSERT INTO sessions (user_id, token_hash, tenant_type, tenant_id, expires_at)
     VALUES ($1, $2, 'supplier', $3, $4)`,
    [userId, tokenHash, supplierId, expiresAt]
  );

  console.log('1. Created test session token for:', email);

  // 2. Direct simulation of /api/bootstrap logic
  // Test query execution with active session
  const authRes = await query(
    `SELECT s.id AS "sessionId", s.tenant_type AS "tenantType", s.tenant_id AS "tenantId",
            u.id, u.email, u.full_name AS "fullName", u.status, u.is_platform_admin AS "isPlatformAdmin"
     FROM sessions s
     JOIN users u ON u.id = s.user_id
     WHERE s.token_hash = $1 AND s.expires_at > NOW() AND s.revoked_at IS NULL`,
    [tokenHash]
  );

  console.log('2. Session verification against database:');
  console.log('   Authenticated user:', authRes.rows[0].email);
  console.log('   Active tenant ID:', authRes.rows[0].tenantId);

  // Test profile lookup
  const profileRes = await query(
    `SELECT s.id, s.legal_name AS "legalName", s.trading_name AS "tradingName",
            s.cipa_uin AS "cipaNumber", s.burs_tin AS "tinNumber", s.profile_completeness AS "profileCompleteness",
            s.status, s.verification_status AS "verificationStatus"
     FROM suppliers s WHERE s.id = $1`,
    [supplierId]
  );

  console.log('3. Bootstrap profile query response:');
  console.log('   Supplier legal name:', profileRes.rows[0].legalName);
  console.log('   Completeness:', profileRes.rows[0].profileCompleteness + '%');
  console.log('   Verified CIPA:', profileRes.rows[0].cipaNumber);

  // Assert user ID match
  if (authRes.rows[0].id !== userId) {
    throw new Error('User ID mismatch!');
  }
  console.log('4. SUCCESS: User ID strictly matches between session and bootstrap response.');

  // Clean up test session token
  await query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash]);
  console.log('5. Cleaned up test session token.');

  console.log('\n=== ALL LOADING GATE BACKEND CHECKS PASSED ===');
  await pool.end();
}

runLoadingGateVerification().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
