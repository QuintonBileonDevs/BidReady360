import { query } from './client';
import { clearReferenceCache } from '../repositories/reference.repository';

/**
 * Ensures baseline system roles have their PostgreSQL role_permissions rows populated.
 * Safe and idempotent to run on server startup.
 */
export async function ensureSystemRolePermissions(): Promise<void> {
  await query(`
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT r.id, p.id FROM roles r JOIN permissions p ON p.scope = 'organization'
    WHERE r.scope = 'organization' AND r.name IN ('Org Admin', 'Buyer Admin', 'Organization Admin')
    ON CONFLICT DO NOTHING
  `);
  await query(`
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN (
      'calls.create', 'calls.publish', 'calls.manage',
      'applications.view', 'applications.review',
      'suppliers.view', 'bids.view', 'bids.open',
      'evaluation.assign', 'evaluation.consolidate',
      'awards.recommend', 'contracts.manage', 'performance.review',
      'reports.view', 'audit.view'
    )
    WHERE r.scope = 'organization' AND r.name = 'Procurement Officer'
    ON CONFLICT DO NOTHING
  `);
  await query(`
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN (
      'applications.view', 'bids.view', 'evaluation.score'
    )
    WHERE r.scope = 'organization' AND r.name = 'Evaluator'
    ON CONFLICT DO NOTHING
  `);
  await query(`
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN (
      'applications.view', 'applications.approve', 'suppliers.view',
      'bids.view', 'awards.approve', 'reports.view', 'audit.view'
    )
    WHERE r.scope = 'organization' AND r.name = 'Approver'
    ON CONFLICT DO NOTHING
  `);
  await query(`
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN (
      'applications.view', 'suppliers.view', 'bids.view', 'reports.view', 'audit.view'
    )
    WHERE r.scope = 'organization' AND r.name = 'Auditor'
    ON CONFLICT DO NOTHING
  `);
  await query(`
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT r.id, p.id FROM roles r JOIN permissions p ON p.scope = 'supplier'
    WHERE r.scope = 'supplier' AND r.name = 'Supplier Admin'
    ON CONFLICT DO NOTHING
  `);
  await query(`
    INSERT INTO role_permissions (role_id, permission_id)
    SELECT r.id, p.id FROM roles r JOIN permissions p ON p.code IN (
      'supplier.profile.edit', 'supplier.documents.manage', 'supplier.apply', 'supplier.bid.submit'
    )
    WHERE r.scope = 'supplier' AND r.name = 'Supplier Staff'
    ON CONFLICT DO NOTHING
  `);
}

/**
 * Idempotently seeds plain sentence-case in-app notification templates for core procurement events.
 */
export async function ensureInAppNotificationTemplates(): Promise<void> {
  const templates: Array<{ code: string; subject: string; body: string; variables: string[] }> = [
    {
      code: 'organization_approved',
      subject: 'Your organization account is approved',
      body: '{{organizationName}} has been verified and approved. Open your workspace to publish tender calls and review supplier submissions.',
      variables: ['organizationName'],
    },
    {
      code: 'organization_rejected',
      subject: 'Organization verification needs attention',
      body: '{{organizationName}} was not approved. Reason: {{reason}}. Review your organization details and contact platform support to resubmit.',
      variables: ['organizationName', 'reason'],
    },
    {
      code: 'document_verified',
      subject: 'Document verified: {{documentTitle}}',
      body: 'Your {{documentTitle}} has been verified. Open your document vault to check your bidding readiness.',
      variables: ['documentTitle'],
    },
    {
      code: 'document_rejected',
      subject: 'Document needs replacement: {{documentTitle}}',
      body: 'Your {{documentTitle}} could not be accepted. Reason: {{reason}}. Upload a clear replacement copy in your document vault.',
      variables: ['documentTitle', 'reason'],
    },
    {
      code: 'document_expiring_soon',
      subject: '{{documentTitle}} expires on {{expiryDate}}',
      body: 'Your {{documentTitle}} expires on {{expiryDate}} ({{daysRemaining}} days left). Upload a renewed certificate in your document vault to stay ready to bid.',
      variables: ['documentTitle', 'expiryDate', 'daysRemaining'],
    },
    {
      code: 'clarification_asked',
      subject: 'New clarification question on {{callNumber}}',
      body: '{{supplierName}} asked a clarification question under {{topic}}. Review the question and publish an official response.',
      variables: ['callNumber', 'supplierName', 'topic'],
    },
    {
      code: 'clarification_answered',
      subject: 'Clarification answer published for {{callNumber}}',
      body: 'An official clarification response was published for {{callTitle}}. Open the tender call to read the answer before submitting.',
      variables: ['callNumber', 'callTitle'],
    },
    {
      code: 'addendum_published',
      subject: 'Addendum #{{addendumNo}} published for {{callNumber}}',
      body: '{{addendumTitle}} was issued for {{callTitle}}. Open the tender call to review and acknowledge this addendum.',
      variables: ['callNumber', 'callTitle', 'addendumNo', 'addendumTitle'],
    },
    {
      code: 'application_submitted',
      subject: 'New application submitted for {{callNumber}}',
      body: '{{supplierName}} submitted an application dossier (receipt {{receiptNumber}}). Open the applications queue to review the submission.',
      variables: ['supplierName', 'callNumber', 'receiptNumber'],
    },
    {
      code: 'application_status_changed',
      subject: 'Application status updated for {{callNumber}}',
      body: 'Your application for {{callTitle}} is now {{status}}. {{note}}',
      variables: ['callNumber', 'callTitle', 'status', 'note'],
    },
    {
      code: 'application_info_responded',
      subject: 'Additional information submitted for {{callNumber}}',
      body: '{{actorName}} replied to your information request. Open the applications queue to continue the review.',
      variables: ['callNumber', 'actorName'],
    },
    {
      code: 'application_withdrawn',
      subject: 'Application withdrawn for {{callNumber}}',
      body: '{{supplierName}} withdrew their application for {{callTitle}} before closing. Open the applications queue to view the updated list.',
      variables: ['supplierName', 'callNumber', 'callTitle'],
    },
    {
      code: 'bid_submitted',
      subject: 'Sealed bid received for {{callNumber}}',
      body: '{{supplierName}} submitted a sealed bid (receipt {{receiptNumber}}). Pricing stays locked until the witnessed opening session.',
      variables: ['supplierName', 'callNumber', 'receiptNumber'],
    },
    {
      code: 'bid_withdrawn',
      subject: 'Sealed bid withdrawn for {{callNumber}}',
      body: 'A supplier withdrew sealed bid {{receiptNumber}} before the closing deadline. Open bids opening to view the register.',
      variables: ['callNumber', 'receiptNumber'],
    },
    {
      code: 'bid_opened',
      subject: 'Sealed bid opened for {{callNumber}}',
      body: 'Your bid ({{receiptNumber}}) for {{callTitle}} was unsealed during the witnessed opening session. Check your applications for evaluation updates.',
      variables: ['callNumber', 'callTitle', 'receiptNumber', 'registerSha256'],
    },
    {
      code: 'award_pending_approval',
      subject: 'Award recommendation waiting for approval ({{callNumber}})',
      body: '{{actorName}} recommended a contract award of BWP {{awardValue}}. Open awards to review and record your approval decision.',
      variables: ['callNumber', 'actorName', 'awardValue'],
    },
    {
      code: 'award_decision',
      subject: 'Award recommendation {{decision}} for {{callNumber}}',
      body: '{{actorName}} {{decision}} the contract award recommendation for {{callTitle}}. Open awards to review the recorded decision.',
      variables: ['callNumber', 'callTitle', 'actorName', 'decision'],
    },
    {
      code: 'award_approved',
      subject: 'Contract award approved for {{callNumber}}',
      body: 'Your bid for {{callTitle}} (BWP {{awardValue}}) has been approved for contract award. Open your applications to view the next steps.',
      variables: ['callNumber', 'callTitle', 'awardValue'],
    },
    {
      code: 'award_issued',
      subject: 'Contract award approved for {{callNumber}}',
      body: 'Your bid for {{callTitle}} (BWP {{awardValue}}) has been approved for contract award. Open your applications to view the next steps.',
      variables: ['callNumber', 'callTitle', 'awardValue'],
    },
    {
      code: 'award_rejected',
      subject: 'Award recommendation returned for {{callNumber}}',
      body: 'The award recommendation for {{callTitle}} was returned during approval review. Open awards to inspect the feedback.',
      variables: ['callNumber', 'callTitle'],
    },
    {
      code: 'call_invitation',
      subject: 'You are invited to bid on {{callNumber}}',
      body: '{{organizationName}} invited your company to respond to {{callTitle}}. Open the tender call to review requirements and deadlines.',
      variables: ['organizationName', 'callNumber', 'callTitle'],
    },
    {
      code: 'team_invitation',
      subject: 'Workspace invitation to {{tenantName}}',
      body: '{{inviterName}} invited you to join {{tenantName}} as {{roleName}}. Accept your invitation before {{expiresAt}}.',
      variables: ['tenantName', 'inviterName', 'roleName', 'expiresAt'],
    },
    {
      code: 'consent_accessed',
      subject: '{{organizationName}} viewed your shared data',
      body: '{{actorName}} at {{organizationName}} accessed {{scope}}. Open consent and data sharing to review the access log.',
      variables: ['organizationName', 'actorName', 'scope'],
    },
  ];

  for (const tpl of templates) {
    await query(
      `INSERT INTO notification_templates (organization_id, code, channel, locale, subject, body, variables, is_active)
       VALUES (NULL, $1, 'in_app', 'en', $2, $3, $4::text[], TRUE)
       ON CONFLICT ((COALESCE(organization_id, '00000000-0000-0000-0000-000000000000'::uuid)), code, channel, locale)
       DO UPDATE SET
         subject = EXCLUDED.subject,
         body = EXCLUDED.body,
         variables = EXCLUDED.variables,
         is_active = TRUE`,
      [tpl.code, tpl.subject, tpl.body, tpl.variables]
    );
  }
}

export async function seedDatabase() {
  console.log('[DB SEED] Seeding initial database records...');

  try {
    await ensureSystemRolePermissions();
    await ensureInAppNotificationTemplates();
    // 0. Ensure system admin user exists
    let systemUserId = '';
    const existingUser = await query("SELECT id FROM users WHERE email = 'admin@bidready360.bw' LIMIT 1");
    if (existingUser.rows.length > 0) {
      systemUserId = existingUser.rows[0].id;
    } else {
      const userRes = await query(
        `INSERT INTO users (email, full_name, status, is_platform_admin, email_verified_at)
         VALUES ('admin@bidready360.bw', 'System Administrator', 'active', TRUE, NOW())
         RETURNING id`
      );
      systemUserId = userRes.rows[0].id;
    }

    // 1. Seed Organizations
    const orgs = [
      {
        name: 'Gaborone Regional Council',
        slug: 'org-grc',
        type: 'local_authority',
        email: 'procurement@grc.gov.bw',
      },
      {
        name: 'Debswana Diamond Company',
        slug: 'org-debswana',
        type: 'parastatal',
        email: 'tenders@debswana.bw',
      },
      {
        name: 'Botswana Unified Revenue Service (BURS)',
        slug: 'org-burs',
        type: 'ministry',
        email: 'procurement@burs.org.bw',
      },
      {
        name: 'Botswana Power Corporation (BPC)',
        slug: 'org-bpc',
        type: 'parastatal',
        email: 'tenders@bpc.bw',
      },
    ];

    const orgMap: Record<string, string> = {};

    for (const o of orgs) {
      const existing = await query('SELECT id FROM organizations WHERE slug = $1 LIMIT 1', [o.slug]);
      if (existing.rows.length > 0) {
        orgMap[o.slug] = existing.rows[0].id;
      } else {
        const res = await query(
          `INSERT INTO organizations (name, slug, organization_type, contact_email, status, verification_status)
           VALUES ($1, $2, $3, $4, 'active', 'verified')
           RETURNING id, slug`,
          [o.name, o.slug, o.type, o.email]
        );
        if (res.rows[0]) {
          orgMap[o.slug] = res.rows[0].id;
        }
      }
    }

    // 2. Seed Categories
    const categories = [
      { code: 'CAT_CIVIL', name: 'Civil & Infrastructure' },
      { code: 'CAT_ICT', name: 'ICT & Software' },
      { code: 'CAT_RE', name: 'Renewable Energy' },
      { code: 'CAT_MED', name: 'Medical & Logistics' },
      { code: 'CAT_PROF', name: 'Professional Services' },
    ];

    const catMap: Record<string, string> = {};

    for (const c of categories) {
      const existingCat = await query('SELECT id FROM categories WHERE code = $1 LIMIT 1', [c.code]);
      if (existingCat.rows.length > 0) {
        catMap[c.code] = existingCat.rows[0].id;
      } else {
        const res = await query(
          `INSERT INTO categories (name, code) VALUES ($1, $2) RETURNING id`,
          [c.name, c.code]
        );
        if (res.rows[0]) {
          catMap[c.code] = res.rows[0].id;
          clearReferenceCache('categories');
        }
      }
    }

    // 3. Seed Calls / Tenders
    const calls = [
      {
        ref: 'GRC/WORKS/2026/014',
        title: 'Construction of Gaborone South Stormwater Drainage Network (Phase II)',
        orgSlug: 'org-grc',
        type: 'rfp',
        summary: 'Civil engineering works for stormwater infrastructure in Gaborone South, including channel widening, culverts, and road reinstatement.',
        desc: 'The Gaborone Regional Council invites sealed bids from registered 100% citizen-owned contractors for Phase II stormwater construction. Bidders must possess valid PPRA Code 01 (Civil Engineering), Subcode 01 (Grade D/E).',
        estValue: 12500000.0,
        closesAt: new Date(Date.now() + 28 * 86400000).toISOString(),
        clarificationDeadline: new Date(Date.now() + 14 * 86400000).toISOString(),
        catCode: 'CAT_CIVIL',
      },
      {
        ref: 'DEB/ICT/2026/088',
        title: 'Supply, Implementation, and Support of Enterprise Cybersecurity Operations Framework',
        orgSlug: 'org-debswana',
        type: 'rfp',
        summary: 'Turnkey SOC deployment, SIEM implementation, and 24/7 managed security monitoring across Jwaneng and Orapa mine operations.',
        desc: 'Debswana Diamond Company requires a tier-1 cybersecurity partner to deploy threat monitoring tools, automated response playbooks, and local technical skills transfer.',
        estValue: 8400000.0,
        closesAt: new Date(Date.now() + 21 * 86400000).toISOString(),
        clarificationDeadline: new Date(Date.now() + 10 * 86400000).toISOString(),
        catCode: 'CAT_ICT',
      },
      {
        ref: 'BPC/RE/2026/003',
        title: 'Engineering, Procurement, & Construction (EPC) of 15MW Grid-Tied Solar PV Plant',
        orgSlug: 'org-bpc',
        type: 'rfp',
        summary: 'Design, supply, installation, testing, and commissioning of a 15MW solar PV facility in Tutume District.',
        desc: 'Botswana Power Corporation invites international and local joint ventures to submit turnkey EPC proposals for grid-tied solar generation. EDD citizen participation preferences apply.',
        estValue: 45000000.0,
        closesAt: new Date(Date.now() + 45 * 86400000).toISOString(),
        clarificationDeadline: new Date(Date.now() + 20 * 86400000).toISOString(),
        catCode: 'CAT_RE',
      },
      {
        ref: 'BURS/SUP/2026/001',
        title: 'Annual Registration Drive for Citizen Contractors & Professional Consultants',
        orgSlug: 'org-burs',
        type: 'registration_drive',
        summary: 'Open continuous registration drive for citizen suppliers across all procurement categories for FY 2026/2027.',
        desc: 'BURS invites all qualified 100% citizen-owned entities to submit their Supplier Passport credentials to qualify for BURS direct sourcing and restricted bidding rosters.',
        estValue: 0,
        closesAt: new Date(Date.now() + 180 * 86400000).toISOString(),
        clarificationDeadline: new Date(Date.now() + 90 * 86400000).toISOString(),
        catCode: 'CAT_PROF',
      },
    ];

    for (const call of calls) {
      const orgId = orgMap[call.orgSlug];
      if (!orgId) continue;

      const existingCall = await query('SELECT id FROM calls WHERE reference_no = $1 LIMIT 1', [call.ref]);
      if (existingCall.rows.length === 0) {
        const res = await query(
          `INSERT INTO calls (
            organization_id, reference_no, title, call_type, summary, description,
            status, visibility, estimated_value, currency, opens_at, closes_at, clarification_deadline,
            created_by_user_id
          )
          VALUES ($1, $2, $3, $4, $5, $6, 'open', 'open', $7, 'BWP', NOW(), $8, $9, $10)
          RETURNING id`,
          [
            orgId,
            call.ref,
            call.title,
            call.type,
            call.summary,
            call.desc,
            call.estValue,
            call.closesAt,
            call.clarificationDeadline,
            systemUserId,
          ]
        );

        const callId = res.rows[0]?.id;
        const catId = catMap[call.catCode];
        if (callId && catId) {
          await query(
            `INSERT INTO call_categories (call_id, category_id) VALUES ($1, $2)`,
            [callId, catId]
          );
        }
      }
    }

    console.log('[DB SEED SUCCESS] All initial organizations, categories, and calls seeded in PostgreSQL!');
  } catch (err: any) {
    console.error('[DB SEED ERROR] Seed execution issue:', err.message);
  }
}

if (process.argv[1]?.includes('seed.ts')) {
  seedDatabase().then(() => process.exit(0));
}
