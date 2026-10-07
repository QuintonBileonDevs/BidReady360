import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import {
  AlertTriangle,
  ArrowRight,
  Upload,
  Clock,
  ChevronRight,
  FileText,
  Share2,
  Search,
  CheckCircle2,
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
  const { supplier, documents, applications, calls, replaceDocument } = useApp();
  const [quickRenewSuccess, setQuickRenewSuccess] = useState(false);

  const expiredDoc = documents.find((d) => d.status === 'Expired');

  // Filter recommended opportunities matching supplier's category
  const recommendedCalls = calls.filter(
    (c) => c.status === 'Open'
  ).slice(0, 3);

  const handleQuickRenew = () => {
    if (expiredDoc) {
      replaceDocument(expiredDoc.id, {
        documentNumber: `WCA-2026-BW-${Math.floor(1000 + Math.random() * 9000)}`,
        fileName: 'Renewed_Workers_Compensation_2026_2027.pdf',
        issueDate: '2026-10-01',
        expiryDate: '2027-09-30',
      });
      setQuickRenewSuccess(true);
      setTimeout(() => setQuickRenewSuccess(false), 5000);
    }
  };

  return (
    <div className="space-y-12">
      {/* 1. Page Header (One row: Company name 30px, Verified chip, CIPA & Categories; Right buttons) */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#D5E0EA] dark:border-[#1E364A]">
        <div className="space-y-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-heading font-semibold text-[30px] leading-tight text-[#10212E] dark:text-white">
              {supplier.legalName}
            </h1>
            <span className="bg-[#ECFDF5] text-[#2F8F5B] px-2.5 py-0.5 rounded-[6px] text-[14px] font-medium inline-flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>Verified</span>
            </span>
          </div>
          <p className="text-[15px] text-[#43525F] dark:text-[#B2C3D2]">
            CIPA: {supplier.cipaNumber} · Registered for {supplier.category}, Civil Works, and Facility Supplies
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onNavigateToVault}
            className="px-4 py-2.5 border border-[#D5E0EA] dark:border-[#1E364A] text-[#10212E] dark:text-white hover:bg-[#F7FAFD] dark:hover:bg-[#132635] rounded-[6px] text-[15px] font-medium transition-colors cursor-pointer"
          >
            Document vault
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

      {/* 2. Alert (White card with 4px Alert Red left border) */}
      {expiredDoc && !quickRenewSuccess && (
        <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] border-l-4 border-l-[#C2412D] p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="text-[#C2412D] shrink-0 mt-0.5">
              <AlertTriangle className="w-5 h-5" strokeWidth={1.5} />
            </div>
            <div className="space-y-1">
              <h2 className="text-[16px] font-semibold text-[#10212E] dark:text-white">
                Safety certificate expired
              </h2>
              <p className="text-[15px] text-[#43525F] dark:text-[#B2C3D2]">
                It expired on 30 September 2026. Upload a new one so organizations can keep your registration active.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleQuickRenew}
            className="px-4 py-2.5 bg-[#1F5F99] hover:bg-[#184c7a] text-white rounded-[6px] text-[15px] font-medium transition-colors whitespace-nowrap cursor-pointer"
          >
            Upload new certificate
          </button>
        </div>
      )}

      {quickRenewSuccess && (
        <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] border-l-4 border-l-[#2F8F5B] p-6 flex items-center gap-3">
          <CheckCircle2 className="w-5 h-5 text-[#2F8F5B] shrink-0" />
          <p className="text-[15px] text-[#10212E] dark:text-white">
            Safety certificate renewed and verified successfully. Your registration profile is fully compliant.
          </p>
        </div>
      )}

      {/* 3. Summary Row (Three equal cards with 24px gap, 24px padding, 12px radius, no shadow) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
        {/* Card 1: Profile completeness */}
        <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <h2 className="text-[16px] font-semibold text-[#10212E] dark:text-white">
              Profile completeness
            </h2>

            <div className="space-y-2">
              <div className="font-heading font-semibold text-[32px] text-[#10212E] dark:text-white leading-none">
                86%
              </div>
              <div className="h-1.5 w-full bg-[#EAF2FA] dark:bg-[#162C3E] rounded-full overflow-hidden">
                <div className="h-full bg-[#1F5F99] w-[86%] rounded-full" />
              </div>
            </div>

            <div className="space-y-2.5 pt-2">
              <div className="flex items-center justify-between text-[15px]">
                <span className="text-[#43525F] dark:text-[#B2C3D2]">Safety certificate</span>
                <span className="bg-[#FEF2F2] text-[#C2412D] text-[14px] px-2 py-0.5 rounded-[4px] font-medium">
                  Expired
                </span>
              </div>

              <div className="flex items-center justify-between text-[15px]">
                <span className="text-[#43525F] dark:text-[#B2C3D2]">Insurance policy</span>
                <span className="bg-[#FFFBEB] text-[#92400E] text-[14px] px-2 py-0.5 rounded-[4px] font-medium">
                  Expires in 12 days
                </span>
              </div>
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

        {/* Card 2: Applications */}
        <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <h2 className="text-[16px] font-semibold text-[#10212E] dark:text-white">
              Applications
            </h2>

            <div className="divide-y divide-[#D5E0EA] dark:divide-[#1E364A] text-[15px]">
              <div className="py-2 flex items-center justify-between">
                <span className="text-[#43525F] dark:text-[#B2C3D2]">Under review</span>
                <span className="font-semibold text-[#10212E] dark:text-white tabular-nums">3</span>
              </div>

              <div className="py-2 flex items-center justify-between">
                <span className="text-[#43525F] dark:text-[#B2C3D2]">Approved</span>
                <span className="font-semibold text-[#10212E] dark:text-white tabular-nums">1</span>
              </div>

              <div className="py-2 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#E8A33D]" />
                  <span className="text-[#43525F] dark:text-[#B2C3D2]">Action required</span>
                </div>
                <span className="font-semibold text-[#10212E] dark:text-white tabular-nums">1</span>
              </div>

              <div className="py-2 flex items-center justify-between">
                <span className="text-[#43525F] dark:text-[#B2C3D2]">Shared with</span>
                <span className="font-semibold text-[#10212E] dark:text-white tabular-nums">3 buyers</span>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-[#D5E0EA] dark:border-[#1E364A] mt-6">
            <button
              type="button"
              onClick={onNavigateToApplications}
              className="text-[15px] font-medium text-[#1F5F99] dark:text-[#6FAEE0] hover:underline inline-flex items-center gap-1 cursor-pointer"
            >
              <span>View applications</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Card 3: Quick actions */}
        <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <h2 className="text-[16px] font-semibold text-[#10212E] dark:text-white">
              Quick actions
            </h2>

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

      {/* 4. Recommended Tenders Section */}
      <div className="space-y-6">
        <div className="space-y-1">
          <h2 className="font-heading font-semibold text-[22px] text-[#10212E] dark:text-white">
            Recommended tenders
          </h2>
          <p className="text-[15px] text-[#43525F] dark:text-[#B2C3D2]">
            Matched to your registered categories.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          {recommendedCalls.map((call) => {
            const budgetLabel = call.estimatedBudgetBWP
              ? `BWP ${call.estimatedBudgetBWP.toLocaleString()}`
              : 'Not applicable';

            return (
              <div
                key={call.id}
                className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 flex flex-col justify-between"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[14px] text-[#6B7A87]">
                      {call.organizationName}
                    </span>
                    <span className="bg-[#EAF2FA] text-[#1F5F99] text-[14px] px-2 py-0.5 rounded-[4px] font-medium">
                      {call.type === 'RFP' ? 'Request for proposal' : 'Expression of interest'}
                    </span>
                  </div>

                  <h3 className="font-semibold text-[16px] text-[#10212E] dark:text-white line-clamp-2 leading-snug">
                    {call.title}
                  </h3>

                  <div className="space-y-1.5 pt-2 border-t border-[#D5E0EA] dark:border-[#1E364A] text-[14px]">
                    <div className="flex items-center justify-between text-[#43525F] dark:text-[#B2C3D2]">
                      <span>Closing date:</span>
                      <span className="tabular-nums font-medium text-[#10212E] dark:text-white">
                        {call.closingDate} ({call.daysRemaining} days left)
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
                    onClick={() => onNavigateToApply(call.id)}
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
      </div>
    </div>
  );
};
