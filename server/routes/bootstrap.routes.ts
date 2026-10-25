import crypto from 'crypto';
import { Router, Request, Response } from 'express';
import { query } from '../db/client';
import { requireAuth } from '../middleware/auth.middleware';
import { suppliersRepository } from '../repositories/suppliers.repository';
import { documentsRepository } from '../repositories/documents.repository';
import { applicationsRepository } from '../repositories/applications.repository';
import { consentRepository } from '../repositories/consent.repository';
import { usersRepository } from '../repositories/users.repository';
import { resolveDeterministicTenant, persistActiveTenantToSession } from '../services/tenant.resolver';
import { computeSupplierCompleteness, CompletenessResult } from '../services/completeness.service';

const router = Router();

// GET /api/bootstrap (and /api/auth/bootstrap)
// Fetches all essential data for the dashboard in a single coordinated request
router.get(['/', '/bootstrap', '/auth/bootstrap'], requireAuth, async (req: Request, res: Response) => {
  try {
    const user = req.user!;
    let activeTenant = req.activeTenant;
    const allMemberships = await usersRepository.getUserMemberships(user.id);

    // Deterministic resolution fallback if activeTenant is missing
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
        activeTenant = resolveDeterministicTenant(allMemberships as any, req.session?.tenantId);
        if (activeTenant && req.session?.id) {
          await persistActiveTenantToSession(req.session.id, activeTenant.tenantType, activeTenant.tenantId);
          req.session.tenantType = activeTenant.tenantType;
          req.session.tenantId = activeTenant.tenantId;
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
    let completeness: CompletenessResult | null = null;

    if ((activeTenant.tenantType as string) === 'platform' || activeTenant.tenantId === 'platform') {
      profile = {
        id: 'platform',
        legalName: 'BidReady360 Platform Administration',
        name: 'Platform Administration',
        role: 'Super Admin',
      };
    } else if (activeTenant.tenantType === 'supplier') {
      // Parallel coordinated fetch of all domain datasets with pure read-only snapshot
      const [profData, docsData, appsData, peopleData, consentData] = await Promise.all([
        suppliersRepository.getById(activeTenant.tenantId).catch(() => null),
        documentsRepository.listBySupplier(activeTenant.tenantId).catch(() => []),
        applicationsRepository.listBySupplier(activeTenant.tenantId).catch(() => []),
        suppliersRepository.listPeople(activeTenant.tenantId).catch(() => []),
        consentRepository.listBySupplier(activeTenant.tenantId).catch(() => []),
      ]);

      profile = profData;
      docs = docsData || [];
      apps = appsData || [];
      people = peopleData || [];
      consent = consentData || [];

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
            companyType: r.company_type || '',
            yearEstablished: r.year_established,
            description: r.description || '',
            physicalAddress: r.physical_address || '',
            city: r.city || '',
            districtId: r.district_id,
            primaryPhone: r.primary_phone || '',
            email: r.email || '',
            website: r.website || '',
            bankName: r.bank_name || '',
            bankBranch: r.bank_branch || '',
            accountNumberMasked: r.account_number_masked || '',
            citizenOwnedPercentage: r.citizen_owned_percentage,
            youthOwned: r.youth_owned || false,
            womenOwned: r.women_owned || false,
            disabilityOwned: r.disability_owned || false,
            eddCertified: r.edd_certified || false,
            hasTradingLicence: r.has_trading_licence,
            tradingLicenceReason: r.trading_licence_reason,
            profileCompleteness: r.profile_completeness || 0,
            status: r.status,
            verificationStatus: r.verification_status,
          };
        }
      }

      // Compute pure completeness from current rows without database mutation
      if (profile) {
        completeness = computeSupplierCompleteness(profile, people, docs);
        profile.profileCompleteness = completeness.score;
        profile.complianceStatus = completeness.complianceStatus;
        profile.missingItems = completeness.missingItems.map((m) => m.label);
      }
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

    // Server truth fingerprint computed over the rows just read
    const fingerprintRaw = [
      activeTenant.tenantId,
      profile?.updated_at || profile?.updatedAt || profile?.created_at || '',
      completeness?.score ?? profile?.profileCompleteness ?? 0,
      people.length,
      docs.length,
      apps.length,
    ].join('|');
    const serverFingerprint = crypto.createHash('sha256').update(fingerprintRaw).digest('hex');

    res.json({
      activeTenant,
      memberships: allMemberships,
      resolvedSupplierId: activeTenant.tenantId,
      serverFingerprint,
      completeness: completeness || null,
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
