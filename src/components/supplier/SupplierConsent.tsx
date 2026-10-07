import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { ConsentGrant } from '../../mockData';
import { StatusChip } from '../common/StatusChip';
import {
  Building2,
  CheckCircle2,
  XCircle,
  Lock,
  Plus,
  X,
  Check,
  Info,
  Clock,
  Eye,
  AlertTriangle,
  Calendar,
  FileText,
  Users,
  Briefcase,
  Search,
} from 'lucide-react';

interface SharingActivityItem {
  id: string;
  organizationName: string;
  action: string;
  dateStr: string;
  timestamp: string;
  ipAddress: string;
}

export const SupplierConsent: React.FC = () => {
  const {
    consentGrants,
    revokeConsent,
    grantConsent,
    updateConsentScope,
    supplier,
    organizations,
    documents,
    applications,
    addAuditEvent,
  } = useApp();

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Drawers & Modals
  const [isShareDrawerOpen, setIsShareDrawerOpen] = useState(false);
  const [revokingGrant, setRevokingGrant] = useState<ConsentGrant | null>(null);

  // "Share with an organization" Drawer Form State
  const [selectedOrgId, setSelectedOrgId] = useState<string>(
    organizations[0]?.id || 'org-grc'
  );
  const [shareCompanyDetails, setShareCompanyDetails] = useState<boolean>(true);
  const [shareDirectorsOwners, setShareDirectorsOwners] = useState<boolean>(true);
  const [sharePastProjects, setSharePastProjects] = useState<boolean>(true);
  const [shareSelectedDocs, setShareSelectedDocs] = useState<boolean>(true);
  const [pickedDocNames, setPickedDocNames] = useState<string[]>([
    'BURS Tax Clearance Certificate',
    'PPRA Registration Certificate',
  ]);
  const [expiryDateInput, setExpiryDateInput] = useState<string>('2027-03-31');
  const [hasExpiryDate, setHasExpiryDate] = useState<boolean>(true);
  const [purposeLine, setPurposeLine] = useState<string>(
    'Vendor qualification and annual tender bidding accreditation'
  );

  // Activity list records (incorporating exact user specification)
  const [activitiesList] = useState<SharingActivityItem[]>([
    {
      id: 'act-1',
      organizationName: 'Okavango Regional Council',
      action: 'viewed your tax clearance',
      dateStr: '3 Oct 2026',
      timestamp: '3 Oct 2026, 14:15 CAT',
      ipAddress: '168.167.44.12',
    },
    {
      id: 'act-2',
      organizationName: 'Gaborone Regional Council',
      action: 'verified your PPRA registration',
      dateStr: '2 Oct 2026',
      timestamp: '2 Oct 2026, 11:30 CAT',
      ipAddress: '168.167.44.18',
    },
    {
      id: 'act-3',
      organizationName: 'National Training Agency',
      action: 'inspected your audited financial statements',
      dateStr: '28 Sep 2026',
      timestamp: '28 Sep 2026, 16:45 CAT',
      ipAddress: '168.167.44.05',
    },
    {
      id: 'act-4',
      organizationName: 'Botswana Housing Corporation',
      action: 'viewed your past projects',
      dateStr: '24 Sep 2026',
      timestamp: '24 Sep 2026, 10:20 CAT',
      ipAddress: '168.167.44.22',
    },
    {
      id: 'act-5',
      organizationName: 'Gaborone Regional Council',
      action: 'inspected your company details and directors',
      dateStr: '20 Sep 2026',
      timestamp: '20 Sep 2026, 09:15 CAT',
      ipAddress: '168.167.44.18',
    },
  ]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 5000);
  };

  // Open Share Drawer
  const handleOpenShareDrawer = () => {
    setSelectedOrgId(organizations[0]?.id || 'org-grc');
    setShareCompanyDetails(true);
    setShareDirectorsOwners(true);
    setSharePastProjects(true);
    setShareSelectedDocs(true);
    setPickedDocNames([
      'BURS Tax Clearance Certificate',
      'PPRA Registration Certificate',
    ]);
    setExpiryDateInput('2027-03-31');
    setHasExpiryDate(true);
    setPurposeLine('Vendor qualification and tender bidding accreditation');
    setIsShareDrawerOpen(true);
  };

  // Submit new grant from drawer
  const handleConfirmShare = (e: React.FormEvent) => {
    e.preventDefault();
    const targetOrg = organizations.find((o) => o.id === selectedOrgId);
    if (!targetOrg) return;

    grantConsent({
      supplierId: supplier.id,
      organizationId: targetOrg.id,
      organizationName: targetOrg.name,
      expiryDate: hasExpiryDate && expiryDateInput ? expiryDateInput : undefined,
      purpose: purposeLine.trim() || 'Procurement evaluation and verification',
      scope: {
        companyDetails: shareCompanyDetails,
        directorsOwners: shareDirectorsOwners,
        pastProjects: sharePastProjects,
        selectedDocuments: shareSelectedDocs,
        taxCompliance: shareSelectedDocs && pickedDocNames.some((d) => d.includes('Tax')),
        financialStatements: shareSelectedDocs && pickedDocNames.some((d) => d.includes('Financial')),
        keyPersonnel: true,
        pastContracts: sharePastProjects,
        bankingDetails: false,
      },
      selectedDocumentNames: shareSelectedDocs ? pickedDocNames : [],
      tiedApplicationNumbers: [],
      lastAccessedAt: 'Just now',
    });

    setIsShareDrawerOpen(false);
    showToast(`Access successfully granted to ${targetOrg.name}.`);
  };

  // Execute revoke after confirmation dialog
  const handleExecuteRevoke = () => {
    if (!revokingGrant) return;

    revokeConsent(revokingGrant.id);
    addAuditEvent({
      action: 'Sharing access revoked',
      actorName: 'Kagiso Molosiwa (Supplier admin)',
      actorRole: 'Supplier',
      organizationName: supplier.legalName,
      entityType: 'Organization',
      entityId: revokingGrant.organizationId,
      details: `Revoked data sharing agreement with ${revokingGrant.organizationName}. Access to company details, directors, and documents terminated.`,
      ipAddress: '168.167.23.41',
    });

    showToast(`Access permissions revoked for ${revokingGrant.organizationName}.`);
    setRevokingGrant(null);
  };

  // Plain summary generator for drawer
  const plainSummaryText = useMemo(() => {
    const targetOrg = organizations.find((o) => o.id === selectedOrgId);
    const orgName = targetOrg ? targetOrg.name : 'the selected organization';

    const sharedItems: string[] = [];
    if (shareCompanyDetails) sharedItems.push('Company details');
    if (shareDirectorsOwners) sharedItems.push('Directors and owners');
    if (sharePastProjects) sharedItems.push('Past projects');
    if (shareSelectedDocs && pickedDocNames.length > 0) {
      sharedItems.push(`${pickedDocNames.length} selected documents (${pickedDocNames.join(', ')})`);
    }

    const itemsStr =
      sharedItems.length > 0 ? sharedItems.join(', ') : 'no items selected';
    const expiryStr =
      hasExpiryDate && expiryDateInput ? `until ${expiryDateInput}` : 'with no expiry set (until you revoke it)';
    const purposeStr = purposeLine ? `for the purpose of "${purposeLine}"` : '';

    return `You are sharing ${itemsStr} with ${orgName} ${expiryStr} ${purposeStr}.`;
  }, [
    selectedOrgId,
    organizations,
    shareCompanyDetails,
    shareDirectorsOwners,
    sharePastProjects,
    shareSelectedDocs,
    pickedDocNames,
    hasExpiryDate,
    expiryDateInput,
    purposeLine,
  ]);

  const activeGrants = consentGrants.filter((g) => g.status === 'Active');

  return (
    <div className="space-y-8">
      {/* 1. Header with Single Primary Action in Pula Deep */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#D5E0EA] dark:border-[#1E364A]">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-semibold text-[#1F5F99] bg-[#EAF2FA] dark:bg-[#1E364A] dark:text-[#6FAEE0] px-3 py-1 rounded-[4px]">
              Data sovereignty
            </span>
            <span className="text-[14px] text-[#6B7A87]">· Controlled access</span>
          </div>
          <h1 className="font-heading font-semibold text-[30px] leading-tight text-[#10212E] dark:text-white">
            Sharing and consent
          </h1>
          <p className="text-[15px] text-[#43525F] dark:text-[#B2C3D2]">
            Control which buying organizations can view your credentials and inspect statutory access logs.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={handleOpenShareDrawer}
            className="px-5 py-2.5 bg-[#1F5F99] hover:bg-[#184c7a] text-white rounded-[6px] text-[14px] font-medium inline-flex items-center gap-2 cursor-pointer transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Share with an organization</span>
          </button>
        </div>
      </div>

      {/* Toast Alert */}
      {toastMessage && (
        <div className="p-4 rounded-[12px] bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0] flex items-center justify-between gap-3 text-[14px]">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-[#2F8F5B] shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-[#065F46] hover:opacity-75 text-[14px] cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* 2. Explainer Card in Plain Words */}
      <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-full bg-[#EAF2FA] dark:bg-[#1E364A] text-[#1F5F99] dark:text-[#6FAEE0] flex items-center justify-center shrink-0">
            <Lock className="w-5 h-5" />
          </div>
          <div className="space-y-1">
            <h2 className="font-heading font-semibold text-[18px] text-[#10212E] dark:text-white">
              You decide what each organization can see. You can change this at any time.
            </h2>
            <p className="text-[14px] text-[#43525F] dark:text-[#B2C3D2] leading-relaxed">
              No organization can browse your vault or inspect your certificates without your explicit permission. You choose the exact categories, documents, and timeframes.
            </p>
          </div>
        </div>
      </div>

      {/* 3. Figures Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-5 space-y-1.5">
          <span className="text-[14px] text-[#6B7A87] block">Authorized organizations</span>
          <div className="font-heading font-semibold text-[28px] text-[#10212E] dark:text-white tabular-nums">
            {activeGrants.length}
          </div>
          <span className="text-[14px] text-[#43525F] dark:text-[#B2C3D2] block">
            Active permissions agreements
          </span>
        </div>

        <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-5 space-y-1.5">
          <span className="text-[14px] text-[#6B7A87] block">Tied active applications</span>
          <div className="font-heading font-semibold text-[28px] text-[#10212E] dark:text-white tabular-nums">
            {consentGrants.reduce((sum, g) => sum + (g.tiedApplicationNumbers?.length || 0), 0)}
          </div>
          <span className="text-[14px] text-[#43525F] dark:text-[#B2C3D2] block">
            Tender bids relying on active permissions
          </span>
        </div>

        <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-5 space-y-1.5">
          <span className="text-[14px] text-[#6B7A87] block">Recent inspections</span>
          <div className="font-heading font-semibold text-[28px] text-[#10212E] dark:text-white tabular-nums">
            {activitiesList.length}
          </div>
          <span className="text-[14px] text-[#43525F] dark:text-[#B2C3D2] block">
            Access events logged in audit ledger
          </span>
        </div>
      </div>

      {/* 4. List of Organizations with Access */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading font-semibold text-[22px] text-[#10212E] dark:text-white">
            Organizations with access
          </h2>
          <span className="text-[14px] text-[#6B7A87]">
            Showing {consentGrants.length} sharing agreements
          </span>
        </div>

        <div className="space-y-4">
          {consentGrants.map((grant) => {
            const isActive = grant.status === 'Active';
            const hasTiedApps =
              grant.tiedApplicationNumbers && grant.tiedApplicationNumbers.length > 0;

            // Compute visible permissions summary
            const visibleItems: string[] = [];
            if (grant.scope.companyDetails) visibleItems.push('Company details');
            if (grant.scope.directorsOwners) visibleItems.push('Directors and owners');
            if (grant.scope.pastProjects) visibleItems.push('Past projects');
            if (grant.scope.selectedDocuments) {
              const docCount = grant.selectedDocumentNames?.length || 0;
              visibleItems.push(
                docCount > 0
                  ? `Selected documents (${grant.selectedDocumentNames?.join(', ')})`
                  : 'Selected documents'
              );
            }

            return (
              <div
                key={grant.id}
                className={`bg-white dark:bg-[#132635] rounded-[12px] border p-6 space-y-5 transition-all ${
                  isActive
                    ? 'border-[#D5E0EA] dark:border-[#1E364A]'
                    : 'border-[#D5E0EA]/60 dark:border-[#1E364A]/60 bg-[#F7FAFD]/50 opacity-75'
                }`}
              >
                {/* Header row: Organization info & Revoke action */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-[#D5E0EA] dark:border-[#1E364A]">
                  <div className="flex items-start gap-3.5">
                    <div
                      className={`p-2.5 rounded-[8px] shrink-0 ${
                        isActive
                          ? 'bg-[#EAF2FA] text-[#1F5F99] dark:bg-[#1E364A] dark:text-[#6FAEE0]'
                          : 'bg-[#F7FAFD] text-[#6B7A87]'
                      }`}
                    >
                      <Building2 className="w-5 h-5" />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <h3 className="font-heading font-semibold text-[18px] text-[#10212E] dark:text-white">
                          {grant.organizationName}
                        </h3>
                        <StatusChip status={grant.status} />
                      </div>

                      <div className="flex items-center gap-3 text-[14px] text-[#6B7A87] flex-wrap">
                        <span>Access granted on {grant.grantedAt}</span>
                        <span>·</span>
                        <span>
                          {grant.expiryDate
                            ? `Expires on ${grant.expiryDate}`
                            : 'No expiry set (until revoked)'}
                        </span>
                        {grant.lastAccessedAt && (
                          <>
                            <span>·</span>
                            <span className="text-[#10212E] dark:text-white font-medium">
                              Last accessed on {grant.lastAccessedAt}
                            </span>
                          </>
                        )}
                      </div>

                      {grant.purpose && (
                        <div className="text-[14px] text-[#43525F] dark:text-[#B2C3D2] pt-0.5">
                          <span className="text-[#6B7A87]">Purpose: </span>
                          <span>{grant.purpose}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="shrink-0 self-start sm:self-auto">
                    {isActive ? (
                      <button
                        type="button"
                        onClick={() => setRevokingGrant(grant)}
                        className="px-4 py-2 border border-[#D5E0EA] dark:border-[#1E364A] text-[#C2412D] hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-[6px] text-[14px] font-medium inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <XCircle className="w-4 h-4" />
                        <span>Revoke</span>
                      </button>
                    ) : (
                      <span className="text-[14px] text-[#6B7A87] italic font-medium px-2 py-1">
                        Access revoked
                      </span>
                    )}
                  </div>
                </div>

                {/* What they can see */}
                <div className="space-y-2 text-[14px]">
                  <span className="font-semibold text-[#10212E] dark:text-white block">
                    What this organization can see:
                  </span>

                  <div className="flex flex-wrap gap-2">
                    {grant.scope.companyDetails && (
                      <span className="px-3 py-1 bg-[#F7FAFD] dark:bg-[#10212E] border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[#10212E] dark:text-white font-medium inline-flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-[#2F8F5B]" />
                        <span>Company details</span>
                      </span>
                    )}

                    {grant.scope.directorsOwners && (
                      <span className="px-3 py-1 bg-[#F7FAFD] dark:bg-[#10212E] border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[#10212E] dark:text-white font-medium inline-flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-[#2F8F5B]" />
                        <span>Directors and owners</span>
                      </span>
                    )}

                    {grant.scope.pastProjects && (
                      <span className="px-3 py-1 bg-[#F7FAFD] dark:bg-[#10212E] border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[#10212E] dark:text-white font-medium inline-flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-[#2F8F5B]" />
                        <span>Past projects</span>
                      </span>
                    )}

                    {grant.scope.selectedDocuments && (
                      <span className="px-3 py-1 bg-[#F7FAFD] dark:bg-[#10212E] border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[#10212E] dark:text-white font-medium inline-flex items-center gap-1.5">
                        <Check className="w-3.5 h-3.5 text-[#2F8F5B]" />
                        <span>Selected documents ({grant.selectedDocumentNames?.length || 0})</span>
                      </span>
                    )}
                  </div>

                  {grant.scope.selectedDocuments && grant.selectedDocumentNames && grant.selectedDocumentNames.length > 0 && (
                    <div className="pl-1 pt-1 space-y-1 text-[#43525F] dark:text-[#B2C3D2]">
                      <span className="text-[#6B7A87] block text-[14px]">Shared certificates:</span>
                      <ul className="list-disc list-inside space-y-0.5">
                        {grant.selectedDocumentNames.map((docName) => (
                          <li key={docName}>{docName}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {/* Tied Applications Banner & Warning */}
                {hasTiedApps && (
                  <div className="p-3.5 rounded-[8px] bg-[#EAF2FA] dark:bg-[#1E364A]/50 border border-[#D5E0EA] dark:border-[#1E364A] flex items-start gap-2.5 text-[14px]">
                    <FileText className="w-4 h-4 text-[#1F5F99] dark:text-[#6FAEE0] mt-0.5 shrink-0" />
                    <div>
                      <strong className="text-[#10212E] dark:text-white font-semibold">
                        Tied to active tender submission:
                      </strong>
                      <span className="text-[#43525F] dark:text-[#B2C3D2] ml-1.5">
                        {grant.tiedApplicationNumbers?.join(', ')}.
                      </span>
                      <span className="text-[#6B7A87] block mt-0.5">
                        This organization is currently reviewing your submitted bid under this tender call.
                      </span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* 5. Activity List Section */}
      <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 sm:p-8 space-y-6">
        <div className="space-y-1 pb-4 border-b border-[#D5E0EA] dark:border-[#1E364A]">
          <h2 className="font-heading font-semibold text-[22px] text-[#10212E] dark:text-white">
            Recent activity
          </h2>
          <p className="text-[14px] text-[#43525F] dark:text-[#B2C3D2]">
            Detailed inspection log recording when organizations accessed your profile or verified your documents.
          </p>
        </div>

        <div className="space-y-3">
          {activitiesList.map((item) => (
            <div
              key={item.id}
              className="p-4 rounded-[8px] border border-[#D5E0EA] dark:border-[#1E364A] bg-[#F7FAFD]/60 dark:bg-[#10212E]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[14px]"
            >
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-[#EAF2FA] dark:bg-[#1E364A] text-[#1F5F99] dark:text-[#6FAEE0] flex items-center justify-center shrink-0 mt-0.5">
                  <Eye className="w-4 h-4" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-[#10212E] dark:text-white">
                    <strong>{item.organizationName}</strong> {item.action} on {item.dateStr}.
                  </p>
                  <span className="text-[#6B7A87] text-[14px] block tabular-nums">
                    Logged at {item.timestamp} · IP: {item.ipAddress}
                  </span>
                </div>
              </div>

              <span className="text-[14px] text-[#2F8F5B] bg-[#ECFDF5] px-2.5 py-0.5 rounded font-medium shrink-0 self-start sm:self-center">
                Verified
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* =========================================================================
          6. "SHARE WITH AN ORGANIZATION" SLIDE-OVER DRAWER
          ========================================================================= */}
      {isShareDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-[#10212E]/40 backdrop-blur-xs transition-opacity"
            onClick={() => setIsShareDrawerOpen(false)}
          />

          {/* Drawer Container */}
          <div className="relative w-full max-w-xl bg-white dark:bg-[#132635] shadow-2xl h-full flex flex-col z-10 border-l border-[#D5E0EA] dark:border-[#1E364A] overflow-y-auto">
            {/* Header */}
            <div className="p-6 border-b border-[#D5E0EA] dark:border-[#1E364A] flex items-center justify-between">
              <div>
                <h2 className="font-heading font-semibold text-[20px] text-[#10212E] dark:text-white">
                  Share with an organization
                </h2>
                <span className="text-[14px] text-[#6B7A87]">
                  Authorize a buying organization to view your credentials
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsShareDrawerOpen(false)}
                className="p-2 rounded-full text-[#6B7A87] hover:bg-[#F7FAFD] dark:hover:bg-[#10212E] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleConfirmShare} className="p-6 space-y-6 flex-1 text-[14px]">
              {/* 1. Choose Organization */}
              <div className="space-y-1.5">
                <label className="font-semibold text-[#10212E] dark:text-white block">
                  Choose organization *
                </label>
                <select
                  value={selectedOrgId}
                  onChange={(e) => setSelectedOrgId(e.target.value)}
                  className="w-full px-3 py-2.5 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] bg-white dark:bg-[#132635] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99]"
                >
                  {organizations.map((org) => (
                    <option key={org.id} value={org.id}>
                      {org.name} ({org.type})
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. Tick What to Share */}
              <div className="space-y-3">
                <label className="font-semibold text-[#10212E] dark:text-white block">
                  What to share *
                </label>
                <div className="space-y-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[8px] p-4 bg-[#F7FAFD]/40 dark:bg-[#10212E]/40">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={shareCompanyDetails}
                      onChange={(e) => setShareCompanyDetails(e.target.checked)}
                      className="mt-1 rounded border-[#D5E0EA] text-[#1F5F99] focus:ring-[#1F5F99]"
                    />
                    <div>
                      <span className="font-semibold text-[#10212E] dark:text-white block">
                        Company details
                      </span>
                      <span className="text-[#6B7A87] text-[14px]">
                        Legal name, registration number, registered address, and primary contacts.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 cursor-pointer pt-2 border-t border-[#D5E0EA]/60 dark:border-[#1E364A]/60">
                    <input
                      type="checkbox"
                      checked={shareDirectorsOwners}
                      onChange={(e) => setShareDirectorsOwners(e.target.checked)}
                      className="mt-1 rounded border-[#D5E0EA] text-[#1F5F99] focus:ring-[#1F5F99]"
                    />
                    <div>
                      <span className="font-semibold text-[#10212E] dark:text-white block">
                        Directors and owners
                      </span>
                      <span className="text-[#6B7A87] text-[14px]">
                        Beneficial ownership percentages, citizenship, and identity verification status.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 cursor-pointer pt-2 border-t border-[#D5E0EA]/60 dark:border-[#1E364A]/60">
                    <input
                      type="checkbox"
                      checked={sharePastProjects}
                      onChange={(e) => setSharePastProjects(e.target.checked)}
                      className="mt-1 rounded border-[#D5E0EA] text-[#1F5F99] focus:ring-[#1F5F99]"
                    />
                    <div>
                      <span className="font-semibold text-[#10212E] dark:text-white block">
                        Past projects
                      </span>
                      <span className="text-[#6B7A87] text-[14px]">
                        Track record of completed works, contract values, and reference officer contacts.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-start gap-2.5 cursor-pointer pt-2 border-t border-[#D5E0EA]/60 dark:border-[#1E364A]/60">
                    <input
                      type="checkbox"
                      checked={shareSelectedDocs}
                      onChange={(e) => setShareSelectedDocs(e.target.checked)}
                      className="mt-1 rounded border-[#D5E0EA] text-[#1F5F99] focus:ring-[#1F5F99]"
                    />
                    <div>
                      <span className="font-semibold text-[#10212E] dark:text-white block">
                        Selected documents
                      </span>
                      <span className="text-[#6B7A87] text-[14px]">
                        Choose specific statutory certificates and compliance policies from your vault.
                      </span>
                    </div>
                  </label>
                </div>
              </div>

              {/* 3. Pick Specific Documents */}
              {shareSelectedDocs && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="font-semibold text-[#10212E] dark:text-white block">
                      Pick specific documents ({pickedDocNames.length} selected)
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        const allTypes = documents.map((d) => d.documentType);
                        if (pickedDocNames.length === allTypes.length) {
                          setPickedDocNames([]);
                        } else {
                          setPickedDocNames(Array.from(new Set(allTypes)));
                        }
                      }}
                      className="text-[#1F5F99] dark:text-[#6FAEE0] text-[14px] hover:underline cursor-pointer font-medium"
                    >
                      {pickedDocNames.length === documents.length ? 'Deselect all' : 'Select all'}
                    </button>
                  </div>

                  <div className="border border-[#D5E0EA] dark:border-[#1E364A] rounded-[8px] p-3 space-y-2 max-h-48 overflow-y-auto">
                    {documents.map((doc) => {
                      const isChecked = pickedDocNames.includes(doc.documentType);

                      return (
                        <label
                          key={doc.id}
                          className="flex items-center justify-between p-2 rounded hover:bg-[#F7FAFD] dark:hover:bg-[#10212E] cursor-pointer"
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setPickedDocNames([...pickedDocNames, doc.documentType]);
                                } else {
                                  setPickedDocNames(
                                    pickedDocNames.filter((name) => name !== doc.documentType)
                                  );
                                }
                              }}
                              className="rounded border-[#D5E0EA] text-[#1F5F99] focus:ring-[#1F5F99]"
                            />
                            <div>
                              <span className="font-medium text-[#10212E] dark:text-white block">
                                {doc.documentType}
                              </span>
                              <span className="text-[#6B7A87] text-[14px]">
                                {doc.fileName} · {doc.status}
                              </span>
                            </div>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 4. Optional Expiry Date */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-[#10212E] dark:text-white block">
                    Access expiry date
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-[14px] text-[#6B7A87]">
                    <input
                      type="checkbox"
                      checked={hasExpiryDate}
                      onChange={(e) => setHasExpiryDate(e.target.checked)}
                      className="rounded border-[#D5E0EA] text-[#1F5F99] focus:ring-[#1F5F99]"
                    />
                    <span>Set expiry date</span>
                  </label>
                </div>

                {hasExpiryDate ? (
                  <input
                    type="date"
                    value={expiryDateInput}
                    onChange={(e) => setExpiryDateInput(e.target.value)}
                    className="w-full px-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] bg-white dark:bg-[#132635] text-[#10212E] dark:text-white tabular-nums"
                  />
                ) : (
                  <div className="p-3 rounded-[6px] bg-[#F7FAFD] dark:bg-[#10212E] border border-[#D5E0EA] dark:border-[#1E364A] text-[#6B7A87] text-[14px]">
                    No expiry date set. Access remains active until you click Revoke.
                  </div>
                )}
              </div>

              {/* 5. Purpose Line */}
              <div className="space-y-1.5">
                <label className="font-semibold text-[#10212E] dark:text-white block">
                  Purpose line *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Tender qualification for GRC/2026/W04 Clinic Expansion"
                  value={purposeLine}
                  onChange={(e) => setPurposeLine(e.target.value)}
                  className="w-full px-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] bg-white dark:bg-[#132635] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99]"
                />
              </div>

              {/* 6. Plain Summary Before Confirming */}
              <div className="p-4 rounded-[10px] bg-[#F7FAFD] dark:bg-[#10212E] border border-[#D5E0EA] dark:border-[#1E364A] space-y-1.5">
                <strong className="font-semibold text-[#10212E] dark:text-white block">
                  Summary before confirming:
                </strong>
                <p className="text-[#43525F] dark:text-[#B2C3D2] leading-relaxed">
                  {plainSummaryText}
                </p>
              </div>

              {/* Drawer Footer Actions */}
              <div className="pt-4 border-t border-[#D5E0EA] dark:border-[#1E364A] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsShareDrawerOpen(false)}
                  className="px-4 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[#43525F] dark:text-[#B2C3D2] hover:bg-[#F7FAFD] dark:hover:bg-[#10212E] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#1F5F99] hover:bg-[#184c7a] text-white rounded-[6px] font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <span>Confirm and share</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          7. REVOKE CONFIRMATION DIALOG (WITH ACTIVE APPLICATION WARNING)
          ========================================================================= */}
      {revokingGrant && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-xl animate-fade-in text-[14px]">
            <div className="flex items-start justify-between pb-4 border-b border-[#D5E0EA] dark:border-[#1E364A]">
              <div className="space-y-1">
                <h3 className="font-heading font-semibold text-[20px] text-[#10212E] dark:text-white">
                  Revoke organization access?
                </h3>
                <span className="text-[#6B7A87]">
                  {revokingGrant.organizationName}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setRevokingGrant(null)}
                className="p-1 text-[#6B7A87] hover:text-[#10212E] dark:hover:text-white rounded-[4px] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Explanation of what changes */}
            <div className="space-y-3">
              <p className="text-[#43525F] dark:text-[#B2C3D2] leading-relaxed">
                If you revoke access, <strong>{revokingGrant.organizationName}</strong> will immediately lose the ability to inspect your company details, directors and beneficial owners, past projects, and all selected compliance certificates.
              </p>

              {/* Warning when revoking would affect an active application */}
              {revokingGrant.tiedApplicationNumbers && revokingGrant.tiedApplicationNumbers.length > 0 ? (
                <div className="p-4 rounded-[8px] bg-[#FEF2F2] dark:bg-[#7F1D1D]/20 border border-[#FCA5A5] dark:border-[#7F1D1D]/40 space-y-2">
                  <div className="flex items-start gap-2.5">
                    <AlertTriangle className="w-5 h-5 text-[#C2412D] shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-[#8E2A1B] dark:text-red-300 font-semibold block">
                        Warning: Active application tied to this grant
                      </strong>
                      <p className="text-[#8E2A1B] dark:text-red-200 mt-0.5 leading-relaxed">
                        This organization is currently evaluating your active tender application (
                        <strong>{revokingGrant.tiedApplicationNumbers.join(', ')}</strong>).
                        Revoking access will immediately prevent the evaluation committee from verifying your compliance documents and may result in administrative disqualification.
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-3.5 rounded-[8px] bg-[#F7FAFD] dark:bg-[#10212E] border border-[#D5E0EA] dark:border-[#1E364A] text-[#6B7A87]">
                  No active tender submissions are currently tied to this grant. You can reinstate access at any time.
                </div>
              )}
            </div>

            {/* Modal Actions */}
            <div className="pt-4 border-t border-[#D5E0EA] dark:border-[#1E364A] flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setRevokingGrant(null)}
                className="px-4 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[#43525F] dark:text-[#B2C3D2] hover:bg-[#F7FAFD] dark:hover:bg-[#10212E] cursor-pointer"
              >
                Keep access
              </button>
              <button
                type="button"
                onClick={handleExecuteRevoke}
                className="px-5 py-2 bg-[#C2412D] hover:bg-[#A12B1B] text-white rounded-[6px] font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <span>Revoke access</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
