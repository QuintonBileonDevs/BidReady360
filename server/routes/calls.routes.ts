import { Router, Request, Response } from 'express';
import { callsRepository } from '../repositories/calls.repository';
import { requireAuth, requireTenantType } from '../middleware/auth.middleware';
import { getSupplierContext } from '../middleware/tenant.helper';
import { translateDbError } from '../db/errors';
import { extractClientIp } from '../utils/ip';

const router = Router();

// GET /api/calls (Opportunities Directory respecting visibility rules)
router.get('/', async (req: Request, res: Response) => {
  try {
    const { q, type } = req.query;
    const supplierId = req.activeTenant?.tenantType === 'supplier' ? req.activeTenant.tenantId : undefined;
    const calls = await callsRepository.listOpen({
      query: q as string,
      callType: type as string,
      supplierId,
    });
    res.json(calls);
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

// GET /api/calls/:id (Call Detail, Price Items, Addenda, Required Documents)
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const call = await callsRepository.getById(req.params.id, {
      supplierId: req.activeTenant?.tenantType === 'supplier' ? req.activeTenant.tenantId : undefined,
      organizationId: req.activeTenant?.tenantType === 'organization' ? req.activeTenant.tenantId : undefined,
      isPlatformAdmin: Boolean(req.user?.isPlatformAdmin),
    });
    if (!call) {
      res.status(404).json({ error: 'CALL_NOT_FOUND', message: 'Tender call not found or restricted.' });
      return;
    }
    res.json(call);
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

// POST /api/calls/:id/addenda/:addendumId/acknowledge
router.post('/:id/addenda/:addendumId/acknowledge', requireAuth, requireTenantType('supplier'), async (req: Request, res: Response) => {
  try {
    const ctx = getSupplierContext(req);
    const result = await callsRepository.acknowledgeAddendum({
      callId: req.params.id,
      addendumId: req.params.addendumId,
      supplierId: ctx.tenantId,
      userId: ctx.userId,
      actorName: req.user!.fullName,
      actorRole: ctx.roleName,
      ipAddress: extractClientIp(req),
    });
    res.json({ success: true, ...result });
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

// GET /api/calls/:id/clarifications
router.get('/:id/clarifications', async (req: Request, res: Response) => {
  try {
    const supplierId = req.activeTenant?.tenantType === 'supplier' ? req.activeTenant.tenantId : undefined;
    const items = await callsRepository.listClarifications(req.params.id, supplierId);
    res.json(items);
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

// POST /api/calls/:id/clarifications (Ask Clarification Question)
router.post('/:id/clarifications', requireAuth, requireTenantType('supplier'), async (req: Request, res: Response) => {
  try {
    const ctx = getSupplierContext(req);
    const { question, topic } = req.body;

    if (!question || !String(question).trim()) {
      res.status(400).json({ error: 'MISSING_QUESTION', message: 'Question content cannot be empty.' });
      return;
    }

    const item = await callsRepository.askClarification({
      callId: req.params.id,
      supplierId: ctx.tenantId,
      userId: ctx.userId,
      question: String(question).trim(),
      topic,
    });

    res.status(201).json(item);
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

export const callsRouter = router;
