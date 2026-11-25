import fs from 'fs';
import path from 'path';
import { getClient } from '../server/db/client.ts';

async function runMigration() {
  let client;
  try {
    console.log('Connecting to PostgreSQL via fail-closed DB guard...');
    client = await getClient();
    console.log('Connection established.');

    const sqlPath = path.resolve('scripts/schema.sql');
    const sqlContent = fs.readFileSync(sqlPath, 'utf8');

    console.log('Executing BidReady360 schema and seed migrations...');
    await client.query(sqlContent);
    console.log('Schema execution completed successfully!');

    // Verification queries
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);

    console.log('\n--- VERIFICATION REPORT ---');
    console.log(`Total Tables Created: ${tablesRes.rows.length}`);
    console.log('Tables:', tablesRes.rows.map(r => r.table_name).join(', '));

    const rolesRes = await client.query('SELECT name, scope FROM roles ORDER BY name');
    console.log(`\nSystem Roles Seeded (${rolesRes.rows.length}):`, rolesRes.rows.map(r => `${r.name} (${r.scope})`).join(', '));

    const permissionsRes = await client.query('SELECT count(*) FROM permissions');
    console.log(`Permissions Seeded: ${permissionsRes.rows[0].count}`);

    const docTypesRes = await client.query('SELECT count(*) FROM document_types');
    console.log(`Document Types Seeded: ${docTypesRes.rows[0].count}`);

    const disciplinesRes = await client.query('SELECT count(*) FROM procurement_disciplines');
    console.log(`PPRA Procurement Disciplines Seeded: ${disciplinesRes.rows[0].count}`);

    const districtsRes = await client.query('SELECT count(*) FROM geographic_districts');
    console.log(`Districts Seeded: ${districtsRes.rows[0].count}`);

    console.log('\nMigration finished successfully with zero errors.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exitCode = 1;
  } finally {
    if (client) client.release();
    process.exit(process.exitCode || 0);
  }
}

runMigration();
