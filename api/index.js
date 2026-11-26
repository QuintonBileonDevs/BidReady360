// server/app.ts
import "dotenv/config";

// server/config/secrets.ts
import "dotenv/config";
import crypto from "crypto";
var ConfigSecretError = class extends Error {
  constructor(reason) {
    super(reason);
    this.code = "CONFIG_SECRET";
    this.status = 503;
    this.reason = reason;
  }
};
var WEAK_SECRET_BLOCKLIST = /* @__PURE__ */ new Set([
  "changeme",
  "changeme123",
  "secret",
  "password",
  "dev",
  "test",
  "default"
]);
var WEAK_SECRET_HASH_BLOCKLIST = /* @__PURE__ */ new Set([
  "147f8a7efed6b004f4bb4be6bbbed30197ed869bfce31c87dab270ddb63d56cb",
  "364992338852422c26d3203094fd6b58e41eddceca97f535c1255c1526ac24a0",
  "73cda9a506a67556e1f441290d5c6a4b67bf022909107997903726c723e6a057"
]);
function isBlocklistedSecret(val) {
  const lower = val.toLowerCase();
  if (WEAK_SECRET_BLOCKLIST.has(lower)) return true;
  const hash = crypto.createHash("sha256").update(lower).digest("hex");
  if (WEAK_SECRET_HASH_BLOCKLIST.has(hash)) return true;
  const stripped = lower.replace(/[-_0-9\s]/g, "");
  if (["changeme", "secret", "password", "default"].includes(stripped)) return true;
  if (/^(dev|test)[-_]/i.test(lower)) return true;
  return false;
}
function validateSecret(name, raw, minLength) {
  const val = (raw ?? "").trim();
  if (!val) {
    return { status: "missing", reason: `secret_missing:${name}`, value: null, rawNonEmpty: null };
  }
  if (val.length < minLength || new Set(val).size <= 1 || isBlocklistedSecret(val)) {
    return { status: "weak", reason: `secret_weak:${name}`, value: null, rawNonEmpty: val };
  }
  return { status: "ok", reason: null, value: val, rawNonEmpty: val };
}
var sessionCheck = validateSecret("SESSION_SECRET", process.env.SESSION_SECRET, 32);
var idCheck = validateSecret("ID_ENCRYPTION_KEY", process.env.ID_ENCRYPTION_KEY, 32);
var mfaCheck = validateSecret("MFA_ENCRYPTION_KEY", process.env.MFA_ENCRYPTION_KEY, 32);
var saltCheck = validateSecret("ENCRYPTION_SALT", process.env.ENCRYPTION_SALT, 16);
var checks = [
  { name: "SESSION_SECRET", check: sessionCheck },
  { name: "ID_ENCRYPTION_KEY", check: idCheck },
  { name: "MFA_ENCRYPTION_KEY", check: mfaCheck },
  { name: "ENCRYPTION_SALT", check: saltCheck }
];
var seenValues = /* @__PURE__ */ new Map();
for (const { name, check } of checks) {
  if (check.rawNonEmpty) {
    const list = seenValues.get(check.rawNonEmpty) || [];
    list.push(name);
    seenValues.set(check.rawNonEmpty, list);
  }
}
var duplicateNames = /* @__PURE__ */ new Set();
for (const names of seenValues.values()) {
  if (names.length > 1) {
    for (const n of names) duplicateNames.add(n);
  }
}
var guardReason = null;
for (const { check } of checks) {
  if (check.reason) {
    guardReason = check.reason;
    break;
  }
}
if (!guardReason && duplicateNames.size > 0) {
  guardReason = "secrets_identical";
}
var sessionSecretStatus = duplicateNames.has("SESSION_SECRET") ? "weak" : sessionCheck.status;
var idKeyStatus = duplicateNames.has("ID_ENCRYPTION_KEY") ? "weak" : idCheck.status;
var mfaKeyStatus = duplicateNames.has("MFA_ENCRYPTION_KEY") ? "weak" : mfaCheck.status;
var encryptionSaltStatus = duplicateNames.has("ENCRYPTION_SALT") ? "weak" : saltCheck.status;
console.log(
  `[startup-env] DATABASE_URL=${process.env.DATABASE_URL?.trim() ? "ok" : "missing"} EXPECTED_DB_NAME=${process.env.EXPECTED_DB_NAME?.trim() ? "ok" : "missing"} SESSION_SECRET=${sessionSecretStatus} ID_ENCRYPTION_KEY=${idKeyStatus} MFA_ENCRYPTION_KEY=${mfaKeyStatus} ENCRYPTION_SALT=${encryptionSaltStatus} GEMINI_API_KEY=${process.env.GEMINI_API_KEY?.trim() ? "ok" : "missing"}`
);
if (guardReason) {
  console.error("[secrets-guard] BLOCKED:", guardReason);
  if (process.env.NODE_ENV === "production" && !process.env.VERCEL) {
    console.error("[secrets-guard] refusing to start");
    process.exit(1);
  }
}
function secretsGuardStatus() {
  return { ok: !guardReason, reason: guardReason };
}
function getSecretsHealth() {
  return {
    sessionSecret: sessionSecretStatus,
    idKey: idKeyStatus,
    mfaKey: mfaKeyStatus,
    encryptionSalt: encryptionSaltStatus
  };
}
function getSessionSecret() {
  if (guardReason || !sessionCheck.value) {
    throw new ConfigSecretError(guardReason || "secret_missing:SESSION_SECRET");
  }
  return sessionCheck.value;
}
function getIdKey() {
  if (guardReason || !idCheck.value) {
    throw new ConfigSecretError(guardReason || "secret_missing:ID_ENCRYPTION_KEY");
  }
  return idCheck.value;
}
function getMfaKey() {
  if (guardReason || !mfaCheck.value) {
    throw new ConfigSecretError(guardReason || "secret_missing:MFA_ENCRYPTION_KEY");
  }
  return mfaCheck.value;
}
function getEncryptionSalt() {
  if (guardReason || !saltCheck.value) {
    throw new ConfigSecretError(guardReason || "secret_missing:ENCRYPTION_SALT");
  }
  return saltCheck.value;
}
var cachedIdHashKey = null;
function getIdHashKey() {
  if (!cachedIdHashKey) {
    const master = getIdKey();
    cachedIdHashKey = crypto.createHmac("sha256", master).update("id-hash-v1").digest();
  }
  return cachedIdHashKey;
}

// server/app.ts
import express from "express";
import cookieParser from "cookie-parser";

// server/utils/crypto.ts
import crypto2 from "crypto";
import bcrypt from "bcryptjs";
var cachedMfaKey = null;
function getMfaEncryptionKey() {
  if (!cachedMfaKey) {
    cachedMfaKey = crypto2.scryptSync(getMfaKey(), getEncryptionSalt(), 32);
  }
  return cachedMfaKey;
}
var cachedTokenHashKey = null;
function getTokenHashKey() {
  if (!cachedTokenHashKey) {
    cachedTokenHashKey = crypto2.createHmac("sha256", getSessionSecret()).update("session-token-v1").digest();
  }
  return cachedTokenHashKey;
}
var DUMMY_HASH = "$2b$12$K8y43jZ10aW2Yh64k5W15e74R6g7o8p9q0r1s2t3u4v5w6x7y8z9a";
var COMMON_PASSWORDS = /* @__PURE__ */ new Set([
  "password123",
  "password1234",
  "1234567890",
  "12345678901",
  "qwertyuiop",
  "admin12345",
  "pass123456",
  "welcome123",
  "bidready360",
  "phiricontracting",
  "gaborone123",
  "botswana123",
  "changeme123",
  "letmein1234"
]);
function validatePassword(password, email) {
  if (!password || typeof password !== "string") {
    return { isValid: false, error: "Password is required." };
  }
  if (password.length < 10) {
    return { isValid: false, error: "Password must be at least 10 characters long." };
  }
  if (password.length > 128) {
    return { isValid: false, error: "Password cannot exceed 128 characters." };
  }
  if (email && password.trim().toLowerCase() === email.trim().toLowerCase()) {
    return { isValid: false, error: "Password cannot be the same as your email address." };
  }
  if (COMMON_PASSWORDS.has(password.toLowerCase().trim())) {
    return { isValid: false, error: "This password is too common. Please choose a stronger password." };
  }
  return { isValid: true };
}
async function hashPassword(password) {
  const salt = await bcrypt.genSalt(12);
  return bcrypt.hash(password, salt);
}
async function verifyPassword(password, hash) {
  try {
    return await bcrypt.compare(password, hash);
  } catch {
    return false;
  }
}
function generateRandomToken(bytes = 32) {
  return crypto2.randomBytes(bytes).toString("hex");
}
function hashToken(token) {
  return crypto2.createHmac("sha256", getTokenHashKey()).update(token.trim()).digest("hex");
}
function encryptData(plainText) {
  const iv = crypto2.randomBytes(12);
  const cipher = crypto2.createCipheriv("aes-256-gcm", getMfaEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]);
}
function decryptData(buffer) {
  const iv = buffer.subarray(0, 12);
  const tag = buffer.subarray(12, 28);
  const encrypted = buffer.subarray(28);
  const decipher = crypto2.createDecipheriv("aes-256-gcm", getMfaEncryptionKey(), iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final("utf8");
}
function generateTotpSecret() {
  return crypto2.randomBytes(20).toString("hex");
}
function generateTotpCode(secretHex, timeStepWindow = 0) {
  const epoch = Math.floor(Date.now() / 1e3);
  const timeStep = Math.floor(epoch / 30) + timeStepWindow;
  const timeBuffer = Buffer.alloc(8);
  timeBuffer.writeBigInt64BE(BigInt(timeStep));
  const secretBuffer = Buffer.from(secretHex, "hex");
  const hmac = crypto2.createHmac("sha1", secretBuffer);
  hmac.update(timeBuffer);
  const digest = hmac.digest();
  const offset = digest[digest.length - 1] & 15;
  const codeInt = (digest[offset] & 127) << 24 | (digest[offset + 1] & 255) << 16 | (digest[offset + 2] & 255) << 8 | digest[offset + 3] & 255;
  const code = (codeInt % 1e6).toString().padStart(6, "0");
  return code;
}
function verifyTotpCode(secretHex, userCode) {
  const cleanCode = userCode.trim();
  for (const window of [0, -1, 1]) {
    if (generateTotpCode(secretHex, window) === cleanCode) {
      return true;
    }
  }
  return false;
}

// server/db/client.ts
import "dotenv/config";
import pg from "pg";
var { Pool } = pg;
var DbGuardError = class extends Error {
  constructor(reason) {
    super(reason);
    this.code = "DB_GUARD";
    this.status = 503;
    this.reason = reason;
  }
};
var FORBIDDEN = /* @__PURE__ */ new Set(["defaultdb", "postgres", "template0", "template1"]);
function normalizeDatabaseUrl(raw) {
  let cleaned = (raw || "").trim();
  if (cleaned.startsWith('"') && cleaned.endsWith('"') || cleaned.startsWith("'") && cleaned.endsWith("'")) {
    cleaned = cleaned.slice(1, -1).trim();
  }
  if (!cleaned) return "";
  try {
    const parsed = new URL(cleaned);
    parsed.searchParams.delete("sslmode");
    return parsed.toString();
  } catch {
    return cleaned.replace(
      /([?&])sslmode=[^&]*(&|$)/,
      (_m, prefix, suffix) => prefix === "?" && suffix === "&" ? "?" : ""
    ).replace(/\?$/, "");
  }
}
function dbFromUrl(u) {
  try {
    return decodeURIComponent(new URL(u).pathname.replace(/^\//, "")) || null;
  } catch {
    return null;
  }
}
var expected = (process.env.EXPECTED_DB_NAME || "").trim();
var url = normalizeDatabaseUrl(process.env.DATABASE_URL || "");
var guardReason2 = null;
if (!expected) guardReason2 = "expected_db_missing";
else if (FORBIDDEN.has(expected)) guardReason2 = "expected_db_forbidden";
else if (!url) guardReason2 = "database_url_missing";
else if (dbFromUrl(url) !== expected) guardReason2 = "db_name_mismatch";
if (guardReason2) console.error("[db-guard] BLOCKED:", guardReason2);
var pool = guardReason2 ? null : new Pool({
  connectionString: url,
  ssl: { rejectUnauthorized: false },
  max: 5,
  idleTimeoutMillis: 1e4,
  connectionTimeoutMillis: 5e3,
  options: "-c idle_in_transaction_session_timeout=15000"
});
pool?.on("error", (e) => console.error("[pool]", e.message));
var verified = /* @__PURE__ */ new WeakSet();
async function verify(client) {
  if (verified.has(client)) return;
  const r = await client.query("SELECT current_database() AS db");
  if (r.rows[0]?.db !== expected) {
    console.error("[db-guard] BLOCKED: live database differs from expected");
    throw new DbGuardError("db_name_mismatch");
  }
  verified.add(client);
}
function guardStatus() {
  return { ok: !guardReason2, reason: guardReason2 };
}
async function getClient() {
  if (guardReason2 || !pool) throw new DbGuardError(guardReason2 || "guard_blocked");
  const client = await pool.connect();
  try {
    await verify(client);
  } catch (e) {
    client.release(true);
    throw e;
  }
  return client;
}
async function query(text, params) {
  const c = await getClient();
  try {
    const res = await c.query(text, params);
    return { rows: res.rows, rowCount: res.rowCount ?? 0 };
  } finally {
    c.release();
  }
}
async function tx(fn) {
  const c = await getClient();
  try {
    await c.query("BEGIN");
    await c.query("SET LOCAL lock_timeout = '3s'");
    await c.query("SET LOCAL statement_timeout = '8s'");
    const out = await fn(c);
    await c.query("COMMIT");
    return out;
  } catch (e) {
    try {
      await c.query("ROLLBACK");
    } catch {
    }
    throw e;
  } finally {
    c.release();
  }
}
if (guardReason2 && process.env.NODE_ENV === "production" && !process.env.VERCEL) {
  console.error("[db-guard] refusing to start");
  process.exit(1);
}

// server/services/tenant.resolver.ts
function resolveDeterministicTenant(memberships, targetTenantId) {
  if (targetTenantId) {
    const match = memberships.find((m) => m.tenantId === targetTenantId && m.status === "active");
    if (match) return match;
  }
  if (!memberships || memberships.length === 0) return void 0;
  const activeMems = memberships.filter((m) => m.status === "active");
  if (activeMems.length === 0) return void 0;
  const sorted = [...activeMems].sort((a, b) => {
    if (Boolean(a.isOwner) !== Boolean(b.isOwner)) {
      return a.isOwner ? -1 : 1;
    }
    const timeA = a.lastActiveAt ? new Date(a.lastActiveAt).getTime() : 0;
    const timeB = b.lastActiveAt ? new Date(b.lastActiveAt).getTime() : 0;
    if (timeA !== timeB) {
      return timeB - timeA;
    }
    const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (createdA !== createdB) {
      return createdA - createdB;
    }
    return (a.tenantName || "").localeCompare(b.tenantName || "");
  });
  return sorted[0];
}
async function persistActiveTenantToSession(sessionId, tenantType, tenantId) {
  try {
    await query(
      `UPDATE sessions
       SET tenant_type = $1, tenant_id = $2
       WHERE id = $3`,
      [tenantType, tenantId, sessionId]
    );
  } catch (err) {
    console.error("[TENANT RESOLVER] Failed to persist active tenant to session:", err.message);
  }
}

// server/middleware/auth.middleware.ts
function csrfProtection(req, res, next) {
  const method = req.method.toUpperCase();
  if (["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    const origin = req.headers.origin;
    if (origin) {
      try {
        const originUrl = new URL(origin);
        const host = req.headers["x-forwarded-host"] || req.headers.host;
        const originHostname = originUrl.hostname;
        const hostOnly = host ? host.split(":")[0] : "";
        const isLocal = originHostname === "localhost" || originHostname === "127.0.0.1" || originHostname === "0.0.0.0";
        const isMatch = host && (originUrl.host === host || originHostname === hostOnly || originHostname.endsWith(".run.app") || hostOnly.endsWith(".run.app"));
        if (!isMatch && !isLocal && !originHostname.endsWith(".run.app") && !originHostname.includes("aistudio")) {
          res.status(403).json({
            error: "FORBIDDEN_CSRF",
            message: "Cross-origin request blocked."
          });
          return;
        }
      } catch {
        res.status(403).json({
          error: "FORBIDDEN_CSRF",
          message: "Invalid request origin header."
        });
        return;
      }
    }
  }
  next();
}
async function authenticate(req, res, next) {
  let rawToken;
  if (req.cookies && req.cookies.session_token) {
    rawToken = req.cookies.session_token;
  } else if (req.headers.authorization && req.headers.authorization.startsWith("Bearer ")) {
    rawToken = req.headers.authorization.substring(7);
  } else if (req.query && typeof req.query.token === "string") {
    rawToken = req.query.token;
  }
  if (!rawToken || !rawToken.trim()) {
    return next();
  }
  try {
    const tokenHash = hashToken(rawToken);
    const authRes = await query(
      `WITH user_session AS (
        SELECT s.id AS "sessionId", s.tenant_type AS "tenantType", s.tenant_id AS "tenantId",
               u.id, u.email, u.password_hash AS "passwordHash", u.full_name AS "fullName",
               u.phone, u.preferred_language AS "preferredLanguage", u.status,
               u.is_platform_admin AS "isPlatformAdmin", u.email_verified_at AS "emailVerifiedAt",
               u.phone_verified_at AS "phoneVerifiedAt", u.mfa_enabled AS "mfaEnabled",
               u.mfa_secret_encrypted AS "mfaSecretEncrypted", u.mfa_type AS "mfaType",
               u.last_login_at AS "lastLoginAt", u.failed_login_attempts AS "failedLoginAttempts",
               u.locked_until AS "lockedUntil", u.created_at AS "createdAt"
        FROM sessions s
        JOIN users u ON u.id = s.user_id AND u.deleted_at IS NULL AND u.status = 'active'
        WHERE s.token_hash = $1
          AND s.expires_at > NOW()
          AND s.revoked_at IS NULL
        LIMIT 1
      ),
      org_mems AS (
        SELECT 'organization' AS "tenantType",
               o.id AS "tenantId",
               o.name AS "tenantName",
               o.status AS "organizationStatus",
               o.verification_status AS "verificationStatus",
               o.rejection_reason AS "rejectionReason",
               r.id AS "roleId",
               r.name AS "roleName",
               om.is_owner AS "isOwner",
               om.status,
               om.last_active_at AS "lastActiveAt",
               om.created_at AS "createdAt",
               COALESCE(
                 (SELECT json_agg(p.code)
                  FROM role_permissions rp
                  JOIN permissions p ON p.id = rp.permission_id
                  WHERE rp.role_id = r.id),
                 '[]'::json
               ) AS permissions,
               json_build_object(
                 'displayName', (SELECT "fullName" FROM user_session),
                 'tenantType', 'organization',
                 'tenantId', o.id,
                 'role', r.name,
                 'supplierOrOrgName', o.name,
                 'status', o.status,
                 'organizationStatus', o.status,
                 'verificationStatus', o.verification_status,
                 'rejectionReason', o.rejection_reason,
                 'emailVerified', ((SELECT "emailVerifiedAt" FROM user_session) IS NOT NULL)
               ) AS profile_summary
        FROM organization_members om
        JOIN organizations o ON o.id = om.organization_id AND o.deleted_at IS NULL
        JOIN roles r ON r.id = om.role_id
        WHERE om.user_id = (SELECT id FROM user_session) AND om.status = 'active'
      ),
      sup_mems AS (
        SELECT 'supplier' AS "tenantType",
               s.id AS "tenantId",
               s.legal_name AS "tenantName",
               s.status AS "supplierStatus",
               s.verification_status AS "verificationStatus",
               r.id AS "roleId",
               r.name AS "roleName",
               sm.is_owner AS "isOwner",
               sm.status,
               sm.last_active_at AS "lastActiveAt",
               sm.created_at AS "createdAt",
               COALESCE(
                 (SELECT json_agg(p.code)
                  FROM role_permissions rp
                  JOIN permissions p ON p.id = rp.permission_id
                  WHERE rp.role_id = r.id),
                 '[]'::json
               ) AS permissions,
               json_build_object(
                 'displayName', (SELECT "fullName" FROM user_session),
                 'tenantType', 'supplier',
                 'tenantId', s.id,
                 'role', r.name,
                 'supplierOrOrgName', s.legal_name,
                 'status', s.status,
                 'supplierStatus', s.status,
                 'verificationStatus', s.verification_status,
                 'cipaNumber', s.cipa_uin,
                 'complianceStatus', s.compliance_status,
                 'profileCompleteness', s.profile_completeness,
                 'emailVerified', ((SELECT "emailVerifiedAt" FROM user_session) IS NOT NULL)
               ) AS profile_summary
        FROM supplier_members sm
        JOIN suppliers s ON s.id = sm.supplier_id AND s.deleted_at IS NULL
        JOIN roles r ON r.id = sm.role_id
        WHERE sm.user_id = (SELECT id FROM user_session) AND sm.status = 'active'
      )
      SELECT 
        us.*,
        COALESCE(
          (SELECT json_agg(m.*) FROM org_mems m),
          '[]'::json
        ) AS "orgMemberships",
        COALESCE(
          (SELECT json_agg(m.*) FROM sup_mems m),
          '[]'::json
        ) AS "supMemberships"
      FROM user_session us`,
      [tokenHash]
    );
    if (authRes.rows.length === 0) {
      return next();
    }
    const sess = authRes.rows[0];
    const user = {
      id: sess.id,
      email: sess.email,
      passwordHash: sess.passwordHash,
      fullName: sess.fullName,
      phone: sess.phone,
      preferredLanguage: sess.preferredLanguage,
      status: sess.status,
      isPlatformAdmin: sess.isPlatformAdmin,
      emailVerifiedAt: sess.emailVerifiedAt,
      phoneVerifiedAt: sess.phoneVerifiedAt,
      mfaEnabled: sess.mfaEnabled,
      mfaSecretEncrypted: sess.mfaSecretEncrypted,
      mfaType: sess.mfaType,
      lastLoginAt: sess.lastLoginAt,
      failedLoginAttempts: sess.failedLoginAttempts,
      lockedUntil: sess.lockedUntil,
      createdAt: sess.createdAt
    };
    const memberships = [
      ...sess.orgMemberships || [],
      ...sess.supMemberships || []
    ];
    let activeTenant;
    let profileSummary = null;
    if (sess.tenantType === "platform" && user.isPlatformAdmin) {
      activeTenant = {
        tenantType: "organization",
        tenantId: "platform",
        tenantName: "Platform Administration",
        roleId: "role-platform-admin",
        roleName: "Super Admin",
        isOwner: true,
        status: "active",
        permissions: ["*"]
      };
      profileSummary = {
        displayName: user.fullName || user.email,
        tenantType: "platform",
        tenantId: "platform",
        role: "Super Admin",
        supplierOrOrgName: "Platform Administration",
        verificationStatus: "verified",
        emailVerified: true
      };
    } else if (sess.tenantId) {
      activeTenant = memberships.find((m) => m.tenantId === sess.tenantId && m.status === "active");
    }
    if (!activeTenant && memberships.length > 0) {
      activeTenant = resolveDeterministicTenant(memberships, sess.tenantId);
      if (activeTenant && sess.sessionId) {
        persistActiveTenantToSession(sess.sessionId, activeTenant.tenantType, activeTenant.tenantId);
        sess.tenantType = activeTenant.tenantType;
        sess.tenantId = activeTenant.tenantId;
      }
    }
    if (!profileSummary && activeTenant) {
      profileSummary = activeTenant.profile_summary || {
        displayName: user.fullName || user.email,
        tenantType: activeTenant.tenantType,
        tenantId: activeTenant.tenantId,
        role: activeTenant.roleName,
        supplierOrOrgName: activeTenant.tenantName,
        verificationStatus: "verified",
        emailVerified: Boolean(user.emailVerifiedAt)
      };
    }
    req.user = user;
    req.session = {
      id: sess.sessionId,
      rawToken,
      tokenHash,
      tenantType: sess.tenantType,
      tenantId: sess.tenantId
    };
    req.activeTenant = activeTenant;
    req.profileSummary = profileSummary;
    req.permissions = new Set(
      user.isPlatformAdmin ? ["*"] : activeTenant?.permissions || []
    );
    return next();
  } catch (err) {
    console.error("[AUTH MIDDLEWARE ERROR]:", err);
    return next();
  }
}
function requireAuth(req, res, next) {
  if (!req.user || !req.session) {
    res.status(401).json({
      error: "AUTHENTICATION_REQUIRED",
      message: "You must be signed in to access this resource."
    });
    return;
  }
  next();
}
function requirePermission(...requiredPermissions) {
  return (req, res, next) => {
    if (!req.user || !req.session) {
      res.status(401).json({
        error: "AUTHENTICATION_REQUIRED",
        message: "You must be signed in to access this resource."
      });
      return;
    }
    if (req.user.isPlatformAdmin) {
      return next();
    }
    if (!req.activeTenant || !req.permissions) {
      res.status(403).json({
        error: "TENANT_MEMBERSHIP_REQUIRED",
        message: "You do not belong to an active organization or supplier workspace."
      });
      return;
    }
    const hasAll = requiredPermissions.every((perm) => req.permissions.has(perm) || req.permissions.has("*"));
    if (!hasAll) {
      res.status(403).json({
        error: "FORBIDDEN_INSUFFICIENT_PERMISSIONS",
        message: `Your active role (${req.activeTenant.roleName}) lacks required permission: ${requiredPermissions.join(", ")}.`,
        requiredPermissions
      });
      return;
    }
    next();
  };
}
function requireTenantType(tenantType) {
  return (req, res, next) => {
    if (!req.user || !req.session) {
      res.status(401).json({
        error: "AUTHENTICATION_REQUIRED",
        message: "You must be signed in to access this resource."
      });
      return;
    }
    if (req.user.isPlatformAdmin) {
      return next();
    }
    if (!req.activeTenant || req.activeTenant.tenantType !== tenantType) {
      res.status(403).json({
        error: "INVALID_TENANT_TYPE",
        message: `This action requires an active ${tenantType} workspace.`
      });
      return;
    }
    next();
  };
}
function requirePlatformAdmin(req, res, next) {
  if (!req.user || !req.user.isPlatformAdmin) {
    res.status(403).json({
      error: "FORBIDDEN_ADMIN_ONLY",
      message: "Access restricted to platform super administrators."
    });
    return;
  }
  next();
}

// server/utils/ip.ts
function sanitizeIp(rawIp) {
  if (!rawIp) return null;
  const ipStr = Array.isArray(rawIp) ? rawIp[0] : String(rawIp);
  const first = ipStr.split(",")[0].trim();
  if (!first) return null;
  const normalized = first.replace(/^::ffff:/i, "");
  const ipv4Regex = /^(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(?:\.(?:25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/;
  if (ipv4Regex.test(normalized)) {
    return normalized;
  }
  const ipv6Regex = /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$|^(([0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4})?::([0-9a-fA-F]{1,4}:){0,6}[0-9a-fA-F]{1,4}$/;
  if (ipv6Regex.test(normalized)) {
    return normalized;
  }
  return "127.0.0.1";
}
function extractClientIp(req) {
  const forwarded = req.headers?.["x-forwarded-for"];
  if (forwarded) {
    const sanitized = sanitizeIp(forwarded);
    if (sanitized) return sanitized;
  }
  const remote = req.socket?.remoteAddress;
  return sanitizeIp(remote) || "127.0.0.1";
}

// server/middleware/rateLimit.middleware.ts
var MAX_BUCKETS = 1e4;
function createRateLimiter(options) {
  const buckets = /* @__PURE__ */ new Map();
  let lastPrune = Date.now();
  function prune(now) {
    if (now - lastPrune < options.windowMs && buckets.size < MAX_BUCKETS) {
      return;
    }
    lastPrune = now;
    for (const [k, b] of buckets.entries()) {
      if (b.resetAt <= now) {
        buckets.delete(k);
      }
    }
    if (buckets.size >= MAX_BUCKETS) {
      const overflow = buckets.size - Math.floor(MAX_BUCKETS * 0.8);
      let removed = 0;
      for (const k of buckets.keys()) {
        buckets.delete(k);
        removed++;
        if (removed >= overflow) break;
      }
    }
  }
  return (req, res, next) => {
    if (req.method === "OPTIONS" || options.skip?.(req)) {
      return next();
    }
    const now = Date.now();
    prune(now);
    const ip = extractClientIp(req) || req.socket?.remoteAddress || "unknown";
    const key = `${options.keyPrefix}:${ip}`;
    const existing = buckets.get(key);
    let bucket;
    if (!existing || existing.resetAt <= now) {
      bucket = { count: 1, resetAt: now + options.windowMs };
      buckets.set(key, bucket);
    } else {
      existing.count += 1;
      bucket = existing;
    }
    const remaining = Math.max(0, options.maxRequests - bucket.count);
    const resetSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1e3));
    res.setHeader("RateLimit-Limit", String(options.maxRequests));
    res.setHeader("RateLimit-Remaining", String(remaining));
    res.setHeader("RateLimit-Reset", String(resetSeconds));
    if (bucket.count > options.maxRequests) {
      res.setHeader("Retry-After", String(resetSeconds));
      res.status(429).json({
        error: "RATE_LIMIT_EXCEEDED",
        code: "RATE_LIMIT_EXCEEDED",
        message: options.message || "Too many requests. Please wait a moment and try again."
      });
      return;
    }
    next();
  };
}
var generalApiRateLimiter = createRateLimiter({
  windowMs: 60 * 1e3,
  maxRequests: 240,
  keyPrefix: "api",
  message: "Too many API requests from this network. Please retry in a minute.",
  skip: (req) => req.path === "/health" || req.path === "/api/health"
});
var authEndpointRateLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1e3,
  maxRequests: 40,
  keyPrefix: "auth",
  message: "Too many authentication attempts. Please try again in 15 minutes.",
  skip: (req) => req.method === "GET" || req.path === "/logout" || req.path === "/switch-tenant"
});

// server/routes/reference.routes.ts
import { Router } from "express";

// server/repositories/reference.repository.ts
var CACHE_TTL_MS = 5 * 60 * 1e3;
var referenceCache = /* @__PURE__ */ new Map();
function clearReferenceCache(key) {
  if (key) {
    referenceCache.delete(key);
  } else {
    referenceCache.clear();
  }
}
async function cachedReferenceQuery(key, fetcher) {
  const entry = referenceCache.get(key);
  if (entry && entry.expiresAt > Date.now()) {
    console.log("[ref] cache hit", key);
    return entry.rows;
  }
  if (entry) {
    referenceCache.delete(key);
  }
  const rows = await fetcher();
  if (Array.isArray(rows) && rows.length > 0) {
    referenceCache.set(key, {
      rows,
      expiresAt: Date.now() + CACHE_TTL_MS
    });
  }
  return rows;
}
var ReferenceRepository = class {
  constructor() {
    this.docTypesHasRequiresNumber = null;
  }
  async hasDocumentTypesRequiresNumber() {
    if (this.docTypesHasRequiresNumber === true) return true;
    const res = await query(
      `SELECT EXISTS (
         SELECT 1
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'document_types'
           AND column_name = 'requires_number'
       ) AS exists`
    );
    const exists = Boolean(res.rows[0]?.exists);
    if (exists) this.docTypesHasRequiresNumber = true;
    return exists;
  }
  async getDistricts() {
    return cachedReferenceQuery("districts", async () => {
      const res = await query(
        `SELECT id, name, administrative_region AS "administrativeRegion", country_code AS "countryCode", sort_order AS "sortOrder"
         FROM geographic_districts WHERE is_active = TRUE ORDER BY sort_order ASC, name ASC`
      );
      return res.rows;
    });
  }
  async getDocumentTypes() {
    return cachedReferenceQuery("documentTypes", async () => {
      const hasRequiresNumber = await this.hasDocumentTypesRequiresNumber();
      const requiresNumberSelect = hasRequiresNumber ? 'requires_number AS "requiresNumber"' : 'TRUE AS "requiresNumber"';
      const res = await query(
        `SELECT id, organization_id AS "organizationId", code, name, description, issuing_authority AS "issuingAuthority",
                requires_expiry AS "requiresExpiry", ${requiresNumberSelect}, default_validity_days AS "defaultValidityDays",
                max_file_size_mb AS "maxFileSizeMb", allowed_mime_types AS "allowedMimeTypes",
                verification_method AS "verificationMethod", is_mandatory_default AS "isMandatoryDefault", sort_order AS "sortOrder"
         FROM document_types WHERE is_active = TRUE ORDER BY sort_order ASC, name ASC`
      );
      return res.rows;
    });
  }
  async getDisciplines() {
    return cachedReferenceQuery("disciplines", async () => {
      const res = await query(
        `SELECT id, code, title, description, sort_order AS "sortOrder"
         FROM procurement_disciplines WHERE is_active = TRUE ORDER BY sort_order ASC, code ASC`
      );
      return res.rows;
    });
  }
  async getCapabilityTiers() {
    return cachedReferenceQuery("capabilityTiers", async () => {
      const res = await query(
        `SELECT id, code, name, description, min_contract_value AS "minContractValue", max_contract_value AS "maxContractValue", sort_order AS "sortOrder"
         FROM capability_tiers ORDER BY sort_order ASC`
      );
      return res.rows;
    });
  }
  async getPlans() {
    return cachedReferenceQuery("plans", async () => {
      const res = await query(
        `SELECT id, code, name, audience, price, currency, billing_interval AS "billingInterval",
                max_users AS "maxUsers", max_calls_per_year AS "maxCallsPerYear", features, sort_order AS "sortOrder"
         FROM plans WHERE is_active = TRUE ORDER BY sort_order ASC`
      );
      return res.rows;
    });
  }
  async getPermissions() {
    return cachedReferenceQuery("permissions", async () => {
      const res = await query(
        `SELECT id, code, scope, category, description FROM permissions ORDER BY scope ASC, category ASC, code ASC`
      );
      return res.rows;
    });
  }
  async getRoles() {
    return cachedReferenceQuery("roles", async () => {
      const res = await query(
        `SELECT id, scope, organization_id AS "organizationId", name, description, color, is_system AS "isSystem", approval_limit_bwp AS "approvalLimitBwp"
         FROM roles WHERE is_system = TRUE ORDER BY scope ASC, sort_order ASC, name ASC`
      );
      return res.rows;
    });
  }
  async getFinancialConfigs() {
    return cachedReferenceQuery("financialConfigs", async () => {
      const res = await query(
        `SELECT id, config_key AS "configKey", config_value AS "configValue", description
         FROM platform_financial_configs`
      );
      return res.rows;
    });
  }
  async getNotificationTemplates() {
    return cachedReferenceQuery("notificationTemplates", async () => {
      const res = await query(
        `SELECT id, organization_id AS "organizationId", code, channel, locale, subject, body, variables
         FROM notification_templates WHERE is_active = TRUE`
      );
      return res.rows;
    });
  }
  /**
   * Loads all reference data from PostgreSQL in parallel.
   * Throws on any database error; never returns fallback or empty cached data.
   */
  async loadAll() {
    const [
      districts,
      documentTypes,
      disciplines,
      capabilityTiers,
      plans,
      permissions,
      roles,
      financialConfigs,
      notificationTemplates
    ] = await Promise.all([
      this.getDistricts(),
      this.getDocumentTypes(),
      this.getDisciplines(),
      this.getCapabilityTiers(),
      this.getPlans(),
      this.getPermissions(),
      this.getRoles(),
      this.getFinancialConfigs(),
      this.getNotificationTemplates()
    ]);
    return {
      districts,
      documentTypes,
      disciplines,
      capabilityTiers,
      plans,
      permissions,
      roles,
      financialConfigs,
      notificationTemplates,
      loadedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  /**
   * Loads category codes and sub-codes from the PostgreSQL categories table
   * structured as hierarchical category tree nodes.
   * Throws on any database error; never returns hardcoded rows.
   */
  async getCategoriesTree() {
    return cachedReferenceQuery("categories", async () => {
      const res = await query(
        `SELECT id, parent_id AS "parentId", code, name, description, level, sort_order AS "sortOrder"
         FROM categories
         WHERE is_active = TRUE
         ORDER BY level ASC, sort_order ASC, code ASC`
      );
      const rows = res.rows;
      const level1 = rows.filter((r) => r.level === 1);
      const level2 = rows.filter((r) => r.level === 2);
      return level1.map((parent) => {
        const children = level2.filter(
          (c) => c.parentId === parent.id || c.code && parent.code && c.code.startsWith(parent.code + "_")
        ).map((c) => ({
          id: c.id,
          code: c.code,
          name: c.name,
          description: c.description,
          level: c.level,
          parentId: c.parentId,
          sortOrder: c.sortOrder
        }));
        return {
          id: parent.id,
          code: parent.code,
          name: parent.name,
          description: parent.description,
          level: parent.level,
          parentId: parent.parentId,
          sortOrder: parent.sortOrder,
          children
        };
      });
    });
  }
  // =========================================================================
  // Admin Catalogue & Plan Management (with cache invalidation)
  // =========================================================================
  async listAllCategoriesAdmin() {
    const res = await query(
      `SELECT id, parent_id AS "parentId", code, name, description, level,
              sort_order AS "sortOrder", is_active AS "isActive",
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM categories
       WHERE organization_id IS NULL
       ORDER BY level ASC, sort_order ASC, code ASC`
    );
    return res.rows;
  }
  async createCategory(data) {
    const code = data.code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "_");
    const name = data.name.trim();
    const level = data.parentId ? Math.max(2, Number(data.level) || 2) : Math.max(1, Math.min(5, Number(data.level) || 1));
    const sortOrder = Number(data.sortOrder) || 0;
    const res = await query(
      `INSERT INTO categories (parent_id, organization_id, code, name, description, level, sort_order, is_active)
       VALUES ($1, NULL, $2, $3, $4, $5, $6, TRUE)
       RETURNING id, parent_id AS "parentId", code, name, description, level,
                 sort_order AS "sortOrder", is_active AS "isActive"`,
      [data.parentId || null, code, name, data.description?.trim() || null, level, sortOrder]
    );
    clearReferenceCache("categories");
    return res.rows[0];
  }
  async updateCategory(id, data) {
    const res = await query(
      `UPDATE categories
       SET name = COALESCE($2, name),
           description = CASE WHEN $3::boolean THEN $4 ELSE description END,
           is_active = COALESCE($5, is_active),
           sort_order = COALESCE($6, sort_order),
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, parent_id AS "parentId", code, name, description, level,
                 sort_order AS "sortOrder", is_active AS "isActive"`,
      [
        id,
        data.name !== void 0 ? data.name.trim() : null,
        data.description !== void 0,
        data.description !== void 0 ? data.description ? data.description.trim() : null : null,
        data.isActive !== void 0 ? Boolean(data.isActive) : null,
        data.sortOrder !== void 0 ? Number(data.sortOrder) : null
      ]
    );
    clearReferenceCache("categories");
    return res.rows[0] || null;
  }
  async listAllDocumentTypesAdmin() {
    const hasRequiresNumber = await this.hasDocumentTypesRequiresNumber();
    const requiresNumberSelect = hasRequiresNumber ? 'requires_number AS "requiresNumber"' : 'TRUE AS "requiresNumber"';
    const res = await query(
      `SELECT id, organization_id AS "organizationId", code, name, description,
              issuing_authority AS "issuingAuthority", requires_expiry AS "requiresExpiry",
              ${requiresNumberSelect}, default_validity_days AS "defaultValidityDays",
              max_file_size_mb AS "maxFileSizeMb", verification_method AS "verificationMethod",
              is_mandatory_default AS "isMandatoryDefault", is_active AS "isActive",
              sort_order AS "sortOrder"
       FROM document_types
       WHERE organization_id IS NULL
       ORDER BY sort_order ASC, name ASC`
    );
    return res.rows;
  }
  async createDocumentType(data) {
    const hasRequiresNumber = await this.hasDocumentTypesRequiresNumber();
    const code = data.code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, "_");
    const name = data.name.trim();
    const allowedMethods = ["manual", "registry_api", "ai_assisted", "hybrid"];
    const verificationMethod = allowedMethods.includes(String(data.verificationMethod || "").toLowerCase()) ? String(data.verificationMethod).toLowerCase() : "manual";
    const res = hasRequiresNumber ? await query(
      `INSERT INTO document_types (
             organization_id, code, name, description, issuing_authority,
             requires_expiry, requires_number, default_validity_days,
             verification_method, is_mandatory_default, is_active, sort_order
           ) VALUES (NULL, $1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE, $10)
           RETURNING id, code, name, description, issuing_authority AS "issuingAuthority",
                     requires_expiry AS "requiresExpiry", requires_number AS "requiresNumber",
                     default_validity_days AS "defaultValidityDays", verification_method AS "verificationMethod",
                     is_mandatory_default AS "isMandatoryDefault", is_active AS "isActive", sort_order AS "sortOrder"`,
      [
        code,
        name,
        data.description?.trim() || null,
        data.issuingAuthority?.trim() || null,
        Boolean(data.requiresExpiry),
        data.requiresNumber !== void 0 ? Boolean(data.requiresNumber) : true,
        data.defaultValidityDays ?? null,
        verificationMethod,
        Boolean(data.isMandatoryDefault),
        Number(data.sortOrder) || 0
      ]
    ) : await query(
      `INSERT INTO document_types (
             organization_id, code, name, description, issuing_authority,
             requires_expiry, default_validity_days,
             verification_method, is_mandatory_default, is_active, sort_order
           ) VALUES (NULL, $1, $2, $3, $4, $5, $6, $7, $8, TRUE, $9)
           RETURNING id, code, name, description, issuing_authority AS "issuingAuthority",
                     requires_expiry AS "requiresExpiry", TRUE AS "requiresNumber",
                     default_validity_days AS "defaultValidityDays", verification_method AS "verificationMethod",
                     is_mandatory_default AS "isMandatoryDefault", is_active AS "isActive", sort_order AS "sortOrder"`,
      [
        code,
        name,
        data.description?.trim() || null,
        data.issuingAuthority?.trim() || null,
        Boolean(data.requiresExpiry),
        data.defaultValidityDays ?? null,
        verificationMethod,
        Boolean(data.isMandatoryDefault),
        Number(data.sortOrder) || 0
      ]
    );
    clearReferenceCache("documentTypes");
    return res.rows[0];
  }
  async updateDocumentType(id, data) {
    const allowedMethods = ["manual", "registry_api", "ai_assisted", "hybrid"];
    const method = data.verificationMethod && allowedMethods.includes(data.verificationMethod.toLowerCase()) ? data.verificationMethod.toLowerCase() : null;
    const hasRequiresNumber = await this.hasDocumentTypesRequiresNumber();
    const requiresNumberSelect = hasRequiresNumber ? 'requires_number AS "requiresNumber"' : 'TRUE AS "requiresNumber"';
    const res = await query(
      `UPDATE document_types
       SET name = COALESCE($2, name),
           description = CASE WHEN $3::boolean THEN $4 ELSE description END,
           issuing_authority = CASE WHEN $5::boolean THEN $6 ELSE issuing_authority END,
           requires_expiry = COALESCE($7, requires_expiry),
           default_validity_days = CASE WHEN $8::boolean THEN $9::int ELSE default_validity_days END,
           verification_method = COALESCE($10, verification_method),
           is_mandatory_default = COALESCE($11, is_mandatory_default),
           is_active = COALESCE($12, is_active),
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, code, name, description, issuing_authority AS "issuingAuthority",
                 requires_expiry AS "requiresExpiry", ${requiresNumberSelect},
                 default_validity_days AS "defaultValidityDays", verification_method AS "verificationMethod",
                 is_mandatory_default AS "isMandatoryDefault", is_active AS "isActive", sort_order AS "sortOrder"`,
      [
        id,
        data.name !== void 0 ? data.name.trim() : null,
        data.description !== void 0,
        data.description !== void 0 ? data.description ? data.description.trim() : null : null,
        data.issuingAuthority !== void 0,
        data.issuingAuthority !== void 0 ? data.issuingAuthority ? data.issuingAuthority.trim() : null : null,
        data.requiresExpiry !== void 0 ? Boolean(data.requiresExpiry) : null,
        data.defaultValidityDays !== void 0,
        data.defaultValidityDays !== void 0 ? data.defaultValidityDays : null,
        method,
        data.isMandatoryDefault !== void 0 ? Boolean(data.isMandatoryDefault) : null,
        data.isActive !== void 0 ? Boolean(data.isActive) : null
      ]
    );
    clearReferenceCache("documentTypes");
    return res.rows[0] || null;
  }
  async updatePlan(id, data) {
    const res = await query(
      `UPDATE plans
       SET price = COALESCE($2, price),
           max_calls_per_year = CASE WHEN $3::boolean THEN $4::int ELSE max_calls_per_year END,
           features = CASE WHEN $5::boolean THEN COALESCE(features, '{}'::jsonb) || $6::jsonb ELSE features END
       WHERE id = $1
       RETURNING id, code, name, audience, price, currency, billing_interval AS "billingInterval",
                 max_users AS "maxUsers", max_calls_per_year AS "maxCallsPerYear", features, sort_order AS "sortOrder"`,
      [
        id,
        data.price !== void 0 ? Number(data.price) : null,
        data.maxCallsPerYear !== void 0,
        data.maxCallsPerYear !== void 0 ? data.maxCallsPerYear : null,
        data.features !== void 0,
        data.features !== void 0 ? JSON.stringify(data.features) : null
      ]
    );
    clearReferenceCache("plans");
    return res.rows[0] || null;
  }
};
var referenceRepository = new ReferenceRepository();

// server/routes/reference.routes.ts
var router = Router();
function setReferenceSuccessHeaders(res) {
  res.removeHeader("Pragma");
  res.removeHeader("Expires");
  res.removeHeader("Surrogate-Control");
  res.setHeader("Cache-Control", "public, max-age=300");
}
function handleReferenceError(err, res, next) {
  if (err instanceof DbGuardError || err?.code === "DB_GUARD") {
    next(err);
    return;
  }
  console.error("[REFERENCE API ERROR]", err?.code || "ERR", err?.message);
  res.removeHeader("Pragma");
  res.removeHeader("Expires");
  res.removeHeader("Surrogate-Control");
  res.setHeader("Cache-Control", "no-store");
  res.status(503).json({ error: "reference_unavailable" });
}
router.get("/categories", async (_req, res, next) => {
  try {
    const tree = await referenceRepository.getCategoriesTree();
    setReferenceSuccessHeaders(res);
    res.json(tree);
  } catch (err) {
    handleReferenceError(err, res, next);
  }
});
router.get("/", async (_req, res, next) => {
  try {
    const data = await referenceRepository.loadAll();
    setReferenceSuccessHeaders(res);
    res.json(data);
  } catch (err) {
    handleReferenceError(err, res, next);
  }
});
router.post("/refresh", requireAuth, requirePlatformAdmin, async (_req, res, next) => {
  try {
    clearReferenceCache();
    const data = await referenceRepository.loadAll();
    res.setHeader("Cache-Control", "no-store");
    res.json({ success: true, reloadedAt: data.loadedAt });
  } catch (err) {
    handleReferenceError(err, res, next);
  }
});
var referenceRouter = router;

// server/routes/auth.routes.ts
import { Router as Router2 } from "express";

// server/repositories/users.repository.ts
var UsersRepository = class {
  async findByEmail(email) {
    const res = await query(
      `SELECT id, email, password_hash AS "passwordHash", full_name AS "fullName",
              phone, preferred_language AS "preferredLanguage", status,
              is_platform_admin AS "isPlatformAdmin", email_verified_at AS "emailVerifiedAt",
              phone_verified_at AS "phoneVerifiedAt", mfa_enabled AS "mfaEnabled",
              mfa_secret_encrypted AS "mfaSecretEncrypted", mfa_type AS "mfaType",
              last_login_at AS "lastLoginAt", failed_login_attempts AS "failedLoginAttempts",
              locked_until AS "lockedUntil", created_at AS "createdAt"
       FROM users WHERE email = $1 AND deleted_at IS NULL`,
      [email.trim().toLowerCase()]
    );
    return res.rows[0] || null;
  }
  async findById(id) {
    const res = await query(
      `SELECT id, email, password_hash AS "passwordHash", full_name AS "fullName",
              phone, preferred_language AS "preferredLanguage", status,
              is_platform_admin AS "isPlatformAdmin", email_verified_at AS "emailVerifiedAt",
              phone_verified_at AS "phoneVerifiedAt", mfa_enabled AS "mfaEnabled",
              mfa_secret_encrypted AS "mfaSecretEncrypted", mfa_type AS "mfaType",
              last_login_at AS "lastLoginAt", failed_login_attempts AS "failedLoginAttempts",
              locked_until AS "lockedUntil", created_at AS "createdAt"
       FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    return res.rows[0] || null;
  }
  async recordLoginSuccess(userId, ip) {
    await query(
      `UPDATE users
       SET last_login_at = NOW(),
           last_login_ip = $2,
           failed_login_attempts = 0,
           locked_until = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [userId, ip || null]
    );
  }
  async recordLoginFailure(userId) {
    const res = await query(
      `UPDATE users
       SET failed_login_attempts = failed_login_attempts + 1,
           locked_until = CASE
             WHEN failed_login_attempts + 1 >= 5 THEN NOW() + INTERVAL '15 minutes'
             ELSE locked_until
           END,
           updated_at = NOW()
       WHERE id = $1
       RETURNING failed_login_attempts AS "failedAttempts", locked_until AS "lockedUntil"`,
      [userId]
    );
    return res.rows[0] || { failedAttempts: 1, lockedUntil: null };
  }
  async saveMfaSecret(userId, encryptedSecret, mfaType = "authenticator") {
    await query(
      `UPDATE users
       SET mfa_secret_encrypted = $2,
           mfa_type = $3,
           updated_at = NOW()
       WHERE id = $1`,
      [userId, encryptedSecret, mfaType]
    );
  }
  async enableMfa(userId) {
    await query(
      `UPDATE users
       SET mfa_enabled = TRUE,
           updated_at = NOW()
       WHERE id = $1`,
      [userId]
    );
  }
  async getUserMemberships(userId) {
    const orgMembersRes = await query(
      `SELECT 'organization' AS "tenantType",
              o.id AS "tenantId",
              o.name AS "tenantName",
              o.status AS "organizationStatus",
              o.verification_status AS "verificationStatus",
              o.rejection_reason AS "rejectionReason",
              r.id AS "roleId",
              r.name AS "roleName",
              om.is_owner AS "isOwner",
              om.status,
              COALESCE(
                (SELECT json_agg(p.code)
                 FROM role_permissions rp
                 JOIN permissions p ON p.id = rp.permission_id
                 WHERE rp.role_id = r.id),
                '[]'::json
              ) AS permissions
       FROM organization_members om
       JOIN organizations o ON o.id = om.organization_id AND o.deleted_at IS NULL
       JOIN roles r ON r.id = om.role_id
       WHERE om.user_id = $1 AND om.status = 'active'`,
      [userId]
    );
    const supMembersRes = await query(
      `SELECT 'supplier' AS "tenantType",
              s.id AS "tenantId",
              s.legal_name AS "tenantName",
              s.status AS "supplierStatus",
              s.verification_status AS "verificationStatus",
              r.id AS "roleId",
              r.name AS "roleName",
              sm.is_owner AS "isOwner",
              sm.status,
              COALESCE(
                (SELECT json_agg(p.code)
                 FROM role_permissions rp
                 JOIN permissions p ON p.id = rp.permission_id
                 WHERE rp.role_id = r.id),
                '[]'::json
              ) AS permissions
       FROM supplier_members sm
       JOIN suppliers s ON s.id = sm.supplier_id AND s.deleted_at IS NULL
       JOIN roles r ON r.id = sm.role_id
       WHERE sm.user_id = $1 AND sm.status = 'active'`,
      [userId]
    );
    return [...orgMembersRes.rows, ...supMembersRes.rows];
  }
};
var usersRepository = new UsersRepository();

// server/repositories/audit.repository.ts
import crypto3 from "crypto";
var UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
var GENESIS_HASH = "0".repeat(64);
var AUDIT_CHAIN_LOCK_KEY = 72819401;
function computeCanonicalRowHash(params) {
  const payload = `${params.prevHash}|${params.occurredAtIso}|${params.actorName}|${params.actorRole}|${params.action}|${params.entityType}|${params.entityId || ""}|${params.details}`;
  return crypto3.createHash("sha256").update(payload).digest("hex");
}
var AuditRepository = class {
  /**
   * Appends an immutable audit event with a serialized cryptographic hash chain.
   * Uses the exact ISO timestamp persisted to occurred_at so hashes can be deterministically re-verified.
   */
  async logEvent(dto, externalClient) {
    const appendWithClient = async (client) => {
      await client.query(`SELECT pg_advisory_xact_lock(${AUDIT_CHAIN_LOCK_KEY})`);
      const lastRowRes = await client.query(
        `SELECT row_hash FROM audit_log ORDER BY occurred_at DESC, id DESC LIMIT 1`
      );
      const prevHash = (lastRowRes.rows[0]?.row_hash || GENESIS_HASH).trim();
      const occurredAtIso = (/* @__PURE__ */ new Date()).toISOString();
      const safeEntityId = dto.entityId && UUID_RE.test(dto.entityId) ? dto.entityId : null;
      const safeActorUserId = dto.actorUserId && UUID_RE.test(dto.actorUserId) ? dto.actorUserId : null;
      const safeOrgId = dto.organizationId && UUID_RE.test(dto.organizationId) ? dto.organizationId : null;
      const safeSupplierId = dto.supplierId && UUID_RE.test(dto.supplierId) ? dto.supplierId : null;
      const cleanActorName = String(dto.actorName || "System").slice(0, 200);
      const cleanActorRole = String(dto.actorRole || "System").slice(0, 50);
      const cleanAction = String(dto.action || "EVENT").slice(0, 100);
      const cleanEntityType = String(dto.entityType || "Record").slice(0, 60);
      const cleanDetails = String(dto.details || "");
      const rowHash = computeCanonicalRowHash({
        prevHash,
        occurredAtIso,
        actorName: cleanActorName,
        actorRole: cleanActorRole,
        action: cleanAction,
        entityType: cleanEntityType,
        entityId: safeEntityId,
        details: cleanDetails
      });
      const res = await client.query(
        `INSERT INTO audit_log (
          occurred_at, actor_type, actor_user_id, actor_name, actor_role,
          organization_id, supplier_id, organization_name, action,
          entity_type, entity_id, ip_address, user_agent,
          before_json, after_json, details, prev_hash, row_hash
        ) VALUES (
          $1::timestamptz, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
        ) RETURNING 
          id, occurred_at AS "occurredAt", actor_type AS "actorType", actor_user_id AS "actorUserId",
          actor_name AS "actorName", actor_role AS "actorRole", organization_id AS "organizationId",
          supplier_id AS "supplierId", organization_name AS "organizationName", action,
          entity_type AS "entityType", entity_id AS "entityId", ip_address AS "ipAddress",
          user_agent AS "userAgent", before_json AS "beforeJson", after_json AS "afterJson",
          details, prev_hash AS "prevHash", row_hash AS "rowHash"`,
        [
          occurredAtIso,
          dto.actorType || "user",
          safeActorUserId,
          cleanActorName,
          cleanActorRole,
          safeOrgId,
          safeSupplierId,
          dto.organizationName || null,
          cleanAction,
          cleanEntityType,
          safeEntityId,
          dto.ipAddress || null,
          dto.userAgent || null,
          dto.beforeJson ? JSON.stringify(dto.beforeJson) : null,
          dto.afterJson ? JSON.stringify(dto.afterJson) : null,
          cleanDetails,
          prevHash,
          rowHash
        ]
      );
      return res.rows[0];
    };
    if (externalClient) {
      return appendWithClient(externalClient);
    }
    return tx(appendWithClient);
  }
  /**
   * Verifies the append-only hash chain across the global audit_log ledger.
   */
  async verifyChain(filters) {
    const limit = Math.min(Math.max(Number(filters?.limit) || 1e3, 1), 5e3);
    const res = await query(
      `SELECT id,
              occurred_at AS "occurredAt",
              actor_name AS "actorName",
              actor_role AS "actorRole",
              organization_id AS "organizationId",
              supplier_id AS "supplierId",
              action,
              entity_type AS "entityType",
              entity_id AS "entityId",
              details,
              prev_hash AS "prevHash",
              row_hash AS "rowHash"
       FROM audit_log
       ORDER BY occurred_at ASC, id ASC
       LIMIT $1`,
      [limit]
    );
    let brokenLinks = 0;
    let hashMismatches = 0;
    let firstBrokenEventId = null;
    let firstBrokenReason = null;
    let expectedPrevHash = GENESIS_HASH;
    let latestHash = null;
    let scopedChecked = 0;
    for (let i = 0; i < res.rows.length; i++) {
      const row = res.rows[i];
      const storedPrev = (row.prevHash || "").trim();
      const storedHash = (row.rowHash || "").trim();
      const inScope = (!filters?.organizationId || row.organizationId === filters.organizationId) && (!filters?.supplierId || row.supplierId === filters.supplierId);
      if (inScope) {
        scopedChecked++;
      }
      if (storedPrev !== expectedPrevHash) {
        brokenLinks++;
        if (!firstBrokenEventId) {
          firstBrokenEventId = row.id;
          firstBrokenReason = "Previous hash pointer mismatch detected in audit chain.";
        }
      }
      const recomputed = computeCanonicalRowHash({
        prevHash: storedPrev || GENESIS_HASH,
        occurredAtIso: new Date(row.occurredAt).toISOString(),
        actorName: row.actorName || "",
        actorRole: row.actorRole || "",
        action: row.action,
        entityType: row.entityType || "",
        entityId: row.entityId,
        details: row.details || ""
      });
      if (!storedHash || storedHash !== recomputed) {
        hashMismatches++;
        if (!firstBrokenEventId) {
          firstBrokenEventId = row.id;
          firstBrokenReason = "Row SHA-256 checksum does not match canonical ledger payload.";
        }
      }
      if (storedHash) {
        expectedPrevHash = storedHash;
        latestHash = storedHash;
      }
    }
    return {
      valid: brokenLinks === 0 && hashMismatches === 0,
      chainLinkValid: brokenLinks === 0,
      totalChecked: filters?.organizationId || filters?.supplierId ? scopedChecked : res.rows.length,
      brokenLinks,
      hashMismatches,
      latestHash,
      firstBrokenEventId,
      firstBrokenReason,
      checkedAt: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  async listEvents(filters) {
    const conditions = [];
    const params = [];
    if (filters.organizationId) {
      params.push(filters.organizationId);
      conditions.push(`(organization_id = $${params.length} OR organization_id IS NULL)`);
    }
    if (filters.supplierId) {
      params.push(filters.supplierId);
      conditions.push(`supplier_id = $${params.length}`);
    }
    if (filters.entityType && filters.entityType !== "ALL") {
      params.push(filters.entityType);
      conditions.push(`LOWER(entity_type) = LOWER($${params.length})`);
    }
    if (filters.actor) {
      params.push(`%${filters.actor.trim()}%`);
      conditions.push(`(actor_name ILIKE $${params.length} OR actor_role ILIKE $${params.length} OR EXISTS (SELECT 1 FROM users u WHERE u.id = audit_log.actor_user_id AND u.email::text ILIKE $${params.length}))`);
    }
    if (filters.action && filters.action !== "ALL") {
      params.push(`%${filters.action.trim()}%`);
      conditions.push(`action ILIKE $${params.length}`);
    }
    if (filters.search) {
      params.push(`%${filters.search.trim()}%`);
      conditions.push(`(actor_name ILIKE $${params.length} OR action ILIKE $${params.length} OR entity_type ILIKE $${params.length} OR details ILIKE $${params.length})`);
    }
    if (filters.fromDate) {
      params.push(filters.fromDate);
      conditions.push(`occurred_at >= $${params.length}::timestamptz`);
    }
    if (filters.toDate) {
      params.push(filters.toDate);
      conditions.push(`occurred_at <= ($${params.length}::date + INTERVAL '1 day' - INTERVAL '1 second')`);
    }
    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit = Math.min(Math.max(Number(filters.limit) || 100, 1), 500);
    params.push(limit);
    const res = await query(
      `SELECT 
        id, occurred_at AS "occurredAt", actor_type AS "actorType", actor_user_id AS "actorUserId",
        actor_name AS "actorName", actor_role AS "actorRole", organization_id AS "organizationId",
        supplier_id AS "supplierId", organization_name AS "organizationName", action,
        entity_type AS "entityType", entity_id AS "entityId", ip_address AS "ipAddress",
        user_agent AS "userAgent", before_json AS "beforeJson", after_json AS "afterJson",
        details, prev_hash AS "prevHash", row_hash AS "rowHash"
       FROM audit_log
       ${whereClause}
       ORDER BY occurred_at DESC, id DESC
       LIMIT $${params.length}`,
      params
    );
    return res.rows;
  }
  async recordExport(data) {
    await query(
      `INSERT INTO audit_exports (
        organization_id, exported_by_user_id, export_type,
        records_count, checksum_sha256, ip_address, user_agent, exported_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [
        data.organizationId,
        data.exportedByUserId,
        data.exportType,
        data.recordsCount,
        data.checksumSha256,
        data.ipAddress || null,
        data.userAgent || null
      ]
    );
  }
};
var auditRepository = new AuditRepository();

// server/services/auth.service.ts
var isColdStart = true;
function runBackgroundTask(task) {
  task.catch((err) => {
    console.error("[BACKGROUND TASK NOTICE]:", err?.message || err);
  });
}
var AuthService = class {
  /**
   * Records an authentication attempt into PostgreSQL login_attempts table.
   */
  async recordLoginAttempt(emailNorm, ip, succeeded) {
    try {
      await query(
        `INSERT INTO login_attempts (email_norm, ip, succeeded, attempted_at)
         VALUES ($1, $2, $3, NOW())`,
        [emailNorm, ip || null, succeeded]
      );
    } catch (err) {
      console.error("[AUTH RECORD ATTEMPT ERROR]:", err.message);
    }
  }
  /**
   * Enforces brute-force lockout using ONE indexed COUNT query:
   * - 5 failures for the same email within 15 minutes
   * - 20 failures from the same IP within 15 minutes
   * Returns HTTP 429 when threshold exceeded.
   */
  async checkBruteForce(emailNorm, ip) {
    const cleanIp = ip && ip.trim() ? ip.trim() : null;
    const res = await query(
      `SELECT 
         COUNT(*) FILTER (WHERE email_norm = $1)::text AS email_fails,
         COUNT(*) FILTER (WHERE $2::text IS NOT NULL AND ip = $2::text)::text AS ip_fails
       FROM login_attempts
       WHERE (email_norm = $1 OR ($2::text IS NOT NULL AND ip = $2::text))
         AND succeeded = FALSE
         AND attempted_at > NOW() - INTERVAL '15 minutes'`,
      [emailNorm, cleanIp]
    );
    const emailFails = parseInt(res.rows[0]?.email_fails || "0", 10);
    const ipFails = parseInt(res.rows[0]?.ip_fails || "0", 10);
    if (emailFails >= 5 || ipFails >= 20) {
      runBackgroundTask(
        auditRepository.logEvent({
          actorType: "system",
          actorName: emailNorm,
          actorRole: "Security Guard",
          action: "lockout",
          entityType: "login_attempt",
          ipAddress: ip,
          details: `Brute force protection triggered: ${emailFails} email failures, ${ipFails} IP failures in 15 minutes.`
        })
      );
      const err = new Error("Too many attempts. Try again in 15 minutes.");
      err.status = 429;
      err.code = "RATE_LIMIT_EXCEEDED";
      throw err;
    }
  }
  /**
   * Rate limits sensitive actions like signups, password resets, and verification resends.
   */
  async checkActionRateLimit(key, maxAttempts, windowMinutes, message) {
    const res = await query(
      `SELECT COUNT(*)::text AS count
       FROM audit_log
       WHERE action = $1
         AND occurred_at > NOW() - ($2 || ' minutes')::INTERVAL`,
      [key, windowMinutes]
    );
    const count = parseInt(res.rows[0]?.count || "0", 10);
    if (count >= maxAttempts) {
      const err = new Error(message);
      err.status = 429;
      err.code = "RATE_LIMIT_EXCEEDED";
      throw err;
    }
  }
  /**
   * Fast, secure authentication:
   * - 1 single combined SQL query for rate limits + user lookup + tenant memberships + profiles.
   * - 1 bcrypt compare (cost 12 preserved).
   * - 1 session insert.
   * - Non-critical writes (login_attempts, audit_log, last_login_at) run in background after response.
   */
  async login(email, passwordPlain, ip, userAgent) {
    const wasCold = isColdStart;
    isColdStart = false;
    const t0 = performance.now();
    const cleanEmail = email.trim().toLowerCase();
    const cleanIp = sanitizeIp(ip);
    const tLookup0 = performance.now();
    const combinedRes = await query(
      `WITH rate_limits AS (
        SELECT 
          COUNT(*) FILTER (WHERE email_norm = $1) AS email_fails,
          COUNT(*) FILTER (WHERE $2::text IS NOT NULL AND ip = $2::text) AS ip_fails
        FROM login_attempts
        WHERE (email_norm = $1 OR ($2::text IS NOT NULL AND ip = $2::text))
          AND succeeded = FALSE
          AND attempted_at > NOW() - INTERVAL '15 minutes'
      ),
      user_data AS (
        SELECT id, email, password_hash, full_name, phone, status,
               email_verified_at, is_platform_admin, mfa_enabled, mfa_secret_encrypted,
               failed_login_attempts, locked_until
        FROM users
        WHERE LOWER(email::text) = LOWER($1) AND deleted_at IS NULL
        LIMIT 1
      ),
      org_mems AS (
        SELECT 
          'organization' AS tenant_type,
          o.id AS tenant_id,
          o.name AS tenant_name,
          o.status AS org_status,
          o.verification_status AS org_verification_status,
          o.rejection_reason AS org_rejection_reason,
          r.id AS role_id,
          r.name AS role_name,
          om.is_owner,
          om.status,
          om.last_active_at,
          om.created_at,
          COALESCE(
            (SELECT json_agg(p.code)
             FROM role_permissions rp
             JOIN permissions p ON p.id = rp.permission_id
             WHERE rp.role_id = r.id),
            '[]'::json
          ) AS permissions,
          json_build_object(
            'id', o.id,
            'name', o.name,
            'slug', o.slug,
            'status', o.status,
            'organizationStatus', o.status,
            'verificationStatus', o.verification_status,
            'rejectionReason', o.rejection_reason,
            'organizationType', o.organization_type
          ) AS org_profile
        FROM organization_members om
        JOIN organizations o ON o.id = om.organization_id AND o.deleted_at IS NULL
        JOIN roles r ON r.id = om.role_id
        WHERE om.user_id = (SELECT id FROM user_data) AND om.status = 'active'
      ),
      sup_mems AS (
        SELECT 
          'supplier' AS tenant_type,
          s.id AS tenant_id,
          s.legal_name AS tenant_name,
          s.status AS sup_status,
          s.verification_status AS sup_verification_status,
          r.id AS role_id,
          r.name AS role_name,
          sm.is_owner,
          sm.status,
          sm.last_active_at,
          sm.created_at,
          COALESCE(
            (SELECT json_agg(p.code)
             FROM role_permissions rp
             JOIN permissions p ON p.id = rp.permission_id
             WHERE rp.role_id = r.id),
            '[]'::json
          ) AS permissions,
          json_build_object(
            'id', s.id,
            'legalName', s.legal_name,
            'tradingName', s.trading_name,
            'cipaUin', s.cipa_uin,
            'email', s.email,
            'primaryPhone', s.primary_phone,
            'status', s.status,
            'supplierStatus', s.status,
            'verificationStatus', s.verification_status,
            'complianceStatus', s.compliance_status,
            'profileCompleteness', s.profile_completeness
          ) AS supplier_profile
        FROM supplier_members sm
        JOIN suppliers s ON s.id = sm.supplier_id AND s.deleted_at IS NULL
        JOIN roles r ON r.id = sm.role_id
        WHERE sm.user_id = (SELECT id FROM user_data) AND sm.status = 'active'
      )
      SELECT 
        (SELECT email_fails FROM rate_limits) AS email_fails,
        (SELECT ip_fails FROM rate_limits) AS ip_fails,
        u.id, u.email, u.password_hash AS "passwordHash", u.full_name AS "fullName",
        u.phone, u.status, u.email_verified_at AS "emailVerifiedAt",
        u.is_platform_admin AS "isPlatformAdmin", u.mfa_enabled AS "mfaEnabled",
        u.mfa_secret_encrypted AS "mfaSecretEncrypted",
        u.failed_login_attempts AS "failedLoginAttempts",
        u.locked_until AS "lockedUntil",
        COALESCE(
          (SELECT json_agg(json_build_object(
            'tenantType', m.tenant_type,
            'tenantId', m.tenant_id,
            'tenantName', m.tenant_name,
            'organizationStatus', m.org_status,
            'verificationStatus', m.org_verification_status,
            'rejectionReason', m.org_rejection_reason,
            'roleId', m.role_id,
            'roleName', m.role_name,
            'isOwner', m.is_owner,
            'status', m.status,
            'lastActiveAt', m.last_active_at,
            'createdAt', m.created_at,
            'permissions', m.permissions,
            'profile', m.org_profile
          )) FROM org_mems m),
          '[]'::json
        ) AS org_memberships,
        COALESCE(
          (SELECT json_agg(json_build_object(
            'tenantType', m.tenant_type,
            'tenantId', m.tenant_id,
            'tenantName', m.tenant_name,
            'supplierStatus', m.sup_status,
            'verificationStatus', m.sup_verification_status,
            'roleId', m.role_id,
            'roleName', m.role_name,
            'isOwner', m.is_owner,
            'status', m.status,
            'lastActiveAt', m.last_active_at,
            'createdAt', m.created_at,
            'permissions', m.permissions,
            'profile', m.supplier_profile
          )) FROM sup_mems m),
          '[]'::json
        ) AS sup_memberships
      FROM (SELECT 1) _
      LEFT JOIN user_data u ON TRUE`,
      [cleanEmail, cleanIp || null]
    );
    const userLookupMs = performance.now() - tLookup0;
    const row = combinedRes.rows[0];
    const emailFails = parseInt(String(row?.email_fails || "0"), 10);
    const ipFails = parseInt(String(row?.ip_fails || "0"), 10);
    if (row?.id && row.lockedUntil && new Date(row.lockedUntil) > /* @__PURE__ */ new Date()) {
      const err = new Error(
        "Your account is temporarily locked due to multiple failed sign-in attempts. Please wait for the lockout period to expire or contact an administrator to unlock it."
      );
      err.status = 423;
      err.code = "ACCOUNT_LOCKED";
      err.lockedUntil = row.lockedUntil;
      throw err;
    }
    if (emailFails >= 5 || ipFails >= 20) {
      runBackgroundTask(
        auditRepository.logEvent({
          actorType: "system",
          actorName: cleanEmail,
          actorRole: "Security Guard",
          action: "lockout",
          entityType: "login_attempt",
          ipAddress: cleanIp,
          details: `Brute force protection triggered: ${emailFails} email failures, ${ipFails} IP failures in 15 minutes.`
        })
      );
      const err = new Error("Too many attempts. Try again in 15 minutes.");
      err.status = 429;
      err.code = "RATE_LIMIT_EXCEEDED";
      throw err;
    }
    if (!row || !row.id || !row.passwordHash || !row.passwordHash.trim()) {
      await verifyPassword(passwordPlain, DUMMY_HASH);
      await this.recordLoginAttempt(cleanEmail, cleanIp, false).catch(() => {
      });
      runBackgroundTask(
        auditRepository.logEvent({
          actorType: "user",
          actorName: cleanEmail,
          actorRole: "Anonymous",
          action: "login.failure",
          entityType: "session",
          ipAddress: cleanIp,
          userAgent,
          details: "Failed login attempt: unknown email or user with no password hash."
        })
      );
      const err = new Error("Email or password is incorrect.");
      err.status = 401;
      err.code = "INVALID_CREDENTIALS";
      throw err;
    }
    const tPass0 = performance.now();
    const isMatch = await verifyPassword(passwordPlain, row.passwordHash);
    const passwordVerifyMs = performance.now() - tPass0;
    if (!isMatch) {
      const [failResult] = await Promise.all([
        usersRepository.recordLoginFailure(row.id).catch(() => ({ failedAttempts: 1, lockedUntil: null })),
        this.recordLoginAttempt(cleanEmail, cleanIp, false).catch(() => {
        })
      ]);
      runBackgroundTask(
        auditRepository.logEvent({
          actorType: "user",
          actorUserId: row.id,
          actorName: row.fullName || cleanEmail,
          actorRole: row.isPlatformAdmin ? "Super Admin" : "User",
          action: failResult.lockedUntil ? "account.locked" : "login.failure",
          entityType: "session",
          ipAddress: cleanIp,
          userAgent,
          details: failResult.lockedUntil ? `Account locked after ${failResult.failedAttempts} consecutive failed sign-in attempts.` : `Failed login attempt (${failResult.failedAttempts}/5): incorrect password.`
        })
      );
      if (failResult.lockedUntil) {
        const err2 = new Error(
          "Your account has been temporarily locked after 5 failed sign-in attempts. Please wait 15 minutes or contact an administrator to unlock it."
        );
        err2.status = 423;
        err2.code = "ACCOUNT_LOCKED";
        err2.lockedUntil = failResult.lockedUntil;
        throw err2;
      }
      const err = new Error("Email or password is incorrect.");
      err.status = 401;
      err.code = "INVALID_CREDENTIALS";
      throw err;
    }
    if (row.status === "pending" || !row.emailVerifiedAt) {
      runBackgroundTask(this.recordLoginAttempt(cleanEmail, cleanIp, false));
      const err = new Error("Verify your email first");
      err.status = 403;
      err.code = "EMAIL_NOT_VERIFIED";
      err.email = cleanEmail;
      throw err;
    }
    if (row.status !== "active") {
      runBackgroundTask(this.recordLoginAttempt(cleanEmail, cleanIp, false));
      const err = new Error("This account has been deactivated. Please contact support.");
      err.status = 403;
      err.code = "ACCOUNT_DISABLED";
      throw err;
    }
    if (row.mfaEnabled && row.mfaSecretEncrypted) {
      return {
        requiresMfa: true,
        mfaUserId: row.id
      };
    }
    const memberships = [
      ...row.org_memberships || [],
      ...row.sup_memberships || []
    ];
    let tenantType = null;
    let tenantId = null;
    let activeTenant;
    let profileSummary = null;
    if (row.isPlatformAdmin) {
      tenantType = "platform";
      tenantId = null;
      activeTenant = {
        tenantType: "organization",
        tenantId: "platform",
        tenantName: "Platform Administration",
        roleId: "role-platform-admin",
        roleName: "Super Admin",
        isOwner: true,
        status: "active",
        permissions: ["*"]
      };
    } else if (memberships.length > 0) {
      activeTenant = resolveDeterministicTenant(memberships, null);
      if (activeTenant) {
        tenantType = activeTenant.tenantType;
        tenantId = activeTenant.tenantId;
        profileSummary = activeTenant.profile || null;
      }
    }
    const rawToken = generateRandomToken(32);
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1e3);
    const tSess0 = performance.now();
    await query(
      `INSERT INTO sessions (user_id, token_hash, tenant_type, tenant_id, ip, user_agent, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [row.id, tokenHash, tenantType, tenantId, cleanIp || null, userAgent || null, expiresAt]
    );
    const sessionInsertMs = performance.now() - tSess0;
    runBackgroundTask(
      Promise.all([
        this.recordLoginAttempt(cleanEmail, cleanIp, true),
        usersRepository.recordLoginSuccess(row.id, cleanIp),
        auditRepository.logEvent({
          actorType: "user",
          actorUserId: row.id,
          actorName: row.fullName || cleanEmail,
          actorRole: activeTenant?.roleName || (row.isPlatformAdmin ? "Super Admin" : "User"),
          organizationId: tenantType === "organization" ? tenantId || void 0 : void 0,
          supplierId: tenantType === "supplier" ? tenantId || void 0 : void 0,
          action: "login.success",
          entityType: "session",
          ipAddress: cleanIp,
          userAgent,
          details: "User authenticated successfully. Active tenant established."
        }),
        // Clean up attempts older than 24h in background
        query(`DELETE FROM login_attempts WHERE attempted_at < NOW() - INTERVAL '24 hours'`)
      ])
    );
    const totalMs = Math.round(performance.now() - t0);
    const timingData = {
      coldStart: wasCold,
      dbConnectMs: 0,
      userLookupMs: Math.round(userLookupMs),
      passwordVerifyMs: Math.round(passwordVerifyMs),
      sessionInsertMs: Math.round(sessionInsertMs),
      auditWriteMs: 0,
      // moved off critical path!
      totalMs
    };
    if (process.env.DEBUG_TIMING === "true" || process.env.NODE_ENV !== "production") {
      console.log(
        `[AUTH_TIMING] coldStart=${timingData.coldStart} dbConnect=${timingData.dbConnectMs}ms userLookup=${timingData.userLookupMs}ms passwordVerify=${timingData.passwordVerifyMs}ms sessionInsert=${timingData.sessionInsertMs}ms auditWrite=${timingData.auditWriteMs}ms response=${timingData.totalMs}ms`
      );
    }
    return {
      token: rawToken,
      user: {
        id: row.id,
        email: row.email || cleanEmail,
        fullName: row.fullName || "",
        phone: row.phone,
        isPlatformAdmin: Boolean(row.isPlatformAdmin),
        memberships
      },
      activeTenant,
      profileSummary,
      timing: timingData
    };
  }
  /**
   * Complete MFA verification with 6-digit TOTP code and issue session token.
   */
  async verifyMfa(userId, totpCode, ip, userAgent) {
    const user = await usersRepository.findById(userId);
    if (!user || !user.mfaSecretEncrypted) {
      const err = new Error("Invalid MFA session.");
      err.status = 400;
      throw err;
    }
    const secretHex = decryptData(user.mfaSecretEncrypted);
    const isValid = verifyTotpCode(secretHex, totpCode);
    if (!isValid) {
      await this.recordLoginAttempt(user.email, sanitizeIp(ip), false);
      const err = new Error("Invalid or expired MFA verification code. Please check your authenticator.");
      err.status = 401;
      throw err;
    }
    const cleanIp = sanitizeIp(ip);
    await this.recordLoginAttempt(user.email, cleanIp, true);
    await usersRepository.recordLoginSuccess(user.id, cleanIp);
    const memberships = await usersRepository.getUserMemberships(user.id);
    let tenantType = null;
    let tenantId = null;
    let activeTenant;
    if (user.isPlatformAdmin) {
      tenantType = "platform";
      activeTenant = {
        tenantType: "organization",
        tenantId: "platform",
        tenantName: "Platform Administration",
        roleId: "role-platform-admin",
        roleName: "Super Admin",
        isOwner: true,
        status: "active",
        permissions: ["*"]
      };
    } else if (memberships.length > 0) {
      activeTenant = memberships[0];
      tenantType = activeTenant.tenantType;
      tenantId = activeTenant.tenantId;
    }
    const rawToken = generateRandomToken(32);
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1e3);
    await query(
      `INSERT INTO sessions (user_id, token_hash, tenant_type, tenant_id, ip, user_agent, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [user.id, tokenHash, tenantType, tenantId, cleanIp || null, userAgent || null, expiresAt]
    );
    await auditRepository.logEvent({
      actorType: "user",
      actorUserId: user.id,
      actorName: user.fullName || user.email,
      actorRole: activeTenant?.roleName || "User",
      action: "login.mfa.success",
      entityType: "session",
      ipAddress: cleanIp,
      userAgent,
      details: "MFA verified and session issued."
    }).catch(() => {
    });
    return {
      token: rawToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        isPlatformAdmin: user.isPlatformAdmin,
        memberships
      },
      activeTenant
    };
  }
  /**
   * Switch active tenant workspace for an authenticated session.
   */
  async switchTenant(rawToken, targetTenantId, targetTenantType) {
    const tokenHash = hashToken(rawToken);
    const sessRes = await query(
      `SELECT id, user_id
       FROM sessions
       WHERE token_hash = $1 AND expires_at > NOW() AND revoked_at IS NULL
       LIMIT 1`,
      [tokenHash]
    );
    if (sessRes.rows.length === 0) {
      const err = new Error("Session is invalid or expired.");
      err.status = 401;
      throw err;
    }
    const sess = sessRes.rows[0];
    const memberships = await usersRepository.getUserMemberships(sess.user_id);
    const target = memberships.find((m) => m.tenantId === targetTenantId && m.tenantType === targetTenantType);
    if (!target) {
      const err = new Error("You do not belong to the selected workspace.");
      err.status = 403;
      throw err;
    }
    await query(
      `UPDATE sessions
       SET tenant_type = $1, tenant_id = $2
       WHERE id = $3`,
      [targetTenantType, targetTenantId, sess.id]
    );
    return target;
  }
  /**
   * Revoke session on logout.
   */
  async logout(rawToken, ip, userAgent) {
    if (!rawToken || !rawToken.trim()) return;
    const tokenHash = hashToken(rawToken);
    const revoked = await query(
      `UPDATE sessions
       SET revoked_at = NOW()
       WHERE token_hash = $1 AND revoked_at IS NULL
       RETURNING user_id, tenant_type, tenant_id`,
      [tokenHash]
    );
    if (revoked.rows[0]) {
      const row = revoked.rows[0];
      await auditRepository.logEvent({
        actorType: "user",
        actorUserId: row.user_id,
        actorName: "Authenticated User",
        actorRole: "User",
        action: "logout",
        entityType: "session",
        ipAddress: sanitizeIp(ip),
        userAgent,
        details: "User logged out and session revoked."
      }).catch(() => {
      });
    }
  }
  /**
   * Supplier registration:
   * - Enforces password rules: 10-128 chars, != email, rejects common list
   * - Sets user status to 'pending'
   * - Generates single-use 24-hour verification token stored hashed in auth_tokens
   */
  async registerSupplier(dto) {
    const cleanEmail = dto.email.trim().toLowerCase();
    const cleanIp = sanitizeIp(dto.ip);
    const passCheck = validatePassword(dto.password, cleanEmail);
    if (!passCheck.isValid) {
      const err = new Error(passCheck.error || "Password does not meet security requirements.");
      err.status = 400;
      err.code = "WEAK_PASSWORD";
      throw err;
    }
    const existing = await query(`SELECT id FROM users WHERE LOWER(email::text) = LOWER($1) AND deleted_at IS NULL LIMIT 1`, [cleanEmail]);
    if (existing.rows.length > 0) {
      const err = new Error("An account with this email address already exists. Please sign in.");
      err.status = 400;
      err.code = "EMAIL_ALREADY_EXISTS";
      throw err;
    }
    const passwordHash = await hashPassword(dto.password);
    const userRes = await query(
      `INSERT INTO users (email, password_hash, full_name, phone, status, email_verified_at)
       VALUES ($1, $2, $3, $4, 'pending', NULL)
       RETURNING id, email`,
      [cleanEmail, passwordHash, dto.fullName.trim(), dto.phone || null]
    );
    const userId = userRes.rows[0].id;
    const supRes = await query(
      `INSERT INTO suppliers (
         legal_name, trading_name, cipa_uin, email, primary_phone, city, country_code,
         status, verification_status, compliance_status, profile_completeness
       ) VALUES (
         $1, $1, $2, $3, $4, 'Gaborone', 'BW',
         'active', 'unverified', 'Action required', 30
       ) RETURNING id`,
      [dto.legalName.trim(), dto.cipaUin.trim().toUpperCase(), cleanEmail, dto.phone || null]
    );
    const supplierId = supRes.rows[0].id;
    const roleRes = await query(
      `SELECT id FROM roles WHERE scope = 'supplier' AND name = 'Supplier Admin' LIMIT 1`
    );
    const roleId = roleRes.rows[0]?.id;
    if (roleId) {
      await query(
        `INSERT INTO supplier_members (supplier_id, user_id, role_id, is_owner, status, joined_at)
         VALUES ($1, $2, $3, TRUE, 'active', NOW())
         ON CONFLICT (supplier_id, user_id) DO NOTHING`,
        [supplierId, userId, roleId]
      );
    }
    const rawVerifyToken = generateRandomToken(32);
    const tokenHash = hashToken(rawVerifyToken);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1e3);
    await query(
      `INSERT INTO auth_tokens (user_id, purpose, token_hash, expires_at)
       VALUES ($1, 'email_verify', $2, $3)`,
      [userId, tokenHash, expiresAt]
    );
    await auditRepository.logEvent({
      actorType: "user",
      actorUserId: userId,
      actorName: dto.fullName.trim(),
      actorRole: "Supplier Admin",
      supplierId,
      action: "supplier.register",
      entityType: "user",
      entityId: userId,
      ipAddress: cleanIp,
      userAgent: dto.userAgent,
      details: "New supplier company registered. Verification email sent."
    }).catch(() => {
    });
    return {
      success: true,
      message: "Account created. Please verify your email before logging in.",
      email: cleanEmail,
      verificationToken: rawVerifyToken
    };
  }
  /**
   * Buyer organization registration:
   * - Enforces password rules
   * - Creates user with status 'pending'
   * - Creates buyer organization with status 'pending'
   * - Issues single-use 24-hour verification token
   */
  async registerOrganization(dto) {
    const cleanEmail = dto.email.trim().toLowerCase();
    const cleanIp = sanitizeIp(dto.ip);
    const passCheck = validatePassword(dto.password, cleanEmail);
    if (!passCheck.isValid) {
      const err = new Error(passCheck.error || "Password does not meet security requirements.");
      err.status = 400;
      err.code = "WEAK_PASSWORD";
      throw err;
    }
    const existing = await query(`SELECT id FROM users WHERE LOWER(email::text) = LOWER($1) AND deleted_at IS NULL LIMIT 1`, [cleanEmail]);
    if (existing.rows.length > 0) {
      const err = new Error("An account with this email address already exists. Please sign in.");
      err.status = 400;
      err.code = "EMAIL_ALREADY_EXISTS";
      throw err;
    }
    const passwordHash = await hashPassword(dto.password);
    const userRes = await query(
      `INSERT INTO users (email, password_hash, full_name, phone, status, email_verified_at)
       VALUES ($1, $2, $3, $4, 'pending', NULL)
       RETURNING id`,
      [cleanEmail, passwordHash, dto.fullName.trim(), dto.phone || null]
    );
    const userId = userRes.rows[0].id;
    const baseSlug = "org-" + dto.organizationName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const orgSlug = `${baseSlug}-${Math.floor(1e3 + Math.random() * 9e3)}`;
    const orgRes = await query(
      `INSERT INTO organizations (
         name, slug, organization_type, contact_email, contact_phone, status, verification_status
       ) VALUES (
         $1, $2, $3, $4, $5, 'pending', 'pending_review'
       ) RETURNING id`,
      [dto.organizationName.trim(), orgSlug, dto.organizationType || "parastatal", cleanEmail, dto.phone || null]
    );
    const orgId = orgRes.rows[0].id;
    const roleRes = await query(
      `SELECT id FROM roles
       WHERE scope = 'organization' AND name IN ('Org Admin', 'Buyer Admin')
       ORDER BY CASE WHEN name = 'Org Admin' THEN 0 ELSE 1 END
       LIMIT 1`
    );
    const roleId = roleRes.rows[0]?.id;
    if (roleId) {
      await query(
        `INSERT INTO organization_members (organization_id, user_id, role_id, is_owner, status, joined_at)
         VALUES ($1, $2, $3, TRUE, 'active', NOW())
         ON CONFLICT (organization_id, user_id) DO NOTHING`,
        [orgId, userId, roleId]
      );
    }
    const rawVerifyToken = generateRandomToken(32);
    const tokenHash = hashToken(rawVerifyToken);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1e3);
    await query(
      `INSERT INTO auth_tokens (user_id, purpose, token_hash, expires_at)
       VALUES ($1, 'email_verify', $2, $3)`,
      [userId, tokenHash, expiresAt]
    );
    await auditRepository.logEvent({
      actorType: "user",
      actorUserId: userId,
      actorName: dto.fullName.trim(),
      actorRole: "Buyer Admin",
      organizationId: orgId,
      action: "organization.register",
      entityType: "organization",
      entityId: orgId,
      ipAddress: cleanIp,
      userAgent: dto.userAgent,
      details: "New procuring entity registered with pending status. Verification email sent."
    }).catch(() => {
    });
    return {
      success: true,
      message: "Procuring entity registration submitted. Please verify your email before signing in.",
      email: cleanEmail,
      verificationToken: rawVerifyToken
    };
  }
  /**
   * Verify email using single-use 24-hour verification token.
   * Sets user status to 'active' and marks token as used.
   */
  async verifyEmailWithToken(token, ip, userAgent) {
    if (!token || !token.trim()) {
      const err = new Error("Verification token is required.");
      err.status = 400;
      throw err;
    }
    const tokenHash = hashToken(token);
    const tokenRes = await query(
      `SELECT id, user_id, expires_at, used_at
       FROM auth_tokens
       WHERE token_hash = $1 AND purpose = 'email_verify'
       LIMIT 1`,
      [tokenHash]
    );
    const row = tokenRes.rows[0];
    if (!row || row.used_at !== null || new Date(row.expires_at) < /* @__PURE__ */ new Date()) {
      const err = new Error("Verification link is invalid or has expired.");
      err.status = 400;
      err.code = "INVALID_TOKEN";
      throw err;
    }
    await query(`UPDATE auth_tokens SET used_at = NOW() WHERE id = $1`, [row.id]);
    const userRes = await query(
      `UPDATE users
       SET status = 'active', email_verified_at = NOW(), updated_at = NOW()
       WHERE id = $1
       RETURNING id, email, full_name`,
      [row.user_id]
    );
    const user = userRes.rows[0];
    await auditRepository.logEvent({
      actorType: "user",
      actorUserId: user?.id,
      actorName: user?.full_name || user?.email || "User",
      actorRole: "User",
      action: "email.verified",
      entityType: "user",
      entityId: user?.id,
      ipAddress: sanitizeIp(ip),
      userAgent,
      details: "User email address verified successfully."
    }).catch(() => {
    });
    return {
      success: true,
      message: "Email verified successfully. You may now sign in."
    };
  }
  /**
   * Resend email verification link (rate limited: max 3 attempts per 15 minutes per email).
   */
  async resendVerification(email, ip, userAgent) {
    const cleanEmail = email.trim().toLowerCase();
    const cleanIp = sanitizeIp(ip);
    const countRes = await query(
      `SELECT COUNT(*)::text AS count
       FROM auth_tokens at
       JOIN users u ON u.id = at.user_id
       WHERE LOWER(u.email::text) = LOWER($1)
         AND at.purpose = 'email_verify'
         AND at.created_at > NOW() - INTERVAL '15 minutes'`,
      [cleanEmail]
    );
    if (parseInt(countRes.rows[0]?.count || "0", 10) >= 5) {
      const err = new Error("Too many verification requests. Please try again in 15 minutes.");
      err.status = 429;
      err.code = "RATE_LIMIT_EXCEEDED";
      throw err;
    }
    const userRes = await query(
      `SELECT id, email, email_verified_at FROM users WHERE LOWER(email::text) = LOWER($1) AND deleted_at IS NULL LIMIT 1`,
      [cleanEmail]
    );
    const user = userRes.rows[0];
    let rawToken;
    if (user && !user.email_verified_at) {
      await query(
        `UPDATE auth_tokens SET used_at = NOW() WHERE user_id = $1 AND purpose = 'email_verify' AND used_at IS NULL`,
        [user.id]
      );
      rawToken = generateRandomToken(32);
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1e3);
      await query(
        `INSERT INTO auth_tokens (user_id, purpose, token_hash, expires_at)
         VALUES ($1, 'email_verify', $2, $3)`,
        [user.id, tokenHash, expiresAt]
      );
      await auditRepository.logEvent({
        actorType: "user",
        actorUserId: user.id,
        actorName: cleanEmail,
        actorRole: "User",
        action: "verification.resent",
        entityType: "auth_token",
        ipAddress: cleanIp,
        userAgent,
        details: "Verification email re-sent upon request."
      }).catch(() => {
      });
    }
    return {
      success: true,
      message: "If an unverified account exists for this email, a verification link has been sent.",
      token: rawToken
    };
  }
  /**
   * Request password reset link (single-use 1-hour token).
   * Always returns the same neutral message: "If that email is registered, we sent a link."
   */
  async forgotPassword(email, ip, userAgent) {
    const cleanEmail = email.trim().toLowerCase();
    const cleanIp = sanitizeIp(ip);
    const ipCheck = await query(
      `SELECT COUNT(*)::text AS count
       FROM audit_log
       WHERE action = 'password_reset.requested'
         AND ip_address = $1
         AND occurred_at > NOW() - INTERVAL '15 minutes'`,
      [cleanIp]
    );
    if (parseInt(ipCheck.rows[0]?.count || "0", 10) >= 5) {
      const err = new Error("Too many requests. Please try again in 15 minutes.");
      err.status = 429;
      err.code = "RATE_LIMIT_EXCEEDED";
      throw err;
    }
    const userRes = await query(
      `SELECT id, email, full_name, status FROM users WHERE LOWER(email::text) = LOWER($1) AND deleted_at IS NULL LIMIT 1`,
      [cleanEmail]
    );
    const user = userRes.rows[0];
    let rawToken;
    if (user && user.status === "active") {
      await query(
        `UPDATE auth_tokens SET used_at = NOW() WHERE user_id = $1 AND purpose = 'password_reset' AND used_at IS NULL`,
        [user.id]
      );
      rawToken = generateRandomToken(32);
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1e3);
      await query(
        `INSERT INTO auth_tokens (user_id, purpose, token_hash, expires_at)
         VALUES ($1, 'password_reset', $2, $3)`,
        [user.id, tokenHash, expiresAt]
      );
      await auditRepository.logEvent({
        actorType: "user",
        actorUserId: user.id,
        actorName: user.full_name || cleanEmail,
        actorRole: "User",
        action: "password_reset.requested",
        entityType: "auth_token",
        ipAddress: cleanIp,
        userAgent,
        details: "Password reset link requested."
      }).catch(() => {
      });
    }
    return {
      success: true,
      message: "If that email is registered, we sent a link.",
      token: rawToken
    };
  }
  /**
   * Reset password with single-use token:
   * - Validates password rules: 10-128 chars, != email, rejects common passwords
   * - Sets new password hash (bcrypt cost 12)
   * - Revokes ALL active sessions for that user
   */
  async resetPassword(token, newPasswordPlain, ip, userAgent) {
    if (!token || !token.trim()) {
      const err = new Error("Reset token is required.");
      err.status = 400;
      throw err;
    }
    const tokenHash = hashToken(token);
    const tokenRes = await query(
      `SELECT id, user_id, expires_at, used_at
       FROM auth_tokens
       WHERE token_hash = $1 AND purpose = 'password_reset'
       LIMIT 1`,
      [tokenHash]
    );
    const row = tokenRes.rows[0];
    if (!row || row.used_at !== null || new Date(row.expires_at) < /* @__PURE__ */ new Date()) {
      const err = new Error("Password reset link is invalid or has expired.");
      err.status = 400;
      err.code = "INVALID_RESET_TOKEN";
      throw err;
    }
    const userRes = await query(
      `SELECT id, email, full_name FROM users WHERE id = $1`,
      [row.user_id]
    );
    const user = userRes.rows[0];
    const passCheck = validatePassword(newPasswordPlain, user?.email);
    if (!passCheck.isValid) {
      const err = new Error(passCheck.error || "Password does not meet security requirements.");
      err.status = 400;
      err.code = "WEAK_PASSWORD";
      throw err;
    }
    await query(`UPDATE auth_tokens SET used_at = NOW() WHERE id = $1`, [row.id]);
    const newHash = await hashPassword(newPasswordPlain);
    await query(
      `UPDATE users
       SET password_hash = $1, failed_login_attempts = 0, locked_until = NULL, updated_at = NOW()
       WHERE id = $2`,
      [newHash, row.user_id]
    );
    await query(
      `UPDATE sessions
       SET revoked_at = NOW()
       WHERE user_id = $1 AND revoked_at IS NULL`,
      [row.user_id]
    );
    await auditRepository.logEvent({
      actorType: "user",
      actorUserId: row.user_id,
      actorName: user?.full_name || user?.email || "User",
      actorRole: "User",
      action: "password_reset.done",
      entityType: "user",
      entityId: row.user_id,
      ipAddress: sanitizeIp(ip),
      userAgent,
      details: "Password was reset successfully. All active sessions revoked."
    }).catch(() => {
    });
    return {
      success: true,
      message: "Password reset successfully. Please sign in with your new password."
    };
  }
  /**
   * Save incremental supplier registration progress (Step 1, Step 2, or Step 3).
   */
  async saveSupplierRegistrationStep(dto) {
    const cleanEmail = dto.email.trim().toLowerCase();
    if (!cleanEmail) {
      throw new Error("Email address is required.");
    }
    if (dto.step === 1) {
      if (!dto.fullName?.trim()) {
        throw new Error("Full name is required for Step 1.");
      }
      let user = await usersRepository.findByEmail(cleanEmail);
      let userId;
      if (!user) {
        if (!dto.password) {
          throw new Error("Password is required.");
        }
        const passCheck = validatePassword(dto.password, cleanEmail);
        if (!passCheck.isValid) {
          throw new Error(passCheck.error || "Password does not meet requirements.");
        }
        const passwordHash = await hashPassword(dto.password);
        const userRes = await query(
          `INSERT INTO users (email, password_hash, full_name, phone, status, email_verified_at)
           VALUES ($1, $2, $3, $4, 'pending', NULL)
           RETURNING id, email, full_name AS "fullName", is_platform_admin AS "isPlatformAdmin"`,
          [cleanEmail, passwordHash, dto.fullName.trim(), dto.phone || null]
        );
        user = userRes.rows[0];
        userId = userRes.rows[0].id;
      } else {
        userId = user.id;
        const updateParams = [dto.fullName.trim(), dto.phone || null, userId];
        let passwordUpdateClause = "";
        if (dto.password) {
          const passCheck = validatePassword(dto.password, cleanEmail);
          if (!passCheck.isValid) {
            throw new Error(passCheck.error || "Password does not meet requirements.");
          }
          const newHash = await hashPassword(dto.password);
          updateParams.push(newHash);
          passwordUpdateClause = `, password_hash = $${updateParams.length}`;
        }
        await query(
          `UPDATE users SET full_name = $1, phone = $2, updated_at = NOW() ${passwordUpdateClause} WHERE id = $3`,
          updateParams
        );
      }
      let supplierId;
      let supplierData;
      const supRes = await query(
        `SELECT id, legal_name, trading_name, cipa_uin, company_type, city, email, primary_phone, profile_completeness
         FROM suppliers
         WHERE LOWER(email::text) = LOWER($1) AND deleted_at IS NULL
         LIMIT 1`,
        [cleanEmail]
      );
      if (supRes.rows.length > 0) {
        supplierId = supRes.rows[0].id;
        supplierData = supRes.rows[0];
        await query(
          `UPDATE suppliers SET primary_phone = COALESCE($1, primary_phone), updated_at = NOW() WHERE id = $2`,
          [dto.phone || null, supplierId]
        );
      } else {
        const defaultLegalName = dto.legalName?.trim() || `${dto.fullName.trim()}'s Enterprise`;
        const tempCipa = dto.cipaUin?.trim().toUpperCase() || "BW-TEMP-" + Math.floor(1e7 + Math.random() * 9e7);
        const insertSup = await query(
          `INSERT INTO suppliers (
             legal_name, trading_name, cipa_uin, email, primary_phone, city, country_code,
             status, verification_status, compliance_status, profile_completeness
           ) VALUES (
             $1, $1, $2, $3, $4, 'Gaborone', 'BW',
             'active', 'unverified', 'Action required', 25
           ) RETURNING id, legal_name, trading_name, cipa_uin, company_type, city, email, primary_phone, profile_completeness`,
          [defaultLegalName, tempCipa, cleanEmail, dto.phone || null]
        );
        supplierId = insertSup.rows[0].id;
        supplierData = insertSup.rows[0];
      }
      const roleRes = await query(
        `SELECT id FROM roles WHERE scope = 'supplier' AND name = 'Supplier Admin' LIMIT 1`
      );
      const roleId = roleRes.rows[0]?.id;
      if (roleId && supplierId && userId) {
        await query(
          `INSERT INTO supplier_members (supplier_id, user_id, role_id, is_owner, status, joined_at)
           VALUES ($1, $2, $3, TRUE, 'active', NOW())
           ON CONFLICT (supplier_id, user_id) DO UPDATE SET status = 'active'`,
          [supplierId, userId, roleId]
        );
      }
      return {
        step: 1,
        nextStep: 2,
        user: { id: userId, email: cleanEmail, fullName: dto.fullName.trim() },
        supplier: supplierData
      };
    }
    if (dto.step === 2) {
      if (!dto.legalName?.trim()) {
        throw new Error("Registered company name is required for Step 2.");
      }
      if (!dto.cipaUin?.trim()) {
        throw new Error("CIPA certificate number is required for Step 2.");
      }
      const supRes = await query(
        `UPDATE suppliers
         SET legal_name = $1,
             trading_name = COALESCE($1, trading_name),
             cipa_uin = $2,
             company_type = COALESCE($3, company_type),
             city = COALESCE($4, city),
             profile_completeness = GREATEST(profile_completeness, 50),
             updated_at = NOW()
         WHERE LOWER(email::text) = LOWER($5) AND deleted_at IS NULL
         RETURNING id, legal_name, trading_name, cipa_uin, company_type, city, email, primary_phone, profile_completeness`,
        [dto.legalName.trim(), dto.cipaUin.trim().toUpperCase(), dto.companyType || "private_company", dto.city || "Gaborone", cleanEmail]
      );
      return {
        step: 2,
        nextStep: 3,
        supplier: supRes.rows[0]
      };
    }
    if (dto.step === 3) {
      if (!dto.agreedToTerms || !dto.agreedToPrivacy) {
        throw new Error("You must accept the BidReady360 Terms of Service and Privacy Policy to activate your account.");
      }
      const supRes = await query(
        `UPDATE suppliers
         SET profile_completeness = GREATEST(profile_completeness, 75),
             updated_at = NOW()
         WHERE LOWER(email::text) = LOWER($1) AND deleted_at IS NULL
         RETURNING id, legal_name, cipa_uin, email, profile_completeness`,
        [cleanEmail]
      );
      const supplier = supRes.rows[0];
      const user = await usersRepository.findByEmail(cleanEmail);
      if (user) {
        const rawVerifyToken = generateRandomToken(32);
        const tokenHash = hashToken(rawVerifyToken);
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1e3);
        await query(
          `INSERT INTO auth_tokens (user_id, purpose, token_hash, expires_at)
           VALUES ($1, 'email_verify', $2, $3)`,
          [user.id, tokenHash, expiresAt]
        );
        return {
          step: 3,
          nextStep: 3,
          completed: true,
          supplier,
          token: rawVerifyToken
        };
      }
      return {
        step: 3,
        nextStep: 3,
        completed: true,
        supplier
      };
    }
    throw new Error(`Unsupported registration step: ${dto.step}`);
  }
  /**
   * Check supplier registration progress.
   */
  async getSupplierRegistrationProgress(email) {
    const cleanEmail = email.trim().toLowerCase();
    const supRes = await query(
      `SELECT s.id, s.legal_name, s.cipa_uin, s.company_type, s.city, s.email, s.primary_phone,
              u.full_name
       FROM suppliers s
       LEFT JOIN supplier_members sm ON sm.supplier_id = s.id AND sm.is_owner = TRUE
       LEFT JOIN users u ON u.id = sm.user_id
       WHERE LOWER(s.email::text) = LOWER($1) AND s.deleted_at IS NULL
       LIMIT 1`,
      [cleanEmail]
    );
    if (supRes.rows.length === 0) {
      return { found: false };
    }
    const sup = supRes.rows[0];
    let step = 1;
    if (sup.legal_name && sup.cipa_uin && !sup.cipa_uin.startsWith("BW-TEMP-")) {
      step = 3;
    } else if (sup.legal_name) {
      step = 2;
    }
    return {
      found: true,
      step,
      email: sup.email,
      fullName: sup.full_name || "",
      phone: sup.primary_phone || "",
      legalName: sup.legal_name?.includes("'s Enterprise") ? "" : sup.legal_name,
      cipaUin: sup.cipa_uin?.startsWith("BW-TEMP-") ? "" : sup.cipa_uin,
      companyType: sup.company_type || "",
      city: sup.city || ""
    };
  }
  /**
   * Generate new TOTP setup secret for enrollment.
   */
  async setupMfaEnrollment(userId) {
    const user = await usersRepository.findById(userId);
    if (!user) throw new Error("User not found.");
    const secretHex = generateTotpSecret();
    const encryptedSecret = encryptData(secretHex);
    await usersRepository.saveMfaSecret(userId, encryptedSecret, "authenticator");
    const issuer = "BidReady360";
    const otpAuthUrl = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(user.email)}?secret=${secretHex}&issuer=${encodeURIComponent(issuer)}`;
    return { secret: secretHex, otpAuthUrl };
  }
  /**
   * Confirm enrollment with first valid code and activate MFA on account.
   */
  async confirmMfaEnrollment(userId, code) {
    const user = await usersRepository.findById(userId);
    if (!user || !user.mfaSecretEncrypted) throw new Error("MFA setup not initialized.");
    const secretHex = decryptData(user.mfaSecretEncrypted);
    if (!verifyTotpCode(secretHex, code)) {
      throw new Error("Verification code does not match. Please verify your clock and try again.");
    }
    await usersRepository.enableMfa(userId);
  }
  /**
   * Look up a pending organization or supplier invitation by raw token.
   */
  async getInvitationByToken(token) {
    if (!token || !token.trim()) {
      const err = new Error("Invitation token is required.");
      err.status = 400;
      throw err;
    }
    const tokenHash = hashToken(token);
    const res = await query(
      `SELECT i.id, i.email::text AS email, i.organization_id, i.supplier_id,
              o.name AS org_name, s.legal_name AS sup_name, r.name AS role_name,
              u.full_name AS invited_by_name, i.department, i.job_title,
              i.expires_at, i.accepted_at, i.revoked_at
       FROM invitations i
       JOIN roles r ON r.id = i.role_id
       LEFT JOIN organizations o ON o.id = i.organization_id
       LEFT JOIN suppliers s ON s.id = i.supplier_id
       LEFT JOIN users u ON u.id = i.invited_by_user_id
       WHERE i.token_hash = $1
       LIMIT 1`,
      [tokenHash]
    );
    const row = res.rows[0];
    if (!row || row.revoked_at !== null || row.accepted_at !== null || new Date(row.expires_at) < /* @__PURE__ */ new Date()) {
      const err = new Error("This invitation link is invalid, revoked, or has expired.");
      err.status = 404;
      err.code = "INVALID_INVITATION";
      throw err;
    }
    return {
      id: row.id,
      email: row.email,
      tenantType: row.organization_id ? "organization" : "supplier",
      tenantName: row.org_name || row.sup_name || "BidReady360 Workspace",
      roleName: row.role_name,
      invitedByName: row.invited_by_name || "Workspace Administrator",
      department: row.department,
      jobTitle: row.job_title,
      expiresAt: new Date(row.expires_at).toISOString()
    };
  }
  /**
   * Accept an organization or supplier invitation, activate account & membership, and create a session.
   */
  async acceptInvitation(dto) {
    if (!dto.token || !dto.token.trim()) {
      const err = new Error("Invitation token is required.");
      err.status = 400;
      throw err;
    }
    const tokenHash = hashToken(dto.token);
    const cleanIp = sanitizeIp(dto.ip);
    const invRes = await query(
      `SELECT id, email::text AS email, organization_id, supplier_id, role_id,
              department, job_title, approval_limit_bwp, invited_by_user_id, expires_at, accepted_at, revoked_at
       FROM invitations
       WHERE token_hash = $1
       LIMIT 1`,
      [tokenHash]
    );
    const inv = invRes.rows[0];
    if (!inv || inv.revoked_at !== null || inv.accepted_at !== null || new Date(inv.expires_at) < /* @__PURE__ */ new Date()) {
      const err = new Error("This invitation link is invalid, revoked, or has expired.");
      err.status = 400;
      err.code = "INVALID_INVITATION";
      throw err;
    }
    const cleanEmail = inv.email.trim().toLowerCase();
    const existing = await usersRepository.findByEmail(cleanEmail);
    let userId;
    let userFullName = dto.fullName?.trim() || cleanEmail.split("@")[0];
    if (!existing) {
      const passCheck = validatePassword(dto.password, cleanEmail);
      if (!passCheck.isValid) {
        const err = new Error(passCheck.error || "Password does not meet security requirements.");
        err.status = 400;
        err.code = "WEAK_PASSWORD";
        throw err;
      }
      const passwordHash = await hashPassword(dto.password);
      const userRes = await query(
        `INSERT INTO users (email, password_hash, full_name, status, email_verified_at)
         VALUES ($1, $2, $3, 'active', NOW())
         RETURNING id, full_name`,
        [cleanEmail, passwordHash, userFullName]
      );
      userId = userRes.rows[0].id;
      userFullName = userRes.rows[0].full_name;
    } else {
      userId = existing.id;
      userFullName = existing.fullName || userFullName;
      if (existing.status === "active") {
        if (!existing.passwordHash) {
          const err = new Error("An account already exists for this email without password login enabled.");
          err.status = 401;
          err.code = "INVALID_CREDENTIALS";
          throw err;
        }
        const match = await verifyPassword(dto.password, existing.passwordHash);
        if (!match) {
          const err = new Error("An account already exists for this email. Enter your existing password to accept this invitation.");
          err.status = 401;
          err.code = "INVALID_CREDENTIALS";
          throw err;
        }
      } else {
        const passCheck = validatePassword(dto.password, cleanEmail);
        if (!passCheck.isValid) {
          const err = new Error(passCheck.error || "Password does not meet security requirements.");
          err.status = 400;
          err.code = "WEAK_PASSWORD";
          throw err;
        }
        const passwordHash = await hashPassword(dto.password);
        await query(
          `UPDATE users
           SET password_hash = $1, full_name = COALESCE($2, full_name), status = 'active',
               email_verified_at = COALESCE(email_verified_at, NOW()), updated_at = NOW()
           WHERE id = $3`,
          [passwordHash, dto.fullName?.trim() || null, userId]
        );
      }
    }
    if (inv.organization_id) {
      const hasLimitRes = await query(
        `SELECT EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'organization_members' AND column_name = 'approval_limit_bwp'
         ) AS exists`
      ).catch(() => ({ rows: [{ exists: false }] }));
      if (hasLimitRes.rows[0]?.exists) {
        await query(
          `INSERT INTO organization_members (
             organization_id, user_id, role_id, is_owner, status, department, job_title,
             approval_limit_bwp, mfa_enforced, invited_by_user_id, invited_at, joined_at
           ) VALUES ($1, $2, $3, FALSE, 'active', $4, $5, $6, TRUE, $7, NOW(), NOW())
           ON CONFLICT (organization_id, user_id) DO UPDATE
           SET role_id = EXCLUDED.role_id,
               department = COALESCE(EXCLUDED.department, organization_members.department),
               job_title = COALESCE(EXCLUDED.job_title, organization_members.job_title),
               approval_limit_bwp = COALESCE(EXCLUDED.approval_limit_bwp, organization_members.approval_limit_bwp),
               status = 'active',
               joined_at = COALESCE(organization_members.joined_at, NOW()),
               updated_at = NOW()`,
          [inv.organization_id, userId, inv.role_id, inv.department, inv.job_title, inv.approval_limit_bwp, inv.invited_by_user_id]
        );
      } else {
        await query(
          `INSERT INTO organization_members (
             organization_id, user_id, role_id, is_owner, status, department, job_title,
             mfa_enforced, invited_by_user_id, invited_at, joined_at
           ) VALUES ($1, $2, $3, FALSE, 'active', $4, $5, TRUE, $6, NOW(), NOW())
           ON CONFLICT (organization_id, user_id) DO UPDATE
           SET role_id = EXCLUDED.role_id,
               status = 'active',
               joined_at = COALESCE(organization_members.joined_at, NOW()),
               updated_at = NOW()`,
          [inv.organization_id, userId, inv.role_id, inv.department, inv.job_title, inv.invited_by_user_id]
        );
      }
    } else if (inv.supplier_id) {
      await query(
        `INSERT INTO supplier_members (
           supplier_id, user_id, role_id, is_owner, status, job_title,
           invited_by_user_id, invited_at, joined_at
         ) VALUES ($1, $2, $3, FALSE, 'active', $4, $5, NOW(), NOW())
         ON CONFLICT (supplier_id, user_id) DO UPDATE
         SET role_id = EXCLUDED.role_id,
             status = 'active',
             joined_at = COALESCE(supplier_members.joined_at, NOW()),
             updated_at = NOW()`,
        [inv.supplier_id, userId, inv.role_id, inv.job_title, inv.invited_by_user_id]
      );
    }
    await query(`UPDATE invitations SET accepted_at = NOW() WHERE id = $1`, [inv.id]);
    const memberships = await usersRepository.getUserMemberships(userId);
    const targetTenantId = inv.organization_id || inv.supplier_id;
    const activeTenant = memberships.find((m) => m.tenantId === targetTenantId) || memberships[0];
    const tenantType = activeTenant?.tenantType || (inv.organization_id ? "organization" : "supplier");
    const tenantId = activeTenant?.tenantId || targetTenantId;
    const profileSummary = activeTenant?.profile || null;
    const rawToken = generateRandomToken(32);
    const sessionTokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1e3);
    await query(
      `INSERT INTO sessions (user_id, token_hash, tenant_type, tenant_id, ip, user_agent, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [userId, sessionTokenHash, tenantType, tenantId, cleanIp || null, dto.userAgent || null, expiresAt]
    );
    await auditRepository.logEvent({
      actorType: "user",
      actorUserId: userId,
      actorName: userFullName,
      actorRole: activeTenant?.roleName || "Member",
      organizationId: inv.organization_id || void 0,
      supplierId: inv.supplier_id || void 0,
      action: "invitation.accepted",
      entityType: "invitation",
      entityId: inv.id,
      ipAddress: cleanIp,
      userAgent: dto.userAgent,
      details: `Invitation accepted for ${cleanEmail}.`
    }).catch(() => {
    });
    return {
      token: rawToken,
      user: {
        id: userId,
        email: cleanEmail,
        fullName: userFullName,
        isPlatformAdmin: false,
        memberships
      },
      activeTenant,
      profileSummary
    };
  }
};
var authService = new AuthService();

// server/db/errors.ts
function translateDbError(err) {
  if (!err || typeof err !== "object") {
    return {
      status: 500,
      message: "An unexpected database error occurred. Please try again.",
      code: "INTERNAL_ERROR"
    };
  }
  const sqlState = err.code;
  switch (sqlState) {
    case "23505": {
      const detail = err.detail || "";
      let fieldMatch = detail.match(/Key \((.*?)\)=/);
      const field = fieldMatch ? fieldMatch[1] : void 0;
      let userFriendlyField = field ? field.replace(/_/g, " ") : "";
      if (field === "cipa_uin") userFriendlyField = "CIPA registration number";
      if (field === "email") userFriendlyField = "email address";
      return {
        status: 409,
        message: field ? `The ${userFriendlyField} provided is already registered to another account.` : "That value is already in use.",
        code: "UNIQUE_VIOLATION",
        field
      };
    }
    case "23503": {
      return {
        status: 400,
        message: "Referenced record does not exist or has been removed.",
        code: "FOREIGN_KEY_VIOLATION"
      };
    }
    case "23514": {
      const constraint = err.constraint || "";
      let msg = "The submitted information does not satisfy required business validation rules.";
      if (constraint.includes("chk_calls_dates")) {
        msg = "Closing date and time must be strictly after the opening date.";
      } else if (constraint.includes("chk_contracts_dates")) {
        msg = "Contract end date must be after the start date.";
      } else if (constraint.includes("chk_invitation_one_tenant") || constraint.includes("chk_subscription_one_tenant")) {
        msg = "Record must belong to either an organization or a supplier, not both.";
      }
      return {
        status: 422,
        message: msg,
        code: "CHECK_VIOLATION"
      };
    }
    case "23502": {
      const column = err.column || "field";
      return {
        status: 400,
        message: `Missing required parameter: ${column.replace(/_/g, " ")}.`,
        code: "NOT_NULL_VIOLATION"
      };
    }
    case "22P02": {
      return {
        status: 400,
        message: "Invalid input format provided. Please check all entered parameters.",
        code: "INVALID_INPUT_SYNTAX"
      };
    }
    case "40P01": {
      return {
        status: 503,
        message: "The system encountered high concurrency. Please retry your request.",
        code: "DEADLOCK_DETECTED"
      };
    }
    case "42501": {
      return {
        status: 403,
        message: err.message || "Operation blocked by immutability or access control rules.",
        code: "IMMUTABLE_OR_FORBIDDEN"
      };
    }
    case "P0001": {
      return {
        status: 403,
        message: err.message || "Operation forbidden by compliance rules.",
        code: "TRIGGER_RULE_REJECTED"
      };
    }
    case "DATABASE_UNAVAILABLE":
    case "ECONNREFUSED":
    case "ETIMEDOUT":
    case "ENOTFOUND":
    case "08001":
    case "08006":
    case "28P01":
    case "28000":
    case "57P01":
    case "57P02":
    case "57P03": {
      return {
        status: 503,
        message: "Database service is temporarily unreachable. Please try again shortly.",
        code: "SERVICE_UNAVAILABLE"
      };
    }
    default:
      if (err.message && typeof err.message === "string" && !err.message.includes("Query execution failed")) {
        return {
          status: err.status || 400,
          message: err.message,
          code: sqlState || err.code || "BAD_REQUEST",
          field: err.field
        };
      }
      return {
        status: 500,
        message: "Unable to process your request at this time. Please verify your details and try again.",
        code: sqlState || "DB_ERROR"
      };
  }
}

// server/routes/auth.routes.ts
var router2 = Router2();
router2.post("/register-supplier-step", async (req, res) => {
  try {
    const { step, email, fullName, phone, password, legalName, cipaUin, companyType, city, agreedToTerms, agreedToPrivacy } = req.body;
    if (!email || !step) {
      res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "Step and Email address are required."
      });
      return;
    }
    const ip = extractClientIp(req);
    const userAgent = req.headers["user-agent"] || "Web Client";
    const result = await authService.saveSupplierRegistrationStep({
      step: Number(step),
      email,
      fullName,
      phone,
      password,
      legalName,
      cipaUin,
      companyType,
      city,
      agreedToTerms,
      agreedToPrivacy,
      ip,
      userAgent
    });
    res.status(200).json(result);
  } catch (err) {
    const safeError = translateDbError(err);
    res.status(safeError.status).json(safeError);
  }
});
router2.get("/supplier-progress", async (req, res) => {
  try {
    const email = String(req.query.email || "").trim();
    if (!email) {
      res.json({ found: false });
      return;
    }
    const progress = await authService.getSupplierRegistrationProgress(email);
    res.json(progress);
  } catch (err) {
    res.status(500).json({ found: false, error: err.message });
  }
});
router2.post("/register-supplier", async (req, res) => {
  try {
    const { legalName, cipaUin, fullName, email, password, phone } = req.body;
    if (!legalName || !cipaUin || !fullName || !email || !password) {
      res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "Please complete all required fields: Company Name, CIPA Number, Full Name, Email, and Password."
      });
      return;
    }
    const ip = extractClientIp(req);
    const userAgent = req.headers["user-agent"] || "Web Client";
    const result = await authService.registerSupplier({
      legalName,
      cipaUin,
      fullName,
      email,
      password,
      phone,
      ip,
      userAgent
    });
    res.status(201).json(result);
  } catch (err) {
    const safeError = translateDbError(err);
    res.status(safeError.status).json(safeError);
  }
});
router2.post("/register-buyer", async (req, res) => {
  try {
    const { organizationName, organizationType, fullName, email, password, phone } = req.body;
    if (!organizationName || !fullName || !email || !password) {
      res.status(400).json({
        error: "VALIDATION_ERROR",
        message: "Please complete all required fields: Organization Name, Full Name, Official Email, and Password."
      });
      return;
    }
    const ip = extractClientIp(req);
    const userAgent = req.headers["user-agent"] || "Web Client";
    const result = await authService.registerOrganization({
      organizationName,
      organizationType,
      fullName,
      email,
      password,
      phone,
      ip,
      userAgent
    });
    res.status(201).json(result);
  } catch (err) {
    const safeError = translateDbError(err);
    res.status(safeError.status).json(safeError);
  }
});
router2.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({
        error: "MISSING_CREDENTIALS",
        message: "Email address and password are required."
      });
      return;
    }
    const ip = extractClientIp(req);
    const userAgent = req.headers["user-agent"] || "Web Client";
    const result = await authService.login(email, password, ip, userAgent);
    if (result.token) {
      res.cookie("session_token", result.token, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 7 * 24 * 60 * 60 * 1e3,
        secure: process.env.NODE_ENV === "production"
      });
    }
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    if (result.timing) {
      res.setHeader(
        "Server-Timing",
        `lookup;dur=${result.timing.userLookupMs}, pass;dur=${result.timing.passwordVerifyMs}, sess;dur=${result.timing.sessionInsertMs}, total;dur=${result.timing.totalMs}`
      );
    }
    res.json(result);
  } catch (err) {
    if (err.status === 423) {
      res.status(423).json({
        error: "ACCOUNT_LOCKED",
        code: "ACCOUNT_LOCKED",
        message: err.message || "Your account is temporarily locked due to failed sign-in attempts.",
        lockedUntil: err.lockedUntil || null
      });
      return;
    }
    if (err.status === 429) {
      res.status(429).json({
        error: "RATE_LIMIT_EXCEEDED",
        code: "RATE_LIMIT_EXCEEDED",
        message: err.message || "Too many attempts. Try again in 15 minutes."
      });
      return;
    }
    if (err.status === 403 && err.code === "EMAIL_NOT_VERIFIED") {
      res.status(403).json({
        error: "EMAIL_NOT_VERIFIED",
        code: "EMAIL_NOT_VERIFIED",
        message: "Verify your email first",
        email: err.email
      });
      return;
    }
    if (err.status === 403) {
      res.status(403).json({
        error: err.code || "FORBIDDEN",
        code: err.code || "FORBIDDEN",
        message: err.message
      });
      return;
    }
    res.status(401).json({
      error: "INVALID_CREDENTIALS",
      code: "INVALID_CREDENTIALS",
      message: "Email or password is incorrect."
    });
  }
});
router2.post("/verify-mfa", async (req, res) => {
  try {
    const { userId, totpCode } = req.body;
    if (!userId || !totpCode) {
      res.status(400).json({
        error: "MISSING_MFA_DATA",
        message: "User ID and 6-digit MFA verification code are required."
      });
      return;
    }
    const ip = extractClientIp(req);
    const userAgent = req.headers["user-agent"] || "Web Client";
    const result = await authService.verifyMfa(userId, totpCode, ip, userAgent);
    if (result.token) {
      res.cookie("session_token", result.token, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 7 * 24 * 60 * 60 * 1e3,
        secure: process.env.NODE_ENV === "production"
      });
    }
    res.json(result);
  } catch (err) {
    res.status(401).json({
      error: "MFA_FAILED",
      message: err.message || "MFA verification failed."
    });
  }
});
router2.post("/verify-email", async (req, res) => {
  try {
    const { token } = req.body;
    if (!token) {
      res.status(400).json({
        error: "MISSING_TOKEN",
        message: "Verification token is required."
      });
      return;
    }
    const ip = extractClientIp(req);
    const userAgent = req.headers["user-agent"] || "Web Client";
    const result = await authService.verifyEmailWithToken(token, ip, userAgent);
    res.json(result);
  } catch (err) {
    const safeError = translateDbError(err);
    res.status(safeError.status || 400).json(safeError);
  }
});
router2.post("/resend-verification", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({
        error: "MISSING_EMAIL",
        message: "Email address is required."
      });
      return;
    }
    const ip = extractClientIp(req);
    const userAgent = req.headers["user-agent"] || "Web Client";
    const result = await authService.resendVerification(email, ip, userAgent);
    res.json(result);
  } catch (err) {
    const safeError = translateDbError(err);
    res.status(safeError.status || 400).json(safeError);
  }
});
router2.post("/forgot-password", async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({
        error: "MISSING_EMAIL",
        message: "Email address is required."
      });
      return;
    }
    const ip = extractClientIp(req);
    const userAgent = req.headers["user-agent"] || "Web Client";
    const result = await authService.forgotPassword(email, ip, userAgent);
    res.json(result);
  } catch (err) {
    const safeError = translateDbError(err);
    res.status(safeError.status || 400).json(safeError);
  }
});
router2.post("/reset-password", async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      res.status(400).json({
        error: "MISSING_DATA",
        message: "Reset token and new password are required."
      });
      return;
    }
    const ip = extractClientIp(req);
    const userAgent = req.headers["user-agent"] || "Web Client";
    const result = await authService.resetPassword(token, password, ip, userAgent);
    res.json(result);
  } catch (err) {
    const safeError = translateDbError(err);
    res.status(safeError.status || 400).json(safeError);
  }
});
router2.post("/switch-tenant", requireAuth, async (req, res) => {
  try {
    const { tenantId, tenantType } = req.body;
    if (!tenantId || !tenantType) {
      res.status(400).json({
        error: "MISSING_DATA",
        message: "tenantId and tenantType are required."
      });
      return;
    }
    const updated = await authService.switchTenant(
      req.session.rawToken,
      tenantId,
      tenantType
    );
    res.json({ success: true, activeTenant: updated });
  } catch (err) {
    const safeError = translateDbError(err);
    res.status(safeError.status || 400).json(safeError);
  }
});
var sendSessionResponse = (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  const user = req.user;
  const activeTenant = req.activeTenant;
  const profileSummary = req.profileSummary || null;
  const displayName = profileSummary?.displayName || user.fullName || user.email;
  const firstName = String(displayName).trim().split(/\s+/)[0] || displayName;
  res.json({
    user: {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      phone: user.phone,
      isPlatformAdmin: user.isPlatformAdmin
    },
    profile: {
      displayName,
      firstName,
      tenantType: user.isPlatformAdmin ? "platform" : activeTenant?.tenantType || "supplier",
      tenantId: activeTenant?.tenantId || (user.isPlatformAdmin ? "platform" : ""),
      role: activeTenant?.roleName || (user.isPlatformAdmin ? "Super Admin" : "Member"),
      orgName: activeTenant?.tenantName || (user.isPlatformAdmin ? "Platform Administration" : displayName),
      verificationStatus: profileSummary?.verificationStatus || activeTenant?.verificationStatus || "unverified"
    },
    activeTenant,
    profileSummary,
    permissions: Array.from(req.permissions || [])
  });
};
router2.get("/me", requireAuth, sendSessionResponse);
router2.get("/session", requireAuth, sendSessionResponse);
router2.get("/invitations/:token", async (req, res) => {
  try {
    const invite = await authService.getInvitationByToken(req.params.token);
    res.json(invite);
  } catch (err) {
    const safeError = translateDbError(err);
    res.status(safeError.status || 404).json(safeError);
  }
});
router2.post("/accept-invite", async (req, res) => {
  try {
    const { token, password, fullName } = req.body;
    if (!token || !password) {
      res.status(400).json({
        error: "MISSING_DATA",
        message: "Invitation token and password are required."
      });
      return;
    }
    const ip = extractClientIp(req);
    const userAgent = req.headers["user-agent"] || "Web Client";
    const result = await authService.acceptInvitation({ token, password, fullName, ip, userAgent });
    if (result.token) {
      res.cookie("session_token", result.token, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 7 * 24 * 60 * 60 * 1e3,
        secure: process.env.NODE_ENV === "production"
      });
    }
    res.json(result);
  } catch (err) {
    const safeError = translateDbError(err);
    res.status(safeError.status || 400).json(safeError);
  }
});
router2.post("/logout", async (req, res) => {
  try {
    const rawToken = req.session?.rawToken || req.cookies?.session_token;
    if (rawToken) {
      const ip = extractClientIp(req);
      const userAgent = req.headers["user-agent"] || "Web Client";
      await authService.logout(rawToken, ip, userAgent);
    }
  } catch {
  }
  res.clearCookie("session_token", { path: "/" });
  res.json({ success: true, message: "Logged out successfully." });
});
var authRouter = router2;

// server/routes/supplier.routes.ts
import { Router as Router3 } from "express";
import multer from "multer";
import { GoogleGenAI } from "@google/genai";

// server/middleware/tenant.helper.ts
function getTenantContext(req) {
  if (!req.user) {
    throw new Error("Unauthenticated request: user session missing.");
  }
  if (!req.activeTenant) {
    throw new Error("Tenant context missing: user has no active organization or supplier workspace.");
  }
  return {
    userId: req.user.id,
    userEmail: req.user.email,
    isPlatformAdmin: req.user.isPlatformAdmin,
    tenantType: req.activeTenant.tenantType,
    tenantId: req.activeTenant.tenantId,
    tenantName: req.activeTenant.tenantName,
    roleName: req.activeTenant.roleName,
    isOwner: req.activeTenant.isOwner,
    permissions: req.permissions || /* @__PURE__ */ new Set()
  };
}
function getOrganizationContext(req) {
  const ctx = getTenantContext(req);
  if (ctx.tenantType !== "organization" && !ctx.isPlatformAdmin) {
    throw new Error("Access denied: active workspace is not a buying organization.");
  }
  return ctx;
}
function getSupplierContext(req) {
  const ctx = getTenantContext(req);
  if (ctx.tenantType !== "supplier" && !ctx.isPlatformAdmin) {
    throw new Error("Access denied: active workspace is not a supplier profile.");
  }
  return ctx;
}

// server/repositories/suppliers.repository.ts
import crypto4 from "crypto";

// server/services/completeness.service.ts
function computeSupplierCompleteness(supplier, people = [], documents = []) {
  const isTradingLicenceRequired = supplier?.has_trading_licence === true || supplier?.hasTradingLicence === true;
  const items = [];
  const legalName = supplier?.legal_name || supplier?.legalName;
  const hasLegal = Boolean(legalName && String(legalName).trim().length > 0);
  items.push({
    key: "legalName",
    label: "Legal company name",
    category: "Company",
    complete: hasLegal,
    reason: hasLegal ? void 0 : "Official corporate name is required.",
    value: legalName || null
  });
  const tradingName = supplier?.trading_name || supplier?.tradingName;
  const hasTrading = Boolean(tradingName && String(tradingName).trim().length > 0);
  items.push({
    key: "tradingName",
    label: "Trading name",
    category: "Company",
    complete: hasTrading,
    reason: hasTrading ? void 0 : "Commercial trading name is required.",
    value: tradingName || null
  });
  const tin = supplier?.burs_tin || supplier?.tinNumber || supplier?.bursTin;
  const hasTin = Boolean(tin && String(tin).trim().length > 0);
  items.push({
    key: "tinNumber",
    label: "BURS Tax Identification Number (TIN)",
    category: "Company",
    complete: hasTin,
    reason: hasTin ? void 0 : "Valid BURS TIN is required.",
    value: tin || null
  });
  const physicalAddress = supplier?.physical_address || supplier?.physicalAddress;
  const hasPhysical = Boolean(physicalAddress && String(physicalAddress).trim().length > 0);
  items.push({
    key: "physicalAddress",
    label: "Physical plot & street address",
    category: "Company",
    complete: hasPhysical,
    reason: hasPhysical ? void 0 : "Physical business address is required.",
    value: physicalAddress || null
  });
  const city = supplier?.city;
  const hasCity = Boolean(city && String(city).trim().length > 0);
  items.push({
    key: "city",
    label: "City or town of operation",
    category: "Company",
    complete: hasCity,
    reason: hasCity ? void 0 : "City or town is required.",
    value: city || null
  });
  const district = supplier?.district_id || supplier?.districtId || supplier?.district || supplier?.districtName;
  const hasDistrict = Boolean(district && String(district).trim().length > 0);
  items.push({
    key: "district",
    label: "Administrative district",
    category: "Company",
    complete: hasDistrict,
    reason: hasDistrict ? void 0 : "District selection is required.",
    value: district || null
  });
  const phone = supplier?.primary_phone || supplier?.primaryPhone;
  const phoneDigits = (phone || "").replace(/\D/g, "");
  const hasPhone = Boolean(phone && phoneDigits.length >= 7);
  items.push({
    key: "primaryPhone",
    label: "Primary contact telephone",
    category: "Company",
    complete: hasPhone,
    reason: hasPhone ? void 0 : "A telephone number with at least 7 digits is required.",
    value: phone || null
  });
  const email = supplier?.email;
  const hasEmail = Boolean(email && String(email).trim().length > 0 && String(email).includes("@"));
  items.push({
    key: "email",
    label: "Official corporate email",
    category: "Company",
    complete: hasEmail,
    reason: hasEmail ? void 0 : "A valid email address is required.",
    value: email || null
  });
  const bankName = supplier?.bank_name || supplier?.bankName;
  const bankBranch = supplier?.bank_branch || supplier?.bankBranch;
  const accountMasked = supplier?.account_number_masked || supplier?.accountNumberMasked;
  const hasBank = Boolean(
    bankName && String(bankName).trim().length > 0 && (bankBranch && String(bankBranch).trim().length > 0 || accountMasked && String(accountMasked).trim().length > 0)
  );
  items.push({
    key: "bankDetails",
    label: "Commercial banking details",
    category: "Company",
    complete: hasBank,
    reason: hasBank ? void 0 : "Bank name and branch or masked account number are required.",
    value: hasBank ? `${bankName} (${bankBranch || "Active account"})` : null
  });
  const citizenPct = supplier?.citizen_owned_percentage ?? supplier?.citizenOwnedPercentage;
  const citizenNum = Number(citizenPct);
  const hasCitizen = !isNaN(citizenNum) && citizenNum > 0 && citizenNum <= 100;
  items.push({
    key: "citizenOwnership",
    label: "Citizen equity ownership percentage",
    category: "Company",
    complete: hasCitizen,
    reason: hasCitizen ? void 0 : "Citizen equity ownership between 1% and 100% is required.",
    value: hasCitizen ? `${citizenNum}%` : null
  });
  const activePeople = (people || []).filter((p) => p.is_active !== false && p.isActive !== false);
  const totalOwnership = activePeople.reduce((sum, p) => {
    const raw = p.ownership_percent ?? p.ownershipPercent ?? p.shareholdingPercentage ?? 0;
    return sum + (parseFloat(raw) || 0);
  }, 0);
  const hasDirectors100 = activePeople.length > 0 && Math.round(totalOwnership) === 100;
  items.push({
    key: "directors",
    label: "Registered directors with 100% total ownership",
    category: "People",
    complete: hasDirectors100,
    reason: hasDirectors100 ? void 0 : activePeople.length === 0 ? "No registered directors or shareholders found." : `Total ownership is ${totalOwnership}%, must equal 100%.`,
    value: `${activePeople.length} registered (${Math.round(totalOwnership)}% total)`
  });
  const checkDocByCode = (codes, label, key) => {
    const matchingTypeDocs = (documents || []).filter((d) => {
      const code = (d.documentTypeCode || d.doc_type_code || d.code || "").toUpperCase();
      return codes.some((c) => c.toUpperCase() === code);
    });
    const now = /* @__PURE__ */ new Date();
    const todayUtcStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const isExpiryPast = (expiry) => {
      if (!expiry) return false;
      const expDate = new Date(expiry);
      if (isNaN(expDate.getTime())) return false;
      const expUtcStart = Date.UTC(expDate.getUTCFullYear(), expDate.getUTCMonth(), expDate.getUTCDate());
      return expUtcStart < todayUtcStart;
    };
    const validVerifiedMatch = matchingTypeDocs.find((d) => {
      const docStatus = (d.status || "").toLowerCase();
      if (docStatus === "expired" || docStatus === "rejected" || docStatus === "deleted") return false;
      const verStatus = (d.verificationStatus || d.verification_status || "").toUpperCase();
      if (verStatus !== "VERIFIED" && verStatus !== "APPROVED") return false;
      const expiryState = (d.expiryState || d.expiry_state || "").toUpperCase();
      if (expiryState === "EXPIRED") return false;
      const expiry = d.expiryDate || d.expiry_date || d.valid_until;
      if (isExpiryPast(expiry)) return false;
      return true;
    });
    if (validVerifiedMatch) {
      return {
        key,
        label,
        category: "Documents",
        complete: true,
        unverified: false,
        reason: "Verified",
        value: validVerifiedMatch.fileName || validVerifiedMatch.file_name || validVerifiedMatch.title || "Verified"
      };
    }
    const pendingDoc = matchingTypeDocs.find((d) => {
      const docStatus = (d.status || "").toLowerCase();
      if (docStatus === "expired" || docStatus === "rejected" || docStatus === "deleted") return false;
      const verStatus = (d.verificationStatus || d.verification_status || "").toUpperCase();
      if (verStatus === "REJECTED" || verStatus === "EXPIRED" || verStatus === "UNVERIFIABLE") return false;
      const expiryState = (d.expiryState || d.expiry_state || "").toUpperCase();
      if (expiryState === "EXPIRED") return false;
      const expiry = d.expiryDate || d.expiry_date || d.valid_until;
      if (isExpiryPast(expiry)) return false;
      return verStatus === "PENDING_VERIFICATION" || verStatus === "PENDING" || docStatus === "active";
    });
    if (pendingDoc) {
      return {
        key,
        label,
        category: "Documents",
        complete: false,
        unverified: true,
        reason: `${label} is uploaded and awaiting administrator verification.`,
        value: pendingDoc.fileName || pendingDoc.file_name || pendingDoc.title || "Pending verification"
      };
    }
    const rejectedDoc = matchingTypeDocs.find((d) => {
      const verStatus = (d.verificationStatus || d.verification_status || "").toUpperCase();
      const docStatus = (d.status || "").toLowerCase();
      return verStatus === "REJECTED" || docStatus === "rejected";
    });
    if (rejectedDoc) {
      const rejNote = rejectedDoc.rejectionReason || rejectedDoc.rejection_reason || rejectedDoc.verificationNotes || rejectedDoc.verification_notes;
      return {
        key,
        label,
        category: "Documents",
        complete: false,
        reason: rejNote ? `${label} was rejected: ${rejNote}. Please upload a replacement.` : `${label} was rejected by an administrator. Please upload a replacement.`
      };
    }
    const expiredDoc = matchingTypeDocs.find((d) => {
      const verStatus = (d.verificationStatus || d.verification_status || "").toUpperCase();
      const expiryState = (d.expiryState || d.expiry_state || "").toUpperCase();
      const expiry = d.expiryDate || d.expiry_date || d.valid_until;
      return verStatus === "EXPIRED" || expiryState === "EXPIRED" || isExpiryPast(expiry);
    });
    if (expiredDoc) {
      return {
        key,
        label,
        category: "Documents",
        complete: false,
        reason: `${label} has expired. Please upload a renewed document.`
      };
    }
    const unverifiableDoc = matchingTypeDocs.find((d) => {
      const verStatus = (d.verificationStatus || d.verification_status || "").toUpperCase();
      return verStatus === "UNVERIFIABLE";
    });
    if (unverifiableDoc) {
      return {
        key,
        label,
        category: "Documents",
        complete: false,
        reason: `${label} could not be verified. Please upload a clearer replacement.`
      };
    }
    return {
      key,
      label,
      category: "Documents",
      complete: false,
      reason: `${label} has not been uploaded.`
    };
  };
  items.push(checkDocByCode(["COMPANY_REGISTRATION", "CIPA_CERT", "CIPA"], "CIPA Certificate of Incorporation", "cipaDoc"));
  items.push(checkDocByCode(["TAX_CLEARANCE", "BURS_TAX"], "BURS Tax Clearance Certificate", "taxDoc"));
  items.push(checkDocByCode(["DIRECTOR_ID", "DIRECTORS_ID", "OMANG"], "Directors' and shareholders' ID", "directorsIdDoc"));
  items.push(checkDocByCode(["BANK_CONFIRMATION", "BANK_LETTER"], "Bank confirmation letter", "bankDoc"));
  if (isTradingLicenceRequired) {
    items.push(checkDocByCode(["BUSINESS_LICENCE", "TRADING_LICENCE"], "Trading licence", "tradingLicenceDoc"));
  }
  const totalCount = items.length;
  const completedCount = items.filter((i) => i.complete).length;
  const score = Math.round(completedCount / Math.max(1, totalCount) * 100);
  const missingItems = items.filter((i) => !i.complete);
  const complianceStatus = score >= 80 ? "Fully compliant" : "Action required";
  return {
    score,
    completedCount,
    totalCount,
    items,
    missingItems,
    complianceStatus
  };
}
var CompletenessService = class {
  constructor() {
    this.timer = null;
  }
  async calculateForSupplier(supplierId) {
    try {
      const [sRes, pRes, dRes] = await Promise.all([
        query(
          `SELECT s.legal_name, s.trading_name, s.burs_tin, s.physical_address, s.city, s.district_id,
                  s.primary_phone, s.email, s.bank_name, s.bank_branch, s.account_number_masked,
                  s.citizen_owned_percentage, s.has_trading_licence
           FROM suppliers s
           WHERE s.id = $1 AND s.deleted_at IS NULL`,
          [supplierId]
        ),
        query(
          `SELECT ownership_percent, ownership_percent AS "ownershipPercent", is_active FROM supplier_people WHERE supplier_id = $1 AND is_active = TRUE`,
          [supplierId]
        ),
        query(
          `SELECT sd.id, dt.code AS doc_type_code, dt.code, dt.name, sd.title,
                  sdv.file_name, sdv.verification_status, sdv.verification_notes, sdv.rejection_reason,
                  sdv.expiry_date, sd.status
           FROM supplier_documents sd
           JOIN document_types dt ON dt.id = sd.document_type_id
           LEFT JOIN supplier_document_versions sdv ON sdv.id = sd.current_version_id
           WHERE sd.supplier_id = $1 AND sd.status = 'active'`,
          [supplierId]
        )
      ]);
      if (sRes.rows.length === 0) return null;
      return computeSupplierCompleteness(sRes.rows[0], pRes.rows, dRes.rows);
    } catch (err) {
      console.warn(`[COMPLETENESS SERVICE] Failed calculateForSupplier(${supplierId}):`, err);
      return null;
    }
  }
  async auditCompleteness() {
    try {
      const res = await query(`
        SELECT id, legal_name, profile_completeness, compliance_status
        FROM suppliers
        WHERE deleted_at IS NULL
        ORDER BY created_at DESC
        LIMIT 100
      `);
      const auditResults = [];
      let matchedCount = 0;
      let discrepancyCount = 0;
      for (const row of res.rows) {
        const computed = await this.calculateForSupplier(row.id);
        const storedScore = Number(row.profile_completeness || 0);
        const computedScore = computed ? computed.score : 0;
        const matched = storedScore === computedScore;
        if (matched) matchedCount++;
        else discrepancyCount++;
        auditResults.push({
          supplierId: row.id,
          legalName: row.legal_name,
          storedScore,
          computedScore,
          matched,
          complianceStatus: computed?.complianceStatus || row.compliance_status
        });
      }
      return {
        totalAudited: res.rows.length,
        matchedCount,
        discrepancyCount,
        auditTimestamp: (/* @__PURE__ */ new Date()).toISOString(),
        suppliers: auditResults
      };
    } catch (err) {
      console.error("[AUDIT COMPLETENESS ERROR]", err);
      return { error: err.message, totalAudited: 0, matchedCount: 0, discrepancyCount: 0, suppliers: [] };
    }
  }
  async runDailyJob() {
    try {
      console.log("[COMPLETENESS SERVICE] Running daily reconciliation job...");
      const res = await query(`
        SELECT id FROM suppliers WHERE deleted_at IS NULL
      `);
      let processedCount = 0;
      for (const row of res.rows) {
        const computed = await this.calculateForSupplier(row.id);
        if (computed) {
          const missingLabels = computed.missingItems.map((m) => m.label);
          await query(
            `UPDATE suppliers
             SET profile_completeness = $1,
                 compliance_status = $2,
                 missing_items = $3,
                 profile_completeness_updated_at = NOW()
             WHERE id = $4`,
            [computed.score, computed.complianceStatus, missingLabels, row.id]
          );
          processedCount++;
        }
      }
      console.log(`[COMPLETENESS SERVICE] Reconciled ${processedCount} suppliers.`);
      return {
        success: true,
        processedCount,
        checked: res.rows.length,
        updated: processedCount,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      };
    } catch (err) {
      console.error("[COMPLETENESS SERVICE RUN DAILY JOB ERROR]", err);
      return {
        success: false,
        error: err.message,
        processedCount: 0,
        checked: 0,
        updated: 0,
        timestamp: (/* @__PURE__ */ new Date()).toISOString()
      };
    }
  }
  startScheduler() {
    console.log("[COMPLETENESS SERVICE] Daily completeness reconciliation scheduler active (target: 00:05 Africa/Gaborone).");
    if (this.timer) {
      clearInterval(this.timer);
    }
    this.timer = setInterval(() => {
      this.runDailyJob().catch((err) => {
        console.warn("[COMPLETENESS SERVICE CRON ERROR]", err);
      });
    }, 24 * 60 * 60 * 1e3);
    if (this.timer.unref) {
      this.timer.unref();
    }
  }
};
var completenessService = new CompletenessService();

// shared/omang.ts
function normaliseOmang(s) {
  if (typeof s !== "string") return "";
  return s.trim().replace(/[\s-]+/g, "");
}
function validateOmang(s, gender) {
  const n = normaliseOmang(s);
  if (!/^\d{9}$/.test(n)) {
    return {
      ok: false,
      code: "INVALID_LENGTH_OR_CHARS",
      message: "ID number must be 9 digits.",
      normalised: n,
      derivedGender: null
    };
  }
  const fifth = n[4];
  if (fifth !== "1" && fifth !== "2") {
    return {
      ok: false,
      code: "INVALID_GENDER_DIGIT",
      message: "The 5th digit must be 1 (male) or 2 (female).",
      normalised: n,
      derivedGender: null
    };
  }
  const derivedGender = fifth === "1" ? "male" : "female";
  const normGender = typeof gender === "string" ? gender.trim().toLowerCase() : "";
  if ((normGender === "male" || normGender === "female") && normGender !== derivedGender) {
    return {
      ok: false,
      code: "GENDER_MISMATCH",
      message: "The ID number does not match the selected gender.",
      normalised: n,
      derivedGender
    };
  }
  return {
    ok: true,
    code: "VALID",
    message: "",
    normalised: n,
    derivedGender
  };
}

// server/repositories/suppliers.repository.ts
var MONTHS_MAP = {
  jan: "01",
  january: "01",
  feb: "02",
  february: "02",
  mar: "03",
  march: "03",
  apr: "04",
  april: "04",
  may: "05",
  jun: "06",
  june: "06",
  jul: "07",
  july: "07",
  aug: "08",
  august: "08",
  sep: "09",
  sept: "09",
  september: "09",
  oct: "10",
  october: "10",
  nov: "11",
  november: "11",
  dec: "12",
  december: "12"
};
function parseProjectDate(val) {
  if (!val || typeof val !== "string") return null;
  const trimmed = val.trim();
  if (!trimmed || /^ongoing$/i.test(trimmed) || /^present$/i.test(trimmed)) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
  if (/^\d{4}-\d{2}$/.test(trimmed)) return `${trimmed}-01`;
  const monthYear = trimmed.match(/^([a-zA-Z]+)\s+(\d{4})$/);
  if (monthYear) {
    const mm = MONTHS_MAP[monthYear[1].toLowerCase()];
    if (mm) return `${monthYear[2]}-${mm}-01`;
  }
  const parsed = new Date(trimmed);
  if (!isNaN(parsed.getTime())) {
    return parsed.toISOString().slice(0, 10);
  }
  return null;
}
async function resolveDistrictId(input) {
  if (!input || typeof input !== "string") return null;
  const trimmed = input.trim();
  if (!trimmed) return null;
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
    try {
      const uuidCheck = await query(`SELECT id FROM geographic_districts WHERE id = $1 LIMIT 1`, [trimmed]);
      if (uuidCheck.rows.length > 0) return uuidCheck.rows[0].id;
    } catch {
    }
  }
  try {
    const cleanName = trimmed.replace(/\s*\([^)]*\)/g, "").trim();
    const withoutDistrict = cleanName.replace(/\s+district$/i, "").trim();
    const res = await query(
      `SELECT id FROM geographic_districts 
       WHERE LOWER(name) = LOWER($1)
          OR LOWER(name) = LOWER($2)
          OR LOWER(name) = LOWER($3)
          OR LOWER(administrative_region) = LOWER($1)
          OR LOWER(administrative_region) = LOWER($2)
          OR LOWER(name) LIKE LOWER($4)
       ORDER BY CASE 
         WHEN LOWER(name) = LOWER($1) THEN 1
         WHEN LOWER(name) = LOWER($2) THEN 2
         WHEN LOWER(administrative_region) = LOWER($1) THEN 3
         ELSE 4 END
       LIMIT 1`,
      [trimmed, cleanName, withoutDistrict, `%${withoutDistrict || cleanName}%`]
    );
    if (res.rows.length > 0) {
      return res.rows[0].id;
    }
    const lower = trimmed.toLowerCase();
    if (lower.includes("gaborone") || lower.includes("south-east") || lower.includes("south east") || lower.includes("tlokweng") || lower.includes("ramotswa")) {
      const gRes = await query(
        `SELECT id FROM geographic_districts WHERE name ILIKE '%South-East%' LIMIT 1`
      );
      if (gRes.rows[0]) return gRes.rows[0].id;
    }
    if (lower.includes("francistown")) {
      const fRes = await query(
        `SELECT id FROM geographic_districts WHERE name ILIKE '%Francistown%' LIMIT 1`
      );
      if (fRes.rows[0]) return fRes.rows[0].id;
    }
    if (lower.includes("lobatse")) {
      const lRes = await query(
        `SELECT id FROM geographic_districts WHERE name ILIKE '%Lobatse%' LIMIT 1`
      );
      if (lRes.rows[0]) return lRes.rows[0].id;
    }
    if (lower.includes("jwaneng")) {
      const jRes = await query(
        `SELECT id FROM geographic_districts WHERE name ILIKE '%Jwaneng%' LIMIT 1`
      );
      if (jRes.rows[0]) return jRes.rows[0].id;
    }
    if (lower.includes("orapa")) {
      const oRes = await query(
        `SELECT id FROM geographic_districts WHERE name ILIKE '%Orapa%' LIMIT 1`
      );
      if (oRes.rows[0]) return oRes.rows[0].id;
    }
    if (lower.includes("selibe") || lower.includes("selebi") || lower.includes("phikwe")) {
      const sRes = await query(
        `SELECT id FROM geographic_districts WHERE name ILIKE '%Selibe%' LIMIT 1`
      );
      if (sRes.rows[0]) return sRes.rows[0].id;
    }
    if (lower.includes("sowa")) {
      const swRes = await query(
        `SELECT id FROM geographic_districts WHERE name ILIKE '%Sowa%' LIMIT 1`
      );
      if (swRes.rows[0]) return swRes.rows[0].id;
    }
    if (lower.includes("central") || lower.includes("serowe") || lower.includes("palapye") || lower.includes("mahalapye") || lower.includes("bobonong") || lower.includes("tutume")) {
      const cRes = await query(
        `SELECT id FROM geographic_districts WHERE name ILIKE '%Central%' LIMIT 1`
      );
      if (cRes.rows[0]) return cRes.rows[0].id;
    }
    if (lower.includes("kweneng") || lower.includes("molepolole") || lower.includes("mogoditshane") || lower.includes("thamaga")) {
      const kwRes = await query(
        `SELECT id FROM geographic_districts WHERE name ILIKE '%Kweneng%' LIMIT 1`
      );
      if (kwRes.rows[0]) return kwRes.rows[0].id;
    }
    if (lower.includes("kgatleng") || lower.includes("mochudi")) {
      const kgRes = await query(
        `SELECT id FROM geographic_districts WHERE name ILIKE '%Kgatleng%' LIMIT 1`
      );
      if (kgRes.rows[0]) return kgRes.rows[0].id;
    }
    if (lower.includes("southern") || lower.includes("kanye") || lower.includes("moshupa")) {
      const soRes = await query(
        `SELECT id FROM geographic_districts WHERE name ILIKE '%Southern%' LIMIT 1`
      );
      if (soRes.rows[0]) return soRes.rows[0].id;
    }
    if (lower.includes("north-east") || lower.includes("north east") || lower.includes("masunga")) {
      const neRes = await query(
        `SELECT id FROM geographic_districts WHERE name ILIKE '%North-East%' LIMIT 1`
      );
      if (neRes.rows[0]) return neRes.rows[0].id;
    }
    if (lower.includes("north-west") || lower.includes("north west") || lower.includes("maun") || lower.includes("ngamiland")) {
      const nwRes = await query(
        `SELECT id FROM geographic_districts WHERE name ILIKE '%North-West%' LIMIT 1`
      );
      if (nwRes.rows[0]) return nwRes.rows[0].id;
    }
    if (lower.includes("chobe") || lower.includes("kasane")) {
      const chRes = await query(
        `SELECT id FROM geographic_districts WHERE name ILIKE '%Chobe%' LIMIT 1`
      );
      if (chRes.rows[0]) return chRes.rows[0].id;
    }
    if (lower.includes("ghanzi")) {
      const ghRes = await query(
        `SELECT id FROM geographic_districts WHERE name ILIKE '%Ghanzi%' LIMIT 1`
      );
      if (ghRes.rows[0]) return ghRes.rows[0].id;
    }
    if (lower.includes("kgalagadi") || lower.includes("tsabong") || lower.includes("hukuntsi")) {
      const kglRes = await query(
        `SELECT id FROM geographic_districts WHERE name ILIKE '%Kgalagadi%' LIMIT 1`
      );
      if (kglRes.rows[0]) return kglRes.rows[0].id;
    }
    if (lower.includes("south-west") || lower.includes("south west")) {
      const swRes = await query(
        `SELECT id FROM geographic_districts WHERE name ILIKE '%South-West%' LIMIT 1`
      );
      if (swRes.rows[0]) return swRes.rows[0].id;
    }
    try {
      const insertRes = await query(
        `INSERT INTO geographic_districts (name, administrative_region, country_code, is_active, sort_order)
         VALUES ($1, $1, 'BW', true, 0)
         RETURNING id`,
        [cleanName || trimmed]
      );
      if (insertRes.rows[0]?.id) {
        clearReferenceCache("districts");
        return insertRes.rows[0].id;
      }
    } catch {
      const retry = await query(
        `SELECT id FROM geographic_districts WHERE LOWER(name) = LOWER($1) LIMIT 1`,
        [cleanName || trimmed]
      );
      if (retry.rows[0]?.id) return retry.rows[0].id;
    }
    const fallback = await query(`SELECT id FROM geographic_districts LIMIT 1`);
    if (fallback.rows[0]?.id) return fallback.rows[0].id;
  } catch (err) {
    console.warn("[RESOLVE DISTRICT ID NOTICE]", err);
  }
  return null;
}
function normalizeCompanyType(input) {
  if (!input) return "private_company";
  const lower = String(input).toLowerCase().trim();
  if (lower.includes("sole")) return "sole_proprietor";
  if (lower.includes("partner")) return "partnership";
  if (lower.includes("public")) return "public_company";
  if (lower.includes("coop")) return "cooperative";
  if (lower.includes("ngo") || lower.includes("non-profit")) return "ngo";
  if (lower.includes("joint") || lower.includes("jv")) return "joint_venture";
  if (lower.includes("other")) return "other";
  if (lower.includes("private") || lower.includes("pty") || lower.includes("ltd") || lower.includes("close")) return "private_company";
  const allowed = ["sole_proprietor", "partnership", "private_company", "public_company", "cooperative", "ngo", "joint_venture", "other"];
  if (allowed.includes(lower)) return lower;
  return "private_company";
}
var SuppliersRepository = class {
  constructor() {
    this.peopleHasGenderColumn = null;
    this.ensureGenderPromise = null;
  }
  async hasPeopleGenderColumn(autoMigrate = true) {
    if (this.peopleHasGenderColumn === true) return true;
    const checkExists = async () => {
      const res = await query(
        `SELECT EXISTS (
           SELECT 1
           FROM information_schema.columns
           WHERE table_schema = 'public'
             AND table_name = 'supplier_people'
             AND column_name = 'gender'
         ) AS exists`
      );
      return Boolean(res.rows[0]?.exists);
    };
    try {
      if (await checkExists()) {
        this.peopleHasGenderColumn = true;
        return true;
      }
      if (!autoMigrate) return false;
      if (!this.ensureGenderPromise) {
        this.ensureGenderPromise = (async () => {
          try {
            await query(
              `ALTER TABLE supplier_people ADD COLUMN IF NOT EXISTS gender VARCHAR(10) CHECK (gender IN ('male', 'female'))`
            );
            const created = await checkExists();
            if (created) {
              this.peopleHasGenderColumn = true;
              console.log("[DB MIGRATION] Added missing supplier_people.gender column.");
            }
            return created;
          } catch (err) {
            console.error("[DB MIGRATION] Could not add supplier_people.gender column:", err?.message || err);
            return false;
          } finally {
            this.ensureGenderPromise = null;
          }
        })();
      }
      return await this.ensureGenderPromise;
    } catch {
      return false;
    }
  }
  normalizeGenderInput(raw) {
    if (raw === void 0 || raw === null || raw === "") return null;
    const norm = String(raw).trim().toLowerCase();
    if (norm === "male" || norm === "female") return norm;
    const err = new Error("Gender must be male or female.");
    err.status = 400;
    err.code = "INVALID_GENDER";
    err.field = "gender";
    throw err;
  }
  /**
   * Recalculates and persists completeness only when called on data mutation events.
   * Never called on read operations.
   */
  async calculateCompleteness(supplierId) {
    try {
      const [sRes, pRes, dRes] = await Promise.all([
        query(
          `SELECT s.legal_name, s.trading_name, s.burs_tin, s.physical_address, s.city, s.district_id,
                  s.primary_phone, s.email, s.bank_name, s.bank_branch, s.account_number_masked,
                  s.citizen_owned_percentage, s.has_trading_licence
           FROM suppliers s WHERE s.id = $1`,
          [supplierId]
        ),
        query(
          `SELECT ownership_percent, ownership_percent AS "ownershipPercent", is_active FROM supplier_people WHERE supplier_id = $1 AND is_active = TRUE`,
          [supplierId]
        ),
        query(
          `SELECT dt.code, dt.name, sd.status, sdv.expiry_date, sdv.verification_status, sdv.file_name
           FROM supplier_documents sd
           JOIN document_types dt ON dt.id = sd.document_type_id
           LEFT JOIN supplier_document_versions sdv ON sdv.id = sd.current_version_id
           WHERE sd.supplier_id = $1 AND sd.status = 'active'`,
          [supplierId]
        )
      ]);
      if (sRes.rows.length === 0) return 0;
      const s = sRes.rows[0];
      const people = pRes.rows;
      const docs = dRes.rows;
      const result = computeSupplierCompleteness(s, people, docs);
      const missingLabels = result.missingItems.map((m) => m.label);
      await query(
        `UPDATE suppliers
         SET profile_completeness = $1,
             compliance_status = $2,
             missing_items = $3,
             profile_completeness_updated_at = NOW()
         WHERE id = $4`,
        [result.score, result.complianceStatus, missingLabels, supplierId]
      );
      return result.score;
    } catch (err) {
      console.warn("[RECALCULATE COMPLETENESS ERROR]", err);
      return 0;
    }
  }
  /**
   * PURE READ: Returns the supplier profile row without mutating the database or updating completeness.
   */
  async getById(supplierId) {
    const res = await query(
      `SELECT s.id, 
              s.legal_name AS "legalName", s.legal_name,
              s.trading_name AS "tradingName", s.trading_name,
              s.cipa_uin AS "cipaUin", s.cipa_uin AS "cipaNumber", s.cipa_uin,
              s.burs_tin AS "bursTin", s.burs_tin AS "tinNumber", s.burs_tin,
              s.ppra_registration_no AS "ppraRegistrationNo", s.ppra_registration_no AS "ppraCode", s.ppra_registration_no,
              s.company_type AS "companyType", s.company_type,
              s.year_established AS "yearEstablished", s.year_established,
              s.description,
              s.physical_address AS "physicalAddress", s.physical_address,
              s.postal_address AS "postalAddress", s.postal_address,
              s.city,
              s.district_id AS "districtId", s.district_id,
              gd.name AS "districtName", gd.name AS "district",
              s.primary_phone AS "primaryPhone", s.primary_phone,
              s.email,
              s.website,
              s.bank_name AS "bankName", s.bank_name,
              s.bank_branch AS "bankBranch", s.bank_branch,
              s.account_number_masked AS "accountNumberMasked", s.account_number_masked,
              s.employee_count_band AS "employeeCountBand",
              s.citizen_owned_percentage AS "citizenOwnedPercentage", s.citizen_owned_percentage,
              s.youth_owned AS "youthOwned", s.youth_owned,
              s.women_owned AS "womenOwned", s.women_owned,
              s.disability_owned AS "disabilityOwned", s.disability_owned,
              s.edd_certified AS "eddCertified", s.edd_certified,
              s.edd_certificate_no AS "eddCertificateNo", s.edd_certificate_no,
              s.edd_valid_until AS "eddValidUntil",
              s.has_trading_licence AS "hasTradingLicence", s.has_trading_licence,
              s.trading_licence_reason AS "tradingLicenceReason", s.trading_licence_reason,
              s.vat_registered AS "vatRegistered", s.vat_registered,
              s.citizen_ownership_set AS "citizenOwnershipSet", s.citizen_ownership_set,
              s.bidding_public_tenders AS "biddingPublicTenders", s.bidding_public_tenders,
              s.secondary_categories AS "secondaryCategories", s.secondary_categories,
              s.secondary_categories AS "categories",
              COALESCE(s.secondary_categories[1], '') AS "category",
              s.ppra_subcodes AS "ppraSubcodes", s.ppra_subcodes,
              s.ppra_grade AS "ppraGrade", s.ppra_grade,
              s.status,
              s.verification_status AS "verificationStatus", s.verification_status,
              s.compliance_status AS "complianceStatus", s.compliance_status,
              s.profile_completeness AS "profileCompleteness", s.profile_completeness,
              s.missing_items AS "missingItems", s.missing_items
       FROM suppliers s
       LEFT JOIN geographic_districts gd ON gd.id = s.district_id
       WHERE s.id = $1 AND s.deleted_at IS NULL`,
      [supplierId]
    );
    return res.rows[0] || null;
  }
  async updateProfile(supplierId, data) {
    const fields = [];
    const params = [supplierId];
    const legalName = data.legal_name !== void 0 ? data.legal_name : data.legalName;
    if (legalName !== void 0) {
      params.push(legalName ? String(legalName).trim() : null);
      fields.push(`legal_name = $${params.length}`);
    }
    const tradingName = data.trading_name !== void 0 ? data.trading_name : data.tradingName;
    if (tradingName !== void 0) {
      params.push(tradingName ? String(tradingName).trim() : null);
      fields.push(`trading_name = $${params.length}`);
    }
    const cipaUin = data.cipa_uin !== void 0 ? data.cipa_uin : data.cipaUin !== void 0 ? data.cipaUin : data.cipaNumber;
    if (cipaUin !== void 0) {
      params.push(cipaUin ? String(cipaUin).trim() : null);
      fields.push(`cipa_uin = $${params.length}`);
    }
    const bursTin = data.burs_tin !== void 0 ? data.burs_tin : data.bursTin !== void 0 ? data.bursTin : data.tinNumber;
    if (bursTin !== void 0) {
      params.push(bursTin ? String(bursTin).trim() : null);
      fields.push(`burs_tin = $${params.length}`);
    }
    const ppraReg = data.ppra_registration_no !== void 0 ? data.ppra_registration_no : data.ppraRegistrationNo !== void 0 ? data.ppraRegistrationNo : data.ppraCode;
    if (ppraReg !== void 0) {
      params.push(ppraReg ? String(ppraReg).trim() : null);
      fields.push(`ppra_registration_no = $${params.length}`);
    }
    const rawCompanyType = data.company_type !== void 0 ? data.company_type : data.companyType;
    if (rawCompanyType !== void 0) {
      params.push(normalizeCompanyType(rawCompanyType));
      fields.push(`company_type = $${params.length}`);
    }
    const yearEstablished = data.year_established !== void 0 ? data.year_established : data.yearEstablished;
    if (yearEstablished !== void 0) {
      const num = Number(yearEstablished);
      params.push(!isNaN(num) && num > 0 ? num : null);
      fields.push(`year_established = $${params.length}`);
    }
    if (data.description !== void 0) {
      params.push(data.description ? String(data.description).trim() : null);
      fields.push(`description = $${params.length}`);
    }
    const physicalAddress = data.physical_address !== void 0 ? data.physical_address : data.physicalAddress;
    if (physicalAddress !== void 0) {
      params.push(physicalAddress ? String(physicalAddress).trim() : null);
      fields.push(`physical_address = $${params.length}`);
    }
    const postalAddress = data.postal_address !== void 0 ? data.postal_address : data.postalAddress;
    if (postalAddress !== void 0) {
      params.push(postalAddress ? String(postalAddress).trim() : null);
      fields.push(`postal_address = $${params.length}`);
    }
    if (data.city !== void 0) {
      params.push(data.city ? String(data.city).trim() : null);
      fields.push(`city = $${params.length}`);
    }
    const rawDistrict = typeof data.district === "string" && data.district.trim() ? data.district.trim() : typeof data.district_id === "string" && data.district_id.trim() ? data.district_id.trim() : typeof data.districtId === "string" && data.districtId.trim() ? data.districtId.trim() : data.district !== void 0 ? data.district : data.district_id !== void 0 ? data.district_id : data.districtId;
    if (rawDistrict !== void 0) {
      const resolvedDistrictId = await resolveDistrictId(rawDistrict);
      params.push(resolvedDistrictId);
      fields.push(`district_id = $${params.length}`);
    }
    const primaryPhone = data.primary_phone !== void 0 ? data.primary_phone : data.primaryPhone !== void 0 ? data.primaryPhone : data.phone;
    if (primaryPhone !== void 0) {
      params.push(primaryPhone ? String(primaryPhone).trim() : null);
      fields.push(`primary_phone = $${params.length}`);
    }
    if (data.email !== void 0) {
      params.push(data.email ? String(data.email).trim().toLowerCase() : null);
      fields.push(`email = $${params.length}`);
    }
    if (data.website !== void 0) {
      params.push(data.website ? String(data.website).trim() : null);
      fields.push(`website = $${params.length}`);
    }
    const bankName = data.bank_name !== void 0 ? data.bank_name : data.bankName;
    if (bankName !== void 0) {
      params.push(bankName ? String(bankName).trim() : null);
      fields.push(`bank_name = $${params.length}`);
    }
    const bankBranch = data.bank_branch !== void 0 ? data.bank_branch : data.bankBranch;
    if (bankBranch !== void 0) {
      params.push(bankBranch ? String(bankBranch).trim() : null);
      fields.push(`bank_branch = $${params.length}`);
    }
    const accountMasked = data.account_number_masked !== void 0 ? data.account_number_masked : data.accountNumberMasked !== void 0 ? data.accountNumberMasked : data.bankAccountNumber !== void 0 ? data.bankAccountNumber : data.accountNumber;
    if (accountMasked !== void 0) {
      params.push(accountMasked ? String(accountMasked).trim() : null);
      fields.push(`account_number_masked = $${params.length}`);
    }
    const citizenPct = data.citizen_owned_percentage !== void 0 ? data.citizen_owned_percentage : data.citizenOwnedPercentage;
    if (citizenPct !== void 0) {
      const num = Number(citizenPct);
      params.push(!isNaN(num) ? num : 0);
      fields.push(`citizen_owned_percentage = $${params.length}`);
    }
    const youthOwned = data.youth_owned !== void 0 ? data.youth_owned : data.youthOwned;
    if (youthOwned !== void 0) {
      params.push(Boolean(youthOwned));
      fields.push(`youth_owned = $${params.length}`);
    }
    const womenOwned = data.women_owned !== void 0 ? data.women_owned : data.womenOwned;
    if (womenOwned !== void 0) {
      params.push(Boolean(womenOwned));
      fields.push(`women_owned = $${params.length}`);
    }
    const disabilityOwned = data.disability_owned !== void 0 ? data.disability_owned : data.disabilityOwned;
    if (disabilityOwned !== void 0) {
      params.push(Boolean(disabilityOwned));
      fields.push(`disability_owned = $${params.length}`);
    }
    const eddCertified = data.edd_certified !== void 0 ? data.edd_certified : data.eddCertified;
    if (eddCertified !== void 0) {
      params.push(Boolean(eddCertified));
      fields.push(`edd_certified = $${params.length}`);
    }
    if (data.edd_certificate_no !== void 0 || data.eddCertificateNo !== void 0) {
      const eddNo = data.edd_certificate_no !== void 0 ? data.edd_certificate_no : data.eddCertificateNo;
      params.push(eddNo ? String(eddNo).trim() : null);
      fields.push(`edd_certificate_no = $${params.length}`);
    }
    const hasTradingLicence = data.has_trading_licence !== void 0 ? data.has_trading_licence : data.hasTradingLicence;
    if (hasTradingLicence !== void 0) {
      params.push(hasTradingLicence === null ? null : Boolean(hasTradingLicence));
      fields.push(`has_trading_licence = $${params.length}`);
    }
    const tradingLicenceReason = data.trading_licence_reason !== void 0 ? data.trading_licence_reason : data.tradingLicenceReason;
    if (tradingLicenceReason !== void 0) {
      params.push(tradingLicenceReason ? String(tradingLicenceReason).trim() : null);
      fields.push(`trading_licence_reason = $${params.length}`);
    }
    const vatRegistered = data.vat_registered !== void 0 ? data.vat_registered : data.vatRegistered;
    if (vatRegistered !== void 0) {
      params.push(Boolean(vatRegistered));
      fields.push(`vat_registered = $${params.length}`);
    }
    const citizenOwnershipSet = data.citizen_ownership_set !== void 0 ? data.citizen_ownership_set : data.citizenOwnershipSet;
    if (citizenOwnershipSet !== void 0) {
      params.push(Boolean(citizenOwnershipSet));
      fields.push(`citizen_ownership_set = $${params.length}`);
    }
    const biddingPublicTenders = data.bidding_public_tenders !== void 0 ? data.bidding_public_tenders : data.biddingPublicTenders;
    if (biddingPublicTenders !== void 0) {
      params.push(Boolean(biddingPublicTenders));
      fields.push(`bidding_public_tenders = $${params.length}`);
    }
    const secondaryCategories = data.secondary_categories !== void 0 ? data.secondary_categories : data.secondaryCategories !== void 0 ? data.secondaryCategories : data.categories;
    if (secondaryCategories !== void 0) {
      params.push(Array.isArray(secondaryCategories) ? secondaryCategories.map((c) => String(c).trim()).filter(Boolean) : []);
      fields.push(`secondary_categories = $${params.length}`);
    }
    const ppraSubcodes = data.ppra_subcodes !== void 0 ? data.ppra_subcodes : data.ppraSubcodes;
    if (ppraSubcodes !== void 0) {
      params.push(Array.isArray(ppraSubcodes) ? ppraSubcodes.map((c) => String(c)) : []);
      fields.push(`ppra_subcodes = $${params.length}`);
    }
    const ppraGrade = data.ppra_grade !== void 0 ? data.ppra_grade : data.ppraGrade;
    if (ppraGrade !== void 0) {
      params.push(ppraGrade ? String(ppraGrade).trim().slice(0, 50) : null);
      fields.push(`ppra_grade = $${params.length}`);
    }
    if (!fields.length) {
      const current = await this.getById(supplierId);
      if (!current) throw new Error("Supplier not found.");
      return current;
    }
    fields.push(`updated_at = NOW()`);
    await query(
      `UPDATE suppliers SET ${fields.join(", ")} WHERE id = $1`,
      params
    );
    await this.calculateCompleteness(supplierId);
    const updated = await this.getById(supplierId);
    if (!updated) throw new Error("Supplier not found after update.");
    return updated;
  }
  async listPeople(supplierId) {
    const encryptionKey = getIdKey();
    const hasGender = await this.hasPeopleGenderColumn();
    const genderSelect = hasGender ? "gender," : "NULL::varchar AS gender,";
    const res = await query(
      `SELECT id, supplier_id AS "supplierId", full_name AS "fullName",
              person_role AS "personRole", person_role,
              ownership_percent AS "ownershipPercent", ownership_percent,
              is_active AS "isActive", is_active,
              identity_type AS "identityType", ${genderSelect} nationality, is_citizen AS "isCitizen",
              email, phone, date_of_birth AS "dateOfBirth",
              kyc_status AS "kycStatus", kyc_verified_at AS "kycVerifiedAt", kyc_reference AS "kycReference",
              CASE WHEN national_identity_number_encrypted IS NOT NULL
                   THEN RIGHT(pgp_sym_decrypt(national_identity_number_encrypted, $2), 4)
                   ELSE NULL END AS "idLast4",
              national_identity_number_encrypted IS NOT NULL AS "hasId"
       FROM supplier_people
       WHERE supplier_id = $1 AND is_active = TRUE
       ORDER BY created_at ASC`,
      [supplierId, encryptionKey]
    );
    return res.rows;
  }
  async addPerson(supplierId, person, user) {
    const encryptionKey = getIdKey();
    const hasGender = await this.hasPeopleGenderColumn();
    const fullName = person.fullName ? String(person.fullName).trim() : "";
    if (!fullName || fullName.length < 2 || fullName.length > 200) {
      const err = new Error("Full name is required and must be between 2 and 200 characters.");
      err.status = 400;
      err.code = "INVALID_FULL_NAME";
      err.field = "fullName";
      throw err;
    }
    const role = ["director", "owner", "shareholder", "authorised_signatory", "other"].includes(person.personRole) ? person.personRole : "director";
    const ownership = person.ownershipPercent !== void 0 && !isNaN(Number(person.ownershipPercent)) ? Number(person.ownershipPercent) : 0;
    if (ownership < 0 || ownership > 100) {
      const err = new Error("Ownership percentage must be between 0 and 100.");
      err.status = 400;
      err.code = "INVALID_OWNERSHIP";
      err.field = "ownershipPercent";
      throw err;
    }
    if (["director", "shareholder", "owner"].includes(role)) {
      const currentActive = await query(
        `SELECT SUM(ownership_percent) AS total FROM supplier_people WHERE supplier_id = $1 AND is_active = TRUE AND LOWER(person_role) IN ('director', 'shareholder', 'owner')`,
        [supplierId]
      );
      const currentSum = Number(currentActive.rows[0]?.total || 0);
      const newTotal = currentSum + ownership;
      if (newTotal > 100) {
        const err = new Error(`Ownership would total ${newTotal}%. It cannot be more than 100%.`);
        err.status = 400;
        err.code = "OWNERSHIP_EXCEEDED";
        err.field = "ownershipPercent";
        throw err;
      }
    }
    const identityType = person.identityType === "PASSPORT" ? "PASSPORT" : "OMANG";
    const isCitizen = identityType === "OMANG";
    const nationality = person.nationality || (isCitizen ? "Motswana" : "Foreign");
    const gender = this.normalizeGenderInput(person.gender);
    const rawIdNumber = person.idNumber ? String(person.idNumber).trim() : "";
    if (identityType === "OMANG" && !hasGender) {
      const err = new Error("Could not save gender because the supplier_people.gender column is missing in the database.");
      err.status = 500;
      err.code = "GENDER_COLUMN_MISSING";
      err.field = "gender";
      throw err;
    }
    let finalIdNumber = null;
    if (identityType === "OMANG") {
      if (rawIdNumber) {
        const omangCheck = validateOmang(rawIdNumber, gender);
        if (!omangCheck.ok) {
          const err = new Error(omangCheck.message);
          err.status = 400;
          err.code = omangCheck.code;
          err.field = "idNumber";
          throw err;
        }
        if (!gender) {
          const err = new Error("Gender is required for Omang ID.");
          err.status = 400;
          err.code = "GENDER_REQUIRED";
          err.field = "gender";
          throw err;
        }
        finalIdNumber = omangCheck.normalised;
      } else {
        const err = new Error("ID number must be 9 digits.");
        err.status = 400;
        err.code = "INVALID_LENGTH_OR_CHARS";
        err.field = "idNumber";
        throw err;
      }
    } else if (rawIdNumber) {
      finalIdNumber = rawIdNumber.toUpperCase();
    }
    let identityHash = null;
    if (finalIdNumber) {
      const normalizedForHash = identityType === "OMANG" ? normaliseOmang(finalIdNumber) : finalIdNumber.toUpperCase();
      identityHash = crypto4.createHmac("sha256", getIdHashKey()).update(normalizedForHash).digest("hex");
      const dupCheck = await query(
        `SELECT id FROM supplier_people WHERE supplier_id = $1 AND national_identity_hash = $2 AND is_active = TRUE LIMIT 1`,
        [supplierId, identityHash]
      );
      if (dupCheck.rows.length > 0) {
        const err = new Error("A director or person with this identification number already exists for this supplier.");
        err.status = 400;
        err.code = "DUPLICATE_IDENTITY";
        err.field = "idNumber";
        throw err;
      }
    }
    const initialKycStatus = finalIdNumber ? "pending" : "not_started";
    const newPersonId = await tx(async (client) => {
      const insertSql = hasGender ? `INSERT INTO supplier_people (
             supplier_id, full_name, person_role, ownership_percent, identity_type, gender,
             nationality, is_citizen, email, phone, date_of_birth,
             national_identity_number_encrypted, national_identity_hash, kyc_status, is_active
           ) VALUES (
             $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
             CASE WHEN $12::text IS NOT NULL THEN pgp_sym_encrypt($12, $13) ELSE NULL END,
             $14, $15, TRUE
           ) RETURNING id` : `INSERT INTO supplier_people (
             supplier_id, full_name, person_role, ownership_percent, identity_type,
             nationality, is_citizen, email, phone, date_of_birth,
             national_identity_number_encrypted, national_identity_hash, kyc_status, is_active
           ) VALUES (
             $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
             CASE WHEN $11::text IS NOT NULL THEN pgp_sym_encrypt($11, $12) ELSE NULL END,
             $13, $14, TRUE
           ) RETURNING id`;
      const insertParams = hasGender ? [
        supplierId,
        fullName,
        role,
        ownership,
        identityType,
        gender,
        nationality,
        isCitizen,
        person.email || null,
        person.phone || null,
        person.dateOfBirth || null,
        finalIdNumber,
        encryptionKey,
        identityHash,
        initialKycStatus
      ] : [
        supplierId,
        fullName,
        role,
        ownership,
        identityType,
        nationality,
        isCitizen,
        person.email || null,
        person.phone || null,
        person.dateOfBirth || null,
        finalIdNumber,
        encryptionKey,
        identityHash,
        initialKycStatus
      ];
      const insertRes = await client.query(insertSql, insertParams);
      return insertRes.rows[0].id;
    });
    try {
      await auditRepository.logEvent({
        actorName: user?.fullName || "Supplier Administrator",
        actorRole: user?.role || "Supplier",
        supplierId,
        action: "CREATED_SUPPLIER_PERSON",
        entityType: "supplier_person",
        entityId: newPersonId,
        details: `Added person ${fullName} (${role})`
      });
      await this.calculateCompleteness(supplierId);
    } catch (e) {
      console.warn("[ADD PERSON AUDIT/COMPLETENESS WARNING]:", e.message);
    }
    const genderSelect = hasGender ? "gender," : "NULL::varchar AS gender,";
    const fetched = await query(
      `SELECT id, supplier_id AS "supplierId", full_name AS "fullName",
              person_role AS "personRole", ownership_percent AS "ownershipPercent",
              identity_type AS "identityType", ${genderSelect} nationality, is_citizen AS "isCitizen",
              email, phone, date_of_birth AS "dateOfBirth",
              kyc_status AS "kycStatus", kyc_verified_at AS "kycVerifiedAt", kyc_reference AS "kycReference",
              CASE WHEN national_identity_number_encrypted IS NOT NULL
                   THEN RIGHT(pgp_sym_decrypt(national_identity_number_encrypted, $2), 4)
                   ELSE NULL END AS "idLast4",
              national_identity_number_encrypted IS NOT NULL AS "hasId"
       FROM supplier_people WHERE id = $1`,
      [newPersonId, encryptionKey]
    );
    return fetched.rows[0];
  }
  async updatePerson(supplierId, personId, person, user) {
    const encryptionKey = getIdKey();
    const hasGender = await this.hasPeopleGenderColumn();
    const existing = await query(
      `SELECT id, full_name, ownership_percent, person_role, identity_type, kyc_status,
              ${hasGender ? "gender," : "NULL::varchar AS gender,"}
              CASE WHEN national_identity_number_encrypted IS NOT NULL
                   THEN pgp_sym_decrypt(national_identity_number_encrypted, $3)
                   ELSE NULL END AS existing_id
       FROM supplier_people
       WHERE id = $1 AND supplier_id = $2 AND is_active = TRUE`,
      [personId, supplierId, encryptionKey]
    );
    if (existing.rows.length === 0) {
      const err = new Error("Person not found or unauthorized.");
      err.status = 404;
      err.code = "NOT_FOUND";
      throw err;
    }
    const existingRow = existing.rows[0];
    const fullName = person.fullName !== void 0 ? String(person.fullName).trim() : void 0;
    if (fullName !== void 0 && (fullName.length < 2 || fullName.length > 200)) {
      const err = new Error("Full name is required and must be between 2 and 200 characters.");
      err.status = 400;
      err.code = "INVALID_FULL_NAME";
      err.field = "fullName";
      throw err;
    }
    const role = person.personRole !== void 0 ? person.personRole : void 0;
    const ownership = person.ownershipPercent !== void 0 ? Number(person.ownershipPercent) : void 0;
    const identityType = person.identityType !== void 0 ? person.identityType === "PASSPORT" ? "PASSPORT" : "OMANG" : void 0;
    const effectiveIdentityType = identityType ?? (existingRow.identity_type === "PASSPORT" ? "PASSPORT" : "OMANG");
    const requestedGender = person.gender !== void 0 ? this.normalizeGenderInput(person.gender) : void 0;
    const effectiveGender = requestedGender !== void 0 ? requestedGender : existingRow.gender ?? null;
    const rawIdNumber = person.idNumber !== void 0 && String(person.idNumber).trim() !== "" ? String(person.idNumber).trim() : void 0;
    if (ownership !== void 0 && (isNaN(ownership) || ownership < 0 || ownership > 100)) {
      const err = new Error("Ownership percentage must be between 0 and 100.");
      err.status = 400;
      err.code = "INVALID_OWNERSHIP";
      err.field = "ownershipPercent";
      throw err;
    }
    if (ownership !== void 0) {
      const currentActive = await query(
        `SELECT SUM(ownership_percent) AS total FROM supplier_people WHERE supplier_id = $1 AND id != $2 AND is_active = TRUE AND LOWER(person_role) IN ('director', 'shareholder', 'owner')`,
        [supplierId, personId]
      );
      const currentSum = Number(currentActive.rows[0]?.total || 0);
      const newTotal = currentSum + ownership;
      if (newTotal > 100) {
        const err = new Error(`Ownership would total ${newTotal}%. It cannot be more than 100%.`);
        err.status = 400;
        err.code = "OWNERSHIP_EXCEEDED";
        err.field = "ownershipPercent";
        throw err;
      }
    }
    let finalIdNumber;
    if (effectiveIdentityType === "OMANG") {
      const idToValidate = rawIdNumber ?? existingRow.existing_id ?? "";
      if (rawIdNumber !== void 0) {
        const omangCheck = validateOmang(rawIdNumber, effectiveGender);
        if (!omangCheck.ok) {
          const err = new Error(omangCheck.message);
          err.status = 400;
          err.code = omangCheck.code;
          err.field = "idNumber";
          throw err;
        }
        if (!effectiveGender) {
          const err = new Error("Gender is required for Omang ID.");
          err.status = 400;
          err.code = "GENDER_REQUIRED";
          err.field = "gender";
          throw err;
        }
        finalIdNumber = omangCheck.normalised;
      } else if (person.gender !== void 0 || identityType === "OMANG") {
        if (idToValidate) {
          const omangCheck = validateOmang(idToValidate, effectiveGender);
          if (!omangCheck.ok) {
            const err = new Error(omangCheck.message);
            err.status = 400;
            err.code = omangCheck.code;
            err.field = "idNumber";
            throw err;
          }
        }
        if (!effectiveGender) {
          const err = new Error("Gender is required for Omang ID.");
          err.status = 400;
          err.code = "GENDER_REQUIRED";
          err.field = "gender";
          throw err;
        }
      }
    } else if (rawIdNumber !== void 0) {
      finalIdNumber = rawIdNumber.toUpperCase();
    }
    let identityHash = null;
    if (finalIdNumber) {
      const normalizedForHash = effectiveIdentityType === "OMANG" ? normaliseOmang(finalIdNumber) : finalIdNumber.toUpperCase();
      identityHash = crypto4.createHmac("sha256", getIdHashKey()).update(normalizedForHash).digest("hex");
      const dupCheck = await query(
        `SELECT id FROM supplier_people WHERE supplier_id = $1 AND national_identity_hash = $2 AND id != $3 AND is_active = TRUE LIMIT 1`,
        [supplierId, identityHash, personId]
      );
      if (dupCheck.rows.length > 0) {
        const err = new Error("A director or person with this identification number already exists for this supplier.");
        err.status = 400;
        err.code = "DUPLICATE_IDENTITY";
        err.field = "idNumber";
        throw err;
      }
    }
    if (!hasGender && (person.gender !== void 0 || effectiveIdentityType === "OMANG")) {
      const err = new Error("Could not save gender because the supplier_people.gender column is missing in the database.");
      err.status = 500;
      err.code = "GENDER_COLUMN_MISSING";
      err.field = "gender";
      throw err;
    }
    const identityFieldsChanged = fullName !== void 0 && fullName !== existingRow.full_name || identityType !== void 0 && identityType !== existingRow.identity_type || requestedGender !== void 0 && requestedGender !== (existingRow.gender ?? null) || finalIdNumber !== void 0 && finalIdNumber !== (existingRow.existing_id ?? void 0);
    const shouldResetKyc = identityFieldsChanged && (existingRow.kyc_status === "verified" || existingRow.kyc_status === "failed" || existingRow.kyc_status === "not_started");
    await tx(async (client) => {
      const updateSql = hasGender ? `UPDATE supplier_people
           SET full_name = COALESCE($3, full_name),
               person_role = COALESCE($4, person_role),
               ownership_percent = COALESCE($5, ownership_percent),
               identity_type = COALESCE($6, identity_type),
               gender = CASE WHEN $7::boolean THEN $8::varchar ELSE gender END,
               is_citizen = CASE WHEN $6::text IS NOT NULL THEN ($6 = 'OMANG') ELSE is_citizen END,
               nationality = COALESCE($9, nationality),
               email = COALESCE($10, email),
               phone = COALESCE($11, phone),
               date_of_birth = COALESCE($12, date_of_birth),
               national_identity_number_encrypted = CASE WHEN $13::text IS NOT NULL THEN pgp_sym_encrypt($13, $14) ELSE national_identity_number_encrypted END,
               national_identity_hash = COALESCE($15, national_identity_hash),
               kyc_status = CASE WHEN $16::boolean THEN 'pending' ELSE kyc_status END,
               kyc_verified_at = CASE WHEN $16::boolean THEN NULL ELSE kyc_verified_at END,
               kyc_reference = CASE WHEN $16::boolean THEN NULL ELSE kyc_reference END,
               updated_at = NOW()
           WHERE id = $2 AND supplier_id = $1` : `UPDATE supplier_people
           SET full_name = COALESCE($3, full_name),
               person_role = COALESCE($4, person_role),
               ownership_percent = COALESCE($5, ownership_percent),
               identity_type = COALESCE($6, identity_type),
               is_citizen = CASE WHEN $6::text IS NOT NULL THEN ($6 = 'OMANG') ELSE is_citizen END,
               nationality = COALESCE($7, nationality),
               email = COALESCE($8, email),
               phone = COALESCE($9, phone),
               date_of_birth = COALESCE($10, date_of_birth),
               national_identity_number_encrypted = CASE WHEN $11::text IS NOT NULL THEN pgp_sym_encrypt($11, $12) ELSE national_identity_number_encrypted END,
               national_identity_hash = COALESCE($13, national_identity_hash),
               kyc_status = CASE WHEN $14::boolean THEN 'pending' ELSE kyc_status END,
               kyc_verified_at = CASE WHEN $14::boolean THEN NULL ELSE kyc_verified_at END,
               kyc_reference = CASE WHEN $14::boolean THEN NULL ELSE kyc_reference END,
               updated_at = NOW()
           WHERE id = $2 AND supplier_id = $1`;
      const updateParams = hasGender ? [
        supplierId,
        personId,
        fullName || null,
        role || null,
        ownership !== void 0 ? ownership : null,
        identityType || null,
        person.gender !== void 0,
        requestedGender ?? null,
        person.nationality || null,
        person.email || null,
        person.phone || null,
        person.dateOfBirth || null,
        finalIdNumber || null,
        encryptionKey,
        identityHash !== void 0 ? identityHash : null,
        shouldResetKyc
      ] : [
        supplierId,
        personId,
        fullName || null,
        role || null,
        ownership !== void 0 ? ownership : null,
        identityType || null,
        person.nationality || null,
        person.email || null,
        person.phone || null,
        person.dateOfBirth || null,
        finalIdNumber || null,
        encryptionKey,
        identityHash !== void 0 ? identityHash : null,
        shouldResetKyc
      ];
      await client.query(updateSql, updateParams);
    });
    try {
      await auditRepository.logEvent({
        actorName: user?.fullName || "Supplier Administrator",
        actorRole: user?.role || "Supplier",
        supplierId,
        action: "UPDATED_SUPPLIER_PERSON",
        entityType: "supplier_person",
        entityId: personId,
        details: `Updated person record ${personId}`
      });
      await this.calculateCompleteness(supplierId);
    } catch (e) {
      console.warn("[UPDATE PERSON AUDIT/COMPLETENESS WARNING]:", e.message);
    }
    const genderSelect = hasGender ? "gender," : "NULL::varchar AS gender,";
    const fetched = await query(
      `SELECT id, supplier_id AS "supplierId", full_name AS "fullName",
              person_role AS "personRole", ownership_percent AS "ownershipPercent",
              identity_type AS "identityType", ${genderSelect} nationality, is_citizen AS "isCitizen",
              email, phone, date_of_birth AS "dateOfBirth",
              kyc_status AS "kycStatus", kyc_verified_at AS "kycVerifiedAt", kyc_reference AS "kycReference",
              CASE WHEN national_identity_number_encrypted IS NOT NULL
                   THEN RIGHT(pgp_sym_decrypt(national_identity_number_encrypted, $2), 4)
                   ELSE NULL END AS "idLast4",
              national_identity_number_encrypted IS NOT NULL AS "hasId"
       FROM supplier_people WHERE id = $1`,
      [personId, encryptionKey]
    );
    return fetched.rows[0];
  }
  async deletePerson(supplierId, personId, user) {
    const result = await tx(async (client) => {
      const checkRes = await client.query(
        `SELECT id, is_active FROM supplier_people WHERE id = $1 AND supplier_id = $2`,
        [personId, supplierId]
      );
      if (checkRes.rows.length === 0) {
        const err = new Error("This person was not found.");
        err.status = 404;
        err.code = "not_found";
        throw err;
      }
      const personRecord = checkRes.rows[0];
      if (!personRecord.is_active) {
        return { ok: true, alreadyRemoved: true };
      }
      const res = await client.query(
        `UPDATE supplier_people SET is_active = FALSE, updated_at = NOW() WHERE id = $1 AND supplier_id = $2 AND is_active = TRUE`,
        [personId, supplierId]
      );
      return { ok: true, id: personId };
    });
    if (result.ok && !result.alreadyRemoved) {
      try {
        await auditRepository.logEvent({
          actorName: user?.fullName || "Supplier Administrator",
          actorRole: user?.role || "Supplier",
          supplierId,
          action: "supplier_person.remove",
          entityType: "supplier_person",
          entityId: personId,
          details: `Removed person record ${personId}`
        });
        await this.calculateCompleteness(supplierId);
      } catch (e) {
        console.warn("[DELETE PERSON AUDIT/COMPLETENESS WARNING]:", e.message);
      }
    }
    return result;
  }
  async listProjects(supplierId) {
    const res = await query(
      `SELECT id, supplier_id AS "supplierId", client_name AS "clientName", client_name AS "client",
              project_title AS "projectTitle", project_title AS "title", description,
              contract_value AS "contractValue", contract_value AS "valueBWP",
              currency, start_date AS "startDate", end_date AS "endDate",
              reference_name AS "referenceName", reference_contact AS "referenceContactRaw",
              reference_verified AS "referenceVerified"
       FROM supplier_projects
       WHERE supplier_id = $1
       ORDER BY start_date DESC NULLS LAST, created_at DESC`,
      [supplierId]
    );
    return res.rows.map((row) => {
      let refContactObj;
      if (row.referenceContactRaw) {
        try {
          const parsed = JSON.parse(row.referenceContactRaw);
          if (parsed && typeof parsed === "object") {
            refContactObj = {
              name: parsed.name || row.referenceName || "",
              phone: parsed.phone || "",
              email: parsed.email || ""
            };
          }
        } catch {
          refContactObj = {
            name: row.referenceName || "",
            phone: String(row.referenceContactRaw),
            email: ""
          };
        }
      } else if (row.referenceName) {
        refContactObj = { name: row.referenceName, phone: "", email: "" };
      }
      return {
        ...row,
        valueBWP: row.valueBWP !== null && row.valueBWP !== void 0 ? Number(row.valueBWP) : 0,
        status: row.endDate ? "Completed" : "Ongoing",
        referenceContact: refContactObj || row.referenceContactRaw || null
      };
    });
  }
  normalizeProjectInput(project) {
    const clientName = String(project.clientName ?? project.client ?? "").trim();
    const projectTitle = String(project.projectTitle ?? project.title ?? "").trim();
    if (!clientName || !projectTitle) {
      throw new Error("Project title and client name are required.");
    }
    const rawVal = project.contractValue ?? project.valueBWP;
    const contractValue = rawVal !== void 0 && rawVal !== null && rawVal !== "" ? Number(rawVal) : null;
    const currency = project.currency ? String(project.currency).trim().slice(0, 3).toUpperCase() : "BWP";
    const description = project.description ? String(project.description).trim() : null;
    const startDate = parseProjectDate(project.startDate);
    const endDate = String(project.status || "").toLowerCase() === "ongoing" ? null : parseProjectDate(project.endDate);
    let referenceName = project.referenceName ? String(project.referenceName).trim() : null;
    let referenceContact = null;
    if (project.referenceContact && typeof project.referenceContact === "object") {
      referenceName = referenceName || (project.referenceContact.name ? String(project.referenceContact.name).trim() : null);
      const serialized = JSON.stringify({
        name: project.referenceContact.name || referenceName || "",
        phone: project.referenceContact.phone || "",
        email: project.referenceContact.email || ""
      });
      referenceContact = serialized;
    } else if (project.referenceContact) {
      referenceContact = String(project.referenceContact).trim();
    }
    return { clientName, projectTitle, contractValue, currency, description, startDate, endDate, referenceName, referenceContact };
  }
  async addProject(supplierId, project) {
    const p = this.normalizeProjectInput(project);
    const res = await query(
      `INSERT INTO supplier_projects (
         supplier_id, client_name, project_title, contract_value, currency,
         description, start_date, end_date, reference_name, reference_contact
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       RETURNING id`,
      [supplierId, p.clientName, p.projectTitle, p.contractValue, p.currency, p.description, p.startDate, p.endDate, p.referenceName, p.referenceContact]
    );
    const createdId = res.rows[0].id;
    const all = await this.listProjects(supplierId);
    return all.find((item) => item.id === createdId) || { id: createdId, ...p };
  }
  async updateProject(supplierId, projectId, project) {
    const p = this.normalizeProjectInput(project);
    const res = await query(
      `UPDATE supplier_projects
       SET client_name = $3,
           project_title = $4,
           contract_value = $5,
           currency = $6,
           description = $7,
           start_date = $8,
           end_date = $9,
           reference_name = $10,
           reference_contact = $11,
           updated_at = NOW()
       WHERE id = $1 AND supplier_id = $2
       RETURNING id`,
      [projectId, supplierId, p.clientName, p.projectTitle, p.contractValue, p.currency, p.description, p.startDate, p.endDate, p.referenceName, p.referenceContact]
    );
    if (!res.rows.length) return null;
    const all = await this.listProjects(supplierId);
    return all.find((item) => item.id === projectId) || null;
  }
  async deleteProject(supplierId, projectId) {
    const res = await query(
      `DELETE FROM supplier_projects WHERE id = $1 AND supplier_id = $2`,
      [projectId, supplierId]
    );
    return (res.rowCount || 0) > 0;
  }
  async listTeam(supplierId) {
    const [membersRes, invitesRes] = await Promise.all([
      query(
        `SELECT sm.id, sm.user_id AS "userId", u.full_name AS "name", u.email::text AS email,
                r.name AS "role", sm.status, sm.is_owner AS "isOwner", sm.joined_at AS "joinedAt"
         FROM supplier_members sm
         JOIN users u ON u.id = sm.user_id AND u.deleted_at IS NULL
         JOIN roles r ON r.id = sm.role_id
         WHERE sm.supplier_id = $1 AND sm.status != 'removed'
         ORDER BY sm.is_owner DESC, sm.created_at ASC`,
        [supplierId]
      ),
      query(
        `SELECT i.id, i.email::text AS email, r.name AS "role",
                i.created_at AS "sentAt", i.expires_at AS "expiresAt"
         FROM invitations i
         JOIN roles r ON r.id = i.role_id
         WHERE i.supplier_id = $1
           AND i.accepted_at IS NULL
           AND i.revoked_at IS NULL
           AND i.expires_at > NOW()
         ORDER BY i.created_at DESC`,
        [supplierId]
      )
    ]);
    return {
      teamMembers: membersRes.rows.map((m) => ({
        id: m.id,
        userId: m.userId,
        name: m.name || m.email,
        email: m.email,
        role: m.role,
        status: m.status === "active" ? "Active" : "Invited",
        isOwner: m.isOwner
      })),
      pendingInvitations: invitesRes.rows.map((inv) => ({
        id: inv.id,
        email: inv.email,
        role: inv.role,
        sentAt: inv.sentAt,
        expiresAt: inv.expiresAt
      }))
    };
  }
  async inviteTeamMember(supplierId, data) {
    const cleanEmail = String(data.email || "").trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      throw new Error("A valid email address is required.");
    }
    const roleName = String(data.role || "Bid Contributor").trim();
    const roleRes = await query(
      `SELECT id, name FROM roles
       WHERE scope = 'supplier'
         AND (LOWER(name) = LOWER($1) OR name IN ('Bid Contributor', 'Supplier Admin'))
       ORDER BY CASE
         WHEN LOWER(name) = LOWER($1) THEN 0
         WHEN name = 'Bid Contributor' THEN 1
         ELSE 2 END
       LIMIT 1`,
      [roleName]
    );
    const roleRow = roleRes.rows[0];
    if (!roleRow) {
      throw new Error("Supplier role configuration not found.");
    }
    const rawToken = generateRandomToken(32);
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1e3);
    await query(
      `UPDATE invitations
       SET revoked_at = NOW()
       WHERE supplier_id = $1 AND LOWER(email::text) = LOWER($2) AND accepted_at IS NULL AND revoked_at IS NULL`,
      [supplierId, cleanEmail]
    );
    const invRes = await query(
      `INSERT INTO invitations (supplier_id, email, role_id, token_hash, invited_by_user_id, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email::text AS email, created_at, expires_at`,
      [supplierId, cleanEmail, roleRow.id, tokenHash, data.invitedByUserId, expiresAt]
    );
    const row = invRes.rows[0];
    return {
      id: row.id,
      email: row.email,
      role: roleRow.name,
      sentAt: row.created_at,
      expiresAt: row.expires_at,
      inviteToken: rawToken
    };
  }
  async revokeInvitation(supplierId, invitationId) {
    const res = await query(
      `UPDATE invitations
       SET revoked_at = NOW()
       WHERE id = $1 AND supplier_id = $2 AND accepted_at IS NULL AND revoked_at IS NULL`,
      [invitationId, supplierId]
    );
    return (res.rowCount || 0) > 0;
  }
  async getDisciplines(supplierId) {
    const res = await query(
      `SELECT sda.id, sda.supplier_id AS "supplierId", sda.discipline_id AS "disciplineId",
              pd.code AS "disciplineCode", pd.title AS "disciplineTitle",
              sda.capability_tier_id AS "capabilityTierId", ct.code AS "capabilityTierCode", ct.name AS "capabilityTierName",
              sda.is_primary AS "isPrimary"
       FROM supplier_discipline_allocations sda
       JOIN procurement_disciplines pd ON pd.id = sda.discipline_id
       LEFT JOIN capability_tiers ct ON ct.id = sda.capability_tier_id
       WHERE sda.supplier_id = $1
       ORDER BY sda.is_primary DESC, pd.code ASC`,
      [supplierId]
    );
    return res.rows;
  }
};
var suppliersRepository = new SuppliersRepository();

// server/repositories/documents.repository.ts
import crypto5 from "crypto";
var UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
var SAFE_INLINE_MIME_TYPES = /* @__PURE__ */ new Set([
  "application/pdf",
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/msword",
  "text/plain",
  "text/csv"
]);
function detectSafeMimeType(buffer, storedMime, fileName) {
  if (buffer && buffer.length >= 4) {
    const head = buffer.subarray(0, Math.min(1024, buffer.length));
    if (head.includes(Buffer.from("%PDF"))) {
      return "application/pdf";
    }
    if (buffer[0] === 137 && buffer[1] === 80 && buffer[2] === 78 && buffer[3] === 71) {
      return "image/png";
    }
    if (buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) {
      return "image/jpeg";
    }
    if (buffer.length >= 6 && (head.subarray(0, 6).toString("ascii") === "GIF87a" || head.subarray(0, 6).toString("ascii") === "GIF89a")) {
      return "image/gif";
    }
    if (buffer.length >= 12 && head.subarray(0, 4).toString("ascii") === "RIFF" && head.subarray(8, 12).toString("ascii") === "WEBP") {
      return "image/webp";
    }
    if (buffer[0] === 80 && buffer[1] === 75 && buffer[2] === 3 && buffer[3] === 4) {
      const ext2 = (fileName || "").split(".").pop()?.toLowerCase();
      if (ext2 === "docx" || (storedMime || "").toLowerCase().includes("wordprocessingml")) {
        return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      }
    }
    if (buffer[0] === 208 && buffer[1] === 207 && buffer[2] === 17 && buffer[3] === 224) {
      return "application/msword";
    }
  }
  const normalizedStored = String(storedMime || "").split(";")[0].trim().toLowerCase();
  if (normalizedStored === "image/jpg") {
    return "image/jpeg";
  }
  if (SAFE_INLINE_MIME_TYPES.has(normalizedStored)) {
    return normalizedStored;
  }
  const ext = (fileName || "").split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "application/pdf";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "webp") return "image/webp";
  if (ext === "gif") return "image/gif";
  if (ext === "docx") return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (ext === "doc") return "application/msword";
  if (ext === "txt") return "text/plain";
  if (ext === "csv") return "text/csv";
  return "application/octet-stream";
}
var DocumentsRepository = class {
  /**
   * Retrieves all documents with their latest pinned versions and computed expiry states.
   * NOTE: List responses NEVER contain file bytes.
   */
  async listBySupplier(supplierId) {
    const res = await query(
      `SELECT d.id AS "documentId", d.supplier_id AS "supplierId",
              dt.id AS "documentTypeId", dt.code AS "documentTypeCode", dt.name AS "documentTypeName",
              dt.issuing_authority AS "issuingAuthority", dt.requires_expiry AS "requiresExpiry",
              d.title, d.status,
              v.id AS "versionId", v.version_no AS "versionNo", v.storage_key AS "storageKey",
              v.file_name AS "fileName", v.mime_type AS "mimeType", v.file_size_bytes AS "fileSizeBytes",
              v.sha256, v.document_number AS "documentNumber", v.issue_date AS "issueDate",
              v.expiry_date AS "expiryDate", v.verification_status AS "verificationStatus",
              v.verified_via AS "verifiedVia", v.verified_at AS "verifiedAt",
              v.verification_notes AS "verificationNotes", v.rejection_reason AS "rejectionReason",
              v.uploaded_at AS "uploadedAt",
              EXISTS (
                SELECT 1 FROM document_files f
                WHERE f.document_version_id = v.id AND octet_length(f.content) > 0
              ) AS "hasFile",
              CASE WHEN v.expiry_date IS NOT NULL THEN (v.expiry_date - CURRENT_DATE) ELSE NULL END AS "daysToExpiry",
              CASE
                WHEN v.expiry_date IS NULL THEN 'NO_EXPIRY'
                WHEN v.expiry_date < CURRENT_DATE THEN 'EXPIRED'
                WHEN v.expiry_date <= CURRENT_DATE + INTERVAL '90 days' THEN 'EXPIRING_SOON'
                ELSE 'VALID'
              END AS "expiryState"
       FROM supplier_documents d
       JOIN document_types dt ON dt.id = d.document_type_id
       LEFT JOIN supplier_document_versions v ON v.id = d.current_version_id
       WHERE d.supplier_id = $1 AND d.status = 'active'
       ORDER BY dt.sort_order ASC, d.created_at DESC`,
      [supplierId]
    );
    return res.rows;
  }
  /**
   * Upload a new document or add an immutable new version to an existing document container.
   * Saves bytes in document_files and version in supplier_document_versions in the SAME transaction.
   * Validates hash integrity after saving.
   */
  async uploadVersion(dto) {
    const sha256 = crypto5.createHash("sha256").update(dto.fileBuffer).digest("hex");
    const fileSizeBytes = dto.fileBuffer.length;
    const resolvedMimeType = detectSafeMimeType(dto.fileBuffer, dto.mimeType, dto.fileName);
    const storageKey = `vault/${dto.supplierId}/${Date.now()}-${dto.fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    let docTypeRes = await query(
      `SELECT id, name FROM document_types WHERE code = $1 OR UPPER(code) = UPPER($1) LIMIT 1`,
      [dto.documentTypeCode]
    );
    if (!docTypeRes.rows.length) {
      docTypeRes = await query(
        `SELECT id, name FROM document_types WHERE LOWER(name) = LOWER($1) LIMIT 1`,
        [dto.documentTypeCode]
      );
    }
    if (!docTypeRes.rows.length) {
      docTypeRes = await query(
        `SELECT id, name FROM document_types LIMIT 1`
      );
    }
    if (!docTypeRes.rows.length) {
      throw new Error(`Invalid document type: ${dto.documentTypeCode}`);
    }
    const docType = docTypeRes.rows[0];
    return tx(async (client) => {
      let docId;
      const existingDocRes = await client.query(
        `SELECT d.id, COALESCE(v.version_no, 0) as version_no
         FROM supplier_documents d
         LEFT JOIN supplier_document_versions v ON v.id = d.current_version_id
         WHERE d.supplier_id = $1 AND d.document_type_id = $2 AND d.status = 'active'
         LIMIT 1`,
        [dto.supplierId, docType.id]
      );
      let nextVersionNo = 1;
      if (existingDocRes.rows.length > 0) {
        docId = existingDocRes.rows[0].id;
        const maxVerRes = await client.query(
          `SELECT COALESCE(MAX(version_no), 0) as max_version FROM supplier_document_versions WHERE document_id = $1`,
          [docId]
        );
        nextVersionNo = Number(maxVerRes.rows[0]?.max_version || 0) + 1;
      } else {
        const newDocRes = await client.query(
          `INSERT INTO supplier_documents (supplier_id, document_type_id, title, file_size_bytes, status)
           VALUES ($1, $2, $3, $4, 'active')
           RETURNING id`,
          [dto.supplierId, docType.id, dto.title || docType.name, fileSizeBytes]
        );
        docId = newDocRes.rows[0].id;
      }
      const newVersionRes = await client.query(
        `INSERT INTO supplier_document_versions (
          document_id, version_no, storage_key, file_name, mime_type,
          file_size_bytes, sha256, document_number, issue_date, expiry_date,
          uploaded_by_user_id, verification_status, uploaded_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'PENDING_VERIFICATION', NOW()
        ) RETURNING id`,
        [
          docId,
          nextVersionNo,
          storageKey,
          dto.fileName,
          resolvedMimeType,
          fileSizeBytes,
          sha256,
          dto.documentNumber || null,
          dto.issueDate || null,
          dto.expiryDate || null,
          dto.userId
        ]
      );
      const versionId = newVersionRes.rows[0].id;
      await client.query(
        `INSERT INTO document_files (document_version_id, content, mime_type, file_name, size_bytes, sha256)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [versionId, dto.fileBuffer, resolvedMimeType, dto.fileName, fileSizeBytes, sha256]
      );
      const readBackRes = await client.query(
        `SELECT sha256, size_bytes, file_name FROM document_files WHERE document_version_id = $1`,
        [versionId]
      );
      if (!readBackRes.rows.length) {
        throw new Error("Transaction integrity error: document_files record was not persisted.");
      }
      const storedSha = readBackRes.rows[0].sha256.trim();
      if (storedSha !== sha256) {
        throw new Error(`File integrity check failed: stored hash (${storedSha}) does not match computed hash (${sha256}).`);
      }
      await client.query(
        `UPDATE supplier_documents
         SET current_version_id = $1, file_size_bytes = $2, updated_at = NOW()
         WHERE id = $3`,
        [versionId, fileSizeBytes, docId]
      );
      let computedDaysToExpiry = null;
      let computedExpiryState = "NO_EXPIRY";
      if (dto.expiryDate) {
        const expStr = String(dto.expiryDate).slice(0, 10);
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(expStr);
        const now = /* @__PURE__ */ new Date();
        const todayUtcMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
        const expUtcMs = match ? Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])) : Date.parse(dto.expiryDate);
        if (!Number.isNaN(expUtcMs)) {
          computedDaysToExpiry = Math.ceil((expUtcMs - todayUtcMs) / 864e5);
          if (computedDaysToExpiry < 0) {
            computedExpiryState = "EXPIRED";
          } else if (computedDaysToExpiry <= 90) {
            computedExpiryState = "EXPIRING_SOON";
          } else {
            computedExpiryState = "VALID";
          }
        }
      }
      return {
        documentId: docId,
        supplierId: dto.supplierId,
        documentTypeId: docType.id,
        documentTypeCode: dto.documentTypeCode,
        documentTypeName: docType.name,
        issuingAuthority: null,
        requiresExpiry: !!dto.expiryDate,
        title: dto.title || docType.name,
        status: "active",
        versionId,
        versionNo: nextVersionNo,
        storageKey,
        fileName: dto.fileName,
        mimeType: resolvedMimeType,
        fileSizeBytes: String(fileSizeBytes),
        sha256,
        documentNumber: dto.documentNumber || null,
        issueDate: dto.issueDate || null,
        expiryDate: dto.expiryDate || null,
        verificationStatus: "PENDING_VERIFICATION",
        verifiedVia: null,
        verifiedAt: null,
        verificationNotes: "File uploaded and verified against canonical SHA-256 checksum rules.",
        rejectionReason: null,
        uploadedAt: (/* @__PURE__ */ new Date()).toISOString(),
        daysToExpiry: computedDaysToExpiry,
        expiryState: computedExpiryState,
        hasFile: true,
        certifiedCopy: dto.certifiedCopy
      };
    });
  }
  /**
   * Fetch actual uploaded file bytes by document version ID or document ID,
   * strictly scoped to the owning supplier and prioritizing the exact requested
   * version or the document's current active version.
   * Never fabricates placeholder PDFs when real bytes do not exist.
   */
  async getFileByVersionOrDocId(id, supplierId) {
    if (!UUID_REGEX.test(id) || !UUID_REGEX.test(supplierId)) {
      return null;
    }
    const res = await query(
      `SELECT f.content,
              COALESCE(f.mime_type, v.mime_type) AS "mimeType",
              COALESCE(f.file_name, v.file_name) AS "fileName",
              f.size_bytes AS "sizeBytes",
              COALESCE(f.sha256, v.sha256) AS sha256,
              v.id AS "versionId",
              d.id AS "documentId"
       FROM document_files f
       JOIN supplier_document_versions v ON v.id = f.document_version_id
       JOIN supplier_documents d ON d.id = v.document_id
       WHERE d.supplier_id = $2
         AND d.status != 'deleted'
         AND (v.id = $1 OR d.id = $1 OR f.id = $1)
       ORDER BY (v.id = $1) DESC, (v.id = d.current_version_id) DESC, v.version_no DESC
       LIMIT 1`,
      [id, supplierId]
    );
    if (!res.rows.length || !res.rows[0].content || res.rows[0].content.length === 0) {
      return null;
    }
    const row = res.rows[0];
    const buf = Buffer.isBuffer(row.content) ? row.content : Buffer.from(row.content);
    return {
      content: buf,
      mimeType: detectSafeMimeType(buf, row.mimeType, row.fileName),
      fileName: row.fileName || "document",
      sizeBytes: buf.length,
      sha256: row.sha256 ? row.sha256.trim() : null,
      versionId: row.versionId,
      documentId: row.documentId
    };
  }
  /**
   * Fetch actual uploaded file bytes for platform administrators during verification.
   * Accepts either a versionId or a documentId (defaulting to current_version_id).
   */
  async getFileForAdmin(versionOrDocId) {
    if (!UUID_REGEX.test(versionOrDocId)) {
      return null;
    }
    const res = await query(
      `SELECT f.content,
              COALESCE(f.mime_type, v.mime_type) AS "mimeType",
              COALESCE(f.file_name, v.file_name) AS "fileName",
              f.size_bytes AS "sizeBytes",
              COALESCE(f.sha256, v.sha256) AS sha256,
              v.id AS "versionId",
              d.id AS "documentId"
       FROM document_files f
       JOIN supplier_document_versions v ON v.id = f.document_version_id
       JOIN supplier_documents d ON d.id = v.document_id
       WHERE v.id = $1 OR d.id = $1 OR f.id = $1
       ORDER BY (v.id = $1) DESC, (v.id = d.current_version_id) DESC, v.version_no DESC
       LIMIT 1`,
      [versionOrDocId]
    );
    if (!res.rows.length || !res.rows[0].content || res.rows[0].content.length === 0) {
      return null;
    }
    const row = res.rows[0];
    const buf = Buffer.isBuffer(row.content) ? row.content : Buffer.from(row.content);
    return {
      content: buf,
      mimeType: detectSafeMimeType(buf, row.mimeType, row.fileName),
      fileName: row.fileName || "document",
      sizeBytes: buf.length,
      sha256: row.sha256 ? row.sha256.trim() : null,
      versionId: row.versionId,
      documentId: row.documentId
    };
  }
  /**
   * Fetch actual uploaded file bytes for an authorized procuring organization (buyer).
   * Enforces that the supplier either submitted an application to one of this organization's calls
   * or holds an active data-sharing consent grant with this organization.
   */
  async getFileForBuyer(versionOrDocId, organizationId) {
    if (!UUID_REGEX.test(versionOrDocId) || !UUID_REGEX.test(organizationId)) {
      return null;
    }
    const res = await query(
      `SELECT f.content,
              COALESCE(f.mime_type, v.mime_type) AS "mimeType",
              COALESCE(f.file_name, v.file_name) AS "fileName",
              f.size_bytes AS "sizeBytes",
              COALESCE(f.sha256, v.sha256) AS sha256,
              v.id AS "versionId",
              d.id AS "documentId",
              d.supplier_id AS "supplierId",
              dt.name AS "documentTypeName"
       FROM document_files f
       JOIN supplier_document_versions v ON v.id = f.document_version_id
       JOIN supplier_documents d ON d.id = v.document_id
       LEFT JOIN document_types dt ON dt.id = d.document_type_id
       WHERE d.status != 'deleted'
         AND (v.id = $1 OR d.id = $1 OR f.id = $1)
         AND (
           EXISTS (
             SELECT 1
             FROM application_documents ad
             JOIN applications a ON a.id = ad.application_id
             WHERE (ad.document_version_id = v.id OR ad.document_type_id = d.document_type_id)
               AND a.supplier_id = d.supplier_id
               AND a.organization_id = $2
               AND a.status <> 'Draft'
           )
           OR EXISTS (
             SELECT 1
             FROM consent_grants cg
             WHERE cg.supplier_id = d.supplier_id
               AND cg.organization_id = $2
               AND cg.status = 'active'
               AND (cg.expires_at IS NULL OR cg.expires_at > NOW())
           )
         )
       ORDER BY (v.id = $1) DESC, (v.id = d.current_version_id) DESC, v.version_no DESC
       LIMIT 1`,
      [versionOrDocId, organizationId]
    );
    if (!res.rows.length || !res.rows[0].content || res.rows[0].content.length === 0) {
      return null;
    }
    const row = res.rows[0];
    const buf = Buffer.isBuffer(row.content) ? row.content : Buffer.from(row.content);
    return {
      content: buf,
      mimeType: detectSafeMimeType(buf, row.mimeType, row.fileName),
      fileName: row.fileName || "document",
      sizeBytes: buf.length,
      sha256: row.sha256 ? row.sha256.trim() : null,
      versionId: row.versionId,
      documentId: row.documentId,
      supplierId: row.supplierId,
      documentTypeName: row.documentTypeName || void 0
    };
  }
  /**
   * Delete or soft-delete a document for a supplier.
   */
  async deleteDocument(id, supplierId) {
    const res = await query(
      `UPDATE supplier_documents SET status = 'deleted', updated_at = NOW()
       WHERE (id = $1 OR current_version_id = $1) AND supplier_id = $2`,
      [id, supplierId]
    );
    return (res.rowCount || 0) > 0;
  }
};
var documentsRepository = new DocumentsRepository();

// server/repositories/consent.repository.ts
var UUID_REGEX2 = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function hasSelectedDocNamesColumn() {
  const res = await query(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'consent_grants'
         AND column_name = 'selected_document_names'
     ) AS exists`
  ).catch(() => ({ rows: [{ exists: false }] }));
  return Boolean(res.rows[0]?.exists);
}
function buildGrantSelectSql(includeDocNames) {
  return `
  SELECT cg.id, cg.supplier_id AS "supplierId", cg.organization_id AS "organizationId",
         o.name AS "organizationName", cg.share_company_details AS "shareCompanyDetails",
         cg.share_directors_owners AS "shareDirectorsOwners", cg.share_past_projects AS "sharePastProjects",
         cg.share_tax_compliance AS "shareTaxCompliance", cg.share_financial_statements AS "shareFinancialStatements",
         cg.share_key_personnel AS "shareKeyPersonnel", cg.share_past_contracts AS "sharePastContracts",
         cg.share_banking_details AS "shareBankingDetails",
         COALESCE(
           (SELECT array_agg(cgd.document_id::text ORDER BY cgd.attached_at ASC)
            FROM consent_grant_documents cgd
            WHERE cgd.consent_grant_id = cg.id),
           '{}'::text[]
         ) AS "selectedDocumentIds",
         COALESCE(
           NULLIF(
             (SELECT array_agg(DISTINCT dt.name)
              FROM consent_grant_documents cgd
              JOIN supplier_documents sd ON sd.id = cgd.document_id
              JOIN document_types dt ON dt.id = sd.document_type_id
              WHERE cgd.consent_grant_id = cg.id),
             '{}'::text[]
           ),
           ${includeDocNames ? `COALESCE(cg.selected_document_names, '{}'::text[])` : `'{}'::text[]`}
         ) AS "selectedDocumentNames",
         COALESCE(
           (SELECT array_agg(c.reference_no ORDER BY a.submitted_at DESC)
            FROM applications a
            JOIN calls c ON c.id = a.call_id
            WHERE a.supplier_id = cg.supplier_id
              AND a.organization_id = cg.organization_id
              AND a.status <> 'Draft'),
           '{}'::text[]
         ) AS "tiedApplicationNumbers",
         cg.purpose,
         CASE
           WHEN cg.status = 'active' AND cg.expires_at IS NOT NULL AND cg.expires_at <= NOW() THEN 'expired'
           ELSE cg.status
         END AS status,
         cg.granted_at AS "grantedAt", cg.expires_at AS "expiresAt",
         cg.revoked_at AS "revokedAt", cg.revocation_reason AS "revocationReason",
         cg.last_accessed_at AS "lastAccessedAt",
         cg.access_count AS "accessCount"
  FROM consent_grants cg
  JOIN organizations o ON o.id = cg.organization_id
`;
}
async function syncConsentGrantDocuments(client, grantId, supplierId, selectedDocumentIds, selectedDocumentNames) {
  if (selectedDocumentIds === void 0 && selectedDocumentNames === void 0) return;
  await client.query(`DELETE FROM consent_grant_documents WHERE consent_grant_id = $1`, [grantId]);
  const validDocIds = Array.isArray(selectedDocumentIds) ? selectedDocumentIds.filter((id) => UUID_REGEX2.test(String(id))) : [];
  if (validDocIds.length > 0) {
    await client.query(
      `INSERT INTO consent_grant_documents (consent_grant_id, document_id, attached_at)
       SELECT $1, sd.id, NOW()
       FROM supplier_documents sd
       WHERE sd.supplier_id = $2
         AND sd.status != 'deleted'
         AND (sd.id = ANY($3::uuid[]) OR sd.current_version_id = ANY($3::uuid[]))
       ON CONFLICT DO NOTHING`,
      [grantId, supplierId, validDocIds]
    );
    return;
  }
  const cleanNames = Array.isArray(selectedDocumentNames) ? selectedDocumentNames.map((n) => String(n).trim()).filter(Boolean) : [];
  if (cleanNames.length > 0) {
    await client.query(
      `INSERT INTO consent_grant_documents (consent_grant_id, document_id, attached_at)
       SELECT $1, sd.id, NOW()
       FROM supplier_documents sd
       JOIN document_types dt ON dt.id = sd.document_type_id
       WHERE sd.supplier_id = $2
         AND sd.status != 'deleted'
         AND dt.name = ANY($3::text[])
       ON CONFLICT DO NOTHING`,
      [grantId, supplierId, cleanNames]
    );
  }
}
var ConsentRepository = class {
  async listBySupplier(supplierId) {
    const hasCol = await hasSelectedDocNamesColumn();
    const res = await query(
      `${buildGrantSelectSql(hasCol)}
       WHERE cg.supplier_id = $1
       ORDER BY cg.granted_at DESC`,
      [supplierId]
    );
    return res.rows;
  }
  async listAccessLogsBySupplier(supplierId, limit = 50) {
    if (!UUID_REGEX2.test(supplierId)) return [];
    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const res = await query(
      `SELECT l.id,
              l.organization_id AS "organizationId",
              o.name AS "organizationName",
              l.supplier_id AS "supplierId",
              l.consent_grant_id AS "consentGrantId",
              l.accessed_by_user_id AS "accessedByUserId",
              COALESCE(u.full_name, u.email::text, 'Authorized Officer') AS "accessedByName",
              l.accessed_data_scope AS "accessedDataScope",
              host(l.ip_address) AS "ipAddress",
              l.accessed_at AS "accessedAt"
       FROM organization_data_access_logs l
       JOIN organizations o ON o.id = l.organization_id
       LEFT JOIN users u ON u.id = l.accessed_by_user_id
       WHERE l.supplier_id = $1
       ORDER BY l.accessed_at DESC
       LIMIT $2`,
      [supplierId, safeLimit]
    );
    return res.rows;
  }
  /**
   * Persist an immutable access record in organization_data_access_logs whenever buyer staff
   * inspect a supplier profile or view/download a supplier document.
   */
  async logDataAccess(input) {
    if (!UUID_REGEX2.test(input.organizationId) || !UUID_REGEX2.test(input.supplierId) || !UUID_REGEX2.test(input.accessedByUserId)) {
      return;
    }
    const scopes = Array.from(
      new Set((input.accessedDataScope || []).map((s) => String(s).trim()).filter(Boolean))
    );
    if (!scopes.length) scopes.push("profile_summary");
    let grantId = input.consentGrantId && UUID_REGEX2.test(input.consentGrantId) ? input.consentGrantId : null;
    if (!grantId) {
      const activeGrant = await query(
        `SELECT id
         FROM consent_grants
         WHERE supplier_id = $1
           AND organization_id = $2
           AND status = 'active'
           AND (expires_at IS NULL OR expires_at > NOW())
         ORDER BY granted_at DESC
         LIMIT 1`,
        [input.supplierId, input.organizationId]
      );
      grantId = activeGrant.rows[0]?.id || null;
    }
    const safeIp = input.ipAddress && /^[0-9a-fA-F:.]{3,45}$/.test(input.ipAddress) ? input.ipAddress : null;
    const safeUa = input.userAgent ? String(input.userAgent).slice(0, 290) : null;
    await query(
      `INSERT INTO organization_data_access_logs (
         organization_id, supplier_id, consent_grant_id, accessed_by_user_id,
         accessed_data_scope, ip_address, user_agent, accessed_at
       ) VALUES ($1, $2, $3, $4, $5::text[], $6::inet, $7, NOW())`,
      [input.organizationId, input.supplierId, grantId, input.accessedByUserId, scopes, safeIp, safeUa]
    );
    if (grantId) {
      await query(
        `UPDATE consent_grants
         SET access_count = COALESCE(access_count, 0) + 1,
             last_accessed_at = NOW(),
             updated_at = NOW()
         WHERE id = $1`,
        [grantId]
      );
    }
  }
  async grantConsent(data) {
    const hasCol = await hasSelectedDocNamesColumn();
    return tx(async (client) => {
      const orgRes = await client.query(
        `SELECT id, name FROM organizations WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
        [data.organizationId]
      );
      if (!orgRes.rows.length) {
        const err = new Error("Target procuring organization was not found.");
        err.status = 404;
        err.code = "ORGANIZATION_NOT_FOUND";
        throw err;
      }
      const existing = await client.query(
        `SELECT id, status
         FROM consent_grants
         WHERE supplier_id = $1 AND organization_id = $2
         ORDER BY created_at DESC
         LIMIT 1
         FOR UPDATE`,
        [data.supplierId, data.organizationId]
      );
      const s = data.scopes || {};
      const selectedDocs = Array.isArray(data.selectedDocumentNames) ? data.selectedDocumentNames : [];
      const purpose = data.purpose || "Statutory Tender Application Evaluation";
      const expiresAt = data.expiresAt || null;
      let grantId;
      if (existing.rows.length > 0) {
        grantId = existing.rows[0].id;
        await client.query(
          `UPDATE consent_grants
           SET status = 'active',
               granted_by_user_id = $2,
               granted_at = NOW(),
               expires_at = $3,
               purpose = $4,
               share_company_details = $5,
               share_directors_owners = $6,
               share_past_projects = $7,
               share_tax_compliance = $8,
               share_financial_statements = $9,
               share_key_personnel = $10,
               share_past_contracts = $11,
               share_banking_details = $12,
               ${hasCol ? "selected_document_names = $13," : ""}
               revoked_by_user_id = NULL,
               revoked_at = NULL,
               revocation_reason = NULL,
               updated_at = NOW()
           WHERE id = $1`,
          hasCol ? [
            grantId,
            data.userId,
            expiresAt,
            purpose,
            s.shareCompanyDetails ?? true,
            s.shareDirectorsOwners ?? true,
            s.sharePastProjects ?? true,
            s.shareTaxCompliance ?? true,
            s.shareFinancialStatements ?? false,
            s.shareKeyPersonnel ?? true,
            s.sharePastContracts ?? true,
            s.shareBankingDetails ?? false,
            selectedDocs
          ] : [
            grantId,
            data.userId,
            expiresAt,
            purpose,
            s.shareCompanyDetails ?? true,
            s.shareDirectorsOwners ?? true,
            s.sharePastProjects ?? true,
            s.shareTaxCompliance ?? true,
            s.shareFinancialStatements ?? false,
            s.shareKeyPersonnel ?? true,
            s.sharePastContracts ?? true,
            s.shareBankingDetails ?? false
          ]
        );
      } else {
        const ins = await client.query(
          hasCol ? `INSERT INTO consent_grants (
                supplier_id, organization_id, granted_by_user_id, status, purpose, expires_at,
                share_company_details, share_directors_owners, share_past_projects,
                share_tax_compliance, share_financial_statements, share_key_personnel,
                share_past_contracts, share_banking_details, selected_document_names, granted_at
              ) VALUES (
                $1, $2, $3, 'active', $4, $5,
                $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW()
              ) RETURNING id` : `INSERT INTO consent_grants (
                supplier_id, organization_id, granted_by_user_id, status, purpose, expires_at,
                share_company_details, share_directors_owners, share_past_projects,
                share_tax_compliance, share_financial_statements, share_key_personnel,
                share_past_contracts, share_banking_details, granted_at
              ) VALUES (
                $1, $2, $3, 'active', $4, $5,
                $6, $7, $8, $9, $10, $11, $12, $13, NOW()
              ) RETURNING id`,
          hasCol ? [
            data.supplierId,
            data.organizationId,
            data.userId,
            purpose,
            expiresAt,
            s.shareCompanyDetails ?? true,
            s.shareDirectorsOwners ?? true,
            s.sharePastProjects ?? true,
            s.shareTaxCompliance ?? true,
            s.shareFinancialStatements ?? false,
            s.shareKeyPersonnel ?? true,
            s.sharePastContracts ?? true,
            s.shareBankingDetails ?? false,
            selectedDocs
          ] : [
            data.supplierId,
            data.organizationId,
            data.userId,
            purpose,
            expiresAt,
            s.shareCompanyDetails ?? true,
            s.shareDirectorsOwners ?? true,
            s.sharePastProjects ?? true,
            s.shareTaxCompliance ?? true,
            s.shareFinancialStatements ?? false,
            s.shareKeyPersonnel ?? true,
            s.sharePastContracts ?? true,
            s.shareBankingDetails ?? false
          ]
        );
        grantId = ins.rows[0].id;
      }
      await syncConsentGrantDocuments(
        client,
        grantId,
        data.supplierId,
        data.selectedDocumentIds,
        selectedDocs
      );
      await auditRepository.logEvent(
        {
          actorName: data.actorName || "Supplier Administrator",
          actorRole: data.actorRole || "Supplier Admin",
          actorUserId: data.userId,
          supplierId: data.supplierId,
          organizationId: data.organizationId,
          organizationName: orgRes.rows[0].name,
          action: "Consent Grant Issued",
          entityType: "ConsentGrant",
          entityId: grantId,
          ipAddress: data.ipAddress,
          details: `Granted scoped data access to ${orgRes.rows[0].name} (Tax: ${s.shareTaxCompliance ?? true}, Directors: ${s.shareDirectorsOwners ?? true}, Financials: ${s.shareFinancialStatements ?? false}, Banking: ${s.shareBankingDetails ?? false}${expiresAt ? `, Expires: ${expiresAt}` : ""}).`
        },
        client
      );
      const out = await client.query(`${buildGrantSelectSql(hasCol)} WHERE cg.id = $1`, [grantId]);
      return out.rows[0];
    });
  }
  async updateConsentScope(grantId, supplierId, userId, updates, auditMeta) {
    const hasCol = await hasSelectedDocNamesColumn();
    return tx(async (client) => {
      const existing = await client.query(
        `SELECT id, organization_id, status
         FROM consent_grants
         WHERE id = $1 AND supplier_id = $2
         FOR UPDATE`,
        [grantId, supplierId]
      );
      if (!existing.rows.length) {
        const err = new Error("Consent grant record not found.");
        err.status = 404;
        err.code = "CONSENT_NOT_FOUND";
        throw err;
      }
      if (existing.rows[0].status !== "active") {
        const err = new Error("Revoked or expired consent grants cannot be modified. Issue a new grant if re-sharing is required.");
        err.status = 400;
        err.code = "CONSENT_NOT_ACTIVE";
        throw err;
      }
      const s = updates.scopes || {};
      if (hasCol) {
        await client.query(
          `UPDATE consent_grants
           SET share_company_details = COALESCE($3, share_company_details),
               share_directors_owners = COALESCE($4, share_directors_owners),
               share_past_projects = COALESCE($5, share_past_projects),
               share_tax_compliance = COALESCE($6, share_tax_compliance),
               share_financial_statements = COALESCE($7, share_financial_statements),
               share_key_personnel = COALESCE($8, share_key_personnel),
               share_past_contracts = COALESCE($9, share_past_contracts),
               share_banking_details = COALESCE($10, share_banking_details),
               selected_document_names = COALESCE($11, selected_document_names),
               expires_at = CASE WHEN $12::boolean THEN $13::timestamptz ELSE expires_at END,
               updated_at = NOW()
           WHERE id = $1 AND supplier_id = $2 AND status = 'active'`,
          [
            grantId,
            supplierId,
            s.shareCompanyDetails ?? null,
            s.shareDirectorsOwners ?? null,
            s.sharePastProjects ?? null,
            s.shareTaxCompliance ?? null,
            s.shareFinancialStatements ?? null,
            s.shareKeyPersonnel ?? null,
            s.sharePastContracts ?? null,
            s.shareBankingDetails ?? null,
            updates.selectedDocumentNames !== void 0 ? updates.selectedDocumentNames : null,
            updates.expiresAt !== void 0,
            updates.expiresAt ?? null
          ]
        );
      } else {
        await client.query(
          `UPDATE consent_grants
           SET share_company_details = COALESCE($3, share_company_details),
               share_directors_owners = COALESCE($4, share_directors_owners),
               share_past_projects = COALESCE($5, share_past_projects),
               share_tax_compliance = COALESCE($6, share_tax_compliance),
               share_financial_statements = COALESCE($7, share_financial_statements),
               share_key_personnel = COALESCE($8, share_key_personnel),
               share_past_contracts = COALESCE($9, share_past_contracts),
               share_banking_details = COALESCE($10, share_banking_details),
               expires_at = CASE WHEN $11::boolean THEN $12::timestamptz ELSE expires_at END,
               updated_at = NOW()
           WHERE id = $1 AND supplier_id = $2 AND status = 'active'`,
          [
            grantId,
            supplierId,
            s.shareCompanyDetails ?? null,
            s.shareDirectorsOwners ?? null,
            s.sharePastProjects ?? null,
            s.shareTaxCompliance ?? null,
            s.shareFinancialStatements ?? null,
            s.shareKeyPersonnel ?? null,
            s.sharePastContracts ?? null,
            s.shareBankingDetails ?? null,
            updates.expiresAt !== void 0,
            updates.expiresAt ?? null
          ]
        );
      }
      await syncConsentGrantDocuments(
        client,
        grantId,
        supplierId,
        updates.selectedDocumentIds,
        updates.selectedDocumentNames
      );
      await auditRepository.logEvent(
        {
          actorName: auditMeta?.actorName || "Supplier Administrator",
          actorRole: auditMeta?.actorRole || "Supplier Admin",
          actorUserId: userId,
          supplierId,
          organizationId: existing.rows[0].organization_id,
          action: "Consent Scope Updated",
          entityType: "ConsentGrant",
          entityId: grantId,
          ipAddress: auditMeta?.ipAddress,
          details: `Updated data sharing scope permissions for consent grant ${grantId}.`
        },
        client
      );
      const out = await client.query(`${buildGrantSelectSql(hasCol)} WHERE cg.id = $1`, [grantId]);
      return out.rows[0];
    });
  }
  async revokeConsent(grantId, supplierId, userId, reason, auditMeta) {
    await tx(async (client) => {
      const check = await client.query(
        `SELECT id, organization_id, status
         FROM consent_grants
         WHERE id = $1 AND supplier_id = $2
         FOR UPDATE`,
        [grantId, supplierId]
      );
      if (!check.rows.length) {
        const err = new Error("Consent grant record not found.");
        err.status = 404;
        err.code = "CONSENT_NOT_FOUND";
        throw err;
      }
      if (check.rows[0].status === "revoked") {
        const err = new Error("Consent grant has already been revoked.");
        err.status = 400;
        err.code = "CONSENT_ALREADY_REVOKED";
        throw err;
      }
      const cleanReason = (reason || "Revoked by supplier administrator").trim();
      await client.query(
        `UPDATE consent_grants
         SET status = 'revoked',
             revoked_by_user_id = $3,
             revoked_at = NOW(),
             revocation_reason = $4,
             updated_at = NOW()
         WHERE id = $1 AND supplier_id = $2`,
        [grantId, supplierId, userId, cleanReason]
      );
      await auditRepository.logEvent(
        {
          actorName: auditMeta?.actorName || "Supplier Administrator",
          actorRole: auditMeta?.actorRole || "Supplier Admin",
          actorUserId: userId,
          supplierId,
          organizationId: check.rows[0].organization_id,
          action: "Consent Grant Revoked",
          entityType: "ConsentGrant",
          entityId: grantId,
          ipAddress: auditMeta?.ipAddress,
          details: `Data sharing consent revoked. Reason: ${cleanReason}. Previously submitted tender dossiers remain legally archived for the buyer.`
        },
        client
      );
    });
  }
};
var consentRepository = new ConsentRepository();

// server/repositories/notifications.repository.ts
var UUID_REGEX3 = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function execQuery(sql, params, client) {
  if (client) {
    const res2 = await client.query(sql, params);
    return { rows: res2.rows, rowCount: res2.rowCount };
  }
  const res = await query(sql, params);
  return { rows: res.rows, rowCount: res.rowCount };
}
function interpolateTemplate(template, vars) {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key) => {
    const val = vars[key];
    if (val === void 0 || val === null) return "";
    return String(val);
  });
}
var NotificationsRepository = class {
  /**
   * Look up an active notification_templates record (organization override first, then platform default)
   * and safely interpolate {{variable}} placeholders.
   */
  async renderTemplate(code, channel, vars, organizationId, client) {
    if (!code) return null;
    const safeOrgId = organizationId && UUID_REGEX3.test(organizationId) ? organizationId : null;
    try {
      const res = await execQuery(
        `SELECT code, subject, body
         FROM notification_templates
         WHERE code = $1
           AND channel = $2
           AND is_active = TRUE
           AND (organization_id = $3 OR organization_id IS NULL)
         ORDER BY (organization_id IS NOT NULL) DESC, created_at DESC
         LIMIT 1`,
        [code.slice(0, 100), channel, safeOrgId],
        client
      );
      if (!res.rows.length) return null;
      const tpl = res.rows[0];
      return {
        code: tpl.code,
        subject: tpl.subject ? interpolateTemplate(tpl.subject, vars).trim() : null,
        body: interpolateTemplate(tpl.body, vars).trim()
      };
    } catch {
      return null;
    }
  }
  /**
   * Queue an email delivery row in message_deliveries using notification_templates when available.
   */
  async queueEmailDelivery(input, client) {
    const cleanRecipient = String(input.recipientEmail || "").trim().toLowerCase().slice(0, 255);
    if (!cleanRecipient || !cleanRecipient.includes("@")) return;
    const safeUserId = input.userId && UUID_REGEX3.test(input.userId) ? input.userId : null;
    const safeNotificationId = input.notificationId && UUID_REGEX3.test(input.notificationId) ? input.notificationId : null;
    const safeCode = String(input.templateCode || "system_notification").slice(0, 100);
    const rendered = await this.renderTemplate(
      safeCode,
      "email",
      input.vars || {},
      input.organizationId || null,
      client
    );
    const providerRef = rendered ? `tpl:${rendered.code}` : null;
    await execQuery(
      `INSERT INTO message_deliveries (
         notification_id, user_id, channel, recipient, template_code, status, provider_ref, queued_at
       ) VALUES ($1, $2, 'email', $3, $4, 'queued', $5, NOW())`,
      [safeNotificationId, safeUserId, cleanRecipient, safeCode, providerRef],
      client
    );
  }
  async listForUser(userId, activeTenantType, limit = 50) {
    if (!UUID_REGEX3.test(userId)) return [];
    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const res = await query(
      `SELECT id,
              user_id AS "userId",
              organization_id AS "organizationId",
              supplier_id AS "supplierId",
              event_type AS "eventType",
              title,
              body,
              link_url AS "linkUrl",
              data,
              priority,
              read_at AS "readAt",
              created_at AS "createdAt"
       FROM notifications
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, safeLimit]
    );
    return res.rows.map((r) => ({
      ...r,
      recipientRole: r.supplierId && (!r.organizationId || activeTenantType === "supplier") ? "Supplier" : r.organizationId ? "Buyer" : activeTenantType === "organization" ? "Buyer" : "Supplier"
    }));
  }
  async markRead(notificationId, userId) {
    if (!UUID_REGEX3.test(notificationId) || !UUID_REGEX3.test(userId)) return false;
    const res = await query(
      `UPDATE notifications
       SET read_at = COALESCE(read_at, NOW())
       WHERE id = $1 AND user_id = $2`,
      [notificationId, userId]
    );
    return (res.rowCount || 0) > 0;
  }
  async markAllRead(userId) {
    if (!UUID_REGEX3.test(userId)) return 0;
    const res = await query(
      `UPDATE notifications
       SET read_at = NOW()
       WHERE user_id = $1 AND read_at IS NULL`,
      [userId]
    );
    return res.rowCount || 0;
  }
  async notifyUsers(input, client) {
    const uniqueUsers = Array.from(new Set((input.userIds || []).filter((id) => UUID_REGEX3.test(String(id)))));
    if (!uniqueUsers.length) return;
    const safeOrgId = input.organizationId && UUID_REGEX3.test(input.organizationId) ? input.organizationId : null;
    const safeSupId = input.supplierId && UUID_REGEX3.test(input.supplierId) ? input.supplierId : null;
    const eventCode = input.eventType.slice(0, 100);
    const priority = input.priority || "info";
    const templateVars = input.data && typeof input.data === "object" ? input.data : {};
    const inAppTemplate = Object.keys(templateVars).length > 0 ? await this.renderTemplate(eventCode, "in_app", templateVars, safeOrgId, client) : null;
    const resolvedTitle = ((inAppTemplate?.subject && !inAppTemplate.subject.includes("{{") ? inAppTemplate.subject : "") || input.title).trim().slice(0, 250);
    const resolvedBody = ((inAppTemplate?.body && inAppTemplate.body.length > 0 && !inAppTemplate.body.includes("{{") ? inAppTemplate.body : "") || input.body).trim().slice(0, 990);
    const emailsRes = await execQuery(
      `SELECT id, email::text AS email FROM users WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL`,
      [uniqueUsers],
      client
    );
    const emailByUser = new Map(emailsRes.rows.map((u) => [u.id, u.email]));
    for (const userId of uniqueUsers) {
      const ins = await execQuery(
        `INSERT INTO notifications (
          user_id, organization_id, supplier_id, event_type, title, body, link_url, data, priority, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NOW())
        RETURNING id`,
        [
          userId,
          safeOrgId,
          safeSupId,
          eventCode,
          resolvedTitle,
          resolvedBody,
          input.linkUrl || null,
          input.data ? JSON.stringify(input.data) : null,
          priority
        ],
        client
      );
      const userEmail = emailByUser.get(userId);
      if (input.queueEmail !== false && userEmail) {
        await this.queueEmailDelivery(
          {
            userId,
            recipientEmail: userEmail,
            templateCode: eventCode,
            vars: { ...templateVars, title: resolvedTitle, body: resolvedBody },
            organizationId: safeOrgId,
            notificationId: ins.rows[0]?.id || null
          },
          client
        );
      }
    }
  }
  async notifySupplierMembers(supplierId, payload, client) {
    if (!UUID_REGEX3.test(supplierId)) return;
    const memRes = await execQuery(
      `SELECT user_id FROM supplier_members WHERE supplier_id = $1 AND status = 'active'`,
      [supplierId],
      client
    );
    const userIds = memRes.rows.map((r) => r.user_id);
    if (!userIds.length) return;
    await this.notifyUsers(
      {
        userIds,
        supplierId,
        organizationId: payload.organizationId || null,
        eventType: payload.eventType,
        title: payload.title,
        body: payload.body,
        linkUrl: payload.linkUrl,
        data: payload.data,
        priority: payload.priority,
        queueEmail: payload.queueEmail
      },
      client
    );
  }
  async notifyOrganizationMembers(organizationId, payload, client) {
    if (!UUID_REGEX3.test(organizationId)) return;
    const memRes = payload.permissionCode ? await execQuery(
      `SELECT DISTINCT om.user_id
           FROM organization_members om
           JOIN role_permissions rp ON rp.role_id = om.role_id
           JOIN permissions p ON p.id = rp.permission_id
           WHERE om.organization_id = $1
             AND om.status = 'active'
             AND p.code = $2`,
      [organizationId, payload.permissionCode],
      client
    ) : await execQuery(
      `SELECT user_id FROM organization_members WHERE organization_id = $1 AND status = 'active'`,
      [organizationId],
      client
    );
    const userIds = memRes.rows.map((r) => r.user_id);
    if (!userIds.length) return;
    await this.notifyUsers(
      {
        userIds,
        organizationId,
        supplierId: payload.supplierId || null,
        eventType: payload.eventType,
        title: payload.title,
        body: payload.body,
        linkUrl: payload.linkUrl,
        data: payload.data,
        priority: payload.priority,
        queueEmail: payload.queueEmail
      },
      client
    );
  }
};
var notificationsRepository = new NotificationsRepository();

// server/repositories/applications.repository.ts
var UUID_REGEX4 = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
var ApplicationsRepository = class {
  async hydrateApplications(rows, includeSupplierBidPrice) {
    if (!rows.length) return [];
    const appIds = rows.map((r) => r.id);
    const callSupplierPairs = rows.map((r) => ({ callId: r.callId, supplierId: r.supplierId }));
    const [docsRes, timelineRes, infoRes, bidsRes] = await Promise.all([
      query(
        `SELECT ad.application_id AS "applicationId",
                ad.document_type_id AS "documentTypeId",
                ad.document_version_id AS "documentVersionId",
                dt.code,
                dt.name,
                ad.pinned_version_no AS "versionNo",
                ad.pinned_sha256 AS "sha256",
                sdv.storage_key AS "storageKey",
                COALESCE(ad.document_number_snapshot, sdv.document_number) AS "documentNumber",
                COALESCE(ad.expiry_date_snapshot, sdv.expiry_date) AS "expiryDate",
                sdv.verification_status AS "verificationStatus"
         FROM application_documents ad
         JOIN document_types dt ON dt.id = ad.document_type_id
         LEFT JOIN supplier_document_versions sdv ON sdv.id = ad.document_version_id
         WHERE ad.application_id = ANY($1::uuid[])
         ORDER BY dt.sort_order ASC, ad.attached_at ASC`,
        [appIds]
      ),
      query(
        `SELECT application_id AS "applicationId", stage, note, created_at AS "createdAt"
         FROM application_timeline
         WHERE application_id = ANY($1::uuid[])
         ORDER BY created_at ASC`,
        [appIds]
      ),
      query(
        `SELECT id, application_id AS "applicationId", message, requested_at AS "requestedAt",
                due_at AS "dueAt", responded_at AS "respondedAt", response_note AS "responseNote"
         FROM application_info_requests
         WHERE application_id = ANY($1::uuid[])
         ORDER BY requested_at DESC`,
        [appIds]
      ),
      query(
        `SELECT id, call_id AS "callId", supplier_id AS "supplierId", status,
                receipt_number AS "receiptNumber", payload_sha256 AS "sealedHash",
                ${includeSupplierBidPrice ? "total_price" : `CASE WHEN status = 'opened' THEN total_price ELSE NULL END`} AS "totalPrice"
         FROM bids
         WHERE call_id = ANY($1::uuid[]) AND supplier_id = ANY($2::uuid[])`,
        [
          Array.from(new Set(callSupplierPairs.map((p) => p.callId))),
          Array.from(new Set(callSupplierPairs.map((p) => p.supplierId)))
        ]
      )
    ]);
    const docsByApp = /* @__PURE__ */ new Map();
    for (const d of docsRes.rows) {
      const list = docsByApp.get(d.applicationId) || [];
      list.push(d);
      docsByApp.set(d.applicationId, list);
    }
    const timelineByApp = /* @__PURE__ */ new Map();
    for (const t of timelineRes.rows) {
      const list = timelineByApp.get(t.applicationId) || [];
      list.push({ stage: t.stage, note: t.note, createdAt: t.createdAt });
      timelineByApp.set(t.applicationId, list);
    }
    const latestInfoByApp = /* @__PURE__ */ new Map();
    for (const ir of infoRes.rows) {
      if (!latestInfoByApp.has(ir.applicationId)) {
        latestInfoByApp.set(ir.applicationId, {
          id: ir.id,
          message: ir.message,
          requestedAt: ir.requestedAt,
          dueAt: ir.dueAt,
          respondedAt: ir.respondedAt,
          responseNote: ir.responseNote
        });
      }
    }
    const bidByPair = /* @__PURE__ */ new Map();
    for (const b of bidsRes.rows) {
      bidByPair.set(`${b.callId}|${b.supplierId}`, {
        id: b.id,
        status: b.status,
        receiptNumber: b.receiptNumber,
        sealedHash: b.sealedHash,
        totalAmountBWP: b.totalPrice !== null && b.totalPrice !== void 0 ? Number(b.totalPrice) : null
      });
    }
    return rows.map((row) => ({
      ...row,
      documents: docsByApp.get(row.id) || [],
      timeline: timelineByApp.get(row.id) || [],
      informationRequest: latestInfoByApp.get(row.id) || null,
      bid: bidByPair.get(`${row.callId}|${row.supplierId}`) || null
    }));
  }
  async getByCallAndSupplier(callId, supplierId) {
    const res = await query(
      `SELECT a.id, a.call_id AS "callId", c.reference_no AS "callNumber", c.title AS "callTitle",
              c.call_type AS "callType", c.closes_at AS "closesAt",
              a.supplier_id AS "supplierId", s.legal_name AS "supplierLegalName", s.cipa_uin AS "cipaUin",
              a.organization_id AS "organizationId", o.name AS "organizationName",
              a.consent_grant_id AS "consentGrantId",
              a.status, a.receipt_number AS "receiptNumber", a.submitted_at AS "submittedAt",
              a.withdrawn_at AS "withdrawnAt", a.withdrawal_reason AS "withdrawalReason",
              a.decision_note AS "decisionNote", a.answers
       FROM applications a
       JOIN calls c ON c.id = a.call_id
       JOIN suppliers s ON s.id = a.supplier_id
       JOIN organizations o ON o.id = a.organization_id
       WHERE a.call_id = $1 AND a.supplier_id = $2`,
      [callId, supplierId]
    );
    if (!res.rows.length) return null;
    const hydrated = await this.hydrateApplications(res.rows, true);
    return hydrated[0];
  }
  async listByOrganization(orgId) {
    const res = await query(
      `SELECT a.id, a.call_id AS "callId", c.reference_no AS "callNumber", c.title AS "callTitle",
              c.call_type AS "callType", c.closes_at AS "closesAt",
              a.supplier_id AS "supplierId", s.legal_name AS "supplierLegalName", s.cipa_uin AS "cipaUin",
              a.organization_id AS "organizationId", o.name AS "organizationName",
              a.consent_grant_id AS "consentGrantId",
              a.status, a.receipt_number AS "receiptNumber", a.submitted_at AS "submittedAt",
              a.withdrawn_at AS "withdrawnAt", a.withdrawal_reason AS "withdrawalReason",
              a.decision_note AS "decisionNote", a.answers
       FROM applications a
       JOIN calls c ON c.id = a.call_id
       JOIN suppliers s ON s.id = a.supplier_id
       JOIN organizations o ON o.id = a.organization_id
       WHERE a.organization_id = $1 AND a.status <> 'Draft'
       ORDER BY a.submitted_at DESC NULLS LAST, a.created_at DESC`,
      [orgId]
    );
    return this.hydrateApplications(res.rows, false);
  }
  async listBySupplier(supplierId) {
    const res = await query(
      `SELECT a.id, a.call_id AS "callId", c.reference_no AS "callNumber", c.title AS "callTitle",
              c.call_type AS "callType", c.closes_at AS "closesAt",
              a.supplier_id AS "supplierId", s.legal_name AS "supplierLegalName", s.cipa_uin AS "cipaUin",
              a.organization_id AS "organizationId", o.name AS "organizationName",
              a.consent_grant_id AS "consentGrantId",
              a.status, a.receipt_number AS "receiptNumber", a.submitted_at AS "submittedAt",
              a.withdrawn_at AS "withdrawnAt", a.withdrawal_reason AS "withdrawalReason",
              a.decision_note AS "decisionNote", a.answers
       FROM applications a
       JOIN calls c ON c.id = a.call_id
       JOIN suppliers s ON s.id = a.supplier_id
       JOIN organizations o ON o.id = a.organization_id
       WHERE a.supplier_id = $1
       ORDER BY a.submitted_at DESC NULLS LAST, a.created_at DESC`,
      [supplierId]
    );
    return this.hydrateApplications(res.rows, true);
  }
  /**
   * Submit an application with strict mandatory document verification.
   * Respects existing finalized states and never reactivates revoked consent grants.
   */
  async submitApplication(data) {
    const callRes = await query(
      `SELECT c.id, c.organization_id, c.reference_no, c.title, c.status, c.closes_at, o.status AS org_status
       FROM calls c
       JOIN organizations o ON o.id = c.organization_id AND o.deleted_at IS NULL
       WHERE c.id = $1`,
      [data.callId]
    );
    if (!callRes.rows.length) {
      const err = new Error("Call does not exist.");
      err.status = 404;
      err.code = "CALL_NOT_FOUND";
      throw err;
    }
    const call = callRes.rows[0];
    if (call.org_status !== "active") {
      const err = new Error("This opportunity is unavailable because the procuring organization is not currently active.");
      err.status = 403;
      err.code = "ORGANIZATION_INACTIVE";
      throw err;
    }
    if (!["open", "published"].includes(String(call.status || "").toLowerCase())) {
      const err = new Error("This call is not currently open for applications.");
      err.status = 400;
      err.code = "CALL_NOT_OPEN";
      throw err;
    }
    if (call.closes_at && /* @__PURE__ */ new Date() > new Date(call.closes_at)) {
      const err = new Error("The closing time has passed; applications can no longer be submitted.");
      err.status = 400;
      err.code = "CALL_CLOSED";
      throw err;
    }
    const supRes = await query(
      `SELECT status, verification_status, legal_name FROM suppliers WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [data.supplierId]
    );
    if (!supRes.rows.length) {
      const err = new Error("Supplier profile not found.");
      err.status = 403;
      err.code = "SUPPLIER_NOT_FOUND";
      throw err;
    }
    const sup = supRes.rows[0];
    if (String(sup.status || "").toLowerCase() !== "active") {
      const err = new Error(
        `Application blocked: your supplier account is currently ${sup.status}. Contact BidReady360 compliance administration.`
      );
      err.status = 403;
      err.code = "SUPPLIER_SUSPENDED";
      throw err;
    }
    if (String(sup.verification_status || "").toLowerCase() === "rejected") {
      const err = new Error(
        "Application blocked: your supplier verification was rejected. Please address compliance findings before applying."
      );
      err.status = 403;
      err.code = "SUPPLIER_REJECTED";
      throw err;
    }
    const debarRes = await query(
      `SELECT id, reason, ends_on
       FROM debarments
       WHERE supplier_id = $1
         AND lifted_at IS NULL
         AND starts_on <= CURRENT_DATE
         AND (ends_on IS NULL OR ends_on >= CURRENT_DATE)
         AND (organization_id IS NULL OR organization_id = $2)
       ORDER BY created_at DESC
       LIMIT 1`,
      [data.supplierId, call.organization_id]
    );
    if (debarRes.rows.length > 0) {
      const deb = debarRes.rows[0];
      const err = new Error(
        `Application blocked: supplier is currently debarred (${deb.reason})${deb.ends_on ? ` until ${deb.ends_on}` : " (permanent)"}.`
      );
      err.status = 403;
      err.code = "SUPPLIER_DEBARRED";
      throw err;
    }
    const reqDocsRes = await query(
      `SELECT crd.document_type_id, dt.code, dt.name
       FROM call_required_documents crd
       JOIN document_types dt ON dt.id = crd.document_type_id
       WHERE crd.call_id = $1 AND crd.is_mandatory = TRUE`,
      [data.callId]
    );
    let attachedVersions = [];
    if (data.attachedDocumentVersionIds.length > 0) {
      const validUuids = data.attachedDocumentVersionIds.filter((id) => UUID_REGEX4.test(String(id)));
      if (validUuids.length > 0) {
        const vRes = await query(
          `SELECT sdv.id, sd.document_type_id, sdv.version_no, sdv.sha256,
                  sdv.document_number, sdv.expiry_date, sdv.verification_status
           FROM supplier_document_versions sdv
           JOIN supplier_documents sd ON sd.id = sdv.document_id
           WHERE (sdv.id = ANY($1::uuid[]) OR (sd.id = ANY($1::uuid[]) AND sd.current_version_id = sdv.id))
             AND sd.supplier_id = $2
             AND sd.status = 'active'
             AND COALESCE(UPPER(sdv.verification_status), 'PENDING_VERIFICATION') NOT IN ('REJECTED', 'EXPIRED', 'UNVERIFIABLE')
             AND (sdv.expiry_date IS NULL OR sdv.expiry_date >= CURRENT_DATE)`,
          [validUuids, data.supplierId]
        );
        attachedVersions = vRes.rows;
      }
    }
    const attachedTypeIds = new Set(attachedVersions.map((v) => v.document_type_id));
    for (const reqDoc of reqDocsRes.rows) {
      if (!attachedTypeIds.has(reqDoc.document_type_id)) {
        const err = new Error(
          `Mandatory document missing or invalid: You must attach a valid, non-rejected ${reqDoc.name} (${reqDoc.code}) to submit this application.`
        );
        err.status = 400;
        err.code = "MANDATORY_DOCUMENT_MISSING";
        throw err;
      }
    }
    const receiptNumber = `APP-${call.reference_no.replace(/[^a-zA-Z0-9]/g, "")}-${Date.now().toString().slice(-6)}`;
    return tx(async (client) => {
      const existingApp = await client.query(
        `SELECT id, status FROM applications WHERE call_id = $1 AND supplier_id = $2 FOR UPDATE`,
        [data.callId, data.supplierId]
      );
      if (existingApp.rows.length > 0 && ["Approved", "Rejected"].includes(existingApp.rows[0].status)) {
        const err = new Error(
          `This application has already been finalized (${existingApp.rows[0].status}) and cannot be overwritten.`
        );
        err.status = 400;
        err.code = "APPLICATION_FINALIZED";
        throw err;
      }
      const activeGrantRes = await client.query(
        `SELECT id
         FROM consent_grants
         WHERE supplier_id = $1
           AND organization_id = $2
           AND status = 'active'
           AND (expires_at IS NULL OR expires_at > NOW())
         ORDER BY granted_at DESC
         LIMIT 1`,
        [data.supplierId, call.organization_id]
      );
      const consentGrantId = activeGrantRes.rows[0]?.id || null;
      const appRes = await client.query(
        `INSERT INTO applications (
          call_id, supplier_id, organization_id, consent_grant_id, status, answers, receipt_number,
          submitted_by_user_id, submitted_at, withdrawn_at, withdrawal_reason, updated_at
        ) VALUES (
          $1, $2, $3, $4, 'Submitted', $5, $6, $7, NOW(), NULL, NULL, NOW()
        )
        ON CONFLICT (call_id, supplier_id) DO UPDATE
        SET status = 'Submitted',
            consent_grant_id = COALESCE(EXCLUDED.consent_grant_id, applications.consent_grant_id),
            answers = EXCLUDED.answers,
            receipt_number = EXCLUDED.receipt_number,
            submitted_by_user_id = EXCLUDED.submitted_by_user_id,
            submitted_at = NOW(),
            withdrawn_at = NULL,
            withdrawal_reason = NULL,
            updated_at = NOW()
        RETURNING id`,
        [
          data.callId,
          data.supplierId,
          call.organization_id,
          consentGrantId,
          JSON.stringify(data.answers),
          receiptNumber,
          data.userId
        ]
      );
      const appId = appRes.rows[0].id;
      if (consentGrantId) {
        await client.query(
          `INSERT INTO consent_grant_applications (consent_grant_id, application_id, attached_at)
           VALUES ($1, $2, NOW()) ON CONFLICT DO NOTHING`,
          [consentGrantId, appId]
        );
      }
      await client.query(`DELETE FROM application_documents WHERE application_id = $1`, [appId]);
      for (const v of attachedVersions) {
        await client.query(
          `INSERT INTO application_documents (
            application_id, document_version_id, document_type_id,
            pinned_version_no, pinned_sha256, document_number_snapshot, expiry_date_snapshot, attached_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
          [appId, v.id, v.document_type_id, v.version_no, v.sha256, v.document_number, v.expiry_date]
        );
      }
      await client.query(
        `INSERT INTO application_timeline (application_id, stage, note, created_by_user_id, created_at)
         VALUES ($1, 'Submitted', 'Formal dossier submitted with pinned vault document checksums.', $2, NOW())`,
        [appId, data.userId]
      );
      await auditRepository.logEvent(
        {
          actorName: data.actorName,
          actorRole: data.actorRole,
          actorUserId: data.userId,
          supplierId: data.supplierId,
          organizationId: call.organization_id,
          action: "Application Submitted",
          entityType: "Application",
          entityId: appId,
          ipAddress: data.ipAddress,
          details: `Application submitted for call ${call.reference_no} (Receipt: ${receiptNumber}). Attached ${attachedVersions.length} pinned document versions.`
        },
        client
      );
      await notificationsRepository.notifyOrganizationMembers(
        call.organization_id,
        {
          supplierId: data.supplierId,
          eventType: "application_submitted",
          title: `New Application Received (${call.reference_no})`,
          body: `${sup.legal_name} submitted a compliance dossier (Receipt ${receiptNumber}).`,
          linkUrl: "review-queue",
          priority: "info",
          permissionCode: "applications.view",
          data: { applicationId: appId, callId: data.callId, receiptNumber }
        },
        client
      );
      return { applicationId: appId, receiptNumber };
    });
  }
  /**
   * Withdraw a submitted application prior to closing deadline.
   */
  async withdrawApplication(data) {
    if (!UUID_REGEX4.test(data.applicationIdOrCallId)) {
      const err = new Error("Invalid application identifier.");
      err.status = 400;
      throw err;
    }
    return tx(async (client) => {
      const appRes = await client.query(
        `SELECT a.id, a.call_id, a.organization_id, a.status, c.reference_no, c.title, c.closes_at
         FROM applications a
         JOIN calls c ON c.id = a.call_id
         WHERE (a.id = $1 OR a.call_id = $1) AND a.supplier_id = $2
         FOR UPDATE OF a`,
        [data.applicationIdOrCallId, data.supplierId]
      );
      if (!appRes.rows.length) {
        const err = new Error("Application not found.");
        err.status = 404;
        err.code = "APPLICATION_NOT_FOUND";
        throw err;
      }
      const app2 = appRes.rows[0];
      if (!["Submitted", "Under review", "More information requested"].includes(app2.status)) {
        const err = new Error(`Applications in "${app2.status}" status cannot be withdrawn.`);
        err.status = 400;
        err.code = "INVALID_STATE_TRANSITION";
        throw err;
      }
      if (app2.closes_at && /* @__PURE__ */ new Date() > new Date(app2.closes_at)) {
        const err = new Error("Closing deadline has passed; applications can no longer be withdrawn.");
        err.status = 400;
        err.code = "CALL_CLOSED";
        throw err;
      }
      const cleanReason = (data.reason || "Withdrawn by supplier prior to closing deadline").trim();
      await client.query(
        `UPDATE applications
         SET status = 'Withdrawn',
             withdrawn_at = NOW(),
             withdrawal_reason = $2,
             updated_at = NOW()
         WHERE id = $1`,
        [app2.id, cleanReason]
      );
      await client.query(
        `UPDATE bids
         SET status = 'withdrawn', updated_at = NOW()
         WHERE call_id = $1 AND supplier_id = $2 AND status IN ('draft', 'submitted')`,
        [app2.call_id, data.supplierId]
      );
      await client.query(
        `INSERT INTO application_timeline (application_id, stage, note, created_by_user_id, created_at)
         VALUES ($1, 'Withdrawn', $2, $3, NOW())`,
        [app2.id, cleanReason, data.userId]
      );
      await auditRepository.logEvent(
        {
          actorName: data.actorName,
          actorRole: data.actorRole,
          actorUserId: data.userId,
          supplierId: data.supplierId,
          organizationId: app2.organization_id,
          action: "Application Withdrawn",
          entityType: "Application",
          entityId: app2.id,
          ipAddress: data.ipAddress,
          details: `Supplier withdrew application for ${app2.reference_no}. Reason: ${cleanReason}`
        },
        client
      );
      await notificationsRepository.notifyOrganizationMembers(
        app2.organization_id,
        {
          supplierId: data.supplierId,
          eventType: "application_withdrawn",
          title: `Application Withdrawn (${app2.reference_no})`,
          body: `A supplier withdrew their application for ${app2.title} prior to closing.`,
          linkUrl: "review-queue",
          priority: "warning",
          permissionCode: "applications.view",
          data: { applicationId: app2.id, callId: app2.call_id }
        },
        client
      );
      return { applicationId: app2.id, callId: app2.call_id, withdrawnAt: (/* @__PURE__ */ new Date()).toISOString() };
    });
  }
  /**
   * Supplier response to an open "More information requested" review cycle.
   */
  async respondToInfoRequest(data) {
    const cleanMsg = String(data.responseMessage || "").trim();
    if (!cleanMsg) {
      const err = new Error("Response message is required.");
      err.status = 400;
      throw err;
    }
    await tx(async (client) => {
      const appRes = await client.query(
        `SELECT a.id, a.call_id, a.organization_id, a.status, c.reference_no
         FROM applications a
         JOIN calls c ON c.id = a.call_id
         WHERE a.id = $1 AND a.supplier_id = $2
         FOR UPDATE OF a`,
        [data.applicationId, data.supplierId]
      );
      if (!appRes.rows.length) {
        const err = new Error("Application not found.");
        err.status = 404;
        throw err;
      }
      const app2 = appRes.rows[0];
      if (app2.status !== "More information requested") {
        const err = new Error("This application is not currently awaiting additional information.");
        err.status = 400;
        err.code = "INVALID_STATE_TRANSITION";
        throw err;
      }
      await client.query(
        `UPDATE application_info_requests
         SET responded_at = NOW(),
             response_note = $2,
             responded_by_user_id = $3
         WHERE id = (
           SELECT id FROM application_info_requests
           WHERE application_id = $1 AND responded_at IS NULL
           ORDER BY requested_at DESC
           LIMIT 1
         )`,
        [app2.id, cleanMsg.slice(0, 1990), data.userId]
      );
      await client.query(
        `INSERT INTO application_reviewer_messages (application_id, sender_user_id, sender_name, sender_role, message, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [app2.id, data.userId, data.actorName, data.actorRole, cleanMsg]
      );
      await client.query(
        `UPDATE applications SET status = 'Under review', updated_at = NOW() WHERE id = $1`,
        [app2.id]
      );
      await client.query(
        `INSERT INTO application_timeline (application_id, stage, note, created_by_user_id, created_at)
         VALUES ($1, 'Under review', $2, $3, NOW())`,
        [app2.id, `Supplier submitted clarification: ${cleanMsg.slice(0, 450)}`, data.userId]
      );
      await auditRepository.logEvent(
        {
          actorName: data.actorName,
          actorRole: data.actorRole,
          actorUserId: data.userId,
          supplierId: data.supplierId,
          organizationId: app2.organization_id,
          action: "Application Information Submitted",
          entityType: "Application",
          entityId: app2.id,
          ipAddress: data.ipAddress,
          details: `Supplier responded to information request on ${app2.reference_no} and returned dossier to Under review.`
        },
        client
      );
      await notificationsRepository.notifyOrganizationMembers(
        app2.organization_id,
        {
          supplierId: data.supplierId,
          eventType: "application_info_responded",
          title: `Clarification Submitted (${app2.reference_no})`,
          body: `${data.actorName} responded to the additional information request.`,
          linkUrl: "review-queue",
          priority: "info",
          permissionCode: "applications.review",
          data: { applicationId: app2.id, callId: app2.call_id }
        },
        client
      );
    });
  }
  /**
   * Record buyer application review decision enforcing valid state machine,
   * review trail rows, info requests, approved supplier roster sync, audit & notification.
   */
  async recordReviewDecision(data) {
    const allowedDecisions = ["Under review", "Approved", "Rejected", "More information requested"];
    if (!allowedDecisions.includes(data.decision)) {
      const err = new Error("Unsupported review decision.");
      err.status = 400;
      throw err;
    }
    const cleanComment = (data.comment || "").trim();
    if (data.decision === "More information requested" && !cleanComment) {
      const err = new Error("Please specify what additional information is requested from the supplier.");
      err.status = 400;
      throw err;
    }
    if (data.decision === "Rejected" && !cleanComment) {
      const err = new Error("Please provide a statutory reason when rejecting an application.");
      err.status = 400;
      throw err;
    }
    await tx(async (client) => {
      const appRes = await client.query(
        `SELECT a.id, a.call_id, a.supplier_id, a.status, c.reference_no, c.title
         FROM applications a
         JOIN calls c ON c.id = a.call_id
         WHERE a.id = $1 AND a.organization_id = $2
         FOR UPDATE OF a`,
        [data.applicationId, data.orgId]
      );
      if (!appRes.rows.length) {
        const err = new Error("Application not found for your organization.");
        err.status = 404;
        err.code = "APPLICATION_NOT_FOUND";
        throw err;
      }
      const app2 = appRes.rows[0];
      if (["Draft", "Withdrawn", "Approved", "Rejected"].includes(app2.status)) {
        const err = new Error(`Cannot record review decision: application is in "${app2.status}" state.`);
        err.status = 400;
        err.code = "INVALID_STATE_TRANSITION";
        throw err;
      }
      await client.query(
        `UPDATE applications
         SET status = $2,
             decided_by_user_id = $3,
             decided_at = NOW(),
             decision_note = $4,
             updated_at = NOW()
         WHERE id = $1 AND organization_id = $5`,
        [data.applicationId, data.decision, data.userId, cleanComment || null, data.orgId]
      );
      const reviewDecisionEnum = data.decision === "Approved" ? "approved" : data.decision === "Rejected" ? "rejected" : data.decision === "More information requested" ? "info_requested" : "comment";
      await client.query(
        `INSERT INTO application_reviews (application_id, reviewer_user_id, decision, comment, decided_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [data.applicationId, data.userId, reviewDecisionEnum, cleanComment || `Status transitioned to ${data.decision}`]
      );
      if (data.decision === "More information requested") {
        await client.query(
          `INSERT INTO application_info_requests (application_id, requested_by_user_id, message, requested_at)
           VALUES ($1, $2, $3, NOW())`,
          [data.applicationId, data.userId, cleanComment.slice(0, 1990)]
        );
      }
      if (data.decision === "Approved") {
        await client.query(
          `INSERT INTO approved_suppliers (organization_id, supplier_id, source_application_id, status, valid_from, approved_at, last_reviewed_at)
           VALUES ($1, $2, $3, 'active', CURRENT_DATE, NOW(), NOW())
           ON CONFLICT (organization_id, supplier_id) DO UPDATE
           SET status = 'active',
               source_application_id = EXCLUDED.source_application_id,
               last_reviewed_at = NOW()`,
          [data.orgId, app2.supplier_id, data.applicationId]
        );
      }
      await client.query(
        `INSERT INTO application_timeline (application_id, stage, note, created_by_user_id, created_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [data.applicationId, data.decision, cleanComment || `Review decision recorded: ${data.decision}`, data.userId]
      );
      await auditRepository.logEvent(
        {
          actorName: data.reviewerName,
          actorRole: data.reviewerRole,
          actorUserId: data.userId,
          organizationId: data.orgId,
          supplierId: app2.supplier_id,
          action: `Application ${data.decision}`,
          entityType: "Application",
          entityId: data.applicationId,
          ipAddress: data.ipAddress,
          details: `Official review decision recorded for ${app2.reference_no}: ${data.decision}. Note: ${cleanComment || "None"}`
        },
        client
      );
      await notificationsRepository.notifySupplierMembers(
        app2.supplier_id,
        {
          organizationId: data.orgId,
          eventType: "application_status_changed",
          title: `Application Update: ${data.decision} (${app2.reference_no})`,
          body: cleanComment ? `${app2.title}: ${cleanComment}` : `Your application for ${app2.title} has moved to "${data.decision}".`,
          linkUrl: "applications",
          priority: data.decision === "More information requested" ? "urgent" : data.decision === "Approved" ? "success" : "warning",
          data: { applicationId: data.applicationId, callId: app2.call_id, status: data.decision }
        },
        client
      );
    });
  }
};
var applicationsRepository = new ApplicationsRepository();

// server/repositories/bids.repository.ts
import crypto6 from "crypto";
var UUID_REGEX5 = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
async function hasWitnessSummaryColumn() {
  const res = await query(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'bid_opening_sessions'
         AND column_name = 'witness_summary'
     ) AS exists`
  ).catch(() => ({ rows: [{ exists: false }] }));
  return Boolean(res.rows[0]?.exists);
}
var BidsRepository = class {
  async getByCallAndSupplier(callId, supplierId) {
    const res = await query(
      `SELECT b.id, b.call_id AS "callId", c.reference_no AS "callNumber",
              b.supplier_id AS "supplierId", s.legal_name AS "supplierName",
              b.status, b.receipt_number AS "receiptNumber", b.payload_sha256 AS "payloadSha256",
              b.total_price AS "totalPrice", b.currency, b.submitted_at AS "submittedAt", b.opened_at AS "openedAt"
       FROM bids b
       JOIN calls c ON c.id = b.call_id
       JOIN suppliers s ON s.id = b.supplier_id
       WHERE b.call_id = $1 AND b.supplier_id = $2`,
      [callId, supplierId]
    );
    if (!res.rows.length) return null;
    const base = res.rows[0];
    const [filesRes, itemsRes] = await Promise.all([
      query(
        `SELECT id, file_role AS "fileRole", file_name AS "fileName", sha256, storage_key AS "storageKey"
         FROM bid_files WHERE bid_id = $1`,
        [base.id]
      ),
      query(
        `SELECT line_no AS "lineNo", description, quantity, unit_price AS "unitPrice", line_total AS "lineTotal"
         FROM bid_price_items WHERE bid_id = $1 ORDER BY line_no ASC`,
        [base.id]
      )
    ]);
    return {
      ...base,
      files: filesRes.rows,
      priceItems: itemsRes.rows
    };
  }
  async listByCall(callId, orgId) {
    const res = await query(
      `SELECT b.id, b.call_id AS "callId", c.reference_no AS "callNumber",
              b.supplier_id AS "supplierId", s.legal_name AS "supplierName",
              s.cipa_uin AS "cipaNumber",
              b.status, b.receipt_number AS "receiptNumber", b.payload_sha256 AS "payloadSha256",
              CASE WHEN b.status = 'opened' THEN b.total_price ELSE NULL END AS "totalPrice",
              b.currency, b.submitted_at AS "submittedAt", b.opened_at AS "openedAt"
       FROM bids b
       JOIN calls c ON c.id = b.call_id
       JOIN suppliers s ON s.id = b.supplier_id
       WHERE b.call_id = $1 AND c.organization_id = $2
       ORDER BY b.submitted_at ASC NULLS LAST`,
      [callId, orgId]
    );
    return res.rows;
  }
  async getOpeningSession(callId, orgId) {
    const hasSummary = await hasWitnessSummaryColumn();
    const res = await query(
      `SELECT bos.id, bos.call_id AS "callId", bos.opened_at AS "openedAt",
              bos.conducted_by_user_id AS "conductedByUserId",
              u.full_name AS "conductedByName",
              bos.session_status AS "sessionStatus",
              bos.protocol_type AS "protocolType",
              bos.quorum_verified AS "quorumVerified",
              bos.register_sha256 AS "registerSha256",
              bos.notes,
              ${hasSummary ? "bos.witness_summary" : "NULL::jsonb"} AS "witnessSummary"
       FROM bid_opening_sessions bos
       JOIN calls c ON c.id = bos.call_id
       JOIN users u ON u.id = bos.conducted_by_user_id
       WHERE bos.call_id = $1 AND c.organization_id = $2
       ORDER BY bos.opened_at DESC
       LIMIT 1`,
      [callId, orgId]
    );
    if (!res.rows.length) return null;
    const row = res.rows[0];
    const witRes = await query(
      `SELECT bow.user_id AS "userId", u.full_name AS name, bow.witness_role AS "witnessRole",
              bow.signed_at AS "signedAt", bow.digital_signature_hash AS "signatureHash"
       FROM bid_opening_witnesses bow
       JOIN users u ON u.id = bow.user_id
       WHERE bow.session_id = $1
       ORDER BY bow.signed_at ASC NULLS LAST`,
      [row.id]
    );
    let witnesses = witRes.rows;
    if (Array.isArray(row.witnessSummary) && row.witnessSummary.length > 0) {
      const seenUserIds = new Set(witnesses.map((w) => w.userId).filter(Boolean));
      for (const extra of row.witnessSummary) {
        if (extra && (!extra.userId || !seenUserIds.has(extra.userId))) {
          witnesses.push({
            userId: extra.userId || null,
            name: extra.name || "Co-Witness",
            witnessRole: extra.witnessRole || "External Witness",
            signedAt: extra.signedAt || row.openedAt,
            signatureHash: extra.signatureHash || null
          });
        }
      }
    }
    return {
      id: row.id,
      callId: row.callId,
      openedAt: row.openedAt,
      conductedByUserId: row.conductedByUserId,
      conductedByName: row.conductedByName,
      sessionStatus: row.sessionStatus,
      protocolType: row.protocolType,
      quorumVerified: row.quorumVerified,
      registerSha256: row.registerSha256,
      notes: row.notes,
      witnesses
    };
  }
  /**
   * Seals and submits a bid envelope.
   * Server validates closing deadline, existing lock state, and computes cryptographic SHA-256 seal.
   */
  async sealAndSubmitBid(data) {
    const callRes = await query(
      `SELECT c.id, c.organization_id, c.reference_no, c.status, c.closes_at, o.status AS org_status
       FROM calls c
       JOIN organizations o ON o.id = c.organization_id AND o.deleted_at IS NULL
       WHERE c.id = $1`,
      [data.callId]
    );
    if (!callRes.rows.length) {
      const err = new Error("Tender call does not exist.");
      err.status = 404;
      err.code = "CALL_NOT_FOUND";
      throw err;
    }
    const call = callRes.rows[0];
    if (call.org_status !== "active") {
      const err = new Error("This tender call is unavailable because the procuring organization is not currently active.");
      err.status = 403;
      err.code = "ORGANIZATION_INACTIVE";
      throw err;
    }
    if (!["open", "published"].includes(String(call.status || "").toLowerCase())) {
      const err = new Error("This tender call is not currently open for bid submissions.");
      err.status = 400;
      err.code = "CALL_NOT_OPEN";
      throw err;
    }
    if (call.closes_at && /* @__PURE__ */ new Date() > new Date(call.closes_at)) {
      const err = new Error("The closing time has passed; bids can no longer be submitted.");
      err.status = 400;
      err.code = "CALL_CLOSED";
      throw err;
    }
    const supplierRes = await query(
      `SELECT status, verification_status, legal_name
       FROM suppliers
       WHERE id = $1 AND deleted_at IS NULL
       LIMIT 1`,
      [data.supplierId]
    );
    if (!supplierRes.rows.length) {
      const err = new Error("Supplier profile not found.");
      err.status = 403;
      err.code = "SUPPLIER_NOT_FOUND";
      throw err;
    }
    const sup = supplierRes.rows[0];
    const supStatus = String(sup.status || "").toLowerCase();
    const supVer = String(sup.verification_status || "").toLowerCase();
    if (supStatus !== "active") {
      const err = new Error(
        `Bid submission blocked: your supplier account is currently ${supStatus}. Contact BidReady360 compliance administration.`
      );
      err.status = 403;
      err.code = "SUPPLIER_SUSPENDED";
      throw err;
    }
    if (supVer === "rejected") {
      const err = new Error(
        "Bid submission blocked: your supplier verification was rejected. Please address compliance findings and resubmit for verification."
      );
      err.status = 403;
      err.code = "SUPPLIER_REJECTED";
      throw err;
    }
    if (supVer !== "verified") {
      const err = new Error(
        "Bid submission blocked: your supplier profile must be verified by an administrator before submitting sealed bids."
      );
      err.status = 403;
      err.code = "SUPPLIER_NOT_VERIFIED";
      throw err;
    }
    const debarRes = await query(
      `SELECT id, reason, starts_on, ends_on
       FROM debarments
       WHERE supplier_id = $1
         AND lifted_at IS NULL
         AND starts_on <= CURRENT_DATE
         AND (ends_on IS NULL OR ends_on >= CURRENT_DATE)
         AND (organization_id IS NULL OR organization_id = $2)
       ORDER BY created_at DESC
       LIMIT 1`,
      [data.supplierId, call.organization_id]
    );
    if (debarRes.rows.length > 0) {
      const deb = debarRes.rows[0];
      const err = new Error(
        `Bid submission blocked: supplier is currently debarred (${deb.reason})${deb.ends_on ? ` until ${deb.ends_on}` : " (permanent)"}.`
      );
      err.status = 403;
      err.code = "SUPPLIER_DEBARRED";
      throw err;
    }
    const payloadStr = JSON.stringify({
      callId: data.callId,
      supplierId: data.supplierId,
      items: data.financialSchedule,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
    const sealedHash = crypto6.createHash("sha256").update(payloadStr).digest("hex");
    const receiptNumber = `BID-${call.reference_no.replace(/[^a-zA-Z0-9]/g, "")}-${Date.now().toString().slice(-6)}`;
    return tx(async (client) => {
      const existingBid = await client.query(
        `SELECT id, status FROM bids WHERE call_id = $1 AND supplier_id = $2 FOR UPDATE`,
        [data.callId, data.supplierId]
      );
      if (existingBid.rows.length > 0 && ["opened", "disqualified"].includes(existingBid.rows[0].status)) {
        const err = new Error("This bid envelope has already been opened or disqualified and cannot be modified.");
        err.status = 400;
        err.code = "BID_LOCKED";
        throw err;
      }
      const bidRes = await client.query(
        `INSERT INTO bids (
          call_id, supplier_id, status, receipt_number, sealed_payload_key,
          sealed_payload_hash, envelope_key_ref, payload_sha256, submitted_by_user_id, submitted_at, updated_at
        ) VALUES (
          $1, $2, 'submitted', $3, $4, $6, $5, $6, $7, NOW(), NOW()
        )
        ON CONFLICT (call_id, supplier_id) DO UPDATE
        SET status = 'submitted',
            receipt_number = EXCLUDED.receipt_number,
            sealed_payload_hash = EXCLUDED.sealed_payload_hash,
            payload_sha256 = EXCLUDED.payload_sha256,
            submitted_by_user_id = EXCLUDED.submitted_by_user_id,
            submitted_at = NOW(),
            updated_at = NOW()
        RETURNING id`,
        [
          data.callId,
          data.supplierId,
          receiptNumber,
          `sealed/${data.callId}/${data.supplierId}.enc`,
          "kms/bidready-bw-primary-2026",
          sealedHash,
          data.userId
        ]
      );
      const bidId = bidRes.rows[0].id;
      await client.query(`DELETE FROM bid_price_items WHERE bid_id = $1`, [bidId]);
      for (const item of data.financialSchedule) {
        await client.query(
          `INSERT INTO bid_price_items (bid_id, line_no, description, quantity, unit_price)
           VALUES ($1, $2, $3, $4, $5)`,
          [bidId, item.lineNo, item.description, item.quantity, item.unitPrice]
        );
      }
      await client.query(
        `INSERT INTO bid_sealing_receipts (bid_id, receipt_number, sealed_hash, file_fingerprints, generated_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [bidId, receiptNumber, sealedHash, JSON.stringify([{ role: "financial_schedule", sha256: sealedHash }])]
      );
      await auditRepository.logEvent(
        {
          actorName: data.actorName,
          actorRole: data.actorRole,
          actorUserId: data.userId,
          supplierId: data.supplierId,
          organizationId: call.organization_id,
          action: "Bid Sealed & Submitted",
          entityType: "Bid",
          entityId: bidId,
          ipAddress: data.ipAddress,
          details: `Sealed electronic bid envelope submitted for ${call.reference_no} (Receipt: ${receiptNumber}, SHA-256: ${sealedHash}).`
        },
        client
      );
      await notificationsRepository.notifyOrganizationMembers(
        call.organization_id,
        {
          supplierId: data.supplierId,
          eventType: "bid_submitted",
          title: `Sealed Bid Envelope Received (${call.reference_no})`,
          body: `${sup.legal_name} sealed a tender bid envelope (Receipt ${receiptNumber}). Commercial pricing remains encrypted until official opening.`,
          linkUrl: "bids-opening",
          priority: "info",
          permissionCode: "bids.view",
          data: { callId: data.callId, bidId, receiptNumber }
        },
        client
      );
      return { bidId, receiptNumber, sealedHash };
    });
  }
  /**
   * Pre-closing withdrawal of a submitted sealed bid (also withdraws linked active application).
   */
  async withdrawBid(data) {
    return tx(async (client) => {
      const callRes = await client.query(
        `SELECT id, organization_id, reference_no, closes_at FROM calls WHERE id = $1 FOR UPDATE`,
        [data.callId]
      );
      if (!callRes.rows.length) {
        const err = new Error("Tender call does not exist.");
        err.status = 404;
        err.code = "CALL_NOT_FOUND";
        throw err;
      }
      const call = callRes.rows[0];
      if (call.closes_at && /* @__PURE__ */ new Date() > new Date(call.closes_at)) {
        const err = new Error("The tender closing deadline has passed; sealed bids can no longer be withdrawn.");
        err.status = 400;
        err.code = "CALL_CLOSED";
        throw err;
      }
      const bidRes = await client.query(
        `SELECT id, status, receipt_number FROM bids WHERE call_id = $1 AND supplier_id = $2 FOR UPDATE`,
        [data.callId, data.supplierId]
      );
      if (!bidRes.rows.length) {
        const err = new Error("No submitted bid was found for this tender call.");
        err.status = 404;
        err.code = "BID_NOT_FOUND";
        throw err;
      }
      const bid = bidRes.rows[0];
      if (["opened", "disqualified"].includes(bid.status)) {
        const err = new Error("Already opened or disqualified bids cannot be withdrawn.");
        err.status = 400;
        err.code = "BID_LOCKED";
        throw err;
      }
      if (bid.status === "withdrawn") {
        const err = new Error("This bid has already been withdrawn.");
        err.status = 400;
        err.code = "BID_ALREADY_WITHDRAWN";
        throw err;
      }
      const cleanReason = (data.reason || "Withdrawn by supplier prior to tender closing deadline").trim();
      await client.query(`UPDATE bids SET status = 'withdrawn', updated_at = NOW() WHERE id = $1`, [bid.id]);
      const appSync = await client.query(
        `UPDATE applications
         SET status = 'Withdrawn',
             withdrawn_at = NOW(),
             withdrawal_reason = $3,
             updated_at = NOW()
         WHERE call_id = $1
           AND supplier_id = $2
           AND status IN ('Submitted', 'Under review', 'More information requested')
         RETURNING id`,
        [data.callId, data.supplierId, cleanReason]
      );
      if (appSync.rows.length > 0) {
        await client.query(
          `INSERT INTO application_timeline (application_id, stage, note, created_by_user_id, created_at)
           VALUES ($1, 'Withdrawn', $2, $3, NOW())`,
          [appSync.rows[0].id, cleanReason, data.userId]
        );
      }
      await auditRepository.logEvent(
        {
          actorName: data.actorName,
          actorRole: data.actorRole,
          actorUserId: data.userId,
          supplierId: data.supplierId,
          organizationId: call.organization_id,
          action: "Bid Withdrawn",
          entityType: "Bid",
          entityId: bid.id,
          ipAddress: data.ipAddress,
          details: `Withdrew sealed bid ${bid.receipt_number || bid.id} for ${call.reference_no} prior to closing. Reason: ${cleanReason}`
        },
        client
      );
      await notificationsRepository.notifyOrganizationMembers(
        call.organization_id,
        {
          supplierId: data.supplierId,
          eventType: "bid_withdrawn",
          title: `Bid Withdrawn (${call.reference_no})`,
          body: `A supplier withdrew sealed bid ${bid.receipt_number || ""} prior to the tender closing deadline.`,
          linkUrl: "bids-opening",
          priority: "warning",
          permissionCode: "bids.view",
          data: { callId: data.callId, bidId: bid.id }
        },
        client
      );
      return { bidId: bid.id, withdrawnAt: (/* @__PURE__ */ new Date()).toISOString() };
    });
  }
  /**
   * Conducts controlled bid opening session with strict closing deadline, duplicate-session,
   * submitted-bid existence, >=2 witness quorum, register SHA-256, and atomic audit/notifications.
   */
  async conductOpeningSession(data) {
    const hasSummary = await hasWitnessSummaryColumn();
    return tx(async (client) => {
      const callRes = await client.query(
        `SELECT id, reference_no, title, closes_at FROM calls WHERE id = $1 AND organization_id = $2 FOR UPDATE`,
        [data.callId, data.orgId]
      );
      if (!callRes.rows.length) {
        const err = new Error("Tender call not found for your organization.");
        err.status = 404;
        err.code = "CALL_NOT_FOUND";
        throw err;
      }
      const call = callRes.rows[0];
      if (!call.closes_at || /* @__PURE__ */ new Date() < new Date(call.closes_at)) {
        const err = new Error("Bids cannot be opened before the closing time. The statutory sealing protocol remains active.");
        err.status = 400;
        err.code = "BEFORE_CLOSING_DEADLINE";
        throw err;
      }
      const existingSession = await client.query(
        `SELECT id FROM bid_opening_sessions WHERE call_id = $1 AND session_status = 'completed' LIMIT 1`,
        [data.callId]
      );
      if (existingSession.rows.length > 0) {
        const err = new Error("An official bid opening session has already been completed for this tender call.");
        err.status = 409;
        err.code = "ALREADY_OPENED";
        throw err;
      }
      const bidsRes = await client.query(
        `SELECT b.id, b.supplier_id, s.legal_name AS supplier_name, b.receipt_number, b.payload_sha256
         FROM bids b
         JOIN suppliers s ON s.id = b.supplier_id
         WHERE b.call_id = $1 AND b.status = 'submitted'
         ORDER BY b.submitted_at ASC
         FOR UPDATE OF b`,
        [data.callId]
      );
      if (!bidsRes.rows.length) {
        const err = new Error("Cannot conduct an opening ceremony: there are no submitted sealed bids awaiting unsealing.");
        err.status = 400;
        err.code = "NO_SUBMITTED_BIDS";
        throw err;
      }
      const membersRes = await client.query(
        `SELECT om.user_id AS "userId", u.full_name AS "fullName", u.email, r.name AS "roleName"
         FROM organization_members om
         JOIN users u ON u.id = om.user_id AND u.deleted_at IS NULL
         JOIN roles r ON r.id = om.role_id
         WHERE om.organization_id = $1 AND om.status = 'active'`,
        [data.orgId]
      );
      const memberMap = new Map(membersRes.rows.map((m) => [m.userId, m]));
      const orgWitnesses = /* @__PURE__ */ new Map();
      const presidingMember = memberMap.get(data.userId);
      if (presidingMember) {
        orgWitnesses.set(data.userId, {
          userId: data.userId,
          name: presidingMember.fullName,
          witnessRole: "Presiding Officer"
        });
      }
      const externalWitnesses = [];
      const suppliedList = Array.isArray(data.witnesses) ? data.witnesses : [];
      for (const w of suppliedList) {
        if (!w) continue;
        if (w.userId) {
          if (!UUID_REGEX5.test(w.userId)) {
            const err = new Error("Invalid witness user identifier provided.");
            err.status = 400;
            err.code = "INVALID_WITNESS";
            throw err;
          }
          const member = memberMap.get(w.userId);
          if (!member) {
            const err = new Error("Selected witness is not an active member of your procuring organization.");
            err.status = 400;
            err.code = "INVALID_WITNESS";
            throw err;
          }
          orgWitnesses.set(member.userId, {
            userId: member.userId,
            name: member.fullName,
            witnessRole: (w.witnessRole || member.roleName || "Witness").trim().slice(0, 50)
          });
        } else if (w.name && w.name.trim().length >= 2) {
          externalWitnesses.push({
            userId: null,
            name: w.name.trim().slice(0, 150),
            witnessRole: (w.witnessRole || "External Co-Witness").trim().slice(0, 50)
          });
        }
      }
      if (membersRes.rows.length >= 2 && orgWitnesses.size < 2) {
        const err = new Error(
          "Quorum not met: Statutory bid opening requires at least 2 distinct organization officers/witnesses to co-sign."
        );
        err.status = 400;
        err.code = "QUORUM_NOT_MET";
        throw err;
      }
      const totalWitnessCount = orgWitnesses.size + (presidingMember ? 0 : 1) + externalWitnesses.length;
      if (totalWitnessCount < 2) {
        const err = new Error(
          "Quorum not met: At least 2 witnesses (a presiding officer plus a co-witness or external witness) must be recorded."
        );
        err.status = 400;
        err.code = "QUORUM_NOT_MET";
        throw err;
      }
      const openedAtIso = (/* @__PURE__ */ new Date()).toISOString();
      const witnessRoster = [
        ...Array.from(orgWitnesses.values()).map((w) => ({
          userId: w.userId,
          name: w.name,
          witnessRole: w.witnessRole,
          signedAt: openedAtIso,
          signatureHash: crypto6.createHash("sha256").update(`${data.callId}|${w.userId}|${openedAtIso}`).digest("hex")
        })),
        ...externalWitnesses.map((w) => ({
          userId: null,
          name: w.name,
          witnessRole: w.witnessRole,
          signedAt: openedAtIso,
          signatureHash: crypto6.createHash("sha256").update(`${data.callId}|${w.name}|${openedAtIso}`).digest("hex")
        }))
      ];
      const summaryNote = `Presiding: ${data.actorName}. Witnesses: ${witnessRoster.map((w) => `${w.name} (${w.witnessRole})`).join("; ")}.`;
      const sessionRes = await client.query(
        hasSummary ? `INSERT INTO bid_opening_sessions (
              call_id, conducted_by_user_id, session_status, protocol_type, quorum_verified, notes, witness_summary, opened_at
            ) VALUES ($1, $2, 'completed', 'dual_key_statutory_quorum', TRUE, $3, $4::jsonb, $5::timestamptz)
            RETURNING id` : `INSERT INTO bid_opening_sessions (
              call_id, conducted_by_user_id, session_status, protocol_type, quorum_verified, notes, opened_at
            ) VALUES ($1, $2, 'completed', 'dual_key_statutory_quorum', TRUE, $3, $4::timestamptz)
            RETURNING id`,
        hasSummary ? [data.callId, data.userId, summaryNote, JSON.stringify(witnessRoster), openedAtIso] : [data.callId, data.userId, summaryNote, openedAtIso]
      );
      const sessionId = sessionRes.rows[0].id;
      for (const w of witnessRoster) {
        if (!w.userId) continue;
        await client.query(
          `INSERT INTO bid_opening_witnesses (session_id, user_id, witness_role, digital_signature_hash, ip_address, signed_at)
           VALUES ($1, $2, $3, $4, $5, $6::timestamptz) ON CONFLICT DO NOTHING`,
          [sessionId, w.userId, w.witnessRole, w.signatureHash, data.ipAddress || null, openedAtIso]
        );
      }
      const openedBidsSummary = [];
      for (const b of bidsRes.rows) {
        const sumRes = await client.query(
          `SELECT COALESCE(SUM(quantity * unit_price), 0) AS sum FROM bid_price_items WHERE bid_id = $1`,
          [b.id]
        );
        const totalPrice = Number(sumRes.rows[0].sum);
        await client.query(
          `UPDATE bids
           SET status = 'opened',
               total_price = $2,
               opened_in_session_id = $3,
               opened_at = $5::timestamptz,
               unsealed_by_user_id = $4,
               updated_at = NOW()
           WHERE id = $1`,
          [b.id, totalPrice, sessionId, data.userId, openedAtIso]
        );
        openedBidsSummary.push({
          bidId: b.id,
          supplierId: b.supplier_id,
          supplierName: b.supplier_name,
          receiptNumber: b.receipt_number,
          payloadSha256: b.payload_sha256,
          totalPrice
        });
      }
      const registerSha256 = crypto6.createHash("sha256").update(
        JSON.stringify({
          sessionId,
          callId: data.callId,
          referenceNo: call.reference_no,
          openedAt: openedAtIso,
          witnesses: witnessRoster.map((w) => ({ userId: w.userId, name: w.name, role: w.witnessRole })),
          bids: openedBidsSummary
        })
      ).digest("hex");
      await client.query(
        `UPDATE bid_opening_sessions SET register_sha256 = $2 WHERE id = $1`,
        [sessionId, registerSha256]
      );
      await client.query(`UPDATE calls SET status = 'evaluating', updated_at = NOW() WHERE id = $1`, [data.callId]);
      await auditRepository.logEvent(
        {
          actorName: data.actorName,
          actorRole: data.actorRole,
          actorUserId: data.userId,
          organizationId: data.orgId,
          action: "Bids Unsealed in Opening Session",
          entityType: "Call",
          entityId: data.callId,
          ipAddress: data.ipAddress,
          afterJson: { sessionId, registerSha256, witnessCount: witnessRoster.length, openedBidsCount: bidsRes.rows.length },
          details: `Official opening session conducted for ${call.reference_no}. Unsealed ${bidsRes.rows.length} bids with ${witnessRoster.length} witnesses (Register SHA-256: ${registerSha256.slice(0, 16)}...).`
        },
        client
      );
      for (const ob of openedBidsSummary) {
        await notificationsRepository.notifySupplierMembers(
          ob.supplierId,
          {
            organizationId: data.orgId,
            eventType: "bid_opened",
            title: `Tender Envelope Unsealed (${call.reference_no})`,
            body: `Your sealed bid (${ob.receiptNumber || ob.bidId}) for ${call.title} was officially unsealed during the witnessed opening ceremony.`,
            linkUrl: "applications",
            priority: "info",
            data: { callId: data.callId, sessionId, registerSha256 }
          },
          client
        );
      }
      return {
        sessionId,
        openedBidsCount: bidsRes.rows.length,
        registerSha256,
        witnesses: witnessRoster
      };
    });
  }
};
var bidsRepository = new BidsRepository();

// server/repositories/calls.repository.ts
var UUID_REGEX6 = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
var CallsRepository = class {
  /**
   * Reads open tenders/EOIs respecting call visibility rules:
   * - 'open' & 'category_restricted': publicly discoverable
   * - 'invite_only': visible only if the supplier has a row in call_invitations
   * - 'approved_suppliers': visible only if the supplier is active in approved_suppliers for that org
   */
  async listOpen(filters) {
    const validSupplierId = filters?.supplierId && UUID_REGEX6.test(filters.supplierId) ? filters.supplierId : null;
    const params = [validSupplierId];
    let sql = `
      SELECT c.id, c.reference_no AS "referenceNo", c.title, c.call_type AS "callType",
             c.summary, c.description, c.status, c.visibility,
             c.opens_at AS "opensAt", c.clarification_deadline AS "clarificationDeadline",
             c.closes_at AS "closesAt", c.estimated_value AS "estimatedValue", c.currency,
             o.id AS "organizationId", o.name AS "organizationName", o.slug AS "organizationSlug",
             COALESCE(o.brand_primary_color, '#1F5F99') AS "orgBrandPrimaryColor",
             COALESCE(o.brand_subtext, '') AS "orgBrandSubtext",
             COALESCE(o.custom_domain, '') AS "orgCustomDomain",
             COALESCE(o.settings->>'welcomeNotice', '') AS "orgWelcomeNotice",
             CASE WHEN c.closes_at IS NOT NULL THEN EXTRACT(DAY FROM (c.closes_at - NOW())) ELSE NULL END AS "daysRemaining",
             COALESCE(
               (SELECT json_agg(json_build_object('id', cat.id, 'name', cat.name))
                FROM call_categories cc
                JOIN categories cat ON cat.id = cc.category_id
                WHERE cc.call_id = c.id),
               '[]'::json
             ) AS categories
      FROM calls c
      JOIN organizations o ON o.id = c.organization_id
      WHERE c.status IN ('open', 'published')
        AND o.status = 'active'
        AND o.deleted_at IS NULL
        AND (
          c.visibility IN ('open', 'category_restricted')
          OR (
            $1::uuid IS NOT NULL
            AND (
              (c.visibility = 'invite_only' AND EXISTS (
                SELECT 1 FROM call_invitations ci WHERE ci.call_id = c.id AND ci.supplier_id = $1::uuid
              ))
              OR (c.visibility = 'approved_suppliers' AND EXISTS (
                SELECT 1 FROM approved_suppliers ap
                WHERE ap.supplier_id = $1::uuid AND ap.organization_id = c.organization_id AND ap.status = 'active'
              ))
            )
          )
        )
    `;
    if (filters?.callType && filters.callType !== "all") {
      params.push(filters.callType);
      sql += ` AND c.call_type = $${params.length}`;
    }
    if (filters?.query) {
      params.push(`%${filters.query}%`);
      sql += ` AND (c.title ILIKE $${params.length} OR c.reference_no ILIKE $${params.length} OR c.summary ILIKE $${params.length})`;
    }
    sql += ` ORDER BY c.closes_at ASC NULLS LAST, c.created_at DESC`;
    const res = await query(sql, params);
    return res.rows;
  }
  async getById(callId, access) {
    const callRes = await query(
      `SELECT c.id, c.reference_no AS "referenceNo", c.title, c.call_type AS "callType",
              c.summary, c.description, c.status, c.visibility,
              c.opens_at AS "opensAt", c.clarification_deadline AS "clarificationDeadline",
              c.closes_at AS "closesAt", c.estimated_value AS "estimatedValue", c.currency,
              o.id AS "organizationId", o.name AS "organizationName", o.slug AS "organizationSlug",
              COALESCE(o.brand_primary_color, '#1F5F99') AS "orgBrandPrimaryColor",
              COALESCE(o.brand_subtext, '') AS "orgBrandSubtext",
              COALESCE(o.custom_domain, '') AS "orgCustomDomain",
              COALESCE(o.settings->>'welcomeNotice', '') AS "orgWelcomeNotice",
              CASE WHEN c.closes_at IS NOT NULL THEN EXTRACT(DAY FROM (c.closes_at - NOW())) ELSE NULL END AS "daysRemaining",
              COALESCE(
                (SELECT json_agg(json_build_object('id', cat.id, 'name', cat.name))
                 FROM call_categories cc
                 JOIN categories cat ON cat.id = cc.category_id
                 WHERE cc.call_id = c.id),
                '[]'::json
              ) AS categories
       FROM calls c
       JOIN organizations o ON o.id = c.organization_id
       WHERE c.id = $1`,
      [callId]
    );
    if (!callRes.rows.length) return null;
    const base = callRes.rows[0];
    const isOwnerOrg = Boolean(access?.organizationId && access.organizationId === base.organizationId);
    const validSupplierId = access?.supplierId && UUID_REGEX6.test(access.supplierId) ? access.supplierId : null;
    if (!access?.isPlatformAdmin && !isOwnerOrg && base.visibility === "invite_only") {
      if (!validSupplierId) return null;
      const invRes = await query(
        `SELECT TRUE AS ok FROM call_invitations WHERE call_id = $1 AND supplier_id = $2 LIMIT 1`,
        [callId, validSupplierId]
      );
      if (!invRes.rows.length) return null;
    }
    if (!access?.isPlatformAdmin && !isOwnerOrg && base.visibility === "approved_suppliers") {
      if (!validSupplierId) return null;
      const apRes = await query(
        `SELECT TRUE AS ok FROM approved_suppliers WHERE supplier_id = $1 AND organization_id = $2 AND status = 'active' LIMIT 1`,
        [validSupplierId, base.organizationId]
      );
      if (!apRes.rows.length) return null;
    }
    const [docsRes, priceRes, addendaRes, clarCountRes] = await Promise.all([
      query(
        `SELECT crd.document_type_id AS "documentTypeId", dt.code, dt.name, crd.is_mandatory AS "isMandatory"
         FROM call_required_documents crd
         JOIN document_types dt ON dt.id = crd.document_type_id
         WHERE crd.call_id = $1`,
        [callId]
      ),
      query(
        `SELECT id, line_no AS "lineNo", description, unit, quantity
         FROM call_price_items
         WHERE call_id = $1
         ORDER BY line_no ASC`,
        [callId]
      ),
      query(
        `SELECT ca.id, ca.addendum_no AS "addendumNo", ca.title, ca.body,
                ca.published_at AS "publishedAt", ca.new_closes_at AS "newClosesAt",
                (SELECT COUNT(*)::int FROM call_addendum_acknowledgements caa WHERE caa.addendum_id = ca.id) AS "acknowledgementsCount",
                CASE WHEN $2::uuid IS NOT NULL
                  THEN EXISTS (SELECT 1 FROM call_addendum_acknowledgements caa WHERE caa.addendum_id = ca.id AND caa.supplier_id = $2::uuid)
                  ELSE FALSE
                END AS acknowledged
         FROM call_addenda ca
         WHERE ca.call_id = $1
         ORDER BY ca.addendum_no ASC`,
        [callId, validSupplierId]
      ),
      query(
        `SELECT count(*) FROM clarifications WHERE call_id = $1 AND is_published = TRUE`,
        [callId]
      )
    ]);
    return {
      ...base,
      requiredDocuments: docsRes.rows,
      priceItems: priceRes.rows,
      addenda: addendaRes.rows,
      clarificationsCount: parseInt(clarCountRes.rows[0]?.count || "0", 10)
    };
  }
  async listClarifications(callId, supplierId) {
    const validSupplierId = supplierId && UUID_REGEX6.test(supplierId) ? supplierId : null;
    const res = await query(
      `SELECT id, call_id AS "callId",
              COALESCE(published_question, question) AS question,
              published_question AS "publishedQuestion",
              answer, responder_title AS "responderTitle", topic, status,
              asked_at AS "askedAt", answered_at AS "answeredAt", is_published AS "isPublished",
              (asked_by_supplier_id = $2::uuid) AS "isOwnQuestion"
       FROM clarifications
       WHERE call_id = $1
         AND (is_published = TRUE OR ($2::uuid IS NOT NULL AND asked_by_supplier_id = $2::uuid))
       ORDER BY asked_at DESC`,
      [callId, validSupplierId]
    );
    return res.rows;
  }
  async listClarificationsByOrganization(orgId) {
    const res = await query(
      `SELECT cl.id, cl.call_id AS "callId", c.reference_no AS "callNumber", c.title AS "callTitle",
              cl.asked_by_supplier_id AS "supplierId",
              COALESCE(s.legal_name, cl.supplier_name_snapshot, 'Prospective Bidder') AS "supplierName",
              cl.question, cl.published_question AS "publishedQuestion",
              cl.answer, cl.responder_title AS "responderTitle",
              cl.topic, cl.status, cl.is_published AS "isPublished",
              cl.asked_at AS "askedAt", cl.answered_at AS "answeredAt"
       FROM clarifications cl
       JOIN calls c ON c.id = cl.call_id
       LEFT JOIN suppliers s ON s.id = cl.asked_by_supplier_id
       WHERE c.organization_id = $1
       ORDER BY cl.asked_at DESC`,
      [orgId]
    );
    return res.rows;
  }
  async askClarification(data) {
    if (!data.question || !data.question.trim()) {
      const err = new Error("Clarification question text is required.");
      err.status = 400;
      throw err;
    }
    const call = await this.getById(data.callId, { supplierId: data.supplierId });
    if (!call) {
      const err = new Error("Call does not exist or is restricted to invited/approved suppliers.");
      err.status = 404;
      throw err;
    }
    if (!["open", "published"].includes(String(call.status || "").toLowerCase())) {
      const err = new Error("Clarifications can only be submitted on open tender calls.");
      err.status = 400;
      throw err;
    }
    if (call.clarificationDeadline && /* @__PURE__ */ new Date() > new Date(call.clarificationDeadline)) {
      const err = new Error("The clarification window for this tender has closed. Questions can no longer be submitted.");
      err.status = 400;
      throw err;
    }
    const supRes = await query(
      `SELECT legal_name FROM suppliers WHERE id = $1 LIMIT 1`,
      [data.supplierId]
    );
    const supplierSnapshot = supRes.rows[0]?.legal_name || null;
    const res = await query(
      `INSERT INTO clarifications (
        call_id, asked_by_supplier_id, asked_by_user_id, supplier_name_snapshot, question, topic, is_published, status, asked_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, FALSE, 'Pending', NOW()
      ) RETURNING id, call_id AS "callId", question, published_question AS "publishedQuestion",
                  answer, responder_title AS "responderTitle", topic, status,
                  asked_at AS "askedAt", answered_at AS "answeredAt", is_published AS "isPublished"`,
      [data.callId, data.supplierId, data.userId, supplierSnapshot, data.question.trim(), data.topic || "General"]
    );
    await notificationsRepository.notifyOrganizationMembers(
      call.organizationId,
      {
        supplierId: data.supplierId,
        eventType: "clarification_asked",
        title: `New Clarification Question (${call.referenceNo})`,
        body: `${supplierSnapshot || "A prospective supplier"} submitted a clarification question under "${data.topic || "General"}".`,
        linkUrl: "clarifications",
        priority: "info",
        permissionCode: "calls.manage",
        data: { callId: data.callId, clarificationId: res.rows[0].id }
      }
    ).catch((e) => console.warn("[clarification notify warning]", e?.message || e));
    return res.rows[0];
  }
  async answerClarification(clarificationId, answer, responderTitle, userId, orgId, actor) {
    const cleanAnswer = answer ? String(answer).trim() : "";
    if (!cleanAnswer) {
      const err = new Error("Official clarification response cannot be empty.");
      err.status = 400;
      throw err;
    }
    await tx(async (client) => {
      const res = await client.query(
        `UPDATE clarifications cl
         SET answer = $2,
             responder_title = $3,
             answered_by_user_id = $4,
             answered_at = NOW(),
             status = 'Answered',
             is_published = TRUE,
             published_question = COALESCE(cl.published_question, cl.question)
         FROM calls c
         WHERE cl.id = $1
           AND cl.call_id = c.id
           AND c.organization_id = $5
         RETURNING cl.id, cl.call_id, cl.asked_by_supplier_id, c.reference_no, c.title`,
        [clarificationId, cleanAnswer, responderTitle, userId, orgId]
      );
      if (res.rowCount === 0) {
        const err = new Error("Clarification question not found for your organization.");
        err.status = 404;
        throw err;
      }
      const row = res.rows[0];
      await auditRepository.logEvent(
        {
          actorName: actor?.actorName || responderTitle || "Procurement Officer",
          actorRole: actor?.actorRole || "Buyer",
          actorUserId: userId,
          organizationId: orgId,
          action: "Clarification Answer Published",
          entityType: "Clarification",
          entityId: row.id,
          ipAddress: actor?.ipAddress,
          details: `Published official clarification response for ${row.reference_no} (${row.title}).`
        },
        client
      );
      const supRes = await client.query(
        `SELECT $2::uuid AS supplier_id
         UNION
         SELECT supplier_id FROM applications WHERE call_id = $1 AND status <> 'Draft'
         UNION
         SELECT supplier_id FROM call_invitations WHERE call_id = $1`,
        [row.call_id, row.asked_by_supplier_id]
      );
      for (const s of supRes.rows) {
        if (!s.supplier_id) continue;
        await notificationsRepository.notifySupplierMembers(
          s.supplier_id,
          {
            organizationId: orgId,
            eventType: "clarification_answered",
            title: `Clarification Published (${row.reference_no})`,
            body: `An official clarification Q&A response has been published for ${row.title}.`,
            linkUrl: "directory",
            priority: "info",
            data: { callId: row.call_id, clarificationId: row.id }
          },
          client
        );
      }
    });
  }
  async listByOrganization(orgId) {
    const res = await query(
      `SELECT c.id, c.reference_no AS "referenceNo", c.title, c.call_type AS "callType",
              c.summary, c.description, c.status, c.visibility,
              c.opens_at AS "opensAt", c.clarification_deadline AS "clarificationDeadline",
              c.closes_at AS "closesAt", c.estimated_value AS "estimatedValue", c.currency,
              c.sealed_bid_protocol_enforced AS "isSealed",
              c.organization_id AS "organizationId", o.name AS "organizationName", o.slug AS "organizationSlug",
              (SELECT count(*)::int FROM applications a WHERE a.call_id = c.id AND a.status <> 'Draft') AS "applicationsCount",
              (SELECT count(*)::int FROM call_invitations ci WHERE ci.call_id = c.id) AS "invitationsCount",
              COALESCE(
                (SELECT json_agg(json_build_object('id', cat.id, 'name', cat.name))
                 FROM call_categories cc
                 JOIN categories cat ON cat.id = cc.category_id
                 WHERE cc.call_id = c.id),
                '[]'::json
              ) AS categories,
              COALESCE(
                (SELECT json_agg(json_build_object('code', dt.code, 'name', dt.name))
                 FROM call_required_documents crd
                 JOIN document_types dt ON dt.id = crd.document_type_id
                 WHERE crd.call_id = c.id),
                '[]'::json
              ) AS "requiredDocuments",
              COALESCE(
                (SELECT json_agg(json_build_object(
                   'id', ca.id,
                   'addendumNo', ca.addendum_no,
                   'title', ca.title,
                   'body', ca.body,
                   'publishedAt', ca.published_at,
                   'newClosesAt', ca.new_closes_at,
                   'acknowledgementsCount', (SELECT count(*)::int FROM call_addendum_acknowledgements caa WHERE caa.addendum_id = ca.id)
                 ) ORDER BY ca.addendum_no ASC)
                 FROM call_addenda ca
                 WHERE ca.call_id = c.id),
                '[]'::json
              ) AS addenda,
              COALESCE(o.brand_primary_color, '#1F5F99') AS "orgBrandPrimaryColor",
              COALESCE(o.brand_subtext, '') AS "orgBrandSubtext",
              COALESCE(o.custom_domain, '') AS "orgCustomDomain",
              COALESCE(o.settings->>'welcomeNotice', '') AS "orgWelcomeNotice"
       FROM calls c
       JOIN organizations o ON o.id = c.organization_id
       WHERE c.organization_id = $1
       ORDER BY c.created_at DESC`,
      [orgId]
    );
    return res.rows;
  }
  /**
   * Create a new Call / Tender with strict statutory criteria weighting validation (must sum to 100%).
   */
  async createCall(data) {
    if (data.criteria && data.criteria.length > 0) {
      const scored = data.criteria.filter((c) => c.criterionType === "scored" || c.criterionType === "price");
      if (scored.length > 0) {
        const totalWeight = scored.reduce((sum, c) => sum + Number(c.weight || 0), 0);
        if (Math.abs(totalWeight - 100) > 0.01) {
          throw new Error(`Criteria weight validation failed: Scored criteria weights must sum to exactly 100% (currently ${totalWeight}%).`);
        }
      }
    }
    const allowedStatuses = ["draft", "open"];
    const resolvedStatus = allowedStatuses.includes(String(data.status || "").toLowerCase()) ? String(data.status).toLowerCase() : "open";
    const allowedVisibilities = ["open", "approved_suppliers", "category_restricted", "invite_only"];
    const resolvedVisibility = allowedVisibilities.includes(String(data.visibility || "").toLowerCase()) ? String(data.visibility).toLowerCase() : "open";
    const isSealed = data.isSealed !== void 0 ? Boolean(data.isSealed) : true;
    return tx(async (client) => {
      const orgCheck = await client.query(
        `SELECT status, verification_status, rejection_reason FROM organizations WHERE id = $1 AND deleted_at IS NULL`,
        [data.organizationId]
      );
      const orgRow = orgCheck.rows[0];
      if (!orgRow) {
        const err = new Error("Procuring organization record not found.");
        err.status = 403;
        err.code = "ORGANIZATION_NOT_FOUND";
        throw err;
      }
      if (orgRow.status === "pending" || orgRow.verification_status === "pending_review" || orgRow.verification_status === "pending") {
        const err = new Error("Your organization is pending verification and approval. You cannot publish tender calls yet.");
        err.status = 403;
        err.code = "ORGANIZATION_PENDING_APPROVAL";
        throw err;
      }
      if (orgRow.status !== "active" || orgRow.verification_status === "rejected") {
        const code = orgRow.verification_status === "rejected" ? "ORGANIZATION_REJECTED" : "ORGANIZATION_SUSPENDED";
        const err = new Error(
          orgRow.rejection_reason ? `Your organization is currently ${orgRow.status} (${orgRow.rejection_reason}) and cannot publish tender calls.` : `Your organization is currently ${orgRow.status} and cannot publish tender calls.`
        );
        err.status = 403;
        err.code = code;
        throw err;
      }
      const callRes = await client.query(
        `INSERT INTO calls (
          organization_id, reference_no, title, call_type, summary, description,
          status, visibility, sealed_bid_protocol_enforced,
          opens_at, closes_at, clarification_deadline,
          estimated_value, currency, created_by_user_id,
          published_by_user_id, published_at, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9,
          $10, $11, $12,
          $13, $14, $15,
          CASE WHEN $7 = 'open' THEN $15 ELSE NULL END,
          CASE WHEN $7 = 'open' THEN NOW() ELSE NULL END,
          NOW(), NOW()
        ) RETURNING id`,
        [
          data.organizationId,
          data.referenceNo.trim(),
          data.title.trim(),
          data.callType,
          (data.summary || "").trim(),
          (data.description || data.summary || "").trim(),
          resolvedStatus,
          resolvedVisibility,
          isSealed,
          data.opensAt,
          data.closesAt,
          data.clarificationDeadline || null,
          data.estimatedValue || null,
          data.currency || "BWP",
          data.userId
        ]
      );
      const callId = callRes.rows[0].id;
      if (Array.isArray(data.categoryIds) && data.categoryIds.length > 0) {
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        let idx = 0;
        for (const catId of data.categoryIds) {
          if (!uuidRegex.test(String(catId))) continue;
          await client.query(
            `INSERT INTO call_categories (call_id, category_id, is_primary)
             VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
            [callId, catId, idx === 0]
          );
          idx++;
        }
      }
      if (data.requiredDocTypeCodes && data.requiredDocTypeCodes.length) {
        for (const code of data.requiredDocTypeCodes) {
          const docType = await client.query(
            `SELECT id FROM document_types WHERE code = $1 OR LOWER(name) = LOWER($1) LIMIT 1`,
            [code]
          );
          if (docType.rows.length) {
            await client.query(
              `INSERT INTO call_required_documents (call_id, document_type_id, is_mandatory)
               VALUES ($1, $2, TRUE) ON CONFLICT DO NOTHING`,
              [callId, docType.rows[0].id]
            );
          }
        }
      }
      if (data.criteria && data.criteria.length) {
        for (let i = 0; i < data.criteria.length; i++) {
          const crit = data.criteria[i];
          await client.query(
            `INSERT INTO evaluation_criteria (
              call_id, name, criterion_type, weight, max_score, is_mandatory_gate, sort_order
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
            [
              callId,
              crit.name,
              crit.criterionType,
              crit.weight || 0,
              crit.maxScore || 100,
              crit.isMandatoryGate || false,
              i + 1
            ]
          );
        }
      }
      if (data.priceItems && data.priceItems.length) {
        for (let i = 0; i < data.priceItems.length; i++) {
          const pi = data.priceItems[i];
          await client.query(
            `INSERT INTO call_price_items (call_id, line_no, description, unit, quantity)
             VALUES ($1, $2, $3, $4, $5)`,
            [callId, i + 1, pi.description, pi.unit, pi.quantity]
          );
        }
      }
      return callId;
    });
  }
  async updateCall(callId, orgId, userId, data) {
    const sets = [];
    const params = [callId, orgId];
    if (data.status !== void 0) {
      const allowed = ["draft", "open", "closed", "evaluating", "awarded", "cancelled"];
      const cleanStatus = String(data.status).toLowerCase();
      if (!allowed.includes(cleanStatus)) {
        const err = new Error("Invalid call status.");
        err.status = 400;
        throw err;
      }
      params.push(cleanStatus);
      sets.push(`status = $${params.length}`);
      if (cleanStatus === "open") {
        params.push(userId);
        sets.push(`published_by_user_id = COALESCE(published_by_user_id, $${params.length})`);
        sets.push(`published_at = COALESCE(published_at, NOW())`);
      }
    }
    if (data.visibility !== void 0) {
      const allowedVis = ["open", "approved_suppliers", "category_restricted", "invite_only"];
      const cleanVis = String(data.visibility).toLowerCase();
      if (!allowedVis.includes(cleanVis)) {
        const err = new Error("Invalid call visibility.");
        err.status = 400;
        throw err;
      }
      params.push(cleanVis);
      sets.push(`visibility = $${params.length}`);
    }
    if (data.closesAt !== void 0) {
      params.push(data.closesAt);
      sets.push(`closes_at = $${params.length}`);
    }
    if (data.clarificationDeadline !== void 0) {
      params.push(data.clarificationDeadline || null);
      sets.push(`clarification_deadline = $${params.length}`);
    }
    if (!sets.length) return;
    sets.push(`updated_at = NOW()`);
    const res = await query(
      `UPDATE calls SET ${sets.join(", ")} WHERE id = $1 AND organization_id = $2`,
      params
    );
    if (res.rowCount === 0) {
      const err = new Error("Call not found for your organization.");
      err.status = 404;
      throw err;
    }
  }
  async createAddendum(callId, orgId, userId, data, actor) {
    const cleanBody = (data.body ?? data.summary ?? "").trim();
    if (!data.title?.trim() || !cleanBody) {
      const err = new Error("Addendum title and details are required.");
      err.status = 400;
      throw err;
    }
    return tx(async (client) => {
      const check = await client.query(
        `SELECT id, reference_no, title FROM calls WHERE id = $1 AND organization_id = $2 FOR UPDATE`,
        [callId, orgId]
      );
      if (!check.rows.length) {
        const err = new Error("Tender call not found for your organization.");
        err.status = 404;
        throw err;
      }
      const callRow = check.rows[0];
      const maxRes = await client.query(
        `SELECT COALESCE(MAX(addendum_no), 0) + 1 AS next_no FROM call_addenda WHERE call_id = $1`,
        [callId]
      );
      const addendumNo = maxRes.rows[0].next_no;
      const ins = await client.query(
        `INSERT INTO call_addenda (
          call_id, addendum_no, title, body, new_closes_at, published_by_user_id, published_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, NOW()
        ) RETURNING id, call_id AS "callId", addendum_no AS "addendumNo", title, body, new_closes_at AS "newClosesAt", published_at AS "publishedAt"`,
        [callId, addendumNo, data.title.trim(), cleanBody, data.newClosesAt || null, userId]
      );
      const addendum = ins.rows[0];
      if (data.newClosesAt) {
        await client.query(
          `UPDATE calls SET closes_at = $2, updated_at = NOW() WHERE id = $1 AND organization_id = $3`,
          [callId, data.newClosesAt, orgId]
        );
      }
      await auditRepository.logEvent(
        {
          actorName: actor?.actorName || "Procurement Officer",
          actorRole: actor?.actorRole || "Buyer",
          actorUserId: userId,
          organizationId: orgId,
          action: "Call Addendum Issued",
          entityType: "CallAddendum",
          entityId: addendum.id,
          ipAddress: actor?.ipAddress,
          afterJson: { callId, addendumNo, newClosesAt: data.newClosesAt || null },
          details: `Issued Addendum #${addendumNo} ("${data.title.trim()}") for ${callRow.reference_no}${data.newClosesAt ? ` \u2014 closing extended to ${data.newClosesAt}` : ""}.`
        },
        client
      );
      const targetSuppliers = await client.query(
        `SELECT supplier_id FROM applications WHERE call_id = $1 AND status <> 'Draft'
         UNION
         SELECT supplier_id FROM bids WHERE call_id = $1 AND status <> 'withdrawn'
         UNION
         SELECT supplier_id FROM call_invitations WHERE call_id = $1`,
        [callId]
      );
      for (const sup of targetSuppliers.rows) {
        await notificationsRepository.notifySupplierMembers(
          sup.supplier_id,
          {
            organizationId: orgId,
            eventType: "addendum_published",
            title: `Addendum #${addendumNo} Issued (${callRow.reference_no})`,
            body: `${data.title.trim()}: please review and formally acknowledge Addendum #${addendumNo} on ${callRow.title}.`,
            linkUrl: "directory",
            priority: "urgent",
            data: { callId, addendumId: addendum.id, addendumNo }
          },
          client
        );
      }
      return { ...addendum, acknowledgementsCount: 0 };
    });
  }
  async acknowledgeAddendum(data) {
    if (!UUID_REGEX6.test(data.callId) || !UUID_REGEX6.test(data.addendumId)) {
      const err = new Error("Invalid call or addendum identifier.");
      err.status = 400;
      throw err;
    }
    const accessibleCall = await this.getById(data.callId, { supplierId: data.supplierId });
    if (!accessibleCall) {
      const err = new Error("Tender call not found or not accessible to your supplier account.");
      err.status = 404;
      throw err;
    }
    return tx(async (client) => {
      const addRes = await client.query(
        `SELECT id, addendum_no, title FROM call_addenda WHERE id = $1 AND call_id = $2 LIMIT 1`,
        [data.addendumId, data.callId]
      );
      if (!addRes.rows.length) {
        const err = new Error("Addendum not found for this tender call.");
        err.status = 404;
        throw err;
      }
      const addendum = addRes.rows[0];
      await client.query(
        `INSERT INTO call_addendum_acknowledgements (addendum_id, supplier_id, acknowledged_by_user_id, acknowledged_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (addendum_id, supplier_id) DO NOTHING`,
        [data.addendumId, data.supplierId, data.userId]
      );
      await auditRepository.logEvent(
        {
          actorName: data.actorName,
          actorRole: data.actorRole,
          actorUserId: data.userId,
          supplierId: data.supplierId,
          organizationId: accessibleCall.organizationId,
          action: "Addendum Acknowledged",
          entityType: "CallAddendum",
          entityId: data.addendumId,
          ipAddress: data.ipAddress,
          details: `Supplier acknowledged Addendum #${addendum.addendum_no} ("${addendum.title}") on ${accessibleCall.referenceNo}.`
        },
        client
      );
      return { addendumId: data.addendumId, acknowledgedAt: (/* @__PURE__ */ new Date()).toISOString() };
    });
  }
  async listInvitations(callId, orgId) {
    const ownCheck = await query(`SELECT id FROM calls WHERE id = $1 AND organization_id = $2 LIMIT 1`, [callId, orgId]);
    if (!ownCheck.rows.length) {
      const err = new Error("Tender call not found for your organization.");
      err.status = 404;
      throw err;
    }
    const res = await query(
      `SELECT ci.call_id AS "callId",
              ci.supplier_id AS "supplierId",
              s.legal_name AS "supplierLegalName",
              s.cipa_uin AS "cipaNumber",
              s.email,
              s.compliance_status AS "complianceStatus",
              u.full_name AS "invitedByName",
              ci.invited_at AS "invitedAt"
       FROM call_invitations ci
       JOIN suppliers s ON s.id = ci.supplier_id
       JOIN users u ON u.id = ci.invited_by_user_id
       WHERE ci.call_id = $1
       ORDER BY ci.invited_at DESC`,
      [callId]
    );
    return res.rows;
  }
  async inviteSuppliers(data) {
    const cleanIds = Array.from(new Set((data.supplierIds || []).filter((id) => UUID_REGEX6.test(String(id)))));
    if (!cleanIds.length) {
      const err = new Error("Select at least one valid supplier to invite.");
      err.status = 400;
      throw err;
    }
    await tx(async (client) => {
      const callRes = await client.query(
        `SELECT c.id, c.reference_no, c.title, o.name AS org_name
         FROM calls c
         JOIN organizations o ON o.id = c.organization_id
         WHERE c.id = $1 AND c.organization_id = $2
         LIMIT 1`,
        [data.callId, data.orgId]
      );
      if (!callRes.rows.length) {
        const err = new Error("Tender call not found for your organization.");
        err.status = 404;
        throw err;
      }
      const call = callRes.rows[0];
      const supRes = await client.query(
        `SELECT id, legal_name, email FROM suppliers WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL`,
        [cleanIds]
      );
      for (const sup of supRes.rows) {
        const ins = await client.query(
          `INSERT INTO call_invitations (call_id, supplier_id, invited_by_user_id, invited_at)
           VALUES ($1, $2, $3, NOW())
           ON CONFLICT (call_id, supplier_id) DO NOTHING
           RETURNING supplier_id`,
          [data.callId, sup.id, data.userId]
        );
        if ((ins.rowCount || 0) > 0) {
          await notificationsRepository.notifySupplierMembers(
            sup.id,
            {
              organizationId: data.orgId,
              eventType: "call_invitation",
              title: `Tender Invitation: ${call.reference_no}`,
              body: `${call.org_name} has formally invited your company to participate in "${call.title}".`,
              linkUrl: "directory",
              priority: "urgent",
              data: { callId: data.callId, referenceNo: call.reference_no }
            },
            client
          );
          if (sup.email) {
            await client.query(
              `INSERT INTO message_deliveries (channel, recipient, template_code, status, queued_at, sent_at)
               VALUES ('email', $1, 'call_invitation', 'sent', NOW(), NOW())`,
              [sup.email]
            );
          }
        }
      }
      await auditRepository.logEvent(
        {
          actorName: data.actorName,
          actorRole: data.actorRole,
          actorUserId: data.userId,
          organizationId: data.orgId,
          action: "Suppliers Invited to Tender",
          entityType: "Call",
          entityId: data.callId,
          ipAddress: data.ipAddress,
          afterJson: { invitedSupplierIds: supRes.rows.map((s) => s.id) },
          details: `Issued formal tender invitations on ${call.reference_no} to ${supRes.rows.map((s) => s.legal_name).join(", ")}.`
        },
        client
      );
    });
    const invitations = await this.listInvitations(data.callId, data.orgId);
    return { invitedCount: cleanIds.length, invitations };
  }
  async listSupplierInvitations(supplierId) {
    if (!UUID_REGEX6.test(supplierId)) return [];
    const res = await query(
      `SELECT ci.call_id AS "callId",
              c.reference_no AS "referenceNo",
              c.title,
              c.call_type AS "callType",
              c.status,
              c.visibility,
              c.closes_at AS "closesAt",
              o.id AS "organizationId",
              o.name AS "organizationName",
              u.full_name AS "invitedByName",
              ci.invited_at AS "invitedAt"
       FROM call_invitations ci
       JOIN calls c ON c.id = ci.call_id
       JOIN organizations o ON o.id = c.organization_id
       JOIN users u ON u.id = ci.invited_by_user_id
       WHERE ci.supplier_id = $1 AND o.status = 'active' AND o.deleted_at IS NULL
       ORDER BY ci.invited_at DESC`,
      [supplierId]
    );
    return res.rows;
  }
};
var callsRepository = new CallsRepository();

// server/routes/supplier.routes.ts
var upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }
  // 10 MB limit
});
function validateFileBuffer(buffer, originalName) {
  if (!buffer || buffer.length === 0) {
    return { isValid: false, mimeType: "", error: "Uploaded file is empty or corrupt." };
  }
  if (buffer.length > 10 * 1024 * 1024) {
    return { isValid: false, mimeType: "", error: "File size exceeds 10 MB limit." };
  }
  const headerSlice = buffer.subarray(0, Math.min(1024, buffer.length));
  if (headerSlice.includes(Buffer.from("%PDF"))) {
    return { isValid: true, mimeType: "application/pdf" };
  }
  if (buffer[0] === 137 && buffer[1] === 80 && buffer[2] === 78 && buffer[3] === 71) {
    return { isValid: true, mimeType: "image/png" };
  }
  if (buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) {
    return { isValid: true, mimeType: "image/jpeg" };
  }
  if (buffer.length >= 6) {
    const gifHeader = buffer.subarray(0, 6).toString("ascii");
    if (gifHeader === "GIF87a" || gifHeader === "GIF89a") {
      return { isValid: true, mimeType: "image/gif" };
    }
  }
  if (buffer.length >= 12 && buffer.subarray(0, 4).toString("ascii") === "RIFF" && buffer.subarray(8, 12).toString("ascii") === "WEBP") {
    return { isValid: true, mimeType: "image/webp" };
  }
  if (buffer[0] === 80 && buffer[1] === 75 && buffer[2] === 3 && buffer[3] === 4) {
    return { isValid: true, mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
  }
  if (buffer[0] === 208 && buffer[1] === 207 && buffer[2] === 17 && buffer[3] === 224) {
    return { isValid: true, mimeType: "application/msword" };
  }
  if (originalName) {
    const ext = originalName.split(".").pop()?.toLowerCase();
    if (ext === "pdf") return { isValid: true, mimeType: "application/pdf" };
    if (ext === "png") return { isValid: true, mimeType: "image/png" };
    if (ext === "jpg" || ext === "jpeg") return { isValid: true, mimeType: "image/jpeg" };
    if (ext === "webp") return { isValid: true, mimeType: "image/webp" };
    if (ext === "gif") return { isValid: true, mimeType: "image/gif" };
    if (ext === "docx") return { isValid: true, mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
    if (ext === "doc") return { isValid: true, mimeType: "application/msword" };
    if (ext === "txt") return { isValid: true, mimeType: "text/plain" };
  }
  return { isValid: false, mimeType: "", error: "Unsupported or corrupt file type. Only PDF, PNG, JPG, WebP, GIF, Word, and TXT files are accepted." };
}
var ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      "User-Agent": "aistudio-build"
    }
  }
});
var router3 = Router3();
router3.use(requireAuth);
router3.use(requireTenantType("supplier"));
router3.get("/profile", async (req, res) => {
  try {
    const ctx = getSupplierContext(req);
    const profile = await suppliersRepository.getById(ctx.tenantId);
    res.json(profile);
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router3.put("/profile", async (req, res) => {
  try {
    const ctx = getSupplierContext(req);
    const updated = await suppliersRepository.updateProfile(ctx.tenantId, req.body);
    res.json(updated);
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router3.get("/people", async (req, res) => {
  try {
    const ctx = getSupplierContext(req);
    const people = await suppliersRepository.listPeople(ctx.tenantId);
    res.json(people);
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router3.post("/people", async (req, res) => {
  try {
    const ctx = getSupplierContext(req);
    const person = await suppliersRepository.addPerson(ctx.tenantId, req.body, { id: ctx.userId, email: ctx.userEmail });
    res.status(201).json(person);
  } catch (err) {
    const status = err.status || 400;
    res.status(status).json({
      error: err.code || "VALIDATION_ERROR",
      code: err.code || "VALIDATION_ERROR",
      field: err.field || "fullName",
      message: err.message || "Failed to save director"
    });
  }
});
router3.put("/people/:id", async (req, res) => {
  try {
    const ctx = getSupplierContext(req);
    const person = await suppliersRepository.updatePerson(ctx.tenantId, req.params.id, req.body, { id: ctx.userId, email: ctx.userEmail });
    if (!person) {
      return res.status(404).json({ error: "NOT_FOUND", field: "id", message: "Person not found" });
    }
    res.json(person);
  } catch (err) {
    const status = err.status || 400;
    res.status(status).json({
      error: err.code || "VALIDATION_ERROR",
      code: err.code || "VALIDATION_ERROR",
      field: err.field || "fullName",
      message: err.message || "Failed to update director"
    });
  }
});
async function getSupplierIdForUser(client, userId, activeTenantId) {
  if (activeTenantId && activeTenantId !== "platform") {
    const res2 = await client.query(
      `SELECT supplier_id FROM supplier_members WHERE user_id = $1 AND supplier_id = $2 AND status = 'active' LIMIT 1`,
      [userId, activeTenantId]
    );
    if (res2.rows.length > 0) return res2.rows[0].supplier_id;
  }
  const res = await client.query(
    `SELECT supplier_id FROM supplier_members WHERE user_id = $1 AND status = 'active' ORDER BY is_owner DESC, created_at ASC LIMIT 1`,
    [userId]
  );
  return res.rows[0]?.supplier_id || null;
}
router3.delete("/people/:id", async (req, res) => {
  if (!req.user || !req.session) {
    return res.status(401).json({ error: "unauthorized", message: "You must be signed in." });
  }
  let client;
  try {
    client = await getClient();
    await client.query("BEGIN");
    await client.query("SET LOCAL lock_timeout = '3s'");
    await client.query("SET LOCAL statement_timeout = '8s'");
    const supplierId = await getSupplierIdForUser(client, req.user.id, req.activeTenant?.tenantId);
    if (!supplierId) {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: "forbidden", message: "You do not have access." });
    }
    const r = await client.query(
      "UPDATE supplier_people SET is_active = FALSE, updated_at = NOW() WHERE id = $1 AND supplier_id = $2 AND is_active = TRUE RETURNING id, full_name",
      [req.params.id, supplierId]
    );
    if (r.rowCount === 0) {
      const ex = await client.query(
        "SELECT is_active FROM supplier_people WHERE id = $1 AND supplier_id = $2",
        [req.params.id, supplierId]
      );
      await client.query("ROLLBACK");
      if (ex.rowCount === 0) {
        return res.status(404).json({ error: "not_found", message: "This person was not found." });
      }
      return res.json({ ok: true, alreadyRemoved: true });
    }
    const actorName = req.user?.fullName || req.user?.email || "Supplier Administrator";
    const actorRole = req.activeTenant?.roleName || (req.user?.isPlatformAdmin ? "Super Admin" : "Supplier");
    await auditRepository.logEvent(
      {
        actorName,
        actorRole,
        actorUserId: req.user.id,
        supplierId,
        action: "supplier_person.remove",
        entityType: "supplier_person",
        entityId: r.rows[0].id,
        ipAddress: extractClientIp(req),
        details: `Removed director/shareholder record ${r.rows[0].full_name || r.rows[0].id}.`
      },
      client
    );
    await client.query("COMMIT");
    await suppliersRepository.calculateCompleteness(supplierId).catch(() => {
    });
    res.json({ ok: true, id: r.rows[0].id });
  } catch (err) {
    try {
      if (client) await client.query("ROLLBACK");
    } catch {
    }
    console.error("[remove-director] failed", err.code, err.message);
    if (!res.headersSent) {
      res.status(err.code === "55P03" ? 503 : 500).json({
        error: "server",
        message: "We could not remove this person. Try again."
      });
    }
  } finally {
    if (client) client.release();
  }
});
router3.get("/projects", async (req, res) => {
  try {
    const ctx = getSupplierContext(req);
    const projects = await suppliersRepository.listProjects(ctx.tenantId);
    res.json(projects);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router3.post("/projects", async (req, res) => {
  try {
    const ctx = getSupplierContext(req);
    const project = await suppliersRepository.addProject(ctx.tenantId, req.body);
    res.status(201).json(project);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
router3.put("/projects/:id", async (req, res) => {
  try {
    const ctx = getSupplierContext(req);
    const updated = await suppliersRepository.updateProject(ctx.tenantId, req.params.id, req.body);
    if (!updated) {
      res.status(404).json({ error: "NOT_FOUND", message: "Project not found." });
      return;
    }
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
router3.delete("/projects/:id", async (req, res) => {
  try {
    const ctx = getSupplierContext(req);
    const deleted = await suppliersRepository.deleteProject(ctx.tenantId, req.params.id);
    if (!deleted) {
      res.status(404).json({ error: "NOT_FOUND", message: "Project not found." });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
router3.get("/team", async (req, res) => {
  try {
    const ctx = getSupplierContext(req);
    const team = await suppliersRepository.listTeam(ctx.tenantId);
    res.json(team);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router3.post("/team/invite", async (req, res) => {
  try {
    const ctx = getSupplierContext(req);
    const { email, role } = req.body;
    const invite = await suppliersRepository.inviteTeamMember(ctx.tenantId, {
      email,
      role,
      invitedByUserId: ctx.userId
    });
    const supProfile = await suppliersRepository.getById(ctx.tenantId).catch(() => null);
    await notificationsRepository.queueEmailDelivery({
      recipientEmail: invite.email,
      templateCode: "team_invitation",
      vars: {
        tenantName: supProfile?.legalName || "Supplier Workspace",
        inviterName: req.user?.fullName || "Supplier Admin",
        roleName: invite.role,
        expiresAt: String(invite.expiresAt || "").slice(0, 10)
      }
    }).catch(() => {
    });
    res.status(201).json(invite);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
router3.delete("/team/invite/:id", async (req, res) => {
  try {
    const ctx = getSupplierContext(req);
    const revoked = await suppliersRepository.revokeInvitation(ctx.tenantId, req.params.id);
    if (!revoked) {
      res.status(404).json({ error: "NOT_FOUND", message: "Invitation not found or already closed." });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
router3.get("/disciplines", async (req, res) => {
  try {
    const ctx = getSupplierContext(req);
    const disciplines = await suppliersRepository.getDisciplines(ctx.tenantId);
    res.json(disciplines);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router3.get("/documents", async (req, res) => {
  try {
    const ctx = getSupplierContext(req);
    const docs = await documentsRepository.listBySupplier(ctx.tenantId);
    res.json(docs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router3.post("/documents/upload", upload.single("file"), async (req, res) => {
  try {
    const ctx = getSupplierContext(req);
    const file = req.file;
    const { documentTypeCode, documentNumber, issueDate, expiryDate, title, certifiedCopy, identityType, gender } = req.body;
    if (!file) {
      res.status(400).json({ error: "MISSING_FILE", message: "No file uploaded or file missing." });
      return;
    }
    if (!documentTypeCode) {
      res.status(400).json({ error: "MISSING_TYPE", message: "Document type code is required." });
      return;
    }
    let cleanedDocNumber = documentNumber ? String(documentNumber).trim() : void 0;
    const isDirectorsIdDoc = String(documentTypeCode).toUpperCase() === "DIRECTOR_ID" || /director|shareholder|omang/i.test(String(title || ""));
    if (isDirectorsIdDoc && cleanedDocNumber && String(identityType || "OMANG").toUpperCase() !== "PASSPORT") {
      const omangCheck = validateOmang(cleanedDocNumber, gender);
      if (!omangCheck.ok) {
        res.status(400).json({
          error: omangCheck.code,
          code: omangCheck.code,
          field: "documentNumber",
          message: omangCheck.message
        });
        return;
      }
      cleanedDocNumber = omangCheck.normalised;
    }
    const validation = validateFileBuffer(file.buffer, file.originalname);
    if (!validation.isValid) {
      res.status(400).json({ error: "INVALID_FILE", message: validation.error || "Invalid file format." });
      return;
    }
    const doc = await documentsRepository.uploadVersion({
      supplierId: ctx.tenantId,
      documentTypeCode,
      fileName: file.originalname || "document.pdf",
      mimeType: validation.mimeType,
      fileBuffer: file.buffer,
      documentNumber: cleanedDocNumber,
      issueDate,
      expiryDate,
      certifiedCopy: certifiedCopy === "true" || certifiedCopy === true,
      title,
      userId: ctx.userId
    });
    await suppliersRepository.calculateCompleteness(ctx.tenantId);
    res.status(201).json(doc);
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router3.delete("/documents/:id", async (req, res) => {
  try {
    const ctx = getSupplierContext(req);
    await documentsRepository.deleteDocument(req.params.id, ctx.tenantId);
    await suppliersRepository.calculateCompleteness(ctx.tenantId);
    res.json({ success: true, message: "Document removed from vault." });
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router3.get("/documents/:id/file", async (req, res) => {
  try {
    const ctx = getSupplierContext(req);
    const fileRecord = await documentsRepository.getFileByVersionOrDocId(req.params.id, ctx.tenantId);
    if (!fileRecord) {
      res.status(404).json({
        error: "NOT_FOUND",
        message: "No uploaded file found for this document. Please upload the document file to preview it."
      });
      return;
    }
    const isDownload = req.query.download === "1" || req.query.download === "true" || req.query.attachment === "true";
    const dispositionType = isDownload ? "attachment" : "inline";
    const safeFileName = (fileRecord.fileName || "document").replace(/[\r\n"\\]/g, "_");
    res.setHeader("Content-Type", fileRecord.mimeType || "application/octet-stream");
    res.setHeader("Content-Length", String(fileRecord.content.length));
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Disposition", `${dispositionType}; filename="${safeFileName}"; filename*=UTF-8''${encodeURIComponent(safeFileName)}`);
    res.setHeader("Cache-Control", "private, no-store, no-cache, must-revalidate");
    res.send(fileRecord.content);
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router3.post("/documents/read", async (req, res) => {
  try {
    const { fileBase64, mimeType, documentTypeName, identityType } = req.body;
    if (!fileBase64) {
      res.status(400).json({ error: "File content is required" });
      return;
    }
    let parsed = null;
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: mimeType || "application/pdf",
                data: fileBase64
              }
            },
            {
              text: "Extract document details from this uploaded document. Return valid JSON only (no markdown formatting), with these exact fields: document_type, holder_name, document_number, issue_date (YYYY-MM-DD), expiry_date (YYYY-MM-DD), issuing_authority, and confidence (an object containing a confidence score from 0 to 1 for each of document_type, holder_name, document_number, issue_date, expiry_date, issuing_authority). Use null when a field is not visible. Never guess."
            }
          ]
        },
        config: {
          responseMimeType: "application/json"
        }
      });
      let rawText = response.text || "{}";
      rawText = rawText.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/, "").trim();
      parsed = JSON.parse(rawText);
    } catch (aiErr) {
      console.warn("[GEMINI API READ WARNING]:", aiErr?.message || "Read failed");
    }
    if (!parsed || typeof parsed !== "object") {
      return res.json({
        document_type: documentTypeName || null,
        holder_name: null,
        document_number: null,
        issue_date: null,
        expiry_date: null,
        issuing_authority: null,
        confidence: {},
        validation_status: "Needs review",
        omang_valid: null,
        auto_fill_allowed: false,
        verified: false
      });
    }
    const isDirectorsIdDoc = /director|shareholder|omang|national.?id|director_id/i.test(String(documentTypeName || "")) || /omang|national.?id/i.test(String(parsed.document_type || ""));
    const isOmangCheck = isDirectorsIdDoc && String(identityType || "OMANG").toUpperCase() !== "PASSPORT";
    let omangValid = null;
    let omangError = null;
    let derivedGender = null;
    let validationStatus = "Extracted (unverified)";
    let autoFillAllowed = Boolean(parsed.document_number);
    if (isOmangCheck) {
      if (parsed.document_number) {
        const omangCheck = validateOmang(String(parsed.document_number));
        omangValid = omangCheck.ok;
        if (omangCheck.ok) {
          parsed.document_number = omangCheck.normalised;
          derivedGender = omangCheck.derivedGender;
        } else {
          omangError = omangCheck.message;
          validationStatus = "Needs review";
          autoFillAllowed = false;
        }
      } else {
        validationStatus = "Needs review";
        autoFillAllowed = false;
      }
    }
    res.json({
      ...parsed,
      omang_valid: omangValid,
      omang_error: omangError,
      derived_gender: derivedGender,
      validation_status: validationStatus,
      auto_fill_allowed: autoFillAllowed,
      verified: false
      // Reading a document never verifies it
    });
  } catch (err) {
    console.error("[GEMINI DOCUMENT READ ERROR]", err?.message || "Unknown error");
    res.status(500).json({
      error: "DOCUMENT_READ_FAILED",
      validation_status: "Needs review",
      auto_fill_allowed: false,
      verified: false,
      message: "Could not read document details automatically."
    });
  }
});
router3.post("/documents/:id/read", async (req, res) => {
  try {
    const ctx = getSupplierContext(req);
    const docId = req.params.id;
    const docs = await documentsRepository.listBySupplier(ctx.tenantId);
    const targetDoc = docs.find((d) => d.documentId === docId);
    if (!targetDoc) {
      res.status(404).json({ error: "DOCUMENT_NOT_FOUND", message: "Document not found in vault." });
      return;
    }
    const extracted = {
      document_type: targetDoc.documentTypeName,
      holder_name: null,
      document_number: targetDoc.documentNumber || null,
      issue_date: targetDoc.issueDate || null,
      expiry_date: targetDoc.expiryDate || null,
      issuing_authority: targetDoc.issuingAuthority || null,
      confidence: {},
      validation_status: "Needs review",
      omang_valid: null,
      omang_error: null,
      derived_gender: null,
      auto_fill_allowed: false,
      verified: false
      // Reading a document never verifies it
    };
    const fileRecord = await documentsRepository.getFileByVersionOrDocId(docId, ctx.tenantId).catch(() => null);
    if (fileRecord && fileRecord.content) {
      try {
        const response = await ai.models.generateContent({
          model: "gemini-2.5-flash",
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: fileRecord.mimeType || "application/pdf",
                  data: fileRecord.content.toString("base64")
                }
              },
              {
                text: "Extract document details from this uploaded document. Return valid JSON only (no markdown formatting), with these exact fields: document_type, holder_name, document_number, issue_date (YYYY-MM-DD), expiry_date (YYYY-MM-DD), issuing_authority, and confidence (an object containing a confidence score from 0 to 1 for each of document_type, holder_name, document_number, issue_date, expiry_date, issuing_authority). Use null when a field is not visible. Never guess."
              }
            ]
          },
          config: {
            responseMimeType: "application/json"
          }
        });
        let rawText = response.text || "{}";
        rawText = rawText.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/, "").trim();
        const parsed = JSON.parse(rawText);
        if (parsed && typeof parsed === "object") {
          Object.assign(extracted, parsed, { verified: false });
        }
      } catch (aiErr) {
        console.warn("[GEMINI STORED DOC READ WARNING]:", aiErr?.message || "Read failed");
      }
    }
    const isDirectorsIdDoc = String(targetDoc.documentTypeCode || "").toUpperCase() === "DIRECTOR_ID" || /director|shareholder|omang|national.?id/i.test(String(targetDoc.documentTypeName || ""));
    if (isDirectorsIdDoc) {
      if (extracted.document_number) {
        const omangCheck = validateOmang(String(extracted.document_number));
        extracted.omang_valid = omangCheck.ok;
        if (omangCheck.ok) {
          extracted.document_number = omangCheck.normalised;
          extracted.derived_gender = omangCheck.derivedGender;
          extracted.validation_status = "Extracted (unverified)";
          extracted.auto_fill_allowed = true;
        } else {
          extracted.omang_error = omangCheck.message;
          extracted.validation_status = "Needs review";
          extracted.auto_fill_allowed = false;
        }
      } else {
        extracted.validation_status = "Needs review";
        extracted.auto_fill_allowed = false;
      }
    } else if (extracted.document_number) {
      extracted.validation_status = "Extracted (unverified)";
      extracted.auto_fill_allowed = true;
    }
    extracted.verified = false;
    res.json({ success: true, extracted, document: targetDoc });
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router3.get("/consent", async (req, res) => {
  try {
    const ctx = getSupplierContext(req);
    const grants = await consentRepository.listBySupplier(ctx.tenantId);
    res.json(grants);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router3.get("/consent/access-logs", async (req, res) => {
  try {
    const ctx = getSupplierContext(req);
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const logs = await consentRepository.listAccessLogsBySupplier(ctx.tenantId, limit);
    res.json(logs);
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router3.post("/consent", async (req, res) => {
  try {
    const ctx = getSupplierContext(req);
    const { organizationId, scopes, selectedDocumentIds, selectedDocumentNames, expiresAt, purpose } = req.body || {};
    if (!organizationId) {
      return res.status(400).json({ error: "MISSING_ORG", message: "Procuring organization ID is required." });
    }
    const grant = await consentRepository.grantConsent({
      supplierId: ctx.tenantId,
      organizationId,
      userId: ctx.userId,
      scopes,
      selectedDocumentIds,
      selectedDocumentNames,
      expiresAt,
      purpose,
      actorName: req.user.fullName,
      actorRole: ctx.roleName,
      ipAddress: extractClientIp(req)
    });
    res.status(201).json(grant);
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router3.patch("/consent/:id", async (req, res) => {
  try {
    const ctx = getSupplierContext(req);
    const { scopes, selectedDocumentIds, selectedDocumentNames, expiresAt } = req.body || {};
    const updated = await consentRepository.updateConsentScope(
      req.params.id,
      ctx.tenantId,
      ctx.userId,
      { scopes, selectedDocumentIds, selectedDocumentNames, expiresAt },
      {
        actorName: req.user.fullName,
        actorRole: ctx.roleName,
        ipAddress: extractClientIp(req)
      }
    );
    res.json(updated);
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router3.post("/consent/:id/revoke", async (req, res) => {
  try {
    const ctx = getSupplierContext(req);
    const { reason } = req.body || {};
    await consentRepository.revokeConsent(
      req.params.id,
      ctx.tenantId,
      ctx.userId,
      reason || "Revoked by supplier administrator",
      {
        actorName: req.user.fullName,
        actorRole: ctx.roleName,
        ipAddress: extractClientIp(req)
      }
    );
    res.json({ success: true, message: "Data sharing access revoked." });
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router3.get("/applications", async (req, res) => {
  try {
    const ctx = getSupplierContext(req);
    const apps = await applicationsRepository.listBySupplier(ctx.tenantId);
    res.json(apps);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router3.post("/applications/submit", async (req, res) => {
  try {
    const ctx = getSupplierContext(req);
    const { callId, answers, attachedDocumentVersionIds } = req.body;
    if (!callId) {
      res.status(400).json({ error: "MISSING_CALL_ID", message: "Call ID is required." });
      return;
    }
    const ip = extractClientIp(req);
    const result = await applicationsRepository.submitApplication({
      callId,
      supplierId: ctx.tenantId,
      userId: ctx.userId,
      answers: answers || {},
      attachedDocumentVersionIds: attachedDocumentVersionIds || [],
      actorName: req.user.fullName,
      actorRole: ctx.roleName,
      ipAddress: ip
    });
    res.status(201).json(result);
  } catch (err) {
    if (err?.status === 403 || err?.status === 400 || err?.status === 404) {
      res.status(err.status).json({
        error: err.code || "SUBMISSION_BLOCKED",
        code: err.code || "SUBMISSION_BLOCKED",
        message: err.message || "Application submission could not be completed."
      });
      return;
    }
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router3.post("/applications/:id/withdraw", async (req, res) => {
  try {
    const ctx = getSupplierContext(req);
    const { reason } = req.body || {};
    const result = await applicationsRepository.withdrawApplication({
      applicationIdOrCallId: req.params.id,
      supplierId: ctx.tenantId,
      userId: ctx.userId,
      reason,
      actorName: req.user.fullName,
      actorRole: ctx.roleName,
      ipAddress: extractClientIp(req)
    });
    res.json({ success: true, ...result });
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router3.post("/applications/:id/respond", async (req, res) => {
  try {
    const ctx = getSupplierContext(req);
    const { responseMessage } = req.body || {};
    await applicationsRepository.respondToInfoRequest({
      applicationId: req.params.id,
      supplierId: ctx.tenantId,
      userId: ctx.userId,
      responseMessage,
      actorName: req.user.fullName,
      actorRole: ctx.roleName,
      ipAddress: extractClientIp(req)
    });
    res.json({ success: true, message: "Additional information submitted to procuring organization." });
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router3.get("/bids/:callId", async (req, res) => {
  try {
    const ctx = getSupplierContext(req);
    const bid = await bidsRepository.getByCallAndSupplier(req.params.callId, ctx.tenantId);
    res.json(bid);
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router3.post("/bids/seal", async (req, res) => {
  try {
    const ctx = getSupplierContext(req);
    const { callId, financialSchedule } = req.body;
    if (!callId || !financialSchedule || !financialSchedule.length) {
      res.status(400).json({ error: "INVALID_BID_DATA", code: "INVALID_BID_DATA", message: "Tender ID and completed financial bill of quantities schedule are required." });
      return;
    }
    const ip = extractClientIp(req);
    const result = await bidsRepository.sealAndSubmitBid({
      callId,
      supplierId: ctx.tenantId,
      userId: ctx.userId,
      financialSchedule,
      actorName: req.user.fullName,
      actorRole: ctx.roleName,
      ipAddress: ip
    });
    res.status(201).json(result);
  } catch (err) {
    if (err?.status === 403 || err?.status === 400 || err?.status === 404) {
      res.status(err.status).json({
        error: err.code || "BID_SUBMISSION_BLOCKED",
        code: err.code || "BID_SUBMISSION_BLOCKED",
        message: err.message || "Bid submission blocked due to supplier compliance status."
      });
      return;
    }
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router3.post("/bids/:callId/withdraw", async (req, res) => {
  try {
    const ctx = getSupplierContext(req);
    const { reason } = req.body || {};
    const result = await bidsRepository.withdrawBid({
      callId: req.params.callId,
      supplierId: ctx.tenantId,
      userId: ctx.userId,
      reason,
      actorName: req.user.fullName,
      actorRole: ctx.roleName,
      ipAddress: extractClientIp(req)
    });
    res.json({ success: true, ...result });
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router3.get("/invitations", async (req, res) => {
  try {
    const ctx = getSupplierContext(req);
    const invitations = await callsRepository.listSupplierInvitations(ctx.tenantId);
    res.json(invitations);
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
var supplierRouter = router3;

// server/routes/calls.routes.ts
import { Router as Router4 } from "express";
var router4 = Router4();
router4.get("/", async (req, res) => {
  try {
    const { q, type } = req.query;
    const supplierId = req.activeTenant?.tenantType === "supplier" ? req.activeTenant.tenantId : void 0;
    const calls = await callsRepository.listOpen({
      query: q,
      callType: type,
      supplierId
    });
    res.json(calls);
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router4.get("/:id", async (req, res) => {
  try {
    const call = await callsRepository.getById(req.params.id, {
      supplierId: req.activeTenant?.tenantType === "supplier" ? req.activeTenant.tenantId : void 0,
      organizationId: req.activeTenant?.tenantType === "organization" ? req.activeTenant.tenantId : void 0,
      isPlatformAdmin: Boolean(req.user?.isPlatformAdmin)
    });
    if (!call) {
      res.status(404).json({ error: "CALL_NOT_FOUND", message: "Tender call not found or restricted." });
      return;
    }
    res.json(call);
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router4.post("/:id/addenda/:addendumId/acknowledge", requireAuth, requireTenantType("supplier"), async (req, res) => {
  try {
    const ctx = getSupplierContext(req);
    const result = await callsRepository.acknowledgeAddendum({
      callId: req.params.id,
      addendumId: req.params.addendumId,
      supplierId: ctx.tenantId,
      userId: ctx.userId,
      actorName: req.user.fullName,
      actorRole: ctx.roleName,
      ipAddress: extractClientIp(req)
    });
    res.json({ success: true, ...result });
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router4.get("/:id/clarifications", async (req, res) => {
  try {
    const supplierId = req.activeTenant?.tenantType === "supplier" ? req.activeTenant.tenantId : void 0;
    const items = await callsRepository.listClarifications(req.params.id, supplierId);
    res.json(items);
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router4.post("/:id/clarifications", requireAuth, requireTenantType("supplier"), async (req, res) => {
  try {
    const ctx = getSupplierContext(req);
    const { question, topic } = req.body;
    if (!question || !String(question).trim()) {
      res.status(400).json({ error: "MISSING_QUESTION", message: "Question content cannot be empty." });
      return;
    }
    const item = await callsRepository.askClarification({
      callId: req.params.id,
      supplierId: ctx.tenantId,
      userId: ctx.userId,
      question: String(question).trim(),
      topic
    });
    res.status(201).json(item);
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
var callsRouter = router4;

// server/routes/buyer.routes.ts
import { Router as Router5 } from "express";

// server/repositories/evaluations.repository.ts
var EvaluationsRepository = class {
  async getCriteria(callId) {
    const res = await query(
      `SELECT id, call_id AS "callId", name, description,
              criterion_type AS "criterionType", stage, weight,
              max_score AS "maxScore", is_mandatory_gate AS "isMandatoryGate", sort_order AS "sortOrder"
       FROM evaluation_criteria
       WHERE call_id = $1
       ORDER BY sort_order ASC`,
      [callId]
    );
    return res.rows;
  }
  async getEvaluatorAssignment(callId, userId) {
    const res = await query(
      `SELECT id, call_id AS "callId", user_id AS "userId", organization_id AS "organizationId",
              evaluator_role AS "evaluatorRole", coi_status AS "coiStatus", coi_declared_at AS "coiDeclaredAt",
              scorecard_locked AS "scorecardLocked", scorecard_locked_at AS "scorecardLockedAt"
       FROM evaluator_assignments
       WHERE call_id = $1 AND user_id = $2`,
      [callId, userId]
    );
    return res.rows[0] || null;
  }
  async signConflictDeclaration(callId, userId, orgId, hasConflict, details) {
    await tx(async (client) => {
      let assignmentRes = await client.query(
        `SELECT id FROM evaluator_assignments WHERE call_id = $1 AND user_id = $2`,
        [callId, userId]
      );
      let assignmentId = assignmentRes.rows[0]?.id;
      if (!assignmentId) {
        const createRes = await client.query(
          `INSERT INTO evaluator_assignments (call_id, user_id, organization_id, evaluator_role, assigned_by_user_id, coi_status, coi_declared_at, coi_details)
           VALUES ($1, $2, $3, 'evaluator', $2, $4, NOW(), $5) RETURNING id`,
          [callId, userId, orgId, hasConflict ? "conflict" : "none", details || null]
        );
        assignmentId = createRes.rows[0].id;
      } else {
        await client.query(
          `UPDATE evaluator_assignments
           SET coi_status = $2, coi_declared_at = NOW(), coi_details = $3
           WHERE id = $1`,
          [assignmentId, hasConflict ? "conflict" : "none", details || null]
        );
      }
      await client.query(
        `INSERT INTO conflict_declarations (evaluator_assignment_id, has_conflict, details, declared_at)
         VALUES ($1, $2, $3, NOW())`,
        [assignmentId, hasConflict, details || null]
      );
    });
  }
  async submitScore(data) {
    const assignment = await this.getEvaluatorAssignment(data.callId, data.userId);
    if (!assignment) {
      throw new Error("You are not assigned as an evaluator for this tender.");
    }
    if (assignment.coiStatus !== "none") {
      throw new Error("Conflict of Interest Declaration Required: You must sign the statutory independence declaration before scoring.");
    }
    if (assignment.scorecardLocked) {
      throw new Error("This scorecard has been locked and finalized. No further score modifications are permitted.");
    }
    await query(
      `INSERT INTO evaluation_scores (
        criterion_id, bid_id, evaluator_assignment_id, score_value, comment, submitted_at
      ) VALUES (
        $1, $2, $3, $4, $5, NOW()
      )
      ON CONFLICT (criterion_id, bid_id, evaluator_assignment_id) DO UPDATE
      SET score_value = EXCLUDED.score_value,
          comment = EXCLUDED.comment,
          submitted_at = NOW()`,
      [data.criterionId, data.bidId, assignment.id, data.score, data.comment || null]
    );
  }
  async lockScorecard(data) {
    const assignment = await this.getEvaluatorAssignment(data.callId, data.userId);
    if (!assignment) throw new Error("Evaluator assignment not found.");
    await tx(async (client) => {
      await client.query(
        `UPDATE evaluator_assignments
         SET scorecard_locked = TRUE, scorecard_locked_at = NOW()
         WHERE id = $1`,
        [assignment.id]
      );
      await client.query(
        `UPDATE evaluation_scores
         SET locked_at = NOW()
         WHERE evaluator_assignment_id = $1`,
        [assignment.id]
      );
      await auditRepository.logEvent(
        {
          actorName: data.actorName,
          actorRole: data.actorRole,
          actorUserId: data.userId,
          organizationId: data.orgId,
          action: "Scorecard Finalized & Locked",
          entityType: "EvaluatorAssignment",
          entityId: assignment.id,
          ipAddress: data.ipAddress,
          details: `Evaluator scorecard locked and finalized for call ${data.callId}.`
        },
        client
      );
    });
  }
  async listScores(callId) {
    const res = await query(
      `SELECT es.criterion_id AS "criterionId", es.bid_id AS "bidId",
              es.evaluator_assignment_id AS "evaluatorAssignmentId",
              es.score_value AS "scoreValue", es.pass_fail AS "passFail",
              es.comment, es.locked_at AS "lockedAt"
       FROM evaluation_scores es
       JOIN evaluation_criteria ec ON ec.id = es.criterion_id
       WHERE ec.call_id = $1`,
      [callId]
    );
    return res.rows;
  }
};
var evaluationsRepository = new EvaluationsRepository();

// server/repositories/awards.repository.ts
var AwardsRepository = class {
  async listAwards(orgId) {
    const res = await query(
      `SELECT a.id, a.call_id AS "callId", c.reference_no AS "callNumber", c.title AS "callTitle",
              a.bid_id AS "bidId", a.supplier_id AS "supplierId", s.legal_name AS "supplierName",
              a.status, a.award_value::numeric AS "awardValue", a.currency, a.justification,
              a.is_public_notice AS "isPublicNotice",
              a.recommended_by_user_id AS "recommendedByUserId",
              ru.full_name AS "recommendedByName",
              (SELECT au.full_name FROM award_approvals aa JOIN users au ON au.id = aa.approver_user_id WHERE aa.award_id = a.id ORDER BY aa.decided_at DESC NULLS LAST LIMIT 1) AS "approvedByName",
              (SELECT aa.comment FROM award_approvals aa WHERE aa.award_id = a.id ORDER BY aa.decided_at DESC NULLS LAST LIMIT 1) AS "decisionComment",
              (SELECT aa.decided_at FROM award_approvals aa WHERE aa.award_id = a.id ORDER BY aa.decided_at DESC NULLS LAST LIMIT 1) AS "decidedAt",
              a.issued_at AS "issuedAt",
              a.created_at AS "createdAt"
       FROM awards a
       JOIN calls c ON c.id = a.call_id
       JOIN suppliers s ON s.id = a.supplier_id
       LEFT JOIN users ru ON ru.id = a.recommended_by_user_id
       WHERE c.organization_id = $1
       ORDER BY a.created_at DESC`,
      [orgId]
    );
    return res.rows.map((r) => ({ ...r, awardValue: Number(r.awardValue || 0) }));
  }
  /**
   * Recommends contract award after verifying org ownership and opened bid state.
   */
  async recommendAward(data) {
    if (!Number.isFinite(data.awardValue) || data.awardValue <= 0) {
      const err = new Error("Award value must be greater than zero.");
      err.status = 400;
      throw err;
    }
    const cleanJustification = String(data.justification || "").trim();
    if (!cleanJustification) {
      const err = new Error("Evaluation and award recommendation justification is required.");
      err.status = 400;
      throw err;
    }
    return tx(async (client) => {
      const callRes = await client.query(
        `SELECT id, reference_no, title, status FROM calls WHERE id = $1 AND organization_id = $2 FOR UPDATE`,
        [data.callId, data.orgId]
      );
      if (!callRes.rows.length) {
        const err = new Error("Tender call not found for your organization.");
        err.status = 404;
        throw err;
      }
      const call = callRes.rows[0];
      const bidRes = await client.query(
        `SELECT id, status, supplier_id FROM bids WHERE id = $1 AND call_id = $2 AND supplier_id = $3 FOR UPDATE`,
        [data.bidId, data.callId, data.supplierId]
      );
      if (!bidRes.rows.length) {
        const err = new Error("Referenced bid envelope was not found for this tender call and supplier.");
        err.status = 404;
        throw err;
      }
      if (bidRes.rows[0].status !== "opened") {
        const err = new Error(
          `Bids must be officially unsealed before recommending an award (current bid status: ${bidRes.rows[0].status}).`
        );
        err.status = 400;
        err.code = "BID_NOT_OPENED";
        throw err;
      }
      const existingAward = await client.query(
        `SELECT id, status FROM awards WHERE bid_id = $1 FOR UPDATE`,
        [data.bidId]
      );
      if (existingAward.rows.length > 0 && ["approved", "issued"].includes(existingAward.rows[0].status)) {
        const err = new Error("An approved or issued award already exists for this bid and cannot be overwritten.");
        err.status = 400;
        err.code = "AWARD_ALREADY_FINALIZED";
        throw err;
      }
      const awardRes = await client.query(
        `INSERT INTO awards (
          call_id, bid_id, supplier_id, status, award_value, currency, justification, recommended_by_user_id, created_at, updated_at
        ) VALUES (
          $1, $2, $3, 'pending_approval', $4, $5, $6, $7, NOW(), NOW()
        )
        ON CONFLICT (bid_id) DO UPDATE
        SET status = 'pending_approval',
            award_value = EXCLUDED.award_value,
            justification = EXCLUDED.justification,
            recommended_by_user_id = EXCLUDED.recommended_by_user_id,
            updated_at = NOW()
        RETURNING id`,
        [data.callId, data.bidId, data.supplierId, data.awardValue, data.currency || "BWP", cleanJustification, data.userId]
      );
      const awardId = awardRes.rows[0].id;
      await auditRepository.logEvent(
        {
          actorName: data.actorName,
          actorRole: data.actorRole,
          actorUserId: data.userId,
          organizationId: data.orgId,
          supplierId: data.supplierId,
          action: "Award Recommended",
          entityType: "Award",
          entityId: awardId,
          ipAddress: data.ipAddress,
          details: `Award recommended for ${call.reference_no} (BWP ${data.awardValue.toLocaleString()}). Justification: ${cleanJustification}`
        },
        client
      );
      await notificationsRepository.notifyOrganizationMembers(
        data.orgId,
        {
          supplierId: data.supplierId,
          eventType: "award_pending_approval",
          title: `Award Awaiting Approval (${call.reference_no})`,
          body: `${data.actorName} recommended contract award for BWP ${data.awardValue.toLocaleString()}. An independent authorized approver must sign off.`,
          linkUrl: "awards",
          priority: "urgent",
          permissionCode: "awards.approve",
          data: { awardId, callId: data.callId }
        },
        client
      );
      return awardId;
    });
  }
  /**
   * Approves or rejects contract award with strict:
   * 1) organization scoping
   * 2) pending_approval state validation
   * 3) separation of drafter vs approver enforcement
   * 4) active role authority + financial delegation ceiling verification
   */
  async approveAward(data) {
    if (!["approved", "rejected"].includes(data.decision)) {
      const err = new Error('Award decision must be "approved" or "rejected".');
      err.status = 400;
      throw err;
    }
    await tx(async (client) => {
      const awardRes = await client.query(
        `SELECT a.id, a.award_value, a.call_id, c.reference_no, a.supplier_id, c.title, a.status, a.recommended_by_user_id
         FROM awards a
         JOIN calls c ON c.id = a.call_id
         WHERE a.id = $1 AND c.organization_id = $2
         FOR UPDATE OF a`,
        [data.awardId, data.orgId]
      );
      if (!awardRes.rows.length) {
        const err = new Error("Award record not found for your organization.");
        err.status = 404;
        err.code = "AWARD_NOT_FOUND";
        throw err;
      }
      const award = awardRes.rows[0];
      const awardVal = Number(award.award_value);
      if (award.status !== "pending_approval") {
        const err = new Error(`Award is currently "${award.status}" and is not awaiting approval.`);
        err.status = 400;
        err.code = "AWARD_NOT_PENDING";
        throw err;
      }
      if (award.recommended_by_user_id === data.userId) {
        const err = new Error(
          "Separation of duties violation: the officer who drafted or recommended this award cannot approve or reject it."
        );
        err.status = 403;
        err.code = "SEPARATION_OF_DUTIES_VIOLATION";
        throw err;
      }
      const hasMemberLimitRes = await client.query(
        `SELECT EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'organization_members' AND column_name = 'approval_limit_bwp'
         ) AS exists`
      );
      const limitSelectExpr = hasMemberLimitRes.rows[0]?.exists ? "COALESCE(om.approval_limit_bwp, r.approval_limit_bwp)" : "r.approval_limit_bwp";
      const memberRes = await client.query(
        `SELECT ${limitSelectExpr} AS approval_limit_bwp,
                r.name AS role_name,
                EXISTS (
                  SELECT 1 FROM role_permissions rp
                  JOIN permissions p ON p.id = rp.permission_id
                  WHERE rp.role_id = om.role_id AND p.code = 'awards.approve'
                ) AS has_approve_perm
         FROM organization_members om
         JOIN roles r ON r.id = om.role_id
         WHERE om.user_id = $1 AND om.organization_id = $2 AND om.status = 'active'
         LIMIT 1`,
        [data.userId, data.orgId]
      );
      if (!memberRes.rows.length || !memberRes.rows[0].has_approve_perm) {
        const err = new Error('Insufficient authority: an active organization role with "awards.approve" permission is required.');
        err.status = 403;
        err.code = "APPROVER_AUTHORITY_REQUIRED";
        throw err;
      }
      const limit = memberRes.rows[0]?.approval_limit_bwp !== null && memberRes.rows[0]?.approval_limit_bwp !== void 0 ? Number(memberRes.rows[0].approval_limit_bwp) : null;
      if (data.decision === "approved" && limit !== null && awardVal > limit) {
        const err = new Error(
          `Financial delegation limit exceeded: Your role (${memberRes.rows[0]?.role_name || "Approver"}) has an approval ceiling of BWP ${limit.toLocaleString()}, but the contract value is BWP ${awardVal.toLocaleString()}. Higher board authorization is required.`
        );
        err.status = 403;
        err.code = "APPROVAL_LIMIT_EXCEEDED";
        throw err;
      }
      await client.query(
        `UPDATE awards
         SET status = $2,
             issued_at = CASE WHEN $2 = 'approved' THEN NOW() ELSE issued_at END,
             updated_at = NOW()
         WHERE id = $1`,
        [data.awardId, data.decision === "approved" ? "approved" : "rejected"]
      );
      await client.query(
        `INSERT INTO award_approvals (award_id, approver_user_id, decision, comment, decided_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [data.awardId, data.userId, data.decision, (data.comment || "").trim() || null]
      );
      if (data.decision === "approved") {
        const contractNo = `CTR-${award.reference_no.replace(/[^a-zA-Z0-9]/g, "")}-${Date.now().toString().slice(-5)}`;
        await client.query(
          `INSERT INTO contracts (
            organization_id, supplier_id, award_id, contract_no, title, status, contract_value, currency, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, 'sent_for_signature', $6, 'BWP', NOW(), NOW()
          ) ON CONFLICT DO NOTHING`,
          [data.orgId, award.supplier_id, award.id, contractNo, `Contract for ${award.title}`, awardVal]
        );
        await client.query(`UPDATE calls SET status = 'awarded', updated_at = NOW() WHERE id = $1`, [award.call_id]);
      }
      await auditRepository.logEvent(
        {
          actorName: data.actorName,
          actorRole: data.actorRole,
          actorUserId: data.userId,
          organizationId: data.orgId,
          supplierId: award.supplier_id,
          action: `Award ${data.decision.toUpperCase()}`,
          entityType: "Award",
          entityId: data.awardId,
          ipAddress: data.ipAddress,
          details: `Official award decision recorded for ${award.reference_no}: ${data.decision.toUpperCase()} (BWP ${awardVal.toLocaleString()}). Comment: ${data.comment || "Approved within statutory delegation threshold."}`
        },
        client
      );
      await notificationsRepository.notifyUsers(
        {
          userIds: [award.recommended_by_user_id],
          organizationId: data.orgId,
          eventType: "award_decision",
          title: `Award Recommendation ${data.decision === "approved" ? "Approved" : "Rejected"} (${award.reference_no})`,
          body: `${data.actorName} ${data.decision} the contract award recommendation for ${award.title}.`,
          linkUrl: "awards",
          priority: data.decision === "approved" ? "success" : "warning",
          data: { awardId: data.awardId, callId: award.call_id, decision: data.decision }
        },
        client
      );
      if (data.decision === "approved") {
        await notificationsRepository.notifySupplierMembers(
          award.supplier_id,
          {
            organizationId: data.orgId,
            eventType: "award_issued",
            title: `Contract Award Approved (${award.reference_no})`,
            body: `Congratulations! Your bid for "${award.title}" (BWP ${awardVal.toLocaleString()}) has been officially approved for contract execution.`,
            linkUrl: "applications",
            priority: "success",
            data: { awardId: data.awardId, callId: award.call_id }
          },
          client
        );
      }
    });
  }
  async listContracts(orgId) {
    const res = await query(
      `SELECT c.id, c.contract_no AS "contractNo", c.title,
              c.organization_id AS "organizationId", o.name AS "organizationName",
              c.supplier_id AS "supplierId", s.legal_name AS "supplierName",
              c.status, c.contract_value::numeric AS "contractValue", c.currency,
              c.start_date AS "startDate", c.end_date AS "endDate", c.signed_at AS "signedAt"
       FROM contracts c
       JOIN organizations o ON o.id = c.organization_id
       JOIN suppliers s ON s.id = c.supplier_id
       WHERE c.organization_id = $1
       ORDER BY c.created_at DESC`,
      [orgId]
    );
    const contracts = [];
    for (const row of res.rows) {
      const [mRes, iRes] = await Promise.all([
        query(`SELECT id, title, amount, status, due_date AS "dueDate" FROM contract_milestones WHERE contract_id = $1`, [row.id]),
        query(`SELECT id, invoice_no AS "invoiceNo", amount, status, issued_on AS "issuedOn" FROM contract_invoices WHERE contract_id = $1`, [row.id])
      ]);
      contracts.push({
        ...row,
        contractValue: Number(row.contractValue || 0),
        milestones: mRes.rows,
        invoices: iRes.rows
      });
    }
    return contracts;
  }
};
var awardsRepository = new AwardsRepository();

// server/repositories/workspace.repository.ts
import crypto7 from "crypto";
var UUID_REGEX7 = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
var HEX_COLOR_REGEX = /^#[0-9A-Fa-f]{6}$/;
var ALLOWED_FIELD_TYPES = /* @__PURE__ */ new Set([
  "text",
  "number",
  "dropdown",
  "date",
  "file_upload",
  "yes_no",
  "textarea",
  "email",
  "phone",
  "currency"
]);
async function hasOrgMemberColumn(columnName) {
  const res = await query(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'organization_members'
         AND column_name = $1
     ) AS exists`,
    [columnName]
  ).catch(() => ({ rows: [{ exists: false }] }));
  return Boolean(res.rows[0]?.exists);
}
function validateSafeWebhookUrl(rawUrl) {
  const trimmed = String(rawUrl || "").trim();
  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    const err = new Error("Webhook endpoint must be a valid HTTPS URL.");
    err.status = 400;
    throw err;
  }
  if (parsed.protocol !== "https:") {
    const err = new Error("Webhook endpoint URL must use HTTPS.");
    err.status = 400;
    throw err;
  }
  const host = parsed.hostname.toLowerCase();
  const isBlocked = host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0" || host === "::1" || host === "[::1]" || host.endsWith(".local") || host.endsWith(".internal") || /^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host) || /^127\./.test(host) || /^172\.(1[6-9]|2\d|3[0-1])\./.test(host);
  if (isBlocked) {
    const err = new Error("Webhook URL cannot target localhost, loopback, link-local, or private network hosts.");
    err.status = 400;
    throw err;
  }
  return parsed.toString().slice(0, 500);
}
var DEFAULT_SCORING_TEMPLATES = [
  {
    id: "tpl-qcbs-80-20",
    name: "Quality & Cost-Based Selection (80% Tech / 20% Fin)",
    badge: "Standard Works Template",
    method: "qcbs",
    isActive: true,
    criteria: [
      { id: "c1", label: "Technical Capacity & Experience", weightPercent: 35 },
      { id: "c2", label: "Key Personnel & Team Qualifications", weightPercent: 25 },
      { id: "c3", label: "Methodology & Work Plan", weightPercent: 20 },
      { id: "c4", label: "Price Proposal (Unsealed Post-Tech)", weightPercent: 20 }
    ]
  },
  {
    id: "tpl-least-cost",
    name: "Compliant Least-Cost Selection (Pass/Fail + Price)",
    badge: "Commodities & Supplies",
    method: "least_cost",
    isActive: true,
    criteria: [
      { id: "lc1", label: "Statutory Document Verification", passFail: true },
      { id: "lc2", label: "Technical Specification Compliance", passFail: true },
      { id: "lc3", label: "Evaluated Financial Proposal", weightPercent: 100 }
    ]
  }
];
var WorkspaceRepository = class {
  // =========================================================================
  // 1. TEAM, ROLES & INVITATIONS
  // =========================================================================
  async listOrgRoles(orgId) {
    const res = await query(
      `SELECT r.id,
              r.name,
              r.description,
              r.is_system AS "isSystem",
              r.approval_limit_bwp AS "approvalLimitBwp",
              COALESCE(
                (SELECT array_agg(p.code ORDER BY p.code)
                 FROM role_permissions rp
                 JOIN permissions p ON p.id = rp.permission_id
                 WHERE rp.role_id = r.id),
                '{}'::text[]
              ) AS permissions
       FROM roles r
       WHERE r.scope = 'organization'
         AND (r.organization_id IS NULL OR r.organization_id = $1)
       ORDER BY r.sort_order ASC, r.is_system DESC, r.name ASC`,
      [orgId]
    );
    return res.rows.map((r) => ({
      ...r,
      approvalLimitBwp: r.approvalLimitBwp !== null && r.approvalLimitBwp !== void 0 ? Number(r.approvalLimitBwp) : null
    }));
  }
  async listTeamAndInvitations(orgId) {
    const [hasLimitCol, hasConflictCol] = await Promise.all([
      hasOrgMemberColumn("approval_limit_bwp"),
      hasOrgMemberColumn("conflict_declared")
    ]);
    const limitExpr = hasLimitCol ? "COALESCE(om.approval_limit_bwp, r.approval_limit_bwp)" : "r.approval_limit_bwp";
    const conflictExpr = hasConflictCol ? "COALESCE(om.conflict_declared, FALSE)" : "FALSE";
    const [membersRes, invitesRes, roles] = await Promise.all([
      query(
        `SELECT om.id,
                om.user_id AS "userId",
                u.full_name AS "fullName",
                u.email::text AS email,
                COALESCE(u.phone, '') AS phone,
                COALESCE(om.department, 'Supply Chain Management') AS department,
                COALESCE(om.job_title, r.name) AS "jobTitle",
                om.role_id AS "roleId",
                r.name AS role,
                ${limitExpr} AS "approvalLimitBWP",
                om.status,
                om.is_owner AS "isOwner",
                om.mfa_enforced AS "mfaEnabled",
                ${conflictExpr} AS "conflictDeclared",
                om.joined_at AS "joinedAt",
                om.last_active_at AS "lastActiveAt",
                om.created_at AS "createdAt"
         FROM organization_members om
         JOIN users u ON u.id = om.user_id AND u.deleted_at IS NULL
         JOIN roles r ON r.id = om.role_id
         WHERE om.organization_id = $1 AND om.status != 'removed'
         ORDER BY om.is_owner DESC, om.created_at ASC`,
        [orgId]
      ),
      query(
        `SELECT i.id,
                i.email::text AS email,
                i.role_id AS "roleId",
                r.name AS role,
                COALESCE(i.department, 'Supply Chain Management') AS department,
                COALESCE(i.job_title, r.name) AS "jobTitle",
                i.approval_limit_bwp AS "approvalLimitBWP",
                i.created_at AS "sentAt",
                i.expires_at AS "expiresAt",
                COALESCE(u.full_name, 'Workspace Admin') AS "invitedByName"
         FROM invitations i
         JOIN roles r ON r.id = i.role_id
         LEFT JOIN users u ON u.id = i.invited_by_user_id
         WHERE i.organization_id = $1
           AND i.accepted_at IS NULL
           AND i.revoked_at IS NULL
           AND i.expires_at > NOW()
         ORDER BY i.created_at DESC`,
        [orgId]
      ),
      this.listOrgRoles(orgId)
    ]);
    return {
      members: membersRes.rows.map((m) => ({
        ...m,
        approvalLimitBWP: m.approvalLimitBWP !== null && m.approvalLimitBWP !== void 0 ? Number(m.approvalLimitBWP) : null
      })),
      pendingInvitations: invitesRes.rows.map((inv) => ({
        ...inv,
        approvalLimitBWP: inv.approvalLimitBWP !== null && inv.approvalLimitBWP !== void 0 ? Number(inv.approvalLimitBWP) : null
      })),
      roles
    };
  }
  async inviteOrgMember(orgId, actor, input) {
    const cleanEmail = String(input.email || "").trim().toLowerCase();
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      const err = new Error("A valid officer email address is required.");
      err.status = 400;
      throw err;
    }
    return tx(async (client) => {
      const orgRes = await client.query(`SELECT name FROM organizations WHERE id = $1`, [orgId]);
      const orgName = orgRes.rows[0]?.name || "Procuring Organization";
      let roleRow;
      if (input.roleId && UUID_REGEX7.test(input.roleId)) {
        const rRes = await client.query(
          `SELECT id, name FROM roles WHERE id = $1 AND scope = 'organization' AND (organization_id IS NULL OR organization_id = $2) LIMIT 1`,
          [input.roleId, orgId]
        );
        roleRow = rRes.rows[0];
      }
      if (!roleRow) {
        const targetRoleName = String(input.roleName || "Procurement Officer").trim();
        const rRes = await client.query(
          `SELECT id, name FROM roles
           WHERE scope = 'organization'
             AND (organization_id IS NULL OR organization_id = $2)
             AND LOWER(name) = LOWER($1)
           LIMIT 1`,
          [targetRoleName, orgId]
        );
        roleRow = rRes.rows[0];
      }
      if (!roleRow) {
        const err = new Error("Selected organization role does not exist.");
        err.status = 400;
        throw err;
      }
      const existingMember = await client.query(
        `SELECT om.id, om.status
         FROM organization_members om
         JOIN users u ON u.id = om.user_id
         WHERE om.organization_id = $1 AND LOWER(u.email::text) = LOWER($2) AND om.status != 'removed'
         LIMIT 1`,
        [orgId, cleanEmail]
      );
      if (existingMember.rows.length > 0) {
        const err = new Error(`User ${cleanEmail} is already a member of this organization.`);
        err.status = 409;
        throw err;
      }
      await client.query(
        `UPDATE invitations
         SET revoked_at = NOW()
         WHERE organization_id = $1 AND LOWER(email::text) = LOWER($2) AND accepted_at IS NULL AND revoked_at IS NULL`,
        [orgId, cleanEmail]
      );
      const rawToken = generateRandomToken(32);
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1e3);
      const cleanDept = input.department ? String(input.department).trim().slice(0, 128) : "Supply Chain Management";
      const cleanTitle = input.jobTitle ? String(input.jobTitle).trim().slice(0, 128) : roleRow.name;
      const numLimit = input.approvalLimitBWP !== void 0 && input.approvalLimitBWP !== null && !isNaN(Number(input.approvalLimitBWP)) ? Math.max(0, Number(input.approvalLimitBWP)) : null;
      const invRes = await client.query(
        `INSERT INTO invitations (
           organization_id, email, role_id, token_hash, invited_by_user_id,
           department, job_title, approval_limit_bwp, expires_at
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING id, email::text AS email, created_at, expires_at`,
        [orgId, cleanEmail, roleRow.id, tokenHash, actor.userId, cleanDept, cleanTitle, numLimit, expiresAt]
      );
      const row = invRes.rows[0];
      await notificationsRepository.queueEmailDelivery(
        {
          recipientEmail: cleanEmail,
          templateCode: "team_invitation",
          organizationId: orgId,
          vars: {
            tenantName: orgName,
            inviterName: actor.fullName,
            roleName: roleRow.name,
            expiresAt: expiresAt.toISOString().slice(0, 10)
          }
        },
        client
      );
      await auditRepository.logEvent(
        {
          actorName: actor.fullName,
          actorRole: actor.roleName,
          actorUserId: actor.userId,
          organizationId: orgId,
          organizationName: orgName,
          action: "Team Member Invited",
          entityType: "Organization",
          entityId: row.id,
          ipAddress: actor.ipAddress,
          details: `Invited ${cleanEmail} as ${roleRow.name} (${cleanDept})${numLimit !== null ? ` with BWP ${numLimit.toLocaleString()} limit` : ""}.`
        },
        client
      );
      return {
        id: row.id,
        email: row.email,
        role: roleRow.name,
        department: cleanDept,
        jobTitle: cleanTitle,
        approvalLimitBWP: numLimit,
        sentAt: row.created_at,
        expiresAt: row.expires_at,
        inviteToken: rawToken
      };
    });
  }
  async updateOrgMember(orgId, memberId, actor, updates) {
    if (!UUID_REGEX7.test(memberId)) {
      const err = new Error("Invalid member ID.");
      err.status = 400;
      throw err;
    }
    const [hasLimitCol, hasConflictCol] = await Promise.all([
      hasOrgMemberColumn("approval_limit_bwp"),
      hasOrgMemberColumn("conflict_declared")
    ]);
    return tx(async (client) => {
      const existingRes = await client.query(
        `SELECT om.id, om.user_id, om.is_owner, u.full_name, u.email::text AS email
         FROM organization_members om
         JOIN users u ON u.id = om.user_id
         WHERE om.id = $1 AND om.organization_id = $2
         FOR UPDATE OF om`,
        [memberId, orgId]
      );
      if (!existingRes.rows.length) {
        const err = new Error("Organization member not found.");
        err.status = 404;
        throw err;
      }
      let resolvedRoleId = null;
      let resolvedRoleName = null;
      if (updates.roleId && UUID_REGEX7.test(updates.roleId)) {
        const r = await client.query(
          `SELECT id, name FROM roles WHERE id = $1 AND scope = 'organization' AND (organization_id IS NULL OR organization_id = $2) LIMIT 1`,
          [updates.roleId, orgId]
        );
        if (r.rows[0]) {
          resolvedRoleId = r.rows[0].id;
          resolvedRoleName = r.rows[0].name;
        }
      } else if (updates.roleName) {
        const r = await client.query(
          `SELECT id, name FROM roles WHERE scope = 'organization' AND (organization_id IS NULL OR organization_id = $2) AND LOWER(name) = LOWER($1) LIMIT 1`,
          [updates.roleName.trim(), orgId]
        );
        if (r.rows[0]) {
          resolvedRoleId = r.rows[0].id;
          resolvedRoleName = r.rows[0].name;
        }
      }
      const setClauses = ["updated_at = NOW()"];
      const params = [memberId, orgId];
      let idx = 3;
      if (resolvedRoleId) {
        setClauses.push(`role_id = $${idx++}`);
        params.push(resolvedRoleId);
      }
      if (updates.department !== void 0) {
        setClauses.push(`department = $${idx++}`);
        params.push(String(updates.department).trim().slice(0, 128) || null);
      }
      if (updates.jobTitle !== void 0) {
        setClauses.push(`job_title = $${idx++}`);
        params.push(String(updates.jobTitle).trim().slice(0, 128) || null);
      }
      if (updates.mfaEnabled !== void 0) {
        setClauses.push(`mfa_enforced = $${idx++}`);
        params.push(Boolean(updates.mfaEnabled));
      }
      if (hasLimitCol && updates.approvalLimitBWP !== void 0) {
        const val = updates.approvalLimitBWP === null || updates.approvalLimitBWP === "" ? null : Math.max(0, Number(updates.approvalLimitBWP));
        setClauses.push(`approval_limit_bwp = $${idx++}`);
        params.push(val !== null && !isNaN(val) ? val : null);
      }
      if (hasConflictCol && updates.conflictDeclared !== void 0) {
        setClauses.push(`conflict_declared = $${idx++}`);
        params.push(Boolean(updates.conflictDeclared));
      }
      await client.query(
        `UPDATE organization_members
         SET ${setClauses.join(", ")}
         WHERE id = $1 AND organization_id = $2`,
        params
      );
      await auditRepository.logEvent(
        {
          actorName: actor.fullName,
          actorRole: actor.roleName,
          actorUserId: actor.userId,
          organizationId: orgId,
          action: "Team Member Updated",
          entityType: "Organization",
          entityId: memberId,
          ipAddress: actor.ipAddress,
          details: `Updated officer ${existingRes.rows[0].full_name} (${existingRes.rows[0].email})${resolvedRoleName ? ` \u2014 Role: ${resolvedRoleName}` : ""}.`
        },
        client
      );
    });
  }
  async updateOrgMemberStatus(orgId, memberId, actor, status, reason) {
    if (!UUID_REGEX7.test(memberId)) {
      const err = new Error("Invalid member ID.");
      err.status = 400;
      throw err;
    }
    return tx(async (client) => {
      const existingRes = await client.query(
        `SELECT om.id, om.user_id, om.is_owner, u.full_name
         FROM organization_members om
         JOIN users u ON u.id = om.user_id
         WHERE om.id = $1 AND om.organization_id = $2
         FOR UPDATE OF om`,
        [memberId, orgId]
      );
      if (!existingRes.rows.length) {
        const err = new Error("Organization member not found.");
        err.status = 404;
        throw err;
      }
      const target = existingRes.rows[0];
      if (status === "suspended" && (target.user_id === actor.userId || target.is_owner)) {
        const err = new Error("You cannot suspend your own account or the organization primary owner.");
        err.status = 400;
        throw err;
      }
      await client.query(
        `UPDATE organization_members SET status = $3, updated_at = NOW() WHERE id = $1 AND organization_id = $2`,
        [memberId, orgId, status]
      );
      await auditRepository.logEvent(
        {
          actorName: actor.fullName,
          actorRole: actor.roleName,
          actorUserId: actor.userId,
          organizationId: orgId,
          action: status === "suspended" ? "Team Member Suspended" : "Team Member Reactivated",
          entityType: "Organization",
          entityId: memberId,
          ipAddress: actor.ipAddress,
          details: `${status === "suspended" ? "Suspended" : "Reactivated"} ${target.full_name}${reason ? `. Reason: ${reason.trim()}` : ""}.`
        },
        client
      );
    });
  }
  async removeOrgMember(orgId, memberId, actor) {
    if (!UUID_REGEX7.test(memberId)) {
      const err = new Error("Invalid member ID.");
      err.status = 400;
      throw err;
    }
    return tx(async (client) => {
      const existingRes = await client.query(
        `SELECT om.id, om.user_id, om.is_owner, u.full_name
         FROM organization_members om
         JOIN users u ON u.id = om.user_id
         WHERE om.id = $1 AND om.organization_id = $2
         FOR UPDATE OF om`,
        [memberId, orgId]
      );
      if (!existingRes.rows.length) {
        const err = new Error("Organization member not found.");
        err.status = 404;
        throw err;
      }
      const target = existingRes.rows[0];
      if (target.user_id === actor.userId || target.is_owner) {
        const err = new Error("Cannot remove your own membership or the organization owner.");
        err.status = 400;
        throw err;
      }
      await client.query(
        `UPDATE organization_members SET status = 'removed', updated_at = NOW() WHERE id = $1 AND organization_id = $2`,
        [memberId, orgId]
      );
      await auditRepository.logEvent(
        {
          actorName: actor.fullName,
          actorRole: actor.roleName,
          actorUserId: actor.userId,
          organizationId: orgId,
          action: "Team Member Removed",
          entityType: "Organization",
          entityId: memberId,
          ipAddress: actor.ipAddress,
          details: `Removed officer ${target.full_name} from organization workspace.`
        },
        client
      );
    });
  }
  async revokeOrgInvitation(orgId, invitationId, actor) {
    if (!UUID_REGEX7.test(invitationId)) {
      const err = new Error("Invalid invitation ID.");
      err.status = 400;
      throw err;
    }
    const res = await query(
      `UPDATE invitations
       SET revoked_at = NOW()
       WHERE id = $1 AND organization_id = $2 AND accepted_at IS NULL AND revoked_at IS NULL
       RETURNING id, email::text AS email`,
      [invitationId, orgId]
    );
    if (!res.rows.length) {
      const err = new Error("Pending invitation not found.");
      err.status = 404;
      throw err;
    }
    await auditRepository.logEvent({
      actorName: actor.fullName,
      actorRole: actor.roleName,
      actorUserId: actor.userId,
      organizationId: orgId,
      action: "Team Invitation Revoked",
      entityType: "Organization",
      entityId: invitationId,
      ipAddress: actor.ipAddress,
      details: `Revoked pending invitation for ${res.rows[0].email}.`
    });
  }
  async resendOrgInvitation(orgId, invitationId, actor) {
    if (!UUID_REGEX7.test(invitationId)) {
      const err = new Error("Invalid invitation ID.");
      err.status = 400;
      throw err;
    }
    return tx(async (client) => {
      const invRes = await client.query(
        `SELECT i.id, i.email::text AS email, r.name AS role_name, o.name AS org_name
         FROM invitations i
         JOIN roles r ON r.id = i.role_id
         JOIN organizations o ON o.id = i.organization_id
         WHERE i.id = $1 AND i.organization_id = $2 AND i.accepted_at IS NULL AND i.revoked_at IS NULL
         FOR UPDATE OF i`,
        [invitationId, orgId]
      );
      if (!invRes.rows.length) {
        const err = new Error("Pending invitation not found or already closed.");
        err.status = 404;
        throw err;
      }
      const rawToken = generateRandomToken(32);
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1e3);
      await client.query(
        `UPDATE invitations SET token_hash = $3, expires_at = $4 WHERE id = $1 AND organization_id = $2`,
        [invitationId, orgId, tokenHash, expiresAt]
      );
      await notificationsRepository.queueEmailDelivery(
        {
          recipientEmail: invRes.rows[0].email,
          templateCode: "team_invitation",
          organizationId: orgId,
          vars: {
            tenantName: invRes.rows[0].org_name,
            inviterName: actor.fullName,
            roleName: invRes.rows[0].role_name,
            expiresAt: expiresAt.toISOString().slice(0, 10)
          }
        },
        client
      );
      return {
        id: invitationId,
        email: invRes.rows[0].email,
        expiresAt: expiresAt.toISOString(),
        inviteToken: rawToken
      };
    });
  }
  // =========================================================================
  // 2. ORGANIZATION BRANDING
  // =========================================================================
  async getBranding(orgId) {
    const res = await query(
      `SELECT id,
              name,
              slug,
              COALESCE(brand_subtext, 'Procurement & Asset Disposal Board') AS "brandSubtext",
              COALESCE(brand_primary_color, '#1F5F99') AS "brandPrimaryColor",
              COALESCE(custom_domain, '') AS "customDomain",
              COALESCE(contact_email::text, '') AS "contactEmail",
              COALESCE(contact_phone, '') AS "contactPhone",
              COALESCE(physical_address, '') AS "physicalAddress",
              COALESCE(city, '') AS city,
              COALESCE(settings->>'welcomeNotice', '') AS "welcomeNotice"
       FROM organizations
       WHERE id = $1 AND deleted_at IS NULL
       LIMIT 1`,
      [orgId]
    );
    return res.rows[0] || null;
  }
  async updateBranding(orgId, actor, input) {
    const cleanName = String(input.name || "").trim().slice(0, 255);
    if (!cleanName) {
      const err = new Error("Official entity name is required.");
      err.status = 400;
      throw err;
    }
    const color = String(input.brandPrimaryColor || "#1F5F99").trim();
    if (!HEX_COLOR_REGEX.test(color)) {
      const err = new Error("Primary theme accent must be a valid 6-digit hex color (e.g. #1F5F99).");
      err.status = 400;
      throw err;
    }
    const subtext = String(input.brandSubtext || "").trim().slice(0, 255);
    const customDomain = String(input.customDomain || "").trim().toLowerCase().slice(0, 255) || null;
    if (customDomain && !/^[a-z0-9.-]+\.[a-z]{2,}$/i.test(customDomain)) {
      const err = new Error("Custom domain must be a valid hostname (e.g. tenders.council.gov.bw).");
      err.status = 400;
      throw err;
    }
    const welcomeNotice = String(input.welcomeNotice || "").trim().slice(0, 500);
    const contactEmail = input.contactEmail ? String(input.contactEmail).trim().toLowerCase().slice(0, 200) : null;
    const contactPhone = input.contactPhone ? String(input.contactPhone).trim().slice(0, 32) : null;
    await query(
      `UPDATE organizations
       SET name = $2,
           brand_subtext = $3,
           brand_primary_color = $4,
           custom_domain = $5,
           contact_email = COALESCE($6, contact_email),
           contact_phone = COALESCE($7, contact_phone),
           settings = COALESCE(settings, '{}'::jsonb) || jsonb_build_object('welcomeNotice', $8::text),
           updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL`,
      [orgId, cleanName, subtext, color, customDomain, contactEmail, contactPhone, welcomeNotice]
    );
    await auditRepository.logEvent({
      actorName: actor.fullName,
      actorRole: actor.roleName,
      actorUserId: actor.userId,
      organizationId: orgId,
      organizationName: cleanName,
      action: "Organization Branding Updated",
      entityType: "Organization",
      entityId: orgId,
      ipAddress: actor.ipAddress,
      details: `Updated branding profile: name="${cleanName}", accent=${color}, subtext="${subtext}".`
    });
    return this.getBranding(orgId);
  }
  // =========================================================================
  // 3. ORGANIZATION SETTINGS (organization_settings)
  // =========================================================================
  async getSettings(orgId) {
    const res = await query(
      `SELECT setting_key, setting_value
       FROM organization_settings
       WHERE organization_id = $1`,
      [orgId]
    );
    const map = new Map(res.rows.map((r) => [r.setting_key, r.setting_value]));
    return {
      minRfpAdvertisingDays: Number(map.get("min_rfp_advertising_days") ?? 21),
      defaultCurrency: String(map.get("default_currency") ?? "BWP"),
      defaultClosingTimeCat: String(map.get("default_closing_time_cat") ?? "14:00"),
      clarificationCutoffDays: Number(map.get("clarification_cutoff_days") ?? 7),
      requireGazetteNotice: Boolean(map.get("require_gazette_notice") ?? true),
      autoDeadlineReminders: Boolean(map.get("auto_deadline_reminders") ?? true),
      requireMfaEvaluators: Boolean(map.get("require_mfa_evaluators") ?? true)
    };
  }
  async updateSettings(orgId, actor, input) {
    const minDays = Number(input.minRfpAdvertisingDays ?? 21);
    if (!Number.isFinite(minDays) || minDays < 7 || minDays > 90) {
      const err = new Error("Minimum advertising period must be between 7 and 90 days.");
      err.status = 400;
      throw err;
    }
    const cutoffDays = Number(input.clarificationCutoffDays ?? 7);
    if (!Number.isFinite(cutoffDays) || cutoffDays < 1 || cutoffDays > 30) {
      const err = new Error("Clarification cut-off must be between 1 and 30 days before closing.");
      err.status = 400;
      throw err;
    }
    const closingTime = String(input.defaultClosingTimeCat || "14:00").trim();
    if (!/^\d{2}:\d{2}$/.test(closingTime)) {
      const err = new Error("Default closing time must use HH:MM format.");
      err.status = 400;
      throw err;
    }
    const currency = String(input.defaultCurrency || "BWP").trim().toUpperCase().slice(0, 6);
    const entries = [
      { key: "min_rfp_advertising_days", value: minDays, type: "number", desc: "Minimum advertising period for competitive RFPs (days)" },
      { key: "default_currency", value: currency, type: "string", desc: "Default procurement currency" },
      { key: "default_closing_time_cat", value: closingTime, type: "string", desc: "Default tender closing time (CAT)" },
      { key: "clarification_cutoff_days", value: cutoffDays, type: "number", desc: "Days before closing when clarification questions close" },
      { key: "require_gazette_notice", value: Boolean(input.requireGazetteNotice ?? true), type: "boolean", desc: "Require statutory gazette notice reference on RFPs" },
      { key: "auto_deadline_reminders", value: Boolean(input.autoDeadlineReminders ?? true), type: "boolean", desc: "Send automated tender closing reminders to bidders" },
      { key: "require_mfa_evaluators", value: Boolean(input.requireMfaEvaluators ?? true), type: "boolean", desc: "Require MFA for evaluation panel scoring sessions" }
    ];
    await tx(async (client) => {
      for (const item of entries) {
        await client.query(
          `INSERT INTO organization_settings (
             organization_id, setting_key, setting_value, setting_type, description, updated_by_user_id, updated_at
           ) VALUES ($1, $2, $3::jsonb, $4, $5, $6, NOW())
           ON CONFLICT (organization_id, setting_key) DO UPDATE
           SET setting_value = EXCLUDED.setting_value,
               setting_type = EXCLUDED.setting_type,
               description = EXCLUDED.description,
               updated_by_user_id = EXCLUDED.updated_by_user_id,
               updated_at = NOW()`,
          [orgId, item.key, JSON.stringify(item.value), item.type, item.desc, actor.userId]
        );
      }
      await auditRepository.logEvent(
        {
          actorName: actor.fullName,
          actorRole: actor.roleName,
          actorUserId: actor.userId,
          organizationId: orgId,
          action: "Organization Settings Updated",
          entityType: "Organization",
          entityId: orgId,
          ipAddress: actor.ipAddress,
          details: `Updated council procurement settings: minDays=${minDays}, cutoff=${cutoffDays}d, closingTime=${closingTime} CAT, currency=${currency}.`
        },
        client
      );
    });
    return this.getSettings(orgId);
  }
  // =========================================================================
  // 4. FORM TEMPLATES & FIELDS
  // =========================================================================
  async listFormTemplates(orgId) {
    const res = await query(
      `SELECT ft.id,
              ft.organization_id AS "organizationId",
              ft.name AS title,
              ft.purpose,
              COALESCE(ft.description, '') AS description,
              ft.status,
              ft.updated_at AS "updatedAt",
              v.id AS "versionId",
              v.version_no AS "versionNo",
              COALESCE(v.label, 'v' || v.version_no::text || '.0') AS version,
              v.schema_json AS "schemaJson"
       FROM form_templates ft
       LEFT JOIN LATERAL (
         SELECT id, version_no, label, schema_json
         FROM form_template_versions
         WHERE template_id = ft.id
         ORDER BY version_no DESC
         LIMIT 1
       ) v ON TRUE
       WHERE ft.organization_id = $1 AND ft.status != 'archived'
       ORDER BY ft.updated_at DESC`,
      [orgId]
    );
    const versionIds = res.rows.map((r) => r.versionId).filter(Boolean);
    const fieldsByVersion = /* @__PURE__ */ new Map();
    if (versionIds.length > 0) {
      const fieldsRes = await query(
        `SELECT id,
                form_version_id AS "formVersionId",
                field_key AS "fieldKey",
                label,
                field_type AS type,
                is_required AS required,
                placeholder,
                help_text AS "helpText",
                options,
                sort_order AS "sortOrder"
         FROM form_fields
         WHERE form_version_id = ANY($1::uuid[])
         ORDER BY sort_order ASC, created_at ASC`,
        [versionIds]
      );
      for (const f of fieldsRes.rows) {
        const list = fieldsByVersion.get(f.formVersionId) || [];
        list.push({
          id: f.id,
          label: f.label,
          type: f.type,
          required: Boolean(f.required),
          placeholder: f.placeholder || "",
          helpText: f.helpText || "",
          options: Array.isArray(f.options) ? f.options : void 0
        });
        fieldsByVersion.set(f.formVersionId, list);
      }
    }
    return res.rows.map((r) => {
      const dbFields = r.versionId ? fieldsByVersion.get(r.versionId) : void 0;
      const schemaFields = Array.isArray(r.schemaJson?.fields) ? r.schemaJson.fields : [];
      return {
        id: r.id,
        organizationId: r.organizationId,
        title: r.title,
        purpose: r.purpose,
        description: r.description,
        version: r.version,
        versionNo: r.versionNo || 1,
        updatedAt: r.updatedAt,
        fields: dbFields && dbFields.length > 0 ? dbFields : schemaFields
      };
    });
  }
  async createFormTemplate(orgId, actor, input) {
    const title = String(input.title || "").trim().slice(0, 200);
    if (!title) {
      const err = new Error("Form template title is required.");
      err.status = 400;
      throw err;
    }
    const purpose = ["registration", "eoi", "rfp_questionnaire", "other"].includes(String(input.purpose)) ? String(input.purpose) : "rfp_questionnaire";
    const description = String(input.description || "").trim().slice(0, 500);
    const versionLabel = String(input.version || "v1.0").trim().slice(0, 100);
    const fields = Array.isArray(input.fields) ? input.fields : [];
    return tx(async (client) => {
      const tplRes = await client.query(
        `INSERT INTO form_templates (organization_id, name, purpose, description, status, created_by_user_id)
         VALUES ($1, $2, $3, $4, 'active', $5)
         RETURNING id`,
        [orgId, title, purpose, description || null, actor.userId]
      );
      const templateId = tplRes.rows[0].id;
      const verRes = await client.query(
        `INSERT INTO form_template_versions (
           template_id, version_no, label, schema_json, status, published_by_user_id, published_at
         ) VALUES ($1, 1, $2, $3::jsonb, 'published', $4, NOW())
         RETURNING id`,
        [templateId, versionLabel, JSON.stringify({ fields }), actor.userId]
      );
      const versionId = verRes.rows[0].id;
      for (let i = 0; i < fields.length; i++) {
        const f = fields[i];
        const safeType = ALLOWED_FIELD_TYPES.has(String(f.type)) ? String(f.type) : "text";
        const fieldKey = `field_${i + 1}_${String(f.label || "q").toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 40)}`;
        await client.query(
          `INSERT INTO form_fields (
             form_version_id, field_key, label, field_type, is_required, placeholder, help_text, options, sort_order
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)`,
          [
            versionId,
            fieldKey,
            String(f.label || `Question ${i + 1}`).trim().slice(0, 255),
            safeType,
            Boolean(f.required),
            f.placeholder ? String(f.placeholder).slice(0, 255) : null,
            f.helpText ? String(f.helpText).slice(0, 1e3) : null,
            Array.isArray(f.options) ? JSON.stringify(f.options) : null,
            i
          ]
        );
      }
      await auditRepository.logEvent(
        {
          actorName: actor.fullName,
          actorRole: actor.roleName,
          actorUserId: actor.userId,
          organizationId: orgId,
          action: "Form Template Created",
          entityType: "FormTemplate",
          entityId: templateId,
          ipAddress: actor.ipAddress,
          details: `Created tender form template "${title}" (${versionLabel}) with ${fields.length} fields.`
        },
        client
      );
      return templateId;
    });
  }
  async updateFormTemplate(orgId, templateId, actor, input) {
    if (!UUID_REGEX7.test(templateId)) {
      const err = new Error("Invalid form template ID.");
      err.status = 400;
      throw err;
    }
    const fields = Array.isArray(input.fields) ? input.fields : [];
    await tx(async (client) => {
      const existing = await client.query(
        `SELECT id, name FROM form_templates WHERE id = $1 AND organization_id = $2 FOR UPDATE`,
        [templateId, orgId]
      );
      if (!existing.rows.length) {
        const err = new Error("Form template not found for your organization.");
        err.status = 404;
        throw err;
      }
      const nextTitle = input.title ? String(input.title).trim().slice(0, 200) : existing.rows[0].name;
      const nextDesc = input.description !== void 0 ? String(input.description).trim().slice(0, 500) : void 0;
      await client.query(
        `UPDATE form_templates
         SET name = $3,
             description = COALESCE($4, description),
             updated_at = NOW()
         WHERE id = $1 AND organization_id = $2`,
        [templateId, orgId, nextTitle, nextDesc !== void 0 ? nextDesc : null]
      );
      const maxVerRes = await client.query(
        `SELECT COALESCE(MAX(version_no), 0)::int AS max_ver FROM form_template_versions WHERE template_id = $1`,
        [templateId]
      );
      const nextVersionNo = (maxVerRes.rows[0]?.max_ver || 0) + 1;
      const versionLabel = String(input.version || `v${nextVersionNo}.0`).trim().slice(0, 100);
      const verRes = await client.query(
        `INSERT INTO form_template_versions (
           template_id, version_no, label, schema_json, status, published_by_user_id, published_at
         ) VALUES ($1, $2, $3, $4::jsonb, 'published', $5, NOW())
         RETURNING id`,
        [templateId, nextVersionNo, versionLabel, JSON.stringify({ fields }), actor.userId]
      );
      const versionId = verRes.rows[0].id;
      for (let i = 0; i < fields.length; i++) {
        const f = fields[i];
        const safeType = ALLOWED_FIELD_TYPES.has(String(f.type)) ? String(f.type) : "text";
        const fieldKey = `field_${i + 1}_${String(f.label || "q").toLowerCase().replace(/[^a-z0-9]+/g, "_").slice(0, 40)}`;
        await client.query(
          `INSERT INTO form_fields (
             form_version_id, field_key, label, field_type, is_required, placeholder, help_text, options, sort_order
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)`,
          [
            versionId,
            fieldKey,
            String(f.label || `Question ${i + 1}`).trim().slice(0, 255),
            safeType,
            Boolean(f.required),
            f.placeholder ? String(f.placeholder).slice(0, 255) : null,
            f.helpText ? String(f.helpText).slice(0, 1e3) : null,
            Array.isArray(f.options) ? JSON.stringify(f.options) : null,
            i
          ]
        );
      }
      await auditRepository.logEvent(
        {
          actorName: actor.fullName,
          actorRole: actor.roleName,
          actorUserId: actor.userId,
          organizationId: orgId,
          action: "Form Template Version Published",
          entityType: "FormTemplate",
          entityId: templateId,
          ipAddress: actor.ipAddress,
          details: `Published revision #${nextVersionNo} (${versionLabel}) for form template "${nextTitle}" (${fields.length} fields).`
        },
        client
      );
    });
  }
  async deleteFormTemplate(orgId, templateId, actor) {
    if (!UUID_REGEX7.test(templateId)) {
      const err = new Error("Invalid form template ID.");
      err.status = 400;
      throw err;
    }
    const res = await query(
      `UPDATE form_templates SET status = 'archived', updated_at = NOW()
       WHERE id = $1 AND organization_id = $2
       RETURNING id, name`,
      [templateId, orgId]
    );
    if (!res.rows.length) {
      const err = new Error("Form template not found.");
      err.status = 404;
      throw err;
    }
    await auditRepository.logEvent({
      actorName: actor.fullName,
      actorRole: actor.roleName,
      actorUserId: actor.userId,
      organizationId: orgId,
      action: "Form Template Archived",
      entityType: "FormTemplate",
      entityId: templateId,
      ipAddress: actor.ipAddress,
      details: `Archived form template "${res.rows[0].name}".`
    });
  }
  // =========================================================================
  // 5. WORKFLOWS & SCORING TEMPLATES
  // =========================================================================
  async getWorkflowsAndScoring(orgId) {
    const [stagesRes, settingsRes, roles] = await Promise.all([
      query(
        `SELECT ws.id,
                ws.applies_to AS "appliesTo",
                ws.name,
                ws.sequence_no AS "sequenceNo",
                ws.stage_type AS "stageType",
                ws.required_role_id AS "requiredRoleId",
                r.name AS "requiredRoleName",
                ws.sla_days AS "slaDays",
                ws.created_at AS "createdAt"
         FROM workflow_stages ws
         LEFT JOIN roles r ON r.id = ws.required_role_id
         WHERE ws.organization_id = $1
         ORDER BY ws.applies_to ASC, ws.sequence_no ASC`,
        [orgId]
      ),
      query(
        `SELECT setting_value FROM organization_settings
         WHERE organization_id = $1 AND setting_key = 'scoring_templates'
         LIMIT 1`,
        [orgId]
      ),
      this.listOrgRoles(orgId)
    ]);
    const storedTemplates = settingsRes.rows[0]?.setting_value;
    const scoringTemplates = Array.isArray(storedTemplates) && storedTemplates.length > 0 ? storedTemplates : DEFAULT_SCORING_TEMPLATES;
    return {
      stages: stagesRes.rows,
      scoringTemplates,
      roles
    };
  }
  async createWorkflowStage(orgId, actor, input) {
    const appliesTo = ["registration", "eoi", "rfp"].includes(input.appliesTo) ? input.appliesTo : "rfp";
    const stageType = ["review", "approval"].includes(input.stageType) ? input.stageType : "review";
    const name = String(input.name || "").trim().slice(0, 100);
    if (!name) {
      const err = new Error("Workflow stage name is required.");
      err.status = 400;
      throw err;
    }
    const seq = Math.max(1, Math.min(20, Number(input.sequenceNo) || 1));
    const safeRoleId = input.requiredRoleId && UUID_REGEX7.test(input.requiredRoleId) ? input.requiredRoleId : null;
    const slaDays = input.slaDays !== void 0 && input.slaDays !== null && !isNaN(Number(input.slaDays)) ? Math.max(1, Math.min(90, Number(input.slaDays))) : null;
    const ins = await query(
      `INSERT INTO workflow_stages (organization_id, applies_to, name, sequence_no, stage_type, required_role_id, sla_days)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [orgId, appliesTo, name, seq, stageType, safeRoleId, slaDays]
    );
    await auditRepository.logEvent({
      actorName: actor.fullName,
      actorRole: actor.roleName,
      actorUserId: actor.userId,
      organizationId: orgId,
      action: "Workflow Stage Configured",
      entityType: "Organization",
      entityId: ins.rows[0].id,
      ipAddress: actor.ipAddress,
      details: `Added ${appliesTo.toUpperCase()} workflow stage #${seq}: "${name}" (${stageType}).`
    });
    return ins.rows[0].id;
  }
  async deleteWorkflowStage(orgId, stageId, actor) {
    if (!UUID_REGEX7.test(stageId)) {
      const err = new Error("Invalid stage ID.");
      err.status = 400;
      throw err;
    }
    const res = await query(
      `DELETE FROM workflow_stages WHERE id = $1 AND organization_id = $2 RETURNING id, name`,
      [stageId, orgId]
    );
    if (!res.rows.length) {
      const err = new Error("Workflow stage not found.");
      err.status = 404;
      throw err;
    }
    await auditRepository.logEvent({
      actorName: actor.fullName,
      actorRole: actor.roleName,
      actorUserId: actor.userId,
      organizationId: orgId,
      action: "Workflow Stage Removed",
      entityType: "Organization",
      entityId: stageId,
      ipAddress: actor.ipAddress,
      details: `Removed workflow stage "${res.rows[0].name}".`
    });
  }
  async saveScoringTemplates(orgId, actor, templates) {
    if (!Array.isArray(templates) || templates.length === 0) {
      const err = new Error("At least one scoring template is required.");
      err.status = 400;
      throw err;
    }
    const sanitized = templates.map((t, idx) => {
      const name = String(t.name || `Template ${idx + 1}`).trim().slice(0, 150);
      const criteria = Array.isArray(t.criteria) ? t.criteria.map((c, cIdx) => ({
        id: String(c.id || `crit-${idx}-${cIdx}`),
        label: String(c.label || `Criterion ${cIdx + 1}`).trim().slice(0, 150),
        weightPercent: c.passFail ? null : Math.max(0, Math.min(100, Number(c.weightPercent) || 0)),
        passFail: Boolean(c.passFail)
      })) : [];
      return {
        id: String(t.id || `tpl-${Date.now()}-${idx}`),
        name,
        badge: String(t.badge || "Custom Template").trim().slice(0, 80),
        method: ["qcbs", "least_cost", "custom"].includes(t.method) ? t.method : "custom",
        isActive: t.isActive !== false,
        criteria
      };
    });
    await query(
      `INSERT INTO organization_settings (
         organization_id, setting_key, setting_value, setting_type, description, updated_by_user_id, updated_at
       ) VALUES ($1, 'scoring_templates', $2::jsonb, 'array', 'Evaluation scoring matrices and criteria templates', $3, NOW())
       ON CONFLICT (organization_id, setting_key) DO UPDATE
       SET setting_value = EXCLUDED.setting_value,
           updated_by_user_id = EXCLUDED.updated_by_user_id,
           updated_at = NOW()`,
      [orgId, JSON.stringify(sanitized), actor.userId]
    );
    await auditRepository.logEvent({
      actorName: actor.fullName,
      actorRole: actor.roleName,
      actorUserId: actor.userId,
      organizationId: orgId,
      action: "Scoring Templates Saved",
      entityType: "Organization",
      entityId: orgId,
      ipAddress: actor.ipAddress,
      details: `Updated ${sanitized.length} evaluation scoring template(s) for organization workspace.`
    });
    return sanitized;
  }
  // =========================================================================
  // 6. INTEGRATIONS (api_clients & webhook_endpoints)
  // =========================================================================
  async getIntegrations(orgId) {
    const [clientsRes, webhooksRes] = await Promise.all([
      query(
        `SELECT ac.id,
                ac.name,
                ac.key_prefix AS "keyPrefix",
                ac.scopes,
                ac.last_used_at AS "lastUsedAt",
                ac.revoked_at AS "revokedAt",
                ac.created_at AS "createdAt",
                COALESCE(u.full_name, 'Admin') AS "createdByName"
         FROM api_clients ac
         LEFT JOIN users u ON u.id = ac.created_by_user_id
         WHERE ac.organization_id = $1
         ORDER BY ac.created_at DESC`,
        [orgId]
      ),
      query(
        `SELECT id,
                url,
                event_types AS "eventTypes",
                is_active AS "isActive",
                created_at AS "createdAt"
         FROM webhook_endpoints
         WHERE organization_id = $1
         ORDER BY created_at DESC`,
        [orgId]
      )
    ]);
    return {
      apiClients: clientsRes.rows,
      webhooks: webhooksRes.rows
    };
  }
  async createApiClient(orgId, actor, input) {
    const name = String(input.name || "").trim().slice(0, 150);
    if (!name) {
      const err = new Error("API client name is required.");
      err.status = 400;
      throw err;
    }
    const rawSecret = `br360_${crypto7.randomBytes(24).toString("hex")}`;
    const keyPrefix = rawSecret.slice(0, 12);
    const keyHash = crypto7.createHash("sha256").update(rawSecret).digest("hex");
    const scopes = Array.isArray(input.scopes) && input.scopes.length > 0 ? input.scopes.map((s) => String(s).trim()).filter(Boolean) : ["calls.read", "awards.read", "applications.read"];
    const res = await query(
      `INSERT INTO api_clients (organization_id, name, key_prefix, key_hash, scopes, created_by_user_id)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6)
       RETURNING id, name, key_prefix AS "keyPrefix", scopes, created_at AS "createdAt"`,
      [orgId, name, keyPrefix, keyHash, JSON.stringify(scopes), actor.userId]
    );
    await auditRepository.logEvent({
      actorName: actor.fullName,
      actorRole: actor.roleName,
      actorUserId: actor.userId,
      organizationId: orgId,
      action: "API Client Key Created",
      entityType: "ApiClient",
      entityId: res.rows[0].id,
      ipAddress: actor.ipAddress,
      details: `Issued new API integration key "${name}" (${keyPrefix}...) with scopes: ${scopes.join(", ")}.`
    });
    return {
      ...res.rows[0],
      plainKeyOnce: rawSecret
    };
  }
  async revokeApiClient(orgId, clientId, actor) {
    if (!UUID_REGEX7.test(clientId)) {
      const err = new Error("Invalid API client ID.");
      err.status = 400;
      throw err;
    }
    const res = await query(
      `UPDATE api_clients SET revoked_at = NOW()
       WHERE id = $1 AND organization_id = $2 AND revoked_at IS NULL
       RETURNING id, name`,
      [clientId, orgId]
    );
    if (!res.rows.length) {
      const err = new Error("Active API key not found.");
      err.status = 404;
      throw err;
    }
    await auditRepository.logEvent({
      actorName: actor.fullName,
      actorRole: actor.roleName,
      actorUserId: actor.userId,
      organizationId: orgId,
      action: "API Client Key Revoked",
      entityType: "ApiClient",
      entityId: clientId,
      ipAddress: actor.ipAddress,
      details: `Revoked API integration key "${res.rows[0].name}".`
    });
  }
  async saveWebhookEndpoint(orgId, actor, input) {
    const safeUrl = validateSafeWebhookUrl(input.url);
    const eventTypes = Array.isArray(input.eventTypes) && input.eventTypes.length > 0 ? input.eventTypes.map((e) => String(e).trim()).filter(Boolean) : ["award.approved", "application.submitted", "bid.opened"];
    if (input.id && UUID_REGEX7.test(input.id)) {
      const upd = await query(
        `UPDATE webhook_endpoints
         SET url = $3, event_types = $4::jsonb, is_active = $5
         WHERE id = $1 AND organization_id = $2
         RETURNING id, url, event_types AS "eventTypes", is_active AS "isActive", created_at AS "createdAt"`,
        [input.id, orgId, safeUrl, JSON.stringify(eventTypes), input.isActive !== false]
      );
      if (!upd.rows.length) {
        const err = new Error("Webhook endpoint not found.");
        err.status = 404;
        throw err;
      }
      await auditRepository.logEvent({
        actorName: actor.fullName,
        actorRole: actor.roleName,
        actorUserId: actor.userId,
        organizationId: orgId,
        action: "Webhook Endpoint Updated",
        entityType: "WebhookEndpoint",
        entityId: input.id,
        ipAddress: actor.ipAddress,
        details: `Updated outbound webhook endpoint to ${safeUrl} (${eventTypes.join(", ")}).`
      });
      return upd.rows[0];
    }
    const signingSecret = `whsec_${crypto7.randomBytes(24).toString("hex")}`;
    const secretHash = crypto7.createHash("sha256").update(signingSecret).digest("hex");
    const ins = await query(
      `INSERT INTO webhook_endpoints (organization_id, url, secret_hash, event_types, is_active)
       VALUES ($1, $2, $3, $4::jsonb, TRUE)
       RETURNING id, url, event_types AS "eventTypes", is_active AS "isActive", created_at AS "createdAt"`,
      [orgId, safeUrl, secretHash, JSON.stringify(eventTypes)]
    );
    await auditRepository.logEvent({
      actorName: actor.fullName,
      actorRole: actor.roleName,
      actorUserId: actor.userId,
      organizationId: orgId,
      action: "Webhook Endpoint Created",
      entityType: "WebhookEndpoint",
      entityId: ins.rows[0].id,
      ipAddress: actor.ipAddress,
      details: `Registered outbound HTTPS webhook ${safeUrl} for events: ${eventTypes.join(", ")}.`
    });
    return {
      ...ins.rows[0],
      signingSecretOnce: signingSecret
    };
  }
  async deleteWebhookEndpoint(orgId, endpointId, actor) {
    if (!UUID_REGEX7.test(endpointId)) {
      const err = new Error("Invalid webhook endpoint ID.");
      err.status = 400;
      throw err;
    }
    const res = await query(
      `DELETE FROM webhook_endpoints WHERE id = $1 AND organization_id = $2 RETURNING id, url`,
      [endpointId, orgId]
    );
    if (!res.rows.length) {
      const err = new Error("Webhook endpoint not found.");
      err.status = 404;
      throw err;
    }
    await auditRepository.logEvent({
      actorName: actor.fullName,
      actorRole: actor.roleName,
      actorUserId: actor.userId,
      organizationId: orgId,
      action: "Webhook Endpoint Removed",
      entityType: "WebhookEndpoint",
      entityId: endpointId,
      ipAddress: actor.ipAddress,
      details: `Removed outbound webhook endpoint ${res.rows[0].url}.`
    });
  }
  // =========================================================================
  // 7. ORGANIZATION BILLING, SUBSCRIPTION & USAGE
  // =========================================================================
  async getOrgBilling(orgId) {
    const [subRes, fallbackPlansRes, callsCountRes, seatsCountRes, invoicesRes] = await Promise.all([
      query(
        `SELECT s.id,
                s.status,
                s.current_period_start AS "currentPeriodStart",
                s.current_period_end AS "currentPeriodEnd",
                s.trial_ends_at AS "trialEndsAt",
                p.id AS "planId",
                p.code AS "planCode",
                p.name AS "planName",
                p.price,
                p.currency,
                p.billing_interval AS "billingInterval",
                p.max_users AS "maxUsers",
                p.max_calls_per_year AS "maxCallsPerYear",
                p.features
         FROM subscriptions s
         JOIN plans p ON p.id = s.plan_id
         WHERE s.organization_id = $1
         ORDER BY (s.status = 'active') DESC, s.created_at DESC
         LIMIT 1`,
        [orgId]
      ),
      query(
        `SELECT id, code, name, price, currency, billing_interval AS "billingInterval",
                max_users AS "maxUsers", max_calls_per_year AS "maxCallsPerYear", features
         FROM plans
         WHERE audience = 'buyer' AND is_active = TRUE
         ORDER BY sort_order ASC, price ASC`
      ),
      query(
        `SELECT COUNT(*)::text AS count
         FROM calls
         WHERE organization_id = $1
           AND created_at >= date_trunc('year', NOW())`,
        [orgId]
      ),
      query(
        `SELECT COUNT(*)::text AS count
         FROM organization_members
         WHERE organization_id = $1 AND status IN ('active', 'invited')`,
        [orgId]
      ),
      query(
        `SELECT id,
                invoice_no AS "invoiceNumber",
                total::numeric AS amount,
                currency,
                status,
                issued_at AS "issuedAt",
                due_at AS "dueAt",
                paid_at AS "paidAt"
         FROM platform_invoices
         WHERE organization_id = $1
         ORDER BY created_at DESC
         LIMIT 25`,
        [orgId]
      )
    ]);
    const sub = subRes.rows[0] || null;
    const defaultPlan = fallbackPlansRes.rows[0] || null;
    return {
      subscription: sub ? {
        id: sub.id,
        status: sub.status,
        currentPeriodStart: sub.currentPeriodStart,
        currentPeriodEnd: sub.currentPeriodEnd,
        planName: sub.planName,
        planCode: sub.planCode,
        price: Number(sub.price) || 0,
        currency: sub.currency || "BWP",
        billingInterval: sub.billingInterval || "monthly",
        maxUsers: sub.maxUsers !== null ? Number(sub.maxUsers) : null,
        maxCallsPerYear: sub.maxCallsPerYear !== null ? Number(sub.maxCallsPerYear) : null,
        features: sub.features || {}
      } : defaultPlan ? {
        id: null,
        status: "trial",
        currentPeriodStart: null,
        currentPeriodEnd: null,
        planName: defaultPlan.name,
        planCode: defaultPlan.code,
        price: Number(defaultPlan.price) || 0,
        currency: defaultPlan.currency || "BWP",
        billingInterval: defaultPlan.billingInterval || "monthly",
        maxUsers: defaultPlan.maxUsers !== null ? Number(defaultPlan.maxUsers) : null,
        maxCallsPerYear: defaultPlan.maxCallsPerYear !== null ? Number(defaultPlan.maxCallsPerYear) : null,
        features: defaultPlan.features || {}
      } : null,
      usage: {
        callsPublishedThisYear: Number(callsCountRes.rows[0]?.count || 0),
        activeSeatsUsed: Number(seatsCountRes.rows[0]?.count || 0)
      },
      availablePlans: fallbackPlansRes.rows.map((p) => ({
        ...p,
        price: Number(p.price) || 0
      })),
      invoices: invoicesRes.rows.map((inv) => ({
        ...inv,
        amount: Number(inv.amount) || 0
      }))
    };
  }
};
var workspaceRepository = new WorkspaceRepository();

// server/routes/buyer.routes.ts
var router5 = Router5();
router5.use(requireAuth);
router5.use(requireTenantType("organization"));
async function requireActiveOrganization(req, res, next) {
  if (req.user?.isPlatformAdmin) {
    return next();
  }
  try {
    const ctx = getOrganizationContext(req);
    const orgRes = await query(
      `SELECT status, verification_status, rejection_reason
       FROM organizations
       WHERE id = $1 AND deleted_at IS NULL
       LIMIT 1`,
      [ctx.tenantId]
    );
    const org = orgRes.rows[0];
    if (!org) {
      res.status(403).json({
        error: "ORGANIZATION_NOT_FOUND",
        code: "ORGANIZATION_NOT_FOUND",
        message: "Your procuring organization record could not be found or is no longer active."
      });
      return;
    }
    const status = String(org.status || "").toLowerCase();
    const verStatus = String(org.verification_status || "").toLowerCase();
    if (status === "pending" || verStatus === "pending_review" || verStatus === "pending") {
      res.status(403).json({
        error: "ORGANIZATION_PENDING_APPROVAL",
        code: "ORGANIZATION_PENDING_APPROVAL",
        message: "Your organization is awaiting administrator approval before you can publish or manage calls."
      });
      return;
    }
    if (status !== "active" || verStatus === "rejected") {
      const code = verStatus === "rejected" ? "ORGANIZATION_REJECTED" : "ORGANIZATION_SUSPENDED";
      res.status(403).json({
        error: code,
        code,
        message: org.rejection_reason ? `Your procuring organization is currently ${status} (${org.rejection_reason}). Contact BidReady360 administration.` : `Your procuring organization is currently ${status} and cannot access procurement operations.`
      });
      return;
    }
    next();
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
}
router5.use(requireActiveOrganization);
router5.get("/calls", requirePermission("calls.create"), async (req, res) => {
  try {
    const ctx = getOrganizationContext(req);
    const calls = await callsRepository.listByOrganization(ctx.tenantId);
    res.json(calls);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router5.post("/calls/create", requirePermission("calls.create"), async (req, res) => {
  try {
    const ctx = getOrganizationContext(req);
    const callId = await callsRepository.createCall({
      ...req.body,
      organizationId: ctx.tenantId,
      userId: ctx.userId
    });
    res.status(201).json({ callId, message: "Tender call saved successfully." });
  } catch (err) {
    if (err?.status === 403) {
      res.status(403).json({
        error: err.code || "FORBIDDEN",
        code: err.code || "FORBIDDEN",
        message: err.message
      });
      return;
    }
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router5.patch("/calls/:id", requirePermission("calls.manage"), async (req, res) => {
  try {
    const ctx = getOrganizationContext(req);
    await callsRepository.updateCall(req.params.id, ctx.tenantId, ctx.userId, req.body);
    res.json({ success: true, message: "Tender call updated." });
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router5.post("/calls/:id/addenda", requirePermission("calls.manage"), async (req, res) => {
  try {
    const ctx = getOrganizationContext(req);
    const addendum = await callsRepository.createAddendum(
      req.params.id,
      ctx.tenantId,
      ctx.userId,
      req.body,
      {
        actorName: req.user.fullName,
        actorRole: ctx.roleName,
        ipAddress: extractClientIp(req)
      }
    );
    res.status(201).json(addendum);
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router5.get("/calls/:id/invitations", requirePermission("calls.manage"), async (req, res) => {
  try {
    const ctx = getOrganizationContext(req);
    const list = await callsRepository.listInvitations(req.params.id, ctx.tenantId);
    res.json(list);
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router5.post("/calls/:id/invitations", requirePermission("calls.manage"), async (req, res) => {
  try {
    const ctx = getOrganizationContext(req);
    const { supplierIds } = req.body || {};
    const result = await callsRepository.inviteSuppliers({
      callId: req.params.id,
      orgId: ctx.tenantId,
      userId: ctx.userId,
      actorName: req.user.fullName,
      actorRole: ctx.roleName,
      supplierIds: Array.isArray(supplierIds) ? supplierIds : [],
      ipAddress: extractClientIp(req)
    });
    res.status(201).json(result);
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router5.get("/members", async (req, res) => {
  try {
    const ctx = getOrganizationContext(req);
    const hasColRes = await query(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'organization_members' AND column_name = 'approval_limit_bwp'
       ) AS exists`
    ).catch(() => ({ rows: [{ exists: false }] }));
    const limitExpr = hasColRes.rows[0]?.exists ? "COALESCE(om.approval_limit_bwp, r.approval_limit_bwp)" : "r.approval_limit_bwp";
    const memRes = await query(
      `SELECT om.user_id AS "userId",
              u.full_name AS "fullName",
              u.email::text AS email,
              r.name AS "roleName",
              ${limitExpr} AS "approvalLimitBwp",
              om.is_owner AS "isOwner"
       FROM organization_members om
       JOIN users u ON u.id = om.user_id AND u.deleted_at IS NULL
       JOIN roles r ON r.id = om.role_id
       WHERE om.organization_id = $1 AND om.status = 'active'
       ORDER BY om.is_owner DESC, u.full_name ASC`,
      [ctx.tenantId]
    );
    res.json(memRes.rows);
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router5.get("/suppliers", requirePermission("suppliers.view"), async (req, res) => {
  try {
    const ctx = getOrganizationContext(req);
    const supRes = await query(
      `SELECT s.id,
              s.legal_name AS "legalName",
              s.trading_name AS "tradingName",
              s.cipa_uin AS "cipaNumber",
              s.burs_tin AS "tinNumber",
              s.city,
              s.physical_address AS "physicalAddress",
              s.email,
              s.primary_phone AS "primaryPhone",
              s.bank_name AS "bankName",
              s.bank_branch AS "bankBranch",
              s.compliance_status AS "complianceStatus",
              s.verification_status AS "verificationStatus",
              s.profile_completeness AS "profileCompleteness",
              s.citizen_owned_percentage AS "citizenOwnedPercentage",
              s.youth_owned AS "youthOwned",
              s.women_owned AS "womenOwned",
              s.edd_certified AS "eddCertified",
              cg.status AS "rawGrantStatus",
              cg.expires_at AS "grantExpiresAt",
              cg.share_company_details AS "shareCompanyDetails",
              cg.share_directors_owners AS "shareDirectorsOwners",
              cg.share_tax_compliance AS "shareTaxCompliance",
              cg.share_financial_statements AS "shareFinancialStatements",
              cg.share_banking_details AS "shareBankingDetails",
              EXISTS (
                SELECT 1 FROM approved_suppliers ap
                WHERE ap.supplier_id = s.id AND ap.organization_id = $1 AND ap.status = 'active'
              ) AS "isApprovedRoster",
              EXISTS (
                SELECT 1 FROM applications a
                WHERE a.supplier_id = s.id AND a.organization_id = $1 AND a.status <> 'Draft'
              ) AS "hasSubmittedApplication",
              COALESCE(
                (SELECT array_agg(DISTINCT cat.name)
                 FROM supplier_categories sc
                 JOIN categories cat ON cat.id = sc.category_id
                 WHERE sc.supplier_id = s.id),
                '{}'::text[]
              ) AS categories
       FROM suppliers s
       LEFT JOIN LATERAL (
         SELECT * FROM consent_grants cg2
         WHERE cg2.supplier_id = s.id AND cg2.organization_id = $1
         ORDER BY cg2.granted_at DESC
         LIMIT 1
       ) cg ON TRUE
       WHERE s.deleted_at IS NULL
         AND (
           s.status = 'active'
           OR EXISTS (SELECT 1 FROM applications a WHERE a.supplier_id = s.id AND a.organization_id = $1 AND a.status <> 'Draft')
         )
       ORDER BY s.legal_name ASC`,
      [ctx.tenantId]
    );
    const now = Date.now();
    const formatted = supRes.rows.map((r) => {
      const isExpired = r.rawGrantStatus === "active" && r.grantExpiresAt && new Date(r.grantExpiresAt).getTime() <= now;
      const consentStatus = !r.rawGrantStatus ? "none" : isExpired ? "expired" : r.rawGrantStatus === "revoked" ? "revoked" : r.rawGrantStatus === "active" ? "active" : "none";
      const hasActiveConsent = consentStatus === "active";
      const allowCompany = hasActiveConsent && Boolean(r.shareCompanyDetails);
      const allowTax = hasActiveConsent && Boolean(r.shareTaxCompliance);
      const allowBanking = hasActiveConsent && Boolean(r.shareBankingDetails);
      return {
        id: r.id,
        legalName: r.legalName,
        tradingName: r.tradingName,
        cipaNumber: allowCompany ? r.cipaNumber : null,
        tinNumber: allowTax ? r.tinNumber : null,
        city: r.city,
        physicalAddress: allowCompany ? r.physicalAddress : null,
        email: allowCompany ? r.email : null,
        primaryPhone: allowCompany ? r.primaryPhone : null,
        bankName: allowBanking ? r.bankName : null,
        bankBranch: allowBanking ? r.bankBranch : null,
        complianceStatus: r.complianceStatus,
        verificationStatus: r.verificationStatus,
        profileCompleteness: Number(r.profileCompleteness || 0),
        citizenOwnedPercentage: r.citizenOwnedPercentage,
        youthOwned: Boolean(r.youthOwned),
        womenOwned: Boolean(r.womenOwned),
        eddCertified: Boolean(r.eddCertified),
        categories: Array.isArray(r.categories) ? r.categories : [],
        consentStatus,
        hasActiveConsent,
        isApprovedRoster: Boolean(r.isApprovedRoster),
        hasSubmittedApplication: Boolean(r.hasSubmittedApplication),
        accessScopes: hasActiveConsent ? {
          companyDetails: Boolean(r.shareCompanyDetails),
          directorsOwners: Boolean(r.shareDirectorsOwners),
          taxCompliance: Boolean(r.shareTaxCompliance),
          financialStatements: Boolean(r.shareFinancialStatements),
          bankingDetails: Boolean(r.shareBankingDetails)
        } : null
      };
    });
    res.json(formatted);
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router5.get("/suppliers/:id", requirePermission("suppliers.view"), async (req, res) => {
  try {
    const ctx = getOrganizationContext(req);
    const supplierId = req.params.id;
    const supRes = await query(
      `SELECT s.id, s.legal_name AS "legalName", s.trading_name AS "tradingName",
              s.cipa_uin AS "cipaNumber", s.burs_tin AS "tinNumber", s.ppra_registration_no AS "ppraCode",
              s.city, s.district, s.physical_address AS "physicalAddress", s.email, s.primary_phone AS "primaryPhone",
              s.website, s.bank_name AS "bankName", s.bank_branch AS "bankBranch",
              s.compliance_status AS "complianceStatus", s.verification_status AS "verificationStatus",
              s.profile_completeness AS "profileCompleteness", s.citizen_owned_percentage AS "citizenOwnedPercentage",
              s.youth_owned AS "youthOwned", s.women_owned AS "womenOwned", s.edd_certified AS "eddCertified",
              cg.id AS "consentGrantId", cg.status AS "rawGrantStatus", cg.expires_at AS "grantExpiresAt",
              cg.share_company_details AS "shareCompanyDetails", cg.share_directors_owners AS "shareDirectorsOwners",
              cg.share_past_projects AS "sharePastProjects", cg.share_tax_compliance AS "shareTaxCompliance",
              cg.share_financial_statements AS "shareFinancialStatements", cg.share_banking_details AS "shareBankingDetails"
       FROM suppliers s
       LEFT JOIN LATERAL (
         SELECT * FROM consent_grants cg2
         WHERE cg2.supplier_id = s.id AND cg2.organization_id = $1
         ORDER BY cg2.granted_at DESC
         LIMIT 1
       ) cg ON TRUE
       WHERE s.id = $2 AND s.deleted_at IS NULL
       LIMIT 1`,
      [ctx.tenantId, supplierId]
    );
    if (!supRes.rows.length) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Supplier not found." });
    }
    const r = supRes.rows[0];
    const isExpired = r.rawGrantStatus === "active" && r.grantExpiresAt && new Date(r.grantExpiresAt).getTime() <= Date.now();
    const consentStatus = !r.rawGrantStatus ? "none" : isExpired ? "expired" : r.rawGrantStatus === "revoked" ? "revoked" : r.rawGrantStatus === "active" ? "active" : "none";
    const hasActiveConsent = consentStatus === "active";
    const allowCompany = hasActiveConsent && Boolean(r.shareCompanyDetails);
    const allowDirectors = hasActiveConsent && Boolean(r.shareDirectorsOwners);
    const allowProjects = hasActiveConsent && Boolean(r.sharePastProjects);
    const allowTax = hasActiveConsent && Boolean(r.shareTaxCompliance);
    const allowBanking = hasActiveConsent && Boolean(r.shareBankingDetails);
    const [directorsRes, projectsRes, docsRes] = await Promise.all([
      allowDirectors ? query(
        `SELECT id, full_name AS "fullName", person_role AS role, nationality, is_citizen AS "isCitizen", ownership_percent AS "ownershipPercent"
             FROM supplier_people WHERE supplier_id = $1 ORDER BY ownership_percent DESC NULLS LAST`,
        [supplierId]
      ) : Promise.resolve({ rows: [] }),
      allowProjects ? query(
        `SELECT id, client_name AS "clientName", project_title AS title, contract_value_bwp AS "valueBWP", completion_year AS "completionYear"
             FROM supplier_projects WHERE supplier_id = $1 ORDER BY completion_year DESC NULLS LAST`,
        [supplierId]
      ) : Promise.resolve({ rows: [] }),
      hasActiveConsent ? query(
        `SELECT sd.id, sd.current_version_id AS "versionId", dt.name AS "documentType",
                    sdv.verification_status AS "verificationStatus", sdv.expiry_date AS "expiryDate"
             FROM supplier_documents sd
             JOIN document_types dt ON dt.id = sd.document_type_id
             LEFT JOIN supplier_document_versions sdv ON sdv.id = sd.current_version_id
             WHERE sd.supplier_id = $1 AND sd.status != 'deleted'
               AND (
                 NOT EXISTS (SELECT 1 FROM consent_grant_documents cgd WHERE cgd.consent_grant_id = $2)
                 OR EXISTS (SELECT 1 FROM consent_grant_documents cgd WHERE cgd.consent_grant_id = $2 AND cgd.document_id = sd.id)
               )
             ORDER BY dt.sort_order ASC`,
        [supplierId, r.consentGrantId]
      ) : Promise.resolve({ rows: [] })
    ]);
    const accessedScopes = ["supplier_profile"];
    if (allowCompany) accessedScopes.push("company_details");
    if (allowDirectors) accessedScopes.push("directors_owners");
    if (allowProjects) accessedScopes.push("past_projects");
    if (allowTax) accessedScopes.push("tax_compliance");
    if (allowBanking) accessedScopes.push("banking_details");
    await consentRepository.logDataAccess({
      organizationId: ctx.tenantId,
      supplierId,
      consentGrantId: hasActiveConsent ? r.consentGrantId : null,
      accessedByUserId: ctx.userId,
      accessedDataScope: accessedScopes,
      ipAddress: extractClientIp(req),
      userAgent: req.get("user-agent") || null
    }).catch(() => {
    });
    res.json({
      id: r.id,
      legalName: r.legalName,
      tradingName: r.tradingName,
      city: r.city,
      district: r.district,
      complianceStatus: r.complianceStatus,
      verificationStatus: r.verificationStatus,
      profileCompleteness: Number(r.profileCompleteness || 0),
      consentStatus,
      hasActiveConsent,
      cipaNumber: allowCompany ? r.cipaNumber : null,
      ppraCode: allowCompany ? r.ppraCode : null,
      physicalAddress: allowCompany ? r.physicalAddress : null,
      email: allowCompany ? r.email : null,
      primaryPhone: allowCompany ? r.primaryPhone : null,
      website: allowCompany ? r.website : null,
      tinNumber: allowTax ? r.tinNumber : null,
      bankName: allowBanking ? r.bankName : null,
      bankBranch: allowBanking ? r.bankBranch : null,
      directors: directorsRes.rows,
      projects: projectsRes.rows,
      sharedDocuments: docsRes.rows
    });
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router5.get("/applications", requirePermission("applications.view"), async (req, res) => {
  try {
    const ctx = getOrganizationContext(req);
    const apps = await applicationsRepository.listByOrganization(ctx.tenantId);
    res.json(apps);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router5.post("/applications/:id/review", requirePermission("applications.review"), async (req, res) => {
  try {
    const ctx = getOrganizationContext(req);
    const { decision, comment } = req.body;
    const ip = extractClientIp(req);
    await applicationsRepository.recordReviewDecision({
      applicationId: req.params.id,
      orgId: ctx.tenantId,
      userId: ctx.userId,
      reviewerName: req.user.fullName,
      reviewerRole: ctx.roleName,
      decision,
      comment,
      ipAddress: ip
    });
    res.json({ success: true, message: `Review decision (${decision}) recorded.` });
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router5.get("/clarifications", requirePermission("calls.manage"), async (req, res) => {
  try {
    const ctx = getOrganizationContext(req);
    const list = await callsRepository.listClarificationsByOrganization(ctx.tenantId);
    res.json(list);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router5.post("/clarifications/:id/answer", requirePermission("calls.manage"), async (req, res) => {
  try {
    const ctx = getOrganizationContext(req);
    const { answer, responderTitle } = req.body;
    if (!answer || !String(answer).trim()) {
      res.status(400).json({ error: "MISSING_ANSWER", message: "Clarification answer cannot be empty." });
      return;
    }
    await callsRepository.answerClarification(
      req.params.id,
      answer,
      responderTitle || `${req.user.fullName} (${ctx.roleName})`,
      ctx.userId,
      ctx.tenantId,
      {
        actorName: req.user.fullName,
        actorRole: ctx.roleName,
        ipAddress: extractClientIp(req)
      }
    );
    res.json({ success: true, message: "Official clarification answer published." });
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router5.get("/bids/:callId/session", requirePermission("bids.view"), async (req, res) => {
  try {
    const ctx = getOrganizationContext(req);
    const session = await bidsRepository.getOpeningSession(req.params.callId, ctx.tenantId);
    res.json(session);
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router5.get("/bids/:callId", requirePermission("bids.view"), async (req, res) => {
  try {
    const ctx = getOrganizationContext(req);
    const bids = await bidsRepository.listByCall(req.params.callId, ctx.tenantId);
    res.json(bids);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router5.post("/bids/:callId/open-session", requirePermission("bids.open"), async (req, res) => {
  try {
    const ctx = getOrganizationContext(req);
    const { witnesses } = req.body || {};
    const ip = extractClientIp(req);
    const result = await bidsRepository.conductOpeningSession({
      callId: req.params.callId,
      orgId: ctx.tenantId,
      userId: ctx.userId,
      actorName: req.user.fullName,
      actorRole: ctx.roleName,
      witnesses: Array.isArray(witnesses) ? witnesses : [],
      ipAddress: ip
    });
    res.json(result);
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router5.get("/evaluations/:callId", requirePermission("applications.view"), async (req, res) => {
  try {
    const ctx = getOrganizationContext(req);
    const callRes = await query(`SELECT id FROM calls WHERE id = $1 AND organization_id = $2`, [req.params.callId, ctx.tenantId]);
    if (!callRes.rows.length) {
      res.status(404).json({ error: "NOT_FOUND", message: "Tender call not found for your organization." });
      return;
    }
    const [criteria, scores, assignment] = await Promise.all([
      evaluationsRepository.getCriteria(req.params.callId),
      evaluationsRepository.listScores(req.params.callId),
      evaluationsRepository.getEvaluatorAssignment(req.params.callId, ctx.userId)
    ]);
    res.json({ criteria, scores, assignment });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router5.post("/evaluations/:callId/declare-conflict", async (req, res) => {
  try {
    const ctx = getOrganizationContext(req);
    const callCheck = await query(`SELECT id FROM calls WHERE id = $1 AND organization_id = $2`, [req.params.callId, ctx.tenantId]);
    if (!callCheck.rows.length) {
      res.status(404).json({ error: "NOT_FOUND", message: "Tender call not found for your organization." });
      return;
    }
    const { hasConflict, details } = req.body;
    await evaluationsRepository.signConflictDeclaration(req.params.callId, ctx.userId, ctx.tenantId, !!hasConflict, details);
    res.json({ success: true, message: "Independence declaration recorded." });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});
router5.post("/evaluations/:callId/score", requirePermission("evaluation.score"), async (req, res) => {
  try {
    const ctx = getOrganizationContext(req);
    const callCheck = await query(`SELECT id FROM calls WHERE id = $1 AND organization_id = $2`, [req.params.callId, ctx.tenantId]);
    if (!callCheck.rows.length) {
      res.status(404).json({ error: "NOT_FOUND", message: "Tender call not found for your organization." });
      return;
    }
    const { criterionId, bidId, score, comment } = req.body;
    await evaluationsRepository.submitScore({
      callId: req.params.callId,
      userId: ctx.userId,
      criterionId,
      bidId,
      score: Number(score),
      comment
    });
    res.json({ success: true, message: "Score saved." });
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router5.post("/evaluations/:callId/lock", requirePermission("evaluation.score"), async (req, res) => {
  try {
    const ctx = getOrganizationContext(req);
    const callCheck = await query(`SELECT id FROM calls WHERE id = $1 AND organization_id = $2`, [req.params.callId, ctx.tenantId]);
    if (!callCheck.rows.length) {
      res.status(404).json({ error: "NOT_FOUND", message: "Tender call not found for your organization." });
      return;
    }
    const ip = extractClientIp(req);
    await evaluationsRepository.lockScorecard({
      callId: req.params.callId,
      userId: ctx.userId,
      actorName: req.user.fullName,
      actorRole: ctx.roleName,
      orgId: ctx.tenantId,
      ipAddress: ip
    });
    res.json({ success: true, message: "Scorecard locked and finalized." });
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router5.get("/awards", requirePermission("reports.view"), async (req, res) => {
  try {
    const ctx = getOrganizationContext(req);
    const awards = await awardsRepository.listAwards(ctx.tenantId);
    res.json(awards);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router5.post("/awards/recommend", requirePermission("awards.recommend"), async (req, res) => {
  try {
    const ctx = getOrganizationContext(req);
    const { callId, bidId, supplierId, awardValue, justification } = req.body;
    const ip = extractClientIp(req);
    const awardId = await awardsRepository.recommendAward({
      callId,
      bidId,
      supplierId,
      awardValue: Number(awardValue),
      justification,
      userId: ctx.userId,
      actorName: req.user.fullName,
      actorRole: ctx.roleName,
      orgId: ctx.tenantId,
      ipAddress: ip
    });
    res.status(201).json({ awardId, message: "Award recommendation submitted." });
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router5.post("/awards/:id/approve", requirePermission("awards.approve"), async (req, res) => {
  try {
    const ctx = getOrganizationContext(req);
    const { decision, comment } = req.body;
    const ip = extractClientIp(req);
    await awardsRepository.approveAward({
      awardId: req.params.id,
      userId: ctx.userId,
      actorName: req.user.fullName,
      actorRole: ctx.roleName,
      orgId: ctx.tenantId,
      decision: decision || "approved",
      comment,
      ipAddress: ip
    });
    res.json({ success: true, message: `Award decision (${decision}) approved and contract generated.` });
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router5.get("/contracts", requirePermission("contracts.manage"), async (req, res) => {
  try {
    const ctx = getOrganizationContext(req);
    const contracts = await awardsRepository.listContracts(ctx.tenantId);
    res.json(contracts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router5.get("/documents/:id/file", requirePermission("applications.view"), async (req, res) => {
  try {
    const ctx = getOrganizationContext(req);
    const fileRecord = await documentsRepository.getFileForBuyer(req.params.id, ctx.tenantId);
    if (!fileRecord) {
      res.status(404).json({
        error: "NOT_FOUND",
        message: "Document file not found or not shared with your organization."
      });
      return;
    }
    if (fileRecord.supplierId) {
      await consentRepository.logDataAccess({
        organizationId: ctx.tenantId,
        supplierId: fileRecord.supplierId,
        accessedByUserId: ctx.userId,
        accessedDataScope: [
          `document:${fileRecord.documentTypeName || fileRecord.fileName || "vault_file"}`
        ],
        ipAddress: extractClientIp(req),
        userAgent: req.get("user-agent") || null
      }).catch(() => {
      });
    }
    const isDownload = req.query.download === "1" || req.query.download === "true";
    const dispositionType = isDownload ? "attachment" : "inline";
    const safeFileName = (fileRecord.fileName || "document").replace(/[\r\n"\\]/g, "_");
    res.setHeader("Content-Type", fileRecord.mimeType || "application/octet-stream");
    res.setHeader("Content-Length", String(fileRecord.content.length));
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "private, no-store, no-cache, must-revalidate");
    res.setHeader("Content-Disposition", `${dispositionType}; filename="${safeFileName}"; filename*=UTF-8''${encodeURIComponent(safeFileName)}`);
    res.send(fileRecord.content);
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router5.get("/team", async (req, res) => {
  try {
    const ctx = getOrganizationContext(req);
    const data = await workspaceRepository.listTeamAndInvitations(ctx.tenantId);
    res.json(data);
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router5.get("/roles", async (req, res) => {
  try {
    const ctx = getOrganizationContext(req);
    const roles = await workspaceRepository.listOrgRoles(ctx.tenantId);
    res.json(roles);
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router5.post("/team/invite", requirePermission("org.members.manage"), async (req, res) => {
  try {
    const ctx = getOrganizationContext(req);
    const created = await workspaceRepository.inviteOrgMember(
      ctx.tenantId,
      {
        userId: ctx.userId,
        fullName: req.user.fullName,
        roleName: ctx.roleName,
        ipAddress: extractClientIp(req)
      },
      req.body || {}
    );
    res.status(201).json(created);
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router5.patch("/team/members/:id", requirePermission("org.members.manage"), async (req, res) => {
  try {
    const ctx = getOrganizationContext(req);
    await workspaceRepository.updateOrgMember(
      ctx.tenantId,
      req.params.id,
      {
        userId: ctx.userId,
        fullName: req.user.fullName,
        roleName: ctx.roleName,
        ipAddress: extractClientIp(req)
      },
      req.body || {}
    );
    res.json({ success: true });
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router5.post("/team/members/:id/status", requirePermission("org.members.manage"), async (req, res) => {
  try {
    const ctx = getOrganizationContext(req);
    const nextStatus = req.body?.status === "suspended" ? "suspended" : "active";
    await workspaceRepository.updateOrgMemberStatus(
      ctx.tenantId,
      req.params.id,
      {
        userId: ctx.userId,
        fullName: req.user.fullName,
        roleName: ctx.roleName,
        ipAddress: extractClientIp(req)
      },
      nextStatus,
      req.body?.reason
    );
    res.json({ success: true });
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router5.delete("/team/members/:id", requirePermission("org.members.manage"), async (req, res) => {
  try {
    const ctx = getOrganizationContext(req);
    await workspaceRepository.removeOrgMember(ctx.tenantId, req.params.id, {
      userId: ctx.userId,
      fullName: req.user.fullName,
      roleName: ctx.roleName,
      ipAddress: extractClientIp(req)
    });
    res.json({ success: true });
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router5.delete("/team/invitations/:id", requirePermission("org.members.manage"), async (req, res) => {
  try {
    const ctx = getOrganizationContext(req);
    await workspaceRepository.revokeOrgInvitation(ctx.tenantId, req.params.id, {
      userId: ctx.userId,
      fullName: req.user.fullName,
      roleName: ctx.roleName,
      ipAddress: extractClientIp(req)
    });
    res.json({ success: true });
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router5.post("/team/invitations/:id/resend", requirePermission("org.members.manage"), async (req, res) => {
  try {
    const ctx = getOrganizationContext(req);
    const resent = await workspaceRepository.resendOrgInvitation(ctx.tenantId, req.params.id, {
      userId: ctx.userId,
      fullName: req.user.fullName,
      roleName: ctx.roleName,
      ipAddress: extractClientIp(req)
    });
    res.json(resent);
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router5.get("/branding", async (req, res) => {
  try {
    const ctx = getOrganizationContext(req);
    const branding = await workspaceRepository.getBranding(ctx.tenantId);
    res.json(branding);
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router5.put("/branding", requirePermission("org.manage"), async (req, res) => {
  try {
    const ctx = getOrganizationContext(req);
    const updated = await workspaceRepository.updateBranding(
      ctx.tenantId,
      {
        userId: ctx.userId,
        fullName: req.user.fullName,
        roleName: ctx.roleName,
        ipAddress: extractClientIp(req)
      },
      req.body || {}
    );
    res.json(updated);
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router5.get("/settings", async (req, res) => {
  try {
    const ctx = getOrganizationContext(req);
    const settings = await workspaceRepository.getSettings(ctx.tenantId);
    res.json(settings);
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router5.put("/settings", requirePermission("org.manage"), async (req, res) => {
  try {
    const ctx = getOrganizationContext(req);
    const updated = await workspaceRepository.updateSettings(
      ctx.tenantId,
      {
        userId: ctx.userId,
        fullName: req.user.fullName,
        roleName: ctx.roleName,
        ipAddress: extractClientIp(req)
      },
      req.body || {}
    );
    res.json(updated);
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router5.get("/form-templates", async (req, res) => {
  try {
    const ctx = getOrganizationContext(req);
    const list = await workspaceRepository.listFormTemplates(ctx.tenantId);
    res.json(list);
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router5.post("/form-templates", requirePermission("forms.manage"), async (req, res) => {
  try {
    const ctx = getOrganizationContext(req);
    const id = await workspaceRepository.createFormTemplate(
      ctx.tenantId,
      {
        userId: ctx.userId,
        fullName: req.user.fullName,
        roleName: ctx.roleName,
        ipAddress: extractClientIp(req)
      },
      req.body || {}
    );
    const templates = await workspaceRepository.listFormTemplates(ctx.tenantId);
    res.status(201).json({ id, templates });
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router5.put("/form-templates/:id", requirePermission("forms.manage"), async (req, res) => {
  try {
    const ctx = getOrganizationContext(req);
    await workspaceRepository.updateFormTemplate(
      ctx.tenantId,
      req.params.id,
      {
        userId: ctx.userId,
        fullName: req.user.fullName,
        roleName: ctx.roleName,
        ipAddress: extractClientIp(req)
      },
      req.body || {}
    );
    const templates = await workspaceRepository.listFormTemplates(ctx.tenantId);
    res.json({ success: true, templates });
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router5.delete("/form-templates/:id", requirePermission("forms.manage"), async (req, res) => {
  try {
    const ctx = getOrganizationContext(req);
    await workspaceRepository.deleteFormTemplate(ctx.tenantId, req.params.id, {
      userId: ctx.userId,
      fullName: req.user.fullName,
      roleName: ctx.roleName,
      ipAddress: extractClientIp(req)
    });
    res.json({ success: true });
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router5.get("/workflows", async (req, res) => {
  try {
    const ctx = getOrganizationContext(req);
    const data = await workspaceRepository.getWorkflowsAndScoring(ctx.tenantId);
    res.json(data);
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router5.post("/workflows/stages", requirePermission("workflows.manage"), async (req, res) => {
  try {
    const ctx = getOrganizationContext(req);
    const id = await workspaceRepository.createWorkflowStage(
      ctx.tenantId,
      {
        userId: ctx.userId,
        fullName: req.user.fullName,
        roleName: ctx.roleName,
        ipAddress: extractClientIp(req)
      },
      req.body || {}
    );
    const data = await workspaceRepository.getWorkflowsAndScoring(ctx.tenantId);
    res.status(201).json({ id, ...data });
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router5.delete("/workflows/stages/:id", requirePermission("workflows.manage"), async (req, res) => {
  try {
    const ctx = getOrganizationContext(req);
    await workspaceRepository.deleteWorkflowStage(ctx.tenantId, req.params.id, {
      userId: ctx.userId,
      fullName: req.user.fullName,
      roleName: ctx.roleName,
      ipAddress: extractClientIp(req)
    });
    res.json({ success: true });
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router5.put("/workflows/scoring-templates", requirePermission("workflows.manage"), async (req, res) => {
  try {
    const ctx = getOrganizationContext(req);
    const templates = await workspaceRepository.saveScoringTemplates(
      ctx.tenantId,
      {
        userId: ctx.userId,
        fullName: req.user.fullName,
        roleName: ctx.roleName,
        ipAddress: extractClientIp(req)
      },
      req.body?.scoringTemplates || []
    );
    res.json({ scoringTemplates: templates });
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router5.get("/integrations", requirePermission("integrations.manage"), async (req, res) => {
  try {
    const ctx = getOrganizationContext(req);
    const data = await workspaceRepository.getIntegrations(ctx.tenantId);
    res.json(data);
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router5.post("/integrations/api-keys", requirePermission("integrations.manage"), async (req, res) => {
  try {
    const ctx = getOrganizationContext(req);
    const created = await workspaceRepository.createApiClient(
      ctx.tenantId,
      {
        userId: ctx.userId,
        fullName: req.user.fullName,
        roleName: ctx.roleName,
        ipAddress: extractClientIp(req)
      },
      req.body || {}
    );
    res.status(201).json(created);
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router5.delete("/integrations/api-keys/:id", requirePermission("integrations.manage"), async (req, res) => {
  try {
    const ctx = getOrganizationContext(req);
    await workspaceRepository.revokeApiClient(ctx.tenantId, req.params.id, {
      userId: ctx.userId,
      fullName: req.user.fullName,
      roleName: ctx.roleName,
      ipAddress: extractClientIp(req)
    });
    res.json({ success: true });
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router5.post("/integrations/webhooks", requirePermission("integrations.manage"), async (req, res) => {
  try {
    const ctx = getOrganizationContext(req);
    const saved = await workspaceRepository.saveWebhookEndpoint(
      ctx.tenantId,
      {
        userId: ctx.userId,
        fullName: req.user.fullName,
        roleName: ctx.roleName,
        ipAddress: extractClientIp(req)
      },
      req.body || {}
    );
    res.status(201).json(saved);
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router5.delete("/integrations/webhooks/:id", requirePermission("integrations.manage"), async (req, res) => {
  try {
    const ctx = getOrganizationContext(req);
    await workspaceRepository.deleteWebhookEndpoint(ctx.tenantId, req.params.id, {
      userId: ctx.userId,
      fullName: req.user.fullName,
      roleName: ctx.roleName,
      ipAddress: extractClientIp(req)
    });
    res.json({ success: true });
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router5.get("/billing", async (req, res) => {
  try {
    const ctx = getOrganizationContext(req);
    const data = await workspaceRepository.getOrgBilling(ctx.tenantId);
    res.json(data);
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
var buyerRouter = router5;

// server/routes/audit.routes.ts
import { Router as Router6 } from "express";
import crypto8 from "crypto";
var router6 = Router6();
router6.use(requireAuth);
router6.get("/logs", requirePermission("audit.view"), async (req, res) => {
  try {
    const ctx = getTenantContext(req);
    const events = await auditRepository.listEvents({
      organizationId: ctx.tenantType === "organization" ? ctx.tenantId : void 0,
      supplierId: ctx.tenantType === "supplier" ? ctx.tenantId : void 0,
      entityType: req.query.entityType
    });
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router6.get("/verify", requirePermission("audit.view"), async (req, res) => {
  try {
    const ctx = getTenantContext(req);
    const verification = await auditRepository.verifyChain({
      organizationId: ctx.tenantType === "organization" ? ctx.tenantId : void 0,
      supplierId: ctx.tenantType === "supplier" ? ctx.tenantId : void 0
    });
    res.json(verification);
  } catch (err) {
    res.status(500).json({ error: err.message || "Audit chain verification failed." });
  }
});
router6.post("/export", requirePermission("audit.view"), async (req, res) => {
  try {
    const ctx = getTenantContext(req);
    const { exportType, recordsCount } = req.body;
    const ip = extractClientIp(req);
    const userAgent = req.headers["user-agent"] || "Web Client";
    const checksumSha256 = crypto8.createHash("sha256").update(`${ctx.tenantId}|${exportType}|${Date.now()}`).digest("hex");
    await auditRepository.recordExport({
      organizationId: ctx.tenantId,
      exportedByUserId: ctx.userId,
      exportType: exportType || "audit_trail_csv",
      recordsCount: Number(recordsCount || 0),
      checksumSha256,
      ipAddress: ip,
      userAgent
    });
    res.json({ success: true, checksumSha256 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
var auditRouter = router6;

// server/routes/bootstrap.routes.ts
import crypto9 from "crypto";
import { Router as Router7 } from "express";
var router7 = Router7();
router7.get(["/", "/bootstrap", "/auth/bootstrap"], requireAuth, async (req, res) => {
  try {
    const user = req.user;
    let activeTenant = req.activeTenant;
    const allMemberships = await usersRepository.getUserMemberships(user.id);
    if (!activeTenant) {
      if (user.isPlatformAdmin) {
        activeTenant = {
          tenantType: "organization",
          tenantId: "platform",
          tenantName: "Platform Administration",
          roleId: "role-platform-admin",
          roleName: "Super Admin",
          isOwner: true,
          status: "active",
          permissions: ["*"]
        };
      } else {
        activeTenant = resolveDeterministicTenant(allMemberships, req.session?.tenantId);
        if (activeTenant && req.session?.id) {
          await persistActiveTenantToSession(req.session.id, activeTenant.tenantType, activeTenant.tenantId);
          req.session.tenantType = activeTenant.tenantType;
          req.session.tenantId = activeTenant.tenantId;
        }
      }
    }
    if (!activeTenant) {
      res.status(404).json({ error: "NO_ACTIVE_TENANT", message: "No active workspace found for this account." });
      return;
    }
    let profile = null;
    let docs = [];
    let apps = [];
    let people = [];
    let consent = [];
    let pastProjects = [];
    let teamMembers = [];
    let pendingInvitations = [];
    let completeness = null;
    if (activeTenant.tenantType === "platform" || activeTenant.tenantId === "platform") {
      profile = {
        id: "platform",
        legalName: "BidReady360 Platform Administration",
        name: "Platform Administration",
        role: "Super Admin"
      };
    } else if (activeTenant.tenantType === "supplier") {
      const [profData, docsData, appsData, peopleData, consentData, projectsData, teamData] = await Promise.all([
        suppliersRepository.getById(activeTenant.tenantId).catch(() => null),
        documentsRepository.listBySupplier(activeTenant.tenantId).catch(() => []),
        applicationsRepository.listBySupplier(activeTenant.tenantId).catch(() => []),
        suppliersRepository.listPeople(activeTenant.tenantId).catch(() => []),
        consentRepository.listBySupplier(activeTenant.tenantId).catch(() => []),
        suppliersRepository.listProjects(activeTenant.tenantId).catch(() => []),
        suppliersRepository.listTeam(activeTenant.tenantId).catch(() => ({ teamMembers: [], pendingInvitations: [] }))
      ]);
      profile = profData;
      docs = docsData || [];
      apps = appsData || [];
      people = peopleData || [];
      consent = consentData || [];
      pastProjects = projectsData || [];
      teamMembers = teamData?.teamMembers || [];
      pendingInvitations = teamData?.pendingInvitations || [];
      if (!profile) {
        const rawRes = await query("SELECT * FROM suppliers WHERE id = $1 LIMIT 1", [activeTenant.tenantId]).catch(() => ({ rows: [] }));
        if (rawRes.rows.length > 0) {
          const r = rawRes.rows[0];
          profile = {
            id: r.id,
            legalName: r.legal_name,
            tradingName: r.trading_name || r.legal_name,
            cipaNumber: r.cipa_uin || "",
            tinNumber: r.burs_tin || "",
            companyType: r.company_type || "",
            yearEstablished: r.year_established,
            description: r.description || "",
            physicalAddress: r.physical_address || "",
            city: r.city || "",
            districtId: r.district_id,
            primaryPhone: r.primary_phone || "",
            email: r.email || "",
            website: r.website || "",
            bankName: r.bank_name || "",
            bankBranch: r.bank_branch || "",
            accountNumberMasked: r.account_number_masked || "",
            citizenOwnedPercentage: r.citizen_owned_percentage,
            youthOwned: r.youth_owned || false,
            womenOwned: r.women_owned || false,
            disabilityOwned: r.disability_owned || false,
            eddCertified: r.edd_certified || false,
            hasTradingLicence: r.has_trading_licence,
            tradingLicenceReason: r.trading_licence_reason,
            profileCompleteness: r.profile_completeness || 0,
            status: r.status,
            verificationStatus: r.verification_status
          };
        }
      }
      if (profile) {
        const debarRes = await query(
          `SELECT id, reason, starts_on AS "startsOn", ends_on AS "endsOn", organization_id AS "organizationId"
           FROM debarments
           WHERE supplier_id = $1
             AND lifted_at IS NULL
             AND starts_on <= CURRENT_DATE
             AND (ends_on IS NULL OR ends_on >= CURRENT_DATE)
           ORDER BY created_at DESC
           LIMIT 1`,
          [activeTenant.tenantId]
        ).catch(() => ({ rows: [] }));
        completeness = computeSupplierCompleteness(profile, people, docs);
        profile.profileCompleteness = completeness.score;
        profile.complianceStatus = completeness.complianceStatus;
        profile.missingItems = completeness.missingItems.map((m) => m.label);
        profile.activeDebarment = debarRes.rows[0] || null;
        profile.pastProjects = pastProjects;
        profile.teamMembers = teamMembers;
        profile.pendingInvitations = pendingInvitations;
      }
    } else if (activeTenant.tenantType === "organization") {
      const orgRes = await query(
        `SELECT id, name, slug, organization_type AS "organizationType",
                status, verification_status AS "verificationStatus",
                rejection_reason AS "rejectionReason", updated_at AS "updatedAt"
         FROM organizations
         WHERE id = $1 AND deleted_at IS NULL
         LIMIT 1`,
        [activeTenant.tenantId]
      ).catch(() => ({ rows: [] }));
      profile = orgRes.rows[0] || null;
    }
    const fingerprintRaw = [
      activeTenant.tenantId,
      profile?.updated_at || profile?.updatedAt || profile?.created_at || "",
      profile?.status || "",
      profile?.verificationStatus || profile?.verification_status || "",
      profile?.activeDebarment?.id || "",
      completeness?.score ?? profile?.profileCompleteness ?? 0,
      people.length,
      docs.length,
      apps.length,
      pastProjects.length,
      teamMembers.length
    ].join("|");
    const serverFingerprint = crypto9.createHash("sha256").update(fingerprintRaw).digest("hex");
    const notifications = await notificationsRepository.listForUser(
      user.id,
      activeTenant.tenantType === "supplier" ? "supplier" : "organization",
      50
    ).catch(() => []);
    res.json({
      activeTenant,
      profileSummary: req.profileSummary || null,
      memberships: allMemberships,
      resolvedSupplierId: activeTenant.tenantId,
      serverFingerprint,
      completeness: completeness || null,
      profile: profile || null,
      documents: docs,
      applications: apps,
      people,
      consent,
      pastProjects,
      teamMembers,
      pendingInvitations,
      notifications,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone || null,
        isPlatformAdmin: user.isPlatformAdmin || false
      }
    });
  } catch (err) {
    console.error("[BOOTSTRAP ERROR]:", err);
    res.status(500).json({ error: "BOOTSTRAP_FAILED", message: err.message || "Failed to assemble workspace bootstrap." });
  }
});
var bootstrapRouter = router7;

// server/routes/debug.routes.ts
import { Router as Router8 } from "express";
var router8 = Router8();
router8.get("/bootstrap-trace", requireAuth, async (req, res) => {
  if (process.env.NODE_ENV === "production") {
    res.status(404).json({ error: "NOT_FOUND", message: "Debug endpoint is disabled in production." });
    return;
  }
  try {
    const user = req.user;
    const session = req.session;
    const membershipsRes = await query(
      `SELECT sm.supplier_id AS "supplierId",
              s.legal_name AS "legalName",
              sm.is_owner AS "isOwner",
              sm.status,
              s.profile_completeness AS "profileCompleteness",
              s.compliance_status AS "complianceStatus",
              s.cipa_uin AS "cipaUin",
              s.created_at AS "createdAt"
       FROM supplier_members sm
       JOIN suppliers s ON s.id = sm.supplier_id AND s.deleted_at IS NULL
       WHERE sm.user_id = $1 AND sm.status = 'active'`,
      [user.id]
    );
    const memberships = membershipsRes.rows;
    let chosenSupplierId = null;
    let ruleFired = "";
    if (session.tenantType === "supplier" && session.tenantId) {
      const match = memberships.find((m) => m.supplierId === session.tenantId);
      if (match) {
        chosenSupplierId = match.supplierId;
        ruleFired = "RULE 1: Matched session.tenant_id with active supplier membership";
      } else {
        ruleFired = "RULE 1 FAILED: session.tenant_id is not in active supplier memberships";
      }
    }
    if (!chosenSupplierId && memberships.length > 0) {
      const owners = memberships.filter((m) => m.isOwner);
      if (owners.length > 0) {
        chosenSupplierId = owners[0].supplierId;
        ruleFired = "RULE 2 FALLBACK: Preferred supplier membership with is_owner = true";
      } else {
        chosenSupplierId = memberships[0].supplierId;
        ruleFired = "RULE 3 FALLBACK: Defaulted to first available membership";
      }
    }
    if (!chosenSupplierId) {
      ruleFired = "NO_SUPPLIER_FOUND: User has no active supplier memberships";
    }
    let rawSupplierRow = null;
    let rawPeople = [];
    let rawDocuments = [];
    if (chosenSupplierId) {
      const supRes = await query("SELECT * FROM suppliers WHERE id = $1", [chosenSupplierId]);
      rawSupplierRow = supRes.rows[0] || null;
      const peopleRes = await query("SELECT * FROM supplier_people WHERE supplier_id = $1", [chosenSupplierId]);
      rawPeople = peopleRes.rows;
      const docsRes = await query(
        `SELECT sd.*, dt.code AS doc_type_code, dt.name AS doc_type_name,
                sdv.version_no, sdv.expiry_date, sdv.verification_status, sdv.file_name
         FROM supplier_documents sd
         JOIN document_types dt ON dt.id = sd.document_type_id
         LEFT JOIN supplier_document_versions sdv ON sdv.id = sd.current_version_id
         WHERE sd.supplier_id = $1`,
        [chosenSupplierId]
      );
      rawDocuments = docsRes.rows;
    }
    res.json({
      sessionId: session.id,
      sessionTenantType: session.tenantType,
      sessionTenantId: session.tenantId,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName
      },
      memberships,
      chosenSupplierId,
      ruleFired,
      queriesExecutedWithSupplierId: chosenSupplierId,
      rawSupplierRow,
      rawPeople,
      rawDocuments
    });
  } catch (err) {
    console.error("[DEBUG BOOTSTRAP-TRACE ERROR]:", err);
    res.status(500).json({ error: "TRACE_FAILED", message: err.message });
  }
});
var debugRouter = router8;

// server/routes/admin.routes.ts
import { Router as Router9 } from "express";
var router9 = Router9();
router9.use(requireAuth, requirePlatformAdmin);
var UUID_REGEX8 = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function getActorInfo(req) {
  return {
    actorUserId: req.user?.id || null,
    actorName: req.user?.fullName || req.user?.email || "Platform Admin",
    actorRole: "Super Admin",
    ipAddress: req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket.remoteAddress || null,
    userAgent: req.headers["user-agent"]?.slice(0, 290) || null
  };
}
async function logAdminAudit(req, payload) {
  const actor = getActorInfo(req);
  await auditRepository.logEvent({
    ...actor,
    organizationName: "BidReady360 Platform Administration",
    action: payload.action,
    entityType: payload.entityType,
    entityId: payload.entityId || null,
    organizationId: payload.organizationId || null,
    supplierId: payload.supplierId || null,
    beforeJson: payload.beforeJson,
    afterJson: payload.afterJson,
    details: payload.details
  });
}
async function hasPeopleGenderColumn() {
  const res = await query(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'supplier_people'
         AND column_name = 'gender'
     ) AS exists`
  );
  return Boolean(res.rows[0]?.exists);
}
router9.get("/overview", async (_req, res) => {
  try {
    const [
      countsRes,
      pendingOrgsRes,
      openFlagsRes,
      recentAuditRes,
      growthRes,
      revenueRes
    ] = await Promise.all([
      query(`
        SELECT
          (SELECT COUNT(*)::int FROM organizations WHERE deleted_at IS NULL AND (status = 'pending' OR verification_status = 'pending_review')) AS "pendingOrgsCount",
          (SELECT COUNT(*)::int FROM organizations WHERE deleted_at IS NULL AND status = 'active') AS "activeOrgsCount",
          (SELECT COUNT(*)::int FROM organizations WHERE deleted_at IS NULL AND status = 'suspended') AS "suspendedOrgsCount",
          (SELECT COUNT(*)::int FROM suppliers WHERE deleted_at IS NULL) AS "totalSuppliersCount",
          (SELECT COUNT(*)::int FROM suppliers WHERE deleted_at IS NULL AND verification_status IN ('unverified', 'pending')) AS "pendingSuppliersCount",
          (SELECT COUNT(*)::int FROM suppliers WHERE deleted_at IS NULL AND verification_status = 'verified') AS "verifiedSuppliersCount",
          (SELECT COUNT(*)::int FROM suppliers WHERE deleted_at IS NULL AND compliance_status = 'Fully compliant') AS "compliantSuppliersCount",
          (SELECT COUNT(*)::int FROM supplier_people WHERE is_active = TRUE AND kyc_status IN ('not_started', 'pending')) AS "pendingPeopleCount",
          (SELECT COUNT(*)::int
             FROM supplier_documents d
             JOIN supplier_document_versions v ON v.id = d.current_version_id
            WHERE d.status = 'active' AND UPPER(v.verification_status) = 'PENDING_VERIFICATION') AS "pendingDocumentsCount",
          (SELECT COUNT(*)::int FROM calls WHERE status IN ('published', 'open', 'evaluating')) AS "activeCallsCount",
          (SELECT COUNT(*)::int FROM bids WHERE status IN ('submitted', 'opened')) AS "totalBidsCount",
          (SELECT COUNT(*)::int FROM users WHERE deleted_at IS NULL) AS "totalUsersCount",
          (SELECT COUNT(*)::int FROM users WHERE deleted_at IS NULL AND locked_until IS NOT NULL AND locked_until > NOW()) AS "lockedUsersCount",
          (SELECT COUNT(*)::int FROM risk_flags WHERE status IN ('open', 'reviewed')) AS "openRiskFlagsCount",
          (SELECT COUNT(*)::int FROM debarments WHERE lifted_at IS NULL AND starts_on <= CURRENT_DATE AND (ends_on IS NULL OR ends_on >= CURRENT_DATE)) AS "activeDebarmentsCount",
          (SELECT COUNT(*)::int FROM message_deliveries WHERE status = 'failed') AS "failedDeliveriesCount",
          (SELECT COUNT(*)::int FROM platform_invoices WHERE status = 'overdue') AS "overdueInvoicesCount",
          (SELECT COALESCE(SUM(p.price), 0)::numeric FROM subscriptions sub JOIN plans p ON p.id = sub.plan_id WHERE sub.status = 'active') AS "monthlyMrrBwp"
      `),
      query(`
        SELECT o.id, o.name, o.organization_type AS "type", o.registration_number AS "gazetteRef",
               o.contact_email AS "email", o.status, o.verification_status AS "verificationStatus",
               o.created_at AS "createdAt"
        FROM organizations o
        WHERE o.deleted_at IS NULL AND (o.status = 'pending' OR o.verification_status = 'pending_review')
        ORDER BY o.created_at DESC
        LIMIT 5
      `),
      query(`
        SELECT rf.id, rf.flag_type AS "flagType", rf.severity, rf.status, rf.details,
               rf.created_at AS "createdAt", s.legal_name AS "supplierName"
        FROM risk_flags rf
        JOIN suppliers s ON s.id = rf.supplier_id
        WHERE rf.status IN ('open', 'reviewed')
        ORDER BY CASE rf.severity WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, rf.created_at DESC
        LIMIT 5
      `),
      auditRepository.listEvents({ limit: 8 }),
      query(`
        SELECT
          TO_CHAR(m.month_start, 'Mon') AS month,
          (SELECT COUNT(*)::int FROM suppliers s WHERE s.deleted_at IS NULL AND s.created_at <= m.month_start + INTERVAL '1 month') AS suppliers,
          (SELECT COUNT(*)::int FROM organizations o WHERE o.deleted_at IS NULL AND o.created_at <= m.month_start + INTERVAL '1 month') AS organizations
        FROM generate_series(
          DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '5 months',
          DATE_TRUNC('month', CURRENT_DATE),
          INTERVAL '1 month'
        ) AS m(month_start)
        ORDER BY m.month_start ASC
      `),
      query(`
        SELECT
          TO_CHAR(m.month_start, 'Mon') AS month,
          COALESCE(SUM(CASE WHEN pi.status = 'paid' THEN pi.total ELSE 0 END), 0)::numeric AS paid,
          COALESCE(SUM(CASE WHEN pi.status IN ('issued', 'overdue') THEN pi.total ELSE 0 END), 0)::numeric AS outstanding,
          COALESCE(SUM(pi.total), 0)::numeric AS total
        FROM generate_series(
          DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '5 months',
          DATE_TRUNC('month', CURRENT_DATE),
          INTERVAL '1 month'
        ) AS m(month_start)
        LEFT JOIN platform_invoices pi
          ON DATE_TRUNC('month', COALESCE(pi.issued_at, pi.created_at)) = m.month_start
        GROUP BY m.month_start
        ORDER BY m.month_start ASC
      `)
    ]);
    const c = countsRes.rows[0] || {};
    const totalSuppliers = Number(c.totalSuppliersCount) || 0;
    const compliantSuppliers = Number(c.compliantSuppliersCount) || 0;
    const complianceRatePercent = totalSuppliers > 0 ? Math.round(compliantSuppliers / totalSuppliers * 1e3) / 10 : 0;
    const verificationQueueCount = (Number(c.pendingPeopleCount) || 0) + (Number(c.pendingDocumentsCount) || 0);
    res.json({
      kpis: {
        pendingOrgsCount: Number(c.pendingOrgsCount) || 0,
        activeOrgsCount: Number(c.activeOrgsCount) || 0,
        suspendedOrgsCount: Number(c.suspendedOrgsCount) || 0,
        totalSuppliersCount: totalSuppliers,
        pendingSuppliersCount: Number(c.pendingSuppliersCount) || 0,
        verifiedSuppliersCount: Number(c.verifiedSuppliersCount) || 0,
        pendingPeopleCount: Number(c.pendingPeopleCount) || 0,
        pendingDocumentsCount: Number(c.pendingDocumentsCount) || 0,
        verificationQueueCount,
        activeCallsCount: Number(c.activeCallsCount) || 0,
        totalBidsCount: Number(c.totalBidsCount) || 0,
        totalUsersCount: Number(c.totalUsersCount) || 0,
        lockedUsersCount: Number(c.lockedUsersCount) || 0,
        openRiskFlagsCount: Number(c.openRiskFlagsCount) || 0,
        activeDebarmentsCount: Number(c.activeDebarmentsCount) || 0,
        failedDeliveriesCount: Number(c.failedDeliveriesCount) || 0,
        overdueInvoicesCount: Number(c.overdueInvoicesCount) || 0,
        monthlyMrrBwp: Number(c.monthlyMrrBwp) || 0,
        complianceRatePercent
      },
      pendingOrgs: pendingOrgsRes.rows,
      openRiskFlags: openFlagsRes.rows,
      recentAuditEvents: recentAuditRes.map((e) => ({
        ...e,
        timestamp: e.occurredAt ? new Date(e.occurredAt).toLocaleString("en-BW", {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        }) : "\u2014"
      })),
      monthlyGrowth: growthRes.rows,
      monthlyRevenue: revenueRes.rows.map((r) => ({
        month: r.month,
        paid: Number(r.paid) || 0,
        outstanding: Number(r.outstanding) || 0,
        total: Number(r.total) || 0
      })),
      generatedAt: (/* @__PURE__ */ new Date()).toISOString()
    });
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router9.get("/organizations", async (req, res) => {
  try {
    const statusFilter = String(req.query.status || "all").toLowerCase();
    const search = String(req.query.search || "").trim();
    const conditions = ["o.deleted_at IS NULL"];
    const params = [];
    if (statusFilter === "pending") {
      conditions.push(`(o.status = 'pending' OR o.verification_status = 'pending_review')`);
    } else if (statusFilter === "active") {
      conditions.push(`o.status = 'active'`);
    } else if (statusFilter === "suspended") {
      conditions.push(`o.status IN ('suspended', 'closed')`);
    }
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(o.name ILIKE $${params.length} OR COALESCE(o.registration_number, '') ILIKE $${params.length} OR COALESCE(o.contact_email::text, '') ILIKE $${params.length})`);
    }
    const result = await query(
      `SELECT o.id,
              o.name,
              o.slug,
              o.organization_type AS "organizationType",
              o.registration_number AS "registrationNumber",
              o.status,
              o.verification_status AS "verificationStatus",
              o.contact_email AS "contactEmail",
              o.contact_phone AS "contactPhone",
              o.city,
              o.district,
              o.rejection_reason AS "rejectionReason",
              o.approved_at AS "approvedAt",
              o.created_at AS "createdAt",
              COALESCE(mem.members_count, 0)::int AS "membersCount",
              mem.lead_name AS "contactPerson",
              COALESCE(mem.lead_email, o.contact_email::text) AS "leadEmail",
              COALESCE(sub.plan_name, 'Standard') AS "planName"
       FROM organizations o
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::int AS members_count,
                (SELECT u2.full_name FROM organization_members om2 JOIN users u2 ON u2.id = om2.user_id WHERE om2.organization_id = o.id ORDER BY om2.is_owner DESC, om2.created_at ASC LIMIT 1) AS lead_name,
                (SELECT u2.email::text FROM organization_members om2 JOIN users u2 ON u2.id = om2.user_id WHERE om2.organization_id = o.id ORDER BY om2.is_owner DESC, om2.created_at ASC LIMIT 1) AS lead_email
         FROM organization_members om
         WHERE om.organization_id = o.id AND om.status = 'active'
       ) mem ON TRUE
       LEFT JOIN LATERAL (
         SELECT p.name AS plan_name
         FROM subscriptions s
         JOIN plans p ON p.id = s.plan_id
         WHERE s.organization_id = o.id AND s.status = 'active'
         ORDER BY s.created_at DESC
         LIMIT 1
       ) sub ON TRUE
       WHERE ${conditions.join(" AND ")}
       ORDER BY
         CASE WHEN o.status = 'pending' OR o.verification_status = 'pending_review' THEN 0
              WHEN o.status = 'active' THEN 1
              ELSE 2 END,
         o.created_at DESC`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router9.post("/organizations/:id/approve", async (req, res) => {
  try {
    const { id } = req.params;
    if (!UUID_REGEX8.test(id)) {
      return res.status(400).json({ error: "INVALID_ID", message: "Invalid organization ID." });
    }
    const beforeRes = await query(
      `SELECT id, name, status, verification_status FROM organizations WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    if (!beforeRes.rows.length) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Organization not found." });
    }
    const before = beforeRes.rows[0];
    const updatedRes = await query(
      `UPDATE organizations
       SET status = 'active',
           verification_status = 'verified',
           approved_by_user_id = $2,
           approved_by = $2,
           approved_at = NOW(),
           rejection_reason = NULL,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, name, status, verification_status AS "verificationStatus", approved_at AS "approvedAt", rejection_reason AS "rejectionReason"`,
      [id, req.user.id]
    );
    await logAdminAudit(req, {
      action: "ADMIN_APPROVED_ORGANIZATION",
      entityType: "organization",
      entityId: id,
      organizationId: id,
      beforeJson: { status: before.status, verificationStatus: before.verification_status },
      afterJson: { status: "active", verificationStatus: "verified" },
      details: `Approved procuring organization "${before.name}" for live tender operations.`
    });
    res.json(updatedRes.rows[0]);
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router9.post("/organizations/:id/reject", async (req, res) => {
  try {
    const { id } = req.params;
    if (!UUID_REGEX8.test(id)) {
      return res.status(400).json({ error: "INVALID_ID", message: "Invalid organization ID." });
    }
    const reason = String(req.body?.reason || "").trim().slice(0, 1e3);
    if (!reason || reason.length < 5) {
      return res.status(400).json({ error: "REASON_REQUIRED", message: "A rejection reason (at least 5 characters) is required." });
    }
    const beforeRes = await query(
      `SELECT id, name, status, verification_status FROM organizations WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    if (!beforeRes.rows.length) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Organization not found." });
    }
    const before = beforeRes.rows[0];
    const updatedRes = await query(
      `UPDATE organizations
       SET status = 'suspended',
           verification_status = 'rejected',
           rejection_reason = $2,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, name, status, verification_status AS "verificationStatus", rejection_reason AS "rejectionReason"`,
      [id, reason]
    );
    await logAdminAudit(req, {
      action: "ADMIN_REJECTED_ORGANIZATION",
      entityType: "organization",
      entityId: id,
      organizationId: id,
      beforeJson: { status: before.status, verificationStatus: before.verification_status },
      afterJson: { status: "suspended", verificationStatus: "rejected", rejectionReason: reason },
      details: `Rejected organization registration "${before.name}". Reason: ${reason}`
    });
    res.json(updatedRes.rows[0]);
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router9.post("/organizations/:id/suspend", async (req, res) => {
  try {
    const { id } = req.params;
    if (!UUID_REGEX8.test(id)) {
      return res.status(400).json({ error: "INVALID_ID", message: "Invalid organization ID." });
    }
    const reason = req.body?.reason ? String(req.body.reason).trim().slice(0, 1e3) : "Suspended by platform administrator";
    const beforeRes = await query(
      `SELECT id, name, status FROM organizations WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    if (!beforeRes.rows.length) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Organization not found." });
    }
    const before = beforeRes.rows[0];
    const updatedRes = await query(
      `UPDATE organizations
       SET status = 'suspended',
           rejection_reason = $2,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, name, status, verification_status AS "verificationStatus", rejection_reason AS "rejectionReason"`,
      [id, reason]
    );
    await logAdminAudit(req, {
      action: "ADMIN_SUSPENDED_ORGANIZATION",
      entityType: "organization",
      entityId: id,
      organizationId: id,
      beforeJson: { status: before.status },
      afterJson: { status: "suspended", reason },
      details: `Suspended procuring organization "${before.name}". Reason: ${reason}`
    });
    res.json(updatedRes.rows[0]);
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router9.get("/suppliers", async (req, res) => {
  try {
    const search = String(req.query.search || "").trim();
    const verificationStatus = String(req.query.verificationStatus || "all").toLowerCase();
    const conditions = ["s.deleted_at IS NULL"];
    const params = [];
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(s.legal_name ILIKE $${params.length} OR s.cipa_uin ILIKE $${params.length} OR COALESCE(s.burs_tin, '') ILIKE $${params.length} OR COALESCE(s.email::text, '') ILIKE $${params.length})`);
    }
    if (verificationStatus !== "all" && ["unverified", "pending", "verified", "rejected"].includes(verificationStatus)) {
      params.push(verificationStatus);
      conditions.push(`s.verification_status = $${params.length}`);
    }
    const result = await query(
      `SELECT s.id,
              s.legal_name AS "legalName",
              s.trading_name AS "tradingName",
              s.cipa_uin AS "cipaNumber",
              s.burs_tin AS "tinNumber",
              s.ppra_registration_no AS "ppraCode",
              s.company_type AS "companyType",
              s.city,
              gd.name AS "district",
              s.email,
              s.primary_phone AS "primaryPhone",
              COALESCE(s.citizen_owned_percentage, 0)::numeric AS "citizenOwnedPercentage",
              s.status,
              s.verification_status AS "verificationStatus",
              s.compliance_status AS "complianceStatus",
              s.profile_completeness AS "profileCompleteness",
              s.verified_at AS "verifiedAt",
              s.created_at AS "createdAt",
              COALESCE(doc_stats.total_docs, 0)::int AS "totalDocs",
              COALESCE(doc_stats.verified_docs, 0)::int AS "verifiedDocs",
              COALESCE(doc_stats.pending_docs, 0)::int AS "pendingDocs",
              COALESCE(doc_stats.expired_docs, 0)::int AS "expiredDocs",
              COALESCE(ppl.total_people, 0)::int AS "peopleCount",
              COALESCE(ppl.verified_people, 0)::int AS "verifiedPeopleCount",
              COALESCE(deb.active_debarments, 0)::int AS "activeDebarments"
       FROM suppliers s
       LEFT JOIN geographic_districts gd ON gd.id = s.district_id
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::int AS total_docs,
                COUNT(*) FILTER (WHERE UPPER(v.verification_status) = 'VERIFIED')::int AS verified_docs,
                COUNT(*) FILTER (WHERE UPPER(v.verification_status) = 'PENDING_VERIFICATION')::int AS pending_docs,
                COUNT(*) FILTER (WHERE v.expiry_date IS NOT NULL AND v.expiry_date < CURRENT_DATE)::int AS expired_docs
         FROM supplier_documents d
         JOIN supplier_document_versions v ON v.id = d.current_version_id
         WHERE d.supplier_id = s.id AND d.status = 'active'
       ) doc_stats ON TRUE
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::int AS total_people,
                COUNT(*) FILTER (WHERE p.kyc_status = 'verified')::int AS verified_people
         FROM supplier_people p
         WHERE p.supplier_id = s.id AND p.is_active = TRUE
       ) ppl ON TRUE
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::int AS active_debarments
         FROM debarments d
         WHERE d.supplier_id = s.id
           AND d.lifted_at IS NULL
           AND d.starts_on <= CURRENT_DATE
           AND (d.ends_on IS NULL OR d.ends_on >= CURRENT_DATE)
       ) deb ON TRUE
       WHERE ${conditions.join(" AND ")}
       ORDER BY s.created_at DESC`,
      params
    );
    res.json(result.rows.map((r) => ({
      ...r,
      citizenOwnedPercentage: Number(r.citizenOwnedPercentage) || 0
    })));
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router9.get("/suppliers/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!UUID_REGEX8.test(id)) {
      return res.status(400).json({ error: "INVALID_ID", message: "Invalid supplier ID." });
    }
    const encryptionKey = getIdKey();
    const hasGender = await hasPeopleGenderColumn();
    const genderSelect = hasGender ? "p.gender," : "NULL::varchar AS gender,";
    const [supRes, peopleRes, docsRes, debRes] = await Promise.all([
      query(
        `SELECT s.id, s.legal_name AS "legalName", s.trading_name AS "tradingName",
                s.cipa_uin AS "cipaNumber", s.burs_tin AS "tinNumber",
                s.ppra_registration_no AS "ppraCode", s.company_type AS "companyType",
                s.physical_address AS "physicalAddress", s.city, gd.name AS "district",
                s.email, s.primary_phone AS "primaryPhone",
                COALESCE(s.citizen_owned_percentage, 0)::numeric AS "citizenOwnedPercentage",
                s.status, s.verification_status AS "verificationStatus",
                s.compliance_status AS "complianceStatus", s.profile_completeness AS "profileCompleteness",
                s.verified_at AS "verifiedAt", s.created_at AS "createdAt"
         FROM suppliers s
         LEFT JOIN geographic_districts gd ON gd.id = s.district_id
         WHERE s.id = $1 AND s.deleted_at IS NULL`,
        [id]
      ),
      query(
        `SELECT p.id, p.full_name AS "fullName", p.person_role AS "personRole",
                p.ownership_percent AS "ownershipPercent", p.identity_type AS "identityType",
                ${genderSelect} p.nationality, p.is_citizen AS "isCitizen",
                p.kyc_status AS "kycStatus", p.kyc_verified_at AS "kycVerifiedAt",
                p.kyc_reference AS "kycReference",
                CASE WHEN p.national_identity_number_encrypted IS NOT NULL
                     THEN pgp_sym_decrypt(p.national_identity_number_encrypted, $2)
                     ELSE NULL END AS "_rawId"
         FROM supplier_people p
         WHERE p.supplier_id = $1 AND p.is_active = TRUE
         ORDER BY p.created_at ASC`,
        [id, encryptionKey]
      ),
      query(
        `SELECT d.id AS "documentId", v.id AS "versionId",
                dt.code AS "documentTypeCode", dt.name AS "documentTypeName",
                d.title, v.version_no AS "versionNo", v.file_name AS "fileName",
                v.mime_type AS "mimeType", v.file_size_bytes AS "fileSizeBytes",
                v.sha256, v.document_number AS "documentNumber",
                v.issue_date AS "issueDate", v.expiry_date AS "expiryDate",
                v.verification_status AS "verificationStatus", v.verified_at AS "verifiedAt",
                v.verification_notes AS "verificationNotes", v.rejection_reason AS "rejectionReason",
                v.uploaded_at AS "uploadedAt",
                EXISTS (
                  SELECT 1 FROM document_files f
                  WHERE f.document_version_id = v.id AND octet_length(f.content) > 0
                ) AS "hasFile"
         FROM supplier_documents d
         JOIN document_types dt ON dt.id = d.document_type_id
         JOIN supplier_document_versions v ON v.id = d.current_version_id
         WHERE d.supplier_id = $1 AND d.status = 'active'
         ORDER BY dt.sort_order ASC, v.uploaded_at DESC`,
        [id]
      ),
      query(
        `SELECT deb.id, deb.reason, deb.starts_on AS "startsOn", deb.ends_on AS "endsOn",
                deb.lifted_at AS "liftedAt", deb.evidence_ref AS "evidenceRef",
                o.name AS "organizationName"
         FROM debarments deb
         LEFT JOIN organizations o ON o.id = deb.organization_id
         WHERE deb.supplier_id = $1
         ORDER BY deb.created_at DESC`,
        [id]
      )
    ]);
    if (!supRes.rows.length) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Supplier not found." });
    }
    const directors = peopleRes.rows.map((p) => {
      const rawId = p._rawId || null;
      const idLast4 = rawId ? rawId.slice(-4) : null;
      const hasId = Boolean(rawId);
      let omangValid = null;
      let omangMessage = null;
      if ((p.identityType || "OMANG") === "OMANG" && rawId) {
        const check = validateOmang(rawId, p.gender || void 0);
        omangValid = check.ok;
        omangMessage = check.ok ? null : check.message;
      }
      const { _rawId, ...safePerson } = p;
      return {
        ...safePerson,
        hasId,
        idLast4,
        omangValid,
        omangMessage
      };
    });
    res.json({
      supplier: {
        ...supRes.rows[0],
        citizenOwnedPercentage: Number(supRes.rows[0].citizenOwnedPercentage) || 0
      },
      directors,
      documents: docsRes.rows,
      debarments: debRes.rows
    });
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router9.post("/suppliers/:id/verification", async (req, res) => {
  try {
    const { id } = req.params;
    if (!UUID_REGEX8.test(id)) {
      return res.status(400).json({ error: "INVALID_ID", message: "Invalid supplier ID." });
    }
    const verificationStatus = String(req.body?.verificationStatus || "").trim().toLowerCase();
    if (!["unverified", "pending", "verified", "rejected"].includes(verificationStatus)) {
      return res.status(400).json({
        error: "INVALID_STATUS",
        message: "verificationStatus must be unverified, pending, verified, or rejected."
      });
    }
    const complianceStatusRaw = req.body?.complianceStatus ? String(req.body.complianceStatus).trim() : null;
    const complianceStatus = complianceStatusRaw && ["Fully compliant", "Action required", "Non-compliant"].includes(complianceStatusRaw) ? complianceStatusRaw : verificationStatus === "verified" ? "Fully compliant" : verificationStatus === "rejected" ? "Non-compliant" : "Action required";
    const statusRaw = req.body?.status ? String(req.body.status).trim().toLowerCase() : null;
    const accountStatus = statusRaw && ["draft", "active", "suspended", "closed"].includes(statusRaw) ? statusRaw : null;
    const notes = req.body?.notes ? String(req.body.notes).trim().slice(0, 500) : null;
    const existing = await query(
      `SELECT id, legal_name, verification_status, compliance_status FROM suppliers WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    if (!existing.rows.length) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Supplier not found." });
    }
    const before = existing.rows[0];
    const updated = await query(
      `UPDATE suppliers
       SET verification_status = $2::varchar,
           compliance_status = $3::varchar,
           status = COALESCE($4::varchar, CASE WHEN $2::varchar = 'verified' THEN 'active' ELSE status END),
           verified_at = CASE WHEN $2::varchar = 'verified' THEN NOW() ELSE NULL END,
           verified_by_user_id = CASE WHEN $2::varchar = 'verified' THEN $5::uuid ELSE NULL END,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, legal_name AS "legalName", status,
                 verification_status AS "verificationStatus",
                 compliance_status AS "complianceStatus",
                 verified_at AS "verifiedAt"`,
      [id, verificationStatus, complianceStatus, accountStatus, req.user.id]
    );
    await logAdminAudit(req, {
      action: "ADMIN_UPDATED_SUPPLIER_VERIFICATION",
      entityType: "supplier",
      entityId: id,
      supplierId: id,
      beforeJson: { verificationStatus: before.verification_status, complianceStatus: before.compliance_status },
      afterJson: { verificationStatus, complianceStatus, notes },
      details: `Updated supplier "${before.legal_name}" verification to ${verificationStatus} (${complianceStatus})${notes ? `. Notes: ${notes}` : ""}`
    });
    res.json(updated.rows[0]);
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router9.get("/verification/queue", async (_req, res) => {
  try {
    const encryptionKey = getIdKey();
    const hasGender = await hasPeopleGenderColumn();
    const genderSelect = hasGender ? "p.gender," : "NULL::varchar AS gender,";
    const [peopleRes, docsRes] = await Promise.all([
      query(
        `SELECT p.id,
                p.supplier_id AS "supplierId",
                s.legal_name AS "supplierName",
                s.cipa_uin AS "supplierCipa",
                p.full_name AS "fullName",
                p.person_role AS "personRole",
                p.ownership_percent AS "ownershipPercent",
                p.identity_type AS "identityType",
                ${genderSelect}
                p.nationality,
                p.is_citizen AS "isCitizen",
                p.kyc_status AS "kycStatus",
                p.kyc_verified_at AS "kycVerifiedAt",
                p.kyc_reference AS "kycReference",
                p.created_at AS "createdAt",
                p.updated_at AS "updatedAt",
                CASE WHEN p.national_identity_number_encrypted IS NOT NULL
                     THEN pgp_sym_decrypt(p.national_identity_number_encrypted, $1)
                     ELSE NULL END AS "_rawId"
         FROM supplier_people p
         JOIN suppliers s ON s.id = p.supplier_id
         WHERE p.is_active = TRUE
         ORDER BY
           CASE p.kyc_status
             WHEN 'pending' THEN 0
             WHEN 'not_started' THEN 1
             WHEN 'failed' THEN 2
             ELSE 3
           END,
           p.updated_at DESC`,
        [encryptionKey]
      ),
      query(
        `SELECT d.id AS "documentId",
                v.id AS "versionId",
                d.supplier_id AS "supplierId",
                s.legal_name AS "supplierName",
                s.cipa_uin AS "supplierCipa",
                dt.code AS "documentTypeCode",
                dt.name AS "documentTypeName",
                d.title,
                v.version_no AS "versionNo",
                v.file_name AS "fileName",
                v.mime_type AS "mimeType",
                v.file_size_bytes AS "fileSizeBytes",
                v.document_number AS "documentNumber",
                v.issue_date AS "issueDate",
                v.expiry_date AS "expiryDate",
                v.verification_status AS "verificationStatus",
                v.verified_via AS "verifiedVia",
                v.verified_at AS "verifiedAt",
                v.verification_notes AS "verificationNotes",
                v.rejection_reason AS "rejectionReason",
                v.extraction_confidence AS "extractionConfidence",
                v.sha256,
                v.uploaded_at AS "uploadedAt",
                EXISTS (
                  SELECT 1 FROM document_files f
                  WHERE f.document_version_id = v.id AND octet_length(f.content) > 0
                ) AS "hasFile"
         FROM supplier_documents d
         JOIN document_types dt ON dt.id = d.document_type_id
         JOIN supplier_document_versions v ON v.id = d.current_version_id
         JOIN suppliers s ON s.id = d.supplier_id
         WHERE d.status = 'active'
         ORDER BY
           CASE v.verification_status
             WHEN 'PENDING_VERIFICATION' THEN 0
             WHEN 'UNVERIFIABLE' THEN 1
             WHEN 'REJECTED' THEN 2
             ELSE 3
           END,
           v.uploaded_at DESC`
      )
    ]);
    const docsBySupplier = /* @__PURE__ */ new Map();
    for (const doc of docsRes.rows) {
      const list = docsBySupplier.get(doc.supplierId) || [];
      list.push(doc);
      docsBySupplier.set(doc.supplierId, list);
    }
    const people = peopleRes.rows.map((p) => {
      const rawId = p._rawId || null;
      const idLast4 = rawId ? rawId.slice(-4) : null;
      const hasId = Boolean(rawId);
      let omangValid = null;
      let omangMessage = null;
      if ((p.identityType || "OMANG") === "OMANG" && rawId) {
        const check = validateOmang(rawId, p.gender || void 0);
        omangValid = check.ok;
        omangMessage = check.ok ? null : check.message;
      }
      const { _rawId, ...safePerson } = p;
      return {
        ...safePerson,
        hasId,
        idLast4,
        omangValid,
        omangMessage,
        supportingDocuments: (docsBySupplier.get(p.supplierId) || []).map((d) => ({
          documentId: d.documentId,
          versionId: d.versionId,
          documentTypeCode: d.documentTypeCode,
          documentTypeName: d.documentTypeName,
          title: d.title,
          fileName: d.fileName,
          mimeType: d.mimeType,
          documentNumber: d.documentNumber,
          verificationStatus: d.verificationStatus,
          sha256: d.sha256 || null,
          hasFile: Boolean(d.hasFile),
          uploadedAt: d.uploadedAt
        }))
      };
    });
    res.json({
      people,
      documents: docsRes.rows
    });
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router9.get("/verification/documents/:versionId/file", async (req, res) => {
  try {
    const { versionId } = req.params;
    if (!UUID_REGEX8.test(versionId)) {
      return res.status(400).json({ error: "INVALID_ID", message: "Invalid document version ID." });
    }
    const file = await documentsRepository.getFileForAdmin(versionId);
    if (!file) {
      return res.status(404).json({
        error: "NOT_FOUND",
        message: "No uploaded file bytes found for this document version. Ask the supplier to re-upload the file."
      });
    }
    const isDownload = req.query.download === "1" || req.query.download === "true";
    const dispositionType = isDownload ? "attachment" : "inline";
    const safeFileName = (file.fileName || "document").replace(/[\r\n"\\]/g, "_");
    res.setHeader("Content-Type", file.mimeType || "application/octet-stream");
    res.setHeader("Content-Length", String(file.content.length));
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Cache-Control", "private, no-store, no-cache, must-revalidate");
    res.setHeader("Content-Disposition", `${dispositionType}; filename="${safeFileName}"; filename*=UTF-8''${encodeURIComponent(safeFileName)}`);
    res.send(file.content);
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router9.post("/verification/people/:personId", async (req, res) => {
  try {
    const { personId } = req.params;
    if (!UUID_REGEX8.test(personId)) {
      return res.status(400).json({ error: "INVALID_ID", message: "Invalid director ID." });
    }
    const rawStatus = String(req.body?.status || "").trim().toLowerCase();
    if (!["verified", "failed", "pending"].includes(rawStatus)) {
      return res.status(400).json({ error: "INVALID_STATUS", message: "Status must be verified, failed, or pending." });
    }
    const rawNotes = req.body?.notes !== void 0 && req.body?.notes !== null ? String(req.body.notes).trim().slice(0, 100) : null;
    if (rawStatus === "failed" && !rawNotes) {
      return res.status(400).json({
        error: "REASON_REQUIRED",
        message: "Please provide a reason when rejecting director verification."
      });
    }
    const existing = await query(
      `SELECT id, supplier_id AS "supplierId", full_name AS "fullName"
       FROM supplier_people WHERE id = $1 AND is_active = TRUE LIMIT 1`,
      [personId]
    );
    if (!existing.rows.length) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Director record not found." });
    }
    const updatedRes = await query(
      `UPDATE supplier_people
       SET kyc_status = $2::varchar,
           kyc_verified_at = CASE WHEN $2::varchar = 'verified' THEN NOW() ELSE NULL END,
           kyc_reference = $3::varchar,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, supplier_id AS "supplierId", full_name AS "fullName",
                 kyc_status AS "kycStatus", kyc_verified_at AS "kycVerifiedAt",
                 kyc_reference AS "kycReference"`,
      [personId, rawStatus, rawNotes || (rawStatus === "verified" ? `Verified by ${req.user?.fullName || req.user?.email || "Admin"}`.slice(0, 100) : null)]
    );
    await logAdminAudit(req, {
      action: rawStatus === "verified" ? "ADMIN_VERIFIED_DIRECTOR" : rawStatus === "failed" ? "ADMIN_REJECTED_DIRECTOR" : "ADMIN_RESET_DIRECTOR_KYC",
      entityType: "supplier_person",
      entityId: personId,
      supplierId: existing.rows[0].supplierId,
      details: `Set director ${existing.rows[0].fullName} KYC status to ${rawStatus}${rawNotes ? ` (${rawNotes})` : ""}`
    });
    res.json(updatedRes.rows[0]);
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router9.post("/verification/documents/:versionId", async (req, res) => {
  try {
    const { versionId } = req.params;
    if (!UUID_REGEX8.test(versionId)) {
      return res.status(400).json({ error: "INVALID_ID", message: "Invalid document version ID." });
    }
    const rawStatus = String(req.body?.status || "").trim().toUpperCase();
    if (!["VERIFIED", "REJECTED", "UNVERIFIABLE", "PENDING_VERIFICATION"].includes(rawStatus)) {
      return res.status(400).json({
        error: "INVALID_STATUS",
        message: "Status must be VERIFIED, REJECTED, UNVERIFIABLE, or PENDING_VERIFICATION."
      });
    }
    const notes = req.body?.notes !== void 0 && req.body?.notes !== null ? String(req.body.notes).trim().slice(0, 1e3) : null;
    const rejectionReason = rawStatus === "REJECTED" ? String(req.body?.rejectionReason || req.body?.notes || "").trim().slice(0, 500) : null;
    if (rawStatus === "REJECTED" && !rejectionReason) {
      return res.status(400).json({
        error: "REASON_REQUIRED",
        message: "Please provide a rejection reason for the supplier."
      });
    }
    const existing = await query(
      `SELECT v.id AS "versionId", d.id AS "documentId", d.supplier_id AS "supplierId", d.title
       FROM supplier_document_versions v
       JOIN supplier_documents d ON d.id = v.document_id
       WHERE v.id = $1
       LIMIT 1`,
      [versionId]
    );
    if (!existing.rows.length) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Document version not found." });
    }
    const supplierId = existing.rows[0].supplierId;
    const updatedRes = await query(
      `UPDATE supplier_document_versions
       SET verification_status = $2::varchar,
           verified_via = 'manual',
           verified_by_user_id = $3::uuid,
           verified_at = CASE WHEN $2::varchar = 'VERIFIED' THEN NOW() ELSE NULL END,
           verification_notes = COALESCE($4::varchar, verification_notes),
           rejection_reason = $5::varchar
       WHERE id = $1
       RETURNING id AS "versionId", verification_status AS "verificationStatus",
                 verified_via AS "verifiedVia", verified_at AS "verifiedAt",
                 verification_notes AS "verificationNotes", rejection_reason AS "rejectionReason"`,
      [versionId, rawStatus, req.user.id, notes, rejectionReason]
    );
    try {
      const docSummaryRes = await query(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE UPPER(v.verification_status) = 'VERIFIED')::int AS verified,
                COUNT(*) FILTER (WHERE UPPER(v.verification_status) = 'REJECTED')::int AS rejected
         FROM supplier_documents d
         JOIN supplier_document_versions v ON v.id = d.current_version_id
         WHERE d.supplier_id = $1 AND d.status = 'active'`,
        [supplierId]
      );
      const summary = docSummaryRes.rows[0];
      if (summary && summary.total > 0) {
        if (summary.rejected > 0) {
          await query(
            `UPDATE suppliers SET verification_status = 'rejected', compliance_status = 'Action required', updated_at = NOW() WHERE id = $1`,
            [supplierId]
          );
        } else if (summary.verified === summary.total) {
          await query(
            `UPDATE suppliers SET verification_status = 'verified', compliance_status = 'Fully compliant', verified_at = NOW(), verified_by_user_id = $2, updated_at = NOW() WHERE id = $1`,
            [supplierId, req.user.id]
          );
        } else {
          await query(
            `UPDATE suppliers SET verification_status = 'pending', compliance_status = 'Action required', updated_at = NOW() WHERE id = $1`,
            [supplierId]
          );
        }
      }
      await suppliersRepository.calculateCompleteness(supplierId);
    } catch (syncErr) {
      console.warn("[ADMIN DOC SYNC WARNING]:", syncErr?.message || syncErr);
    }
    await logAdminAudit(req, {
      action: rawStatus === "VERIFIED" ? "ADMIN_VERIFIED_DOCUMENT" : "ADMIN_UPDATED_DOCUMENT_VERIFICATION",
      entityType: "supplier_document_version",
      entityId: versionId,
      supplierId,
      details: `Set document "${existing.rows[0].title}" status to ${rawStatus}${rejectionReason ? ` (${rejectionReason})` : ""}`
    });
    res.json(updatedRes.rows[0]);
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router9.get("/users", async (req, res) => {
  try {
    const search = String(req.query.search || "").trim();
    const filter = String(req.query.filter || "all").toLowerCase();
    const conditions = ["u.deleted_at IS NULL"];
    const params = [];
    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(u.full_name ILIKE $${params.length} OR u.email::text ILIKE $${params.length})`);
    }
    if (filter === "locked") {
      conditions.push(`u.locked_until IS NOT NULL AND u.locked_until > NOW()`);
    } else if (filter === "admins") {
      conditions.push(`u.is_platform_admin = TRUE`);
    } else if (filter === "suspended") {
      conditions.push(`u.status = 'suspended'`);
    }
    const result = await query(
      `SELECT u.id,
              u.full_name AS "fullName",
              u.email::text AS email,
              u.phone,
              u.status,
              u.is_platform_admin AS "isPlatformAdmin",
              u.email_verified_at AS "emailVerifiedAt",
              u.mfa_enabled AS "mfaEnabled",
              u.mfa_type AS "mfaType",
              u.last_login_at AS "lastLoginAt",
              u.failed_login_attempts AS "failedLoginAttempts",
              u.locked_until AS "lockedUntil",
              (u.locked_until IS NOT NULL AND u.locked_until > NOW()) AS "isLocked",
              u.created_at AS "createdAt",
              COALESCE(sess.active_sessions, 0)::int AS "activeSessionsCount",
              COALESCE(org_m.org_name, sup_m.sup_name, CASE WHEN u.is_platform_admin THEN 'Platform Administration' ELSE 'Unassigned' END) AS "tenantName",
              CASE
                WHEN u.is_platform_admin THEN 'Super Admin'
                WHEN org_m.role_name IS NOT NULL THEN org_m.role_name
                WHEN sup_m.role_name IS NOT NULL THEN sup_m.role_name
                ELSE 'User'
              END AS "roleLabel",
              CASE
                WHEN u.is_platform_admin THEN 'platform'
                WHEN org_m.org_name IS NOT NULL THEN 'organization'
                WHEN sup_m.sup_name IS NOT NULL THEN 'supplier'
                ELSE 'none'
              END AS "tenantType"
       FROM users u
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::int AS active_sessions
         FROM sessions s
         WHERE s.user_id = u.id AND s.revoked_at IS NULL AND s.expires_at > NOW()
       ) sess ON TRUE
       LEFT JOIN LATERAL (
         SELECT o.name AS org_name, r.name AS role_name
         FROM organization_members om
         JOIN organizations o ON o.id = om.organization_id
         JOIN roles r ON r.id = om.role_id
         WHERE om.user_id = u.id AND om.status = 'active'
         ORDER BY om.is_owner DESC, om.created_at ASC
         LIMIT 1
       ) org_m ON TRUE
       LEFT JOIN LATERAL (
         SELECT s.legal_name AS sup_name, r.name AS role_name
         FROM supplier_members sm
         JOIN suppliers s ON s.id = sm.supplier_id
         JOIN roles r ON r.id = sm.role_id
         WHERE sm.user_id = u.id AND sm.status = 'active'
         ORDER BY sm.is_owner DESC, sm.created_at ASC
         LIMIT 1
       ) sup_m ON TRUE
       WHERE ${conditions.join(" AND ")}
       ORDER BY (u.locked_until IS NOT NULL AND u.locked_until > NOW()) DESC, u.is_platform_admin DESC, u.created_at DESC
       LIMIT 200`,
      params
    );
    res.json(result.rows);
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router9.post("/users/:id/unlock", async (req, res) => {
  try {
    const { id } = req.params;
    if (!UUID_REGEX8.test(id)) {
      return res.status(400).json({ error: "INVALID_ID", message: "Invalid user ID." });
    }
    const updated = await query(
      `UPDATE users
       SET failed_login_attempts = 0,
           locked_until = NULL,
           updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id, full_name AS "fullName", email::text AS email, status,
                 failed_login_attempts AS "failedLoginAttempts", locked_until AS "lockedUntil"`,
      [id]
    );
    if (!updated.rows.length) {
      return res.status(404).json({ error: "NOT_FOUND", message: "User not found." });
    }
    await query(
      `DELETE FROM login_attempts
       WHERE LOWER(email_norm) = LOWER($1)
         AND succeeded = FALSE
         AND attempted_at > NOW() - INTERVAL '15 minutes'`,
      [updated.rows[0].email]
    ).catch(() => {
    });
    await logAdminAudit(req, {
      action: "ADMIN_UNLOCKED_USER",
      entityType: "user",
      entityId: id,
      details: `Unlocked locked user account ${updated.rows[0].email} and cleared failed login attempts.`
    });
    res.json({ ...updated.rows[0], isLocked: false });
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router9.post("/users/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    if (!UUID_REGEX8.test(id)) {
      return res.status(400).json({ error: "INVALID_ID", message: "Invalid user ID." });
    }
    const status = String(req.body?.status || "").trim().toLowerCase();
    if (!["active", "suspended"].includes(status)) {
      return res.status(400).json({ error: "INVALID_STATUS", message: "Status must be active or suspended." });
    }
    if (id === req.user.id && status === "suspended") {
      return res.status(400).json({ error: "SELF_SUSPEND_BLOCKED", message: "You cannot suspend your own administrator account." });
    }
    const updated = await query(
      `UPDATE users
       SET status = $2,
           updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id, full_name AS "fullName", email::text AS email, status`,
      [id, status]
    );
    if (!updated.rows.length) {
      return res.status(404).json({ error: "NOT_FOUND", message: "User not found." });
    }
    let revokedCount = 0;
    if (status === "suspended") {
      const rev = await query(
        `UPDATE sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL RETURNING id`,
        [id]
      );
      revokedCount = rev.rows.length;
    }
    await logAdminAudit(req, {
      action: status === "suspended" ? "ADMIN_SUSPENDED_USER" : "ADMIN_ACTIVATED_USER",
      entityType: "user",
      entityId: id,
      details: `${status === "suspended" ? "Suspended" : "Activated"} user account ${updated.rows[0].email}${revokedCount > 0 ? ` and revoked ${revokedCount} active session(s)` : ""}.`
    });
    res.json({ ...updated.rows[0], revokedSessions: revokedCount });
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router9.post("/users/:id/revoke-sessions", async (req, res) => {
  try {
    const { id } = req.params;
    if (!UUID_REGEX8.test(id)) {
      return res.status(400).json({ error: "INVALID_ID", message: "Invalid user ID." });
    }
    const userRes = await query(
      `SELECT id, email::text AS email FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    if (!userRes.rows.length) {
      return res.status(404).json({ error: "NOT_FOUND", message: "User not found." });
    }
    const revRes = await query(
      `UPDATE sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL RETURNING id`,
      [id]
    );
    await logAdminAudit(req, {
      action: "ADMIN_REVOKED_USER_SESSIONS",
      entityType: "user",
      entityId: id,
      details: `Revoked ${revRes.rows.length} active session(s) for user ${userRes.rows[0].email}.`
    });
    res.json({ userId: id, revokedCount: revRes.rows.length });
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router9.get("/risk", async (_req, res) => {
  try {
    const [flagsRes, debarmentsRes] = await Promise.all([
      query(
        `SELECT rf.id,
                rf.supplier_id AS "supplierId",
                s.legal_name AS "supplierName",
                s.cipa_uin AS "supplierCipa",
                rf.call_id AS "callId",
                c.reference_no AS "callRef",
                o.name AS "organizationName",
                rf.flag_type AS "flagType",
                rf.severity,
                rf.details,
                rf.status,
                rf.reviewed_at AS "reviewedAt",
                u.full_name AS "reviewedByName",
                rf.created_at AS "createdAt"
         FROM risk_flags rf
         JOIN suppliers s ON s.id = rf.supplier_id
         LEFT JOIN calls c ON c.id = rf.call_id
         LEFT JOIN organizations o ON o.id = c.organization_id
         LEFT JOIN users u ON u.id = rf.reviewed_by_user_id
         ORDER BY CASE rf.status WHEN 'open' THEN 0 WHEN 'reviewed' THEN 1 ELSE 2 END,
                  CASE rf.severity WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
                  rf.created_at DESC`
      ),
      query(
        `SELECT d.id,
                d.supplier_id AS "supplierId",
                s.legal_name AS "entityName",
                s.cipa_uin AS "cipaNumber",
                d.organization_id AS "organizationId",
                COALESCE(o.name, 'Platform-wide (All Procuring Entities)') AS "scope",
                d.reason,
                d.starts_on AS "startsOn",
                d.ends_on AS "endsOn",
                d.evidence_ref AS "evidenceRef",
                d.lifted_at AS "liftedAt",
                (d.lifted_at IS NULL AND d.starts_on <= CURRENT_DATE AND (d.ends_on IS NULL OR d.ends_on >= CURRENT_DATE)) AS "isActive",
                u.full_name AS "issuedBy",
                d.created_at AS "createdAt"
         FROM debarments d
         JOIN suppliers s ON s.id = d.supplier_id
         LEFT JOIN organizations o ON o.id = d.organization_id
         LEFT JOIN users u ON u.id = d.created_by_user_id
         ORDER BY (d.lifted_at IS NULL) DESC, d.created_at DESC`
      )
    ]);
    res.json({
      flags: flagsRes.rows,
      debarments: debarmentsRes.rows
    });
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router9.post("/risk/flags", async (req, res) => {
  try {
    const { supplierId, flagType, severity, description, callId } = req.body || {};
    if (!supplierId || !UUID_REGEX8.test(supplierId)) {
      return res.status(400).json({ error: "INVALID_SUPPLIER", message: "Valid supplierId is required." });
    }
    const allowedFlagTypes = ["shared_director", "shared_address", "shared_phone", "duplicate_document", "price_pattern", "other"];
    const normFlagType = allowedFlagTypes.includes(String(flagType || "").toLowerCase()) ? String(flagType).toLowerCase() : "other";
    const normSeverity = ["low", "medium", "high"].includes(String(severity || "").toLowerCase()) ? String(severity).toLowerCase() : "medium";
    const desc = String(description || "").trim().slice(0, 1e3);
    if (!desc) {
      return res.status(400).json({ error: "DESCRIPTION_REQUIRED", message: "Flag description is required." });
    }
    const safeCallId = callId && UUID_REGEX8.test(callId) ? callId : null;
    const supRes = await query(`SELECT legal_name FROM suppliers WHERE id = $1 AND deleted_at IS NULL`, [supplierId]);
    if (!supRes.rows.length) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Supplier not found." });
    }
    const ins = await query(
      `INSERT INTO risk_flags (supplier_id, call_id, flag_type, severity, details, status)
       VALUES ($1, $2, $3, $4, $5::jsonb, 'open')
       RETURNING id, supplier_id AS "supplierId", flag_type AS "flagType", severity, details, status, created_at AS "createdAt"`,
      [supplierId, safeCallId, normFlagType, normSeverity, JSON.stringify({ description: desc })]
    );
    await logAdminAudit(req, {
      action: "ADMIN_CREATED_RISK_FLAG",
      entityType: "risk_flag",
      entityId: ins.rows[0].id,
      supplierId,
      details: `Flagged supplier "${supRes.rows[0].legal_name}" (${normSeverity} ${normFlagType}): ${desc}`
    });
    res.status(201).json(ins.rows[0]);
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router9.post("/risk/flags/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    if (!UUID_REGEX8.test(id)) {
      return res.status(400).json({ error: "INVALID_ID", message: "Invalid risk flag ID." });
    }
    const status = String(req.body?.status || "").trim().toLowerCase();
    if (!["open", "reviewed", "dismissed", "resolved"].includes(status)) {
      return res.status(400).json({ error: "INVALID_STATUS", message: "Status must be open, reviewed, dismissed, or resolved." });
    }
    const updated = await query(
      `UPDATE risk_flags
       SET status = $2,
           reviewed_by_user_id = $3,
           reviewed_at = NOW()
       WHERE id = $1
       RETURNING id, supplier_id AS "supplierId", flag_type AS "flagType", severity, status, reviewed_at AS "reviewedAt"`,
      [id, status, req.user.id]
    );
    if (!updated.rows.length) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Risk flag not found." });
    }
    await logAdminAudit(req, {
      action: "ADMIN_UPDATED_RISK_FLAG",
      entityType: "risk_flag",
      entityId: id,
      supplierId: updated.rows[0].supplierId,
      details: `Updated risk flag (${updated.rows[0].flagType}) status to ${status}.`
    });
    res.json(updated.rows[0]);
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router9.post("/debarments", async (req, res) => {
  try {
    const { supplierId, organizationId, reason, startsOn, endsOn, evidenceRef } = req.body || {};
    if (!supplierId || !UUID_REGEX8.test(supplierId)) {
      return res.status(400).json({ error: "INVALID_SUPPLIER", message: "Valid supplierId is required." });
    }
    const cleanReason = String(reason || "").trim().slice(0, 1e3);
    if (!cleanReason || cleanReason.length < 5) {
      return res.status(400).json({ error: "REASON_REQUIRED", message: "Debarment reason (at least 5 characters) is required." });
    }
    const safeOrgId = organizationId && UUID_REGEX8.test(organizationId) ? organizationId : null;
    const effectiveStart = startsOn && /^\d{4}-\d{2}-\d{2}$/.test(String(startsOn)) ? String(startsOn) : (/* @__PURE__ */ new Date()).toISOString().slice(0, 10);
    const effectiveEnd = endsOn && /^\d{4}-\d{2}-\d{2}$/.test(String(endsOn)) ? String(endsOn) : null;
    const cleanEvidence = evidenceRef ? String(evidenceRef).trim().slice(0, 255) : null;
    const supRes = await query(`SELECT legal_name FROM suppliers WHERE id = $1 AND deleted_at IS NULL`, [supplierId]);
    if (!supRes.rows.length) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Supplier not found." });
    }
    const ins = await query(
      `INSERT INTO debarments (organization_id, supplier_id, reason, starts_on, ends_on, evidence_ref, created_by_user_id)
       VALUES ($1, $2, $3, $4::date, $5::date, $6, $7)
       RETURNING id, organization_id AS "organizationId", supplier_id AS "supplierId",
                 reason, starts_on AS "startsOn", ends_on AS "endsOn",
                 evidence_ref AS "evidenceRef", lifted_at AS "liftedAt", created_at AS "createdAt"`,
      [safeOrgId, supplierId, cleanReason, effectiveStart, effectiveEnd, cleanEvidence, req.user.id]
    );
    await logAdminAudit(req, {
      action: "ADMIN_APPLIED_DEBARMENT",
      entityType: "debarment",
      entityId: ins.rows[0].id,
      supplierId,
      organizationId: safeOrgId,
      details: `Applied ${effectiveEnd ? `temporary debarment (${effectiveStart} to ${effectiveEnd})` : `permanent debarment (from ${effectiveStart})`} on "${supRes.rows[0].legal_name}". Reason: ${cleanReason}`
    });
    res.status(201).json(ins.rows[0]);
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router9.post("/debarments/:id/lift", async (req, res) => {
  try {
    const { id } = req.params;
    if (!UUID_REGEX8.test(id)) {
      return res.status(400).json({ error: "INVALID_ID", message: "Invalid debarment ID." });
    }
    const liftReason = req.body?.reason ? String(req.body.reason).trim().slice(0, 500) : "Debarment lifted by platform administrator";
    const existing = await query(
      `SELECT d.id, d.supplier_id AS "supplierId", s.legal_name AS "legalName"
       FROM debarments d
       JOIN suppliers s ON s.id = d.supplier_id
       WHERE d.id = $1`,
      [id]
    );
    if (!existing.rows.length) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Debarment record not found." });
    }
    const updated = await query(
      `UPDATE debarments
       SET lifted_at = NOW()
       WHERE id = $1
       RETURNING id, supplier_id AS "supplierId", lifted_at AS "liftedAt"`,
      [id]
    );
    await logAdminAudit(req, {
      action: "ADMIN_LIFTED_DEBARMENT",
      entityType: "debarment",
      entityId: id,
      supplierId: existing.rows[0].supplierId,
      details: `Lifted debarment order for supplier "${existing.rows[0].legalName}". Note: ${liftReason}`
    });
    res.json(updated.rows[0]);
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router9.get("/catalogues", async (_req, res) => {
  try {
    const [categories, documentTypes] = await Promise.all([
      referenceRepository.listAllCategoriesAdmin(),
      referenceRepository.listAllDocumentTypesAdmin()
    ]);
    res.json({ categories, documentTypes });
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router9.post("/catalogues/categories", async (req, res) => {
  try {
    const { code, name, description, parentId, level, sortOrder } = req.body || {};
    if (!code || !String(code).trim() || !name || !String(name).trim()) {
      return res.status(400).json({ error: "INVALID_INPUT", message: "Category code and name are required." });
    }
    if (parentId && !UUID_REGEX8.test(parentId)) {
      return res.status(400).json({ error: "INVALID_PARENT", message: "Invalid parentId." });
    }
    const created = await referenceRepository.createCategory({ code, name, description, parentId, level, sortOrder });
    await logAdminAudit(req, {
      action: "ADMIN_CREATED_CATEGORY",
      entityType: "category",
      entityId: created.id,
      details: `Created procurement category ${created.code} \u2014 ${created.name}.`
    });
    res.status(201).json(created);
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router9.put("/catalogues/categories/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!UUID_REGEX8.test(id)) {
      return res.status(400).json({ error: "INVALID_ID", message: "Invalid category ID." });
    }
    const updated = await referenceRepository.updateCategory(id, req.body || {});
    if (!updated) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Category not found." });
    }
    await logAdminAudit(req, {
      action: "ADMIN_UPDATED_CATEGORY",
      entityType: "category",
      entityId: id,
      details: `Updated procurement category ${updated.code} \u2014 ${updated.name} (active: ${updated.isActive}).`
    });
    res.json(updated);
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router9.post("/catalogues/document-types", async (req, res) => {
  try {
    const { code, name, description, issuingAuthority, requiresExpiry, requiresNumber, defaultValidityDays, verificationMethod, isMandatoryDefault, sortOrder } = req.body || {};
    if (!code || !String(code).trim() || !name || !String(name).trim()) {
      return res.status(400).json({ error: "INVALID_INPUT", message: "Document type code and name are required." });
    }
    const created = await referenceRepository.createDocumentType({
      code,
      name,
      description,
      issuingAuthority,
      requiresExpiry,
      requiresNumber,
      defaultValidityDays: defaultValidityDays ? Number(defaultValidityDays) : null,
      verificationMethod,
      isMandatoryDefault,
      sortOrder
    });
    await logAdminAudit(req, {
      action: "ADMIN_CREATED_DOCUMENT_TYPE",
      entityType: "document_type",
      entityId: created.id,
      details: `Created compliance document type ${created.code} \u2014 ${created.name}.`
    });
    res.status(201).json(created);
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router9.put("/catalogues/document-types/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!UUID_REGEX8.test(id)) {
      return res.status(400).json({ error: "INVALID_ID", message: "Invalid document type ID." });
    }
    const updated = await referenceRepository.updateDocumentType(id, req.body || {});
    if (!updated) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Document type not found." });
    }
    await logAdminAudit(req, {
      action: "ADMIN_UPDATED_DOCUMENT_TYPE",
      entityType: "document_type",
      entityId: id,
      details: `Updated compliance document type ${updated.code} \u2014 ${updated.name} (active: ${updated.isActive}).`
    });
    res.json(updated);
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router9.get("/billing", async (_req, res) => {
  try {
    const [plansRes, invoicesRes] = await Promise.all([
      query(
        `SELECT p.id, p.code, p.name, p.audience, p.price, p.currency,
                p.billing_interval AS "billingInterval", p.max_users AS "maxUsers",
                p.max_calls_per_year AS "maxCallsPerYear", p.features, p.sort_order AS "sortOrder",
                COUNT(sub.id) FILTER (WHERE sub.status = 'active')::int AS "subscribersCount"
         FROM plans p
         LEFT JOIN subscriptions sub ON sub.plan_id = p.id
         WHERE p.is_active = TRUE
         GROUP BY p.id
         ORDER BY p.sort_order ASC, p.name ASC`
      ),
      query(
        `SELECT pi.id,
                pi.invoice_no AS "invoiceNumber",
                COALESCE(o.name, s.legal_name, 'Tenant') AS "orgName",
                pi.total::numeric AS "amountBWP",
                pi.currency,
                pi.status,
                pi.issued_at AS "issuedAt",
                pi.due_at AS "dueDate",
                pi.paid_at AS "paidAt",
                pi.created_at AS "createdAt"
         FROM platform_invoices pi
         LEFT JOIN organizations o ON o.id = pi.organization_id
         LEFT JOIN suppliers s ON s.id = pi.supplier_id
         ORDER BY pi.created_at DESC
         LIMIT 100`
      )
    ]);
    res.json({
      plans: plansRes.rows.map((p) => ({ ...p, price: Number(p.price) || 0 })),
      invoices: invoicesRes.rows.map((i) => ({ ...i, amountBWP: Number(i.amountBWP) || 0 }))
    });
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router9.put("/billing/plans/:id", async (req, res) => {
  try {
    const { id } = req.params;
    if (!UUID_REGEX8.test(id)) {
      return res.status(400).json({ error: "INVALID_ID", message: "Invalid plan ID." });
    }
    const { price, maxCallsPerYear, description, reason } = req.body || {};
    const numPrice = price !== void 0 ? Number(price) : void 0;
    if (numPrice !== void 0 && (isNaN(numPrice) || numPrice < 0)) {
      return res.status(400).json({ error: "INVALID_PRICE", message: "Price must be a non-negative number." });
    }
    const updated = await referenceRepository.updatePlan(id, {
      price: numPrice,
      maxCallsPerYear: maxCallsPerYear !== void 0 ? maxCallsPerYear === null ? null : Number(maxCallsPerYear) : void 0,
      features: description !== void 0 ? { description: String(description).trim() } : void 0
    });
    if (!updated) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Plan not found." });
    }
    await logAdminAudit(req, {
      action: "ADMIN_UPDATED_PLAN_PRICING",
      entityType: "plan",
      entityId: id,
      details: `Updated plan "${updated.name}" rate to ${updated.currency} ${Number(updated.price).toLocaleString()}${reason ? ` (${String(reason).trim()})` : ""}.`
    });
    res.json(updated);
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router9.get("/notifications", async (_req, res) => {
  try {
    const resRows = await query(
      `SELECT id,
              channel,
              recipient,
              COALESCE(template_code, 'System notification') AS "templateCode",
              status,
              error_message AS "errorMessage",
              retry_count AS "retryCount",
              COALESCE(sent_at, queued_at) AS "sentAt"
       FROM message_deliveries
       ORDER BY queued_at DESC
       LIMIT 100`
    );
    res.json(resRows.rows);
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router9.post("/notifications/:id/retry", async (req, res) => {
  try {
    const { id } = req.params;
    if (!UUID_REGEX8.test(id)) {
      return res.status(400).json({ error: "INVALID_ID", message: "Invalid delivery ID." });
    }
    const updated = await query(
      `UPDATE message_deliveries
       SET status = 'queued',
           retry_count = retry_count + 1,
           error_message = NULL,
           sent_at = NOW()
       WHERE id = $1
       RETURNING id, channel, recipient, COALESCE(template_code, 'System notification') AS "templateCode",
                 status, retry_count AS "retryCount", sent_at AS "sentAt"`,
      [id]
    );
    if (!updated.rows.length) {
      return res.status(404).json({ error: "NOT_FOUND", message: "Delivery record not found." });
    }
    await logAdminAudit(req, {
      action: "ADMIN_RETRIED_NOTIFICATION",
      entityType: "message_delivery",
      entityId: id,
      details: `Queued retry #${updated.rows[0].retryCount} for ${updated.rows[0].channel} delivery to ${updated.rows[0].recipient}.`
    });
    res.json(updated.rows[0]);
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router9.get("/audit-log", async (req, res) => {
  try {
    const events = await auditRepository.listEvents({
      entityType: req.query.entityType ? String(req.query.entityType) : void 0,
      actor: req.query.actor ? String(req.query.actor) : void 0,
      action: req.query.action ? String(req.query.action) : void 0,
      search: req.query.search ? String(req.query.search) : void 0,
      fromDate: req.query.fromDate ? String(req.query.fromDate) : void 0,
      toDate: req.query.toDate ? String(req.query.toDate) : void 0,
      limit: req.query.limit ? Number(req.query.limit) : 150
    });
    res.json(
      events.map((e) => ({
        ...e,
        timestamp: e.occurredAt ? new Date(e.occurredAt).toLocaleString("en-BW", {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        }) : "\u2014"
      }))
    );
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router9.get("/audit-log/verify", async (_req, res) => {
  try {
    const result = await auditRepository.verifyChain();
    res.json(result);
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router9.post("/support/sessions", async (req, res) => {
  try {
    const { targetType, targetId, targetName, ticketRef, justification } = req.body || {};
    const cleanTicket = String(ticketRef || "").trim().slice(0, 100);
    const cleanJustification = String(justification || "").trim().slice(0, 500);
    const cleanTargetName = String(targetName || "").trim().slice(0, 200);
    if (!cleanTicket || cleanJustification.length < 10 || !cleanTargetName) {
      return res.status(400).json({
        error: "INVALID_INPUT",
        message: "Ticket reference, target entity, and justification (min 10 chars) are required."
      });
    }
    const entityType = targetType === "Supplier" ? "supplier" : "organization";
    const safeTargetId = targetId && UUID_REGEX8.test(targetId) ? targetId : null;
    await logAdminAudit(req, {
      action: "ADMIN_SUPPORT_SESSION_STARTED",
      entityType,
      entityId: safeTargetId,
      organizationId: entityType === "organization" ? safeTargetId : null,
      supplierId: entityType === "supplier" ? safeTargetId : null,
      details: `Support diagnostic session authorized for ${cleanTargetName} (${cleanTicket}): ${cleanJustification}`
    });
    res.status(201).json({ ok: true, targetName: cleanTargetName, ticketRef: cleanTicket });
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router9.get("/settings", async (_req, res) => {
  try {
    const rows = await query(
      `SELECT config_key AS "configKey", config_value AS "configValue"
       FROM platform_financial_configs
       WHERE config_key IN ('cipa_gateway_url', 'burs_gateway_url', 'statutory_retention_years')
       ORDER BY created_at DESC`
    );
    const map = /* @__PURE__ */ new Map();
    for (const r of rows.rows) {
      if (!map.has(r.configKey)) {
        map.set(r.configKey, r.configValue);
      }
    }
    res.json({
      cipaEndpoint: map.get("cipa_gateway_url")?.url || "https://api.cipa.gov.bw/v2/registry",
      bursEndpoint: map.get("burs_gateway_url")?.url || "https://etax.burs.org.bw/gateway/api",
      retentionYears: String(map.get("statutory_retention_years")?.years || "7")
    });
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router9.put("/settings", async (req, res) => {
  try {
    const cipaEndpoint = String(req.body?.cipaEndpoint || "").trim().slice(0, 300);
    const bursEndpoint = String(req.body?.bursEndpoint || "").trim().slice(0, 300);
    const retentionYears = String(req.body?.retentionYears || "7").trim();
    if (!["7", "10", "15"].includes(retentionYears)) {
      return res.status(400).json({ error: "INVALID_RETENTION", message: "Retention period must be 7, 10, or 15 years." });
    }
    for (const [label, val] of [["CIPA endpoint", cipaEndpoint], ["BURS endpoint", bursEndpoint]]) {
      try {
        const parsed = new URL(val);
        if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
          return res.status(400).json({ error: "INVALID_URL", message: `${label} must be a valid HTTP(S) URL.` });
        }
      } catch {
        return res.status(400).json({ error: "INVALID_URL", message: `${label} must be a valid URL.` });
      }
    }
    const entries = [
      ["cipa_gateway_url", { url: cipaEndpoint }, "CIPA Companies Registry Gateway URL"],
      ["burs_gateway_url", { url: bursEndpoint }, "BURS e-Tax Verification Gateway URL"],
      ["statutory_retention_years", { years: Number(retentionYears) }, "Statutory tender dossier retention period (years)"]
    ];
    for (const [key, val, desc] of entries) {
      const existing = await query(
        `SELECT id FROM platform_financial_configs WHERE config_key = $1 ORDER BY created_at DESC LIMIT 1`,
        [key]
      );
      if (existing.rows.length) {
        await query(
          `UPDATE platform_financial_configs SET config_value = $2::jsonb, description = $3 WHERE id = $1`,
          [existing.rows[0].id, JSON.stringify(val), desc]
        );
      } else {
        await query(
          `INSERT INTO platform_financial_configs (config_key, config_value, description, effective_from)
           VALUES ($1, $2::jsonb, $3, CURRENT_DATE)`,
          [key, JSON.stringify(val), desc]
        );
      }
    }
    await logAdminAudit(req, {
      action: "ADMIN_UPDATED_PLATFORM_SETTINGS",
      entityType: "platform_config",
      details: `Updated platform settings: retention=${retentionYears}y, CIPA=${cipaEndpoint}, BURS=${bursEndpoint}.`
    });
    res.json({ cipaEndpoint, bursEndpoint, retentionYears });
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

// server/routes/notifications.routes.ts
import { Router as Router10 } from "express";
var router10 = Router10();
router10.use(requireAuth);
router10.get("/", async (req, res) => {
  try {
    const tenantType = req.activeTenant?.tenantType;
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const list = await notificationsRepository.listForUser(req.user.id, tenantType, limit);
    res.json(list);
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router10.post("/read-all", async (req, res) => {
  try {
    const count = await notificationsRepository.markAllRead(req.user.id);
    res.json({ success: true, updatedCount: count });
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router10.post("/:id/read", async (req, res) => {
  try {
    const ok = await notificationsRepository.markRead(req.params.id, req.user.id);
    if (!ok) {
      res.status(404).json({ error: "NOT_FOUND", message: "Notification not found." });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
var notificationsRouter = router10;

// server/app.ts
var app = express();
app.set("etag", false);
app.use("/api", (req, res, next) => {
  if (req.path !== "/health") {
    const s = secretsGuardStatus();
    if (!s.ok) {
      res.setHeader("Cache-Control", "no-store");
      res.status(503).json({ error: "config", reason: s.reason });
      return;
    }
    const g = guardStatus();
    if (!g.ok) {
      console.error("[db-guard] Request blocked:", g.reason);
      res.setHeader("Cache-Control", "no-store");
      res.status(503).json({
        error: "DATABASE_GUARD_FAILED",
        message: "Service temporarily unavailable."
      });
      return;
    }
  }
  next();
});
app.use((req, res, next) => {
  const unprefixedApi = req.path.startsWith("/reference") || req.path.startsWith("/auth") || req.path.startsWith("/supplier") || req.path.startsWith("/calls") || req.path.startsWith("/buyer") || req.path.startsWith("/audit") || req.path.startsWith("/bootstrap") || req.path.startsWith("/debug") || req.path.startsWith("/admin") || req.path.startsWith("/notifications");
  if (unprefixedApi) {
    const s = secretsGuardStatus();
    if (!s.ok) {
      res.setHeader("Cache-Control", "no-store");
      res.status(503).json({ error: "config", reason: s.reason });
      return;
    }
    const g = guardStatus();
    if (!g.ok) {
      console.error("[db-guard] Request blocked:", g.reason);
      res.setHeader("Cache-Control", "no-store");
      res.status(503).json({
        error: "DATABASE_GUARD_FAILED",
        message: "Service temporarily unavailable."
      });
      return;
    }
  }
  next();
});
app.use((req, res, next) => {
  res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
  res.setHeader("Access-Control-Allow-Credentials", "true");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, PATCH, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Origin, Accept");
  if (req.path.startsWith("/api") || req.path.startsWith("/auth") || req.path.startsWith("/supplier") || req.path.startsWith("/bootstrap") || req.path.startsWith("/buyer") || req.path.startsWith("/reference") || req.path.startsWith("/calls") || req.path.startsWith("/audit") || req.path.startsWith("/admin") || req.path.startsWith("/notifications")) {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
    res.setHeader("Surrogate-Control", "no-store");
  }
  if (req.method === "OPTIONS") {
    res.status(200).end();
    return;
  }
  next();
});
app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());
app.use("/api", generalApiRateLimiter);
app.use(["/reference", "/auth", "/supplier", "/calls", "/buyer", "/audit", "/bootstrap", "/debug", "/admin", "/notifications"], generalApiRateLimiter);
app.use(csrfProtection);
app.use(authenticate);
app.get(["/api/health", "/health"], async (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const s = secretsGuardStatus();
  const secrets = getSecretsHealth();
  const g = guardStatus();
  if (!g.ok) {
    console.error("[db-guard] Health check blocked:", g.reason);
    res.status(503).json({
      ok: false,
      error: "DATABASE_GUARD_FAILED",
      secrets,
      db: "blocked"
    });
    return;
  }
  try {
    const [dbRes, countsRes] = await Promise.all([
      query("SELECT current_database() AS db"),
      query(`
        SELECT
          (SELECT COUNT(*)::int FROM categories WHERE is_active = TRUE) AS categories,
          (SELECT COUNT(*)::int FROM procurement_disciplines WHERE is_active = TRUE) AS disciplines,
          (SELECT COUNT(*)::int FROM geographic_districts WHERE is_active = TRUE) AS districts,
          (SELECT COUNT(*)::int FROM document_types WHERE is_active = TRUE) AS "documentTypes"
      `)
    ]);
    const dbName = dbRes.rows[0]?.db;
    const counts = countsRes.rows[0] || {
      categories: 0,
      disciplines: 0,
      districts: 0,
      documentTypes: 0
    };
    const allOk = s.ok;
    res.status(allOk ? 200 : 503).json({
      ok: allOk,
      config: { ok: s.ok },
      secrets,
      db: "reachable",
      database: dbName,
      refs: counts
    });
  } catch (err) {
    if (err instanceof DbGuardError || err?.code === "DB_GUARD") {
      console.error("[db-guard] Health check blocked:", err.reason || "db_name_mismatch");
      res.status(503).json({
        ok: false,
        error: "DATABASE_GUARD_FAILED",
        secrets,
        db: "blocked"
      });
      return;
    }
    res.status(503).json({
      ok: false,
      config: { ok: s.ok },
      secrets,
      db: "unreachable"
    });
  }
});
app.use("/api/reference", referenceRouter);
app.use("/api/auth", authEndpointRateLimiter, authRouter);
app.use("/api/supplier", supplierRouter);
app.use("/api/calls", callsRouter);
app.use("/api/buyer", buyerRouter);
app.use("/api/audit", auditRouter);
app.use("/api/bootstrap", bootstrapRouter);
app.use("/api/debug", debugRouter);
app.use("/api/admin", router9);
app.use("/api/notifications", notificationsRouter);
app.use("/reference", referenceRouter);
app.use("/auth", authEndpointRateLimiter, authRouter);
app.use("/supplier", supplierRouter);
app.use("/calls", callsRouter);
app.use("/buyer", buyerRouter);
app.use("/audit", auditRouter);
app.use("/bootstrap", bootstrapRouter);
app.use("/debug", debugRouter);
app.use("/admin", router9);
app.use("/notifications", notificationsRouter);
app.use((err, _req, res, _next) => {
  console.error("[EXPRESS UNHANDLED ERROR]:", err);
  if (err instanceof ConfigSecretError || err?.code === "CONFIG_SECRET") {
    res.setHeader("Cache-Control", "no-store");
    res.status(503).json({
      error: "config",
      reason: err.reason || "config_invalid"
    });
    return;
  }
  if (err instanceof DbGuardError || err?.code === "DB_GUARD") {
    console.error("[db-guard] Request error blocked:", err.reason || "guard_blocked");
    res.setHeader("Cache-Control", "no-store");
    res.status(503).json({
      error: "DATABASE_GUARD_FAILED",
      message: "Service temporarily unavailable."
    });
    return;
  }
  if (err.code === "DATABASE_UNAVAILABLE" || err.status === 503) {
    res.setHeader("Cache-Control", "no-store");
    res.status(503).json({
      error: "SERVICE_UNAVAILABLE",
      message: "Database service is temporarily unreachable. Please try again shortly."
    });
    return;
  }
  res.status(err.status || 500).json({
    error: err.code || "INTERNAL_ERROR",
    message: err.message || "An unexpected error occurred."
  });
});
var app_default = app;
export {
  app,
  app_default as default
};
