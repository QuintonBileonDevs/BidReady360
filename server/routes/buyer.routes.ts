import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, requireTenantType, requirePermission } from '../middleware/auth.middleware';
import { getOrganizationContext } from '../middleware/tenant.helper';
import { callsRepository } from '../repositories/calls.repository';
import { applicationsRepository } from '../repositories/applications.repository';
import { bidsRepository } from '../repositories/bids.repository';
import { evaluationsRepository } from '../repositories/evaluations.repository';
import { awardsRepository } from '../repositories/awards.repository';
import { documentsRepository } from '../repositories/documents.repository';
import { consentRepository } from '../repositories/consent.repository';
import { workspaceRepository } from '../repositories/workspace.repository';
import { translateDbError } from '../db/errors';
import { extractClientIp } from '../utils/ip';

import { query } from '../db/client';

const router = Router();
router.use(requireAuth);
router.use(requireTenantType('organization'));

async function requireActiveOrganization(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (req.user?.isPlatformAdmin) {
    return next();
  }
  try {
    const ctx = getOrganizationContext(req);
    const orgRes = await query<{ status: string; verification_status: string; rejection_reason: string | null }>(
      `SELECT status, verification_status, rejection_reason
       FROM organizations
       WHERE id = $1 AND deleted_at IS NULL
       LIMIT 1`,
      [ctx.tenantId]
    );
    const org = orgRes.rows[0];
    if (!org) {
      res.status(403).json({
        error: 'ORGANIZATION_NOT_FOUND',
        code: 'ORGANIZATION_NOT_FOUND',
        message: 'Your procuring organization record could not be found or is no longer active.',
      });
      return;
    }

    const status = String(org.status || '').toLowerCase();
    const verStatus = String(org.verification_status || '').toLowerCase();

    if (status === 'pending' || verStatus === 'pending_review' || verStatus === 'pending') {
      res.status(403).json({
        error: 'ORGANIZATION_PENDING_APPROVAL',
        code: 'ORGANIZATION_PENDING_APPROVAL',
        message: 'Your organization is awaiting administrator approval before you can publish or manage calls.',
      });
      return;
    }

    if (status !== 'active' || verStatus === 'rejected') {
      const code = verStatus === 'rejected' ? 'ORGANIZATION_REJECTED' : 'ORGANIZATION_SUSPENDED';
      res.status(403).json({
        error: code,
        code,
        message: org.rejection_reason
          ? `Your procuring organization is currently ${status} (${org.rejection_reason}). Contact BidReady360 administration.`
          : `Your procuring organization is currently ${status} and cannot access procurement operations.`,
      });
      return;
    }

    next();
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
}

router.use(requireActiveOrganization);

// GET /api/buyer/calls
router.get('/calls', requirePermission('calls.create'), async (req: Request, res: Response) => {
  try {
    const ctx = getOrganizationContext(req);
    const calls = await callsRepository.listByOrganization(ctx.tenantId);
    res.json(calls);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/buyer/calls/create
router.post('/calls/create', requirePermission('calls.create'), async (req: Request, res: Response) => {
  try {
    const ctx = getOrganizationContext(req);
    const callId = await callsRepository.createCall({
      ...req.body,
      organizationId: ctx.tenantId,
      userId: ctx.userId,
    });
    res.status(201).json({ callId, message: 'Tender call saved successfully.' });
  } catch (err: any) {
    if (err?.status === 403) {
      res.status(403).json({
        error: err.code || 'FORBIDDEN',
        code: err.code || 'FORBIDDEN',
        message: err.message,
      });
      return;
    }
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

// PATCH /api/buyer/calls/:id
router.patch('/calls/:id', requirePermission('calls.manage'), async (req: Request, res: Response) => {
  try {
    const ctx = getOrganizationContext(req);
    await callsRepository.updateCall(req.params.id, ctx.tenantId, ctx.userId, req.body);
    res.json({ success: true, message: 'Tender call updated.' });
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

// POST /api/buyer/calls/:id/addenda
router.post('/calls/:id/addenda', requirePermission('calls.manage'), async (req: Request, res: Response) => {
  try {
    const ctx = getOrganizationContext(req);
    const addendum = await callsRepository.createAddendum(
      req.params.id,
      ctx.tenantId,
      ctx.userId,
      req.body,
      {
        actorName: req.user!.fullName,
        actorRole: ctx.roleName,
        ipAddress: extractClientIp(req),
      }
    );
    res.status(201).json(addendum);
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

// GET /api/buyer/calls/:id/invitations
router.get('/calls/:id/invitations', requirePermission('calls.manage'), async (req: Request, res: Response) => {
  try {
    const ctx = getOrganizationContext(req);
    const list = await callsRepository.listInvitations(req.params.id, ctx.tenantId);
    res.json(list);
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

// POST /api/buyer/calls/:id/invitations
router.post('/calls/:id/invitations', requirePermission('calls.manage'), async (req: Request, res: Response) => {
  try {
    const ctx = getOrganizationContext(req);
    const { supplierIds } = req.body || {};
    const result = await callsRepository.inviteSuppliers({
      callId: req.params.id,
      orgId: ctx.tenantId,
      userId: ctx.userId,
      actorName: req.user!.fullName,
      actorRole: ctx.roleName,
      supplierIds: Array.isArray(supplierIds) ? supplierIds : [],
      ipAddress: extractClientIp(req),
    });
    res.status(201).json(result);
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

// GET /api/buyer/members - Active organization officers (for witness quorum, review rosters)
router.get('/members', async (req: Request, res: Response) => {
  try {
    const ctx = getOrganizationContext(req);
    const hasColRes = await query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = 'organization_members' AND column_name = 'approval_limit_bwp'
       ) AS exists`
    ).catch(() => ({ rows: [{ exists: false }] }));
    const limitExpr = hasColRes.rows[0]?.exists
      ? 'COALESCE(om.approval_limit_bwp, r.approval_limit_bwp)'
      : 'r.approval_limit_bwp';

    const memRes = await query(
      `SELECT om.user_id AS "userId",
              u.full_name AS "fullName",
              u.email::text AS email,
              r.name AS "roleName",
              ${limitExpr} AS "approvalLimitBwp",
              om.is_owner AS "isOwner"
       FROM organization_members om
       JOIN users u ON u.id = om.user_id AND u.deleted_at IS NULL
       JOIN roles r ON r.id = om.role_id
       WHERE om.organization_id = $1 AND om.status = 'active'
       ORDER BY om.is_owner DESC, u.full_name ASC`,
      [ctx.tenantId]
    );
    res.json(memRes.rows);
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

// GET /api/buyer/suppliers - Consented, approved, and applicant suppliers with strict consent-scope redaction
router.get('/suppliers', requirePermission('suppliers.view'), async (req: Request, res: Response) => {
  try {
    const ctx = getOrganizationContext(req);
    const supRes = await query<any>(
      `SELECT s.id,
              s.legal_name AS "legalName",
              s.trading_name AS "tradingName",
              s.cipa_uin AS "cipaNumber",
              s.burs_tin AS "tinNumber",
              s.city,
              s.physical_address AS "physicalAddress",
              s.email,
              s.primary_phone AS "primaryPhone",
              s.bank_name AS "bankName",
              s.bank_branch AS "bankBranch",
              s.compliance_status AS "complianceStatus",
              s.verification_status AS "verificationStatus",
              s.profile_completeness AS "profileCompleteness",
              s.citizen_owned_percentage AS "citizenOwnedPercentage",
              s.youth_owned AS "youthOwned",
              s.women_owned AS "womenOwned",
              s.edd_certified AS "eddCertified",
              cg.status AS "rawGrantStatus",
              cg.expires_at AS "grantExpiresAt",
              cg.share_company_details AS "shareCompanyDetails",
              cg.share_directors_owners AS "shareDirectorsOwners",
              cg.share_tax_compliance AS "shareTaxCompliance",
              cg.share_financial_statements AS "shareFinancialStatements",
              cg.share_banking_details AS "shareBankingDetails",
              EXISTS (
                SELECT 1 FROM approved_suppliers ap
                WHERE ap.supplier_id = s.id AND ap.organization_id = $1 AND ap.status = 'active'
              ) AS "isApprovedRoster",
              EXISTS (
                SELECT 1 FROM applications a
                WHERE a.supplier_id = s.id AND a.organization_id = $1 AND a.status <> 'Draft'
              ) AS "hasSubmittedApplication",
              COALESCE(
                (SELECT array_agg(DISTINCT cat.name)
                 FROM supplier_categories sc
                 JOIN categories cat ON cat.id = sc.category_id
                 WHERE sc.supplier_id = s.id),
                '{}'::text[]
              ) AS categories
       FROM suppliers s
       LEFT JOIN LATERAL (
         SELECT * FROM consent_grants cg2
         WHERE cg2.supplier_id = s.id AND cg2.organization_id = $1
         ORDER BY cg2.granted_at DESC
         LIMIT 1
       ) cg ON TRUE
       WHERE s.deleted_at IS NULL
         AND (
           s.status = 'active'
           OR EXISTS (SELECT 1 FROM applications a WHERE a.supplier_id = s.id AND a.organization_id = $1 AND a.status <> 'Draft')
         )
       ORDER BY s.legal_name ASC`,
      [ctx.tenantId]
    );

    const now = Date.now();
    const formatted = supRes.rows.map((r: any) => {
      const isExpired = r.rawGrantStatus === 'active' && r.grantExpiresAt && new Date(r.grantExpiresAt).getTime() <= now;
      const consentStatus: 'active' | 'revoked' | 'expired' | 'none' = !r.rawGrantStatus
        ? 'none'
        : isExpired
        ? 'expired'
        : r.rawGrantStatus === 'revoked'
        ? 'revoked'
        : r.rawGrantStatus === 'active'
        ? 'active'
        : 'none';

      const hasActiveConsent = consentStatus === 'active';
      const allowCompany = hasActiveConsent && Boolean(r.shareCompanyDetails);
      const allowTax = hasActiveConsent && Boolean(r.shareTaxCompliance);
      const allowBanking = hasActiveConsent && Boolean(r.shareBankingDetails);

      return {
        id: r.id,
        legalName: r.legalName,
        tradingName: r.tradingName,
        cipaNumber: allowCompany ? r.cipaNumber : null,
        tinNumber: allowTax ? r.tinNumber : null,
        city: r.city,
        physicalAddress: allowCompany ? r.physicalAddress : null,
        email: allowCompany ? r.email : null,
        primaryPhone: allowCompany ? r.primaryPhone : null,
        bankName: allowBanking ? r.bankName : null,
        bankBranch: allowBanking ? r.bankBranch : null,
        complianceStatus: r.complianceStatus,
        verificationStatus: r.verificationStatus,
        profileCompleteness: Number(r.profileCompleteness || 0),
        citizenOwnedPercentage: r.citizenOwnedPercentage,
        youthOwned: Boolean(r.youthOwned),
        womenOwned: Boolean(r.womenOwned),
        eddCertified: Boolean(r.eddCertified),
        categories: Array.isArray(r.categories) ? r.categories : [],
        consentStatus,
        hasActiveConsent,
        isApprovedRoster: Boolean(r.isApprovedRoster),
        hasSubmittedApplication: Boolean(r.hasSubmittedApplication),
        accessScopes: hasActiveConsent
          ? {
              companyDetails: Boolean(r.shareCompanyDetails),
              directorsOwners: Boolean(r.shareDirectorsOwners),
              taxCompliance: Boolean(r.shareTaxCompliance),
              financialStatements: Boolean(r.shareFinancialStatements),
              bankingDetails: Boolean(r.shareBankingDetails),
            }
          : null,
      };
    });

    res.json(formatted);
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

// GET /api/buyer/suppliers/:id - Consent-scoped detailed supplier profile view + immutable access log
router.get('/suppliers/:id', requirePermission('suppliers.view'), async (req: Request, res: Response) => {
  try {
    const ctx = getOrganizationContext(req);
    const supplierId = req.params.id;
    const supRes = await query<any>(
      `SELECT s.id, s.legal_name AS "legalName", s.trading_name AS "tradingName",
              s.cipa_uin AS "cipaNumber", s.burs_tin AS "tinNumber", s.ppra_registration_no AS "ppraCode",
              s.city, s.district, s.physical_address AS "physicalAddress", s.email, s.primary_phone AS "primaryPhone",
              s.website, s.bank_name AS "bankName", s.bank_branch AS "bankBranch",
              s.compliance_status AS "complianceStatus", s.verification_status AS "verificationStatus",
              s.profile_completeness AS "profileCompleteness", s.citizen_owned_percentage AS "citizenOwnedPercentage",
              s.youth_owned AS "youthOwned", s.women_owned AS "womenOwned", s.edd_certified AS "eddCertified",
              cg.id AS "consentGrantId", cg.status AS "rawGrantStatus", cg.expires_at AS "grantExpiresAt",
              cg.share_company_details AS "shareCompanyDetails", cg.share_directors_owners AS "shareDirectorsOwners",
              cg.share_past_projects AS "sharePastProjects", cg.share_tax_compliance AS "shareTaxCompliance",
              cg.share_financial_statements AS "shareFinancialStatements", cg.share_banking_details AS "shareBankingDetails"
       FROM suppliers s
       LEFT JOIN LATERAL (
         SELECT * FROM consent_grants cg2
         WHERE cg2.supplier_id = s.id AND cg2.organization_id = $1
         ORDER BY cg2.granted_at DESC
         LIMIT 1
       ) cg ON TRUE
       WHERE s.id = $2 AND s.deleted_at IS NULL
       LIMIT 1`,
      [ctx.tenantId, supplierId]
    );
    if (!supRes.rows.length) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Supplier not found.' });
    }

    const r = supRes.rows[0];
    const isExpired = r.rawGrantStatus === 'active' && r.grantExpiresAt && new Date(r.grantExpiresAt).getTime() <= Date.now();
    const consentStatus: 'active' | 'revoked' | 'expired' | 'none' = !r.rawGrantStatus
      ? 'none'
      : isExpired
      ? 'expired'
      : r.rawGrantStatus === 'revoked'
      ? 'revoked'
      : r.rawGrantStatus === 'active'
      ? 'active'
      : 'none';
    const hasActiveConsent = consentStatus === 'active';

    const allowCompany = hasActiveConsent && Boolean(r.shareCompanyDetails);
    const allowDirectors = hasActiveConsent && Boolean(r.shareDirectorsOwners);
    const allowProjects = hasActiveConsent && Boolean(r.sharePastProjects);
    const allowTax = hasActiveConsent && Boolean(r.shareTaxCompliance);
    const allowBanking = hasActiveConsent && Boolean(r.shareBankingDetails);

    const [directorsRes, projectsRes, docsRes] = await Promise.all([
      allowDirectors
        ? query<any>(
            `SELECT id, full_name AS "fullName", person_role AS role, nationality, is_citizen AS "isCitizen", ownership_percent AS "ownershipPercent"
             FROM supplier_people WHERE supplier_id = $1 ORDER BY ownership_percent DESC NULLS LAST`,
            [supplierId]
          )
        : Promise.resolve({ rows: [] }),
      allowProjects
        ? query<any>(
            `SELECT id, client_name AS "clientName", project_title AS title, contract_value_bwp AS "valueBWP", completion_year AS "completionYear"
             FROM supplier_projects WHERE supplier_id = $1 ORDER BY completion_year DESC NULLS LAST`,
            [supplierId]
          )
        : Promise.resolve({ rows: [] }),
      hasActiveConsent
        ? query<any>(
            `SELECT sd.id, sd.current_version_id AS "versionId", dt.name AS "documentType",
                    sdv.verification_status AS "verificationStatus", sdv.expiry_date AS "expiryDate"
             FROM supplier_documents sd
             JOIN document_types dt ON dt.id = sd.document_type_id
             LEFT JOIN supplier_document_versions sdv ON sdv.id = sd.current_version_id
             WHERE sd.supplier_id = $1 AND sd.status != 'deleted'
               AND (
                 NOT EXISTS (SELECT 1 FROM consent_grant_documents cgd WHERE cgd.consent_grant_id = $2)
                 OR EXISTS (SELECT 1 FROM consent_grant_documents cgd WHERE cgd.consent_grant_id = $2 AND cgd.document_id = sd.id)
               )
             ORDER BY dt.sort_order ASC`,
            [supplierId, r.consentGrantId]
          )
        : Promise.resolve({ rows: [] }),
    ]);

    const accessedScopes: string[] = ['supplier_profile'];
    if (allowCompany) accessedScopes.push('company_details');
    if (allowDirectors) accessedScopes.push('directors_owners');
    if (allowProjects) accessedScopes.push('past_projects');
    if (allowTax) accessedScopes.push('tax_compliance');
    if (allowBanking) accessedScopes.push('banking_details');

    await consentRepository
      .logDataAccess({
        organizationId: ctx.tenantId,
        supplierId,
        consentGrantId: hasActiveConsent ? r.consentGrantId : null,
        accessedByUserId: ctx.userId,
        accessedDataScope: accessedScopes,
        ipAddress: extractClientIp(req),
        userAgent: req.get('user-agent') || null,
      })
      .catch(() => {});

    res.json({
      id: r.id,
      legalName: r.legalName,
      tradingName: r.tradingName,
      city: r.city,
      district: r.district,
      complianceStatus: r.complianceStatus,
      verificationStatus: r.verificationStatus,
      profileCompleteness: Number(r.profileCompleteness || 0),
      consentStatus,
      hasActiveConsent,
      cipaNumber: allowCompany ? r.cipaNumber : null,
      ppraCode: allowCompany ? r.ppraCode : null,
      physicalAddress: allowCompany ? r.physicalAddress : null,
      email: allowCompany ? r.email : null,
      primaryPhone: allowCompany ? r.primaryPhone : null,
      website: allowCompany ? r.website : null,
      tinNumber: allowTax ? r.tinNumber : null,
      bankName: allowBanking ? r.bankName : null,
      bankBranch: allowBanking ? r.bankBranch : null,
      directors: directorsRes.rows,
      projects: projectsRes.rows,
      sharedDocuments: docsRes.rows,
    });
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

// GET /api/buyer/applications
router.get('/applications', requirePermission('applications.view'), async (req: Request, res: Response) => {
  try {
    const ctx = getOrganizationContext(req);
    const apps = await applicationsRepository.listByOrganization(ctx.tenantId);
    res.json(apps);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/buyer/applications/:id/review
router.post('/applications/:id/review', requirePermission('applications.review'), async (req: Request, res: Response) => {
  try {
    const ctx = getOrganizationContext(req);
    const { decision, comment } = req.body;
    const ip = extractClientIp(req);

    await applicationsRepository.recordReviewDecision({
      applicationId: req.params.id,
      orgId: ctx.tenantId,
      userId: ctx.userId,
      reviewerName: req.user!.fullName,
      reviewerRole: ctx.roleName,
      decision,
      comment,
      ipAddress: ip,
    });

    res.json({ success: true, message: `Review decision (${decision}) recorded.` });
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

// GET /api/buyer/clarifications
router.get('/clarifications', requirePermission('calls.manage'), async (req: Request, res: Response) => {
  try {
    const ctx = getOrganizationContext(req);
    const list = await callsRepository.listClarificationsByOrganization(ctx.tenantId);
    res.json(list);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/buyer/clarifications/:id/answer
router.post('/clarifications/:id/answer', requirePermission('calls.manage'), async (req: Request, res: Response) => {
  try {
    const ctx = getOrganizationContext(req);
    const { answer, responderTitle } = req.body;

    if (!answer || !String(answer).trim()) {
      res.status(400).json({ error: 'MISSING_ANSWER', message: 'Clarification answer cannot be empty.' });
      return;
    }

    await callsRepository.answerClarification(
      req.params.id,
      answer,
      responderTitle || `${req.user!.fullName} (${ctx.roleName})`,
      ctx.userId,
      ctx.tenantId,
      {
        actorName: req.user!.fullName,
        actorRole: ctx.roleName,
        ipAddress: extractClientIp(req),
      }
    );

    res.json({ success: true, message: 'Official clarification answer published.' });
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

// GET /api/buyer/bids/:callId/session
router.get('/bids/:callId/session', requirePermission('bids.view'), async (req: Request, res: Response) => {
  try {
    const ctx = getOrganizationContext(req);
    const session = await bidsRepository.getOpeningSession(req.params.callId, ctx.tenantId);
    res.json(session);
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

// GET /api/buyer/bids/:callId
router.get('/bids/:callId', requirePermission('bids.view'), async (req: Request, res: Response) => {
  try {
    const ctx = getOrganizationContext(req);
    const bids = await bidsRepository.listByCall(req.params.callId, ctx.tenantId);
    res.json(bids);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/buyer/bids/:callId/open-session
router.post('/bids/:callId/open-session', requirePermission('bids.open'), async (req: Request, res: Response) => {
  try {
    const ctx = getOrganizationContext(req);
    const { witnesses } = req.body || {};
    const ip = extractClientIp(req);

    const result = await bidsRepository.conductOpeningSession({
      callId: req.params.callId,
      orgId: ctx.tenantId,
      userId: ctx.userId,
      actorName: req.user!.fullName,
      actorRole: ctx.roleName,
      witnesses: Array.isArray(witnesses) ? witnesses : [],
      ipAddress: ip,
    });

    res.json(result);
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

// GET /api/buyer/evaluations/:callId
router.get('/evaluations/:callId', requirePermission('applications.view'), async (req: Request, res: Response) => {
  try {
    const ctx = getOrganizationContext(req);
    const callRes = await query(`SELECT id FROM calls WHERE id = $1 AND organization_id = $2`, [req.params.callId, ctx.tenantId]);
    if (!callRes.rows.length) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Tender call not found for your organization.' });
      return;
    }
    const [criteria, scores, assignment] = await Promise.all([
      evaluationsRepository.getCriteria(req.params.callId),
      evaluationsRepository.listScores(req.params.callId),
      evaluationsRepository.getEvaluatorAssignment(req.params.callId, ctx.userId),
    ]);

    res.json({ criteria, scores, assignment });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/buyer/evaluations/:callId/declare-conflict
router.post('/evaluations/:callId/declare-conflict', async (req: Request, res: Response) => {
  try {
    const ctx = getOrganizationContext(req);
    const callCheck = await query(`SELECT id FROM calls WHERE id = $1 AND organization_id = $2`, [req.params.callId, ctx.tenantId]);
    if (!callCheck.rows.length) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Tender call not found for your organization.' });
      return;
    }
    const { hasConflict, details } = req.body;
    await evaluationsRepository.signConflictDeclaration(req.params.callId, ctx.userId, ctx.tenantId, !!hasConflict, details);
    res.json({ success: true, message: 'Independence declaration recorded.' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// POST /api/buyer/evaluations/:callId/score
router.post('/evaluations/:callId/score', requirePermission('evaluation.score'), async (req: Request, res: Response) => {
  try {
    const ctx = getOrganizationContext(req);
    const callCheck = await query(`SELECT id FROM calls WHERE id = $1 AND organization_id = $2`, [req.params.callId, ctx.tenantId]);
    if (!callCheck.rows.length) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Tender call not found for your organization.' });
      return;
    }
    const { criterionId, bidId, score, comment } = req.body;

    await evaluationsRepository.submitScore({
      callId: req.params.callId,
      userId: ctx.userId,
      criterionId,
      bidId,
      score: Number(score),
      comment,
    });

    res.json({ success: true, message: 'Score saved.' });
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

// POST /api/buyer/evaluations/:callId/lock
router.post('/evaluations/:callId/lock', requirePermission('evaluation.score'), async (req: Request, res: Response) => {
  try {
    const ctx = getOrganizationContext(req);
    const callCheck = await query(`SELECT id FROM calls WHERE id = $1 AND organization_id = $2`, [req.params.callId, ctx.tenantId]);
    if (!callCheck.rows.length) {
      res.status(404).json({ error: 'NOT_FOUND', message: 'Tender call not found for your organization.' });
      return;
    }
    const ip = extractClientIp(req);

    await evaluationsRepository.lockScorecard({
      callId: req.params.callId,
      userId: ctx.userId,
      actorName: req.user!.fullName,
      actorRole: ctx.roleName,
      orgId: ctx.tenantId,
      ipAddress: ip,
    });

    res.json({ success: true, message: 'Scorecard locked and finalized.' });
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

// GET /api/buyer/awards
router.get('/awards', requirePermission('reports.view'), async (req: Request, res: Response) => {
  try {
    const ctx = getOrganizationContext(req);
    const awards = await awardsRepository.listAwards(ctx.tenantId);
    res.json(awards);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/buyer/awards/recommend
router.post('/awards/recommend', requirePermission('awards.recommend'), async (req: Request, res: Response) => {
  try {
    const ctx = getOrganizationContext(req);
    const { callId, bidId, supplierId, awardValue, justification } = req.body;
    const ip = extractClientIp(req);

    const awardId = await awardsRepository.recommendAward({
      callId,
      bidId,
      supplierId,
      awardValue: Number(awardValue),
      justification,
      userId: ctx.userId,
      actorName: req.user!.fullName,
      actorRole: ctx.roleName,
      orgId: ctx.tenantId,
      ipAddress: ip,
    });

    res.status(201).json({ awardId, message: 'Award recommendation submitted.' });
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

// POST /api/buyer/awards/:id/approve
router.post('/awards/:id/approve', requirePermission('awards.approve'), async (req: Request, res: Response) => {
  try {
    const ctx = getOrganizationContext(req);
    const { decision, comment } = req.body;
    const ip = extractClientIp(req);

    await awardsRepository.approveAward({
      awardId: req.params.id,
      userId: ctx.userId,
      actorName: req.user!.fullName,
      actorRole: ctx.roleName,
      orgId: ctx.tenantId,
      decision: decision || 'approved',
      comment,
      ipAddress: ip,
    });

    res.json({ success: true, message: `Award decision (${decision}) approved and contract generated.` });
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

// GET /api/buyer/contracts
router.get('/contracts', requirePermission('contracts.manage'), async (req: Request, res: Response) => {
  try {
    const ctx = getOrganizationContext(req);
    const contracts = await awardsRepository.listContracts(ctx.tenantId);
    res.json(contracts);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/buyer/documents/:id/file - Authorized buyer preview of applicant/consented supplier documents
router.get('/documents/:id/file', requirePermission('applications.view'), async (req: Request, res: Response) => {
  try {
    const ctx = getOrganizationContext(req);
    const fileRecord = (await documentsRepository.getFileForBuyer(req.params.id, ctx.tenantId)) as any;
    if (!fileRecord) {
      res.status(404).json({
        error: 'NOT_FOUND',
        message: 'Document file not found or not shared with your organization.',
      });
      return;
    }

    if (fileRecord.supplierId) {
      await consentRepository
        .logDataAccess({
          organizationId: ctx.tenantId,
          supplierId: fileRecord.supplierId,
          accessedByUserId: ctx.userId,
          accessedDataScope: [
            `document:${fileRecord.documentTypeName || fileRecord.fileName || 'vault_file'}`,
          ],
          ipAddress: extractClientIp(req),
          userAgent: req.get('user-agent') || null,
        })
        .catch(() => {});
    }

    const isDownload = req.query.download === '1' || req.query.download === 'true';
    const dispositionType = isDownload ? 'attachment' : 'inline';
    const safeFileName = (fileRecord.fileName || 'document').replace(/[\r\n"\\]/g, '_');

    res.setHeader('Content-Type', fileRecord.mimeType || 'application/octet-stream');
    res.setHeader('Content-Length', String(fileRecord.content.length));
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate');
    res.setHeader('Content-Disposition', `${dispositionType}; filename="${safeFileName}"; filename*=UTF-8''${encodeURIComponent(safeFileName)}`);
    res.send(fileRecord.content);
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

// =========================================================================
// STEP 4: BUYER ADMIN & WORKSPACE CUSTOMIZATION ROUTES
// =========================================================================

// Team, Roles & Invitations
router.get('/team', async (req: Request, res: Response) => {
  try {
    const ctx = getOrganizationContext(req);
    const data = await workspaceRepository.listTeamAndInvitations(ctx.tenantId);
    res.json(data);
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

router.get('/roles', async (req: Request, res: Response) => {
  try {
    const ctx = getOrganizationContext(req);
    const roles = await workspaceRepository.listOrgRoles(ctx.tenantId);
    res.json(roles);
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

router.post('/team/invite', requirePermission('org.members.manage'), async (req: Request, res: Response) => {
  try {
    const ctx = getOrganizationContext(req);
    const created = await workspaceRepository.inviteOrgMember(
      ctx.tenantId,
      {
        userId: ctx.userId,
        fullName: req.user!.fullName,
        roleName: ctx.roleName,
        ipAddress: extractClientIp(req),
      },
      req.body || {}
    );
    res.status(201).json(created);
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

router.patch('/team/members/:id', requirePermission('org.members.manage'), async (req: Request, res: Response) => {
  try {
    const ctx = getOrganizationContext(req);
    await workspaceRepository.updateOrgMember(
      ctx.tenantId,
      req.params.id,
      {
        userId: ctx.userId,
        fullName: req.user!.fullName,
        roleName: ctx.roleName,
        ipAddress: extractClientIp(req),
      },
      req.body || {}
    );
    res.json({ success: true });
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

router.post('/team/members/:id/status', requirePermission('org.members.manage'), async (req: Request, res: Response) => {
  try {
    const ctx = getOrganizationContext(req);
    const nextStatus = req.body?.status === 'suspended' ? 'suspended' : 'active';
    await workspaceRepository.updateOrgMemberStatus(
      ctx.tenantId,
      req.params.id,
      {
        userId: ctx.userId,
        fullName: req.user!.fullName,
        roleName: ctx.roleName,
        ipAddress: extractClientIp(req),
      },
      nextStatus,
      req.body?.reason
    );
    res.json({ success: true });
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

router.delete('/team/members/:id', requirePermission('org.members.manage'), async (req: Request, res: Response) => {
  try {
    const ctx = getOrganizationContext(req);
    await workspaceRepository.removeOrgMember(ctx.tenantId, req.params.id, {
      userId: ctx.userId,
      fullName: req.user!.fullName,
      roleName: ctx.roleName,
      ipAddress: extractClientIp(req),
    });
    res.json({ success: true });
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

router.delete('/team/invitations/:id', requirePermission('org.members.manage'), async (req: Request, res: Response) => {
  try {
    const ctx = getOrganizationContext(req);
    await workspaceRepository.revokeOrgInvitation(ctx.tenantId, req.params.id, {
      userId: ctx.userId,
      fullName: req.user!.fullName,
      roleName: ctx.roleName,
      ipAddress: extractClientIp(req),
    });
    res.json({ success: true });
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

router.post('/team/invitations/:id/resend', requirePermission('org.members.manage'), async (req: Request, res: Response) => {
  try {
    const ctx = getOrganizationContext(req);
    const resent = await workspaceRepository.resendOrgInvitation(ctx.tenantId, req.params.id, {
      userId: ctx.userId,
      fullName: req.user!.fullName,
      roleName: ctx.roleName,
      ipAddress: extractClientIp(req),
    });
    res.json(resent);
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

// Organization Branding
router.get('/branding', async (req: Request, res: Response) => {
  try {
    const ctx = getOrganizationContext(req);
    const branding = await workspaceRepository.getBranding(ctx.tenantId);
    res.json(branding);
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

router.put('/branding', requirePermission('org.manage'), async (req: Request, res: Response) => {
  try {
    const ctx = getOrganizationContext(req);
    const updated = await workspaceRepository.updateBranding(
      ctx.tenantId,
      {
        userId: ctx.userId,
        fullName: req.user!.fullName,
        roleName: ctx.roleName,
        ipAddress: extractClientIp(req),
      },
      req.body || {}
    );
    res.json(updated);
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

// Organization Settings
router.get('/settings', async (req: Request, res: Response) => {
  try {
    const ctx = getOrganizationContext(req);
    const settings = await workspaceRepository.getSettings(ctx.tenantId);
    res.json(settings);
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

router.put('/settings', requirePermission('org.manage'), async (req: Request, res: Response) => {
  try {
    const ctx = getOrganizationContext(req);
    const updated = await workspaceRepository.updateSettings(
      ctx.tenantId,
      {
        userId: ctx.userId,
        fullName: req.user!.fullName,
        roleName: ctx.roleName,
        ipAddress: extractClientIp(req),
      },
      req.body || {}
    );
    res.json(updated);
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

// Form Templates
router.get('/form-templates', async (req: Request, res: Response) => {
  try {
    const ctx = getOrganizationContext(req);
    const list = await workspaceRepository.listFormTemplates(ctx.tenantId);
    res.json(list);
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

router.post('/form-templates', requirePermission('forms.manage'), async (req: Request, res: Response) => {
  try {
    const ctx = getOrganizationContext(req);
    const id = await workspaceRepository.createFormTemplate(
      ctx.tenantId,
      {
        userId: ctx.userId,
        fullName: req.user!.fullName,
        roleName: ctx.roleName,
        ipAddress: extractClientIp(req),
      },
      req.body || {}
    );
    const templates = await workspaceRepository.listFormTemplates(ctx.tenantId);
    res.status(201).json({ id, templates });
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

router.put('/form-templates/:id', requirePermission('forms.manage'), async (req: Request, res: Response) => {
  try {
    const ctx = getOrganizationContext(req);
    await workspaceRepository.updateFormTemplate(
      ctx.tenantId,
      req.params.id,
      {
        userId: ctx.userId,
        fullName: req.user!.fullName,
        roleName: ctx.roleName,
        ipAddress: extractClientIp(req),
      },
      req.body || {}
    );
    const templates = await workspaceRepository.listFormTemplates(ctx.tenantId);
    res.json({ success: true, templates });
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

router.delete('/form-templates/:id', requirePermission('forms.manage'), async (req: Request, res: Response) => {
  try {
    const ctx = getOrganizationContext(req);
    await workspaceRepository.deleteFormTemplate(ctx.tenantId, req.params.id, {
      userId: ctx.userId,
      fullName: req.user!.fullName,
      roleName: ctx.roleName,
      ipAddress: extractClientIp(req),
    });
    res.json({ success: true });
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

// Workflows & Scoring Templates
router.get('/workflows', async (req: Request, res: Response) => {
  try {
    const ctx = getOrganizationContext(req);
    const data = await workspaceRepository.getWorkflowsAndScoring(ctx.tenantId);
    res.json(data);
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

router.post('/workflows/stages', requirePermission('workflows.manage'), async (req: Request, res: Response) => {
  try {
    const ctx = getOrganizationContext(req);
    const id = await workspaceRepository.createWorkflowStage(
      ctx.tenantId,
      {
        userId: ctx.userId,
        fullName: req.user!.fullName,
        roleName: ctx.roleName,
        ipAddress: extractClientIp(req),
      },
      req.body || {}
    );
    const data = await workspaceRepository.getWorkflowsAndScoring(ctx.tenantId);
    res.status(201).json({ id, ...data });
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

router.delete('/workflows/stages/:id', requirePermission('workflows.manage'), async (req: Request, res: Response) => {
  try {
    const ctx = getOrganizationContext(req);
    await workspaceRepository.deleteWorkflowStage(ctx.tenantId, req.params.id, {
      userId: ctx.userId,
      fullName: req.user!.fullName,
      roleName: ctx.roleName,
      ipAddress: extractClientIp(req),
    });
    res.json({ success: true });
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

router.put('/workflows/scoring-templates', requirePermission('workflows.manage'), async (req: Request, res: Response) => {
  try {
    const ctx = getOrganizationContext(req);
    const templates = await workspaceRepository.saveScoringTemplates(
      ctx.tenantId,
      {
        userId: ctx.userId,
        fullName: req.user!.fullName,
        roleName: ctx.roleName,
        ipAddress: extractClientIp(req),
      },
      req.body?.scoringTemplates || []
    );
    res.json({ scoringTemplates: templates });
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

// ERP Integrations (API Clients & Webhooks)
router.get('/integrations', requirePermission('integrations.manage'), async (req: Request, res: Response) => {
  try {
    const ctx = getOrganizationContext(req);
    const data = await workspaceRepository.getIntegrations(ctx.tenantId);
    res.json(data);
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

router.post('/integrations/api-keys', requirePermission('integrations.manage'), async (req: Request, res: Response) => {
  try {
    const ctx = getOrganizationContext(req);
    const created = await workspaceRepository.createApiClient(
      ctx.tenantId,
      {
        userId: ctx.userId,
        fullName: req.user!.fullName,
        roleName: ctx.roleName,
        ipAddress: extractClientIp(req),
      },
      req.body || {}
    );
    res.status(201).json(created);
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

router.delete('/integrations/api-keys/:id', requirePermission('integrations.manage'), async (req: Request, res: Response) => {
  try {
    const ctx = getOrganizationContext(req);
    await workspaceRepository.revokeApiClient(ctx.tenantId, req.params.id, {
      userId: ctx.userId,
      fullName: req.user!.fullName,
      roleName: ctx.roleName,
      ipAddress: extractClientIp(req),
    });
    res.json({ success: true });
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

router.post('/integrations/webhooks', requirePermission('integrations.manage'), async (req: Request, res: Response) => {
  try {
    const ctx = getOrganizationContext(req);
    const saved = await workspaceRepository.saveWebhookEndpoint(
      ctx.tenantId,
      {
        userId: ctx.userId,
        fullName: req.user!.fullName,
        roleName: ctx.roleName,
        ipAddress: extractClientIp(req),
      },
      req.body || {}
    );
    res.status(201).json(saved);
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

router.delete('/integrations/webhooks/:id', requirePermission('integrations.manage'), async (req: Request, res: Response) => {
  try {
    const ctx = getOrganizationContext(req);
    await workspaceRepository.deleteWebhookEndpoint(ctx.tenantId, req.params.id, {
      userId: ctx.userId,
      fullName: req.user!.fullName,
      roleName: ctx.roleName,
      ipAddress: extractClientIp(req),
    });
    res.json({ success: true });
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

// Organization Billing & Usage Allowance
router.get('/billing', async (req: Request, res: Response) => {
  try {
    const ctx = getOrganizationContext(req);
    const data = await workspaceRepository.getOrgBilling(ctx.tenantId);
    res.json(data);
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

export const buyerRouter = router;
