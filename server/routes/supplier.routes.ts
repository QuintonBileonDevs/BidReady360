import { Router, Request, Response } from 'express';
import { requireAuth, requireTenantType } from '../middleware/auth.middleware';
import { getSupplierContext } from '../middleware/tenant.helper';
import { suppliersRepository } from '../repositories/suppliers.repository';
import { documentsRepository } from '../repositories/documents.repository';
import { consentRepository } from '../repositories/consent.repository';
import { applicationsRepository } from '../repositories/applications.repository';
import { bidsRepository } from '../repositories/bids.repository';
import { translateDbError } from '../db/errors';
import { extractClientIp } from '../utils/ip';

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
    res.status(500).json({ error: err.message });
  }
});

// POST /api/supplier/people
router.post('/people', async (req: Request, res: Response) => {
  try {
    const ctx = getSupplierContext(req);
    const person = await suppliersRepository.addPerson(ctx.tenantId, req.body);
    res.status(201).json(person);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
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

// POST /api/supplier/documents/upload
router.post('/documents/upload', async (req: Request, res: Response) => {
  try {
    const ctx = getSupplierContext(req);
    const { documentTypeCode, fileName, mimeType, fileBase64, documentNumber, issueDate, expiryDate, title } = req.body;

    if (!documentTypeCode || !fileName || !fileBase64) {
      res.status(400).json({ error: 'MISSING_FILE', message: 'Document type, file name, and file content are required.' });
      return;
    }

    const fileBuffer = Buffer.from(fileBase64, 'base64');
    const doc = await documentsRepository.uploadVersion({
      supplierId: ctx.tenantId,
      documentTypeCode,
      fileName,
      mimeType: mimeType || 'application/pdf',
      fileBuffer,
      documentNumber,
      issueDate,
      expiryDate,
      title,
      userId: ctx.userId,
    });

    res.status(201).json(doc);
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

// POST /api/supplier/applications/submit
router.post('/applications/submit', async (req: Request, res: Response) => {
  try {
    const ctx = getSupplierContext(req);
    const { callId, answers, attachedDocumentVersionIds } = req.body;

    if (!callId) {
      res.status(400).json({ error: 'MISSING_CALL_ID', message: 'Call ID is required.' });
      return;
    }

    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
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

    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
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
