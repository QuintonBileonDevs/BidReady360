import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'bidready360-jwt-secret-key-bw-2026-prod-fallback';
const ENCRYPTION_KEY = crypto.scryptSync(process.env.APP_SECRET || 'bidready360-enc-secret-key-bw', 'salt', 32);

// =====================================================================
// 1. PASSWORD HASHING
// =====================================================================

export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// =====================================================================
// 2. ENCRYPTION AT REST (AES-256-GCM)
// =====================================================================

export function encryptData(plainText: string): Buffer {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Combined format: [12 bytes IV] + [16 bytes Tag] + [Encrypted Content]
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
// 3. TOTP / MFA (RFC 6238)
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
  // Check current window, previous 30s window, and next 30s window for clock drift
  for (const window of [0, -1, 1]) {
    if (generateTotpCode(secretHex, window) === cleanCode) {
      return true;
    }
  }
  return false;
}

// =====================================================================
// 4. JWT SESSION TOKENS
// =====================================================================

export interface SessionPayload {
  userId: string;
  email: string;
  isPlatformAdmin: boolean;
  activeTenantType?: 'organization' | 'supplier' | 'platform';
  activeTenantId?: string;
  role?: string;
}

export function signSessionToken(payload: SessionPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
}

export function verifySessionToken(token: string): SessionPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as SessionPayload;
  } catch (err) {
    return null;
  }
}
