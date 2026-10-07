import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { AwardDecision } from '../../types';
import { StatusChip } from '../common/StatusChip';
import {
  Award,
  CheckCircle2,
  FileCheck,
  Send,
  Building2,
  FileText,
  AlertCircle,
  Save,
  Download,
} from 'lucide-react';

export const BuyerAwards: React.FC = () => {
  const { awardDecision, updateAwardDecision, supplier } = useApp();
  const [justificationText, setJustificationText] = useState(awardDecision.justification);
  const [awardAmount, setAwardAmount] = useState(awardDecision.awardedAmountBWP);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleSaveDraft = (e: React.FormEvent) => {
    e.preventDefault();
    updateAwardDecision({
      justification: justificationText,
      awardedAmountBWP: awardAmount,
      status: 'Pending approval',
    });
    showToast('Award decision routed to Head of Tender Board for statutory sign-off.');
  };

  const handleApproveFinal = () => {
    updateAwardDecision({
      status: 'Approved & Published',
    });
    showToast('Contract award approved and published to Botswana Public Procurement Registry.');
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Toast */}
      {toastMessage && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 text-[#2F8F5B] dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 rounded-xl text-xs flex items-center gap-2 shadow-xs">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="card-elevated p-6 sm:p-8 flex flex-wrap items-center justify-between gap-6 border-l-4 border-l-[#1F5F99]">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-[#1F5F99] dark:text-[#6FAEE0] bg-[#EAF2FA] dark:bg-slate-800 px-2.5 py-0.5 rounded-md">
              Contract Award Studio
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">· Statutory Decision & Public Notification</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-heading font-bold text-slate-900 dark:text-white">
            Tender Award Decision & Approval Routing
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
            Formulate statutory award justifications based on evaluation scoring and route for final Tender Board sign-off.
          </p>
        </div>

        <StatusChip status={awardDecision.status} />
      </div>

      {/* Main Award Form */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-6 text-xs">
        <div className="p-4 bg-[#EAF2FA]/50 border border-[#1F5F99]/20 rounded-xl space-y-2">
          <span className="text-[11px] font-bold text-slate-500 uppercase">Target Tender Reference</span>
          <h3 className="font-heading font-bold text-base text-[#10212E]">
            {awardDecision.callNumber} — {awardDecision.callTitle}
          </h3>
        </div>

        <form onSubmit={handleSaveDraft} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Recommended Winning Contractor</label>
              <input
                type="text"
                readOnly
                value={awardDecision.recommendedSupplierName}
                className="w-full p-2.5 bg-slate-50 border border-slate-300 rounded-lg font-bold text-slate-900"
              />
            </div>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Total Contract Award Value (BWP)</label>
              <input
                type="number"
                value={awardAmount}
                onChange={(e) => setAwardAmount(Number(e.target.value))}
                className="w-full p-2.5 bg-white border border-slate-300 rounded-lg font-mono font-bold text-sm text-[#1F5F99]"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block font-semibold text-slate-700 mb-1">
                Statutory Technical & Economic Justification (For Public Record)
              </label>
              <textarea
                rows={4}
                required
                value={justificationText}
                onChange={(e) => setJustificationText(e.target.value)}
                className="w-full p-3 bg-white border border-slate-300 rounded-lg text-xs leading-relaxed text-[#10212E]"
              />
            </div>
          </div>

          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-slate-600">
            <span className="font-bold text-slate-800 block">Governance Sign-off Trail:</span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px]">
              <div>Drafted By: <strong className="text-slate-800">{awardDecision.draftedBy}</strong> ({awardDecision.draftedAt})</div>
              <div>
                Approved By: <strong className="text-slate-800">{awardDecision.approvedBy || 'Pending Town Clerk / Tender Board'}</strong>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-slate-200">
            <button
              type="submit"
              className="px-4 py-2.5 bg-[#1F5F99] hover:bg-[#184a77] text-white font-semibold rounded-xl flex items-center gap-1.5 shadow-xs"
            >
              <Save className="w-4 h-4" />
              <span>Submit for Tender Board Approval</span>
            </button>

            {awardDecision.status !== 'Approved & Published' && (
              <button
                type="button"
                onClick={handleApproveFinal}
                className="px-5 py-2.5 bg-[#2F8F5B] hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center gap-2 shadow-xs"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Simulate Final Tender Board Sign-off</span>
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  );
};
