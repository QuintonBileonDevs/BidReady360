import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import {
  notificationsRepository,
  NotificationTenantScope,
  NotificationBulkAction,
} from '../repositories/notifications.repository';
import { translateDbError } from '../db/errors';

const router = Router();
router.use(requireAuth);

const ALLOWED_BULK_ACTIONS: NotificationBulkAction[] = [
  'read',
  'unread',
  'star',
  'unstar',
  'archive',
  'unarchive',
  'delete',
];

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
    const limit = req.query.limit ? Number(req.query.limit) : 100;
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

// POST /api/notifications/bulk
router.post('/bulk', async (req: Request, res: Response) => {
  try {
    const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(String) : [];
    const action = String(req.body?.action || '') as NotificationBulkAction;
    if (!ids.length) {
      res.status(400).json({ error: 'INVALID_INPUT', message: 'Select at least one notification.' });
      return;
    }
    if (!ALLOWED_BULK_ACTIONS.includes(action)) {
      res.status(400).json({ error: 'INVALID_ACTION', message: 'Unsupported bulk notification action.' });
      return;
    }
    const scope = resolveScope(req);
    const updatedCount = await notificationsRepository.bulkUpdate(ids, req.user!.id, action, scope);
    res.json({ success: true, updatedCount });
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

// PATCH /api/notifications/:id/unread
router.patch('/:id/unread', async (req: Request, res: Response) => {
  try {
    const scope = resolveScope(req);
    const ok = await notificationsRepository.markUnread(req.params.id, req.user!.id, scope);
    if (!ok) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Notification not found.' });
      return;
    }
    res.json({ success: true });
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

// PATCH /api/notifications/:id/star
router.patch('/:id/star', async (req: Request, res: Response) => {
  try {
    const starred = Boolean(req.body?.starred);
    const scope = resolveScope(req);
    const ok = await notificationsRepository.setStarred(req.params.id, req.user!.id, starred, scope);
    if (!ok) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Notification not found.' });
      return;
    }
    res.json({ success: true, starred });
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

// PATCH /api/notifications/:id/archive
router.patch('/:id/archive', async (req: Request, res: Response) => {
  try {
    const archived = Boolean(req.body?.archived);
    const scope = resolveScope(req);
    const ok = await notificationsRepository.setArchived(req.params.id, req.user!.id, archived, scope);
    if (!ok) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Notification not found.' });
      return;
    }
    res.json({ success: true, archived });
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

// DELETE /api/notifications/:id
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const scope = resolveScope(req);
    const ok = await notificationsRepository.softDelete(req.params.id, req.user!.id, scope);
    if (!ok) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Notification not found.' });
      return;
    }
    res.json({ success: true });
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

export const notificationsRouter = router;
