import crypto from 'crypto';
import type { PoolClient } from 'pg';
import { query, tx } from '../db/client';

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

export interface AuditChainVerificationResult {
  valid: boolean;
  chainLinkValid: boolean;
  totalChecked: number;
  brokenLinks: number;
  hashMismatches: number;
  latestHash: string | null;
  firstBrokenEventId: string | null;
  firstBrokenReason: string | null;
  checkedAt: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const GENESIS_HASH = '0'.repeat(64);
const AUDIT_CHAIN_LOCK_KEY = 72819401;

function computeCanonicalRowHash(params: {
  prevHash: string;
  occurredAtIso: string;
  actorName: string;
  actorRole: string;
  action: string;
  entityType: string;
  entityId: string | null;
  details: string;
}): string {
  const payload = `${params.prevHash}|${params.occurredAtIso}|${params.actorName}|${params.actorRole}|${params.action}|${params.entityType}|${params.entityId || ''}|${params.details}`;
  return crypto.createHash('sha256').update(payload).digest('hex');
}

export class AuditRepository {
  /**
   * Appends an immutable audit event with a serialized cryptographic hash chain.
   * Uses the exact ISO timestamp persisted to occurred_at so hashes can be deterministically re-verified.
   */
  async logEvent(dto: CreateAuditEventDTO, externalClient?: PoolClient): Promise<AuditEventRecord> {
    const appendWithClient = async (client: PoolClient): Promise<AuditEventRecord> => {
      // Serialize concurrent audit appends across transactions to prevent chain forks
      await client.query(`SELECT pg_advisory_xact_lock(${AUDIT_CHAIN_LOCK_KEY})`);

      // 1. Fetch the latest row hash in the global ledger
      const lastRowRes = await client.query<{ row_hash: string | null }>(
        `SELECT row_hash FROM audit_log ORDER BY occurred_at DESC, id DESC LIMIT 1`
      );
      const prevHash = (lastRowRes.rows[0]?.row_hash || GENESIS_HASH).trim();

      // 2. Normalize UUIDs and compute canonical SHA-256 using exact timestamp persisted in occurred_at
      const occurredAtIso = new Date().toISOString();
      const safeEntityId = dto.entityId && UUID_RE.test(dto.entityId) ? dto.entityId : null;
      const safeActorUserId = dto.actorUserId && UUID_RE.test(dto.actorUserId) ? dto.actorUserId : null;
      const safeOrgId = dto.organizationId && UUID_RE.test(dto.organizationId) ? dto.organizationId : null;
      const safeSupplierId = dto.supplierId && UUID_RE.test(dto.supplierId) ? dto.supplierId : null;
      const cleanActorName = String(dto.actorName || 'System').slice(0, 200);
      const cleanActorRole = String(dto.actorRole || 'System').slice(0, 50);
      const cleanAction = String(dto.action || 'EVENT').slice(0, 100);
      const cleanEntityType = String(dto.entityType || 'Record').slice(0, 60);
      const cleanDetails = String(dto.details || '');

      const rowHash = computeCanonicalRowHash({
        prevHash,
        occurredAtIso,
        actorName: cleanActorName,
        actorRole: cleanActorRole,
        action: cleanAction,
        entityType: cleanEntityType,
        entityId: safeEntityId,
        details: cleanDetails,
      });

      // 3. Insert into append-only audit_log
      const res = await client.query<AuditEventRecord>(
        `INSERT INTO audit_log (
          occurred_at, actor_type, actor_user_id, actor_name, actor_role,
          organization_id, supplier_id, organization_name, action,
          entity_type, entity_id, ip_address, user_agent,
          before_json, after_json, details, prev_hash, row_hash
        ) VALUES (
          $1::timestamptz, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18
        ) RETURNING 
          id, occurred_at AS "occurredAt", actor_type AS "actorType", actor_user_id AS "actorUserId",
          actor_name AS "actorName", actor_role AS "actorRole", organization_id AS "organizationId",
          supplier_id AS "supplierId", organization_name AS "organizationName", action,
          entity_type AS "entityType", entity_id AS "entityId", ip_address AS "ipAddress",
          user_agent AS "userAgent", before_json AS "beforeJson", after_json AS "afterJson",
          details, prev_hash AS "prevHash", row_hash AS "rowHash"`,
        [
          occurredAtIso,
          dto.actorType || 'user',
          safeActorUserId,
          cleanActorName,
          cleanActorRole,
          safeOrgId,
          safeSupplierId,
          dto.organizationName || null,
          cleanAction,
          cleanEntityType,
          safeEntityId,
          dto.ipAddress || null,
          dto.userAgent || null,
          dto.beforeJson ? JSON.stringify(dto.beforeJson) : null,
          dto.afterJson ? JSON.stringify(dto.afterJson) : null,
          cleanDetails,
          prevHash,
          rowHash,
        ]
      );

      return res.rows[0];
    };

    if (externalClient) {
      return appendWithClient(externalClient);
    }
    return tx(appendWithClient);
  }

  /**
   * Verifies the append-only hash chain across the global audit_log ledger.
   */
  async verifyChain(filters?: { organizationId?: string; supplierId?: string; limit?: number }): Promise<AuditChainVerificationResult> {
    const limit = Math.min(Math.max(Number(filters?.limit) || 1000, 1), 5000);

    // Always verify linkage in strict chronological order across the global ledger
    const res = await query<{
      id: string;
      occurredAt: string;
      actorName: string | null;
      actorRole: string | null;
      organizationId: string | null;
      supplierId: string | null;
      action: string;
      entityType: string | null;
      entityId: string | null;
      details: string | null;
      prevHash: string | null;
      rowHash: string | null;
    }>(
      `SELECT id,
              occurred_at AS "occurredAt",
              actor_name AS "actorName",
              actor_role AS "actorRole",
              organization_id AS "organizationId",
              supplier_id AS "supplierId",
              action,
              entity_type AS "entityType",
              entity_id AS "entityId",
              details,
              prev_hash AS "prevHash",
              row_hash AS "rowHash"
       FROM audit_log
       ORDER BY occurred_at ASC, id ASC
       LIMIT $1`,
      [limit]
    );

    let brokenLinks = 0;
    let hashMismatches = 0;
    let firstBrokenEventId: string | null = null;
    let firstBrokenReason: string | null = null;
    let expectedPrevHash = GENESIS_HASH;
    let latestHash: string | null = null;
    let scopedChecked = 0;

    for (let i = 0; i < res.rows.length; i++) {
      const row = res.rows[i];
      const storedPrev = (row.prevHash || '').trim();
      const storedHash = (row.rowHash || '').trim();
      const inScope =
        (!filters?.organizationId || row.organizationId === filters.organizationId) &&
        (!filters?.supplierId || row.supplierId === filters.supplierId);

      if (inScope) {
        scopedChecked++;
      }

      if (storedPrev !== expectedPrevHash) {
        brokenLinks++;
        if (!firstBrokenEventId) {
          firstBrokenEventId = row.id;
          firstBrokenReason = 'Previous hash pointer mismatch detected in audit chain.';
        }
      }

      const recomputed = computeCanonicalRowHash({
        prevHash: storedPrev || GENESIS_HASH,
        occurredAtIso: new Date(row.occurredAt).toISOString(),
        actorName: row.actorName || '',
        actorRole: row.actorRole || '',
        action: row.action,
        entityType: row.entityType || '',
        entityId: row.entityId,
        details: row.details || '',
      });

      if (!storedHash || storedHash !== recomputed) {
        // Distinguish pre-fix legacy timestamp drift only when next row's prev_hash still chains properly,
        // otherwise count as hash mismatch. Even on mismatch, report honestly for strict verification.
        hashMismatches++;
        if (!firstBrokenEventId) {
          firstBrokenEventId = row.id;
          firstBrokenReason = 'Row SHA-256 checksum does not match canonical ledger payload.';
        }
      }

      if (storedHash) {
        expectedPrevHash = storedHash;
        latestHash = storedHash;
      }
    }

    return {
      valid: brokenLinks === 0 && hashMismatches === 0,
      chainLinkValid: brokenLinks === 0,
      totalChecked: filters?.organizationId || filters?.supplierId ? scopedChecked : res.rows.length,
      brokenLinks,
      hashMismatches,
      latestHash,
      firstBrokenEventId,
      firstBrokenReason,
      checkedAt: new Date().toISOString(),
    };
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
       ORDER BY occurred_at DESC, id DESC
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
