import { query, tx } from '../db/client';
import { auditRepository } from './audit.repository';
import { notificationsRepository } from './notifications.repository';

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
  recommendedByUserId: string;
  recommendedByName: string | null;
  approvedByName: string | null;
  decisionComment: string | null;
  decidedAt: string | null;
  issuedAt: string | null;
  createdAt: string;
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
              a.status, a.award_value::numeric AS "awardValue", a.currency, a.justification,
              a.is_public_notice AS "isPublicNotice",
              a.recommended_by_user_id AS "recommendedByUserId",
              ru.full_name AS "recommendedByName",
              (SELECT au.full_name FROM award_approvals aa JOIN users au ON au.id = aa.approver_user_id WHERE aa.award_id = a.id ORDER BY aa.decided_at DESC NULLS LAST LIMIT 1) AS "approvedByName",
              (SELECT aa.comment FROM award_approvals aa WHERE aa.award_id = a.id ORDER BY aa.decided_at DESC NULLS LAST LIMIT 1) AS "decisionComment",
              (SELECT aa.decided_at FROM award_approvals aa WHERE aa.award_id = a.id ORDER BY aa.decided_at DESC NULLS LAST LIMIT 1) AS "decidedAt",
              a.issued_at AS "issuedAt",
              a.created_at AS "createdAt"
       FROM awards a
       JOIN calls c ON c.id = a.call_id
       JOIN suppliers s ON s.id = a.supplier_id
       LEFT JOIN users ru ON ru.id = a.recommended_by_user_id
       WHERE c.organization_id = $1
       ORDER BY a.created_at DESC`,
      [orgId]
    );
    return res.rows.map((r: any) => ({ ...r, awardValue: Number(r.awardValue || 0) }));
  }

  /**
   * Recommends contract award after verifying org ownership and opened bid state.
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
    if (!Number.isFinite(data.awardValue) || data.awardValue <= 0) {
      const err: any = new Error('Award value must be greater than zero.');
      err.status = 400;
      throw err;
    }
    const cleanJustification = String(data.justification || '').trim();
    if (!cleanJustification) {
      const err: any = new Error('Evaluation and award recommendation justification is required.');
      err.status = 400;
      throw err;
    }

    return tx(async (client) => {
      const callRes = await client.query<{ id: string; reference_no: string; title: string; status: string }>(
        `SELECT id, reference_no, title, status FROM calls WHERE id = $1 AND organization_id = $2 FOR UPDATE`,
        [data.callId, data.orgId]
      );
      if (!callRes.rows.length) {
        const err: any = new Error('Tender call not found for your organization.');
        err.status = 404;
        throw err;
      }
      const call = callRes.rows[0];

      const bidRes = await client.query<{ id: string; status: string; supplier_id: string }>(
        `SELECT id, status, supplier_id FROM bids WHERE id = $1 AND call_id = $2 AND supplier_id = $3 FOR UPDATE`,
        [data.bidId, data.callId, data.supplierId]
      );
      if (!bidRes.rows.length) {
        const err: any = new Error('Referenced bid envelope was not found for this tender call and supplier.');
        err.status = 404;
        throw err;
      }
      if (bidRes.rows[0].status !== 'opened') {
        const err: any = new Error(
          `Bids must be officially unsealed before recommending an award (current bid status: ${bidRes.rows[0].status}).`
        );
        err.status = 400;
        err.code = 'BID_NOT_OPENED';
        throw err;
      }

      const existingAward = await client.query<{ id: string; status: string }>(
        `SELECT id, status FROM awards WHERE bid_id = $1 FOR UPDATE`,
        [data.bidId]
      );
      if (existingAward.rows.length > 0 && ['approved', 'issued'].includes(existingAward.rows[0].status)) {
        const err: any = new Error('An approved or issued award already exists for this bid and cannot be overwritten.');
        err.status = 400;
        err.code = 'AWARD_ALREADY_FINALIZED';
        throw err;
      }

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
        [data.callId, data.bidId, data.supplierId, data.awardValue, data.currency || 'BWP', cleanJustification, data.userId]
      );
      const awardId = awardRes.rows[0].id;

      await auditRepository.logEvent(
        {
          actorName: data.actorName,
          actorRole: data.actorRole,
          actorUserId: data.userId,
          organizationId: data.orgId,
          supplierId: data.supplierId,
          action: 'Award Recommended',
          entityType: 'Award',
          entityId: awardId,
          ipAddress: data.ipAddress,
          details: `Award recommended for ${call.reference_no} (BWP ${data.awardValue.toLocaleString()}). Justification: ${cleanJustification}`,
        },
        client
      );

      await notificationsRepository.notifyOrganizationMembers(
        data.orgId,
        {
          supplierId: data.supplierId,
          eventType: 'award_pending_approval',
          title: `Award recommendation waiting for approval (${call.reference_no})`,
          body: `${data.actorName} recommended a contract award of BWP ${data.awardValue.toLocaleString()}. Open awards to review and record your approval decision.`,
          linkUrl: 'awards',
          priority: 'urgent',
          permissionCode: 'awards.approve',
          data: {
            awardId,
            callId: data.callId,
            callNumber: call.reference_no,
            actorName: data.actorName,
            awardValue: data.awardValue.toLocaleString(),
          },
        },
        client
      );

      return awardId;
    });
  }

  /**
   * Approves or rejects contract award with strict:
   * 1) organization scoping
   * 2) pending_approval state validation
   * 3) separation of drafter vs approver enforcement
   * 4) active role authority + financial delegation ceiling verification
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
    if (!['approved', 'rejected'].includes(data.decision)) {
      const err: any = new Error('Award decision must be "approved" or "rejected".');
      err.status = 400;
      throw err;
    }

    await tx(async (client) => {
      // 1. Fetch and lock award within organization scope
      const awardRes = await client.query<{
        id: string;
        award_value: string;
        call_id: string;
        reference_no: string;
        supplier_id: string;
        title: string;
        status: string;
        recommended_by_user_id: string;
      }>(
        `SELECT a.id, a.award_value, a.call_id, c.reference_no, a.supplier_id, c.title, a.status, a.recommended_by_user_id
         FROM awards a
         JOIN calls c ON c.id = a.call_id
         WHERE a.id = $1 AND c.organization_id = $2
         FOR UPDATE OF a`,
        [data.awardId, data.orgId]
      );
      if (!awardRes.rows.length) {
        const err: any = new Error('Award record not found for your organization.');
        err.status = 404;
        err.code = 'AWARD_NOT_FOUND';
        throw err;
      }
      const award = awardRes.rows[0];
      const awardVal = Number(award.award_value);

      if (award.status !== 'pending_approval') {
        const err: any = new Error(`Award is currently "${award.status}" and is not awaiting approval.`);
        err.status = 400;
        err.code = 'AWARD_NOT_PENDING';
        throw err;
      }

      // 2. Enforce Separation of Duties (recommender / drafter cannot approve/reject own recommendation)
      if (award.recommended_by_user_id === data.userId) {
        const err: any = new Error(
          'Separation of duties violation: the officer who drafted or recommended this award cannot approve or reject it.'
        );
        err.status = 403;
        err.code = 'SEPARATION_OF_DUTIES_VIOLATION';
        throw err;
      }

      // 3. Verify active membership, awards.approve permission, and financial delegation limit
      const hasMemberLimitRes = await client.query<{ exists: boolean }>(
        `SELECT EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_schema = 'public' AND table_name = 'organization_members' AND column_name = 'approval_limit_bwp'
         ) AS exists`
      );
      const limitSelectExpr = hasMemberLimitRes.rows[0]?.exists
        ? 'COALESCE(om.approval_limit_bwp, r.approval_limit_bwp)'
        : 'r.approval_limit_bwp';

      const memberRes = await client.query<{
        approval_limit_bwp: string | null;
        role_name: string;
        has_approve_perm: boolean;
      }>(
        `SELECT ${limitSelectExpr} AS approval_limit_bwp,
                r.name AS role_name,
                EXISTS (
                  SELECT 1 FROM role_permissions rp
                  JOIN permissions p ON p.id = rp.permission_id
                  WHERE rp.role_id = om.role_id AND p.code = 'awards.approve'
                ) AS has_approve_perm
         FROM organization_members om
         JOIN roles r ON r.id = om.role_id
         WHERE om.user_id = $1 AND om.organization_id = $2 AND om.status = 'active'
         LIMIT 1`,
        [data.userId, data.orgId]
      );
      if (!memberRes.rows.length || !memberRes.rows[0].has_approve_perm) {
        const err: any = new Error('Insufficient authority: an active organization role with "awards.approve" permission is required.');
        err.status = 403;
        err.code = 'APPROVER_AUTHORITY_REQUIRED';
        throw err;
      }

      const limit = memberRes.rows[0]?.approval_limit_bwp !== null && memberRes.rows[0]?.approval_limit_bwp !== undefined
        ? Number(memberRes.rows[0].approval_limit_bwp)
        : null;
      if (data.decision === 'approved' && limit !== null && awardVal > limit) {
        const err: any = new Error(
          `Financial delegation limit exceeded: Your role (${memberRes.rows[0]?.role_name || 'Approver'}) has an approval ceiling of BWP ${limit.toLocaleString()}, but the contract value is BWP ${awardVal.toLocaleString()}. Higher board authorization is required.`
        );
        err.status = 403;
        err.code = 'APPROVAL_LIMIT_EXCEEDED';
        throw err;
      }

      // 4. Update award status
      await client.query(
        `UPDATE awards
         SET status = $2,
             issued_at = CASE WHEN $2 = 'approved' THEN NOW() ELSE issued_at END,
             updated_at = NOW()
         WHERE id = $1`,
        [data.awardId, data.decision === 'approved' ? 'approved' : 'rejected']
      );

      // 5. Record approval trail entry
      await client.query(
        `INSERT INTO award_approvals (award_id, approver_user_id, decision, comment, decided_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [data.awardId, data.userId, data.decision, (data.comment || '').trim() || null]
      );

      // 6. If approved, create contract record and transition call to 'awarded'
      if (data.decision === 'approved') {
        const contractNo = `CTR-${award.reference_no.replace(/[^a-zA-Z0-9]/g, '')}-${Date.now().toString().slice(-5)}`;
        await client.query(
          `INSERT INTO contracts (
            organization_id, supplier_id, award_id, contract_no, title, status, contract_value, currency, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5, 'sent_for_signature', $6, 'BWP', NOW(), NOW()
          ) ON CONFLICT DO NOTHING`,
          [data.orgId, award.supplier_id, award.id, contractNo, `Contract for ${award.title}`, awardVal]
        );

        await client.query(`UPDATE calls SET status = 'awarded', updated_at = NOW() WHERE id = $1`, [award.call_id]);
      }

      // 7. Atomic audit log & notifications
      await auditRepository.logEvent(
        {
          actorName: data.actorName,
          actorRole: data.actorRole,
          actorUserId: data.userId,
          organizationId: data.orgId,
          supplierId: award.supplier_id,
          action: `Award ${data.decision.toUpperCase()}`,
          entityType: 'Award',
          entityId: data.awardId,
          ipAddress: data.ipAddress,
          details: `Official award decision recorded for ${award.reference_no}: ${data.decision.toUpperCase()} (BWP ${awardVal.toLocaleString()}). Comment: ${data.comment || 'Approved within statutory delegation threshold.'}`,
        },
        client
      );

      await notificationsRepository.notifyUsers(
        {
          userIds: [award.recommended_by_user_id],
          organizationId: data.orgId,
          eventType: 'award_decision',
          title: `Award recommendation ${data.decision} for ${award.reference_no}`,
          body: `${data.actorName} ${data.decision} the contract award recommendation for ${award.title}. Open awards to review the recorded decision.`,
          linkUrl: 'awards',
          priority: data.decision === 'approved' ? 'success' : 'warning',
          data: {
            awardId: data.awardId,
            callId: award.call_id,
            callNumber: award.reference_no,
            callTitle: award.title,
            actorName: data.actorName,
            decision: data.decision,
          },
        },
        client
      );

      if (data.decision === 'approved') {
        await notificationsRepository.notifySupplierMembers(
          award.supplier_id,
          {
            organizationId: data.orgId,
            eventType: 'award_approved',
            title: `Contract award approved for ${award.reference_no}`,
            body: `Your bid for ${award.title} (BWP ${awardVal.toLocaleString()}) has been approved for contract award. Open your applications to view the next steps.`,
            linkUrl: 'applications',
            priority: 'success',
            data: {
              awardId: data.awardId,
              callId: award.call_id,
              callNumber: award.reference_no,
              callTitle: award.title,
              awardValue: awardVal.toLocaleString(),
            },
          },
          client
        );
      }
    });
  }

  async listContracts(orgId: string): Promise<ContractRecordView[]> {
    const res = await query<any>(
      `SELECT c.id, c.contract_no AS "contractNo", c.title,
              c.organization_id AS "organizationId", o.name AS "organizationName",
              c.supplier_id AS "supplierId", s.legal_name AS "supplierName",
              c.status, c.contract_value::numeric AS "contractValue", c.currency,
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
        contractValue: Number(row.contractValue || 0),
        milestones: mRes.rows,
        invoices: iRes.rows,
      });
    }

    return contracts;
  }
}

export const awardsRepository = new AwardsRepository();
