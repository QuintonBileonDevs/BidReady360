import 'dotenv/config';
import {
  secretsGuardStatus,
  getSecretsHealth,
  ConfigSecretError,
} from './config/secrets';
import express, { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import { authenticate, csrfProtection } from './middleware/auth.middleware';
import { generalApiRateLimiter, authEndpointRateLimiter } from './middleware/rateLimit.middleware';
import { guardStatus, DbGuardError, query } from './db/client';
import { referenceRouter } from './routes/reference.routes';
import { authRouter } from './routes/auth.routes';
import { supplierRouter } from './routes/supplier.routes';
import { callsRouter } from './routes/calls.routes';
import { buyerRouter } from './routes/buyer.routes';
import { auditRouter } from './routes/audit.routes';
import { bootstrapRouter } from './routes/bootstrap.routes';
import { debugRouter } from './routes/debug.routes';
import { adminRouter } from './routes/admin.routes';
import { notificationsRouter } from './routes/notifications.routes';

const app = express();
app.set('etag', false);

// Fail-closed config secrets & database guard middleware (FIRST middleware on /api and non-prefixed API paths)
app.use('/api', (req: Request, res: Response, next: NextFunction) => {
  if (req.path !== '/health') {
    const s = secretsGuardStatus();
    if (!s.ok) {
      res.setHeader('Cache-Control', 'no-store');
      res.status(503).json({ error: 'config', reason: s.reason });
      return;
    }
    const g = guardStatus();
    if (!g.ok) {
      console.error('[db-guard] Request blocked:', g.reason);
      res.setHeader('Cache-Control', 'no-store');
      res.status(503).json({
        error: 'DATABASE_GUARD_FAILED',
        message: 'Service temporarily unavailable.',
      });
      return;
    }
  }
  next();
});

app.use((req: Request, res: Response, next: NextFunction) => {
  const unprefixedApi =
    req.path.startsWith('/reference') ||
    req.path.startsWith('/auth') ||
    req.path.startsWith('/supplier') ||
    req.path.startsWith('/calls') ||
    req.path.startsWith('/buyer') ||
    req.path.startsWith('/audit') ||
    req.path.startsWith('/bootstrap') ||
    req.path.startsWith('/debug') ||
    req.path.startsWith('/admin') ||
    req.path.startsWith('/notifications');
  if (unprefixedApi) {
    const s = secretsGuardStatus();
    if (!s.ok) {
      res.setHeader('Cache-Control', 'no-store');
      res.status(503).json({ error: 'config', reason: s.reason });
      return;
    }
    const g = guardStatus();
    if (!g.ok) {
      console.error('[db-guard] Request blocked:', g.reason);
      res.setHeader('Cache-Control', 'no-store');
      res.status(503).json({
        error: 'DATABASE_GUARD_FAILED',
        message: 'Service temporarily unavailable.',
      });
      return;
    }
  }
  next();
});

// CORS & preflight handling
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Origin, Accept');

  // Enforce no-store on all API endpoints by default (reference success responses override with max-age=300)
  if (req.path.startsWith('/api') || req.path.startsWith('/auth') || req.path.startsWith('/supplier') || req.path.startsWith('/bootstrap') || req.path.startsWith('/buyer') || req.path.startsWith('/reference') || req.path.startsWith('/calls') || req.path.startsWith('/audit') || req.path.startsWith('/admin') || req.path.startsWith('/notifications')) {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.setHeader('Surrogate-Control', 'no-store');
  }

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use('/api', generalApiRateLimiter);
app.use(['/reference', '/auth', '/supplier', '/calls', '/buyer', '/audit', '/bootstrap', '/debug', '/admin', '/notifications'], generalApiRateLimiter);
app.use(csrfProtection);
app.use(authenticate);

// Health check (reports secrets status words, guard status, DB reachability, database name when OK, and reference counts)
app.get(['/api/health', '/health'], async (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store');
  const s = secretsGuardStatus();
  const secrets = getSecretsHealth();
  const g = guardStatus();
  if (!g.ok) {
    console.error('[db-guard] Health check blocked:', g.reason);
    res.status(503).json({
      ok: false,
      error: 'DATABASE_GUARD_FAILED',
      secrets,
      db: 'blocked',
    });
    return;
  }

  try {
    const [dbRes, countsRes] = await Promise.all([
      query<{ db: string }>('SELECT current_database() AS db'),
      query<{
        categories: number;
        disciplines: number;
        districts: number;
        documentTypes: number;
      }>(`
        SELECT
          (SELECT COUNT(*)::int FROM categories WHERE is_active = TRUE) AS categories,
          (SELECT COUNT(*)::int FROM procurement_disciplines WHERE is_active = TRUE) AS disciplines,
          (SELECT COUNT(*)::int FROM geographic_districts WHERE is_active = TRUE) AS districts,
          (SELECT COUNT(*)::int FROM document_types WHERE is_active = TRUE) AS "documentTypes"
      `),
    ]);

    const dbName = dbRes.rows[0]?.db;
    const counts = countsRes.rows[0] || {
      categories: 0,
      disciplines: 0,
      districts: 0,
      documentTypes: 0,
    };

    const allOk = s.ok;
    res.status(allOk ? 200 : 503).json({
      ok: allOk,
      config: { ok: s.ok },
      secrets,
      db: 'reachable',
      database: dbName,
      refs: counts,
    });
  } catch (err: any) {
    if (err instanceof DbGuardError || err?.code === 'DB_GUARD') {
      console.error('[db-guard] Health check blocked:', err.reason || 'db_name_mismatch');
      res.status(503).json({
        ok: false,
        error: 'DATABASE_GUARD_FAILED',
        secrets,
        db: 'blocked',
      });
      return;
    }
    res.status(503).json({
      ok: false,
      config: { ok: s.ok },
      secrets,
      db: 'unreachable',
    });
  }
});

// API routes with '/api' prefix
app.use('/api/reference', referenceRouter);
app.use('/api/auth', authEndpointRateLimiter, authRouter);
app.use('/api/supplier', supplierRouter);
app.use('/api/calls', callsRouter);
app.use('/api/buyer', buyerRouter);
app.use('/api/audit', auditRouter);
app.use('/api/bootstrap', bootstrapRouter);
app.use('/api/debug', debugRouter);
app.use('/api/admin', adminRouter);
app.use('/api/notifications', notificationsRouter);

// Same routes without the prefix, in case a rewrite strips '/api'
app.use('/reference', referenceRouter);
app.use('/auth', authEndpointRateLimiter, authRouter);
app.use('/supplier', supplierRouter);
app.use('/calls', callsRouter);
app.use('/buyer', buyerRouter);
app.use('/audit', auditRouter);
app.use('/bootstrap', bootstrapRouter);
app.use('/debug', debugRouter);
app.use('/admin', adminRouter);
app.use('/notifications', notificationsRouter);

// Centralized error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[EXPRESS UNHANDLED ERROR]:', err);
  if (err instanceof ConfigSecretError || err?.code === 'CONFIG_SECRET') {
    res.setHeader('Cache-Control', 'no-store');
    res.status(503).json({
      error: 'config',
      reason: err.reason || 'config_invalid',
    });
    return;
  }
  if (err instanceof DbGuardError || err?.code === 'DB_GUARD') {
    console.error('[db-guard] Request error blocked:', err.reason || 'guard_blocked');
    res.setHeader('Cache-Control', 'no-store');
    res.status(503).json({
      error: 'DATABASE_GUARD_FAILED',
      message: 'Service temporarily unavailable.',
    });
    return;
  }
  if (err.code === 'DATABASE_UNAVAILABLE' || err.status === 503) {
    res.setHeader('Cache-Control', 'no-store');
    res.status(503).json({
      error: 'SERVICE_UNAVAILABLE',
      message: 'Database service is temporarily unreachable. Please try again shortly.',
    });
    return;
  }
  res.status(err.status || 500).json({
    error: err.code || 'INTERNAL_ERROR',
    message: err.message || 'An unexpected error occurred.',
  });
});

export default app;
export { app };