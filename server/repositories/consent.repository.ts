import { query, tx } from '../db/client';
import { auditRepository } from './audit.repository';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ConsentGrantRecord {
  id: string;
  supplierId: string;
  organizationId: string;
  organizationName: string;
  shareCompanyDetails: boolean;
  shareDirectorsOwners: boolean;
  sharePastProjects: boolean;
  shareTaxCompliance: boolean;
  shareFinancialStatements: boolean;
  shareKeyPersonnel: boolean;
  sharePastContracts: boolean;
  shareBankingDetails: boolean;
  selectedDocumentIds: string[];
  selectedDocumentNames: string[];
  tiedApplicationNumbers: string[];
  purpose: string | null;
  status: 'active' | 'revoked' | 'expired';
  grantedAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  revocationReason: string | null;
  lastAccessedAt: string | null;
  accessCount: number;
}

export interface ConsentAccessLogRecord {
  id: string;
  organizationId: string;
  organizationName: string;
  supplierId: string;
  consentGrantId: string | null;
  accessedByUserId: string;
  accessedByName: string;
  accessedDataScope: string[];
  ipAddress: string | null;
  accessedAt: string;
}

async function hasSelectedDocNamesColumn(): Promise<boolean> {
  const res = await query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'consent_grants'
         AND column_name = 'selected_document_names'
     ) AS exists`
  ).catch(() => ({ rows: [{ exists: false }] }));
  return Boolean(res.rows[0]?.exists);
}

function buildGrantSelectSql(includeDocNames: boolean): string {
  return `
  SELECT cg.id, cg.supplier_id AS "supplierId", cg.organization_id AS "organizationId",
         o.name AS "organizationName", cg.share_company_details AS "shareCompanyDetails",
         cg.share_directors_owners AS "shareDirectorsOwners", cg.share_past_projects AS "sharePastProjects",
         cg.share_tax_compliance AS "shareTaxCompliance", cg.share_financial_statements AS "shareFinancialStatements",
         cg.share_key_personnel AS "shareKeyPersonnel", cg.share_past_contracts AS "sharePastContracts",
         cg.share_banking_details AS "shareBankingDetails",
         COALESCE(
           (SELECT array_agg(cgd.document_id::text ORDER BY cgd.attached_at ASC)
            FROM consent_grant_documents cgd
            WHERE cgd.consent_grant_id = cg.id),
           '{}'::text[]
         ) AS "selectedDocumentIds",
         COALESCE(
           NULLIF(
             (SELECT array_agg(DISTINCT dt.name)
              FROM consent_grant_documents cgd
              JOIN supplier_documents sd ON sd.id = cgd.document_id
              JOIN document_types dt ON dt.id = sd.document_type_id
              WHERE cgd.consent_grant_id = cg.id),
             '{}'::text[]
           ),
           ${includeDocNames ? `COALESCE(cg.selected_document_names, '{}'::text[])` : `'{}'::text[]`}
         ) AS "selectedDocumentNames",
         COALESCE(
           (SELECT array_agg(c.reference_no ORDER BY a.submitted_at DESC)
            FROM applications a
            JOIN calls c ON c.id = a.call_id
            WHERE a.supplier_id = cg.supplier_id
              AND a.organization_id = cg.organization_id
              AND a.status <> 'Draft'),
           '{}'::text[]
         ) AS "tiedApplicationNumbers",
         cg.purpose,
         CASE
           WHEN cg.status = 'active' AND cg.expires_at IS NOT NULL AND cg.expires_at <= NOW() THEN 'expired'
           ELSE cg.status
         END AS status,
         cg.granted_at AS "grantedAt", cg.expires_at AS "expiresAt",
         cg.revoked_at AS "revokedAt", cg.revocation_reason AS "revocationReason",
         cg.last_accessed_at AS "lastAccessedAt",
         cg.access_count AS "accessCount"
  FROM consent_grants cg
  JOIN organizations o ON o.id = cg.organization_id
`;
}

async function syncConsentGrantDocuments(
  client: any,
  grantId: string,
  supplierId: string,
  selectedDocumentIds?: string[],
  selectedDocumentNames?: string[]
): Promise<void> {
  if (selectedDocumentIds === undefined && selectedDocumentNames === undefined) return;

  await client.query(`DELETE FROM consent_grant_documents WHERE consent_grant_id = $1`, [grantId]);

  const validDocIds = Array.isArray(selectedDocumentIds)
    ? selectedDocumentIds.filter((id) => UUID_REGEX.test(String(id)))
    : [];

  if (validDocIds.length > 0) {
    await client.query(
      `INSERT INTO consent_grant_documents (consent_grant_id, document_id, attached_at)
       SELECT $1, sd.id, NOW()
       FROM supplier_documents sd
       WHERE sd.supplier_id = $2
         AND sd.status != 'deleted'
         AND (sd.id = ANY($3::uuid[]) OR sd.current_version_id = ANY($3::uuid[]))
       ON CONFLICT DO NOTHING`,
      [grantId, supplierId, validDocIds]
    );
    return;
  }

  const cleanNames = Array.isArray(selectedDocumentNames)
    ? selectedDocumentNames.map((n) => String(n).trim()).filter(Boolean)
    : [];

  if (cleanNames.length > 0) {
    await client.query(
      `INSERT INTO consent_grant_documents (consent_grant_id, document_id, attached_at)
       SELECT $1, sd.id, NOW()
       FROM supplier_documents sd
       JOIN document_types dt ON dt.id = sd.document_type_id
       WHERE sd.supplier_id = $2
         AND sd.status != 'deleted'
         AND dt.name = ANY($3::text[])
       ON CONFLICT DO NOTHING`,
      [grantId, supplierId, cleanNames]
    );
  }
}

export class ConsentRepository {
  async listBySupplier(supplierId: string): Promise<ConsentGrantRecord[]> {
    const hasCol = await hasSelectedDocNamesColumn();
    const res = await query<ConsentGrantRecord>(
      `${buildGrantSelectSql(hasCol)}
       WHERE cg.supplier_id = $1
       ORDER BY cg.granted_at DESC`,
      [supplierId]
    );
    return res.rows;
  }

  async listAccessLogsBySupplier(supplierId: string, limit = 50): Promise<ConsentAccessLogRecord[]> {
    if (!UUID_REGEX.test(supplierId)) return [];
    const safeLimit = Math.min(Math.max(Number(limit) || 50, 1), 200);
    const res = await query<ConsentAccessLogRecord>(
      `SELECT l.id,
              l.organization_id AS "organizationId",
              o.name AS "organizationName",
              l.supplier_id AS "supplierId",
              l.consent_grant_id AS "consentGrantId",
              l.accessed_by_user_id AS "accessedByUserId",
              COALESCE(u.full_name, u.email::text, 'Authorized Officer') AS "accessedByName",
              l.accessed_data_scope AS "accessedDataScope",
              host(l.ip_address) AS "ipAddress",
              l.accessed_at AS "accessedAt"
       FROM organization_data_access_logs l
       JOIN organizations o ON o.id = l.organization_id
       LEFT JOIN users u ON u.id = l.accessed_by_user_id
       WHERE l.supplier_id = $1
       ORDER BY l.accessed_at DESC
       LIMIT $2`,
      [supplierId, safeLimit]
    );
    return res.rows;
  }

  /**
   * Persist an immutable access record in organization_data_access_logs whenever buyer staff
   * inspect a supplier profile or view/download a supplier document.
   */
  async logDataAccess(input: {
    organizationId: string;
    supplierId: string;
    accessedByUserId: string;
    accessedDataScope: string[];
    consentGrantId?: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
  }): Promise<void> {
    if (
      !UUID_REGEX.test(input.organizationId) ||
      !UUID_REGEX.test(input.supplierId) ||
      !UUID_REGEX.test(input.accessedByUserId)
    ) {
      return;
    }

    const scopes = Array.from(
      new Set((input.accessedDataScope || []).map((s) => String(s).trim()).filter(Boolean))
    );
    if (!scopes.length) scopes.push('profile_summary');

    let grantId = input.consentGrantId && UUID_REGEX.test(input.consentGrantId) ? input.consentGrantId : null;
    if (!grantId) {
      const activeGrant = await query<{ id: string }>(
        `SELECT id
         FROM consent_grants
         WHERE supplier_id = $1
           AND organization_id = $2
           AND status = 'active'
           AND (expires_at IS NULL OR expires_at > NOW())
         ORDER BY granted_at DESC
         LIMIT 1`,
        [input.supplierId, input.organizationId]
      );
      grantId = activeGrant.rows[0]?.id || null;
    }

    const safeIp = input.ipAddress && /^[0-9a-fA-F:.]{3,45}$/.test(input.ipAddress) ? input.ipAddress : null;
    const safeUa = input.userAgent ? String(input.userAgent).slice(0, 290) : null;

    await query(
      `INSERT INTO organization_data_access_logs (
         organization_id, supplier_id, consent_grant_id, accessed_by_user_id,
         accessed_data_scope, ip_address, user_agent, accessed_at
       ) VALUES ($1, $2, $3, $4, $5::text[], $6::inet, $7, NOW())`,
      [input.organizationId, input.supplierId, grantId, input.accessedByUserId, scopes, safeIp, safeUa]
    );

    if (grantId) {
      await query(
        `UPDATE consent_grants
         SET access_count = COALESCE(access_count, 0) + 1,
             last_accessed_at = NOW(),
             updated_at = NOW()
         WHERE id = $1`,
        [grantId]
      );
    }
  }

  async grantConsent(data: {
    supplierId: string;
    organizationId: string;
    userId: string;
    scopes?: Partial<Record<string, boolean>>;
    selectedDocumentIds?: string[];
    selectedDocumentNames?: string[];
    expiresAt?: string | null;
    purpose?: string;
    actorName?: string;
    actorRole?: string;
    ipAddress?: string;
  }): Promise<ConsentGrantRecord> {
    const hasCol = await hasSelectedDocNamesColumn();
    return tx(async (client) => {
      const orgRes = await client.query<{ id: string; name: string }>(
        `SELECT id, name FROM organizations WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
        [data.organizationId]
      );
      if (!orgRes.rows.length) {
        const err: any = new Error('Target procuring organization was not found.');
        err.status = 404;
        err.code = 'ORGANIZATION_NOT_FOUND';
        throw err;
      }

      const existing = await client.query<{ id: string; status: string }>(
        `SELECT id, status
         FROM consent_grants
         WHERE supplier_id = $1 AND organization_id = $2
         ORDER BY created_at DESC
         LIMIT 1
         FOR UPDATE`,
        [data.supplierId, data.organizationId]
      );

      const s = data.scopes || {};
      const selectedDocs = Array.isArray(data.selectedDocumentNames) ? data.selectedDocumentNames : [];
      const purpose = data.purpose || 'Statutory Tender Application Evaluation';
      const expiresAt = data.expiresAt || null;

      let grantId: string;
      if (existing.rows.length > 0) {
        grantId = existing.rows[0].id;
        await client.query(
          `UPDATE consent_grants
           SET status = 'active',
               granted_by_user_id = $2,
               granted_at = NOW(),
               expires_at = $3,
               purpose = $4,
               share_company_details = $5,
               share_directors_owners = $6,
               share_past_projects = $7,
               share_tax_compliance = $8,
               share_financial_statements = $9,
               share_key_personnel = $10,
               share_past_contracts = $11,
               share_banking_details = $12,
               ${hasCol ? 'selected_document_names = $13,' : ''}
               revoked_by_user_id = NULL,
               revoked_at = NULL,
               revocation_reason = NULL,
               updated_at = NOW()
           WHERE id = $1`,
          hasCol
            ? [
                grantId,
                data.userId,
                expiresAt,
                purpose,
                s.shareCompanyDetails ?? true,
                s.shareDirectorsOwners ?? true,
                s.sharePastProjects ?? true,
                s.shareTaxCompliance ?? true,
                s.shareFinancialStatements ?? false,
                s.shareKeyPersonnel ?? true,
                s.sharePastContracts ?? true,
                s.shareBankingDetails ?? false,
                selectedDocs,
              ]
            : [
                grantId,
                data.userId,
                expiresAt,
                purpose,
                s.shareCompanyDetails ?? true,
                s.shareDirectorsOwners ?? true,
                s.sharePastProjects ?? true,
                s.shareTaxCompliance ?? true,
                s.shareFinancialStatements ?? false,
                s.shareKeyPersonnel ?? true,
                s.sharePastContracts ?? true,
                s.shareBankingDetails ?? false,
              ]
        );
      } else {
        const ins = await client.query<{ id: string }>(
          hasCol
            ? `INSERT INTO consent_grants (
                supplier_id, organization_id, granted_by_user_id, status, purpose, expires_at,
                share_company_details, share_directors_owners, share_past_projects,
                share_tax_compliance, share_financial_statements, share_key_personnel,
                share_past_contracts, share_banking_details, selected_document_names, granted_at
              ) VALUES (
                $1, $2, $3, 'active', $4, $5,
                $6, $7, $8, $9, $10, $11, $12, $13, $14, NOW()
              ) RETURNING id`
            : `INSERT INTO consent_grants (
                supplier_id, organization_id, granted_by_user_id, status, purpose, expires_at,
                share_company_details, share_directors_owners, share_past_projects,
                share_tax_compliance, share_financial_statements, share_key_personnel,
                share_past_contracts, share_banking_details, granted_at
              ) VALUES (
                $1, $2, $3, 'active', $4, $5,
                $6, $7, $8, $9, $10, $11, $12, $13, NOW()
              ) RETURNING id`,
          hasCol
            ? [
                data.supplierId,
                data.organizationId,
                data.userId,
                purpose,
                expiresAt,
                s.shareCompanyDetails ?? true,
                s.shareDirectorsOwners ?? true,
                s.sharePastProjects ?? true,
                s.shareTaxCompliance ?? true,
                s.shareFinancialStatements ?? false,
                s.shareKeyPersonnel ?? true,
                s.sharePastContracts ?? true,
                s.shareBankingDetails ?? false,
                selectedDocs,
              ]
            : [
                data.supplierId,
                data.organizationId,
                data.userId,
                purpose,
                expiresAt,
                s.shareCompanyDetails ?? true,
                s.shareDirectorsOwners ?? true,
                s.sharePastProjects ?? true,
                s.shareTaxCompliance ?? true,
                s.shareFinancialStatements ?? false,
                s.shareKeyPersonnel ?? true,
                s.sharePastContracts ?? true,
                s.shareBankingDetails ?? false,
              ]
        );
        grantId = ins.rows[0].id;
      }

      await syncConsentGrantDocuments(
        client,
        grantId,
        data.supplierId,
        data.selectedDocumentIds,
        selectedDocs
      );

      await auditRepository.logEvent(
        {
          actorName: data.actorName || 'Supplier Administrator',
          actorRole: data.actorRole || 'Supplier Admin',
          actorUserId: data.userId,
          supplierId: data.supplierId,
          organizationId: data.organizationId,
          organizationName: orgRes.rows[0].name,
          action: 'Consent Grant Issued',
          entityType: 'ConsentGrant',
          entityId: grantId,
          ipAddress: data.ipAddress,
          details: `Granted scoped data access to ${orgRes.rows[0].name} (Tax: ${s.shareTaxCompliance ?? true}, Directors: ${s.shareDirectorsOwners ?? true}, Financials: ${s.shareFinancialStatements ?? false}, Banking: ${s.shareBankingDetails ?? false}${expiresAt ? `, Expires: ${expiresAt}` : ''}).`,
        },
        client
      );

      const out = await client.query<ConsentGrantRecord>(`${buildGrantSelectSql(hasCol)} WHERE cg.id = $1`, [grantId]);
      return out.rows[0];
    });
  }

  async updateConsentScope(
    grantId: string,
    supplierId: string,
    userId: string,
    updates: {
      scopes?: Partial<Record<string, boolean>>;
      selectedDocumentIds?: string[];
      selectedDocumentNames?: string[];
      expiresAt?: string | null;
    },
    auditMeta?: { actorName?: string; actorRole?: string; ipAddress?: string }
  ): Promise<ConsentGrantRecord> {
    const hasCol = await hasSelectedDocNamesColumn();
    return tx(async (client) => {
      const existing = await client.query<{ id: string; organization_id: string; status: string }>(
        `SELECT id, organization_id, status
         FROM consent_grants
         WHERE id = $1 AND supplier_id = $2
         FOR UPDATE`,
        [grantId, supplierId]
      );
      if (!existing.rows.length) {
        const err: any = new Error('Consent grant record not found.');
        err.status = 404;
        err.code = 'CONSENT_NOT_FOUND';
        throw err;
      }
      if (existing.rows[0].status !== 'active') {
        const err: any = new Error('Revoked or expired consent grants cannot be modified. Issue a new grant if re-sharing is required.');
        err.status = 400;
        err.code = 'CONSENT_NOT_ACTIVE';
        throw err;
      }

      const s = updates.scopes || {};
      if (hasCol) {
        await client.query(
          `UPDATE consent_grants
           SET share_company_details = COALESCE($3, share_company_details),
               share_directors_owners = COALESCE($4, share_directors_owners),
               share_past_projects = COALESCE($5, share_past_projects),
               share_tax_compliance = COALESCE($6, share_tax_compliance),
               share_financial_statements = COALESCE($7, share_financial_statements),
               share_key_personnel = COALESCE($8, share_key_personnel),
               share_past_contracts = COALESCE($9, share_past_contracts),
               share_banking_details = COALESCE($10, share_banking_details),
               selected_document_names = COALESCE($11, selected_document_names),
               expires_at = CASE WHEN $12::boolean THEN $13::timestamptz ELSE expires_at END,
               updated_at = NOW()
           WHERE id = $1 AND supplier_id = $2 AND status = 'active'`,
          [
            grantId,
            supplierId,
            s.shareCompanyDetails ?? null,
            s.shareDirectorsOwners ?? null,
            s.sharePastProjects ?? null,
            s.shareTaxCompliance ?? null,
            s.shareFinancialStatements ?? null,
            s.shareKeyPersonnel ?? null,
            s.sharePastContracts ?? null,
            s.shareBankingDetails ?? null,
            updates.selectedDocumentNames !== undefined ? updates.selectedDocumentNames : null,
            updates.expiresAt !== undefined,
            updates.expiresAt ?? null,
          ]
        );
      } else {
        await client.query(
          `UPDATE consent_grants
           SET share_company_details = COALESCE($3, share_company_details),
               share_directors_owners = COALESCE($4, share_directors_owners),
               share_past_projects = COALESCE($5, share_past_projects),
               share_tax_compliance = COALESCE($6, share_tax_compliance),
               share_financial_statements = COALESCE($7, share_financial_statements),
               share_key_personnel = COALESCE($8, share_key_personnel),
               share_past_contracts = COALESCE($9, share_past_contracts),
               share_banking_details = COALESCE($10, share_banking_details),
               expires_at = CASE WHEN $11::boolean THEN $12::timestamptz ELSE expires_at END,
               updated_at = NOW()
           WHERE id = $1 AND supplier_id = $2 AND status = 'active'`,
          [
            grantId,
            supplierId,
            s.shareCompanyDetails ?? null,
            s.shareDirectorsOwners ?? null,
            s.sharePastProjects ?? null,
            s.shareTaxCompliance ?? null,
            s.shareFinancialStatements ?? null,
            s.shareKeyPersonnel ?? null,
            s.sharePastContracts ?? null,
            s.shareBankingDetails ?? null,
            updates.expiresAt !== undefined,
            updates.expiresAt ?? null,
          ]
        );
      }

      await syncConsentGrantDocuments(
        client,
        grantId,
        supplierId,
        updates.selectedDocumentIds,
        updates.selectedDocumentNames
      );

      await auditRepository.logEvent(
        {
          actorName: auditMeta?.actorName || 'Supplier Administrator',
          actorRole: auditMeta?.actorRole || 'Supplier Admin',
          actorUserId: userId,
          supplierId,
          organizationId: existing.rows[0].organization_id,
          action: 'Consent Scope Updated',
          entityType: 'ConsentGrant',
          entityId: grantId,
          ipAddress: auditMeta?.ipAddress,
          details: `Updated data sharing scope permissions for consent grant ${grantId}.`,
        },
        client
      );

      const out = await client.query<ConsentGrantRecord>(`${buildGrantSelectSql(hasCol)} WHERE cg.id = $1`, [grantId]);
      return out.rows[0];
    });
  }

  async revokeConsent(
    grantId: string,
    supplierId: string,
    userId: string,
    reason: string,
    auditMeta?: { actorName?: string; actorRole?: string; ipAddress?: string }
  ): Promise<void> {
    await tx(async (client) => {
      const check = await client.query<{ id: string; organization_id: string; status: string }>(
        `SELECT id, organization_id, status
         FROM consent_grants
         WHERE id = $1 AND supplier_id = $2
         FOR UPDATE`,
        [grantId, supplierId]
      );
      if (!check.rows.length) {
        const err: any = new Error('Consent grant record not found.');
        err.status = 404;
        err.code = 'CONSENT_NOT_FOUND';
        throw err;
      }
      if (check.rows[0].status === 'revoked') {
        const err: any = new Error('Consent grant has already been revoked.');
        err.status = 400;
        err.code = 'CONSENT_ALREADY_REVOKED';
        throw err;
      }

      const cleanReason = (reason || 'Revoked by supplier administrator').trim();
      await client.query(
        `UPDATE consent_grants
         SET status = 'revoked',
             revoked_by_user_id = $3,
             revoked_at = NOW(),
             revocation_reason = $4,
             updated_at = NOW()
         WHERE id = $1 AND supplier_id = $2`,
        [grantId, supplierId, userId, cleanReason]
      );

      await auditRepository.logEvent(
        {
          actorName: auditMeta?.actorName || 'Supplier Administrator',
          actorRole: auditMeta?.actorRole || 'Supplier Admin',
          actorUserId: userId,
          supplierId,
          organizationId: check.rows[0].organization_id,
          action: 'Consent Grant Revoked',
          entityType: 'ConsentGrant',
          entityId: grantId,
          ipAddress: auditMeta?.ipAddress,
          details: `Data sharing consent revoked. Reason: ${cleanReason}. Previously submitted tender dossiers remain legally archived for the buyer.`,
        },
        client
      );
    });
  }
}

export const consentRepository = new ConsentRepository();
