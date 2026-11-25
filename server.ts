import 'dotenv/config';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { app } from './server/app';
import { getClient, DbGuardError } from './server/db/client';
import { completenessService } from './server/services/completeness.service';

const PORT = parseInt(process.env.PORT || '3000', 10);

async function startServer() {
  // Verify database guard and live connection before opening HTTP listener
  try {
    const client = await getClient();
    client.release();
  } catch (err: any) {
    const reason = err instanceof DbGuardError || err?.code === 'DB_GUARD' ? err.reason : 'db_unreachable';
    console.error('[db-guard] Startup verification failed:', reason);
    process.exit(1);
  }

  // Start daily completeness reconciliation scheduler (00:05 Africa/Gaborone)
  completenessService.startScheduler();

  // Mount Vite middleware in development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get('*', (_req, res) => {
      res.sendFile('dist/index.html', { root: '.' });
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[BidReady360 Server] Running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[FATAL SERVER START ERROR]', err instanceof DbGuardError ? err.reason : err?.message);
  process.exit(1);
});
