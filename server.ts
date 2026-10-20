import express from 'express';
import { createServer as createViteServer } from 'vite';
import { app } from './server/app';
import { referenceDataLoader } from './server/services/reference.loader';

const PORT = parseInt(process.env.PORT || '3000', 10);

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
