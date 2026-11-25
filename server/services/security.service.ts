import { query } from '../db/client';
import { sanitizeIp } from '../utils/ip';

export interface LoginRateLimitCheck {
  isAllowed: boolean;
  message?: string;
}

export class SecurityService {
  /**
   * Check brute-force login rate limits:
   * Max 5 failures for the same email within 15 minutes, or
   * Max 20 failures from the same IP within 15 minutes.
   */
  async checkLoginRateLimit(emailNorm: string, ip?: string): Promise<LoginRateLimitCheck> {
    const cleanEmail = emailNorm.trim().toLowerCase();
    const sanitizedIp = sanitizeIp(ip);

    // 1. Check failures by email in last 15 minutes
    const emailRes = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM login_attempts
       WHERE email_norm = $1
         AND succeeded = FALSE
         AND attempted_at > NOW() - INTERVAL '15 minutes'`,
      [cleanEmail]
    );

    const emailFailures = parseInt(emailRes.rows[0]?.count || '0', 10);
    if (emailFailures >= 5) {
      await this.recordAudit({
        action: 'lockout',
        details: `Brute-force lockout triggered for email ${cleanEmail} (${emailFailures} consecutive failures).`,
        ip: sanitizedIp,
      });
      return {
        isAllowed: false,
        message: 'Too many attempts. Try again in 15 minutes.',
      };
    }

    // 2. Check failures by IP in last 15 minutes
    if (sanitizedIp) {
      const ipRes = await query<{ count: string }>(
        `SELECT COUNT(*)::text AS count
         FROM login_attempts
         WHERE ip = $1
           AND succeeded = FALSE
           AND attempted_at > NOW() - INTERVAL '15 minutes'`,
        [sanitizedIp]
      );

      const ipFailures = parseInt(ipRes.rows[0]?.count || '0', 10);
      if (ipFailures >= 20) {
        await this.recordAudit({
          action: 'lockout',
          details: `Brute-force IP lockout triggered for IP ${sanitizedIp} (${ipFailures} consecutive failures).`,
          ip: sanitizedIp,
        });
        return {
          isAllowed: false,
          message: 'Too many attempts. Try again in 15 minutes.',
        };
      }
    }

    return { isAllowed: true };
  }

  /**
   * Rate limit action (sign-up, resend verification, forgot password)
   */
  async checkActionRateLimit(
    actionName: string,
    identifier: string,
    limit = 5,
    windowMinutes = 15
  ): Promise<boolean> {
    const cleanId = identifier.trim().toLowerCase();
    const res = await query<{ count: string }>(
      `SELECT COUNT(*)::text AS count
       FROM audit_log
       WHERE action = $1
         AND details LIKE $2
         AND occurred_at > NOW() - ($3 || ' minutes')::interval`,
      [actionName, `%${cleanId}%`, String(windowMinutes)]
    );
    const count = parseInt(res.rows[0]?.count || '0', 10);
    return count < limit;
  }

  /**
   * Record every login attempt in login_attempts table.
   */
  async recordLoginAttempt(emailNorm: string, ip: string | undefined, succeeded: boolean): Promise<void> {
    const cleanEmail = emailNorm.trim().toLowerCase();
    const sanitizedIp = sanitizeIp(ip);
    await query(
      `INSERT INTO login_attempts (email_norm, ip, succeeded, attempted_at)
       VALUES ($1, $2, $3, NOW())`,
      [cleanEmail, sanitizedIp, succeeded]
    );
  }

  /**
   * Write forensic event to audit_log table. Never puts passwords or tokens in it.
   */
  async recordAudit(params: {
    action: string;
    actorUserId?: string | null;
    actorName?: string | null;
    actorRole?: string | null;
    organizationId?: string | null;
    supplierId?: string | null;
    organizationName?: string | null;
    entityType?: string | null;
    entityId?: string | null;
    ip?: string | null;
    userAgent?: string | null;
    details?: string | null;
  }): Promise<void> {
    try {
      const sanitizedIp = sanitizeIp(params.ip);
      await query(
        `INSERT INTO audit_log (
           action, actor_user_id, actor_name, actor_role, organization_id, supplier_id,
           organization_name, entity_type, entity_id, ip_address, user_agent, details, occurred_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, NOW())`,
        [
          params.action,
          params.actorUserId || null,
          params.actorName || null,
          params.actorRole || null,
          params.organizationId || null,
          params.supplierId || null,
          params.organizationName || null,
          params.entityType || null,
          params.entityId || null,
          sanitizedIp,
          params.userAgent || null,
          params.details || null,
        ]
      );
    } catch (err: any) {
      console.warn('[SECURITY SERVICE] Failed to record audit log:', err.message);
    }
  }
}

export const securityService = new SecurityService();
