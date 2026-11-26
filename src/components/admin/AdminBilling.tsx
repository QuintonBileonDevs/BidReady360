import React, { useState, useEffect, useCallback } from 'react';
import {
  CheckCircle2,
  Edit3,
  Save,
  X,
  Sliders,
  Percent,
  RotateCcw,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { adminApi, AdminInvoiceRecord } from '../../services/api';

export interface PlanTier {
  id: string;
  name: string;
  category: string;
  priceBWP: number;
  annualDiscountPercent: number;
  maxCallsPerYear: number | null;
  callsAllowance: string;
  description: string;
  subscribersCount: number;
}

function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString('en-BW', { year: 'numeric', month: 'short', day: 'numeric' });
}

export const AdminBilling: React.FC = () => {
  const [invoices, setInvoices] = useState<AdminInvoiceRecord[]>([]);
  const [plans, setPlans] = useState<PlanTier[]>([]);
  const [isLoadingPlans, setIsLoadingPlans] = useState<boolean>(true);
  const [plansError, setPlansError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const loadBilling = useCallback(async () => {
    setIsLoadingPlans(true);
    setPlansError(null);
    try {
      const data = await adminApi.getBilling();
      const loadedPlans = Array.isArray(data.plans) ? data.plans : [];
      const buyerPlans = loadedPlans.filter((p) => p.audience === 'buyer');
      const sourcePlans = buyerPlans.length > 0 ? buyerPlans : loadedPlans;
      setPlans(
        sourcePlans.map((p) => ({
          id: p.id,
          name: p.name,
          category: p.code || (p.audience === 'buyer' ? 'Buyer Tier' : 'Supplier Tier'),
          priceBWP: Number(p.price) || 0,
          annualDiscountPercent: Number(p.features?.annualDiscountPercent ?? 10),
          maxCallsPerYear: p.maxCallsPerYear ?? null,
          callsAllowance:
            p.maxCallsPerYear === null || p.maxCallsPerYear === undefined
              ? 'Unlimited calls'
              : `Up to ${p.maxCallsPerYear} calls / year`,
          description:
            p.features?.description ||
            `${p.name} (${p.billingInterval || 'monthly'} billing)`,
          subscribersCount: Number(p.subscribersCount ?? 0),
        }))
      );
      setInvoices(Array.isArray(data.invoices) ? data.invoices : []);
    } catch (err: any) {
      setPlans([]);
      setInvoices([]);
      setPlansError(err?.message || 'We could not load billing plans and invoices.');
    } finally {
      setIsLoadingPlans(false);
    }
  }, []);

  useEffect(() => {
    loadBilling();
  }, [loadBilling]);

  // Inline card edit state
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null);
  const [editPrice, setEditPrice] = useState<number>(0);
  const [editMaxCalls, setEditMaxCalls] = useState<string>('');
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

  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const startEditing = (plan: PlanTier) => {
    setEditingPlanId(plan.id);
    setEditPrice(plan.priceBWP);
    setEditMaxCalls(plan.maxCallsPerYear === null ? '' : String(plan.maxCallsPerYear));
    setEditDescription(plan.description);
    setEditReason('Annual tariff indexation');
  };

  const cancelEditing = () => setEditingPlanId(null);

  const applyQuickPriceOffset = (deltaBWP: number) => {
    setEditPrice((prev) => Math.max(0, prev + deltaBWP));
  };

  const applyQuickPricePercent = (pct: number) => {
    setEditPrice((prev) => Math.round((prev * (1 + pct / 100)) / 100) * 100);
  };

  const savePlanChanges = async (planId: string) => {
    const updatedPlan = plans.find((p) => p.id === planId);
    if (!updatedPlan) return;

    const newPrice = Math.max(0, editPrice);
    const parsedMaxCalls = editMaxCalls.trim() === '' ? null : Number(editMaxCalls);

    setIsSaving(true);
    setPlansError(null);
    try {
      await adminApi.updatePlan(planId, {
        price: newPrice,
        maxCallsPerYear: parsedMaxCalls !== null && !isNaN(parsedMaxCalls) ? parsedMaxCalls : null,
        description: editDescription,
        reason: editReason,
      });
      setEditingPlanId(null);
      await loadBilling();
      setSuccessMessage(
        `Saved "${updatedPlan.name}" tariff at BWP ${newPrice.toLocaleString()} / month and logged to audit trail.`
      );
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      setPlansError(err?.message || 'Failed to save subscription plan rate.');
    } finally {
      setIsSaving(false);
    }
  };

  const openAdjustModal = () => {
    const initialMap: Record<string, number> = {};
    plans.forEach((p) => {
      initialMap[p.id] = p.priceBWP;
    });
    setTempModalPrices(initialMap);
    setIsAdjustModalOpen(true);
  };

  const handleModalPriceChange = (planId: string, val: number) => {
    setTempModalPrices((prev) => ({ ...prev, [planId]: Math.max(0, val) }));
  };

  const applyBulkIndexation = (pct: number) => {
    setIndexationPercent(pct);
    const updated: Record<string, number> = {};
    plans.forEach((p) => {
      updated[p.id] = Math.round((p.priceBWP * (1 + pct / 100)) / 50) * 50;
    });
    setTempModalPrices(updated);
  };

  const saveModalPricing = async () => {
    const changedPlans = plans.filter((p) => {
      const next = tempModalPrices[p.id] !== undefined ? tempModalPrices[p.id] : p.priceBWP;
      return next !== p.priceBWP;
    });
    if (changedPlans.length === 0) {
      setIsAdjustModalOpen(false);
      return;
    }

    setIsSaving(true);
    setPlansError(null);
    try {
      await Promise.all(
        changedPlans.map((p) =>
          adminApi.updatePlan(p.id, {
            price: tempModalPrices[p.id],
            reason: adjustmentJustification,
          })
        )
      );
      setIsAdjustModalOpen(false);
      await loadBilling();
      setSuccessMessage(
        `Updated subscription tariffs for ${changedPlans.length} plan(s) in PostgreSQL.`
      );
      setTimeout(() => setSuccessMessage(null), 5000);
    } catch (err: any) {
      setPlansError(err?.message || 'Failed to apply batch plan updates.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#D5E0EA] dark:border-[#244157]">
        <div className="space-y-1">
          <h1 className="font-heading font-semibold text-[30px] leading-tight text-[#10212E] dark:text-white">
            Billing &amp; revenue operations
          </h1>
          <p className="text-[15px] text-[#43525F] dark:text-[#D3E3F2]">
            Manage procuring organization subscription tiers and reconcile platform invoices.
          </p>
        </div>

        <button
          type="button"
          onClick={openAdjustModal}
          disabled={plans.length === 0}
          className="px-4 py-2.5 bg-[#1F5F99] hover:bg-[#184c7a] text-white rounded-[6px] text-[14px] font-medium inline-flex items-center gap-2 cursor-pointer transition-colors shadow-sm disabled:opacity-50"
        >
          <Sliders className="w-4 h-4" />
          <span>Adjust plan pricing</span>
        </button>
      </div>

      {plansError && (
        <div className="p-4 rounded-[10px] bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-[#C2412D] dark:text-rose-200 text-[14px] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{plansError}</span>
          </div>
          <button
            type="button"
            onClick={loadBilling}
            className="text-[13px] font-semibold underline cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {successMessage && (
        <div className="p-4 rounded-[12px] bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0] flex items-center justify-between gap-3 text-[14px] dark:bg-[#2F8F5B]/20 dark:text-[#6EE7B7] dark:border-[#2F8F5B]/40">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-[#2F8F5B] shrink-0" />
            <span>{successMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessMessage(null)}
            className="text-[#065F46] hover:opacity-75 text-[14px] cursor-pointer dark:text-[#6EE7B7]"
          >
            ✕
          </button>
        </div>
      )}

      {/* Subscription Plans */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="font-heading font-semibold text-[22px] text-[#10212E] dark:text-white">
              Active subscription plans
            </h2>
            <p className="text-[14px] text-[#6B7A87] dark:text-[#9CB4C9]">
              Configured monthly rates and annual call allowances stored in PostgreSQL.
            </p>
          </div>

          <button
            type="button"
            onClick={loadBilling}
            className="text-[13px] text-[#6B7A87] hover:text-[#10212E] dark:hover:text-white inline-flex items-center gap-1 cursor-pointer dark:text-[#9CB4C9]"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reload from database</span>
          </button>
        </div>

        {isLoadingPlans ? (
          <div className="bg-white dark:bg-[#1C364B] rounded-[12px] border border-[#D5E0EA] dark:border-[#244157] p-8 flex items-center justify-center gap-3 text-[#6B7A87] dark:text-[#9CB4C9]">
            <Loader2 className="w-5 h-5 animate-spin text-[#1F5F99] dark:text-[#6FAEE0]" />
            <span className="text-[14px]">Loading subscription plans...</span>
          </div>
        ) : plans.length === 0 ? (
          <div className="bg-white dark:bg-[#1C364B] rounded-[12px] border border-[#D5E0EA] dark:border-[#244157] p-8 text-center text-[#6B7A87] text-[14px] dark:text-[#9CB4C9]">
            No subscription plans configured in database.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan) => {
              const isEditing = editingPlanId === plan.id;
              const annualPrice = Math.round(plan.priceBWP * 12 * (1 - plan.annualDiscountPercent / 100));

              return (
                <div
                  key={plan.id}
                  className="bg-white dark:bg-[#1C364B] rounded-[12px] border border-[#D5E0EA] dark:border-[#244157] p-6 space-y-5 flex flex-col justify-between"
                >
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-[12px] text-[#1F5F99] bg-[#EAF2FA] px-2.5 py-0.5 rounded-[4px] font-medium dark:bg-[#162C3D] dark:text-[#6FAEE0]">
                        {plan.category}
                      </span>
                      {!isEditing && (
                        <button
                          type="button"
                          onClick={() => startEditing(plan)}
                          className="px-2.5 py-1 text-[13px] bg-[#F7FAFD] dark:bg-[#10212E] hover:bg-[#EAF2FA] text-[#1F5F99] dark:text-[#6FAEE0] rounded-[6px] border border-[#D5E0EA] dark:border-[#244157] inline-flex items-center gap-1.5 font-medium cursor-pointer dark:hover:bg-[#162C3D]"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          <span>Edit</span>
                        </button>
                      )}
                    </div>

                    <h3 className="font-heading font-semibold text-[20px] text-[#10212E] dark:text-white">
                      {plan.name}
                    </h3>

                    {isEditing ? (
                      <div className="space-y-4 p-4 bg-[#F7FAFD] dark:bg-[#10212E] rounded-[8px] border border-[#D5E0EA] dark:border-[#244157]">
                        <div className="space-y-1.5">
                          <label className="text-[13px] font-semibold block">Monthly rate (BWP)</label>
                          <input
                            type="number"
                            value={editPrice}
                            onChange={(e) => setEditPrice(Number(e.target.value))}
                            className="w-full px-3 py-2 border border-[#D5E0EA] dark:border-[#244157] rounded-[6px] bg-white dark:bg-[#1C364B] text-[15px] font-semibold tabular-nums"
                            min="0"
                            step="100"
                          />
                          <div className="flex flex-wrap gap-1.5 pt-1">
                            <button type="button" onClick={() => applyQuickPriceOffset(500)} className="text-[11px] px-2 py-0.5 rounded border border-[#D5E0EA] cursor-pointer dark:border-[#244157]">+500</button>
                            <button type="button" onClick={() => applyQuickPricePercent(5)} className="text-[11px] px-2 py-0.5 rounded border border-[#D5E0EA] cursor-pointer dark:border-[#244157]">+5%</button>
                            <button type="button" onClick={() => applyQuickPricePercent(-5)} className="text-[11px] px-2 py-0.5 rounded border border-[#D5E0EA] cursor-pointer dark:border-[#244157]">-5%</button>
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[13px] font-semibold block">
                            Max calls / year (blank = unlimited)
                          </label>
                          <input
                            type="number"
                            min="1"
                            value={editMaxCalls}
                            onChange={(e) => setEditMaxCalls(e.target.value)}
                            className="w-full px-3 py-1.5 border border-[#D5E0EA] dark:border-[#244157] rounded-[6px] bg-white dark:bg-[#1C364B] text-[14px]"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[13px] font-semibold block">Tier description</label>
                          <textarea
                            rows={2}
                            value={editDescription}
                            onChange={(e) => setEditDescription(e.target.value)}
                            className="w-full p-2 border border-[#D5E0EA] dark:border-[#244157] rounded-[6px] bg-white dark:bg-[#1C364B] text-[13px]"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[12px] font-semibold text-[#6B7A87] block dark:text-[#9CB4C9]">Audit rationale</label>
                          <input
                            type="text"
                            value={editReason}
                            onChange={(e) => setEditReason(e.target.value)}
                            className="w-full px-3 py-1 border border-[#D5E0EA] dark:border-[#244157] rounded-[6px] bg-white dark:bg-[#1C364B] text-[13px]"
                          />
                        </div>

                        <div className="flex items-center gap-2 pt-2">
                          <button
                            type="button"
                            disabled={isSaving}
                            onClick={() => savePlanChanges(plan.id)}
                            className="flex-1 py-2 bg-[#1F5F99] hover:bg-[#184c7a] text-white text-[13px] font-medium rounded-[6px] inline-flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <Save className="w-3.5 h-3.5" />
                            <span>{isSaving ? 'Saving...' : 'Save'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={cancelEditing}
                            className="px-3 py-2 border border-[#D5E0EA] text-[13px] rounded-[6px] cursor-pointer dark:border-[#244157]"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        <div className="flex items-baseline gap-2">
                          <div className="font-heading font-semibold text-[32px] text-[#10212E] dark:text-white tabular-nums">
                            BWP {plan.priceBWP.toLocaleString()}
                          </div>
                          <span className="text-[14px] text-[#6B7A87] dark:text-[#9CB4C9]">/ month</span>
                        </div>
                        <div className="text-[13px] text-[#2F8F5B] bg-[#ECFDF5] px-2.5 py-1 rounded-[4px] inline-block font-medium dark:bg-[#2F8F5B]/20">
                          BWP {annualPrice.toLocaleString()} / year
                        </div>
                        <div className="text-[13px] font-medium text-[#1F5F99] dark:text-[#6FAEE0]">
                          Quota: {plan.callsAllowance}
                        </div>
                        <p className="text-[14px] text-[#43525F] dark:text-[#D3E3F2] leading-relaxed">
                          {plan.description}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="pt-4 border-t border-[#D5E0EA] dark:border-[#244157] text-[13px] text-[#6B7A87] dark:text-[#9CB4C9]">
                    {plan.subscribersCount} active subscriber{plan.subscribersCount === 1 ? '' : 's'}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Adjust All Pricing Modal */}
      {isAdjustModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#1C364B] rounded-[12px] border border-[#D5E0EA] dark:border-[#244157] max-w-2xl w-full p-6 space-y-6 my-8">
            <div className="flex items-start justify-between pb-4 border-b border-[#D5E0EA] dark:border-[#244157]">
              <div>
                <h3 className="font-heading font-semibold text-[20px]">Adjust subscription plan pricing</h3>
                <p className="text-[13px] text-[#6B7A87] dark:text-[#9CB4C9]">Changes persist to PostgreSQL and log an audit event.</p>
              </div>
              <button type="button" onClick={() => setIsAdjustModalOpen(false)} className="p-1 text-[#6B7A87] cursor-pointer dark:text-[#9CB4C9]">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex border-b border-[#D5E0EA] dark:border-[#244157] gap-4">
              <button
                type="button"
                onClick={() => setModalTab('individual')}
                className={`pb-2 text-[14px] font-semibold border-b-2 cursor-pointer ${
                  modalTab === 'individual' ? 'border-[#1F5F99] text-[#1F5F99]' : 'border-transparent text-[#6B7A87]'
                }`}
              >
                Manual tier rates
              </button>
              <button
                type="button"
                onClick={() => setModalTab('indexation')}
                className={`pb-2 text-[14px] font-semibold border-b-2 cursor-pointer flex items-center gap-1.5 ${
                  modalTab === 'indexation' ? 'border-[#1F5F99] text-[#1F5F99]' : 'border-transparent text-[#6B7A87]'
                }`}
              >
                <Percent className="w-3.5 h-3.5" />
                <span>Percentage indexation</span>
              </button>
            </div>

            {modalTab === 'indexation' && (
              <div className="flex flex-wrap items-center gap-2 p-3 rounded-[8px] bg-[#F7FAFD] dark:bg-[#10212E]">
                {[3, 5, 8, 10, -5].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => applyBulkIndexation(pct)}
                    className={`px-3 py-1.5 rounded-[6px] text-[13px] font-semibold cursor-pointer ${
                      indexationPercent === pct
                        ? 'bg-[#1F5F99] text-white'
                        : 'bg-white dark:bg-[#1C364B] border border-[#D5E0EA] dark:border-[#244157]'
                    }`}
                  >
                    {pct > 0 ? `+${pct}%` : `${pct}%`}
                  </button>
                ))}
              </div>
            )}

            <div className="divide-y divide-[#D5E0EA] dark:divide-[#244157] border border-[#D5E0EA] dark:border-[#244157] rounded-[8px]">
              {plans.map((p) => (
                <div key={p.id} className="p-4 flex items-center justify-between gap-4">
                  <div>
                    <div className="font-semibold text-[14px]">{p.name}</div>
                    <div className="text-[12px] text-[#6B7A87] dark:text-[#9CB4C9]">Current: BWP {p.priceBWP.toLocaleString()}</div>
                  </div>
                  <input
                    type="number"
                    min="0"
                    step="100"
                    value={tempModalPrices[p.id] ?? p.priceBWP}
                    onChange={(e) => handleModalPriceChange(p.id, Number(e.target.value))}
                    className="w-36 px-3 py-1.5 border border-[#D5E0EA] dark:border-[#244157] rounded-[6px] bg-[#F7FAFD] dark:bg-[#10212E] text-right font-semibold tabular-nums"
                  />
                </div>
              ))}
            </div>

            <div className="space-y-1">
              <label className="text-[13px] font-semibold block">Administrative rationale</label>
              <input
                type="text"
                value={adjustmentJustification}
                onChange={(e) => setAdjustmentJustification(e.target.value)}
                className="w-full px-3 py-2 border border-[#D5E0EA] dark:border-[#244157] rounded-[6px] text-[14px] bg-white dark:bg-[#10212E]"
              />
            </div>

            <div className="flex justify-end gap-3 pt-2 border-t border-[#D5E0EA] dark:border-[#244157]">
              <button type="button" onClick={() => setIsAdjustModalOpen(false)} className="px-4 py-2 text-[14px] cursor-pointer">
                Cancel
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={saveModalPricing}
                className="px-5 py-2 bg-[#1F5F99] hover:bg-[#184c7a] text-white rounded-[6px] text-[14px] font-medium inline-flex items-center gap-2 cursor-pointer disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isSaving ? 'Saving...' : 'Apply adjusted pricing'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Platform Invoices Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading font-semibold text-[22px] text-[#10212E] dark:text-white">
            Platform invoices ({invoices.length})
          </h2>
        </div>

        <div className="bg-white dark:bg-[#1C364B] rounded-[12px] border border-[#D5E0EA] dark:border-[#244157] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[14px] divide-y divide-[#D5E0EA] dark:divide-[#244157]">
              <thead className="bg-[#F7FAFD] dark:bg-[#10212E] text-[#6B7A87] font-medium text-[13px] dark:text-[#9CB4C9]">
                <tr>
                  <th className="p-4">Invoice #</th>
                  <th className="p-4">Tenant</th>
                  <th className="p-4">Issued</th>
                  <th className="p-4 text-right">Amount</th>
                  <th className="p-4">Due date</th>
                  <th className="p-4">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D5E0EA] dark:divide-[#244157] text-[#10212E] dark:text-white">
                {invoices.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-[#6B7A87] dark:text-[#9CB4C9]">
                      No platform invoices recorded yet.
                    </td>
                  </tr>
                ) : (
                  invoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-[#F7FAFD] dark:hover:bg-[#10212E]">
                      <td className="p-4 font-semibold">{inv.invoiceNumber}</td>
                      <td className="p-4 text-[#43525F] dark:text-[#D3E3F2]">{inv.orgName}</td>
                      <td className="p-4 tabular-nums text-[#43525F] dark:text-[#D3E3F2]">
                        {formatDate(inv.issuedAt || inv.createdAt)}
                      </td>
                      <td className="p-4 font-semibold tabular-nums text-right">
                        {inv.currency} {inv.amountBWP.toLocaleString()}
                      </td>
                      <td className="p-4 tabular-nums text-[#43525F] dark:text-[#D3E3F2]">
                        {formatDate(inv.dueDate)}
                      </td>
                      <td className="p-4">
                        <span
                          className={`text-[12px] px-2.5 py-0.5 rounded-[4px] font-medium capitalize ${
                            inv.status === 'paid'
                              ? 'bg-[#ECFDF5] text-[#2F8F5B]'
                              : inv.status === 'overdue'
                              ? 'bg-[#FEF2F2] text-[#C2412D]'
                              : 'bg-[#EAF2FA] text-[#1F5F99]'
                          }`}
                        >
                          {inv.status}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};
