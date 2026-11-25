import dotenv from 'dotenv';
dotenv.config();

import { query } from '../server/db/client.js';

async function check() {
  try {
    const res = await query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('suppliers', 'supplier_people', 'supplier_documents', 'supplier_document_versions', 'supplier_categories', 'supplier_attributes')
    `);
    console.log('Existing tables:', res.rows.map(r => r.table_name));

    // Also check trigger names
    const trigRes = await query(`
      SELECT trigger_name, event_object_table 
      FROM information_schema.triggers 
      WHERE trigger_schema = 'public'
    `);
    console.log('Existing triggers:', trigRes.rows);
  } catch (err: any) {
    console.error('Error:', err.message);
  } finally {
    process.exit(0);
  }
}

check();
