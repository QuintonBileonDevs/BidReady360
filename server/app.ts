import 'dotenv/config';
import express, { Request, Response, NextFunction } from 'express';
import cookieParser from 'cookie-parser';
import { authenticate, csrfProtection } from './middleware/auth.middleware';
import { verifyDatabaseGuard } from './db/client';
import { referenceRouter } from './routes/reference.routes';
import { authRouter } from './routes/auth.routes';
import { supplierRouter } from './routes/supplier.routes';
import { callsRouter } from './routes/calls.routes';
import { buyerRouter } from './routes/buyer.routes';
import { auditRouter } from './routes/audit.routes';
import { bootstrapRouter } from './routes/bootstrap.routes';
import { debugRouter } from './routes/debug.routes';

// Run startup database verification guard
verifyDatabaseGuard().catch((err) => {
  console.error('[FATAL STARTUP GUARD FAILED]:', err.message);
});

const app = express();
app.set('etag', false);

// CORS & preflight handling
app.use((req: Request, res: Response, next: NextFunction) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Origin, Accept');
  
  // Enforce no-store on all API endpoints to prevent stale cached authenticated data
  if (req.path.startsWith('/api') || req.path.startsWith('/auth') || req.path.startsWith('/supplier') || req.path.startsWith('/bootstrap') || req.path.startsWith('/buyer')) {
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

// Health check
app.get(['/api/health', '/health'], (_req: Request, res: Response) => {
  res.json({
    ok: true,
  });
});

// Centralized error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[EXPRESS UNHANDLED ERROR]:', err);
  if (err.code === 'DATABASE_UNAVAILABLE' || err.status === 503) {
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