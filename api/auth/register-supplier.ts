import type { IncomingMessage, ServerResponse } from 'http';
import { authService } from '../../server/services/auth.service';
import { translateDbError } from '../../server/db/errors';
import { extractClientIp } from '../../server/utils/ip';

interface VercelRequest extends IncomingMessage {
  body: any;
  query: Record<string, string | string[]>;
  cookies: Record<string, string>;
  headers: IncomingMessage['headers'];
}

interface VercelResponse extends ServerResponse {
  status: (statusCode: number) => VercelResponse;
  json: (data: any) => VercelResponse;
  send: (body: any) => VercelResponse;
}

/**
 * Vercel Serverless Function: POST /api/auth/register-supplier
 * Explicitly matches the endpoint called by the supplier onboarding form.
 */
export default async function handler(req: VercelRequest, res: VercelResponse) {
  // 1. Set CORS and preflight headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // 2. Reject non-POST HTTP methods with proper 405 and Allow header
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST, OPTIONS');
    return res.status(405).json({
      error: 'METHOD_NOT_ALLOWED',
      message: `HTTP method ${req.method} not allowed. Please use POST.`,
    });
  }

  // 3. Parse JSON body (support pre-parsed or raw string)
  let payload = req.body;
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload);
    } catch {
      return res.status(400).json({
        error: 'INVALID_JSON',
        message: 'Invalid JSON request payload.',
      });
    }
  }
  payload = payload || {};

  const { legalName, cipaUin, fullName, email, password, phone } = payload;

  // 4. Input Validation
  if (!legalName || !cipaUin || !fullName || !email || !password) {
    return res.status(400).json({
      error: 'VALIDATION_ERROR',
      message: 'Please complete all required fields: Company Name, CIPA Number, Full Name, Email, and Password.',
    });
  }

  if (typeof password !== 'string' || password.length < 8) {
    return res.status(400).json({
      error: 'PASSWORD_TOO_SHORT',
      message: 'Password must be at least 8 characters long.',
    });
  }

  // 5. Execution
  try {
    const ip = extractClientIp(req as any);
    const userAgent = (req.headers['user-agent'] as string) || 'Web Client';

    const result = await authService.registerSupplier({
      legalName: String(legalName).trim(),
      cipaUin: String(cipaUin).trim().toUpperCase(),
      fullName: String(fullName).trim(),
      email: String(email).trim().toLowerCase(),
      password,
      phone: phone ? String(phone).trim() : undefined,
      ip,
      userAgent,
    });

    // Set cookie if token is present
    if (result.token) {
      const isProd = process.env.NODE_ENV === 'production';
      res.setHeader(
        'Set-Cookie',
        `session_token=${result.token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=28800${isProd ? '; Secure' : ''}`
      );
    }

    return res.status(201).json(result);
  } catch (err: any) {
    console.error('[VERCEL API] Supplier registration error:', err);
    const safeError = translateDbError(err);
    return res.status(safeError.status).json(safeError);
  }
}
