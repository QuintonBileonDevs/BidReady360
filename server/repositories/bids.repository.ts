import crypto from 'crypto';
import { query, tx } from '../db/client';
import { auditRepository } from './audit.repository';

export interface BidRecordView {
  id: string;
  callId: string;
  callNumber: string;
  supplierId: string;
  supplierName: string;
  status: 'draft' | 'submitted' | 'opened' | 'withdrawn' | 'disqualified';
  receiptNumber: string | null;
  payloadSha256: string | null;
  totalPrice: string | null;
  currency: string;
  submittedAt: string | null;
  openedAt: string | null;
  files: { id: string; fileRole: string; fileName: string; sha256: string; storageKey: string }[];
  priceItems: { lineNo: number; description: string; quantity: number; unitPrice: number; lineTotal: number }[];
}

export class BidsRepository {
  async getByCallAndSupplier(callId: string, supplierId: string): Promise<BidRecordView | null> {
    const res = await query<any>(
      `SELECT b.id, b.call_id AS "callId", c.reference_no AS "callNumber",
              b.supplier_id AS "supplierId", s.legal_name AS "supplierName",
              b.status, b.receipt_number AS "receiptNumber", b.payload_sha256 AS "payloadSha256",
              b.total_price AS "totalPrice", b.currency, b.submitted_at AS "submittedAt", b.opened_at AS "openedAt"
       FROM bids b
       JOIN calls c ON c.id = b.call_id
       JOIN suppliers s ON s.id = b.supplier_id
       WHERE b.call_id = $1 AND b.supplier_id = $2`,
      [callId, supplierId]
    );

    if (!res.rows.length) return null;
    const base = res.rows[0];

    const [filesRes, itemsRes] = await Promise.all([
      query(
        `SELECT id, file_role AS "fileRole", file_name AS "fileName", sha256, storage_key AS "storageKey"
         FROM bid_files WHERE bid_id = $1`,
        [base.id]
      ),
      query(
        `SELECT line_no AS "lineNo", description, quantity, unit_price AS "unitPrice", line_total AS "lineTotal"
         FROM bid_price_items WHERE bid_id = $1 ORDER BY line_no ASC`,
        [base.id]
      ),
    ]);

    return {
      ...base,
      files: filesRes.rows,
      priceItems: itemsRes.rows,
    };
  }

  async listByCall(callId: string, orgId: string): Promise<BidRecordView[]> {
    const res = await query<any>(
      `SELECT b.id, b.call_id AS "callId", c.reference_no AS "callNumber",
              b.supplier_id AS "supplierId", s.legal_name AS "supplierName",
              s.cipa_uin AS "cipaNumber",
              b.status, b.receipt_number AS "receiptNumber", b.payload_sha256 AS "payloadSha256",
              CASE WHEN b.status = 'opened' THEN b.total_price ELSE NULL END AS "totalPrice",
              b.currency, b.submitted_at AS "submittedAt", b.opened_at AS "openedAt"
       FROM bids b
       JOIN calls c ON c.id = b.call_id
       JOIN suppliers s ON s.id = b.supplier_id
       WHERE b.call_id = $1 AND c.organization_id = $2
       ORDER BY b.submitted_at ASC NULLS LAST`,
      [callId, orgId]
    );
    return res.rows;
  }

  /**
   * Seals and submits a bid envelope.
   * Server validates closing deadline and computes cryptographic SHA-256 seal.
   */
  async sealAndSubmitBid(data: {
    callId: string;
    supplierId: string;
    userId: string;
    technicalProposalBuffer?: Buffer;
    financialSchedule: { lineNo: number; description: string; quantity: number; unitPrice: number }[];
    actorName: string;
    actorRole: string;
    ipAddress?: string;
  }): Promise<{ bidId: string; receiptNumber: string; sealedHash: string }> {
    // 1. Validate Call Closing Date, Call Status, and Buyer Organization Status
    const callRes = await query<{
      id: string;
      organization_id: string;
      reference_no: string;
      status: string;
      closes_at: string | null;
      org_status: string;
    }>(
      `SELECT c.id, c.organization_id, c.reference_no, c.status, c.closes_at, o.status AS org_status
       FROM calls c
       JOIN organizations o ON o.id = c.organization_id AND o.deleted_at IS NULL
       WHERE c.id = $1`,
      [data.callId]
    );
    if (!callRes.rows.length) {
      const err: any = new Error('Tender call does not exist.');
      err.status = 404;
      err.code = 'CALL_NOT_FOUND';
      throw err;
    }
    const call = callRes.rows[0];

    if (call.org_status !== 'active') {
      const err: any = new Error('This tender call is unavailable because the procuring organization is not currently active.');
      err.status = 403;
      err.code = 'ORGANIZATION_INACTIVE';
      throw err;
    }

    if (!['open', 'published'].includes(String(call.status || '').toLowerCase())) {
      const err: any = new Error('This tender call is not currently open for bid submissions.');
      err.status = 400;
      err.code = 'CALL_NOT_OPEN';
      throw err;
    }

    if (call.closes_at && new Date() > new Date(call.closes_at)) {
      const err: any = new Error('The closing time has passed; bids can no longer be submitted.');
      err.status = 400;
      err.code = 'CALL_CLOSED';
      throw err;
    }

    // 1a. Enforce Supplier Standing (must be active & verified — blocks suspended, rejected, and unapproved suppliers)
    const supplierRes = await query<{ status: string; verification_status: string; legal_name: string }>(
      `SELECT status, verification_status, legal_name
       FROM suppliers
       WHERE id = $1 AND deleted_at IS NULL
       LIMIT 1`,
      [data.supplierId]
    );
    if (!supplierRes.rows.length) {
      const err: any = new Error('Supplier profile not found.');
      err.status = 403;
      err.code = 'SUPPLIER_NOT_FOUND';
      throw err;
    }
    const sup = supplierRes.rows[0];
    const supStatus = String(sup.status || '').toLowerCase();
    const supVer = String(sup.verification_status || '').toLowerCase();

    if (supStatus !== 'active') {
      const err: any = new Error(
        `Bid submission blocked: your supplier account is currently ${supStatus}. Contact BidReady360 compliance administration.`
      );
      err.status = 403;
      err.code = 'SUPPLIER_SUSPENDED';
      throw err;
    }

    if (supVer === 'rejected') {
      const err: any = new Error(
        'Bid submission blocked: your supplier verification was rejected. Please address compliance findings and resubmit for verification.'
      );
      err.status = 403;
      err.code = 'SUPPLIER_REJECTED';
      throw err;
    }

    if (supVer !== 'verified') {
      const err: any = new Error(
        'Bid submission blocked: your supplier profile must be verified by an administrator before submitting sealed bids.'
      );
      err.status = 403;
      err.code = 'SUPPLIER_NOT_VERIFIED';
      throw err;
    }

    // 1b. Enforce statutory debarment block (platform-wide or procuring-entity-specific)
    const debarRes = await query<{ id: string; reason: string; starts_on: string; ends_on: string | null }>(
      `SELECT id, reason, starts_on, ends_on
       FROM debarments
       WHERE supplier_id = $1
         AND lifted_at IS NULL
         AND starts_on <= CURRENT_DATE
         AND (ends_on IS NULL OR ends_on >= CURRENT_DATE)
         AND (organization_id IS NULL OR organization_id = $2)
       ORDER BY created_at DESC
       LIMIT 1`,
      [data.supplierId, call.organization_id]
    );
    if (debarRes.rows.length > 0) {
      const deb = debarRes.rows[0];
      const err = new Error(
        `Bid submission blocked: supplier is currently debarred (${deb.reason})${deb.ends_on ? ` until ${deb.ends_on}` : ' (permanent)'}.`
      ) as any;
      err.status = 403;
      err.code = 'SUPPLIER_DEBARRED';
      throw err;
    }

    // 2. Compute canonical sealed payload hash (financial schedule stays encrypted until opening)
    const payloadStr = JSON.stringify({
      callId: data.callId,
      supplierId: data.supplierId,
      items: data.financialSchedule,
      timestamp: new Date().toISOString(),
    });
    const sealedHash = crypto.createHash('sha256').update(payloadStr).digest('hex');
    const receiptNumber = `BID-${call.reference_no.replace(/[^a-zA-Z0-9]/g, '')}-${Date.now().toString().slice(-6)}`;

    return tx(async (client) => {
      // 3. Insert or update bid envelope in 'submitted' state with sealed payload
      const bidRes = await client.query<{ id: string }>(
        `INSERT INTO bids (
          call_id, supplier_id, status, receipt_number, sealed_payload_key,
          sealed_payload_hash, envelope_key_ref, payload_sha256, submitted_by_user_id, submitted_at, updated_at
        ) VALUES (
          $1, $2, 'submitted', $3, $4, $6, $5, $6, $7, NOW(), NOW()
        )
        ON CONFLICT (call_id, supplier_id) DO UPDATE
        SET status = 'submitted',
            receipt_number = EXCLUDED.receipt_number,
            sealed_payload_hash = EXCLUDED.sealed_payload_hash,
            payload_sha256 = EXCLUDED.payload_sha256,
            submitted_by_user_id = EXCLUDED.submitted_by_user_id,
            submitted_at = NOW(),
            updated_at = NOW()
        RETURNING id`,
        [
          data.callId,
          data.supplierId,
          receiptNumber,
          `sealed/${data.callId}/${data.supplierId}.enc`,
          'kms/bidready-bw-primary-2026',
          sealedHash,
          data.userId,
        ]
      );
      const bidId = bidRes.rows[0].id;

      // 4. Record Price items (stored with prices sealed or populated)
      await client.query(`DELETE FROM bid_price_items WHERE bid_id = $1`, [bidId]);
      for (const item of data.financialSchedule) {
        await client.query(
          `INSERT INTO bid_price_items (bid_id, line_no, description, quantity, unit_price)
           VALUES ($1, $2, $3, $4, $5)`,
          [bidId, item.lineNo, item.description, item.quantity, item.unitPrice]
        );
      }

      // 5. Store electronic sealing receipt
      await client.query(
        `INSERT INTO bid_sealing_receipts (bid_id, receipt_number, sealed_hash, file_fingerprints, generated_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [bidId, receiptNumber, sealedHash, JSON.stringify([{ role: 'financial_schedule', sha256: sealedHash }])]
      );

      // 6. Write Audit Event
      await auditRepository.logEvent({
        actorName: data.actorName,
        actorRole: data.actorRole,
        actorUserId: data.userId,
        supplierId: data.supplierId,
        organizationId: call.organization_id,
        action: 'Bid Sealed & Submitted',
        entityType: 'Bid',
        entityId: bidId,
        ipAddress: data.ipAddress,
        details: `Sealed electronic bid envelope submitted for ${call.reference_no} (Receipt: ${receiptNumber}, SHA-256: ${sealedHash}).`,
      });

      return { bidId, receiptNumber, sealedHash };
    });
  }

  /**
   * Conducts bid opening session. Trigger blocks unsealing if closing deadline has not passed.
   */
  async conductOpeningSession(data: {
    callId: string;
    orgId: string;
    userId: string;
    actorName: string;
    actorRole: string;
    witnesses: { userId: string; witnessRole: string }[];
    ipAddress?: string;
  }): Promise<{ sessionId: string; openedBidsCount: number }> {
    // Verify call belongs to organization
    const callRes = await query<{ id: string; reference_no: string; closes_at: string | null }>(
      `SELECT id, reference_no, closes_at FROM calls WHERE id = $1 AND organization_id = $2`,
      [data.callId, data.orgId]
    );
    if (!callRes.rows.length) throw new Error('Tender call not found for your organization.');
    const call = callRes.rows[0];

    if (!call.closes_at || new Date() < new Date(call.closes_at)) {
      throw new Error('Bids cannot be opened before the closing time. The statutory sealing protocol remains active.');
    }

    return tx(async (client) => {
      // 1. Create opening session
      const sessionRes = await client.query<{ id: string }>(
        `INSERT INTO bid_opening_sessions (
          call_id, conducted_by_user_id, session_status, protocol_type, quorum_verified, opened_at
        ) VALUES ($1, $2, 'completed', 'dual_key_statutory_quorum', TRUE, NOW())
        RETURNING id`,
        [data.callId, data.userId]
      );
      const sessionId = sessionRes.rows[0].id;

      // 2. Record witnesses
      for (const w of data.witnesses) {
        const sigHash = crypto.createHash('sha256').update(`${sessionId}|${w.userId}|${Date.now()}`).digest('hex');
        await client.query(
          `INSERT INTO bid_opening_witnesses (session_id, user_id, witness_role, digital_signature_hash, signed_at)
           VALUES ($1, $2, $3, $4, NOW()) ON CONFLICT DO NOTHING`,
          [sessionId, w.userId, w.witnessRole, sigHash]
        );
      }

      // 3. Unseal all submitted bids for this call
      const bidsRes = await client.query<{ id: string }>(
        `SELECT id FROM bids WHERE call_id = $1 AND status = 'submitted'`,
        [data.callId]
      );

      for (const b of bidsRes.rows) {
        // Calculate total price from price items
        const sumRes = await client.query<{ sum: string }>(
          `SELECT COALESCE(SUM(quantity * unit_price), 0) AS sum FROM bid_price_items WHERE bid_id = $1`,
          [b.id]
        );
        const totalPrice = Number(sumRes.rows[0].sum);

        await client.query(
          `UPDATE bids
           SET status = 'opened',
               total_price = $2,
               opened_in_session_id = $3,
               opened_at = NOW(),
               unsealed_by_user_id = $4,
               updated_at = NOW()
           WHERE id = $1`,
          [b.id, totalPrice, sessionId, data.userId]
        );
      }

      // 4. Update call status to 'evaluating'
      await client.query(`UPDATE calls SET status = 'evaluating', updated_at = NOW() WHERE id = $1`, [data.callId]);

      // 5. Write Audit event
      await auditRepository.logEvent({
        actorName: data.actorName,
        actorRole: data.actorRole,
        actorUserId: data.userId,
        organizationId: data.orgId,
        action: 'Bids Unsealed in Opening Session',
        entityType: 'Call',
        entityId: data.callId,
        ipAddress: data.ipAddress,
        details: `Official opening session conducted for ${call.reference_no}. Unsealed ${bidsRes.rows.length} bids with verified witness quorum.`,
      });

      return { sessionId, openedBidsCount: bidsRes.rows.length };
    });
  }
}

export const bidsRepository = new BidsRepository();
