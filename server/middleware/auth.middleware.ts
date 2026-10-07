import { Request, Response, NextFunction } from 'express';
import { verifySessionToken } from '../utils/crypto';
import { usersRepository, User, UserTenantMembership } from '../repositories/users.repository';

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
    const user = await usersRepository.findById(payload.userId);
    if (!user || user.status !== 'active') {
      return next();
    }

    const memberships = await usersRepository.getUserMemberships(user.id);

    // Determine active tenant based on header override or token payload
    const requestedTenantId = (req.headers['x-tenant-id'] as string) || payload.activeTenantId;
    const activeTenant =
      memberships.find((m) => m.tenantId === requestedTenantId) ||
      memberships[0] ||
      undefined;

    req.user = user;
    req.activeTenant = activeTenant;
    req.permissions = new Set<string>(activeTenant?.permissions || []);

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
