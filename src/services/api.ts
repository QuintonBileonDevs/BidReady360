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

export interface AuthSession {
  user: ApiUser;
  activeTenant?: ApiTenantMembership;
  permissions: string[];
}

export async function apiRequest<T = any>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem('bidready_token');
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(endpoint, {
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
    throw err;
  }

  return data as T;
}

// ---------------------------------------------------------------------
// Auth API
// ---------------------------------------------------------------------
export const authApi = {
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

  async getMe(): Promise<AuthSession | null> {
    try {
      return await apiRequest<AuthSession>('/api/auth/me');
    } catch {
      return null;
    }
  },

  async logout() {
    localStorage.removeItem('bidready_token');
    await apiRequest('/api/auth/logout', { method: 'POST' }).catch(() => {});
  },
};

// ---------------------------------------------------------------------
// Reference Catalogue API
// ---------------------------------------------------------------------
export const referenceApi = {
  async loadAll() {
    return apiRequest('/api/reference');
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
    fileName: string;
    mimeType: string;
    fileBase64: string;
    documentNumber?: string;
    issueDate?: string;
    expiryDate?: string;
    title?: string;
  }) {
    return apiRequest('/api/supplier/documents/upload', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  },

  async listPeople() {
    return apiRequest<any[]>('/api/supplier/people');
  },

  async addPerson(data: any) {
    return apiRequest('/api/supplier/people', {
      method: 'POST',
      body: JSON.stringify(data),
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
