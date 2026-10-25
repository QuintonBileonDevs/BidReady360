import { Router, Request, Response } from 'express';
import { query } from '../db/client';
import { requireAuth } from '../middleware/auth.middleware';
import { suppliersRepository } from '../repositories/suppliers.repository';
import { usersRepository } from '../repositories/users.repository';

const router = Router();

// GET /api/bootstrap (and /api/auth/bootstrap)
// Fetches all essential data for the dashboard in a single coordinated request
router.get(['/bootstrap', '/auth/bootstrap'], requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    let activeTenant = req.activeTenant;

    // Self-healing: If activeTenant is missing from session, resolve deterministically from memberships
    if (!activeTenant) {
      if (user.isPlatformAdmin) {
        activeTenant = {
          tenantType: 'organization',
          tenantId: 'platform',
          tenantName: 'Platform Administration',
          roleId: 'role-platform-admin',
          roleName: 'Super Admin',
          isOwner: true,
          status: 'active',
          permissions: ['*'],
        };
      } else {
        const memberships = await usersRepository.getUserMemberships(user.id);
        if (memberships.length > 0) {
          // Deterministic sort: Owner > Admin > Member, then alphabetical by tenantName
          const sorted = [...memberships].sort((a, b) => {
            if (a.isOwner !== b.isOwner) return a.isOwner ? -1 : 1;
            return a.tenantName.localeCompare(b.tenantName);
          });
          activeTenant = sorted[0];
        }
      }
    }

    if (!activeTenant) {
      res.status(404).json({ error: 'NO_ACTIVE_TENANT', message: 'No active workspace found for this account.' });
      return;
    }

    let profile: any = null;
    let docs: any[] = [];
    let apps: any[] = [];
    let people: any[] = [];
    let consent: any[] = [];

    if ((activeTenant.tenantType as string) === 'platform' || activeTenant.tenantId === 'platform') {
      profile = {
        id: 'platform',
        legalName: 'BidReady360 Platform Administration',
        name: 'Platform Administration',
        role: 'Super Admin',
      };
    } else if (activeTenant.tenantType === 'supplier') {
      // Use suppliersRepository for full camelCase normalization & safe completeness calculation
      profile = await suppliersRepository.getById(activeTenant.tenantId, true).catch(() => null);

      if (!profile) {
        // Fallback to raw query if repository had any error
        const rawRes = await query('SELECT * FROM suppliers WHERE id = $1 LIMIT 1', [activeTenant.tenantId]).catch(() => ({ rows: [] }));
        if (rawRes.rows.length > 0) {
          const r = rawRes.rows[0];
          profile = {
            id: r.id,
            legalName: r.legal_name,
            tradingName: r.trading_name || r.legal_name,
            cipaNumber: r.cipa_uin || '',
            tinNumber: r.burs_tin || '',
            profileCompleteness: r.profile_completeness || 0,
            status: r.status,
            verificationStatus: r.verification_status,
          };
        }
      }

      // Concurrently fetch supplier subsidiary collections with graceful catch defaults
      const [docsRes, appsRes, peopleRes, consentRes] = await Promise.all([
        query('SELECT * FROM supplier_documents WHERE supplier_id = $1 ORDER BY created_at DESC', [activeTenant.tenantId]).catch(() => ({ rows: [] })),
        query('SELECT * FROM supplier_applications WHERE supplier_id = $1 ORDER BY submitted_at DESC', [activeTenant.tenantId]).catch(() => ({ rows: [] })),
        query('SELECT * FROM supplier_people WHERE supplier_id = $1 ORDER BY is_active DESC', [activeTenant.tenantId]).catch(() => ({ rows: [] })),
        query('SELECT * FROM supplier_consent_grants WHERE supplier_id = $1', [activeTenant.tenantId]).catch(() => ({ rows: [] })),
      ]);

      docs = docsRes.rows || [];
      apps = appsRes.rows || [];
      people = peopleRes.rows || [];
      consent = consentRes.rows || [];
    } else if (activeTenant.tenantType === 'organization') {
      // Buyer organization
      const orgRes = await query(
        `SELECT id, name, slug, organization_type AS "organizationType", status, verification_status AS "verificationStatus"
         FROM organizations WHERE id = $1 LIMIT 1`,
        [activeTenant.tenantId]
      ).catch(() => ({ rows: [] }));

      profile = orgRes.rows[0] || {
        id: activeTenant.tenantId,
        name: activeTenant.tenantName,
        status: 'active',
      };
    }

    res.json({
      activeTenant,
      profile: profile || null,
      documents: docs,
      applications: apps,
      people: people,
      consent: consent,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        phone: user.phone || null,
        isPlatformAdmin: user.isPlatformAdmin || false,
      },
    });
  } catch (err: any) {
    console.error('[BOOTSTRAP ERROR]:', err);
    res.status(500).json({ error: 'BOOTSTRAP_FAILED', message: err.message || 'Failed to assemble workspace bootstrap.' });
  }
});

export const bootstrapRouter = router;
