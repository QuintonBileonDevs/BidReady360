import express from 'express';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import { createServer as createViteServer } from 'vite';
import { authenticate } from './server/middleware/auth.middleware';
import { referenceRouter } from './server/routes/reference.routes';
import { authRouter } from './server/routes/auth.routes';
import { supplierRouter } from './server/routes/supplier.routes';
import { callsRouter } from './server/routes/calls.routes';
import { buyerRouter } from './server/routes/buyer.routes';
import { auditRouter } from './server/routes/audit.routes';
import { referenceDataLoader } from './server/services/reference.loader';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(authenticate);

// Mount API routes
app.use('/api/reference', referenceRouter);
app.use('/api/auth', authRouter);
app.use('/api/supplier', supplierRouter);
app.use('/api/calls', callsRouter);
app.use('/api/buyer', buyerRouter);
app.use('/api/audit', auditRouter);

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    database: 'PostgreSQL on Aiven',
    timestamp: new Date().toISOString(),
  });
});

async function startServer() {
  // Pre-warm reference data cache on server boot
  try {
    await referenceDataLoader.getReferenceData();
  } catch (err) {
    console.warn('[SERVER INIT] Reference data pre-warm encountered non-fatal error:', err);
  }

  // Mount Vite middleware in development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get('*', (req, res) => {
      res.sendFile('dist/index.html', { root: '.' });
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[BidReady360 Server] Running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[FATAL SERVER START ERROR]', err);
  process.exit(1);
});
