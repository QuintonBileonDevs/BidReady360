import React, { createContext, useContext, useState, useEffect } from 'react';
import {
  Supplier,
  SupplierDocument,
  Organization,
  Call,
  Application,
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
import { Language, TRANSLATIONS } from '../translations';
import { ApiUser, authApi, callsApi, supplierApi, buyerApi } from '../services/api';
import { calculateSupplierCompleteness, SupplierCompletenessResult } from '../utils/supplierOnboarding';
import {
  DEMO_SUPPLIER,
  DEMO_DOCUMENTS,
  DEMO_APPLICATIONS,
  DEMO_CONSENT_GRANTS,
  DEMO_PAST_PROJECTS,
  DEMO_TEAM_MEMBERS,
} from '../data/demoSupplierData';

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
  loginSuccess: (session: { user: ApiUser; activeTenant?: any; token?: string }, targetRole?: UserRole) => void;
  logout: () => Promise<void>;
  
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
  updateSupplierProfile: (updates: Partial<Supplier>) => void;
  uploadDocument: (doc: Omit<SupplierDocument, 'id'>) => void;
  replaceDocument: (docId: string, updates: Partial<SupplierDocument>) => void;
  deleteDocument: (docId: string) => void;
  grantConsent: (newGrant: Omit<ConsentGrant, 'id' | 'grantedAt' | 'status'>) => void;
  revokeConsent: (grantId: string) => void;
  updateConsentScope: (grantId: string, scopeKey: keyof ConsentGrant['scope'], allowed: boolean) => void;
  submitApplication: (applicationData: Omit<Application, 'id' | 'submittedAt' | 'timeline'> & { initialTimelineNote?: string }) => string;
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
  completenessResult: SupplierCompletenessResult;
}

const AppContext = createContext<AppContextType | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [role, setRoleState] = useState<UserRole>('public');
  const [buyerSubRole, setBuyerSubRole] = useState<BuyerSubRole>('Procurement officer');
  const [currentOrgSlug, setCurrentOrgSlug] = useState<string>('org-grc');
  const [language, setLanguage] = useState<Language>('en');
  const [theme, setThemeState] = useState<ThemeMode>('light');
  const [activeNav, setActiveNavState] = useState<string>('about');
  const [selectedCallId, setSelectedCallId] = useState<string | null>(null);
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);

  // Authentication & Security State
  const [currentUser, setCurrentUser] = useState<ApiUser | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [intendedRoute, setIntendedRoute] = useState<string | null>(null);

  // Restore authenticated session on startup
  useEffect(() => {
    let isMounted = true;
    async function restoreSession() {
      const token = localStorage.getItem('bidready_token');
      if (!token) {
        if (isMounted) {
          setIsAuthenticated(false);
          setCurrentUser(null);
          setAuthLoading(false);
        }
        return;
      }

      try {
        const session = await authApi.getMe();
        if (session && session.user && isMounted) {
          setCurrentUser(session.user);
          setIsAuthenticated(true);
          if (session.user.isPlatformAdmin) {
            setRoleState('admin');
          } else if (session.activeTenant?.tenantType === 'organization') {
            setRoleState('buyer');
            setBuyerOrgStatus('Approved');
            setRegisteredBuyerOrgName(session.activeTenant.tenantName);
            setRegisteredBuyerEmail(session.user.email);
          } else if (session.activeTenant?.tenantType === 'supplier') {
            setRoleState('supplier');
            try {
              const remoteProfile = await supplierApi.getProfile();
              if (remoteProfile) {
                updateSupplierProfile({
                  id: session.activeTenant.tenantId,
                  legalName: remoteProfile.legalName || session.activeTenant.tenantName,
                  tradingName: remoteProfile.tradingName || session.activeTenant.tenantName,
                  email: remoteProfile.email || session.user.email,
                  ...(remoteProfile.cipaNumber || remoteProfile.cipaUin ? { cipaNumber: remoteProfile.cipaNumber || remoteProfile.cipaUin } : {}),
                  ...(remoteProfile.tinNumber || remoteProfile.bursTin ? { tinNumber: remoteProfile.tinNumber || remoteProfile.bursTin } : {}),
                  ...(remoteProfile.ppraCode || remoteProfile.ppraRegistrationNo ? { ppraCode: remoteProfile.ppraCode || remoteProfile.ppraRegistrationNo } : {}),
                  ...(remoteProfile.physicalAddress ? { physicalAddress: remoteProfile.physicalAddress } : {}),
                  ...(remoteProfile.city ? { city: remoteProfile.city } : {}),
                  ...(remoteProfile.districtName || remoteProfile.districtId ? { district: remoteProfile.districtName || remoteProfile.districtId } : {}),
                  ...(remoteProfile.postalAddress ? { postalAddress: remoteProfile.postalAddress } : {}),
                  ...(remoteProfile.primaryPhone ? { primaryPhone: remoteProfile.primaryPhone } : {}),
                  ...(remoteProfile.bankName ? { bankName: remoteProfile.bankName } : {}),
                  ...(remoteProfile.bankBranch ? { bankBranch: remoteProfile.bankBranch } : {}),
                  ...(remoteProfile.accountNumberMasked ? { accountNumberMasked: remoteProfile.accountNumberMasked } : {}),
                  ...(remoteProfile.companyType ? { companyType: remoteProfile.companyType } : {}),
                  ...(remoteProfile.description ? { description: remoteProfile.description } : {}),
                  ...(remoteProfile.yearEstablished ? { yearEstablished: Number(remoteProfile.yearEstablished) } : {}),
                  ...(remoteProfile.citizenOwnedPercentage !== undefined && remoteProfile.citizenOwnedPercentage !== null ? { citizenOwnedPercentage: Number(remoteProfile.citizenOwnedPercentage) } : {}),
                });
              }
            } catch {
              // Maintain local state if offline or endpoint fails
            }
          }
        } else if (isMounted) {
          localStorage.removeItem('bidready_token');
          setIsAuthenticated(false);
          setCurrentUser(null);
        }
      } catch {
        if (isMounted) {
          localStorage.removeItem('bidready_token');
          setIsAuthenticated(false);
          setCurrentUser(null);
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
      localStorage.setItem('bidready_token', session.token);
    }
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
      updateSupplierProfile({
        id: session.activeTenant.tenantId,
        legalName: session.activeTenant.tenantName,
        tradingName: session.activeTenant.tenantName,
        email: session.user.email,
      });
    }

    setRoleState(resolvedRole);

    if (intendedRoute) {
      const destination = intendedRoute;
      setIntendedRoute(null);
      setActiveNavState(destination);
    } else {
      setActiveNavState(resolvedRole === 'admin' ? 'admin-dashboard' : 'dashboard');
    }

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

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      // Ignore
    }
    localStorage.removeItem('bidready_token');
    setCurrentUser(null);
    setIsAuthenticated(false);
    setRoleState('public');
    setActiveNavState('about');
    setIntendedRoute(null);

    addAuditEvent({
      actorName: currentUser?.fullName || 'Active User',
      actorRole: role === 'supplier' ? 'Supplier' : role === 'buyer' ? 'Procurement Officer' : role === 'admin' ? 'Super Admin' : 'System',
      organizationName: 'BidReady360 Platform',
      action: 'Session Terminated (Logout)',
      entityType: role === 'buyer' ? 'Organization' : 'Supplier',
      entityId: currentUser?.id || 'anon',
      details: 'User logged out and security session invalidated.',
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

  // Dynamic data states with localStorage initialization
  const [supplier, setSupplier] = useState<Supplier>(() => {
    try {
      const saved = localStorage.getItem('bidready_supplier_profile');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && parsed.id) return parsed;
      }
    } catch {}
    return EMPTY_SUPPLIER;
  });
  const [allSuppliers] = useState<Supplier[]>([EMPTY_SUPPLIER]);
  const [documents, setDocuments] = useState<SupplierDocument[]>(() => {
    try {
      const saved = localStorage.getItem('bidready_supplier_documents');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });
  const [organizations] = useState<Organization[]>([]);
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
                directors: mappedDirectors,
                profileCompleteness: 0,
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
    if (targetNav) {
      setActiveNavState(targetNav);
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
  };

  const addAuditEvent = (event: Omit<AuditEvent, 'id' | 'timestamp'>) => {
    const newEvent: AuditEvent = {
      ...event,
      id: `aud-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: new Date().toISOString().replace('T', ' ').substring(0, 19),
    };
    setAuditEvents((prev) => [newEvent, ...prev]);
  };

  const updateSupplierProfile = (updates: Partial<Supplier>) => {
    setSupplier((prev) => {
      const next = { ...prev, ...updates };
      const completeness = calculateSupplierCompleteness(next, documents);
      next.profileCompleteness = completeness.score;
      next.missingItems = completeness.missingItems.map((m) => m.label);
      saveSupplierToStorage(next);
      return next;
    });

    const token = localStorage.getItem('bidready_token');
    if (token) {
      supplierApi.updateProfile(updates).catch((err) => {
        console.warn('[APP CONTEXT] Server database profile update notice:', err);
      });
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

  const uploadDocument = (docData: Omit<SupplierDocument, 'id'>) => {
    const newDoc: SupplierDocument = {
      ...docData,
      id: `doc-${Date.now()}`,
    };
    const nextDocs = [newDoc, ...documents];
    setDocuments(nextDocs);
    saveDocumentsToStorage(nextDocs);
    setSupplier((prev) => {
      const completeness = calculateSupplierCompleteness(prev, nextDocs);
      const nextSup = {
        ...prev,
        documents: nextDocs,
        profileCompleteness: completeness.score,
        missingItems: completeness.missingItems.map((m) => m.label),
      };
      saveSupplierToStorage(nextSup);
      return nextSup;
    });

    addAuditEvent({
      actorName: supplier.directors[0]?.fullName || 'Supplier Admin',
      actorRole: 'Supplier',
      organizationName: supplier.legalName,
      action: 'Uploaded Document to Vault',
      entityType: 'Document',
      entityId: newDoc.id,
      details: `Uploaded ${newDoc.documentType} (Exp: ${newDoc.expiryDate}).`,
    });

    const token = localStorage.getItem('bidready_token');
    if (token) {
      supplierApi.uploadDocument({
        documentTypeCode: docData.documentType,
        fileName: docData.fileName,
        mimeType: 'application/pdf',
        fileBase64: 'SGVsbG8gV29ybGQ=',
        documentNumber: docData.documentNumber,
        issueDate: docData.issueDate,
        expiryDate: docData.expiryDate,
        title: docData.title || docData.documentType,
      }).catch((err) => {
        console.warn('[APP CONTEXT] Server document upload sync notice:', err);
      });
    }
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
    setSupplier((prev) => {
      const completeness = calculateSupplierCompleteness(prev, nextDocs);
      const nextSup = {
        ...prev,
        documents: nextDocs,
        profileCompleteness: completeness.score,
        missingItems: completeness.missingItems.map((m) => m.label),
      };
      saveSupplierToStorage(nextSup);
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
    saveDocumentsToStorage(nextDocs);
    setSupplier((prev) => {
      const completeness = calculateSupplierCompleteness(prev, nextDocs);
      const nextSup = {
        ...prev,
        documents: nextDocs,
        profileCompleteness: completeness.score,
        missingItems: completeness.missingItems.map((m) => m.label),
      };
      saveSupplierToStorage(nextSup);
      return nextSup;
    });
  };

  const grantConsent = (newGrant: Omit<ConsentGrant, 'id' | 'grantedAt' | 'status'>) => {
    const grant: ConsentGrant = {
      ...newGrant,
      id: `cg-${Date.now()}`,
      grantedAt: '6 Oct 2026',
      status: 'Active',
    };
    setConsentGrants((prev) => [grant, ...prev]);
    addAuditEvent({
      actorName: supplier.directors[0]?.fullName || supplier.teamMembers?.[0]?.name || supplier.legalName || 'Supplier Admin',
      actorRole: 'Supplier',
      organizationName: supplier.legalName,
      action: 'Granted Data Sharing Access',
      entityType: 'Consent',
      entityId: grant.id,
      details: `Authorized ${grant.organizationName} to inspect selected compliance credentials.`,
    });
  };

  const revokeConsent = (grantId: string) => {
    const grant = consentGrants.find((g) => g.id === grantId);
    setConsentGrants((prev) =>
      prev.map((g) => (g.id === grantId ? { ...g, status: 'Revoked' } : g))
    );

    addAuditEvent({
      actorName: supplier.directors[0]?.fullName || supplier.teamMembers?.[0]?.name || supplier.legalName || 'Supplier Admin',
      actorRole: 'Supplier',
      organizationName: supplier.legalName,
      action: 'Revoked Data Sharing Consent',
      entityType: 'Consent',
      entityId: grantId,
      details: `Revoked profile and document access for ${grant?.organizationName || 'buying organization'}.`,
    });
  };

  const updateConsentScope = (grantId: string, scopeKey: keyof ConsentGrant['scope'], allowed: boolean) => {
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

  const submitApplication = (appData: Omit<Application, 'id' | 'submittedAt' | 'timeline'> & { initialTimelineNote?: string }): string => {
    const appId = `app-${Date.now()}`;
    const now = new Date().toISOString().replace('T', ' ').substring(0, 16);

    const newApp: Application = {
      id: appId,
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

    setApplications((prev) => {
      const nextApps = [newApp, ...prev];
      saveApplicationsToStorage(nextApps);
      return nextApps;
    });

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
      setConsentGrants((prev) => [newGrant, ...prev]);
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
        completenessResult,
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
