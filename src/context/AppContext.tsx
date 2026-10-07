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
  CURRENT_SUPPLIER,
  CURRENT_SUPPLIER_DOCUMENTS,
  INITIAL_ORGANIZATIONS,
  INITIAL_CALLS,
  INITIAL_APPLICATIONS,
  INITIAL_CLARIFICATIONS,
  INITIAL_CONSENT_GRANTS,
  INITIAL_CRITERIA,
  INITIAL_EVALUATORS,
  INITIAL_SCORES,
  INITIAL_AWARD_DECISION,
  INITIAL_AUDIT_EVENTS,
  INITIAL_NOTIFICATIONS,
  INITIAL_FORM_TEMPLATES,
  OTHER_SUPPLIERS,
} from '../mockData';
import { Language, TRANSLATIONS } from '../translations';

export type UserRole = 'public' | 'supplier' | 'buyer' | 'admin';
export type BuyerSubRole = 'Org admin' | 'Procurement officer' | 'Evaluator' | 'Approver' | 'Auditor';
export type ThemeMode = 'light' | 'dark';

interface AppContextType {
  role: UserRole;
  setRole: (role: UserRole) => void;
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

  // Buyer Verification State
  const [buyerOrgStatus, setBuyerOrgStatus] = useState<'Pending' | 'Approved' | 'Rejected'>('Approved');
  const [registeredBuyerOrgName, setRegisteredBuyerOrgName] = useState<string | null>('Gaborone Regional Council');
  const [registeredBuyerEmail, setRegisteredBuyerEmail] = useState<string | null>('k.tau@grc.gov.bw');

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

  // In-memory data states
  const [supplier, setSupplier] = useState<Supplier>(CURRENT_SUPPLIER);
  const [documents, setDocuments] = useState<SupplierDocument[]>(CURRENT_SUPPLIER_DOCUMENTS);
  const [organizations] = useState<Organization[]>(INITIAL_ORGANIZATIONS);
  const [calls, setCalls] = useState<Call[]>(INITIAL_CALLS);
  const [applications, setApplications] = useState<Application[]>(INITIAL_APPLICATIONS);
  const [clarifications, setClarifications] = useState<Clarification[]>(INITIAL_CLARIFICATIONS);
  const [consentGrants, setConsentGrants] = useState<ConsentGrant[]>(INITIAL_CONSENT_GRANTS);
  const [criteria, setCriteria] = useState<Criterion[]>(INITIAL_CRITERIA);
  const [scores, setScores] = useState<Score[]>(INITIAL_SCORES);
  const [evaluators, setEvaluators] = useState<Evaluator[]>(INITIAL_EVALUATORS);
  const [awardDecision, setAwardDecision] = useState<AwardDecision>(INITIAL_AWARD_DECISION);
  const [auditEvents, setAuditEvents] = useState<AuditEvent[]>(INITIAL_AUDIT_EVENTS);
  const [notifications, setNotifications] = useState<NotificationItem[]>(INITIAL_NOTIFICATIONS);
  const [formTemplates, setFormTemplates] = useState<FormTemplate[]>(INITIAL_FORM_TEMPLATES);

  const t = (key: string): string => {
    return TRANSLATIONS[language]?.[key] || key;
  };

  const setRole = (newRole: UserRole) => {
    setRoleState(newRole);
    if (newRole === 'public') {
      setActiveNavState('about');
    } else if (newRole === 'supplier') {
      setActiveNavState('dashboard');
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
      // Recalculate completeness
      let score = 70;
      if (next.directors.length > 0) score += 10;
      if (next.bankName && next.bankBranch) score += 10;
      if (documents.some((d) => d.status === 'Verified')) score += 10;
      const missing: string[] = [];
      if (documents.some((d) => d.status === 'Expired')) {
        missing.push('One or more compliance certificates in vault are expired');
        score = Math.max(score - 15, 60);
      }
      next.profileCompleteness = Math.min(100, score);
      next.missingItems = missing;
      return next;
    });

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
    setDocuments((prev) => [newDoc, ...prev]);
    setSupplier((prev) => ({
      ...prev,
      documents: [newDoc, ...prev.documents],
    }));

    addAuditEvent({
      actorName: supplier.directors[0]?.fullName || 'Kagiso Molosiwa',
      actorRole: 'Supplier',
      organizationName: supplier.legalName,
      action: 'Uploaded Document to Vault',
      entityType: 'Document',
      entityId: newDoc.id,
      details: `Uploaded ${newDoc.documentType} (Exp: ${newDoc.expiryDate}).`,
    });
  };

  const replaceDocument = (docId: string, updates: Partial<SupplierDocument>) => {
    setDocuments((prev) =>
      prev.map((d) => {
        if (d.id === docId) {
          const currentVersions = d.versionHistory || [];
          const nextVersionNumber = currentVersions.length + 1;
          const newVersionEntry = {
            version: nextVersionNumber,
            uploadedBy: 'Kagiso Molosiwa (Supplier admin)',
            uploadedAt: new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) + ', ' + new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
            fileFingerprint: `SHA-256: ${Math.random().toString(36).substring(2, 8)}...${Math.random().toString(36).substring(2, 6)}`,
            fileName: updates.fileName || d.fileName,
            fileSize: updates.fileSize || d.fileSize || '1.6 MB',
            usedInApplications: [],
          };
          return {
            ...d,
            ...updates,
            status: updates.status || 'Pending',
            statusMessage: updates.statusMessage || 'Pending verification by procurement registry officers.',
            versionHistory: [...currentVersions, newVersionEntry],
          };
        }
        return d;
      })
    );
    setSupplier((prev) => ({
      ...prev,
      documents: prev.documents.map((d) =>
        d.id === docId ? { ...d, ...updates, status: updates.status || 'Pending' } : d
      ),
    }));

    addAuditEvent({
      actorName: supplier.directors[0]?.fullName || 'Kagiso Molosiwa',
      actorRole: 'Supplier',
      organizationName: supplier.legalName,
      action: 'Renewed & Replaced Vault Document',
      entityType: 'Document',
      entityId: docId,
      details: `Replaced compliance document with updated certificate version.`,
    });
  };

  const deleteDocument = (docId: string) => {
    setDocuments((prev) => prev.filter((d) => d.id !== docId));
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
      actorName: supplier.directors[0]?.fullName || 'Kagiso Molosiwa',
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
      actorName: supplier.directors[0]?.fullName || 'Kagiso Molosiwa',
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

    setApplications((prev) => [newApp, ...prev]);

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
      actorName: supplier.directors[0]?.fullName || 'Kagiso Molosiwa',
      actorRole: 'Supplier',
      organizationName: supplier.legalName,
      action: appData.callType === 'RFP' ? 'Submitted Sealed RFP Bid' : 'Submitted Registration / EOI Application',
      entityType: 'Application',
      entityId: appId,
      details: `Application for ${appData.callNumber} (${appData.callTitle}) submitted to ${appData.organizationName}.`,
    });

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
      actorName: supplier.directors[0]?.fullName || 'Kagiso Molosiwa',
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
    const respondent = supplier.directors[0]?.fullName ? `${supplier.directors[0].fullName} (Supplier)` : 'Kagiso Molosiwa (Supplier)';

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
      actorName: supplier.directors[0]?.fullName || 'Kagiso Molosiwa',
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

  const allSuppliers = [supplier, ...OTHER_SUPPLIERS];

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
