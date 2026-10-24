import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { query, pool } from '../server/db/client';

async function syncSuppliersToUsers() {
  console.log('--- Syncing All Suppliers to Users Table ---');

  // 1. Fetch all active suppliers
  const suppliersRes = await query<{
    id: string;
    legal_name: string;
    email: string | null;
    primary_phone: string | null;
  }>(
    `SELECT id, legal_name, email, primary_phone FROM suppliers WHERE deleted_at IS NULL`
  );

  console.log(`Found ${suppliersRes.rows.length} suppliers in database.`);

  const defaultPasswordHash = await bcrypt.hash('Password123!', 12);
  const roleRes = await query("SELECT id FROM roles WHERE scope = 'supplier' AND name = 'Supplier Admin' LIMIT 1");
  const roleId = roleRes.rows[0]?.id;

  let syncedCount = 0;
  let createdCount = 0;

  for (const sup of suppliersRes.rows) {
    const email = sup.email && sup.email.trim() ? sup.email.trim().toLowerCase() : `supplier_${sup.id.substring(0, 8)}@bidready360.co.bw`;
    const fullName = sup.legal_name || 'Supplier Director';
    const phone = sup.primary_phone || '+267 71234567';

    // 2. Check if user exists for this email
    let userRes = await query<{ id: string }>(
      `SELECT id FROM users WHERE LOWER(email::text) = LOWER($1) AND deleted_at IS NULL LIMIT 1`,
      [email]
    );

    let userId: string;

    if (userRes.rows.length > 0) {
      userId = userRes.rows[0].id;
      // Ensure active and verified
      await query(
        `UPDATE users
         SET status = 'active',
             email_verified_at = COALESCE(email_verified_at, NOW()),
             password_hash = COALESCE(password_hash, $1)
         WHERE id = $2`,
        [defaultPasswordHash, userId]
      );
      syncedCount++;
    } else {
      // Create user
      const newUserRes = await query<{ id: string }>(
        `INSERT INTO users (email, password_hash, full_name, phone, status, email_verified_at)
         VALUES ($1, $2, $3, $4, 'active', NOW())
         RETURNING id`,
        [email, defaultPasswordHash, fullName, phone]
      );
      userId = newUserRes.rows[0].id;
      createdCount++;
      console.log(`Created user for supplier '${sup.legal_name}' -> ${email} (Password: Password123!)`);
    }

    // 3. Ensure supplier_members link
    if (roleId) {
      await query(
        `INSERT INTO supplier_members (supplier_id, user_id, role_id, is_owner, status, joined_at)
         VALUES ($1, $2, $3, TRUE, 'active', NOW())
         ON CONFLICT (supplier_id, user_id) DO UPDATE SET status = 'active'`,
        [sup.id, userId, roleId]
      );
    }
  }

  console.log(`\n--- Supplier User Sync Complete ---`);
  console.log(`Total suppliers checked: ${suppliersRes.rows.length}`);
  console.log(`New users created: ${createdCount}`);
  console.log(`Existing users synced: ${syncedCount}`);

  await pool.end();
}

syncSuppliersToUsers().catch((err) => {
  console.error('Supplier user sync failed:', err);
  process.exit(1);
});
