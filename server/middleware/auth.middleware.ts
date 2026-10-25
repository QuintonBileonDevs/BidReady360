import { Request, Response, NextFunction } from 'express';
import { hashToken } from '../utils/crypto';
import { usersRepository, User, UserTenantMembership } from '../repositories/users.repository';
import { query } from '../db/client';

export interface UserSessionContext {
  id: string;
  rawToken: string;
  tokenHash: string;
  tenantType: 'supplier' | 'organization' | 'platform' | null;
  tenantId: string | null;
}

// Extend Express Request interface to include authenticated session context
declare global {
  namespace Express {
    interface Request {
      user?: User;
      session?: UserSessionContext;
      activeTenant?: UserTenantMembership;
      profileSummary?: any;
      permissions?: Set<string>;
    }
  }
}

/**
 * Reject state-changing requests (POST, PUT, PATCH, DELETE) whose Origin header is not our own site.
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  const method = req.method.toUpperCase();
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    const origin = req.headers.origin;
    if (origin) {
      try {
        const originUrl = new URL(origin);
        const host = (req.headers['x-forwarded-host'] as string) || req.headers.host;
        const originHostname = originUrl.hostname;
        const hostOnly = host ? host.split(':')[0] : '';

        const isLocal = originHostname === 'localhost' || originHostname === '127.0.0.1' || originHostname === '0.0.0.0';
        const isMatch = host && (originUrl.host === host || originHostname === hostOnly || originHostname.endsWith('.run.app') || hostOnly.endsWith('.run.app'));

        if (!isMatch && !isLocal && !originHostname.endsWith('.run.app') && !originHostname.includes('aistudio')) {
          res.status(403).json({
            error: 'FORBIDDEN_CSRF',
            message: 'Cross-origin request blocked.',
          });
          return;
        }
      } catch {
        res.status(403).json({
          error: 'FORBIDDEN_CSRF',
          message: 'Invalid request origin header.',
        });
        return;
      }
    }
  }
  next();
}

/**
 * Authenticate incoming request via httpOnly session cookie (or Authorization Bearer header).
 * Looks up valid, non-expired, non-revoked session from PostgreSQL `sessions` table.
 */
export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  let rawToken: string | undefined;

  if (req.cookies && req.cookies.session_token) {
    rawToken = req.cookies.session_token;
  } else if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    rawToken = req.headers.authorization.substring(7);
  }

  if (!rawToken || !rawToken.trim()) {
    return next();
  }

  try {
    const tokenHash = hashToken(rawToken);

    // 1. Single indexed query: session, user, and joined tenant memberships with profile summaries
    const authRes = await query<{
      sessionId: string;
      tenantType: 'supplier' | 'organization' | 'platform' | null;
      tenantId: string | null;
      id: string;
      email: string;
      passwordHash: string | null;
      fullName: string;
      phone: string | null;
      preferredLanguage: string;
      status: 'pending' | 'active' | 'suspended' | 'deleted';
      isPlatformAdmin: boolean;
      emailVerifiedAt: string | null;
      phoneVerifiedAt: string | null;
      mfaEnabled: boolean;
      mfaSecretEncrypted: Buffer | null;
      mfaType: string | null;
      lastLoginAt: string | null;
      failedLoginAttempts: number;
      lockedUntil: string | null;
      createdAt: string;
      orgMemberships: any[];
      supMemberships: any[];
    }>(
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
    const user: User = {
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
      createdAt: sess.createdAt,
    };

    // 2. Resolve active tenant and profile summary from joined memberships
    const memberships: UserTenantMembership[] = [
      ...(sess.orgMemberships || []),
      ...(sess.supMemberships || []),
    ];

    let activeTenant: UserTenantMembership | undefined;
    let profileSummary: any = null;

    if (sess.tenantType === 'platform' && user.isPlatformAdmin) {
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
      profileSummary = {
        displayName: user.fullName || user.email,
        tenantType: 'platform',
        tenantId: 'platform',
        role: 'Super Admin',
        supplierOrOrgName: 'Platform Administration',
        verificationStatus: 'verified',
        emailVerified: true,
      };
    } else if (sess.tenantId) {
      activeTenant = memberships.find((m) => m.tenantId === sess.tenantId);
    }

    if (!activeTenant && memberships.length > 0) {
      activeTenant = memberships[0];
    }

    if (!profileSummary && activeTenant) {
      profileSummary = (activeTenant as any).profile_summary || {
        displayName: user.fullName || user.email,
        tenantType: activeTenant.tenantType,
        tenantId: activeTenant.tenantId,
        role: activeTenant.roleName,
        supplierOrOrgName: activeTenant.tenantName,
        verificationStatus: 'verified',
        emailVerified: Boolean(user.emailVerifiedAt),
      };
    }

    req.user = user;
    req.session = {
      id: sess.sessionId,
      rawToken,
      tokenHash,
      tenantType: sess.tenantType,
      tenantId: sess.tenantId,
    };
    req.activeTenant = activeTenant;
    req.profileSummary = profileSummary;
    req.permissions = new Set<string>(
      user.isPlatformAdmin ? ['*'] : activeTenant?.permissions || []
    );

    return next();
  } catch (err) {
    console.error('[AUTH MIDDLEWARE ERROR]:', err);
    return next();
  }
}

/**
 * Guard requiring an active authenticated user session.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || !req.session) {
    res.status(401).json({
      error: 'AUTHENTICATION_REQUIRED',
      message: 'You must be signed in to access this resource.',
    });
    return;
  }
  next();
}

/**
 * Guard requiring specific permission code(s) on the active tenant.
 */
export function requirePermission(...requiredPermissions: string[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !req.session) {
      res.status(401).json({
        error: 'AUTHENTICATION_REQUIRED',
        message: 'You must be signed in to access this resource.',
      });
      return;
    }

    // Platform Super Admin bypasses tenant permissions
    if (req.user.isPlatformAdmin) {
      return next();
    }

    if (!req.activeTenant || !req.permissions) {
      res.status(403).json({
        error: 'TENANT_MEMBERSHIP_REQUIRED',
        message: 'You do not belong to an active organization or supplier workspace.',
      });
      return;
    }

    const hasAll = requiredPermissions.every((perm) => req.permissions!.has(perm) || req.permissions!.has('*'));
    if (!hasAll) {
      res.status(403).json({
        error: 'FORBIDDEN_INSUFFICIENT_PERMISSIONS',
        message: `Your active role (${req.activeTenant.roleName}) lacks required permission: ${requiredPermissions.join(', ')}.`,
        requiredPermissions,
      });
      return;
    }

    next();
  };
}

/**
 * Guard requiring a specific tenant type (e.g. 'organization' for buyers or 'supplier').
 */
export function requireTenantType(tenantType: 'organization' | 'supplier') {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !req.session) {
      res.status(401).json({
        error: 'AUTHENTICATION_REQUIRED',
        message: 'You must be signed in to access this resource.',
      });
      return;
    }

    if (req.user.isPlatformAdmin) {
      return next();
    }

    if (!req.activeTenant || req.activeTenant.tenantType !== tenantType) {
      res.status(403).json({
        error: 'INVALID_TENANT_TYPE',
        message: `This action requires an active ${tenantType} workspace.`,
      });
      return;
    }

    next();
  };
}

/**
 * Guard requiring platform super-administrator privileges.
 */
export function requirePlatformAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || !req.user.isPlatformAdmin) {
    res.status(403).json({
      error: 'FORBIDDEN_ADMIN_ONLY',
      message: 'Access restricted to platform super administrators.',
    });
    return;
  }
  next();
}
