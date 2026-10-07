import crypto from 'crypto';
import { query } from '../db/client';

export interface CreateAuditEventDTO {
  actorType?: 'user' | 'system' | 'api';
  actorUserId?: string;
  actorName: string;
  actorRole: string;
  organizationId?: string;
  supplierId?: string;
  organizationName?: string;
  action: string;
  entityType: string;
  entityId?: string;
  ipAddress?: string;
  userAgent?: string;
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
        dto.actorUserId || null,
        dto.actorName,
        dto.actorRole,
        dto.organizationId || null,
        dto.supplierId || null,
        dto.organizationName || null,
        dto.action,
        dto.entityType,
        dto.entityId || null,
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

  async listEvents(filters: { organizationId?: string; supplierId?: string; entityType?: string; limit?: number }): Promise<AuditEventRecord[]> {
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

    if (filters.entityType) {
      params.push(filters.entityType);
      conditions.push(`entity_type = $${params.length}`);
    }

    const whereClause = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const limit = filters.limit || 100;
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
