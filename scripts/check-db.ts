import 'dotenv/config';
import { query } from '../server/db/client';

async function checkDb() {
  try {
    const dbRes = await query('SELECT current_database()');
    console.log('Current Database:', dbRes.rows[0]);

    const colRes = await query(`
      SELECT column_name, data_type, is_nullable 
      FROM information_schema.columns 
      WHERE table_name='supplier_people' 
      ORDER BY ordinal_position;
    `);
    console.log('Columns in supplier_people:');
    colRes.rows.forEach(r => {
      console.log(`- ${r.column_name} (${r.data_type}, nullable: ${r.is_nullable})`);
    });
  } catch (err: any) {
    console.error('Error checking DB:', err.message);
  }
}

checkDb();
