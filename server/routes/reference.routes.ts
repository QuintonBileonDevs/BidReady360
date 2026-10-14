import { Router, Request, Response } from 'express';
import { referenceDataLoader } from '../services/reference.loader';
import { referenceRepository } from '../repositories/reference.repository';

const router = Router();

// GET /api/reference/categories: Returns category codes and sub-codes from PostgreSQL categories table
router.get('/categories', async (req: Request, res: Response) => {
  try {
    const tree = await referenceRepository.getCategoriesTree();
    res.json(tree);
  } catch (err: any) {
    console.error('[CATEGORIES API ERROR]', err);
    res.status(500).json({ error: 'FAILED_TO_LOAD_CATEGORIES', message: 'Unable to load categories from database.' });
  }
});

// GET /api/reference: Returns all cached reference data (districts, document types, disciplines, plans, etc.)
router.get('/', async (req: Request, res: Response) => {
  try {
    const data = await referenceDataLoader.getReferenceData();
    res.json(data);
  } catch (err: any) {
    console.error('[REFERENCE API ERROR]', err);
    res.status(500).json({ error: 'FAILED_TO_LOAD_REFERENCE_DATA', message: 'Unable to load statutory reference catalogues.' });
  }
});

// POST /api/reference/refresh: Admin on-demand cache reload
router.post('/refresh', async (req: Request, res: Response) => {
  try {
    const data = await referenceDataLoader.refreshCache();
    res.json({ success: true, reloadedAt: data.loadedAt });
  } catch (err: any) {
    res.status(500).json({ error: 'FAILED_TO_REFRESH_CACHE', message: err.message });
  }
});

export const referenceRouter = router;
