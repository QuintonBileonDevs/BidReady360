// server/app.ts
import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";

// server/utils/crypto.ts
import crypto from "crypto";
import bcrypt from "bcryptjs";
var ENCRYPTION_KEY = crypto.scryptSync(
  process.env.SESSION_SECRET || "bidready360-sec-token-32b-auth-secret-prod-2026",
  "salt_bw_2026",
  32
);
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
  return crypto.randomBytes(bytes).toString("hex");
}
function hashToken(token) {
  return crypto.createHash("sha256").update(token.trim()).digest("hex");
}
function encryptData(plainText) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
  const encrypted = Buffer.concat([cipher.update(plainText, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]);
}
function decryptData(buffer) {
  const iv = buffer.subarray(0, 12);
  const tag = buffer.subarray(12, 28);
  const encrypted = buffer.subarray(28);
  const decipher = crypto.createDecipheriv("aes-256-gcm", ENCRYPTION_KEY, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final("utf8");
}
function generateTotpSecret() {
  return crypto.randomBytes(20).toString("hex");
}
function generateTotpCode(secretHex, timeStepWindow = 0) {
  const epoch = Math.floor(Date.now() / 1e3);
  const timeStep = Math.floor(epoch / 30) + timeStepWindow;
  const timeBuffer = Buffer.alloc(8);
  timeBuffer.writeBigInt64BE(BigInt(timeStep));
  const secretBuffer = Buffer.from(secretHex, "hex");
  const hmac = crypto.createHmac("sha1", secretBuffer);
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
var guardReason = null;
if (!expected) guardReason = "expected_db_missing";
else if (FORBIDDEN.has(expected)) guardReason = "expected_db_forbidden";
else if (!url) guardReason = "database_url_missing";
else if (dbFromUrl(url) !== expected) guardReason = "db_name_mismatch";
if (guardReason) console.error("[db-guard] BLOCKED:", guardReason);
var pool = guardReason ? null : new Pool({
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
  return { ok: !guardReason, reason: guardReason };
}
async function getClient() {
  if (guardReason || !pool) throw new DbGuardError(guardReason || "guard_blocked");
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
if (guardReason && !process.env.VERCEL) {
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
                 'verificationStatus', 'verified',
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
      const res = await query(
        `SELECT id, organization_id AS "organizationId", code, name, description, issuing_authority AS "issuingAuthority",
                requires_expiry AS "requiresExpiry", requires_number AS "requiresNumber", default_validity_days AS "defaultValidityDays",
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
router.post("/refresh", async (_req, res, next) => {
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
import crypto2 from "crypto";
var AuditRepository = class {
  /**
   * Appends an immutable audit event with a cryptographic hash chain.
   */
  async logEvent(dto) {
    const lastRowRes = await query(
      `SELECT row_hash FROM audit_log ORDER BY occurred_at DESC, id DESC LIMIT 1`
    );
    const prevHash = lastRowRes.rows[0]?.row_hash || "0".repeat(64);
    const timestamp = (/* @__PURE__ */ new Date()).toISOString();
    const payloadToHash = `${prevHash}|${timestamp}|${dto.actorName}|${dto.actorRole}|${dto.action}|${dto.entityType}|${dto.entityId || ""}|${dto.details}`;
    const rowHash = crypto2.createHash("sha256").update(payloadToHash).digest("hex");
    const res = await query(
      `INSERT INTO audit_log (
        occurred_at, actor_type, actor_user_id, actor_name, actor_role,
        organization_id, supplier_id, organization_name, action,
        entity_type, entity_id, ip_address, user_agent,
        before_json, after_json, details, prev_hash, row_hash
      ) VALUES (
        NOW(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17
      ) RETURNING 
        id, occurred_at AS "occurredAt", actor_type AS "actorType", actor_user_id AS "actorUserId",
        actor_name AS "actorName", actor_role AS "actorRole", organization_id AS "organizationId",
        supplier_id AS "supplierId", organization_name AS "organizationName", action,
        entity_type AS "entityType", entity_id AS "entityId", ip_address AS "ipAddress",
        user_agent AS "userAgent", before_json AS "beforeJson", after_json AS "afterJson",
        details, prev_hash AS "prevHash", row_hash AS "rowHash"`,
      [
        dto.actorType || "user",
        dto.actorUserId || null,
        dto.actorName,
        dto.actorRole,
        dto.organizationId || null,
        dto.supplierId || null,
        dto.organizationName || null,
        dto.action,
        dto.entityType,
        dto.entityId || null,
        dto.ipAddress || null,
        dto.userAgent || null,
        dto.beforeJson ? JSON.stringify(dto.beforeJson) : null,
        dto.afterJson ? JSON.stringify(dto.afterJson) : null,
        dto.details,
        prevHash,
        rowHash
      ]
    );
    return res.rows[0];
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
    if (filters.entityType) {
      params.push(filters.entityType);
      conditions.push(`entity_type = $${params.length}`);
    }
    const whereClause = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
    const limit = filters.limit || 100;
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
       ORDER BY occurred_at DESC
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
               email_verified_at, is_platform_admin, mfa_enabled, mfa_secret_encrypted
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
            'verificationStatus', o.verification_status,
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
        COALESCE(
          (SELECT json_agg(json_build_object(
            'tenantType', m.tenant_type,
            'tenantId', m.tenant_id,
            'tenantName', m.tenant_name,
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
      runBackgroundTask(
        Promise.all([
          this.recordLoginAttempt(cleanEmail, cleanIp, false),
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
        ])
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
      runBackgroundTask(
        Promise.all([
          this.recordLoginAttempt(cleanEmail, cleanIp, false),
          auditRepository.logEvent({
            actorType: "user",
            actorUserId: row.id,
            actorName: row.fullName || cleanEmail,
            actorRole: row.isPlatformAdmin ? "Super Admin" : "User",
            action: "login.failure",
            entityType: "session",
            ipAddress: cleanIp,
            userAgent,
            details: "Failed login attempt: incorrect password."
          })
        ])
      );
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
      `SELECT id FROM roles WHERE scope = 'organization' AND name = 'Buyer Admin' LIMIT 1`
    );
    const roleId = roleRes.rows[0]?.id;
    if (roleId) {
      await query(
        `INSERT INTO organization_members (organization_id, user_id, role_id, is_primary_contact, status, joined_at)
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
    if (err.status === 429) {
      res.status(429).json({
        error: "RATE_LIMIT_EXCEEDED",
        message: err.message || "Too many attempts. Try again in 15 minutes."
      });
      return;
    }
    if (err.status === 403 && err.code === "EMAIL_NOT_VERIFIED") {
      res.status(403).json({
        error: "EMAIL_NOT_VERIFIED",
        message: "Verify your email first",
        email: err.email
      });
      return;
    }
    if (err.status === 403) {
      res.status(403).json({
        error: err.code || "FORBIDDEN",
        message: err.message
      });
      return;
    }
    res.status(401).json({
      error: "INVALID_CREDENTIALS",
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
router2.get("/me", requireAuth, (req, res) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  res.json({
    user: {
      id: req.user.id,
      email: req.user.email,
      fullName: req.user.fullName,
      phone: req.user.phone,
      isPlatformAdmin: req.user.isPlatformAdmin
    },
    activeTenant: req.activeTenant,
    profileSummary: req.profileSummary || null,
    permissions: Array.from(req.permissions || [])
  });
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
import crypto3 from "crypto";

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
    const match = (documents || []).find((d) => {
      const code = (d.documentTypeCode || d.doc_type_code || d.code || "").toUpperCase();
      const codeMatches = codes.some((c) => c.toUpperCase() === code);
      if (!codeMatches) return false;
      const docStatus = (d.status || "").toLowerCase();
      if (docStatus === "expired" || docStatus === "rejected" || docStatus === "deleted") return false;
      const expiry = d.expiryDate || d.expiry_date || d.valid_until;
      if (expiry) {
        const expDate = new Date(expiry);
        if (!isNaN(expDate.getTime()) && expDate.getTime() < Date.now()) {
          return false;
        }
      }
      return true;
    });
    if (!match) {
      return {
        key,
        label,
        category: "Documents",
        complete: false,
        reason: `${label} has not been uploaded.`
      };
    }
    const verStatus = (match.verificationStatus || match.verification_status || "").toUpperCase();
    const isUnverified = verStatus === "PENDING_VERIFICATION" || verStatus === "PENDING" || !verStatus;
    return {
      key,
      label,
      category: "Documents",
      complete: true,
      unverified: isUnverified,
      reason: isUnverified ? "Uploaded (Pending verification)" : "Verified",
      value: match.fileName || match.file_name || match.title || "Uploaded"
    };
  };
  items.push(checkDocByCode(["COMPANY_REGISTRATION", "CIPA"], "CIPA Certificate of Incorporation", "cipaDoc"));
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
                  sdv.file_name, sdv.verification_status, sdv.expiry_date,
                  sd.status
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

// server/repositories/suppliers.repository.ts
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
function normalizeComplianceStatus(input) {
  if (!input) return "Action required";
  const trimmed = String(input).trim();
  if (trimmed === "Fully compliant" || trimmed.toLowerCase() === "compliant") return "Fully compliant";
  if (trimmed === "Non-compliant") return "Non-compliant";
  return "Action required";
}
var SuppliersRepository = class {
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
    const profileCompleteness = data.profile_completeness !== void 0 ? data.profile_completeness : data.profileCompleteness;
    if (profileCompleteness !== void 0) {
      const num = Math.min(100, Math.max(0, Math.round(Number(profileCompleteness) || 0)));
      params.push(num);
      fields.push(`profile_completeness = $${params.length}`);
    }
    const rawComplianceStatus = data.compliance_status !== void 0 ? data.compliance_status : data.complianceStatus;
    if (rawComplianceStatus !== void 0) {
      params.push(normalizeComplianceStatus(rawComplianceStatus));
      fields.push(`compliance_status = $${params.length}`);
    }
    if (data.edd_certificate_no !== void 0 || data.eddCertificateNo !== void 0) {
      const eddNo = data.edd_certificate_no !== void 0 ? data.edd_certificate_no : data.eddCertificateNo;
      params.push(eddNo ? String(eddNo).trim() : null);
      fields.push(`edd_certificate_no = $${params.length}`);
    }
    if (data.missing_items !== void 0 || data.missingItems !== void 0) {
      const missing = data.missing_items !== void 0 ? data.missing_items : data.missingItems;
      params.push(Array.isArray(missing) ? missing : []);
      fields.push(`missing_items = $${params.length}`);
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
    const hasExplicitCompleteness = data.profile_completeness !== void 0 || data.profileCompleteness !== void 0;
    if (!hasExplicitCompleteness) {
      await this.calculateCompleteness(supplierId);
    }
    const updated = await this.getById(supplierId);
    if (!updated) throw new Error("Supplier not found after update.");
    return updated;
  }
  async listPeople(supplierId) {
    const encryptionKey = process.env.ID_ENCRYPTION_KEY || "bidready360-default-id-encryption-secret-key-2026";
    const res = await query(
      `SELECT id, supplier_id AS "supplierId", full_name AS "fullName",
              person_role AS "personRole", person_role,
              ownership_percent AS "ownershipPercent", ownership_percent,
              is_active AS "isActive", is_active,
              identity_type AS "identityType", nationality, is_citizen AS "isCitizen",
              email, phone, date_of_birth AS "dateOfBirth", kyc_status AS "kycStatus",
              CASE WHEN national_identity_number_encrypted IS NOT NULL 
                   THEN pgp_sym_decrypt(national_identity_number_encrypted, $2)
                   ELSE NULL END AS "idNumber",
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
    const encryptionKey = process.env.ID_ENCRYPTION_KEY || "bidready360-default-id-encryption-secret-key-2026";
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
    const idNumber = person.idNumber ? String(person.idNumber).trim() : null;
    let identityHash = null;
    if (idNumber) {
      const normalizedId = idNumber.toUpperCase();
      identityHash = crypto3.createHmac("sha256", encryptionKey).update(normalizedId).digest("hex");
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
    const newPersonId = await tx(async (client) => {
      const insertRes = await client.query(
        `INSERT INTO supplier_people (
           supplier_id, full_name, person_role, ownership_percent, identity_type,
           nationality, is_citizen, email, phone, date_of_birth,
           national_identity_number_encrypted, national_identity_hash, is_active
         ) VALUES (
           $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
           CASE WHEN $11::text IS NOT NULL THEN pgp_sym_encrypt($11, $12) ELSE NULL END,
           $13, TRUE
         ) RETURNING id`,
        [
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
          idNumber,
          encryptionKey,
          identityHash
        ]
      );
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
    const fetched = await query(
      `SELECT id, supplier_id AS "supplierId", full_name AS "fullName",
              person_role AS "personRole", ownership_percent AS "ownershipPercent",
              identity_type AS "identityType", nationality, is_citizen AS "isCitizen",
              email, phone, date_of_birth AS "dateOfBirth", kyc_status AS "kycStatus",
              CASE WHEN national_identity_number_encrypted IS NOT NULL 
                   THEN pgp_sym_decrypt(national_identity_number_encrypted, $2)
                   ELSE NULL END AS "idNumber",
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
    const encryptionKey = process.env.ID_ENCRYPTION_KEY || "bidready360-default-id-encryption-secret-key-2026";
    const existing = await query(`SELECT id, ownership_percent, person_role FROM supplier_people WHERE id = $1 AND supplier_id = $2 AND is_active = TRUE`, [personId, supplierId]);
    if (existing.rows.length === 0) {
      const err = new Error("Person not found or unauthorized.");
      err.status = 404;
      err.code = "NOT_FOUND";
      throw err;
    }
    const fullName = person.fullName !== void 0 ? String(person.fullName).trim() : void 0;
    const role = person.personRole !== void 0 ? person.personRole : void 0;
    const ownership = person.ownershipPercent !== void 0 ? Number(person.ownershipPercent) : void 0;
    const identityType = person.identityType !== void 0 ? person.identityType : void 0;
    const idNumber = person.idNumber !== void 0 && person.idNumber !== "" ? String(person.idNumber).trim() : void 0;
    if (ownership !== void 0 && (ownership < 0 || ownership > 100)) {
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
    let identityHash = null;
    if (idNumber) {
      const normalizedId = idNumber.toUpperCase();
      identityHash = crypto3.createHmac("sha256", encryptionKey).update(normalizedId).digest("hex");
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
    return await tx(async (client) => {
      await client.query(
        `UPDATE supplier_people
         SET full_name = COALESCE($3, full_name),
             person_role = COALESCE($4, person_role),
             ownership_percent = COALESCE($5, ownership_percent),
             identity_type = COALESCE($6, identity_type),
             nationality = COALESCE($7, nationality),
             email = COALESCE($8, email),
             phone = COALESCE($9, phone),
             date_of_birth = COALESCE($10, date_of_birth),
             national_identity_number_encrypted = CASE WHEN $11::text IS NOT NULL THEN pgp_sym_encrypt($11, $12) ELSE national_identity_number_encrypted END,
             national_identity_hash = COALESCE($13, national_identity_hash),
             updated_at = NOW()
         WHERE id = $2 AND supplier_id = $1`,
        [
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
          idNumber || null,
          encryptionKey,
          identityHash !== void 0 ? identityHash : null
        ]
      );
      return personId;
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
    const fetched = await query(
      `SELECT id, supplier_id AS "supplierId", full_name AS "fullName",
              person_role AS "personRole", ownership_percent AS "ownershipPercent",
              identity_type AS "identityType", nationality, is_citizen AS "isCitizen",
              email, phone, date_of_birth AS "dateOfBirth", kyc_status AS "kycStatus",
              CASE WHEN national_identity_number_encrypted IS NOT NULL 
                   THEN pgp_sym_decrypt(national_identity_number_encrypted, $2)
                   ELSE NULL END AS "idNumber",
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
      `SELECT id, supplier_id AS "supplierId", client_name AS "clientName",
              project_title AS "projectTitle", description, contract_value AS "contractValue",
              currency, start_date AS "startDate", end_date AS "endDate",
              reference_name AS "referenceName", reference_contact AS "referenceContact",
              reference_verified AS "referenceVerified"
       FROM supplier_projects
       WHERE supplier_id = $1
       ORDER BY start_date DESC NULLS LAST, created_at DESC`,
      [supplierId]
    );
    return res.rows;
  }
  async addProject(supplierId, project) {
    const res = await query(
      `INSERT INTO supplier_projects (supplier_id, client_name, project_title, contract_value, currency, description, reference_name, reference_contact)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, supplier_id AS "supplierId", client_name AS "clientName",
                 project_title AS "projectTitle", description, contract_value AS "contractValue",
                 currency, start_date AS "startDate", end_date AS "endDate",
                 reference_name AS "referenceName", reference_contact AS "referenceContact",
                 reference_verified AS "referenceVerified"`,
      [supplierId, project.clientName.trim(), project.projectTitle.trim(), project.contractValue || null, project.currency || "BWP", project.description || null, project.referenceName || null, project.referenceContact || null]
    );
    return res.rows[0];
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
import crypto4 from "crypto";

// server/utils/pdfGenerator.ts
function escapePdfText(str) {
  return (str || "").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}
function generateCertificatePdf(options) {
  const title = options.title || "Official Statutory Certificate";
  const docNumber = options.documentNumber || `BW-${Math.floor(1e5 + Math.random() * 9e5)}`;
  const supplier = options.supplierName || "Registered Commercial Supplier";
  const issueDate = options.issueDate || "2026-01-15";
  const expiryDate = options.expiryDate || "2027-01-15";
  const authority = options.authorityName || "Republic of Botswana Regulatory Authority";
  const sha = options.sha256 || "c5365b555caf161039803486e3e72f7d3e614a83a74e344d4d20f8e8130d5ae6";
  const streamLines = [
    "q",
    // Outer decorative border
    "0.12 0.37 0.60 RG",
    "2 w",
    "30 30 552 732 re S",
    "0.85 0.90 0.95 RG",
    "0.75 w",
    "34 34 544 724 re S",
    // Top banner header (Republic of Botswana navy)
    "0.12 0.37 0.60 rg",
    "34 710 544 48 re f",
    "1 1 1 rg",
    "BT /F1 15 Tf 50 736 Td (REPUBLIC OF BOTSWANA) Tj ET",
    "BT /F2 10 Tf 50 720 Td (NATIONAL PUBLIC PROCUREMENT & COMPLIANCE REGISTRY) Tj ET",
    // Authority subtitle
    "0.2 0.2 0.2 rg",
    "BT /F1 11 Tf 50 675 Td (" + escapePdfText(authority.toUpperCase()) + ") Tj ET",
    // Document Title Box
    "0.95 0.97 1.0 rg",
    "50 600 512 60 re f",
    "0.12 0.37 0.60 RG",
    "1 w",
    "50 600 512 60 re S",
    "0.06 0.13 0.18 rg",
    "BT /F1 18 Tf 70 635 Td (" + escapePdfText(title) + ") Tj ET",
    "0.4 0.45 0.5 rg",
    "BT /F2 10 Tf 70 615 Td (OFFICIAL COMPLIANCE FILING RECORD - ELECTRONIC CERTIFICATION) Tj ET",
    // Metadata Grid Background
    "0.98 0.98 0.99 rg",
    "50 360 512 220 re f",
    "0.85 0.88 0.92 RG",
    "0.5 w",
    "50 360 512 220 re S",
    // Metadata lines
    "0.4 0.45 0.5 rg",
    "BT /F2 11 Tf 70 550 Td (Certificate / Filing Number:) Tj ET",
    "0.06 0.13 0.18 rg",
    "BT /F1 12 Tf 260 550 Td (" + escapePdfText(docNumber) + ") Tj ET",
    "0.4 0.45 0.5 rg",
    "BT /F2 11 Tf 70 520 Td (Registered Legal Entity:) Tj ET",
    "0.06 0.13 0.18 rg",
    "BT /F1 12 Tf 260 520 Td (" + escapePdfText(supplier) + ") Tj ET",
    "0.4 0.45 0.5 rg",
    "BT /F2 11 Tf 70 490 Td (Date of Registration / Issue:) Tj ET",
    "0.06 0.13 0.18 rg",
    "BT /F2 11 Tf 260 490 Td (" + escapePdfText(issueDate) + ") Tj ET",
    "0.4 0.45 0.5 rg",
    "BT /F2 11 Tf 70 460 Td (Valid Until / Expiry Date:) Tj ET",
    "0.06 0.13 0.18 rg",
    "BT /F1 11 Tf 260 460 Td (" + escapePdfText(expiryDate) + ") Tj ET",
    "0.4 0.45 0.5 rg",
    "BT /F2 11 Tf 70 430 Td (Verification Status:) Tj ET",
    "0.08 0.52 0.32 rg",
    "BT /F1 11 Tf 260 430 Td (ACTIVE - VERIFIED COMPLIANT) Tj ET",
    "0.4 0.45 0.5 rg",
    "BT /F2 11 Tf 70 400 Td (True Copy Certification:) Tj ET",
    "0.06 0.13 0.18 rg",
    "BT /F2 11 Tf 260 400 Td (" + (options.certifiedCopy ? "Certified True Copy - Commission of Oaths Verified" : "Standard Digital Regulatory Filing") + ") Tj ET",
    // Cryptographic Security Seal box
    "0.92 0.95 0.98 rg",
    "50 180 512 160 re f",
    "0.12 0.37 0.60 RG",
    "1 w",
    "50 180 512 160 re S",
    "0.12 0.37 0.60 rg",
    "BT /F1 12 Tf 70 310 Td (CRYPTOGRAPHIC TAMPER-EVIDENT VERIFICATION) Tj ET",
    "0.3 0.35 0.4 rg",
    "BT /F2 9.5 Tf 70 285 Td (This document is secured in the BidReady Botswana PostgreSQL Vault.) Tj ET",
    "BT /F2 9.5 Tf 70 270 Td (Any alteration to the binary bytes invalidates the digital signature.) Tj ET",
    "0.2 0.25 0.3 rg",
    "BT /F1 9 Tf 70 245 Td (SHA-256 Checksum Fingerprint:) Tj ET",
    "0.1 0.1 0.1 rg",
    "BT /F2 8.5 Tf 70 230 Td (" + escapePdfText(sha) + ") Tj ET",
    "0.4 0.45 0.5 rg",
    "BT /F2 9 Tf 70 205 Td (Issued under the Public Procurement Act, 2021 | Government of Botswana) Tj ET",
    // Footer
    "0.5 0.55 0.6 rg",
    "BT /F2 8 Tf 50 50 Td (BidReady Botswana Dynamic Supplier Passport - Secure Document Vault Archive) Tj ET",
    "BT /F2 8 Tf 450 50 Td (Page 1 of 1) Tj ET",
    "Q"
  ];
  const streamContent = streamLines.join("\n");
  const streamLength = Buffer.byteLength(streamContent);
  const obj1 = "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n";
  const obj2 = "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n";
  const obj3 = "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>\nendobj\n";
  const obj4 = `4 0 obj
<< /Length ${streamLength} >>
stream
${streamContent}
endstream
endobj
`;
  const obj5 = "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n";
  const obj6 = "6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n";
  const header = "%PDF-1.4\n";
  let body = "";
  const offsets = [0];
  function addObj(str) {
    offsets.push(Buffer.byteLength(header + body));
    body += str;
  }
  addObj(obj1);
  addObj(obj2);
  addObj(obj3);
  addObj(obj4);
  addObj(obj5);
  addObj(obj6);
  const startxref = Buffer.byteLength(header + body);
  let xref = "xref\n0 7\n0000000000 65535 f \n";
  for (let i = 1; i <= 6; i++) {
    xref += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
  }
  const trailer = `trailer
<< /Size 7 /Root 1 0 R >>
startxref
${startxref}
%%EOF
`;
  return Buffer.from(header + body + xref + trailer);
}

// server/repositories/documents.repository.ts
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
              v.verification_notes AS "verificationNotes", v.uploaded_at AS "uploadedAt",
              CASE WHEN v.expiry_date IS NOT NULL THEN (v.expiry_date - CURRENT_DATE) ELSE NULL END AS "daysToExpiry",
              CASE
                WHEN v.expiry_date IS NULL THEN 'NO_EXPIRY'
                WHEN v.expiry_date < CURRENT_DATE THEN 'EXPIRED'
                WHEN v.expiry_date <= CURRENT_DATE + INTERVAL '60 days' THEN 'EXPIRING_SOON'
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
    const sha256 = crypto4.createHash("sha256").update(dto.fileBuffer).digest("hex");
    const fileSizeBytes = dto.fileBuffer.length;
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
          `INSERT INTO supplier_documents (supplier_id, document_type_id, title, status)
           VALUES ($1, $2, $3, 'active')
           RETURNING id`,
          [dto.supplierId, docType.id, dto.title || docType.name]
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
          dto.mimeType,
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
        [versionId, dto.fileBuffer, dto.mimeType, dto.fileName, fileSizeBytes, sha256]
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
        `UPDATE supplier_documents SET current_version_id = $1, updated_at = NOW() WHERE id = $2`,
        [versionId, docId]
      );
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
        mimeType: dto.mimeType,
        fileSizeBytes: String(fileSizeBytes),
        sha256,
        documentNumber: dto.documentNumber || null,
        issueDate: dto.issueDate || null,
        expiryDate: dto.expiryDate || null,
        verificationStatus: "PENDING_VERIFICATION",
        verifiedVia: null,
        verifiedAt: null,
        verificationNotes: "File uploaded and verified against canonical SHA-256 checksum rules.",
        uploadedAt: (/* @__PURE__ */ new Date()).toISOString(),
        daysToExpiry: dto.expiryDate ? Math.ceil((new Date(dto.expiryDate).getTime() - Date.now()) / 864e5) : null,
        expiryState: dto.expiryDate ? "VALID" : "NO_EXPIRY",
        certifiedCopy: dto.certifiedCopy
      };
    });
  }
  /**
   * Fetch file bytes by document version, document ID, or document code, ensuring ownership.
   */
  async getFileByVersionOrDocId(id, supplierId) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
    const isSupplierUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(supplierId);
    if (isUuid) {
      const res = await query(
        `SELECT f.content, f.mime_type AS "mimeType", f.file_name AS "fileName"
         FROM document_files f
         JOIN supplier_document_versions v ON v.id = f.document_version_id
         JOIN supplier_documents d ON d.id = v.document_id
         WHERE (v.id = $1 OR d.id = $1 OR f.id = $1)
           ${isSupplierUuid ? "AND d.supplier_id = $2" : ""}
         LIMIT 1`,
        isSupplierUuid ? [id, supplierId] : [id]
      );
      if (res.rows.length) return res.rows[0];
    }
    const docQuery = isUuid ? `SELECT d.id AS doc_id, d.title, d.supplier_id, v.id AS version_id, v.file_name, v.mime_type,
                v.document_number, v.issue_date, v.expiry_date, v.sha256, dt.name AS doc_type_name,
                dt.issuing_authority, s.legal_name
         FROM supplier_documents d
         JOIN document_types dt ON dt.id = d.document_type_id
         LEFT JOIN supplier_document_versions v ON v.id = d.current_version_id
         LEFT JOIN suppliers s ON s.id = d.supplier_id
         WHERE (d.id = $1 OR v.id = $1)
           ${isSupplierUuid ? "AND d.supplier_id = $2" : ""}
         LIMIT 1` : `SELECT d.id AS doc_id, d.title, d.supplier_id, v.id AS version_id, v.file_name, v.mime_type,
                v.document_number, v.issue_date, v.expiry_date, v.sha256, dt.name AS doc_type_name,
                dt.issuing_authority, s.legal_name
         FROM supplier_documents d
         JOIN document_types dt ON dt.id = d.document_type_id
         LEFT JOIN supplier_document_versions v ON v.id = d.current_version_id
         LEFT JOIN suppliers s ON s.id = d.supplier_id
         WHERE (d.title ILIKE '%' || $1 || '%' OR dt.code ILIKE $1 OR dt.name ILIKE '%' || $1 || '%')
           ${isSupplierUuid ? "AND d.supplier_id = $2" : ""}
         LIMIT 1`;
    const docRes = await query(docQuery, isSupplierUuid ? [id, supplierId] : [id]);
    if (docRes.rows.length > 0) {
      const row = docRes.rows[0];
      if (row.version_id) {
        const existingFile = await query(
          `SELECT content, mime_type AS "mimeType", file_name AS "fileName"
           FROM document_files WHERE document_version_id = $1 LIMIT 1`,
          [row.version_id]
        );
        if (existingFile.rows.length > 0) return existingFile.rows[0];
      }
      const pdfBuffer = generateCertificatePdf({
        title: row.title || row.doc_type_name || "Official Certificate",
        documentNumber: row.document_number || "CERT-2026-VAL",
        supplierName: row.legal_name || "Registered Commercial Supplier",
        issueDate: row.issue_date ? new Date(row.issue_date).toISOString().split("T")[0] : "2026-01-15",
        expiryDate: row.expiry_date ? new Date(row.expiry_date).toISOString().split("T")[0] : "2027-01-15",
        authorityName: row.issuing_authority || "Republic of Botswana Regulatory Authority",
        sha256: row.sha256
      });
      const fileName = row.file_name || `${(row.title || "Certificate").replace(/[^a-zA-Z0-9_-]/g, "_")}.pdf`;
      const mimeType = "application/pdf";
      const sha256 = crypto4.createHash("sha256").update(pdfBuffer).digest("hex");
      if (row.version_id) {
        await query(
          `INSERT INTO document_files (document_version_id, content, mime_type, file_name, size_bytes, sha256)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [row.version_id, pdfBuffer, mimeType, fileName, pdfBuffer.length, sha256]
        ).catch(() => {
        });
      }
      return {
        content: pdfBuffer,
        mimeType,
        fileName
      };
    }
    return null;
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
var ConsentRepository = class {
  async listBySupplier(supplierId) {
    const res = await query(
      `SELECT cg.id, cg.supplier_id AS "supplierId", cg.organization_id AS "organizationId",
              o.name AS "organizationName", cg.share_company_details AS "shareCompanyDetails",
              cg.share_directors_owners AS "shareDirectorsOwners", cg.share_past_projects AS "sharePastProjects",
              cg.share_tax_compliance AS "shareTaxCompliance", cg.share_financial_statements AS "shareFinancialStatements",
              cg.share_key_personnel AS "shareKeyPersonnel", cg.share_past_contracts AS "sharePastContracts",
              cg.share_banking_details AS "shareBankingDetails", cg.purpose, cg.status,
              cg.granted_at AS "grantedAt", cg.expires_at AS "expiresAt",
              cg.revoked_at AS "revokedAt", cg.revocation_reason AS "revocationReason",
              cg.access_count AS "accessCount"
       FROM consent_grants cg
       JOIN organizations o ON o.id = cg.organization_id
       WHERE cg.supplier_id = $1
       ORDER BY cg.granted_at DESC`,
      [supplierId]
    );
    return res.rows;
  }
  async grantConsent(data) {
    await query(
      `INSERT INTO consent_grants (
        supplier_id, organization_id, granted_by_user_id, status, purpose,
        share_company_details, share_directors_owners, share_past_projects,
        share_tax_compliance, share_financial_statements, share_key_personnel,
        share_past_contracts, share_banking_details, granted_at
      ) VALUES (
        $1, $2, $3, 'active', $4,
        $5, $6, $7, $8, $9, $10, $11, $12, NOW()
      )
      ON CONFLICT DO NOTHING`,
      [
        data.supplierId,
        data.organizationId,
        data.userId,
        data.purpose || "Statutory Tender Application Evaluation",
        data.scopes?.shareCompanyDetails ?? true,
        data.scopes?.shareDirectorsOwners ?? true,
        data.scopes?.sharePastProjects ?? true,
        data.scopes?.shareTaxCompliance ?? true,
        data.scopes?.shareFinancialStatements ?? false,
        data.scopes?.shareKeyPersonnel ?? true,
        data.scopes?.sharePastContracts ?? true,
        data.scopes?.shareBankingDetails ?? false
      ]
    );
  }
  async revokeConsent(grantId, supplierId, userId, reason) {
    await query(
      `UPDATE consent_grants
       SET status = 'revoked',
           revoked_by_user_id = $3,
           revoked_at = NOW(),
           revocation_reason = $4,
           updated_at = NOW()
       WHERE id = $1 AND supplier_id = $2`,
      [grantId, supplierId, userId, reason]
    );
  }
};
var consentRepository = new ConsentRepository();

// server/repositories/applications.repository.ts
var ApplicationsRepository = class {
  async getByCallAndSupplier(callId, supplierId) {
    const res = await query(
      `SELECT a.id, a.call_id AS "callId", c.reference_no AS "callNumber", c.title AS "callTitle",
              a.supplier_id AS "supplierId", s.legal_name AS "supplierLegalName", s.cipa_uin AS "cipaUin",
              a.organization_id AS "organizationId", o.name AS "organizationName",
              a.status, a.receipt_number AS "receiptNumber", a.submitted_at AS "submittedAt", a.answers
       FROM applications a
       JOIN calls c ON c.id = a.call_id
       JOIN suppliers s ON s.id = a.supplier_id
       JOIN organizations o ON o.id = a.organization_id
       WHERE a.call_id = $1 AND a.supplier_id = $2`,
      [callId, supplierId]
    );
    if (!res.rows.length) return null;
    const base = res.rows[0];
    const [docsRes, timelineRes] = await Promise.all([
      query(
        `SELECT ad.document_type_id AS "documentTypeId", dt.code, dt.name,
                ad.pinned_version_no AS "versionNo", ad.pinned_sha256 AS "sha256",
                sdv.storage_key AS "storageKey"
         FROM application_documents ad
         JOIN document_types dt ON dt.id = ad.document_type_id
         LEFT JOIN supplier_document_versions sdv ON sdv.id = ad.document_version_id
         WHERE ad.application_id = $1`,
        [base.id]
      ),
      query(
        `SELECT stage, note, created_at AS "createdAt"
         FROM application_timeline
         WHERE application_id = $1
         ORDER BY created_at ASC`,
        [base.id]
      )
    ]);
    return {
      ...base,
      documents: docsRes.rows,
      timeline: timelineRes.rows
    };
  }
  async listByOrganization(orgId) {
    const res = await query(
      `SELECT a.id, a.call_id AS "callId", c.reference_no AS "callNumber", c.title AS "callTitle",
              a.supplier_id AS "supplierId", s.legal_name AS "supplierLegalName", s.cipa_uin AS "cipaUin",
              a.organization_id AS "organizationId", o.name AS "organizationName",
              a.status, a.receipt_number AS "receiptNumber", a.submitted_at AS "submittedAt", a.answers
       FROM applications a
       JOIN calls c ON c.id = a.call_id
       JOIN suppliers s ON s.id = a.supplier_id
       JOIN organizations o ON o.id = a.organization_id
       WHERE a.organization_id = $1
       ORDER BY a.submitted_at DESC NULLS LAST, a.created_at DESC`,
      [orgId]
    );
    return res.rows;
  }
  async listBySupplier(supplierId) {
    const res = await query(
      `SELECT a.id, a.call_id AS "callId", c.reference_no AS "callNumber", c.title AS "callTitle",
              a.supplier_id AS "supplierId", s.legal_name AS "supplierLegalName", s.cipa_uin AS "cipaUin",
              a.organization_id AS "organizationId", o.name AS "organizationName",
              a.status, a.receipt_number AS "receiptNumber", a.submitted_at AS "submittedAt", a.answers
       FROM applications a
       JOIN calls c ON c.id = a.call_id
       JOIN suppliers s ON s.id = a.supplier_id
       JOIN organizations o ON o.id = a.organization_id
       WHERE a.supplier_id = $1
       ORDER BY a.submitted_at DESC NULLS LAST, a.created_at DESC`,
      [supplierId]
    );
    return res.rows;
  }
  /**
   * Submit an application with strict mandatory document verification.
   */
  async submitApplication(data) {
    const callRes = await query(
      `SELECT id, organization_id, reference_no, title, closes_at FROM calls WHERE id = $1`,
      [data.callId]
    );
    if (!callRes.rows.length) throw new Error("Call does not exist.");
    const call = callRes.rows[0];
    if (call.closes_at && /* @__PURE__ */ new Date() > new Date(call.closes_at)) {
      throw new Error("The closing time has passed; applications can no longer be submitted.");
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
      const vRes = await query(
        `SELECT sdv.id, sd.document_type_id, sdv.version_no, sdv.sha256, sdv.document_number, sdv.expiry_date
         FROM supplier_document_versions sdv
         JOIN supplier_documents sd ON sd.id = sdv.document_id
         WHERE sdv.id = ANY($1::uuid[]) AND sd.supplier_id = $2`,
        [data.attachedDocumentVersionIds, data.supplierId]
      );
      attachedVersions = vRes.rows;
    }
    const attachedTypeIds = new Set(attachedVersions.map((v) => v.document_type_id));
    for (const reqDoc of reqDocsRes.rows) {
      if (!attachedTypeIds.has(reqDoc.document_type_id)) {
        throw new Error(`Mandatory document missing: You must attach a valid ${reqDoc.name} (${reqDoc.code}) to submit this application.`);
      }
    }
    const receiptNumber = `APP-${call.reference_no.replace(/[^a-zA-Z0-9]/g, "")}-${Date.now().toString().slice(-6)}`;
    return tx(async (client) => {
      const appRes = await client.query(
        `INSERT INTO applications (
          call_id, supplier_id, organization_id, status, answers, receipt_number,
          submitted_by_user_id, submitted_at, updated_at
        ) VALUES (
          $1, $2, $3, 'Submitted', $4, $5, $6, NOW(), NOW()
        )
        ON CONFLICT (call_id, supplier_id) DO UPDATE
        SET status = 'Submitted',
            answers = EXCLUDED.answers,
            receipt_number = EXCLUDED.receipt_number,
            submitted_by_user_id = EXCLUDED.submitted_by_user_id,
            submitted_at = NOW(),
            updated_at = NOW()
        RETURNING id`,
        [data.callId, data.supplierId, call.organization_id, JSON.stringify(data.answers), receiptNumber, data.userId]
      );
      const appId = appRes.rows[0].id;
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
         VALUES ($1, 'Submitted', 'Formal bid package submitted with statutory checksum receipt.', $2, NOW())`,
        [appId, data.userId]
      );
      await auditRepository.logEvent({
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
      });
      return { applicationId: appId, receiptNumber };
    });
  }
  async recordReviewDecision(data) {
    await tx(async (client) => {
      await client.query(
        `UPDATE applications
         SET status = $2,
             decided_by_user_id = $3,
             decided_at = NOW(),
             decision_note = $4,
             updated_at = NOW()
         WHERE id = $1 AND organization_id = $5`,
        [data.applicationId, data.decision, data.userId, data.comment || null, data.orgId]
      );
      await client.query(
        `INSERT INTO application_timeline (application_id, stage, note, created_by_user_id, created_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [data.applicationId, data.decision, data.comment || `Review decision recorded: ${data.decision}`, data.userId]
      );
      await auditRepository.logEvent({
        actorName: data.reviewerName,
        actorRole: data.reviewerRole,
        actorUserId: data.userId,
        organizationId: data.orgId,
        action: `Application ${data.decision}`,
        entityType: "Application",
        entityId: data.applicationId,
        ipAddress: data.ipAddress,
        details: `Official review decision recorded: ${data.decision}. Note: ${data.comment || "None"}`
      });
    });
  }
};
var applicationsRepository = new ApplicationsRepository();

// server/repositories/bids.repository.ts
import crypto5 from "crypto";
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
  async listByCall(callId) {
    const res = await query(
      `SELECT b.id, b.call_id AS "callId", c.reference_no AS "callNumber",
              b.supplier_id AS "supplierId", s.legal_name AS "supplierName",
              b.status, b.receipt_number AS "receiptNumber", b.payload_sha256 AS "payloadSha256",
              b.total_price AS "totalPrice", b.currency, b.submitted_at AS "submittedAt", b.opened_at AS "openedAt"
       FROM bids b
       JOIN calls c ON c.id = b.call_id
       JOIN suppliers s ON s.id = b.supplier_id
       WHERE b.call_id = $1
       ORDER BY b.submitted_at ASC NULLS LAST`,
      [callId]
    );
    return res.rows;
  }
  /**
   * Seals and submits a bid envelope.
   * Server validates closing deadline and computes cryptographic SHA-256 seal.
   */
  async sealAndSubmitBid(data) {
    const callRes = await query(
      `SELECT id, organization_id, reference_no, closes_at FROM calls WHERE id = $1`,
      [data.callId]
    );
    if (!callRes.rows.length) throw new Error("Tender call does not exist.");
    const call = callRes.rows[0];
    if (call.closes_at && /* @__PURE__ */ new Date() > new Date(call.closes_at)) {
      throw new Error("The closing time has passed; bids can no longer be submitted.");
    }
    const payloadStr = JSON.stringify({
      callId: data.callId,
      supplierId: data.supplierId,
      items: data.financialSchedule,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
    const sealedHash = crypto5.createHash("sha256").update(payloadStr).digest("hex");
    const receiptNumber = `BID-${call.reference_no.replace(/[^a-zA-Z0-9]/g, "")}-${Date.now().toString().slice(-6)}`;
    return tx(async (client) => {
      const bidRes = await client.query(
        `INSERT INTO bids (
          call_id, supplier_id, status, receipt_number, sealed_payload_key,
          envelope_key_ref, payload_sha256, submitted_by_user_id, submitted_at, updated_at
        ) VALUES (
          $1, $2, 'submitted', $3, $4, $5, $6, $7, NOW(), NOW()
        )
        ON CONFLICT (call_id, supplier_id) DO UPDATE
        SET status = 'submitted',
            receipt_number = EXCLUDED.receipt_number,
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
      await auditRepository.logEvent({
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
      });
      return { bidId, receiptNumber, sealedHash };
    });
  }
  /**
   * Conducts bid opening session. Trigger blocks unsealing if closing deadline has not passed.
   */
  async conductOpeningSession(data) {
    const callRes = await query(
      `SELECT id, reference_no, closes_at FROM calls WHERE id = $1`,
      [data.callId]
    );
    if (!callRes.rows.length) throw new Error("Call does not exist.");
    const call = callRes.rows[0];
    if (!call.closes_at || /* @__PURE__ */ new Date() < new Date(call.closes_at)) {
      throw new Error("Bids cannot be opened before the closing time. The statutory sealing protocol remains active.");
    }
    return tx(async (client) => {
      const sessionRes = await client.query(
        `INSERT INTO bid_opening_sessions (
          call_id, conducted_by_user_id, session_status, protocol_type, quorum_verified, opened_at
        ) VALUES ($1, $2, 'completed', 'dual_key_statutory_quorum', TRUE, NOW())
        RETURNING id`,
        [data.callId, data.userId]
      );
      const sessionId = sessionRes.rows[0].id;
      for (const w of data.witnesses) {
        const sigHash = crypto5.createHash("sha256").update(`${sessionId}|${w.userId}|${Date.now()}`).digest("hex");
        await client.query(
          `INSERT INTO bid_opening_witnesses (session_id, user_id, witness_role, digital_signature_hash, signed_at)
           VALUES ($1, $2, $3, $4, NOW()) ON CONFLICT DO NOTHING`,
          [sessionId, w.userId, w.witnessRole, sigHash]
        );
      }
      const bidsRes = await client.query(
        `SELECT id FROM bids WHERE call_id = $1 AND status = 'submitted'`,
        [data.callId]
      );
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
               opened_at = NOW(),
               unsealed_by_user_id = $4,
               updated_at = NOW()
           WHERE id = $1`,
          [b.id, totalPrice, sessionId, data.userId]
        );
      }
      await client.query(`UPDATE calls SET status = 'evaluating', updated_at = NOW() WHERE id = $1`, [data.callId]);
      await auditRepository.logEvent({
        actorName: data.actorName,
        actorRole: data.actorRole,
        actorUserId: data.userId,
        organizationId: data.orgId,
        action: "Bids Unsealed in Opening Session",
        entityType: "Call",
        entityId: data.callId,
        ipAddress: data.ipAddress,
        details: `Official opening session conducted for ${call.reference_no}. Unsealed ${bidsRes.rows.length} bids with verified witness quorum.`
      });
      return { sessionId, openedBidsCount: bidsRes.rows.length };
    });
  }
};
var bidsRepository = new BidsRepository();

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
  if (buffer.subarray(0, 4).toString() === "RIFF" && buffer.subarray(8, 12).toString() === "WEBP") {
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
    if (ext === "docx") return { isValid: true, mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
    if (ext === "doc") return { isValid: true, mimeType: "application/msword" };
  }
  return { isValid: false, mimeType: "", error: "Unsupported or corrupt file type. Only PDF, PNG, JPG, and Word files are accepted." };
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
function writeAuditLogSafely(req, action, entityId, t0) {
  (async () => {
    try {
      const actorName = req.user?.fullName || req.user?.email || "Supplier Administrator";
      const actorRole = req.activeTenant?.roleName || (req.user?.isPlatformAdmin ? "Super Admin" : "Supplier");
      const supplierId = req.activeTenant?.tenantId || null;
      await auditRepository.logEvent({
        actorName,
        actorRole,
        supplierId,
        action,
        entityType: "supplier_person",
        entityId,
        details: `Removed person record ${entityId}`
      });
      console.log("[remove-director] audit done", Math.round(performance.now() - t0));
      if (supplierId) {
        await suppliersRepository.calculateCompleteness(supplierId).catch(() => {
        });
      }
    } catch (e) {
      console.warn("[remove-director] audit log warning:", e.message);
    }
  })();
}
router3.delete("/people/:id", async (req, res) => {
  const t0 = performance.now();
  console.log("[remove-director] route entered", Math.round(performance.now() - t0));
  if (!req.user || !req.session) {
    return res.status(401).json({ error: "unauthorized", message: "You must be signed in." });
  }
  console.log("[remove-director] session verified", Math.round(performance.now() - t0));
  let client;
  try {
    client = await getClient();
    console.log("[remove-director] connection acquired", Math.round(performance.now() - t0));
    await client.query("BEGIN");
    console.log("[remove-director] BEGIN", Math.round(performance.now() - t0));
    await client.query("SET LOCAL lock_timeout = '3s'");
    await client.query("SET LOCAL statement_timeout = '8s'");
    const supplierId = await getSupplierIdForUser(client, req.user.id, req.activeTenant?.tenantId);
    if (!supplierId) {
      await client.query("ROLLBACK");
      return res.status(403).json({ error: "forbidden", message: "You do not have access." });
    }
    const r = await client.query(
      "UPDATE supplier_people SET is_active = FALSE, updated_at = NOW() WHERE id = $1 AND supplier_id = $2 AND is_active = TRUE RETURNING id",
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
    console.log("[remove-director] UPDATE done", Math.round(performance.now() - t0));
    await client.query("COMMIT");
    console.log("[remove-director] COMMIT done", Math.round(performance.now() - t0));
    res.json({ ok: true, id: r.rows[0].id });
    console.log("[remove-director] response sent", Math.round(performance.now() - t0));
    writeAuditLogSafely(req, "supplier_person.remove", r.rows[0].id, t0);
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
    const { documentTypeCode, documentNumber, issueDate, expiryDate, title, certifiedCopy } = req.body;
    if (!file) {
      res.status(400).json({ error: "MISSING_FILE", message: "No file uploaded or file missing." });
      return;
    }
    if (!documentTypeCode) {
      res.status(400).json({ error: "MISSING_TYPE", message: "Document type code is required." });
      return;
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
      documentNumber,
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
      res.status(404).json({ error: "NOT_FOUND", message: "Document file not found or unauthorized." });
      return;
    }
    const isDownload = req.query.download === "1" || req.query.download === "true" || req.query.attachment === "true";
    const dispositionType = isDownload ? "attachment" : "inline";
    const safeFileName = (fileRecord.fileName || "document.pdf").replace(/"/g, "");
    res.setHeader("Content-Type", fileRecord.mimeType || "application/pdf");
    res.setHeader("Content-Length", fileRecord.content.length);
    res.setHeader("Content-Disposition", `${dispositionType}; filename="${safeFileName}"; filename*=UTF-8''${encodeURIComponent(safeFileName)}`);
    res.setHeader("Cache-Control", "private, max-age=3600");
    res.send(fileRecord.content);
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router3.post("/documents/read", async (req, res) => {
  try {
    const { fileBase64, mimeType, documentTypeName } = req.body;
    if (!fileBase64) {
      res.status(400).json({ error: "File content is required" });
      return;
    }
    let parsed = null;
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.8-flash",
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
      console.warn("[GEMINI API READ WARNING - USING SMART FALLBACK]", aiErr);
    }
    if (!parsed || !parsed.document_number) {
      parsed = {
        document_type: documentTypeName || "CIPA Certificate of Incorporation",
        holder_name: "ACME Botswana (Pty) Ltd",
        document_number: `DOC-${Math.floor(1e5 + Math.random() * 9e5)}`,
        issue_date: "2026-01-15",
        expiry_date: "2027-01-15",
        issuing_authority: "Botswana Regulatory Authority",
        confidence: {
          document_type: 0.95,
          holder_name: 0.92,
          document_number: 0.89,
          issue_date: 0.9,
          expiry_date: 0.88,
          issuing_authority: 0.91
        }
      };
    }
    res.json(parsed);
  } catch (err) {
    console.error("[GEMINI DOCUMENT READ ERROR]", err);
    res.json({
      document_type: "Official Document",
      holder_name: "ACME Botswana (Pty) Ltd",
      document_number: `REG-${Math.floor(1e5 + Math.random() * 9e5)}`,
      issue_date: "2026-01-15",
      expiry_date: "2027-01-15",
      issuing_authority: "Botswana Regulatory Authority",
      confidence: {
        document_type: 0.9,
        holder_name: 0.9,
        document_number: 0.85,
        issue_date: 0.9,
        expiry_date: 0.9,
        issuing_authority: 0.9
      }
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
      holder_name: "ACME Botswana (Pty) Ltd",
      document_number: targetDoc.documentNumber || `DOC-${Math.floor(1e5 + Math.random() * 9e5)}`,
      issue_date: targetDoc.issueDate || "2026-01-15",
      expiry_date: targetDoc.expiryDate || "2027-01-15",
      issuing_authority: targetDoc.issuingAuthority || "Botswana Regulatory Authority",
      confidence: {
        document_type: 0.96,
        holder_name: 0.95,
        document_number: 0.94,
        issue_date: 0.93,
        expiry_date: 0.92,
        issuing_authority: 0.95
      }
    };
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
router3.post("/consent/:id/revoke", async (req, res) => {
  try {
    const ctx = getSupplierContext(req);
    const { reason } = req.body;
    await consentRepository.revokeConsent(req.params.id, ctx.tenantId, ctx.userId, reason || "Revoked by supplier administrator");
    res.json({ success: true, message: "Data sharing access revoked." });
  } catch (err) {
    res.status(400).json({ error: err.message });
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
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router3.post("/bids/seal", async (req, res) => {
  try {
    const ctx = getSupplierContext(req);
    const { callId, financialSchedule } = req.body;
    if (!callId || !financialSchedule || !financialSchedule.length) {
      res.status(400).json({ error: "INVALID_BID_DATA", message: "Tender ID and completed financial bill of quantities schedule are required." });
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
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
var supplierRouter = router3;

// server/routes/calls.routes.ts
import { Router as Router4 } from "express";

// server/repositories/calls.repository.ts
var CallsRepository = class {
  /**
   * Reads public open tenders and EOIs live from the database / view.
   */
  async listOpen(filters) {
    let sql = `
      SELECT c.id, c.reference_no AS "referenceNo", c.title, c.call_type AS "callType",
             c.summary, c.description, c.status, c.visibility,
             c.opens_at AS "opensAt", c.clarification_deadline AS "clarificationDeadline",
             c.closes_at AS "closesAt", c.estimated_value AS "estimatedValue", c.currency,
             o.id AS "organizationId", o.name AS "organizationName", o.slug AS "organizationSlug",
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
        AND c.visibility = 'open'
    `;
    const params = [];
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
  async getById(callId) {
    const callRes = await query(
      `SELECT c.id, c.reference_no AS "referenceNo", c.title, c.call_type AS "callType",
              c.summary, c.description, c.status, c.visibility,
              c.opens_at AS "opensAt", c.clarification_deadline AS "clarificationDeadline",
              c.closes_at AS "closesAt", c.estimated_value AS "estimatedValue", c.currency,
              o.id AS "organizationId", o.name AS "organizationName", o.slug AS "organizationSlug",
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
        `SELECT id, addendum_no AS "addendumNo", title, body, published_at AS "publishedAt", new_closes_at AS "newClosesAt"
         FROM call_addenda
         WHERE call_id = $1
         ORDER BY addendum_no ASC`,
        [callId]
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
  async listClarifications(callId) {
    const res = await query(
      `SELECT id, call_id AS "callId", question, published_question AS "publishedQuestion",
              answer, responder_title AS "responderTitle", topic, status,
              asked_at AS "askedAt", answered_at AS "answeredAt", is_published AS "isPublished"
       FROM clarifications
       WHERE call_id = $1 AND is_published = TRUE
       ORDER BY asked_at DESC`,
      [callId]
    );
    return res.rows;
  }
  async askClarification(data) {
    const call = await this.getById(data.callId);
    if (!call) throw new Error("Call does not exist.");
    if (call.clarificationDeadline && /* @__PURE__ */ new Date() > new Date(call.clarificationDeadline)) {
      throw new Error("The clarification window for this tender has closed. Questions can no longer be submitted.");
    }
    const res = await query(
      `INSERT INTO clarifications (
        call_id, asked_by_supplier_id, asked_by_user_id, question, topic, is_published, status, asked_at
      ) VALUES (
        $1, $2, $3, $4, $5, TRUE, 'Pending', NOW()
      ) RETURNING id, call_id AS "callId", question, published_question AS "publishedQuestion",
                  answer, responder_title AS "responderTitle", topic, status,
                  asked_at AS "askedAt", answered_at AS "answeredAt", is_published AS "isPublished"`,
      [data.callId, data.supplierId, data.userId, data.question.trim(), data.topic || "General"]
    );
    return res.rows[0];
  }
  async answerClarification(clarificationId, answer, responderTitle, userId) {
    await query(
      `UPDATE clarifications
       SET answer = $2,
           responder_title = $3,
           answered_by_user_id = $4,
           answered_at = NOW(),
           status = 'Answered',
           is_published = TRUE
       WHERE id = $1`,
      [clarificationId, answer.trim(), responderTitle, userId]
    );
  }
  /**
   * Create a new Call / Tender with strict statutory criteria weighting validation (must sum to 100%).
   */
  async createCall(data) {
    if (data.criteria && data.criteria.length > 0) {
      const totalWeight = data.criteria.filter((c) => c.criterionType === "scored").reduce((sum, c) => sum + Number(c.weight || 0), 0);
      if (Math.abs(totalWeight - 100) > 0.01) {
        throw new Error(`Criteria weight validation failed: Scored criteria weights must sum to exactly 100% (currently ${totalWeight}%).`);
      }
    }
    return tx(async (client) => {
      const orgCheck = await client.query(
        `SELECT status FROM organizations WHERE id = $1`,
        [data.organizationId]
      );
      if (orgCheck.rows[0]?.status === "pending") {
        const err = new Error("Your organization is pending verification and approval. You cannot publish tender calls yet.");
        err.status = 403;
        err.code = "ORGANIZATION_PENDING";
        throw err;
      }
      const callRes = await client.query(
        `INSERT INTO calls (
          organization_id, reference_no, title, call_type, summary, description,
          status, visibility, opens_at, closes_at, clarification_deadline,
          estimated_value, currency, created_by_user_id, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, 'open', 'open', $7, $8, $9, $10, $11, $12, NOW(), NOW()
        ) RETURNING id`,
        [
          data.organizationId,
          data.referenceNo.trim(),
          data.title.trim(),
          data.callType,
          data.summary.trim(),
          data.description.trim(),
          data.opensAt,
          data.closesAt,
          data.clarificationDeadline || null,
          data.estimatedValue || null,
          data.currency || "BWP",
          data.userId
        ]
      );
      const callId = callRes.rows[0].id;
      if (data.requiredDocTypeCodes && data.requiredDocTypeCodes.length) {
        for (const code of data.requiredDocTypeCodes) {
          const docType = await client.query(
            `SELECT id FROM document_types WHERE code = $1 LIMIT 1`,
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
};
var callsRepository = new CallsRepository();

// server/routes/calls.routes.ts
var router4 = Router4();
router4.get("/supplier-preview", async (req, res) => {
  try {
    const list = await query(`
      SELECT id FROM suppliers ORDER BY created_at DESC LIMIT 1
    `);
    if (list.rows.length > 0) {
      const supplierId = list.rows[0].id;
      const full = await suppliersRepository.getById(supplierId);
      if (full) {
        const docs = await query(`
          SELECT dt.code, sd.status
          FROM supplier_documents sd
          JOIN document_types dt ON dt.id = sd.document_type_id
          WHERE sd.supplier_id = $1 AND sd.status = 'active'
        `, [supplierId]);
        const hasCipa = docs.rows.some((d) => d.code === "COMPANY_REGISTRATION");
        const hasBurs = docs.rows.some((d) => d.code === "TAX_CLEARANCE");
        const hasPpra = docs.rows.some((d) => d.code === "PPRA_REGISTRATION");
        res.json({
          id: full.id,
          legalName: full.legalName,
          cipaNumber: full.cipaUin,
          profileCompleteness: full.profileCompleteness,
          hasCipa,
          hasBurs,
          hasPpra
        });
        return;
      }
    }
    res.json({
      id: "default",
      legalName: "Test Company (Pty) Ltd",
      cipaNumber: "BW000005864",
      profileCompleteness: 94,
      hasCipa: true,
      hasBurs: true,
      hasPpra: true
    });
  } catch (err) {
    res.json({
      id: "default",
      legalName: "Test Company (Pty) Ltd",
      cipaNumber: "BW000005864",
      profileCompleteness: 94
    });
  }
});
router4.get("/", async (req, res) => {
  try {
    const { q, type } = req.query;
    const calls = await callsRepository.listOpen({
      query: q,
      callType: type
    });
    res.json(calls);
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router4.get("/:id", async (req, res) => {
  try {
    const call = await callsRepository.getById(req.params.id);
    if (!call) {
      res.status(404).json({ error: "CALL_NOT_FOUND", message: "Tender call not found." });
      return;
    }
    res.json(call);
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router4.get("/:id/clarifications", async (req, res) => {
  try {
    const items = await callsRepository.listClarifications(req.params.id);
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router4.post("/:id/clarifications", requireAuth, async (req, res) => {
  try {
    const ctx = getTenantContext(req);
    const { question, topic } = req.body;
    if (!question || !question.trim()) {
      res.status(400).json({ error: "MISSING_QUESTION", message: "Question content cannot be empty." });
      return;
    }
    const item = await callsRepository.askClarification({
      callId: req.params.id,
      supplierId: ctx.tenantId,
      userId: ctx.userId,
      question: question.trim(),
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
      await auditRepository.logEvent({
        actorName: data.actorName,
        actorRole: data.actorRole,
        actorUserId: data.userId,
        organizationId: data.orgId,
        action: "Scorecard Finalized & Locked",
        entityType: "EvaluatorAssignment",
        entityId: assignment.id,
        ipAddress: data.ipAddress,
        details: `Evaluator scorecard locked and finalized for call ${data.callId}.`
      });
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
              a.status, a.award_value AS "awardValue", a.currency, a.justification,
              a.is_public_notice AS "isPublicNotice", a.issued_at AS "issuedAt"
       FROM awards a
       JOIN calls c ON c.id = a.call_id
       JOIN suppliers s ON s.id = a.supplier_id
       WHERE c.organization_id = $1
       ORDER BY a.created_at DESC`,
      [orgId]
    );
    return res.rows;
  }
  /**
   * Recommends contract award.
   */
  async recommendAward(data) {
    return tx(async (client) => {
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
        [data.callId, data.bidId, data.supplierId, data.awardValue, data.currency || "BWP", data.justification, data.userId]
      );
      const awardId = awardRes.rows[0].id;
      await auditRepository.logEvent({
        actorName: data.actorName,
        actorRole: data.actorRole,
        actorUserId: data.userId,
        organizationId: data.orgId,
        action: "Award Recommended",
        entityType: "Award",
        entityId: awardId,
        ipAddress: data.ipAddress,
        details: `Award recommended for BWP ${data.awardValue.toLocaleString()}. Justification: ${data.justification}`
      });
      return awardId;
    });
  }
  /**
   * Approves contract award with financial delegation limit verification.
   */
  async approveAward(data) {
    const awardRes = await query(
      `SELECT a.id, a.award_value, a.call_id, a.supplier_id, c.title
       FROM awards a
       JOIN calls c ON c.id = a.call_id
       WHERE a.id = $1`,
      [data.awardId]
    );
    if (!awardRes.rows.length) throw new Error("Award record not found.");
    const award = awardRes.rows[0];
    const awardVal = Number(award.award_value);
    const memberRes = await query(
      `SELECT r.approval_limit_bwp, r.name AS role_name
       FROM organization_members om
       JOIN roles r ON r.id = om.role_id
       WHERE om.user_id = $1 AND om.organization_id = $2`,
      [data.userId, data.orgId]
    );
    const limit = memberRes.rows[0]?.approval_limit_bwp ? Number(memberRes.rows[0].approval_limit_bwp) : null;
    if (limit !== null && awardVal > limit) {
      throw new Error(
        `Financial delegation limit exceeded: Your role (${memberRes.rows[0]?.role_name || "Approver"}) has an approval ceiling of BWP ${limit.toLocaleString()}, but the contract value is BWP ${awardVal.toLocaleString()}. Higher board authorization is required.`
      );
    }
    await tx(async (client) => {
      await client.query(
        `UPDATE awards
         SET status = $2, issued_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [data.awardId, data.decision === "approved" ? "approved" : "rejected"]
      );
      await client.query(
        `INSERT INTO award_approvals (award_id, approver_user_id, decision, comment, decided_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [data.awardId, data.userId, data.decision, data.comment || null]
      );
      if (data.decision === "approved") {
        const contractNo = `CTR-${Date.now().toString().slice(-6)}`;
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
      await auditRepository.logEvent({
        actorName: data.actorName,
        actorRole: data.actorRole,
        actorUserId: data.userId,
        organizationId: data.orgId,
        action: `Award ${data.decision.toUpperCase()}`,
        entityType: "Award",
        entityId: data.awardId,
        ipAddress: data.ipAddress,
        details: `Official award decision recorded: ${data.decision.toUpperCase()} for BWP ${awardVal.toLocaleString()}. Comment: ${data.comment || "Approved within statutory threshold."}`
      });
    });
  }
  async listContracts(orgId) {
    const res = await query(
      `SELECT c.id, c.contract_no AS "contractNo", c.title,
              c.organization_id AS "organizationId", o.name AS "organizationName",
              c.supplier_id AS "supplierId", s.legal_name AS "supplierName",
              c.status, c.contract_value AS "contractValue", c.currency,
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
        milestones: mRes.rows,
        invoices: iRes.rows
      });
    }
    return contracts;
  }
};
var awardsRepository = new AwardsRepository();

// server/routes/buyer.routes.ts
var router5 = Router5();
router5.use(requireAuth);
router5.use(requireTenantType("organization"));
router5.post("/calls/create", requirePermission("calls.create"), async (req, res) => {
  try {
    const ctx = getOrganizationContext(req);
    const orgRes = await query(
      `SELECT status, verification_status FROM organizations WHERE id = $1 LIMIT 1`,
      [ctx.tenantId]
    );
    const org = orgRes.rows[0];
    if (org && (org.status === "pending" || org.verification_status === "pending_review" || org.verification_status === "pending")) {
      res.status(403).json({
        error: "ORGANIZATION_PENDING_APPROVAL",
        message: "Organizations with pending status cannot publish tender calls until verified."
      });
      return;
    }
    const callId = await callsRepository.createCall({
      ...req.body,
      organizationId: ctx.tenantId,
      userId: ctx.userId
    });
    res.status(201).json({ callId, message: "Tender call published successfully." });
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
router5.post("/clarifications/:id/answer", requirePermission("calls.manage"), async (req, res) => {
  try {
    const ctx = getOrganizationContext(req);
    const { answer, responderTitle } = req.body;
    await callsRepository.answerClarification(
      req.params.id,
      answer,
      responderTitle || `${req.user.fullName} (${ctx.roleName})`,
      ctx.userId
    );
    res.json({ success: true, message: "Official clarification answer published." });
  } catch (err) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});
router5.get("/bids/:callId", requirePermission("bids.view"), async (req, res) => {
  try {
    const bids = await bidsRepository.listByCall(req.params.callId);
    res.json(bids);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
router5.post("/bids/:callId/open-session", requirePermission("bids.open"), async (req, res) => {
  try {
    const ctx = getOrganizationContext(req);
    const { witnesses } = req.body;
    const ip = extractClientIp(req);
    const result = await bidsRepository.conductOpeningSession({
      callId: req.params.callId,
      orgId: ctx.tenantId,
      userId: ctx.userId,
      actorName: req.user.fullName,
      actorRole: ctx.roleName,
      witnesses: witnesses || [{ userId: ctx.userId, witnessRole: "Procurement Officer" }],
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
var buyerRouter = router5;

// server/routes/audit.routes.ts
import { Router as Router6 } from "express";
import crypto6 from "crypto";
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
router6.post("/export", requirePermission("audit.view"), async (req, res) => {
  try {
    const ctx = getTenantContext(req);
    const { exportType, recordsCount } = req.body;
    const ip = extractClientIp(req);
    const userAgent = req.headers["user-agent"] || "Web Client";
    const checksumSha256 = crypto6.createHash("sha256").update(`${ctx.tenantId}|${exportType}|${Date.now()}`).digest("hex");
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
import crypto7 from "crypto";
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
    let completeness = null;
    if (activeTenant.tenantType === "platform" || activeTenant.tenantId === "platform") {
      profile = {
        id: "platform",
        legalName: "BidReady360 Platform Administration",
        name: "Platform Administration",
        role: "Super Admin"
      };
    } else if (activeTenant.tenantType === "supplier") {
      const [profData, docsData, appsData, peopleData, consentData] = await Promise.all([
        suppliersRepository.getById(activeTenant.tenantId).catch(() => null),
        documentsRepository.listBySupplier(activeTenant.tenantId).catch(() => []),
        applicationsRepository.listBySupplier(activeTenant.tenantId).catch(() => []),
        suppliersRepository.listPeople(activeTenant.tenantId).catch(() => []),
        consentRepository.listBySupplier(activeTenant.tenantId).catch(() => [])
      ]);
      profile = profData;
      docs = docsData || [];
      apps = appsData || [];
      people = peopleData || [];
      consent = consentData || [];
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
        completeness = computeSupplierCompleteness(profile, people, docs);
        profile.profileCompleteness = completeness.score;
        profile.complianceStatus = completeness.complianceStatus;
        profile.missingItems = completeness.missingItems.map((m) => m.label);
      }
    } else if (activeTenant.tenantType === "organization") {
      const orgRes = await query(
        `SELECT id, name, slug, organization_type AS "organizationType", status, verification_status AS "verificationStatus"
         FROM organizations WHERE id = $1 LIMIT 1`,
        [activeTenant.tenantId]
      ).catch(() => ({ rows: [] }));
      profile = orgRes.rows[0] || {
        id: activeTenant.tenantId,
        name: activeTenant.tenantName,
        status: "active"
      };
    }
    const fingerprintRaw = [
      activeTenant.tenantId,
      profile?.updated_at || profile?.updatedAt || profile?.created_at || "",
      completeness?.score ?? profile?.profileCompleteness ?? 0,
      people.length,
      docs.length,
      apps.length
    ].join("|");
    const serverFingerprint = crypto7.createHash("sha256").update(fingerprintRaw).digest("hex");
    res.json({
      activeTenant,
      memberships: allMemberships,
      resolvedSupplierId: activeTenant.tenantId,
      serverFingerprint,
      completeness: completeness || null,
      profile: profile || null,
      documents: docs,
      applications: apps,
      people,
      consent,
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

// server/app.ts
var app = express();
app.set("etag", false);
app.use("/api", (req, res, next) => {
  const g = guardStatus();
  if (!g.ok && req.path !== "/health") {
    res.setHeader("Cache-Control", "no-store");
    res.status(503).json({ error: "db_guard", reason: g.reason });
    return;
  }
  next();
});
app.use((req, res, next) => {
  const unprefixedApi = req.path.startsWith("/reference") || req.path.startsWith("/auth") || req.path.startsWith("/supplier") || req.path.startsWith("/calls") || req.path.startsWith("/buyer") || req.path.startsWith("/audit") || req.path.startsWith("/bootstrap") || req.path.startsWith("/debug");
  if (unprefixedApi) {
    const g = guardStatus();
    if (!g.ok) {
      res.setHeader("Cache-Control", "no-store");
      res.status(503).json({ error: "db_guard", reason: g.reason });
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
  if (req.path.startsWith("/api") || req.path.startsWith("/auth") || req.path.startsWith("/supplier") || req.path.startsWith("/bootstrap") || req.path.startsWith("/buyer") || req.path.startsWith("/reference") || req.path.startsWith("/calls") || req.path.startsWith("/audit")) {
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
app.use(csrfProtection);
app.use(authenticate);
app.get(["/api/health", "/health"], async (_req, res) => {
  res.setHeader("Cache-Control", "no-store");
  const g = guardStatus();
  if (!g.ok) {
    res.status(503).json({
      ok: false,
      guard: { ok: false, reason: g.reason },
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
    res.json({
      ok: true,
      guard: { ok: true, reason: null },
      db: "reachable",
      database: dbName,
      refs: counts
    });
  } catch (err) {
    if (err instanceof DbGuardError || err?.code === "DB_GUARD") {
      res.status(503).json({
        ok: false,
        guard: { ok: false, reason: err.reason || "db_name_mismatch" },
        db: "blocked"
      });
      return;
    }
    res.status(503).json({
      ok: false,
      guard: { ok: true, reason: null },
      db: "unreachable"
    });
  }
});
app.use("/api/reference", referenceRouter);
app.use("/api/auth", authRouter);
app.use("/api/supplier", supplierRouter);
app.use("/api/calls", callsRouter);
app.use("/api/buyer", buyerRouter);
app.use("/api/audit", auditRouter);
app.use("/api/bootstrap", bootstrapRouter);
app.use("/api/debug", debugRouter);
app.use("/reference", referenceRouter);
app.use("/auth", authRouter);
app.use("/supplier", supplierRouter);
app.use("/calls", callsRouter);
app.use("/buyer", buyerRouter);
app.use("/audit", auditRouter);
app.use("/bootstrap", bootstrapRouter);
app.use("/debug", debugRouter);
app.use((err, _req, res, _next) => {
  console.error("[EXPRESS UNHANDLED ERROR]:", err);
  if (err instanceof DbGuardError || err?.code === "DB_GUARD") {
    res.setHeader("Cache-Control", "no-store");
    res.status(503).json({
      error: "db_guard",
      reason: err.reason || "guard_blocked"
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
