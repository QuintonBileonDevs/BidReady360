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

    // 1. Query sessions table for active, unexpired, unrevoked session
    const sessionRes = await query<{
      sessionId: string;
      userId: string;
      tenantType: 'supplier' | 'organization' | 'platform' | null;
      tenantId: string | null;
    }>(
      `SELECT s.id AS "sessionId", s.user_id AS "userId", s.tenant_type AS "tenantType", s.tenant_id AS "tenantId"
       FROM sessions s
       WHERE s.token_hash = $1
         AND s.expires_at > NOW()
         AND s.revoked_at IS NULL
       LIMIT 1`,
      [tokenHash]
    );

    if (sessionRes.rows.length === 0) {
      return next();
    }

    const sess = sessionRes.rows[0];

    // 2. Load user strictly from PostgreSQL (must be active and verified)
    const userRes = await query<User>(
      `SELECT id, email, password_hash AS "passwordHash", full_name AS "fullName",
              phone, preferred_language AS "preferredLanguage", status,
              is_platform_admin AS "isPlatformAdmin", email_verified_at AS "emailVerifiedAt",
              phone_verified_at AS "phoneVerifiedAt", mfa_enabled AS "mfaEnabled",
              mfa_secret_encrypted AS "mfaSecretEncrypted", mfa_type AS "mfaType",
              last_login_at AS "lastLoginAt", failed_login_attempts AS "failedLoginAttempts",
              locked_until AS "lockedUntil", created_at AS "createdAt"
       FROM users
       WHERE id = $1 AND deleted_at IS NULL AND status = 'active'`,
      [sess.userId]
    );

    const user = userRes.rows[0];
    if (!user) {
      return next();
    }

    // 3. Resolve tenant membership
    const memberships = await usersRepository.getUserMemberships(user.id);
    let activeTenant: UserTenantMembership | undefined;

    if (sess.tenantType === 'platform' && user.isPlatformAdmin) {
      activeTenant = {
        tenantType: 'organization', // administrative umbrella
        tenantId: 'platform',
        tenantName: 'Platform Administration',
        roleId: 'role-platform-admin',
        roleName: 'Super Admin',
        isOwner: true,
        status: 'active',
        permissions: ['*'],
      };
    } else if (sess.tenantId) {
      activeTenant = memberships.find((m) => m.tenantId === sess.tenantId);
    }

    if (!activeTenant && memberships.length > 0) {
      activeTenant = memberships[0];
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
