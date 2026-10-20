import 'dotenv/config';
import express from 'express';
import cookieParser from 'cookie-parser';
import { authenticate } from './middleware/auth.middleware';
import { referenceRouter } from './routes/reference.routes';
import { authRouter } from './routes/auth.routes';
import { supplierRouter } from './routes/supplier.routes';
import { callsRouter } from './routes/calls.routes';
import { buyerRouter } from './routes/buyer.routes';
import { auditRouter } from './routes/audit.routes';

const app = express();

// CORS & preflight handling
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  next();
});

app.use(express.json({ limit: '10mb' }));
app.use(cookieParser());
app.use(authenticate);

// API routes with '/api' prefix
app.use('/api/reference', referenceRouter);
app.use('/api/auth', authRouter);
app.use('/api/supplier', supplierRouter);
app.use('/api/calls', callsRouter);
app.use('/api/buyer', buyerRouter);
app.use('/api/audit', auditRouter);

// Same routes without the prefix, in case a rewrite strips '/api'
app.use('/reference', referenceRouter);
app.use('/auth', authRouter);
app.use('/supplier', supplierRouter);
app.use('/calls', callsRouter);
app.use('/buyer', buyerRouter);
app.use('/audit', auditRouter);

// Health check
app.get(['/api/health', '/health'], (req, res) => {
  res.json({
    ok: true,
  });
});

export default app;
export { app };