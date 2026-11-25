import 'dotenv/config';
import crypto from 'crypto';

export type SecretStatus = 'ok' | 'missing' | 'weak';

export class ConfigSecretError extends Error {
  code = 'CONFIG_SECRET';
  status = 503;
  reason: string;
  constructor(reason: string) {
    super(reason);
    this.reason = reason;
  }
}

const WEAK_SECRET_BLOCKLIST = new Set([
  'changeme',
  'changeme123',
  'secret',
  'password',
  'dev',
  'test',
  'default',
]);

const WEAK_SECRET_HASH_BLOCKLIST = new Set([
  '147f8a7efed6b004f4bb4be6bbbed30197ed869bfce31c87dab270ddb63d56cb',
  '364992338852422c26d3203094fd6b58e41eddceca97f535c1255c1526ac24a0',
  '73cda9a506a67556e1f441290d5c6a4b67bf022909107997903726c723e6a057',
]);

function isBlocklistedSecret(val: string): boolean {
  const lower = val.toLowerCase();
  if (WEAK_SECRET_BLOCKLIST.has(lower)) return true;
  const hash = crypto.createHash('sha256').update(lower).digest('hex');
  if (WEAK_SECRET_HASH_BLOCKLIST.has(hash)) return true;
  const stripped = lower.replace(/[-_0-9\s]/g, '');
  if (['changeme', 'secret', 'password', 'default'].includes(stripped)) return true;
  if (/^(dev|test)[-_]/i.test(lower)) return true;
  return false;
}

type SecretName =
  | 'SESSION_SECRET'
  | 'ID_ENCRYPTION_KEY'
  | 'MFA_ENCRYPTION_KEY'
  | 'ENCRYPTION_SALT';

function validateSecret(
  name: SecretName,
  raw: string | undefined,
  minLength: number
): { status: SecretStatus; reason: string | null; value: string | null; rawNonEmpty: string | null } {
  const val = (raw ?? '').trim();
  if (!val) {
    return { status: 'missing', reason: `secret_missing:${name}`, value: null, rawNonEmpty: null };
  }
  if (val.length < minLength || new Set(val).size <= 1 || isBlocklistedSecret(val)) {
    return { status: 'weak', reason: `secret_weak:${name}`, value: null, rawNonEmpty: val };
  }
  return { status: 'ok', reason: null, value: val, rawNonEmpty: val };
}

const sessionCheck = validateSecret('SESSION_SECRET', process.env.SESSION_SECRET, 32);
const idCheck = validateSecret('ID_ENCRYPTION_KEY', process.env.ID_ENCRYPTION_KEY, 32);
const mfaCheck = validateSecret('MFA_ENCRYPTION_KEY', process.env.MFA_ENCRYPTION_KEY, 32);
const saltCheck = validateSecret('ENCRYPTION_SALT', process.env.ENCRYPTION_SALT, 16);

const checks = [
  { name: 'SESSION_SECRET' as const, check: sessionCheck },
  { name: 'ID_ENCRYPTION_KEY' as const, check: idCheck },
  { name: 'MFA_ENCRYPTION_KEY' as const, check: mfaCheck },
  { name: 'ENCRYPTION_SALT' as const, check: saltCheck },
];

// Detect any identical pair among non-empty secrets
const seenValues = new Map<string, SecretName[]>();
for (const { name, check } of checks) {
  if (check.rawNonEmpty) {
    const list = seenValues.get(check.rawNonEmpty) || [];
    list.push(name);
    seenValues.set(check.rawNonEmpty, list);
  }
}
const duplicateNames = new Set<SecretName>();
for (const names of seenValues.values()) {
  if (names.length > 1) {
    for (const n of names) duplicateNames.add(n);
  }
}

let guardReason: string | null = null;
for (const { check } of checks) {
  if (check.reason) {
    guardReason = check.reason;
    break;
  }
}
if (!guardReason && duplicateNames.size > 0) {
  guardReason = 'secrets_identical';
}

const sessionSecretStatus: SecretStatus = duplicateNames.has('SESSION_SECRET')
  ? 'weak'
  : sessionCheck.status;
const idKeyStatus: SecretStatus = duplicateNames.has('ID_ENCRYPTION_KEY')
  ? 'weak'
  : idCheck.status;
const mfaKeyStatus: SecretStatus = duplicateNames.has('MFA_ENCRYPTION_KEY')
  ? 'weak'
  : mfaCheck.status;
const encryptionSaltStatus: SecretStatus = duplicateNames.has('ENCRYPTION_SALT')
  ? 'weak'
  : saltCheck.status;

console.log(
  `[startup-env] DATABASE_URL=${process.env.DATABASE_URL?.trim() ? 'ok' : 'missing'} ` +
    `EXPECTED_DB_NAME=${process.env.EXPECTED_DB_NAME?.trim() ? 'ok' : 'missing'} ` +
    `SESSION_SECRET=${sessionSecretStatus} ` +
    `ID_ENCRYPTION_KEY=${idKeyStatus} ` +
    `MFA_ENCRYPTION_KEY=${mfaKeyStatus} ` +
    `ENCRYPTION_SALT=${encryptionSaltStatus} ` +
    `GEMINI_API_KEY=${process.env.GEMINI_API_KEY?.trim() ? 'ok' : 'missing'}`
);

if (guardReason) {
  console.error('[secrets-guard] BLOCKED:', guardReason);
  if (process.env.NODE_ENV === 'production' && !process.env.VERCEL) {
    console.error('[secrets-guard] refusing to start');
    process.exit(1);
  }
}

export function secretsGuardStatus(): { ok: boolean; reason: string | null } {
  return { ok: !guardReason, reason: guardReason };
}

export function getSecretsHealth(): {
  sessionSecret: SecretStatus;
  idKey: SecretStatus;
  mfaKey: SecretStatus;
  encryptionSalt: SecretStatus;
} {
  return {
    sessionSecret: sessionSecretStatus,
    idKey: idKeyStatus,
    mfaKey: mfaKeyStatus,
    encryptionSalt: encryptionSaltStatus,
  };
}

export function getSessionSecret(): string {
  if (guardReason || !sessionCheck.value) {
    throw new ConfigSecretError(guardReason || 'secret_missing:SESSION_SECRET');
  }
  return sessionCheck.value;
}

export function getIdKey(): string {
  if (guardReason || !idCheck.value) {
    throw new ConfigSecretError(guardReason || 'secret_missing:ID_ENCRYPTION_KEY');
  }
  return idCheck.value;
}

export function getMfaKey(): string {
  if (guardReason || !mfaCheck.value) {
    throw new ConfigSecretError(guardReason || 'secret_missing:MFA_ENCRYPTION_KEY');
  }
  return mfaCheck.value;
}

export function getEncryptionSalt(): string {
  if (guardReason || !saltCheck.value) {
    throw new ConfigSecretError(guardReason || 'secret_missing:ENCRYPTION_SALT');
  }
  return saltCheck.value;
}

let cachedIdHashKey: Buffer | null = null;

/**
 * Separate domain-separated key derived via HMAC(ID_ENCRYPTION_KEY, "id-hash-v1")
 * so the encryption key is not reused for keyed identity hashing.
 */
export function getIdHashKey(): Buffer {
  if (!cachedIdHashKey) {
    const master = getIdKey();
    cachedIdHashKey = crypto.createHmac('sha256', master).update('id-hash-v1').digest();
  }
  return cachedIdHashKey;
}
