import { query, pool } from '../server/db/client';

async function seedKagisoSupplier() {
  console.log('--- Linking Kagiso Phiri to Supplier Entity in bidready360 ---');

  const userRes = await query(
    'SELECT id, email, full_name, phone FROM users WHERE email = $1',
    ['kagiso@phiricontracting.co.bw']
  );

  if (userRes.rows.length === 0) {
    console.error('Kagiso user not found!');
    process.exit(1);
  }

  const user = userRes.rows[0];
  console.log('User found in bidready360:', user.email, 'ID:', user.id);

  // Check or insert supplier
  let supplierId: string;
  const supCheck = await query(
    'SELECT id FROM suppliers WHERE email = $1 OR cipa_uin = $2',
    [user.email, 'BW00003429104']
  );

  if (supCheck.rows.length > 0) {
    supplierId = supCheck.rows[0].id;
    console.log('Supplier record already exists:', supplierId);
  } else {
    const insertSup = await query(
      `INSERT INTO suppliers (
        legal_name, trading_name, cipa_uin, email, primary_phone, city, country_code,
        status, verification_status, compliance_status, profile_completeness
      ) VALUES (
        'Phiri Contracting (Pty) Ltd', 'Phiri Contracting', 'BW00003429104',
        $1, $2, 'Gaborone', 'BW', 'active', 'unverified', 'Action required', 30
      ) RETURNING id`,
      [user.email, user.phone || '+267 72123456']
    );
    supplierId = insertSup.rows[0].id;
    console.log('Created supplier record in bidready360:', supplierId);
  }

  // Get Supplier Admin role
  const roleRes = await query(
    "SELECT id FROM roles WHERE scope = 'supplier' AND name = 'Supplier Admin' LIMIT 1"
  );
  const roleId = roleRes.rows[0]?.id;

  // Link in supplier_members
  await query(
    `INSERT INTO supplier_members (supplier_id, user_id, role_id, is_owner, status, joined_at)
     VALUES ($1, $2, $3, TRUE, 'active', NOW())
     ON CONFLICT (supplier_id, user_id) DO UPDATE SET role_id = $3, status = 'active'`,
    [supplierId, user.id, roleId]
  );
  console.log('Linked Kagiso Phiri as Supplier Admin to supplier:', supplierId);

  // Add to supplier_people
  const personCheck = await query(
    'SELECT id FROM supplier_people WHERE supplier_id = $1 AND email = $2',
    [supplierId, user.email]
  );
  if (personCheck.rows.length === 0) {
    await query(
      `INSERT INTO supplier_people (
        supplier_id, full_name, person_role, nationality, is_citizen, email, phone, kyc_status, is_active
      ) VALUES (
        $1, $2, 'director', 'Motswana', TRUE, $3, $4, 'verified', TRUE
      )`,
      [supplierId, user.full_name, user.email, user.phone || '+267 72123456']
    );
    console.log('Added director profile in supplier_people.');
  }

  // Verify
  const memberships = await query(
    `SELECT sm.id, s.id as supplier_id, s.legal_name, u.email, r.name as role_name
     FROM supplier_members sm
     JOIN suppliers s ON sm.supplier_id = s.id
     JOIN users u ON sm.user_id = u.id
     JOIN roles r ON sm.role_id = r.id
     WHERE u.id = $1`,
    [user.id]
  );
  console.log('Verified active memberships for Kagiso:', memberships.rows);

  await pool.end();
}

seedKagisoSupplier().catch((err) => {
  console.error('Failed:', err);
  process.exit(1);
});
