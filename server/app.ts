import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import { authenticate, csrfProtection } from './middleware/auth.middleware';
import { guardStatus, DbGuardError, query } from './db/client';
import { referenceRouter } from './routes/reference.routes';
import { authRouter } from './routes/auth.routes';
import { supplierRouter } from './routes/supplier.routes';
import { callsRouter } from './routes/calls.routes';
import { buyerRouter } from './routes/buyer.routes';
import { auditRouter } from './routes/audit.routes';
import { bootstrapRouter } from './routes/bootstrap.routes';
import { debugRouter } from './routes/debug.routes';

const app = express();
app.set('etag', false);

// Fail-closed database guard middleware (FIRST middleware on /api and non-prefixed API paths)
app.use('/api', (req: Request, res: Response, next: NextFunction) => {
  const g = guardStatus();
  if (!g.ok && req.path !== '/health') {
    res.setHeader('Cache-Control', 'no-store');
    res.status(503).json({ error: 'db_guard', reason: g.reason });
    return;
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
    req.path.startsWith('/debug');
  if (unprefixedApi) {
    const g = guardStatus();
    if (!g.ok) {
      res.setHeader('Cache-Control', 'no-store');
      res.status(503).json({ error: 'db_guard', reason: g.reason });
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
  if (req.path.startsWith('/api') || req.path.startsWith('/auth') || req.path.startsWith('/supplier') || req.path.startsWith('/bootstrap') || req.path.startsWith('/buyer') || req.path.startsWith('/reference') || req.path.startsWith('/calls') || req.path.startsWith('/audit')) {
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
app.use(csrfProtection);
app.use(authenticate);

// Health check (reports guard status, DB reachability, database name when OK, and reference counts)
app.get(['/api/health', '/health'], async (_req: Request, res: Response) => {
  res.setHeader('Cache-Control', 'no-store');
  const g = guardStatus();
  if (!g.ok) {
    res.status(503).json({
      ok: false,
      guard: { ok: false, reason: g.reason },
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

    res.json({
      ok: true,
      guard: { ok: true, reason: null },
      db: 'reachable',
      database: dbName,
      refs: counts,
    });
  } catch (err: any) {
    if (err instanceof DbGuardError || err?.code === 'DB_GUARD') {
      res.status(503).json({
        ok: false,
        guard: { ok: false, reason: err.reason || 'db_name_mismatch' },
        db: 'blocked',
      });
      return;
    }
    res.status(503).json({
      ok: false,
      guard: { ok: true, reason: null },
      db: 'unreachable',
    });
  }
});

// API routes with '/api' prefix
app.use('/api/reference', referenceRouter);
app.use('/api/auth', authRouter);
app.use('/api/supplier', supplierRouter);
app.use('/api/calls', callsRouter);
app.use('/api/buyer', buyerRouter);
app.use('/api/audit', auditRouter);
app.use('/api/bootstrap', bootstrapRouter);
app.use('/api/debug', debugRouter);

// Same routes without the prefix, in case a rewrite strips '/api'
app.use('/reference', referenceRouter);
app.use('/auth', authRouter);
app.use('/supplier', supplierRouter);
app.use('/calls', callsRouter);
app.use('/buyer', buyerRouter);
app.use('/audit', auditRouter);
app.use('/bootstrap', bootstrapRouter);
app.use('/debug', debugRouter);

// Centralized error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[EXPRESS UNHANDLED ERROR]:', err);
  if (err instanceof DbGuardError || err?.code === 'DB_GUARD') {
    res.setHeader('Cache-Control', 'no-store');
    res.status(503).json({
      error: 'db_guard',
      reason: err.reason || 'guard_blocked',
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