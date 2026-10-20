import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Client } = pg;

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

  const cleanUrl = connectionString.replace(/(\?|&)sslmode=[^&]*/, '');
  const client = new Client({
    connectionString: cleanUrl,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 5000,
  });

  try {
    console.log('\nAttempting TCP connection and SSL handshake...');
    await client.connect();
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
    console.error('Error Message:', err.message);

    if (err.code === 'ENOTFOUND') {
      console.error('\n💡 Diagnosis: The hostname could not be resolved via DNS. This usually means the DATABASE_URL contains placeholder host text (e.g., pg-service-name.aivencloud.com) instead of your real database host.');
    } else if (err.code === '28P01') {
      console.error('\n💡 Diagnosis: Authentication failed (invalid username or password).');
    } else if (err.code === 'ECONNREFUSED') {
      console.error('\n💡 Diagnosis: Connection was refused by the host or port.');
    }
  } finally {
    await client.end().catch(() => {});
  }
}

testConnection();
