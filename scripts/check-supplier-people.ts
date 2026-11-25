import dotenv from 'dotenv';
dotenv.config();

import { query } from '../server/db/client.js';

async function check() {
  try {
    const res = await query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'supplier_people'
    `);
    console.log('supplier_people columns:', res.rows.map(r => r.column_name));
  } catch (err: any) {
    console.error('Error:', err.message);
  } finally {
    process.exit(0);
  }
}

check();
