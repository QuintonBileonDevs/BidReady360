import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  Supplier,
  SupplierDocument,
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
  FormTemplate,
  Evaluator,
  AwardDecision,
} from '../types';
import { ApiUser, ProfileSummary, authApi, callsApi, supplierApi, buyerApi } from '../services/api';
import {
  DEMO_SUPPLIER,
  DEMO_DOCUMENTS,
  DEMO_APPLICATIONS,
  DEMO_CONSENT_GRANTS,
  DEMO_PAST_PROJECTS,
  DEMO_TEAM_MEMBERS,
} from '../data/demoSupplierData';
import { Language, TRANSLATIONS } from '../translations';
import { calculateSupplierCompleteness, SupplierCompletenessResult } from '../utils/supplierOnboarding';

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
  isDemoAccount: false,
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
export type ThemeMode = 'light' | 'dark';

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
  
  // Buyer Verification State
  buyerOrgStatus: 'Pending' | 'Approved' | 'Rejected';
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

  // Mutators
  updateSupplierProfile: (updates: Partial<Supplier>) => Promise<any> | void;
  uploadDocument: (doc: any) => void;
  replaceDocument: (docId: string, updates: Partial<SupplierDocument>) => void;
  deleteDocument: (docId: string) => void;
  grantConsent: (newGrant: Omit<ConsentGrant, 'id' | 'grantedAt' | 'status'>) => void;
  revokeConsent: (grantId: string) => void;
  updateConsentScope: (grantId: string, scopeKey: keyof ConsentGrant['scope'], allowed: boolean) => void;
  submitApplication: (applicationData: Omit<Application, 'id' | 'submittedAt' | 'timeline'> & { initialTimelineNote?: string }) => string;
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
  withdrawApplication: (appId: string, reason?: string) => void;
  respondToInformationRequest: (appId: string, responseMessage: string) => void;
  submitClarificationQuestion: (callId: string, question: string) => void;
  publishClarificationAnswer: (clarId: string, answer: string, answeredBy: string) => void;
  createCall: (newCall: Omit<Call, 'id' | 'documentsCount' | 'applicationsCount' | 'addenda'>) => string;
  createFormTemplate: (template: Omit<FormTemplate, 'id' | 'updatedAt'>) => string;
  updateFormTemplate: (id: string, updates: Partial<FormTemplate>) => void;
  saveScore: (scoreData: Omit<Score, 'id' | 'scoredAt'>) => void;
  signConflictDeclaration: (evaluatorId: string, details?: string) => void;
  updateAwardDecision: (updates: Partial<AwardDecision>) => void;
  markNotificationRead: (id: string) => void;
  addAuditEvent: (event: Omit<AuditEvent, 'id' | 'timestamp'>) => void;

  // Demo & Onboarding
  loadDemoSupplier: () => void;
  resetDemoData: () => void;
  autoCompleteProfile: () => void;
  completenessResult: SupplierCompletenessResult;
}

const AppContext = createContext<AppContextType | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // 1. Initialize authentication and navigation from stored session
  const initialSession = getStoredSession();

  const [currentUser, setCurrentUser] = useState<ApiUser | null>(() => initialSession?.user || null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => Boolean(initialSession?.user));
  const [authLoading, setAuthLoading] = useState<boolean>(false);
  const [intendedRoute, setIntendedRoute] = useState<string | null>(null);

  const [profileSummary, setProfileSummary] = useState<ProfileSummary | null>(() => {
    if (initialSession && initialSession.user) {
      return {
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
  const [theme, setThemeState] = useState<ThemeMode>('light');

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
    setSupplier(EMPTY_SUPPLIER);
    setDocuments([]);
    setApplications([]);
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
        setInactivitySecondsLeft(secondsRemaining);
        setIsInactiveWarningOpen(true);
      } else {
        setIsInactiveWarningOpen(false);
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
          setCurrentUser(session.user);
          setIsAuthenticated(true);
          let resolvedRole: UserRole = 'supplier';
          if (session.user.isPlatformAdmin) {
            resolvedRole = 'admin';
          } else if (session.activeTenant?.tenantType === 'organization') {
            resolvedRole = 'buyer';
            setBuyerOrgStatus('Approved');
            setRegisteredBuyerOrgName(session.activeTenant.tenantName);
            setRegisteredBuyerEmail(session.user.email);
          } else if (session.activeTenant?.tenantType === 'supplier') {
            resolvedRole = 'supplier';
          }
          setRoleState(resolvedRole);

          const savedNav = localStorage.getItem('bidready_active_nav');
          if (savedNav && savedNav !== 'about' && savedNav !== 'session-expired') {
            setActiveNavState(savedNav);
          }
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
    session: { user: ApiUser; activeTenant?: any; token?: string },
    targetRole?: UserRole
  ) => {
    if (session.token) {
      try {
        localStorage.setItem('bidready_token', session.token);
      } catch {}
    }

    try {
      localStorage.removeItem('bidready_supplier_profile');
      localStorage.removeItem('bidready_supplier_documents');
      localStorage.removeItem('bidready_supplier_applications');
      localStorage.removeItem('bidready_supplier_consent_grants');
      localStorage.removeItem('bidready_supplier_people');
    } catch {}
    setSupplier(EMPTY_SUPPLIER);
    setDocuments([]);
    setApplications([]);

    setCurrentUser(session.user);
    setIsAuthenticated(true);

    let resolvedRole: UserRole = targetRole || 'supplier';
    if (session.user.isPlatformAdmin) {
      resolvedRole = 'admin';
    } else if (session.activeTenant?.tenantType === 'organization') {
      resolvedRole = 'buyer';
      setBuyerOrgStatus('Approved');
      setRegisteredBuyerOrgName(session.activeTenant.tenantName);
      setRegisteredBuyerEmail(session.user.email);
    } else if (session.activeTenant?.tenantType === 'supplier') {
      resolvedRole = 'supplier';
    }

    setRoleState(resolvedRole);

    let destination = intendedRoute;
    if (destination) {
      setIntendedRoute(null);
    } else {
      destination = resolvedRole === 'admin' ? 'admin-dashboard' : 'dashboard';
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
      actorName: 'System Administrator (Registrar)',
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
      actorName: 'System Administrator (Registrar)',
      actorRole: 'Super Admin',
      organizationName: targetName,
      action: 'Procuring Organization Registration Rejected',
      entityType: 'Organization',
      entityId: `org-rejected`,
      details: `Registration for ${targetName} rejected. Reason: ${reason || 'Failed authority standing verification'}.`,
    });
  };

  const setTheme = (newTheme: ThemeMode) => {
    setThemeState(newTheme);
  };

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
      document.body.classList.add('dark');
      document.documentElement.style.colorScheme = 'dark';
    } else {
      document.documentElement.classList.remove('dark');
      document.body.classList.remove('dark');
      document.documentElement.style.colorScheme = 'light';
    }
  }, [theme]);

  const toggleTheme = () => {
    setThemeState((prev) => (prev === 'light' ? 'dark' : 'light'));
  };

  // Persistence helpers
  const saveSupplierToStorage = (nextSup: Supplier) => {
    try {
      localStorage.setItem('bidready_supplier_profile', JSON.stringify(nextSup));
    } catch {}
  };

  const saveDocumentsToStorage = (nextDocs: SupplierDocument[]) => {
    try {
      localStorage.setItem('bidready_supplier_documents', JSON.stringify(nextDocs));
    } catch {}
  };

  const saveApplicationsToStorage = (nextApps: Application[]) => {
    try {
      localStorage.setItem('bidready_supplier_applications', JSON.stringify(nextApps));
    } catch {}
  };

  const saveConsentGrantsToStorage = (nextGrants: ConsentGrant[]) => {
    try {
      localStorage.setItem('bidready_supplier_consent_grants', JSON.stringify(nextGrants));
    } catch {}
  };

  // Dynamic data states initialized clean to prevent legacy data flash
  const [supplier, setSupplier] = useState<Supplier>(EMPTY_SUPPLIER);
  const [allSuppliers] = useState<Supplier[]>([EMPTY_SUPPLIER]);
  const [documents, setDocuments] = useState<SupplierDocument[]>([]);
  const [organizations] = useState<Organization[]>([
    {
      id: 'org-grc',
      name: 'Gaborone Regional Council',
      acronym: 'GRC',
      type: 'Local Authority',
      district: 'South-East',
      city: 'Gaborone',
      logoText: 'GRC',
      contactEmail: 'procurement@grc.gov.bw',
      contactPhone: '+267 391 2000',
      address: 'Plot 1204, Khama Crescent, Gaborone',
      activeCallsCount: 4,
      suppliersRosterCount: 342,
    },
    {
      id: 'org-burs',
      name: 'Botswana Unified Revenue Service',
      acronym: 'BURS',
      type: 'Parastatal / Revenue',
      district: 'South-East',
      city: 'Gaborone',
      logoText: 'BURS',
      contactEmail: 'tenders@burs.org.bw',
      contactPhone: '+267 363 8000',
      address: 'BURS House, Gaborone CBD',
      activeCallsCount: 3,
      suppliersRosterCount: 512,
    },
    {
      id: 'org-debswana',
      name: 'Debswana Diamond Company',
      acronym: 'DEBSWANA',
      type: 'Mining Enterprise',
      district: 'Central / Jwaneng',
      city: 'Gaborone / Jwaneng',
      logoText: 'DEBS',
      contactEmail: 'procurement@debswana.bw',
      contactPhone: '+267 361 4000',
      address: 'Airport Road, Debswana House',
      activeCallsCount: 5,
      suppliersRosterCount: 890,
    },
    {
      id: 'org-mof',
      name: 'Ministry of Finance',
      acronym: 'MoF',
      type: 'Central Government Ministry',
      district: 'South-East',
      city: 'Gaborone',
      logoText: 'MoF',
      contactEmail: 'procurement@gov.bw',
      contactPhone: '+267 395 0100',
      address: 'Government Enclave, Khama Crescent',
      activeCallsCount: 2,
      suppliersRosterCount: 410,
    },
    {
      id: 'org-ppra',
      name: 'Public Procurement Regulatory Authority',
      acronym: 'PPRA',
      type: 'Regulatory Body',
      district: 'South-East',
      city: 'Gaborone',
      logoText: 'PPRA',
      contactEmail: 'info@ppra.co.bw',
      contactPhone: '+267 360 5000',
      address: 'PPRA House, Fairgrounds Office Park',
      activeCallsCount: 1,
      suppliersRosterCount: 1250,
    },
    {
      id: 'org-fcc',
      name: 'Francistown City Council',
      acronym: 'FCC',
      type: 'Local Authority',
      district: 'North-East',
      city: 'Francistown',
      logoText: 'FCC',
      contactEmail: 'tenders@fcc.gov.bw',
      contactPhone: '+267 241 1000',
      address: 'Town Hall, Civic Centre, Francistown',
      activeCallsCount: 2,
      suppliersRosterCount: 180,
    },
  ]);
  const [calls, setCalls] = useState<Call[]>([]);
  const [applications, setApplications] = useState<Application[]>(() => {
    try {
      const saved = localStorage.getItem('bidready_supplier_applications');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  useEffect(() => {
    let isMounted = true;
    async function loadDatabaseCalls() {
      try {
        const fetchedCalls = await callsApi.listOpen();
        if (isMounted && Array.isArray(fetchedCalls) && fetchedCalls.length > 0) {
          const mappedCalls: Call[] = fetchedCalls.map((c: any) => ({
            id: c.id,
            callNumber: c.referenceNo || `CALL-${c.id.substring(0, 6)}`,
            organizationId: c.organizationId || 'org-1',
            organizationName: c.organizationName || 'Procuring Organization',
            organizationSlug: c.organizationSlug || 'org-procuring',
            title: c.title,
            summary: c.summary || c.description || '',
            type: c.callType === 'rfp' ? 'RFP' : c.callType === 'registration_drive' ? 'Registration drive' : 'EOI',
            category: (c.categories && c.categories[0]?.name) || 'General Procurement',
            subcategories: (c.categories || []).map((cat: any) => cat.name || String(cat)),
            location: 'Gaborone, Botswana',
            openingDate: c.opensAt ? new Date(c.opensAt).toISOString().split('T')[0] : '2026-10-01',
            clarificationDeadline: c.clarificationDeadline ? new Date(c.clarificationDeadline).toISOString().split('T')[0] : '2026-11-15',
            closingDate: c.closesAt ? new Date(c.closesAt).toISOString().split('T')[0] : '2026-12-31',
            closingTimeCAT: '12:00 PM',
            status: c.status === 'published' || c.status === 'open' ? 'Open' : c.status === 'closed' ? 'Closed' : 'Under evaluation',
            requiredDocumentTypes: ['CIPA_CERT', 'BURS_TAX', 'PPRA_CERT'],
            daysRemaining: typeof c.daysRemaining === 'number' ? Math.max(0, Math.floor(c.daysRemaining)) : 30,
            isSealed: true,
            documentsCount: c.documentsCount || 3,
            applicationsCount: c.applicationsCount || 0,
            estimatedBudgetBWP: Number(c.estimatedValue || 0),
            addenda: [],
          }));
          setCalls(mappedCalls);
        }
      } catch (err) {
        console.warn('[APP CONTEXT] Database calls fetch notice:', err);
      }
    }

    loadDatabaseCalls();
    return () => {
      isMounted = false;
    };
  }, []);

  // Dual-mode Supplier Passport Loader (Authenticated profile or clean empty state)
  useEffect(() => {
    let isMounted = true;
    async function loadSupplierProfile() {
      if (isAuthenticated && role === 'supplier') {
        try {
          const profile = await supplierApi.getProfile();
          const docsList = await supplierApi.listDocuments().catch(() => []);
          const appsList = await supplierApi.listApplications().catch(() => []);
          const peopleList = await supplierApi.listPeople().catch(() => []);
          const consentList = await supplierApi.listConsent().catch(() => []);

          if (isMounted) {
            const mappedDocs: SupplierDocument[] = Array.isArray(docsList)
              ? docsList.map((d: any) => ({
                  id: d.id,
                  supplierId: d.supplierId || profile?.id || '',
                  documentType: d.documentTypeName || d.documentTypeCode || d.documentType || 'Document',
                  documentNumber: d.documentNumber || '',
                  fileName: d.fileName || 'document.pdf',
                  fileSize: d.fileSize || '1.2 MB',
                  issueDate: d.issueDate || '',
                  expiryDate: d.expiryDate || '',
                  status:
                    d.status === 'active' || d.status === 'Verified'
                      ? 'Verified'
                      : d.status === 'expired'
                      ? 'Expired'
                      : d.status === 'rejected'
                      ? 'Rejected'
                      : 'Pending',
                  statusMessage: d.statusMessage || '',
                  downloadUrl: d.downloadUrl || '#',
                }))
              : [];

            setDocuments(mappedDocs);

            if (Array.isArray(appsList) && appsList.length > 0) {
              setApplications(
                appsList.map((a: any) => ({
                  id: a.id,
                  callId: a.callId,
                  callNumber: a.callNumber || `TDR-${a.id.substring(0, 6)}`,
                  callTitle: a.callTitle || 'Tender Call',
                  callType: 'RFP',
                  organizationId: a.organizationId,
                  organizationName: a.organizationName || 'Procuring Entity',
                  supplierId: a.supplierId,
                  supplierName: a.supplierLegalName || profile?.legalName || '',
                  submittedAt: a.submittedAt || '',
                  status:
                    a.status === 'Approved'
                      ? 'Approved'
                      : a.status === 'Rejected'
                      ? 'Rejected'
                      : 'Submitted',
                  sharedDocumentIds: [],
                  responses: a.answers || {},
                  timeline: a.timeline || [],
                }))
              );
            }

            if (Array.isArray(consentList) && consentList.length > 0) {
              setConsentGrants(
                consentList.map((c: any) => ({
                  id: c.id,
                  supplierId: c.supplierId || profile?.id || '',
                  organizationId: c.organizationId,
                  organizationName: c.organizationName || 'Buying Entity',
                  grantedAt: c.grantedAt || '',
                  validUntil: c.validUntil || '',
                  status: c.status === 'revoked' ? 'Revoked' : 'Active',
                  scope: c.scope || {
                    profile: true,
                    directors: true,
                    financials: true,
                    taxClearance: true,
                    certifications: true,
                  },
                  accessedCount: c.accessedCount || 0,
                  lastAccessedAt: c.lastAccessedAt,
                }))
              );
            }

            const mappedDirectors = Array.isArray(peopleList)
              ? peopleList.map((p: any) => ({
                  id: p.id,
                  fullName: p.fullName,
                  nationalIdOrPassport: p.nationalIdOrPassport || p.identityNumber || '',
                  nationality: p.nationality || 'Motswana',
                  isCitizen: p.isCitizen !== false,
                  shareholdingPercentage: Number(p.ownershipPercent || p.shareholdingPercentage || 0),
                  role: p.personRole || p.role || 'Director',
                }))
              : [];

            if (profile) {
              const builtSupplier: Supplier = {
                id: profile.id,
                legalName: profile.legalName,
                tradingName: profile.tradingName || profile.legalName,
                cipaNumber: profile.cipaUin || '',
                tinNumber: profile.bursTin || '',
                ppraCode: profile.ppraRegistrationNo || '',
                ppraSubcodes: [],
                ppraGrade: '',
                category: profile.category || '',
                secondaryCategories: [],
                categories: profile.categories || [],
                physicalAddress: profile.physicalAddress || '',
                city: profile.city || '',
                district: profile.districtName || profile.districtId || '',
                postalAddress: profile.postalAddress || '',
                primaryPhone: profile.primaryPhone || '',
                email: profile.email || '',
                website: profile.website || '',
                yearEstablished: profile.yearEstablished || new Date().getFullYear(),
                citizenOwnedPercentage: profile.citizenOwnedPercentage
                  ? Number(profile.citizenOwnedPercentage)
                  : 0,
                citizenOwnershipSet:
                  profile.citizenOwnedPercentage !== null &&
                  profile.citizenOwnedPercentage !== undefined,
                youthOwned: profile.youthOwned || false,
                womenOwned: profile.womenOwned || false,
                disabilityOwned: profile.disabilityOwned || false,
                eddCertified: profile.eddCertified || false,
                bankName: profile.bankName || '',
                bankBranch: profile.bankBranch || '',
                accountNumberMasked: profile.accountNumberMasked || profile.bankAccountNumber || '',
                hasTradingLicence: profile.hasTradingLicence ?? false,
                tradingLicenceReason: profile.tradingLicenceReason || '',
                detailsSaved: true,
                companyType: profile.companyType || 'private_company',
                description: profile.description || '',
                districtId: profile.districtId || null,
                directors: mappedDirectors,
                profileCompleteness: profile.profileCompleteness !== undefined ? Number(profile.profileCompleteness) : 0,
                missingItems: [],
                complianceStatus: profile.complianceStatus || 'Action required',
                documents: mappedDocs,
                hasCipa: mappedDocs.some((d) => d.documentType.toLowerCase().includes('cipa')),
                hasBurs: mappedDocs.some((d) => d.documentType.toLowerCase().includes('tax')),
                hasPpra: mappedDocs.some((d) => d.documentType.toLowerCase().includes('ppra')),
                isDemoAccount: false,
              };

              const completeness = calculateSupplierCompleteness(builtSupplier, mappedDocs);
              builtSupplier.profileCompleteness = completeness.score;
              builtSupplier.missingItems = completeness.missingItems.map((m) => m.label);
              builtSupplier.complianceStatus = (builtSupplier.profileCompleteness >= 80 ? 'Fully compliant' : 'Action required');

              // If database completeness does not match what is calculated in the app, update database immediately
              if (profile.profileCompleteness !== completeness.score) {
                supplierApi.updateProfile({
                  profileCompleteness: completeness.score,
                  profile_completeness: completeness.score,
                  complianceStatus: builtSupplier.complianceStatus,
                  compliance_status: builtSupplier.complianceStatus,
                  missingItems: builtSupplier.missingItems,
                  missing_items: builtSupplier.missingItems,
                }).catch(() => {});
              }

              setSupplier(builtSupplier);
            }
          }
        } catch (err) {
          console.warn('[APP CONTEXT] Failed to load live supplier profile:', err);
        }
      }
    }

    loadSupplierProfile();
    return () => {
      isMounted = false;
    };
  }, [isAuthenticated, role]);

  // Whenever profile completeness changes in the application, update the database immediately
  const prevCompletenessRef = useRef<number | null>(null);
  useEffect(() => {
    if (!isAuthenticated || role !== 'supplier') return;
    const token = localStorage.getItem('bidready_token');
    if (!token || token.startsWith('demo_') || token === 'platform_admin_session_token') return;

    const completeness = calculateSupplierCompleteness(supplier, documents);
    const score = completeness.score;
    const missing = completeness.missingItems.map((m) => m.label);
    const compliance = score >= 80 ? 'Fully compliant' : 'Action required';

    if (score !== prevCompletenessRef.current) {
      prevCompletenessRef.current = score;
      supplierApi.updateProfile({
        profileCompleteness: score,
        profile_completeness: score,
        complianceStatus: compliance,
        compliance_status: compliance,
        missingItems: missing,
        missing_items: missing,
      }).catch((err) => {
        console.warn('[DB COMPLETENESS AUTO-SYNC NOTICE]', err);
      });
    }
  }, [
    supplier.legalName,
    supplier.tradingName,
    supplier.tinNumber,
    supplier.physicalAddress,
    supplier.city,
    supplier.district,
    supplier.primaryPhone,
    supplier.email,
    supplier.bankName,
    supplier.bankBranch,
    supplier.accountNumberMasked,
    supplier.citizenOwnedPercentage,
    supplier.hasTradingLicence,
    supplier.directors,
    documents,
    isAuthenticated,
    role,
  ]);

  const [clarifications, setClarifications] = useState<Clarification[]>([]);
  const [consentGrants, setConsentGrants] = useState<ConsentGrant[]>(() => {
    try {
      const saved = localStorage.getItem('bidready_supplier_consent_grants');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });
  const [criteria, setCriteria] = useState<Criterion[]>([]);
  const [scores, setScores] = useState<Score[]>([]);
  const [evaluators, setEvaluators] = useState<Evaluator[]>([]);
  const [awardDecision, setAwardDecision] = useState<AwardDecision>(DEFAULT_AWARD_DECISION);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>([]);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [formTemplates, setFormTemplates] = useState<FormTemplate[]>([]);

  // Real-time completeness result computed from current memory state
  const completenessResult = calculateSupplierCompleteness(supplier, documents);

  const loadDemoSupplier = () => {
    setSupplier({
      ...DEMO_SUPPLIER,
      pastProjects: DEMO_PAST_PROJECTS,
      teamMembers: DEMO_TEAM_MEMBERS,
      isDemoAccount: true,
      profileCompleteness: 100,
      missingItems: [],
    });
    setDocuments(DEMO_DOCUMENTS);
    setApplications(DEMO_APPLICATIONS);
    setConsentGrants(DEMO_CONSENT_GRANTS);
  };

  const resetDemoData = () => {
    setSupplier({
      ...DEMO_SUPPLIER,
      pastProjects: DEMO_PAST_PROJECTS,
      teamMembers: DEMO_TEAM_MEMBERS,
      isDemoAccount: true,
      profileCompleteness: 100,
      missingItems: [],
    });
    setDocuments(DEMO_DOCUMENTS);
    setApplications(DEMO_APPLICATIONS);
    setConsentGrants(DEMO_CONSENT_GRANTS);
  };

  const autoCompleteProfile = () => {
    const updated: Supplier = {
      ...supplier,
      detailsSaved: true,
      profileCompleteness: 100,
      missingItems: [],
      complianceStatus: 'Fully compliant',
      directors: supplier.directors?.length ? supplier.directors : [{
        id: 'dir-1',
        fullName: 'Kagiso Molosiwa',
        nationalIdOrPassport: '123456789',
        nationality: 'Botswana',
        isCitizen: true,
        shareholdingPercentage: 100,
        role: 'Managing Director'
      }]
    };
    setSupplier(updated);
    saveSupplierToStorage(updated);
  };

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

  const addAuditEvent = (event: Omit<AuditEvent, 'id' | 'timestamp'>) => {
    const newEvent: AuditEvent = {
      ...event,
      id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
    };
    setAuditEvents((prev) => [newEvent, ...prev]);
  };

  const updateSupplierProfile = async (updates: Partial<Supplier>) => {
    // 1. Immediately compute the synchronous merged supplier object
    const nextMerged: Supplier = { ...supplier, ...updates };
    const completeness = calculateSupplierCompleteness(nextMerged, documents);
    const computedCompleteness = completeness.score;
    const computedMissing = completeness.missingItems.map((m) => m.label);

    nextMerged.profileCompleteness = computedCompleteness;
    nextMerged.missingItems = computedMissing;
    if (computedCompleteness >= 80) {
      nextMerged.complianceStatus = 'Fully compliant';
    } else {
      nextMerged.complianceStatus = 'Action required';
    }

    saveSupplierToStorage(nextMerged);
    setSupplier(nextMerged);

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
            saveSupplierToStorage(reMerged);
            return reMerged;
          });
        }
      } catch (err) {
        console.warn('[APP CONTEXT] Server database profile update notice:', err);
      }
    }

    addAuditEvent({
      actorName: supplier.directors[0]?.fullName || 'Supplier Admin',
      actorRole: 'Supplier',
      organizationName: supplier.legalName,
      action: 'Updated Company Profile',
      entityType: 'Document',
      entityId: supplier.id,
      details: 'Modified general registration and corporate profile fields.',
    });
  };

  const uploadDocument = (docData: any) => {
    const newDoc: SupplierDocument = {
      ...docData,
      id: docData.id || `doc-${Date.now()}`,
    };
    const nextDocs = [newDoc, ...documents];
    setDocuments(nextDocs);
    saveDocumentsToStorage(nextDocs);
    let nextCompleteness = 0;
    setSupplier((prev) => {
      const completeness = calculateSupplierCompleteness(prev, nextDocs);
      nextCompleteness = completeness.score;
      const nextSup = {
        ...prev,
        documents: nextDocs,
        profileCompleteness: completeness.score,
        missingItems: completeness.missingItems.map((m) => m.label),
        complianceStatus: (completeness.score >= 80 ? 'Fully compliant' : 'Action required') as 'Fully compliant' | 'Action required',
      };
      saveSupplierToStorage(nextSup);
      return nextSup;
    });

    // Also update server completeness
    const token = localStorage.getItem('bidready_token');
    if (token) {
      supplierApi.updateProfile({
        profileCompleteness: nextCompleteness,
        profile_completeness: nextCompleteness,
        complianceStatus: nextCompleteness >= 80 ? 'Fully compliant' : 'Action required',
        compliance_status: nextCompleteness >= 80 ? 'Fully compliant' : 'Action required',
      }).catch(() => {});
    }

    addAuditEvent({
      actorName: supplier.directors[0]?.fullName || 'Supplier Admin',
      actorRole: 'Supplier',
      organizationName: supplier.legalName,
      action: 'Uploaded Document to Vault',
      entityType: 'Document',
      entityId: newDoc.id,
      details: `Uploaded ${newDoc.documentType} (Exp: ${newDoc.expiryDate}).`,
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
          fileFingerprint: `SHA-256: ${Math.random().toString(36).substring(2, 8)}...${Math.random().toString(36).substring(2, 6)}`,
          fileName: updates.fileName || d.fileName,
          fileSize: updates.fileSize || d.fileSize || '1.6 MB',
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
    saveDocumentsToStorage(nextDocs);
    let nextCompleteness = 0;
    setSupplier((prev) => {
      const completeness = calculateSupplierCompleteness(prev, nextDocs);
      nextCompleteness = completeness.score;
      const nextSup = {
        ...prev,
        documents: nextDocs,
        profileCompleteness: completeness.score,
        missingItems: completeness.missingItems.map((m) => m.label),
        complianceStatus: (completeness.score >= 80 ? 'Fully compliant' : 'Action required') as 'Fully compliant' | 'Action required',
      };
      saveSupplierToStorage(nextSup);
      return nextSup;
    });

    const token = localStorage.getItem('bidready_token');
    if (token) {
      supplierApi.updateProfile({
        profileCompleteness: nextCompleteness,
        profile_completeness: nextCompleteness,
        complianceStatus: nextCompleteness >= 80 ? 'Fully compliant' : 'Action required',
        compliance_status: nextCompleteness >= 80 ? 'Fully compliant' : 'Action required',
      }).catch(() => {});
    }

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
    saveDocumentsToStorage(nextDocs);
    let nextCompleteness = 0;
    setSupplier((prev) => {
      const completeness = calculateSupplierCompleteness(prev, nextDocs);
      nextCompleteness = completeness.score;
      const nextSup = {
        ...prev,
        documents: nextDocs,
        profileCompleteness: completeness.score,
        missingItems: completeness.missingItems.map((m) => m.label),
        complianceStatus: (completeness.score >= 80 ? 'Fully compliant' : 'Action required') as 'Fully compliant' | 'Action required',
      };
      saveSupplierToStorage(nextSup);
      return nextSup;
    });

    const token = localStorage.getItem('bidready_token');
    if (token) {
      supplierApi.deleteDocument(docId).catch(() => {});
      supplierApi.updateProfile({
        profileCompleteness: nextCompleteness,
        profile_completeness: nextCompleteness,
        complianceStatus: nextCompleteness >= 80 ? 'Fully compliant' : 'Action required',
        compliance_status: nextCompleteness >= 80 ? 'Fully compliant' : 'Action required',
      }).catch(() => {});
    }
  };

  const grantConsent = (newGrant: Omit<ConsentGrant, 'id' | 'grantedAt' | 'status'>) => {
    const grant: ConsentGrant = {
      ...newGrant,
      id: `cg-${Date.now()}`,
      grantedAt: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
      status: 'Active',
    };
    setConsentGrants((prev) => {
      const nextGrants = [grant, ...prev];
      saveConsentGrantsToStorage(nextGrants);
      return nextGrants;
    });
    addAuditEvent({
      actorName: supplier.directors[0]?.fullName || supplier.teamMembers?.[0]?.name || supplier.legalName || 'Supplier Admin',
      actorRole: 'Supplier',
      organizationName: supplier.legalName,
      action: 'Granted Data Sharing Access',
      entityType: 'Consent',
      entityId: grant.id,
      details: `Authorized ${grant.organizationName} to inspect selected compliance credentials. Saved to database & local store.`,
    });
  };

  const revokeConsent = (grantId: string) => {
    const grant = consentGrants.find((g) => g.id === grantId);
    setConsentGrants((prev) => {
      const nextGrants = prev.map((g) => (g.id === grantId ? { ...g, status: 'Revoked' as const } : g));
      saveConsentGrantsToStorage(nextGrants);
      return nextGrants;
    });

    addAuditEvent({
      actorName: supplier.directors[0]?.fullName || supplier.teamMembers?.[0]?.name || supplier.legalName || 'Supplier Admin',
      actorRole: 'Supplier',
      organizationName: supplier.legalName,
      action: 'Revoked Data Sharing Consent',
      entityType: 'Consent',
      entityId: grantId,
      details: `Revoked profile and document access for ${grant?.organizationName || 'buying organization'}. Saved to database & local store.`,
    });
  };

  const updateConsentScope = (grantId: string, scopeKey: keyof ConsentGrant['scope'], allowed: boolean) => {
    setConsentGrants((prev) => {
      const nextGrants = prev.map((g) => {
        if (g.id === grantId) {
          return {
            ...g,
            scope: { ...g.scope, [scopeKey]: allowed },
          };
        }
        return g;
      });
      saveConsentGrantsToStorage(nextGrants);
      return nextGrants;
    });
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
        saveApplicationsToStorage(nextApps);
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
        const nextApps = [newDraftApp, ...prev];
        saveApplicationsToStorage(nextApps);
        return nextApps;
      }
    });

    try {
      localStorage.setItem(
        `bidready_draft_tender_${supplier.id}_${draftData.callId}`,
        JSON.stringify({
          ...draftData,
          savedAt: now,
        })
      );
    } catch {}

    return targetAppId;
  };

  const deleteApplicationDraft = (appId: string) => {
    setApplications((prev) => {
      const target = prev.find((a) => a.id === appId);
      const nextApps = prev.filter((a) => a.id !== appId);
      saveApplicationsToStorage(nextApps);
      if (target) {
        try {
          localStorage.removeItem(`bidready_draft_tender_${supplier.id}_${target.callId}`);
          localStorage.removeItem(`bidready_draft_bid_${supplier.id}_${target.callId}`);
        } catch {}
      }
      return nextApps;
    });
  };

  const submitApplication = (appData: Omit<Application, 'id' | 'submittedAt' | 'timeline'> & { initialTimelineNote?: string }): string => {
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
        saveApplicationsToStorage(nextApps);
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

      const nextApps = [newApp, ...prev];
      saveApplicationsToStorage(nextApps);
      return nextApps;
    });

    try {
      localStorage.removeItem(`bidready_draft_tender_${appData.supplierId}_${appData.callId}`);
      localStorage.removeItem(`bidready_draft_bid_${appData.supplierId}_${appData.callId}`);
    } catch {}

    const appId = assignedAppId || `app-${Date.now()}`;

    // Update Call application count
    setCalls((prev) =>
      prev.map((c) => (c.id === appData.callId ? { ...c, applicationsCount: c.applicationsCount + 1 } : c))
    );

    // Auto add / update consent grant
    const existingGrant = consentGrants.find((g) => g.organizationId === appData.organizationId);
    if (!existingGrant) {
      const newGrant: ConsentGrant = {
        id: `cg-${Date.now()}`,
        supplierId: supplier.id,
        organizationId: appData.organizationId,
        organizationName: appData.organizationName,
        grantedAt: now,
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
        tiedApplicationNumbers: [appData.callNumber],
      };
      setConsentGrants((prev) => {
        const nextGrants = [newGrant, ...prev];
        saveConsentGrantsToStorage(nextGrants);
        return nextGrants;
      });
    }

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
    if (token) {
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

  const updateApplicationStatus = (appId: string, status: Application['status'], reason?: string, reviewer = 'K. Tau (Lead Procurement Officer)') => {
    const now = new Date().toISOString().replace('T', ' ').substring(0, 16);
    setApplications((prev) =>
      prev.map((app) => {
        if (app.id === appId) {
          return {
            ...app,
            status,
            statusReason: reason,
            reviewedBy: reviewer,
            reviewedAt: now,
            timeline: [
              ...app.timeline,
              {
                stage: status,
                timestamp: now,
                note: reason || `Status updated to ${status} by ${reviewer}.`,
              },
            ],
          };
        }
        return app;
      })
    );

    addAuditEvent({
      actorName: reviewer,
      actorRole: 'Procurement Officer',
      organizationName: 'Gaborone Regional Council',
      action: `Updated Application Status to ${status}`,
      entityType: 'Application',
      entityId: appId,
      details: reason || `Processed application for evaluation stage.`,
    });
  };

  const withdrawApplication = (appId: string, reason?: string) => {
    const targetApp = applications.find((a) => a.id === appId);
    const now = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    setApplications((prev) =>
      prev.map((app) => {
        if (app.id === appId) {
          return {
            ...app,
            status: 'Withdrawn',
            statusReason: reason || 'Application withdrawn by supplier prior to award.',
            withdrawnAt: now,
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

    addAuditEvent({
      actorName: supplier.directors[0]?.fullName || supplier.teamMembers?.[0]?.name || supplier.legalName || 'Supplier Admin',
      actorRole: 'Supplier',
      organizationName: supplier.legalName,
      action: 'Withdrew Tender Application',
      entityType: 'Application',
      entityId: appId,
      details: `Withdrew submission for ${targetApp?.callNumber || appId}: ${targetApp?.callTitle || ''}.`,
    });
  };

  const respondToInformationRequest = (appId: string, responseMessage: string) => {
    const targetApp = applications.find((a) => a.id === appId);
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

    addAuditEvent({
      actorName: respondent,
      actorRole: 'Supplier',
      organizationName: supplier.legalName,
      action: 'Responded to Information Request',
      entityType: 'Application',
      entityId: appId,
      details: `Submitted requested information for ${targetApp?.callNumber || appId}: "${responseMessage}".`,
    });
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
      organizationName: 'Gaborone Regional Council',
      action: 'Published Official Clarification Answer',
      entityType: 'Call',
      entityId: clarId,
      details: `Published public clarification response for all prospective bidders.`,
    });
  };

  const createCall = (newCallData: Omit<Call, 'id' | 'documentsCount' | 'applicationsCount' | 'addenda'>): string => {
    const newId = `call-${Date.now()}`;
    const newCall: Call = {
      ...newCallData,
      id: newId,
      documentsCount: newCallData.requiredDocumentTypes.length,
      applicationsCount: 0,
      addenda: [],
    };
    setCalls((prev) => [newCall, ...prev]);

    addAuditEvent({
      actorName: 'K. Tau (Lead Procurement Specialist)',
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
      actorName: 'K. Tau',
      actorRole: 'Procurement Officer',
      organizationName: 'Gaborone Regional Council',
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
      organizationName: 'Gaborone Regional Council',
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
      actorName: evaluators.find((e) => e.id === evaluatorId)?.name || 'Evaluator',
      actorRole: 'Evaluator',
      organizationName: 'Gaborone Regional Council',
      action: 'Signed Conflict of Interest Declaration',
      entityType: 'Evaluation',
      entityId: evaluatorId,
      details: 'Completed mandatory statutory declaration before opening scoring matrix.',
    });
  };

  const updateAwardDecision = (updates: Partial<AwardDecision>) => {
    const now = new Date().toISOString().replace('T', ' ').substring(0, 16);
    setAwardDecision((prev) => ({
      ...prev,
      ...updates,
      approvedAt: updates.status === 'Approved & Published' ? now : prev.approvedAt,
      approvedBy: updates.status === 'Approved & Published' ? 'Town Clerk / Head of Tender Board' : prev.approvedBy,
    }));

    addAuditEvent({
      actorName: updates.status === 'Approved & Published' ? 'Town Clerk / Head of Tender Board' : 'K. Tau (Lead Procurement Specialist)',
      actorRole: updates.status === 'Approved & Published' ? 'Approver' : 'Procurement Officer',
      organizationName: 'Gaborone Regional Council',
      action: updates.status === 'Approved & Published' ? 'Approved and Published Contract Award' : 'Updated Draft Award Recommendation',
      entityType: 'Award',
      entityId: awardDecision.id,
      details: `Award recommendation updated to ${updates.status}. Amount: BWP ${updates.awardedAmountBWP?.toLocaleString() || awardDecision.awardedAmountBWP.toLocaleString()}.`,
    });
  };

  const markNotificationRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
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
        registeredBuyerOrgName,
        registeredBuyerEmail,
        registerBuyerOrganization,
        approveBuyerOrg,
        rejectBuyerOrg,
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
        addAuditEvent,
        loadDemoSupplier,
        resetDemoData,
        autoCompleteProfile,
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
