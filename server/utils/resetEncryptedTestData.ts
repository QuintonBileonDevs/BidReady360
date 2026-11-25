import { getIdKey } from '../config/secrets';
import { tx } from '../db/client';
import { decryptData } from './crypto';

export interface EncryptedResetCounts {
  mfa_on: number;
  mfa_secrets: number;
  encrypted_ids: number;
  encrypted_accounts: number;
}

export interface EncryptedResetSummary {
  before: EncryptedResetCounts;
  mfaUsersReset: number;
  clearedIds: number;
  clearedAccounts: number;
  after: EncryptedResetCounts;
}

/**
 * Option (iii) one-time cleanup:
 * - Resets existing MFA enrollments (users.mfa_enabled = FALSE, users.mfa_secret_encrypted = NULL)
 * - Clears unreadable encrypted national IDs / hashes in supplier_people
 * - Clears unreadable encrypted bank account numbers in suppliers
 */
export async function runResetEncryptedTestData(forceAll = false): Promise<EncryptedResetSummary> {
  const idKey = getIdKey();

  return tx(async (client) => {
    const beforeRes = await client.query<EncryptedResetCounts>(`
      SELECT
        (SELECT COUNT(*)::int FROM users WHERE mfa_enabled = TRUE) AS mfa_on,
        (SELECT COUNT(*)::int FROM users WHERE mfa_secret_encrypted IS NOT NULL) AS mfa_secrets,
        (SELECT COUNT(*)::int FROM supplier_people WHERE national_identity_number_encrypted IS NOT NULL) AS encrypted_ids,
        (SELECT COUNT(*)::int FROM suppliers WHERE account_number_encrypted IS NOT NULL) AS encrypted_accounts
    `);

    const mfaReset = await client.query(
      `UPDATE users
       SET mfa_enabled = FALSE,
           mfa_secret_encrypted = NULL,
           mfa_type = NULL,
           updated_at = NOW()
       WHERE mfa_enabled = TRUE OR mfa_secret_encrypted IS NOT NULL`
    );

    const peopleRes = await client.query<{
      id: string;
      national_identity_number_encrypted: Buffer | null;
      national_identity_hash: string | null;
    }>(
      `SELECT id, national_identity_number_encrypted, national_identity_hash
       FROM supplier_people
       WHERE national_identity_number_encrypted IS NOT NULL
          OR national_identity_hash IS NOT NULL`
    );

    let clearedIds = 0;
    for (const row of peopleRes.rows) {
      let unreadable = forceAll || row.national_identity_number_encrypted === null;
      if (!unreadable && row.national_identity_number_encrypted) {
        await client.query('SAVEPOINT chk_person_id');
        try {
          await client.query(`SELECT pgp_sym_decrypt($1::bytea, $2) AS val`, [
            row.national_identity_number_encrypted,
            idKey,
          ]);
          await client.query('RELEASE SAVEPOINT chk_person_id');
        } catch {
          await client.query('ROLLBACK TO SAVEPOINT chk_person_id');
          await client.query('RELEASE SAVEPOINT chk_person_id');
          unreadable = true;
        }
      }
      if (unreadable) {
        await client.query(
          `UPDATE supplier_people
           SET national_identity_number_encrypted = NULL,
               national_identity_hash = NULL,
               updated_at = NOW()
           WHERE id = $1`,
          [row.id]
        );
        clearedIds += 1;
      }
    }

    const suppliersRes = await client.query<{
      id: string;
      account_number_encrypted: Buffer;
    }>(
      `SELECT id, account_number_encrypted
       FROM suppliers
       WHERE account_number_encrypted IS NOT NULL`
    );

    let clearedAccounts = 0;
    for (const row of suppliersRes.rows) {
      let unreadable = forceAll;
      if (!unreadable) {
        let decrypted = false;
        try {
          decryptData(row.account_number_encrypted);
          decrypted = true;
        } catch {
          decrypted = false;
        }
        if (!decrypted) {
          await client.query('SAVEPOINT chk_supplier_acct');
          try {
            await client.query(`SELECT pgp_sym_decrypt($1::bytea, $2) AS val`, [
              row.account_number_encrypted,
              idKey,
            ]);
            await client.query('RELEASE SAVEPOINT chk_supplier_acct');
            decrypted = true;
          } catch {
            await client.query('ROLLBACK TO SAVEPOINT chk_supplier_acct');
            await client.query('RELEASE SAVEPOINT chk_supplier_acct');
            decrypted = false;
          }
        }
        unreadable = !decrypted;
      }
      if (unreadable) {
        await client.query(
          `UPDATE suppliers
           SET account_number_encrypted = NULL,
               account_number_masked = NULL,
               updated_at = NOW()
           WHERE id = $1`,
          [row.id]
        );
        clearedAccounts += 1;
      }
    }

    const afterRes = await client.query<EncryptedResetCounts>(`
      SELECT
        (SELECT COUNT(*)::int FROM users WHERE mfa_enabled = TRUE) AS mfa_on,
        (SELECT COUNT(*)::int FROM users WHERE mfa_secret_encrypted IS NOT NULL) AS mfa_secrets,
        (SELECT COUNT(*)::int FROM supplier_people WHERE national_identity_number_encrypted IS NOT NULL) AS encrypted_ids,
        (SELECT COUNT(*)::int FROM suppliers WHERE account_number_encrypted IS NOT NULL) AS encrypted_accounts
    `);

    return {
      before: beforeRes.rows[0],
      mfaUsersReset: mfaReset.rowCount ?? 0,
      clearedIds,
      clearedAccounts,
      after: afterRes.rows[0],
    };
  });
}
