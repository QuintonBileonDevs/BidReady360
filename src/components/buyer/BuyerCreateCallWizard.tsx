import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { buyerApi, referenceApi, CategoryTreeNode } from '../../services/api';
import { Call } from '../../types';
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

interface BuyerCreateCallWizardProps {
  onFinished: (newCallId: string) => void;
  onCancel: () => void;
}

const DOC_TYPE_CODE_MAP: Record<string, string> = {
  'CIPA Certificate of Incorporation': 'COMPANY_REGISTRATION',
  'BURS Tax Clearance Certificate': 'TAX_CLEARANCE',
  'PPRA Registration Certificate': 'PPRA_REGISTRATION',
  'Workers Compensation & Safety Compliance': 'WORKERS_COMPENSATION',
  'Public Liability Insurance Policy': 'PUBLIC_LIABILITY_INSURANCE',
  'Audited Financial Statements': 'AUDITED_FINANCIALS',
  'Bank Rating Letter': 'BANK_CONFIRMATION',
  'Trading Licence': 'BUSINESS_LICENCE',
};

const addDaysIsoDate = (days: number): string => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
};

export const BuyerCreateCallWizard: React.FC<BuyerCreateCallWizardProps> = ({ onFinished, onCancel }) => {
  const { createCall, formTemplates, registeredBuyerOrgName, profileSummary } = useApp();
  const [currentStep, setCurrentStep] = useState(1);
  const [isPublishing, setIsPublishing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [categories, setCategories] = useState<{ id: string; name: string }[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [publishMode, setPublishMode] = useState<'open' | 'draft'>('open');
  const [visibility, setVisibility] = useState<'open' | 'approved_suppliers' | 'category_restricted' | 'invite_only'>('open');

  const currentYear = new Date().getUTCFullYear();
  const [callData, setCallData] = useState({
    callNumber: `RFP/${currentYear}/${Math.floor(100 + Math.random() * 900)}`,
    organizationId: '',
    organizationName: profileSummary?.supplierOrOrgName || registeredBuyerOrgName || 'Procuring Organization',
    title: '',
    summary: '',
    type: 'RFP' as Call['type'],
    category: 'General Procurement',
    subcategories: [] as string[],
    location: 'Botswana',
    estimatedBudgetBWP: 1850000,
    openingDate: addDaysIsoDate(0),
    clarificationDeadline: addDaysIsoDate(21),
    closingDate: addDaysIsoDate(30),
    closingTimeCAT: '14:00',
    daysRemaining: 30,
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

  useEffect(() => {
    let mounted = true;
    referenceApi.getCategories()
      .then((tree: CategoryTreeNode[]) => {
        if (!mounted || !Array.isArray(tree)) return;
        const flat: { id: string; name: string }[] = [];
        tree.forEach((node) => {
          if (node.id && node.name) flat.push({ id: node.id, name: node.name });
          if (Array.isArray(node.children)) {
            node.children.forEach((ch) => {
              if (ch.id && ch.name) flat.push({ id: ch.id, name: `${node.name} — ${ch.name}` });
            });
          }
        });
        setCategories(flat);
        if (flat.length > 0) {
          setSelectedCategoryId((prev) => prev || flat[0].id);
          setCallData((prev) => ({
            ...prev,
            category: prev.category === 'General Procurement' ? flat[0].name : prev.category,
          }));
        }
      })
      .catch(() => {});
    return () => {
      mounted = false;
    };
  }, []);

  const availableDocTypes = Object.keys(DOC_TYPE_CODE_MAP);

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
    if (!callData.title.trim() || !callData.callNumber.trim()) {
      setErrorMsg('Tender reference number and title are required.');
      return;
    }

    setIsPublishing(true);
    setErrorMsg(null);

    const mappedType =
      callData.type === 'EOI'
        ? 'eoi'
        : callData.type === 'Registration drive'
        ? 'registration_drive'
        : 'rfp';

    const cleanTime = (callData.closingTimeCAT || '14:00').replace(/\s*CAT.*/i, '').trim() || '14:00';
    const opensIso = new Date(`${callData.openingDate}T08:00:00+02:00`).toISOString();
    const closesIso = new Date(`${callData.closingDate}T${cleanTime.length === 5 ? cleanTime : '14:00'}:00+02:00`).toISOString();
    const clarDateOnly = String(callData.clarificationDeadline || '').slice(0, 10);
    const clarIso = /^\d{4}-\d{2}-\d{2}$/.test(clarDateOnly)
      ? new Date(`${clarDateOnly}T17:00:00+02:00`).toISOString()
      : undefined;

    const requiredDocTypeCodes = callData.requiredDocumentTypes
      .map((name) => DOC_TYPE_CODE_MAP[name])
      .filter(Boolean);

    try {
      const res = await buyerApi.createCall({
        referenceNo: callData.callNumber.trim(),
        title: callData.title.trim(),
        callType: mappedType,
        summary: callData.summary.trim() || callData.title.trim(),
        description: callData.summary.trim() || callData.title.trim(),
        status: publishMode,
        visibility,
        isSealed: callData.isSealed,
        opensAt: opensIso,
        closesAt: closesIso,
        clarificationDeadline: clarIso,
        estimatedValue: Number(callData.estimatedBudgetBWP) || undefined,
        currency: 'BWP',
        categoryIds: selectedCategoryId ? [selectedCategoryId] : [],
        criteria: [
          { name: 'Technical Methodology & Past Performance', weight: 40, maxScore: 100, criterionType: 'scored', isMandatoryGate: false },
          { name: 'Key Personnel Qualifications & OHS Plan', weight: 30, maxScore: 100, criterionType: 'scored', isMandatoryGate: false },
          { name: 'Financial Schedule & Bill of Quantities', weight: 30, maxScore: 100, criterionType: 'scored', isMandatoryGate: false },
        ],
        requiredDocTypeCodes,
      });

      const localId = createCall({
        ...callData,
        status: publishMode === 'draft' ? 'Draft' : 'Open',
      });
      onFinished(res.callId || localId);
    } catch (err: any) {
      console.error('[PUBLISH CALL ERROR]', err);
      setErrorMsg(err?.message || 'Failed to save tender call.');
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
        {['1. Basic Info & Type', '2. Deadlines & Visibility', '3. Vault Documents', '4. Form & Publish'].map((st, idx) => (
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
                <label className="block font-semibold text-slate-700 mb-1">Tender Reference Number *</label>
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
                <label className="block font-semibold text-slate-700 mb-1">Tender Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Supply and Delivery of Civil Infrastructure Materials"
                  value={callData.title}
                  onChange={(e) => setCallData({ ...callData, title: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 mb-1">Summary / Objective</label>
                <textarea
                  rows={3}
                  placeholder="Describe tender scope, deliverables, and key compliance expectations..."
                  value={callData.summary}
                  onChange={(e) => setCallData({ ...callData, summary: e.target.value })}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Primary Sector / Category</label>
                {categories.length > 0 ? (
                  <select
                    value={selectedCategoryId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setSelectedCategoryId(id);
                      const found = categories.find((c) => c.id === id);
                      setCallData({ ...callData, category: found?.name || 'General Procurement' });
                    }}
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  >
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={callData.category}
                    onChange={(e) => setCallData({ ...callData, category: e.target.value })}
                    className="w-full p-2 border border-slate-300 rounded-lg"
                  />
                )}
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
            <h3 className="font-heading font-bold text-base text-[#10212E]">Step 2: Statutory Deadlines, Visibility & Security</h3>

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
                  type="date"
                  value={String(callData.clarificationDeadline).slice(0, 10)}
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
                  placeholder="14:00"
                  className="w-full p-2 border border-slate-300 rounded-lg font-mono font-bold"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Portal Visibility</label>
                <select
                  value={visibility}
                  onChange={(e) => setVisibility(e.target.value as any)}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                >
                  <option value="open">Open Public Tender (Public Portal)</option>
                  <option value="approved_suppliers">Approved Roster Suppliers Only</option>
                  <option value="category_restricted">Category Restricted</option>
                  <option value="invite_only">Invite Only (Restricted Tender)</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Publication Status</label>
                <select
                  value={publishMode}
                  onChange={(e) => setPublishMode(e.target.value as 'open' | 'draft')}
                  className="w-full p-2 border border-slate-300 rounded-lg"
                >
                  <option value="open">Publish Open Immediately</option>
                  <option value="draft">Save as Draft (Internal Review)</option>
                </select>
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
                      Bids remain locked and cannot be decrypted by evaluators until the exact closing timestamp and opening session.
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
                Suppliers with verified documents in BidReady360 can attach them directly from their Document Vault.
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
              <span className="font-bold text-[#10212E] block">Tender Summary</span>
              <div className="grid grid-cols-2 gap-2 text-slate-600">
                <div>Ref: <strong className="text-slate-800">{callData.callNumber}</strong></div>
                <div>Type: <strong className="text-slate-800">{callData.type}</strong></div>
                <div>Status: <strong className="text-slate-800 uppercase">{publishMode}</strong></div>
                <div>Visibility: <strong className="text-slate-800">{visibility.replace('_', ' ')}</strong></div>
                <div>Closing: <strong className="text-slate-800">{callData.closingDate} ({callData.closingTimeCAT} CAT)</strong></div>
                <div>Mandatory Docs: <strong className="text-slate-800">{callData.requiredDocumentTypes.length} types</strong></div>
              </div>
            </div>
            {errorMsg && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 flex items-start gap-2.5 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}
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
              disabled={isPublishing}
              onClick={handlePublish}
              className="px-6 py-2.5 bg-[#2F8F5B] hover:bg-emerald-700 disabled:opacity-50 text-white font-bold rounded-xl flex items-center gap-2 shadow-xs"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>
                {isPublishing
                  ? 'Saving...'
                  : publishMode === 'draft'
                  ? 'Save Call as Draft'
                  : 'Publish Call to Portal'}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
