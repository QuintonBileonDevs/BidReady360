import React, { useState, useEffect } from 'react';
import { ADMIN_INVOICES } from '../../mockAdminData';
import {
  CreditCard,
  Receipt,
  FileText,
  CheckCircle2,
  Edit3,
  Save,
  X,
  Sliders,
  TrendingUp,
  Percent,
  RotateCcw,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

export interface PlanTier {
  id: string;
  name: string;
  category: string;
  priceBWP: number;
  annualDiscountPercent: number;
  callsAllowance: string;
  description: string;
  subscribersCount: number;
}

const DEFAULT_PLANS: PlanTier[] = [
  {
    id: 'tier-standard',
    name: 'Local Authority',
    category: 'Standard Tier',
    priceBWP: 4500,
    annualDiscountPercent: 10,
    callsAllowance: 'Up to 10 calls / year',
    description: 'For sub-districts and municipal boards managing up to 10 active calls per year.',
    subscribersCount: 7,
  },
  {
    id: 'tier-parastatal',
    name: 'Regional Council / Parastatal',
    category: 'Parastatal Tier',
    priceBWP: 12500,
    annualDiscountPercent: 10,
    callsAllowance: 'Unlimited calls',
    description: 'Unlimited tender calls, multi-evaluator scoring panels, and direct CIPA/BURS roster verification.',
    subscribersCount: 6,
  },
  {
    id: 'tier-enterprise',
    name: 'State-Owned & Corporate',
    category: 'Enterprise Tier',
    priceBWP: 16000,
    annualDiscountPercent: 15,
    callsAllowance: 'Unlimited + priority support',
    description: 'Custom ERP API integration, dedicated account executive, and enterprise SSO authentication.',
    subscribersCount: 3,
  },
];

export const AdminBilling: React.FC = () => {
  const { addAuditEvent } = useApp();

  // Load from localStorage or defaults
  const [plans, setPlans] = useState<PlanTier[]>(() => {
    try {
      const saved = localStorage.getItem('bidready_admin_plans');
      if (saved) {
        return JSON.parse(saved);
      }
    } catch {
      // Fallback
    }
    return DEFAULT_PLANS;
  });

  // Save to localStorage when plans change
  useEffect(() => {
    try {
      localStorage.setItem('bidready_admin_plans', JSON.stringify(plans));
    } catch {
      // Ignore
    }
  }, [plans]);

  // Inline card edit state
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState<number>(0);
  const [editCallsAllowance, setEditCallsAllowance] = useState<string>('');
  const [editDescription, setEditDescription] = useState<string>('');
  const [editReason, setEditReason] = useState<string>('Annual tariff indexation');

  // Bulk / Modal adjustment state
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false);
  const [modalTab, setModalTab] = useState<'individual' | 'indexation'>('individual');
  const [tempModalPrices, setTempModalPrices] = useState<Record<string, number>>({});
  const [indexationPercent, setIndexationPercent] = useState<number>(5);
  const [adjustmentJustification, setAdjustmentJustification] = useState<string>(
    'Statutory review in accordance with Public Procurement Act tariff regulations'
  );

  // Success alert state
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Open inline card editor
  const startEditing = (plan: PlanTier) => {
    setEditingPlanId(plan.id);
    setEditPrice(plan.priceBWP);
    setEditCallsAllowance(plan.callsAllowance);
    setEditDescription(plan.description);
    setEditReason('Annual tariff indexation');
  };

  const cancelEditing = () => {
    setEditingPlanId(null);
  };

  // Quick price modifier for card editor
  const applyQuickPriceOffset = (deltaBWP: number) => {
    setEditPrice((prev) => Math.max(500, prev + deltaBWP));
  };

  const applyQuickPricePercent = (pct: number) => {
    setEditPrice((prev) => Math.round((prev * (1 + pct / 100)) / 100) * 100);
  };

  // Save single card changes
  const savePlanChanges = (planId: string) => {
    const updatedPlan = plans.find((p) => p.id === planId);
    if (!updatedPlan) return;

    const oldPrice = updatedPlan.priceBWP;
    const newPrice = Math.max(0, editPrice);

    setPlans((prev) =>
      prev.map((p) =>
        p.id === planId
          ? {
              ...p,
              priceBWP: newPrice,
              callsAllowance: editCallsAllowance,
              description: editDescription,
            }
          : p
      )
    );

    addAuditEvent({
      action: 'Subscription Pricing Adjusted',
      actorName: 'Lesedi Mokgweetsi',
      actorRole: 'Super Admin',
      organizationName: 'BidReady360 Platform Administration',
      entityType: 'Organization',
      entityId: planId,
      details: `Updated ${updatedPlan.name} monthly tariff from BWP ${oldPrice.toLocaleString()} to BWP ${newPrice.toLocaleString()} (${editReason}).`,
      ipAddress: '168.167.12.89',
    });

    setEditingPlanId(null);
    setSuccessMessage(
      `Pricing for "${updatedPlan.name}" updated to BWP ${newPrice.toLocaleString()} / month.`
    );
    setTimeout(() => setSuccessMessage(null), 5000);
  };

  // Open adjustment modal
  const openAdjustModal = () => {
    const initialMap: Record<string, number> = {};
    plans.forEach((p) => {
      initialMap[p.id] = p.priceBWP;
    });
    setTempModalPrices(initialMap);
    setIsAdjustModalOpen(true);
  };

  // Handle modal price change
  const handleModalPriceChange = (planId: string, val: number) => {
    setTempModalPrices((prev) => ({
      ...prev,
      [planId]: Math.max(0, val),
    }));
  };

  // Apply indexation in modal
  const applyBulkIndexation = (pct: number) => {
    setIndexationPercent(pct);
    const updated: Record<string, number> = {};
    plans.forEach((p) => {
      // Round to nearest 50 BWP
      const calc = Math.round((p.priceBWP * (1 + pct / 100)) / 50) * 50;
      updated[p.id] = calc;
    });
    setTempModalPrices(updated);
  };

  // Save modal changes
  const saveModalPricing = () => {
    const changesSummary: string[] = [];

    setPlans((prev) =>
      prev.map((p) => {
        const newPrice = tempModalPrices[p.id] !== undefined ? tempModalPrices[p.id] : p.priceBWP;
        if (newPrice !== p.priceBWP) {
          changesSummary.push(`${p.name}: BWP ${p.priceBWP.toLocaleString()} → BWP ${newPrice.toLocaleString()}`);
        }
        return {
          ...p,
          priceBWP: newPrice,
        };
      })
    );

    if (changesSummary.length > 0) {
      addAuditEvent({
        action: 'Batch Subscription Pricing Adjusted',
        actorName: 'Lesedi Mokgweetsi',
        actorRole: 'Super Admin',
        organizationName: 'BidReady360 Platform Administration',
        entityType: 'Organization',
        entityId: 'tiers-all',
        details: `Batch adjusted subscription tariffs: ${changesSummary.join('; ')}. Reason: ${adjustmentJustification}.`,
        ipAddress: '168.167.12.89',
      });

      setSuccessMessage(
        `Successfully updated subscription tariffs for ${changesSummary.length} tier(s). Changes are now effective.`
      );
      setTimeout(() => setSuccessMessage(null), 5000);
    }

    setIsAdjustModalOpen(false);
  };

  // Reset to default platform tariffs
  const resetToDefaults = () => {
    if (window.confirm('Reset all subscription plan tariffs to platform statutory defaults?')) {
      setPlans(DEFAULT_PLANS);
      addAuditEvent({
        action: 'Subscription Pricing Reset',
        actorName: 'Lesedi Mokgweetsi',
        actorRole: 'Super Admin',
        organizationName: 'BidReady360 Platform Administration',
        entityType: 'Organization',
        entityId: 'tiers-all',
        details: 'Reset all organization subscription rates to baseline defaults.',
        ipAddress: '168.167.12.89',
      });
      setSuccessMessage('Subscription plan pricing reset to standard platform defaults.');
      setTimeout(() => setSuccessMessage(null), 4000);
    }
  };

  return (
    <div className="space-y-10">
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#D5E0EA] dark:border-[#1E364A]">
        <div className="space-y-1">
          <h1 className="font-heading font-semibold text-[30px] leading-tight text-[#10212E] dark:text-white">
            Billing & revenue operations
          </h1>
          <p className="text-[15px] text-[#43525F] dark:text-[#B2C3D2]">
            Manage procuring organization subscription tiers, per-call billing, and invoice reconciliation.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={openAdjustModal}
            className="px-4 py-2.5 bg-[#1F5F99] hover:bg-[#184c7a] text-white rounded-[6px] text-[14px] font-medium inline-flex items-center gap-2 cursor-pointer transition-colors shadow-sm"
          >
            <Sliders className="w-4 h-4" />
            <span>Adjust plan pricing</span>
          </button>
        </div>
      </div>

      {/* Success Notification */}
      {successMessage && (
        <div className="p-4 rounded-[12px] bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0] flex items-center justify-between gap-3 text-[14px] animate-fade-in">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-[#2F8F5B] shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-[#065F46] hover:opacity-75 text-[14px] cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* 2. Subscription Plans Row (Selected Element Area) */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="font-heading font-semibold text-[22px] text-[#10212E] dark:text-white">
              Active subscription plans
            </h2>
            <p className="text-[14px] text-[#6B7A87]">
              Configured monthly rates and allowances for procuring entities in Botswana.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={resetToDefaults}
              className="text-[13px] text-[#6B7A87] hover:text-[#10212E] dark:hover:text-white inline-flex items-center gap-1 cursor-pointer transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset defaults</span>
            </button>
            <button
              type="button"
              onClick={openAdjustModal}
              className="text-[13px] text-[#1F5F99] dark:text-[#6FAEE0] hover:underline font-medium inline-flex items-center gap-1 cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Adjust all prices</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {plans.map((plan) => {
            const isEditing = editingPlanId === plan.id;
            const annualPrice = Math.round(plan.priceBWP * 12 * (1 - plan.annualDiscountPercent / 100));

            return (
              <div
                key={plan.id}
                className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 space-y-5 flex flex-col justify-between transition-all"
              >
                <div className="space-y-4">
                  {/* Category Chip & Edit Button */}
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] text-[#1F5F99] bg-[#EAF2FA] px-2.5 py-0.5 rounded-[4px] font-medium">
                      {plan.category}
                    </span>
                    {!isEditing && (
                      <button
                        type="button"
                        onClick={() => startEditing(plan)}
                        className="px-2.5 py-1 text-[13px] bg-[#F7FAFD] dark:bg-[#10212E] hover:bg-[#EAF2FA] text-[#1F5F99] dark:text-[#6FAEE0] rounded-[6px] border border-[#D5E0EA] dark:border-[#1E364A] inline-flex items-center gap-1.5 font-medium cursor-pointer transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Adjust price</span>
                      </button>
                    )}
                  </div>

                  <h3 className="font-heading font-semibold text-[20px] text-[#10212E] dark:text-white">
                    {plan.name}
                  </h3>

                  {isEditing ? (
                    /* Inline Card Editing Form */
                    <div className="space-y-4 p-4 bg-[#F7FAFD] dark:bg-[#10212E] rounded-[8px] border border-[#D5E0EA] dark:border-[#1E364A]">
                      {/* Price Field */}
                      <div className="space-y-1.5">
                        <div className="flex items-center justify-between">
                          <label className="text-[13px] font-semibold text-[#10212E] dark:text-white">
                            Monthly rate (BWP)
                          </label>
                          <span className="text-[12px] text-[#6B7A87]">excl. VAT</span>
                        </div>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[14px] font-medium text-[#6B7A87]">
                            BWP
                          </span>
                          <input
                            type="number"
                            value={editPrice}
                            onChange={(e) => setEditPrice(Number(e.target.value))}
                            className="w-full pl-14 pr-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] bg-white dark:bg-[#132635] text-[16px] font-semibold text-[#10212E] dark:text-white tabular-nums focus:outline-none focus:border-[#1F5F99]"
                            min="0"
                            step="500"
                          />
                        </div>

                        {/* Quick Price Buttons */}
                        <div className="flex flex-wrap items-center gap-1.5 pt-1">
                          <button
                            type="button"
                            onClick={() => applyQuickPriceOffset(500)}
                            className="text-[11px] px-2 py-0.5 rounded bg-white dark:bg-[#132635] border border-[#D5E0EA] dark:border-[#1E364A] text-[#43525F] dark:text-[#B2C3D2] hover:border-[#1F5F99] cursor-pointer"
                          >
                            +BWP 500
                          </button>
                          <button
                            type="button"
                            onClick={() => applyQuickPriceOffset(1000)}
                            className="text-[11px] px-2 py-0.5 rounded bg-white dark:bg-[#132635] border border-[#D5E0EA] dark:border-[#1E364A] text-[#43525F] dark:text-[#B2C3D2] hover:border-[#1F5F99] cursor-pointer"
                          >
                            +BWP 1,000
                          </button>
                          <button
                            type="button"
                            onClick={() => applyQuickPricePercent(5)}
                            className="text-[11px] px-2 py-0.5 rounded bg-white dark:bg-[#132635] border border-[#D5E0EA] dark:border-[#1E364A] text-[#43525F] dark:text-[#B2C3D2] hover:border-[#1F5F99] cursor-pointer"
                          >
                            +5%
                          </button>
                          <button
                            type="button"
                            onClick={() => applyQuickPricePercent(-5)}
                            className="text-[11px] px-2 py-0.5 rounded bg-white dark:bg-[#132635] border border-[#D5E0EA] dark:border-[#1E364A] text-[#43525F] dark:text-[#B2C3D2] hover:border-[#1F5F99] cursor-pointer"
                          >
                            -5%
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditPrice(plan.priceBWP)}
                            className="text-[11px] px-2 py-0.5 rounded bg-white dark:bg-[#132635] border border-[#D5E0EA] dark:border-[#1E364A] text-[#6B7A87] hover:text-[#10212E] cursor-pointer"
                          >
                            Reset
                          </button>
                        </div>
                      </div>

                      {/* Calls Allowance */}
                      <div className="space-y-1">
                        <label className="text-[13px] font-semibold text-[#10212E] dark:text-white block">
                          Annual call quota
                        </label>
                        <input
                          type="text"
                          value={editCallsAllowance}
                          onChange={(e) => setEditCallsAllowance(e.target.value)}
                          className="w-full px-3 py-1.5 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] bg-white dark:bg-[#132635] text-[14px] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99]"
                        />
                      </div>

                      {/* Tier description */}
                      <div className="space-y-1">
                        <label className="text-[13px] font-semibold text-[#10212E] dark:text-white block">
                          Tier description
                        </label>
                        <textarea
                          rows={2}
                          value={editDescription}
                          onChange={(e) => setEditDescription(e.target.value)}
                          className="w-full p-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] bg-white dark:bg-[#132635] text-[13px] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99]"
                        />
                      </div>

                      {/* Statutory Rationale */}
                      <div className="space-y-1">
                        <label className="text-[12px] font-semibold text-[#6B7A87] block">
                          Adjustment rationale (for audit log)
                        </label>
                        <input
                          type="text"
                          value={editReason}
                          onChange={(e) => setEditReason(e.target.value)}
                          className="w-full px-3 py-1 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] bg-white dark:bg-[#132635] text-[13px] text-[#43525F] dark:text-[#B2C3D2]"
                          placeholder="e.g. Gazette indexation 2026/27"
                        />
                      </div>

                      {/* Action buttons */}
                      <div className="flex items-center gap-2 pt-2">
                        <button
                          type="button"
                          onClick={() => savePlanChanges(plan.id)}
                          className="flex-1 py-2 bg-[#1F5F99] hover:bg-[#184c7a] text-white text-[13px] font-medium rounded-[6px] inline-flex items-center justify-center gap-1.5 cursor-pointer shadow-sm"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>Save pricing</span>
                        </button>
                        <button
                          type="button"
                          onClick={cancelEditing}
                          className="px-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] text-[#43525F] dark:text-[#B2C3D2] hover:bg-white dark:hover:bg-[#132635] text-[13px] rounded-[6px] cursor-pointer"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* Normal Display View */
                    <div className="space-y-3">
                      <div className="flex items-baseline gap-2">
                        <div className="font-heading font-semibold text-[32px] text-[#10212E] dark:text-white tabular-nums">
                          BWP {plan.priceBWP.toLocaleString()}
                        </div>
                        <span className="text-[14px] text-[#6B7A87] font-normal">/ month</span>
                      </div>

                      <div className="text-[13px] text-[#2F8F5B] bg-[#ECFDF5] px-2.5 py-1 rounded-[4px] inline-block font-medium">
                        BWP {annualPrice.toLocaleString()} / year ({plan.annualDiscountPercent}% annual discount)
                      </div>

                      <div className="text-[13px] font-medium text-[#1F5F99] dark:text-[#6FAEE0]">
                        Quota: {plan.callsAllowance}
                      </div>

                      <p className="text-[14px] text-[#43525F] dark:text-[#B2C3D2] leading-relaxed">
                        {plan.description}
                      </p>
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-[#D5E0EA] dark:border-[#1E364A] flex items-center justify-between text-[13px] text-[#6B7A87]">
                  <span>{plan.subscribersCount} active subscribers</span>
                  {!isEditing && (
                    <button
                      type="button"
                      onClick={() => startEditing(plan)}
                      className="text-[#1F5F99] hover:underline font-medium inline-flex items-center gap-1 cursor-pointer"
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>Adjust rate</span>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. Modal: Adjust Subscription Pricing (All Tiers / Bulk Indexation) */}
      {isAdjustModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] max-w-2xl w-full p-6 sm:p-8 space-y-6 shadow-xl animate-fade-in my-8">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-[#D5E0EA] dark:border-[#1E364A]">
              <div>
                <h3 className="font-heading font-semibold text-[22px] text-[#10212E] dark:text-white">
                  Adjust subscription plan pricing
                </h3>
                <p className="text-[14px] text-[#43525F] dark:text-[#B2C3D2] mt-0.5">
                  Update statutory monthly rates across buyer tiers. Changes update active invoices and contracts.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsAdjustModalOpen(false)}
                className="p-1 text-[#6B7A87] hover:text-[#10212E] dark:hover:text-white rounded-[4px] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Mode Switch Tabs */}
            <div className="flex border-b border-[#D5E0EA] dark:border-[#1E364A] gap-4">
              <button
                type="button"
                onClick={() => setModalTab('individual')}
                className={`pb-2.5 text-[14px] font-semibold border-b-2 cursor-pointer transition-colors ${
                  modalTab === 'individual'
                    ? 'border-[#1F5F99] text-[#1F5F99]'
                    : 'border-transparent text-[#6B7A87] hover:text-[#10212E]'
                }`}
              >
                Manual tier rates
              </button>
              <button
                type="button"
                onClick={() => setModalTab('indexation')}
                className={`pb-2.5 text-[14px] font-semibold border-b-2 cursor-pointer transition-colors flex items-center gap-1.5 ${
                  modalTab === 'indexation'
                    ? 'border-[#1F5F99] text-[#1F5F99]'
                    : 'border-transparent text-[#6B7A87] hover:text-[#10212E]'
                }`}
              >
                <Percent className="w-3.5 h-3.5" />
                <span>Percentage indexation</span>
              </button>
            </div>

            {/* Content for Indexation Mode */}
            {modalTab === 'indexation' && (
              <div className="space-y-4 p-4 rounded-[8px] bg-[#F7FAFD] dark:bg-[#10212E] border border-[#D5E0EA] dark:border-[#1E364A]">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-[14px] font-semibold text-[#10212E] dark:text-white">
                      Across-the-board indexation
                    </span>
                    <p className="text-[13px] text-[#6B7A87]">
                      Apply standard annual inflation or tariff adjustments to all three plans simultaneously.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 pt-2">
                  {[3, 5, 8, 10, -5].map((pct) => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => applyBulkIndexation(pct)}
                      className={`px-3 py-1.5 rounded-[6px] text-[13px] font-semibold transition-colors cursor-pointer ${
                        indexationPercent === pct
                          ? 'bg-[#1F5F99] text-white'
                          : 'bg-white dark:bg-[#132635] border border-[#D5E0EA] dark:border-[#1E364A] text-[#10212E] dark:text-white hover:border-[#1F5F99]'
                      }`}
                    >
                      {pct > 0 ? `+${pct}%` : `${pct}%`}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Rates Table / Inputs */}
            <div className="space-y-3">
              <span className="text-[13px] font-semibold text-[#6B7A87] uppercase tracking-wider block">
                Tier rate comparison
              </span>

              <div className="divide-y divide-[#D5E0EA] dark:divide-[#1E364A] border border-[#D5E0EA] dark:border-[#1E364A] rounded-[8px] overflow-hidden">
                {plans.map((p) => {
                  const currentPrice = p.priceBWP;
                  const newPrice = tempModalPrices[p.id] !== undefined ? tempModalPrices[p.id] : p.priceBWP;
                  const diff = newPrice - currentPrice;
                  const pctChange = currentPrice > 0 ? ((diff / currentPrice) * 100).toFixed(1) : '0';

                  return (
                    <div
                      key={p.id}
                      className="p-4 bg-white dark:bg-[#132635] flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                    >
                      <div className="space-y-0.5 min-w-[200px]">
                        <h4 className="font-semibold text-[15px] text-[#10212E] dark:text-white">
                          {p.name}
                        </h4>
                        <span className="text-[13px] text-[#6B7A87]">
                          Currently BWP {currentPrice.toLocaleString()} / month
                        </span>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="relative w-44">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[13px] font-medium text-[#6B7A87]">
                            BWP
                          </span>
                          <input
                            type="number"
                            value={newPrice}
                            onChange={(e) => handleModalPriceChange(p.id, Number(e.target.value))}
                            className="w-full pl-12 pr-3 py-1.5 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] bg-[#F7FAFD] dark:bg-[#10212E] text-[15px] font-semibold text-[#10212E] dark:text-white tabular-nums text-right focus:outline-none focus:border-[#1F5F99]"
                            min="0"
                            step="500"
                          />
                        </div>

                        <div className="w-24 text-right tabular-nums text-[13px]">
                          {diff !== 0 ? (
                            <span className={diff > 0 ? 'text-[#2F8F5B] font-semibold' : 'text-[#C2412D] font-semibold'}>
                              {diff > 0 ? `+${diff.toLocaleString()}` : diff.toLocaleString()} ({pctChange}%)
                            </span>
                          ) : (
                            <span className="text-[#6B7A87]">Unchanged</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Statutory Reason */}
            <div className="space-y-1.5">
              <label className="text-[13px] font-semibold text-[#10212E] dark:text-white block">
                Administrative rationale (logged in statutory audit trail)
              </label>
              <input
                type="text"
                value={adjustmentJustification}
                onChange={(e) => setAdjustmentJustification(e.target.value)}
                className="w-full px-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] bg-white dark:bg-[#132635] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99]"
                placeholder="e.g. PPRA annual tariff indexing circular 2026/27"
              />
            </div>

            {/* Note & Actions */}
            <div className="pt-2 border-t border-[#D5E0EA] dark:border-[#1E364A] flex flex-col sm:flex-row items-center justify-between gap-4">
              <span className="text-[12px] text-[#6B7A87]">
                Actions are permanently cryptographically sealed in the audit log.
              </span>

              <div className="flex items-center gap-3 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="flex-1 sm:flex-initial px-4 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] text-[#43525F] dark:text-[#B2C3D2] hover:bg-[#F7FAFD] dark:hover:bg-[#10212E] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={saveModalPricing}
                  className="flex-1 sm:flex-initial px-5 py-2 bg-[#1F5F99] hover:bg-[#184c7a] text-white rounded-[6px] text-[14px] font-medium inline-flex items-center justify-center gap-2 cursor-pointer shadow-sm transition-colors"
                >
                  <Save className="w-4 h-4" />
                  <span>Apply adjusted pricing</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Invoices Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading font-semibold text-[22px] text-[#10212E] dark:text-white">
            Recent billing invoices
          </h2>
          <span className="text-[13px] text-[#6B7A87]">
            Automated settlement via BWP direct clearance
          </span>
        </div>

        <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[14px] divide-y divide-[#D5E0EA] dark:divide-[#1E364A]">
              <thead className="bg-[#F7FAFD] dark:bg-[#10212E] text-[#6B7A87] font-medium text-[13px]">
                <tr>
                  <th className="p-4">Invoice #</th>
                  <th className="p-4">Organization</th>
                  <th className="p-4">Billing period</th>
                  <th className="p-4 text-right">Amount</th>
                  <th className="p-4">Due date</th>
                  <th className="p-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D5E0EA] dark:divide-[#1E364A] text-[#10212E] dark:text-white">
                {ADMIN_INVOICES.map((inv) => (
                  <tr key={inv.id} className="hover:bg-[#F7FAFD] dark:hover:bg-[#10212E] transition-colors">
                    <td className="p-4 font-semibold">{inv.invoiceNumber}</td>
                    <td className="p-4 text-[#43525F] dark:text-[#B2C3D2]">{inv.orgName}</td>
                    <td className="p-4 text-[#43525F] dark:text-[#B2C3D2]">{inv.billingPeriod}</td>
                    <td className="p-4 font-semibold tabular-nums text-right">
                      BWP {inv.amountBWP.toLocaleString()}
                    </td>
                    <td className="p-4 tabular-nums text-[#43525F] dark:text-[#B2C3D2]">{inv.dueDate}</td>
                    <td className="p-4">
                      <span
                        className={`text-[12px] px-2.5 py-0.5 rounded-[4px] font-medium ${
                          inv.status === 'Paid'
                            ? 'bg-[#ECFDF5] text-[#2F8F5B]'
                            : inv.status === 'Processing'
                            ? 'bg-[#EAF2FA] text-[#1F5F99]'
                            : 'bg-[#FEF2F2] text-[#C2412D]'
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
