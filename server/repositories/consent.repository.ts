import { query, withTransaction } from '../db/client';

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
  purpose: string | null;
  status: 'active' | 'revoked' | 'expired';
  grantedAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
  revocationReason: string | null;
  accessCount: number;
}

export class ConsentRepository {
  async listBySupplier(supplierId: string): Promise<ConsentGrantRecord[]> {
    const res = await query<ConsentGrantRecord>(
      `SELECT cg.id, cg.supplier_id AS "supplierId", cg.organization_id AS "organizationId",
              o.name AS "organizationName", cg.share_company_details AS "shareCompanyDetails",
              cg.share_directors_owners AS "shareDirectorsOwners", cg.share_past_projects AS "sharePastProjects",
              cg.share_tax_compliance AS "shareTaxCompliance", cg.share_financial_statements AS "shareFinancialStatements",
              cg.share_key_personnel AS "shareKeyPersonnel", cg.share_past_contracts AS "sharePastContracts",
              cg.share_banking_details AS "shareBankingDetails", cg.purpose, cg.status,
              cg.granted_at AS "grantedAt", cg.expires_at AS "expiresAt",
              cg.revoked_at AS "revokedAt", cg.revocation_reason AS "revocationReason",
              cg.access_count AS "accessCount"
       FROM consent_grants cg
       JOIN organizations o ON o.id = cg.organization_id
       WHERE cg.supplier_id = $1
       ORDER BY cg.granted_at DESC`,
      [supplierId]
    );
    return res.rows;
  }

  async grantConsent(data: {
    supplierId: string;
    organizationId: string;
    userId: string;
    scopes?: Partial<Record<string, boolean>>;
    purpose?: string;
  }): Promise<void> {
    await query(
      `INSERT INTO consent_grants (
        supplier_id, organization_id, granted_by_user_id, status, purpose,
        share_company_details, share_directors_owners, share_past_projects,
        share_tax_compliance, share_financial_statements, share_key_personnel,
        share_past_contracts, share_banking_details, granted_at
      ) VALUES (
        $1, $2, $3, 'active', $4,
        $5, $6, $7, $8, $9, $10, $11, $12, NOW()
      )
      ON CONFLICT DO NOTHING`,
      [
        data.supplierId,
        data.organizationId,
        data.userId,
        data.purpose || 'Statutory Tender Application Evaluation',
        data.scopes?.shareCompanyDetails ?? true,
        data.scopes?.shareDirectorsOwners ?? true,
        data.scopes?.sharePastProjects ?? true,
        data.scopes?.shareTaxCompliance ?? true,
        data.scopes?.shareFinancialStatements ?? false,
        data.scopes?.shareKeyPersonnel ?? true,
        data.scopes?.sharePastContracts ?? true,
        data.scopes?.shareBankingDetails ?? false,
      ]
    );
  }

  async revokeConsent(grantId: string, supplierId: string, userId: string, reason: string): Promise<void> {
    await query(
      `UPDATE consent_grants
       SET status = 'revoked',
           revoked_by_user_id = $3,
           revoked_at = NOW(),
           revocation_reason = $4,
           updated_at = NOW()
       WHERE id = $1 AND supplier_id = $2`,
      [grantId, supplierId, userId, reason]
    );
  }
}

export const consentRepository = new ConsentRepository();
