import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { completenessService } from '../services/completeness.service';

const router = Router();

// Token-protected dev completeness audit endpoint
router.get('/completeness-audit', requireAuth, async (req: Request, res: Response) => {
  try {
    const audit = await completenessService.auditCompleteness();
    res.json(audit);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// Dev endpoint to trigger the reconciliation job on demand
router.post('/completeness-reconcile', requireAuth, async (req: Request, res: Response) => {
  try {
    const result = await completenessService.runDailyJob();
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export const devRouter = router;
