import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useReadinessContext } from './ReadinessContext';
import {
  Supplier,
  SupplierDocument,
  Director,
  Organization,
  Call,
  Application,
  ApplicationResponse,
  Bid,
  Criterion,
  Score,
  Clarification,
  ConsentGrant,
  AuditEvent,
  NotificationItem,
  NotificationBulkAction,
  FormTemplate,
  Evaluator,
  AwardDecision,
  BuyerBrandingConfig,
} from '../types';
import { ApiUser, ProfileSummary, authApi, callsApi, supplierApi, buyerApi, notificationsApi } from '../services/api';
import { Language, TRANSLATIONS } from '../translations';
import { calculateSupplierCompleteness, SupplierCompletenessResult } from '../utils/supplierOnboarding';
import { ThemeMode, ResolvedTheme, useTheme } from './ThemeContext';

const EMPTY_SUPPLIER: Supplier = {
  id: '',
  legalName: '',
  tradingName: '',
  cipaNumber: '',
  tinNumber: '',
  ppraCode: '',
  ppraSubcodes: [],
  ppraGrade: '',
  category: '',
  secondaryCategories: [],
  categories: [],
  physicalAddress: '',
  city: '',
  district: '',
  postalAddress: '',
  primaryPhone: '',
  email: '',
  website: '',
  yearEstablished: new Date().getFullYear(),
  citizenOwnedPercentage: 0,
  citizenOwnershipSet: false,
  youthOwned: false,
  womenOwned: false,
  disabilityOwned: false,
  eddCertified: false,
  bankName: '',
  bankBranch: '',
  accountNumberMasked: '',
  directors: [],
  profileCompleteness: 0,
  missingItems: [],
  complianceStatus: 'Action required',
  documents: [],
  pastProjects: [],
  teamMembers: [],
  pendingInvitations: [],
  emailVerified: false,
  detailsSaved: false,
};

const DEFAULT_AWARD_DECISION: AwardDecision = {
  id: '',
  callId: '',
  callNumber: '',
  callTitle: '',
  recommendedSupplierId: '',
  recommendedSupplierName: '',
  awardedAmountBWP: 0,
  justification: '',
  status: 'Draft',
  draftedBy: '',
  draftedAt: '',
};

export type UserRole = 'public' | 'supplier' | 'buyer' | 'admin';
export type BuyerSubRole = 'Org admin' | 'Procurement officer' | 'Evaluator' | 'Approver' | 'Auditor';
export type { ThemeMode, ResolvedTheme };

export const INACTIVITY_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes of inactivity before automatic logout
export const INACTIVITY_WARNING_MS = 2 * 60 * 1000;  // 2 minutes warning countdown before expiration

export interface StoredSessionData {
  user: ApiUser;
  activeTenant?: any;
  role: UserRole;
  activeNav: string;
}

export const getStoredSession = (): StoredSessionData | null => {
  try {
    const raw = localStorage.getItem('bidready_session');
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.user) return null;

    // Check inactivity
    const lastActive = Number(localStorage.getItem('bidready_last_active') || 0);
    const now = Date.now();
    if (lastActive && (now - lastActive > INACTIVITY_TIMEOUT_MS)) {
      // Inactivity timeout exceeded while page was away
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
};

interface AppContextType {
  role: UserRole;
  setRole: (role: UserRole, targetNav?: string) => void;
  buyerSubRole: BuyerSubRole;
  setBuyerSubRole: (subRole: BuyerSubRole) => void;
  currentOrgSlug: string;
  setCurrentOrgSlug: (slug: string) => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  theme: ThemeMode;
  resolvedTheme: ResolvedTheme;
  setTheme: (theme: ThemeMode) => void;
  toggleTheme: () => void;
  t: (key: string) => string;
  activeNav: string;
  setActiveNav: (nav: string) => void;
  selectedCallId: string | null;
  setSelectedCallId: (id: string | null) => void;
  selectedAppId: string | null;
  setSelectedAppId: (id: string | null) => void;

  // Authentication & Security State
  currentUser: ApiUser | null;
  isAuthenticated: boolean;
  authLoading: boolean;
  intendedRoute: string | null;
  setIntendedRoute: (route: string | null) => void;
  loginSuccess: (session: { user: ApiUser; activeTenant?: any; profileSummary?: ProfileSummary; token?: string }, targetRole?: UserRole) => void;
  logout: (reason?: 'user_initiated' | 'inactivity') => Promise<void>;
  isInactiveWarningOpen: boolean;
  inactivitySecondsLeft: number;
  resetInactivity: () => void;

  // Gate & Profile Summary State
  profileSummary: ProfileSummary | null;
  isGateReady: boolean;
  gatePurpose: 'loading_profile' | 'setting_up' | 'switching' | 'logging_out';
  switchingTargetName: string | null;
  gateError: string | null;
  retryProfileLoad: () => Promise<void>;
  setGatePurpose: (purpose: 'loading_profile' | 'setting_up' | 'switching' | 'logging_out', targetName?: string) => void;
  switchOrganizationOrSupplier: (tenantId: string, tenantType: 'supplier' | 'organization', targetName?: string) => Promise<void>;
  
  // Loading Gate
  isBootstrapping: boolean;
  bootstrapStep: number;
  bootstrapMessage: string;
  runBootstrap: (options?: { force?: boolean }) => Promise<any>;
  
  // Buyer Verification State
  buyerOrgStatus: 'Pending' | 'Approved' | 'Rejected';
  buyerOrgRejectionReason: string | null;
  registeredBuyerOrgName: string | null;
  registeredBuyerEmail: string | null;
  registerBuyerOrganization: (data: { orgName: string; email: string; orgType?: string; regNumber?: string; jobTitle?: string; phone?: string }) => void;
  approveBuyerOrg: (orgName?: string) => void;
  rejectBuyerOrg: (orgName?: string, reason?: string) => void;
  
  // Data
  supplier: Supplier;
  allSuppliers: Supplier[];
  documents: SupplierDocument[];
  organizations: Organization[];
  calls: Call[];
  applications: Application[];
  clarifications: Clarification[];
  consentGrants: ConsentGrant[];
  criteria: Criterion[];
  scores: Score[];
  evaluators: Evaluator[];
  awardDecision: AwardDecision;
  auditEvents: AuditEvent[];
  notifications: NotificationItem[];
  formTemplates: FormTemplate[];
  buyerBranding: BuyerBrandingConfig | null;
  setBuyerBranding: (branding: BuyerBrandingConfig | null) => void;
  refreshCalls: () => Promise<void>;

  // Mutators
  updateSupplierProfile: (updates: Partial<Supplier>) => Promise<any> | void;
  uploadDocument: (doc: any) => void;
  replaceDocument: (docId: string, updates: Partial<SupplierDocument>) => void;
  deleteDocument: (docId: string) => void;
  grantConsent: (newGrant: Omit<ConsentGrant, 'id' | 'grantedAt' | 'status'>) => Promise<void>;
  revokeConsent: (grantId: string, reason?: string) => Promise<void>;
  updateConsentScope: (grantId: string, scopeKey: keyof ConsentGrant['scope'], allowed: boolean) => Promise<void>;
  submitApplication: (
    applicationData: Omit<Application, 'id' | 'submittedAt' | 'timeline'> & { initialTimelineNote?: string },
    options?: { skipApiSync?: boolean }
  ) => string;
  saveApplicationDraft: (draftData: {
    callId: string;
    callNumber: string;
    callTitle: string;
    callType: 'Registration drive' | 'EOI' | 'RFP';
    organizationId: string;
    organizationName: string;
    currentStep?: number;
    bid?: Bid;
    responses?: ApplicationResponse[];
    sharedDocumentIds?: string[];
    answers?: Record<string, any>;
    draftData?: any;
    initialTimelineNote?: string;
  }) => string;
  deleteApplicationDraft: (appId: string) => void;
  updateApplicationStatus: (appId: string, status: Application['status'], reason?: string, reviewer?: string) => void;
  withdrawApplication: (appId: string, reason?: string, options?: { skipApiSync?: boolean }) => Promise<void>;
  respondToInformationRequest: (appId: string, responseMessage: string) => Promise<void>;
  submitClarificationQuestion: (callId: string, question: string) => void;
  publishClarificationAnswer: (clarId: string, answer: string, answeredBy: string) => void;
  createCall: (newCall: Omit<Call, 'id' | 'documentsCount' | 'applicationsCount' | 'addenda'> & { id?: string }) => string;
  createFormTemplate: (template: Omit<FormTemplate, 'id' | 'updatedAt'>) => string;
  updateFormTemplate: (id: string, updates: Partial<FormTemplate>) => void;
  saveScore: (scoreData: Omit<Score, 'id' | 'scoredAt'>) => void;
  signConflictDeclaration: (evaluatorId: string, details?: string) => void;
  updateAwardDecision: (updates: Partial<AwardDecision>) => void;
  markNotificationRead: (id: string) => Promise<void>;
  markNotificationUnread: (id: string) => Promise<void>;
  toggleNotificationStar: (id: string, starred: boolean) => Promise<void>;
  toggleNotificationArchive: (id: string, archived: boolean) => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  bulkUpdateNotifications: (ids: string[], action: NotificationBulkAction) => Promise<void>;
  markAllNotificationsRead: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  addAuditEvent: (event: Omit<AuditEvent, 'id' | 'timestamp'>) => void;

  // Completeness & Onboarding
  completenessResult: SupplierCompletenessResult;
}

const AppContext = createContext<AppContextType | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { waitForPaintAndSettle } = useReadinessContext();

  // 1. Initialize authentication and navigation from stored session
  const initialSession = getStoredSession();

  const [currentUser, setCurrentUser] = useState<ApiUser | null>(() => initialSession?.user || null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => Boolean(initialSession?.user));
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [intendedRoute, setIntendedRoute] = useState<string | null>(null);

  const [profileSummary, setProfileSummary] = useState<ProfileSummary | null>(() => {
    if (initialSession && initialSession.user) {
      return {
        userId: initialSession.user.id,
        displayName: initialSession.user.fullName,
        tenantType: initialSession.activeTenant?.tenantType || 'supplier',
        tenantId: initialSession.activeTenant?.tenantId || null,
        role: initialSession.activeTenant?.roleName || 'Member',
        supplierOrOrgName: initialSession.activeTenant?.tenantName || initialSession.user.fullName,
        verificationStatus: 'Verified',
      };
    }
    return null;
  });

  const [gatePurpose, setGatePurposeState] = useState<'loading_profile' | 'setting_up' | 'switching' | 'logging_out'>('loading_profile');
  const [switchingTargetName, setSwitchingTargetName] = useState<string | null>(null);
  const [gateError, setGateError] = useState<string | null>(null);

  const isGateReady = !isAuthenticated || (currentUser !== null && profileSummary !== null && !authLoading);

  const setGatePurpose = (purpose: 'loading_profile' | 'setting_up' | 'switching' | 'logging_out', targetName?: string) => {
    setGatePurposeState(purpose);
    if (targetName) setSwitchingTargetName(targetName);
  };

  const retryProfileLoad = async () => {
    setGateError(null);
    setAuthLoading(true);
    try {
      const session = await authApi.getMe();
      if (session && session.user) {
        setCurrentUser(session.user);
        setProfileSummary(session.profileSummary || {
          userId: session.user.id,
          displayName: session.user.fullName,
          tenantType: session.activeTenant?.tenantType || 'supplier',
          tenantId: session.activeTenant?.tenantId || null,
          role: session.activeTenant?.roleName || 'Member',
          supplierOrOrgName: session.activeTenant?.tenantName || session.user.fullName,
          verificationStatus: 'Verified',
        });
        setIsAuthenticated(true);
      }
    } catch (err: any) {
      if (err.status === 401) {
        logout('user_initiated');
      } else {
        setGateError(err.message || 'Failed to load profile');
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const switchOrganizationOrSupplier = async (tenantId: string, tenantType: 'supplier' | 'organization', targetName?: string) => {
    setGatePurpose('switching', targetName);
    setProfileSummary(null);
    try {
      const res = await authApi.switchTenant(tenantId, tenantType);
      if (res && res.success) {
        await retryProfileLoad();
      }
    } catch (err: any) {
      setGateError(err.message || 'Failed to switch organization');
    }
  };

  const [role, setRoleState] = useState<UserRole>(() => {
    if (initialSession?.role) return initialSession.role;
    const savedRole = localStorage.getItem('bidready_role') as UserRole;
    if (savedRole && ['supplier', 'buyer', 'admin', 'public'].includes(savedRole)) return savedRole;
    return 'public';
  });

  const [buyerSubRole, setBuyerSubRole] = useState<BuyerSubRole>('Procurement officer');
  const [currentOrgSlug, setCurrentOrgSlug] = useState<string>('org-grc');
  const [language, setLanguage] = useState<Language>('en');
  const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme();

  const [activeNav, setActiveNavState] = useState<string>(() => {
    const savedNav = localStorage.getItem('bidready_active_nav');
    const authRoutes = [
      'auth', 'signin', 'signup', 'register', 'supplier-login', 'supplier-signup',
      'buyer-login', 'buyer-signup', 'org-login', 'admin-login', 'forgot-password',
      'reset-password', 'accept-invite', 'choose-workspace',
    ];
    if (savedNav && !authRoutes.includes(savedNav)) {
      return savedNav;
    }
    if (initialSession) {
      if (initialSession.role === 'admin') return 'admin-dashboard';
      if (initialSession.role === 'buyer') return 'buyer-dashboard';
      if (initialSession.role === 'supplier') return 'dashboard';
    }
    return 'about';
  });

  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);

  // Inactivity Warning & Timeout State
  const [isInactiveWarningOpen, setIsInactiveWarningOpen] = useState<boolean>(false);
  const [inactivitySecondsLeft, setInactivitySecondsLeft] = useState<number>(Math.floor(INACTIVITY_WARNING_MS / 1000));
  // Loading Gate & Robust Bootstrap State
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const [bootstrapStep, setBootstrapStep] = useState(0);
  const [bootstrapMessage, setBootstrapMessage] = useState('');

  const runIdRef = useRef(0);
  const inFlightRef = useRef<Promise<boolean> | null>(null);
  const watchdogTimerRef = useRef<any>(null);

  const runBootstrap = async (options?: { force?: boolean }): Promise<boolean> => {
    if (inFlightRef.current && !options?.force) {
      return inFlightRef.current;
    }

    const runId = ++runIdRef.current;
    console.log('[bootstrap:start] Starting bootstrap run #', runId);

    setIsBootstrapping(true);
    setBootstrapStep(0);
    setBootstrapMessage('Signing you in...');

    const bootstrapPromise = (async () => {
      let attempt = 0;
      let hasSelfHealed = false;
      const startTime = Date.now();

      if (watchdogTimerRef.current) {
        clearTimeout(watchdogTimerRef.current);
      }

      // 15s Watchdog: auto-recover if gate stays up longer than 15 seconds
      watchdogTimerRef.current = setTimeout(async () => {
        if (runIdRef.current === runId) {
          console.warn('[bootstrap:watchdog] Gate up > 15s. Running self-healing path...');
          try {
            const meRes = await authApi.getMe();
            if (meRes && meRes.activeTenant) {
              await authApi.switchTenant(meRes.activeTenant.tenantId, meRes.activeTenant.tenantType);
            }
          } catch (e) {
            console.warn('[bootstrap:watchdog] Self-heal error:', e);
          }
        }
      }, 15000);

      while (runIdRef.current === runId) {
        attempt++;
        try {
          if (attempt === 1) {
            setBootstrapStep(0);
            setBootstrapMessage('Signing you in...');
            await new Promise((r) => setTimeout(r, 180));
          }

          if (runIdRef.current !== runId) return false;

          setBootstrapStep(1);
          setBootstrapMessage('Loading your company...');

          // Timeout per request: 10 seconds
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 10000);

          let data: any;
          try {
            data = await authApi.bootstrap(controller.signal);
          } finally {
            clearTimeout(timeoutId);
          }

          console.log('[bootstrap:response] Received bootstrap data for run #', runId);

          if (runIdRef.current !== runId) return false;

          if (!data || typeof data !== 'object') {
            throw new Error('INVALID_BOOTSTRAP_PAYLOAD');
          }

          setBootstrapStep(2);
          setBootstrapMessage('Checking your documents...');
          await new Promise((r) => setTimeout(r, 180));

          if (runIdRef.current !== runId) return false;

          setBootstrapStep(3);
          setBootstrapMessage('Setting up your dashboard...');

          // Authoritative session & tenant returned atomically by GET /api/bootstrap (no redundant /api/auth/me roundtrip)
          if (!data.user || !data.user.id) {
            console.warn('[validate:mismatch] No active session found in bootstrap payload. Signing out.');
            setIsBootstrapping(false);
            logout('user_initiated');
            return false;
          }

          const currentSession = {
            user: data.user,
            activeTenant: data.activeTenant,
            profileSummary: data.profileSummary || null,
          };

          console.log('[validate:ok] Session and workspace validated for run #', runId);

          // 1. Map directors/people from bootstrap payload into authoritative supplier state
          const mappedDirectors: Director[] = (data.people || []).map((p: any) => ({
            id: p.id,
            fullName: p.full_name || p.fullName || '',
            nationalIdOrPassport: p.idLast4 ? `ending ${p.idLast4}` : (p.hasId ? 'Provided' : ''),
            idLast4: p.idLast4 ?? null,
            hasId: Boolean(p.hasId),
            gender: p.gender ?? null,
            idType: (p.identity_type === 'PASSPORT' || p.identityType === 'PASSPORT') ? 'Passport' : 'National ID (Omang)',
            nationality: p.nationality || 'Motswana',
            isCitizen: p.is_citizen ?? p.isCitizen ?? true,
            shareholdingPercentage: parseFloat(p.ownership_percent ?? p.ownershipPercent ?? p.shareholdingPercentage ?? '0') || 0,
            role: p.person_role === 'shareholder' || p.personRole === 'shareholder' ? 'Shareholder' : (p.person_role === 'director' || p.personRole === 'director' ? 'Director' : (p.person_role || p.personRole || 'Director')),
          }));

          // 2. Map documents from bootstrap payload with authoritative codes, version IDs, and admin verification statuses
          const mappedDocs: SupplierDocument[] = (data.documents || []).map((d: any) => {
            const verUpper = String(d.verificationStatus || '').toUpperCase();
            const docStatusLower = String(d.status || '').toLowerCase();
            const expiryUpper = String(d.expiryState || '').toUpperCase();

            let statusLabel: SupplierDocument['status'] = 'Pending';
            if (verUpper === 'REJECTED' || docStatusLower === 'rejected') {
              statusLabel = 'Rejected';
            } else if (verUpper === 'EXPIRED' || expiryUpper === 'EXPIRED' || docStatusLower === 'expired') {
              statusLabel = 'Expired';
            } else if (verUpper === 'UNVERIFIABLE') {
              statusLabel = 'Cannot verify';
            } else if (verUpper === 'VERIFIED' || verUpper === 'APPROVED') {
              statusLabel = expiryUpper === 'EXPIRING_SOON' ? 'Expiring soon' : 'Verified';
            }

            return {
              id: d.documentId || d.id,
              versionId: d.versionId || null,
              versionNo: d.versionNo || undefined,
              supplierId: d.supplierId || data.resolvedSupplierId,
              documentType: d.documentTypeName || d.documentTypeCode || d.title || 'Document',
              documentTypeCode: d.documentTypeCode,
              title: d.title || d.documentTypeName,
              documentNumber: d.documentNumber || undefined,
              fileName: d.fileName || 'document.pdf',
              fileSize: d.fileSizeBytes ? `${Math.round(parseInt(d.fileSizeBytes) / 1024)} KB` : '100 KB',
              issueDate: d.issueDate || d.uploadedAt || new Date().toISOString(),
              expiryDate: d.expiryDate || undefined,
              status: statusLabel,
              verificationStatus: d.verificationStatus || null,
              verificationNotes: d.verificationNotes || null,
              rejectionReason: d.rejectionReason || (statusLabel === 'Rejected' ? d.verificationNotes : undefined) || undefined,
              verifiedAt: d.verifiedAt || undefined,
              issuingAuthority: d.issuingAuthority || undefined,
              sha256: d.sha256 || undefined,
              mimeType: d.mimeType || undefined,
              hasFile: d.hasFile !== undefined ? Boolean(d.hasFile) : undefined,
              uploadedAt: d.uploadedAt || undefined,
              downloadUrl: `/api/supplier/documents/${d.versionId || d.documentId || d.id}/file`,
            };
          });

          const normApps: Application[] = Array.isArray(data.applications)
            ? data.applications.map((a: any) => {
                const normalizedDocs = Array.isArray(a.documents) ? a.documents : [];
                const ir = a.informationRequest;
                const mappedInfoReq = ir
                  ? {
                      id: ir.id,
                      requestedBy: 'Procurement Committee',
                      requestedAt: ir.requestedAt ? new Date(ir.requestedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '',
                      dueDate: ir.dueAt ? new Date(ir.dueAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—',
                      message: ir.message,
                      status: ir.respondedAt ? ('Responded' as const) : ('Pending response' as const),
                      responseMessage: ir.responseNote || undefined,
                      respondedAt: ir.respondedAt ? new Date(ir.respondedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : undefined,
                      respondedBy: ir.respondedAt ? (a.supplierLegalName || 'Supplier') : undefined,
                    }
                  : undefined;

                const mappedBid = a.bid
                  ? {
                      id: a.bid.id,
                      applicationId: a.id,
                      callId: a.callId,
                      supplierId: a.supplierId,
                      supplierName: a.supplierLegalName || a.supplierName || '',
                      currency: 'BWP' as const,
                      status: a.bid.status,
                      pricingLineItems: Array.isArray(a.bid.pricingLineItems) ? a.bid.pricingLineItems : [],
                      totalAmountBWP: a.bid.totalAmountBWP !== null && a.bid.totalAmountBWP !== undefined ? Number(a.bid.totalAmountBWP) : 0,
                      technicalProposalFileName: 'Technical Proposal',
                      financialProposalFileName: 'Financial Schedule',
                      isSealed: String(a.bid.status || '').toLowerCase() !== 'opened',
                      sealedHash: a.bid.sealedHash || '',
                    }
                  : undefined;

                return {
                  id: a.id,
                  callId: a.callId,
                  callNumber: a.callNumber || '',
                  callTitle: a.callTitle || '',
                  callType: a.callType === 'rfp' || a.callType === 'RFP' ? 'RFP' : a.callType === 'registration_drive' || a.callType === 'Registration drive' ? 'Registration drive' : 'EOI',
                  closesAt: a.closesAt || null,
                  organizationId: a.organizationId,
                  organizationName: a.organizationName || '',
                  supplierId: a.supplierId,
                  supplierName: a.supplierLegalName || a.supplierName || '',
                  submittedAt: a.submittedAt ? new Date(a.submittedAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '',
                  receiptNumber: a.receiptNumber || undefined,
                  status: (a.status || 'Submitted') as Application['status'],
                  statusReason: a.decisionNote || a.withdrawalReason || undefined,
                  decisionNote: a.decisionNote || undefined,
                  informationRequest: mappedInfoReq,
                  withdrawnAt: a.withdrawnAt || undefined,
                  withdrawalReason: a.withdrawalReason || null,
                  sharedDocumentIds: normalizedDocs.map((d: any) => d.documentVersionId).filter(Boolean),
                  documents: normalizedDocs,
                  pinnedDocumentVersionIds: normalizedDocs.map((d: any) => d.documentVersionId).filter(Boolean),
                  answers: a.answers || {},
                  responses: Array.isArray(a.responses) ? a.responses : [],
                  bid: mappedBid,
                  timeline: Array.isArray(a.timeline)
                    ? a.timeline.map((t: any) => ({
                        stage: (t.stage || 'Submitted') as Application['status'],
                        timestamp: t.createdAt ? new Date(t.createdAt).toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : (t.timestamp || ''),
                        note: t.note || undefined,
                      }))
                    : [],
                };
              })
            : [];
          const rawProfile = data.profile || {};
          const completenessScore = data.completeness?.score ?? rawProfile.profileCompleteness ?? rawProfile.profile_completeness ?? 0;
          const complianceStatus = data.completeness?.complianceStatus ?? rawProfile.complianceStatus ?? rawProfile.compliance_status ?? (completenessScore >= 80 ? 'Fully compliant' : 'Action required');

          const mappedCategories: string[] = Array.isArray(rawProfile.categories) && rawProfile.categories.length > 0
            ? rawProfile.categories
            : Array.isArray(rawProfile.secondaryCategories) && rawProfile.secondaryCategories.length > 0
            ? rawProfile.secondaryCategories
            : Array.isArray(rawProfile.secondary_categories)
            ? rawProfile.secondary_categories
            : rawProfile.category
            ? [rawProfile.category]
            : [];

          const normProfile: Supplier = {
            id: rawProfile.id || currentSession.activeTenant?.tenantId || data.resolvedSupplierId || '',
            legalName: rawProfile.legalName || rawProfile.legal_name || currentSession.activeTenant?.tenantName || currentSession.user.fullName || '',
            tradingName: rawProfile.tradingName || rawProfile.trading_name || rawProfile.legalName || rawProfile.legal_name || '',
            cipaNumber: rawProfile.cipaNumber || rawProfile.cipaUin || rawProfile.cipa_uin || '',
            tinNumber: rawProfile.tinNumber || rawProfile.bursTin || rawProfile.burs_tin || '',
            ppraCode: rawProfile.ppraCode || rawProfile.ppraRegistrationNo || rawProfile.ppra_registration_no || '',
            ppraSubcodes: rawProfile.ppraSubcodes || rawProfile.ppra_subcodes || [],
            ppraGrade: rawProfile.ppraGrade || rawProfile.ppra_grade || '',
            category: rawProfile.category || mappedCategories[0] || '',
            secondaryCategories: mappedCategories,
            categories: mappedCategories,
            physicalAddress: rawProfile.physicalAddress || rawProfile.physical_address || '',
            city: rawProfile.city || '',
            district: rawProfile.district || rawProfile.districtName || '',
            districtId: rawProfile.districtId || rawProfile.district_id || null,
            postalAddress: rawProfile.postalAddress || rawProfile.postal_address || '',
            primaryPhone: rawProfile.primaryPhone || rawProfile.primary_phone || '',
            email: rawProfile.email || '',
            website: rawProfile.website || '',
            yearEstablished: rawProfile.yearEstablished || rawProfile.year_established || new Date().getFullYear(),
            companyType: rawProfile.companyType || rawProfile.company_type || 'Private Company (Pty) Ltd',
            description: rawProfile.description || '',
            vatRegistered: Boolean(rawProfile.vatRegistered ?? rawProfile.vat_registered),
            biddingPublicTenders: rawProfile.biddingPublicTenders ?? rawProfile.bidding_public_tenders ?? true,
            citizenOwnedPercentage: Number(rawProfile.citizenOwnedPercentage ?? rawProfile.citizen_owned_percentage ?? 0),
            citizenOwnershipSet: Boolean(
              rawProfile.citizenOwnershipSet ??
              rawProfile.citizen_ownership_set ??
              (rawProfile.citizenOwnedPercentage ?? rawProfile.citizen_owned_percentage)
            ),
            youthOwned: Boolean(rawProfile.youthOwned ?? rawProfile.youth_owned),
            womenOwned: Boolean(rawProfile.womenOwned ?? rawProfile.women_owned),
            disabilityOwned: Boolean(rawProfile.disabilityOwned ?? rawProfile.disability_owned),
            eddCertified: Boolean(rawProfile.eddCertified ?? rawProfile.edd_certified),
            bankName: rawProfile.bankName || rawProfile.bank_name || '',
            bankBranch: rawProfile.bankBranch || rawProfile.bank_branch || '',
            accountNumberMasked: rawProfile.accountNumberMasked || rawProfile.account_number_masked || '',
            hasTradingLicence: rawProfile.hasTradingLicence ?? rawProfile.has_trading_licence ?? null,
            tradingLicenceReason: rawProfile.tradingLicenceReason || rawProfile.trading_licence_reason || '',
            directors: mappedDirectors,
            documents: mappedDocs,
            profileCompleteness: completenessScore,
            complianceStatus: complianceStatus,
            missingItems: data.completeness?.missingItems ? data.completeness.missingItems.map((m: any) => m.label) : (rawProfile.missingItems || rawProfile.missing_items || []),
            pastProjects: data.pastProjects ?? rawProfile.pastProjects ?? [],
            teamMembers: data.teamMembers ?? rawProfile.teamMembers ?? [],
            pendingInvitations: data.pendingInvitations ?? rawProfile.pendingInvitations ?? [],
            emailVerified: Boolean(currentSession.user.emailVerifiedAt || currentSession.profileSummary?.emailVerified),
            accountStatus: rawProfile.status || currentSession.activeTenant?.supplierStatus || 'active',
            verificationStatus: rawProfile.verificationStatus || rawProfile.verification_status || currentSession.activeTenant?.verificationStatus || 'unverified',
            activeDebarment: rawProfile.activeDebarment || null,
          };

          // Hydrate consent grants strictly from live PostgreSQL bootstrap payload
          const mappedConsents: ConsentGrant[] = Array.isArray(data.consent)
            ? data.consent.map((c: any) => {
                const statusLower = String(c.status || '').toLowerCase();
                const mappedStatus: ConsentGrant['status'] =
                  statusLower === 'revoked' ? 'Revoked' : statusLower === 'expired' ? 'Expired' : 'Active';
                const selectedNames = Array.isArray(c.selectedDocumentNames) ? c.selectedDocumentNames : [];
                return {
                  id: c.id,
                  supplierId: c.supplierId || normProfile.id,
                  organizationId: c.organizationId,
                  organizationName: c.organizationName || 'Procuring Organization',
                  grantedAt: c.grantedAt ? new Date(c.grantedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '',
                  expiryDate: c.expiresAt ? String(c.expiresAt).slice(0, 10) : undefined,
                  revokedAt: c.revokedAt ? new Date(c.revokedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : undefined,
                  revocationReason: c.revocationReason || undefined,
                  purpose: c.purpose || undefined,
                  status: mappedStatus,
                  scope: c.scope || {
                    companyDetails: Boolean(c.shareCompanyDetails),
                    directorsOwners: Boolean(c.shareDirectorsOwners),
                    pastProjects: Boolean(c.sharePastProjects),
                    selectedDocuments: selectedNames.length > 0 || Boolean(c.shareTaxCompliance || c.shareFinancialStatements),
                    taxCompliance: Boolean(c.shareTaxCompliance),
                    financialStatements: Boolean(c.shareFinancialStatements),
                    keyPersonnel: Boolean(c.shareKeyPersonnel),
                    pastContracts: Boolean(c.sharePastContracts),
                    bankingDetails: Boolean(c.shareBankingDetails),
                  },
                  selectedDocumentIds: Array.isArray(c.selectedDocumentIds) ? c.selectedDocumentIds : [],
                  selectedDocumentNames: selectedNames,
                  tiedApplicationNumbers: Array.isArray(c.tiedApplicationNumbers) ? c.tiedApplicationNumbers : [],
                  accessedCount: typeof c.accessCount === 'number' ? c.accessCount : 0,
                  lastAccessedAt: c.lastAccessedAt
                    ? new Date(c.lastAccessedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
                    : undefined,
                };
              })
            : [];

          const mappedNotifications: NotificationItem[] = Array.isArray(data.notifications)
            ? data.notifications.map((n: any) => ({
                id: n.id,
                recipientRole:
                  n.recipientRole === 'Buyer' || currentSession.activeTenant?.tenantType === 'organization'
                    ? 'Buyer'
                    : 'Supplier',
                recipientId: n.supplierId || n.organizationId || n.userId || '',
                eventType: n.eventType || n.type || undefined,
                title: n.title || 'Procurement notification',
                message: n.body || n.message || '',
                timestamp: n.createdAt || '',
                read: typeof n.isRead === 'boolean' ? n.isRead : Boolean(n.readAt),
                starred: Boolean(n.isStarred ?? n.starred),
                archived: Boolean(n.isArchived ?? n.archived ?? n.archivedAt),
                archivedAt: n.archivedAt || null,
                type: (['urgent', 'info', 'success', 'warning'].includes(n.priority) ? n.priority : 'info') as NotificationItem['type'],
                actionLink: n.linkUrl || n.link || undefined,
                data: n.data || null,
              }))
            : [];

          // Synchronously commit to React state behind opaque gate
          setCurrentUser(currentSession.user);
          if (currentSession.profileSummary) {
            setProfileSummary(currentSession.profileSummary);
          }
          setIsAuthenticated(true);
          setSupplier(normProfile);
          setDocuments(mappedDocs);
          setApplications(normApps);
          setConsentGrants(mappedConsents);
          setNotifications(mappedNotifications);
          void refreshCalls();

          let resolvedRole: UserRole = 'supplier';
          if (currentSession.user.isPlatformAdmin) {
            resolvedRole = 'admin';
          } else if (currentSession.activeTenant?.tenantType === 'organization') {
            resolvedRole = 'buyer';
            const orgStatusRaw = String(
              rawProfile.status ||
              currentSession.activeTenant.organizationStatus ||
              currentSession.profileSummary?.organizationStatus ||
              'pending'
            ).toLowerCase();
            const orgVerRaw = String(
              rawProfile.verificationStatus ||
              rawProfile.verification_status ||
              currentSession.activeTenant.verificationStatus ||
              currentSession.profileSummary?.verificationStatus ||
              ''
            ).toLowerCase();
            const derivedBuyerStatus: 'Pending' | 'Approved' | 'Rejected' =
              orgStatusRaw === 'active' && orgVerRaw !== 'rejected'
                ? 'Approved'
                : orgStatusRaw === 'pending' || orgVerRaw === 'pending_review' || orgVerRaw === 'pending'
                ? 'Pending'
                : 'Rejected';

            setBuyerOrgStatus(derivedBuyerStatus);
            setBuyerOrgRejectionReason(
              rawProfile.rejectionReason ||
              currentSession.activeTenant.rejectionReason ||
              currentSession.profileSummary?.rejectionReason ||
              null
            );
            setRegisteredBuyerOrgName(rawProfile.name || currentSession.activeTenant.tenantName);
            setRegisteredBuyerEmail(currentSession.user.email);
            if (derivedBuyerStatus === 'Approved') {
              setActiveNavState((prev) => (prev === 'buyer-pending' || prev === 'buyer-login' ? 'buyer-dashboard' : prev));
              buyerApi
                .listFormTemplates()
                .then((tmpls) => {
                  if (Array.isArray(tmpls)) setFormTemplates(tmpls);
                })
                .catch(() => {});
              buyerApi
                .getBranding()
                .then((b) => {
                  if (b) {
                    setBuyerBranding(b);
                    if (b.name) setRegisteredBuyerOrgName(b.name);
                  }
                })
                .catch(() => {});
            } else {
              setActiveNavState('buyer-pending');
            }
          } else if (currentSession.activeTenant?.tenantType === 'supplier') {
            resolvedRole = 'supplier';
          }
          setRoleState(resolvedRole);

          // Layer 3, 4, 5: Settle quiet window & verify DOM bindings
          setBootstrapStep(3);
          setBootstrapMessage('Verifying display readiness...');

          const domTarget = {
            supplierName: normProfile.legalName,
            completenessScore: normProfile.profileCompleteness,
            documentsCount: mappedDocs.length,
            applicationsCount: normApps.length,
            userId: currentSession.user.id,
            tenantId: currentSession.activeTenant?.tenantId,
            resolvedSupplierId: data.resolvedSupplierId || currentSession.activeTenant?.tenantId,
            serverFingerprint: data.serverFingerprint,
          };

          const settleResult = await waitForPaintAndSettle(domTarget, 250);
          console.log('[gate:settle-result]', settleResult);

          // Minimum display time of 700ms so gate does not flicker
          const elapsed = Date.now() - startTime;
          if (elapsed < 700) {
            await new Promise((r) => setTimeout(r, 700 - elapsed));
          }

          if (runIdRef.current !== runId) return false;

          // Step 4 done
          setBootstrapStep(4);
          setBootstrapMessage('Ready');
          await new Promise((r) => setTimeout(r, 200));

          if (runIdRef.current !== runId) return false;

          setIsBootstrapping(false);
          console.log('[gate:lift] Render-verified loading gate lifted for run #', runId);
          return true;

        } catch (err: any) {
          console.warn(`[bootstrap:attempt ${attempt}] Error:`, err);

          // 1. Permanent: 401 Unauthorized -> redirect cleanly
          if (err?.status === 401) {
            console.warn('[bootstrap:unauthorized] Received 401 -> redirecting to login.');
            setIsBootstrapping(false);
            logout('user_initiated');
            window.location.href = `/supplier-login?redirect=${encodeURIComponent(window.location.pathname)}`;
            return false;
          }

          // 2. Tenant error: 403 / 404 / NO_ACTIVE_TENANT -> self-heal once
          const isTenantError =
            err?.status === 403 ||
            err?.status === 404 ||
            err?.message?.includes('NO_ACTIVE_TENANT');

          if (isTenantError && !hasSelfHealed) {
            hasSelfHealed = true;
            console.warn('[bootstrap:self-heal] Attempting deterministic workspace recovery...');
            try {
              const session = await authApi.getMe();
              if (session && session.user) {
                const memberships = (session as any).memberships || [];
                if (memberships.length > 0) {
                  const sorted = [...memberships].sort((a: any, b: any) => {
                    if (a.isOwner !== b.isOwner) return a.isOwner ? -1 : 1;
                    return (a.tenantName || '').localeCompare(b.tenantName || '');
                  });
                  await authApi.switchTenant(sorted[0].tenantId, sorted[0].tenantType);
                }
              }
            } catch (switchErr) {
              console.warn('[bootstrap:self-heal] Tenant switch notice:', switchErr);
            }
            continue;
          }

          // 3. Transient error check: network failure, timeout, 502/503/504, or DATABASE_UNAVAILABLE
          const isTransient =
            !err?.status ||
            err?.name === 'AbortError' ||
            [502, 503, 504].includes(err.status) ||
            err?.code === 'DATABASE_UNAVAILABLE';

          if (isTransient) {
            const delay = [1500, 3000, 4500, 5000][Math.min(attempt - 1, 3)];
            const totalElapsed = Date.now() - startTime;
            setBootstrapMessage(
              totalElapsed > 5000
                ? 'Still working. Your data is safe.'
                : 'Reconnecting…'
            );
            await new Promise((r) => setTimeout(r, delay));
            continue;
          }

          // 4. Unrecoverable permanent failure after retry/self-heal: clean signout
          console.error('[bootstrap:permanent-failure] Could not recover workspace:', err);
          setIsBootstrapping(false);
          logout('user_initiated');
          window.location.href = '/supplier-login?notice=workspace_unavailable';
          return false;
        }
      }

      return false;
    })();

    inFlightRef.current = bootstrapPromise;
    try {
      return await bootstrapPromise;
    } finally {
      inFlightRef.current = null;
      if (watchdogTimerRef.current) {
        clearTimeout(watchdogTimerRef.current);
        watchdogTimerRef.current = null;
      }
    }
  };
  const resetInactivity = () => {
    const now = Date.now();
    try {
      localStorage.setItem('bidready_last_active', String(now));
    } catch {}
    setIsInactiveWarningOpen(false);
    setInactivitySecondsLeft(Math.floor(INACTIVITY_WARNING_MS / 1000));
  };

  const logout = async (reason: 'user_initiated' | 'inactivity' = 'user_initiated') => {
    try {
      await authApi.logout();
    } catch {}

    try {
      localStorage.removeItem('bidready_token');
      localStorage.removeItem('bidready_session');
      localStorage.removeItem('bidready_role');
      localStorage.removeItem('bidready_last_active');
      localStorage.removeItem('bidready_supplier_profile');
      localStorage.removeItem('bidready_supplier_documents');
      localStorage.removeItem('bidready_supplier_applications');
      localStorage.removeItem('bidready_supplier_consent_grants');
      localStorage.removeItem('bidready_supplier_people');
    } catch {}

    setCurrentUser(null);
    setBuyerBrandingState(null);
    setSupplier(EMPTY_SUPPLIER);
    setDocuments([]);
    setApplications([]);
    setConsentGrants([]);
    setNotifications([]);
    setRegisteredBuyerOrgName(null);
    setRegisteredBuyerEmail(null);
    setBuyerOrgStatus('Pending');
    setIsAuthenticated(false);
    setRoleState('public');
    setIntendedRoute(null);
    setIsInactiveWarningOpen(false);

    if (reason === 'inactivity') {
      setActiveNavState('session-expired');
      try {
        localStorage.setItem('bidready_active_nav', 'session-expired');
      } catch {}
    } else {
      setActiveNavState('about');
      try {
        localStorage.removeItem('bidready_active_nav');
      } catch {}
    }

    addAuditEvent({
      actorName: currentUser?.fullName || 'Active User',
      actorRole: role === 'supplier' ? 'Supplier' : role === 'buyer' ? 'Procurement Officer' : role === 'admin' ? 'Super Admin' : 'System',
      organizationName: 'BidReady360 Platform',
      action: reason === 'inactivity' ? 'Session Expired Due to Inactivity' : 'Session Terminated (Logout)',
      entityType: role === 'buyer' ? 'Organization' : 'Supplier',
      entityId: currentUser?.id || 'anon',
      details: reason === 'inactivity'
        ? 'User was automatically signed out after inactivity timeout with security warning.'
        : 'User logged out and security session invalidated.',
    });
  };

  // Inactivity tracking and multi-tab synchronization effect
  useEffect(() => {
    if (!isAuthenticated) {
      setIsInactiveWarningOpen(false);
      return;
    }

    // Ensure last active timestamp exists
    if (!localStorage.getItem('bidready_last_active')) {
      try {
        localStorage.setItem('bidready_last_active', String(Date.now()));
      } catch {}
    }

    let lastThrottledUpdate = Date.now();

    const handleUserActivity = () => {
      const now = Date.now();
      // Throttle localStorage writes to at most once per 3 seconds
      if (now - lastThrottledUpdate > 3000) {
        lastThrottledUpdate = now;
        try {
          localStorage.setItem('bidready_last_active', String(now));
        } catch {}
      }
    };

    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'click'];
    activityEvents.forEach((evt) => window.addEventListener(evt, handleUserActivity, { passive: true }));

    // Sync across browser tabs
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'bidready_last_active' && e.newValue) {
        lastThrottledUpdate = Number(e.newValue);
      } else if (e.key === 'bidready_session' && !e.newValue) {
        // Logged out in another tab
        setIsAuthenticated(false);
        setCurrentUser(null);
        setRoleState('public');
      }
    };
    window.addEventListener('storage', handleStorageChange);

    // Heartbeat check every 1 second
    const interval = setInterval(() => {
      const lastActive = Number(localStorage.getItem('bidready_last_active') || Date.now());
      const now = Date.now();
      const idleTime = now - lastActive;

      if (idleTime >= INACTIVITY_TIMEOUT_MS) {
        logout('inactivity');
      } else if (idleTime >= INACTIVITY_TIMEOUT_MS - INACTIVITY_WARNING_MS) {
        const secondsRemaining = Math.max(0, Math.ceil((INACTIVITY_TIMEOUT_MS - idleTime) / 1000));
        setInactivitySecondsLeft((prev) => (prev === secondsRemaining ? prev : secondsRemaining));
        setIsInactiveWarningOpen((prev) => (prev ? prev : true));
      } else {
        setIsInactiveWarningOpen((prev) => (prev ? false : prev));
      }
    }, 1000);

    return () => {
      activityEvents.forEach((evt) => window.removeEventListener(evt, handleUserActivity));
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, [isAuthenticated]);

  // Server-authoritative session revalidation on startup
  useEffect(() => {
    let isMounted = true;
    async function restoreSession() {
      // Check inactivity timeout first
      const lastActive = Number(localStorage.getItem('bidready_last_active') || 0);
      const now = Date.now();
      if (lastActive && (now - lastActive > INACTIVITY_TIMEOUT_MS)) {
        if (isMounted) {
          logout('inactivity');
          setAuthLoading(false);
        }
        return;
      }

      try {
        const session = await authApi.getMe();
        if (session && session.user && isMounted) {
          const savedNav = localStorage.getItem('bidready_active_nav');
          if (savedNav && savedNav !== 'about' && savedNav !== 'session-expired') {
            setActiveNavState(savedNav);
          }
          await runBootstrap();
        } else if (isMounted) {
          setIsAuthenticated(false);
          setCurrentUser(null);
          setRoleState('public');
          try {
            localStorage.removeItem('bidready_token');
            localStorage.removeItem('bidready_session');
          } catch {}
        }
      } catch (err) {
        if (isMounted) {
          setIsAuthenticated(false);
          setCurrentUser(null);
          setRoleState('public');
          try {
            localStorage.removeItem('bidready_token');
            localStorage.removeItem('bidready_session');
          } catch {}
        }
      } finally {
        if (isMounted) {
          setAuthLoading(false);
        }
      }
    }

    restoreSession();
    return () => {
      isMounted = false;
    };
  }, []);

  const loginSuccess = (
    session: { user: ApiUser; activeTenant?: any; token?: string; profileSummary?: any },
    targetRole?: UserRole
  ) => {
    if (session.token) {
      try {
        localStorage.setItem('bidready_token', session.token);
      } catch {}
    }

    runBootstrap({ force: true });

    let resolvedRole: UserRole = targetRole || 'supplier';
    let derivedBuyerStatus: 'Pending' | 'Approved' | 'Rejected' = 'Pending';

    if (session.user.isPlatformAdmin) {
      resolvedRole = 'admin';
    } else if (session.activeTenant?.tenantType === 'organization') {
      resolvedRole = 'buyer';
      const orgStatusRaw = String(
        session.activeTenant.organizationStatus ||
        session.activeTenant.profile?.status ||
        session.profileSummary?.organizationStatus ||
        session.profileSummary?.status ||
        'pending'
      ).toLowerCase();
      const orgVerRaw = String(
        session.activeTenant.verificationStatus ||
        session.activeTenant.profile?.verificationStatus ||
        session.profileSummary?.verificationStatus ||
        ''
      ).toLowerCase();

      derivedBuyerStatus =
        orgStatusRaw === 'active' && orgVerRaw !== 'rejected'
          ? 'Approved'
          : orgStatusRaw === 'pending' || orgVerRaw === 'pending_review' || orgVerRaw === 'pending'
          ? 'Pending'
          : 'Rejected';

      setBuyerOrgStatus(derivedBuyerStatus);
      setBuyerOrgRejectionReason(
        session.activeTenant.rejectionReason ||
        session.activeTenant.profile?.rejectionReason ||
        session.profileSummary?.rejectionReason ||
        null
      );
      setRegisteredBuyerOrgName(session.activeTenant.tenantName);
      setRegisteredBuyerEmail(session.user.email);
    } else if (session.activeTenant?.tenantType === 'supplier') {
      resolvedRole = 'supplier';
    }

    setRoleState(resolvedRole);

    let destination = intendedRoute;
    if (destination) {
      setIntendedRoute(null);
    } else if (resolvedRole === 'admin') {
      destination = 'admin-dashboard';
    } else if (resolvedRole === 'buyer') {
      destination = derivedBuyerStatus === 'Approved' ? 'buyer-dashboard' : 'buyer-pending';
    } else {
      destination = 'dashboard';
    }
    setActiveNavState(destination);

    // Save session and activity timestamp
    const now = Date.now();
    try {
      localStorage.setItem('bidready_last_active', String(now));
      localStorage.setItem('bidready_role', resolvedRole);
      localStorage.setItem('bidready_active_nav', destination);
      localStorage.setItem('bidready_session', JSON.stringify({
        user: session.user,
        activeTenant: session.activeTenant,
        role: resolvedRole,
        activeNav: destination,
      }));
    } catch {}

    setIsInactiveWarningOpen(false);
    setInactivitySecondsLeft(Math.floor(INACTIVITY_WARNING_MS / 1000));

    addAuditEvent({
      actorName: session.user.fullName || session.user.email,
      actorRole: resolvedRole === 'supplier' ? 'Supplier' : resolvedRole === 'buyer' ? 'Procurement Officer' : 'Super Admin',
      organizationName: session.activeTenant?.tenantName || 'BidReady360 Platform',
      action: 'User Authentication Successful',
      entityType: resolvedRole === 'buyer' ? 'Organization' : 'Supplier',
      entityId: session.user.id,
      details: `Interactive session established for ${session.user.email}. Role: ${resolvedRole}.`,
    });
  };

  // Buyer Verification State
  const [buyerOrgStatus, setBuyerOrgStatus] = useState<'Pending' | 'Approved' | 'Rejected'>('Pending');
  const [buyerOrgRejectionReason, setBuyerOrgRejectionReason] = useState<string | null>(null);
  const [registeredBuyerOrgName, setRegisteredBuyerOrgName] = useState<string | null>(null);
  const [registeredBuyerEmail, setRegisteredBuyerEmail] = useState<string | null>(null);

  const registerBuyerOrganization = (data: {
    orgName: string;
    email: string;
    orgType?: string;
    regNumber?: string;
    jobTitle?: string;
    phone?: string;
  }) => {
    setRegisteredBuyerOrgName(data.orgName);
    setRegisteredBuyerEmail(data.email);
    setBuyerOrgStatus('Pending');
    
    addAuditEvent({
      actorName: data.email,
      actorRole: 'Procurement Officer',
      organizationName: data.orgName,
      action: 'Procuring Organization Registration Submitted',
      entityType: 'Organization',
      entityId: `org-${Date.now()}`,
      details: `New procuring entity '${data.orgName}' submitted for verification. Institutional domain: ${data.email.split('@')[1] || 'domain'}.`,
    });
  };

  const approveBuyerOrg = (orgName?: string) => {
    setBuyerOrgStatus('Approved');
    const targetName = orgName || registeredBuyerOrgName || 'Procuring Organization';
    addAuditEvent({
      actorName: currentUser?.fullName || 'Platform Registrar',
      actorRole: 'Super Admin',
      organizationName: targetName,
      action: 'Procuring Organization Verified & Approved',
      entityType: 'Organization',
      entityId: `org-approved`,
      details: `Official workspace authorization granted for ${targetName}. Tender publishing and evaluation controls unlocked.`,
    });
  };

  const rejectBuyerOrg = (orgName?: string, reason?: string) => {
    setBuyerOrgStatus('Rejected');
    const targetName = orgName || registeredBuyerOrgName || 'Procuring Organization';
    addAuditEvent({
      actorName: currentUser?.fullName || 'Platform Registrar',
      actorRole: 'Super Admin',
      organizationName: targetName,
      action: 'Procuring Organization Registration Rejected',
      entityType: 'Organization',
      entityId: `org-rejected`,
      details: `Registration for ${targetName} rejected. Reason: ${reason || 'Failed authority standing verification'}.`,
    });
  };

  // Theme preference and OS sync are managed by ThemeProvider (src/context/ThemeContext.tsx)

  // Dynamic data states initialized clean from server bootstrap (no localStorage business-state fallbacks)
  const [supplier, setSupplier] = useState<Supplier>(EMPTY_SUPPLIER);
  const [allSuppliers] = useState<Supplier[]>([]);
  const [documents, setDocuments] = useState<SupplierDocument[]>([]);
  const supplierRef = useRef<Supplier>(supplier);
  supplierRef.current = supplier;
  const documentsRef = useRef<SupplierDocument[]>(documents);
  documentsRef.current = documents;
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [calls, setCalls] = useState<Call[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);

  const refreshCalls = useCallback(async () => {
    try {
      const fetchedCalls = await callsApi.listOpen();
      if (Array.isArray(fetchedCalls)) {
        const mappedCalls: Call[] = fetchedCalls.map((c: any) => ({
          id: c.id,
          callNumber: c.referenceNo || `CALL-${c.id.substring(0, 6)}`,
          organizationId: c.organizationId || '',
          organizationName: c.organizationName || 'Procuring Organization',
          orgBrandPrimaryColor: c.orgBrandPrimaryColor || '#1F5F99',
          orgBrandSubtext: c.orgBrandSubtext || '',
          orgCustomDomain: c.orgCustomDomain || '',
          orgWelcomeNotice: c.orgWelcomeNotice || '',
          title: c.title,
          summary: c.summary || c.description || '',
          type: c.callType === 'rfp' ? 'RFP' : c.callType === 'registration_drive' ? 'Registration drive' : 'EOI',
          category: (c.categories && c.categories[0]?.name) || 'General Procurement',
          subcategories: (c.categories || []).map((cat: any) => cat.name || String(cat)),
          location: 'Botswana',
          openingDate: c.opensAt ? new Date(c.opensAt).toISOString().split('T')[0] : '',
          clarificationDeadline: c.clarificationDeadline ? new Date(c.clarificationDeadline).toISOString().split('T')[0] : '',
          closingDate: c.closesAt ? new Date(c.closesAt).toISOString().split('T')[0] : '',
          closingTimeCAT: '12:00 PM',
          status: c.status === 'published' || c.status === 'open' ? 'Open' : c.status === 'closed' ? 'Closed' : 'Under evaluation',
          visibility: c.visibility || 'open',
          requiredDocumentTypes: [],
          daysRemaining: typeof c.daysRemaining === 'number' ? Math.max(0, Math.floor(c.daysRemaining)) : 0,
          isSealed: true,
          documentsCount: c.documentsCount || 0,
          applicationsCount: c.applicationsCount || 0,
          estimatedBudgetBWP: Number(c.estimatedValue || 0),
          addenda: [],
        }));
        setCalls(mappedCalls);

        // Derive live active organizations directly from open database calls
        const orgMap = new Map<string, Organization>();
        for (const mc of mappedCalls) {
          if (!mc.organizationId) continue;
          const existing = orgMap.get(mc.organizationId);
          if (existing) {
            existing.activeCallsCount += 1;
          } else {
            const initials = mc.organizationName
              .split(/\s+/)
              .filter(Boolean)
              .map((w) => w[0])
              .join('')
              .slice(0, 4)
              .toUpperCase();
            orgMap.set(mc.organizationId, {
              id: mc.organizationId,
              name: mc.organizationName,
              acronym: initials || 'ORG',
              type: 'Procuring Entity',
              district: 'Botswana',
              city: 'Gaborone',
              logoText: initials || 'ORG',
              contactEmail: '',
              contactPhone: '',
              address: '',
              activeCallsCount: 1,
              suppliersRosterCount: 0,
            });
          }
        }
        setOrganizations(Array.from(orgMap.values()));
      }
    } catch (err) {
      console.warn('[APP CONTEXT] Database calls fetch notice:', err);
    }
  }, []);

  useEffect(() => {
    void refreshCalls();
  }, [refreshCalls]);

  // Single source of truth: Profile snapshot is loaded atomically via runBootstrap (/api/bootstrap)
  // Page-level and context-level duplicate fetches have been removed to prevent post-gate data shifts.

  // Completeness is computed from pure database snapshots and recalculated only on mutation events.

  const [clarifications, setClarifications] = useState<Clarification[]>([]);
  const [consentGrants, setConsentGrants] = useState<ConsentGrant[]>([]);
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [scores, setScores] = useState<Score[]>([]);
  const [evaluators, setEvaluators] = useState<Evaluator[]>([]);
  const [awardDecision, setAwardDecision] = useState<AwardDecision>(DEFAULT_AWARD_DECISION);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [formTemplates, setFormTemplates] = useState<FormTemplate[]>([]);
  const [buyerBranding, setBuyerBrandingState] = useState<BuyerBrandingConfig | null>(null);

  const setBuyerBranding = useCallback((branding: BuyerBrandingConfig | null) => {
    setBuyerBrandingState(branding);
    if (branding?.name) {
      setRegisteredBuyerOrgName(branding.name);
      setProfileSummary((prev) =>
        prev && prev.tenantType === 'organization'
          ? { ...prev, supplierOrOrgName: branding.name }
          : prev
      );
    }
  }, []);

  // Real-time completeness result computed from current memory state
  const completenessResult = calculateSupplierCompleteness(supplier, documents);

  const t = (key: string): string => {
    return TRANSLATIONS[language]?.[key] || key;
  };

  const setRole = (newRole: UserRole, targetNav?: string) => {
    if (!isAuthenticated && newRole !== 'public') {
      const token = localStorage.getItem('bidready_token');
      if (token) {
        setIsAuthenticated(true);
      } else {
        if (newRole === 'supplier') {
          setActiveNavState('supplier-login');
        } else if (newRole === 'buyer') {
          setActiveNavState('buyer-login');
        } else if (newRole === 'admin') {
          setActiveNavState('admin-login');
        }
        return;
      }
    }

    setRoleState(newRole);
    try {
      localStorage.setItem('bidready_role', newRole);
      const raw = localStorage.getItem('bidready_session');
      if (raw) {
        const parsed = JSON.parse(raw);
        parsed.role = newRole;
        localStorage.setItem('bidready_session', JSON.stringify(parsed));
      }
    } catch {}

    if (targetNav) {
      setActiveNav(targetNav);
      return;
    }

    if (newRole === 'public') {
      setActiveNavState('about');
    } else if (newRole === 'supplier') {
      setActiveNavState((prev) => (prev === 'profile' ? 'profile' : 'dashboard'));
    } else if (newRole === 'buyer') {
      setActiveNavState('dashboard');
    } else if (newRole === 'admin') {
      setActiveNavState('admin-dashboard');
    }
  };

  const setActiveNav = (nav: string) => {
    setActiveNavState(nav);
    const ephemeralAuthRoutes = [
      'auth', 'signin', 'signup', 'register', 'supplier-login', 'supplier-signup',
      'buyer-login', 'buyer-signup', 'org-login', 'admin-login', 'forgot-password',
      'reset-password', 'accept-invite', 'choose-workspace',
    ];
    if (!ephemeralAuthRoutes.includes(nav)) {
      try {
        localStorage.setItem('bidready_active_nav', nav);
        const raw = localStorage.getItem('bidready_session');
        if (raw) {
          const parsed = JSON.parse(raw);
          parsed.activeNav = nav;
          localStorage.setItem('bidready_session', JSON.stringify(parsed));
        }
      } catch {}
    }
  };

  const addAuditEvent = useCallback((event: Omit<AuditEvent, 'id' | 'timestamp'>) => {
    const newEvent: AuditEvent = {
      ...event,
      id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
    };
    setAuditEvents((prev) => [newEvent, ...prev]);
  }, []);

  const updateSupplierProfile = useCallback(async (updates: Partial<Supplier>) => {
    const currentSupplier = supplierRef.current;
    const currentDocuments = documentsRef.current;

    // 1. Immediately compute the synchronous merged supplier object
    const nextMerged: Supplier = { ...currentSupplier, ...updates };
    const completeness = calculateSupplierCompleteness(nextMerged, currentDocuments);
    const computedCompleteness = completeness.score;
    const computedMissing = completeness.missingItems.map((m) => m.label);

    nextMerged.profileCompleteness = computedCompleteness;
    nextMerged.missingItems = computedMissing;
    if (computedCompleteness >= 80) {
      nextMerged.complianceStatus = 'Fully compliant';
    } else {
      nextMerged.complianceStatus = 'Action required';
    }

    supplierRef.current = nextMerged;
    setSupplier(nextMerged);

    // Directors are persisted via /api/supplier/people; syncing them into context should not trigger PUT /api/supplier/profile
    const updateKeys = Object.keys(updates);
    if (updateKeys.length === 1 && updateKeys[0] === 'directors') {
      return;
    }

    // 2. Persist to Postgres database via REST API
    const token = localStorage.getItem('bidready_token');
    if (token) {
      const activeDistrict = updates.district !== undefined
        ? updates.district
        : (nextMerged.district || (nextMerged as any).districtName || (nextMerged as any).district_id || '');

      const payload: Record<string, any> = {
        legalName: nextMerged.legalName,
        legal_name: nextMerged.legalName,
        tradingName: nextMerged.tradingName,
        trading_name: nextMerged.tradingName,
        cipaUin: nextMerged.cipaNumber || (nextMerged as any).cipaUin,
        cipa_uin: nextMerged.cipaNumber || (nextMerged as any).cipaUin,
        cipaNumber: nextMerged.cipaNumber,
        bursTin: nextMerged.tinNumber || (nextMerged as any).bursTin,
        burs_tin: nextMerged.tinNumber || (nextMerged as any).bursTin,
        tinNumber: nextMerged.tinNumber,
        ppraRegistrationNo: nextMerged.ppraCode || (nextMerged as any).ppraRegistrationNo,
        ppra_registration_no: nextMerged.ppraCode || (nextMerged as any).ppraRegistrationNo,
        ppraCode: nextMerged.ppraCode,
        companyType: nextMerged.companyType || 'private_company',
        company_type: nextMerged.companyType || 'private_company',
        yearEstablished: nextMerged.yearEstablished,
        year_established: nextMerged.yearEstablished,
        description: nextMerged.description,
        physicalAddress: nextMerged.physicalAddress,
        physical_address: nextMerged.physicalAddress,
        postalAddress: nextMerged.postalAddress,
        postal_address: nextMerged.postalAddress,
        city: nextMerged.city,
        district: activeDistrict,
        districtId: activeDistrict,
        district_id: activeDistrict,
        primaryPhone: nextMerged.primaryPhone,
        primary_phone: nextMerged.primaryPhone,
        email: nextMerged.email,
        website: nextMerged.website,
        bankName: nextMerged.bankName,
        bank_name: nextMerged.bankName,
        bankBranch: nextMerged.bankBranch,
        bank_branch: nextMerged.bankBranch,
        accountNumberMasked: nextMerged.accountNumberMasked,
        account_number_masked: nextMerged.accountNumberMasked,
        citizenOwnedPercentage: nextMerged.citizenOwnedPercentage,
        citizen_owned_percentage: nextMerged.citizenOwnedPercentage,
        youthOwned: nextMerged.youthOwned,
        youth_owned: nextMerged.youthOwned,
        womenOwned: nextMerged.womenOwned,
        women_owned: nextMerged.womenOwned,
        disabilityOwned: nextMerged.disabilityOwned,
        disability_owned: nextMerged.disabilityOwned,
        eddCertified: nextMerged.eddCertified,
        edd_certified: nextMerged.eddCertified,
        hasTradingLicence: nextMerged.hasTradingLicence,
        has_trading_licence: nextMerged.hasTradingLicence,
        tradingLicenceReason: nextMerged.tradingLicenceReason,
        trading_licence_reason: nextMerged.tradingLicenceReason,
        profileCompleteness: computedCompleteness,
        profile_completeness: computedCompleteness,
        complianceStatus: nextMerged.complianceStatus || 'Action required',
        compliance_status: nextMerged.complianceStatus || 'Action required',
        missingItems: computedMissing,
        missing_items: computedMissing,
        ...updates,
      };

      try {
        const saved = await supplierApi.updateProfile(payload);
        if (saved) {
          setSupplier((curr) => {
            const reMerged = {
              ...curr,
              district: saved.district || saved.districtName || curr.district,
              districtId: saved.districtId || saved.district_id || curr.districtId,
              profileCompleteness: saved.profileCompleteness ?? curr.profileCompleteness,
              complianceStatus: saved.complianceStatus || curr.complianceStatus,
              hasTradingLicence: saved.hasTradingLicence ?? curr.hasTradingLicence,
              tradingLicenceReason: saved.tradingLicenceReason ?? curr.tradingLicenceReason,
            };
            supplierRef.current = reMerged;
            return reMerged;
          });
        }
      } catch (err) {
        console.warn('[APP CONTEXT] Server database profile update notice:', err);
      }
    }

    addAuditEvent({
      actorName: currentSupplier.directors[0]?.fullName || 'Supplier Admin',
      actorRole: 'Supplier',
      organizationName: currentSupplier.legalName,
      action: 'Updated Company Profile',
      entityType: 'Document',
      entityId: currentSupplier.id,
      details: 'Modified general registration and corporate profile fields.',
    });
  }, [addAuditEvent]);

  const uploadDocument = (docData: any) => {
    const newDoc: SupplierDocument = {
      ...docData,
      id: docData.id || `doc-${Date.now()}`,
    };
    const existingIdx = documents.findIndex((d) => d.id === newDoc.id);
    const nextDocs =
      existingIdx >= 0
        ? documents.map((d) => (d.id === newDoc.id ? { ...d, ...newDoc } : d))
        : [newDoc, ...documents];
    setDocuments(nextDocs);
    setSupplier((prev) => {
      const completeness = calculateSupplierCompleteness(prev, nextDocs);
      const nextSup = {
        ...prev,
        documents: nextDocs,
        profileCompleteness: completeness.score,
        missingItems: completeness.missingItems.map((m) => m.label),
        complianceStatus: (completeness.score >= 80 ? 'Fully compliant' : 'Action required') as 'Fully compliant' | 'Action required',
      };
      return nextSup;
    });

    addAuditEvent({
      actorName: supplier.directors[0]?.fullName || 'Supplier Admin',
      actorRole: 'Supplier',
      organizationName: supplier.legalName,
      action: 'Uploaded Document to Vault',
      entityType: 'Document',
      entityId: newDoc.id,
      details: `Uploaded ${newDoc.documentType}${newDoc.expiryDate ? ` (Exp: ${newDoc.expiryDate})` : ''}.`,
    });
  };

  const replaceDocument = (docId: string, updates: Partial<SupplierDocument>) => {
    const nextDocs = documents.map((d) => {
      if (d.id === docId) {
        const currentVersions = d.versionHistory || [];
        const nextVersionNumber = currentVersions.length + 1;
        const newVersionEntry = {
          version: nextVersionNumber,
          uploadedBy: supplier.directors[0]?.fullName || 'Supplier admin',
          uploadedAt:
            new Date().toLocaleDateString('en-GB', {
              day: 'numeric',
              month: 'short',
              year: 'numeric',
            }) +
            ', ' +
            new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
          fileFingerprint: updates.sha256 ? `SHA-256: ${updates.sha256}` : 'Pending checksum',
          fileName: updates.fileName || d.fileName,
          fileSize: updates.fileSize || d.fileSize || 'Unknown size',
          usedInApplications: [],
        };
        return {
          ...d,
          ...updates,
          status: updates.status || 'Pending',
          statusMessage:
            updates.statusMessage || 'Pending verification by procurement registry officers.',
          versionHistory: [...currentVersions, newVersionEntry],
        };
      }
      return d;
    });

    setDocuments(nextDocs);
    setSupplier((prev) => {
      const completeness = calculateSupplierCompleteness(prev, nextDocs);
      const nextSup = {
        ...prev,
        documents: nextDocs,
        profileCompleteness: completeness.score,
        missingItems: completeness.missingItems.map((m) => m.label),
        complianceStatus: (completeness.score >= 80 ? 'Fully compliant' : 'Action required') as 'Fully compliant' | 'Action required',
      };
      return nextSup;
    });

    addAuditEvent({
      actorName: supplier.directors[0]?.fullName || 'Supplier Admin',
      actorRole: 'Supplier',
      organizationName: supplier.legalName,
      action: 'Renewed & Replaced Vault Document',
      entityType: 'Document',
      entityId: docId,
      details: `Replaced compliance document with updated certificate version.`,
    });
  };

  const deleteDocument = (docId: string) => {
    const nextDocs = documents.filter((d) => d.id !== docId);
    setDocuments(nextDocs);
    setSupplier((prev) => {
      const completeness = calculateSupplierCompleteness(prev, nextDocs);
      const nextSup = {
        ...prev,
        documents: nextDocs,
        profileCompleteness: completeness.score,
        missingItems: completeness.missingItems.map((m) => m.label),
        complianceStatus: (completeness.score >= 80 ? 'Fully compliant' : 'Action required') as 'Fully compliant' | 'Action required',
      };
      return nextSup;
    });

    const token = localStorage.getItem('bidready_token');
    if (token) {
      supplierApi.deleteDocument(docId).catch(() => {});
    }
  };

  const grantConsent = async (newGrant: Omit<ConsentGrant, 'id' | 'grantedAt' | 'status'>) => {
    const token = localStorage.getItem('bidready_token');
    if (token) {
      const saved = await supplierApi.grantConsent({
        organizationId: newGrant.organizationId,
        scopes: {
          companyDetails: Boolean(newGrant.scope?.companyDetails),
          directorsOwners: Boolean(newGrant.scope?.directorsOwners),
          pastProjects: Boolean(newGrant.scope?.pastProjects),
          taxCompliance: Boolean(newGrant.scope?.taxCompliance),
          financialStatements: Boolean(newGrant.scope?.financialStatements),
          keyPersonnel: Boolean(newGrant.scope?.keyPersonnel),
          pastContracts: Boolean(newGrant.scope?.pastContracts),
          bankingDetails: Boolean(newGrant.scope?.bankingDetails),
        },
        selectedDocumentIds: newGrant.selectedDocumentIds || [],
        selectedDocumentNames: newGrant.selectedDocumentNames || [],
        expiresAt: newGrant.expiryDate || null,
        purpose: newGrant.purpose,
      });

      const mapped: ConsentGrant = {
        id: saved.id,
        supplierId: saved.supplierId || supplier.id,
        organizationId: saved.organizationId,
        organizationName: saved.organizationName || newGrant.organizationName,
        grantedAt: saved.grantedAt
          ? new Date(saved.grantedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
          : new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        expiryDate: saved.expiresAt ? String(saved.expiresAt).slice(0, 10) : newGrant.expiryDate,
        purpose: saved.purpose || newGrant.purpose,
        status: 'Active',
        scope: {
          companyDetails: Boolean(saved.shareCompanyDetails),
          directorsOwners: Boolean(saved.shareDirectorsOwners),
          pastProjects: Boolean(saved.sharePastProjects),
          selectedDocuments:
            (saved.selectedDocumentNames?.length || 0) > 0 ||
            (saved.selectedDocumentIds?.length || 0) > 0 ||
            Boolean(saved.shareTaxCompliance || saved.shareFinancialStatements),
          taxCompliance: Boolean(saved.shareTaxCompliance),
          financialStatements: Boolean(saved.shareFinancialStatements),
          keyPersonnel: Boolean(saved.shareKeyPersonnel),
          pastContracts: Boolean(saved.sharePastContracts),
          bankingDetails: Boolean(saved.shareBankingDetails),
        },
        selectedDocumentIds: saved.selectedDocumentIds || newGrant.selectedDocumentIds || [],
        selectedDocumentNames: saved.selectedDocumentNames || newGrant.selectedDocumentNames || [],
        tiedApplicationNumbers: saved.tiedApplicationNumbers || [],
        accessedCount: typeof saved.accessCount === 'number' ? saved.accessCount : 0,
        lastAccessedAt: saved.lastAccessedAt
          ? new Date(saved.lastAccessedAt).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
          : undefined,
      };
      setConsentGrants((prev) => {
        const filtered = prev.filter((g) => g.id !== mapped.id && g.organizationId !== mapped.organizationId);
        return [mapped, ...filtered];
      });
      return;
    }

    const grant: ConsentGrant = {
      ...newGrant,
      id: `cg-${Date.now()}`,
      grantedAt: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      status: 'Active',
    };
    setConsentGrants((prev) => [grant, ...prev]);
  };

  const revokeConsent = async (grantId: string, reason?: string) => {
    const token = localStorage.getItem('bidready_token');
    if (token) {
      await supplierApi.revokeConsent(grantId, reason);
    }
    setConsentGrants((prev) =>
      prev.map((g) =>
        g.id === grantId
          ? {
              ...g,
              status: 'Revoked' as const,
              revocationReason: reason || g.revocationReason,
              revokedAt: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
            }
          : g
      )
    );
  };

  const updateConsentScope = async (grantId: string, scopeKey: keyof ConsentGrant['scope'], allowed: boolean) => {
    const current = consentGrants.find((g) => g.id === grantId);
    const nextScope = current ? { ...current.scope, [scopeKey]: allowed } : { [scopeKey]: allowed };
    const token = localStorage.getItem('bidready_token');
    if (token) {
      await supplierApi.updateConsentScope(grantId, {
        scopes: {
          companyDetails: Boolean(nextScope.companyDetails),
          directorsOwners: Boolean(nextScope.directorsOwners),
          pastProjects: Boolean(nextScope.pastProjects),
          taxCompliance: Boolean(nextScope.taxCompliance),
          financialStatements: Boolean(nextScope.financialStatements),
          keyPersonnel: Boolean(nextScope.keyPersonnel),
          pastContracts: Boolean(nextScope.pastContracts),
          bankingDetails: Boolean(nextScope.bankingDetails),
        },
      });
    }
    setConsentGrants((prev) =>
      prev.map((g) => {
        if (g.id === grantId) {
          return {
            ...g,
            scope: { ...g.scope, [scopeKey]: allowed },
          };
        }
        return g;
      })
    );
  };

  const saveApplicationDraft = (draftData: {
    callId: string;
    callNumber: string;
    callTitle: string;
    callType: 'Registration drive' | 'EOI' | 'RFP';
    organizationId: string;
    organizationName: string;
    currentStep?: number;
    bid?: Bid;
    responses?: ApplicationResponse[];
    sharedDocumentIds?: string[];
    answers?: Record<string, any>;
    draftData?: any;
    initialTimelineNote?: string;
  }): string => {
    const now = new Date().toISOString().replace('T', ' ').substring(0, 16);
    let targetAppId = '';

    setApplications((prev) => {
      const existingDraftIndex = prev.findIndex(
        (a) => a.callId === draftData.callId && a.supplierId === supplier.id && a.status === 'Draft'
      );

      if (existingDraftIndex >= 0) {
        targetAppId = prev[existingDraftIndex].id;
        const updatedApp: Application = {
          ...prev[existingDraftIndex],
          currentStep: draftData.currentStep || prev[existingDraftIndex].currentStep || 1,
          lastSavedAt: now,
          sharedDocumentIds: draftData.sharedDocumentIds || prev[existingDraftIndex].sharedDocumentIds,
          responses: draftData.responses || prev[existingDraftIndex].responses,
          bid: draftData.bid || prev[existingDraftIndex].bid,
          answers: draftData.answers || prev[existingDraftIndex].answers,
          draftData: draftData.draftData || prev[existingDraftIndex].draftData,
          timeline: [
            ...prev[existingDraftIndex].timeline,
            {
              stage: 'Draft',
              timestamp: now,
              note: draftData.initialTimelineNote || `Application draft saved at Step ${draftData.currentStep || 1}.`,
            },
          ],
        };
        const nextApps = [...prev];
        nextApps[existingDraftIndex] = updatedApp;
        return nextApps;
      } else {
        targetAppId = `app-draft-${Date.now()}`;
        const newDraftApp: Application = {
          id: targetAppId,
          callId: draftData.callId,
          callNumber: draftData.callNumber,
          callTitle: draftData.callTitle,
          callType: draftData.callType,
          organizationId: draftData.organizationId,
          organizationName: draftData.organizationName,
          supplierId: supplier.id,
          supplierName: supplier.legalName,
          submittedAt: now,
          lastSavedAt: now,
          status: 'Draft',
          currentStep: draftData.currentStep || 1,
          sharedDocumentIds: draftData.sharedDocumentIds || [],
          responses: draftData.responses || [],
          bid: draftData.bid,
          answers: draftData.answers || {},
          draftData: draftData.draftData || {},
          timeline: [
            {
              stage: 'Draft',
              timestamp: now,
              note: draftData.initialTimelineNote || `Application draft created at Step ${draftData.currentStep || 1}.`,
            },
          ],
        };
        return [newDraftApp, ...prev];
      }
    });
    return targetAppId;
  };

  const deleteApplicationDraft = (appId: string) => {
    setApplications((prev) => prev.filter((a) => a.id !== appId));
  };

  const submitApplication = (
    appData: Omit<Application, 'id' | 'submittedAt' | 'timeline'> & { initialTimelineNote?: string },
    options?: { skipApiSync?: boolean }
  ): string => {
    const now = new Date().toISOString().replace('T', ' ').substring(0, 16);
    let assignedAppId = '';

    setApplications((prev) => {
      const existingDraftIndex = prev.findIndex(
        (a) => a.callId === appData.callId && a.supplierId === appData.supplierId && a.status === 'Draft'
      );

      if (existingDraftIndex >= 0) {
        assignedAppId = prev[existingDraftIndex].id;
        const updatedApp: Application = {
          ...prev[existingDraftIndex],
          status: 'Submitted',
          submittedAt: now,
          receiptNumber: appData.receiptNumber,
          sharedDocumentIds: appData.sharedDocumentIds,
          responses: appData.responses,
          bid: appData.bid,
          currentStep: 5,
          draftData: undefined,
          timeline: [
            ...prev[existingDraftIndex].timeline,
            {
              stage: 'Submitted',
              timestamp: now,
              note: appData.initialTimelineNote || (appData.callType === 'RFP' ? 'Sealed tender bid submitted electronically.' : 'Application submitted successfully.'),
            },
          ],
        };
        const nextApps = [...prev];
        nextApps[existingDraftIndex] = updatedApp;
        return nextApps;
      }

      assignedAppId = `app-${Date.now()}`;
      const newApp: Application = {
        id: assignedAppId,
        callId: appData.callId,
        callNumber: appData.callNumber,
        callTitle: appData.callTitle,
        callType: appData.callType,
        organizationId: appData.organizationId,
        organizationName: appData.organizationName,
        supplierId: appData.supplierId,
        supplierName: appData.supplierName,
        submittedAt: now,
        status: 'Submitted',
        receiptNumber: appData.receiptNumber,
        sharedDocumentIds: appData.sharedDocumentIds,
        responses: appData.responses,
        bid: appData.bid,
        timeline: [
          {
            stage: 'Submitted',
            timestamp: now,
            note: appData.initialTimelineNote || (appData.callType === 'RFP' ? 'Sealed tender bid submitted electronically.' : 'Application submitted successfully.'),
          },
        ],
      };

      return [newApp, ...prev];
    });

    const appId = assignedAppId || `app-${Date.now()}`;

    // Update Call application count
    setCalls((prev) =>
      prev.map((c) => (c.id === appData.callId ? { ...c, applicationsCount: c.applicationsCount + 1 } : c))
    );

    addAuditEvent({
      actorName: supplier.directors[0]?.fullName || supplier.teamMembers?.[0]?.name || supplier.legalName || 'Supplier Admin',
      actorRole: 'Supplier',
      organizationName: supplier.legalName,
      action: appData.callType === 'RFP' ? 'Submitted Sealed RFP Bid' : 'Submitted Registration / EOI Application',
      entityType: 'Application',
      entityId: appId,
      details: `Application for ${appData.callNumber} (${appData.callTitle}) submitted to ${appData.organizationName}.`,
    });

    const token = localStorage.getItem('bidready_token');
    if (token && !options?.skipApiSync) {
      supplierApi.submitApplication({
        callId: appData.callId,
        answers: appData.answers || {},
        attachedDocumentVersionIds: appData.sharedDocumentIds || [],
      }).catch((err) => {
        console.warn('[APP CONTEXT] Server application submission sync notice:', err);
      });
    }

    return appId;
  };

  const updateApplicationStatus = (appId: string, status: Application['status'], reason?: string, reviewer?: string) => {
    const actorName = reviewer || currentUser?.fullName || 'Authorized Procurement Officer';
    const buyerOrgName = registeredBuyerOrgName || 'Procuring Organization';
    const now = new Date().toISOString().replace('T', ' ').substring(0, 16);
    setApplications((prev) =>
      prev.map((app) => {
        if (app.id === appId) {
          return {
            ...app,
            status,
            statusReason: reason,
            reviewedBy: actorName,
            reviewedAt: now,
            timeline: [
              ...app.timeline,
              {
                stage: status,
                timestamp: now,
                note: reason || `Status updated to ${status} by ${actorName}.`,
              },
            ],
          };
        }
        return app;
      })
    );

    addAuditEvent({
      actorName,
      actorRole: 'Procurement Officer',
      organizationName: buyerOrgName,
      action: `Updated Application Status to ${status}`,
      entityType: 'Application',
      entityId: appId,
      details: reason || `Processed application for evaluation stage.`,
    });
  };

  const withdrawApplication = async (
    appId: string,
    reason?: string,
    options?: { skipApiSync?: boolean }
  ) => {
    const token = localStorage.getItem('bidready_token');
    if (token && !options?.skipApiSync) {
      await supplierApi.withdrawApplication(appId, reason);
    }

    const now = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    setApplications((prev) =>
      prev.map((app) => {
        if (app.id === appId) {
          return {
            ...app,
            status: 'Withdrawn',
            statusReason: reason || 'Application withdrawn by supplier prior to closing.',
            withdrawnAt: now,
            withdrawalReason: reason || null,
            timeline: [
              ...app.timeline,
              {
                stage: 'Withdrawn',
                timestamp: now,
                note: reason || 'Proposal withdrawn by authorized supplier representative.',
              },
            ],
          };
        }
        return app;
      })
    );
  };

  const respondToInformationRequest = async (appId: string, responseMessage: string) => {
    const token = localStorage.getItem('bidready_token');
    if (token) {
      await supplierApi.respondToInfoRequest(appId, responseMessage);
    }

    const now = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + ', ' + new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
    const respondent = supplier.directors[0]?.fullName
      ? `${supplier.directors[0].fullName} (Supplier)`
      : supplier.teamMembers?.[0]?.name
      ? `${supplier.teamMembers[0].name} (Supplier)`
      : `${supplier.legalName || 'Supplier'} (Supplier)`;

    setApplications((prev) =>
      prev.map((app) => {
        if (app.id === appId) {
          const updatedInfoRequest = app.informationRequest
            ? {
                ...app.informationRequest,
                status: 'Responded' as const,
                responseMessage,
                respondedAt: now,
                respondedBy: respondent,
              }
            : undefined;

          const updatedReviewerMessages = [
            ...(app.reviewerMessages || []),
            {
              id: `rm-resp-${Date.now()}`,
              sender: respondent,
              senderRole: 'Supplier',
              timestamp: now,
              message: responseMessage,
            },
          ];

          return {
            ...app,
            status: 'Under review' as const,
            statusReason: 'Clarification response submitted. Back under review by evaluation committee.',
            informationRequest: updatedInfoRequest,
            reviewerMessages: updatedReviewerMessages,
            timeline: [
              ...app.timeline,
              {
                stage: 'Under review' as const,
                timestamp: now,
                note: `Clarification response submitted by supplier: "${responseMessage}". Status reverted to Under review.`,
              },
            ],
          };
        }
        return app;
      })
    );
  };

  const submitClarificationQuestion = (callId: string, question: string) => {
    const newClar: Clarification = {
      id: `clar-${Date.now()}`,
      callId,
      supplierId: supplier.id,
      supplierName: supplier.legalName,
      question,
      submittedAt: new Date().toISOString().replace('T', ' ').substring(0, 16),
      status: 'Pending',
      isPublished: false,
    };
    setClarifications((prev) => [newClar, ...prev]);

    addAuditEvent({
      actorName: supplier.directors[0]?.fullName || supplier.teamMembers?.[0]?.name || supplier.legalName || 'Supplier Admin',
      actorRole: 'Supplier',
      organizationName: supplier.legalName,
      action: 'Submitted Clarification Question',
      entityType: 'Call',
      entityId: callId,
      details: `Question submitted on tender ${callId}.`,
    });
  };

  const publishClarificationAnswer = (clarId: string, answer: string, answeredBy: string) => {
    const now = new Date().toISOString().replace('T', ' ').substring(0, 16);
    setClarifications((prev) =>
      prev.map((c) =>
        c.id === clarId
          ? {
              ...c,
              answer,
              answeredAt: now,
              answeredBy,
              status: 'Answered',
              isPublished: true,
            }
          : c
      )
    );

    addAuditEvent({
      actorName: answeredBy,
      actorRole: 'Procurement Officer',
      organizationName: registeredBuyerOrgName || 'Procuring Organization',
      action: 'Published Official Clarification Answer',
      entityType: 'Call',
      entityId: clarId,
      details: `Published public clarification response for all prospective bidders.`,
    });
  };

  const createCall = (newCallData: Omit<Call, 'id' | 'documentsCount' | 'applicationsCount' | 'addenda'> & { id?: string }): string => {
    const newId = newCallData.id || `call-${Date.now()}`;
    const newCall: Call = {
      ...newCallData,
      id: newId,
      documentsCount: newCallData.requiredDocumentTypes.length,
      applicationsCount: 0,
      addenda: [],
    };
    setCalls((prev) => [newCall, ...prev]);

    addAuditEvent({
      actorName: currentUser?.fullName || 'Authorized Procurement Officer',
      actorRole: 'Procurement Officer',
      organizationName: newCall.organizationName,
      action: 'Created New Procurement Call',
      entityType: 'Call',
      entityId: newId,
      details: `Published ${newCall.type} tender: ${newCall.callNumber} - ${newCall.title}.`,
    });

    return newId;
  };

  const createFormTemplate = (templateData: Omit<FormTemplate, 'id' | 'updatedAt'>): string => {
    const newId = `tmpl-${Date.now()}`;
    const newTemplate: FormTemplate = {
      ...templateData,
      id: newId,
      updatedAt: new Date().toISOString().substring(0, 10),
    };
    setFormTemplates((prev) => [newTemplate, ...prev]);

    addAuditEvent({
      actorName: currentUser?.fullName || 'Authorized Procurement Officer',
      actorRole: 'Procurement Officer',
      organizationName: registeredBuyerOrgName || 'Procuring Organization',
      action: 'Created Form Template',
      entityType: 'Form',
      entityId: newId,
      details: `Designed custom questionnaire: ${newTemplate.title} (${newTemplate.version}).`,
    });

    return newId;
  };

  const updateFormTemplate = (id: string, updates: Partial<FormTemplate>) => {
    setFormTemplates((prev) =>
      prev.map((t) => (t.id === id ? { ...t, ...updates, updatedAt: new Date().toISOString().substring(0, 10) } : t))
    );
  };

  const saveScore = (scoreData: Omit<Score, 'id' | 'scoredAt'>) => {
    const now = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const existingIndex = scores.findIndex(
      (s) =>
        s.callId === scoreData.callId &&
        s.applicationId === scoreData.applicationId &&
        s.evaluatorId === scoreData.evaluatorId &&
        s.criterionId === scoreData.criterionId
    );

    if (existingIndex >= 0) {
      setScores((prev) => {
        const next = [...prev];
        next[existingIndex] = { ...next[existingIndex], ...scoreData, scoredAt: now };
        return next;
      });
    } else {
      const newScore: Score = {
        ...scoreData,
        id: `sc-${Date.now()}`,
        scoredAt: now,
      };
      setScores((prev) => [...prev, newScore]);
    }

    addAuditEvent({
      actorName: scoreData.evaluatorName,
      actorRole: 'Evaluator',
      organizationName: registeredBuyerOrgName || 'Procuring Organization',
      action: 'Recorded Evaluation Score',
      entityType: 'Evaluation',
      entityId: scoreData.applicationId,
      details: `Scored criterion with ${scoreData.score} points.`,
    });
  };

  const signConflictDeclaration = (evaluatorId: string, details?: string) => {
    const now = new Date().toISOString().replace('T', ' ').substring(0, 16);
    setEvaluators((prev) =>
      prev.map((e) =>
        e.id === evaluatorId
          ? {
              ...e,
              hasDeclaredConflict: true,
              declarationDate: now,
              conflictDetails: details || 'No pecuniary, family, or commercial conflict of interest declared.',
            }
          : e
      )
    );

    addAuditEvent({
      actorName: evaluators.find((e) => e.id === evaluatorId)?.name || currentUser?.fullName || 'Evaluator',
      actorRole: 'Evaluator',
      organizationName: registeredBuyerOrgName || 'Procuring Organization',
      action: 'Signed Conflict of Interest Declaration',
      entityType: 'Evaluation',
      entityId: evaluatorId,
      details: 'Completed mandatory statutory declaration before opening scoring matrix.',
    });
  };

  const updateAwardDecision = (updates: Partial<AwardDecision>) => {
    const now = new Date().toISOString().replace('T', ' ').substring(0, 16);
    const actorName = currentUser?.fullName || (updates.status === 'Approved & Published' ? 'Tender Board Approver' : 'Procurement Officer');
    setAwardDecision((prev) => ({
      ...prev,
      ...updates,
      approvedAt: updates.status === 'Approved & Published' ? now : prev.approvedAt,
      approvedBy: updates.status === 'Approved & Published' ? actorName : prev.approvedBy,
    }));

    addAuditEvent({
      actorName,
      actorRole: updates.status === 'Approved & Published' ? 'Approver' : 'Procurement Officer',
      organizationName: registeredBuyerOrgName || 'Procuring Organization',
      action: updates.status === 'Approved & Published' ? 'Approved and Published Contract Award' : 'Updated Draft Award Recommendation',
      entityType: 'Award',
      entityId: awardDecision.id,
      details: `Award recommendation updated to ${updates.status}. Amount: BWP ${updates.awardedAmountBWP?.toLocaleString() || awardDecision.awardedAmountBWP.toLocaleString()}.`,
    });
  };

  const refreshNotifications = useCallback(async () => {
    if (!isAuthenticated) return;
    try {
      const rows = await notificationsApi.list(100);
      if (!Array.isArray(rows)) return;
      const mapped: NotificationItem[] = rows.map((n: any) => ({
        id: n.id,
        recipientRole:
          n.recipientRole === 'Buyer' || role === 'buyer'
            ? 'Buyer'
            : 'Supplier',
        recipientId: n.supplierId || n.organizationId || n.userId || '',
        eventType: n.eventType || n.type || undefined,
        title: n.title || 'Procurement notification',
        message: n.body || n.message || '',
        timestamp: n.createdAt || '',
        read: typeof n.isRead === 'boolean' ? n.isRead : Boolean(n.readAt),
        starred: Boolean(n.isStarred ?? n.starred),
        archived: Boolean(n.isArchived ?? n.archived ?? n.archivedAt),
        archivedAt: n.archivedAt || null,
        type: (['urgent', 'info', 'success', 'warning'].includes(n.priority) ? n.priority : 'info') as NotificationItem['type'],
        actionLink: n.linkUrl || n.link || undefined,
        data: n.data || null,
      }));
      setNotifications(mapped);
    } catch {
      // Keep current notifications on transient network error
    }
  }, [isAuthenticated, role]);

  useEffect(() => {
    if (!isAuthenticated || (role !== 'supplier' && role !== 'buyer')) return;
    const handleFocus = () => {
      if (document.visibilityState === 'visible') {
        void refreshNotifications();
      }
    };
    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);
    const intervalId = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void refreshNotifications();
      }
    }, 30000);
    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
      window.clearInterval(intervalId);
    };
  }, [isAuthenticated, role, refreshNotifications]);

  const markNotificationRead = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    if (!isAuthenticated) return;
    try {
      await notificationsApi.markRead(id);
    } catch {
      await refreshNotifications();
    }
  };

  const markNotificationUnread = async (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: false } : n))
    );
    if (!isAuthenticated) return;
    try {
      await notificationsApi.markUnread(id);
    } catch {
      await refreshNotifications();
    }
  };

  const toggleNotificationStar = async (id: string, starred: boolean) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, starred } : n))
    );
    if (!isAuthenticated) return;
    try {
      await notificationsApi.setStarred(id, starred);
    } catch {
      await refreshNotifications();
    }
  };

  const toggleNotificationArchive = async (id: string, archived: boolean) => {
    setNotifications((prev) =>
      prev.map((n) =>
        n.id === id
          ? { ...n, archived, archivedAt: archived ? new Date().toISOString() : null }
          : n
      )
    );
    if (!isAuthenticated) return;
    try {
      await notificationsApi.setArchived(id, archived);
    } catch {
      await refreshNotifications();
    }
  };

  const deleteNotification = async (id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (!isAuthenticated) return;
    try {
      await notificationsApi.deleteNotification(id);
    } catch {
      await refreshNotifications();
    }
  };

  const bulkUpdateNotifications = async (ids: string[], action: NotificationBulkAction) => {
    if (!ids.length) return;
    const idSet = new Set(ids);
    const nowIso = new Date().toISOString();
    setNotifications((prev) => {
      if (action === 'delete') {
        return prev.filter((n) => !idSet.has(n.id));
      }
      return prev.map((n) => {
        if (!idSet.has(n.id)) return n;
        switch (action) {
          case 'read':
            return { ...n, read: true };
          case 'unread':
            return { ...n, read: false };
          case 'star':
            return { ...n, starred: true };
          case 'unstar':
            return { ...n, starred: false };
          case 'archive':
            return { ...n, archived: true, archivedAt: n.archivedAt || nowIso };
          case 'unarchive':
            return { ...n, archived: false, archivedAt: null };
          default:
            return n;
        }
      });
    });
    if (!isAuthenticated) return;
    try {
      await notificationsApi.bulkAction(ids, action);
    } catch {
      await refreshNotifications();
    }
  };

  const markAllNotificationsRead = async () => {
    setNotifications((prev) => prev.map((n) => (n.archived ? n : { ...n, read: true })));
    if (!isAuthenticated) return;
    try {
      await notificationsApi.markAllRead();
    } catch {
      await refreshNotifications();
    }
  };

  return (
    <AppContext.Provider
      value={{
        role,
        setRole,
        buyerSubRole,
        setBuyerSubRole,
        currentOrgSlug,
        setCurrentOrgSlug,
        language,
        setLanguage,
        theme,
        resolvedTheme,
        setTheme,
        toggleTheme,
        t,
        activeNav,
        setActiveNav,
        selectedCallId,
        setSelectedCallId,
        selectedAppId,
        setSelectedAppId,
        currentUser,
        isAuthenticated,
        authLoading,
        intendedRoute,
        setIntendedRoute,
        loginSuccess,
        logout,
        isInactiveWarningOpen,
        inactivitySecondsLeft,
        resetInactivity,
        buyerOrgStatus,
        buyerOrgRejectionReason,
        registeredBuyerOrgName,
        registeredBuyerEmail,
        registerBuyerOrganization,
        approveBuyerOrg,
        rejectBuyerOrg,
        isBootstrapping,
        bootstrapStep,
        bootstrapMessage,
        runBootstrap,
        supplier,
        allSuppliers,
        documents,
        organizations,
        calls,
        applications,
        clarifications,
        consentGrants,
        criteria,
        scores,
        evaluators,
        awardDecision,
        auditEvents,
        notifications,
        formTemplates,
        buyerBranding,
        setBuyerBranding,
        refreshCalls,
        updateSupplierProfile,
        uploadDocument,
        replaceDocument,
        deleteDocument,
        grantConsent,
        revokeConsent,
        updateConsentScope,
        submitApplication,
        saveApplicationDraft,
        deleteApplicationDraft,
        updateApplicationStatus,
        withdrawApplication,
        respondToInformationRequest,
        submitClarificationQuestion,
        publishClarificationAnswer,
        createCall,
        createFormTemplate,
        updateFormTemplate,
        saveScore,
        signConflictDeclaration,
        updateAwardDecision,
        markNotificationRead,
        markNotificationUnread,
        toggleNotificationStar,
        toggleNotificationArchive,
        deleteNotification,
        bulkUpdateNotifications,
        markAllNotificationsRead,
        refreshNotifications,
        addAuditEvent,
        completenessResult,
        profileSummary,
        isGateReady,
        gatePurpose,
        switchingTargetName,
        gateError,
        retryProfileLoad,
        setGatePurpose,
        switchOrganizationOrSupplier,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
};
