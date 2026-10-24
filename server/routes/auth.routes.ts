import { Router, Request, Response } from 'express';
import { authService } from '../services/auth.service';
import { translateDbError } from '../db/errors';
import { requireAuth } from '../middleware/auth.middleware';
import { extractClientIp } from '../utils/ip';

const router = Router();

// POST /api/auth/register-supplier-step (Multi-step onboarding)
router.post('/register-supplier-step', async (req: Request, res: Response) => {
  try {
    const { step, email, fullName, phone, password, legalName, cipaUin, companyType, city, agreedToTerms, agreedToPrivacy } = req.body;

    if (!email || !step) {
      res.status(400).json({
        error: 'VALIDATION_ERROR',
        message: 'Step and Email address are required.',
      });
      return;
    }

    const ip = extractClientIp(req);
    const userAgent = req.headers['user-agent'] || 'Web Client';

    const result = await authService.saveSupplierRegistrationStep({
      step: Number(step) as 1 | 2 | 3,
      email,
      fullName,
      phone,
      password,
      legalName,
      cipaUin,
      companyType,
      city,
      agreedToTerms,
      agreedToPrivacy,
      ip,
      userAgent,
    });

    res.status(200).json(result);
  } catch (err: any) {
    const safeError = translateDbError(err);
    res.status(safeError.status).json(safeError);
  }
});

// GET /api/auth/supplier-progress
router.get('/supplier-progress', async (req: Request, res: Response) => {
  try {
    const email = String(req.query.email || '').trim();
    if (!email) {
      res.json({ found: false });
      return;
    }
    const progress = await authService.getSupplierRegistrationProgress(email);
    res.json(progress);
  } catch (err: any) {
    res.status(500).json({ found: false, error: err.message });
  }
});

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

    res.status(201).json(result);
  } catch (err: any) {
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

    res.status(201).json(result);
  } catch (err: any) {
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
    const userAgent = req.headers['user-agent'] || 'Web Client';
    const result = await authService.login(email, password, ip, userAgent);

    // Set HTTP-only secure session cookie with 7-day expiry
    if (result.token) {
      res.cookie('session_token', result.token, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000,
        secure: process.env.NODE_ENV === 'production',
      });
    }

    res.json(result);
  } catch (err: any) {
    if (err.status === 429) {
      res.status(429).json({
        error: 'RATE_LIMIT_EXCEEDED',
        message: err.message || 'Too many attempts. Try again in 15 minutes.',
      });
      return;
    }

    if (err.status === 403 && err.code === 'EMAIL_NOT_VERIFIED') {
      res.status(403).json({
        error: 'EMAIL_NOT_VERIFIED',
        message: 'Verify your email first',
        email: err.email,
      });
      return;
    }

    if (err.status === 403) {
      res.status(403).json({
        error: err.code || 'FORBIDDEN',
        message: err.message,
      });
      return;
    }

    res.status(401).json({
      error: 'INVALID_CREDENTIALS',
      message: 'Email or password is incorrect.',
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
    const userAgent = req.headers['user-agent'] || 'Web Client';
    const result = await authService.verifyMfa(userId, totpCode, ip, userAgent);

    if (result.token) {
      res.cookie('session_token', result.token, {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000,
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
    const { token } = req.body;
    if (!token) {
      res.status(400).json({
        error: 'MISSING_TOKEN',
        message: 'Verification token is required.',
      });
      return;
    }

    const ip = extractClientIp(req);
    const userAgent = req.headers['user-agent'] || 'Web Client';
    const result = await authService.verifyEmailWithToken(token, ip, userAgent);
    res.json(result);
  } catch (err: any) {
    const safeError = translateDbError(err);
    res.status(safeError.status || 400).json(safeError);
  }
});

// POST /api/auth/resend-verification
router.post('/resend-verification', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({
        error: 'MISSING_EMAIL',
        message: 'Email address is required.',
      });
      return;
    }

    const ip = extractClientIp(req);
    const userAgent = req.headers['user-agent'] || 'Web Client';
    const result = await authService.resendVerification(email, ip, userAgent);
    res.json(result);
  } catch (err: any) {
    const safeError = translateDbError(err);
    res.status(safeError.status || 400).json(safeError);
  }
});

// POST /api/auth/forgot-password
router.post('/forgot-password', async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({
        error: 'MISSING_EMAIL',
        message: 'Email address is required.',
      });
      return;
    }

    const ip = extractClientIp(req);
    const userAgent = req.headers['user-agent'] || 'Web Client';
    const result = await authService.forgotPassword(email, ip, userAgent);
    res.json(result);
  } catch (err: any) {
    const safeError = translateDbError(err);
    res.status(safeError.status || 400).json(safeError);
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req: Request, res: Response) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      res.status(400).json({
        error: 'MISSING_DATA',
        message: 'Reset token and new password are required.',
      });
      return;
    }

    const ip = extractClientIp(req);
    const userAgent = req.headers['user-agent'] || 'Web Client';
    const result = await authService.resetPassword(token, password, ip, userAgent);
    res.json(result);
  } catch (err: any) {
    const safeError = translateDbError(err);
    res.status(safeError.status || 400).json(safeError);
  }
});

// POST /api/auth/switch-tenant
router.post('/switch-tenant', requireAuth, async (req: Request, res: Response) => {
  try {
    const { tenantId, tenantType } = req.body;
    if (!tenantId || !tenantType) {
      res.status(400).json({
        error: 'MISSING_DATA',
        message: 'tenantId and tenantType are required.',
      });
      return;
    }

    const updated = await authService.switchTenant(
      req.session!.rawToken,
      tenantId,
      tenantType
    );

    res.json({ success: true, activeTenant: updated });
  } catch (err: any) {
    const safeError = translateDbError(err);
    res.status(safeError.status || 400).json(safeError);
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
router.post('/logout', async (req: Request, res: Response) => {
  try {
    const rawToken = req.session?.rawToken || req.cookies?.session_token;
    if (rawToken) {
      const ip = extractClientIp(req);
      const userAgent = req.headers['user-agent'] || 'Web Client';
      await authService.logout(rawToken, ip, userAgent);
    }
  } catch {}

  res.clearCookie('session_token', { path: '/' });
  res.json({ success: true, message: 'Logged out successfully.' });
});

export const authRouter = router;
