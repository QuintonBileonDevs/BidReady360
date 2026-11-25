import 'dotenv/config';
import { runResetEncryptedTestData } from '../server/utils/resetEncryptedTestData';

async function main() {
  const forceAll = process.argv.includes('--force');
  const summary = await runResetEncryptedTestData(forceAll);
  console.log('[reset-encrypted-test-data] Complete:', JSON.stringify(summary));
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[reset-encrypted-test-data] FAILED:', err?.reason || err?.message || err);
    process.exit(1);
  });
