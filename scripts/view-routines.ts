import dotenv from 'dotenv';
dotenv.config();

import { query } from '../server/db/client.js';

async function check() {
  try {
    const res = await query(`
      SELECT routine_name, routine_definition 
      FROM information_schema.routines 
      WHERE routine_name IN ('compute_supplier_completeness', 'recalc_supplier_completeness', 'compute_supplier_missing_items')
    `);
    for (const r of res.rows) {
      console.log('=== ROUTINE:', r.routine_name, '===');
      console.log(r.routine_definition);
    }
  } catch (err: any) {
    console.error('Error:', err.message);
  } finally {
    process.exit(0);
  }
}

check();
