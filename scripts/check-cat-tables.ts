import dotenv from 'dotenv';
dotenv.config();

import { query } from '../server/db/client.js';

async function check() {
  try {
    const res = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND (table_name LIKE '%cat%' OR table_name LIKE '%disc%')
    `);
    console.log('Tables matching cat/disc:', res.rows.map(r => r.table_name));
  } catch (err: any) {
    console.error('Error:', err.message);
  } finally {
    process.exit(0);
  }
}

check();
