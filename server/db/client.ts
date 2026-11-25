import 'dotenv/config';
import pg from 'pg';

const { Pool } = pg;

export class DbGuardError extends Error {
  code = 'DB_GUARD';
  status = 503;
  reason: string;
  constructor(reason: string) {
    super(reason);
    this.reason = reason;
  }
}

const FORBIDDEN = new Set(['defaultdb', 'postgres', 'template0', 'template1']);

function normalizeDatabaseUrl(raw: string): string {
  let cleaned = (raw || '').trim();
  if (
    (cleaned.startsWith('"') && cleaned.endsWith('"')) ||
    (cleaned.startsWith("'") && cleaned.endsWith("'"))
  ) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  if (!cleaned) return '';

  try {
    const parsed = new URL(cleaned);
    parsed.searchParams.delete('sslmode');
    return parsed.toString();
  } catch {
    return cleaned
      .replace(/([?&])sslmode=[^&]*(&|$)/, (_m, prefix, suffix) =>
        prefix === '?' && suffix === '&' ? '?' : ''
      )
      .replace(/\?$/, '');
  }
}

function dbFromUrl(u: string): string | null {
  try {
    return decodeURIComponent(new URL(u).pathname.replace(/^\//, '')) || null;
  } catch {
    return null;
  }
}

const expected = (process.env.EXPECTED_DB_NAME || '').trim();
const url = normalizeDatabaseUrl(process.env.DATABASE_URL || '');

// 1. STATIC CHECK (before any connection is made)
let guardReason: string | null = null;
if (!expected) guardReason = 'expected_db_missing';
else if (FORBIDDEN.has(expected)) guardReason = 'expected_db_forbidden';
else if (!url) guardReason = 'database_url_missing';
else if (dbFromUrl(url) !== expected) guardReason = 'db_name_mismatch';
if (guardReason) console.error('[db-guard] BLOCKED:', guardReason);

const pool = guardReason
  ? null
  : new Pool({
      connectionString: url,
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 5000,
      options: '-c idle_in_transaction_session_timeout=15000',
    });

pool?.on('error', (e) => console.error('[pool]', e.message));

// 2. LIVE CHECK on EVERY physical connection, before its first query
const verified = new WeakSet<object>();

async function verify(client: pg.PoolClient) {
  if (verified.has(client)) return;
  const r = await client.query('SELECT current_database() AS db');
  if (r.rows[0]?.db !== expected) {
    console.error('[db-guard] BLOCKED: live database differs from expected');
    throw new DbGuardError('db_name_mismatch');
  }
  verified.add(client);
}

export function guardStatus() {
  return { ok: !guardReason, reason: guardReason };
}

export async function getClient(): Promise<pg.PoolClient> {
  if (guardReason || !pool) throw new DbGuardError(guardReason || 'guard_blocked');
  const client = await pool.connect();
  try {
    await verify(client);
  } catch (e) {
    client.release(true);
    throw e;
  }
  return client;
}

export async function query<R = any>(text: string, params?: any[]): Promise<{ rows: R[]; rowCount: number }> {
  const c = await getClient();
  try {
    const res = await c.query(text, params);
    return { rows: res.rows as R[], rowCount: res.rowCount ?? 0 };
  } finally {
    c.release();
  }
}

export async function tx<T>(fn: (c: pg.PoolClient) => Promise<T>): Promise<T> {
  const c = await getClient();
  try {
    await c.query('BEGIN');
    await c.query("SET LOCAL lock_timeout = '3s'");
    await c.query("SET LOCAL statement_timeout = '8s'");
    const out = await fn(c);
    await c.query('COMMIT');
    return out;
  } catch (e) {
    try {
      await c.query('ROLLBACK');
    } catch {}
    throw e;
  } finally {
    c.release();
  }
}

// 3. STARTUP: fail closed
if (guardReason && !process.env.VERCEL) {
  console.error('[db-guard] refusing to start');
  process.exit(1);
}
