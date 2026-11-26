import { Router, Request, Response } from 'express';
import { requireAuth, requirePlatformAdmin } from '../middleware/auth.middleware';
import { query } from '../db/client';
import { getIdKey } from '../config/secrets';
import { auditRepository } from '../repositories/audit.repository';
import { referenceRepository } from '../repositories/reference.repository';
import { suppliersRepository } from '../repositories/suppliers.repository';
import { documentsRepository } from '../repositories/documents.repository';
import { notificationsRepository } from '../repositories/notifications.repository';
import { translateDbError } from '../db/errors';
import { validateOmang } from '../../shared/omang';

const router = Router();

// Strict server-side authentication and platform super-admin authorization on every route
router.use(requireAuth, requirePlatformAdmin);

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function getActorInfo(req: Request) {
  return {
    actorUserId: req.user?.id || null,
    actorName: req.user?.fullName || req.user?.email || 'Platform Admin',
    actorRole: 'Super Admin',
    ipAddress: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || null,
    userAgent: (req.headers['user-agent'] as string)?.slice(0, 290) || null,
  };
}

async function logAdminAudit(
  req: Request,
  payload: {
    action: string;
    entityType: string;
    entityId?: string | null;
    organizationId?: string | null;
    supplierId?: string | null;
    details: string;
    beforeJson?: any;
    afterJson?: any;
  }
) {
  const actor = getActorInfo(req);
  await auditRepository.logEvent({
    ...actor,
    organizationName: 'BidReady360 Platform Administration',
    action: payload.action,
    entityType: payload.entityType,
    entityId: payload.entityId || null,
    organizationId: payload.organizationId || null,
    supplierId: payload.supplierId || null,
    beforeJson: payload.beforeJson,
    afterJson: payload.afterJson,
    details: payload.details,
  });
}

async function hasPeopleGenderColumn(): Promise<boolean> {
  const res = await query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM information_schema.columns
       WHERE table_schema = 'public'
         AND table_name = 'supplier_people'
         AND column_name = 'gender'
     ) AS exists`
  );
  return Boolean(res.rows[0]?.exists);
}

// =========================================================================
// 1. DASHBOARD OVERVIEW & KPIs
// =========================================================================
router.get('/overview', async (_req: Request, res: Response) => {
  try {
    const [
      countsRes,
      pendingOrgsRes,
      openFlagsRes,
      recentAuditRes,
      growthRes,
      revenueRes,
    ] = await Promise.all([
      query<any>(`
        SELECT
          (SELECT COUNT(*)::int FROM organizations WHERE deleted_at IS NULL AND (status = 'pending' OR verification_status = 'pending_review')) AS "pendingOrgsCount",
          (SELECT COUNT(*)::int FROM organizations WHERE deleted_at IS NULL AND status = 'active') AS "activeOrgsCount",
          (SELECT COUNT(*)::int FROM organizations WHERE deleted_at IS NULL AND status = 'suspended') AS "suspendedOrgsCount",
          (SELECT COUNT(*)::int FROM suppliers WHERE deleted_at IS NULL) AS "totalSuppliersCount",
          (SELECT COUNT(*)::int FROM suppliers WHERE deleted_at IS NULL AND verification_status IN ('unverified', 'pending')) AS "pendingSuppliersCount",
          (SELECT COUNT(*)::int FROM suppliers WHERE deleted_at IS NULL AND verification_status = 'verified') AS "verifiedSuppliersCount",
          (SELECT COUNT(*)::int FROM suppliers WHERE deleted_at IS NULL AND compliance_status = 'Fully compliant') AS "compliantSuppliersCount",
          (SELECT COUNT(*)::int FROM supplier_people WHERE is_active = TRUE AND kyc_status IN ('not_started', 'pending')) AS "pendingPeopleCount",
          (SELECT COUNT(*)::int
             FROM supplier_documents d
             JOIN supplier_document_versions v ON v.id = d.current_version_id
            WHERE d.status = 'active' AND UPPER(v.verification_status) = 'PENDING_VERIFICATION') AS "pendingDocumentsCount",
          (SELECT COUNT(*)::int FROM calls WHERE status IN ('published', 'open', 'evaluating')) AS "activeCallsCount",
          (SELECT COUNT(*)::int FROM bids WHERE status IN ('submitted', 'opened')) AS "totalBidsCount",
          (SELECT COUNT(*)::int FROM users WHERE deleted_at IS NULL) AS "totalUsersCount",
          (SELECT COUNT(*)::int FROM users WHERE deleted_at IS NULL AND locked_until IS NOT NULL AND locked_until > NOW()) AS "lockedUsersCount",
          (SELECT COUNT(*)::int FROM risk_flags WHERE status IN ('open', 'reviewed')) AS "openRiskFlagsCount",
          (SELECT COUNT(*)::int FROM debarments WHERE lifted_at IS NULL AND starts_on <= CURRENT_DATE AND (ends_on IS NULL OR ends_on >= CURRENT_DATE)) AS "activeDebarmentsCount",
          (SELECT COUNT(*)::int FROM message_deliveries WHERE status = 'failed') AS "failedDeliveriesCount",
          (SELECT COUNT(*)::int FROM platform_invoices WHERE status = 'overdue') AS "overdueInvoicesCount",
          (SELECT COALESCE(SUM(p.price), 0)::numeric FROM subscriptions sub JOIN plans p ON p.id = sub.plan_id WHERE sub.status = 'active') AS "monthlyMrrBwp"
      `),
      query<any>(`
        SELECT o.id, o.name, o.organization_type AS "type", o.registration_number AS "gazetteRef",
               o.contact_email AS "email", o.status, o.verification_status AS "verificationStatus",
               o.created_at AS "createdAt"
        FROM organizations o
        WHERE o.deleted_at IS NULL AND (o.status = 'pending' OR o.verification_status = 'pending_review')
        ORDER BY o.created_at DESC
        LIMIT 5
      `),
      query<any>(`
        SELECT rf.id, rf.flag_type AS "flagType", rf.severity, rf.status, rf.details,
               rf.created_at AS "createdAt", s.legal_name AS "supplierName"
        FROM risk_flags rf
        JOIN suppliers s ON s.id = rf.supplier_id
        WHERE rf.status IN ('open', 'reviewed')
        ORDER BY CASE rf.severity WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END, rf.created_at DESC
        LIMIT 5
      `),
      auditRepository.listEvents({ limit: 8 }),
      query<any>(`
        SELECT
          TO_CHAR(m.month_start, 'Mon') AS month,
          (SELECT COUNT(*)::int FROM suppliers s WHERE s.deleted_at IS NULL AND s.created_at <= m.month_start + INTERVAL '1 month') AS suppliers,
          (SELECT COUNT(*)::int FROM organizations o WHERE o.deleted_at IS NULL AND o.created_at <= m.month_start + INTERVAL '1 month') AS organizations
        FROM generate_series(
          DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '5 months',
          DATE_TRUNC('month', CURRENT_DATE),
          INTERVAL '1 month'
        ) AS m(month_start)
        ORDER BY m.month_start ASC
      `),
      query<any>(`
        SELECT
          TO_CHAR(m.month_start, 'Mon') AS month,
          COALESCE(SUM(CASE WHEN pi.status = 'paid' THEN pi.total ELSE 0 END), 0)::numeric AS paid,
          COALESCE(SUM(CASE WHEN pi.status IN ('issued', 'overdue') THEN pi.total ELSE 0 END), 0)::numeric AS outstanding,
          COALESCE(SUM(pi.total), 0)::numeric AS total
        FROM generate_series(
          DATE_TRUNC('month', CURRENT_DATE) - INTERVAL '5 months',
          DATE_TRUNC('month', CURRENT_DATE),
          INTERVAL '1 month'
        ) AS m(month_start)
        LEFT JOIN platform_invoices pi
          ON DATE_TRUNC('month', COALESCE(pi.issued_at, pi.created_at)) = m.month_start
        GROUP BY m.month_start
        ORDER BY m.month_start ASC
      `),
    ]);

    const c = countsRes.rows[0] || {};
    const totalSuppliers = Number(c.totalSuppliersCount) || 0;
    const compliantSuppliers = Number(c.compliantSuppliersCount) || 0;
    const complianceRatePercent = totalSuppliers > 0 ? Math.round((compliantSuppliers / totalSuppliers) * 1000) / 10 : 0;
    const verificationQueueCount = (Number(c.pendingPeopleCount) || 0) + (Number(c.pendingDocumentsCount) || 0);

    res.json({
      kpis: {
        pendingOrgsCount: Number(c.pendingOrgsCount) || 0,
        activeOrgsCount: Number(c.activeOrgsCount) || 0,
        suspendedOrgsCount: Number(c.suspendedOrgsCount) || 0,
        totalSuppliersCount: totalSuppliers,
        pendingSuppliersCount: Number(c.pendingSuppliersCount) || 0,
        verifiedSuppliersCount: Number(c.verifiedSuppliersCount) || 0,
        pendingPeopleCount: Number(c.pendingPeopleCount) || 0,
        pendingDocumentsCount: Number(c.pendingDocumentsCount) || 0,
        verificationQueueCount,
        activeCallsCount: Number(c.activeCallsCount) || 0,
        totalBidsCount: Number(c.totalBidsCount) || 0,
        totalUsersCount: Number(c.totalUsersCount) || 0,
        lockedUsersCount: Number(c.lockedUsersCount) || 0,
        openRiskFlagsCount: Number(c.openRiskFlagsCount) || 0,
        activeDebarmentsCount: Number(c.activeDebarmentsCount) || 0,
        failedDeliveriesCount: Number(c.failedDeliveriesCount) || 0,
        overdueInvoicesCount: Number(c.overdueInvoicesCount) || 0,
        monthlyMrrBwp: Number(c.monthlyMrrBwp) || 0,
        complianceRatePercent,
      },
      pendingOrgs: pendingOrgsRes.rows,
      openRiskFlags: openFlagsRes.rows,
      recentAuditEvents: recentAuditRes.map((e) => ({
        ...e,
        timestamp: e.occurredAt
          ? new Date(e.occurredAt).toLocaleString('en-BW', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })
          : '—',
      })),
      monthlyGrowth: growthRes.rows,
      monthlyRevenue: revenueRes.rows.map((r: any) => ({
        month: r.month,
        paid: Number(r.paid) || 0,
        outstanding: Number(r.outstanding) || 0,
        total: Number(r.total) || 0,
      })),
      generatedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

// =========================================================================
// 2. BUYER ORGANIZATION GATEKEEPING
// =========================================================================
router.get('/organizations', async (req: Request, res: Response) => {
  try {
    const statusFilter = String(req.query.status || 'all').toLowerCase();
    const search = String(req.query.search || '').trim();
    const conditions: string[] = ['o.deleted_at IS NULL'];
    const params: any[] = [];

    if (statusFilter === 'pending') {
      conditions.push(`(o.status = 'pending' OR o.verification_status = 'pending_review')`);
    } else if (statusFilter === 'active') {
      conditions.push(`o.status = 'active'`);
    } else if (statusFilter === 'suspended') {
      conditions.push(`o.status IN ('suspended', 'closed')`);
    }

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(o.name ILIKE $${params.length} OR COALESCE(o.registration_number, '') ILIKE $${params.length} OR COALESCE(o.contact_email::text, '') ILIKE $${params.length})`);
    }

    const result = await query(
      `SELECT o.id,
              o.name,
              o.slug,
              o.organization_type AS "organizationType",
              o.registration_number AS "registrationNumber",
              o.status,
              o.verification_status AS "verificationStatus",
              o.contact_email AS "contactEmail",
              o.contact_phone AS "contactPhone",
              o.city,
              o.district,
              o.rejection_reason AS "rejectionReason",
              o.approved_at AS "approvedAt",
              o.created_at AS "createdAt",
              COALESCE(mem.members_count, 0)::int AS "membersCount",
              mem.lead_name AS "contactPerson",
              COALESCE(mem.lead_email, o.contact_email::text) AS "leadEmail",
              COALESCE(sub.plan_name, 'Standard') AS "planName"
       FROM organizations o
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::int AS members_count,
                (SELECT u2.full_name FROM organization_members om2 JOIN users u2 ON u2.id = om2.user_id WHERE om2.organization_id = o.id ORDER BY om2.is_owner DESC, om2.created_at ASC LIMIT 1) AS lead_name,
                (SELECT u2.email::text FROM organization_members om2 JOIN users u2 ON u2.id = om2.user_id WHERE om2.organization_id = o.id ORDER BY om2.is_owner DESC, om2.created_at ASC LIMIT 1) AS lead_email
         FROM organization_members om
         WHERE om.organization_id = o.id AND om.status = 'active'
       ) mem ON TRUE
       LEFT JOIN LATERAL (
         SELECT p.name AS plan_name
         FROM subscriptions s
         JOIN plans p ON p.id = s.plan_id
         WHERE s.organization_id = o.id AND s.status = 'active'
         ORDER BY s.created_at DESC
         LIMIT 1
       ) sub ON TRUE
       WHERE ${conditions.join(' AND ')}
       ORDER BY
         CASE WHEN o.status = 'pending' OR o.verification_status = 'pending_review' THEN 0
              WHEN o.status = 'active' THEN 1
              ELSE 2 END,
         o.created_at DESC`,
      params
    );

    res.json(result.rows);
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

router.post('/organizations/:id/approve', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!UUID_REGEX.test(id)) {
      return res.status(400).json({ error: 'INVALID_ID', message: 'Invalid organization ID.' });
    }

    const beforeRes = await query<{ id: string; name: string; status: string; verification_status: string }>(
      `SELECT id, name, status, verification_status FROM organizations WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    if (!beforeRes.rows.length) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Organization not found.' });
    }
    const before = beforeRes.rows[0];

    const updatedRes = await query(
      `UPDATE organizations
       SET status = 'active',
           verification_status = 'verified',
           approved_by_user_id = $2,
           approved_by = $2,
           approved_at = NOW(),
           rejection_reason = NULL,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, name, status, verification_status AS "verificationStatus", approved_at AS "approvedAt", rejection_reason AS "rejectionReason"`,
      [id, req.user!.id]
    );

    await logAdminAudit(req, {
      action: 'ADMIN_APPROVED_ORGANIZATION',
      entityType: 'organization',
      entityId: id,
      organizationId: id,
      beforeJson: { status: before.status, verificationStatus: before.verification_status },
      afterJson: { status: 'active', verificationStatus: 'verified' },
      details: `Approved procuring organization "${before.name}" for live tender operations.`,
    });

    await notificationsRepository
      .notifyOrganizationMembers(id, {
        eventType: 'organization_approved',
        title: 'Your organization account is approved',
        body: `${before.name} has been verified and approved. Open your workspace to publish tender calls and review supplier submissions.`,
        linkUrl: 'overview',
        priority: 'success',
        data: { organizationId: id, organizationName: before.name },
      })
      .catch((notifErr) => console.warn('[ORG APPROVE NOTIFY WARNING]:', notifErr?.message || notifErr));

    res.json(updatedRes.rows[0]);
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

router.post('/organizations/:id/reject', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!UUID_REGEX.test(id)) {
      return res.status(400).json({ error: 'INVALID_ID', message: 'Invalid organization ID.' });
    }
    const reason = String(req.body?.reason || '').trim().slice(0, 1000);
    if (!reason || reason.length < 5) {
      return res.status(400).json({ error: 'REASON_REQUIRED', message: 'A rejection reason (at least 5 characters) is required.' });
    }

    const beforeRes = await query<{ id: string; name: string; status: string; verification_status: string }>(
      `SELECT id, name, status, verification_status FROM organizations WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    if (!beforeRes.rows.length) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Organization not found.' });
    }
    const before = beforeRes.rows[0];

    const updatedRes = await query(
      `UPDATE organizations
       SET status = 'suspended',
           verification_status = 'rejected',
           rejection_reason = $2,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, name, status, verification_status AS "verificationStatus", rejection_reason AS "rejectionReason"`,
      [id, reason]
    );

    await logAdminAudit(req, {
      action: 'ADMIN_REJECTED_ORGANIZATION',
      entityType: 'organization',
      entityId: id,
      organizationId: id,
      beforeJson: { status: before.status, verificationStatus: before.verification_status },
      afterJson: { status: 'suspended', verificationStatus: 'rejected', rejectionReason: reason },
      details: `Rejected organization registration "${before.name}". Reason: ${reason}`,
    });

    await notificationsRepository
      .notifyOrganizationMembers(id, {
        eventType: 'organization_rejected',
        title: 'Organization verification needs attention',
        body: `${before.name} was not approved. Reason: ${reason}. Review your organization details and contact platform support to resubmit.`,
        linkUrl: 'settings',
        priority: 'urgent',
        data: { organizationId: id, organizationName: before.name, reason },
      })
      .catch((notifErr) => console.warn('[ORG REJECT NOTIFY WARNING]:', notifErr?.message || notifErr));

    res.json(updatedRes.rows[0]);
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

router.post('/organizations/:id/suspend', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!UUID_REGEX.test(id)) {
      return res.status(400).json({ error: 'INVALID_ID', message: 'Invalid organization ID.' });
    }
    const reason = req.body?.reason ? String(req.body.reason).trim().slice(0, 1000) : 'Suspended by platform administrator';

    const beforeRes = await query<{ id: string; name: string; status: string }>(
      `SELECT id, name, status FROM organizations WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    if (!beforeRes.rows.length) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Organization not found.' });
    }
    const before = beforeRes.rows[0];

    const updatedRes = await query(
      `UPDATE organizations
       SET status = 'suspended',
           rejection_reason = $2,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, name, status, verification_status AS "verificationStatus", rejection_reason AS "rejectionReason"`,
      [id, reason]
    );

    await logAdminAudit(req, {
      action: 'ADMIN_SUSPENDED_ORGANIZATION',
      entityType: 'organization',
      entityId: id,
      organizationId: id,
      beforeJson: { status: before.status },
      afterJson: { status: 'suspended', reason },
      details: `Suspended procuring organization "${before.name}". Reason: ${reason}`,
    });

    res.json(updatedRes.rows[0]);
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

// =========================================================================
// 3. SUPPLIER DIRECTORY, COMPLIANCE INSPECTION & VERIFICATION
// =========================================================================
router.get('/suppliers', async (req: Request, res: Response) => {
  try {
    const search = String(req.query.search || '').trim();
    const verificationStatus = String(req.query.verificationStatus || 'all').toLowerCase();
    const conditions: string[] = ['s.deleted_at IS NULL'];
    const params: any[] = [];

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(s.legal_name ILIKE $${params.length} OR s.cipa_uin ILIKE $${params.length} OR COALESCE(s.burs_tin, '') ILIKE $${params.length} OR COALESCE(s.email::text, '') ILIKE $${params.length})`);
    }
    if (verificationStatus !== 'all' && ['unverified', 'pending', 'verified', 'rejected'].includes(verificationStatus)) {
      params.push(verificationStatus);
      conditions.push(`s.verification_status = $${params.length}`);
    }

    const result = await query(
      `SELECT s.id,
              s.legal_name AS "legalName",
              s.trading_name AS "tradingName",
              s.cipa_uin AS "cipaNumber",
              s.burs_tin AS "tinNumber",
              s.ppra_registration_no AS "ppraCode",
              s.company_type AS "companyType",
              s.city,
              gd.name AS "district",
              s.email,
              s.primary_phone AS "primaryPhone",
              COALESCE(s.citizen_owned_percentage, 0)::numeric AS "citizenOwnedPercentage",
              s.status,
              s.verification_status AS "verificationStatus",
              s.compliance_status AS "complianceStatus",
              s.profile_completeness AS "profileCompleteness",
              s.verified_at AS "verifiedAt",
              s.created_at AS "createdAt",
              COALESCE(doc_stats.total_docs, 0)::int AS "totalDocs",
              COALESCE(doc_stats.verified_docs, 0)::int AS "verifiedDocs",
              COALESCE(doc_stats.pending_docs, 0)::int AS "pendingDocs",
              COALESCE(doc_stats.expired_docs, 0)::int AS "expiredDocs",
              COALESCE(ppl.total_people, 0)::int AS "peopleCount",
              COALESCE(ppl.verified_people, 0)::int AS "verifiedPeopleCount",
              COALESCE(deb.active_debarments, 0)::int AS "activeDebarments"
       FROM suppliers s
       LEFT JOIN geographic_districts gd ON gd.id = s.district_id
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::int AS total_docs,
                COUNT(*) FILTER (WHERE UPPER(v.verification_status) = 'VERIFIED')::int AS verified_docs,
                COUNT(*) FILTER (WHERE UPPER(v.verification_status) = 'PENDING_VERIFICATION')::int AS pending_docs,
                COUNT(*) FILTER (WHERE v.expiry_date IS NOT NULL AND v.expiry_date < CURRENT_DATE)::int AS expired_docs
         FROM supplier_documents d
         JOIN supplier_document_versions v ON v.id = d.current_version_id
         WHERE d.supplier_id = s.id AND d.status = 'active'
       ) doc_stats ON TRUE
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::int AS total_people,
                COUNT(*) FILTER (WHERE p.kyc_status = 'verified')::int AS verified_people
         FROM supplier_people p
         WHERE p.supplier_id = s.id AND p.is_active = TRUE
       ) ppl ON TRUE
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::int AS active_debarments
         FROM debarments d
         WHERE d.supplier_id = s.id
           AND d.lifted_at IS NULL
           AND d.starts_on <= CURRENT_DATE
           AND (d.ends_on IS NULL OR d.ends_on >= CURRENT_DATE)
       ) deb ON TRUE
       WHERE ${conditions.join(' AND ')}
       ORDER BY s.created_at DESC`,
      params
    );

    res.json(result.rows.map((r: any) => ({
      ...r,
      citizenOwnedPercentage: Number(r.citizenOwnedPercentage) || 0,
    })));
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

router.get('/suppliers/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!UUID_REGEX.test(id)) {
      return res.status(400).json({ error: 'INVALID_ID', message: 'Invalid supplier ID.' });
    }

    const encryptionKey = getIdKey();
    const hasGender = await hasPeopleGenderColumn();
    const genderSelect = hasGender ? 'p.gender,' : 'NULL::varchar AS gender,';

    const [supRes, peopleRes, docsRes, debRes] = await Promise.all([
      query(
        `SELECT s.id, s.legal_name AS "legalName", s.trading_name AS "tradingName",
                s.cipa_uin AS "cipaNumber", s.burs_tin AS "tinNumber",
                s.ppra_registration_no AS "ppraCode", s.company_type AS "companyType",
                s.physical_address AS "physicalAddress", s.city, gd.name AS "district",
                s.email, s.primary_phone AS "primaryPhone",
                COALESCE(s.citizen_owned_percentage, 0)::numeric AS "citizenOwnedPercentage",
                s.status, s.verification_status AS "verificationStatus",
                s.compliance_status AS "complianceStatus", s.profile_completeness AS "profileCompleteness",
                s.verified_at AS "verifiedAt", s.created_at AS "createdAt"
         FROM suppliers s
         LEFT JOIN geographic_districts gd ON gd.id = s.district_id
         WHERE s.id = $1 AND s.deleted_at IS NULL`,
        [id]
      ),
      query(
        `SELECT p.id, p.full_name AS "fullName", p.person_role AS "personRole",
                p.ownership_percent AS "ownershipPercent", p.identity_type AS "identityType",
                ${genderSelect} p.nationality, p.is_citizen AS "isCitizen",
                p.kyc_status AS "kycStatus", p.kyc_verified_at AS "kycVerifiedAt",
                p.kyc_reference AS "kycReference",
                CASE WHEN p.national_identity_number_encrypted IS NOT NULL
                     THEN pgp_sym_decrypt(p.national_identity_number_encrypted, $2)
                     ELSE NULL END AS "_rawId"
         FROM supplier_people p
         WHERE p.supplier_id = $1 AND p.is_active = TRUE
         ORDER BY p.created_at ASC`,
        [id, encryptionKey]
      ),
      query(
        `SELECT d.id AS "documentId", v.id AS "versionId",
                dt.code AS "documentTypeCode", dt.name AS "documentTypeName",
                d.title, v.version_no AS "versionNo", v.file_name AS "fileName",
                v.mime_type AS "mimeType", v.file_size_bytes AS "fileSizeBytes",
                v.sha256, v.document_number AS "documentNumber",
                v.issue_date AS "issueDate", v.expiry_date AS "expiryDate",
                v.verification_status AS "verificationStatus", v.verified_at AS "verifiedAt",
                v.verification_notes AS "verificationNotes", v.rejection_reason AS "rejectionReason",
                v.uploaded_at AS "uploadedAt",
                EXISTS (
                  SELECT 1 FROM document_files f
                  WHERE f.document_version_id = v.id AND octet_length(f.content) > 0
                ) AS "hasFile"
         FROM supplier_documents d
         JOIN document_types dt ON dt.id = d.document_type_id
         JOIN supplier_document_versions v ON v.id = d.current_version_id
         WHERE d.supplier_id = $1 AND d.status = 'active'
         ORDER BY dt.sort_order ASC, v.uploaded_at DESC`,
        [id]
      ),
      query(
        `SELECT deb.id, deb.reason, deb.starts_on AS "startsOn", deb.ends_on AS "endsOn",
                deb.lifted_at AS "liftedAt", deb.evidence_ref AS "evidenceRef",
                o.name AS "organizationName"
         FROM debarments deb
         LEFT JOIN organizations o ON o.id = deb.organization_id
         WHERE deb.supplier_id = $1
         ORDER BY deb.created_at DESC`,
        [id]
      ),
    ]);

    if (!supRes.rows.length) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Supplier not found.' });
    }

    // Validate Omang server-side via shared/omang.ts and strip raw ID before returning
    const directors = peopleRes.rows.map((p: any) => {
      const rawId: string | null = p._rawId || null;
      const idLast4 = rawId ? rawId.slice(-4) : null;
      const hasId = Boolean(rawId);
      let omangValid: boolean | null = null;
      let omangMessage: string | null = null;
      if ((p.identityType || 'OMANG') === 'OMANG' && rawId) {
        const check = validateOmang(rawId, p.gender || undefined);
        omangValid = check.ok;
        omangMessage = check.ok ? null : check.message;
      }
      const { _rawId, ...safePerson } = p;
      return {
        ...safePerson,
        hasId,
        idLast4,
        omangValid,
        omangMessage,
      };
    });

    res.json({
      supplier: {
        ...supRes.rows[0],
        citizenOwnedPercentage: Number(supRes.rows[0].citizenOwnedPercentage) || 0,
      },
      directors,
      documents: docsRes.rows,
      debarments: debRes.rows,
    });
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

router.post('/suppliers/:id/verification', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!UUID_REGEX.test(id)) {
      return res.status(400).json({ error: 'INVALID_ID', message: 'Invalid supplier ID.' });
    }

    const verificationStatus = String(req.body?.verificationStatus || '').trim().toLowerCase();
    if (!['unverified', 'pending', 'verified', 'rejected'].includes(verificationStatus)) {
      return res.status(400).json({
        error: 'INVALID_STATUS',
        message: 'verificationStatus must be unverified, pending, verified, or rejected.',
      });
    }

    const complianceStatusRaw = req.body?.complianceStatus ? String(req.body.complianceStatus).trim() : null;
    const complianceStatus =
      complianceStatusRaw && ['Fully compliant', 'Action required', 'Non-compliant'].includes(complianceStatusRaw)
        ? complianceStatusRaw
        : verificationStatus === 'verified'
        ? 'Fully compliant'
        : verificationStatus === 'rejected'
        ? 'Non-compliant'
        : 'Action required';

    const statusRaw = req.body?.status ? String(req.body.status).trim().toLowerCase() : null;
    const accountStatus =
      statusRaw && ['draft', 'active', 'suspended', 'closed'].includes(statusRaw) ? statusRaw : null;

    const notes = req.body?.notes ? String(req.body.notes).trim().slice(0, 500) : null;

    const existing = await query<{ id: string; legal_name: string; verification_status: string; compliance_status: string }>(
      `SELECT id, legal_name, verification_status, compliance_status FROM suppliers WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    if (!existing.rows.length) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Supplier not found.' });
    }
    const before = existing.rows[0];

    const updated = await query(
      `UPDATE suppliers
       SET verification_status = $2::varchar,
           compliance_status = $3::varchar,
           status = COALESCE($4::varchar, CASE WHEN $2::varchar = 'verified' THEN 'active' ELSE status END),
           verified_at = CASE WHEN $2::varchar = 'verified' THEN NOW() ELSE NULL END,
           verified_by_user_id = CASE WHEN $2::varchar = 'verified' THEN $5::uuid ELSE NULL END,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, legal_name AS "legalName", status,
                 verification_status AS "verificationStatus",
                 compliance_status AS "complianceStatus",
                 verified_at AS "verifiedAt"`,
      [id, verificationStatus, complianceStatus, accountStatus, req.user!.id]
    );

    await logAdminAudit(req, {
      action: 'ADMIN_UPDATED_SUPPLIER_VERIFICATION',
      entityType: 'supplier',
      entityId: id,
      supplierId: id,
      beforeJson: { verificationStatus: before.verification_status, complianceStatus: before.compliance_status },
      afterJson: { verificationStatus, complianceStatus, notes },
      details: `Updated supplier "${before.legal_name}" verification to ${verificationStatus} (${complianceStatus})${notes ? `. Notes: ${notes}` : ''}`,
    });

    res.json(updated.rows[0]);
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

// =========================================================================
// 4. VERIFICATION QUEUE (DIRECTORS & DOCUMENTS)
// =========================================================================
router.get('/verification/queue', async (_req: Request, res: Response) => {
  try {
    const encryptionKey = getIdKey();
    const hasGender = await hasPeopleGenderColumn();
    const genderSelect = hasGender ? 'p.gender,' : 'NULL::varchar AS gender,';

    const [peopleRes, docsRes] = await Promise.all([
      query(
        `SELECT p.id,
                p.supplier_id AS "supplierId",
                s.legal_name AS "supplierName",
                s.cipa_uin AS "supplierCipa",
                p.full_name AS "fullName",
                p.person_role AS "personRole",
                p.ownership_percent AS "ownershipPercent",
                p.identity_type AS "identityType",
                ${genderSelect}
                p.nationality,
                p.is_citizen AS "isCitizen",
                p.kyc_status AS "kycStatus",
                p.kyc_verified_at AS "kycVerifiedAt",
                p.kyc_reference AS "kycReference",
                p.created_at AS "createdAt",
                p.updated_at AS "updatedAt",
                CASE WHEN p.national_identity_number_encrypted IS NOT NULL
                     THEN pgp_sym_decrypt(p.national_identity_number_encrypted, $1)
                     ELSE NULL END AS "_rawId"
         FROM supplier_people p
         JOIN suppliers s ON s.id = p.supplier_id
         WHERE p.is_active = TRUE
         ORDER BY
           CASE p.kyc_status
             WHEN 'pending' THEN 0
             WHEN 'not_started' THEN 1
             WHEN 'failed' THEN 2
             ELSE 3
           END,
           p.updated_at DESC`,
        [encryptionKey]
      ),
      query(
        `SELECT d.id AS "documentId",
                v.id AS "versionId",
                d.supplier_id AS "supplierId",
                s.legal_name AS "supplierName",
                s.cipa_uin AS "supplierCipa",
                dt.code AS "documentTypeCode",
                dt.name AS "documentTypeName",
                d.title,
                v.version_no AS "versionNo",
                v.file_name AS "fileName",
                v.mime_type AS "mimeType",
                v.file_size_bytes AS "fileSizeBytes",
                v.document_number AS "documentNumber",
                v.issue_date AS "issueDate",
                v.expiry_date AS "expiryDate",
                v.verification_status AS "verificationStatus",
                v.verified_via AS "verifiedVia",
                v.verified_at AS "verifiedAt",
                v.verification_notes AS "verificationNotes",
                v.rejection_reason AS "rejectionReason",
                v.extraction_confidence AS "extractionConfidence",
                v.sha256,
                v.uploaded_at AS "uploadedAt",
                EXISTS (
                  SELECT 1 FROM document_files f
                  WHERE f.document_version_id = v.id AND octet_length(f.content) > 0
                ) AS "hasFile"
         FROM supplier_documents d
         JOIN document_types dt ON dt.id = d.document_type_id
         JOIN supplier_document_versions v ON v.id = d.current_version_id
         JOIN suppliers s ON s.id = d.supplier_id
         WHERE d.status = 'active'
         ORDER BY
           CASE v.verification_status
             WHEN 'PENDING_VERIFICATION' THEN 0
             WHEN 'UNVERIFIABLE' THEN 1
             WHEN 'REJECTED' THEN 2
             ELSE 3
           END,
           v.uploaded_at DESC`
      ),
    ]);

    const docsBySupplier = new Map<string, any[]>();
    for (const doc of docsRes.rows) {
      const list = docsBySupplier.get(doc.supplierId) || [];
      list.push(doc);
      docsBySupplier.set(doc.supplierId, list);
    }

    const people = peopleRes.rows.map((p: any) => {
      const rawId: string | null = p._rawId || null;
      const idLast4 = rawId ? rawId.slice(-4) : null;
      const hasId = Boolean(rawId);
      let omangValid: boolean | null = null;
      let omangMessage: string | null = null;
      if ((p.identityType || 'OMANG') === 'OMANG' && rawId) {
        const check = validateOmang(rawId, p.gender || undefined);
        omangValid = check.ok;
        omangMessage = check.ok ? null : check.message;
      }
      const { _rawId, ...safePerson } = p;
      return {
        ...safePerson,
        hasId,
        idLast4,
        omangValid,
        omangMessage,
        supportingDocuments: (docsBySupplier.get(p.supplierId) || []).map((d) => ({
          documentId: d.documentId,
          versionId: d.versionId,
          documentTypeCode: d.documentTypeCode,
          documentTypeName: d.documentTypeName,
          title: d.title,
          fileName: d.fileName,
          mimeType: d.mimeType,
          documentNumber: d.documentNumber,
          verificationStatus: d.verificationStatus,
          sha256: d.sha256 || null,
          hasFile: Boolean(d.hasFile),
          uploadedAt: d.uploadedAt,
        })),
      };
    });

    res.json({
      people,
      documents: docsRes.rows,
    });
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

router.get('/verification/documents/:versionId/file', async (req: Request, res: Response) => {
  try {
    const { versionId } = req.params;
    if (!UUID_REGEX.test(versionId)) {
      return res.status(400).json({ error: 'INVALID_ID', message: 'Invalid document version ID.' });
    }

    const file = await documentsRepository.getFileForAdmin(versionId);
    if (!file) {
      return res.status(404).json({
        error: 'NOT_FOUND',
        message: 'No uploaded file bytes found for this document version. Ask the supplier to re-upload the file.',
      });
    }

    const isDownload = req.query.download === '1' || req.query.download === 'true';
    const dispositionType = isDownload ? 'attachment' : 'inline';
    const safeFileName = (file.fileName || 'document').replace(/[\r\n"\\]/g, '_');

    res.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
    res.setHeader('Content-Length', String(file.content.length));
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store, no-cache, must-revalidate');
    res.setHeader('Content-Disposition', `${dispositionType}; filename="${safeFileName}"; filename*=UTF-8''${encodeURIComponent(safeFileName)}`);
    res.send(file.content);
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

router.post('/verification/people/:personId', async (req: Request, res: Response) => {
  try {
    const { personId } = req.params;
    if (!UUID_REGEX.test(personId)) {
      return res.status(400).json({ error: 'INVALID_ID', message: 'Invalid director ID.' });
    }

    const rawStatus = String(req.body?.status || '').trim().toLowerCase();
    if (!['verified', 'failed', 'pending'].includes(rawStatus)) {
      return res.status(400).json({ error: 'INVALID_STATUS', message: 'Status must be verified, failed, or pending.' });
    }

    const rawNotes = req.body?.notes !== undefined && req.body?.notes !== null
      ? String(req.body.notes).trim().slice(0, 100)
      : null;

    if (rawStatus === 'failed' && !rawNotes) {
      return res.status(400).json({
        error: 'REASON_REQUIRED',
        message: 'Please provide a reason when rejecting director verification.',
      });
    }

    const existing = await query<{ id: string; supplierId: string; fullName: string }>(
      `SELECT id, supplier_id AS "supplierId", full_name AS "fullName"
       FROM supplier_people WHERE id = $1 AND is_active = TRUE LIMIT 1`,
      [personId]
    );
    if (!existing.rows.length) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Director record not found.' });
    }

    const updatedRes = await query(
      `UPDATE supplier_people
       SET kyc_status = $2::varchar,
           kyc_verified_at = CASE WHEN $2::varchar = 'verified' THEN NOW() ELSE NULL END,
           kyc_reference = $3::varchar,
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, supplier_id AS "supplierId", full_name AS "fullName",
                 kyc_status AS "kycStatus", kyc_verified_at AS "kycVerifiedAt",
                 kyc_reference AS "kycReference"`,
      [personId, rawStatus, rawNotes || (rawStatus === 'verified' ? `Verified by ${req.user?.fullName || req.user?.email || 'Admin'}`.slice(0, 100) : null)]
    );

    await logAdminAudit(req, {
      action: rawStatus === 'verified' ? 'ADMIN_VERIFIED_DIRECTOR' : rawStatus === 'failed' ? 'ADMIN_REJECTED_DIRECTOR' : 'ADMIN_RESET_DIRECTOR_KYC',
      entityType: 'supplier_person',
      entityId: personId,
      supplierId: existing.rows[0].supplierId,
      details: `Set director ${existing.rows[0].fullName} KYC status to ${rawStatus}${rawNotes ? ` (${rawNotes})` : ''}`,
    });

    res.json(updatedRes.rows[0]);
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

router.post('/verification/documents/:versionId', async (req: Request, res: Response) => {
  try {
    const { versionId } = req.params;
    if (!UUID_REGEX.test(versionId)) {
      return res.status(400).json({ error: 'INVALID_ID', message: 'Invalid document version ID.' });
    }

    const rawStatus = String(req.body?.status || '').trim().toUpperCase();
    if (!['VERIFIED', 'REJECTED', 'UNVERIFIABLE', 'PENDING_VERIFICATION'].includes(rawStatus)) {
      return res.status(400).json({
        error: 'INVALID_STATUS',
        message: 'Status must be VERIFIED, REJECTED, UNVERIFIABLE, or PENDING_VERIFICATION.',
      });
    }

    const notes = req.body?.notes !== undefined && req.body?.notes !== null
      ? String(req.body.notes).trim().slice(0, 1000)
      : null;
    const rejectionReason = rawStatus === 'REJECTED'
      ? String(req.body?.rejectionReason || req.body?.notes || '').trim().slice(0, 500)
      : null;

    if (rawStatus === 'REJECTED' && !rejectionReason) {
      return res.status(400).json({
        error: 'REASON_REQUIRED',
        message: 'Please provide a rejection reason for the supplier.',
      });
    }

    const existing = await query<{ versionId: string; documentId: string; supplierId: string; title: string }>(
      `SELECT v.id AS "versionId", d.id AS "documentId", d.supplier_id AS "supplierId", d.title
       FROM supplier_document_versions v
       JOIN supplier_documents d ON d.id = v.document_id
       WHERE v.id = $1
       LIMIT 1`,
      [versionId]
    );
    if (!existing.rows.length) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Document version not found.' });
    }

    const supplierId = existing.rows[0].supplierId;

    const updatedRes = await query(
      `UPDATE supplier_document_versions
       SET verification_status = $2::varchar,
           verified_via = 'manual',
           verified_by_user_id = $3::uuid,
           verified_at = CASE WHEN $2::varchar = 'VERIFIED' THEN NOW() ELSE NULL END,
           verification_notes = COALESCE($4::varchar, verification_notes),
           rejection_reason = $5::varchar
       WHERE id = $1
       RETURNING id AS "versionId", verification_status AS "verificationStatus",
                 verified_via AS "verifiedVia", verified_at AS "verifiedAt",
                 verification_notes AS "verificationNotes", rejection_reason AS "rejectionReason"`,
      [versionId, rawStatus, req.user!.id, notes, rejectionReason]
    );

    // Sync overall supplier verification & compliance readiness based on active documents
    try {
      const docSummaryRes = await query<{ total: number; verified: number; rejected: number }>(
        `SELECT COUNT(*)::int AS total,
                COUNT(*) FILTER (WHERE UPPER(v.verification_status) = 'VERIFIED')::int AS verified,
                COUNT(*) FILTER (WHERE UPPER(v.verification_status) = 'REJECTED')::int AS rejected
         FROM supplier_documents d
         JOIN supplier_document_versions v ON v.id = d.current_version_id
         WHERE d.supplier_id = $1 AND d.status = 'active'`,
        [supplierId]
      );
      const summary = docSummaryRes.rows[0];
      if (summary && summary.total > 0) {
        if (summary.rejected > 0) {
          await query(
            `UPDATE suppliers SET verification_status = 'rejected', compliance_status = 'Action required', updated_at = NOW() WHERE id = $1`,
            [supplierId]
          );
        } else if (summary.verified === summary.total) {
          await query(
            `UPDATE suppliers SET verification_status = 'verified', compliance_status = 'Fully compliant', verified_at = NOW(), verified_by_user_id = $2, updated_at = NOW() WHERE id = $1`,
            [supplierId, req.user!.id]
          );
        } else {
          await query(
            `UPDATE suppliers SET verification_status = 'pending', compliance_status = 'Action required', updated_at = NOW() WHERE id = $1`,
            [supplierId]
          );
        }
      }
      await suppliersRepository.calculateCompleteness(supplierId);
    } catch (syncErr: any) {
      console.warn('[ADMIN DOC SYNC WARNING]:', syncErr?.message || syncErr);
    }

    await logAdminAudit(req, {
      action: rawStatus === 'VERIFIED' ? 'ADMIN_VERIFIED_DOCUMENT' : 'ADMIN_UPDATED_DOCUMENT_VERIFICATION',
      entityType: 'supplier_document_version',
      entityId: versionId,
      supplierId,
      details: `Set document "${existing.rows[0].title}" status to ${rawStatus}${rejectionReason ? ` (${rejectionReason})` : ''}`,
    });

    if (rawStatus === 'VERIFIED') {
      await notificationsRepository
        .notifySupplierMembers(supplierId, {
          eventType: 'document_verified',
          title: `Document verified: ${existing.rows[0].title}`,
          body: `Your ${existing.rows[0].title} has been verified. Open your document vault to check your bidding readiness.`,
          linkUrl: 'vault',
          priority: 'success',
          data: {
            documentId: existing.rows[0].documentId,
            versionId,
            documentTitle: existing.rows[0].title,
          },
        })
        .catch((notifErr) => console.warn('[DOC VERIFY NOTIFY WARNING]:', notifErr?.message || notifErr));
    } else if (rawStatus === 'REJECTED' || rawStatus === 'UNVERIFIABLE') {
      const reasonText = rejectionReason || notes || 'Please upload a clearer, valid copy.';
      await notificationsRepository
        .notifySupplierMembers(supplierId, {
          eventType: 'document_rejected',
          title: `Document needs replacement: ${existing.rows[0].title}`,
          body: `Your ${existing.rows[0].title} could not be accepted. Reason: ${reasonText}. Upload a clear replacement copy in your document vault.`,
          linkUrl: 'vault',
          priority: 'urgent',
          data: {
            documentId: existing.rows[0].documentId,
            versionId,
            documentTitle: existing.rows[0].title,
            reason: reasonText,
          },
        })
        .catch((notifErr) => console.warn('[DOC REJECT NOTIFY WARNING]:', notifErr?.message || notifErr));
    }

    res.json(updatedRes.rows[0]);
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

// =========================================================================
// 5. USER & SECURITY MANAGEMENT (CROSS-TENANT)
// =========================================================================
router.get('/users', async (req: Request, res: Response) => {
  try {
    const search = String(req.query.search || '').trim();
    const filter = String(req.query.filter || 'all').toLowerCase();
    const conditions: string[] = ['u.deleted_at IS NULL'];
    const params: any[] = [];

    if (search) {
      params.push(`%${search}%`);
      conditions.push(`(u.full_name ILIKE $${params.length} OR u.email::text ILIKE $${params.length})`);
    }
    if (filter === 'locked') {
      conditions.push(`u.locked_until IS NOT NULL AND u.locked_until > NOW()`);
    } else if (filter === 'admins') {
      conditions.push(`u.is_platform_admin = TRUE`);
    } else if (filter === 'suspended') {
      conditions.push(`u.status = 'suspended'`);
    }

    const result = await query(
      `SELECT u.id,
              u.full_name AS "fullName",
              u.email::text AS email,
              u.phone,
              u.status,
              u.is_platform_admin AS "isPlatformAdmin",
              u.email_verified_at AS "emailVerifiedAt",
              u.mfa_enabled AS "mfaEnabled",
              u.mfa_type AS "mfaType",
              u.last_login_at AS "lastLoginAt",
              u.failed_login_attempts AS "failedLoginAttempts",
              u.locked_until AS "lockedUntil",
              (u.locked_until IS NOT NULL AND u.locked_until > NOW()) AS "isLocked",
              u.created_at AS "createdAt",
              COALESCE(sess.active_sessions, 0)::int AS "activeSessionsCount",
              COALESCE(org_m.org_name, sup_m.sup_name, CASE WHEN u.is_platform_admin THEN 'Platform Administration' ELSE 'Unassigned' END) AS "tenantName",
              CASE
                WHEN u.is_platform_admin THEN 'Super Admin'
                WHEN org_m.role_name IS NOT NULL THEN org_m.role_name
                WHEN sup_m.role_name IS NOT NULL THEN sup_m.role_name
                ELSE 'User'
              END AS "roleLabel",
              CASE
                WHEN u.is_platform_admin THEN 'platform'
                WHEN org_m.org_name IS NOT NULL THEN 'organization'
                WHEN sup_m.sup_name IS NOT NULL THEN 'supplier'
                ELSE 'none'
              END AS "tenantType"
       FROM users u
       LEFT JOIN LATERAL (
         SELECT COUNT(*)::int AS active_sessions
         FROM sessions s
         WHERE s.user_id = u.id AND s.revoked_at IS NULL AND s.expires_at > NOW()
       ) sess ON TRUE
       LEFT JOIN LATERAL (
         SELECT o.name AS org_name, r.name AS role_name
         FROM organization_members om
         JOIN organizations o ON o.id = om.organization_id
         JOIN roles r ON r.id = om.role_id
         WHERE om.user_id = u.id AND om.status = 'active'
         ORDER BY om.is_owner DESC, om.created_at ASC
         LIMIT 1
       ) org_m ON TRUE
       LEFT JOIN LATERAL (
         SELECT s.legal_name AS sup_name, r.name AS role_name
         FROM supplier_members sm
         JOIN suppliers s ON s.id = sm.supplier_id
         JOIN roles r ON r.id = sm.role_id
         WHERE sm.user_id = u.id AND sm.status = 'active'
         ORDER BY sm.is_owner DESC, sm.created_at ASC
         LIMIT 1
       ) sup_m ON TRUE
       WHERE ${conditions.join(' AND ')}
       ORDER BY (u.locked_until IS NOT NULL AND u.locked_until > NOW()) DESC, u.is_platform_admin DESC, u.created_at DESC
       LIMIT 200`,
      params
    );

    res.json(result.rows);
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

router.post('/users/:id/unlock', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!UUID_REGEX.test(id)) {
      return res.status(400).json({ error: 'INVALID_ID', message: 'Invalid user ID.' });
    }

    const updated = await query(
      `UPDATE users
       SET failed_login_attempts = 0,
           locked_until = NULL,
           updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id, full_name AS "fullName", email::text AS email, status,
                 failed_login_attempts AS "failedLoginAttempts", locked_until AS "lockedUntil"`,
      [id]
    );
    if (!updated.rows.length) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found.' });
    }

    // Also clear recent failed login_attempts for this email so brute-force rate limit does not block immediate login
    await query(
      `DELETE FROM login_attempts
       WHERE LOWER(email_norm) = LOWER($1)
         AND succeeded = FALSE
         AND attempted_at > NOW() - INTERVAL '15 minutes'`,
      [updated.rows[0].email]
    ).catch(() => {});

    await logAdminAudit(req, {
      action: 'ADMIN_UNLOCKED_USER',
      entityType: 'user',
      entityId: id,
      details: `Unlocked locked user account ${updated.rows[0].email} and cleared failed login attempts.`,
    });

    res.json({ ...updated.rows[0], isLocked: false });
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

router.post('/users/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!UUID_REGEX.test(id)) {
      return res.status(400).json({ error: 'INVALID_ID', message: 'Invalid user ID.' });
    }
    const status = String(req.body?.status || '').trim().toLowerCase();
    if (!['active', 'suspended'].includes(status)) {
      return res.status(400).json({ error: 'INVALID_STATUS', message: 'Status must be active or suspended.' });
    }
    if (id === req.user!.id && status === 'suspended') {
      return res.status(400).json({ error: 'SELF_SUSPEND_BLOCKED', message: 'You cannot suspend your own administrator account.' });
    }

    const updated = await query(
      `UPDATE users
       SET status = $2,
           updated_at = NOW()
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING id, full_name AS "fullName", email::text AS email, status`,
      [id, status]
    );
    if (!updated.rows.length) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found.' });
    }

    let revokedCount = 0;
    if (status === 'suspended') {
      const rev = await query(
        `UPDATE sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL RETURNING id`,
        [id]
      );
      revokedCount = rev.rows.length;
    }

    await logAdminAudit(req, {
      action: status === 'suspended' ? 'ADMIN_SUSPENDED_USER' : 'ADMIN_ACTIVATED_USER',
      entityType: 'user',
      entityId: id,
      details: `${status === 'suspended' ? 'Suspended' : 'Activated'} user account ${updated.rows[0].email}${revokedCount > 0 ? ` and revoked ${revokedCount} active session(s)` : ''}.`,
    });

    res.json({ ...updated.rows[0], revokedSessions: revokedCount });
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

router.post('/users/:id/revoke-sessions', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!UUID_REGEX.test(id)) {
      return res.status(400).json({ error: 'INVALID_ID', message: 'Invalid user ID.' });
    }

    const userRes = await query<{ id: string; email: string }>(
      `SELECT id, email::text AS email FROM users WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );
    if (!userRes.rows.length) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'User not found.' });
    }

    const revRes = await query(
      `UPDATE sessions SET revoked_at = NOW() WHERE user_id = $1 AND revoked_at IS NULL RETURNING id`,
      [id]
    );

    await logAdminAudit(req, {
      action: 'ADMIN_REVOKED_USER_SESSIONS',
      entityType: 'user',
      entityId: id,
      details: `Revoked ${revRes.rows.length} active session(s) for user ${userRes.rows[0].email}.`,
    });

    res.json({ userId: id, revokedCount: revRes.rows.length });
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

// =========================================================================
// 6. RISK FLAGS & STATUTORY DEBARMENTS
// =========================================================================
router.get('/risk', async (_req: Request, res: Response) => {
  try {
    const [flagsRes, debarmentsRes] = await Promise.all([
      query(
        `SELECT rf.id,
                rf.supplier_id AS "supplierId",
                s.legal_name AS "supplierName",
                s.cipa_uin AS "supplierCipa",
                rf.call_id AS "callId",
                c.reference_no AS "callRef",
                o.name AS "organizationName",
                rf.flag_type AS "flagType",
                rf.severity,
                rf.details,
                rf.status,
                rf.reviewed_at AS "reviewedAt",
                u.full_name AS "reviewedByName",
                rf.created_at AS "createdAt"
         FROM risk_flags rf
         JOIN suppliers s ON s.id = rf.supplier_id
         LEFT JOIN calls c ON c.id = rf.call_id
         LEFT JOIN organizations o ON o.id = c.organization_id
         LEFT JOIN users u ON u.id = rf.reviewed_by_user_id
         ORDER BY CASE rf.status WHEN 'open' THEN 0 WHEN 'reviewed' THEN 1 ELSE 2 END,
                  CASE rf.severity WHEN 'high' THEN 0 WHEN 'medium' THEN 1 ELSE 2 END,
                  rf.created_at DESC`
      ),
      query(
        `SELECT d.id,
                d.supplier_id AS "supplierId",
                s.legal_name AS "entityName",
                s.cipa_uin AS "cipaNumber",
                d.organization_id AS "organizationId",
                COALESCE(o.name, 'Platform-wide (All Procuring Entities)') AS "scope",
                d.reason,
                d.starts_on AS "startsOn",
                d.ends_on AS "endsOn",
                d.evidence_ref AS "evidenceRef",
                d.lifted_at AS "liftedAt",
                (d.lifted_at IS NULL AND d.starts_on <= CURRENT_DATE AND (d.ends_on IS NULL OR d.ends_on >= CURRENT_DATE)) AS "isActive",
                u.full_name AS "issuedBy",
                d.created_at AS "createdAt"
         FROM debarments d
         JOIN suppliers s ON s.id = d.supplier_id
         LEFT JOIN organizations o ON o.id = d.organization_id
         LEFT JOIN users u ON u.id = d.created_by_user_id
         ORDER BY (d.lifted_at IS NULL) DESC, d.created_at DESC`
      ),
    ]);

    res.json({
      flags: flagsRes.rows,
      debarments: debarmentsRes.rows,
    });
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

router.post('/risk/flags', async (req: Request, res: Response) => {
  try {
    const { supplierId, flagType, severity, description, callId } = req.body || {};
    if (!supplierId || !UUID_REGEX.test(supplierId)) {
      return res.status(400).json({ error: 'INVALID_SUPPLIER', message: 'Valid supplierId is required.' });
    }
    const allowedFlagTypes = ['shared_director', 'shared_address', 'shared_phone', 'duplicate_document', 'price_pattern', 'other'];
    const normFlagType = allowedFlagTypes.includes(String(flagType || '').toLowerCase()) ? String(flagType).toLowerCase() : 'other';
    const normSeverity = ['low', 'medium', 'high'].includes(String(severity || '').toLowerCase()) ? String(severity).toLowerCase() : 'medium';
    const desc = String(description || '').trim().slice(0, 1000);
    if (!desc) {
      return res.status(400).json({ error: 'DESCRIPTION_REQUIRED', message: 'Flag description is required.' });
    }
    const safeCallId = callId && UUID_REGEX.test(callId) ? callId : null;

    const supRes = await query<{ legal_name: string }>(`SELECT legal_name FROM suppliers WHERE id = $1 AND deleted_at IS NULL`, [supplierId]);
    if (!supRes.rows.length) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Supplier not found.' });
    }

    const ins = await query(
      `INSERT INTO risk_flags (supplier_id, call_id, flag_type, severity, details, status)
       VALUES ($1, $2, $3, $4, $5::jsonb, 'open')
       RETURNING id, supplier_id AS "supplierId", flag_type AS "flagType", severity, details, status, created_at AS "createdAt"`,
      [supplierId, safeCallId, normFlagType, normSeverity, JSON.stringify({ description: desc })]
    );

    await logAdminAudit(req, {
      action: 'ADMIN_CREATED_RISK_FLAG',
      entityType: 'risk_flag',
      entityId: ins.rows[0].id,
      supplierId,
      details: `Flagged supplier "${supRes.rows[0].legal_name}" (${normSeverity} ${normFlagType}): ${desc}`,
    });

    res.status(201).json(ins.rows[0]);
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

router.post('/risk/flags/:id/status', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!UUID_REGEX.test(id)) {
      return res.status(400).json({ error: 'INVALID_ID', message: 'Invalid risk flag ID.' });
    }
    const status = String(req.body?.status || '').trim().toLowerCase();
    if (!['open', 'reviewed', 'dismissed', 'resolved'].includes(status)) {
      return res.status(400).json({ error: 'INVALID_STATUS', message: 'Status must be open, reviewed, dismissed, or resolved.' });
    }

    const updated = await query(
      `UPDATE risk_flags
       SET status = $2,
           reviewed_by_user_id = $3,
           reviewed_at = NOW()
       WHERE id = $1
       RETURNING id, supplier_id AS "supplierId", flag_type AS "flagType", severity, status, reviewed_at AS "reviewedAt"`,
      [id, status, req.user!.id]
    );
    if (!updated.rows.length) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Risk flag not found.' });
    }

    await logAdminAudit(req, {
      action: 'ADMIN_UPDATED_RISK_FLAG',
      entityType: 'risk_flag',
      entityId: id,
      supplierId: updated.rows[0].supplierId,
      details: `Updated risk flag (${updated.rows[0].flagType}) status to ${status}.`,
    });

    res.json(updated.rows[0]);
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

router.post('/debarments', async (req: Request, res: Response) => {
  try {
    const { supplierId, organizationId, reason, startsOn, endsOn, evidenceRef } = req.body || {};
    if (!supplierId || !UUID_REGEX.test(supplierId)) {
      return res.status(400).json({ error: 'INVALID_SUPPLIER', message: 'Valid supplierId is required.' });
    }
    const cleanReason = String(reason || '').trim().slice(0, 1000);
    if (!cleanReason || cleanReason.length < 5) {
      return res.status(400).json({ error: 'REASON_REQUIRED', message: 'Debarment reason (at least 5 characters) is required.' });
    }
    const safeOrgId = organizationId && UUID_REGEX.test(organizationId) ? organizationId : null;
    const effectiveStart = startsOn && /^\d{4}-\d{2}-\d{2}$/.test(String(startsOn))
      ? String(startsOn)
      : new Date().toISOString().slice(0, 10);
    const effectiveEnd = endsOn && /^\d{4}-\d{2}-\d{2}$/.test(String(endsOn)) ? String(endsOn) : null;
    const cleanEvidence = evidenceRef ? String(evidenceRef).trim().slice(0, 255) : null;

    const supRes = await query<{ legal_name: string }>(`SELECT legal_name FROM suppliers WHERE id = $1 AND deleted_at IS NULL`, [supplierId]);
    if (!supRes.rows.length) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Supplier not found.' });
    }

    const ins = await query(
      `INSERT INTO debarments (organization_id, supplier_id, reason, starts_on, ends_on, evidence_ref, created_by_user_id)
       VALUES ($1, $2, $3, $4::date, $5::date, $6, $7)
       RETURNING id, organization_id AS "organizationId", supplier_id AS "supplierId",
                 reason, starts_on AS "startsOn", ends_on AS "endsOn",
                 evidence_ref AS "evidenceRef", lifted_at AS "liftedAt", created_at AS "createdAt"`,
      [safeOrgId, supplierId, cleanReason, effectiveStart, effectiveEnd, cleanEvidence, req.user!.id]
    );

    await logAdminAudit(req, {
      action: 'ADMIN_APPLIED_DEBARMENT',
      entityType: 'debarment',
      entityId: ins.rows[0].id,
      supplierId,
      organizationId: safeOrgId,
      details: `Applied ${effectiveEnd ? `temporary debarment (${effectiveStart} to ${effectiveEnd})` : `permanent debarment (from ${effectiveStart})`} on "${supRes.rows[0].legal_name}". Reason: ${cleanReason}`,
    });

    res.status(201).json(ins.rows[0]);
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

router.post('/debarments/:id/lift', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!UUID_REGEX.test(id)) {
      return res.status(400).json({ error: 'INVALID_ID', message: 'Invalid debarment ID.' });
    }
    const liftReason = req.body?.reason ? String(req.body.reason).trim().slice(0, 500) : 'Debarment lifted by platform administrator';

    const existing = await query<{ id: string; supplierId: string; legalName: string }>(
      `SELECT d.id, d.supplier_id AS "supplierId", s.legal_name AS "legalName"
       FROM debarments d
       JOIN suppliers s ON s.id = d.supplier_id
       WHERE d.id = $1`,
      [id]
    );
    if (!existing.rows.length) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Debarment record not found.' });
    }

    const updated = await query(
      `UPDATE debarments
       SET lifted_at = NOW()
       WHERE id = $1
       RETURNING id, supplier_id AS "supplierId", lifted_at AS "liftedAt"`,
      [id]
    );

    await logAdminAudit(req, {
      action: 'ADMIN_LIFTED_DEBARMENT',
      entityType: 'debarment',
      entityId: id,
      supplierId: existing.rows[0].supplierId,
      details: `Lifted debarment order for supplier "${existing.rows[0].legalName}". Note: ${liftReason}`,
    });

    res.json(updated.rows[0]);
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

// =========================================================================
// 7. MASTER CATALOGUES & REFERENCE DATA
// =========================================================================
router.get('/catalogues', async (_req: Request, res: Response) => {
  try {
    const [categories, documentTypes] = await Promise.all([
      referenceRepository.listAllCategoriesAdmin(),
      referenceRepository.listAllDocumentTypesAdmin(),
    ]);
    res.json({ categories, documentTypes });
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

router.post('/catalogues/categories', async (req: Request, res: Response) => {
  try {
    const { code, name, description, parentId, level, sortOrder } = req.body || {};
    if (!code || !String(code).trim() || !name || !String(name).trim()) {
      return res.status(400).json({ error: 'INVALID_INPUT', message: 'Category code and name are required.' });
    }
    if (parentId && !UUID_REGEX.test(parentId)) {
      return res.status(400).json({ error: 'INVALID_PARENT', message: 'Invalid parentId.' });
    }
    const created = await referenceRepository.createCategory({ code, name, description, parentId, level, sortOrder });
    await logAdminAudit(req, {
      action: 'ADMIN_CREATED_CATEGORY',
      entityType: 'category',
      entityId: created.id,
      details: `Created procurement category ${created.code} — ${created.name}.`,
    });
    res.status(201).json(created);
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

router.put('/catalogues/categories/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!UUID_REGEX.test(id)) {
      return res.status(400).json({ error: 'INVALID_ID', message: 'Invalid category ID.' });
    }
    const updated = await referenceRepository.updateCategory(id, req.body || {});
    if (!updated) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Category not found.' });
    }
    await logAdminAudit(req, {
      action: 'ADMIN_UPDATED_CATEGORY',
      entityType: 'category',
      entityId: id,
      details: `Updated procurement category ${updated.code} — ${updated.name} (active: ${updated.isActive}).`,
    });
    res.json(updated);
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

router.post('/catalogues/document-types', async (req: Request, res: Response) => {
  try {
    const { code, name, description, issuingAuthority, requiresExpiry, requiresNumber, defaultValidityDays, verificationMethod, isMandatoryDefault, sortOrder } = req.body || {};
    if (!code || !String(code).trim() || !name || !String(name).trim()) {
      return res.status(400).json({ error: 'INVALID_INPUT', message: 'Document type code and name are required.' });
    }
    const created = await referenceRepository.createDocumentType({
      code,
      name,
      description,
      issuingAuthority,
      requiresExpiry,
      requiresNumber,
      defaultValidityDays: defaultValidityDays ? Number(defaultValidityDays) : null,
      verificationMethod,
      isMandatoryDefault,
      sortOrder,
    });
    await logAdminAudit(req, {
      action: 'ADMIN_CREATED_DOCUMENT_TYPE',
      entityType: 'document_type',
      entityId: created.id,
      details: `Created compliance document type ${created.code} — ${created.name}.`,
    });
    res.status(201).json(created);
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

router.put('/catalogues/document-types/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!UUID_REGEX.test(id)) {
      return res.status(400).json({ error: 'INVALID_ID', message: 'Invalid document type ID.' });
    }
    const updated = await referenceRepository.updateDocumentType(id, req.body || {});
    if (!updated) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Document type not found.' });
    }
    await logAdminAudit(req, {
      action: 'ADMIN_UPDATED_DOCUMENT_TYPE',
      entityType: 'document_type',
      entityId: id,
      details: `Updated compliance document type ${updated.code} — ${updated.name} (active: ${updated.isActive}).`,
    });
    res.json(updated);
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

// =========================================================================
// 8. BILLING, PLANS & INVOICES
// =========================================================================
router.get('/billing', async (_req: Request, res: Response) => {
  try {
    const [plansRes, invoicesRes] = await Promise.all([
      query(
        `SELECT p.id, p.code, p.name, p.audience, p.price, p.currency,
                p.billing_interval AS "billingInterval", p.max_users AS "maxUsers",
                p.max_calls_per_year AS "maxCallsPerYear", p.features, p.sort_order AS "sortOrder",
                COUNT(sub.id) FILTER (WHERE sub.status = 'active')::int AS "subscribersCount"
         FROM plans p
         LEFT JOIN subscriptions sub ON sub.plan_id = p.id
         WHERE p.is_active = TRUE
         GROUP BY p.id
         ORDER BY p.sort_order ASC, p.name ASC`
      ),
      query(
        `SELECT pi.id,
                pi.invoice_no AS "invoiceNumber",
                COALESCE(o.name, s.legal_name, 'Tenant') AS "orgName",
                pi.total::numeric AS "amountBWP",
                pi.currency,
                pi.status,
                pi.issued_at AS "issuedAt",
                pi.due_at AS "dueDate",
                pi.paid_at AS "paidAt",
                pi.created_at AS "createdAt"
         FROM platform_invoices pi
         LEFT JOIN organizations o ON o.id = pi.organization_id
         LEFT JOIN suppliers s ON s.id = pi.supplier_id
         ORDER BY pi.created_at DESC
         LIMIT 100`
      ),
    ]);

    res.json({
      plans: plansRes.rows.map((p: any) => ({ ...p, price: Number(p.price) || 0 })),
      invoices: invoicesRes.rows.map((i: any) => ({ ...i, amountBWP: Number(i.amountBWP) || 0 })),
    });
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

router.put('/billing/plans/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!UUID_REGEX.test(id)) {
      return res.status(400).json({ error: 'INVALID_ID', message: 'Invalid plan ID.' });
    }
    const { price, maxCallsPerYear, description, reason } = req.body || {};
    const numPrice = price !== undefined ? Number(price) : undefined;
    if (numPrice !== undefined && (isNaN(numPrice) || numPrice < 0)) {
      return res.status(400).json({ error: 'INVALID_PRICE', message: 'Price must be a non-negative number.' });
    }

    const updated = await referenceRepository.updatePlan(id, {
      price: numPrice,
      maxCallsPerYear: maxCallsPerYear !== undefined ? (maxCallsPerYear === null ? null : Number(maxCallsPerYear)) : undefined,
      features: description !== undefined ? { description: String(description).trim() } : undefined,
    });
    if (!updated) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Plan not found.' });
    }

    await logAdminAudit(req, {
      action: 'ADMIN_UPDATED_PLAN_PRICING',
      entityType: 'plan',
      entityId: id,
      details: `Updated plan "${updated.name}" rate to ${updated.currency} ${Number(updated.price).toLocaleString()}${reason ? ` (${String(reason).trim()})` : ''}.`,
    });

    res.json(updated);
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

// =========================================================================
// 9. IN-APP NOTIFICATIONS & DELIVERY LOGS
// =========================================================================
router.get('/notifications/in-app', async (_req: Request, res: Response) => {
  try {
    const resRows = await query(
      `SELECT n.id,
              n.event_type AS "eventType",
              n.title,
              n.body,
              n.link_url AS "linkUrl",
              n.priority,
              (n.read_at IS NOT NULL) AS "isRead",
              n.read_at AS "readAt",
              n.created_at AS "createdAt",
              COALESCE(u.full_name, u.email::text, 'Unknown user') AS "recipientName",
              u.email::text AS "recipientEmail",
              COALESCE(o.name, s.legal_name, 'Platform') AS "workspaceName",
              CASE
                WHEN n.organization_id IS NOT NULL THEN 'Buyer'
                WHEN n.supplier_id IS NOT NULL THEN 'Supplier'
                ELSE 'Platform'
              END AS "workspaceType"
       FROM notifications n
       LEFT JOIN users u ON u.id = n.user_id
       LEFT JOIN organizations o ON o.id = n.organization_id
       LEFT JOIN suppliers s ON s.id = n.supplier_id
       ORDER BY n.created_at DESC
       LIMIT 150`
    );
    res.json(resRows.rows);
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

router.get('/notifications', async (_req: Request, res: Response) => {
  try {
    const resRows = await query(
      `SELECT id,
              channel,
              recipient,
              COALESCE(template_code, 'System notification') AS "templateCode",
              status,
              error_message AS "errorMessage",
              retry_count AS "retryCount",
              COALESCE(sent_at, queued_at) AS "sentAt"
       FROM message_deliveries
       ORDER BY queued_at DESC
       LIMIT 100`
    );
    res.json(resRows.rows);
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

router.post('/notifications/:id/retry', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!UUID_REGEX.test(id)) {
      return res.status(400).json({ error: 'INVALID_ID', message: 'Invalid delivery ID.' });
    }
    const updated = await query(
      `UPDATE message_deliveries
       SET status = 'queued',
           retry_count = retry_count + 1,
           error_message = NULL,
           sent_at = NOW()
       WHERE id = $1
       RETURNING id, channel, recipient, COALESCE(template_code, 'System notification') AS "templateCode",
                 status, retry_count AS "retryCount", sent_at AS "sentAt"`,
      [id]
    );
    if (!updated.rows.length) {
      return res.status(404).json({ error: 'NOT_FOUND', message: 'Delivery record not found.' });
    }
    await logAdminAudit(req, {
      action: 'ADMIN_RETRIED_NOTIFICATION',
      entityType: 'message_delivery',
      entityId: id,
      details: `Queued retry #${updated.rows[0].retryCount} for ${updated.rows[0].channel} delivery to ${updated.rows[0].recipient}.`,
    });
    res.json(updated.rows[0]);
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

// =========================================================================
// 10. CROSS-TENANT AUDIT LOG
// =========================================================================
router.get('/audit-log', async (req: Request, res: Response) => {
  try {
    const events = await auditRepository.listEvents({
      entityType: req.query.entityType ? String(req.query.entityType) : undefined,
      actor: req.query.actor ? String(req.query.actor) : undefined,
      action: req.query.action ? String(req.query.action) : undefined,
      search: req.query.search ? String(req.query.search) : undefined,
      fromDate: req.query.fromDate ? String(req.query.fromDate) : undefined,
      toDate: req.query.toDate ? String(req.query.toDate) : undefined,
      limit: req.query.limit ? Number(req.query.limit) : 150,
    });
    res.json(
      events.map((e) => ({
        ...e,
        timestamp: e.occurredAt
          ? new Date(e.occurredAt).toLocaleString('en-BW', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })
          : '—',
      }))
    );
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

router.get('/audit-log/verify', async (_req: Request, res: Response) => {
  try {
    const result = await auditRepository.verifyChain();
    res.json(result);
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

// =========================================================================
// 11. SUPPORT SESSIONS & PLATFORM SETTINGS
// =========================================================================
router.post('/support/sessions', async (req: Request, res: Response) => {
  try {
    const { targetType, targetId, targetName, ticketRef, justification } = req.body || {};
    const cleanTicket = String(ticketRef || '').trim().slice(0, 100);
    const cleanJustification = String(justification || '').trim().slice(0, 500);
    const cleanTargetName = String(targetName || '').trim().slice(0, 200);
    if (!cleanTicket || cleanJustification.length < 10 || !cleanTargetName) {
      return res.status(400).json({
        error: 'INVALID_INPUT',
        message: 'Ticket reference, target entity, and justification (min 10 chars) are required.',
      });
    }

    const entityType = targetType === 'Supplier' ? 'supplier' : 'organization';
    const safeTargetId = targetId && UUID_REGEX.test(targetId) ? targetId : null;

    await logAdminAudit(req, {
      action: 'ADMIN_SUPPORT_SESSION_STARTED',
      entityType,
      entityId: safeTargetId,
      organizationId: entityType === 'organization' ? safeTargetId : null,
      supplierId: entityType === 'supplier' ? safeTargetId : null,
      details: `Support diagnostic session authorized for ${cleanTargetName} (${cleanTicket}): ${cleanJustification}`,
    });

    res.status(201).json({ ok: true, targetName: cleanTargetName, ticketRef: cleanTicket });
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

router.get('/settings', async (_req: Request, res: Response) => {
  try {
    const rows = await query<{ configKey: string; configValue: any }>(
      `SELECT config_key AS "configKey", config_value AS "configValue"
       FROM platform_financial_configs
       WHERE config_key IN ('cipa_gateway_url', 'burs_gateway_url', 'statutory_retention_years')
       ORDER BY created_at DESC`
    );

    const map = new Map<string, any>();
    for (const r of rows.rows) {
      if (!map.has(r.configKey)) {
        map.set(r.configKey, r.configValue);
      }
    }

    res.json({
      cipaEndpoint: map.get('cipa_gateway_url')?.url || 'https://api.cipa.gov.bw/v2/registry',
      bursEndpoint: map.get('burs_gateway_url')?.url || 'https://etax.burs.org.bw/gateway/api',
      retentionYears: String(map.get('statutory_retention_years')?.years || '7'),
    });
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

router.put('/settings', async (req: Request, res: Response) => {
  try {
    const cipaEndpoint = String(req.body?.cipaEndpoint || '').trim().slice(0, 300);
    const bursEndpoint = String(req.body?.bursEndpoint || '').trim().slice(0, 300);
    const retentionYears = String(req.body?.retentionYears || '7').trim();

    if (!['7', '10', '15'].includes(retentionYears)) {
      return res.status(400).json({ error: 'INVALID_RETENTION', message: 'Retention period must be 7, 10, or 15 years.' });
    }
    for (const [label, val] of [['CIPA endpoint', cipaEndpoint], ['BURS endpoint', bursEndpoint]]) {
      try {
        const parsed = new URL(val);
        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
          return res.status(400).json({ error: 'INVALID_URL', message: `${label} must be a valid HTTP(S) URL.` });
        }
      } catch {
        return res.status(400).json({ error: 'INVALID_URL', message: `${label} must be a valid URL.` });
      }
    }

    const entries: [string, any, string][] = [
      ['cipa_gateway_url', { url: cipaEndpoint }, 'CIPA Companies Registry Gateway URL'],
      ['burs_gateway_url', { url: bursEndpoint }, 'BURS e-Tax Verification Gateway URL'],
      ['statutory_retention_years', { years: Number(retentionYears) }, 'Statutory tender dossier retention period (years)'],
    ];

    for (const [key, val, desc] of entries) {
      const existing = await query<{ id: string }>(
        `SELECT id FROM platform_financial_configs WHERE config_key = $1 ORDER BY created_at DESC LIMIT 1`,
        [key]
      );
      if (existing.rows.length) {
        await query(
          `UPDATE platform_financial_configs SET config_value = $2::jsonb, description = $3 WHERE id = $1`,
          [existing.rows[0].id, JSON.stringify(val), desc]
        );
      } else {
        await query(
          `INSERT INTO platform_financial_configs (config_key, config_value, description, effective_from)
           VALUES ($1, $2::jsonb, $3, CURRENT_DATE)`,
          [key, JSON.stringify(val), desc]
        );
      }
    }

    await logAdminAudit(req, {
      action: 'ADMIN_UPDATED_PLATFORM_SETTINGS',
      entityType: 'platform_config',
      details: `Updated platform settings: retention=${retentionYears}y, CIPA=${cipaEndpoint}, BURS=${bursEndpoint}.`,
    });

    res.json({ cipaEndpoint, bursEndpoint, retentionYears });
  } catch (err: any) {
    const safe = translateDbError(err);
    res.status(safe.status).json(safe);
  }
});

export { router as adminRouter };
