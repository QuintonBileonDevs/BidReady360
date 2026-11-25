import dotenv from 'dotenv';
dotenv.config();

import { query } from '../server/db/client';

async function main() {
  try {
    for (const tableName of ['sessions', 'auth_tokens', 'login_attempts', 'users', 'audit_log']) {
      const res = await query(
        `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_name = $1
         ORDER BY ordinal_position`,
        [tableName]
      );
      console.log(`\n=== Table: ${tableName} ===`);
      console.table(res.rows);
    }
  } catch (err: any) {
    console.error('Error:', err.message);
  } finally {
    process.exit(0);
  }
}

main();
