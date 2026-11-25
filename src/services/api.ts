/**
 * BidReady360 Client API Layer
 * Live PostgreSQL Backend integration via Express server
 */

export interface ApiUser {
  id: string;
  email: string;
  fullName: string;
  phone?: string;
  isPlatformAdmin: boolean;
}

export interface ApiTenantMembership {
  tenantType: 'organization' | 'supplier';
  tenantId: string;
  tenantName: string;
  roleId: string;
  roleName: string;
  isOwner: boolean;
  status: string;
  permissions: string[];
}

export interface ProfileSummary {
  userId: string;
  displayName: string;
  tenantType: 'supplier' | 'organization' | 'platform';
  tenantId: string | null;
  role: string;
  supplierOrOrgName: string;
  verificationStatus: string;
  cipaNumber?: string;
  emailVerified?: boolean;
  complianceStatus?: string;
  profileCompleteness?: number;
}

export interface AuthSession {
  user: ApiUser;
  activeTenant?: ApiTenantMembership;
  profileSummary?: ProfileSummary;
  permissions: string[];
}

type InFlightListener = (count: number) => void;
class InFlightTracker {
  private count = 0;
  private listeners: Set<InFlightListener> = new Set();

  increment() {
    this.count++;
    this.notify();
  }

  decrement() {
    this.count = Math.max(0, this.count - 1);
    this.notify();
  }

  getCount() {
    return this.count;
  }

  subscribe(listener: InFlightListener) {
    this.listeners.add(listener);
    listener(this.count);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach((l) => l(this.count));
  }
}

export const inFlightTracker = new InFlightTracker();

export async function apiRequest<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  inFlightTracker.increment();
  try {
    const token = localStorage.getItem('bidready_token');
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(endpoint, {
      credentials: 'include',
      ...options,
      headers,
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      const errorMsg = data.message || `Request failed with status ${res.status}`;
      const err = new Error(errorMsg) as any;
      err.status = res.status;
      err.code = data.code || 'API_ERROR';
      err.field = data.field;
      err.email = data.email;
      throw err;
    }

    return data as T;
  } finally {
    inFlightTracker.decrement();
  }
}

// ---------------------------------------------------------------------
// Auth API
// ---------------------------------------------------------------------
export const authApi = {
  async saveSupplierStep(payload: {
    step: 1 | 2 | 3;
    email: string;
    fullName?: string;
    phone?: string;
    password?: string;
    legalName?: string;
    cipaUin?: string;
    companyType?: string;
    city?: string;
    agreedToTerms?: boolean;
    agreedToPrivacy?: boolean;
  }) {
    const res = await apiRequest<{ token?: string; user?: any; supplier?: any; nextStep?: number }>(
      '/api/auth/register-supplier-step',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
    if (res.token) localStorage.setItem('bidready_token', res.token);
    return res;
  },

  async getSupplierProgress(email: string) {
    return apiRequest<{
      found: boolean;
      email?: string;
      fullName?: string;
      phone?: string;
      legalName?: string;
      tradingName?: string;
      cipaNumber?: string;
      companyType?: string;
      city?: string;
      currentStep?: number;
    }>(`/api/auth/supplier-progress?email=${encodeURIComponent(email)}`);
  },

  async registerSupplier(payload: {
    legalName: string;
    cipaUin: string;
    fullName: string;
    email: string;
    password: string;
    phone?: string;
  }) {
    const res = await apiRequest<{ token?: string; user?: any }>('/api/auth/register-supplier', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (res.token) localStorage.setItem('bidready_token', res.token);
    return res;
  },

  async registerBuyer(payload: {
    organizationName: string;
    organizationType?: string;
    fullName: string;
    email: string;
    password: string;
    phone?: string;
  }) {
    const res = await apiRequest<{ token?: string; user?: any }>('/api/auth/register-buyer', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (res.token) localStorage.setItem('bidready_token', res.token);
    return res;
  },

  async login(email: string, password: string) {
    const res = await apiRequest<{ requiresMfa?: boolean; mfaUserId?: string; token?: string; user?: any }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (res.token) localStorage.setItem('bidready_token', res.token);
    return res;
  },

  async verifyMfa(userId: string, totpCode: string) {
    const res = await apiRequest<{ token?: string; user?: any }>('/api/auth/verify-mfa', {
      method: 'POST',
      body: JSON.stringify({ userId, totpCode }),
    });
    if (res.token) localStorage.setItem('bidready_token', res.token);
    return res;
  },

  async verifyEmail(tokenOrEmail: string) {
    return await apiRequest<{ success: boolean; message: string }>('/api/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ token: tokenOrEmail, email: tokenOrEmail }),
    });
  },

  async resendVerification(email: string) {
    return await apiRequest<{ success: boolean; message: string }>('/api/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  async forgotPassword(email: string) {
    return await apiRequest<{ success: boolean; message: string }>('/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  async resetPassword(token: string, passwordPlain: string) {
    return await apiRequest<{ success: boolean; message: string }>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password: passwordPlain }),
    });
  },

  async switchTenant(tenantId: string, tenantType: 'supplier' | 'organization') {
    return await apiRequest<{ success: boolean; activeTenant: any }>('/api/auth/switch-tenant', {
      method: 'POST',
      body: JSON.stringify({ tenantId, tenantType }),
    });
  },

  async getMe(): Promise<AuthSession | null> {
    try {
      if (typeof window !== 'undefined' && window.location.search.includes('slowgate=1')) {
        await new Promise((resolve) => setTimeout(resolve, 5000));
      }
      return await apiRequest<AuthSession>('/api/auth/me');
    } catch {
      return null;
    }
  },

  async bootstrap(signal?: AbortSignal) {
    return await apiRequest<any>('/api/bootstrap', { signal });
  },

  async logout() {
    localStorage.removeItem('bidready_token');
    localStorage.removeItem('bidready_session');
    localStorage.removeItem('bidready_last_active');
    await apiRequest('/api/auth/logout', { method: 'POST' }).catch(() => {});
  },
};

// ---------------------------------------------------------------------
// Reference Catalogue API
// ---------------------------------------------------------------------
export interface CategoryTreeNode {
  id: string;
  code: string;
  name: string;
  description: string | null;
  level: number;
  parentId: string | null;
  sortOrder: number;
  children: {
    id: string;
    code: string;
    name: string;
    description: string | null;
    level: number;
    parentId: string | null;
    sortOrder: number;
  }[];
}

export const referenceApi = {
  async loadAll() {
    return apiRequest('/api/reference');
  },
  async getCategories(): Promise<CategoryTreeNode[]> {
    return apiRequest<CategoryTreeNode[]>('/api/reference/categories');
  },
};

// ---------------------------------------------------------------------
// Calls & Opportunities API
// ---------------------------------------------------------------------
export const callsApi = {
  async listOpen(filters?: { query?: string; type?: string }) {
    const params = new URLSearchParams();
    if (filters?.query) params.set('q', filters.query);
    if (filters?.type) params.set('type', filters.type);
    return apiRequest<any[]>(`/api/calls?${params.toString()}`);
  },

  async getDetail(callId: string) {
    return apiRequest<any>(`/api/calls/${callId}`);
  },

  async listClarifications(callId: string) {
    return apiRequest<any[]>(`/api/calls/${callId}/clarifications`);
  },

  async askClarification(callId: string, question: string, topic?: string) {
    return apiRequest(`/api/calls/${callId}/clarifications`, {
      method: 'POST',
      body: JSON.stringify({ question, topic }),
    });
  },

  async getSupplierPreview() {
    return apiRequest<any>('/api/calls/supplier-preview');
  },
};

// ---------------------------------------------------------------------
// Supplier API (Passport & Vault)
// ---------------------------------------------------------------------
export const supplierApi = {
  async getProfile() {
    return apiRequest<any>('/api/supplier/profile');
  },

  async updateProfile(data: any) {
    return apiRequest('/api/supplier/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async listDocuments() {
    return apiRequest<any[]>('/api/supplier/documents');
  },

  async uploadDocument(payload: {
    documentTypeCode: string;
    file: File;
    documentNumber?: string;
    issueDate?: string;
    expiryDate?: string;
    certifiedCopy?: boolean;
    title?: string;
    identityType?: 'OMANG' | 'PASSPORT';
    gender?: 'male' | 'female' | '';
  }) {
    const token = localStorage.getItem('bidready_token');
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const formData = new FormData();
    formData.append('file', payload.file);
    formData.append('documentTypeCode', payload.documentTypeCode);
    if (payload.documentNumber) formData.append('documentNumber', payload.documentNumber);
    if (payload.issueDate) formData.append('issueDate', payload.issueDate);
    if (payload.expiryDate) formData.append('expiryDate', payload.expiryDate);
    if (payload.certifiedCopy !== undefined) formData.append('certifiedCopy', String(payload.certifiedCopy));
    if (payload.title) formData.append('title', payload.title);
    if (payload.identityType) formData.append('identityType', payload.identityType);
    if (payload.gender) formData.append('gender', payload.gender);

    const res = await fetch('/api/supplier/documents/upload', {
      method: 'POST',
      headers,
      body: formData,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      const errorMsg = data.message || data.error || `Upload failed with status ${res.status}`;
      const err = new Error(errorMsg) as any;
      err.status = res.status;
      err.code = data.code || 'API_ERROR';
      err.field = data.field;
      throw err;
    }
    return data;
  },

  async readDocument(payload: {
    fileBase64: string;
    mimeType: string;
    documentTypeName?: string;
    identityType?: 'OMANG' | 'PASSPORT';
  }) {
    return apiRequest<{
      document_type?: string | null;
      holder_name?: string | null;
      document_number?: string | null;
      issue_date?: string | null;
      expiry_date?: string | null;
      issuing_authority?: string | null;
      omang_valid?: boolean | null;
      omang_error?: string | null;
      derived_gender?: 'male' | 'female' | null;
      validation_status?: string;
      auto_fill_allowed?: boolean;
      verified?: boolean;
    }>('/api/supplier/documents/read', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async deleteDocument(id: string) {
    return apiRequest(`/api/supplier/documents/${id}`, {
      method: 'DELETE',
    });
  },

  getDocumentDownloadUrl(docId: string, download = false): string {
    const token = localStorage.getItem('bidready_token');
    const params = new URLSearchParams();
    if (download) params.set('download', '1');
    if (token) params.set('token', token);
    return `/api/supplier/documents/${encodeURIComponent(docId)}/file?${params.toString()}`;
  },

  async getDocumentFileBlob(docId: string): Promise<{ blob: Blob; fileName: string; mimeType: string; objectUrl: string }> {
    const token = localStorage.getItem('bidready_token');
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`/api/supplier/documents/${encodeURIComponent(docId)}/file`, {
      method: 'GET',
      headers,
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.message || `Failed to fetch document file (${res.status})`);
    }

    let fileName = 'document.pdf';
    const disposition = res.headers.get('content-disposition');
    if (disposition) {
      const match = disposition.match(/filename\*?=(?:UTF-8'')?"?([^";]+)"?/i);
      if (match && match[1]) {
        fileName = decodeURIComponent(match[1].trim());
      }
    }

    const blob = await res.blob();
    const mimeType = blob.type || res.headers.get('content-type') || 'application/pdf';
    const objectUrl = URL.createObjectURL(blob);
    return { blob, fileName, mimeType, objectUrl };
  },

  async listPeople() {
    return apiRequest<any[]>('/api/supplier/people', { cache: 'no-store' });
  },

  async addPerson(data: any) {
    return apiRequest('/api/supplier/people', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async updatePerson(id: string, data: any) {
    return apiRequest(`/api/supplier/people/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deletePerson(id: string) {
    return apiRequest(`/api/supplier/people/${id}`, {
      method: 'DELETE',
    });
  },

  async listProjects() {
    return apiRequest<any[]>('/api/supplier/projects');
  },

  async addProject(data: any) {
    return apiRequest('/api/supplier/projects', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  },

  async listDisciplines() {
    return apiRequest<any[]>('/api/supplier/disciplines');
  },

  async listConsent() {
    return apiRequest<any[]>('/api/supplier/consent');
  },

  async revokeConsent(grantId: string, reason?: string) {
    return apiRequest(`/api/supplier/consent/${grantId}/revoke`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  async listApplications() {
    return apiRequest<any[]>('/api/supplier/applications');
  },

  async submitApplication(payload: {
    callId: string;
    answers: Record<string, any>;
    attachedDocumentVersionIds: string[];
  }) {
    return apiRequest('/api/supplier/applications/submit', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async sealBid(payload: {
    callId: string;
    financialSchedule: { lineNo: number; description: string; quantity: number; unitPrice: number }[];
  }) {
    return apiRequest('/api/supplier/bids/seal', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};

// ---------------------------------------------------------------------
// Buyer API
// ---------------------------------------------------------------------
export const buyerApi = {
  async createCall(payload: any) {
    return apiRequest('/api/buyer/calls/create', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async listApplications() {
    return apiRequest<any[]>('/api/buyer/applications');
  },

  async reviewApplication(applicationId: string, decision: string, comment?: string) {
    return apiRequest(`/api/buyer/applications/${applicationId}/review`, {
      method: 'POST',
      body: JSON.stringify({ decision, comment }),
    });
  },

  async answerClarification(clarificationId: string, answer: string, responderTitle?: string) {
    return apiRequest(`/api/buyer/clarifications/${clarificationId}/answer`, {
      method: 'POST',
      body: JSON.stringify({ answer, responderTitle }),
    });
  },

  async listBids(callId: string) {
    return apiRequest<any[]>(`/api/buyer/bids/${callId}`);
  },

  async conductOpeningSession(callId: string, witnesses?: any[]) {
    return apiRequest(`/api/buyer/bids/${callId}/open-session`, {
      method: 'POST',
      body: JSON.stringify({ witnesses }),
    });
  },

  async getEvaluations(callId: string) {
    return apiRequest<any>(`/api/buyer/evaluations/${callId}`);
  },

  async declareConflict(callId: string, hasConflict: boolean, details?: string) {
    return apiRequest(`/api/buyer/evaluations/${callId}/declare-conflict`, {
      method: 'POST',
      body: JSON.stringify({ hasConflict, details }),
    });
  },

  async submitScore(callId: string, criterionId: string, bidId: string, score: number, comment?: string) {
    return apiRequest(`/api/buyer/evaluations/${callId}/score`, {
      method: 'POST',
      body: JSON.stringify({ criterionId, bidId, score, comment }),
    });
  },

  async lockScorecard(callId: string) {
    return apiRequest(`/api/buyer/evaluations/${callId}/lock`, {
      method: 'POST',
    });
  },

  async listAwards() {
    return apiRequest<any[]>('/api/buyer/awards');
  },

  async recommendAward(payload: { callId: string; bidId: string; supplierId: string; awardValue: number; justification: string }) {
    return apiRequest('/api/buyer/awards/recommend', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async approveAward(awardId: string, decision: 'approved' | 'rejected', comment?: string) {
    return apiRequest(`/api/buyer/awards/${awardId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ decision, comment }),
    });
  },

  async listContracts() {
    return apiRequest<any[]>('/api/buyer/contracts');
  },
};

// ---------------------------------------------------------------------
// Audit & Forensics API
// ---------------------------------------------------------------------
export const auditApi = {
  async listLogs(entityType?: string) {
    const params = entityType ? `?entityType=${entityType}` : '';
    return apiRequest<any[]>(`/api/audit/logs${params}`);
  },

  async recordExport(payload: { exportType: string; recordsCount: number }) {
    return apiRequest('/api/audit/export', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },
};

// ---------------------------------------------------------------------
// Platform Admin Verification API
// ---------------------------------------------------------------------
export interface AdminSupportingDoc {
  documentId: string;
  versionId: string;
  documentTypeCode: string;
  documentTypeName: string;
  title: string;
  fileName: string;
  mimeType: string;
  documentNumber: string | null;
  verificationStatus: string;
  uploadedAt: string;
}

export interface AdminQueuePerson {
  id: string;
  supplierId: string;
  supplierName: string;
  supplierCipa: string | null;
  fullName: string;
  personRole: string;
  ownershipPercent: number | null;
  identityType: string | null;
  gender: 'male' | 'female' | null;
  nationality: string | null;
  isCitizen: boolean;
  kycStatus: 'not_started' | 'pending' | 'verified' | 'failed';
  kycVerifiedAt: string | null;
  kycReference: string | null;
  idLast4: string | null;
  hasId: boolean;
  createdAt: string;
  updatedAt: string;
  supportingDocuments: AdminSupportingDoc[];
}

export interface AdminQueueDocument {
  documentId: string;
  versionId: string;
  supplierId: string;
  supplierName: string;
  supplierCipa: string | null;
  documentTypeCode: string;
  documentTypeName: string;
  title: string;
  versionNo: number;
  fileName: string;
  mimeType: string;
  fileSizeBytes: string | null;
  documentNumber: string | null;
  issueDate: string | null;
  expiryDate: string | null;
  verificationStatus: string;
  verifiedVia: string | null;
  verifiedAt: string | null;
  verificationNotes: string | null;
  rejectionReason: string | null;
  extractionConfidence: number | null;
  uploadedAt: string;
}

export const adminApi = {
  async getVerificationQueue(): Promise<{ people: AdminQueuePerson[]; documents: AdminQueueDocument[] }> {
    return apiRequest('/api/admin/verification/queue', { cache: 'no-store' });
  },

  async verifyPerson(
    personId: string,
    payload: { status: 'verified' | 'failed' | 'pending'; notes?: string }
  ) {
    return apiRequest(`/api/admin/verification/people/${personId}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async verifyDocument(
    versionId: string,
    payload: { status: 'VERIFIED' | 'REJECTED' | 'UNVERIFIABLE' | 'PENDING_VERIFICATION'; notes?: string; rejectionReason?: string }
  ) {
    return apiRequest(`/api/admin/verification/documents/${versionId}`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async fetchDocumentBlob(versionId: string): Promise<{ blob: Blob; fileName: string; mimeType: string; objectUrl: string }> {
    const token = localStorage.getItem('bidready_token');
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`/api/admin/verification/documents/${versionId}/file`, {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
      headers,
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || `Failed to load document preview (HTTP ${res.status})`);
    }

    const contentDisposition = res.headers.get('content-disposition');
    let fileName = 'document';
    if (contentDisposition) {
      const match = contentDisposition.match(/filename="?([^"]+)"?/i);
      if (match && match[1]) {
        fileName = match[1];
      }
    }

    const blob = await res.blob();
    const mimeType = blob.type || res.headers.get('content-type') || 'application/octet-stream';
    const objectUrl = URL.createObjectURL(blob);
    return { blob, fileName, mimeType, objectUrl };
  },
};

