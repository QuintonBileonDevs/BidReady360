import pg from 'pg';

const { Pool } = pg;

export interface QueryResult<T> {
  rows: T[];
  rowCount: number;
}

export interface DbClient {
  query<R = any>(text: string, params?: any[]): Promise<QueryResult<R>>;
  release: () => void;
}

// ---------------------------------------------------------------------------
// STARTUP GUARDS: EXPECTED_DB_NAME & SESSION_SECRET
// ---------------------------------------------------------------------------
const expectedDbName = process.env.EXPECTED_DB_NAME;
const sessionSecret = process.env.SESSION_SECRET;

if (!expectedDbName || !expectedDbName.trim()) {
  throw new Error('Fatal startup check failed: Missing required environment variable EXPECTED_DB_NAME.');
}

if (!sessionSecret || !sessionSecret.trim()) {
  throw new Error('Fatal startup check failed: Missing required environment variable SESSION_SECRET.');
}

const rawConnectionString = process.env.DATABASE_URL || '';
const connectionString = rawConnectionString.replace(/(\?|&)sslmode=[^&]*/, '');

if (!connectionString || !connectionString.trim()) {
  throw new Error('Fatal startup check failed: Missing required environment variable DATABASE_URL.');
}

export const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  max: 10,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 15000,
});

pool.on('error', (err) => {
  console.error('[DATABASE POOL ERROR]:', err.message);
});

let dbVerified = false;

/**
 * Validates at startup that connected PostgreSQL database matches EXPECTED_DB_NAME.
 */
export async function verifyDatabaseGuard(): Promise<void> {
  if (dbVerified) return;
  try {
    const res = await pool.query('SELECT current_database()');
    const actualDb = res.rows[0]?.current_database;
    if (actualDb !== expectedDbName) {
      throw new Error(
        `Database mismatch guard failed: Connected database "${actualDb}" does not match EXPECTED_DB_NAME "${expectedDbName}".`
      );
    }
    dbVerified = true;
    console.log(`[DATABASE GUARD] Successfully verified database: ${actualDb}`);
  } catch (err: any) {
    console.error('[DATABASE GUARD FAILED]:', err.message);
    throw err;
  }
}

/**
 * Execute a parameterized query against PostgreSQL.
 * NEVER falls back to mock. If unreachable, throws an error with code DATABASE_UNAVAILABLE.
 */
export async function query<T = any>(text: string, params: any[] = []): Promise<QueryResult<T>> {
  try {
    const res = await pool.query(text, params);
    return { rows: res.rows as T[], rowCount: res.rowCount ?? 0 };
  } catch (err: any) {
    if (
      err.code === 'ECONNREFUSED' ||
      err.code === 'ETIMEDOUT' ||
      err.code === '57P01' ||
      err.code === '57P02' ||
      err.code === '57P03' ||
      err.code === '08001' ||
      err.code === '08006'
    ) {
      const dbErr = new Error('Database service is currently unreachable. Please try again shortly.') as any;
      dbErr.code = 'DATABASE_UNAVAILABLE';
      dbErr.status = 503;
      throw dbErr;
    }
    throw err;
  }
}

/**
 * Execute multiple queries inside an atomic PostgreSQL transaction.
 */
export async function withTransaction<T>(
  callback: (client: DbClient) => Promise<T>
): Promise<T> {
  let client: pg.PoolClient;
  try {
    client = await pool.connect();
  } catch (err: any) {
    const dbErr = new Error('Database service is currently unreachable. Please try again shortly.') as any;
    dbErr.code = 'DATABASE_UNAVAILABLE';
    dbErr.status = 503;
    throw dbErr;
  }

  try {
    await client.query('BEGIN');
    const wrappedClient: DbClient = {
      query: async <R = any>(text: string, p: any[] = []) => {
        const res = await client.query(text, p);
        return { rows: res.rows as R[], rowCount: res.rowCount ?? 0 };
      },
      release: () => client.release(),
    };
    const result = await callback(wrappedClient);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    try {
      await client.query('ROLLBACK');
    } catch {}
    throw err;
  } finally {
    client.release();
  }
}
