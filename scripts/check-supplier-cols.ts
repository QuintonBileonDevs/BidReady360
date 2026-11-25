import dotenv from 'dotenv';
dotenv.config();

import { query } from '../server/db/client.js';

async function check() {
  try {
    const res = await query(`
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns 
      WHERE table_name = 'suppliers'
      ORDER BY ordinal_position
    `);
    console.log('Suppliers columns:', res.rows.map(r => `${r.column_name} (${r.data_type})`));

    const checkCons = await query(`
      SELECT conname, pg_get_constraintdef(c.oid)
      FROM pg_constraint c
      JOIN pg_class t ON c.conrelid = t.oid
      WHERE t.relname = 'suppliers' AND c.contype = 'c'
    `);
    console.log('Suppliers check constraints:', checkCons.rows);
  } catch (err: any) {
    console.error('Error:', err.message);
  } finally {
    process.exit(0);
  }
}

check();
