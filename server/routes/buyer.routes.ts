import { Router, Request, Response } from 'express';
import { requireAuth, requireTenantType, requirePermission } from '../middleware/auth.middleware';
import { getOrganizationContext } from '../middleware/tenant.helper';
import { callsRepository } from '../repositories/calls.repository';
import { applicationsRepository } from '../repositories/applications.repository';
import { bidsRepository } from '../repositories/bids.repository';
import { evaluationsRepository } from '../repositories/evaluations.repository';
import { awardsRepository } from '../repositories/awards.repository';
import { translateDbError } from '../db/errors';
import { extractClientIp } from '../utils/ip';

const router = Router();
router.use(requireAuth);
router.use(requireTenantType('organization'));

// POST /api/buyer/calls/create
router.post('/calls/create', requirePermission('calls.create'), async (req: Request, res: Response) => {
  try {
    const ctx = getOrganizationContext(req);
    const callId = await callsRepository.createCall({
      ...req.body,
      organizationId: ctx.tenantId,
      userId: ctx.userId,
    });
    res.status(201).json({ callId, message: 'Tender call published successfully.' });
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

// GET /api/buyer/applications
router.get('/applications', requirePermission('applications.view'), async (req: Request, res: Response) => {
  try {
    const ctx = getOrganizationContext(req);
    const apps = await applicationsRepository.listByOrganization(ctx.tenantId);
    res.json(apps);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/buyer/applications/:id/review
router.post('/applications/:id/review', requirePermission('applications.review'), async (req: Request, res: Response) => {
  try {
    const ctx = getOrganizationContext(req);
    const { decision, comment } = req.body;
    const ip = extractClientIp(req);

    await applicationsRepository.recordReviewDecision({
      applicationId: req.params.id,
      orgId: ctx.tenantId,
      userId: ctx.userId,
      reviewerName: req.user!.fullName,
      reviewerRole: ctx.roleName,
      decision,
      comment,
      ipAddress: ip,
    });

    res.json({ success: true, message: `Review decision (${decision}) recorded.` });
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

// POST /api/buyer/clarifications/:id/answer
router.post('/clarifications/:id/answer', requirePermission('calls.manage'), async (req: Request, res: Response) => {
  try {
    const ctx = getOrganizationContext(req);
    const { answer, responderTitle } = req.body;

    await callsRepository.answerClarification(
      req.params.id,
      answer,
      responderTitle || `${req.user!.fullName} (${ctx.roleName})`,
      ctx.userId
    );

    res.json({ success: true, message: 'Official clarification answer published.' });
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

// GET /api/buyer/bids/:callId
router.get('/bids/:callId', requirePermission('bids.view'), async (req: Request, res: Response) => {
  try {
    const bids = await bidsRepository.listByCall(req.params.callId);
    res.json(bids);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/buyer/bids/:callId/open-session
router.post('/bids/:callId/open-session', requirePermission('bids.open'), async (req: Request, res: Response) => {
  try {
    const ctx = getOrganizationContext(req);
    const { witnesses } = req.body;
    const ip = extractClientIp(req);

    const result = await bidsRepository.conductOpeningSession({
      callId: req.params.callId,
      orgId: ctx.tenantId,
      userId: ctx.userId,
      actorName: req.user!.fullName,
      actorRole: ctx.roleName,
      witnesses: witnesses || [{ userId: ctx.userId, witnessRole: 'Procurement Officer' }],
      ipAddress: ip,
    });

    res.json(result);
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

// GET /api/buyer/evaluations/:callId
router.get('/evaluations/:callId', requirePermission('applications.view'), async (req: Request, res: Response) => {
  try {
    const ctx = getOrganizationContext(req);
    const [criteria, scores, assignment] = await Promise.all([
      evaluationsRepository.getCriteria(req.params.callId),
      evaluationsRepository.listScores(req.params.callId),
      evaluationsRepository.getEvaluatorAssignment(req.params.callId, ctx.userId),
    ]);

    res.json({ criteria, scores, assignment });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/buyer/evaluations/:callId/declare-conflict
router.post('/evaluations/:callId/declare-conflict', async (req: Request, res: Response) => {
  try {
    const ctx = getOrganizationContext(req);
    const { hasConflict, details } = req.body;
    await evaluationsRepository.signConflictDeclaration(req.params.callId, ctx.userId, ctx.tenantId, !!hasConflict, details);
    res.json({ success: true, message: 'Independence declaration recorded.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/buyer/evaluations/:callId/score
router.post('/evaluations/:callId/score', requirePermission('evaluation.score'), async (req: Request, res: Response) => {
  try {
    const ctx = getOrganizationContext(req);
    const { criterionId, bidId, score, comment } = req.body;

    await evaluationsRepository.submitScore({
      callId: req.params.callId,
      userId: ctx.userId,
      criterionId,
      bidId,
      score: Number(score),
      comment,
    });

    res.json({ success: true, message: 'Score saved.' });
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

// POST /api/buyer/evaluations/:callId/lock
router.post('/evaluations/:callId/lock', requirePermission('evaluation.score'), async (req: Request, res: Response) => {
  try {
    const ctx = getOrganizationContext(req);
    const ip = extractClientIp(req);

    await evaluationsRepository.lockScorecard({
      callId: req.params.callId,
      userId: ctx.userId,
      actorName: req.user!.fullName,
      actorRole: ctx.roleName,
      orgId: ctx.tenantId,
      ipAddress: ip,
    });

    res.json({ success: true, message: 'Scorecard locked and finalized.' });
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

// GET /api/buyer/awards
router.get('/awards', requirePermission('reports.view'), async (req: Request, res: Response) => {
  try {
    const ctx = getOrganizationContext(req);
    const awards = await awardsRepository.listAwards(ctx.tenantId);
    res.json(awards);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/buyer/awards/recommend
router.post('/awards/recommend', requirePermission('awards.recommend'), async (req: Request, res: Response) => {
  try {
    const ctx = getOrganizationContext(req);
    const { callId, bidId, supplierId, awardValue, justification } = req.body;
    const ip = extractClientIp(req);

    const awardId = await awardsRepository.recommendAward({
      callId,
      bidId,
      supplierId,
      awardValue: Number(awardValue),
      justification,
      userId: ctx.userId,
      actorName: req.user!.fullName,
      actorRole: ctx.roleName,
      orgId: ctx.tenantId,
      ipAddress: ip,
    });

    res.status(201).json({ awardId, message: 'Award recommendation submitted.' });
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

// POST /api/buyer/awards/:id/approve
router.post('/awards/:id/approve', requirePermission('awards.approve'), async (req: Request, res: Response) => {
  try {
    const ctx = getOrganizationContext(req);
    const { decision, comment } = req.body;
    const ip = extractClientIp(req);

    await awardsRepository.approveAward({
      awardId: req.params.id,
      userId: ctx.userId,
      actorName: req.user!.fullName,
      actorRole: ctx.roleName,
      orgId: ctx.tenantId,
      decision: decision || 'approved',
      comment,
      ipAddress: ip,
    });

    res.json({ success: true, message: `Award decision (${decision}) approved and contract generated.` });
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

// GET /api/buyer/contracts
router.get('/contracts', requirePermission('contracts.manage'), async (req: Request, res: Response) => {
  try {
    const ctx = getOrganizationContext(req);
    const contracts = await awardsRepository.listContracts(ctx.tenantId);
    res.json(contracts);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export const buyerRouter = router;
