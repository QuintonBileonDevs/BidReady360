import { Router, Request, Response } from 'express';
import crypto from 'crypto';
import { requireAuth, requirePermission } from '../middleware/auth.middleware';
import { getTenantContext } from '../middleware/tenant.helper';
import { auditRepository } from '../repositories/audit.repository';

const router = Router();
router.use(requireAuth);

// GET /api/audit/logs
router.get('/logs', requirePermission('audit.view'), async (req: Request, res: Response) => {
  try {
    const ctx = getTenantContext(req);
    const events = await auditRepository.listEvents({
      organizationId: ctx.tenantType === 'organization' ? ctx.tenantId : undefined,
      supplierId: ctx.tenantType === 'supplier' ? ctx.tenantId : undefined,
      entityType: req.query.entityType as string,
    });
    res.json(events);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/audit/export
router.post('/export', requirePermission('audit.view'), async (req: Request, res: Response) => {
  try {
    const ctx = getTenantContext(req);
    const { exportType, recordsCount } = req.body;
    const ip = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || '127.0.0.1';
    const userAgent = req.headers['user-agent'] || 'Web Client';

    const checksumSha256 = crypto.createHash('sha256').update(`${ctx.tenantId}|${exportType}|${Date.now()}`).digest('hex');

    await auditRepository.recordExport({
      organizationId: ctx.tenantId,
      exportedByUserId: ctx.userId,
      exportType: exportType || 'audit_trail_csv',
      recordsCount: Number(recordsCount || 0),
      checksumSha256,
      ipAddress: ip,
      userAgent,
    });

    res.json({ success: true, checksumSha256 });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export const auditRouter = router;
