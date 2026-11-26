import 'dotenv/config';
import http from 'http';
import { secretsGuardStatus } from './server/config/secrets';
import express from 'express';
import { createServer as createViteServer } from 'vite';
import { app } from './server/app';
import { getClient, guardStatus, DbGuardError } from './server/db/client';
import { ensureFoundationSchema } from './server/db/migrations';
import { ensureSystemRolePermissions, ensureInAppNotificationTemplates } from './server/db/seed';
import { completenessService } from './server/services/completeness.service';

const PORT = parseInt(process.env.PORT || '3000', 10);

async function startServer() {
  const s = secretsGuardStatus();
  const g = guardStatus();
  const isProd = process.env.NODE_ENV === 'production';

  if (s.ok && g.ok) {
    // Verify database guard and live connection before opening HTTP listener
    try {
      const client = await getClient();
      client.release();
      // Ensure foundation columns, indexes, RBAC role_permissions, and in-app notification templates exist in PostgreSQL
      await ensureFoundationSchema();
      await ensureSystemRolePermissions();
      await ensureInAppNotificationTemplates();
      // Start daily completeness reconciliation scheduler (00:05 Africa/Gaborone)
      completenessService.startScheduler();
    } catch (err: any) {
      const reason = err instanceof DbGuardError || err?.code === 'DB_GUARD' ? err.reason : 'db_unreachable';
      console.error('[db-guard] Startup verification failed:', reason);
      if (isProd) {
        process.exit(1);
      }
    }
  } else {
    console.warn(
      `[server] Starting in fail-closed blocked mode on port ${PORT} (/api/* returning 503 until env config is complete)`
    );
    if (isProd) {
      process.exit(1);
    }
  }

  const httpServer = http.createServer(app);

  // Mount Vite middleware in development and attach Vite 8 WebSocket server to the same HTTP server
  if (process.env.NODE_ENV !== 'production') {
    const hmrDisabled = process.env.DISABLE_HMR === 'true';
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: hmrDisabled ? false : true,
        ws: { server: httpServer },
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static('dist'));
    app.get('*', (_req, res) => {
      res.sendFile('dist/index.html', { root: '.' });
    });
  }

  httpServer.listen(PORT, '0.0.0.0', () => {
    console.log(`[BidReady360 Server] Running on http://localhost:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('[FATAL SERVER START ERROR]', err instanceof DbGuardError ? err.reason : err?.message);
  process.exit(1);
});
