import crypto from 'crypto';
import { query, tx } from '../db/client';
import { auditRepository } from './audit.repository';
import { notificationsRepository } from './notifications.repository';

export interface BidRecordView {
  id: string;
  callId: string;
  callNumber: string;
  supplierId: string;
  supplierName: string;
  cipaNumber?: string | null;
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

export interface OpeningSessionWitnessInput {
  userId?: string;
  name?: string;
  witnessRole?: string;
}

export interface OpeningSessionView {
  id: string;
  callId: string;
  openedAt: string;
  conductedByUserId: string;
  conductedByName: string;
  sessionStatus: string;
  protocolType: string;
  quorumVerified: boolean;
  registerSha256: string | null;
  notes: string | null;
  witnesses: { userId: string | null; name: string; witnessRole: string; signedAt: string | null; signatureHash: string | null }[];
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function hasWitnessSummaryColumn(): Promise<boolean> {
  const res = await query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'bid_opening_sessions'
         AND column_name = 'witness_summary'
     ) AS exists`
  ).catch(() => ({ rows: [{ exists: false }] }));
  return Boolean(res.rows[0]?.exists);
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

  async getOpeningSession(callId: string, orgId: string): Promise<OpeningSessionView | null> {
    const hasSummary = await hasWitnessSummaryColumn();
    const res = await query<any>(
      `SELECT bos.id, bos.call_id AS "callId", bos.opened_at AS "openedAt",
              bos.conducted_by_user_id AS "conductedByUserId",
              u.full_name AS "conductedByName",
              bos.session_status AS "sessionStatus",
              bos.protocol_type AS "protocolType",
              bos.quorum_verified AS "quorumVerified",
              bos.register_sha256 AS "registerSha256",
              bos.notes,
              ${hasSummary ? 'bos.witness_summary' : 'NULL::jsonb'} AS "witnessSummary"
       FROM bid_opening_sessions bos
       JOIN calls c ON c.id = bos.call_id
       JOIN users u ON u.id = bos.conducted_by_user_id
       WHERE bos.call_id = $1 AND c.organization_id = $2
       ORDER BY bos.opened_at DESC
       LIMIT 1`,
      [callId, orgId]
    );

    if (!res.rows.length) return null;
    const row = res.rows[0];

    const witRes = await query<any>(
      `SELECT bow.user_id AS "userId", u.full_name AS name, bow.witness_role AS "witnessRole",
              bow.signed_at AS "signedAt", bow.digital_signature_hash AS "signatureHash"
       FROM bid_opening_witnesses bow
       JOIN users u ON u.id = bow.user_id
       WHERE bow.session_id = $1
       ORDER BY bow.signed_at ASC NULLS LAST`,
      [row.id]
    );

    let witnesses: OpeningSessionView['witnesses'] = witRes.rows;
    if (Array.isArray(row.witnessSummary) && row.witnessSummary.length > 0) {
      const seenUserIds = new Set(witnesses.map((w) => w.userId).filter(Boolean));
      for (const extra of row.witnessSummary) {
        if (extra && (!extra.userId || !seenUserIds.has(extra.userId))) {
          witnesses.push({
            userId: extra.userId || null,
            name: extra.name || 'Co-Witness',
            witnessRole: extra.witnessRole || 'External Witness',
            signedAt: extra.signedAt || row.openedAt,
            signatureHash: extra.signatureHash || null,
          });
        }
      }
    }

    return {
      id: row.id,
      callId: row.callId,
      openedAt: row.openedAt,
      conductedByUserId: row.conductedByUserId,
      conductedByName: row.conductedByName,
      sessionStatus: row.sessionStatus,
      protocolType: row.protocolType,
      quorumVerified: row.quorumVerified,
      registerSha256: row.registerSha256,
      notes: row.notes,
      witnesses,
    };
  }

  /**
   * Seals and submits a bid envelope.
   * Server validates closing deadline, existing lock state, and computes cryptographic SHA-256 seal.
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

    const payloadStr = JSON.stringify({
      callId: data.callId,
      supplierId: data.supplierId,
      items: data.financialSchedule,
      timestamp: new Date().toISOString(),
    });
    const sealedHash = crypto.createHash('sha256').update(payloadStr).digest('hex');
    const receiptNumber = `BID-${call.reference_no.replace(/[^a-zA-Z0-9]/g, '')}-${Date.now().toString().slice(-6)}`;

    return tx(async (client) => {
      // Prevent modification of already opened or disqualified bids
      const existingBid = await client.query<{ id: string; status: string }>(
        `SELECT id, status FROM bids WHERE call_id = $1 AND supplier_id = $2 FOR UPDATE`,
        [data.callId, data.supplierId]
      );
      if (existingBid.rows.length > 0 && ['opened', 'disqualified'].includes(existingBid.rows[0].status)) {
        const err: any = new Error('This bid envelope has already been opened or disqualified and cannot be modified.');
        err.status = 400;
        err.code = 'BID_LOCKED';
        throw err;
      }

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

      await client.query(`DELETE FROM bid_price_items WHERE bid_id = $1`, [bidId]);
      for (const item of data.financialSchedule) {
        await client.query(
          `INSERT INTO bid_price_items (bid_id, line_no, description, quantity, unit_price)
           VALUES ($1, $2, $3, $4, $5)`,
          [bidId, item.lineNo, item.description, item.quantity, item.unitPrice]
        );
      }

      await client.query(
        `INSERT INTO bid_sealing_receipts (bid_id, receipt_number, sealed_hash, file_fingerprints, generated_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [bidId, receiptNumber, sealedHash, JSON.stringify([{ role: 'financial_schedule', sha256: sealedHash }])]
      );

      await auditRepository.logEvent(
        {
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
        },
        client
      );

      await notificationsRepository.notifyOrganizationMembers(
        call.organization_id,
        {
          supplierId: data.supplierId,
          eventType: 'bid_submitted',
          title: `Sealed bid received for ${call.reference_no}`,
          body: `${sup.legal_name} submitted a sealed bid (receipt ${receiptNumber}). Pricing stays locked until the witnessed opening session.`,
          linkUrl: 'bids-opening',
          priority: 'info',
          permissionCode: 'bids.view',
          data: {
            callId: data.callId,
            callNumber: call.reference_no,
            supplierName: sup.legal_name,
            bidId,
            receiptNumber,
          },
        },
        client
      );

      return { bidId, receiptNumber, sealedHash };
    });
  }

  /**
   * Pre-closing withdrawal of a submitted sealed bid (also withdraws linked active application).
   */
  async withdrawBid(data: {
    callId: string;
    supplierId: string;
    userId: string;
    reason?: string;
    actorName: string;
    actorRole: string;
    ipAddress?: string;
  }): Promise<{ bidId: string; withdrawnAt: string }> {
    return tx(async (client) => {
      const callRes = await client.query<{
        id: string;
        organization_id: string;
        reference_no: string;
        closes_at: string | null;
      }>(
        `SELECT id, organization_id, reference_no, closes_at FROM calls WHERE id = $1 FOR UPDATE`,
        [data.callId]
      );
      if (!callRes.rows.length) {
        const err: any = new Error('Tender call does not exist.');
        err.status = 404;
        err.code = 'CALL_NOT_FOUND';
        throw err;
      }
      const call = callRes.rows[0];

      if (call.closes_at && new Date() > new Date(call.closes_at)) {
        const err: any = new Error('The tender closing deadline has passed; sealed bids can no longer be withdrawn.');
        err.status = 400;
        err.code = 'CALL_CLOSED';
        throw err;
      }

      const bidRes = await client.query<{ id: string; status: string; receipt_number: string | null }>(
        `SELECT id, status, receipt_number FROM bids WHERE call_id = $1 AND supplier_id = $2 FOR UPDATE`,
        [data.callId, data.supplierId]
      );
      if (!bidRes.rows.length) {
        const err: any = new Error('No submitted bid was found for this tender call.');
        err.status = 404;
        err.code = 'BID_NOT_FOUND';
        throw err;
      }
      const bid = bidRes.rows[0];
      if (['opened', 'disqualified'].includes(bid.status)) {
        const err: any = new Error('Already opened or disqualified bids cannot be withdrawn.');
        err.status = 400;
        err.code = 'BID_LOCKED';
        throw err;
      }
      if (bid.status === 'withdrawn') {
        const err: any = new Error('This bid has already been withdrawn.');
        err.status = 400;
        err.code = 'BID_ALREADY_WITHDRAWN';
        throw err;
      }

      const cleanReason = (data.reason || 'Withdrawn by supplier prior to tender closing deadline').trim();
      await client.query(`UPDATE bids SET status = 'withdrawn', updated_at = NOW() WHERE id = $1`, [bid.id]);

      const appSync = await client.query<{ id: string }>(
        `UPDATE applications
         SET status = 'Withdrawn',
             withdrawn_at = NOW(),
             withdrawal_reason = $3,
             updated_at = NOW()
         WHERE call_id = $1
           AND supplier_id = $2
           AND status IN ('Submitted', 'Under review', 'More information requested')
         RETURNING id`,
        [data.callId, data.supplierId, cleanReason]
      );
      if (appSync.rows.length > 0) {
        await client.query(
          `INSERT INTO application_timeline (application_id, stage, note, created_by_user_id, created_at)
           VALUES ($1, 'Withdrawn', $2, $3, NOW())`,
          [appSync.rows[0].id, cleanReason, data.userId]
        );
      }

      await auditRepository.logEvent(
        {
          actorName: data.actorName,
          actorRole: data.actorRole,
          actorUserId: data.userId,
          supplierId: data.supplierId,
          organizationId: call.organization_id,
          action: 'Bid Withdrawn',
          entityType: 'Bid',
          entityId: bid.id,
          ipAddress: data.ipAddress,
          details: `Withdrew sealed bid ${bid.receipt_number || bid.id} for ${call.reference_no} prior to closing. Reason: ${cleanReason}`,
        },
        client
      );

      await notificationsRepository.notifyOrganizationMembers(
        call.organization_id,
        {
          supplierId: data.supplierId,
          eventType: 'bid_withdrawn',
          title: `Sealed bid withdrawn for ${call.reference_no}`,
          body: `A supplier withdrew sealed bid ${bid.receipt_number || bid.id} before the closing deadline. Open bids opening to view the register.`,
          linkUrl: 'bids-opening',
          priority: 'warning',
          permissionCode: 'bids.view',
          data: {
            callId: data.callId,
            callNumber: call.reference_no,
            receiptNumber: bid.receipt_number || bid.id,
            bidId: bid.id,
          },
        },
        client
      );

      return { bidId: bid.id, withdrawnAt: new Date().toISOString() };
    });
  }

  /**
   * Conducts controlled bid opening session with strict closing deadline, duplicate-session,
   * submitted-bid existence, >=2 witness quorum, register SHA-256, and atomic audit/notifications.
   */
  async conductOpeningSession(data: {
    callId: string;
    orgId: string;
    userId: string;
    actorName: string;
    actorRole: string;
    witnesses: OpeningSessionWitnessInput[];
    ipAddress?: string;
  }): Promise<{ sessionId: string; openedBidsCount: number; registerSha256: string; witnesses: OpeningSessionView['witnesses'] }> {
    const hasSummary = await hasWitnessSummaryColumn();

    return tx(async (client) => {
      // 1. Lock call & verify ownership + closing deadline
      const callRes = await client.query<{ id: string; reference_no: string; title: string; closes_at: string | null }>(
        `SELECT id, reference_no, title, closes_at FROM calls WHERE id = $1 AND organization_id = $2 FOR UPDATE`,
        [data.callId, data.orgId]
      );
      if (!callRes.rows.length) {
        const err: any = new Error('Tender call not found for your organization.');
        err.status = 404;
        err.code = 'CALL_NOT_FOUND';
        throw err;
      }
      const call = callRes.rows[0];

      if (!call.closes_at || new Date() < new Date(call.closes_at)) {
        const err: any = new Error('Bids cannot be opened before the closing time. The statutory sealing protocol remains active.');
        err.status = 400;
        err.code = 'BEFORE_CLOSING_DEADLINE';
        throw err;
      }

      // 2. Prevent duplicate completed opening sessions
      const existingSession = await client.query<{ id: string }>(
        `SELECT id FROM bid_opening_sessions WHERE call_id = $1 AND session_status = 'completed' LIMIT 1`,
        [data.callId]
      );
      if (existingSession.rows.length > 0) {
        const err: any = new Error('An official bid opening session has already been completed for this tender call.');
        err.status = 409;
        err.code = 'ALREADY_OPENED';
        throw err;
      }

      // 3. Ensure at least one submitted sealed bid exists
      const bidsRes = await client.query<{
        id: string;
        supplier_id: string;
        supplier_name: string;
        receipt_number: string | null;
        payload_sha256: string | null;
      }>(
        `SELECT b.id, b.supplier_id, s.legal_name AS supplier_name, b.receipt_number, b.payload_sha256
         FROM bids b
         JOIN suppliers s ON s.id = b.supplier_id
         WHERE b.call_id = $1 AND b.status = 'submitted'
         ORDER BY b.submitted_at ASC
         FOR UPDATE OF b`,
        [data.callId]
      );
      if (!bidsRes.rows.length) {
        const err: any = new Error('Cannot conduct an opening ceremony: there are no submitted sealed bids awaiting unsealing.');
        err.status = 400;
        err.code = 'NO_SUBMITTED_BIDS';
        throw err;
      }

      // 4. Validate witness quorum (>= 2 witnesses)
      const membersRes = await client.query<{
        userId: string;
        fullName: string;
        email: string;
        roleName: string;
      }>(
        `SELECT om.user_id AS "userId", u.full_name AS "fullName", u.email, r.name AS "roleName"
         FROM organization_members om
         JOIN users u ON u.id = om.user_id AND u.deleted_at IS NULL
         JOIN roles r ON r.id = om.role_id
         WHERE om.organization_id = $1 AND om.status = 'active'`,
        [data.orgId]
      );
      const memberMap = new Map(membersRes.rows.map((m) => [m.userId, m]));

      const orgWitnesses = new Map<string, { userId: string; name: string; witnessRole: string }>();
      const presidingMember = memberMap.get(data.userId);
      if (presidingMember) {
        orgWitnesses.set(data.userId, {
          userId: data.userId,
          name: presidingMember.fullName,
          witnessRole: 'Presiding Officer',
        });
      }

      const externalWitnesses: { userId: null; name: string; witnessRole: string }[] = [];
      const suppliedList = Array.isArray(data.witnesses) ? data.witnesses : [];

      for (const w of suppliedList) {
        if (!w) continue;
        if (w.userId) {
          if (!UUID_REGEX.test(w.userId)) {
            const err: any = new Error('Invalid witness user identifier provided.');
            err.status = 400;
            err.code = 'INVALID_WITNESS';
            throw err;
          }
          const member = memberMap.get(w.userId);
          if (!member) {
            const err: any = new Error('Selected witness is not an active member of your procuring organization.');
            err.status = 400;
            err.code = 'INVALID_WITNESS';
            throw err;
          }
          orgWitnesses.set(member.userId, {
            userId: member.userId,
            name: member.fullName,
            witnessRole: (w.witnessRole || member.roleName || 'Witness').trim().slice(0, 50),
          });
        } else if (w.name && w.name.trim().length >= 2) {
          externalWitnesses.push({
            userId: null,
            name: w.name.trim().slice(0, 150),
            witnessRole: (w.witnessRole || 'External Co-Witness').trim().slice(0, 50),
          });
        }
      }

      if (membersRes.rows.length >= 2 && orgWitnesses.size < 2) {
        const err: any = new Error(
          'Quorum not met: Statutory bid opening requires at least 2 distinct organization officers/witnesses to co-sign.'
        );
        err.status = 400;
        err.code = 'QUORUM_NOT_MET';
        throw err;
      }

      const totalWitnessCount = orgWitnesses.size + (presidingMember ? 0 : 1) + externalWitnesses.length;
      if (totalWitnessCount < 2) {
        const err: any = new Error(
          'Quorum not met: At least 2 witnesses (a presiding officer plus a co-witness or external witness) must be recorded.'
        );
        err.status = 400;
        err.code = 'QUORUM_NOT_MET';
        throw err;
      }

      const openedAtIso = new Date().toISOString();
      const witnessRoster: OpeningSessionView['witnesses'] = [
        ...Array.from(orgWitnesses.values()).map((w) => ({
          userId: w.userId,
          name: w.name,
          witnessRole: w.witnessRole,
          signedAt: openedAtIso,
          signatureHash: crypto
            .createHash('sha256')
            .update(`${data.callId}|${w.userId}|${openedAtIso}`)
            .digest('hex'),
        })),
        ...externalWitnesses.map((w) => ({
          userId: null,
          name: w.name,
          witnessRole: w.witnessRole,
          signedAt: openedAtIso,
          signatureHash: crypto
            .createHash('sha256')
            .update(`${data.callId}|${w.name}|${openedAtIso}`)
            .digest('hex'),
        })),
      ];

      const summaryNote = `Presiding: ${data.actorName}. Witnesses: ${witnessRoster
        .map((w) => `${w.name} (${w.witnessRole})`)
        .join('; ')}.`;

      // 5. Create opening session
      const sessionRes = await client.query<{ id: string }>(
        hasSummary
          ? `INSERT INTO bid_opening_sessions (
              call_id, conducted_by_user_id, session_status, protocol_type, quorum_verified, notes, witness_summary, opened_at
            ) VALUES ($1, $2, 'completed', 'dual_key_statutory_quorum', TRUE, $3, $4::jsonb, $5::timestamptz)
            RETURNING id`
          : `INSERT INTO bid_opening_sessions (
              call_id, conducted_by_user_id, session_status, protocol_type, quorum_verified, notes, opened_at
            ) VALUES ($1, $2, 'completed', 'dual_key_statutory_quorum', TRUE, $3, $4::timestamptz)
            RETURNING id`,
        hasSummary
          ? [data.callId, data.userId, summaryNote, JSON.stringify(witnessRoster), openedAtIso]
          : [data.callId, data.userId, summaryNote, openedAtIso]
      );
      const sessionId = sessionRes.rows[0].id;

      // 6. Record org-member witnesses into bid_opening_witnesses
      for (const w of witnessRoster) {
        if (!w.userId) continue;
        await client.query(
          `INSERT INTO bid_opening_witnesses (session_id, user_id, witness_role, digital_signature_hash, ip_address, signed_at)
           VALUES ($1, $2, $3, $4, $5, $6::timestamptz) ON CONFLICT DO NOTHING`,
          [sessionId, w.userId, w.witnessRole, w.signatureHash, data.ipAddress || null, openedAtIso]
        );
      }

      // 7. Unseal all submitted bids for this call
      const openedBidsSummary: any[] = [];
      for (const b of bidsRes.rows) {
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
               opened_at = $5::timestamptz,
               unsealed_by_user_id = $4,
               updated_at = NOW()
           WHERE id = $1`,
          [b.id, totalPrice, sessionId, data.userId, openedAtIso]
        );

        openedBidsSummary.push({
          bidId: b.id,
          supplierId: b.supplier_id,
          supplierName: b.supplier_name,
          receiptNumber: b.receipt_number,
          payloadSha256: b.payload_sha256,
          totalPrice,
        });
      }

      // 8. Compute canonical register SHA-256 over witnesses and unsealed bids
      const registerSha256 = crypto
        .createHash('sha256')
        .update(
          JSON.stringify({
            sessionId,
            callId: data.callId,
            referenceNo: call.reference_no,
            openedAt: openedAtIso,
            witnesses: witnessRoster.map((w) => ({ userId: w.userId, name: w.name, role: w.witnessRole })),
            bids: openedBidsSummary,
          })
        )
        .digest('hex');

      await client.query(
        `UPDATE bid_opening_sessions SET register_sha256 = $2 WHERE id = $1`,
        [sessionId, registerSha256]
      );

      // 9. Transition call status to evaluating
      await client.query(`UPDATE calls SET status = 'evaluating', updated_at = NOW() WHERE id = $1`, [data.callId]);

      // 10. Atomic audit log & notifications
      await auditRepository.logEvent(
        {
          actorName: data.actorName,
          actorRole: data.actorRole,
          actorUserId: data.userId,
          organizationId: data.orgId,
          action: 'Bids Unsealed in Opening Session',
          entityType: 'Call',
          entityId: data.callId,
          ipAddress: data.ipAddress,
          afterJson: { sessionId, registerSha256, witnessCount: witnessRoster.length, openedBidsCount: bidsRes.rows.length },
          details: `Official opening session conducted for ${call.reference_no}. Unsealed ${bidsRes.rows.length} bids with ${witnessRoster.length} witnesses (Register SHA-256: ${registerSha256.slice(0, 16)}...).`,
        },
        client
      );

      for (const ob of openedBidsSummary) {
        await notificationsRepository.notifySupplierMembers(
          ob.supplierId,
          {
            organizationId: data.orgId,
            eventType: 'bid_opened',
            title: `Sealed bid opened for ${call.reference_no}`,
            body: `Your bid (${ob.receiptNumber || ob.bidId}) for ${call.title} was unsealed during the witnessed opening session. Check your applications for evaluation updates.`,
            linkUrl: 'applications',
            priority: 'info',
            data: {
              callId: data.callId,
              callNumber: call.reference_no,
              callTitle: call.title,
              receiptNumber: ob.receiptNumber || ob.bidId,
              sessionId,
              registerSha256,
            },
          },
          client
        );
      }

      return {
        sessionId,
        openedBidsCount: bidsRes.rows.length,
        registerSha256,
        witnesses: witnessRoster,
      };
    });
  }
}

export const bidsRepository = new BidsRepository();
