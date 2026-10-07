/**
 * BidReady360 Mock Data & Entity Types
 * Single source of truth for in-memory procurement data in Botswana context.
 * All amounts in BWP (Botswana Pula).
 */

export interface Director {
  id: string;
  fullName: string;
  nationalIdOrPassport: string;
  nationality: string;
  isCitizen: boolean;
  shareholdingPercentage: number;
  role: string;
}

export interface DocumentVersion {
  version: number;
  uploadedBy: string;
  uploadedAt: string;
  fileFingerprint: string;
  fileName: string;
  fileSize: string;
  usedInApplications: string[];
}

export interface SupplierDocument {
  id: string;
  supplierId: string;
  documentType: 
    | 'CIPA Certificate of Incorporation'
    | 'BURS Tax Clearance Certificate'
    | 'PPRA Registration Certificate'
    | 'Workers Compensation & Safety Compliance'
    | 'Public Liability Insurance Policy'
    | 'Audited Financial Statements'
    | 'Bank Rating Letter'
    | 'Trading Licence';
  documentNumber: string;
  fileName: string;
  fileSize: string;
  issueDate: string;
  expiryDate: string;
  status: 'Verified' | 'Pending' | 'Expiring soon' | 'Expired' | 'Rejected' | 'Cannot verify';
  statusMessage?: string;
  rejectionReason?: string;
  verifiedAt?: string;
  verifiedBy?: string;
  downloadUrl: string;
  versionHistory?: DocumentVersion[];
  extractedFields?: { [key: string]: string };
}

export interface Supplier {
  id: string;
  legalName: string;
  tradingName: string;
  cipaNumber: string; // Botswana UIN / CIPA
  tinNumber: string;  // BURS Tax Identification Number
  ppraCode: string;   // Public Procurement Regulatory Authority Code
  ppraSubcodes: string[];
  ppraGrade: string;  // Grade A, B, C, D, E, Micro, Small
  category: string;
  secondaryCategories: string[];
  physicalAddress: string;
  city: string;
  district: string;
  postalAddress: string;
  primaryPhone: string;
  email: string;
  website?: string;
  yearEstablished: number;
  citizenOwnedPercentage: number;
  youthOwned: boolean;
  womenOwned: boolean;
  disabilityOwned: boolean;
  eddCertified: boolean; // Economic Diversification Drive
  bankName: string;
  bankBranch: string;
  accountNumberMasked: string;
  directors: Director[];
  profileCompleteness: number; // percentage 0-100
  missingItems: string[];
  complianceStatus: 'Fully compliant' | 'Action required' | 'Non-compliant';
  documents: SupplierDocument[];
}

export interface Organization {
  id: string;
  name: string;
  acronym: string;
  type: 'Local Authority' | 'Parastatal' | 'Central Government' | 'Private-Public Partnership' | 'Commercial Entity';
  district: string;
  city: string;
  logoText: string;
  contactEmail: string;
  contactPhone: string;
  address: string;
  activeCallsCount: number;
  suppliersRosterCount: number;
}

export interface FormFieldOption {
  label: string;
  value: string;
}

export interface FormField {
  id: string;
  label: string;
  type: 'text' | 'number' | 'dropdown' | 'date' | 'file_upload' | 'yes_no' | 'textarea';
  required: boolean;
  placeholder?: string;
  options?: FormFieldOption[];
  helpText?: string;
  conditionalOnFieldId?: string;
  conditionalValue?: string | boolean;
}

export interface FormTemplate {
  id: string;
  organizationId: string;
  title: string;
  version: string;
  description: string;
  fields: FormField[];
  updatedAt: string;
}

export interface PriceLineItem {
  id: string;
  itemNumber: number;
  description: string;
  unit: string;
  quantity: number;
  unitPriceBWP?: number;
  totalPriceBWP?: number;
}

export interface Call {
  id: string;
  callNumber: string;
  organizationId: string;
  organizationName: string;
  title: string;
  summary: string;
  type: 'Registration drive' | 'EOI' | 'RFP';
  category: string;
  subcategories: string[];
  location: string;
  estimatedBudgetBWP?: number;
  openingDate: string;
  clarificationDeadline: string;
  closingDate: string; // ISO or date string
  closingTimeCAT: string;
  status: 'Open' | 'Closed' | 'Under evaluation' | 'Awarded' | 'Draft';
  requiredDocumentTypes: string[];
  formTemplateId?: string;
  lineItems?: PriceLineItem[];
  daysRemaining: number;
  isSealed: boolean;
  documentsCount: number;
  applicationsCount: number;
  addenda: {
    id: string;
    number: number;
    title: string;
    issuedDate: string;
    summary: string;
    downloadUrl: string;
  }[];
}

export interface Clarification {
  id: string;
  callId: string;
  supplierId: string;
  supplierName: string;
  question: string;
  submittedAt: string;
  status: 'Answered' | 'Pending';
  answer?: string;
  answeredAt?: string;
  answeredBy?: string;
  isPublished: boolean;
}

export interface ConsentGrant {
  id: string;
  supplierId: string;
  organizationId: string;
  organizationName: string;
  grantedAt: string;
  expiryDate?: string;
  purpose?: string;
  status: 'Active' | 'Revoked';
  scope: {
    companyDetails: boolean;
    directorsOwners: boolean;
    pastProjects: boolean;
    selectedDocuments: boolean;
    taxCompliance?: boolean;
    financialStatements?: boolean;
    keyPersonnel?: boolean;
    pastContracts?: boolean;
    bankingDetails?: boolean;
  };
  selectedDocumentIds?: string[];
  selectedDocumentNames?: string[];
  tiedApplicationNumbers?: string[];
  lastAccessedAt?: string;
}

export interface ApplicationResponse {
  fieldId: string;
  label: string;
  value: string | number | boolean | null;
}

export interface Bid {
  id: string;
  applicationId: string;
  callId: string;
  supplierId: string;
  supplierName: string;
  currency: 'BWP';
  pricingLineItems: PriceLineItem[];
  totalAmountBWP: number;
  technicalProposalFileName: string;
  financialProposalFileName: string;
  isSealed: boolean;
  unsealedAt?: string;
  unsealedBy?: string;
  sealedHash: string;
}

export interface InformationRequest {
  id: string;
  requestedBy: string;
  requestedAt: string;
  dueDate: string;
  message: string;
  status: 'Pending response' | 'Responded';
  responseMessage?: string;
  respondedAt?: string;
  respondedBy?: string;
}

export interface Application {
  id: string;
  callId: string;
  callNumber: string;
  callTitle: string;
  callType: 'Registration drive' | 'EOI' | 'RFP';
  organizationId: string;
  organizationName: string;
  supplierId: string;
  supplierName: string;
  submittedAt: string;
  receiptNumber?: string;
  status: 'Draft' | 'Submitted' | 'Under review' | 'More information requested' | 'Approved' | 'Rejected' | 'Withdrawn';
  statusReason?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  decisionNote?: string;
  decisionDate?: string;
  reviewerMessages?: {
    id: string;
    sender: string;
    senderRole: string;
    timestamp: string;
    message: string;
  }[];
  informationRequest?: InformationRequest;
  withdrawnAt?: string;
  sharedDocumentIds: string[];
  responses: ApplicationResponse[];
  bid?: Bid;
  timeline: {
    stage: 'Draft' | 'Submitted' | 'Under review' | 'More information requested' | 'Approved' | 'Rejected' | 'Withdrawn';
    timestamp: string;
    note?: string;
  }[];
}

export interface Criterion {
  id: string;
  callId: string;
  title: string;
  description: string;
  weight: number; // e.g. 35 for 35%
  maxScore: number; // e.g. 100
}

export interface Score {
  id: string;
  callId: string;
  applicationId: string;
  evaluatorId: string;
  evaluatorName: string;
  evaluatorRole: string;
  criterionId: string;
  score: number; // 0 to maxScore
  comments: string;
  scoredAt: string;
}

export interface Evaluator {
  id: string;
  organizationId: string;
  name: string;
  role: string;
  department: string;
  hasDeclaredConflict: boolean;
  declarationDate?: string;
  conflictDetails?: string;
}

export interface AwardDecision {
  id: string;
  callId: string;
  callNumber: string;
  callTitle: string;
  recommendedSupplierId: string;
  recommendedSupplierName: string;
  awardedAmountBWP: number;
  justification: string;
  status: 'Draft' | 'Pending approval' | 'Approved & Published' | 'Rejected';
  draftedBy: string;
  draftedAt: string;
  approvedBy?: string;
  approvedAt?: string;
}

export interface AuditEvent {
  id: string;
  actorName: string;
  actorRole: 'Supplier' | 'Procurement Officer' | 'Evaluator' | 'Approver' | 'Auditor' | 'System' | 'Super Admin' | 'Operator';
  organizationName: string;
  action: string;
  entityType: 'Call' | 'Application' | 'Bid' | 'Document' | 'Consent' | 'Evaluation' | 'Award' | 'Form' | 'Organization' | 'Supplier';
  entityId: string;
  timestamp: string;
  details: string;
  ipAddress?: string;
}

export interface NotificationItem {
  id: string;
  recipientRole: 'Supplier' | 'Buyer';
  recipientId: string;
  title: string;
  message: string;
  timestamp: string;
  read: boolean;
  type: 'urgent' | 'info' | 'success' | 'warning';
  actionLink?: string;
}

// ==========================================
// INITIAL REALISTIC DATA SEED (BOTSWANA)
// ==========================================

export const INITIAL_ORGANIZATIONS: Organization[] = [
  {
    id: 'org-grc',
    name: 'Gaborone Regional Council',
    acronym: 'GRC',
    type: 'Local Authority',
    district: 'South-East District',
    city: 'Gaborone',
    logoText: 'GRC',
    contactEmail: 'procurement@grc.gov.bw',
    contactPhone: '+267 365 7400',
    address: 'Plot 101, Independence Avenue, Civic Centre, Gaborone',
    activeCallsCount: 3,
    suppliersRosterCount: 142,
  },
  {
    id: 'org-nta',
    name: 'National Training Agency',
    acronym: 'NTA',
    type: 'Parastatal',
    district: 'Gaborone',
    city: 'Gaborone',
    logoText: 'NTA',
    contactEmail: 'tenders@nta.org.bw',
    contactPhone: '+267 395 2100',
    address: 'Plot 4886, Station Road, Private Bag BO 198, Gaborone',
    activeCallsCount: 2,
    suppliersRosterCount: 98,
  },
  {
    id: 'org-bpc',
    name: 'Botswana Power Corporation',
    acronym: 'BPC',
    type: 'Parastatal',
    district: 'South-East District',
    city: 'Gaborone',
    logoText: 'BPC',
    contactEmail: 'supplychain@bpc.bw',
    contactPhone: '+267 360 3000',
    address: 'Motlakase House, Macheng Way, Industrial Site, Gaborone',
    activeCallsCount: 4,
    suppliersRosterCount: 215,
  },
  {
    id: 'org-debswana',
    name: 'Debswana Diamond Company Procurement',
    acronym: 'DEBSWANA',
    type: 'Private-Public Partnership',
    district: 'Southern District',
    city: 'Jwaneng',
    logoText: 'DEBS',
    contactEmail: 'commercial@debswana.bw',
    contactPhone: '+267 361 4000',
    address: 'Debswana Corporate Centre, Plot 75782, Airport Road, Gaborone',
    activeCallsCount: 2,
    suppliersRosterCount: 310,
  },
  {
    id: 'org-orc',
    name: 'Okavango Regional Council',
    acronym: 'ORC',
    type: 'Local Authority',
    district: 'North-West District',
    city: 'Shakawe',
    logoText: 'ORC',
    contactEmail: 'tenders@orc.gov.bw',
    contactPhone: '+267 687 5000',
    address: 'Civic Centre, Council Headquarters, Shakawe',
    activeCallsCount: 1,
    suppliersRosterCount: 84,
  },
];

export const CURRENT_SUPPLIER_DOCUMENTS: SupplierDocument[] = [
  {
    id: 'doc-cipa-01',
    supplierId: 'sup-kopano',
    documentType: 'CIPA Certificate of Incorporation',
    documentNumber: 'BW000034821',
    fileName: 'CIPA_Incorporation_Kopano_2026.pdf',
    fileSize: '1.4 MB',
    issueDate: '2019-04-12',
    expiryDate: '2028-12-31',
    status: 'Verified',
    statusMessage: 'Verified via CIPA Open Registry database.',
    verifiedAt: '2026-05-10',
    verifiedBy: 'System Auto-Verify',
    downloadUrl: '#',
    extractedFields: {
      'Company name': 'Kopano Building Supplies (Pty) Ltd',
      'UIN number': 'BW000034821',
      'Incorporation date': '12 April 2019',
      'Company type': 'Private Company (Pty) Ltd',
    },
    versionHistory: [
      {
        version: 1,
        uploadedBy: 'Kagiso Molosiwa (Supplier admin)',
        uploadedAt: '12 Apr 2019, 09:15',
        fileFingerprint: 'SHA-256: 7f8a9b...3c12',
        fileName: 'CIPA_Incorporation_Kopano_Initial.pdf',
        fileSize: '1.2 MB',
        usedInApplications: ['GRC/2024/W01'],
      },
      {
        version: 2,
        uploadedBy: 'Kagiso Molosiwa (Supplier admin)',
        uploadedAt: '10 May 2026, 11:30',
        fileFingerprint: 'SHA-256: c3e120...88ab',
        fileName: 'CIPA_Incorporation_Kopano_2026.pdf',
        fileSize: '1.4 MB',
        usedInApplications: ['GRC/2026/W04', 'NTA/RFP/2026/01'],
      },
    ],
  },
  {
    id: 'doc-tax-02',
    supplierId: 'sup-kopano',
    documentType: 'BURS Tax Clearance Certificate',
    documentNumber: 'TCC-2026-BURS-8849',
    fileName: 'BURS_Tax_Clearance_2026_2027.pdf',
    fileSize: '840 KB',
    issueDate: '2026-04-01',
    expiryDate: '2027-03-31',
    status: 'Verified',
    statusMessage: 'Good standing with Botswana Unified Revenue Service.',
    verifiedAt: '2026-04-05',
    verifiedBy: 'System Auto-Verify',
    downloadUrl: '#',
    extractedFields: {
      'Taxpayer PIN': 'C12894002',
      'Certificate number': 'TCC-2026-BURS-8849',
      'Issue date': '1 April 2026',
      'Valid through': '31 March 2027',
    },
    versionHistory: [
      {
        version: 1,
        uploadedBy: 'Kagiso Molosiwa (Supplier admin)',
        uploadedAt: '1 Apr 2025, 08:30',
        fileFingerprint: 'SHA-256: 12ab44...99ea',
        fileName: 'BURS_TCC_FY2025.pdf',
        fileSize: '810 KB',
        usedInApplications: ['BHC/2025/M02'],
      },
      {
        version: 2,
        uploadedBy: 'Kagiso Molosiwa (Supplier admin)',
        uploadedAt: '1 Apr 2026, 14:10',
        fileFingerprint: 'SHA-256: 98fa11...23cd',
        fileName: 'BURS_Tax_Clearance_2026_2027.pdf',
        fileSize: '840 KB',
        usedInApplications: ['GRC/2026/W04'],
      },
    ],
  },
  {
    id: 'doc-ppra-03',
    supplierId: 'sup-kopano',
    documentType: 'PPRA Registration Certificate',
    documentNumber: 'PPRA/REG/2025/1109',
    fileName: 'PPRA_Registration_Certificate_2025.pdf',
    fileSize: '1.8 MB',
    issueDate: '2025-01-15',
    expiryDate: '2027-01-15',
    status: 'Verified',
    statusMessage: 'Building Construction & Timber Supply discipline.',
    verifiedAt: '2025-01-20',
    verifiedBy: 'PPRA Central Service',
    downloadUrl: '#',
    extractedFields: {
      'Discipline': 'Building Works & Materials',
      'Scope': 'Building Construction, Structural Timber & Roofing',
      'Registration status': 'Active (Unlimited capacity)',
    },
    versionHistory: [
      {
        version: 1,
        uploadedBy: 'Kagiso Molosiwa (Supplier admin)',
        uploadedAt: '15 Jan 2025, 10:00',
        fileFingerprint: 'SHA-256: 44ee88...77aa',
        fileName: 'PPRA_Registration_Certificate_2025.pdf',
        fileSize: '1.8 MB',
        usedInApplications: ['GRC/2026/W04', 'NTA/RFP/2026/01'],
      },
    ],
  },
  {
    id: 'doc-safety-04',
    supplierId: 'sup-kopano',
    documentType: 'Workers Compensation & Safety Compliance',
    documentNumber: 'WCA-2025-BW-4912',
    fileName: 'Workers_Compensation_Certificate_2025.pdf',
    fileSize: '1.1 MB',
    issueDate: '2025-09-30',
    expiryDate: '2026-09-30',
    status: 'Expired',
    statusMessage: 'Your safety certificate expired on 30 September 2026. Upload a new one so organizations can keep your registration active.',
    downloadUrl: '#',
    versionHistory: [
      {
        version: 1,
        uploadedBy: 'Tshepo Matlapeng (Supplier staff)',
        uploadedAt: '30 Sep 2025, 16:20',
        fileFingerprint: 'SHA-256: 55bc09...11dd',
        fileName: 'Workers_Compensation_Certificate_2025.pdf',
        fileSize: '1.1 MB',
        usedInApplications: ['GRC/2025/W02'],
      },
    ],
  },
  {
    id: 'doc-insur-05',
    supplierId: 'sup-kopano',
    documentType: 'Public Liability Insurance Policy',
    documentNumber: 'PL-BIC-2025-9921',
    fileName: 'BIC_Public_Liability_Cover_10M.pdf',
    fileSize: '2.2 MB',
    issueDate: '2025-10-15',
    expiryDate: '2026-10-14',
    status: 'Expiring soon',
    statusMessage: 'Policy expires in 9 days. Please initiate renewal with your insurer.',
    verifiedAt: '2025-10-20',
    downloadUrl: '#',
    extractedFields: {
      'Insurer': 'Botswana Insurance Company (BIC)',
      'Policy limit': 'BWP 10,000,000',
      'Policy number': 'PL-BIC-2025-9921',
    },
    versionHistory: [
      {
        version: 1,
        uploadedBy: 'Kagiso Molosiwa (Supplier admin)',
        uploadedAt: '15 Oct 2025, 11:45',
        fileFingerprint: 'SHA-256: 88bb23...44ff',
        fileName: 'BIC_Public_Liability_Cover_10M.pdf',
        fileSize: '2.2 MB',
        usedInApplications: ['GRC/2026/W04'],
      },
    ],
  },
  {
    id: 'doc-fin-06',
    supplierId: 'sup-kopano',
    documentType: 'Audited Financial Statements',
    documentNumber: 'AFS-FY2025-BW',
    fileName: 'Kopano_Audited_Financials_FY2025.pdf',
    fileSize: '4.7 MB',
    issueDate: '2026-02-28',
    expiryDate: '2027-02-28',
    status: 'Verified',
    statusMessage: 'Audited by BDO Botswana (Chartered Accountants).',
    verifiedAt: '2026-03-15',
    downloadUrl: '#',
    extractedFields: {
      'Auditing firm': 'BDO Botswana (Chartered Accountants)',
      'Audit opinion': 'Unqualified (Clean Opinion)',
      'Reporting year': 'FY2025 (Ended 31 Dec 2025)',
    },
    versionHistory: [
      {
        version: 1,
        uploadedBy: 'Kagiso Molosiwa (Supplier admin)',
        uploadedAt: '28 Feb 2026, 17:00',
        fileFingerprint: 'SHA-256: a1b2c3...d4e5',
        fileName: 'Kopano_Audited_Financials_FY2025.pdf',
        fileSize: '4.7 MB',
        usedInApplications: ['NTA/RFP/2026/01'],
      },
    ],
  },
  {
    id: 'doc-bank-07',
    supplierId: 'sup-kopano',
    documentType: 'Bank Rating Letter',
    documentNumber: 'FNBB-RATING-2026-04',
    fileName: 'FNB_Bank_Rating_Category_A.pdf',
    fileSize: '620 KB',
    issueDate: '2026-03-10',
    expiryDate: '2027-03-10',
    status: 'Verified',
    statusMessage: 'Category "A" rating confirmed by First National Bank Botswana.',
    verifiedAt: '2026-03-18',
    downloadUrl: '#',
    extractedFields: {
      'Commercial bank': 'First National Bank of Botswana',
      'Assigned rating': 'Category A (Good Conduct & Facilities)',
    },
    versionHistory: [
      {
        version: 1,
        uploadedBy: 'Kagiso Molosiwa (Supplier admin)',
        uploadedAt: '10 Mar 2026, 12:20',
        fileFingerprint: 'SHA-256: 33dd67...89fe',
        fileName: 'FNB_Bank_Rating_Category_A.pdf',
        fileSize: '620 KB',
        usedInApplications: ['GRC/2026/W04'],
      },
    ],
  },
  {
    id: 'doc-rej-08',
    supplierId: 'sup-kopano',
    documentType: 'Trading Licence',
    documentNumber: 'GCC/TL/2024/991',
    fileName: 'Municipal_Trading_Licence_Scanned.pdf',
    fileSize: '1.3 MB',
    issueDate: '2024-05-01',
    expiryDate: '2025-04-30',
    status: 'Rejected',
    rejectionReason: 'The submitted trading licence has expired and lacks the 2026 annual renewal endorsement stamp from Gaborone City Council. Please upload a renewed licence.',
    statusMessage: 'Rejected by central compliance reviewers.',
    downloadUrl: '#',
    extractedFields: {
      'Issuing council': 'Gaborone City Council',
      'Licence number': 'GCC/TL/2024/991',
      'Expiry date': '30 April 2025 (Expired)',
    },
    versionHistory: [
      {
        version: 1,
        uploadedBy: 'Tshepo Matlapeng (Supplier staff)',
        uploadedAt: '28 Sep 2026, 10:14',
        fileFingerprint: 'SHA-256: 99aa34...01ff',
        fileName: 'Municipal_Trading_Licence_Scanned.pdf',
        fileSize: '1.3 MB',
        usedInApplications: [],
      },
    ],
  },
  {
    id: 'doc-pend-09',
    supplierId: 'sup-kopano',
    documentType: 'Workers Compensation & Safety Compliance',
    documentNumber: 'WCA-2026-BW-5890',
    fileName: 'Renewed_Workers_Compensation_Cover_2026.pdf',
    fileSize: '1.5 MB',
    issueDate: '2026-10-01',
    expiryDate: '2027-09-30',
    status: 'Pending',
    statusMessage: 'Pending verification by procurement registry officers. Documents are reviewed within 1–2 business days.',
    downloadUrl: '#',
    extractedFields: {
      'Insurer / authority': 'Department of Occupational Health & Safety',
      'Policy certificate': 'WCA-2026-BW-5890',
      'Valid until': '30 September 2027',
    },
    versionHistory: [
      {
        version: 1,
        uploadedBy: 'Kagiso Molosiwa (Supplier admin)',
        uploadedAt: '2 Oct 2026, 15:45',
        fileFingerprint: 'SHA-256: 77aa12...99ef',
        fileName: 'Renewed_Workers_Compensation_Cover_2026.pdf',
        fileSize: '1.5 MB',
        usedInApplications: [],
      },
    ],
  },
];

export const CURRENT_SUPPLIER: Supplier = {
  id: 'sup-kopano',
  legalName: 'Kopano Building Supplies (Pty) Ltd',
  tradingName: 'Kopano Materials & Hardware',
  cipaNumber: 'BW000034821',
  tinNumber: 'C12894002',
  ppraCode: 'Building Works & Materials',
  ppraSubcodes: ['Building Construction', 'Structural Timber & Roofing', 'General Hardware Supply'],
  ppraGrade: 'Unlimited capacity',
  category: 'Building & Civil Construction',
  secondaryCategories: ['Hardware & Industrial Supplies', 'Timber & Wood Products', 'Logistics'],
  physicalAddress: 'Plot 22019, G-West Industrial Park, Lobatse Road',
  city: 'Gaborone',
  district: 'South-East District',
  postalAddress: 'P.O. Box 40882, Gaborone, Botswana',
  primaryPhone: '+267 391 4455',
  email: 'tenders@kopanobuilding.co.bw',
  website: 'https://www.kopanobuilding.co.bw',
  yearEstablished: 2012,
  citizenOwnedPercentage: 100,
  youthOwned: false,
  womenOwned: true,
  disabilityOwned: false,
  eddCertified: true,
  bankName: 'First National Bank of Botswana',
  bankBranch: 'Corporate Branch, Gaborone',
  accountNumberMasked: '•••• •••• 4912',
  directors: [
    {
      id: 'dir-1',
      fullName: 'Kagiso Boitumelo Molosiwa',
      nationalIdOrPassport: '618219401 (Omang)',
      nationality: 'Motswana',
      isCitizen: true,
      shareholdingPercentage: 60,
      role: 'Managing Director',
    },
    {
      id: 'dir-2',
      fullName: 'Lesego Tebogo Kgosi',
      nationalIdOrPassport: '739104812 (Omang)',
      nationality: 'Motswana',
      isCitizen: true,
      shareholdingPercentage: 40,
      role: 'Executive Director & Operations',
    },
  ],
  profileCompleteness: 86,
  missingItems: [
    'Workers Compensation & Safety Compliance certificate is expired',
    'Public Liability Insurance Policy expires in 12 days',
  ],
  complianceStatus: 'Action required',
  documents: CURRENT_SUPPLIER_DOCUMENTS,
};

export const OTHER_SUPPLIERS: Supplier[] = [
  {
    id: 'sup-okavango',
    legalName: 'Okavango Stationers & Print Ltd',
    tradingName: 'Okavango Office Solutions',
    cipaNumber: 'BW000088192',
    tinNumber: 'C09441209',
    ppraCode: 'Code 211 (General Office Supplies & Printing)',
    ppraSubcodes: ['Subcode 01: Computer Consumables', 'Subcode 02: Stationery & Printing'],
    ppraGrade: 'Grade C',
    category: 'Stationery & Printing',
    secondaryCategories: ['IT Supplies', 'Educational Materials'],
    physicalAddress: 'Plot 410, Light Industrial Area',
    city: 'Francistown',
    district: 'North-East District',
    postalAddress: 'P.O. Box 1120, Francistown',
    primaryPhone: '+267 241 3322',
    email: 'info@okavangoprint.co.bw',
    yearEstablished: 2016,
    citizenOwnedPercentage: 100,
    youthOwned: true,
    womenOwned: false,
    disabilityOwned: false,
    eddCertified: true,
    bankName: 'Absa Bank Botswana',
    bankBranch: 'Francistown Main',
    accountNumberMasked: '•••• •••• 8841',
    directors: [
      {
        id: 'dir-ok-1',
        fullName: 'Thabo Mompati',
        nationalIdOrPassport: '849201948',
        nationality: 'Motswana',
        isCitizen: true,
        shareholdingPercentage: 100,
        role: 'Director',
      },
    ],
    profileCompleteness: 100,
    missingItems: [],
    complianceStatus: 'Fully compliant',
    documents: [],
  },
  {
    id: 'sup-kgale',
    legalName: 'Kgale IT Solutions & Cloud Services (Pty) Ltd',
    tradingName: 'Kgale Tech',
    cipaNumber: 'BW000051294',
    tinNumber: 'C11894520',
    ppraCode: 'Code 120 (ICT Technical Support & Infrastructure)',
    ppraSubcodes: ['Subcode 01: Systems Integration', 'Subcode 03: Cloud Services'],
    ppraGrade: 'Grade D',
    category: 'ICT & Technology',
    secondaryCategories: ['Telecommunications', 'Cybersecurity'],
    physicalAddress: 'iTowers South, 14th Floor, CBD',
    city: 'Gaborone',
    district: 'South-East District',
    postalAddress: 'P.O. Box 7010, Gaborone',
    primaryPhone: '+267 390 8877',
    email: 'procurement@kgaletech.bw',
    yearEstablished: 2018,
    citizenOwnedPercentage: 100,
    youthOwned: true,
    womenOwned: true,
    disabilityOwned: false,
    eddCertified: true,
    bankName: 'Stanbic Bank Botswana',
    bankBranch: 'Fairgrounds Branch',
    accountNumberMasked: '•••• •••• 1092',
    directors: [
      {
        id: 'dir-kg-1',
        fullName: 'Naledi Segokgo',
        nationalIdOrPassport: '901238491',
        nationality: 'Motswana',
        isCitizen: true,
        shareholdingPercentage: 70,
        role: 'Managing Director',
      },
    ],
    profileCompleteness: 92,
    missingItems: [],
    complianceStatus: 'Fully compliant',
    documents: [],
  },
  {
    id: 'sup-mowana',
    legalName: 'Mowana Clean Tech & Energy (Pty) Ltd',
    tradingName: 'Mowana Solar',
    cipaNumber: 'BW000099401',
    tinNumber: 'C14983021',
    ppraCode: 'Code 02 (Electrical Engineering Works)',
    ppraSubcodes: ['Subcode 04: Solar Photovoltaic Systems', 'Subcode 05: Backup Generators'],
    ppraGrade: 'Grade D',
    category: 'Electrical & Clean Energy',
    secondaryCategories: ['Renewable Energy', 'Civil Engineering'],
    physicalAddress: 'Plot 1802, New Industrial Site',
    city: 'Maun',
    district: 'North-West District',
    postalAddress: 'P.O. Box 390, Maun',
    primaryPhone: '+267 686 1144',
    email: 'solar@mowanatech.co.bw',
    yearEstablished: 2020,
    citizenOwnedPercentage: 100,
    youthOwned: false,
    womenOwned: false,
    disabilityOwned: false,
    eddCertified: true,
    bankName: 'First National Bank of Botswana',
    bankBranch: 'Maun Branch',
    accountNumberMasked: '•••• •••• 6612',
    directors: [],
    profileCompleteness: 88,
    missingItems: [],
    complianceStatus: 'Fully compliant',
    documents: [],
  },
];

export const INITIAL_FORM_TEMPLATES: FormTemplate[] = [
  {
    id: 'tmpl-grc-materials',
    organizationId: 'org-grc',
    title: 'GRC Works & Materials Technical Questionnaire',
    version: 'v2.1',
    description: 'Standard technical questionnaire for civil works and building supplies under Gaborone Regional Council guidelines.',
    updatedAt: '2026-08-15',
    fields: [
      {
        id: 'f1',
        label: 'Lead time for delivery to municipal depots in Gaborone (days)',
        type: 'number',
        required: true,
        placeholder: 'e.g. 7',
        helpText: 'Indicate calendar days from official purchase order issuance to on-site offloading.',
      },
      {
        id: 'f2',
        label: 'Do you operate an active physical storage yard or warehouse within Greater Gaborone?',
        type: 'yes_no',
        required: true,
        helpText: 'Council inspection officers may verify storage facilities prior to award.',
      },
      {
        id: 'f3',
        label: 'Warehouse / Yard Physical Location & Plot Number',
        type: 'text',
        required: true,
        placeholder: 'Plot number, industrial area',
        conditionalOnFieldId: 'f2',
        conditionalValue: true,
      },
      {
        id: 'f4',
        label: 'Are you bidding as a Joint Venture or Consortium?',
        type: 'yes_no',
        required: true,
      },
      {
        id: 'f5',
        label: 'Upload Notarized Joint Venture Agreement',
        type: 'file_upload',
        required: true,
        helpText: 'Required in accordance with PPRA JV regulations.',
        conditionalOnFieldId: 'f4',
        conditionalValue: true,
      },
      {
        id: 'f6',
        label: 'Primary Timber Sourcing Country / Certified Sawmill Source',
        type: 'dropdown',
        required: true,
        options: [
          { label: 'Botswana Local Sawmills & Plantations', value: 'BW_LOCAL' },
          { label: 'SADC Region (South Africa / Eswatini FSC Certified)', value: 'SADC_FSC' },
          { label: 'SADC Region (Zimbabwe / Mozambique)', value: 'SADC_OTHER' },
          { label: 'International / Other', value: 'INTERNATIONAL' },
        ],
      },
      {
        id: 'f7',
        label: 'Outline your contingency plan for fuel or supply chain disruptions',
        type: 'textarea',
        required: false,
        placeholder: 'Brief summary of secondary suppliers and backup transport fleets...',
      },
    ],
  },
  {
    id: 'tmpl-nta-general',
    organizationId: 'org-nta',
    title: 'NTA Supplier Registration General Form',
    version: 'v1.4',
    description: 'General pre-qualification form for all goods and services suppliers.',
    updatedAt: '2026-07-20',
    fields: [
      {
        id: 'nta-f1',
        label: 'Number of full-time permanent employees in Botswana',
        type: 'number',
        required: true,
        placeholder: 'e.g. 15',
      },
      {
        id: 'nta-f2',
        label: 'Do you offer credit payment terms of 30 days from invoice?',
        type: 'yes_no',
        required: true,
      },
      {
        id: 'nta-f3',
        label: 'Primary contact person for purchase orders',
        type: 'text',
        required: true,
        placeholder: 'Name and designation',
      },
    ],
  },
];

export const INITIAL_CALLS: Call[] = [
  {
    id: 'call-grc-rfp-08',
    callNumber: 'GRC/RFP/2026/08',
    organizationId: 'org-grc',
    organizationName: 'Gaborone Regional Council',
    title: 'Supply and Delivery of Building Materials and Structural Timber for Gaborone Municipal Facilities Phase II',
    summary: 'Procurement of SABS/BOBS approved timber beams, roofing trusses, Portland cement, steel reinforcements, and plumbing hardware for ongoing civic infrastructure upgrades.',
    type: 'RFP',
    category: 'Building & Civil Construction',
    subcategories: ['Structural Timber', 'Building Hardware', 'Roofing Materials'],
    location: 'Gaborone (G-West, Broadhurst, Block 8 Depots)',
    estimatedBudgetBWP: 2450000,
    openingDate: '2026-09-05',
    clarificationDeadline: '2026-09-28 17:00 CAT',
    closingDate: '2026-10-05', // Closing within 3 days!
    closingTimeCAT: '14:00 CAT',
    daysRemaining: 3,
    status: 'Open',
    isSealed: true,
    requiredDocumentTypes: [
      'BURS Tax Clearance Certificate',
      'PPRA Registration Certificate',
      'Workers Compensation & Safety Compliance',
      'Public Liability Insurance Policy',
      'Audited Financial Statements',
    ],
    formTemplateId: 'tmpl-grc-materials',
    documentsCount: 4,
    applicationsCount: 8,
    lineItems: [
      {
        id: 'li-1',
        itemNumber: 1,
        description: 'Treated Structural Timber (Pine 38x114mm x 6.0m SABS 1460)',
        unit: 'Length (6m)',
        quantity: 1200,
        unitPriceBWP: 185,
        totalPriceBWP: 222000,
      },
      {
        id: 'li-2',
        itemNumber: 2,
        description: 'Treated Structural Timber (Pine 50x228mm x 6.0m SABS 1460)',
        unit: 'Length (6m)',
        quantity: 650,
        unitPriceBWP: 420,
        totalPriceBWP: 273000,
      },
      {
        id: 'li-3',
        itemNumber: 3,
        description: 'Ordinary Portland Cement CEM II 42.5N (50kg Bags)',
        unit: 'Bag (50kg)',
        quantity: 4500,
        unitPriceBWP: 112,
        totalPriceBWP: 504000,
      },
      {
        id: 'li-4',
        itemNumber: 4,
        description: 'High Tensile Deformed Steel Rebar (Y12 x 12.0m)',
        unit: 'Bundle (10 bars)',
        quantity: 300,
        unitPriceBWP: 1450,
        totalPriceBWP: 435000,
      },
      {
        id: 'li-5',
        itemNumber: 5,
        description: 'IBR Galvanized Corrugated Roofing Sheets 0.5mm x 6.0m',
        unit: 'Sheet',
        quantity: 800,
        unitPriceBWP: 395,
        totalPriceBWP: 316000,
      },
      {
        id: 'li-6',
        itemNumber: 6,
        description: 'Transport, Offloading & Stacking to Designated GRC Depots',
        unit: 'Lump Sum',
        quantity: 1,
        unitPriceBWP: 110000,
        totalPriceBWP: 110000,
      },
    ],
    addenda: [
      {
        id: 'add-1',
        number: 1,
        title: 'Addendum No. 1: Clarification on Delivery Point Staging & SABS Markings',
        issuedDate: '2026-09-22',
        summary: 'Clarified that all structural timber must carry visible SABS/BOBS stamp marks and delivered during working hours (07:30 to 15:30 weekdays).',
        downloadUrl: '#',
      },
    ],
  },
  {
    id: 'call-nta-reg-04',
    callNumber: 'NTA/SUP/2026/04',
    organizationId: 'org-nta',
    organizationName: 'National Training Agency',
    title: 'Biennial Supplier Registration & Pre-Qualification Roster (2026–2028)',
    summary: 'Expression of registration for qualified domestic suppliers across 12 procurement categories including training supplies, office equipment, vehicle maintenance, and ICT software.',
    type: 'Registration drive',
    category: 'General Supply & Pre-Qualification',
    subcategories: ['Stationery & Consumables', 'Building Works', 'ICT Hardware', 'Catering'],
    location: 'National (Gaborone, Francistown, Maun centers)',
    openingDate: '2026-08-01',
    clarificationDeadline: '2026-11-15 16:30 CAT',
    closingDate: '2026-11-30',
    closingTimeCAT: '16:30 CAT',
    daysRemaining: 59,
    status: 'Open',
    isSealed: false,
    requiredDocumentTypes: [
      'CIPA Certificate of Incorporation',
      'BURS Tax Clearance Certificate',
      'PPRA Registration Certificate',
    ],
    formTemplateId: 'tmpl-nta-general',
    documentsCount: 2,
    applicationsCount: 42,
    addenda: [],
  },
  {
    id: 'call-bpc-eoi-19',
    callNumber: 'BPC/EOI/2026/19',
    organizationId: 'org-bpc',
    organizationName: 'Botswana Power Corporation',
    title: 'Expression of Interest: Sustainable Solar Backup & Mini-Grid Infrastructure for Rural Health Clinics',
    summary: 'BPC invites pre-qualification applications from citizen-owned EPC engineering firms for off-grid hybrid solar PV installation and battery storage in Kgalagadi and Ghanzi rural clinics.',
    type: 'EOI',
    category: 'Electrical & Clean Energy',
    subcategories: ['Solar PV', 'Battery Energy Storage', 'Civil Works'],
    location: 'Kgalagadi & Ghanzi Districts',
    estimatedBudgetBWP: 7800000,
    openingDate: '2026-09-15',
    clarificationDeadline: '2026-10-18 12:00 CAT',
    closingDate: '2026-10-28',
    closingTimeCAT: '12:00 CAT',
    daysRemaining: 26,
    status: 'Open',
    isSealed: false,
    requiredDocumentTypes: [
      'CIPA Certificate of Incorporation',
      'BURS Tax Clearance Certificate',
      'PPRA Registration Certificate',
      'Audited Financial Statements',
      'Bank Rating Letter',
    ],
    documentsCount: 3,
    applicationsCount: 14,
    addenda: [],
  },
  {
    id: 'call-deb-proc-102',
    callNumber: 'DEB/PROC/2026/102',
    organizationId: 'org-debswana',
    organizationName: 'Debswana Diamond Company Procurement',
    title: 'Provision of Integrated Facilities Maintenance, Electrical & Plumbing Services for Jwaneng Township',
    summary: 'Multi-year term contract for preventative and responsive maintenance across residential and commercial housing units in Jwaneng Mine township.',
    type: 'RFP',
    category: 'Facilities & Maintenance',
    subcategories: ['Electrical Engineering', 'Plumbing Works', 'Civil Repairs'],
    location: 'Jwaneng Township',
    estimatedBudgetBWP: 4200000,
    openingDate: '2026-09-20',
    clarificationDeadline: '2026-10-30 15:00 CAT',
    closingDate: '2026-11-15',
    closingTimeCAT: '15:00 CAT',
    daysRemaining: 44,
    status: 'Open',
    isSealed: true,
    requiredDocumentTypes: [
      'BURS Tax Clearance Certificate',
      'PPRA Registration Certificate',
      'Workers Compensation & Safety Compliance',
      'Public Liability Insurance Policy',
      'Audited Financial Statements',
    ],
    documentsCount: 5,
    applicationsCount: 6,
    addenda: [],
  },
];

export const INITIAL_CLARIFICATIONS: Clarification[] = [
  {
    id: 'clar-1',
    callId: 'call-grc-rfp-08',
    supplierId: 'sup-kopano',
    supplierName: 'Kopano Building Supplies (Pty) Ltd',
    question: 'Is it acceptable to deliver structural timber in staggered batches of 300 lengths per week to the G-West Depot to accommodate space constraints?',
    submittedAt: '2026-09-18 10:24',
    status: 'Answered',
    answer: 'Yes, phased delivery schedule across 4 consecutive calendar weeks is acceptable provided the first batch is delivered within 10 days of official purchase order.',
    answeredAt: '2026-09-20 14:15',
    answeredBy: 'K. Tau (Senior Procurement Officer, GRC)',
    isPublished: true,
  },
  {
    id: 'clar-2',
    callId: 'call-grc-rfp-08',
    supplierId: 'sup-other-1',
    supplierName: 'Broadhurst Timber & Joinery',
    question: 'Should prices quoted on the Bill of Quantities be inclusive or exclusive of 14% VAT?',
    submittedAt: '2026-09-21 11:05',
    status: 'Answered',
    answer: 'All line item unit prices must be entered exclusive of VAT. The 14% Value Added Tax will be automatically computed and summarized on the final submission schedule.',
    answeredAt: '2026-09-22 09:30',
    answeredBy: 'K. Tau (Senior Procurement Officer, GRC)',
    isPublished: true,
  },
  {
    id: 'clar-3',
    callId: 'call-grc-rfp-08',
    supplierId: 'sup-okavango',
    supplierName: 'Okavango Materials',
    question: 'Will council provide offloading forklifts and crane assistance at the Broadhurst facility?',
    submittedAt: '2026-09-27 16:40',
    status: 'Pending',
    isPublished: false,
  },
];

export const INITIAL_CONSENT_GRANTS: ConsentGrant[] = [
  {
    id: 'cg-1',
    supplierId: 'sup-kopano',
    organizationId: 'org-grc',
    organizationName: 'Gaborone Regional Council',
    grantedAt: '10 Aug 2026',
    expiryDate: '31 Dec 2026',
    purpose: 'Tender evaluation for GRC/2026/W04 Clinic Expansion',
    status: 'Active',
    scope: {
      companyDetails: true,
      directorsOwners: true,
      pastProjects: true,
      selectedDocuments: true,
      taxCompliance: true,
      financialStatements: true,
      keyPersonnel: true,
      pastContracts: true,
      bankingDetails: false,
    },
    selectedDocumentNames: [
      'BURS Tax Clearance Certificate',
      'PPRA Registration Certificate',
      'Public Liability Insurance Policy',
    ],
    tiedApplicationNumbers: ['GRC/2026/W04'],
    lastAccessedAt: '1 Oct 2026',
  },
  {
    id: 'cg-2',
    supplierId: 'sup-kopano',
    organizationId: 'org-nta',
    organizationName: 'National Training Agency',
    grantedAt: '1 Sep 2026',
    expiryDate: '30 Nov 2026',
    purpose: 'Expression of interest for facility hardware upgrade NTA/RFP/2026/01',
    status: 'Active',
    scope: {
      companyDetails: true,
      directorsOwners: true,
      pastProjects: false,
      selectedDocuments: true,
      taxCompliance: true,
      financialStatements: true,
      keyPersonnel: true,
      pastContracts: false,
      bankingDetails: false,
    },
    selectedDocumentNames: [
      'BURS Tax Clearance Certificate',
      'Audited Financial Statements',
    ],
    tiedApplicationNumbers: ['NTA/RFP/2026/01'],
    lastAccessedAt: '28 Sep 2026',
  },
  {
    id: 'cg-3',
    supplierId: 'sup-kopano',
    organizationId: 'org-orc',
    organizationName: 'Okavango Regional Council',
    grantedAt: '15 Sep 2026',
    expiryDate: '15 Mar 2027',
    purpose: 'Regional supplier qualification and vendor onboarding',
    status: 'Active',
    scope: {
      companyDetails: true,
      directorsOwners: false,
      pastProjects: true,
      selectedDocuments: true,
      taxCompliance: true,
      financialStatements: false,
      keyPersonnel: false,
      pastContracts: true,
      bankingDetails: false,
    },
    selectedDocumentNames: ['BURS Tax Clearance Certificate'],
    tiedApplicationNumbers: [],
    lastAccessedAt: '3 Oct 2026',
  },
  {
    id: 'cg-4',
    supplierId: 'sup-kopano',
    organizationId: 'org-bpc',
    organizationName: 'Botswana Power Corporation',
    grantedAt: '15 Jul 2026',
    expiryDate: '15 Jul 2027',
    purpose: 'Substation works electrical hardware vendor accreditation',
    status: 'Active',
    scope: {
      companyDetails: true,
      directorsOwners: true,
      pastProjects: true,
      selectedDocuments: true,
      taxCompliance: true,
      financialStatements: true,
      keyPersonnel: true,
      pastContracts: true,
      bankingDetails: true,
    },
    selectedDocumentNames: [
      'PPRA Registration Certificate',
      'Workers Compensation & Safety Compliance',
    ],
    tiedApplicationNumbers: [],
    lastAccessedAt: '12 Sep 2026',
  },
];

export const INITIAL_APPLICATIONS: Application[] = [
  // 1. Submitted RFP Bid (Kopano)
  {
    id: 'app-grc-01',
    callId: 'call-grc-rfp-08',
    callNumber: 'GRC/RFP/2026/08',
    callTitle: 'Supply and Delivery of Building Materials and Structural Timber for Gaborone Municipal Facilities Phase II',
    callType: 'RFP',
    organizationId: 'org-grc',
    organizationName: 'Gaborone Regional Council',
    supplierId: 'sup-kopano',
    supplierName: 'Kopano Building Supplies (Pty) Ltd',
    submittedAt: '2026-09-29 15:40',
    receiptNumber: 'B360-GRC-2026-0929-8812',
    status: 'Submitted',
    sharedDocumentIds: ['doc-cipa-01', 'doc-tax-02', 'doc-ppra-03', 'doc-insur-05', 'doc-fin-06', 'doc-bank-07'],
    responses: [
      { fieldId: 'f1', label: 'Lead time for delivery to municipal depots in Gaborone (days)', value: 5 },
      { fieldId: 'f2', label: 'Do you operate an active physical storage yard or warehouse within Greater Gaborone?', value: true },
      { fieldId: 'f3', label: 'Warehouse / Yard Physical Location & Plot Number', value: 'Plot 22019 G-West Industrial' },
      { fieldId: 'f4', label: 'Are you bidding as a Joint Venture or Consortium?', value: false },
      { fieldId: 'f6', label: 'Primary Timber Sourcing Country / Certified Sawmill Source', value: 'SADC_FSC' },
      { fieldId: 'f7', label: 'Outline your contingency plan for fuel or supply chain disruptions', value: 'We hold dedicated buffer stocks for 45 days at our G-West yard with secondary fleet contracts.' },
    ],
    bid: {
      id: 'bid-grc-01',
      applicationId: 'app-grc-01',
      callId: 'call-grc-rfp-08',
      supplierId: 'sup-kopano',
      supplierName: 'Kopano Building Supplies (Pty) Ltd',
      currency: 'BWP',
      pricingLineItems: [
        { id: 'li-1', itemNumber: 1, description: 'Treated Structural Timber (Pine 38x114mm x 6.0m SABS 1460)', unit: 'Length (6m)', quantity: 1200, unitPriceBWP: 175, totalPriceBWP: 210000 },
        { id: 'li-2', itemNumber: 2, description: 'Treated Structural Timber (Pine 50x228mm x 6.0m SABS 1460)', unit: 'Length (6m)', quantity: 650, unitPriceBWP: 390, totalPriceBWP: 253500 },
        { id: 'li-3', itemNumber: 3, description: 'Ordinary Portland Cement CEM II 42.5N (50kg Bags)', unit: 'Bag (50kg)', quantity: 4500, unitPriceBWP: 108, totalPriceBWP: 486000 },
        { id: 'li-4', itemNumber: 4, description: 'High Tensile Deformed Steel Rebar (Y12 x 12.0m)', unit: 'Bundle (10 bars)', quantity: 300, unitPriceBWP: 1390, totalPriceBWP: 417000 },
        { id: 'li-5', itemNumber: 5, description: 'IBR Galvanized Corrugated Roofing Sheets 0.5mm x 6.0m', unit: 'Sheet', quantity: 800, unitPriceBWP: 380, totalPriceBWP: 304000 },
        { id: 'li-6', itemNumber: 6, description: 'Transport, Offloading & Stacking to Designated GRC Depots', unit: 'Lump Sum', quantity: 1, unitPriceBWP: 90000, totalPriceBWP: 90000 },
      ],
      totalAmountBWP: 1760500,
      technicalProposalFileName: 'Kopano_Technical_Compliance_Schedule_GRC.pdf',
      financialProposalFileName: 'Kopano_Signed_Financial_BOQ.pdf',
      isSealed: true,
      sealedHash: 'SHA256:7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069',
    },
    reviewerMessages: [
      {
        id: 'rm-1',
        sender: 'K. Tau (Lead Procurement Officer, GRC)',
        senderRole: 'Lead Procurement Officer',
        timestamp: '2026-09-30 09:15',
        message: 'Your sealed tender packet has been registered under vault reference B360-GRC-2026-0929-8812. The public unsealing session is scheduled for 10 October 2026.',
      },
    ],
    timeline: [
      { stage: 'Submitted', timestamp: '2026-09-29 15:40', note: 'Sealed tender submitted electronically with cryptographic hash.' },
    ],
  },

  // 2. Under Review with Information Request (Kopano)
  {
    id: 'app-bpc-06',
    callId: 'call-bpc-eoi-19',
    callNumber: 'BPC/EOI/2026/19',
    callTitle: 'Expression of Interest: Sustainable Solar Backup & Mini-Grid Infrastructure for Rural Health Clinics',
    callType: 'EOI',
    organizationId: 'org-bpc',
    organizationName: 'Botswana Power Corporation',
    supplierId: 'sup-kopano',
    supplierName: 'Kopano Building Supplies (Pty) Ltd',
    submittedAt: '2026-09-22 14:10',
    receiptNumber: 'B360-BPC-2026-0922-3401',
    status: 'More information requested',
    statusReason: 'Clarification required regarding battery storage manufacturer warranty and local maintenance depot SLA.',
    reviewedBy: 'M. Gaoretelelwe (Senior Engineer, BPC Renewables)',
    reviewedAt: '2026-10-02 11:20',
    sharedDocumentIds: ['doc-cipa-01', 'doc-tax-02', 'doc-ppra-03', 'doc-insur-05'],
    responses: [
      { fieldId: 'eoi-f1', label: 'Primary solar EPC technical partners', value: 'Sunsave Solar & Kopano Joint Enterprise' },
      { fieldId: 'eoi-f2', label: 'Years of demonstrated experience in hybrid PV installations', value: 8 },
      { fieldId: 'eoi-f3', label: 'Can your team mobilize within 14 calendar days to Kgalagadi District?', value: true },
    ],
    reviewerMessages: [
      {
        id: 'rm-bpc-1',
        sender: 'M. Gaoretelelwe (Senior Engineer, BPC Renewables)',
        senderRole: 'Technical Evaluation Committee',
        timestamp: '2026-10-02 11:20',
        message: 'The evaluation committee has concluded preliminary dossier vetting. Please confirm whether tier-1 lithium iron phosphate (LiFePO4) battery packs carry a minimum 10-year manufacturer warranty supported by a certified local depot in Botswana.',
      },
    ],
    informationRequest: {
      id: 'ir-bpc-01',
      requestedBy: 'M. Gaoretelelwe (Senior Engineer, BPC Renewables)',
      requestedAt: '2026-10-02 11:20',
      dueDate: '2026-10-12',
      message: 'Provide written confirmation and letter of OEM authorization guaranteeing a minimum 10-year warranty on storage cells and 48-hour emergency swap-out SLA within Botswana.',
      status: 'Pending response',
    },
    timeline: [
      { stage: 'Submitted', timestamp: '2026-09-22 14:10', note: 'EOI proposal submitted.' },
      { stage: 'Under review', timestamp: '2026-09-26 10:00', note: 'Technical review committee opened submission for compliance check.' },
      { stage: 'More information requested', timestamp: '2026-10-02 11:20', note: 'Official clarification requested regarding battery storage warranty and local depot support.' },
    ],
  },

  // 3. Approved Decision (Kopano)
  {
    id: 'app-nta-02',
    callId: 'call-nta-reg-04',
    callNumber: 'NTA/SUP/2026/04',
    callTitle: 'Biennial Supplier Registration & Pre-Qualification Roster (2026–2028)',
    callType: 'Registration drive',
    organizationId: 'org-nta',
    organizationName: 'National Training Agency',
    supplierId: 'sup-kopano',
    supplierName: 'Kopano Building Supplies (Pty) Ltd',
    submittedAt: '2026-09-02 11:15',
    receiptNumber: 'B360-NTA-2026-0902-1102',
    status: 'Approved',
    reviewedBy: 'T. Motlogelwa (Procurement Officer, NTA)',
    reviewedAt: '2026-09-20 16:00',
    decisionDate: '2026-09-20 16:00',
    decisionNote: 'Congratulations. Kopano Building Supplies (Pty) Ltd has been admitted to the National Training Agency Approved Supplier Roster (2026–2028) under category Building Construction & Maintenance. Your verified credentials satisfy the qualification criteria for this biennial roster.',
    sharedDocumentIds: ['doc-cipa-01', 'doc-tax-02', 'doc-ppra-03'],
    responses: [
      { fieldId: 'nta-f1', label: 'Number of full-time permanent employees in Botswana', value: 24 },
      { fieldId: 'nta-f2', label: 'Do you offer credit payment terms of 30 days from invoice?', value: true },
      { fieldId: 'nta-f3', label: 'Primary contact person for purchase orders', value: 'Kagiso Molosiwa (Managing Director)' },
    ],
    reviewerMessages: [
      {
        id: 'rm-nta-1',
        sender: 'T. Motlogelwa (Procurement Officer, NTA)',
        senderRole: 'Procurement Officer',
        timestamp: '2026-09-20 16:00',
        message: 'Official approval notice: All verified compliance certificates passed statutory verification. Supplier roster certificate has been generated and dispatched to your email.',
      },
    ],
    timeline: [
      { stage: 'Submitted', timestamp: '2026-09-02 11:15', note: 'Registration documents submitted.' },
      { stage: 'Under review', timestamp: '2026-09-10 09:00', note: 'Verification in progress by NTA Supply Chain Committee.' },
      { stage: 'Approved', timestamp: '2026-09-20 16:00', note: 'Admitted to Category: Building Maintenance & Civil Supplies.' },
    ],
  },

  // 4. Rejected Decision (Kopano)
  {
    id: 'app-wuc-07',
    callId: 'call-wuc-rfp-12',
    callNumber: 'WUC/T/2026/12',
    callTitle: 'Framework Agreement for High-Pressure Ductile Iron Pipes and Bulk Fittings',
    callType: 'RFP',
    organizationId: 'org-wuc',
    organizationName: 'Water Utilities Corporation',
    supplierId: 'sup-kopano',
    supplierName: 'Kopano Building Supplies (Pty) Ltd',
    submittedAt: '2026-08-15 09:30',
    receiptNumber: 'B360-WUC-2026-0815-7091',
    status: 'Rejected',
    reviewedBy: 'B. Kebonyemodisa (Contracts Manager, WUC)',
    reviewedAt: '2026-09-05 14:00',
    decisionDate: '2026-09-05 14:00',
    decisionNote: 'Bid disqualified during Stage 1 Mandatory Technical Compliance. Tenderers were required to produce registration for Mechanical and Piping Specialization. The bidder provided general building construction credentials, which do not satisfy the specific technical requirements for pressure pipeline installations under this tender.',
    sharedDocumentIds: ['doc-cipa-01', 'doc-tax-02'],
    responses: [
      { fieldId: 'wuc-f1', label: 'Manufacturing standards compliance', value: 'ISO 2531 / EN 545' },
      { fieldId: 'wuc-f2', label: 'Maximum lead time for pipe shipments', value: '6 weeks' },
    ],
    reviewerMessages: [
      {
        id: 'rm-wuc-1',
        sender: 'B. Kebonyemodisa (Contracts Manager, WUC)',
        senderRole: 'Contracts Manager',
        timestamp: '2026-09-05 14:00',
        message: 'Formal rejection notification issued. Please inspect the formal decision note regarding required mechanical piping discipline credentials.',
      },
    ],
    timeline: [
      { stage: 'Submitted', timestamp: '2026-08-15 09:30', note: 'Tender submission entered.' },
      { stage: 'Under review', timestamp: '2026-08-22 10:00', note: 'Stage 1 mandatory compliance review commenced.' },
      { stage: 'Rejected', timestamp: '2026-09-05 14:00', note: 'Disqualified for non-conforming PPRA discipline subcode.' },
    ],
  },

  // 5. Draft Application (Kopano)
  {
    id: 'app-draft-08',
    callId: 'call-moe-rfp-03',
    callNumber: 'MOE/DEV/2026/03',
    callTitle: 'Construction of 4-Unit Staff Housing Blocks and Ablution Facilities at Mogoditshane Senior Secondary School',
    callType: 'RFP',
    organizationId: 'org-moe',
    organizationName: 'Ministry of Education & Skills Development',
    supplierId: 'sup-kopano',
    supplierName: 'Kopano Building Supplies (Pty) Ltd',
    submittedAt: '2026-10-04 18:30',
    status: 'Draft',
    sharedDocumentIds: ['doc-cipa-01', 'doc-tax-02', 'doc-ppra-03'],
    responses: [
      { fieldId: 'moe-f1', label: 'Proposed construction completion period (weeks)', value: 16 },
      { fieldId: 'moe-f2', label: 'Will you deploy a resident site engineer registered with ERB?', value: true },
    ],
    timeline: [
      { stage: 'Draft', timestamp: '2026-10-04 18:30', note: 'Draft application autosaved with preliminary questionnaire responses.' },
    ],
  },

  // 6. Another supplier application (Okavango)
  {
    id: 'app-okavango-03',
    callId: 'call-nta-reg-04',
    callNumber: 'NTA/SUP/2026/04',
    callTitle: 'Biennial Supplier Registration & Pre-Qualification Roster (2026–2028)',
    callType: 'Registration drive',
    organizationId: 'org-nta',
    organizationName: 'National Training Agency',
    supplierId: 'sup-okavango',
    supplierName: 'Okavango Stationers & Print Ltd',
    submittedAt: '2026-09-14 14:10',
    status: 'More information requested',
    statusReason: 'Please provide updated bank rating letter issued within the last 3 months from a commercial bank registered in Botswana.',
    reviewedBy: 'T. Motlogelwa (Procurement Officer, NTA)',
    reviewedAt: '2026-09-24 10:30',
    sharedDocumentIds: [],
    responses: [
      { fieldId: 'nta-f1', label: 'Number of full-time permanent employees in Botswana', value: 12 },
      { fieldId: 'nta-f2', label: 'Do you offer credit payment terms of 30 days from invoice?', value: true },
    ],
    timeline: [
      { stage: 'Submitted', timestamp: '2026-09-14 14:10', note: 'Registration submitted.' },
      { stage: 'Under review', timestamp: '2026-09-18 11:00', note: 'Under initial review.' },
      { stage: 'More information requested', timestamp: '2026-09-24 10:30', note: 'Updated bank rating letter requested.' },
    ],
  },
  {
    id: 'app-kgale-04',
    callId: 'call-grc-rfp-08',
    callNumber: 'GRC/RFP/2026/08',
    callTitle: 'Supply and Delivery of Building Materials and Structural Timber for Gaborone Municipal Facilities Phase II',
    callType: 'RFP',
    organizationId: 'org-grc',
    organizationName: 'Gaborone Regional Council',
    supplierId: 'sup-kgale',
    supplierName: 'Kgale IT Solutions & Cloud Services (Pty) Ltd',
    submittedAt: '2026-09-28 10:05',
    status: 'Under review',
    sharedDocumentIds: [],
    responses: [],
    timeline: [
      { stage: 'Submitted', timestamp: '2026-09-28 10:05', note: 'Bid sealed.' },
      { stage: 'Under review', timestamp: '2026-10-01 09:00', note: 'Compliance vetting in progress.' },
    ],
  },
  {
    id: 'app-mowana-05',
    callId: 'call-bpc-eoi-19',
    callNumber: 'BPC/EOI/2026/19',
    callTitle: 'Expression of Interest: Sustainable Solar Backup & Mini-Grid Infrastructure for Rural Health Clinics',
    callType: 'EOI',
    organizationId: 'org-bpc',
    organizationName: 'Botswana Power Corporation',
    supplierId: 'sup-mowana',
    supplierName: 'Mowana Clean Tech & Energy (Pty) Ltd',
    submittedAt: '2026-09-26 16:20',
    status: 'Under review',
    sharedDocumentIds: [],
    responses: [],
    timeline: [
      { stage: 'Submitted', timestamp: '2026-09-26 16:20', note: 'EOI submission received.' },
      { stage: 'Under review', timestamp: '2026-09-30 14:00', note: 'Technical review committee evaluating qualifications.' },
    ],
  },
];

export const INITIAL_CRITERIA: Criterion[] = [
  {
    id: 'crit-tech',
    callId: 'call-grc-rfp-08',
    title: 'Technical Compliance & Material Specifications',
    description: 'Compliance with BOBS/SABS standards, certified timber kiln treatment, and verified depot storage capacity.',
    weight: 35,
    maxScore: 100,
  },
  {
    id: 'crit-fin',
    callId: 'call-grc-rfp-08',
    title: 'Financial Proposal & BOQ Price Realism',
    description: 'Competitiveness of itemized unit rates, mathematical accuracy, and transparent freight line items.',
    weight: 35,
    maxScore: 100,
  },
  {
    id: 'crit-exp',
    callId: 'call-grc-rfp-08',
    title: 'Past Performance & Local References',
    description: 'Track record in executing public sector or commercial material supply contracts $\\ge$ BWP 1M in the last 3 years.',
    weight: 20,
    maxScore: 100,
  },
  {
    id: 'crit-ceep',
    callId: 'call-grc-rfp-08',
    title: 'Citizen Economic Empowerment & EDD Registration',
    description: '100% Citizen shareholding, local workforce employment, and valid EDD certificate preference margins.',
    weight: 10,
    maxScore: 100,
  },
];

export const INITIAL_EVALUATORS: Evaluator[] = [
  {
    id: 'eval-tau',
    organizationId: 'org-grc',
    name: 'K. Tau',
    role: 'Lead Procurement Specialist',
    department: 'Supply Chain Management Unit',
    hasDeclaredConflict: true,
    declarationDate: '2026-09-25 08:30',
    conflictDetails: 'No known pecuniary or family interests with any participating bidding entities.',
  },
  {
    id: 'eval-phiri',
    organizationId: 'org-grc',
    name: 'Eng. M. Phiri',
    role: 'Senior Civil & Structural Engineer',
    department: 'Department of Civil Works',
    hasDeclaredConflict: true,
    declarationDate: '2026-09-25 09:15',
    conflictDetails: 'Declared independence. No commercial affiliation.',
  },
  {
    id: 'eval-kgakgamatso',
    organizationId: 'org-grc',
    name: 'B. Kgakgamatso',
    role: 'Financial Analyst',
    department: 'Treasury & Finance',
    hasDeclaredConflict: true,
    declarationDate: '2026-09-25 11:00',
    conflictDetails: 'No conflicts of interest identified.',
  },
];

export const INITIAL_SCORES: Score[] = [
  // Scores for Kopano Building Supplies
  { id: 'sc-1', callId: 'call-grc-rfp-08', applicationId: 'app-grc-01', evaluatorId: 'eval-tau', evaluatorName: 'K. Tau', evaluatorRole: 'Lead Procurement', criterionId: 'crit-tech', score: 92, comments: 'Full SABS 1460 compliance certification provided. Excellent warehouse location in G-West.', scoredAt: '2026-10-01 14:10' },
  { id: 'sc-2', callId: 'call-grc-rfp-08', applicationId: 'app-grc-01', evaluatorId: 'eval-tau', evaluatorName: 'K. Tau', evaluatorRole: 'Lead Procurement', criterionId: 'crit-fin', score: 88, comments: 'Competitive unit rates across all timber lines; 12% below initial benchmark budget.', scoredAt: '2026-10-01 14:15' },
  { id: 'sc-3', callId: 'call-grc-rfp-08', applicationId: 'app-grc-01', evaluatorId: 'eval-tau', evaluatorName: 'K. Tau', evaluatorRole: 'Lead Procurement', criterionId: 'crit-exp', score: 90, comments: 'Three positive reference letters from major commercial contractors in Gaborone.', scoredAt: '2026-10-01 14:20' },
  { id: 'sc-4', callId: 'call-grc-rfp-08', applicationId: 'app-grc-01', evaluatorId: 'eval-tau', evaluatorName: 'K. Tau', evaluatorRole: 'Lead Procurement', criterionId: 'crit-ceep', score: 100, comments: '100% Citizen-owned and valid EDD certificate on file.', scoredAt: '2026-10-01 14:22' },

  { id: 'sc-5', callId: 'call-grc-rfp-08', applicationId: 'app-grc-01', evaluatorId: 'eval-phiri', evaluatorName: 'Eng. M. Phiri', evaluatorRole: 'Structural Engineer', criterionId: 'crit-tech', score: 95, comments: 'Timber moisture ratings meet national standards. Delivery truck capacity adequate.', scoredAt: '2026-10-01 15:30' },
  { id: 'sc-6', callId: 'call-grc-rfp-08', applicationId: 'app-grc-01', evaluatorId: 'eval-phiri', evaluatorName: 'Eng. M. Phiri', evaluatorRole: 'Structural Engineer', criterionId: 'crit-fin', score: 86, comments: 'Reasonable material transport margins.', scoredAt: '2026-10-01 15:35' },
  { id: 'sc-7', callId: 'call-grc-rfp-08', applicationId: 'app-grc-01', evaluatorId: 'eval-phiri', evaluatorName: 'Eng. M. Phiri', evaluatorRole: 'Structural Engineer', criterionId: 'crit-exp', score: 85, comments: 'Sound technical qualifications.', scoredAt: '2026-10-01 15:40' },
  { id: 'sc-8', callId: 'call-grc-rfp-08', applicationId: 'app-grc-01', evaluatorId: 'eval-phiri', evaluatorName: 'Eng. M. Phiri', evaluatorRole: 'Structural Engineer', criterionId: 'crit-ceep', score: 100, comments: 'Citizen enterprise verification confirmed.', scoredAt: '2026-10-01 15:42' },
];

export const INITIAL_AWARD_DECISION: AwardDecision = {
  id: 'award-grc-01',
  callId: 'call-grc-rfp-08',
  callNumber: 'GRC/RFP/2026/08',
  callTitle: 'Supply and Delivery of Building Materials and Structural Timber for Gaborone Municipal Facilities Phase II',
  recommendedSupplierId: 'sup-kopano',
  recommendedSupplierName: 'Kopano Building Supplies (Pty) Ltd',
  awardedAmountBWP: 1760500,
  justification: 'Highest composite score (90.8%) demonstrating superior technical adherence, full SABS certification, competitive pricing yielding BWP 689,500 savings against estimated budget, and 100% citizen equity empowerment.',
  status: 'Pending approval',
  draftedBy: 'K. Tau (Lead Procurement Specialist)',
  draftedAt: '2026-10-01 16:30',
};

export const INITIAL_AUDIT_EVENTS: AuditEvent[] = [
  {
    id: 'aud-01',
    actorName: 'Kagiso Molosiwa',
    actorRole: 'Supplier',
    organizationName: 'Kopano Building Supplies (Pty) Ltd',
    action: 'Submitted Sealed Tender Bid',
    entityType: 'Bid',
    entityId: 'bid-grc-01',
    timestamp: '2026-09-29 15:40:12',
    details: 'Encrypted tender package uploaded with cryptographic proof SHA256:7f83b1... for Call GRC/RFP/2026/08.',
    ipAddress: '41.138.12.94',
  },
  {
    id: 'aud-02',
    actorName: 'K. Tau',
    actorRole: 'Procurement Officer',
    organizationName: 'Gaborone Regional Council',
    action: 'Published Clarification Answer',
    entityType: 'Call',
    entityId: 'call-grc-rfp-08',
    timestamp: '2026-09-22 09:30:44',
    details: 'Published official response regarding VAT 14% exclusion on BOQ line item entries.',
    ipAddress: '168.167.4.22',
  },
  {
    id: 'aud-03',
    actorName: 'Kagiso Molosiwa',
    actorRole: 'Supplier',
    organizationName: 'Kopano Building Supplies (Pty) Ltd',
    action: 'Granted Data Consent',
    entityType: 'Consent',
    entityId: 'cg-1',
    timestamp: '2026-08-10 09:30:00',
    details: 'Authorized Gaborone Regional Council to verify company profile, CIPA registration, and audited financials.',
    ipAddress: '41.138.12.94',
  },
  {
    id: 'aud-04',
    actorName: 'Eng. M. Phiri',
    actorRole: 'Evaluator',
    organizationName: 'Gaborone Regional Council',
    action: 'Signed Conflict of Interest Declaration',
    entityType: 'Evaluation',
    entityId: 'eval-phiri',
    timestamp: '2026-09-25 09:15:20',
    details: 'Electronic declaration of independence signed under GRC Procurement Code Section 42.',
    ipAddress: '168.167.4.88',
  },
  {
    id: 'aud-05',
    actorName: 'K. Tau',
    actorRole: 'Procurement Officer',
    organizationName: 'Gaborone Regional Council',
    action: 'Drafted Award Recommendation',
    entityType: 'Award',
    entityId: 'award-grc-01',
    timestamp: '2026-10-01 16:30:15',
    details: 'Submitted draft award recommendation for Kopano Building Supplies (BWP 1,760,500) to Tender Board.',
    ipAddress: '168.167.4.22',
  },
];

export const INITIAL_NOTIFICATIONS: NotificationItem[] = [
  {
    id: 'notif-1',
    recipientRole: 'Supplier',
    recipientId: 'sup-kopano',
    title: 'Document Expired: Workers Compensation',
    message: 'Your safety certificate expired on 30 September 2026. Upload a new one so organizations can keep your registration active.',
    timestamp: '2026-10-01 08:00',
    read: false,
    type: 'urgent',
    actionLink: 'vault',
  },
  {
    id: 'notif-2',
    recipientRole: 'Supplier',
    recipientId: 'sup-kopano',
    title: 'Clarification Answer Published',
    message: 'Gaborone Regional Council replied to your delivery batch query for RFP GRC/RFP/2026/08.',
    timestamp: '2026-09-20 14:15',
    read: true,
    type: 'info',
    actionLink: 'call-grc-rfp-08',
  },
  {
    id: 'notif-3',
    recipientRole: 'Supplier',
    recipientId: 'sup-kopano',
    title: 'Registration Approved: National Training Agency',
    message: 'Your pre-qualification application for Biennial Supplier Roster (2026–2028) has been approved.',
    timestamp: '2026-09-20 16:05',
    read: true,
    type: 'success',
    actionLink: 'applications',
  },
  {
    id: 'notif-4',
    recipientRole: 'Buyer',
    recipientId: 'org-grc',
    title: 'Tender Closing in 3 Days',
    message: 'RFP GRC/RFP/2026/08 will close on 05 October 2026 at 14:00 CAT. 8 bids currently sealed.',
    timestamp: '2026-10-02 08:30',
    read: false,
    type: 'warning',
    actionLink: 'rfp-management',
  },
];
