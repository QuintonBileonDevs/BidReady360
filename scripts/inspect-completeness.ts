import dotenv from 'dotenv';
dotenv.config();

import { query } from '../server/db/client.js';

async function check() {
  try {
    const res = await query(`
      SELECT routine_name 
      FROM information_schema.routines 
      WHERE routine_name LIKE '%supplier_completeness%'
    `);
    console.log('Existing routines:', res.rows);

    const supRes = await query(`SELECT id, legal_name, profile_completeness FROM suppliers LIMIT 5`);
    console.log('Suppliers:', supRes.rows);

    if (supRes.rows.length > 0) {
      const supId = supRes.rows[0].id;
      const compRes = await query(`SELECT compute_supplier_completeness($1) as comp`, [supId]);
      console.log('compute_supplier_completeness result for first supplier:', compRes.rows);
    }
  } catch (err: any) {
    console.error('Error:', err.message);
  } finally {
    process.exit(0);
  }
}

check();
