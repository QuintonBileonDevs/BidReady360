import pg from 'pg';

const { Pool } = pg;

// Clean connection string for Aiven (remove conflicting sslmode string to allow explicit rejectUnauthorized: false)
const rawConnectionString = process.env.DATABASE_URL || '';
const connectionString = rawConnectionString.replace(/(\?|&)sslmode=[^&]*/, '');

export const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 10000,
  connectionTimeoutMillis: 5000,
});

export interface QueryResult<T> {
  rows: T[];
  rowCount: number;
}

/**
 * Execute a parameterized query against the database connection pool.
 */
export async function query<T = any>(text: string, params: any[] = []): Promise<QueryResult<T>> {
  const start = Date.now();
  try {
    const res = await pool.query(text, params);
    return { rows: res.rows as T[], rowCount: res.rowCount ?? 0 };
  } catch (err: any) {
    console.warn(`[DB WARNING] Query execution notice (${err.code || 'ERR'}): ${err.message}`, {
      query: text.slice(0, 150),
      paramsCount: params.length,
      durationMs: Date.now() - start,
    });
    throw err;
  }
}

/**
 * Execute multiple queries inside an atomic PostgreSQL transaction.
 * Automatically handles BEGIN, COMMIT, and ROLLBACK.
 */
export async function withTransaction<T>(
  callback: (client: pg.PoolClient) => Promise<T>
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
