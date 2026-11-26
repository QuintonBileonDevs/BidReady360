import 'dotenv/config';
import { ensureFoundationSchema } from '../server/db/migrations';
import { ensureSystemRolePermissions } from '../server/db/seed';

async function main() {
  console.log('[migrate-foundation] Applying idempotent foundation schema columns & indexes...');
  await ensureFoundationSchema();
  await ensureSystemRolePermissions();
  console.log('[migrate-foundation] Done.');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[migrate-foundation] FAILED:', err?.message || err);
    process.exit(1);
  });
