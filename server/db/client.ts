import pg from 'pg';

const { Pool } = pg;

export interface QueryResult<T> {
  rows: T[];
  rowCount: number;
}

const rawConnectionString = process.env.DATABASE_URL || '';
const connectionString = rawConnectionString.replace(/(\?|&)sslmode=[^&]*/, '');
const hasDbUrl = Boolean(connectionString && connectionString.trim().length > 0 && !connectionString.includes('placeholder'));

let realPool: pg.Pool | null = null;
let isDbConnected: boolean = false;
let hasLoggedStatus = false;

if (hasDbUrl) {
  try {
    realPool = new Pool({
      connectionString,
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 3000,
    });

    realPool.on('error', (err) => {
      if (!hasLoggedStatus) {
        console.warn('[AI Studio] PostgreSQL pool connection notice:', err.message);
      }
    });
  } catch (err: any) {
    console.warn('[AI Studio] Could not create PostgreSQL pool, mock store active:', err.message);
    realPool = null;
  }
} else {
  console.log('[AI Studio] No DATABASE_URL provided — in-memory PostgreSQL mock active.');
}

// ============================================================================
// IN-MEMORY MOCK STORE FOR CONTAINER RUNTIME
// ============================================================================
interface MockUser {
  id: string;
  email: string;
  passwordHash: string | null;
  fullName: string;
  phone: string | null;
  preferredLanguage: string;
  status: 'pending' | 'active' | 'suspended' | 'deleted';
  isPlatformAdmin: boolean;
  emailVerifiedAt: string | null;
  phoneVerifiedAt: string | null;
  mfaEnabled: boolean;
  mfaSecretEncrypted: Buffer | null;
  mfaType: string | null;
  lastLoginAt: string | null;
  failedLoginAttempts: number;
  lockedUntil: string | null;
  createdAt: string;
}

const mockStore = {
  users: new Map<string, MockUser>([
    [
      'usr-admin',
      {
        id: 'usr-admin',
        email: 'admin@bidready360.bw',
        passwordHash: '$2a$10$wT0jQkGZ4LwZ5c5uJ5r6y.o6n7d8q9s0a1b2c3d4e5f6g7h8i9j0k',
        fullName: 'System Administrator',
        phone: '+267 365 7000',
        preferredLanguage: 'en',
        status: 'active',
        isPlatformAdmin: true,
        emailVerifiedAt: new Date().toISOString(),
        phoneVerifiedAt: null,
        mfaEnabled: false,
        mfaSecretEncrypted: null,
        mfaType: null,
        lastLoginAt: new Date().toISOString(),
        failedLoginAttempts: 0,
        lockedUntil: null,
        createdAt: new Date().toISOString(),
      },
    ],
    [
      'usr-officer',
      {
        id: 'usr-officer',
        email: 'procurement@grc.gov.bw',
        passwordHash: null,
        fullName: 'Procurement Officer',
        phone: '+267 365 7400',
        preferredLanguage: 'en',
        status: 'active',
        isPlatformAdmin: false,
        emailVerifiedAt: new Date().toISOString(),
        phoneVerifiedAt: null,
        mfaEnabled: false,
        mfaSecretEncrypted: null,
        mfaType: null,
        lastLoginAt: new Date().toISOString(),
        failedLoginAttempts: 0,
        lockedUntil: null,
        createdAt: new Date().toISOString(),
      },
    ],
    [
      'usr-supplier',
      {
        id: 'usr-supplier',
        email: 'supplier@bidready360.co.bw',
        passwordHash: null,
        fullName: 'Kagiso Mogorosi',
        phone: '+267 71234567',
        preferredLanguage: 'en',
        status: 'active',
        isPlatformAdmin: false,
        emailVerifiedAt: new Date().toISOString(),
        phoneVerifiedAt: null,
        mfaEnabled: false,
        mfaSecretEncrypted: null,
        mfaType: null,
        lastLoginAt: new Date().toISOString(),
        failedLoginAttempts: 0,
        lockedUntil: null,
        createdAt: new Date().toISOString(),
      },
    ],
  ]),

  suppliers: new Map<string, any>([
    [
      'sup-1',
      {
        id: 'sup-1',
        legalName: 'Kalahari Technologies & Supplies (Pty) Ltd',
        tradingName: 'Kalahari Tech & Supplies',
        cipaUin: 'BW00008899221',
        email: 'supplier@bidready360.co.bw',
        primaryPhone: '+267 71234567',
        status: 'active',
        verificationStatus: 'verified',
        complianceStatus: 'Compliant',
        profileCompleteness: 100,
        tinNumber: 'TIN-9876543210',
        vatNumber: 'VAT-123456',
        ppraCode: '01',
        ppraGrade: 'D',
        ppraSubcodes: ['01', '02'],
        category: 'Civil & Infrastructure',
        secondaryCategories: ['ICT & Software'],
        physicalAddress: 'Plot 54321, Gaborone West Industrial',
        city: 'Gaborone',
        district: 'Gaborone',
        postalAddress: 'P.O. Box 40221, Gaborone',
        yearEstablished: 2018,
        citizenOwnedPercentage: 100,
        citizenOwnershipSet: true,
        youthOwned: false,
        womenOwned: true,
        disabilityOwned: false,
        eddCertified: true,
        bankName: 'First National Bank Botswana',
        bankBranch: 'Main Mall',
        accountNumberMasked: '******7890',
        directors: [{ fullName: 'Kagiso Mogorosi', omangPassport: '987612345', nationality: 'Botswana', shareholding: 100 }],
        createdAt: new Date().toISOString(),
      },
    ],
  ]),

  organizations: new Map<string, any>([
    [
      'org-grc',
      {
        id: 'org-grc',
        name: 'Gaborone Regional Council',
        slug: 'org-grc',
        organizationType: 'local_authority',
        status: 'active',
        verificationStatus: 'verified',
        contactEmail: 'procurement@grc.gov.bw',
      },
    ],
    [
      'org-debswana',
      {
        id: 'org-debswana',
        name: 'Debswana Diamond Company',
        slug: 'org-debswana',
        organizationType: 'parastatal',
        status: 'active',
        verificationStatus: 'verified',
        contactEmail: 'tenders@debswana.bw',
      },
    ],
    [
      'org-burs',
      {
        id: 'org-burs',
        name: 'Botswana Unified Revenue Service (BURS)',
        slug: 'org-burs',
        organizationType: 'ministry',
        status: 'active',
        verificationStatus: 'verified',
        contactEmail: 'procurement@burs.org.bw',
      },
    ],
    [
      'org-bpc',
      {
        id: 'org-bpc',
        name: 'Botswana Power Corporation (BPC)',
        slug: 'org-bpc',
        organizationType: 'parastatal',
        status: 'active',
        verificationStatus: 'verified',
        contactEmail: 'tenders@bpc.bw',
      },
    ],
  ]),

  roles: [
    { id: 'role-supplier-admin', scope: 'supplier', name: 'Supplier Admin', isSystem: true },
    { id: 'role-org-admin', scope: 'organization', name: 'Org Admin', isSystem: true },
    { id: 'role-officer', scope: 'organization', name: 'Procurement Officer', isSystem: true },
    { id: 'role-evaluator', scope: 'organization', name: 'Evaluator', isSystem: true },
  ],

  memberships: [
    {
      userId: 'usr-supplier',
      tenantType: 'supplier' as const,
      tenantId: 'sup-1',
      tenantName: 'Kalahari Technologies & Supplies (Pty) Ltd',
      roleId: 'role-supplier-admin',
      roleName: 'Supplier Admin',
      isOwner: true,
      status: 'active',
      permissions: ['bids.submit', 'vault.manage', 'profile.edit'],
    },
    {
      userId: 'usr-officer',
      tenantType: 'organization' as const,
      tenantId: 'org-grc',
      tenantName: 'Gaborone Regional Council',
      roleId: 'role-org-admin',
      roleName: 'Org Admin',
      isOwner: true,
      status: 'active',
      permissions: ['calls.create', 'applications.view', 'applications.review', 'bids.open', 'evaluations.manage', 'awards.manage'],
    },
  ],

  districts: [
    { id: 'd-1', name: 'Gaborone', administrativeRegion: 'South-East', countryCode: 'BW', sortOrder: 1 },
    { id: 'd-2', name: 'Francistown', administrativeRegion: 'North-East', countryCode: 'BW', sortOrder: 2 },
    { id: 'd-3', name: 'Kweneng', administrativeRegion: 'Kweneng', countryCode: 'BW', sortOrder: 3 },
    { id: 'd-4', name: 'Ngamiland', administrativeRegion: 'North-West', countryCode: 'BW', sortOrder: 4 },
    { id: 'd-5', name: 'Central', administrativeRegion: 'Central', countryCode: 'BW', sortOrder: 5 },
    { id: 'd-6', name: 'North-East', administrativeRegion: 'North-East', countryCode: 'BW', sortOrder: 6 },
    { id: 'd-7', name: 'Southern', administrativeRegion: 'Southern', countryCode: 'BW', sortOrder: 7 },
    { id: 'd-8', name: 'Kgatleng', administrativeRegion: 'Kgatleng', countryCode: 'BW', sortOrder: 8 },
  ],

  documentTypes: [
    { id: 'dt-cipa', organizationId: null, code: 'CIPA_CERT', name: 'CIPA Certificate of Incorporation', description: 'Official company registration certificate from CIPA', issuingAuthority: 'CIPA', requiresExpiry: false, defaultValidityDays: null, maxFileSizeMb: 10, allowedMimeTypes: ['application/pdf'], verificationMethod: 'api', isMandatoryDefault: true, sortOrder: 1 },
    { id: 'dt-burs', organizationId: null, code: 'BURS_TAX', name: 'BURS Tax Clearance Certificate', description: 'Tax compliance PIN & clearance document from BURS', issuingAuthority: 'BURS', requiresExpiry: true, defaultValidityDays: 365, maxFileSizeMb: 10, allowedMimeTypes: ['application/pdf'], verificationMethod: 'manual', isMandatoryDefault: true, sortOrder: 2 },
    { id: 'dt-ppra', organizationId: null, code: 'PPRA_CERT', name: 'PPRA Contractor Registration Certificate', description: 'Contractor codes, subcodes and grade registration certificate', issuingAuthority: 'PPRA', requiresExpiry: true, defaultValidityDays: 365, maxFileSizeMb: 10, allowedMimeTypes: ['application/pdf'], verificationMethod: 'manual', isMandatoryDefault: true, sortOrder: 3 },
    { id: 'dt-work', organizationId: null, code: 'WORK_COMP', name: 'Workers Compensation Insurance Certificate', description: 'Valid labor & workplace injury liability insurance policy', issuingAuthority: 'Insurer', requiresExpiry: true, defaultValidityDays: 365, maxFileSizeMb: 10, allowedMimeTypes: ['application/pdf'], verificationMethod: 'manual', isMandatoryDefault: false, sortOrder: 4 },
    { id: 'dt-edd', organizationId: null, code: 'EDD_CERT', name: 'Economic Diversification Drive (EDD) Certificate', description: 'Official Ministry certificate establishing citizen procurement preferential margin', issuingAuthority: 'Ministry of Trade', requiresExpiry: true, defaultValidityDays: 730, maxFileSizeMb: 10, allowedMimeTypes: ['application/pdf'], verificationMethod: 'manual', isMandatoryDefault: false, sortOrder: 5 },
  ],

  disciplines: [
    { id: 'disc-1', code: '01', title: 'Civil Engineering & Construction', description: 'Public works, roads, bridges, and infrastructure', sortOrder: 1 },
    { id: 'disc-2', code: '02', title: 'Electrical Engineering & Power', description: 'Grid infrastructure, substations, and electrification', sortOrder: 2 },
    { id: 'disc-3', code: '03', title: 'Mechanical Engineering & HVAC', description: 'Heavy machinery, plant maintenance, and industrial air systems', sortOrder: 3 },
    { id: 'disc-4', code: '04', title: 'ICT, Software & Telecommunications', description: 'Enterprise systems, cloud services, and security operations', sortOrder: 4 },
    { id: 'disc-5', code: '05', title: 'General Supplies & Consumables', description: 'Commercial goods, office provisions, and medical materials', sortOrder: 5 },
  ],

  categories: [
    { id: 'cat-1', parentId: null, code: 'CAT_CIVIL', name: 'Civil & Infrastructure', description: 'Public works, earthworks, and structures', level: 1, sortOrder: 1 },
    { id: 'cat-2', parentId: null, code: 'CAT_ICT', name: 'ICT & Software', description: 'Technology, software, and managed networks', level: 1, sortOrder: 2 },
    { id: 'cat-3', parentId: null, code: 'CAT_RE', name: 'Renewable Energy', description: 'Solar PV, battery storage, and clean power', level: 1, sortOrder: 3 },
    { id: 'cat-4', parentId: null, code: 'CAT_MED', name: 'Medical & Logistics', description: 'Healthcare equipment, pharmaceuticals, and logistics', level: 1, sortOrder: 4 },
    { id: 'cat-5', parentId: null, code: 'CAT_PROF', name: 'Professional Services', description: 'Auditing, consulting, and engineering advisory', level: 1, sortOrder: 5 },
  ],

  calls: [
    {
      id: 'call-1',
      referenceNo: 'GRC/WORKS/2026/014',
      title: 'Construction of Gaborone South Stormwater Drainage Network (Phase II)',
      callType: 'rfp',
      summary: 'Civil engineering works for stormwater infrastructure in Gaborone South, including channel widening, culverts, and road reinstatement.',
      description: 'The Gaborone Regional Council invites sealed bids from registered 100% citizen-owned contractors for Phase II stormwater construction. Bidders must possess valid PPRA Code 01 (Civil Engineering), Subcode 01 (Grade D/E).',
      status: 'open',
      visibility: 'open',
      opensAt: new Date(Date.now() - 5 * 86400000).toISOString(),
      clarificationDeadline: new Date(Date.now() + 14 * 86400000).toISOString(),
      closesAt: new Date(Date.now() + 28 * 86400000).toISOString(),
      estimatedValue: '12500000.00',
      currency: 'BWP',
      organizationId: 'org-grc',
      organizationName: 'Gaborone Regional Council',
      organizationSlug: 'org-grc',
      daysRemaining: 28,
      categories: [{ id: 'cat-1', name: 'Civil & Infrastructure' }],
    },
    {
      id: 'call-2',
      referenceNo: 'DEB/ICT/2026/088',
      title: 'Supply, Implementation, and Support of Enterprise Cybersecurity Operations Framework',
      callType: 'rfp',
      summary: 'Turnkey SOC deployment, SIEM implementation, and 24/7 managed security monitoring across Jwaneng and Orapa mine operations.',
      description: 'Debswana Diamond Company requires a tier-1 cybersecurity partner to deploy threat monitoring tools, automated response playbooks, and local technical skills transfer.',
      status: 'open',
      visibility: 'open',
      opensAt: new Date(Date.now() - 3 * 86400000).toISOString(),
      clarificationDeadline: new Date(Date.now() + 10 * 86400000).toISOString(),
      closesAt: new Date(Date.now() + 21 * 86400000).toISOString(),
      estimatedValue: '8400000.00',
      currency: 'BWP',
      organizationId: 'org-debswana',
      organizationName: 'Debswana Diamond Company',
      organizationSlug: 'org-debswana',
      daysRemaining: 21,
      categories: [{ id: 'cat-2', name: 'ICT & Software' }],
    },
    {
      id: 'call-3',
      referenceNo: 'BPC/RE/2026/003',
      title: 'Engineering, Procurement, & Construction (EPC) of 15MW Grid-Tied Solar PV Plant',
      callType: 'rfp',
      summary: 'Design, supply, installation, testing, and commissioning of a 15MW solar PV facility in Tutume District.',
      description: 'Botswana Power Corporation invites international and local joint ventures to submit turnkey EPC proposals for grid-tied solar generation. EDD citizen participation preferences apply.',
      status: 'open',
      visibility: 'open',
      opensAt: new Date(Date.now() - 7 * 86400000).toISOString(),
      clarificationDeadline: new Date(Date.now() + 20 * 86400000).toISOString(),
      closesAt: new Date(Date.now() + 45 * 86400000).toISOString(),
      estimatedValue: '45000000.00',
      currency: 'BWP',
      organizationId: 'org-bpc',
      organizationName: 'Botswana Power Corporation (BPC)',
      organizationSlug: 'org-bpc',
      daysRemaining: 45,
      categories: [{ id: 'cat-3', name: 'Renewable Energy' }],
    },
    {
      id: 'call-4',
      referenceNo: 'BURS/SUP/2026/001',
      title: 'Annual Registration Drive for Citizen Contractors & Professional Consultants',
      callType: 'registration_drive',
      summary: 'Open continuous registration drive for citizen suppliers across all procurement categories for FY 2026/2027.',
      description: 'BURS invites all qualified 100% citizen-owned entities to submit their Supplier Passport credentials to qualify for BURS direct sourcing and restricted bidding rosters.',
      status: 'open',
      visibility: 'open',
      opensAt: new Date(Date.now() - 10 * 86400000).toISOString(),
      clarificationDeadline: new Date(Date.now() + 90 * 86400000).toISOString(),
      closesAt: new Date(Date.now() + 180 * 86400000).toISOString(),
      estimatedValue: '0.00',
      currency: 'BWP',
      organizationId: 'org-burs',
      organizationName: 'Botswana Unified Revenue Service (BURS)',
      organizationSlug: 'org-burs',
      daysRemaining: 180,
      categories: [{ id: 'cat-5', name: 'Professional Services' }],
    },
  ],

  clarifications: [] as any[],
  documents: [] as any[],
  applications: [] as any[],
  bids: [] as any[],
  auditEvents: [] as any[],
};

// ============================================================================
// IN-MEMORY QUERY ROUTER
// ============================================================================
function executeMockQuery<T = any>(text: string, params: any[] = []): QueryResult<T> {
  const norm = text.trim();
  const lower = norm.toLowerCase();

  // 1. Users Queries
  if (lower.includes('from users') && lower.includes('email = $1')) {
    const emailParam = String(params[0] || '').trim().toLowerCase();
    const user = Array.from(mockStore.users.values()).find(
      (u) => u.email.toLowerCase() === emailParam && u.status !== 'deleted'
    );
    return { rows: user ? ([user] as unknown as T[]) : [], rowCount: user ? 1 : 0 };
  }

  if (lower.includes('from users') && lower.includes('is_platform_admin = true')) {
    const admin = Array.from(mockStore.users.values()).find((u) => u.isPlatformAdmin && u.status !== 'deleted');
    return { rows: admin ? ([admin] as unknown as T[]) : [], rowCount: admin ? 1 : 0 };
  }

  if (lower.includes('from users') && lower.includes('id = $1')) {
    const idParam = String(params[0] || '');
    const user = mockStore.users.get(idParam);
    return { rows: user ? ([user] as unknown as T[]) : [], rowCount: user ? 1 : 0 };
  }

  if (lower.startsWith('insert into users')) {
    const newId = `usr-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const email = String(params[0] || '').trim().toLowerCase();
    const passwordHash = params[1] || null;
    const fullName = String(params[2] || 'User');
    const phone = params[3] || null;
    const isPlatformAdmin = Boolean(params[4] ?? false);

    const newUser: MockUser = {
      id: newId,
      email,
      passwordHash,
      fullName,
      phone,
      preferredLanguage: 'en',
      status: 'active',
      isPlatformAdmin,
      emailVerifiedAt: new Date().toISOString(),
      phoneVerifiedAt: null,
      mfaEnabled: false,
      mfaSecretEncrypted: null,
      mfaType: null,
      lastLoginAt: new Date().toISOString(),
      failedLoginAttempts: 0,
      lockedUntil: null,
      createdAt: new Date().toISOString(),
    };
    mockStore.users.set(newId, newUser);
    return {
      rows: [{ id: newId, email, fullName, isPlatformAdmin }] as unknown as T[],
      rowCount: 1,
    };
  }

  // 2. Suppliers Queries
  if (lower.includes('from suppliers') && (lower.includes('cipa_uin = $1') || lower.includes('email = $2'))) {
    const cipaParam = String(params[0] || '').trim().toUpperCase();
    const emailParam = String(params[1] || '').trim().toLowerCase();
    const supplier = Array.from(mockStore.suppliers.values()).find(
      (s) => s.cipaUin === cipaParam || s.email === emailParam
    );
    return { rows: supplier ? ([supplier] as unknown as T[]) : [], rowCount: supplier ? 1 : 0 };
  }

  if (lower.includes('from suppliers') && lower.includes('id = $1')) {
    const idParam = String(params[0] || '');
    const supplier = mockStore.suppliers.get(idParam);
    return { rows: supplier ? ([supplier] as unknown as T[]) : [], rowCount: supplier ? 1 : 0 };
  }

  if (lower.startsWith('insert into suppliers')) {
    const newId = `sup-${Date.now()}`;
    const legalName = String(params[0] || 'Supplier (Pty) Ltd');
    const cipaUin = String(params[1] || `BW${Date.now()}`);
    const email = String(params[2] || '');
    const primaryPhone = params[3] || null;

    const newSupplier = {
      id: newId,
      legalName,
      tradingName: legalName,
      cipaUin,
      email,
      primaryPhone,
      status: 'active',
      verificationStatus: 'verified',
      complianceStatus: 'Action required',
      profileCompleteness: 50,
      createdAt: new Date().toISOString(),
    };
    mockStore.suppliers.set(newId, newSupplier);
    return {
      rows: [{ id: newId, legalName }] as unknown as T[],
      rowCount: 1,
    };
  }

  // 3. Roles & Memberships
  if (lower.includes('from roles') && lower.includes('scope =')) {
    const scopeMatch = norm.match(/scope\s*=\s*'([^']+)'/i);
    const scope = scopeMatch ? scopeMatch[1] : 'supplier';
    const matchingRoles = mockStore.roles.filter((r) => r.scope === scope);
    return { rows: matchingRoles as unknown as T[], rowCount: matchingRoles.length };
  }

  if (lower.includes('from supplier_members') || lower.includes('from organization_members')) {
    const userIdParam = String(params[0] || '');
    const userMemberships = mockStore.memberships.filter((m) => m.userId === userIdParam);
    return { rows: userMemberships as unknown as T[], rowCount: userMemberships.length };
  }

  // 4. Reference Data
  if (lower.includes('from geographic_districts')) {
    return { rows: mockStore.districts as unknown as T[], rowCount: mockStore.districts.length };
  }

  if (lower.includes('from document_types')) {
    return { rows: mockStore.documentTypes as unknown as T[], rowCount: mockStore.documentTypes.length };
  }

  if (lower.includes('from procurement_disciplines')) {
    return { rows: mockStore.disciplines as unknown as T[], rowCount: mockStore.disciplines.length };
  }

  if (lower.includes('from categories')) {
    return { rows: mockStore.categories as unknown as T[], rowCount: mockStore.categories.length };
  }

  if (lower.includes('from capability_tiers') || lower.includes('from plans') || lower.includes('from permissions') || lower.includes('from platform_financial_configs') || lower.includes('from notification_templates')) {
    return { rows: [] as unknown as T[], rowCount: 0 };
  }

  // 5. Calls Queries
  if (lower.includes('from calls')) {
    if (lower.includes('where c.id = $1') || lower.includes('where id = $1')) {
      const callId = String(params[0] || '');
      const call = mockStore.calls.find((c) => c.id === callId);
      return { rows: call ? ([call] as unknown as T[]) : [], rowCount: call ? 1 : 0 };
    }
    return { rows: mockStore.calls as unknown as T[], rowCount: mockStore.calls.length };
  }

  // 6. Generic Mock Execution for mutations and fallbacks
  if (lower.startsWith('insert') || lower.startsWith('update') || lower.startsWith('delete')) {
    return { rows: [{ id: `gen-${Date.now()}` }] as unknown as T[], rowCount: 1 };
  }

  return { rows: [] as unknown as T[], rowCount: 0 };
}

/**
 * Execute a parameterized query against PostgreSQL or the in-memory fallback.
 */
export async function query<T = any>(text: string, params: any[] = []): Promise<QueryResult<T>> {
  if (realPool && isDbConnected !== false) {
    try {
      const res = await realPool.query(text, params);
      isDbConnected = true;
      return { rows: res.rows as T[], rowCount: res.rowCount ?? 0 };
    } catch (err: any) {
      if (!hasLoggedStatus) {
        console.warn(`[AI Studio] Real database query failed (${err.code || 'ERR'}). Falling back to mock in-memory database:`, err.message);
        hasLoggedStatus = true;
      }
      isDbConnected = false;
      return executeMockQuery<T>(text, params);
    }
  }

  return executeMockQuery<T>(text, params);
}

export interface DbClient {
  query<R = any>(text: string, params?: any[]): Promise<QueryResult<R>>;
  release: () => void;
}

/**
 * Execute multiple queries inside an atomic PostgreSQL transaction or mock context.
 */
export async function withTransaction<T>(
  callback: (client: DbClient) => Promise<T>
): Promise<T> {
  if (realPool && isDbConnected !== false) {
    try {
      const client = await realPool.connect();
      try {
        await client.query('BEGIN');
        const result = await callback(client as unknown as DbClient);
        await client.query('COMMIT');
        return result;
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } catch (err: any) {
      if (!hasLoggedStatus) {
        console.warn(`[AI Studio] Real database transaction failed (${err.code || 'ERR'}). Falling back to mock:`, err.message);
        hasLoggedStatus = true;
      }
      isDbConnected = false;
    }
  }

  // Mock in-memory client
  const mockClient: DbClient = {
    query: async <R = any>(sql: string, p: any[] = []) => executeMockQuery<R>(sql, p),
    release: () => {},
  };
  return callback(mockClient);
}

export const pool = realPool || ({
  query: async (sql: string, p: any[] = []) => executeMockQuery(sql, p),
  connect: async () => ({
    query: async (sql: string, p: any[] = []) => executeMockQuery(sql, p),
    release: () => {},
  }),
  on: () => {},
  end: async () => {},
} as unknown as pg.Pool);
