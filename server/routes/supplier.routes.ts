import { Router, Request, Response } from 'express';
import multer from 'multer';
import { GoogleGenAI, Type } from '@google/genai';
import { requireAuth, requireTenantType } from '../middleware/auth.middleware';
import { getSupplierContext } from '../middleware/tenant.helper';
import { suppliersRepository } from '../repositories/suppliers.repository';
import { auditRepository } from '../repositories/audit.repository';
import { documentsRepository } from '../repositories/documents.repository';
import { consentRepository } from '../repositories/consent.repository';
import { applicationsRepository } from '../repositories/applications.repository';
import { bidsRepository } from '../repositories/bids.repository';
import { translateDbError } from '../db/errors';
import { extractClientIp } from '../utils/ip';
import { getClient } from '../db/client';
import { validateOmang } from '../../shared/omang';

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB limit
});

function validateFileBuffer(buffer: Buffer, originalName?: string): { isValid: boolean; mimeType: string; error?: string } {
  if (!buffer || buffer.length === 0) {
    return { isValid: false, mimeType: '', error: 'Uploaded file is empty or corrupt.' };
  }
  if (buffer.length > 10 * 1024 * 1024) {
    return { isValid: false, mimeType: '', error: 'File size exceeds 10 MB limit.' };
  }

  // Check magic bytes
  // PDF: %PDF anywhere in first 1024 bytes
  const headerSlice = buffer.subarray(0, Math.min(1024, buffer.length));
  if (headerSlice.includes(Buffer.from('%PDF'))) {
    return { isValid: true, mimeType: 'application/pdf' };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4E && buffer[3] === 0x47) {
    return { isValid: true, mimeType: 'image/png' };
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xFF && buffer[1] === 0xD8 && buffer[2] === 0xFF) {
    return { isValid: true, mimeType: 'image/jpeg' };
  }

  // WebP: RIFF ... WEBP
  if (buffer.subarray(0, 4).toString() === 'RIFF' && buffer.subarray(8, 12).toString() === 'WEBP') {
    return { isValid: true, mimeType: 'image/webp' };
  }

  // DOCX: PK zip 50 4B 03 04
  if (buffer[0] === 0x50 && buffer[1] === 0x4B && buffer[2] === 0x03 && buffer[3] === 0x04) {
    return { isValid: true, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
  }

  // DOC: D0 CF 11 E0 A1 B1 1A E1
  if (buffer[0] === 0xD0 && buffer[1] === 0xCF && buffer[2] === 0x11 && buffer[3] === 0xE0) {
    return { isValid: true, mimeType: 'application/msword' };
  }

  // Fallback check by file extension for known document extensions
  if (originalName) {
    const ext = originalName.split('.').pop()?.toLowerCase();
    if (ext === 'pdf') return { isValid: true, mimeType: 'application/pdf' };
    if (ext === 'png') return { isValid: true, mimeType: 'image/png' };
    if (ext === 'jpg' || ext === 'jpeg') return { isValid: true, mimeType: 'image/jpeg' };
    if (ext === 'docx') return { isValid: true, mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
    if (ext === 'doc') return { isValid: true, mimeType: 'application/msword' };
  }

  return { isValid: false, mimeType: '', error: 'Unsupported or corrupt file type. Only PDF, PNG, JPG, and Word files are accepted.' };
}

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

const router = Router();
router.use(requireAuth);
router.use(requireTenantType('supplier'));

// GET /api/supplier/profile
router.get('/profile', async (req: Request, res: Response) => {
  try {
    const ctx = getSupplierContext(req);
    const profile = await suppliersRepository.getById(ctx.tenantId);
    res.json(profile);
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

// PUT /api/supplier/profile
router.put('/profile', async (req: Request, res: Response) => {
  try {
    const ctx = getSupplierContext(req);
    const updated = await suppliersRepository.updateProfile(ctx.tenantId, req.body);
    res.json(updated);
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

// GET /api/supplier/people
router.get('/people', async (req: Request, res: Response) => {
  try {
    const ctx = getSupplierContext(req);
    const people = await suppliersRepository.listPeople(ctx.tenantId);
    res.json(people);
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

// POST /api/supplier/people
router.post('/people', async (req: Request, res: Response) => {
  try {
    const ctx = getSupplierContext(req);
    const person = await suppliersRepository.addPerson(ctx.tenantId, req.body, { id: ctx.userId, email: ctx.userEmail });
    res.status(201).json(person);
  } catch (err: any) {
    const status = err.status || 400;
    res.status(status).json({
      error: err.code || 'VALIDATION_ERROR',
      code: err.code || 'VALIDATION_ERROR',
      field: err.field || 'fullName',
      message: err.message || 'Failed to save director',
    });
  }
});

// PUT /api/supplier/people/:id
router.put('/people/:id', async (req: Request, res: Response) => {
  try {
    const ctx = getSupplierContext(req);
    const person = await suppliersRepository.updatePerson(ctx.tenantId, req.params.id, req.body, { id: ctx.userId, email: ctx.userEmail });
    if (!person) {
      return res.status(404).json({ error: 'NOT_FOUND', field: 'id', message: 'Person not found' });
    }
    res.json(person);
  } catch (err: any) {
    const status = err.status || 400;
    res.status(status).json({
      error: err.code || 'VALIDATION_ERROR',
      code: err.code || 'VALIDATION_ERROR',
      field: err.field || 'fullName',
      message: err.message || 'Failed to update director',
    });
  }
});

// Helper functions for director deletion (Step 2 structure)
async function getSupplierIdForUser(client: any, userId: string, activeTenantId?: string): Promise<string | null> {
  if (activeTenantId && activeTenantId !== 'platform') {
    const res = await client.query(
      `SELECT supplier_id FROM supplier_members WHERE user_id = $1 AND supplier_id = $2 AND status = 'active' LIMIT 1`,
      [userId, activeTenantId]
    );
    if (res.rows.length > 0) return res.rows[0].supplier_id;
  }
  const res = await client.query(
    `SELECT supplier_id FROM supplier_members WHERE user_id = $1 AND status = 'active' ORDER BY is_owner DESC, created_at ASC LIMIT 1`,
    [userId]
  );
  return res.rows[0]?.supplier_id || null;
}

function writeAuditLogSafely(req: Request, action: string, entityId: string, t0: number) {
  // separate connection, awaited inside its own try/catch, never blocks the response
  (async () => {
    try {
      const actorName = req.user?.fullName || req.user?.email || 'Supplier Administrator';
      const actorRole = req.activeTenant?.roleName || (req.user?.isPlatformAdmin ? 'Super Admin' : 'Supplier');
      const supplierId = req.activeTenant?.tenantId || null;
      await auditRepository.logEvent({
        actorName,
        actorRole,
        supplierId,
        action,
        entityType: 'supplier_person',
        entityId,
        details: `Removed person record ${entityId}`,
      });
      console.log('[remove-director] audit done', Math.round(performance.now() - t0));
      if (supplierId) {
        await suppliersRepository.calculateCompleteness(supplierId).catch(() => {});
      }
    } catch (e: any) {
      console.warn('[remove-director] audit log warning:', e.message);
    }
  })();
}

// DELETE /api/supplier/people/:id
router.delete('/people/:id', async (req: Request, res: Response) => {
  const t0 = performance.now();
  console.log('[remove-director] route entered', Math.round(performance.now() - t0));

  if (!req.user || !req.session) {
    return res.status(401).json({ error: 'unauthorized', message: 'You must be signed in.' });
  }
  console.log('[remove-director] session verified', Math.round(performance.now() - t0));

  let client;
  try {
    client = await getClient(); // ONE verified client for the whole transaction
    console.log('[remove-director] connection acquired', Math.round(performance.now() - t0));

    await client.query('BEGIN');
    console.log('[remove-director] BEGIN', Math.round(performance.now() - t0));

    await client.query("SET LOCAL lock_timeout = '3s'");
    await client.query("SET LOCAL statement_timeout = '8s'");

    const supplierId = await getSupplierIdForUser(client, req.user.id, req.activeTenant?.tenantId); // from the session, never from the request
    if (!supplierId) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'forbidden', message: 'You do not have access.' });
    }

    const r = await client.query(
      'UPDATE supplier_people SET is_active = FALSE, updated_at = NOW() WHERE id = $1 AND supplier_id = $2 AND is_active = TRUE RETURNING id',
      [req.params.id, supplierId]
    );

    if (r.rowCount === 0) {
      const ex = await client.query(
        'SELECT is_active FROM supplier_people WHERE id = $1 AND supplier_id = $2',
        [req.params.id, supplierId]
      );
      await client.query('ROLLBACK');
      if (ex.rowCount === 0) {
        return res.status(404).json({ error: 'not_found', message: 'This person was not found.' });
      }
      return res.json({ ok: true, alreadyRemoved: true });
    }

    console.log('[remove-director] UPDATE done', Math.round(performance.now() - t0));

    await client.query('COMMIT');
    console.log('[remove-director] COMMIT done', Math.round(performance.now() - t0));

    res.json({ ok: true, id: r.rows[0].id }); // respond BEFORE any optional extra work
    console.log('[remove-director] response sent', Math.round(performance.now() - t0));

    writeAuditLogSafely(req, 'supplier_person.remove', r.rows[0].id, t0); // separate connection, awaited inside its own try/catch, never blocks the response
  } catch (err: any) {
    try {
      if (client) await client.query('ROLLBACK');
    } catch {}
    console.error('[remove-director] failed', err.code, err.message);
    if (!res.headersSent) {
      res.status(err.code === '55P03' ? 503 : 500).json({
        error: 'server',
        message: 'We could not remove this person. Try again.',
      });
    }
  } finally {
    if (client) client.release(); // ALWAYS release
  }
});

// GET /api/supplier/projects
router.get('/projects', async (req: Request, res: Response) => {
  try {
    const ctx = getSupplierContext(req);
    const projects = await suppliersRepository.listProjects(ctx.tenantId);
    res.json(projects);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/supplier/projects
router.post('/projects', async (req: Request, res: Response) => {
  try {
    const ctx = getSupplierContext(req);
    const project = await suppliersRepository.addProject(ctx.tenantId, req.body);
    res.status(201).json(project);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/supplier/disciplines
router.get('/disciplines', async (req: Request, res: Response) => {
  try {
    const ctx = getSupplierContext(req);
    const disciplines = await suppliersRepository.getDisciplines(ctx.tenantId);
    res.json(disciplines);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/supplier/documents
router.get('/documents', async (req: Request, res: Response) => {
  try {
    const ctx = getSupplierContext(req);
    const docs = await documentsRepository.listBySupplier(ctx.tenantId);
    res.json(docs);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/supplier/documents/upload (multipart/form-data with 4MB limit and magic byte checks)
router.post('/documents/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const ctx = getSupplierContext(req);
    const file = req.file;
    const { documentTypeCode, documentNumber, issueDate, expiryDate, title, certifiedCopy, identityType, gender } = req.body;

    if (!file) {
      res.status(400).json({ error: 'MISSING_FILE', message: 'No file uploaded or file missing.' });
      return;
    }
    if (!documentTypeCode) {
      res.status(400).json({ error: 'MISSING_TYPE', message: 'Document type code is required.' });
      return;
    }

    let cleanedDocNumber = documentNumber ? String(documentNumber).trim() : undefined;
    const isDirectorsIdDoc =
      String(documentTypeCode).toUpperCase() === 'DIRECTOR_ID' ||
      /director|shareholder|omang/i.test(String(title || ''));
    if (isDirectorsIdDoc && cleanedDocNumber && String(identityType || 'OMANG').toUpperCase() !== 'PASSPORT') {
      const omangCheck = validateOmang(cleanedDocNumber, gender);
      if (!omangCheck.ok) {
        res.status(400).json({
          error: omangCheck.code,
          code: omangCheck.code,
          field: 'documentNumber',
          message: omangCheck.message,
        });
        return;
      }
      cleanedDocNumber = omangCheck.normalised;
    }

    const validation = validateFileBuffer(file.buffer, file.originalname);
    if (!validation.isValid) {
      res.status(400).json({ error: 'INVALID_FILE', message: validation.error || 'Invalid file format.' });
      return;
    }

    const doc = await documentsRepository.uploadVersion({
      supplierId: ctx.tenantId,
      documentTypeCode,
      fileName: file.originalname || 'document.pdf',
      mimeType: validation.mimeType,
      fileBuffer: file.buffer,
      documentNumber: cleanedDocNumber,
      issueDate,
      expiryDate,
      certifiedCopy: certifiedCopy === 'true' || certifiedCopy === true,
      title,
      userId: ctx.userId,
    });

    await suppliersRepository.calculateCompleteness(ctx.tenantId);

    res.status(201).json(doc);
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

// DELETE /api/supplier/documents/:id
router.delete('/documents/:id', async (req: Request, res: Response) => {
  try {
    const ctx = getSupplierContext(req);
    await documentsRepository.deleteDocument(req.params.id, ctx.tenantId);
    await suppliersRepository.calculateCompleteness(ctx.tenantId);
    res.json({ success: true, message: 'Document removed from vault.' });
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

// GET /api/supplier/documents/:id/file - Fetch file bytes by ID with ownership check
router.get('/documents/:id/file', async (req: Request, res: Response) => {
  try {
    const ctx = getSupplierContext(req);
    const fileRecord = await documentsRepository.getFileByVersionOrDocId(req.params.id, ctx.tenantId);
    if (!fileRecord) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Document file not found or unauthorized.' });
      return;
    }

    const isDownload = req.query.download === '1' || req.query.download === 'true' || req.query.attachment === 'true';
    const dispositionType = isDownload ? 'attachment' : 'inline';
    const safeFileName = (fileRecord.fileName || 'document.pdf').replace(/"/g, '');

    res.setHeader('Content-Type', fileRecord.mimeType || 'application/pdf');
    res.setHeader('Content-Length', fileRecord.content.length);
    res.setHeader('Content-Disposition', `${dispositionType}; filename="${safeFileName}"; filename*=UTF-8''${encodeURIComponent(safeFileName)}`);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(fileRecord.content);
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

// POST /api/supplier/documents/read
router.post('/documents/read', async (req: Request, res: Response) => {
  try {
    const { fileBase64, mimeType, documentTypeName, identityType } = req.body;
    if (!fileBase64) {
      res.status(400).json({ error: 'File content is required' });
      return;
    }

    let parsed: any = null;
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: {
          parts: [
            {
              inlineData: {
                mimeType: mimeType || 'application/pdf',
                data: fileBase64,
              },
            },
            {
              text: 'Extract document details from this uploaded document. Return valid JSON only (no markdown formatting), with these exact fields: document_type, holder_name, document_number, issue_date (YYYY-MM-DD), expiry_date (YYYY-MM-DD), issuing_authority, and confidence (an object containing a confidence score from 0 to 1 for each of document_type, holder_name, document_number, issue_date, expiry_date, issuing_authority). Use null when a field is not visible. Never guess.'
            }
          ]
        },
        config: {
          responseMimeType: 'application/json'
        }
      });

      let rawText = response.text || '{}';
      rawText = rawText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '').trim();
      parsed = JSON.parse(rawText);
    } catch (aiErr: any) {
      console.warn('[GEMINI API READ WARNING]:', aiErr?.message || 'Read failed');
    }

    if (!parsed || typeof parsed !== 'object') {
      return res.json({
        document_type: documentTypeName || null,
        holder_name: null,
        document_number: null,
        issue_date: null,
        expiry_date: null,
        issuing_authority: null,
        confidence: {},
        validation_status: 'Needs review',
        omang_valid: null,
        auto_fill_allowed: false,
        verified: false,
      });
    }

    const isDirectorsIdDoc =
      /director|shareholder|omang|national.?id|director_id/i.test(String(documentTypeName || '')) ||
      /omang|national.?id/i.test(String(parsed.document_type || ''));
    const isOmangCheck = isDirectorsIdDoc && String(identityType || 'OMANG').toUpperCase() !== 'PASSPORT';

    let omangValid: boolean | null = null;
    let omangError: string | null = null;
    let derivedGender: 'male' | 'female' | null = null;
    let validationStatus = 'Extracted (unverified)';
    let autoFillAllowed = Boolean(parsed.document_number);

    if (isOmangCheck) {
      if (parsed.document_number) {
        const omangCheck = validateOmang(String(parsed.document_number));
        omangValid = omangCheck.ok;
        if (omangCheck.ok) {
          parsed.document_number = omangCheck.normalised;
          derivedGender = omangCheck.derivedGender;
        } else {
          omangError = omangCheck.message;
          validationStatus = 'Needs review';
          autoFillAllowed = false;
        }
      } else {
        validationStatus = 'Needs review';
        autoFillAllowed = false;
      }
    }

    res.json({
      ...parsed,
      omang_valid: omangValid,
      omang_error: omangError,
      derived_gender: derivedGender,
      validation_status: validationStatus,
      auto_fill_allowed: autoFillAllowed,
      verified: false, // Reading a document never verifies it
    });
  } catch (err: any) {
    console.error('[GEMINI DOCUMENT READ ERROR]', err?.message || 'Unknown error');
    res.status(500).json({
      error: 'DOCUMENT_READ_FAILED',
      validation_status: 'Needs review',
      auto_fill_allowed: false,
      verified: false,
      message: 'Could not read document details automatically.',
    });
  }
});

// POST /api/supplier/documents/:id/read - Extract text / metadata from an already uploaded document
router.post('/documents/:id/read', async (req: Request, res: Response) => {
  try {
    const ctx = getSupplierContext(req);
    const docId = req.params.id;

    const docs = await documentsRepository.listBySupplier(ctx.tenantId);
    const targetDoc = docs.find(d => d.documentId === docId);

    if (!targetDoc) {
      res.status(404).json({ error: 'DOCUMENT_NOT_FOUND', message: 'Document not found in vault.' });
      return;
    }

    const extracted: any = {
      document_type: targetDoc.documentTypeName,
      holder_name: null,
      document_number: targetDoc.documentNumber || null,
      issue_date: targetDoc.issueDate || null,
      expiry_date: targetDoc.expiryDate || null,
      issuing_authority: targetDoc.issuingAuthority || null,
      confidence: {},
      validation_status: 'Needs review',
      omang_valid: null as boolean | null,
      omang_error: null as string | null,
      derived_gender: null as 'male' | 'female' | null,
      auto_fill_allowed: false,
      verified: false, // Reading a document never verifies it
    };

    const fileRecord = await documentsRepository.getFileByVersionOrDocId(docId, ctx.tenantId).catch(() => null);
    if (fileRecord && fileRecord.content) {
      try {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType: fileRecord.mimeType || 'application/pdf',
                  data: fileRecord.content.toString('base64'),
                },
              },
              {
                text: 'Extract document details from this uploaded document. Return valid JSON only (no markdown formatting), with these exact fields: document_type, holder_name, document_number, issue_date (YYYY-MM-DD), expiry_date (YYYY-MM-DD), issuing_authority, and confidence (an object containing a confidence score from 0 to 1 for each of document_type, holder_name, document_number, issue_date, expiry_date, issuing_authority). Use null when a field is not visible. Never guess.'
              }
            ]
          },
          config: {
            responseMimeType: 'application/json'
          }
        });

        let rawText = response.text || '{}';
        rawText = rawText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/\s*```$/, '').trim();
        const parsed = JSON.parse(rawText);
        if (parsed && typeof parsed === 'object') {
          Object.assign(extracted, parsed, { verified: false });
        }
      } catch (aiErr: any) {
        console.warn('[GEMINI STORED DOC READ WARNING]:', aiErr?.message || 'Read failed');
      }
    }

    const isDirectorsIdDoc =
      String(targetDoc.documentTypeCode || '').toUpperCase() === 'DIRECTOR_ID' ||
      /director|shareholder|omang|national.?id/i.test(String(targetDoc.documentTypeName || ''));

    if (isDirectorsIdDoc) {
      if (extracted.document_number) {
        const omangCheck = validateOmang(String(extracted.document_number));
        extracted.omang_valid = omangCheck.ok;
        if (omangCheck.ok) {
          extracted.document_number = omangCheck.normalised;
          extracted.derived_gender = omangCheck.derivedGender;
          extracted.validation_status = 'Extracted (unverified)';
          extracted.auto_fill_allowed = true;
        } else {
          extracted.omang_error = omangCheck.message;
          extracted.validation_status = 'Needs review';
          extracted.auto_fill_allowed = false;
        }
      } else {
        extracted.validation_status = 'Needs review';
        extracted.auto_fill_allowed = false;
      }
    } else if (extracted.document_number) {
      extracted.validation_status = 'Extracted (unverified)';
      extracted.auto_fill_allowed = true;
    }

    extracted.verified = false;

    res.json({ success: true, extracted, document: targetDoc });
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

// GET /api/supplier/consent
router.get('/consent', async (req: Request, res: Response) => {
  try {
    const ctx = getSupplierContext(req);
    const grants = await consentRepository.listBySupplier(ctx.tenantId);
    res.json(grants);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/supplier/consent/:id/revoke
router.post('/consent/:id/revoke', async (req: Request, res: Response) => {
  try {
    const ctx = getSupplierContext(req);
    const { reason } = req.body;
    await consentRepository.revokeConsent(req.params.id, ctx.tenantId, ctx.userId, reason || 'Revoked by supplier administrator');
    res.json({ success: true, message: 'Data sharing access revoked.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/supplier/applications
router.get('/applications', async (req: Request, res: Response) => {
  try {
    const ctx = getSupplierContext(req);
    const apps = await applicationsRepository.listBySupplier(ctx.tenantId);
    res.json(apps);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/supplier/applications/submit
router.post('/applications/submit', async (req: Request, res: Response) => {
  try {
    const ctx = getSupplierContext(req);
    const { callId, answers, attachedDocumentVersionIds } = req.body;

    if (!callId) {
      res.status(400).json({ error: 'MISSING_CALL_ID', message: 'Call ID is required.' });
      return;
    }

    const ip = extractClientIp(req);
    const result = await applicationsRepository.submitApplication({
      callId,
      supplierId: ctx.tenantId,
      userId: ctx.userId,
      answers: answers || {},
      attachedDocumentVersionIds: attachedDocumentVersionIds || [],
      actorName: req.user!.fullName,
      actorRole: ctx.roleName,
      ipAddress: ip,
    });

    res.status(201).json(result);
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

// POST /api/supplier/bids/seal
router.post('/bids/seal', async (req: Request, res: Response) => {
  try {
    const ctx = getSupplierContext(req);
    const { callId, financialSchedule } = req.body;

    if (!callId || !financialSchedule || !financialSchedule.length) {
      res.status(400).json({ error: 'INVALID_BID_DATA', message: 'Tender ID and completed financial bill of quantities schedule are required.' });
      return;
    }

    const ip = extractClientIp(req);
    const result = await bidsRepository.sealAndSubmitBid({
      callId,
      supplierId: ctx.tenantId,
      userId: ctx.userId,
      financialSchedule,
      actorName: req.user!.fullName,
      actorRole: ctx.roleName,
      ipAddress: ip,
    });

    res.status(201).json(result);
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

export const supplierRouter = router;
