import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { buyerApi } from '../../services/api';
import { Call } from '../../types';
import {
  PlusCircle,
  Calendar,
  Clock,
  ShieldCheck,
  FileCheck,
  Building2,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Lock,
  AlertCircle,
} from 'lucide-react';

interface BuyerCreateCallWizardProps {
  onFinished: (newCallId: string) => void;
  onCancel: () => void;
}

export const BuyerCreateCallWizard: React.FC<BuyerCreateCallWizardProps> = ({ onFinished, onCancel }) => {
  const { createCall, formTemplates } = useApp();
  const [currentStep, setCurrentStep] = useState(1);
  const [isPublishing, setIsPublishing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [callData, setCallData] = useState({
    callNumber: `GRC/RFP/2026/${Math.floor(10 + Math.random() * 90)}`,
    organizationId: 'org-grc',
    organizationName: 'Gaborone Regional Council',
    title: 'Procurement of Municipal Fleet Maintenance & Heavy Equipment Spare Parts',
    summary: 'Supply of OEM replacement parts, hydraulic servicing, and preventative maintenance for Gaborone Council municipal trucks and graders.',
    type: 'RFP' as Call['type'],
    category: 'Fleet & Heavy Mechanical Works',
    subcategories: ['Hydraulic Parts', 'Mechanical Maintenance', 'Tire Replacements'],
    location: 'Gaborone Central Workshop, Plot 102 G-West',
    estimatedBudgetBWP: 1850000,
    openingDate: '2026-10-02',
    clarificationDeadline: '2026-10-24 17:00 CAT',
    closingDate: '2026-11-04',
    closingTimeCAT: '14:00 CAT',
    daysRemaining: 33,
    status: 'Open' as Call['status'],
    isSealed: true,
    requiredDocumentTypes: [
      'BURS Tax Clearance Certificate',
      'PPRA Registration Certificate',
      'Workers Compensation & Safety Compliance',
      'Public Liability Insurance Policy',
    ],
    formTemplateId: formTemplates[0]?.id || '',
  });

  const availableDocTypes = [
    'CIPA Certificate of Incorporation',
    'BURS Tax Clearance Certificate',
    'PPRA Registration Certificate',
    'Workers Compensation & Safety Compliance',
    'Public Liability Insurance Policy',
    'Audited Financial Statements',
    'Bank Rating Letter',
    'Trading Licence',
  ];

  const handleDocToggle = (docType: string) => {
    if (callData.requiredDocumentTypes.includes(docType)) {
      setCallData({
        ...callData,
        requiredDocumentTypes: callData.requiredDocumentTypes.filter((d) => d !== docType),
      });
    } else {
      setCallData({
        ...callData,
        requiredDocumentTypes: [...callData.requiredDocumentTypes, docType],
      });
    }
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    setErrorMsg(null);

    try {
      const res = await buyerApi.createCall({
        referenceNo: callData.callNumber,
        title: callData.title,
        callType: 'rfp',
        summary: callData.summary,
        description: callData.summary,
        opensAt: new Date().toISOString(),
        closesAt: new Date(Date.now() + 30 * 86400000).toISOString(),
        estimatedValue: callData.estimatedBudgetBWP,
        currency: 'BWP',
        criteria: [
          { name: 'Technical Methodology & Past Performance', weight: 40, maxScore: 100, criterionType: 'scored', isMandatoryGate: false },
          { name: 'Key Personnel Qualifications & OHS Plan', weight: 30, maxScore: 100, criterionType: 'scored', isMandatoryGate: false },
          { name: 'Financial Schedule & Bill of Quantities', weight: 30, maxScore: 100, criterionType: 'scored', isMandatoryGate: false },
        ],
        requiredDocTypeCodes: ['TAX_CLEARANCE', 'PPRA_REGISTRATION', 'WORKERS_COMPENSATION', 'PUBLIC_LIABILITY_INSURANCE'],
      });

      const localId = createCall(callData);
      onFinished(res.callId || localId);
    } catch (err: any) {
      console.error('[PUBLISH CALL ERROR]', err);
      setErrorMsg(err.message || 'Failed to publish tender call.');
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">
            Tender Publishing Studio
          </span>
          <h1 className="text-xl sm:text-2xl font-heading font-bold text-[#10212E]">
            Create Procurement Call / Tender
          </h1>
        </div>
        <button onClick={onCancel} className="text-xs font-semibold text-slate-500 hover:text-slate-900">
          Cancel
        </button>
      </div>

      {/* Stepper header */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs flex items-center justify-between text-xs font-semibold">
        {['1. Basic Info & Type', '2. Deadlines & Security', '3. Vault Documents', '4. Form & Publish'].map((st, idx) => (
          <div
            key={idx}
            className={`flex items-center gap-2 ${
              currentStep === idx + 1
                ? 'text-[#1F5F99] font-bold'
                : currentStep > idx + 1
                ? 'text-[#2F8F5B]'
                : 'text-slate-400'
            }`}
          >
            <span
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] ${
                currentStep === idx + 1
                  ? 'bg-[#1F5F99] text-white'
                  : currentStep > idx + 1
                  ? 'bg-[#2F8F5B] text-white'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              {idx + 1}
            </span>
            <span className="hidden sm:inline">{st}</span>
          </div>
        ))}
      </div>

      {/* Step Content */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 space-y-5 text-xs">
        {/* Step 1 */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <h3 className="font-heading font-bold text-base text-[#10212E]">Step 1: Tender Scope & Identity</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Tender Reference Number</label>
                <input
                  type="text"
                  required
                  value={callData.callNumber}
                  onChange={(e) => setCallData({ ...callData, callNumber: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Procurement Type</label>
                <select
                  value={callData.type}
                  onChange={(e) => setCallData({ ...callData, type: e.target.value as Call['type'] })}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                >
                  <option value="RFP">Request for Proposal (RFP)</option>
                  <option value="EOI">Expression of Interest (EOI)</option>
                  <option value="Registration drive">Supplier Registration Drive</option>
                </select>
              </div>

              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">Tender Title</label>
                <input
                  type="text"
                  required
                  value={callData.title}
                  onChange={(e) => setCallData({ ...callData, title: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">Summary / Objective</label>
                <textarea
                  rows={3}
                  value={callData.summary}
                  onChange={(e) => setCallData({ ...callData, summary: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Primary Sector / Category</label>
                <input
                  type="text"
                  value={callData.category}
                  onChange={(e) => setCallData({ ...callData, category: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Estimated Budget (BWP)</label>
                <input
                  type="number"
                  value={callData.estimatedBudgetBWP}
                  onChange={(e) => setCallData({ ...callData, estimatedBudgetBWP: Number(e.target.value) })}
                  className="w-full p-2 border border-slate-300 rounded-lg font-mono"
                />
              </div>
            </div>
          </div>
        )}

        {/* Step 2 */}
        {currentStep === 2 && (
          <div className="space-y-4">
            <h3 className="font-heading font-bold text-base text-[#10212E]">Step 2: Statutory Deadlines & Encryption</h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Opening Date</label>
                <input
                  type="date"
                  value={callData.openingDate}
                  onChange={(e) => setCallData({ ...callData, openingDate: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Clarification Deadline</label>
                <input
                  type="text"
                  value={callData.clarificationDeadline}
                  onChange={(e) => setCallData({ ...callData, clarificationDeadline: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Closing Date</label>
                <input
                  type="date"
                  value={callData.closingDate}
                  onChange={(e) => setCallData({ ...callData, closingDate: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Closing Time (CAT)</label>
                <input
                  type="text"
                  value={callData.closingTimeCAT}
                  onChange={(e) => setCallData({ ...callData, closingTimeCAT: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg font-mono font-bold"
                />
              </div>

              <div className="sm:col-span-2 pt-2">
                <label className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={callData.isSealed}
                    onChange={(e) => setCallData({ ...callData, isSealed: e.target.checked })}
                    className="rounded border-slate-300 text-[#1F5F99] mt-0.5"
                  />
                  <div className="space-y-0.5">
                    <span className="font-bold text-[#10212E] block">
                      Enforce Encrypted Sealed Tender Vault (Mandatory for competitive RFPs)
                    </span>
                    <p className="text-slate-500">
                      Bids remain locked and cannot be decrypted by council evaluators until the exact closing timestamp.
                    </p>
                  </div>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Step 3 */}
        {currentStep === 3 && (
          <div className="space-y-4">
            <div>
              <h3 className="font-heading font-bold text-base text-[#10212E]">
                Step 3: Standard Document Vault Requirements
              </h3>
              <p className="text-slate-500">
                Suppliers who have already verified these documents in BidReady360 will be able to attach them instantly without re-uploading.
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {availableDocTypes.map((docType) => {
                const isSelected = callData.requiredDocumentTypes.includes(docType);
                return (
                  <div
                    key={docType}
                    onClick={() => handleDocToggle(docType)}
                    className={`p-3.5 rounded-xl border cursor-pointer flex items-center justify-between transition-colors ${
                      isSelected ? 'bg-[#EAF2FA]/50 border-[#1F5F99] text-[#10212E]' : 'bg-slate-50 border-slate-200 text-slate-500'
                    }`}
                  >
                    <span className="font-semibold">{docType}</span>
                    <input
                      type="checkbox"
                      checked={isSelected}
                      readOnly
                      className="rounded border-slate-300 text-[#1F5F99]"
                    />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Step 4 */}
        {currentStep === 4 && (
          <div className="space-y-4">
            <h3 className="font-heading font-bold text-base text-[#10212E]">Step 4: Attach Form Template & Review</h3>

            <div>
              <label className="block font-semibold text-slate-700 mb-1">Attach Questionnaire Form Template</label>
              <select
                value={callData.formTemplateId}
                onChange={(e) => setCallData({ ...callData, formTemplateId: e.target.value })}
                className="w-full p-2.5 border border-slate-300 rounded-lg text-xs font-semibold"
              >
                <option value="">No supplementary questionnaire</option>
                {formTemplates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title} ({t.version} — {t.fields.length} questions)
                  </option>
                ))}
              </select>
            </div>

            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <span className="font-bold text-[#10212E] block">Tender Summary Summary</span>
              <div className="grid grid-cols-2 gap-2 text-slate-600">
                <div>Ref: <strong className="text-slate-800">{callData.callNumber}</strong></div>
                <div>Type: <strong className="text-slate-800">{callData.type}</strong></div>
                <div>Closing: <strong className="text-slate-800">{callData.closingDate} ({callData.closingTimeCAT})</strong></div>
                <div>Mandatory Docs: <strong className="text-slate-800">{callData.requiredDocumentTypes.length} types</strong></div>
              </div>
            </div>
          </div>
        )}

        {/* Buttons */}
        <div className="flex items-center justify-between pt-4 border-t border-slate-200">
          {currentStep > 1 ? (
            <button
              onClick={() => setCurrentStep(currentStep - 1)}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Previous</span>
            </button>
          ) : (
            <div />
          )}

          {currentStep < 4 ? (
            <button
              onClick={() => setCurrentStep(currentStep + 1)}
              className="px-5 py-2.5 bg-[#1F5F99] hover:bg-[#184a77] text-white font-semibold rounded-xl flex items-center gap-1.5"
            >
              <span>Next Step</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handlePublish}
              className="px-6 py-2.5 bg-[#2F8F5B] hover:bg-emerald-700 text-white font-bold rounded-xl flex items-center gap-2 shadow-xs"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Publish Call to Public Portal</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
