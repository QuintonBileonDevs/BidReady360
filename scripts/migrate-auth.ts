import dotenv from 'dotenv';
dotenv.config();

import { query } from '../server/db/client';

async function migrate() {
  console.log('Running auth migration...');

  try {
    // 1. Check duplicate emails before creating unique index
    const dupCheck = await query(`
      SELECT LOWER(email::text) AS email, COUNT(*)
      FROM users
      GROUP BY LOWER(email::text)
      HAVING COUNT(*) > 1
    `);

    if (dupCheck.rows.length > 0) {
      console.warn('WARNING: Duplicate emails exist in users table:', dupCheck.rows);
    } else {
      console.log('No duplicate emails found.');
    }

    // 2. Create tables
    await query(`
      CREATE TABLE IF NOT EXISTS sessions (
        id bigserial PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        token_hash char(64) NOT NULL UNIQUE,
        tenant_type text CHECK (tenant_type IN ('supplier','organization','platform')),
        tenant_id UUID,
        ip text,
        user_agent text,
        expires_at timestamptz NOT NULL,
        revoked_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS auth_tokens (
        id bigserial PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        purpose text NOT NULL CHECK (purpose IN ('email_verify','password_reset')),
        token_hash char(64) NOT NULL UNIQUE,
        expires_at timestamptz NOT NULL,
        used_at timestamptz,
        created_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS login_attempts (
        id bigserial PRIMARY KEY,
        email_norm text NOT NULL,
        ip text,
        succeeded boolean NOT NULL,
        attempted_at timestamptz NOT NULL DEFAULT now()
      );

      CREATE INDEX IF NOT EXISTS ix_login_attempts_email ON login_attempts (email_norm, attempted_at);
      CREATE INDEX IF NOT EXISTS ix_login_attempts_ip ON login_attempts (ip, attempted_at);
      CREATE INDEX IF NOT EXISTS ix_sessions_token_hash ON sessions (token_hash) WHERE revoked_at IS NULL;
      CREATE INDEX IF NOT EXISTS ix_auth_tokens_hash ON auth_tokens (token_hash) WHERE used_at IS NULL;
    `);

    // 3. Unique index on lower(email)
    try {
      await query(`
        CREATE UNIQUE INDEX IF NOT EXISTS uq_users_email_lower ON users (lower(email::text))
      `);
      console.log('Index uq_users_email_lower verified/created.');
    } catch (e: any) {
      console.warn('Could not create uq_users_email_lower index:', e.message);
    }

    console.log('Auth migration completed successfully.');
  } catch (err: any) {
    console.error('Migration failed:', err.message);
  } finally {
    process.exit(0);
  }
}

migrate();
