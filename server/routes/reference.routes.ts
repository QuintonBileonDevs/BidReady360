import { Router, Request, Response, NextFunction } from 'express';
import { referenceRepository, clearReferenceCache } from '../repositories/reference.repository';
import { DbGuardError } from '../db/client';

const router = Router();

function setReferenceSuccessHeaders(res: Response): void {
  res.removeHeader('Pragma');
  res.removeHeader('Expires');
  res.removeHeader('Surrogate-Control');
  res.setHeader('Cache-Control', 'public, max-age=300');
}

function handleReferenceError(err: any, res: Response, next: NextFunction): void {
  if (err instanceof DbGuardError || err?.code === 'DB_GUARD') {
    next(err);
    return;
  }
  console.error('[REFERENCE API ERROR]', err?.code || 'ERR', err?.message);
  res.removeHeader('Pragma');
  res.removeHeader('Expires');
  res.removeHeader('Surrogate-Control');
  res.setHeader('Cache-Control', 'no-store');
  res.status(503).json({ error: 'reference_unavailable' });
}

// GET /api/reference/categories: Returns category codes and sub-codes from PostgreSQL categories table
router.get('/categories', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const tree = await referenceRepository.getCategoriesTree();
    setReferenceSuccessHeaders(res);
    res.json(tree);
  } catch (err: any) {
    handleReferenceError(err, res, next);
  }
});

// GET /api/reference: Returns reference data from PostgreSQL (5-min per-reference cache on non-empty DB hits)
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await referenceRepository.loadAll();
    setReferenceSuccessHeaders(res);
    res.json(data);
  } catch (err: any) {
    handleReferenceError(err, res, next);
  }
});

// POST /api/reference/refresh: Clear reference cache and reload from PostgreSQL
router.post('/refresh', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    clearReferenceCache();
    const data = await referenceRepository.loadAll();
    res.setHeader('Cache-Control', 'no-store');
    res.json({ success: true, reloadedAt: data.loadedAt });
  } catch (err: any) {
    handleReferenceError(err, res, next);
  }
});

export const referenceRouter = router;
