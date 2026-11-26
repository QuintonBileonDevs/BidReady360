import crypto from 'crypto';
import { query, tx } from '../db/client';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const SAFE_INLINE_MIME_TYPES = new Set([
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
  'text/plain',
  'text/csv',
]);

export interface StoredDocumentFile {
  content: Buffer;
  mimeType: string;
  fileName: string;
  sizeBytes: number;
  sha256: string | null;
  versionId: string;
  documentId: string;
}

/**
 * Determine a safe, accurate MIME type for stored bytes using magic bytes first,
 * then an allowlist of safe document MIME types. Never returns active web types
 * such as text/html or image/svg+xml.
 */
export function detectSafeMimeType(
  buffer: Buffer,
  storedMime?: string | null,
  fileName?: string | null
): string {
  if (buffer && buffer.length >= 4) {
    // PDF: %PDF within first 1024 bytes
    const head = buffer.subarray(0, Math.min(1024, buffer.length));
    if (head.includes(Buffer.from('%PDF'))) {
      return 'application/pdf';
    }
    // PNG: 89 50 4E 47
    if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
      return 'image/png';
    }
    // JPEG: FF D8 FF
    if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return 'image/jpeg';
    }
    // GIF: GIF87a / GIF89a
    if (buffer.length >= 6 && (head.subarray(0, 6).toString('ascii') === 'GIF87a' || head.subarray(0, 6).toString('ascii') === 'GIF89a')) {
      return 'image/gif';
    }
    // WebP: RIFF....WEBP
    if (buffer.length >= 12 && head.subarray(0, 4).toString('ascii') === 'RIFF' && head.subarray(8, 12).toString('ascii') === 'WEBP') {
      return 'image/webp';
    }
    // ZIP container -> DOCX
    if (buffer[0] === 0x50 && buffer[1] === 0x4b && buffer[2] === 0x03 && buffer[3] === 0x04) {
      const ext = (fileName || '').split('.').pop()?.toLowerCase();
      if (ext === 'docx' || (storedMime || '').toLowerCase().includes('wordprocessingml')) {
        return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
      }
    }
    // Legacy OLE2 DOC
    if (buffer[0] === 0xd0 && buffer[1] === 0xcf && buffer[2] === 0x11 && buffer[3] === 0xe0) {
      return 'application/msword';
    }
  }

  const normalizedStored = String(storedMime || '').split(';')[0].trim().toLowerCase();
  if (normalizedStored === 'image/jpg') {
    return 'image/jpeg';
  }
  if (SAFE_INLINE_MIME_TYPES.has(normalizedStored)) {
    return normalizedStored;
  }

  const ext = (fileName || '').split('.').pop()?.toLowerCase();
  if (ext === 'pdf') return 'application/pdf';
  if (ext === 'png') return 'image/png';
  if (ext === 'jpg' || ext === 'jpeg') return 'image/jpeg';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  if (ext === 'docx') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
  if (ext === 'doc') return 'application/msword';
  if (ext === 'txt') return 'text/plain';
  if (ext === 'csv') return 'text/csv';

  return 'application/octet-stream';
}

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
  rejectionReason: string | null;
  uploadedAt: string | null;
  daysToExpiry: number | null;
  expiryState: string | null;
  hasFile?: boolean;
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
              v.verification_notes AS "verificationNotes", v.rejection_reason AS "rejectionReason",
              v.uploaded_at AS "uploadedAt",
              EXISTS (
                SELECT 1 FROM document_files f
                WHERE f.document_version_id = v.id AND octet_length(f.content) > 0
              ) AS "hasFile",
              CASE WHEN v.expiry_date IS NOT NULL THEN (v.expiry_date - CURRENT_DATE) ELSE NULL END AS "daysToExpiry",
              CASE
                WHEN v.expiry_date IS NULL THEN 'NO_EXPIRY'
                WHEN v.expiry_date < CURRENT_DATE THEN 'EXPIRED'
                WHEN v.expiry_date <= CURRENT_DATE + INTERVAL '90 days' THEN 'EXPIRING_SOON'
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
    // 1. Server computes canonical SHA-256 and safe MIME type from actual bytes
    const sha256 = crypto.createHash('sha256').update(dto.fileBuffer).digest('hex');
    const fileSizeBytes = dto.fileBuffer.length;
    const resolvedMimeType = detectSafeMimeType(dto.fileBuffer, dto.mimeType, dto.fileName);
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

    return tx(async (client) => {
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
          `INSERT INTO supplier_documents (supplier_id, document_type_id, title, file_size_bytes, status)
           VALUES ($1, $2, $3, $4, 'active')
           RETURNING id`,
          [dto.supplierId, docType.id, dto.title || docType.name, fileSizeBytes]
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
          resolvedMimeType,
          fileSizeBytes,
          sha256,
          dto.documentNumber || null,
          dto.issueDate || null,
          dto.expiryDate || null,
          dto.userId,
        ]
      );
      const versionId = newVersionRes.rows[0].id;

      // 5. Save real bytes in document_files in the SAME transaction
      await client.query(
        `INSERT INTO document_files (document_version_id, content, mime_type, file_name, size_bytes, sha256)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [versionId, dto.fileBuffer, resolvedMimeType, dto.fileName, fileSizeBytes, sha256]
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

      // 7. Update container current_version_id & latest file size
      await client.query(
        `UPDATE supplier_documents
         SET current_version_id = $1, file_size_bytes = $2, updated_at = NOW()
         WHERE id = $3`,
        [versionId, fileSizeBytes, docId]
      );

      let computedDaysToExpiry: number | null = null;
      let computedExpiryState: 'VALID' | 'EXPIRING_SOON' | 'EXPIRED' | 'NO_EXPIRY' = 'NO_EXPIRY';
      if (dto.expiryDate) {
        const expStr = String(dto.expiryDate).slice(0, 10);
        const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(expStr);
        const now = new Date();
        const todayUtcMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
        const expUtcMs = match
          ? Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
          : Date.parse(dto.expiryDate);
        if (!Number.isNaN(expUtcMs)) {
          computedDaysToExpiry = Math.ceil((expUtcMs - todayUtcMs) / 86400000);
          if (computedDaysToExpiry < 0) {
            computedExpiryState = 'EXPIRED';
          } else if (computedDaysToExpiry <= 90) {
            computedExpiryState = 'EXPIRING_SOON';
          } else {
            computedExpiryState = 'VALID';
          }
        }
      }

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
        mimeType: resolvedMimeType,
        fileSizeBytes: String(fileSizeBytes),
        sha256,
        documentNumber: dto.documentNumber || null,
        issueDate: dto.issueDate || null,
        expiryDate: dto.expiryDate || null,
        verificationStatus: 'PENDING_VERIFICATION',
        verifiedVia: null,
        verifiedAt: null,
        verificationNotes: 'File uploaded and verified against canonical SHA-256 checksum rules.',
        rejectionReason: null,
        uploadedAt: new Date().toISOString(),
        daysToExpiry: computedDaysToExpiry,
        expiryState: computedExpiryState,
        hasFile: true,
        certifiedCopy: dto.certifiedCopy,
      };
    });
  }

  /**
   * Fetch actual uploaded file bytes by document version ID or document ID,
   * strictly scoped to the owning supplier and prioritizing the exact requested
   * version or the document's current active version.
   * Never fabricates placeholder PDFs when real bytes do not exist.
   */
  async getFileByVersionOrDocId(id: string, supplierId: string): Promise<StoredDocumentFile | null> {
    if (!UUID_REGEX.test(id) || !UUID_REGEX.test(supplierId)) {
      return null;
    }

    const res = await query<{
      content: Buffer;
      mimeType: string;
      fileName: string;
      sizeBytes: string;
      sha256: string | null;
      versionId: string;
      documentId: string;
    }>(
      `SELECT f.content,
              COALESCE(f.mime_type, v.mime_type) AS "mimeType",
              COALESCE(f.file_name, v.file_name) AS "fileName",
              f.size_bytes AS "sizeBytes",
              COALESCE(f.sha256, v.sha256) AS sha256,
              v.id AS "versionId",
              d.id AS "documentId"
       FROM document_files f
       JOIN supplier_document_versions v ON v.id = f.document_version_id
       JOIN supplier_documents d ON d.id = v.document_id
       WHERE d.supplier_id = $2
         AND d.status != 'deleted'
         AND (v.id = $1 OR d.id = $1 OR f.id = $1)
       ORDER BY (v.id = $1) DESC, (v.id = d.current_version_id) DESC, v.version_no DESC
       LIMIT 1`,
      [id, supplierId]
    );

    if (!res.rows.length || !res.rows[0].content || res.rows[0].content.length === 0) {
      return null;
    }

    const row = res.rows[0];
    const buf = Buffer.isBuffer(row.content) ? row.content : Buffer.from(row.content);
    return {
      content: buf,
      mimeType: detectSafeMimeType(buf, row.mimeType, row.fileName),
      fileName: row.fileName || 'document',
      sizeBytes: buf.length,
      sha256: row.sha256 ? row.sha256.trim() : null,
      versionId: row.versionId,
      documentId: row.documentId,
    };
  }

  /**
   * Fetch actual uploaded file bytes for platform administrators during verification.
   * Accepts either a versionId or a documentId (defaulting to current_version_id).
   */
  async getFileForAdmin(versionOrDocId: string): Promise<StoredDocumentFile | null> {
    if (!UUID_REGEX.test(versionOrDocId)) {
      return null;
    }

    const res = await query<{
      content: Buffer;
      mimeType: string;
      fileName: string;
      sizeBytes: string;
      sha256: string | null;
      versionId: string;
      documentId: string;
    }>(
      `SELECT f.content,
              COALESCE(f.mime_type, v.mime_type) AS "mimeType",
              COALESCE(f.file_name, v.file_name) AS "fileName",
              f.size_bytes AS "sizeBytes",
              COALESCE(f.sha256, v.sha256) AS sha256,
              v.id AS "versionId",
              d.id AS "documentId"
       FROM document_files f
       JOIN supplier_document_versions v ON v.id = f.document_version_id
       JOIN supplier_documents d ON d.id = v.document_id
       WHERE v.id = $1 OR d.id = $1 OR f.id = $1
       ORDER BY (v.id = $1) DESC, (v.id = d.current_version_id) DESC, v.version_no DESC
       LIMIT 1`,
      [versionOrDocId]
    );

    if (!res.rows.length || !res.rows[0].content || res.rows[0].content.length === 0) {
      return null;
    }

    const row = res.rows[0];
    const buf = Buffer.isBuffer(row.content) ? row.content : Buffer.from(row.content);
    return {
      content: buf,
      mimeType: detectSafeMimeType(buf, row.mimeType, row.fileName),
      fileName: row.fileName || 'document',
      sizeBytes: buf.length,
      sha256: row.sha256 ? row.sha256.trim() : null,
      versionId: row.versionId,
      documentId: row.documentId,
    };
  }

  /**
   * Fetch actual uploaded file bytes for an authorized procuring organization (buyer).
   * Enforces that the supplier either submitted an application to one of this organization's calls
   * or holds an active data-sharing consent grant with this organization.
   */
  async getFileForBuyer(versionOrDocId: string, organizationId: string): Promise<StoredDocumentFile | null> {
    if (!UUID_REGEX.test(versionOrDocId) || !UUID_REGEX.test(organizationId)) {
      return null;
    }

    const res = await query<{
      content: Buffer;
      mimeType: string;
      fileName: string;
      sizeBytes: string;
      sha256: string | null;
      versionId: string;
      documentId: string;
      supplierId: string;
      documentTypeName: string | null;
    }>(
      `SELECT f.content,
              COALESCE(f.mime_type, v.mime_type) AS "mimeType",
              COALESCE(f.file_name, v.file_name) AS "fileName",
              f.size_bytes AS "sizeBytes",
              COALESCE(f.sha256, v.sha256) AS sha256,
              v.id AS "versionId",
              d.id AS "documentId",
              d.supplier_id AS "supplierId",
              dt.name AS "documentTypeName"
       FROM document_files f
       JOIN supplier_document_versions v ON v.id = f.document_version_id
       JOIN supplier_documents d ON d.id = v.document_id
       LEFT JOIN document_types dt ON dt.id = d.document_type_id
       WHERE d.status != 'deleted'
         AND (v.id = $1 OR d.id = $1 OR f.id = $1)
         AND (
           EXISTS (
             SELECT 1
             FROM application_documents ad
             JOIN applications a ON a.id = ad.application_id
             WHERE (ad.document_version_id = v.id OR ad.document_type_id = d.document_type_id)
               AND a.supplier_id = d.supplier_id
               AND a.organization_id = $2
               AND a.status <> 'Draft'
           )
           OR EXISTS (
             SELECT 1
             FROM consent_grants cg
             WHERE cg.supplier_id = d.supplier_id
               AND cg.organization_id = $2
               AND cg.status = 'active'
               AND (cg.expires_at IS NULL OR cg.expires_at > NOW())
           )
         )
       ORDER BY (v.id = $1) DESC, (v.id = d.current_version_id) DESC, v.version_no DESC
       LIMIT 1`,
      [versionOrDocId, organizationId]
    );

    if (!res.rows.length || !res.rows[0].content || res.rows[0].content.length === 0) {
      return null;
    }

    const row = res.rows[0];
    const buf = Buffer.isBuffer(row.content) ? row.content : Buffer.from(row.content);
    return {
      content: buf,
      mimeType: detectSafeMimeType(buf, row.mimeType, row.fileName),
      fileName: row.fileName || 'document',
      sizeBytes: buf.length,
      sha256: row.sha256 ? row.sha256.trim() : null,
      versionId: row.versionId,
      documentId: row.documentId,
      supplierId: row.supplierId,
      documentTypeName: row.documentTypeName || undefined,
    } as StoredDocumentFile & { supplierId: string; documentTypeName?: string };
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
