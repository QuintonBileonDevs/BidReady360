import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const ENCRYPTION_KEY = crypto.scryptSync(
  process.env.SESSION_SECRET || 'bidready360-sec-token-32b-auth-secret-prod-2026',
  'salt_bw_2026',
  32
);

// Precomputed valid bcrypt hash with cost 12 used for dummy timing checks
export const DUMMY_HASH = '$2b$12$K8y43jZ10aW2Yh64k5W15e74R6g7o8p9q0r1s2t3u4v5w6x7y8z9a';

// Common passwords list rejected at validation
const COMMON_PASSWORDS = new Set([
  'password123',
  'password1234',
  '1234567890',
  '12345678901',
  'qwertyuiop',
  'admin12345',
  'pass123456',
  'welcome123',
  'bidready360',
  'phiricontracting',
  'gaborone123',
  'botswana123',
  'changeme123',
  'letmein1234',
]);

// =====================================================================
// 1. PASSWORD RULES & HASHING (bcrypt cost 12)
// =====================================================================

export function validatePassword(password: string, email?: string): { isValid: boolean; error?: string } {
  if (!password || typeof password !== 'string') {
    return { isValid: false, error: 'Password is required.' };
  }
  if (password.length < 10) {
    return { isValid: false, error: 'Password must be at least 10 characters long.' };
  }
  if (password.length > 128) {
    return { isValid: false, error: 'Password cannot exceed 128 characters.' };
  }
  if (email && password.trim().toLowerCase() === email.trim().toLowerCase()) {
    return { isValid: false, error: 'Password cannot be the same as your email address.' };
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase().trim())) {
    return { isValid: false, error: 'This password is too common. Please choose a stronger password.' };
  }
  return { isValid: true };
}

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}

// =====================================================================
// 2. RANDOM TOKENS & SHA-256 HASHING
// =====================================================================

export function generateRandomToken(bytes: number = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token.trim()).digest('hex');
}

// =====================================================================
// 3. ENCRYPTION AT REST (AES-256-GCM)
// =====================================================================

export function encryptData(plainText: string): Buffer {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]);
}

export function decryptData(buffer: Buffer): string {
  const iv = buffer.subarray(0, 12);
  const tag = buffer.subarray(12, 28);
  const encrypted = buffer.subarray(28);
  const decipher = crypto.createDecipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final('utf8');
}

// =====================================================================
// 4. TOTP / MFA (RFC 6238)
// =====================================================================

export function generateTotpSecret(): string {
  return crypto.randomBytes(20).toString('hex');
}

export function generateTotpCode(secretHex: string, timeStepWindow = 0): string {
  const epoch = Math.floor(Date.now() / 1000);
  const timeStep = Math.floor(epoch / 30) + timeStepWindow;
  const timeBuffer = Buffer.alloc(8);
  timeBuffer.writeBigInt64BE(BigInt(timeStep));

  const secretBuffer = Buffer.from(secretHex, 'hex');
  const hmac = crypto.createHmac('sha1', secretBuffer);
  hmac.update(timeBuffer);
  const digest = hmac.digest();

  const offset = digest[digest.length - 1] & 0xf;
  const codeInt =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  const code = (codeInt % 1000000).toString().padStart(6, '0');
  return code;
}

export function verifyTotpCode(secretHex: string, userCode: string): boolean {
  const cleanCode = userCode.trim();
  for (const window of [0, -1, 1]) {
    if (generateTotpCode(secretHex, window) === cleanCode) {
      return true;
    }
  }
  return false;
}
