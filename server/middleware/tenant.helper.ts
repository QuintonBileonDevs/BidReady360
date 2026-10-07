import { Request } from 'express';

export interface TenantContext {
  userId: string;
  userEmail: string;
  isPlatformAdmin: boolean;
  tenantType: 'organization' | 'supplier';
  tenantId: string;
  tenantName: string;
  roleName: string;
  isOwner: boolean;
  permissions: Set<string>;
}

/**
 * Extract verified tenant context from the authenticated request.
 * Throws if the caller is not authenticated or not attached to a tenant.
 */
export function getTenantContext(req: Request): TenantContext {
  if (!req.user) {
    throw new Error('Unauthenticated request: user session missing.');
  }

  if (!req.activeTenant) {
    throw new Error('Tenant context missing: user has no active organization or supplier workspace.');
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
    permissions: req.permissions || new Set<string>(),
  };
}

/**
 * Enforce organization tenant check.
 */
export function getOrganizationContext(req: Request): TenantContext {
  const ctx = getTenantContext(req);
  if (ctx.tenantType !== 'organization' && !ctx.isPlatformAdmin) {
    throw new Error('Access denied: active workspace is not a buying organization.');
  }
  return ctx;
}

/**
 * Enforce supplier tenant check.
 */
export function getSupplierContext(req: Request): TenantContext {
  const ctx = getTenantContext(req);
  if (ctx.tenantType !== 'supplier' && !ctx.isPlatformAdmin) {
    throw new Error('Access denied: active workspace is not a supplier account.');
  }
  return ctx;
}
