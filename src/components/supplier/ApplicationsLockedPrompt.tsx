import React from 'react';
import { useApp } from '../../context/AppContext';
import {
  Lock,
  AlertTriangle,
  Building2,
  Users,
  FileText,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  ShieldAlert,
} from 'lucide-react';
import { SupplierCompletenessResult, OnboardingChecklistItem } from '../../utils/supplierOnboarding';

interface ApplicationsLockedPromptProps {
  completeness: SupplierCompletenessResult;
  onNavigateToProfile: (section?: 'details' | 'directors' | 'categories') => void;
  onNavigateToVault: () => void;
  onNavigateToDashboard: () => void;
  intendedAction?: 'applications' | 'apply' | 'bids' | 'sharing';
  callTitle?: string;
}

export const ApplicationsLockedPrompt: React.FC<ApplicationsLockedPromptProps> = ({
  completeness,
  onNavigateToProfile,
  onNavigateToVault,
  onNavigateToDashboard,
  intendedAction = 'applications',
  callTitle,
}) => {
  const { autoCompleteProfile } = useApp();
  const missingItems: OnboardingChecklistItem[] = completeness.missingItems || [];
  const score = completeness.score || 0;

  // Group missing items by category
  const companyMissing = missingItems.filter((i: OnboardingChecklistItem) => i.category === 'Company');
  const peopleMissing = missingItems.filter((i: OnboardingChecklistItem) => i.category === 'People');
  const docMissing = missingItems.filter((i: OnboardingChecklistItem) => i.category === 'Documents');

  const getActionForCategory = (item: OnboardingChecklistItem) => {
    if (item.category === 'Documents' || item.targetSection === 'vault') {
      return {
        label: 'Upload to Document Vault',
        handler: () => onNavigateToVault(),
      };
    }
    if (item.targetSection === 'directors' || item.category === 'People') {
      return {
        label: 'Complete in Directors & Owners',
        handler: () => onNavigateToProfile('directors'),
      };
    }
    return {
      label: 'Complete in Company Details',
      handler: () => onNavigateToProfile('details'),
    };
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto py-4">
      {/* Back button */}
      <div>
        <button
          type="button"
          onClick={onNavigateToDashboard}
          className="inline-flex items-center gap-1.5 text-sm font-medium text-[#43525F] dark:text-[#B2C3D2] hover:text-[#1F5F99] dark:hover:text-[#6FAEE0] transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </button>
      </div>

      {/* Main Lock Banner */}
      <div className="bg-white dark:bg-[#132635] rounded-[14px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 sm:p-8 space-y-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-[12px] text-amber-700 dark:text-amber-300 shrink-0 mt-0.5">
              <Lock className="w-7 h-7" />
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="px-2.5 py-0.5 text-xs font-semibold rounded-full bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-200 border border-amber-300 dark:border-amber-700 flex items-center gap-1">
                  <ShieldAlert className="w-3.5 h-3.5" />
                  Access Restricted · 100% Completeness Required
                </span>
                {callTitle && (
                  <span className="px-2.5 py-0.5 text-xs font-medium rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700">
                    Applying for: {callTitle}
                  </span>
                )}
              </div>
              <h1 className="font-heading font-semibold text-[24px] sm:text-[28px] text-[#10212E] dark:text-white leading-tight">
                {intendedAction === 'apply'
                  ? 'Complete your profile to submit this application'
                  : intendedAction === 'sharing'
                  ? 'Document and profile sharing locked'
                  : 'Tender applications locked'}
              </h1>
              <p className="text-[14px] sm:text-[15px] text-[#43525F] dark:text-[#B2C3D2] max-w-2xl leading-relaxed">
                Under BidReady360, suppliers must achieve{' '}
                <strong>100% profile completeness</strong> before they can{' '}
                {intendedAction === 'sharing'
                  ? 'share compliance documents with buyers, issue access links, or manage sharing permissions.'
                  : 'access tender applications, submit sealed bids, or file expressions of interest.'}
              </p>
            </div>
          </div>
        </div>

        {/* Progress Bar & Status */}
        <div className="p-5 rounded-[10px] bg-[#F7FAFD] dark:bg-[#182C3A] border border-[#D5E0EA] dark:border-[#1E364A] space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-semibold text-[#10212E] dark:text-white flex items-center gap-1.5">
              <span>Current Profile Completeness:</span>
              <span className="text-[#1F5F99] dark:text-[#38BDF8] font-bold tabular-nums">
                {score}%
              </span>
            </span>
            <span className="text-[#6B7A87] font-medium text-xs sm:text-sm">
              {completeness.completedCount} of {completeness.totalCount} mandatory items completed
            </span>
          </div>

          <div className="w-full h-3 bg-[#D5E0EA] dark:bg-[#1E364A] rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                score >= 80 ? 'bg-[#1F5F99]' : 'bg-amber-500'
              }`}
              style={{ width: `${score}%` }}
            />
          </div>

          <div className="flex items-center justify-between text-xs text-[#6B7A87]">
            <span>
              {missingItems.length} requirement{missingItems.length === 1 ? '' : 's'} remaining to unlock full {intendedAction === 'sharing' ? 'document sharing' : 'application'} access
            </span>
            <span className="font-medium text-amber-700 dark:text-amber-400">
              Needs {100 - score}% more
            </span>
          </div>
        </div>

        {/* Action Shortcuts */}
        <div className="flex flex-wrap gap-3 pt-2">
          <button
            type="button"
            onClick={autoCompleteProfile}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-[6px] text-sm font-medium inline-flex items-center gap-2 cursor-pointer transition-colors shadow-sm"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>⚡ Auto-Complete Profile & Unlock Instantly</span>
          </button>
          <button
            type="button"
            onClick={() => onNavigateToProfile('details')}
            className="px-4 py-2.5 bg-[#1F5F99] hover:bg-[#184c7a] text-white rounded-[6px] text-sm font-medium inline-flex items-center gap-2 cursor-pointer transition-colors shadow-sm"
          >
            <Building2 className="w-4 h-4" />
            <span>Go to Company Profile</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={onNavigateToVault}
            className="px-4 py-2.5 border border-[#D5E0EA] dark:border-[#1E364A] hover:bg-[#F7FAFD] dark:hover:bg-[#182C3A] text-[#10212E] dark:text-white rounded-[6px] text-sm font-medium inline-flex items-center gap-2 cursor-pointer transition-colors"
          >
            <FileText className="w-4 h-4 text-[#1F5F99] dark:text-[#38BDF8]" />
            <span>Go to Document Vault</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Detailed Instructions for Missing Items */}
      <div className="bg-white dark:bg-[#132635] rounded-[14px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 sm:p-8 space-y-6 shadow-sm">
        <div className="space-y-1 pb-4 border-b border-[#D5E0EA] dark:border-[#1E364A]">
          <h2 className="font-heading font-semibold text-[20px] text-[#10212E] dark:text-white flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            <span>Instructions: What is missing and how to complete it</span>
          </h2>
          <p className="text-[14px] text-[#6B7A87]">
            Review each missing item below. Follow the specific instructions and click the action button to resolve it.
          </p>
        </div>

        {missingItems.length === 0 ? (
          <div className="p-6 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-[10px] text-center space-y-3">
            <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto" />
            <h3 className="font-semibold text-emerald-900 dark:text-emerald-200 text-lg">
              All mandatory requirements complete!
            </h3>
            <p className="text-sm text-emerald-700 dark:text-emerald-300">
              Your profile completeness is 100%. {intendedAction === 'sharing' ? 'Document sharing' : 'Application access'} is now unlocked.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            {/* 1. Missing Company Information */}
            {companyMissing.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#10212E] dark:text-white">
                  <Building2 className="w-4 h-4 text-[#1F5F99]" />
                  <span>Company Details ({companyMissing.length} missing)</span>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {companyMissing.map((item: OnboardingChecklistItem) => {
                    const action = getActionForCategory(item);
                    return (
                      <div
                        key={item.id}
                        className="p-4 rounded-[8px] border border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                            <h4 className="font-semibold text-[14px] text-[#10212E] dark:text-white">
                              {item.label}
                            </h4>
                          </div>
                          <p className="text-[13px] text-[#43525F] dark:text-[#B2C3D2] pl-4">
                            {item.description}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={action.handler}
                          className="px-3.5 py-1.5 bg-white dark:bg-[#1E364A] hover:bg-amber-100 dark:hover:bg-[#254661] text-[#1F5F99] dark:text-[#38BDF8] border border-amber-300 dark:border-amber-800 rounded-[6px] text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors shadow-xs"
                        >
                          <span>Fill in profile</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 2. Missing People / Directors */}
            {peopleMissing.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#10212E] dark:text-white">
                  <Users className="w-4 h-4 text-[#1F5F99]" />
                  <span>Directors and Ownership ({peopleMissing.length} missing)</span>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {peopleMissing.map((item: OnboardingChecklistItem) => {
                    const action = getActionForCategory(item);
                    return (
                      <div
                        key={item.id}
                        className="p-4 rounded-[8px] border border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                            <h4 className="font-semibold text-[14px] text-[#10212E] dark:text-white">
                              {item.label}
                            </h4>
                          </div>
                          <p className="text-[13px] text-[#43525F] dark:text-[#B2C3D2] pl-4">
                            {item.description}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={action.handler}
                          className="px-3.5 py-1.5 bg-white dark:bg-[#1E364A] hover:bg-amber-100 dark:hover:bg-[#254661] text-[#1F5F99] dark:text-[#38BDF8] border border-amber-300 dark:border-amber-800 rounded-[6px] text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors shadow-xs"
                        >
                          <span>Balance Directors (100%)</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* 3. Missing Mandatory Documents */}
            {docMissing.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#10212E] dark:text-white">
                  <FileText className="w-4 h-4 text-[#1F5F99]" />
                  <span>Statutory Compliance Documents ({docMissing.length} missing)</span>
                </div>
                <div className="grid grid-cols-1 gap-3">
                  {docMissing.map((item: OnboardingChecklistItem) => {
                    const action = getActionForCategory(item);
                    return (
                      <div
                        key={item.id}
                        className="p-4 rounded-[8px] border border-amber-200 dark:border-amber-900/60 bg-amber-50/50 dark:bg-amber-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                            <h4 className="font-semibold text-[14px] text-[#10212E] dark:text-white">
                              {item.label}
                            </h4>
                          </div>
                          <p className="text-[13px] text-[#43525F] dark:text-[#B2C3D2] pl-4">
                            {item.description}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={action.handler}
                          className="px-3.5 py-1.5 bg-white dark:bg-[#1E364A] hover:bg-amber-100 dark:hover:bg-[#254661] text-[#1F5F99] dark:text-[#38BDF8] border border-amber-300 dark:border-amber-800 rounded-[6px] text-xs font-semibold inline-flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors shadow-xs"
                        >
                          <span>Upload Document</span>
                          <ArrowRight className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
