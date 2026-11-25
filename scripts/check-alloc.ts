import dotenv from 'dotenv';
dotenv.config();

import { query } from '../server/db/client.js';

async function check() {
  try {
    const res = await query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'supplier_discipline_allocations'
    `);
    console.log('supplier_discipline_allocations columns:', res.rows);
  } catch (err: any) {
    console.error('Error:', err.message);
  } finally {
    process.exit(0);
  }
}

check();
