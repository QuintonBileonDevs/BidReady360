import { query, withTransaction } from '../db/client';
import { auditRepository } from './audit.repository';

export interface AwardRecordView {
  id: string;
  callId: string;
  callNumber: string;
  callTitle: string;
  bidId: string;
  supplierId: string;
  supplierName: string;
  status: 'draft' | 'pending_approval' | 'approved' | 'rejected' | 'issued';
  awardValue: number;
  currency: string;
  justification: string | null;
  isPublicNotice: boolean;
  issuedAt: string | null;
}

export interface ContractRecordView {
  id: string;
  contractNo: string;
  title: string;
  organizationId: string;
  organizationName: string;
  supplierId: string;
  supplierName: string;
  status: 'draft' | 'sent_for_signature' | 'active' | 'completed' | 'terminated';
  contractValue: number;
  currency: string;
  startDate: string | null;
  endDate: string | null;
  signedAt: string | null;
  milestones: { id: string; title: string; amount: number; status: string; dueDate: string | null }[];
  invoices: { id: string; invoiceNo: string; amount: number; status: string; issuedOn: string }[];
}

export class AwardsRepository {
  async listAwards(orgId: string): Promise<AwardRecordView[]> {
    const res = await query<any>(
      `SELECT a.id, a.call_id AS "callId", c.reference_no AS "callNumber", c.title AS "callTitle",
              a.bid_id AS "bidId", a.supplier_id AS "supplierId", s.legal_name AS "supplierName",
              a.status, a.award_value AS "awardValue", a.currency, a.justification,
              a.is_public_notice AS "isPublicNotice", a.issued_at AS "issuedAt"
       FROM awards a
       JOIN calls c ON c.id = a.call_id
       JOIN suppliers s ON s.id = a.supplier_id
       WHERE c.organization_id = $1
       ORDER BY a.created_at DESC`,
      [orgId]
    );
    return res.rows;
  }

  /**
   * Recommends contract award.
   */
  async recommendAward(data: {
    callId: string;
    bidId: string;
    supplierId: string;
    awardValue: number;
    currency?: string;
    justification: string;
    userId: string;
    actorName: string;
    actorRole: string;
    orgId: string;
    ipAddress?: string;
  }): Promise<string> {
    return withTransaction(async (client) => {
      const awardRes = await client.query<{ id: string }>(
        `INSERT INTO awards (
          call_id, bid_id, supplier_id, status, award_value, currency, justification, recommended_by_user_id, created_at, updated_at
        ) VALUES (
          $1, $2, $3, 'pending_approval', $4, $5, $6, $7, NOW(), NOW()
        )
        ON CONFLICT (bid_id) DO UPDATE
        SET status = 'pending_approval',
            award_value = EXCLUDED.award_value,
            justification = EXCLUDED.justification,
            recommended_by_user_id = EXCLUDED.recommended_by_user_id,
            updated_at = NOW()
        RETURNING id`,
        [data.callId, data.bidId, data.supplierId, data.awardValue, data.currency || 'BWP', data.justification, data.userId]
      );
      const awardId = awardRes.rows[0].id;

      await auditRepository.logEvent({
        actorName: data.actorName,
        actorRole: data.actorRole,
        actorUserId: data.userId,
        organizationId: data.orgId,
        action: 'Award Recommended',
        entityType: 'Award',
        entityId: awardId,
        ipAddress: data.ipAddress,
        details: `Award recommended for BWP ${data.awardValue.toLocaleString()}. Justification: ${data.justification}`,
      });

      return awardId;
    });
  }

  /**
   * Approves contract award with financial delegation limit verification.
   */
  async approveAward(data: {
    awardId: string;
    userId: string;
    actorName: string;
    actorRole: string;
    orgId: string;
    decision: 'approved' | 'rejected';
    comment?: string;
    ipAddress?: string;
  }): Promise<void> {
    // 1. Fetch award and check contract value
    const awardRes = await query<{ id: string; award_value: string; call_id: string; supplier_id: string; title: string }>(
      `SELECT a.id, a.award_value, a.call_id, a.supplier_id, c.title
       FROM awards a
       JOIN calls c ON c.id = a.call_id
       WHERE a.id = $1`,
      [data.awardId]
    );
    if (!awardRes.rows.length) throw new Error('Award record not found.');
    const award = awardRes.rows[0];
    const awardVal = Number(award.award_value);

    // 2. Fetch approver's financial limit from role
    const memberRes = await query<{ approval_limit_bwp: string | null; role_name: string }>(
      `SELECT r.approval_limit_bwp, r.name AS role_name
       FROM organization_members om
       JOIN roles r ON r.id = om.role_id
       WHERE om.user_id = $1 AND om.organization_id = $2`,
      [data.userId, data.orgId]
    );

    const limit = memberRes.rows[0]?.approval_limit_bwp ? Number(memberRes.rows[0].approval_limit_bwp) : null;
    if (limit !== null && awardVal > limit) {
      throw new Error(
        `Financial delegation limit exceeded: Your role (${memberRes.rows[0]?.role_name || 'Approver'}) has an approval ceiling of BWP ${limit.toLocaleString()}, but the contract value is BWP ${awardVal.toLocaleString()}. Higher board authorization is required.`
      );
    }

    await withTransaction(async (client) => {
      // 3. Update award
      await client.query(
        `UPDATE awards
         SET status = $2, issued_at = NOW(), updated_at = NOW()
         WHERE id = $1`,
        [data.awardId, data.decision === 'approved' ? 'approved' : 'rejected']
      );

      // 4. Record approval log
      await client.query(
        `INSERT INTO award_approvals (award_id, approver_user_id, decision, comment, decided_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [data.awardId, data.userId, data.decision, data.comment || null]
      );

      // 5. If approved, automatically create the contract record
      if (data.decision === 'approved') {
        const contractNo = `CTR-${Date.now().toString().slice(-6)}`;
        await client.query(
          `INSERT INTO contracts (
            organization_id, supplier_id, award_id, contract_no, title, status, contract_value, currency, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, 'sent_for_signature', $6, 'BWP', NOW(), NOW()
          ) ON CONFLICT DO NOTHING`,
          [data.orgId, award.supplier_id, award.id, contractNo, `Contract for ${award.title}`, awardVal]
        );

        // Update call status to 'awarded'
        await client.query(`UPDATE calls SET status = 'awarded', updated_at = NOW() WHERE id = $1`, [award.call_id]);
      }

      // 6. Write Audit Event
      await auditRepository.logEvent({
        actorName: data.actorName,
        actorRole: data.actorRole,
        actorUserId: data.userId,
        organizationId: data.orgId,
        action: `Award ${data.decision.toUpperCase()}`,
        entityType: 'Award',
        entityId: data.awardId,
        ipAddress: data.ipAddress,
        details: `Official award decision recorded: ${data.decision.toUpperCase()} for BWP ${awardVal.toLocaleString()}. Comment: ${data.comment || 'Approved within statutory threshold.'}`,
      });
    });
  }

  async listContracts(orgId: string): Promise<ContractRecordView[]> {
    const res = await query<any>(
      `SELECT c.id, c.contract_no AS "contractNo", c.title,
              c.organization_id AS "organizationId", o.name AS "organizationName",
              c.supplier_id AS "supplierId", s.legal_name AS "supplierName",
              c.status, c.contract_value AS "contractValue", c.currency,
              c.start_date AS "startDate", c.end_date AS "endDate", c.signed_at AS "signedAt"
       FROM contracts c
       JOIN organizations o ON o.id = c.organization_id
       JOIN suppliers s ON s.id = c.supplier_id
       WHERE c.organization_id = $1
       ORDER BY c.created_at DESC`,
      [orgId]
    );

    const contracts: ContractRecordView[] = [];
    for (const row of res.rows) {
      const [mRes, iRes] = await Promise.all([
        query(`SELECT id, title, amount, status, due_date AS "dueDate" FROM contract_milestones WHERE contract_id = $1`, [row.id]),
        query(`SELECT id, invoice_no AS "invoiceNo", amount, status, issued_on AS "issuedOn" FROM contract_invoices WHERE contract_id = $1`, [row.id]),
      ]);
      contracts.push({
        ...row,
        milestones: mRes.rows,
        invoices: iRes.rows,
      });
    }

    return contracts;
  }
}

export const awardsRepository = new AwardsRepository();
