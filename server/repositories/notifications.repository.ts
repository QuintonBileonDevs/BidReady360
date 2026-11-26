import { PoolClient } from 'pg';
import { query } from '../db/client';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const ORG_FACING_LEGACY_EVENTS = [
  'organization_approved',
  'organization_rejected',
  'application_submitted',
  'application_withdrawn',
  'application_info_responded',
  'clarification_asked',
  'bid_submitted',
  'bid_withdrawn',
  'award_pending_approval',
  'award_decision',
];

export interface NotificationTenantScope {
  tenantType?: 'supplier' | 'organization' | 'platform' | null;
  tenantId?: string | null;
}

export interface NotificationRecord {
  id: string;
  userId: string;
  organizationId: string | null;
  supplierId: string | null;
  eventType: string;
  type: string;
  title: string;
  body: string | null;
  linkUrl: string | null;
  link: string | null;
  data: any;
  priority: 'urgent' | 'info' | 'success' | 'warning';
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
  recipientRole: 'Supplier' | 'Buyer';
}

export interface RenderedTemplate {
  code: string;
  subject: string | null;
  body: string;
}

export function formatCatDate(input: string | Date): string {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return String(input);
  const formatted = d.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    timeZone: 'Africa/Gaborone',
  });
  return `${formatted} CAT`;
}

export function formatCatDateTime(input: string | Date): string {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return String(input);
  const formatted = d.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Africa/Gaborone',
  });
  return `${formatted} CAT`;
}

async function execQuery<T = any>(
  sql: string,
  params: any[],
  client?: PoolClient
): Promise<{ rows: T[]; rowCount?: number | null }> {
  if (client) {
    const res = await client.query(sql, params);
    return { rows: res.rows as T[], rowCount: res.rowCount };
  }
  const res = await query<T>(sql, params);
  return { rows: res.rows, rowCount: res.rowCount };
}

function interpolateTemplate(template: string, vars: Record<string, any>): string {
  return template.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_match, key: string) => {
    const val = vars[key];
    if (val === undefined || val === null) return '';
    return String(val);
  });
}

function buildTenantScopeSql(
  scope: NotificationTenantScope | 'supplier' | 'organization' | undefined,
  startParamIndex: number
): { clause: string; params: any[]; normalizedType: 'supplier' | 'organization' | 'platform' | undefined } {
  const normalized: NotificationTenantScope =
    typeof scope === 'string'
      ? { tenantType: scope, tenantId: null }
      : scope || {};

  const tenantType = normalized.tenantType || undefined;
  const tenantId = normalized.tenantId && UUID_REGEX.test(normalized.tenantId) ? normalized.tenantId : null;

  if (tenantType === 'organization' && tenantId) {
    return {
      clause: `AND organization_id = $${startParamIndex} AND (supplier_id IS NULL OR event_type = ANY($${startParamIndex + 1}::text[]))`,
      params: [tenantId, ORG_FACING_LEGACY_EVENTS],
      normalizedType: 'organization',
    };
  }

  if (tenantType === 'supplier' && tenantId) {
    return {
      clause: `AND supplier_id = $${startParamIndex} AND (organization_id IS NULL OR NOT (event_type = ANY($${startParamIndex + 1}::text[])))`,
      params: [tenantId, ORG_FACING_LEGACY_EVENTS],
      normalizedType: 'supplier',
    };
  }

  if (tenantType === 'organization') {
    return {
      clause: `AND organization_id IS NOT NULL AND (supplier_id IS NULL OR event_type = ANY($${startParamIndex}::text[]))`,
      params: [ORG_FACING_LEGACY_EVENTS],
      normalizedType: 'organization',
    };
  }

  if (tenantType === 'supplier') {
    return {
      clause: `AND supplier_id IS NOT NULL AND (organization_id IS NULL OR NOT (event_type = ANY($${startParamIndex}::text[])))`,
      params: [ORG_FACING_LEGACY_EVENTS],
      normalizedType: 'supplier',
    };
  }

  return {
    clause: '',
    params: [],
    normalizedType: tenantType,
  };
}

export class NotificationsRepository {
  /**
   * Look up an active notification_templates record (organization override first, then platform default)
   * and safely interpolate {{variable}} placeholders.
   */
  async renderTemplate(
    code: string,
    channel: 'in_app' | 'email' | 'sms' | 'whatsapp',
    vars: Record<string, any>,
    organizationId?: string | null,
    client?: PoolClient
  ): Promise<RenderedTemplate | null> {
    if (!code) return null;
    const safeOrgId = organizationId && UUID_REGEX.test(organizationId) ? organizationId : null;
    try {
      const res = await execQuery<{ code: string; subject: string | null; body: string }>(
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
        body: interpolateTemplate(tpl.body, vars).trim(),
      };
    } catch {
      return null;
    }
  }

  /**
   * Queue an email delivery row in message_deliveries using notification_templates when explicitly enabled.
   */
  async queueEmailDelivery(
    input: {
      userId?: string | null;
      recipientEmail: string;
      templateCode: string;
      vars?: Record<string, any>;
      organizationId?: string | null;
      notificationId?: string | null;
    },
    client?: PoolClient
  ): Promise<void> {
    const cleanRecipient = String(input.recipientEmail || '').trim().toLowerCase().slice(0, 255);
    if (!cleanRecipient || !cleanRecipient.includes('@')) return;

    const safeUserId = input.userId && UUID_REGEX.test(input.userId) ? input.userId : null;
    const safeNotificationId =
      input.notificationId && UUID_REGEX.test(input.notificationId) ? input.notificationId : null;
    const safeCode = String(input.templateCode || 'system_notification').slice(0, 100);

    const rendered = await this.renderTemplate(
      safeCode,
      'email',
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

  async listForUser(
    userId: string,
    scope?: NotificationTenantScope | 'supplier' | 'organization',
    limit = 50
  ): Promise<NotificationRecord[]> {
    if (!UUID_REGEX.test(userId)) return [];
    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const { clause, params: scopeParams, normalizedType } = buildTenantScopeSql(scope, 2);
    const limitParamIndex = 2 + scopeParams.length;

    const res = await query<any>(
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
       ${clause}
       ORDER BY created_at DESC
       LIMIT $${limitParamIndex}`,
      [userId, ...scopeParams, safeLimit]
    );

    return res.rows.map((r: any) => ({
      ...r,
      type: r.eventType,
      link: r.linkUrl,
      isRead: Boolean(r.readAt),
      recipientRole:
        normalizedType === 'organization'
          ? 'Buyer'
          : normalizedType === 'supplier'
          ? 'Supplier'
          : r.organizationId && !r.supplierId
          ? 'Buyer'
          : 'Supplier',
    }));
  }

  async getUnreadCount(
    userId: string,
    scope?: NotificationTenantScope | 'supplier' | 'organization'
  ): Promise<number> {
    if (!UUID_REGEX.test(userId)) return 0;
    const { clause, params: scopeParams } = buildTenantScopeSql(scope, 2);
    const res = await query<{ count: number }>(
      `SELECT COUNT(*)::int AS count
       FROM notifications
       WHERE user_id = $1
         AND read_at IS NULL
       ${clause}`,
      [userId, ...scopeParams]
    );
    return Number(res.rows[0]?.count || 0);
  }

  async markRead(
    notificationId: string,
    userId: string,
    scope?: NotificationTenantScope | 'supplier' | 'organization'
  ): Promise<boolean> {
    if (!UUID_REGEX.test(notificationId) || !UUID_REGEX.test(userId)) return false;
    const { clause, params: scopeParams } = buildTenantScopeSql(scope, 3);
    const res = await query(
      `UPDATE notifications
       SET read_at = COALESCE(read_at, NOW())
       WHERE id = $1
         AND user_id = $2
       ${clause}`,
      [notificationId, userId, ...scopeParams]
    );
    return (res.rowCount || 0) > 0;
  }

  async markAllRead(
    userId: string,
    scope?: NotificationTenantScope | 'supplier' | 'organization'
  ): Promise<number> {
    if (!UUID_REGEX.test(userId)) return 0;
    const { clause, params: scopeParams } = buildTenantScopeSql(scope, 2);
    const res = await query(
      `UPDATE notifications
       SET read_at = NOW()
       WHERE user_id = $1
         AND read_at IS NULL
       ${clause}`,
      [userId, ...scopeParams]
    );
    return res.rowCount || 0;
  }

  async notifyUsers(
    input: {
      userIds: string[];
      organizationId?: string | null;
      supplierId?: string | null;
      templateOrganizationId?: string | null;
      eventType: string;
      title: string;
      body: string;
      linkUrl?: string | null;
      data?: Record<string, any> | null;
      priority?: 'urgent' | 'info' | 'success' | 'warning';
      queueEmail?: boolean;
    },
    client?: PoolClient
  ): Promise<{ recipientCount: number; insertedCount: number; error?: string }> {
    const uniqueUsers = Array.from(new Set((input.userIds || []).filter((id) => UUID_REGEX.test(String(id)))));
    if (!uniqueUsers.length) {
      return { recipientCount: 0, insertedCount: 0 };
    }

    const safeOrgId = input.organizationId && UUID_REGEX.test(input.organizationId) ? input.organizationId : null;
    const safeSupId = input.supplierId && UUID_REGEX.test(input.supplierId) ? input.supplierId : null;
    const templateOrgId =
      input.templateOrganizationId && UUID_REGEX.test(input.templateOrganizationId)
        ? input.templateOrganizationId
        : safeOrgId;
    const eventCode = input.eventType.slice(0, 100);
    const priority = ['urgent', 'info', 'success', 'warning'].includes(String(input.priority || ''))
      ? (input.priority as 'urgent' | 'info' | 'success' | 'warning')
      : 'info';

    const templateVars = input.data && typeof input.data === 'object' ? input.data : {};
    const inAppTemplate =
      Object.keys(templateVars).length > 0
        ? await this.renderTemplate(eventCode, 'in_app', templateVars, templateOrgId, client)
        : null;

    const resolvedTitle = (
      (inAppTemplate?.subject && !inAppTemplate.subject.includes('{{') ? inAppTemplate.subject : '') ||
      input.title ||
      'Procurement notification'
    )
      .trim()
      .slice(0, 250);
    const resolvedBody = (
      (inAppTemplate?.body && inAppTemplate.body.length > 0 && !inAppTemplate.body.includes('{{')
        ? inAppTemplate.body
        : '') ||
      input.body ||
      ''
    )
      .trim()
      .slice(0, 990);

    // External email sending is disabled by default; only queue email rows when explicitly requested
    const shouldQueueEmail = input.queueEmail === true;
    let emailByUser = new Map<string, string>();
    if (shouldQueueEmail) {
      const emailsRes = await execQuery<{ id: string; email: string }>(
        `SELECT id, email::text AS email FROM users WHERE id = ANY($1::uuid[]) AND deleted_at IS NULL`,
        [uniqueUsers],
        client
      );
      emailByUser = new Map(emailsRes.rows.map((u) => [u.id, u.email]));
    }

    let insertedCount = 0;
    let lastError: string | undefined;

    for (const userId of uniqueUsers) {
      try {
        const ins = await execQuery<{ id: string }>(
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
            priority,
          ],
          client
        );

        if (ins.rows.length > 0) {
          insertedCount += 1;
        }

        if (shouldQueueEmail) {
          const userEmail = emailByUser.get(userId);
          if (userEmail) {
            await this.queueEmailDelivery(
              {
                userId,
                recipientEmail: userEmail,
                templateCode: eventCode,
                vars: { ...templateVars, title: resolvedTitle, body: resolvedBody },
                organizationId: templateOrgId,
                notificationId: ins.rows[0]?.id || null,
              },
              client
            );
          }
        }
      } catch (err: any) {
        lastError = err?.message || String(err);
        console.error('[NOTIFY INSERT FAILED]', {
          eventCode,
          userId,
          safeOrgId,
          safeSupId,
          code: err?.code,
          constraint: err?.constraint,
          detail: err?.detail,
          message: err?.message,
        });
        if (client) {
          throw err;
        }
      }
    }

    return { recipientCount: uniqueUsers.length, insertedCount, error: lastError };
  }

  async notifySupplierMembers(
    supplierId: string,
    payload: {
      organizationId?: string | null;
      eventType: string;
      title: string;
      body: string;
      linkUrl?: string | null;
      data?: Record<string, any> | null;
      priority?: 'urgent' | 'info' | 'success' | 'warning';
      queueEmail?: boolean;
      fallbackUserIds?: string[];
    },
    client?: PoolClient
  ): Promise<{ recipientCount: number; insertedCount: number; error?: string }> {
    if (!UUID_REGEX.test(supplierId)) {
      return { recipientCount: 0, insertedCount: 0 };
    }

    const memRes = await execQuery<{ user_id: string }>(
      `SELECT DISTINCT user_id FROM (
         SELECT sm.user_id
         FROM supplier_members sm
         JOIN users u ON u.id = sm.user_id AND u.deleted_at IS NULL
         WHERE sm.supplier_id = $1
           AND LOWER(COALESCE(sm.status, 'active')) = 'active'
         UNION
         SELECT u.id AS user_id
         FROM suppliers s
         JOIN users u ON LOWER(u.email::text) = LOWER(s.email::text)
         WHERE s.id = $1
           AND s.email IS NOT NULL
           AND u.deleted_at IS NULL
           AND LOWER(COALESCE(u.status, 'active')) = 'active'
       ) recipients`,
      [supplierId],
      client
    );

    const extraIds = (payload.fallbackUserIds || []).filter((id) => UUID_REGEX.test(String(id)));
    const userIds = Array.from(new Set([...memRes.rows.map((r) => r.user_id), ...extraIds]));
    if (!userIds.length) {
      console.warn('[NOTIFY SUPPLIER SKIPPED] No active user accounts found for supplier:', supplierId, payload.eventType);
      return { recipientCount: 0, insertedCount: 0 };
    }

    const mergedData = {
      ...(payload.data || {}),
      ...(payload.organizationId ? { sourceOrganizationId: payload.organizationId } : {}),
    };

    return this.notifyUsers(
      {
        userIds,
        supplierId,
        organizationId: null,
        templateOrganizationId: payload.organizationId || null,
        eventType: payload.eventType,
        title: payload.title,
        body: payload.body,
        linkUrl: payload.linkUrl,
        data: Object.keys(mergedData).length ? mergedData : null,
        priority: payload.priority,
        queueEmail: payload.queueEmail,
      },
      client
    );
  }

  async notifyOrganizationMembers(
    organizationId: string,
    payload: {
      supplierId?: string | null;
      eventType: string;
      title: string;
      body: string;
      linkUrl?: string | null;
      data?: Record<string, any> | null;
      priority?: 'urgent' | 'info' | 'success' | 'warning';
      permissionCode?: string;
      queueEmail?: boolean;
    },
    client?: PoolClient
  ): Promise<{ recipientCount: number; insertedCount: number; error?: string }> {
    if (!UUID_REGEX.test(organizationId)) {
      return { recipientCount: 0, insertedCount: 0 };
    }

    const memRes = payload.permissionCode
      ? await execQuery<{ user_id: string }>(
          `SELECT DISTINCT om.user_id
           FROM organization_members om
           JOIN users u ON u.id = om.user_id AND u.deleted_at IS NULL
           JOIN role_permissions rp ON rp.role_id = om.role_id
           JOIN permissions p ON p.id = rp.permission_id
           WHERE om.organization_id = $1
             AND LOWER(COALESCE(om.status, 'active')) = 'active'
             AND p.code = $2`,
          [organizationId, payload.permissionCode],
          client
        )
      : await execQuery<{ user_id: string }>(
          `SELECT DISTINCT user_id FROM (
             SELECT om.user_id
             FROM organization_members om
             JOIN users u ON u.id = om.user_id AND u.deleted_at IS NULL
             WHERE om.organization_id = $1
               AND LOWER(COALESCE(om.status, 'active')) = 'active'
             UNION
             SELECT u.id AS user_id
             FROM organizations o
             JOIN users u ON LOWER(u.email::text) = LOWER(o.contact_email::text)
             WHERE o.id = $1
               AND o.contact_email IS NOT NULL
               AND u.deleted_at IS NULL
               AND LOWER(COALESCE(u.status, 'active')) = 'active'
           ) recipients`,
          [organizationId],
          client
        );

    const userIds = memRes.rows.map((r) => r.user_id);
    if (!userIds.length) {
      console.warn('[NOTIFY ORG SKIPPED] No active user accounts found for organization:', organizationId, payload.eventType);
      return { recipientCount: 0, insertedCount: 0 };
    }

    const mergedData = {
      ...(payload.data || {}),
      ...(payload.supplierId ? { sourceSupplierId: payload.supplierId } : {}),
    };

    return this.notifyUsers(
      {
        userIds,
        organizationId,
        supplierId: null,
        eventType: payload.eventType,
        title: payload.title,
        body: payload.body,
        linkUrl: payload.linkUrl,
        data: Object.keys(mergedData).length ? mergedData : null,
        priority: payload.priority,
        queueEmail: payload.queueEmail,
      },
      client
    );
  }

  /**
   * Idempotently creates in-app alerts for active supplier documents expiring within 90 days.
   * Deduplicates by (user_id, supplier_id, event_type, documentId, rawExpiryDate).
   */
  async syncExpiringDocumentNotifications(supplierId: string): Promise<void> {
    if (!UUID_REGEX.test(supplierId)) return;

    const expiringRes = await query<{
      documentId: string;
      title: string;
      expiryDate: string;
      daysRemaining: number;
    }>(
      `SELECT d.id AS "documentId",
              COALESCE(NULLIF(TRIM(d.title), ''), dt.name, 'Compliance document') AS title,
              TO_CHAR(v.expiry_date, 'YYYY-MM-DD') AS "expiryDate",
              (v.expiry_date - CURRENT_DATE)::int AS "daysRemaining"
       FROM supplier_documents d
       JOIN supplier_document_versions v ON v.id = d.current_version_id
       LEFT JOIN document_types dt ON dt.id = d.document_type_id
       WHERE d.supplier_id = $1
         AND d.status = 'active'
         AND v.expiry_date IS NOT NULL
         AND v.expiry_date >= CURRENT_DATE
         AND v.expiry_date <= CURRENT_DATE + INTERVAL '90 days'
         AND COALESCE(UPPER(v.verification_status), '') <> 'REJECTED'`,
      [supplierId]
    );

    if (!expiringRes.rows.length) return;

    const memRes = await query<{ user_id: string }>(
      `SELECT user_id FROM supplier_members WHERE supplier_id = $1 AND status = 'active'`,
      [supplierId]
    );
    const memberIds = memRes.rows.map((r) => r.user_id);
    if (!memberIds.length) return;

    for (const doc of expiringRes.rows) {
      const formattedExpiry = formatCatDate(`${doc.expiryDate}T00:00:00+02:00`);
      const daysLeft = Math.max(0, Number(doc.daysRemaining) || 0);
      const priority: 'urgent' | 'warning' = daysLeft <= 30 ? 'urgent' : 'warning';

      const existingRes = await query<{ user_id: string }>(
        `SELECT user_id
         FROM notifications
         WHERE supplier_id = $1
           AND event_type = 'document_expiring_soon'
           AND data->>'documentId' = $2
           AND data->>'rawExpiryDate' = $3
           AND user_id = ANY($4::uuid[])`,
        [supplierId, doc.documentId, doc.expiryDate, memberIds]
      );
      const alreadyNotified = new Set(existingRes.rows.map((r) => r.user_id));
      const missingUserIds = memberIds.filter((uid) => !alreadyNotified.has(uid));

      if (!missingUserIds.length) continue;

      const title =
        daysLeft === 0
          ? `${doc.title} expires today (${formattedExpiry})`
          : `${doc.title} expires on ${formattedExpiry}`;
      const body =
        daysLeft === 0
          ? `Your ${doc.title} expires today (${formattedExpiry}). Upload a renewed certificate in your document vault to stay ready to bid.`
          : `Your ${doc.title} expires on ${formattedExpiry} (${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left). Upload a renewed certificate in your document vault to stay ready to bid.`;

      await this.notifyUsers({
        userIds: missingUserIds,
        supplierId,
        organizationId: null,
        eventType: 'document_expiring_soon',
        title,
        body,
        linkUrl: 'vault',
        priority,
        data: {
          documentId: doc.documentId,
          documentTitle: doc.title,
          expiryDate: formattedExpiry,
          rawExpiryDate: doc.expiryDate,
          daysRemaining: daysLeft,
        },
        queueEmail: false,
      });
    }
  }
}

export const notificationsRepository = new NotificationsRepository();
