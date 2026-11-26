import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import { notificationsRepository, NotificationTenantScope } from '../repositories/notifications.repository';
import { translateDbError } from '../db/errors';

const router = Router();
router.use(requireAuth);

function resolveScope(req: Request): NotificationTenantScope {
  return {
    tenantType: req.activeTenant?.tenantType || null,
    tenantId: req.activeTenant?.tenantId || null,
  };
}

// GET /api/notifications
router.get('/', async (req: Request, res: Response) => {
  try {
    const scope = resolveScope(req);
    if (scope.tenantType === 'supplier' && scope.tenantId) {
      await notificationsRepository
        .syncExpiringDocumentNotifications(scope.tenantId)
        .catch((err) => console.warn('[expiring-doc-notif-sync warning]', err?.message || err));
    }
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const list = await notificationsRepository.listForUser(req.user!.id, scope, limit);
    res.json(list);
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

// GET /api/notifications/unread-count
router.get('/unread-count', async (req: Request, res: Response) => {
  try {
    const scope = resolveScope(req);
    if (scope.tenantType === 'supplier' && scope.tenantId) {
      await notificationsRepository
        .syncExpiringDocumentNotifications(scope.tenantId)
        .catch(() => {});
    }
    const unreadCount = await notificationsRepository.getUnreadCount(req.user!.id, scope);
    res.json({ unreadCount });
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

// POST /api/notifications/read-all
router.post('/read-all', async (req: Request, res: Response) => {
  try {
    const scope = resolveScope(req);
    const count = await notificationsRepository.markAllRead(req.user!.id, scope);
    res.json({ success: true, updatedCount: count });
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

async function handleMarkSingleRead(req: Request, res: Response): Promise<void> {
  try {
    const scope = resolveScope(req);
    const ok = await notificationsRepository.markRead(req.params.id, req.user!.id, scope);
    if (!ok) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Notification not found.' });
      return;
    }
    res.json({ success: true });
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
}

// PATCH /api/notifications/:id/read (primary REST endpoint)
router.patch('/:id/read', handleMarkSingleRead);

// POST /api/notifications/:id/read (backward-compatible alias)
router.post('/:id/read', handleMarkSingleRead);

export const notificationsRouter = router;
