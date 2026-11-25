import { Router, Request, Response } from 'express';
import { requireAuth, requirePlatformAdmin } from '../middleware/auth.middleware';
import { query } from '../db/client';
import { getIdKey } from '../config/secrets';
import { auditRepository } from '../repositories/audit.repository';
import { translateDbError } from '../db/errors';

const router = Router();

// Strict server-side authentication and platform super-admin authorization on every route
router.use(requireAuth, requirePlatformAdmin);

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const SAFE_PREVIEW_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
]);

// GET /api/admin/verification/queue
router.get('/verification/queue', async (_req: Request, res: Response) => {
  try {
    const encryptionKey = getIdKey();

    // Check if supplier_people.gender exists safely
    const genderColRes = await query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'supplier_people'
           AND column_name = 'gender'
       ) AS exists`
    );
    const hasGender = Boolean(genderColRes.rows[0]?.exists);
    const genderSelect = hasGender ? 'p.gender,' : 'NULL::varchar AS gender,';

    const [peopleRes, docsRes] = await Promise.all([
      query(
        `SELECT p.id,
                p.supplier_id AS "supplierId",
                s.legal_name AS "supplierName",
                s.cipa_uin AS "supplierCipa",
                p.full_name AS "fullName",
                p.person_role AS "personRole",
                p.ownership_percent AS "ownershipPercent",
                p.identity_type AS "identityType",
                ${genderSelect}
                p.nationality,
                p.is_citizen AS "isCitizen",
                p.kyc_status AS "kycStatus",
                p.kyc_verified_at AS "kycVerifiedAt",
                p.kyc_reference AS "kycReference",
                p.created_at AS "createdAt",
                p.updated_at AS "updatedAt",
                CASE WHEN p.national_identity_number_encrypted IS NOT NULL
                     THEN RIGHT(pgp_sym_decrypt(p.national_identity_number_encrypted, $1), 4)
                     ELSE NULL END AS "idLast4",
                p.national_identity_number_encrypted IS NOT NULL AS "hasId"
         FROM supplier_people p
         JOIN suppliers s ON s.id = p.supplier_id
         WHERE p.is_active = TRUE
         ORDER BY
           CASE p.kyc_status
             WHEN 'pending' THEN 0
             WHEN 'not_started' THEN 1
             WHEN 'failed' THEN 2
             ELSE 3
           END,
           p.updated_at DESC`,
        [encryptionKey]
      ),
      query(
        `SELECT d.id AS "documentId",
                v.id AS "versionId",
                d.supplier_id AS "supplierId",
                s.legal_name AS "supplierName",
                s.cipa_uin AS "supplierCipa",
                dt.code AS "documentTypeCode",
                dt.name AS "documentTypeName",
                d.title,
                v.version_no AS "versionNo",
                v.file_name AS "fileName",
                v.mime_type AS "mimeType",
                v.file_size_bytes AS "fileSizeBytes",
                v.document_number AS "documentNumber",
                v.issue_date AS "issueDate",
                v.expiry_date AS "expiryDate",
                v.verification_status AS "verificationStatus",
                v.verified_via AS "verifiedVia",
                v.verified_at AS "verifiedAt",
                v.verification_notes AS "verificationNotes",
                v.rejection_reason AS "rejectionReason",
                v.extraction_confidence AS "extractionConfidence",
                v.uploaded_at AS "uploadedAt"
         FROM supplier_documents d
         JOIN document_types dt ON dt.id = d.document_type_id
         JOIN supplier_document_versions v ON v.id = d.current_version_id
         JOIN suppliers s ON s.id = d.supplier_id
         WHERE d.status = 'active'
         ORDER BY
           CASE v.verification_status
             WHEN 'PENDING_VERIFICATION' THEN 0
             WHEN 'UNVERIFIABLE' THEN 1
             WHEN 'REJECTED' THEN 2
             ELSE 3
           END,
           v.uploaded_at DESC`
      ),
    ]);

    // Group active documents by supplier so admin can inspect supporting files alongside each director
    const docsBySupplier = new Map<string, any[]>();
    for (const doc of docsRes.rows) {
      const list = docsBySupplier.get(doc.supplierId) || [];
      list.push(doc);
      docsBySupplier.set(doc.supplierId, list);
    }

    const people = peopleRes.rows.map((p) => ({
      ...p,
      supportingDocuments: (docsBySupplier.get(p.supplierId) || []).map((d) => ({
        documentId: d.documentId,
        versionId: d.versionId,
        documentTypeCode: d.documentTypeCode,
        documentTypeName: d.documentTypeName,
        title: d.title,
        fileName: d.fileName,
        mimeType: d.mimeType,
        documentNumber: d.documentNumber,
        verificationStatus: d.verificationStatus,
        uploadedAt: d.uploadedAt,
      })),
    }));

    res.json({
      people,
      documents: docsRes.rows,
    });
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

// GET /api/admin/verification/documents/:versionId/file
router.get('/verification/documents/:versionId/file', async (req: Request, res: Response) => {
  try {
    const { versionId } = req.params;
    if (!UUID_REGEX.test(versionId)) {
      return res.status(400).json({ error: 'INVALID_ID', message: 'Invalid document version ID.' });
    }

    const fileRes = await query<{ content: Buffer; mimeType: string; fileName: string }>(
      `SELECT f.content, f.mime_type AS "mimeType", f.file_name AS "fileName"
       FROM document_files f
       JOIN supplier_document_versions v ON v.id = f.document_version_id
       WHERE v.id = $1
       LIMIT 1`,
      [versionId]
    );

    if (fileRes.rows.length === 0) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Uploaded document file not found.' });
    }

    const file = fileRes.rows[0];
    const safeMime = SAFE_PREVIEW_MIME_TYPES.has((file.mimeType || '').toLowerCase())
      ? file.mimeType
      : 'application/octet-stream';
    const safeFileName = (file.fileName || 'document').replace(/[^a-zA-Z0-9._-]/g, '_');

    res.setHeader('Content-Type', safeMime);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Disposition', `inline; filename="${safeFileName}"`);
    res.send(file.content);
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

// POST /api/admin/verification/people/:personId
router.post('/verification/people/:personId', async (req: Request, res: Response) => {
  try {
    const { personId } = req.params;
    if (!UUID_REGEX.test(personId)) {
      return res.status(400).json({ error: 'INVALID_ID', message: 'Invalid director ID.' });
    }

    const rawStatus = String(req.body?.status || '').trim().toLowerCase();
    const allowedStatuses = ['verified', 'failed', 'pending'];
    if (!allowedStatuses.includes(rawStatus)) {
      return res.status(400).json({
        error: 'INVALID_STATUS',
        message: 'Status must be verified, failed, or pending.',
      });
    }

    const rawNotes = req.body?.notes !== undefined && req.body?.notes !== null
      ? String(req.body.notes).trim().slice(0, 100)
      : null;

    if (rawStatus === 'failed' && !rawNotes) {
      return res.status(400).json({
        error: 'REASON_REQUIRED',
        message: 'Please provide a reason when rejecting director verification.',
      });
    }

    const existing = await query<{ id: string; supplierId: string; fullName: string }>(
      `SELECT id, supplier_id AS "supplierId", full_name AS "fullName"
       FROM supplier_people
       WHERE id = $1 AND is_active = TRUE
       LIMIT 1`,
      [personId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Director record not found.' });
    }

    const updatedRes = await query(
      `UPDATE supplier_people
       SET kyc_status = $2,
           kyc_verified_at = CASE WHEN $2 = 'verified' THEN NOW() ELSE NULL END,
           kyc_reference = $3,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, supplier_id AS "supplierId", full_name AS "fullName",
                 kyc_status AS "kycStatus", kyc_verified_at AS "kycVerifiedAt",
                 kyc_reference AS "kycReference"`,
      [personId, rawStatus, rawNotes || (rawStatus === 'verified' ? `Verified by ${req.user?.fullName || req.user?.email || 'Admin'}`.slice(0, 100) : null)]
    );

    try {
      await auditRepository.logEvent({
        actorName: req.user?.fullName || req.user?.email || 'Platform Admin',
        actorRole: 'Super Admin',
        supplierId: existing.rows[0].supplierId,
        action: rawStatus === 'verified' ? 'ADMIN_VERIFIED_DIRECTOR' : rawStatus === 'failed' ? 'ADMIN_REJECTED_DIRECTOR' : 'ADMIN_RESET_DIRECTOR_KYC',
        entityType: 'supplier_person',
        entityId: personId,
        details: `Set director ${existing.rows[0].fullName} KYC status to ${rawStatus}${rawNotes ? ` (${rawNotes})` : ''}`,
      });
    } catch (auditErr: any) {
      console.warn('[ADMIN VERIFY DIRECTOR AUDIT WARNING]:', auditErr?.message || auditErr);
    }

    res.json(updatedRes.rows[0]);
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

// POST /api/admin/verification/documents/:versionId
router.post('/verification/documents/:versionId', async (req: Request, res: Response) => {
  try {
    const { versionId } = req.params;
    if (!UUID_REGEX.test(versionId)) {
      return res.status(400).json({ error: 'INVALID_ID', message: 'Invalid document version ID.' });
    }

    const rawStatus = String(req.body?.status || '').trim().toUpperCase();
    const allowedStatuses = ['VERIFIED', 'REJECTED', 'UNVERIFIABLE', 'PENDING_VERIFICATION'];
    if (!allowedStatuses.includes(rawStatus)) {
      return res.status(400).json({
        error: 'INVALID_STATUS',
        message: 'Status must be VERIFIED, REJECTED, UNVERIFIABLE, or PENDING_VERIFICATION.',
      });
    }

    const notes = req.body?.notes !== undefined && req.body?.notes !== null
      ? String(req.body.notes).trim().slice(0, 1000)
      : null;
    const rejectionReason = rawStatus === 'REJECTED'
      ? String(req.body?.rejectionReason || req.body?.notes || '').trim().slice(0, 500)
      : null;

    if (rawStatus === 'REJECTED' && !rejectionReason) {
      return res.status(400).json({
        error: 'REASON_REQUIRED',
        message: 'Please provide a rejection reason for the supplier.',
      });
    }

    const existing = await query<{ versionId: string; documentId: string; supplierId: string; title: string }>(
      `SELECT v.id AS "versionId", d.id AS "documentId", d.supplier_id AS "supplierId", d.title
       FROM supplier_document_versions v
       JOIN supplier_documents d ON d.id = v.document_id
       WHERE v.id = $1
       LIMIT 1`,
      [versionId]
    );
    if (existing.rows.length === 0) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Document version not found.' });
    }

    const updatedRes = await query(
      `UPDATE supplier_document_versions
       SET verification_status = $2,
           verified_via = 'manual',
           verified_by_user_id = $3,
           verified_at = CASE WHEN $2 = 'VERIFIED' THEN NOW() ELSE NULL END,
           verification_notes = COALESCE($4, verification_notes),
           rejection_reason = $5
       WHERE id = $1
       RETURNING id AS "versionId", verification_status AS "verificationStatus",
                 verified_via AS "verifiedVia", verified_at AS "verifiedAt",
                 verification_notes AS "verificationNotes", rejection_reason AS "rejectionReason"`,
      [versionId, rawStatus, req.user!.id, notes, rejectionReason]
    );

    try {
      await auditRepository.logEvent({
        actorName: req.user?.fullName || req.user?.email || 'Platform Admin',
        actorRole: 'Super Admin',
        supplierId: existing.rows[0].supplierId,
        action: rawStatus === 'VERIFIED' ? 'ADMIN_VERIFIED_DOCUMENT' : 'ADMIN_UPDATED_DOCUMENT_VERIFICATION',
        entityType: 'supplier_document_version',
        entityId: versionId,
        details: `Set document "${existing.rows[0].title}" status to ${rawStatus}${rejectionReason ? ` (${rejectionReason})` : ''}`,
      });
    } catch (auditErr: any) {
      console.warn('[ADMIN VERIFY DOCUMENT AUDIT WARNING]:', auditErr?.message || auditErr);
    }

    res.json(updatedRes.rows[0]);
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

export { router as adminRouter };
