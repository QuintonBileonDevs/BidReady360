import { query } from './client';

export async function seedDatabase() {
  console.log('[DB SEED] Seeding initial database records...');

  try {
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
