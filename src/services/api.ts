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
  organizationStatus?: string;
  rejectionReason?: string | null;
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
      err.code = data.code || data.error || 'API_ERROR';
      err.field = data.field;
      err.email = data.email;
      err.lockedUntil = data.lockedUntil || null;
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
    const res = await apiRequest<{ requiresMfa?: boolean; mfaUserId?: string; token?: string; user?: any; activeTenant?: any; profileSummary?: any }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    if (res.token) localStorage.setItem('bidready_token', res.token);
    return res;
  },

  async verifyMfa(userId: string, totpCode: string) {
    const res = await apiRequest<{ token?: string; user?: any; activeTenant?: any; profileSummary?: any }>('/api/auth/verify-mfa', {
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

  async getInvitation(token: string) {
    return apiRequest<{
      id: string;
      email: string;
      tenantType: 'supplier' | 'organization';
      tenantId: string;
      tenantName: string;
      roleId: string;
      roleName: string;
      inviterName: string;
      expiresAt: string;
    }>(`/api/auth/invitations/${encodeURIComponent(token)}`);
  },

  async acceptInvite(payload: { token: string; password: string; fullName?: string }) {
    const res = await apiRequest<{ token?: string; user?: any; activeTenant?: any; profileSummary?: any }>(
      '/api/auth/accept-invite',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
    if (res.token) localStorage.setItem('bidready_token', res.token);
    return res;
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

  async acknowledgeAddendum(callId: string, addendumId: string) {
    return apiRequest<{ success: boolean; addendumId: string; acknowledged: boolean }>(
      `/api/calls/${encodeURIComponent(callId)}/addenda/${encodeURIComponent(addendumId)}/acknowledge`,
      { method: 'POST' }
    );
  },
};

// ---------------------------------------------------------------------
// Notifications API
// ---------------------------------------------------------------------
export const notificationsApi = {
  async list(limit = 50) {
    return apiRequest<any[]>(`/api/notifications?limit=${encodeURIComponent(String(limit))}`, { cache: 'no-store' });
  },

  async getUnreadCount() {
    return apiRequest<{ unreadCount: number }>('/api/notifications/unread-count', { cache: 'no-store' });
  },

  async markRead(id: string) {
    return apiRequest<{ success: boolean }>(`/api/notifications/${encodeURIComponent(id)}/read`, { method: 'PATCH' });
  },

  async markAllRead() {
    return apiRequest<{ success: boolean; updatedCount: number }>('/api/notifications/read-all', { method: 'POST' });
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
      credentials: 'include',
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
    const params = new URLSearchParams();
    if (download) params.set('download', '1');
    const qs = params.toString();
    return `/api/supplier/documents/${encodeURIComponent(docId)}/file${qs ? `?${qs}` : ''}`;
  },

  async getDocumentFileBlob(docId: string): Promise<{ blob: Blob; fileName: string; mimeType: string; objectUrl: string }> {
    const token = localStorage.getItem('bidready_token');
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`/api/supplier/documents/${encodeURIComponent(docId)}/file`, {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
      headers,
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.message || `Failed to fetch document file (${res.status})`);
    }

    let fileName = 'document';
    const disposition = res.headers.get('content-disposition');
    if (disposition) {
      const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
      const asciiMatch = disposition.match(/filename="([^"]+)"/i) || disposition.match(/filename=([^;]+)/i);
      if (utf8Match && utf8Match[1]) {
        try {
          fileName = decodeURIComponent(utf8Match[1].trim());
        } catch {
          fileName = utf8Match[1].trim();
        }
      } else if (asciiMatch && asciiMatch[1]) {
        fileName = asciiMatch[1].trim().replace(/^"|"$/g, '');
      }
    }

    const headerMime = (res.headers.get('content-type') || '').split(';')[0].trim();
    const rawBlob = await res.blob();
    const mimeType = headerMime || rawBlob.type || 'application/octet-stream';
    const blob = rawBlob.type === mimeType ? rawBlob : new Blob([rawBlob], { type: mimeType });
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

  async updateProject(id: string, data: any) {
    return apiRequest(`/api/supplier/projects/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  },

  async deleteProject(id: string) {
    return apiRequest(`/api/supplier/projects/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  async listTeam() {
    return apiRequest<{ members: any[]; invitations: any[] }>('/api/supplier/team', { cache: 'no-store' });
  },

  async inviteTeamMember(payload: { email: string; role: string }) {
    return apiRequest<any>('/api/supplier/team/invite', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async revokeInvitation(id: string) {
    return apiRequest(`/api/supplier/team/invite/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  },

  async listDisciplines() {
    return apiRequest<any[]>('/api/supplier/disciplines');
  },

  async listConsent() {
    return apiRequest<any[]>('/api/supplier/consent');
  },

  async listConsentAccessLogs(limit = 50) {
    return apiRequest<
      {
        id: string;
        organizationId: string;
        organizationName: string;
        supplierId: string;
        consentGrantId: string | null;
        accessedByUserId: string;
        accessedByName: string;
        accessedDataScope: string[];
        ipAddress: string | null;
        accessedAt: string;
      }[]
    >(`/api/supplier/consent/access-logs?limit=${encodeURIComponent(String(limit))}`, { cache: 'no-store' });
  },

  async grantConsent(payload: {
    organizationId: string;
    scopes?: Record<string, boolean>;
    selectedDocumentIds?: string[];
    selectedDocumentNames?: string[];
    expiresAt?: string | null;
    purpose?: string;
  }) {
    return apiRequest<any>('/api/supplier/consent', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateConsentScope(
    grantId: string,
    payload: {
      scopes?: Record<string, boolean>;
      selectedDocumentIds?: string[];
      selectedDocumentNames?: string[];
      expiresAt?: string | null;
      purpose?: string;
    }
  ) {
    return apiRequest<any>(`/api/supplier/consent/${encodeURIComponent(grantId)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
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

  async withdrawApplication(applicationId: string, reason?: string) {
    return apiRequest(`/api/supplier/applications/${encodeURIComponent(applicationId)}/withdraw`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  async respondToInfoRequest(applicationId: string, responseMessage: string) {
    return apiRequest(`/api/supplier/applications/${encodeURIComponent(applicationId)}/respond`, {
      method: 'POST',
      body: JSON.stringify({ responseMessage }),
    });
  },

  async getBid(callId: string) {
    return apiRequest<any>(`/api/supplier/bids/${encodeURIComponent(callId)}`, { cache: 'no-store' });
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

  async withdrawBid(callId: string, reason?: string) {
    return apiRequest(`/api/supplier/bids/${encodeURIComponent(callId)}/withdraw`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  async listInvitations() {
    return apiRequest<any[]>('/api/supplier/invitations', { cache: 'no-store' });
  },
};

// ---------------------------------------------------------------------
// Buyer API
// ---------------------------------------------------------------------
export const buyerApi = {
  async listCalls() {
    return apiRequest<any[]>('/api/buyer/calls', { cache: 'no-store' });
  },

  async createCall(payload: any) {
    return apiRequest('/api/buyer/calls/create', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateCall(callId: string, payload: any) {
    return apiRequest(`/api/buyer/calls/${encodeURIComponent(callId)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  async createAddendum(callId: string, payload: { title: string; body?: string; summary?: string; newClosesAt?: string }) {
    return apiRequest(`/api/buyer/calls/${encodeURIComponent(callId)}/addenda`, {
      method: 'POST',
      body: JSON.stringify({
        title: payload.title,
        body: payload.body ?? payload.summary ?? '',
        newClosesAt: payload.newClosesAt,
      }),
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

  async listClarifications() {
    return apiRequest<any[]>('/api/buyer/clarifications', { cache: 'no-store' });
  },

  async answerClarification(clarificationId: string, answer: string, responderTitle?: string) {
    return apiRequest(`/api/buyer/clarifications/${clarificationId}/answer`, {
      method: 'POST',
      body: JSON.stringify({ answer, responderTitle }),
    });
  },

  async listMembers() {
    return apiRequest<any[]>('/api/buyer/members', { cache: 'no-store' });
  },

  async listSuppliers() {
    return apiRequest<any[]>('/api/buyer/suppliers', { cache: 'no-store' });
  },

  async getSupplierProfile(supplierId: string) {
    return apiRequest<any>(`/api/buyer/suppliers/${encodeURIComponent(supplierId)}`, { cache: 'no-store' });
  },

  async listCallInvitations(callId: string) {
    return apiRequest<any[]>(`/api/buyer/calls/${encodeURIComponent(callId)}/invitations`, { cache: 'no-store' });
  },

  async inviteSuppliers(callId: string, supplierIds: string[]) {
    return apiRequest(`/api/buyer/calls/${encodeURIComponent(callId)}/invitations`, {
      method: 'POST',
      body: JSON.stringify({ supplierIds }),
    });
  },

  async listBids(callId: string) {
    return apiRequest<any[]>(`/api/buyer/bids/${callId}`);
  },

  async getOpeningSession(callId: string) {
    return apiRequest<any>(`/api/buyer/bids/${encodeURIComponent(callId)}/session`, { cache: 'no-store' });
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

  async fetchDocumentBlob(docOrVersionId: string): Promise<{ blob: Blob; fileName: string; mimeType: string; objectUrl: string }> {
    const token = localStorage.getItem('bidready_token');
    const headers: Record<string, string> = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`/api/buyer/documents/${encodeURIComponent(docOrVersionId)}/file`, {
      method: 'GET',
      credentials: 'include',
      cache: 'no-store',
      headers,
    });

    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.message || `Failed to load document preview (HTTP ${res.status})`);
    }

    let fileName = 'document';
    const disposition = res.headers.get('content-disposition');
    if (disposition) {
      const utf8Match = disposition.match(/filename\*=UTF-8''([^;]+)/i);
      const asciiMatch = disposition.match(/filename="([^"]+)"/i) || disposition.match(/filename=([^;]+)/i);
      if (utf8Match && utf8Match[1]) {
        try {
          fileName = decodeURIComponent(utf8Match[1].trim());
        } catch {
          fileName = utf8Match[1].trim();
        }
      } else if (asciiMatch && asciiMatch[1]) {
        fileName = asciiMatch[1].trim().replace(/^"|"$/g, '');
      }
    }

    const headerMime = (res.headers.get('content-type') || '').split(';')[0].trim();
    const rawBlob = await res.blob();
    const mimeType = headerMime || rawBlob.type || 'application/octet-stream';
    const blob = rawBlob.type === mimeType ? rawBlob : new Blob([rawBlob], { type: mimeType });
    const objectUrl = URL.createObjectURL(blob);
    return { blob, fileName, mimeType, objectUrl };
  },

  // Step 4: Buyer Admin & Workspace Customization
  async getTeam() {
    return apiRequest<{ members: any[]; pendingInvitations: any[]; roles: any[] }>('/api/buyer/team', {
      cache: 'no-store',
    });
  },

  async listRoles() {
    return apiRequest<any[]>('/api/buyer/roles', { cache: 'no-store' });
  },

  async inviteMember(payload: {
    email: string;
    roleName?: string;
    roleId?: string;
    department?: string;
    jobTitle?: string;
    approvalLimitBWP?: number | null;
  }) {
    return apiRequest<{
      id: string;
      email: string;
      role: string;
      department: string;
      jobTitle: string;
      approvalLimitBWP: number | null;
      sentAt: string;
      expiresAt: string;
      inviteToken: string;
    }>('/api/buyer/team/invite', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateMember(
    memberId: string,
    payload: {
      roleName?: string;
      roleId?: string;
      department?: string;
      jobTitle?: string;
      approvalLimitBWP?: number | null;
      mfaEnabled?: boolean;
      conflictDeclared?: boolean;
    }
  ) {
    return apiRequest(`/api/buyer/team/members/${encodeURIComponent(memberId)}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    });
  },

  async updateMemberStatus(memberId: string, status: 'active' | 'suspended', reason?: string) {
    return apiRequest(`/api/buyer/team/members/${encodeURIComponent(memberId)}/status`, {
      method: 'POST',
      body: JSON.stringify({ status, reason }),
    });
  },

  async removeMember(memberId: string) {
    return apiRequest(`/api/buyer/team/members/${encodeURIComponent(memberId)}`, {
      method: 'DELETE',
    });
  },

  async revokeTeamInvitation(invitationId: string) {
    return apiRequest(`/api/buyer/team/invitations/${encodeURIComponent(invitationId)}`, {
      method: 'DELETE',
    });
  },

  async resendTeamInvitation(invitationId: string) {
    return apiRequest<{ id: string; email: string; expiresAt: string; inviteToken: string }>(
      `/api/buyer/team/invitations/${encodeURIComponent(invitationId)}/resend`,
      { method: 'POST' }
    );
  },

  async getBranding() {
    return apiRequest<{
      id: string;
      name: string;
      slug: string;
      brandSubtext: string;
      brandPrimaryColor: string;
      customDomain: string;
      contactEmail: string;
      contactPhone: string;
      physicalAddress: string;
      city: string;
      welcomeNotice: string;
    }>('/api/buyer/branding', { cache: 'no-store' });
  },

  async updateBranding(payload: {
    name: string;
    brandSubtext?: string;
    brandPrimaryColor?: string;
    customDomain?: string;
    contactEmail?: string;
    contactPhone?: string;
    welcomeNotice?: string;
  }) {
    return apiRequest<any>('/api/buyer/branding', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async getSettings() {
    return apiRequest<{
      minRfpAdvertisingDays: number;
      defaultCurrency: string;
      defaultClosingTimeCat: string;
      clarificationCutoffDays: number;
      requireGazetteNotice: boolean;
      autoDeadlineReminders: boolean;
      requireMfaEvaluators: boolean;
    }>('/api/buyer/settings', { cache: 'no-store' });
  },

  async updateSettings(payload: {
    minRfpAdvertisingDays: number;
    defaultCurrency: string;
    defaultClosingTimeCat: string;
    clarificationCutoffDays: number;
    requireGazetteNotice: boolean;
    autoDeadlineReminders: boolean;
    requireMfaEvaluators: boolean;
  }) {
    return apiRequest<any>('/api/buyer/settings', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async listFormTemplates() {
    return apiRequest<any[]>('/api/buyer/form-templates', { cache: 'no-store' });
  },

  async createFormTemplate(payload: {
    title: string;
    purpose?: string;
    description?: string;
    version?: string;
    fields: any[];
  }) {
    return apiRequest<{ id: string; templates: any[] }>('/api/buyer/form-templates', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateFormTemplate(
    templateId: string,
    payload: { title?: string; description?: string; version?: string; fields: any[] }
  ) {
    return apiRequest<{ success: boolean; templates: any[] }>(
      `/api/buyer/form-templates/${encodeURIComponent(templateId)}`,
      {
        method: 'PUT',
        body: JSON.stringify(payload),
      }
    );
  },

  async deleteFormTemplate(templateId: string) {
    return apiRequest(`/api/buyer/form-templates/${encodeURIComponent(templateId)}`, {
      method: 'DELETE',
    });
  },

  async getWorkflows() {
    return apiRequest<{ stages: any[]; scoringTemplates: any[]; roles: any[] }>('/api/buyer/workflows', {
      cache: 'no-store',
    });
  },

  async createWorkflowStage(payload: {
    appliesTo: 'registration' | 'eoi' | 'rfp';
    name: string;
    sequenceNo: number;
    stageType: 'review' | 'approval';
    requiredRoleId?: string | null;
    slaDays?: number | null;
  }) {
    return apiRequest<{ id: string; stages: any[]; scoringTemplates: any[]; roles: any[] }>(
      '/api/buyer/workflows/stages',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      }
    );
  },

  async deleteWorkflowStage(stageId: string) {
    return apiRequest(`/api/buyer/workflows/stages/${encodeURIComponent(stageId)}`, {
      method: 'DELETE',
    });
  },

  async saveScoringTemplates(scoringTemplates: any[]) {
    return apiRequest<{ scoringTemplates: any[] }>('/api/buyer/workflows/scoring-templates', {
      method: 'PUT',
      body: JSON.stringify({ scoringTemplates }),
    });
  },

  async getIntegrations() {
    return apiRequest<{ apiClients: any[]; webhooks: any[] }>('/api/buyer/integrations', { cache: 'no-store' });
  },

  async createApiKey(payload: { name: string; scopes?: string[] }) {
    return apiRequest<{
      id: string;
      name: string;
      keyPrefix: string;
      scopes: string[];
      createdAt: string;
      plainKeyOnce: string;
    }>('/api/buyer/integrations/api-keys', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async revokeApiKey(clientId: string) {
    return apiRequest(`/api/buyer/integrations/api-keys/${encodeURIComponent(clientId)}`, {
      method: 'DELETE',
    });
  },

  async saveWebhook(payload: { id?: string; url: string; eventTypes?: string[]; isActive?: boolean }) {
    return apiRequest<{
      id: string;
      url: string;
      eventTypes: string[];
      isActive: boolean;
      createdAt: string;
      signingSecretOnce?: string;
    }>('/api/buyer/integrations/webhooks', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async deleteWebhook(endpointId: string) {
    return apiRequest(`/api/buyer/integrations/webhooks/${encodeURIComponent(endpointId)}`, {
      method: 'DELETE',
    });
  },

  async getBilling() {
    return apiRequest<{
      subscription: {
        id: string | null;
        status: string;
        currentPeriodStart: string | null;
        currentPeriodEnd: string | null;
        planName: string;
        planCode: string;
        price: number;
        currency: string;
        billingInterval: string;
        maxUsers: number | null;
        maxCallsPerYear: number | null;
        features: Record<string, any>;
      } | null;
      usage: {
        callsPublishedThisYear: number;
        activeSeatsUsed: number;
      };
      availablePlans: any[];
      invoices: {
        id: string;
        invoiceNumber: string;
        amount: number;
        currency: string;
        status: string;
        issuedAt: string | null;
        dueAt: string | null;
        paidAt: string | null;
      }[];
    }>('/api/buyer/billing', { cache: 'no-store' });
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

  async verifyChain() {
    return apiRequest<{
      valid: boolean;
      chainLinkValid: boolean;
      totalChecked: number;
      brokenLinks: number;
      hashMismatches: number;
      latestHash: string | null;
      firstBrokenEventId: string | null;
      firstBrokenReason: string | null;
      checkedAt: string;
    }>('/api/audit/verify', { cache: 'no-store' });
  },
};

// ---------------------------------------------------------------------
// Platform Admin API
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
  sha256?: string | null;
  hasFile?: boolean;
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
  omangValid?: boolean | null;
  omangMessage?: string | null;
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
  sha256?: string | null;
  hasFile?: boolean;
  uploadedAt: string;
}

export interface AdminOverviewKpis {
  pendingOrgsCount: number;
  activeOrgsCount: number;
  suspendedOrgsCount: number;
  totalSuppliersCount: number;
  pendingSuppliersCount: number;
  verifiedSuppliersCount: number;
  pendingPeopleCount: number;
  pendingDocumentsCount: number;
  verificationQueueCount: number;
  activeCallsCount: number;
  totalBidsCount: number;
  totalUsersCount: number;
  lockedUsersCount: number;
  openRiskFlagsCount: number;
  activeDebarmentsCount: number;
  failedDeliveriesCount: number;
  overdueInvoicesCount: number;
  monthlyMrrBwp: number;
  complianceRatePercent: number;
}

export interface AdminOverviewResponse {
  kpis: AdminOverviewKpis;
  pendingOrgs: {
    id: string;
    name: string;
    type: string | null;
    gazetteRef: string | null;
    email: string | null;
    status: string;
    verificationStatus: string;
    createdAt: string;
  }[];
  openRiskFlags: {
    id: string;
    flagType: string;
    severity: string;
    status: string;
    details: any;
    createdAt: string;
    supplierName: string;
  }[];
  recentAuditEvents: AdminAuditEventRecord[];
  monthlyGrowth: { month: string; suppliers: number; organizations: number }[];
  monthlyRevenue: { month: string; paid: number; outstanding: number; total: number }[];
  generatedAt: string;
}

export interface AdminOrganizationRecord {
  id: string;
  name: string;
  slug: string;
  organizationType: string | null;
  registrationNumber: string | null;
  status: 'pending' | 'active' | 'suspended' | 'closed';
  verificationStatus: 'pending_review' | 'verified' | 'rejected';
  contactEmail: string | null;
  contactPhone: string | null;
  city: string | null;
  district: string | null;
  rejectionReason: string | null;
  approvedAt: string | null;
  createdAt: string;
  membersCount: number;
  contactPerson: string | null;
  leadEmail: string | null;
  planName: string;
}

export interface AdminSupplierRecord {
  id: string;
  legalName: string;
  tradingName: string | null;
  cipaNumber: string;
  tinNumber: string | null;
  ppraCode: string | null;
  companyType: string | null;
  city: string | null;
  district: string | null;
  email: string | null;
  primaryPhone: string | null;
  citizenOwnedPercentage: number;
  status: string;
  verificationStatus: 'unverified' | 'pending' | 'verified' | 'rejected';
  complianceStatus: 'Fully compliant' | 'Action required' | 'Non-compliant';
  profileCompleteness: number;
  verifiedAt: string | null;
  createdAt: string;
  totalDocs: number;
  verifiedDocs: number;
  pendingDocs: number;
  expiredDocs: number;
  peopleCount: number;
  verifiedPeopleCount: number;
  activeDebarments: number;
}

export interface AdminSupplierDetail {
  supplier: AdminSupplierRecord & { physicalAddress?: string | null };
  directors: {
    id: string;
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
    hasId: boolean;
    idLast4: string | null;
    omangValid: boolean | null;
    omangMessage: string | null;
  }[];
  documents: {
    documentId: string;
    versionId: string;
    documentTypeCode: string;
    documentTypeName: string;
    title: string;
    versionNo: number;
    fileName: string;
    mimeType: string;
    documentNumber: string | null;
    issueDate: string | null;
    expiryDate: string | null;
    verificationStatus: string;
    verifiedAt: string | null;
    verificationNotes: string | null;
    rejectionReason: string | null;
    sha256?: string | null;
    hasFile?: boolean;
    uploadedAt: string;
  }[];
  debarments: {
    id: string;
    reason: string;
    startsOn: string;
    endsOn: string | null;
    liftedAt: string | null;
    evidenceRef: string | null;
    organizationName: string | null;
  }[];
}

export interface AdminManagedUser {
  id: string;
  fullName: string;
  email: string;
  phone: string | null;
  status: string;
  isPlatformAdmin: boolean;
  emailVerifiedAt: string | null;
  mfaEnabled: boolean;
  mfaType: string | null;
  lastLoginAt: string | null;
  failedLoginAttempts: number;
  lockedUntil: string | null;
  isLocked: boolean;
  createdAt: string;
  activeSessionsCount: number;
  tenantName: string;
  roleLabel: string;
  tenantType: 'platform' | 'organization' | 'supplier' | 'none';
}

export interface AdminRiskFlagRecord {
  id: string;
  supplierId: string;
  supplierName: string;
  supplierCipa: string | null;
  callId: string | null;
  callRef: string | null;
  organizationName: string | null;
  flagType: string;
  severity: 'low' | 'medium' | 'high';
  details: any;
  status: 'open' | 'reviewed' | 'dismissed' | 'resolved';
  reviewedAt: string | null;
  reviewedByName: string | null;
  createdAt: string;
}

export interface AdminDebarmentRecord {
  id: string;
  supplierId: string;
  entityName: string;
  cipaNumber: string | null;
  organizationId: string | null;
  scope: string;
  reason: string;
  startsOn: string;
  endsOn: string | null;
  evidenceRef: string | null;
  liftedAt: string | null;
  isActive: boolean;
  issuedBy: string | null;
  createdAt: string;
}

export interface AdminCategoryRecord {
  id: string;
  code: string;
  name: string;
  description: string | null;
  level: number;
  parentId: string | null;
  sortOrder: number;
  isActive: boolean;
}

export interface AdminDocumentTypeRecord {
  id: string;
  code: string;
  name: string;
  description: string | null;
  issuingAuthority: string | null;
  requiresExpiry: boolean;
  requiresNumber: boolean;
  defaultValidityDays: number | null;
  verificationMethod: string | null;
  isMandatoryDefault: boolean;
  sortOrder: number;
  isActive: boolean;
}

export interface AdminPlanRecord {
  id: string;
  code: string;
  name: string;
  audience: string;
  price: number;
  currency: string;
  billingInterval: string;
  maxUsers: number | null;
  maxCallsPerYear: number | null;
  features: any;
  sortOrder: number;
  subscribersCount: number;
}

export interface AdminInvoiceRecord {
  id: string;
  invoiceNumber: string;
  orgName: string;
  amountBWP: number;
  currency: string;
  status: string;
  issuedAt: string | null;
  dueDate: string | null;
  paidAt: string | null;
  createdAt: string;
}

export interface AdminNotificationRecord {
  id: string;
  channel: string;
  recipient: string;
  templateCode: string;
  status: string;
  errorMessage: string | null;
  retryCount: number;
  sentAt: string | null;
}

export interface AdminInAppNotificationRecord {
  id: string;
  eventType: string;
  title: string;
  body: string | null;
  linkUrl: string | null;
  priority: 'urgent' | 'info' | 'success' | 'warning' | string;
  isRead: boolean;
  readAt: string | null;
  createdAt: string;
  recipientName: string;
  recipientEmail: string | null;
  workspaceName: string;
  workspaceType: 'Buyer' | 'Supplier' | 'Platform' | string;
}

export interface AdminAuditEventRecord {
  id: string;
  timestamp: string;
  actorName: string;
  actorRole: string;
  organizationName: string;
  action: string;
  entityType: string;
  entityId: string;
  details: string;
  ipAddress: string;
  prevHash?: string | null;
  rowHash?: string | null;
}

export interface AdminPlatformSettings {
  cipaEndpoint: string;
  bursEndpoint: string;
  retentionYears: string;
}

export const adminApi = {
  // Overview KPIs
  async getOverview(): Promise<AdminOverviewResponse> {
    return apiRequest('/api/admin/overview', { cache: 'no-store' });
  },

  // Organizations
  async listOrganizations(params?: { status?: string; search?: string }): Promise<AdminOrganizationRecord[]> {
    const qs = new URLSearchParams();
    if (params?.status) qs.set('status', params.status);
    if (params?.search) qs.set('search', params.search);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return apiRequest(`/api/admin/organizations${suffix}`, { cache: 'no-store' });
  },

  async approveOrganization(id: string) {
    return apiRequest(`/api/admin/organizations/${id}/approve`, { method: 'POST' });
  },

  async rejectOrganization(id: string, reason: string) {
    return apiRequest(`/api/admin/organizations/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  async suspendOrganization(id: string, reason?: string) {
    return apiRequest(`/api/admin/organizations/${id}/suspend`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  // Suppliers
  async listSuppliers(params?: { search?: string; verificationStatus?: string }): Promise<AdminSupplierRecord[]> {
    const qs = new URLSearchParams();
    if (params?.search) qs.set('search', params.search);
    if (params?.verificationStatus) qs.set('verificationStatus', params.verificationStatus);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return apiRequest(`/api/admin/suppliers${suffix}`, { cache: 'no-store' });
  },

  async getSupplierDetail(id: string): Promise<AdminSupplierDetail> {
    return apiRequest(`/api/admin/suppliers/${id}`, { cache: 'no-store' });
  },

  async updateSupplierVerification(
    id: string,
    payload: {
      verificationStatus: 'unverified' | 'pending' | 'verified' | 'rejected';
      complianceStatus?: 'Fully compliant' | 'Action required' | 'Non-compliant';
      status?: 'draft' | 'active' | 'suspended' | 'closed';
      notes?: string;
    }
  ) {
    return apiRequest(`/api/admin/suppliers/${id}/verification`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // Verification Queue
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

    let fileName = 'document';
    const contentDisposition = res.headers.get('content-disposition');
    if (contentDisposition) {
      const utf8Match = contentDisposition.match(/filename\*=UTF-8''([^;]+)/i);
      const asciiMatch = contentDisposition.match(/filename="([^"]+)"/i) || contentDisposition.match(/filename=([^;]+)/i);
      if (utf8Match && utf8Match[1]) {
        try {
          fileName = decodeURIComponent(utf8Match[1].trim());
        } catch {
          fileName = utf8Match[1].trim();
        }
      } else if (asciiMatch && asciiMatch[1]) {
        fileName = asciiMatch[1].trim().replace(/^"|"$/g, '');
      }
    }

    const headerMime = (res.headers.get('content-type') || '').split(';')[0].trim();
    const rawBlob = await res.blob();
    const mimeType = headerMime || rawBlob.type || 'application/octet-stream';
    const blob = rawBlob.type === mimeType ? rawBlob : new Blob([rawBlob], { type: mimeType });
    const objectUrl = URL.createObjectURL(blob);
    return { blob, fileName, mimeType, objectUrl };
  },

  // Users & Security
  async listUsers(params?: { search?: string; filter?: 'all' | 'locked' | 'admins' | 'suspended' }): Promise<AdminManagedUser[]> {
    const qs = new URLSearchParams();
    if (params?.search) qs.set('search', params.search);
    if (params?.filter) qs.set('filter', params.filter);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return apiRequest(`/api/admin/users${suffix}`, { cache: 'no-store' });
  },

  async unlockUser(id: string) {
    return apiRequest(`/api/admin/users/${id}/unlock`, { method: 'POST' });
  },

  async updateUserStatus(id: string, status: 'active' | 'suspended') {
    return apiRequest(`/api/admin/users/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
  },

  async revokeUserSessions(id: string) {
    return apiRequest(`/api/admin/users/${id}/revoke-sessions`, { method: 'POST' });
  },

  // Risk & Debarments
  async getRiskAndDebarments(): Promise<{ flags: AdminRiskFlagRecord[]; debarments: AdminDebarmentRecord[] }> {
    return apiRequest('/api/admin/risk', { cache: 'no-store' });
  },

  async createRiskFlag(payload: {
    supplierId: string;
    flagType: 'shared_director' | 'shared_address' | 'shared_phone' | 'duplicate_document' | 'price_pattern' | 'other';
    severity: 'low' | 'medium' | 'high';
    description: string;
    callId?: string;
  }) {
    return apiRequest('/api/admin/risk/flags', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateRiskFlagStatus(id: string, status: 'open' | 'reviewed' | 'dismissed' | 'resolved') {
    return apiRequest(`/api/admin/risk/flags/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
  },

  async createDebarment(payload: {
    supplierId: string;
    organizationId?: string | null;
    reason: string;
    startsOn?: string;
    endsOn?: string | null;
    evidenceRef?: string;
  }) {
    return apiRequest('/api/admin/debarments', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async liftDebarment(id: string, reason?: string) {
    return apiRequest(`/api/admin/debarments/${id}/lift`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  },

  // Master Catalogues
  async getCatalogues(): Promise<{ categories: AdminCategoryRecord[]; documentTypes: AdminDocumentTypeRecord[] }> {
    return apiRequest('/api/admin/catalogues', { cache: 'no-store' });
  },

  async createCategory(payload: {
    code: string;
    name: string;
    description?: string;
    parentId?: string | null;
    level?: number;
    sortOrder?: number;
  }): Promise<AdminCategoryRecord> {
    return apiRequest('/api/admin/catalogues/categories', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateCategory(
    id: string,
    payload: { code?: string; name?: string; description?: string | null; isActive?: boolean; sortOrder?: number }
  ): Promise<AdminCategoryRecord> {
    return apiRequest(`/api/admin/catalogues/categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  async createDocumentType(payload: {
    code: string;
    name: string;
    description?: string;
    issuingAuthority?: string;
    requiresExpiry?: boolean;
    requiresNumber?: boolean;
    defaultValidityDays?: number | null;
    verificationMethod?: string;
    isMandatoryDefault?: boolean;
    sortOrder?: number;
  }): Promise<AdminDocumentTypeRecord> {
    return apiRequest('/api/admin/catalogues/document-types', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async updateDocumentType(
    id: string,
    payload: {
      name?: string;
      description?: string | null;
      issuingAuthority?: string | null;
      requiresExpiry?: boolean;
      requiresNumber?: boolean;
      defaultValidityDays?: number | null;
      verificationMethod?: string | null;
      isMandatoryDefault?: boolean;
      isActive?: boolean;
      sortOrder?: number;
    }
  ): Promise<AdminDocumentTypeRecord> {
    return apiRequest(`/api/admin/catalogues/document-types/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  // Billing
  async getBilling(): Promise<{ plans: AdminPlanRecord[]; invoices: AdminInvoiceRecord[] }> {
    return apiRequest('/api/admin/billing', { cache: 'no-store' });
  },

  async updatePlan(
    id: string,
    payload: { price?: number; maxCallsPerYear?: number | null; description?: string; reason?: string }
  ) {
    return apiRequest(`/api/admin/billing/plans/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },

  // Notifications
  async listInAppNotifications(): Promise<AdminInAppNotificationRecord[]> {
    return apiRequest('/api/admin/notifications/in-app', { cache: 'no-store' });
  },

  async listNotifications(): Promise<AdminNotificationRecord[]> {
    return apiRequest('/api/admin/notifications', { cache: 'no-store' });
  },

  async retryNotification(id: string): Promise<AdminNotificationRecord> {
    return apiRequest(`/api/admin/notifications/${id}/retry`, { method: 'POST' });
  },

  // Audit Log
  async listAuditLogs(filters?: {
    entityType?: string;
    actor?: string;
    action?: string;
    search?: string;
    fromDate?: string;
    toDate?: string;
    limit?: number;
  }): Promise<AdminAuditEventRecord[]> {
    const qs = new URLSearchParams();
    if (filters?.entityType) qs.set('entityType', filters.entityType);
    if (filters?.actor) qs.set('actor', filters.actor);
    if (filters?.action) qs.set('action', filters.action);
    if (filters?.search) qs.set('search', filters.search);
    if (filters?.fromDate) qs.set('fromDate', filters.fromDate);
    if (filters?.toDate) qs.set('toDate', filters.toDate);
    if (filters?.limit) qs.set('limit', String(filters.limit));
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    return apiRequest(`/api/admin/audit-log${suffix}`, { cache: 'no-store' });
  },

  async verifyAuditChain() {
    return apiRequest<{
      valid: boolean;
      chainLinkValid: boolean;
      totalChecked: number;
      brokenLinks: number;
      hashMismatches: number;
      latestHash: string | null;
      firstBrokenEventId: string | null;
      firstBrokenReason: string | null;
      checkedAt: string;
    }>('/api/admin/audit-log/verify', { cache: 'no-store' });
  },

  // Support Sessions
  async startSupportSession(payload: {
    targetType: string;
    targetId?: string | null;
    targetName: string;
    ticketRef: string;
    justification: string;
  }) {
    return apiRequest('/api/admin/support/sessions', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  // Settings
  async getSettings(): Promise<AdminPlatformSettings> {
    return apiRequest('/api/admin/settings', { cache: 'no-store' });
  },

  async updateSettings(payload: AdminPlatformSettings): Promise<AdminPlatformSettings> {
    return apiRequest('/api/admin/settings', {
      method: 'PUT',
      body: JSON.stringify(payload),
    });
  },
};


