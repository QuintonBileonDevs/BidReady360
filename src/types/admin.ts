/**
 * BidReady360 Admin Entity Types
 */

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
  scope: string;
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
