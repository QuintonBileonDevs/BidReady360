import dotenv from 'dotenv';
import { getClient, guardStatus, DbGuardError } from '../server/db/client.ts';

dotenv.config();

async function testConnection() {
  const connectionString = process.env.DATABASE_URL;

  console.log('=== BidReady360 Database Connection Test ===');
  if (!connectionString) {
    console.error('❌ FAILED: DATABASE_URL environment variable is not defined.');
    process.exit(1);
  }

  // Parse connection details safely (masking password)
  try {
    const parsed = new URL(connectionString.replace(/^(postgres|postgresql):\/\//, 'http://'));
    console.log('Target Host:', parsed.hostname);
    console.log('Target Port:', parsed.port || '5432');
    console.log('Database Name:', parsed.pathname.replace(/^\//, ''));
    console.log('User:', parsed.username);
    console.log('Password set:', parsed.password ? 'YES (masked)' : 'NO');
  } catch {
    console.log('Raw URL provided (failed to parse components)');
  }

  const guard = guardStatus();
  if (!guard.ok) {
    console.error('❌ Database guard blocked connection:', guard.reason);
    process.exit(1);
  }

  let client;
  try {
    console.log('\nAttempting verified database connection...');
    client = await getClient();
    console.log('✅ Connected successfully to PostgreSQL!');

    const res = await client.query('SELECT NOW() as current_time, version() as version;');
    console.log('\nServer Time:', res.rows[0].current_time);
    console.log('PostgreSQL Version:', res.rows[0].version);

    const tables = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name;
    `);

    console.log(`\nFound ${tables.rows.length} tables in public schema:`);
    console.log(tables.rows.map((r) => r.table_name).join(', ') || '(no tables found)');
  } catch (err) {
    console.error('\n❌ Database connection FAILED:');
    console.error('Error Code:', err.code || 'UNKNOWN');
    console.error('Error Message:', err instanceof DbGuardError ? err.reason : err.message);

    if (err.code === 'ENOTFOUND') {
      console.error('\n💡 Diagnosis: The hostname could not be resolved via DNS.');
    } else if (err.code === '28P01') {
      console.error('\n💡 Diagnosis: Authentication failed (invalid username or password).');
    } else if (err.code === 'ECONNREFUSED') {
      console.error('\n💡 Diagnosis: Connection was refused by the host or port.');
    }
    process.exitCode = 1;
  } finally {
    if (client) client.release();
    process.exit(process.exitCode || 0);
  }
}

testConnection();
