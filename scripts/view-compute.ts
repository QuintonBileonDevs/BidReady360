import dotenv from 'dotenv';
dotenv.config();

import { query } from '../server/db/client.js';

async function check() {
  try {
    const res = await query(`
      SELECT routine_definition 
      FROM information_schema.routines 
      WHERE routine_name = 'compute_supplier_completeness'
    `);
    console.log(res.rows[0].routine_definition);
  } catch (err: any) {
    console.error('Error:', err.message);
  } finally {
    process.exit(0);
  }
}

check();
