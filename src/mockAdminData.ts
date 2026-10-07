export interface AdminMetric {
  id: string;
  label: string;
  value: string;
  change: string;
  isPositive: boolean;
}

export interface AttentionItem {
  id: string;
  count: number;
  label: string;
  targetTab: string;
  colorBorder: string;
}

export interface PendingOrg {
  id: string;
  name: string;
  type: string;
  submittedDate: string;
  contactPerson: string;
  email: string;
  gazetteRef: string;
  status: 'Pending' | 'Active' | 'Suspended';
  plan: 'Standard' | 'Enterprise' | 'Parastatal';
  membersCount: number;
}

export interface VerificationQueueItem {
  id: string;
  checkType: 'Tax clearance' | 'CIPA certificate' | 'Workers comp' | 'Bank confirmation' | 'Identity check (Omang)';
  supplierName: string;
  supplierCipa: string;
  submittedDate: string;
  waitingTime: string;
  docNumber: string;
  expiryDate: string;
  confidenceScore: number;
  status: 'Pending review' | 'Verified' | 'Rejected' | 'Cannot verify';
}

export interface RiskFlag {
  id: string;
  flagType: string;
  suppliersInvolved: string[];
  organizationsInvolved: string[];
  severity: 'High' | 'Medium' | 'Low';
  detectedAt: string;
  description: string;
  status: 'Open' | 'Under investigation' | 'Resolved';
}

export interface DebarmentRecord {
  id: string;
  entityName: string;
  cipaNumber: string;
  scope: 'Platform-wide' | 'Gaborone Regional Council' | 'Botswana Power Corporation';
  startDate: string;
  endDate: string;
  reason: string;
  issuedBy: string;
}

export interface AdminInvoice {
  id: string;
  invoiceNumber: string;
  orgName: string;
  amountBWP: number;
  billingPeriod: string;
  dueDate: string;
  status: 'Paid' | 'Overdue' | 'Processing';
}

export interface NotificationDelivery {
  id: string;
  channel: 'SMS' | 'Email' | 'WhatsApp';
  recipient: string;
  subjectOrPreview: string;
  sentAt: string;
  status: 'Delivered' | 'Failed' | 'Queued';
  retryCount: number;
}

export interface AdminUserRecord {
  id: string;
  fullName: string;
  email: string;
  role: 'Super admin' | 'Compliance officer' | 'Operations analyst' | 'Support specialist';
  mfaEnabled: boolean;
  lastSignIn: string;
  status: 'Active' | 'Invited' | 'Suspended';
}

export const ADMIN_ATTENTION_ITEMS: AttentionItem[] = [
  { id: 'att-1', count: 3, label: 'Organizations awaiting approval', targetTab: 'organizations', colorBorder: 'border-l-[#E8A33D]' },
  { id: 'att-2', count: 14, label: 'Verification queue', targetTab: 'verification', colorBorder: 'border-l-[#1F5F99]' },
  { id: 'att-3', count: 2, label: 'Open risk flags', targetTab: 'risk-debarments', colorBorder: 'border-l-[#C2412D]' },
  { id: 'att-4', count: 6, label: 'Failed deliveries', targetTab: 'notifications', colorBorder: 'border-l-[#E8A33D]' },
  { id: 'att-5', count: 1, label: 'Overdue invoices', targetTab: 'billing', colorBorder: 'border-l-[#C2412D]' },
];

export const ADMIN_KEY_METRICS: AdminMetric[] = [
  { id: 'm-1', label: 'Verified suppliers', value: '1,482', change: '+12% vs last month', isPositive: true },
  { id: 'm-2', label: 'Active organizations', value: '16', change: '+2 vs last month', isPositive: true },
  { id: 'm-3', label: 'Open calls', value: '9', change: '+3 vs last month', isPositive: true },
  { id: 'm-4', label: 'Bids submitted this month', value: '212', change: '+24% vs last month', isPositive: true },
  { id: 'm-5', label: 'Monthly recurring revenue', value: 'BWP 38,500', change: '+8% vs last month', isPositive: true },
  { id: 'm-6', label: 'Supplier reuse rate', value: '31%', change: '+4% vs last month', isPositive: true },
];

export const ADMIN_ORGANIZATIONS: PendingOrg[] = [
  {
    id: 'org-nta',
    name: 'National Training Authority',
    type: 'Parastatal / Education & Skills',
    submittedDate: '4 Oct 2026',
    contactPerson: 'Kagiso Ditsele',
    email: 'kditsele@nta.gov.bw',
    gazetteRef: 'BW-GOV-NTA-2026',
    status: 'Pending',
    plan: 'Parastatal',
    membersCount: 4,
  },
  {
    id: 'org-brw',
    name: 'Botswana Railways Board',
    type: 'State-Owned Enterprise / Transport',
    submittedDate: '3 Oct 2026',
    contactPerson: 'Tebogo Sebele',
    email: 't.sebele@botrail.bw',
    gazetteRef: 'BW-SOE-BR-091',
    status: 'Pending',
    plan: 'Enterprise',
    membersCount: 6,
  },
  {
    id: 'org-chobe',
    name: 'Chobe Land Board',
    type: 'Local Authority / Land Admin',
    submittedDate: '2 Oct 2026',
    contactPerson: 'Lesego Modise',
    email: 'l.modise@chobelb.gov.bw',
    gazetteRef: 'BW-LB-CHOBE-04',
    status: 'Pending',
    plan: 'Standard',
    membersCount: 3,
  },
  {
    id: 'org-grc',
    name: 'Gaborone Regional Council',
    type: 'Local Authority / Regional Council',
    submittedDate: '12 Jan 2026',
    contactPerson: 'Kgosi Tau',
    email: 'k.tau@grc.gov.bw',
    gazetteRef: 'BW-GOV-GRC-01',
    status: 'Active',
    plan: 'Parastatal',
    membersCount: 14,
  },
  {
    id: 'org-bpc',
    name: 'Botswana Power Corporation',
    type: 'State-Owned Enterprise / Energy',
    submittedDate: '15 Feb 2026',
    contactPerson: 'Mpho Molosiwa',
    email: 'procurement@bpc.bw',
    gazetteRef: 'BW-SOE-BPC-02',
    status: 'Active',
    plan: 'Enterprise',
    membersCount: 18,
  },
  {
    id: 'org-debswana',
    name: 'Debswana Diamond Company',
    type: 'Joint Venture Mining Procuring Entity',
    submittedDate: '1 Mar 2026',
    contactPerson: 'Onalenna Phetogo',
    email: 'tenders@debswana.com',
    gazetteRef: 'BW-CORP-DEB-01',
    status: 'Active',
    plan: 'Enterprise',
    membersCount: 22,
  },
  {
    id: 'org-fcc',
    name: 'Francistown City Council',
    type: 'Local Authority / Municipal Council',
    submittedDate: '18 Apr 2026',
    contactPerson: 'Boitumelo Masire',
    email: 'b.masire@fcc.gov.bw',
    gazetteRef: 'BW-GOV-FCC-03',
    status: 'Active',
    plan: 'Standard',
    membersCount: 8,
  },
  {
    id: 'org-suspended-1',
    name: 'Kgalagadi North Sub-District Water Desk',
    type: 'Local Authority',
    submittedDate: '10 Jun 2026',
    contactPerson: 'Galeboe R.',
    email: 'galeboe@kgalagadi.gov.bw',
    gazetteRef: 'BW-LB-KG-09',
    status: 'Suspended',
    plan: 'Standard',
    membersCount: 2,
  },
];

export const ADMIN_VERIFICATION_QUEUE: VerificationQueueItem[] = [
  {
    id: 'vq-1',
    checkType: 'Tax clearance',
    supplierName: 'Kopano Building Supplies (Pty) Ltd',
    supplierCipa: 'BW00001234567',
    submittedDate: '5 Oct 2026',
    waitingTime: '2 hrs ago',
    docNumber: 'BURS-TIN-893421',
    expiryDate: '31 Mar 2027',
    confidenceScore: 99,
    status: 'Pending review',
  },
  {
    id: 'vq-2',
    checkType: 'Workers comp',
    supplierName: 'Tsodilo Civil Engineering (Pty) Ltd',
    supplierCipa: 'BW00009876543',
    submittedDate: '5 Oct 2026',
    waitingTime: '4 hrs ago',
    docNumber: 'WCA-2026-BW-7821',
    expiryDate: '30 Sep 2027',
    confidenceScore: 94,
    status: 'Pending review',
  },
  {
    id: 'vq-3',
    checkType: 'CIPA certificate',
    supplierName: 'Kalahari Electrical & Plant Services',
    supplierCipa: 'BW00004561234',
    submittedDate: '4 Oct 2026',
    waitingTime: '1 day ago',
    docNumber: 'CIPA-COI-45612',
    expiryDate: '15 Jul 2028',
    confidenceScore: 98,
    status: 'Pending review',
  },
  {
    id: 'vq-4',
    checkType: 'Bank confirmation',
    supplierName: 'Okavango Logistics & Security CC',
    supplierCipa: 'BW00007890123',
    submittedDate: '4 Oct 2026',
    waitingTime: '1 day ago',
    docNumber: 'FNB-CONF-2026-9',
    expiryDate: '31 Dec 2026',
    confidenceScore: 91,
    status: 'Pending review',
  },
  {
    id: 'vq-5',
    checkType: 'Identity check (Omang)',
    supplierName: 'Tawana Catering & Uniforms',
    supplierCipa: 'BW00006543210',
    submittedDate: '3 Oct 2026',
    waitingTime: '2 days ago',
    docNumber: 'OMANG-612093112',
    expiryDate: '14 Nov 2030',
    confidenceScore: 96,
    status: 'Pending review',
  },
];

export const ADMIN_RISK_FLAGS: RiskFlag[] = [
  {
    id: 'rf-1',
    flagType: 'Shared physical address & directorship anomaly',
    suppliersInvolved: ['Kalahari Infrastructure JV', 'Makgadikgadi Plant Hire (Pty) Ltd'],
    organizationsInvolved: ['Gaborone Regional Council'],
    severity: 'High',
    detectedAt: '5 Oct 2026',
    description: 'Cross-matching detected identical director Omang numbers and registered Plot address across competing bidders on Tender GRC/ENG/2026/04.',
    status: 'Open',
  },
  {
    id: 'rf-2',
    flagType: 'Tax clearance expiry mismatch with BURS gateway',
    suppliersInvolved: ['Delta Electrical Contractors CC'],
    organizationsInvolved: ['Botswana Power Corporation'],
    severity: 'Medium',
    detectedAt: '3 Oct 2026',
    description: 'Uploaded certificate indicates 2027 expiry, but BURS real-time API response flagged taxpayer status as non-compliant.',
    status: 'Under investigation',
  },
];

export const ADMIN_DEBARMENTS: DebarmentRecord[] = [
  {
    id: 'deb-1',
    entityName: 'Vanguard Security Solutions (Pty) Ltd',
    cipaNumber: 'BW00003322114',
    scope: 'Platform-wide',
    startDate: '15 Jan 2026',
    endDate: '14 Jan 2028',
    reason: 'Statutory debarment order issued following fraudulent documentation submission.',
    issuedBy: 'Public Procurement Governance Review Board',
  },
  {
    id: 'deb-2',
    entityName: 'Apex Civil Holdings Joint Venture',
    cipaNumber: 'BW00007788990',
    scope: 'Gaborone Regional Council',
    startDate: '1 Jun 2026',
    endDate: '31 May 2027',
    reason: 'Contractual default and abandonment of municipal culvert maintenance contract.',
    issuedBy: 'Gaborone Regional Council SCM Board',
  },
];

export const ADMIN_INVOICES: AdminInvoice[] = [
  {
    id: 'inv-101',
    invoiceNumber: 'INV-2026-0941',
    orgName: 'National Training Authority',
    amountBWP: 4500,
    billingPeriod: 'October 2026',
    dueDate: '15 Oct 2026',
    status: 'Processing',
  },
  {
    id: 'inv-102',
    invoiceNumber: 'INV-2026-0899',
    orgName: 'Gaborone Regional Council',
    amountBWP: 12500,
    billingPeriod: 'October 2026',
    dueDate: '1 Oct 2026',
    status: 'Paid',
  },
  {
    id: 'inv-103',
    invoiceNumber: 'INV-2026-0898',
    orgName: 'Botswana Power Corporation',
    amountBWP: 16000,
    billingPeriod: 'October 2026',
    dueDate: '1 Oct 2026',
    status: 'Paid',
  },
  {
    id: 'inv-104',
    invoiceNumber: 'INV-2026-0850',
    orgName: 'Francistown City Council',
    amountBWP: 5500,
    billingPeriod: 'September 2026',
    dueDate: '25 Sep 2026',
    status: 'Overdue',
  },
];

export const ADMIN_NOTIFICATIONS: NotificationDelivery[] = [
  {
    id: 'notif-1',
    channel: 'SMS',
    recipient: '+267 71234567 (Kopano Supplies)',
    subjectOrPreview: 'Tender GRC/ENG/2026/04: Addendum 1 published.',
    sentAt: '5 Oct 2026, 09:14',
    status: 'Delivered',
    retryCount: 0,
  },
  {
    id: 'notif-2',
    channel: 'Email',
    recipient: 'tenders@kopano.co.bw',
    subjectOrPreview: 'Clarification response published for Streetlighting Upgrade',
    sentAt: '5 Oct 2026, 09:14',
    status: 'Delivered',
    retryCount: 0,
  },
  {
    id: 'notif-3',
    channel: 'WhatsApp',
    recipient: '+267 72987654 (Delta Electrical)',
    subjectOrPreview: 'BURS Tax Clearance verification failed. Please review.',
    sentAt: '5 Oct 2026, 08:30',
    status: 'Failed',
    retryCount: 2,
  },
  {
    id: 'notif-4',
    channel: 'Email',
    recipient: 'director@tsodilo.co.bw',
    subjectOrPreview: 'Document Vault: Workers compensation certificate verified.',
    sentAt: '4 Oct 2026, 16:45',
    status: 'Delivered',
    retryCount: 0,
  },
  {
    id: 'notif-5',
    channel: 'SMS',
    recipient: '+267 74556677 (Apex Holdings)',
    subjectOrPreview: 'Sealed tender proposal received and logged on ledger.',
    sentAt: '4 Oct 2026, 14:10',
    status: 'Delivered',
    retryCount: 0,
  },
];

export const ADMIN_USERS: AdminUserRecord[] = [
  {
    id: 'adm-1',
    fullName: 'Lesedi Mokgweetsi',
    email: 'admin@bidready360.gov.bw',
    role: 'Super admin',
    mfaEnabled: true,
    lastSignIn: 'Today, 07:45 CAT',
    status: 'Active',
  },
  {
    id: 'adm-2',
    fullName: 'Gorata Setlamelo',
    email: 'gsetlamelo@gmail.com',
    role: 'Super admin',
    mfaEnabled: true,
    lastSignIn: 'Today, 08:12 CAT',
    status: 'Active',
  },
  {
    id: 'adm-3',
    fullName: 'Thabo Mompati',
    email: 't.mompati@bidready360.gov.bw',
    role: 'Compliance officer',
    mfaEnabled: true,
    lastSignIn: 'Yesterday, 17:20 CAT',
    status: 'Active',
  },
  {
    id: 'adm-4',
    fullName: 'Naledi Kgosi',
    email: 'n.kgosi@bidready360.gov.bw',
    role: 'Operations analyst',
    mfaEnabled: true,
    lastSignIn: '3 Oct 2026, 11:05 CAT',
    status: 'Active',
  },
  {
    id: 'adm-5',
    fullName: 'Mooketsi Ramosweu',
    email: 'm.ramosweu@bidready360.gov.bw',
    role: 'Support specialist',
    mfaEnabled: false,
    lastSignIn: 'Pending invitation accept',
    status: 'Invited',
  },
];
