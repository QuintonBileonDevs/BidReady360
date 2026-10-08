/**
 * BidReady360 Domain Entity Types
 * Production TypeScript definitions for Botswana Public Procurement Platform.
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
  documentType: string;
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
  hasCipa?: boolean;
  hasBurs?: boolean;
  hasPpra?: boolean;
}

export interface Organization {
  id: string;
  name: string;
  acronym: string;
  type: string;
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
  closingDate: string;
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
  weight: number;
  maxScore: number;
}

export interface Score {
  id: string;
  callId: string;
  applicationId: string;
  evaluatorId: string;
  evaluatorName: string;
  evaluatorRole: string;
  criterionId: string;
  score: number;
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
