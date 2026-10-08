import { Router, Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { translateDbError } from '../db/errors';
import { requireAuth } from '../middleware/auth.middleware';
import { extractClientIp } from '../utils/ip';

const router = Router();

// POST /api/auth/register-supplier
router.post('/register-supplier', async (req: Request, res: Response) => {
  try {
    const { legalName, cipaUin, fullName, email, password, phone } = req.body;

    if (!legalName || !cipaUin || !fullName || !email || !password) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Please complete all required fields: Company Name, CIPA Number, Full Name, Email, and Password.',
      });
      return;
    }

    if (password.length < 8) {
      res.status(400).json({
        error: 'PASSWORD_TOO_SHORT',
        message: 'Password must be at least 8 characters long.',
      });
      return;
    }

    const ip = extractClientIp(req);
    const userAgent = req.headers['user-agent'] || 'Web Client';

    const result = await authService.registerSupplier({
      legalName,
      cipaUin,
      fullName,
      email,
      password,
      phone,
      ip,
      userAgent,
    });

    // Set HTTP-only session cookie
    if (result.token) {
      res.cookie('session_token', result.token, {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 8 * 60 * 60 * 1000,
        secure: process.env.NODE_ENV === 'production',
      });
    }

    res.status(201).json(result);
  } catch (err: any) {
    console.error('[AUTH REGISTER SUPPLIER ERROR]', err);
    const safeError = translateDbError(err);
    res.status(safeError.status).json(safeError);
  }
});

// POST /api/auth/register-buyer
router.post('/register-buyer', async (req: Request, res: Response) => {
  try {
    const { organizationName, organizationType, fullName, email, password, phone } = req.body;

    if (!organizationName || !fullName || !email || !password) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Please complete all required fields: Organization Name, Full Name, Official Email, and Password.',
      });
      return;
    }

    const ip = extractClientIp(req);
    const userAgent = req.headers['user-agent'] || 'Web Client';

    const result = await authService.registerOrganization({
      organizationName,
      organizationType,
      fullName,
      email,
      password,
      phone,
      ip,
      userAgent,
    });

    if (result.token) {
      res.cookie('session_token', result.token, {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 8 * 60 * 60 * 1000,
        secure: process.env.NODE_ENV === 'production',
      });
    }

    res.status(201).json(result);
  } catch (err: any) {
    console.error('[AUTH REGISTER BUYER ERROR]', err);
    const safeError = translateDbError(err);
    res.status(safeError.status).json(safeError);
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      res.status(400).json({
        error: 'MISSING_CREDENTIALS',
        message: 'Email address and password are required.',
      });
      return;
    }

    const ip = extractClientIp(req);
    const result = await authService.login(email, password, ip);

    if (result.token) {
      res.cookie('session_token', result.token, {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 8 * 60 * 60 * 1000,
        secure: process.env.NODE_ENV === 'production',
      });
    }

    res.json(result);
  } catch (err: any) {
    console.error('[AUTH LOGIN ERROR]', err);
    res.status(401).json({
      error: 'AUTHENTICATION_FAILED',
      message: err.message || 'Invalid email or password.',
    });
  }
});

// POST /api/auth/verify-mfa
router.post('/verify-mfa', async (req: Request, res: Response) => {
  try {
    const { userId, totpCode } = req.body;

    if (!userId || !totpCode) {
      res.status(400).json({
        error: 'MISSING_MFA_DATA',
        message: 'User ID and 6-digit MFA verification code are required.',
      });
      return;
    }

    const ip = extractClientIp(req);
    const result = await authService.verifyMfa(userId, totpCode, ip);

    if (result.token) {
      res.cookie('session_token', result.token, {
        httpOnly: true,
        sameSite: 'lax',
        maxAge: 8 * 60 * 60 * 1000,
        secure: process.env.NODE_ENV === 'production',
      });
    }

    res.json(result);
  } catch (err: any) {
    res.status(401).json({
      error: 'MFA_FAILED',
      message: err.message || 'MFA verification failed.',
    });
  }
});

// POST /api/auth/verify-email
router.post('/verify-email', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({
        error: 'MISSING_EMAIL',
        message: 'Email address is required to verify account.',
      });
      return;
    }

    await authService.verifyEmail(email);
    res.json({ success: true, message: 'Email verified successfully.' });
  } catch (err: any) {
    res.status(400).json({
      error: 'VERIFICATION_FAILED',
      message: err.message || 'Email verification failed.',
    });
  }
});

// GET /api/auth/me
router.get('/me', requireAuth, (req: Request, res: Response) => {
  res.json({
    user: {
      id: req.user!.id,
      email: req.user!.email,
      fullName: req.user!.fullName,
      phone: req.user!.phone,
      isPlatformAdmin: req.user!.isPlatformAdmin,
    },
    activeTenant: req.activeTenant,
    permissions: Array.from(req.permissions || []),
  });
});

// POST /api/auth/logout
router.post('/logout', (req: Request, res: Response) => {
  res.clearCookie('session_token');
  res.json({ success: true, message: 'Logged out successfully.' });
});

export const authRouter = router;
