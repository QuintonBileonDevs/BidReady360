import { query, tx } from '../db/client';
import { auditRepository } from './audit.repository';
import { notificationsRepository } from './notifications.repository';

export interface ApplicationDocumentView {
  documentTypeId: string;
  documentVersionId: string;
  code: string;
  name: string;
  versionNo: number;
  sha256: string;
  storageKey: string | null;
  documentNumber: string | null;
  expiryDate: string | null;
  verificationStatus: string | null;
}

export interface ApplicationView {
  id: string;
  callId: string;
  callNumber: string;
  callTitle: string;
  callType?: string;
  closesAt?: string | null;
  supplierId: string;
  supplierLegalName: string;
  cipaUin: string;
  organizationId: string;
  organizationName: string;
  consentGrantId?: string | null;
  status: string;
  receiptNumber: string | null;
  submittedAt: string | null;
  withdrawnAt?: string | null;
  withdrawalReason?: string | null;
  decisionNote?: string | null;
  answers: Record<string, any> | null;
  documents: ApplicationDocumentView[];
  timeline: { stage: string; note: string | null; createdAt: string }[];
  informationRequest?: {
    id: string;
    message: string;
    requestedAt: string;
    dueAt: string | null;
    respondedAt: string | null;
    responseNote: string | null;
  } | null;
  bid?: {
    id: string;
    status: string;
    receiptNumber: string | null;
    sealedHash: string | null;
    totalAmountBWP: number | null;
  } | null;
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class ApplicationsRepository {
  private async hydrateApplications(rows: any[], includeSupplierBidPrice: boolean): Promise<ApplicationView[]> {
    if (!rows.length) return [];
    const appIds = rows.map((r) => r.id);
    const callSupplierPairs = rows.map((r) => ({ callId: r.callId, supplierId: r.supplierId }));

    const [docsRes, timelineRes, infoRes, bidsRes] = await Promise.all([
      query<any>(
        `SELECT ad.application_id AS "applicationId",
                ad.document_type_id AS "documentTypeId",
                ad.document_version_id AS "documentVersionId",
                dt.code,
                dt.name,
                ad.pinned_version_no AS "versionNo",
                ad.pinned_sha256 AS "sha256",
                sdv.storage_key AS "storageKey",
                COALESCE(ad.document_number_snapshot, sdv.document_number) AS "documentNumber",
                COALESCE(ad.expiry_date_snapshot, sdv.expiry_date) AS "expiryDate",
                sdv.verification_status AS "verificationStatus"
         FROM application_documents ad
         JOIN document_types dt ON dt.id = ad.document_type_id
         LEFT JOIN supplier_document_versions sdv ON sdv.id = ad.document_version_id
         WHERE ad.application_id = ANY($1::uuid[])
         ORDER BY dt.sort_order ASC, ad.attached_at ASC`,
        [appIds]
      ),
      query<any>(
        `SELECT application_id AS "applicationId", stage, note, created_at AS "createdAt"
         FROM application_timeline
         WHERE application_id = ANY($1::uuid[])
         ORDER BY created_at ASC`,
        [appIds]
      ),
      query<any>(
        `SELECT id, application_id AS "applicationId", message, requested_at AS "requestedAt",
                due_at AS "dueAt", responded_at AS "respondedAt", response_note AS "responseNote"
         FROM application_info_requests
         WHERE application_id = ANY($1::uuid[])
         ORDER BY requested_at DESC`,
        [appIds]
      ),
      query<any>(
        `SELECT id, call_id AS "callId", supplier_id AS "supplierId", status,
                receipt_number AS "receiptNumber", payload_sha256 AS "sealedHash",
                ${includeSupplierBidPrice ? 'total_price' : `CASE WHEN status = 'opened' THEN total_price ELSE NULL END`} AS "totalPrice"
         FROM bids
         WHERE call_id = ANY($1::uuid[]) AND supplier_id = ANY($2::uuid[])`,
        [
          Array.from(new Set(callSupplierPairs.map((p) => p.callId))),
          Array.from(new Set(callSupplierPairs.map((p) => p.supplierId))),
        ]
      ),
    ]);

    const docsByApp = new Map<string, ApplicationDocumentView[]>();
    for (const d of docsRes.rows) {
      const list = docsByApp.get(d.applicationId) || [];
      list.push(d);
      docsByApp.set(d.applicationId, list);
    }

    const timelineByApp = new Map<string, any[]>();
    for (const t of timelineRes.rows) {
      const list = timelineByApp.get(t.applicationId) || [];
      list.push({ stage: t.stage, note: t.note, createdAt: t.createdAt });
      timelineByApp.set(t.applicationId, list);
    }

    const latestInfoByApp = new Map<string, any>();
    for (const ir of infoRes.rows) {
      if (!latestInfoByApp.has(ir.applicationId)) {
        latestInfoByApp.set(ir.applicationId, {
          id: ir.id,
          message: ir.message,
          requestedAt: ir.requestedAt,
          dueAt: ir.dueAt,
          respondedAt: ir.respondedAt,
          responseNote: ir.responseNote,
        });
      }
    }

    const bidByPair = new Map<string, any>();
    for (const b of bidsRes.rows) {
      bidByPair.set(`${b.callId}|${b.supplierId}`, {
        id: b.id,
        status: b.status,
        receiptNumber: b.receiptNumber,
        sealedHash: b.sealedHash,
        totalAmountBWP: b.totalPrice !== null && b.totalPrice !== undefined ? Number(b.totalPrice) : null,
      });
    }

    return rows.map((row) => ({
      ...row,
      documents: docsByApp.get(row.id) || [],
      timeline: timelineByApp.get(row.id) || [],
      informationRequest: latestInfoByApp.get(row.id) || null,
      bid: bidByPair.get(`${row.callId}|${row.supplierId}`) || null,
    }));
  }

  async getByCallAndSupplier(callId: string, supplierId: string): Promise<ApplicationView | null> {
    const res = await query<any>(
      `SELECT a.id, a.call_id AS "callId", c.reference_no AS "callNumber", c.title AS "callTitle",
              c.call_type AS "callType", c.closes_at AS "closesAt",
              a.supplier_id AS "supplierId", s.legal_name AS "supplierLegalName", s.cipa_uin AS "cipaUin",
              a.organization_id AS "organizationId", o.name AS "organizationName",
              a.consent_grant_id AS "consentGrantId",
              a.status, a.receipt_number AS "receiptNumber", a.submitted_at AS "submittedAt",
              a.withdrawn_at AS "withdrawnAt", a.withdrawal_reason AS "withdrawalReason",
              a.decision_note AS "decisionNote", a.answers
       FROM applications a
       JOIN calls c ON c.id = a.call_id
       JOIN suppliers s ON s.id = a.supplier_id
       JOIN organizations o ON o.id = a.organization_id
       WHERE a.call_id = $1 AND a.supplier_id = $2`,
      [callId, supplierId]
    );

    if (!res.rows.length) return null;
    const hydrated = await this.hydrateApplications(res.rows, true);
    return hydrated[0];
  }

  async listByOrganization(orgId: string): Promise<ApplicationView[]> {
    const res = await query<any>(
      `SELECT a.id, a.call_id AS "callId", c.reference_no AS "callNumber", c.title AS "callTitle",
              c.call_type AS "callType", c.closes_at AS "closesAt",
              a.supplier_id AS "supplierId", s.legal_name AS "supplierLegalName", s.cipa_uin AS "cipaUin",
              a.organization_id AS "organizationId", o.name AS "organizationName",
              a.consent_grant_id AS "consentGrantId",
              a.status, a.receipt_number AS "receiptNumber", a.submitted_at AS "submittedAt",
              a.withdrawn_at AS "withdrawnAt", a.withdrawal_reason AS "withdrawalReason",
              a.decision_note AS "decisionNote", a.answers
       FROM applications a
       JOIN calls c ON c.id = a.call_id
       JOIN suppliers s ON s.id = a.supplier_id
       JOIN organizations o ON o.id = a.organization_id
       WHERE a.organization_id = $1 AND a.status <> 'Draft'
       ORDER BY a.submitted_at DESC NULLS LAST, a.created_at DESC`,
      [orgId]
    );
    return this.hydrateApplications(res.rows, false);
  }

  async listBySupplier(supplierId: string): Promise<ApplicationView[]> {
    const res = await query<any>(
      `SELECT a.id, a.call_id AS "callId", c.reference_no AS "callNumber", c.title AS "callTitle",
              c.call_type AS "callType", c.closes_at AS "closesAt",
              a.supplier_id AS "supplierId", s.legal_name AS "supplierLegalName", s.cipa_uin AS "cipaUin",
              a.organization_id AS "organizationId", o.name AS "organizationName",
              a.consent_grant_id AS "consentGrantId",
              a.status, a.receipt_number AS "receiptNumber", a.submitted_at AS "submittedAt",
              a.withdrawn_at AS "withdrawnAt", a.withdrawal_reason AS "withdrawalReason",
              a.decision_note AS "decisionNote", a.answers
       FROM applications a
       JOIN calls c ON c.id = a.call_id
       JOIN suppliers s ON s.id = a.supplier_id
       JOIN organizations o ON o.id = a.organization_id
       WHERE a.supplier_id = $1
       ORDER BY a.submitted_at DESC NULLS LAST, a.created_at DESC`,
      [supplierId]
    );
    return this.hydrateApplications(res.rows, true);
  }

  /**
   * Submit an application with strict mandatory document verification.
   * Respects existing finalized states and never reactivates revoked consent grants.
   */
  async submitApplication(data: {
    callId: string;
    supplierId: string;
    userId: string;
    answers: Record<string, any>;
    attachedDocumentVersionIds: string[];
    actorName: string;
    actorRole: string;
    ipAddress?: string;
  }): Promise<{ applicationId: string; receiptNumber: string }> {
    const callRes = await query<{
      id: string;
      organization_id: string;
      reference_no: string;
      title: string;
      status: string;
      closes_at: string | null;
      org_status: string;
    }>(
      `SELECT c.id, c.organization_id, c.reference_no, c.title, c.status, c.closes_at, o.status AS org_status
       FROM calls c
       JOIN organizations o ON o.id = c.organization_id AND o.deleted_at IS NULL
       WHERE c.id = $1`,
      [data.callId]
    );
    if (!callRes.rows.length) {
      const err: any = new Error('Call does not exist.');
      err.status = 404;
      err.code = 'CALL_NOT_FOUND';
      throw err;
    }
    const call = callRes.rows[0];

    if (call.org_status !== 'active') {
      const err: any = new Error('This opportunity is unavailable because the procuring organization is not currently active.');
      err.status = 403;
      err.code = 'ORGANIZATION_INACTIVE';
      throw err;
    }

    if (!['open', 'published'].includes(String(call.status || '').toLowerCase())) {
      const err: any = new Error('This call is not currently open for applications.');
      err.status = 400;
      err.code = 'CALL_NOT_OPEN';
      throw err;
    }

    if (call.closes_at && new Date() > new Date(call.closes_at)) {
      const err: any = new Error('The closing time has passed; applications can no longer be submitted.');
      err.status = 400;
      err.code = 'CALL_CLOSED';
      throw err;
    }

    const supRes = await query<{ status: string; verification_status: string; legal_name: string }>(
      `SELECT status, verification_status, legal_name FROM suppliers WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
      [data.supplierId]
    );
    if (!supRes.rows.length) {
      const err: any = new Error('Supplier profile not found.');
      err.status = 403;
      err.code = 'SUPPLIER_NOT_FOUND';
      throw err;
    }
    const sup = supRes.rows[0];
    if (String(sup.status || '').toLowerCase() !== 'active') {
      const err: any = new Error(
        `Application blocked: your supplier account is currently ${sup.status}. Contact BidReady360 compliance administration.`
      );
      err.status = 403;
      err.code = 'SUPPLIER_SUSPENDED';
      throw err;
    }
    if (String(sup.verification_status || '').toLowerCase() === 'rejected') {
      const err: any = new Error(
        'Application blocked: your supplier verification was rejected. Please address compliance findings before applying.'
      );
      err.status = 403;
      err.code = 'SUPPLIER_REJECTED';
      throw err;
    }

    const debarRes = await query<{ id: string; reason: string; ends_on: string | null }>(
      `SELECT id, reason, ends_on
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
      const err: any = new Error(
        `Application blocked: supplier is currently debarred (${deb.reason})${deb.ends_on ? ` until ${deb.ends_on}` : ' (permanent)'}.`
      );
      err.status = 403;
      err.code = 'SUPPLIER_DEBARRED';
      throw err;
    }

    const reqDocsRes = await query<{ document_type_id: string; code: string; name: string }>(
      `SELECT crd.document_type_id, dt.code, dt.name
       FROM call_required_documents crd
       JOIN document_types dt ON dt.id = crd.document_type_id
       WHERE crd.call_id = $1 AND crd.is_mandatory = TRUE`,
      [data.callId]
    );

    let attachedVersions: any[] = [];
    if (data.attachedDocumentVersionIds.length > 0) {
      const validUuids = data.attachedDocumentVersionIds.filter((id) => UUID_REGEX.test(String(id)));
      if (validUuids.length > 0) {
        const vRes = await query<{
          id: string;
          document_type_id: string;
          version_no: number;
          sha256: string;
          document_number: string | null;
          expiry_date: string | null;
          verification_status: string | null;
        }>(
          `SELECT sdv.id, sd.document_type_id, sdv.version_no, sdv.sha256,
                  sdv.document_number, sdv.expiry_date, sdv.verification_status
           FROM supplier_document_versions sdv
           JOIN supplier_documents sd ON sd.id = sdv.document_id
           WHERE (sdv.id = ANY($1::uuid[]) OR (sd.id = ANY($1::uuid[]) AND sd.current_version_id = sdv.id))
             AND sd.supplier_id = $2
             AND sd.status = 'active'
             AND COALESCE(UPPER(sdv.verification_status), 'PENDING_VERIFICATION') NOT IN ('REJECTED', 'EXPIRED', 'UNVERIFIABLE')
             AND (sdv.expiry_date IS NULL OR sdv.expiry_date >= CURRENT_DATE)`,
          [validUuids, data.supplierId]
        );
        attachedVersions = vRes.rows;
      }
    }

    const attachedTypeIds = new Set(attachedVersions.map((v) => v.document_type_id));
    for (const reqDoc of reqDocsRes.rows) {
      if (!attachedTypeIds.has(reqDoc.document_type_id)) {
        const err: any = new Error(
          `Mandatory document missing or invalid: You must attach a valid, non-rejected ${reqDoc.name} (${reqDoc.code}) to submit this application.`
        );
        err.status = 400;
        err.code = 'MANDATORY_DOCUMENT_MISSING';
        throw err;
      }
    }

    const receiptNumber = `APP-${call.reference_no.replace(/[^a-zA-Z0-9]/g, '')}-${Date.now().toString().slice(-6)}`;

    return tx(async (client) => {
      // Prevent resubmission over finalized decisions
      const existingApp = await client.query<{ id: string; status: string }>(
        `SELECT id, status FROM applications WHERE call_id = $1 AND supplier_id = $2 FOR UPDATE`,
        [data.callId, data.supplierId]
      );
      if (existingApp.rows.length > 0 && ['Approved', 'Rejected'].includes(existingApp.rows[0].status)) {
        const err: any = new Error(
          `This application has already been finalized (${existingApp.rows[0].status}) and cannot be overwritten.`
        );
        err.status = 400;
        err.code = 'APPLICATION_FINALIZED';
        throw err;
      }

      // Link ONLY an existing active, unexpired consent grant; never reactivate a revoked grant
      const activeGrantRes = await client.query<{ id: string }>(
        `SELECT id
         FROM consent_grants
         WHERE supplier_id = $1
           AND organization_id = $2
           AND status = 'active'
           AND (expires_at IS NULL OR expires_at > NOW())
         ORDER BY granted_at DESC
         LIMIT 1`,
        [data.supplierId, call.organization_id]
      );
      const consentGrantId = activeGrantRes.rows[0]?.id || null;

      const appRes = await client.query<{ id: string }>(
        `INSERT INTO applications (
          call_id, supplier_id, organization_id, consent_grant_id, status, answers, receipt_number,
          submitted_by_user_id, submitted_at, withdrawn_at, withdrawal_reason, updated_at
        ) VALUES (
          $1, $2, $3, $4, 'Submitted', $5, $6, $7, NOW(), NULL, NULL, NOW()
        )
        ON CONFLICT (call_id, supplier_id) DO UPDATE
        SET status = 'Submitted',
            consent_grant_id = COALESCE(EXCLUDED.consent_grant_id, applications.consent_grant_id),
            answers = EXCLUDED.answers,
            receipt_number = EXCLUDED.receipt_number,
            submitted_by_user_id = EXCLUDED.submitted_by_user_id,
            submitted_at = NOW(),
            withdrawn_at = NULL,
            withdrawal_reason = NULL,
            updated_at = NOW()
        RETURNING id`,
        [
          data.callId,
          data.supplierId,
          call.organization_id,
          consentGrantId,
          JSON.stringify(data.answers),
          receiptNumber,
          data.userId,
        ]
      );
      const appId = appRes.rows[0].id;

      if (consentGrantId) {
        await client.query(
          `INSERT INTO consent_grant_applications (consent_grant_id, application_id, attached_at)
           VALUES ($1, $2, NOW()) ON CONFLICT DO NOTHING`,
          [consentGrantId, appId]
        );
      }

      await client.query(`DELETE FROM application_documents WHERE application_id = $1`, [appId]);
      for (const v of attachedVersions) {
        await client.query(
          `INSERT INTO application_documents (
            application_id, document_version_id, document_type_id,
            pinned_version_no, pinned_sha256, document_number_snapshot, expiry_date_snapshot, attached_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
          [appId, v.id, v.document_type_id, v.version_no, v.sha256, v.document_number, v.expiry_date]
        );
      }

      await client.query(
        `INSERT INTO application_timeline (application_id, stage, note, created_by_user_id, created_at)
         VALUES ($1, 'Submitted', 'Formal dossier submitted with pinned vault document checksums.', $2, NOW())`,
        [appId, data.userId]
      );

      await auditRepository.logEvent(
        {
          actorName: data.actorName,
          actorRole: data.actorRole,
          actorUserId: data.userId,
          supplierId: data.supplierId,
          organizationId: call.organization_id,
          action: 'Application Submitted',
          entityType: 'Application',
          entityId: appId,
          ipAddress: data.ipAddress,
          details: `Application submitted for call ${call.reference_no} (Receipt: ${receiptNumber}). Attached ${attachedVersions.length} pinned document versions.`,
        },
        client
      );

      await notificationsRepository.notifyOrganizationMembers(
        call.organization_id,
        {
          supplierId: data.supplierId,
          eventType: 'application_submitted',
          title: `New application submitted for ${call.reference_no}`,
          body: `${sup.legal_name} submitted an application dossier (receipt ${receiptNumber}). Open the applications queue to review the submission.`,
          linkUrl: 'review-queue',
          priority: 'info',
          permissionCode: 'applications.view',
          data: {
            applicationId: appId,
            callId: data.callId,
            callNumber: call.reference_no,
            supplierName: sup.legal_name,
            receiptNumber,
          },
        },
        client
      );

      return { applicationId: appId, receiptNumber };
    });
  }

  /**
   * Withdraw a submitted application prior to closing deadline.
   */
  async withdrawApplication(data: {
    applicationIdOrCallId: string;
    supplierId: string;
    userId: string;
    reason?: string;
    actorName: string;
    actorRole: string;
    ipAddress?: string;
  }): Promise<{ applicationId: string; callId: string; withdrawnAt: string }> {
    if (!UUID_REGEX.test(data.applicationIdOrCallId)) {
      const err: any = new Error('Invalid application identifier.');
      err.status = 400;
      throw err;
    }

    return tx(async (client) => {
      const appRes = await client.query<{
        id: string;
        call_id: string;
        organization_id: string;
        status: string;
        reference_no: string;
        title: string;
        closes_at: string | null;
      }>(
        `SELECT a.id, a.call_id, a.organization_id, a.status, c.reference_no, c.title, c.closes_at
         FROM applications a
         JOIN calls c ON c.id = a.call_id
         WHERE (a.id = $1 OR a.call_id = $1) AND a.supplier_id = $2
         FOR UPDATE OF a`,
        [data.applicationIdOrCallId, data.supplierId]
      );
      if (!appRes.rows.length) {
        const err: any = new Error('Application not found.');
        err.status = 404;
        err.code = 'APPLICATION_NOT_FOUND';
        throw err;
      }
      const app = appRes.rows[0];

      if (!['Submitted', 'Under review', 'More information requested'].includes(app.status)) {
        const err: any = new Error(`Applications in "${app.status}" status cannot be withdrawn.`);
        err.status = 400;
        err.code = 'INVALID_STATE_TRANSITION';
        throw err;
      }

      if (app.closes_at && new Date() > new Date(app.closes_at)) {
        const err: any = new Error('Closing deadline has passed; applications can no longer be withdrawn.');
        err.status = 400;
        err.code = 'CALL_CLOSED';
        throw err;
      }

      const cleanReason = (data.reason || 'Withdrawn by supplier prior to closing deadline').trim();
      await client.query(
        `UPDATE applications
         SET status = 'Withdrawn',
             withdrawn_at = NOW(),
             withdrawal_reason = $2,
             updated_at = NOW()
         WHERE id = $1`,
        [app.id, cleanReason]
      );

      // Also withdraw any linked un-opened bid
      await client.query(
        `UPDATE bids
         SET status = 'withdrawn', updated_at = NOW()
         WHERE call_id = $1 AND supplier_id = $2 AND status IN ('draft', 'submitted')`,
        [app.call_id, data.supplierId]
      );

      await client.query(
        `INSERT INTO application_timeline (application_id, stage, note, created_by_user_id, created_at)
         VALUES ($1, 'Withdrawn', $2, $3, NOW())`,
        [app.id, cleanReason, data.userId]
      );

      await auditRepository.logEvent(
        {
          actorName: data.actorName,
          actorRole: data.actorRole,
          actorUserId: data.userId,
          supplierId: data.supplierId,
          organizationId: app.organization_id,
          action: 'Application Withdrawn',
          entityType: 'Application',
          entityId: app.id,
          ipAddress: data.ipAddress,
          details: `Supplier withdrew application for ${app.reference_no}. Reason: ${cleanReason}`,
        },
        client
      );

      await notificationsRepository.notifyOrganizationMembers(
        app.organization_id,
        {
          supplierId: data.supplierId,
          eventType: 'application_withdrawn',
          title: `Application withdrawn for ${app.reference_no}`,
          body: `${data.actorName || 'A supplier'} withdrew their application for ${app.title} before closing. Open the applications queue to view the updated list.`,
          linkUrl: 'review-queue',
          priority: 'warning',
          permissionCode: 'applications.view',
          data: {
            applicationId: app.id,
            callId: app.call_id,
            callNumber: app.reference_no,
            callTitle: app.title,
            supplierName: data.actorName || 'A supplier',
          },
        },
        client
      );

      return { applicationId: app.id, callId: app.call_id, withdrawnAt: new Date().toISOString() };
    });
  }

  /**
   * Supplier response to an open "More information requested" review cycle.
   */
  async respondToInfoRequest(data: {
    applicationId: string;
    supplierId: string;
    userId: string;
    responseMessage: string;
    actorName: string;
    actorRole: string;
    ipAddress?: string;
  }): Promise<void> {
    const cleanMsg = String(data.responseMessage || '').trim();
    if (!cleanMsg) {
      const err: any = new Error('Response message is required.');
      err.status = 400;
      throw err;
    }

    await tx(async (client) => {
      const appRes = await client.query<{
        id: string;
        call_id: string;
        organization_id: string;
        status: string;
        reference_no: string;
      }>(
        `SELECT a.id, a.call_id, a.organization_id, a.status, c.reference_no
         FROM applications a
         JOIN calls c ON c.id = a.call_id
         WHERE a.id = $1 AND a.supplier_id = $2
         FOR UPDATE OF a`,
        [data.applicationId, data.supplierId]
      );
      if (!appRes.rows.length) {
        const err: any = new Error('Application not found.');
        err.status = 404;
        throw err;
      }
      const app = appRes.rows[0];
      if (app.status !== 'More information requested') {
        const err: any = new Error('This application is not currently awaiting additional information.');
        err.status = 400;
        err.code = 'INVALID_STATE_TRANSITION';
        throw err;
      }

      await client.query(
        `UPDATE application_info_requests
         SET responded_at = NOW(),
             response_note = $2,
             responded_by_user_id = $3
         WHERE id = (
           SELECT id FROM application_info_requests
           WHERE application_id = $1 AND responded_at IS NULL
           ORDER BY requested_at DESC
           LIMIT 1
         )`,
        [app.id, cleanMsg.slice(0, 1990), data.userId]
      );

      await client.query(
        `INSERT INTO application_reviewer_messages (application_id, sender_user_id, sender_name, sender_role, message, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())`,
        [app.id, data.userId, data.actorName, data.actorRole, cleanMsg]
      );

      await client.query(
        `UPDATE applications SET status = 'Under review', updated_at = NOW() WHERE id = $1`,
        [app.id]
      );

      await client.query(
        `INSERT INTO application_timeline (application_id, stage, note, created_by_user_id, created_at)
         VALUES ($1, 'Under review', $2, $3, NOW())`,
        [app.id, `Supplier submitted clarification: ${cleanMsg.slice(0, 450)}`, data.userId]
      );

      await auditRepository.logEvent(
        {
          actorName: data.actorName,
          actorRole: data.actorRole,
          actorUserId: data.userId,
          supplierId: data.supplierId,
          organizationId: app.organization_id,
          action: 'Application Information Submitted',
          entityType: 'Application',
          entityId: app.id,
          ipAddress: data.ipAddress,
          details: `Supplier responded to information request on ${app.reference_no} and returned dossier to Under review.`,
        },
        client
      );

      await notificationsRepository.notifyOrganizationMembers(
        app.organization_id,
        {
          supplierId: data.supplierId,
          eventType: 'application_info_responded',
          title: `Additional information submitted for ${app.reference_no}`,
          body: `${data.actorName} replied to your information request. Open the applications queue to continue the review.`,
          linkUrl: 'review-queue',
          priority: 'info',
          permissionCode: 'applications.review',
          data: {
            applicationId: app.id,
            callId: app.call_id,
            callNumber: app.reference_no,
            actorName: data.actorName,
          },
        },
        client
      );
    });
  }

  /**
   * Record buyer application review decision enforcing valid state machine,
   * review trail rows, info requests, approved supplier roster sync, audit & notification.
   */
  async recordReviewDecision(data: {
    applicationId: string;
    orgId: string;
    userId: string;
    reviewerName: string;
    reviewerRole: string;
    decision: 'Under review' | 'Approved' | 'Rejected' | 'More information requested';
    comment?: string;
    ipAddress?: string;
  }): Promise<void> {
    const allowedDecisions = ['Under review', 'Approved', 'Rejected', 'More information requested'];
    if (!allowedDecisions.includes(data.decision)) {
      const err: any = new Error('Unsupported review decision.');
      err.status = 400;
      throw err;
    }
    const cleanComment = (data.comment || '').trim();
    if (data.decision === 'More information requested' && !cleanComment) {
      const err: any = new Error('Please specify what additional information is requested from the supplier.');
      err.status = 400;
      throw err;
    }
    if (data.decision === 'Rejected' && !cleanComment) {
      const err: any = new Error('Please provide a statutory reason when rejecting an application.');
      err.status = 400;
      throw err;
    }

    await tx(async (client) => {
      const appRes = await client.query<{
        id: string;
        call_id: string;
        supplier_id: string;
        status: string;
        reference_no: string;
        title: string;
      }>(
        `SELECT a.id, a.call_id, a.supplier_id, a.status, c.reference_no, c.title
         FROM applications a
         JOIN calls c ON c.id = a.call_id
         WHERE a.id = $1 AND a.organization_id = $2
         FOR UPDATE OF a`,
        [data.applicationId, data.orgId]
      );
      if (!appRes.rows.length) {
        const err: any = new Error('Application not found for your organization.');
        err.status = 404;
        err.code = 'APPLICATION_NOT_FOUND';
        throw err;
      }
      const app = appRes.rows[0];
      if (['Draft', 'Withdrawn', 'Approved', 'Rejected'].includes(app.status)) {
        const err: any = new Error(`Cannot record review decision: application is in "${app.status}" state.`);
        err.status = 400;
        err.code = 'INVALID_STATE_TRANSITION';
        throw err;
      }

      await client.query(
        `UPDATE applications
         SET status = $2,
             decided_by_user_id = $3,
             decided_at = NOW(),
             decision_note = $4,
             updated_at = NOW()
         WHERE id = $1 AND organization_id = $5`,
        [data.applicationId, data.decision, data.userId, cleanComment || null, data.orgId]
      );

      const reviewDecisionEnum =
        data.decision === 'Approved'
          ? 'approved'
          : data.decision === 'Rejected'
          ? 'rejected'
          : data.decision === 'More information requested'
          ? 'info_requested'
          : 'comment';

      await client.query(
        `INSERT INTO application_reviews (application_id, reviewer_user_id, decision, comment, decided_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [data.applicationId, data.userId, reviewDecisionEnum, cleanComment || `Status transitioned to ${data.decision}`]
      );

      if (data.decision === 'More information requested') {
        await client.query(
          `INSERT INTO application_info_requests (application_id, requested_by_user_id, message, requested_at)
           VALUES ($1, $2, $3, NOW())`,
          [data.applicationId, data.userId, cleanComment.slice(0, 1990)]
        );
      }

      if (data.decision === 'Approved') {
        await client.query(
          `INSERT INTO approved_suppliers (organization_id, supplier_id, source_application_id, status, valid_from, approved_at, last_reviewed_at)
           VALUES ($1, $2, $3, 'active', CURRENT_DATE, NOW(), NOW())
           ON CONFLICT (organization_id, supplier_id) DO UPDATE
           SET status = 'active',
               source_application_id = EXCLUDED.source_application_id,
               last_reviewed_at = NOW()`,
          [data.orgId, app.supplier_id, data.applicationId]
        );
      }

      await client.query(
        `INSERT INTO application_timeline (application_id, stage, note, created_by_user_id, created_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [data.applicationId, data.decision, cleanComment || `Review decision recorded: ${data.decision}`, data.userId]
      );

      await auditRepository.logEvent(
        {
          actorName: data.reviewerName,
          actorRole: data.reviewerRole,
          actorUserId: data.userId,
          organizationId: data.orgId,
          supplierId: app.supplier_id,
          action: `Application ${data.decision}`,
          entityType: 'Application',
          entityId: data.applicationId,
          ipAddress: data.ipAddress,
          details: `Official review decision recorded for ${app.reference_no}: ${data.decision}. Note: ${cleanComment || 'None'}`,
        },
        client
      );

      const nextStepNote = cleanComment
        ? `${cleanComment} Open your applications to review the details.`
        : data.decision === 'More information requested'
        ? 'Open your applications to respond to the buyer request.'
        : 'Open your applications to view the review details.';

      await notificationsRepository.notifySupplierMembers(
        app.supplier_id,
        {
          organizationId: data.orgId,
          eventType: 'application_status_changed',
          title: `Application status updated for ${app.reference_no}`,
          body: `Your application for ${app.title} is now ${data.decision}. ${nextStepNote}`,
          linkUrl: 'applications',
          priority: data.decision === 'More information requested' ? 'urgent' : data.decision === 'Approved' ? 'success' : 'warning',
          data: {
            applicationId: data.applicationId,
            callId: app.call_id,
            callNumber: app.reference_no,
            callTitle: app.title,
            status: data.decision,
            note: nextStepNote,
          },
        },
        client
      );
    });
  }
}

export const applicationsRepository = new ApplicationsRepository();
