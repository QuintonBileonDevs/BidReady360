import app from '../server/app';

// Vercel catch-all serverless function for all other /api/* routes
export default function handler(req: any, res: any) {
  return app(req, res);
}
