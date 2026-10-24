import 'dotenv/config';
import { query, pool } from '../server/db/client';

async function fixKagisoSupplierLink() {
  console.log('--- Fixing Kagiso Supplier Association ---');

  const userEmail = 'kagiso@phiricontracting.co.bw';
  const userRes = await query('SELECT id, email, full_name FROM users WHERE LOWER(email::text) = LOWER($1)', [userEmail]);
  if (userRes.rows.length === 0) {
    console.error('Kagiso user not found!');
    await pool.end();
    return;
  }
  const user = userRes.rows[0];
  console.log('Found user:', user);

  // 1. Check if Phiri Contracting supplier exists
  let phiriRes = await query(
    `SELECT id, legal_name FROM suppliers WHERE LOWER(legal_name::text) LIKE '%phiri%' OR cipa_uin = 'BW00003429104'`
  );

  let phiriSupplierId: string;
  if (phiriRes.rows.length > 0) {
    phiriSupplierId = phiriRes.rows[0].id;
    console.log('Found existing Phiri Contracting supplier ID:', phiriSupplierId);
    await query(
      `UPDATE suppliers SET email = $1, status = 'active', verification_status = 'verified' WHERE id = $2`,
      [userEmail, phiriSupplierId]
    );
  } else {
    const newSup = await query(
      `INSERT INTO suppliers (
         legal_name, trading_name, cipa_uin, email, primary_phone, city, country_code,
         status, verification_status, compliance_status, profile_completeness
       ) VALUES (
         'Phiri Contracting (Pty) Ltd', 'Phiri Contracting', 'BW00003429104',
         $1, '+267 72123456', 'Gaborone', 'BW', 'active', 'verified', 'Fully compliant', 100
       ) RETURNING id`,
      [userEmail]
    );
    phiriSupplierId = newSup.rows[0].id;
    console.log('Created Phiri Contracting supplier ID:', phiriSupplierId);
  }

  // 2. Get Supplier Admin role
  const roleRes = await query("SELECT id FROM roles WHERE scope = 'supplier' AND name = 'Supplier Admin' LIMIT 1");
  const roleId = roleRes.rows[0]?.id;

  // 3. Remove incorrect link to Kalahari Technologies
  await query(
    `DELETE FROM supplier_members WHERE user_id = $1 AND supplier_id != $2`,
    [user.id, phiriSupplierId]
  );
  console.log('Removed any incorrect supplier memberships for Kagiso.');

  // 4. Link Kagiso strictly to Phiri Contracting
  if (roleId) {
    await query(
      `INSERT INTO supplier_members (supplier_id, user_id, role_id, is_owner, status, joined_at)
       VALUES ($1, $2, $3, TRUE, 'active', NOW())
       ON CONFLICT (supplier_id, user_id) DO UPDATE SET role_id = $3, status = 'active'`,
      [phiriSupplierId, user.id, roleId]
    );
    console.log('Linked Kagiso to Phiri Contracting as Supplier Admin.');
  }

  // 5. Ensure supplier_people has Kagiso for Phiri Contracting
  const personCheck = await query(
    `SELECT id FROM supplier_people WHERE supplier_id = $1 AND LOWER(email::text) = LOWER($2)`,
    [phiriSupplierId, userEmail]
  );
  if (personCheck.rows.length === 0) {
    await query(
      `INSERT INTO supplier_people (
         supplier_id, full_name, person_role, nationality, is_citizen, email, phone, kyc_status, is_active
       ) VALUES (
         $1, $2, 'director', 'Motswana', TRUE, $3, '+267 72123456', 'verified', TRUE
       )`,
      [phiriSupplierId, user.full_name, userEmail]
    );
    console.log('Added Kagiso as director in supplier_people for Phiri Contracting.');
  }

  console.log('--- Kagiso Supplier Link Fixed Successfully ---');
  await pool.end();
}

fixKagisoSupplierLink().catch((err) => {
  console.error('Fix failed:', err);
  process.exit(1);
});
