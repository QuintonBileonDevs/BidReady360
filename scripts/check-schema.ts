import { query, pool } from '../server/db/client';

async function addUniqueEmailIndex() {
  console.log('Ensuring unique index on suppliers.email...');
  try {
    await query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_suppliers_email 
      ON public.suppliers (LOWER(email::text)) 
      WHERE (deleted_at IS NULL AND email IS NOT NULL);
    `);
    console.log('Unique index idx_suppliers_email verified.');
  } catch (err: any) {
    console.warn('Index notice:', err.message);
  }
  await pool.end();
}

addUniqueEmailIndex().catch(console.error);
