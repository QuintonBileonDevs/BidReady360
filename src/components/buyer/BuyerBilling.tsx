import React from 'react';
import { CreditCard, CheckCircle2, Receipt, FileText } from 'lucide-react';

export const BuyerBilling: React.FC = () => {
  const parastatalPrice = React.useMemo(() => {
    try {
      const saved = localStorage.getItem('bidready_admin_plans');
      if (saved) {
        const parsed = JSON.parse(saved);
        const parastatal = parsed.find((p: any) => p.id === 'tier-parastatal');
        if (parastatal?.priceBWP) {
          return parastatal.priceBWP;
        }
      }
    } catch {
      // Fallback
    }
    return 12500;
  }, []);

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
      <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <span className="text-[12px] text-[#1F5F99] font-medium bg-[#EAF2FA] px-2 py-0.5 rounded-[4px]">
              Active subscription
            </span>
            <h3 className="font-heading font-semibold text-[22px] text-[#10212E] dark:text-white">
              Regional Council / Parastatal Tier
            </h3>
          </div>
          <div className="text-right">
            <div className="font-heading font-semibold text-[24px] text-[#10212E] dark:text-white tabular-nums">
              BWP {parastatalPrice.toLocaleString()} <span className="text-[13px] text-[#6B7A87] font-normal">/ month</span>
            </div>
            <span className="text-[12px] text-[#2F8F5B]">Next billing on 1 Nov 2026</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-[#D5E0EA] dark:border-[#1E364A] text-[14px]">
          <div className="p-4 bg-[#F7FAFD] dark:bg-[#10212E] rounded-[8px] space-y-1">
            <span className="text-[12px] text-[#6B7A87] block">Tender calls published</span>
            <div className="font-semibold text-[#10212E] dark:text-white text-[18px] tabular-nums">
              14 of 25 calls used
            </div>
            <div className="h-1.5 w-full bg-[#EAF2FA] rounded-full overflow-hidden">
              <div className="h-full bg-[#1F5F99] w-[56%]" />
            </div>
          </div>

          <div className="p-4 bg-[#F7FAFD] dark:bg-[#10212E] rounded-[8px] space-y-1">
            <span className="text-[12px] text-[#6B7A87] block">Evaluator & officer seats</span>
            <div className="font-semibold text-[#10212E] dark:text-white text-[18px] tabular-nums">
              6 of 10 seats assigned
            </div>
            <div className="h-1.5 w-full bg-[#EAF2FA] rounded-full overflow-hidden">
              <div className="h-full bg-[#2F8F5B] w-[60%]" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
