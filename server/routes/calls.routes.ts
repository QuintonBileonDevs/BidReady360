import { Router, Request, Response } from 'express';
import { callsRepository } from '../repositories/calls.repository';
import { requireAuth } from '../middleware/auth.middleware';
import { getTenantContext } from '../middleware/tenant.helper';
import { translateDbError } from '../db/errors';

const router = Router();

// GET /api/calls (Public Opportunities Directory)
router.get('/', async (req: Request, res: Response) => {
  try {
    const { q, type } = req.query;
    const calls = await callsRepository.listOpen({
      query: q as string,
      callType: type as string,
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
    const call = await callsRepository.getById(req.params.id);
    if (!call) {
      res.status(404).json({ error: 'CALL_NOT_FOUND', message: 'Tender call not found.' });
      return;
    }
    res.json(call);
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

// GET /api/calls/:id/clarifications
router.get('/:id/clarifications', async (req: Request, res: Response) => {
  try {
    const items = await callsRepository.listClarifications(req.params.id);
    res.json(items);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/calls/:id/clarifications (Ask Clarification Question)
router.post('/:id/clarifications', requireAuth, async (req: Request, res: Response) => {
  try {
    const ctx = getTenantContext(req);
    const { question, topic } = req.body;

    if (!question || !question.trim()) {
      res.status(400).json({ error: 'MISSING_QUESTION', message: 'Question content cannot be empty.' });
      return;
    }

    const item = await callsRepository.askClarification({
      callId: req.params.id,
      supplierId: ctx.tenantId,
      userId: ctx.userId,
      question: question.trim(),
      topic,
    });

    res.status(201).json(item);
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

export const callsRouter = router;
