import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { calculateSupplierCompleteness } from '../../utils/supplierOnboarding';
import {
  AlertTriangle,
  ArrowRight,
  Upload,
  Clock,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  FileText,
  Share2,
  Search,
  CheckCircle2,
  XCircle,
  RotateCw,
  Building2,
  Users,
  ShieldCheck,
  AlertCircle,
  Sparkles,
  ShieldAlert,
  ExternalLink,
} from 'lucide-react';

interface SupplierDashboardProps {
  onNavigateToVault: () => void;
  onNavigateToApplications: () => void;
  onNavigateToApply: (callId?: string) => void;
  onNavigateToProfile: () => void;
  onNavigateToConsent: () => void;
}

export const SupplierDashboard: React.FC<SupplierDashboardProps> = ({
  onNavigateToVault,
  onNavigateToApplications,
  onNavigateToApply,
  onNavigateToProfile,
  onNavigateToConsent,
}) => {
  const {
    supplier,
    documents,
    applications,
    calls,
    replaceDocument,
    resetDemoData,
    setActiveNav,
    updateSupplierProfile,
  } = useApp();

  const handleApplyClick = (callId?: string) => {
    if (!supplier.emailVerified) {
      setActiveNav('supplier-verify-email');
      return;
    }
    onNavigateToApply(callId);
  };

  const [isChecklistExpanded, setIsChecklistExpanded] = useState(true);
  const [quickRenewSuccess, setQuickRenewSuccess] = useState(false);

  // Compute 15-item completeness dynamically from real memory state
  const completeness = calculateSupplierCompleteness(supplier, documents);

  // Real compliance status checks
  const expiredDocs = documents.filter((d) => d.status === 'Expired');
  const expiringSoonDocs = documents.filter((d) => d.status === 'Expiring soon');
  const activeAlertDoc = expiredDocs[0] || expiringSoonDocs[0];

  // Supplier registered categories
  const supplierCategories = supplier.categories?.length
    ? supplier.categories
    : supplier.category
    ? [supplier.category]
    : [];

  // Match tenders ONLY if supplier has chosen at least one category
  const matchingCalls = supplierCategories.length > 0
    ? calls.filter((c) => {
        if (c.status !== 'Open') return false;
        return supplierCategories.some((cat) => {
          const catL = cat.toLowerCase();
          const cCatL = (c.category || '').toLowerCase();
          return (
            cCatL.includes(catL) ||
            catL.includes(cCatL) ||
            (c.subcategories || []).some((sub: string) =>
              sub.toLowerCase().includes(catL) || catL.includes(sub.toLowerCase())
            )
          );
        });
      })
    : [];

  // Applications real breakdown
  const underReviewCount = applications.filter(
    (a) => a.status === 'Submitted' || a.status === 'Under review'
  ).length;
  const approvedCount = applications.filter((a) => a.status === 'Approved').length;
  const actionRequiredCount = applications.filter(
    (a) =>
      a.status === 'More information requested' ||
      a.status === 'Rejected'
  ).length;
  const distinctBuyersCount = new Set(
    applications.map((a) => a.organizationId || a.organizationName)
  ).size;

  const handleQuickRenew = () => {
    if (activeAlertDoc) {
      replaceDocument(activeAlertDoc.id, {
        documentNumber: `RENEW-${Math.floor(1000 + Math.random() * 9000)}`,
        fileName: `Renewed_${activeAlertDoc.documentType.replace(/\s+/g, '_')}_2026.pdf`,
        issueDate: new Date().toISOString().split('T')[0],
        expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        status: 'Verified',
      });
      setQuickRenewSuccess(true);
      setTimeout(() => setQuickRenewSuccess(false), 5000);
    }
  };

  return (
    <div className="space-y-10">
      {/* 0. Demo Mode Ribbon (if demo account) */}
      {supplier.isDemoAccount && (
        <div className="bg-[#FFFBEB] dark:bg-[#78350F]/20 border border-[#FDE68A] dark:border-[#78350F]/50 rounded-[10px] p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[14px]">
          <div className="flex items-center gap-2.5 text-[#92400E] dark:text-[#FCD34D]">
            <Sparkles className="w-5 h-5 shrink-0" />
            <div>
              <span className="font-semibold">Demo Account Mode:</span>{' '}
              <span>Currently inspecting pre-loaded demonstration data for Kopano Building Supplies.</span>
            </div>
          </div>
          <button
            type="button"
            onClick={resetDemoData}
            className="px-3 py-1.5 bg-[#D97706] hover:bg-[#B45309] text-white rounded-[6px] font-medium text-[13px] inline-flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
          >
            <RotateCw className="w-3.5 h-3.5" />
            <span>Reset demo data</span>
          </button>
        </div>
      )}

      {/* Safeguard: Email Verification Mandatory */}
      {!supplier.emailVerified && (
        <div className="p-4 sm:p-5 rounded-[12px] bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-[14px]">
          <div className="flex items-start gap-3.5">
            <ShieldAlert className="w-6 h-6 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-heading font-semibold text-[16px] text-amber-950 dark:text-amber-100 block">
                Action required: Verify your email address ({supplier.email || 'your email'})
              </span>
              <p className="text-amber-800 dark:text-amber-300 text-[13px] leading-relaxed">
                Your supplier account remains unverified. To safeguard Botswana procurement integrity, you cannot apply to open tenders or share documents until your email address is verified.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
            <button
              type="button"
              onClick={() => setActiveNav('supplier-verify-email')}
              className="flex-1 sm:flex-none px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-[6px] text-[13px] font-semibold text-center cursor-pointer transition-colors"
            >
              Enter code
            </button>
            <button
              type="button"
              onClick={() => updateSupplierProfile({ emailVerified: true })}
              className="flex-1 sm:flex-none px-3.5 py-2 border border-amber-400 dark:border-amber-700 bg-white dark:bg-[#132635] text-amber-900 dark:text-amber-200 hover:bg-amber-100/50 rounded-[6px] text-[13px] font-medium text-center cursor-pointer transition-colors inline-flex items-center justify-center gap-1.5"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Simulate email link click</span>
            </button>
          </div>
        </div>
      )}

      {/* 1. Onboarding Checklist Panel (shown until completeness is 100%) */}
      {!completeness.isComplete && (
        <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 shadow-subtle space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#D5E0EA] dark:border-[#1E364A]">
            <div className="space-y-1">
              <div className="flex items-center gap-2.5">
                <span className="px-2.5 py-0.5 rounded-[4px] bg-[#EAF2FA] text-[#1F5F99] dark:bg-[#162C3E] dark:text-[#6FAEE0] text-[12px] font-semibold uppercase tracking-wider">
                  Finish setting up
                </span>
                <span className="text-[14px] text-[#6B7A87]">
                  {completeness.completedCount} of {completeness.totalCount} items completed
                </span>
              </div>
              <h2 className="font-heading font-semibold text-[20px] text-[#10212E] dark:text-white">
                Complete your profile to start applying
              </h2>
              <p className="text-[14px] text-[#43525F] dark:text-[#B2C3D2]">
                Botswana procuring entities require statutory standing verification before you can submit electronic bids.
              </p>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              <button
                type="button"
                onClick={onNavigateToProfile}
                className="px-4 py-2 bg-[#1F5F99] hover:bg-[#184c7a] text-white rounded-[6px] text-[14px] font-medium transition-colors cursor-pointer inline-flex items-center gap-2"
              >
                <span>Continue profile</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsChecklistExpanded(!isChecklistExpanded)}
                className="p-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[#6B7A87] hover:text-[#10212E] transition-colors cursor-pointer"
                aria-label="Toggle checklist"
              >
                {isChecklistExpanded ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[13px]">
              <span className="text-[#6B7A87]">Completeness progress</span>
              <span className="font-semibold text-[#1F5F99] dark:text-[#6FAEE0] tabular-nums">
                {completeness.score}%
              </span>
            </div>
            <div className="h-2 w-full bg-[#EAF2FA] dark:bg-[#162C3E] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#1F5F99] transition-all duration-300 rounded-full"
                style={{ width: `${completeness.score}%` }}
              />
            </div>
          </div>

          {/* Expandable 15-Item Checklist Grid */}
          {isChecklistExpanded && (
            <div className="pt-3 grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Company (10 items) */}
              <div className="p-3.5 bg-[#F7FAFD] dark:bg-[#0D1A25] rounded-[8px] border border-[#D5E0EA] dark:border-[#1E364A] space-y-2">
                <div className="flex items-center gap-2 pb-1.5 border-b border-[#D5E0EA] dark:border-[#1E364A] text-[13px] font-semibold text-[#10212E] dark:text-white">
                  <Building2 className="w-4 h-4 text-[#1F5F99]" />
                  <span>Company Details (10)</span>
                </div>
                <div className="space-y-1.5 text-[13px]">
                  {completeness.items
                    .filter((item) => item.category === 'Company')
                    .map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={onNavigateToProfile}
                        className="w-full flex items-center justify-between text-left py-1 px-1.5 rounded hover:bg-white dark:hover:bg-[#132635] transition-colors cursor-pointer"
                      >
                        <span
                          className={
                            item.isComplete
                              ? 'text-[#2F8F5B] line-through opacity-80'
                              : 'text-[#10212E] dark:text-white font-medium'
                          }
                        >
                          {item.shortLabel}
                        </span>
                        {item.isComplete ? (
                          <CheckCircle2 className="w-4 h-4 text-[#2F8F5B] shrink-0" />
                        ) : (
                          <span className="w-3.5 h-3.5 rounded-full border border-[#D5E0EA] dark:border-[#384C5C] shrink-0" />
                        )}
                      </button>
                    ))}
                </div>
              </div>

              {/* People (1 item) */}
              <div className="p-3.5 bg-[#F7FAFD] dark:bg-[#0D1A25] rounded-[8px] border border-[#D5E0EA] dark:border-[#1E364A] space-y-2">
                <div className="flex items-center gap-2 pb-1.5 border-b border-[#D5E0EA] dark:border-[#1E364A] text-[13px] font-semibold text-[#10212E] dark:text-white">
                  <Users className="w-4 h-4 text-[#1F5F99]" />
                  <span>People & Directors (1)</span>
                </div>
                <div className="space-y-1.5 text-[13px]">
                  {completeness.items
                    .filter((item) => item.category === 'People')
                    .map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={onNavigateToProfile}
                        className="w-full flex items-center justify-between text-left py-1 px-1.5 rounded hover:bg-white dark:hover:bg-[#132635] transition-colors cursor-pointer"
                      >
                        <div className="pr-2">
                          <span
                            className={
                              item.isComplete
                                ? 'text-[#2F8F5B] line-through opacity-80 block'
                                : 'text-[#10212E] dark:text-white font-medium block'
                            }
                          >
                            {item.shortLabel}
                          </span>
                          <span className="text-[11px] text-[#6B7A87]">
                            Ownership must total 100%
                          </span>
                        </div>
                        {item.isComplete ? (
                          <CheckCircle2 className="w-4 h-4 text-[#2F8F5B] shrink-0" />
                        ) : (
                          <span className="w-3.5 h-3.5 rounded-full border border-[#D5E0EA] dark:border-[#384C5C] shrink-0" />
                        )}
                      </button>
                    ))}
                </div>
              </div>

              {/* Documents (4 items) */}
              <div className="p-3.5 bg-[#F7FAFD] dark:bg-[#0D1A25] rounded-[8px] border border-[#D5E0EA] dark:border-[#1E364A] space-y-2">
                <div className="flex items-center gap-2 pb-1.5 border-b border-[#D5E0EA] dark:border-[#1E364A] text-[13px] font-semibold text-[#10212E] dark:text-white">
                  <ShieldCheck className="w-4 h-4 text-[#1F5F99]" />
                  <span>Statutory Documents (4)</span>
                </div>
                <div className="space-y-1.5 text-[13px]">
                  {completeness.items
                    .filter((item) => item.category === 'Documents')
                    .map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={onNavigateToVault}
                        className="w-full flex items-center justify-between text-left py-1 px-1.5 rounded hover:bg-white dark:hover:bg-[#132635] transition-colors cursor-pointer"
                      >
                        <span
                          className={
                            item.isComplete
                              ? 'text-[#2F8F5B] line-through opacity-80'
                              : 'text-[#10212E] dark:text-white font-medium'
                          }
                        >
                          {item.shortLabel}
                        </span>
                        {item.isComplete ? (
                          <CheckCircle2 className="w-4 h-4 text-[#2F8F5B] shrink-0" />
                        ) : (
                          <span className="w-3.5 h-3.5 rounded-full border border-[#D5E0EA] dark:border-[#384C5C] shrink-0" />
                        )}
                      </button>
                    ))}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#D5E0EA] dark:border-[#1E364A]">
        <div className="space-y-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-heading font-semibold text-[30px] leading-tight text-[#10212E] dark:text-white">
              {supplier.legalName || 'Supplier Passport'}
            </h1>
            {completeness.isComplete ? (
              <span className="bg-[#ECFDF5] text-[#2F8F5B] px-2.5 py-0.5 rounded-[6px] text-[14px] font-medium inline-flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Verified profile</span>
              </span>
            ) : (
              <span className="bg-[#FFFBEB] text-[#D97706] px-2.5 py-0.5 rounded-[6px] text-[14px] font-medium inline-flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>Incomplete profile ({completeness.score}%)</span>
              </span>
            )}
          </div>
          <p className="text-[15px] text-[#43525F] dark:text-[#B2C3D2]">
            CIPA: {supplier.cipaNumber || 'Not recorded'} · Categories:{' '}
            {supplierCategories.length > 0
              ? supplierCategories.join(', ')
              : 'None selected'}
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onNavigateToVault}
            className="px-4 py-2.5 border border-[#D5E0EA] dark:border-[#1E364A] text-[#10212E] dark:text-white hover:bg-[#F7FAFD] dark:hover:bg-[#132635] rounded-[6px] text-[15px] font-medium transition-colors cursor-pointer"
          >
            Document vault ({documents.length})
          </button>
          <button
            type="button"
            onClick={() => onNavigateToApply()}
            className="px-4 py-2.5 bg-[#1F5F99] hover:bg-[#184c7a] text-white rounded-[6px] text-[15px] font-medium transition-colors cursor-pointer"
          >
            Browse tenders
          </button>
        </div>
      </div>

      {/* 3. Compliance Alert (Shows ONLY when an uploaded document is expired or expiring soon) */}
      {activeAlertDoc && !quickRenewSuccess && (
        <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] border-l-4 border-l-[#C2412D] p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="text-[#C2412D] shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5" strokeWidth={1.5} />
            </div>
            <div className="space-y-1">
              <h2 className="text-[16px] font-semibold text-[#10212E] dark:text-white">
                {activeAlertDoc.documentType} {activeAlertDoc.status.toLowerCase()}
              </h2>
              <p className="text-[15px] text-[#43525F] dark:text-[#B2C3D2]">
                {activeAlertDoc.status === 'Expired'
                  ? `This document expired on ${activeAlertDoc.expiryDate || 'recently'}. Upload an active replacement to maintain verified procurement standing.`
                  : `This document will expire on ${activeAlertDoc.expiryDate}. Please prepare a renewal certificate.`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={handleQuickRenew}
              className="px-4 py-2.5 bg-[#1F5F99] hover:bg-[#184c7a] text-white rounded-[6px] text-[15px] font-medium transition-colors whitespace-nowrap cursor-pointer"
            >
              Upload replacement
            </button>
          </div>
        </div>
      )}

      {quickRenewSuccess && (
        <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] border-l-4 border-l-[#2F8F5B] p-6 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-[#2F8F5B] shrink-0" />
          <p className="text-[15px] text-[#10212E] dark:text-white">
            Document replaced and compliance status updated successfully.
          </p>
        </div>
      )}

      {/* 4. Summary Row (Three equal cards reading real memory state) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
        {/* Card 1: Profile completeness */}
        <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[16px] font-semibold text-[#10212E] dark:text-white">
                Profile completeness
              </h2>
              <span className="text-[13px] text-[#6B7A87]">
                {completeness.completedCount}/15 items
              </span>
            </div>

            <div className="space-y-2">
              <div className="font-heading font-semibold text-[32px] text-[#10212E] dark:text-white leading-none tabular-nums">
                {completeness.score}%
              </div>
              <div className="h-1.5 w-full bg-[#EAF2FA] dark:bg-[#162C3E] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#1F5F99] rounded-full transition-all duration-300"
                  style={{ width: `${completeness.score}%` }}
                />
              </div>
            </div>

            {/* What's missing list */}
            <div className="space-y-2 pt-1 text-[14px]">
              {completeness.missingItems.length === 0 ? (
                <div className="flex items-center gap-2 text-[#2F8F5B] text-[13px] pt-1">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>All 15 statutory requirements satisfied.</span>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <span className="text-[12px] font-semibold uppercase tracking-wider text-[#6B7A87] block">
                    What's missing ({completeness.missingItems.length}):
                  </span>
                  {completeness.missingItems.slice(0, 3).map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between text-[13px] text-[#43525F] dark:text-[#B2C3D2]"
                    >
                      <span className="truncate max-w-[190px]">{item.label}</span>
                      <span className="text-[#D97706] text-[12px] font-medium shrink-0">
                        Required
                      </span>
                    </div>
                  ))}
                  {completeness.missingItems.length > 3 && (
                    <div className="text-[12px] text-[#6B7A87] pt-0.5">
                      + {completeness.missingItems.length - 3} more item(s) to complete
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          <div className="pt-4 border-t border-[#D5E0EA] dark:border-[#1E364A] mt-6">
            <button
              type="button"
              onClick={onNavigateToProfile}
              className="text-[15px] font-medium text-[#1F5F99] dark:text-[#6FAEE0] hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <span>Manage profile</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Card 2: Applications (Real State with empty state) */}
        <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[16px] font-semibold text-[#10212E] dark:text-white">
                Applications
              </h2>
              <span className="text-[13px] text-[#6B7A87]">
                Total: {applications.length}
              </span>
            </div>

            {applications.length === 0 ? (
              <div className="py-4 space-y-2 text-center sm:text-left">
                <p className="text-[15px] font-medium text-[#10212E] dark:text-white">
                  No applications yet
                </p>
                <p className="text-[13px] text-[#6B7A87] leading-relaxed">
                  You haven't submitted any electronic tender applications or bids yet.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-[#D5E0EA] dark:divide-[#1E364A] text-[15px]">
                <div className="py-2 flex items-center justify-between">
                  <span className="text-[#43525F] dark:text-[#B2C3D2]">Under review</span>
                  <span className="font-semibold text-[#10212E] dark:text-white tabular-nums">
                    {underReviewCount}
                  </span>
                </div>

                <div className="py-2 flex items-center justify-between">
                  <span className="text-[#43525F] dark:text-[#B2C3D2]">Approved</span>
                  <span className="font-semibold text-[#10212E] dark:text-white tabular-nums">
                    {approvedCount}
                  </span>
                </div>

                <div className="py-2 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#E8A33D]" />
                    <span className="text-[#43525F] dark:text-[#B2C3D2]">Action required</span>
                  </div>
                  <span className="font-semibold text-[#10212E] dark:text-white tabular-nums">
                    {actionRequiredCount}
                  </span>
                </div>

                <div className="py-2 flex items-center justify-between">
                  <span className="text-[#43525F] dark:text-[#B2C3D2]">Shared with</span>
                  <span className="font-semibold text-[#10212E] dark:text-white tabular-nums">
                    {distinctBuyersCount} buyer{distinctBuyersCount === 1 ? '' : 's'}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="pt-4 border-t border-[#D5E0EA] dark:border-[#1E364A] mt-6">
            <button
              type="button"
              onClick={onNavigateToApplications}
              className="text-[15px] font-medium text-[#1F5F99] dark:text-[#6FAEE0] hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <span>{applications.length === 0 ? 'Browse tender calls' : 'View applications'}</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Card 3: Quick actions & Vault State */}
        <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-[16px] font-semibold text-[#10212E] dark:text-white">
                Document vault
              </h2>
              <span className="text-[13px] text-[#6B7A87]">
                {documents.length === 0 ? 'No documents uploaded' : `${documents.length} doc${documents.length === 1 ? '' : 's'}`}
              </span>
            </div>

            {documents.length === 0 ? (
              <div className="py-2 space-y-1">
                <p className="text-[14px] font-medium text-[#10212E] dark:text-white">
                  No documents uploaded
                </p>
                <p className="text-[13px] text-[#6B7A87] leading-relaxed">
                  Upload your CIPA certificate and tax clearance to complete your statutory credentials.
                </p>
              </div>
            ) : null}

            <div className="space-y-2">
              <button
                type="button"
                onClick={onNavigateToVault}
                className="w-full p-3 rounded-[6px] hover:bg-[#F7FAFD] dark:hover:bg-[#10212E] border border-[#D5E0EA] dark:border-[#1E364A] transition-colors flex items-center justify-between text-[15px] text-[#10212E] dark:text-white cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <Upload className="w-4 h-4 text-[#1F5F99]" strokeWidth={1.5} />
                  <span>Upload a document</span>
                </div>
                <ChevronRight className="w-4 h-4 text-[#6B7A87]" />
              </button>

              <button
                type="button"
                onClick={onNavigateToConsent}
                className="w-full p-3 rounded-[6px] hover:bg-[#F7FAFD] dark:hover:bg-[#10212E] border border-[#D5E0EA] dark:border-[#1E364A] transition-colors flex items-center justify-between text-[15px] text-[#10212E] dark:text-white cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <Share2 className="w-4 h-4 text-[#1F5F99]" strokeWidth={1.5} />
                  <span>Manage sharing</span>
                </div>
                <ChevronRight className="w-4 h-4 text-[#6B7A87]" />
              </button>

              <button
                type="button"
                onClick={() => onNavigateToApply()}
                className="w-full p-3 rounded-[6px] hover:bg-[#F7FAFD] dark:hover:bg-[#10212E] border border-[#D5E0EA] dark:border-[#1E364A] transition-colors flex items-center justify-between text-[15px] text-[#10212E] dark:text-white cursor-pointer"
              >
                <div className="flex items-center gap-3">
                  <Search className="w-4 h-4 text-[#1F5F99]" strokeWidth={1.5} />
                  <span>Browse open tenders</span>
                </div>
                <ChevronRight className="w-4 h-4 text-[#6B7A87]" />
              </button>
            </div>
          </div>

          <div className="pt-4 border-t border-[#D5E0EA] dark:border-[#1E364A] mt-6">
            <button
              type="button"
              onClick={onNavigateToVault}
              className="text-[15px] font-medium text-[#1F5F99] dark:text-[#6FAEE0] hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <span>View document vault</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* 5. Recommended Tenders Section */}
      <div className="space-y-6">
        <div className="space-y-1">
          <h2 className="font-heading font-semibold text-[22px] text-[#10212E] dark:text-white">
            Recommended tenders
          </h2>
          <p className="text-[15px] text-[#43525F] dark:text-[#B2C3D2]">
            {supplierCategories.length > 0
              ? 'Matched to your registered procurement categories.'
              : 'Choose your categories to see matching tenders.'}
          </p>
        </div>

        {supplierCategories.length === 0 ? (
          /* Empty state when no categories have been chosen */
          <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-dashed border-[#D5E0EA] dark:border-[#1E364A] p-8 text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-[#EAF2FA] dark:bg-[#162C3E] text-[#1F5F99] dark:text-[#6FAEE0] flex items-center justify-center mx-auto">
              <Search className="w-6 h-6" strokeWidth={1.5} />
            </div>
            <div className="max-w-md mx-auto space-y-1">
              <h3 className="font-heading font-semibold text-[18px] text-[#10212E] dark:text-white">
                Choose your categories to see matching tenders
              </h3>
              <p className="text-[14px] text-[#6B7A87] leading-relaxed">
                You haven't chosen any procurement categories yet. Select the supply codes and trade disciplines you operate in so we can match you to open tenders.
              </p>
            </div>
            <button
              type="button"
              onClick={onNavigateToProfile}
              className="px-4 py-2.5 bg-[#1F5F99] hover:bg-[#184c7a] text-white rounded-[6px] text-[14px] font-medium transition-colors cursor-pointer inline-flex items-center gap-2"
            >
              <span>Choose categories in Profile</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : matchingCalls.length === 0 ? (
          /* When categories are chosen but no current calls match */
          <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-8 text-center space-y-3">
            <p className="text-[16px] font-medium text-[#10212E] dark:text-white">
              No open tenders currently match your selected categories.
            </p>
            <p className="text-[14px] text-[#6B7A87]">
              New calls are published regularly by Gaborone Regional Council, BURS, and other procuring authorities.
            </p>
            <div className="pt-2">
              <button
                type="button"
                onClick={() => handleApplyClick()}
                className="px-4 py-2 border border-[#D5E0EA] dark:border-[#1E364A] hover:bg-[#F7FAFD] rounded-[6px] text-[14px] font-medium text-[#1F5F99] transition-colors cursor-pointer"
              >
                Browse all public tenders
              </button>
            </div>
          </div>
        ) : (
          /* Grid of real matching calls */
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
            {matchingCalls.slice(0, 3).map((call) => {
              const budgetLabel = call.estimatedBudgetBWP
                ? `BWP ${call.estimatedBudgetBWP.toLocaleString()}`
                : 'Not disclosed';

              return (
                <div
                  key={call.id}
                  className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[13px] text-[#6B7A87] truncate">
                        {call.organizationName}
                      </span>
                      <span className="bg-[#EAF2FA] text-[#1F5F99] text-[12px] px-2 py-0.5 rounded-[4px] font-medium shrink-0">
                        {call.type === 'RFP' ? 'RFP' : 'EOI'}
                      </span>
                    </div>

                    <h3 className="font-semibold text-[16px] text-[#10212E] dark:text-white line-clamp-2 leading-snug">
                      {call.title}
                    </h3>

                    <div className="space-y-1.5 pt-2 border-t border-[#D5E0EA] dark:border-[#1E364A] text-[14px]">
                      <div className="flex items-center justify-between text-[#43525F] dark:text-[#B2C3D2]">
                        <span>Closing date:</span>
                        <span className="tabular-nums font-medium text-[#10212E] dark:text-white">
                          {call.closingDate}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[#43525F] dark:text-[#B2C3D2]">
                        <span>Budget:</span>
                        <span className="tabular-nums font-medium text-[#10212E] dark:text-white">
                          {budgetLabel}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-[#D5E0EA] dark:border-[#1E364A] mt-6">
                    <button
                      type="button"
                      onClick={() => handleApplyClick(call.id)}
                      className="text-[15px] font-medium text-[#1F5F99] dark:text-[#6FAEE0] hover:underline inline-flex items-center gap-1 cursor-pointer"
                    >
                      <span>View tender</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
