import React, { useEffect, useState, useCallback } from 'react';
import { Loader2 } from 'lucide-react';
import { referenceApi } from '../../services/api';

export const BuyerBilling: React.FC = () => {
  const [activePlan, setActivePlan] = useState<{ name: string; price: number; currency: string; maxCallsPerYear: number | null; maxUsers: number | null } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadPlan = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await referenceApi.loadAll();
      if (!data || !Array.isArray(data.plans)) {
        throw new Error('Invalid plans response');
      }
      const buyerPlans = data.plans.filter((p: any) => p.audience === 'buyer');
      const selected = buyerPlans[0] || data.plans[0] || null;
      setActivePlan(
        selected
          ? {
              name: selected.name,
              price: Number(selected.price) || 0,
              currency: selected.currency || 'BWP',
              maxCallsPerYear: selected.maxCallsPerYear ?? null,
              maxUsers: selected.maxUsers ?? null,
            }
          : null
      );
    } catch (err) {
      console.error('Failed to load buyer plan from database:', err);
      setActivePlan(null);
      setError('We could not load this list. Try again.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPlan();
  }, [loadPlan]);

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#D5E0EA] dark:border-[#1E364A]">
        <div className="space-y-1">
          <h1 className="font-heading font-semibold text-[30px] leading-tight text-[#10212E] dark:text-white">
            Subscription & usage allowance
          </h1>
          <p className="text-[15px] text-[#43525F] dark:text-[#B2C3D2]">
            Monitor annual call quotas, evaluator seat allocations, and payment receipts.
          </p>
        </div>
      </div>

      {/* Plan Card */}
      {isLoading ? (
        <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-8 flex items-center justify-center gap-3 text-[#6B7A87]">
          <Loader2 className="w-5 h-5 animate-spin text-[#1F5F99]" />
          <span className="text-[14px]">Loading subscription plan from database...</span>
        </div>
      ) : error ? (
        <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-rose-200 dark:border-rose-900 p-6 flex items-center justify-between gap-4">
          <span className="text-[14px] text-rose-700 dark:text-rose-300">{error}</span>
          <button
            type="button"
            onClick={loadPlan}
            className="px-4 py-2 bg-[#1F5F99] hover:bg-[#184c7a] text-white rounded-[6px] text-[13px] font-medium cursor-pointer shrink-0"
          >
            Retry
          </button>
        </div>
      ) : !activePlan ? (
        <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-8 text-center text-[#6B7A87] text-[14px]">
          No active subscription plan found in database.
        </div>
      ) : (
        <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <span className="text-[12px] text-[#1F5F99] font-medium bg-[#EAF2FA] px-2 py-0.5 rounded-[4px]">
                Active subscription
              </span>
              <h3 className="font-heading font-semibold text-[22px] text-[#10212E] dark:text-white">
                {activePlan.name}
              </h3>
            </div>
            <div className="text-right">
              <div className="font-heading font-semibold text-[24px] text-[#10212E] dark:text-white tabular-nums">
                {activePlan.currency} {activePlan.price.toLocaleString()} <span className="text-[13px] text-[#6B7A87] font-normal">/ month</span>
              </div>
              <span className="text-[12px] text-[#2F8F5B]">Next billing on 1 Nov 2026</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-[#D5E0EA] dark:border-[#1E364A] text-[14px]">
            <div className="p-4 bg-[#F7FAFD] dark:bg-[#10212E] rounded-[8px] space-y-1">
              <span className="text-[12px] text-[#6B7A87] block">Tender calls published</span>
              <div className="font-semibold text-[#10212E] dark:text-white text-[18px] tabular-nums">
                {activePlan.maxCallsPerYear === null ? 'Unlimited calls' : `Up to ${activePlan.maxCallsPerYear} calls / year`}
              </div>
              <div className="h-1.5 w-full bg-[#EAF2FA] rounded-full overflow-hidden">
                <div className="h-full bg-[#1F5F99] w-[56%]" />
              </div>
            </div>

            <div className="p-4 bg-[#F7FAFD] dark:bg-[#10212E] rounded-[8px] space-y-1">
              <span className="text-[12px] text-[#6B7A87] block">Evaluator & officer seats</span>
              <div className="font-semibold text-[#10212E] dark:text-white text-[18px] tabular-nums">
                {activePlan.maxUsers === null ? 'Unlimited seats' : `Up to ${activePlan.maxUsers} seats`}
              </div>
              <div className="h-1.5 w-full bg-[#EAF2FA] rounded-full overflow-hidden">
                <div className="h-full bg-[#2F8F5B] w-[60%]" />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
