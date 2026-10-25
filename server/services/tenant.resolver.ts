import { query } from '../db/client';
import { UserTenantMembership } from '../repositories/users.repository';

export interface ExtendedTenantMembership extends UserTenantMembership {
  lastActiveAt?: string | null;
  createdAt?: string | null;
}

/**
 * Deterministically resolves the active tenant for a user:
 * 1. If targetTenantId is specified and matches an active membership, use it.
 * 2. Fallback rule:
 *    a. Prefer supplier membership where is_owner = true
 *    b. Then the one most recently active (last_active_at descending)
 *    c. Then the oldest membership (created_at ascending)
 *    d. Alphabetical by tenantName
 * Never does a silent memberships[0].
 */
export function resolveDeterministicTenant(
  memberships: ExtendedTenantMembership[],
  targetTenantId?: string | null
): ExtendedTenantMembership | undefined {
  if (targetTenantId) {
    const match = memberships.find((m) => m.tenantId === targetTenantId && m.status === 'active');
    if (match) return match;
  }

  if (!memberships || memberships.length === 0) return undefined;

  const activeMems = memberships.filter((m) => m.status === 'active');
  if (activeMems.length === 0) return undefined;

  const sorted = [...activeMems].sort((a, b) => {
    // 1. Prefer isOwner = true
    if (Boolean(a.isOwner) !== Boolean(b.isOwner)) {
      return a.isOwner ? -1 : 1;
    }
    // 2. Most recently active (last_active_at descending)
    const timeA = a.lastActiveAt ? new Date(a.lastActiveAt).getTime() : 0;
    const timeB = b.lastActiveAt ? new Date(b.lastActiveAt).getTime() : 0;
    if (timeA !== timeB) {
      return timeB - timeA;
    }
    // 3. Oldest membership (created_at ascending)
    const createdA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const createdB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    if (createdA !== createdB) {
      return createdA - createdB;
    }
    return (a.tenantName || '').localeCompare(b.tenantName || '');
  });

  return sorted[0];
}

/**
 * Persists the resolved tenant to the user's active session in PostgreSQL.
 */
export async function persistActiveTenantToSession(
  sessionId: string,
  tenantType: 'supplier' | 'organization' | 'platform',
  tenantId: string | null
): Promise<void> {
  try {
    await query(
      `UPDATE sessions
       SET tenant_type = $1, tenant_id = $2
       WHERE id = $3`,
      [tenantType, tenantId, sessionId]
    );
  } catch (err: any) {
    console.error('[TENANT RESOLVER] Failed to persist active tenant to session:', err.message);
  }
}
