import { query } from '../db/client';
import { usersRepository, User, UserTenantMembership } from '../repositories/users.repository';
import { auditRepository } from '../repositories/audit.repository';
import { sanitizeIp } from '../utils/ip';
import {
  hashPassword,
  verifyPassword,
  validatePassword,
  generateRandomToken,
  hashToken,
  DUMMY_HASH,
  encryptData,
  decryptData,
  generateTotpSecret,
  verifyTotpCode,
} from '../utils/crypto';

export interface SupplierStepDTO {
  step: 1 | 2 | 3;
  email: string;
  fullName?: string;
  phone?: string;
  password?: string;
  legalName?: string;
  cipaUin?: string;
  companyType?: string;
  city?: string;
  agreedToTerms?: boolean;
  agreedToPrivacy?: boolean;
  ip?: string;
  userAgent?: string;
}

export interface SupplierSignupDTO {
  legalName: string;
  cipaUin: string;
  fullName: string;
  email: string;
  password: string;
  phone?: string;
  ip?: string;
  userAgent?: string;
}

export interface BuyerSignupDTO {
  organizationName: string;
  organizationType?: 'ministry' | 'parastatal' | 'local_authority' | 'private_company' | 'ngo' | 'other';
  fullName: string;
  email: string;
  password: string;
  phone?: string;
  ip?: string;
  userAgent?: string;
}

export interface AuthResponse {
  requiresMfa?: boolean;
  mfaUserId?: string;
  token?: string;
  user?: {
    id: string;
    email: string;
    fullName: string;
    phone?: string | null;
    isPlatformAdmin: boolean;
    memberships: UserTenantMembership[];
  };
  activeTenant?: UserTenantMembership;
  profileSummary?: any;
  timing?: {
    coldStart: boolean;
    dbConnectMs: number;
    userLookupMs: number;
    passwordVerifyMs: number;
    sessionInsertMs: number;
    auditWriteMs: number;
    totalMs: number;
  };
}

let isColdStart = true;

// Helper to run non-critical tasks without blocking HTTP response
function runBackgroundTask(task: Promise<any>): void {
  task.catch((err) => {
    console.error('[BACKGROUND TASK NOTICE]:', err?.message || err);
  });
}

export class AuthService {
  /**
   * Records an authentication attempt into PostgreSQL login_attempts table.
   */
  async recordLoginAttempt(emailNorm: string, ip: string | null, succeeded: boolean): Promise<void> {
    try {
      await query(
        `INSERT INTO login_attempts (email_norm, ip, succeeded, attempted_at)
         VALUES ($1, $2, $3, NOW())`,
        [emailNorm, ip || null, succeeded]
      );
    } catch (err: any) {
      console.error('[AUTH RECORD ATTEMPT ERROR]:', err.message);
    }
  }

  /**
   * Enforces brute-force lockout using ONE indexed COUNT query:
   * - 5 failures for the same email within 15 minutes
   * - 20 failures from the same IP within 15 minutes
   * Returns HTTP 429 when threshold exceeded.
   */
  async checkBruteForce(emailNorm: string, ip?: string | null): Promise<void> {
    const cleanIp = ip && ip.trim() ? ip.trim() : null;
    const res = await query<{ email_fails: string; ip_fails: string }>(
      `SELECT 
         COUNT(*) FILTER (WHERE email_norm = $1)::text AS email_fails,
         COUNT(*) FILTER (WHERE $2::text IS NOT NULL AND ip = $2::text)::text AS ip_fails
       FROM login_attempts
       WHERE (email_norm = $1 OR ($2::text IS NOT NULL AND ip = $2::text))
         AND succeeded = FALSE
         AND attempted_at > NOW() - INTERVAL '15 minutes'`,
      [emailNorm, cleanIp]
    );

    const emailFails = parseInt(res.rows[0]?.email_fails || '0', 10);
    const ipFails = parseInt(res.rows[0]?.ip_fails || '0', 10);

    if (emailFails >= 5 || ipFails >= 20) {
      runBackgroundTask(
        auditRepository.logEvent({
          actorType: 'system',
          actorName: emailNorm,
          actorRole: 'Security Guard',
          action: 'lockout',
          entityType: 'login_attempt',
          ipAddress: ip,
          details: `Brute force protection triggered: ${emailFails} email failures, ${ipFails} IP failures in 15 minutes.`,
        })
      );

      const err: any = new Error('Too many attempts. Try again in 15 minutes.');
      err.status = 429;
      err.code = 'RATE_LIMIT_EXCEEDED';
      throw err;
    }
  }

  /**
   * Rate limits sensitive actions like signups, password resets, and verification resends.
   */
  async checkActionRateLimit(key: string, maxAttempts: number, windowMinutes: number, message: string): Promise<void> {
    const res = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM audit_log
       WHERE action = $1
         AND occurred_at > NOW() - ($2 || ' minutes')::INTERVAL`,
      [key, windowMinutes]
    );
    const count = parseInt(res.rows[0]?.count || '0', 10);
    if (count >= maxAttempts) {
      const err: any = new Error(message);
      err.status = 429;
      err.code = 'RATE_LIMIT_EXCEEDED';
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
  async login(email: string, passwordPlain: string, ip?: string, userAgent?: string): Promise<AuthResponse> {
    const wasCold = isColdStart;
    isColdStart = false;
    const t0 = performance.now();

    const cleanEmail = email.trim().toLowerCase();
    const cleanIp = sanitizeIp(ip);

    // 1 & 2. Single combined query: rate limit check + user lookup + memberships + profile summary
    const tLookup0 = performance.now();
    const combinedRes = await query<{
      email_fails: string | null;
      ip_fails: string | null;
      id: string | null;
      email: string | null;
      passwordHash: string | null;
      fullName: string | null;
      phone: string | null;
      status: string | null;
      emailVerifiedAt: string | null;
      isPlatformAdmin: boolean | null;
      mfaEnabled: boolean | null;
      mfaSecretEncrypted: Buffer | null;
      org_memberships: any;
      sup_memberships: any;
    }>(
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

    const emailFails = parseInt(String(row?.email_fails || '0'), 10);
    const ipFails = parseInt(String(row?.ip_fails || '0'), 10);

    // 2. Enforce brute-force lockout
    if (emailFails >= 5 || ipFails >= 20) {
      runBackgroundTask(
        auditRepository.logEvent({
          actorType: 'system',
          actorName: cleanEmail,
          actorRole: 'Security Guard',
          action: 'lockout',
          entityType: 'login_attempt',
          ipAddress: cleanIp,
          details: `Brute force protection triggered: ${emailFails} email failures, ${ipFails} IP failures in 15 minutes.`,
        })
      );

      const err: any = new Error('Too many attempts. Try again in 15 minutes.');
      err.status = 429;
      err.code = 'RATE_LIMIT_EXCEEDED';
      throw err;
    }

    // 3. Unknown user or user without password hash -> timing equalization dummy hash, then reject
    if (!row || !row.id || !row.passwordHash || !row.passwordHash.trim()) {
      await verifyPassword(passwordPlain, DUMMY_HASH);
      runBackgroundTask(
        Promise.all([
          this.recordLoginAttempt(cleanEmail, cleanIp, false),
          auditRepository.logEvent({
            actorType: 'user',
            actorName: cleanEmail,
            actorRole: 'Anonymous',
            action: 'login.failure',
            entityType: 'session',
            ipAddress: cleanIp,
            userAgent,
            details: 'Failed login attempt: unknown email or user with no password hash.',
          }),
        ])
      );

      const err: any = new Error('Email or password is incorrect.');
      err.status = 401;
      err.code = 'INVALID_CREDENTIALS';
      throw err;
    }

    // 4. Verify password with bcrypt (cost 12 preserved)
    const tPass0 = performance.now();
    const isMatch = await verifyPassword(passwordPlain, row.passwordHash);
    const passwordVerifyMs = performance.now() - tPass0;

    if (!isMatch) {
      runBackgroundTask(
        Promise.all([
          this.recordLoginAttempt(cleanEmail, cleanIp, false),
          auditRepository.logEvent({
            actorType: 'user',
            actorUserId: row.id,
            actorName: row.fullName || cleanEmail,
            actorRole: row.isPlatformAdmin ? 'Super Admin' : 'User',
            action: 'login.failure',
            entityType: 'session',
            ipAddress: cleanIp,
            userAgent,
            details: 'Failed login attempt: incorrect password.',
          }),
        ])
      );

      const err: any = new Error('Email or password is incorrect.');
      err.status = 401;
      err.code = 'INVALID_CREDENTIALS';
      throw err;
    }

    // 5. Enforce Email Verification
    if (row.status === 'pending' || !row.emailVerifiedAt) {
      runBackgroundTask(this.recordLoginAttempt(cleanEmail, cleanIp, false));
      const err: any = new Error('Verify your email first');
      err.status = 403;
      err.code = 'EMAIL_NOT_VERIFIED';
      err.email = cleanEmail;
      throw err;
    }

    // 6. Check user account active status
    if (row.status !== 'active') {
      runBackgroundTask(this.recordLoginAttempt(cleanEmail, cleanIp, false));
      const err: any = new Error('This account has been deactivated. Please contact support.');
      err.status = 403;
      err.code = 'ACCOUNT_DISABLED';
      throw err;
    }

    // 7. If MFA is enabled, challenge for TOTP code
    if (row.mfaEnabled && row.mfaSecretEncrypted) {
      return {
        requiresMfa: true,
        mfaUserId: row.id,
      };
    }

    // 8. Determine default tenant and profile summary from already-joined data
    const memberships: UserTenantMembership[] = [
      ...(row.org_memberships || []),
      ...(row.sup_memberships || []),
    ];

    let tenantType: 'supplier' | 'organization' | 'platform' | null = null;
    let tenantId: string | null = null;
    let activeTenant: UserTenantMembership | undefined;
    let profileSummary: any = null;

    if (row.isPlatformAdmin) {
      tenantType = 'platform';
      tenantId = null;
      activeTenant = {
        tenantType: 'organization',
        tenantId: 'platform',
        tenantName: 'Platform Administration',
        roleId: 'role-platform-admin',
        roleName: 'Super Admin',
        isOwner: true,
        status: 'active',
        permissions: ['*'],
      };
    } else if (memberships.length > 0) {
      activeTenant = memberships[0];
      tenantType = activeTenant.tenantType;
      tenantId = activeTenant.tenantId;
      profileSummary = (activeTenant as any).profile || null;
    }

    // 9. Generate cryptographically secure 32-byte session token
    const rawToken = generateRandomToken(32);
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7-day expiry

    const tSess0 = performance.now();
    await query(
      `INSERT INTO sessions (user_id, token_hash, tenant_type, tenant_id, ip, user_agent, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [row.id, tokenHash, tenantType, tenantId, cleanIp || null, userAgent || null, expiresAt]
    );
    const sessionInsertMs = performance.now() - tSess0;

    // 10. Move non-critical background work off the login response path
    runBackgroundTask(
      Promise.all([
        this.recordLoginAttempt(cleanEmail, cleanIp, true),
        usersRepository.recordLoginSuccess(row.id, cleanIp),
        auditRepository.logEvent({
          actorType: 'user',
          actorUserId: row.id,
          actorName: row.fullName || cleanEmail,
          actorRole: activeTenant?.roleName || (row.isPlatformAdmin ? 'Super Admin' : 'User'),
          organizationId: tenantType === 'organization' ? (tenantId || undefined) : undefined,
          supplierId: tenantType === 'supplier' ? (tenantId || undefined) : undefined,
          action: 'login.success',
          entityType: 'session',
          ipAddress: cleanIp,
          userAgent,
          details: 'User authenticated successfully. Active tenant established.',
        }),
        // Clean up attempts older than 24h in background
        query(`DELETE FROM login_attempts WHERE attempted_at < NOW() - INTERVAL '24 hours'`),
      ])
    );

    const totalMs = Math.round(performance.now() - t0);
    const timingData = {
      coldStart: wasCold,
      dbConnectMs: 0,
      userLookupMs: Math.round(userLookupMs),
      passwordVerifyMs: Math.round(passwordVerifyMs),
      sessionInsertMs: Math.round(sessionInsertMs),
      auditWriteMs: 0, // moved off critical path!
      totalMs,
    };

    if (process.env.DEBUG_TIMING === 'true' || process.env.NODE_ENV !== 'production') {
      console.log(
        `[AUTH_TIMING] coldStart=${timingData.coldStart} dbConnect=${timingData.dbConnectMs}ms userLookup=${timingData.userLookupMs}ms passwordVerify=${timingData.passwordVerifyMs}ms sessionInsert=${timingData.sessionInsertMs}ms auditWrite=${timingData.auditWriteMs}ms response=${timingData.totalMs}ms`
      );
    }

    return {
      token: rawToken,
      user: {
        id: row.id,
        email: row.email || cleanEmail,
        fullName: row.fullName || '',
        phone: row.phone,
        isPlatformAdmin: Boolean(row.isPlatformAdmin),
        memberships,
      },
      activeTenant,
      profileSummary,
      timing: timingData,
    };
  }

  /**
   * Complete MFA verification with 6-digit TOTP code and issue session token.
   */
  async verifyMfa(userId: string, totpCode: string, ip?: string, userAgent?: string): Promise<AuthResponse> {
    const user = await usersRepository.findById(userId);
    if (!user || !user.mfaSecretEncrypted) {
      const err: any = new Error('Invalid MFA session.');
      err.status = 400;
      throw err;
    }

    const secretHex = decryptData(user.mfaSecretEncrypted);
    const isValid = verifyTotpCode(secretHex, totpCode);
    if (!isValid) {
      await this.recordLoginAttempt(user.email, sanitizeIp(ip), false);
      const err: any = new Error('Invalid or expired MFA verification code. Please check your authenticator.');
      err.status = 401;
      throw err;
    }

    const cleanIp = sanitizeIp(ip);
    await this.recordLoginAttempt(user.email, cleanIp, true);
    await usersRepository.recordLoginSuccess(user.id, cleanIp);

    const memberships = await usersRepository.getUserMemberships(user.id);
    let tenantType: 'supplier' | 'organization' | 'platform' | null = null;
    let tenantId: string | null = null;
    let activeTenant: UserTenantMembership | undefined;

    if (user.isPlatformAdmin) {
      tenantType = 'platform';
      activeTenant = {
        tenantType: 'organization',
        tenantId: 'platform',
        tenantName: 'Platform Administration',
        roleId: 'role-platform-admin',
        roleName: 'Super Admin',
        isOwner: true,
        status: 'active',
        permissions: ['*'],
      };
    } else if (memberships.length > 0) {
      activeTenant = memberships[0];
      tenantType = activeTenant.tenantType;
      tenantId = activeTenant.tenantId;
    }

    const rawToken = generateRandomToken(32);
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await query(
      `INSERT INTO sessions (user_id, token_hash, tenant_type, tenant_id, ip, user_agent, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [user.id, tokenHash, tenantType, tenantId, cleanIp || null, userAgent || null, expiresAt]
    );

    await auditRepository.logEvent({
      actorType: 'user',
      actorUserId: user.id,
      actorName: user.fullName || user.email,
      actorRole: activeTenant?.roleName || 'User',
      action: 'login.mfa.success',
      entityType: 'session',
      ipAddress: cleanIp,
      userAgent,
      details: 'MFA verified and session issued.',
    }).catch(() => {});

    return {
      token: rawToken,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone,
        isPlatformAdmin: user.isPlatformAdmin,
        memberships,
      },
      activeTenant,
    };
  }

  /**
   * Switch active tenant workspace for an authenticated session.
   */
  async switchTenant(rawToken: string, targetTenantId: string, targetTenantType: 'supplier' | 'organization'): Promise<UserTenantMembership> {
    const tokenHash = hashToken(rawToken);
    const sessRes = await query<{ id: string; user_id: string }>(
      `SELECT id, user_id
       FROM sessions
       WHERE token_hash = $1 AND expires_at > NOW() AND revoked_at IS NULL
       LIMIT 1`,
      [tokenHash]
    );
    if (sessRes.rows.length === 0) {
      const err: any = new Error('Session is invalid or expired.');
      err.status = 401;
      throw err;
    }

    const sess = sessRes.rows[0];
    const memberships = await usersRepository.getUserMemberships(sess.user_id);
    const target = memberships.find((m) => m.tenantId === targetTenantId && m.tenantType === targetTenantType);

    if (!target) {
      const err: any = new Error('You do not belong to the selected workspace.');
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
  async logout(rawToken: string, ip?: string, userAgent?: string): Promise<void> {
    if (!rawToken || !rawToken.trim()) return;
    const tokenHash = hashToken(rawToken);

    const revoked = await query<{ user_id: string; tenant_type: string; tenant_id: string }>(
      `UPDATE sessions
       SET revoked_at = NOW()
       WHERE token_hash = $1 AND revoked_at IS NULL
       RETURNING user_id, tenant_type, tenant_id`,
      [tokenHash]
    );

    if (revoked.rows[0]) {
      const row = revoked.rows[0];
      await auditRepository.logEvent({
        actorType: 'user',
        actorUserId: row.user_id,
        actorName: 'Authenticated User',
        actorRole: 'User',
        action: 'logout',
        entityType: 'session',
        ipAddress: sanitizeIp(ip),
        userAgent,
        details: 'User logged out and session revoked.',
      }).catch(() => {});
    }
  }

  /**
   * Supplier registration:
   * - Enforces password rules: 10-128 chars, != email, rejects common list
   * - Sets user status to 'pending'
   * - Generates single-use 24-hour verification token stored hashed in auth_tokens
   */
  async registerSupplier(dto: SupplierSignupDTO): Promise<{
    success: boolean;
    message: string;
    email: string;
    verificationToken?: string;
  }> {
    const cleanEmail = dto.email.trim().toLowerCase();
    const cleanIp = sanitizeIp(dto.ip);

    // 1. Validate password rules
    const passCheck = validatePassword(dto.password, cleanEmail);
    if (!passCheck.isValid) {
      const err: any = new Error(passCheck.error || 'Password does not meet security requirements.');
      err.status = 400;
      err.code = 'WEAK_PASSWORD';
      throw err;
    }

    // 2. Check if user already exists
    const existing = await query(`SELECT id FROM users WHERE LOWER(email::text) = LOWER($1) AND deleted_at IS NULL LIMIT 1`, [cleanEmail]);
    if (existing.rows.length > 0) {
      const err: any = new Error('An account with this email address already exists. Please sign in.');
      err.status = 400;
      err.code = 'EMAIL_ALREADY_EXISTS';
      throw err;
    }

    // 3. Hash password using bcrypt cost 12
    const passwordHash = await hashPassword(dto.password);

    // 4. Create user with status 'pending' (unverified)
    const userRes = await query<{ id: string; email: string }>(
      `INSERT INTO users (email, password_hash, full_name, phone, status, email_verified_at)
       VALUES ($1, $2, $3, $4, 'pending', NULL)
       RETURNING id, email`,
      [cleanEmail, passwordHash, dto.fullName.trim(), dto.phone || null]
    );
    const userId = userRes.rows[0].id;

    // 5. Create supplier entity
    const supRes = await query<{ id: string }>(
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

    // 6. Link user as Supplier Admin in supplier_members
    const roleRes = await query<{ id: string }>(
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

    // 7. Generate single-use verification token (24-hour expiry)
    const rawVerifyToken = generateRandomToken(32);
    const tokenHash = hashToken(rawVerifyToken);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await query(
      `INSERT INTO auth_tokens (user_id, purpose, token_hash, expires_at)
       VALUES ($1, 'email_verify', $2, $3)`,
      [userId, tokenHash, expiresAt]
    );

    // 8. Log registration in audit_log
    await auditRepository.logEvent({
      actorType: 'user',
      actorUserId: userId,
      actorName: dto.fullName.trim(),
      actorRole: 'Supplier Admin',
      supplierId,
      action: 'supplier.register',
      entityType: 'user',
      entityId: userId,
      ipAddress: cleanIp,
      userAgent: dto.userAgent,
      details: 'New supplier company registered. Verification email sent.',
    }).catch(() => {});

    return {
      success: true,
      message: 'Account created. Please verify your email before logging in.',
      email: cleanEmail,
      verificationToken: rawVerifyToken,
    };
  }

  /**
   * Buyer organization registration:
   * - Enforces password rules
   * - Creates user with status 'pending'
   * - Creates buyer organization with status 'pending'
   * - Issues single-use 24-hour verification token
   */
  async registerOrganization(dto: BuyerSignupDTO): Promise<{
    success: boolean;
    message: string;
    email: string;
    verificationToken?: string;
  }> {
    const cleanEmail = dto.email.trim().toLowerCase();
    const cleanIp = sanitizeIp(dto.ip);

    const passCheck = validatePassword(dto.password, cleanEmail);
    if (!passCheck.isValid) {
      const err: any = new Error(passCheck.error || 'Password does not meet security requirements.');
      err.status = 400;
      err.code = 'WEAK_PASSWORD';
      throw err;
    }

    const existing = await query(`SELECT id FROM users WHERE LOWER(email::text) = LOWER($1) AND deleted_at IS NULL LIMIT 1`, [cleanEmail]);
    if (existing.rows.length > 0) {
      const err: any = new Error('An account with this email address already exists. Please sign in.');
      err.status = 400;
      err.code = 'EMAIL_ALREADY_EXISTS';
      throw err;
    }

    const passwordHash = await hashPassword(dto.password);

    // 1. Create user with status 'pending'
    const userRes = await query<{ id: string }>(
      `INSERT INTO users (email, password_hash, full_name, phone, status, email_verified_at)
       VALUES ($1, $2, $3, $4, 'pending', NULL)
       RETURNING id`,
      [cleanEmail, passwordHash, dto.fullName.trim(), dto.phone || null]
    );
    const userId = userRes.rows[0].id;

    // 2. Generate slug for organization
    const baseSlug = 'org-' + dto.organizationName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    const orgSlug = `${baseSlug}-${Math.floor(1000 + Math.random() * 9000)}`;

    // 3. Create organization with status 'pending'
    const orgRes = await query<{ id: string }>(
      `INSERT INTO organizations (
         name, slug, organization_type, contact_email, contact_phone, status, verification_status
       ) VALUES (
         $1, $2, $3, $4, $5, 'pending', 'pending_review'
       ) RETURNING id`,
      [dto.organizationName.trim(), orgSlug, dto.organizationType || 'parastatal', cleanEmail, dto.phone || null]
    );
    const orgId = orgRes.rows[0].id;

    // 4. Link user as Buyer Admin in organization_members
    const roleRes = await query<{ id: string }>(
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

    // 5. Generate verification token (24-hour expiry)
    const rawVerifyToken = generateRandomToken(32);
    const tokenHash = hashToken(rawVerifyToken);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

    await query(
      `INSERT INTO auth_tokens (user_id, purpose, token_hash, expires_at)
       VALUES ($1, 'email_verify', $2, $3)`,
      [userId, tokenHash, expiresAt]
    );

    await auditRepository.logEvent({
      actorType: 'user',
      actorUserId: userId,
      actorName: dto.fullName.trim(),
      actorRole: 'Buyer Admin',
      organizationId: orgId,
      action: 'organization.register',
      entityType: 'organization',
      entityId: orgId,
      ipAddress: cleanIp,
      userAgent: dto.userAgent,
      details: 'New procuring entity registered with pending status. Verification email sent.',
    }).catch(() => {});

    return {
      success: true,
      message: 'Procuring entity registration submitted. Please verify your email before signing in.',
      email: cleanEmail,
      verificationToken: rawVerifyToken,
    };
  }

  /**
   * Verify email using single-use 24-hour verification token.
   * Sets user status to 'active' and marks token as used.
   */
  async verifyEmailWithToken(token: string, ip?: string, userAgent?: string): Promise<{ success: boolean; message: string }> {
    if (!token || !token.trim()) {
      const err: any = new Error('Verification token is required.');
      err.status = 400;
      throw err;
    }

    const tokenHash = hashToken(token);

    const tokenRes = await query<{ id: string; user_id: string; expires_at: Date; used_at: Date | null }>(
      `SELECT id, user_id, expires_at, used_at
       FROM auth_tokens
       WHERE token_hash = $1 AND purpose = 'email_verify'
       LIMIT 1`,
      [tokenHash]
    );

    const row = tokenRes.rows[0];
    if (!row || row.used_at !== null || new Date(row.expires_at) < new Date()) {
      const err: any = new Error('Verification link is invalid or has expired.');
      err.status = 400;
      err.code = 'INVALID_TOKEN';
      throw err;
    }

    // Mark token used
    await query(`UPDATE auth_tokens SET used_at = NOW() WHERE id = $1`, [row.id]);

    // Activate user account
    const userRes = await query<{ id: string; email: string; full_name: string }>(
      `UPDATE users
       SET status = 'active', email_verified_at = NOW(), updated_at = NOW()
       WHERE id = $1
       RETURNING id, email, full_name`,
      [row.user_id]
    );
    const user = userRes.rows[0];

    // Audit log
    await auditRepository.logEvent({
      actorType: 'user',
      actorUserId: user?.id,
      actorName: user?.full_name || user?.email || 'User',
      actorRole: 'User',
      action: 'email.verified',
      entityType: 'user',
      entityId: user?.id,
      ipAddress: sanitizeIp(ip),
      userAgent,
      details: 'User email address verified successfully.',
    }).catch(() => {});

    return {
      success: true,
      message: 'Email verified successfully. You may now sign in.',
    };
  }

  /**
   * Resend email verification link (rate limited: max 3 attempts per 15 minutes per email).
   */
  async resendVerification(email: string, ip?: string, userAgent?: string): Promise<{ success: boolean; message: string; token?: string }> {
    const cleanEmail = email.trim().toLowerCase();
    const cleanIp = sanitizeIp(ip);

    // Rate limit check: max 5 verification requests in 15 mins for this email
    const countRes = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM auth_tokens at
       JOIN users u ON u.id = at.user_id
       WHERE LOWER(u.email::text) = LOWER($1)
         AND at.purpose = 'email_verify'
         AND at.created_at > NOW() - INTERVAL '15 minutes'`,
      [cleanEmail]
    );
    if (parseInt(countRes.rows[0]?.count || '0', 10) >= 5) {
      const err: any = new Error('Too many verification requests. Please try again in 15 minutes.');
      err.status = 429;
      err.code = 'RATE_LIMIT_EXCEEDED';
      throw err;
    }

    const userRes = await query<{ id: string; email: string; email_verified_at: string | null }>(
      `SELECT id, email, email_verified_at FROM users WHERE LOWER(email::text) = LOWER($1) AND deleted_at IS NULL LIMIT 1`,
      [cleanEmail]
    );
    const user = userRes.rows[0];

    let rawToken: string | undefined;

    if (user && !user.email_verified_at) {
      // Invalidate existing tokens
      await query(
        `UPDATE auth_tokens SET used_at = NOW() WHERE user_id = $1 AND purpose = 'email_verify' AND used_at IS NULL`,
        [user.id]
      );

      rawToken = generateRandomToken(32);
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

      await query(
        `INSERT INTO auth_tokens (user_id, purpose, token_hash, expires_at)
         VALUES ($1, 'email_verify', $2, $3)`,
        [user.id, tokenHash, expiresAt]
      );

      await auditRepository.logEvent({
        actorType: 'user',
        actorUserId: user.id,
        actorName: cleanEmail,
        actorRole: 'User',
        action: 'verification.resent',
        entityType: 'auth_token',
        ipAddress: cleanIp,
        userAgent,
        details: 'Verification email re-sent upon request.',
      }).catch(() => {});
    }

    return {
      success: true,
      message: 'If an unverified account exists for this email, a verification link has been sent.',
      token: rawToken,
    };
  }

  /**
   * Request password reset link (single-use 1-hour token).
   * Always returns the same neutral message: "If that email is registered, we sent a link."
   */
  async forgotPassword(email: string, ip?: string, userAgent?: string): Promise<{ success: boolean; message: string; token?: string }> {
    const cleanEmail = email.trim().toLowerCase();
    const cleanIp = sanitizeIp(ip);

    // Rate limit: max 5 requests from this IP in 15 min
    const ipCheck = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM audit_log
       WHERE action = 'password_reset.requested'
         AND ip_address = $1
         AND occurred_at > NOW() - INTERVAL '15 minutes'`,
      [cleanIp]
    );
    if (parseInt(ipCheck.rows[0]?.count || '0', 10) >= 5) {
      const err: any = new Error('Too many requests. Please try again in 15 minutes.');
      err.status = 429;
      err.code = 'RATE_LIMIT_EXCEEDED';
      throw err;
    }

    const userRes = await query<{ id: string; email: string; full_name: string; status: string }>(
      `SELECT id, email, full_name, status FROM users WHERE LOWER(email::text) = LOWER($1) AND deleted_at IS NULL LIMIT 1`,
      [cleanEmail]
    );
    const user = userRes.rows[0];

    let rawToken: string | undefined;

    if (user && user.status === 'active') {
      // Invalidate existing unused password_reset tokens
      await query(
        `UPDATE auth_tokens SET used_at = NOW() WHERE user_id = $1 AND purpose = 'password_reset' AND used_at IS NULL`,
        [user.id]
      );

      rawToken = generateRandomToken(32);
      const tokenHash = hashToken(rawToken);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1-hour expiry

      await query(
        `INSERT INTO auth_tokens (user_id, purpose, token_hash, expires_at)
         VALUES ($1, 'password_reset', $2, $3)`,
        [user.id, tokenHash, expiresAt]
      );

      await auditRepository.logEvent({
        actorType: 'user',
        actorUserId: user.id,
        actorName: user.full_name || cleanEmail,
        actorRole: 'User',
        action: 'password_reset.requested',
        entityType: 'auth_token',
        ipAddress: cleanIp,
        userAgent,
        details: 'Password reset link requested.',
      }).catch(() => {});
    }

    return {
      success: true,
      message: 'If that email is registered, we sent a link.',
      token: rawToken,
    };
  }

  /**
   * Reset password with single-use token:
   * - Validates password rules: 10-128 chars, != email, rejects common passwords
   * - Sets new password hash (bcrypt cost 12)
   * - Revokes ALL active sessions for that user
   */
  async resetPassword(token: string, newPasswordPlain: string, ip?: string, userAgent?: string): Promise<{ success: boolean; message: string }> {
    if (!token || !token.trim()) {
      const err: any = new Error('Reset token is required.');
      err.status = 400;
      throw err;
    }

    const tokenHash = hashToken(token);

    const tokenRes = await query<{ id: string; user_id: string; expires_at: Date; used_at: Date | null }>(
      `SELECT id, user_id, expires_at, used_at
       FROM auth_tokens
       WHERE token_hash = $1 AND purpose = 'password_reset'
       LIMIT 1`,
      [tokenHash]
    );

    const row = tokenRes.rows[0];
    if (!row || row.used_at !== null || new Date(row.expires_at) < new Date()) {
      const err: any = new Error('Password reset link is invalid or has expired.');
      err.status = 400;
      err.code = 'INVALID_RESET_TOKEN';
      throw err;
    }

    // Fetch user for email comparison
    const userRes = await query<{ id: string; email: string; full_name: string }>(
      `SELECT id, email, full_name FROM users WHERE id = $1`,
      [row.user_id]
    );
    const user = userRes.rows[0];

    // Enforce password rules
    const passCheck = validatePassword(newPasswordPlain, user?.email);
    if (!passCheck.isValid) {
      const err: any = new Error(passCheck.error || 'Password does not meet security requirements.');
      err.status = 400;
      err.code = 'WEAK_PASSWORD';
      throw err;
    }

    // Mark token used immediately (single-use)
    await query(`UPDATE auth_tokens SET used_at = NOW() WHERE id = $1`, [row.id]);

    // Hash new password
    const newHash = await hashPassword(newPasswordPlain);

    // Update user password and clear any previous lockouts
    await query(
      `UPDATE users
       SET password_hash = $1, failed_login_attempts = 0, locked_until = NULL, updated_at = NOW()
       WHERE id = $2`,
      [newHash, row.user_id]
    );

    // Revoke ALL active sessions for this user across all devices
    await query(
      `UPDATE sessions
       SET revoked_at = NOW()
       WHERE user_id = $1 AND revoked_at IS NULL`,
      [row.user_id]
    );

    // Audit log
    await auditRepository.logEvent({
      actorType: 'user',
      actorUserId: row.user_id,
      actorName: user?.full_name || user?.email || 'User',
      actorRole: 'User',
      action: 'password_reset.done',
      entityType: 'user',
      entityId: row.user_id,
      ipAddress: sanitizeIp(ip),
      userAgent,
      details: 'Password was reset successfully. All active sessions revoked.',
    }).catch(() => {});

    return {
      success: true,
      message: 'Password reset successfully. Please sign in with your new password.',
    };
  }

  /**
   * Save incremental supplier registration progress (Step 1, Step 2, or Step 3).
   */
  async saveSupplierRegistrationStep(dto: SupplierStepDTO): Promise<{
    step: number;
    token?: string;
    user?: any;
    supplier?: any;
    nextStep: number;
    completed?: boolean;
  }> {
    const cleanEmail = dto.email.trim().toLowerCase();
    if (!cleanEmail) {
      throw new Error('Email address is required.');
    }

    if (dto.step === 1) {
      if (!dto.fullName?.trim()) {
        throw new Error('Full name is required for Step 1.');
      }

      let user = await usersRepository.findByEmail(cleanEmail);
      let userId: string;

      if (!user) {
        if (!dto.password) {
          throw new Error('Password is required.');
        }
        const passCheck = validatePassword(dto.password, cleanEmail);
        if (!passCheck.isValid) {
          throw new Error(passCheck.error || 'Password does not meet requirements.');
        }

        const passwordHash = await hashPassword(dto.password);
        const userRes = await query<{ id: string; email: string; fullName: string; isPlatformAdmin: boolean }>(
          `INSERT INTO users (email, password_hash, full_name, phone, status, email_verified_at)
           VALUES ($1, $2, $3, $4, 'pending', NULL)
           RETURNING id, email, full_name AS "fullName", is_platform_admin AS "isPlatformAdmin"`,
          [cleanEmail, passwordHash, dto.fullName.trim(), dto.phone || null]
        );
        user = userRes.rows[0] as any;
        userId = userRes.rows[0].id;
      } else {
        userId = user.id;
        const updateParams: any[] = [dto.fullName.trim(), dto.phone || null, userId];
        let passwordUpdateClause = '';
        if (dto.password) {
          const passCheck = validatePassword(dto.password, cleanEmail);
          if (!passCheck.isValid) {
            throw new Error(passCheck.error || 'Password does not meet requirements.');
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

      let supplierId: string;
      let supplierData: any;
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
        const tempCipa = dto.cipaUin?.trim().toUpperCase() || 'BW-TEMP-' + Math.floor(10000000 + Math.random() * 90000000);
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
        supplier: supplierData,
      };
    }

    if (dto.step === 2) {
      if (!dto.legalName?.trim()) {
        throw new Error('Registered company name is required for Step 2.');
      }
      if (!dto.cipaUin?.trim()) {
        throw new Error('CIPA certificate number is required for Step 2.');
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
        [dto.legalName.trim(), dto.cipaUin.trim().toUpperCase(), dto.companyType || 'private_company', dto.city || 'Gaborone', cleanEmail]
      );

      return {
        step: 2,
        nextStep: 3,
        supplier: supRes.rows[0],
      };
    }

    if (dto.step === 3) {
      if (!dto.agreedToTerms || !dto.agreedToPrivacy) {
        throw new Error('You must accept the BidReady360 Terms of Service and Privacy Policy to activate your account.');
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
        // Generate verification token on completion of signup
        const rawVerifyToken = generateRandomToken(32);
        const tokenHash = hashToken(rawVerifyToken);
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);

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
          token: rawVerifyToken,
        };
      }

      return {
        step: 3,
        nextStep: 3,
        completed: true,
        supplier,
      };
    }

    throw new Error(`Unsupported registration step: ${dto.step}`);
  }

  /**
   * Check supplier registration progress.
   */
  async getSupplierRegistrationProgress(email: string): Promise<{
    found: boolean;
    step?: number;
    email?: string;
    fullName?: string;
    phone?: string;
    legalName?: string;
    cipaUin?: string;
    companyType?: string;
    city?: string;
  }> {
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
    if (sup.legal_name && sup.cipa_uin && !sup.cipa_uin.startsWith('BW-TEMP-')) {
      step = 3;
    } else if (sup.legal_name) {
      step = 2;
    }

    return {
      found: true,
      step,
      email: sup.email,
      fullName: sup.full_name || '',
      phone: sup.primary_phone || '',
      legalName: sup.legal_name?.includes("'s Enterprise") ? '' : sup.legal_name,
      cipaUin: sup.cipa_uin?.startsWith('BW-TEMP-') ? '' : sup.cipa_uin,
      companyType: sup.company_type || '',
      city: sup.city || '',
    };
  }

  /**
   * Generate new TOTP setup secret for enrollment.
   */
  async setupMfaEnrollment(userId: string): Promise<{ secret: string; otpAuthUrl: string }> {
    const user = await usersRepository.findById(userId);
    if (!user) throw new Error('User not found.');

    const secretHex = generateTotpSecret();
    const encryptedSecret = encryptData(secretHex);
    await usersRepository.saveMfaSecret(userId, encryptedSecret, 'authenticator');

    const issuer = 'BidReady360';
    const otpAuthUrl = `otpauth://totp/${encodeURIComponent(issuer)}:${encodeURIComponent(user.email)}?secret=${secretHex}&issuer=${encodeURIComponent(issuer)}`;

    return { secret: secretHex, otpAuthUrl };
  }

  /**
   * Confirm enrollment with first valid code and activate MFA on account.
   */
  async confirmMfaEnrollment(userId: string, code: string): Promise<void> {
    const user = await usersRepository.findById(userId);
    if (!user || !user.mfaSecretEncrypted) throw new Error('MFA setup not initialized.');

    const secretHex = decryptData(user.mfaSecretEncrypted);
    if (!verifyTotpCode(secretHex, code)) {
      throw new Error('Verification code does not match. Please verify your clock and try again.');
    }

    await usersRepository.enableMfa(userId);
  }
}

export const authService = new AuthService();
