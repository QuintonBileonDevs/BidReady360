import 'dotenv/config';
import { query, pool } from '../server/db/client';

async function inspectRelationship() {
  console.log('=== INSPECTING DATABASE RELATIONSHIPS FOR KAGISO & KALAHARI ===\n');

  // 1. Find user Kagiso
  const userRes = await query(
    `SELECT id, email, full_name, status FROM users WHERE LOWER(email::text) LIKE '%kagiso%'`,
  );
  console.log('1. User matching Kagiso:', userRes.rows);

  if (userRes.rows.length === 0) {
    console.log('No user found matching Kagiso.');
    await pool.end();
    return;
  }

  const userId = userRes.rows[0].id;
  const userEmail = userRes.rows[0].email;

  // 2. Find suppliers matching Kalahari
  const supRes = await query(
    `SELECT id, legal_name, email, cipa_uin FROM suppliers WHERE LOWER(legal_name::text) LIKE '%kalahari%'`,
  );
  console.log('2. Suppliers matching Kalahari:', supRes.rows);

  // 3. Find all supplier memberships for Kagiso's userId
  const memberRes = await query(
    `SELECT sm.supplier_id, s.legal_name, s.email AS supplier_email, r.name AS role_name, sm.is_owner, sm.status
     FROM supplier_members sm
     JOIN suppliers s ON s.id = sm.supplier_id
     JOIN roles r ON r.id = sm.role_id
     WHERE sm.user_id = $1`,
    [userId]
  );
  console.log(`3. Supplier memberships for user ID ${userId} (${userEmail}):`, memberRes.rows);

  // 4. Find all supplier people records matching Kagiso email or name
  const peopleRes = await query(
    `SELECT sp.supplier_id, s.legal_name, sp.full_name, sp.person_role, sp.email
     FROM supplier_people sp
     JOIN suppliers s ON s.id = sp.supplier_id
     WHERE LOWER(sp.email::text) = LOWER($1) OR LOWER(sp.full_name::text) LIKE '%kagiso%'`,
    [userEmail]
  );
  console.log('4. Supplier people records matching Kagiso:', peopleRes.rows);

  console.log('\n=== INSPECTION COMPLETE ===');
  await pool.end();
}

inspectRelationship().catch((err) => {
  console.error('Inspection failed:', err);
  process.exit(1);
});
