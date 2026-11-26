import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, requireTenantType, requirePermission } from '../middleware/auth.middleware';
import { getOrganizationContext } from '../middleware/tenant.helper';
import { callsRepository } from '../repositories/calls.repository';
import { applicationsRepository } from '../repositories/applications.repository';
import { bidsRepository } from '../repositories/bids.repository';
import { evaluationsRepository } from '../repositories/evaluations.repository';
import { awardsRepository } from '../repositories/awards.repository';
import { documentsRepository } from '../repositories/documents.repository';
import { translateDbError } from '../db/errors';
import { extractClientIp } from '../utils/ip';

import { query } from '../db/client';

const router = Router();
router.use(requireAuth);
router.use(requireTenantType('organization'));

async function requireActiveOrganization(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (req.user?.isPlatformAdmin) {
    return next();
  }
  try {
    const ctx = getOrganizationContext(req);
    const orgRes = await query<{ status: string; verification_status: string; rejection_reason: string | null }>(
      `SELECT status, verification_status, rejection_reason
       FROM organizations
       WHERE id = $1 AND deleted_at IS NULL
       LIMIT 1`,
      [ctx.tenantId]
    );
    const org = orgRes.rows[0];
    if (!org) {
      res.status(403).json({
        error: 'ORGANIZATION_NOT_FOUND',
        code: 'ORGANIZATION_NOT_FOUND',
        message: 'Your procuring organization record could not be found or is no longer active.',
      });
      return;
    }

    const status = String(org.status || '').toLowerCase();
    const verStatus = String(org.verification_status || '').toLowerCase();

    if (status === 'pending' || verStatus === 'pending_review' || verStatus === 'pending') {
      res.status(403).json({
        error: 'ORGANIZATION_PENDING_APPROVAL',
        code: 'ORGANIZATION_PENDING_APPROVAL',
        message: 'Your organization is awaiting administrator approval before you can publish or manage calls.',
      });
      return;
    }

    if (status !== 'active' || verStatus === 'rejected') {
      const code = verStatus === 'rejected' ? 'ORGANIZATION_REJECTED' : 'ORGANIZATION_SUSPENDED';
      res.status(403).json({
        error: code,
        code,
        message: org.rejection_reason
          ? `Your procuring organization is currently ${status} (${org.rejection_reason}). Contact BidReady360 administration.`
          : `Your procuring organization is currently ${status} and cannot access procurement operations.`,
      });
      return;
    }

    next();
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
}

router.use(requireActiveOrganization);

// GET /api/buyer/calls
router.get('/calls', requirePermission('calls.create'), async (req: Request, res: Response) => {
  try {
    const ctx = getOrganizationContext(req);
    const calls = await callsRepository.listByOrganization(ctx.tenantId);
    res.json(calls);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/buyer/calls/create
router.post('/calls/create', requirePermission('calls.create'), async (req: Request, res: Response) => {
  try {
    const ctx = getOrganizationContext(req);
    const callId = await callsRepository.createCall({
      ...req.body,
      organizationId: ctx.tenantId,
      userId: ctx.userId,
    });
    res.status(201).json({ callId, message: 'Tender call saved successfully.' });
  } catch (err: any) {
    if (err?.status === 403) {
      res.status(403).json({
        error: err.code || 'FORBIDDEN',
        code: err.code || 'FORBIDDEN',
        message: err.message,
      });
      return;
    }
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

// PATCH /api/buyer/calls/:id
router.patch('/calls/:id', requirePermission('calls.manage'), async (req: Request, res: Response) => {
  try {
    const ctx = getOrganizationContext(req);
    await callsRepository.updateCall(req.params.id, ctx.tenantId, ctx.userId, req.body);
    res.json({ success: true, message: 'Tender call updated.' });
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

// POST /api/buyer/calls/:id/addenda
router.post('/calls/:id/addenda', requirePermission('calls.manage'), async (req: Request, res: Response) => {
  try {
    const ctx = getOrganizationContext(req);
    const addendum = await callsRepository.createAddendum(req.params.id, ctx.tenantId, ctx.userId, req.body);
    res.status(201).json(addendum);
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

// GET /api/buyer/clarifications
router.get('/clarifications', requirePermission('calls.manage'), async (req: Request, res: Response) => {
  try {
    const ctx = getOrganizationContext(req);
    const list = await callsRepository.listClarificationsByOrganization(ctx.tenantId);
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/buyer/clarifications/:id/answer
router.post('/clarifications/:id/answer', requirePermission('calls.manage'), async (req: Request, res: Response) => {
  try {
    const ctx = getOrganizationContext(req);
    const { answer, responderTitle } = req.body;

    if (!answer || !String(answer).trim()) {
      res.status(400).json({ error: 'MISSING_ANSWER', message: 'Clarification answer cannot be empty.' });
      return;
    }

    await callsRepository.answerClarification(
      req.params.id,
      answer,
      responderTitle || `${req.user!.fullName} (${ctx.roleName})`,
      ctx.userId,
      ctx.tenantId
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
    const ctx = getOrganizationContext(req);
    const bids = await bidsRepository.listByCall(req.params.callId, ctx.tenantId);
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
    const callRes = await query(`SELECT id FROM calls WHERE id = $1 AND organization_id = $2`, [req.params.callId, ctx.tenantId]);
    if (!callRes.rows.length) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Tender call not found for your organization.' });
      return;
    }
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
    const callCheck = await query(`SELECT id FROM calls WHERE id = $1 AND organization_id = $2`, [req.params.callId, ctx.tenantId]);
    if (!callCheck.rows.length) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Tender call not found for your organization.' });
      return;
    }
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
    const callCheck = await query(`SELECT id FROM calls WHERE id = $1 AND organization_id = $2`, [req.params.callId, ctx.tenantId]);
    if (!callCheck.rows.length) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Tender call not found for your organization.' });
      return;
    }
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
    const callCheck = await query(`SELECT id FROM calls WHERE id = $1 AND organization_id = $2`, [req.params.callId, ctx.tenantId]);
    if (!callCheck.rows.length) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Tender call not found for your organization.' });
      return;
    }
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

// GET /api/buyer/documents/:id/file - Authorized buyer preview of applicant/consented supplier documents
router.get('/documents/:id/file', requirePermission('applications.view'), async (req: Request, res: Response) => {
  try {
    const ctx = getOrganizationContext(req);
    const fileRecord = await documentsRepository.getFileForBuyer(req.params.id, ctx.tenantId);
    if (!fileRecord) {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Document file not found or not shared with your organization.',
      });
      return;
    }

    const isDownload = req.query.download === '1' || req.query.download === 'true';
    const dispositionType = isDownload ? 'attachment' : 'inline';
    const safeFileName = (fileRecord.fileName || 'document').replace(/[\r\n"\\]/g, '_');

    res.setHeader('Content-Type', fileRecord.mimeType || 'application/octet-stream');
    res.setHeader('Content-Length', String(fileRecord.content.length));
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate');
    res.setHeader('Content-Disposition', `${dispositionType}; filename="${safeFileName}"; filename*=UTF-8''${encodeURIComponent(safeFileName)}`);
    res.send(fileRecord.content);
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

export const buyerRouter = router;
