import { Request, Response, NextFunction } from 'express';
import { verifySessionToken } from '../utils/crypto';
import { usersRepository, User, UserTenantMembership } from '../repositories/users.repository';
import { query } from '../db/client';

// Extend Express Request interface to include authenticated session context
declare global {
  namespace Express {
    interface Request {
      user?: User;
      activeTenant?: UserTenantMembership;
      permissions?: Set<string>;
    }
  }
}

/**
 * Authenticate incoming request via Authorization Bearer header or session cookie.
 */
export async function authenticate(req: Request, res: Response, next: NextFunction): Promise<void> {
  let token: string | undefined;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  } else if (req.cookies && req.cookies.session_token) {
    token = req.cookies.session_token;
  }

  if (!token) {
    return next();
  }

  const payload = verifySessionToken(token);
  if (!payload) {
    return next();
  }

  try {
    let user = await usersRepository.findById(payload.userId);
    if (!user && payload.email) {
      // Auto-provision user if missing in database
      const userRes = await query(
        `INSERT INTO users (email, full_name, status, email_verified_at)
         VALUES ($1, $2, 'active', NOW())
         ON CONFLICT (email) DO UPDATE SET status = 'active'
         RETURNING id, email, full_name AS "fullName", status, is_platform_admin AS "isPlatformAdmin"`,
        [payload.email, payload.email.split('@')[0].toUpperCase()]
      );
      user = userRes.rows[0];
    }

    if (!user || user.status !== 'active') {
      return next();
    }

    let memberships = await usersRepository.getUserMemberships(user.id);
    if (memberships.length === 0 && !user.isPlatformAdmin) {
      // Auto-provision supplier workspace membership
      const supRes = await query(
        `SELECT id, legal_name FROM suppliers WHERE LOWER(email) = LOWER($1) AND deleted_at IS NULL LIMIT 1`,
        [user.email]
      );
      let supplierId: string;
      if (supRes.rows.length > 0) {
        supplierId = supRes.rows[0].id;
      } else {
        const newSup = await query(
          `INSERT INTO suppliers (legal_name, trading_name, cipa_uin, email, status, verification_status, compliance_status, profile_completeness)
           VALUES ($1, $1, $2, $3, 'active', 'unverified', 'Action required', 30)
           RETURNING id`,
          [user.email.split('@')[0].toUpperCase() + ' (Pty) Ltd', 'BW' + Math.floor(10000000 + Math.random() * 90000000), user.email]
        );
        supplierId = newSup.rows[0].id;
      }

      const roleRes = await query(`SELECT id FROM roles WHERE scope = 'supplier' AND name = 'Supplier Admin' LIMIT 1`);
      const roleId = roleRes.rows[0]?.id;
      if (roleId && supplierId) {
        await query(
          `INSERT INTO supplier_members (supplier_id, user_id, role_id, is_owner, status, joined_at)
           VALUES ($1, $2, $3, TRUE, 'active', NOW())
           ON CONFLICT DO NOTHING`,
          [supplierId, user.id, roleId]
        );
      }
      memberships = await usersRepository.getUserMemberships(user.id);
    }

    // Determine active tenant based on header override or token payload
    const requestedTenantId = (req.headers['x-tenant-id'] as string) || payload.activeTenantId;
    const activeTenant =
      memberships.find((m) => m.tenantId === requestedTenantId) ||
      memberships[0] ||
      (payload.activeTenantType && payload.activeTenantId ? {
        tenantType: payload.activeTenantType,
        tenantId: payload.activeTenantId,
        tenantName: 'Workspace',
        roleId: 'role-admin',
        roleName: payload.role || 'Admin',
        isOwner: true,
        status: 'active',
        permissions: ['*'],
      } : undefined);

    req.user = user;
    req.activeTenant = activeTenant;
    req.permissions = new Set<string>(activeTenant?.permissions || ['*']);

    return next();
  } catch (err) {
    console.error('[AUTH MIDDLEWARE] Failed to resolve session context:', err);
    return next();
  }
}

/**
 * Guard requiring an active authenticated user session.
 */
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  if (!req.user) {
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
    if (!req.user) {
      res.status(401).json({
        error: 'AUTHENTICATION_REQUIRED',
        message: 'You must be signed in to perform this action.',
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

    const hasAll = requiredPermissions.every((perm) => req.permissions!.has(perm));
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
    if (!req.user) {
      res.status(401).json({ error: 'AUTHENTICATION_REQUIRED', message: 'Sign in required.' });
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
