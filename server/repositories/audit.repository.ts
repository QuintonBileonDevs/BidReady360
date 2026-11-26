import crypto from 'crypto';
import { query } from '../db/client';

export interface CreateAuditEventDTO {
  actorType?: 'user' | 'system' | 'api';
  actorUserId?: string | null;
  actorName: string;
  actorRole: string;
  organizationId?: string | null;
  supplierId?: string | null;
  organizationName?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  beforeJson?: any;
  afterJson?: any;
  details: string;
}

export interface AuditEventRecord {
  id: string;
  occurredAt: string;
  actorType: string;
  actorUserId: string | null;
  actorName: string;
  actorRole: string;
  organizationId: string | null;
  supplierId: string | null;
  organizationName: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  beforeJson: any;
  afterJson: any;
  details: string;
  prevHash: string | null;
  rowHash: string | null;
}

export class AuditRepository {
  /**
   * Appends an immutable audit event with a cryptographic hash chain.
   */
  async logEvent(dto: CreateAuditEventDTO): Promise<AuditEventRecord> {
    // 1. Fetch the latest row hash in the ledger
    const lastRowRes = await query<{ row_hash: string }>(
      `SELECT row_hash FROM audit_log ORDER BY occurred_at DESC, id DESC LIMIT 1`
    );
    const prevHash = lastRowRes.rows[0]?.row_hash || '0'.repeat(64);

    // 2. Compute canonical SHA-256 for the new event
    const timestamp = new Date().toISOString();
    const payloadToHash = `${prevHash}|${timestamp}|${dto.actorName}|${dto.actorRole}|${dto.action}|${dto.entityType}|${dto.entityId || ''}|${dto.details}`;
    const rowHash = crypto.createHash('sha256').update(payloadToHash).digest('hex');

    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const safeEntityId = dto.entityId && UUID_RE.test(dto.entityId) ? dto.entityId : null;
    const safeActorUserId = dto.actorUserId && UUID_RE.test(dto.actorUserId) ? dto.actorUserId : null;
    const safeOrgId = dto.organizationId && UUID_RE.test(dto.organizationId) ? dto.organizationId : null;
    const safeSupplierId = dto.supplierId && UUID_RE.test(dto.supplierId) ? dto.supplierId : null;

    // 3. Insert into append-only audit_log
    const res = await query<AuditEventRecord>(
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
        dto.actorType || 'user',
        safeActorUserId,
        dto.actorName,
        dto.actorRole,
        safeOrgId,
        safeSupplierId,
        dto.organizationName || null,
        dto.action,
        dto.entityType,
        safeEntityId,
        dto.ipAddress || null,
        dto.userAgent || null,
        dto.beforeJson ? JSON.stringify(dto.beforeJson) : null,
        dto.afterJson ? JSON.stringify(dto.afterJson) : null,
        dto.details,
        prevHash,
        rowHash,
      ]
    );

    return res.rows[0];
  }

  async listEvents(filters: {
    organizationId?: string;
    supplierId?: string;
    entityType?: string;
    actor?: string;
    action?: string;
    search?: string;
    fromDate?: string;
    toDate?: string;
    limit?: number;
  }): Promise<AuditEventRecord[]> {
    const conditions: string[] = [];
    const params: any[] = [];

    if (filters.organizationId) {
      params.push(filters.organizationId);
      conditions.push(`(organization_id = $${params.length} OR organization_id IS NULL)`);
    }

    if (filters.supplierId) {
      params.push(filters.supplierId);
      conditions.push(`supplier_id = $${params.length}`);
    }

    if (filters.entityType && filters.entityType !== 'ALL') {
      params.push(filters.entityType);
      conditions.push(`LOWER(entity_type) = LOWER($${params.length})`);
    }

    if (filters.actor) {
      params.push(`%${filters.actor.trim()}%`);
      conditions.push(`(actor_name ILIKE $${params.length} OR actor_role ILIKE $${params.length} OR EXISTS (SELECT 1 FROM users u WHERE u.id = audit_log.actor_user_id AND u.email::text ILIKE $${params.length}))`);
    }

    if (filters.action && filters.action !== 'ALL') {
      params.push(`%${filters.action.trim()}%`);
      conditions.push(`action ILIKE $${params.length}`);
    }

    if (filters.search) {
      params.push(`%${filters.search.trim()}%`);
      conditions.push(`(actor_name ILIKE $${params.length} OR action ILIKE $${params.length} OR entity_type ILIKE $${params.length} OR details ILIKE $${params.length})`);
    }

    if (filters.fromDate) {
      params.push(filters.fromDate);
      conditions.push(`occurred_at >= $${params.length}::timestamptz`);
    }

    if (filters.toDate) {
      params.push(filters.toDate);
      conditions.push(`occurred_at <= ($${params.length}::date + INTERVAL '1 day' - INTERVAL '1 second')`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = Math.min(Math.max(Number(filters.limit) || 100, 1), 500);
    params.push(limit);

    const res = await query<AuditEventRecord>(
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

  async recordExport(data: {
    organizationId: string;
    exportedByUserId: string;
    exportType: 'audit_trail_csv' | 'forensic_ledger_json' | 'statutory_report_csv';
    recordsCount: number;
    checksumSha256: string;
    ipAddress?: string;
    userAgent?: string;
  }): Promise<void> {
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
        data.userAgent || null,
      ]
    );
  }
}

export const auditRepository = new AuditRepository();
