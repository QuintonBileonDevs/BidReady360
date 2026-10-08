import { query, withTransaction } from '../db/client';
import { auditRepository } from './audit.repository';

export interface ApplicationView {
  id: string;
  callId: string;
  callNumber: string;
  callTitle: string;
  supplierId: string;
  supplierLegalName: string;
  cipaUin: string;
  organizationId: string;
  organizationName: string;
  status: string;
  receiptNumber: string | null;
  submittedAt: string | null;
  answers: Record<string, any> | null;
  documents: { documentTypeId: string; code: string; name: string; versionNo: number; sha256: string; storageKey: string }[];
  timeline: { stage: string; note: string | null; createdAt: string }[];
}

export class ApplicationsRepository {
  async getByCallAndSupplier(callId: string, supplierId: string): Promise<ApplicationView | null> {
    const res = await query<any>(
      `SELECT a.id, a.call_id AS "callId", c.reference_no AS "callNumber", c.title AS "callTitle",
              a.supplier_id AS "supplierId", s.legal_name AS "supplierLegalName", s.cipa_uin AS "cipaUin",
              a.organization_id AS "organizationId", o.name AS "organizationName",
              a.status, a.receipt_number AS "receiptNumber", a.submitted_at AS "submittedAt", a.answers
       FROM applications a
       JOIN calls c ON c.id = a.call_id
       JOIN suppliers s ON s.id = a.supplier_id
       JOIN organizations o ON o.id = a.organization_id
       WHERE a.call_id = $1 AND a.supplier_id = $2`,
      [callId, supplierId]
    );

    if (!res.rows.length) return null;
    const base = res.rows[0];

    const [docsRes, timelineRes] = await Promise.all([
      query(
        `SELECT ad.document_type_id AS "documentTypeId", dt.code, dt.name,
                ad.pinned_version_no AS "versionNo", ad.pinned_sha256 AS "sha256",
                sdv.storage_key AS "storageKey"
         FROM application_documents ad
         JOIN document_types dt ON dt.id = ad.document_type_id
         LEFT JOIN supplier_document_versions sdv ON sdv.id = ad.document_version_id
         WHERE ad.application_id = $1`,
        [base.id]
      ),
      query(
        `SELECT stage, note, created_at AS "createdAt"
         FROM application_timeline
         WHERE application_id = $1
         ORDER BY created_at ASC`,
        [base.id]
      ),
    ]);

    return {
      ...base,
      documents: docsRes.rows,
      timeline: timelineRes.rows,
    };
  }

  async listByOrganization(orgId: string): Promise<ApplicationView[]> {
    const res = await query<any>(
      `SELECT a.id, a.call_id AS "callId", c.reference_no AS "callNumber", c.title AS "callTitle",
              a.supplier_id AS "supplierId", s.legal_name AS "supplierLegalName", s.cipa_uin AS "cipaUin",
              a.organization_id AS "organizationId", o.name AS "organizationName",
              a.status, a.receipt_number AS "receiptNumber", a.submitted_at AS "submittedAt", a.answers
       FROM applications a
       JOIN calls c ON c.id = a.call_id
       JOIN suppliers s ON s.id = a.supplier_id
       JOIN organizations o ON o.id = a.organization_id
       WHERE a.organization_id = $1
       ORDER BY a.submitted_at DESC NULLS LAST, a.created_at DESC`,
      [orgId]
    );
    return res.rows;
  }

  async listBySupplier(supplierId: string): Promise<ApplicationView[]> {
    const res = await query<any>(
      `SELECT a.id, a.call_id AS "callId", c.reference_no AS "callNumber", c.title AS "callTitle",
              a.supplier_id AS "supplierId", s.legal_name AS "supplierLegalName", s.cipa_uin AS "cipaUin",
              a.organization_id AS "organizationId", o.name AS "organizationName",
              a.status, a.receipt_number AS "receiptNumber", a.submitted_at AS "submittedAt", a.answers
       FROM applications a
       JOIN calls c ON c.id = a.call_id
       JOIN suppliers s ON s.id = a.supplier_id
       JOIN organizations o ON o.id = a.organization_id
       WHERE a.supplier_id = $1
       ORDER BY a.submitted_at DESC NULLS LAST, a.created_at DESC`,
      [supplierId]
    );
    return res.rows;
  }

  /**
   * Submit an application with strict mandatory document verification.
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
    // 1. Fetch Call & verify closing date
    const callRes = await query<{ id: string; organization_id: string; reference_no: string; title: string; closes_at: string | null }>(
      `SELECT id, organization_id, reference_no, title, closes_at FROM calls WHERE id = $1`,
      [data.callId]
    );
    if (!callRes.rows.length) throw new Error('Call does not exist.');
    const call = callRes.rows[0];

    if (call.closes_at && new Date() > new Date(call.closes_at)) {
      throw new Error('The closing time has passed; applications can no longer be submitted.');
    }

    // 2. Enforce Mandatory Documents check
    const reqDocsRes = await query<{ document_type_id: string; code: string; name: string }>(
      `SELECT crd.document_type_id, dt.code, dt.name
       FROM call_required_documents crd
       JOIN document_types dt ON dt.id = crd.document_type_id
       WHERE crd.call_id = $1 AND crd.is_mandatory = TRUE`,
      [data.callId]
    );

    // Fetch supplier's attached versions
    let attachedVersions: any[] = [];
    if (data.attachedDocumentVersionIds.length > 0) {
      const vRes = await query<{ id: string; document_type_id: string; version_no: number; sha256: string; document_number: string | null; expiry_date: string | null }>(
        `SELECT sdv.id, sd.document_type_id, sdv.version_no, sdv.sha256, sdv.document_number, sdv.expiry_date
         FROM supplier_document_versions sdv
         JOIN supplier_documents sd ON sd.id = sdv.document_id
         WHERE sdv.id = ANY($1::uuid[]) AND sd.supplier_id = $2`,
        [data.attachedDocumentVersionIds, data.supplierId]
      );
      attachedVersions = vRes.rows;
    }

    // Check that every mandatory document is provided
    const attachedTypeIds = new Set(attachedVersions.map((v) => v.document_type_id));
    for (const reqDoc of reqDocsRes.rows) {
      if (!attachedTypeIds.has(reqDoc.document_type_id)) {
        throw new Error(`Mandatory document missing: You must attach a valid ${reqDoc.name} (${reqDoc.code}) to submit this application.`);
      }
    }

    const receiptNumber = `APP-${call.reference_no.replace(/[^a-zA-Z0-9]/g, '')}-${Date.now().toString().slice(-6)}`;

    return withTransaction(async (client) => {
      // 3. Upsert application
      const appRes = await client.query<{ id: string }>(
        `INSERT INTO applications (
          call_id, supplier_id, organization_id, status, answers, receipt_number,
          submitted_by_user_id, submitted_at, updated_at
        ) VALUES (
          $1, $2, $3, 'Submitted', $4, $5, $6, NOW(), NOW()
        )
        ON CONFLICT (call_id, supplier_id) DO UPDATE
        SET status = 'Submitted',
            answers = EXCLUDED.answers,
            receipt_number = EXCLUDED.receipt_number,
            submitted_by_user_id = EXCLUDED.submitted_by_user_id,
            submitted_at = NOW(),
            updated_at = NOW()
        RETURNING id`,
        [data.callId, data.supplierId, call.organization_id, JSON.stringify(data.answers), receiptNumber, data.userId]
      );
      const appId = appRes.rows[0].id;

      // 4. Pin Document Snapshots
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

      // 5. Write to application_timeline
      await client.query(
        `INSERT INTO application_timeline (application_id, stage, note, created_by_user_id, created_at)
         VALUES ($1, 'Submitted', 'Formal bid package submitted with statutory checksum receipt.', $2, NOW())`,
        [appId, data.userId]
      );

      // 6. Write to immutable audit_log
      await auditRepository.logEvent({
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
      });

      return { applicationId: appId, receiptNumber };
    });
  }

  async recordReviewDecision(data: {
    applicationId: string;
    orgId: string;
    userId: string;
    reviewerName: string;
    reviewerRole: string;
    decision: 'Approved' | 'Rejected' | 'More information requested';
    comment?: string;
    ipAddress?: string;
  }): Promise<void> {
    await withTransaction(async (client) => {
      // 1. Update application status
      await client.query(
        `UPDATE applications
         SET status = $2,
             decided_by_user_id = $3,
             decided_at = NOW(),
             decision_note = $4,
             updated_at = NOW()
         WHERE id = $1 AND organization_id = $5`,
        [data.applicationId, data.decision, data.userId, data.comment || null, data.orgId]
      );

      // 2. Add Timeline event
      await client.query(
        `INSERT INTO application_timeline (application_id, stage, note, created_by_user_id, created_at)
         VALUES ($1, $2, $3, $4, NOW())`,
        [data.applicationId, data.decision, data.comment || `Review decision recorded: ${data.decision}`, data.userId]
      );

      // 3. Write Audit Event
      await auditRepository.logEvent({
        actorName: data.reviewerName,
        actorRole: data.reviewerRole,
        actorUserId: data.userId,
        organizationId: data.orgId,
        action: `Application ${data.decision}`,
        entityType: 'Application',
        entityId: data.applicationId,
        ipAddress: data.ipAddress,
        details: `Official review decision recorded: ${data.decision}. Note: ${data.comment || 'None'}`,
      });
    });
  }
}

export const applicationsRepository = new ApplicationsRepository();
