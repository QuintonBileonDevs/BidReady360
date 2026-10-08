import { Supplier, SupplierDocument, Application, ConsentGrant } from '../types';

export interface PastProject {
  id: string;
  client: string;
  title: string;
  valueBWP: number;
  startDate: string;
  endDate: string;
  referenceContact: {
    name: string;
    role: string;
    email: string;
    phone: string;
  };
  status: 'Completed' | 'Ongoing';
}

export interface SupplierTeamMember {
  id: string;
  name: string;
  email: string;
  role: 'Supplier admin' | 'Supplier staff';
  lastActive: string;
  status: 'Active' | 'Invited';
}

export const DEMO_PAST_PROJECTS: PastProject[] = [
  {
    id: 'proj-demo-1',
    client: 'Gaborone Regional Council',
    title: 'Supply of Structural Timber & Roofing Trusses for Block 8 Clinic Expansion',
    valueBWP: 2340000,
    startDate: 'Jan 2025',
    endDate: 'Aug 2025',
    referenceContact: {
      name: 'K. Tau',
      role: 'Lead Procurement Specialist',
      email: 'k.tau@grc.gov.bw',
      phone: '+267 72 310 980',
    },
    status: 'Completed',
  },
  {
    id: 'proj-demo-2',
    client: 'Botswana Housing Corporation',
    title: 'Bulk Delivery of SABS Certified Cement & Masonry Supplies (Tsholofelo Park)',
    valueBWP: 4850000,
    startDate: 'Mar 2024',
    endDate: 'Nov 2024',
    referenceContact: {
      name: 'O. Sechele',
      role: 'Project Director',
      email: 'o.sechele@bhc.bw',
      phone: '+267 360 5100',
    },
    status: 'Completed',
  },
  {
    id: 'proj-demo-3',
    client: 'National Training Agency',
    title: 'Workshop Renovation & Facility Hardware Upgrade',
    valueBWP: 980000,
    startDate: 'Sep 2025',
    endDate: 'Ongoing',
    referenceContact: {
      name: 'M. Phiri',
      role: 'Facilities Engineer',
      email: 'm.phiri@nta.org.bw',
      phone: '+267 395 2100',
    },
    status: 'Ongoing',
  },
];

export const DEMO_TEAM_MEMBERS: SupplierTeamMember[] = [
  {
    id: 'tm-demo-1',
    name: 'Kagiso Molosiwa',
    email: 'k.molosiwa@kopanobuilding.co.bw',
    role: 'Supplier admin',
    lastActive: 'Active now',
    status: 'Active',
  },
  {
    id: 'tm-demo-2',
    name: 'Tshepo Matlapeng',
    email: 't.matlapeng@kopanobuilding.co.bw',
    role: 'Supplier staff',
    lastActive: '2 hrs ago',
    status: 'Active',
  },
];

export const DEMO_DOCUMENTS: SupplierDocument[] = [
  {
    id: 'doc-demo-cipa',
    documentType: 'CIPA Certificate of Incorporation',
    title: 'CIPA Certificate of Incorporation',
    documentNumber: 'BW00001234567',
    issuingAuthority: 'Companies and Intellectual Property Authority (CIPA)',
    issueDate: '2018-04-12',
    expiryDate: '2099-12-31',
    status: 'Verified',
    fileName: 'CIPA_Certificate_BW1234567.pdf',
    fileSize: '1.4 MB',
    uploadedAt: '2026-01-10',
    downloadUrl: '#',
    extractedFields: {
      'Company Name': 'Kopano Building Supplies (Pty) Ltd',
      UIN: 'BW00001234567',
      'Entity Type': 'Private Company Limited by Shares',
    },
  },
  {
    id: 'doc-demo-tax',
    documentType: 'BURS Tax Clearance Certificate',
    title: 'BURS Tax Clearance Certificate',
    documentNumber: 'BURS-TCC-2026-8819',
    issuingAuthority: 'Botswana Unified Revenue Service (BURS)',
    issueDate: '2026-03-01',
    expiryDate: '2027-02-28',
    status: 'Verified',
    fileName: 'BURS_Tax_Clearance_2026.pdf',
    fileSize: '890 KB',
    uploadedAt: '2026-03-05',
    downloadUrl: '#',
    extractedFields: {
      TIN: 'C12894002',
      'Good Standing': 'Compliant',
    },
  },
  {
    id: 'doc-demo-safety',
    documentType: 'Workers Compensation & Safety Compliance',
    title: 'Workers Compensation & Safety Compliance Policy',
    documentNumber: 'WCA-BW-55219',
    issuingAuthority: 'Department of Occupational Health & Safety',
    issueDate: '2026-02-15',
    expiryDate: '2027-02-14',
    status: 'Verified',
    fileName: 'Workers_Compensation_Safety_2026.pdf',
    fileSize: '1.1 MB',
    uploadedAt: '2026-02-20',
    downloadUrl: '#',
  },
  {
    id: 'doc-demo-insurance',
    documentType: 'Public Liability Insurance Policy',
    title: 'Public Liability Insurance Policy (BWP 5,000,000 Cover)',
    documentNumber: 'BIC-PL-90214-BW',
    issuingAuthority: 'Botswana Insurance Company (BIC)',
    issueDate: '2026-01-01',
    expiryDate: '2026-12-31',
    status: 'Verified',
    fileName: 'Public_Liability_Insurance_2026.pdf',
    fileSize: '1.6 MB',
    uploadedAt: '2026-01-05',
    downloadUrl: '#',
  },
  {
    id: 'doc-demo-ppra',
    documentType: 'PPRA Registration Certificate',
    title: 'PPRA Contractor Registration Certificate',
    documentNumber: 'PPRA-2025-C01-D49',
    issuingAuthority: 'Public Procurement Regulatory Authority (PPRA)',
    issueDate: '2025-06-01',
    expiryDate: '2027-05-31',
    status: 'Verified',
    fileName: 'PPRA_Registration_Code01_GradeD.pdf',
    fileSize: '1.2 MB',
    uploadedAt: '2025-06-10',
    downloadUrl: '#',
  },
];

export const DEMO_APPLICATIONS: Application[] = [
  {
    id: 'app-demo-1',
    callId: 'call-grc-works-01',
    callNumber: 'GRC/WORKS/2026/014',
    callTitle: 'Construction of Gaborone South Stormwater Drainage Network (Phase II)',
    callType: 'RFP',
    organizationId: 'org-grc',
    organizationName: 'Gaborone Regional Council',
    supplierId: 'sup-demo-kopano',
    supplierName: 'Kopano Building Supplies (Pty) Ltd',
    submittedAt: '2026-09-28 14:32',
    status: 'Under review',
    completenessScore: 100,
    answers: {},
    sharedDocumentIds: ['doc-demo-cipa', 'doc-demo-tax'],
    pinnedDocumentVersionIds: ['doc-demo-cipa', 'doc-demo-tax'],
    responses: [],
    timeline: [
      {
        id: 'tl-1',
        stage: 'Submitted',
        timestamp: '2026-09-28 14:32',
        author: 'Kagiso Molosiwa (Supplier Admin)',
        action: 'Application Submitted',
        note: 'Complete bid submission sealed and logged with receipt #GRC-9921.',
      },
      {
        id: 'tl-2',
        stage: 'Under review',
        timestamp: '2026-09-29 09:15',
        author: 'Gaborone Regional Council Procurement Unit',
        action: 'Stage 1 Administrative Compliance Verified',
        note: 'Mandatory CIPA and Tax Clearance validated.',
      },
    ],
  },
  {
    id: 'app-demo-2',
    callId: 'call-burs-reg-01',
    callNumber: 'BURS/SUP/2026/001',
    callTitle: 'Annual Registration Drive for Citizen Contractors & Professional Consultants',
    callType: 'Registration drive',
    organizationId: 'org-burs',
    organizationName: 'Botswana Unified Revenue Service (BURS)',
    supplierId: 'sup-demo-kopano',
    supplierName: 'Kopano Building Supplies (Pty) Ltd',
    submittedAt: '2026-08-15 11:10',
    status: 'Approved',
    completenessScore: 100,
    answers: {},
    sharedDocumentIds: ['doc-demo-cipa', 'doc-demo-tax', 'doc-demo-ppra'],
    pinnedDocumentVersionIds: ['doc-demo-cipa', 'doc-demo-tax', 'doc-demo-ppra'],
    responses: [],
    timeline: [
      {
        id: 'tl-3',
        stage: 'Submitted',
        timestamp: '2026-08-15 11:10',
        author: 'Kagiso Molosiwa (Supplier Admin)',
        action: 'Registration Submitted',
      },
      {
        id: 'tl-4',
        stage: 'Approved',
        timestamp: '2026-08-20 16:00',
        author: 'BURS Registrar',
        action: 'Application Approved',
        note: 'Supplier passport approved for 2026/2027 procurement roster.',
      },
    ],
  },
];

export const DEMO_CONSENT_GRANTS: ConsentGrant[] = [
  {
    id: 'cg-demo-1',
    organizationId: 'org-grc',
    organizationName: 'Gaborone Regional Council',
    grantedAt: '2026-09-20',
    validUntil: '2027-09-20',
    status: 'Active',
    scope: {
      profile: true,
      directors: true,
      financials: true,
      taxClearance: true,
      certifications: true,
    },
    accessedCount: 4,
    lastAccessedAt: '2026-10-02 11:24',
  },
  {
    id: 'cg-demo-2',
    organizationId: 'org-debswana',
    organizationName: 'Debswana Diamond Company',
    grantedAt: '2026-09-15',
    validUntil: '2027-09-15',
    status: 'Active',
    scope: {
      profile: true,
      directors: true,
      financials: false,
      taxClearance: true,
      certifications: true,
    },
    accessedCount: 2,
    lastAccessedAt: '2026-09-30 08:45',
  },
];

export const DEMO_SUPPLIER: Supplier = {
  id: 'sup-demo-kopano',
  legalName: 'Kopano Building Supplies (Pty) Ltd',
  tradingName: 'Kopano Hardware & Construction',
  cipaNumber: 'BW00001234567',
  tinNumber: 'C12894002',
  ppraCode: 'Code 01 (Building Works & Materials)',
  ppraSubcodes: ['Subcode 01 (Grade D)', 'Subcode 02 (Roofing)'],
  ppraGrade: 'Grade D',
  category: 'Building Works & Materials',
  secondaryCategories: ['Civil Engineering', 'General Procurement'],
  physicalAddress: 'Plot 22019, G-West Industrial',
  city: 'Gaborone',
  district: 'Gaborone',
  postalAddress: 'P.O. Box 4022, Gaborone',
  primaryPhone: '+267 391 4455',
  email: 'procurement@kopanobuilding.co.bw',
  website: 'https://www.kopanobuilding.co.bw',
  yearEstablished: 2018,
  citizenOwnedPercentage: 100,
  citizenOwnershipSet: true,
  youthOwned: false,
  womenOwned: true,
  disabilityOwned: false,
  eddCertified: true,
  bankName: 'First National Bank Botswana (FNBB)',
  bankBranch: 'Mall Branch, Gaborone',
  accountNumberMasked: '••••••••6491',
  directors: [
    {
      id: 'dir-demo-1',
      fullName: 'Kagiso Boitumelo Molosiwa',
      nationalIdOrPassport: '618219401',
      nationality: 'Motswana',
      isCitizen: true,
      shareholdingPercentage: 60,
      role: 'Managing Director',
    },
    {
      id: 'dir-demo-2',
      fullName: 'Lesego Tebogo Kgosi',
      nationalIdOrPassport: '529124018',
      nationality: 'Motswana',
      isCitizen: true,
      shareholdingPercentage: 40,
      role: 'Director',
    },
  ],
  profileCompleteness: 100,
  missingItems: [],
  complianceStatus: 'Fully compliant',
  documents: DEMO_DOCUMENTS,
  hasCipa: true,
  hasBurs: true,
  hasPpra: true,
  isDemoAccount: true,
  emailVerified: true,
  detailsSaved: true,
};
