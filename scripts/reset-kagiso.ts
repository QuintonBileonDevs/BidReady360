import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { query, pool } from '../server/db/client';

async function resetKagisoPassword() {
  console.log('--- Resetting Password & Activating Kagiso Phiri Account ---');

  const email = 'kagiso@phiricontracting.co.bw';
  const newPassword = 'Password123!';
  const passwordHash = await bcrypt.hash(newPassword, 12);

  // 1. Update user password, activate, verify email
  const userRes = await query(
    `UPDATE users
     SET password_hash = $1,
         status = 'active',
         email_verified_at = COALESCE(email_verified_at, NOW()),
         failed_login_attempts = 0,
         locked_until = NULL,
         updated_at = NOW()
     WHERE LOWER(email::text) = LOWER($2)
     RETURNING id, email, full_name, status`,
    [passwordHash, email]
  );

  if (userRes.rows.length === 0) {
    console.error(`User ${email} not found in database! Creating user...`);
    const insertRes = await query(
      `INSERT INTO users (email, password_hash, full_name, phone, status, email_verified_at)
       VALUES ($1, $2, 'Kagiso Phiri', '+267 72123456', 'active', NOW())
       RETURNING id, email, full_name, status`,
      [email, passwordHash]
    );
    console.log('Created user:', insertRes.rows[0]);
  } else {
    console.log('Successfully updated user credentials for:', userRes.rows[0].email);
  }

  // 2. Ensure supplier and membership exist
  const user = (await query('SELECT id, email, full_name, phone FROM users WHERE LOWER(email::text) = LOWER($1)', [email])).rows[0];
  
  let supRes = await query('SELECT id FROM suppliers WHERE LOWER(email::text) = LOWER($1) OR cipa_uin = $2', [email, 'BW00003429104']);
  let supplierId: string;

  if (supRes.rows.length > 0) {
    supplierId = supRes.rows[0].id;
    await query(
      `UPDATE suppliers SET status = 'active', verification_status = 'verified', email = $1 WHERE id = $2`,
      [email, supplierId]
    );
  } else {
    const newSup = await query(
      `INSERT INTO suppliers (legal_name, trading_name, cipa_uin, email, primary_phone, city, country_code, status, verification_status, compliance_status, profile_completeness)
       VALUES ('Phiri Contracting (Pty) Ltd', 'Phiri Contracting', 'BW00003429104', $1, '+267 72123456', 'Gaborone', 'BW', 'active', 'verified', 'Fully compliant', 100)
       RETURNING id`,
      [email]
    );
    supplierId = newSup.rows[0].id;
  }

  const roleRes = await query("SELECT id FROM roles WHERE scope = 'supplier' AND name = 'Supplier Admin' LIMIT 1");
  const roleId = roleRes.rows[0]?.id;

  if (roleId) {
    await query(
      `INSERT INTO supplier_members (supplier_id, user_id, role_id, is_owner, status, joined_at)
       VALUES ($1, $2, $3, TRUE, 'active', NOW())
       ON CONFLICT (supplier_id, user_id) DO UPDATE SET status = 'active'`,
      [supplierId, user.id, roleId]
    );
  }

  console.log('--- Kagiso Password Reset & Workspace Association Complete ---');
  await pool.end();
}

resetKagisoPassword().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
