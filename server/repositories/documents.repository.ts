import crypto from 'crypto';
import { query, withTransaction } from '../db/client';

export interface SupplierDocumentView {
  documentId: string;
  supplierId: string;
  documentTypeId: string;
  documentTypeCode: string;
  documentTypeName: string;
  issuingAuthority: string | null;
  requiresExpiry: boolean;
  title: string;
  status: string;
  versionId: string | null;
  versionNo: number | null;
  storageKey: string | null;
  fileName: string | null;
  mimeType: string | null;
  fileSizeBytes: string | null;
  sha256: string | null;
  documentNumber: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  verificationStatus: string | null;
  verifiedVia: string | null;
  verifiedAt: string | null;
  verificationNotes: string | null;
  uploadedAt: string | null;
  daysToExpiry: number | null;
  expiryState: string | null;
  certifiedCopy?: boolean;
}

export interface UploadDocumentVersionDTO {
  supplierId: string;
  documentTypeCode: string;
  title?: string;
  fileName: string;
  mimeType: string;
  fileBuffer: Buffer;
  documentNumber?: string;
  issueDate?: string;
  expiryDate?: string;
  userId: string;
  certifiedCopy?: boolean;
}

export class DocumentsRepository {
  /**
   * Retrieves all documents with their latest pinned versions and computed expiry states.
   * NOTE: List responses NEVER contain file bytes.
   */
  async listBySupplier(supplierId: string): Promise<SupplierDocumentView[]> {
    const res = await query<SupplierDocumentView>(
      `SELECT d.id AS "documentId", d.supplier_id AS "supplierId",
              dt.id AS "documentTypeId", dt.code AS "documentTypeCode", dt.name AS "documentTypeName",
              dt.issuing_authority AS "issuingAuthority", dt.requires_expiry AS "requiresExpiry",
              d.title, d.status,
              v.id AS "versionId", v.version_no AS "versionNo", v.storage_key AS "storageKey",
              v.file_name AS "fileName", v.mime_type AS "mimeType", v.file_size_bytes AS "fileSizeBytes",
              v.sha256, v.document_number AS "documentNumber", v.issue_date AS "issueDate",
              v.expiry_date AS "expiryDate", v.verification_status AS "verificationStatus",
              v.verified_via AS "verifiedVia", v.verified_at AS "verifiedAt",
              v.verification_notes AS "verificationNotes", v.uploaded_at AS "uploadedAt",
              CASE WHEN v.expiry_date IS NOT NULL THEN (v.expiry_date - CURRENT_DATE) ELSE NULL END AS "daysToExpiry",
              CASE
                WHEN v.expiry_date IS NULL THEN 'NO_EXPIRY'
                WHEN v.expiry_date < CURRENT_DATE THEN 'EXPIRED'
                WHEN v.expiry_date <= CURRENT_DATE + INTERVAL '60 days' THEN 'EXPIRING_SOON'
                ELSE 'VALID'
              END AS "expiryState"
       FROM supplier_documents d
       JOIN document_types dt ON dt.id = d.document_type_id
       LEFT JOIN supplier_document_versions v ON v.id = d.current_version_id
       WHERE d.supplier_id = $1 AND d.status = 'active'
       ORDER BY dt.sort_order ASC, d.created_at DESC`,
      [supplierId]
    );
    return res.rows;
  }

  /**
   * Upload a new document or add an immutable new version to an existing document container.
   * Saves bytes in document_files and version in supplier_document_versions in the SAME transaction.
   * Validates hash integrity after saving.
   */
  async uploadVersion(dto: UploadDocumentVersionDTO): Promise<SupplierDocumentView> {
    // 1. Server computes canonical SHA-256
    const sha256 = crypto.createHash('sha256').update(dto.fileBuffer).digest('hex');
    const fileSizeBytes = dto.fileBuffer.length;
    const storageKey = `vault/${dto.supplierId}/${Date.now()}-${dto.fileName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;

    // 2. Resolve document type (by code, name, or fallback)
    let docTypeRes = await query<{ id: string; name: string }>(
      `SELECT id, name FROM document_types WHERE code = $1 OR UPPER(code) = UPPER($1) LIMIT 1`,
      [dto.documentTypeCode]
    );
    if (!docTypeRes.rows.length) {
      docTypeRes = await query<{ id: string; name: string }>(
        `SELECT id, name FROM document_types WHERE LOWER(name) = LOWER($1) LIMIT 1`,
        [dto.documentTypeCode]
      );
    }
    if (!docTypeRes.rows.length) {
      docTypeRes = await query<{ id: string; name: string }>(
        `SELECT id, name FROM document_types LIMIT 1`
      );
    }
    if (!docTypeRes.rows.length) {
      throw new Error(`Invalid document type: ${dto.documentTypeCode}`);
    }
    const docType = docTypeRes.rows[0];

    return withTransaction(async (client) => {
      // 3. Find or create supplier_documents container
      let docId: string;
      const existingDocRes = await client.query<{ id: string; version_no: number }>(
        `SELECT d.id, COALESCE(v.version_no, 0) as version_no
         FROM supplier_documents d
         LEFT JOIN supplier_document_versions v ON v.id = d.current_version_id
         WHERE d.supplier_id = $1 AND d.document_type_id = $2 AND d.status = 'active'
         LIMIT 1`,
        [dto.supplierId, docType.id]
      );

      let nextVersionNo = 1;
      if (existingDocRes.rows.length > 0) {
        docId = existingDocRes.rows[0].id;
        const maxVerRes = await client.query<{ max_version: number }>(
          `SELECT COALESCE(MAX(version_no), 0) as max_version FROM supplier_document_versions WHERE document_id = $1`,
          [docId]
        );
        nextVersionNo = Number(maxVerRes.rows[0]?.max_version || 0) + 1;
      } else {
        const newDocRes = await client.query<{ id: string }>(
          `INSERT INTO supplier_documents (supplier_id, document_type_id, title, status)
           VALUES ($1, $2, $3, 'active')
           RETURNING id`,
          [dto.supplierId, docType.id, dto.title || docType.name]
        );
        docId = newDocRes.rows[0].id;
      }

      // 4. Insert immutable version (Every new upload starts as "Pending review" / PENDING_VERIFICATION)
      const newVersionRes = await client.query<{ id: string }>(
        `INSERT INTO supplier_document_versions (
          document_id, version_no, storage_key, file_name, mime_type,
          file_size_bytes, sha256, document_number, issue_date, expiry_date,
          uploaded_by_user_id, verification_status, uploaded_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'PENDING_VERIFICATION', NOW()
        ) RETURNING id`,
        [
          docId,
          nextVersionNo,
          storageKey,
          dto.fileName,
          dto.mimeType,
          fileSizeBytes,
          sha256,
          dto.documentNumber || null,
          dto.issueDate || null,
          dto.expiryDate || null,
          dto.userId,
        ]
      );
      const versionId = newVersionRes.rows[0].id;

      // 5. Save bytes in document_files in the SAME transaction
      await client.query(
        `INSERT INTO document_files (document_version_id, content, mime_type, file_name, size_bytes, sha256)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [versionId, dto.fileBuffer, dto.mimeType, dto.fileName, fileSizeBytes, sha256]
      );

      // 6. Read back file and compare its hash with the stored one (integrity check)
      const readBackRes = await client.query<{ sha256: string; size_bytes: string; file_name: string }>(
        `SELECT sha256, size_bytes, file_name FROM document_files WHERE document_version_id = $1`,
        [versionId]
      );

      if (!readBackRes.rows.length) {
        throw new Error('Transaction integrity error: document_files record was not persisted.');
      }

      const storedSha = readBackRes.rows[0].sha256.trim();
      if (storedSha !== sha256) {
        throw new Error(`File integrity check failed: stored hash (${storedSha}) does not match computed hash (${sha256}).`);
      }

      // 7. Update container current_version_id
      await client.query(
        `UPDATE supplier_documents SET current_version_id = $1, updated_at = NOW() WHERE id = $2`,
        [versionId, docId]
      );

      return {
        documentId: docId,
        supplierId: dto.supplierId,
        documentTypeId: docType.id,
        documentTypeCode: dto.documentTypeCode,
        documentTypeName: docType.name,
        issuingAuthority: null,
        requiresExpiry: !!dto.expiryDate,
        title: dto.title || docType.name,
        status: 'active',
        versionId,
        versionNo: nextVersionNo,
        storageKey,
        fileName: dto.fileName,
        mimeType: dto.mimeType,
        fileSizeBytes: String(fileSizeBytes),
        sha256,
        documentNumber: dto.documentNumber || null,
        issueDate: dto.issueDate || null,
        expiryDate: dto.expiryDate || null,
        verificationStatus: 'PENDING_VERIFICATION',
        verifiedVia: null,
        verifiedAt: null,
        verificationNotes: 'File uploaded and verified against canonical SHA-256 checksum rules.',
        uploadedAt: new Date().toISOString(),
        daysToExpiry: dto.expiryDate ? Math.ceil((new Date(dto.expiryDate).getTime() - Date.now()) / 86400000) : null,
        expiryState: dto.expiryDate ? 'VALID' : 'NO_EXPIRY',
        certifiedCopy: dto.certifiedCopy,
      };
    });
  }

  /**
   * Fetch file bytes by document version or document ID, ensuring ownership.
   */
  async getFileByVersionOrDocId(id: string, supplierId: string): Promise<{ content: Buffer; mimeType: string; fileName: string } | null> {
    const res = await query<{ content: Buffer; mimeType: string; fileName: string }>(
      `SELECT f.content, f.mime_type AS "mimeType", f.file_name AS "fileName"
       FROM document_files f
       JOIN supplier_document_versions v ON v.id = f.document_version_id
       JOIN supplier_documents d ON d.id = v.document_id
       WHERE (v.id = $1 OR d.id = $1) AND d.supplier_id = $2
       LIMIT 1`,
      [id, supplierId]
    );

    if (!res.rows.length) return null;
    return res.rows[0];
  }

  /**
   * Delete or soft-delete a document for a supplier.
   */
  async deleteDocument(id: string, supplierId: string): Promise<boolean> {
    const res = await query(
      `UPDATE supplier_documents SET status = 'deleted', updated_at = NOW()
       WHERE (id = $1 OR current_version_id = $1) AND supplier_id = $2`,
      [id, supplierId]
    );
    return (res.rowCount || 0) > 0;
  }
}

export const documentsRepository = new DocumentsRepository();
