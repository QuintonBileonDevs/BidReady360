import React, { useEffect, useState, useCallback } from 'react';
import { Loader2, AlertCircle, Receipt } from 'lucide-react';
import { buyerApi } from '../../services/api';

function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString('en-BW', { year: 'numeric', month: 'short', day: 'numeric' });
}

export const BuyerBilling: React.FC = () => {
  const [billing, setBilling] = useState<Awaited<ReturnType<typeof buyerApi.getBilling>> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadBilling = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await buyerApi.getBilling();
      setBilling(data);
    } catch (err: any) {
      setBilling(null);
      setError(err?.message || 'We could not load your organization billing and usage records.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadBilling();
  }, [loadBilling]);

  const sub = billing?.subscription || null;
  const usage = billing?.usage || { callsPublishedThisYear: 0, activeSeatsUsed: 0 };
  const invoices = billing?.invoices || [];

  const callsPct =
    sub?.maxCallsPerYear && sub.maxCallsPerYear > 0
      ? Math.min(100, Math.round((usage.callsPublishedThisYear / sub.maxCallsPerYear) * 100))
      : 0;
  const seatsPct =
    sub?.maxUsers && sub.maxUsers > 0
      ? Math.min(100, Math.round((usage.activeSeatsUsed / sub.maxUsers) * 100))
      : 0;

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#D5E0EA] dark:border-[#244157]">
        <div className="space-y-1">
          <h1 className="font-heading font-semibold text-[30px] leading-tight text-[#10212E] dark:text-white">
            Subscription &amp; usage allowance
          </h1>
          <p className="text-[15px] text-[#43525F] dark:text-[#D3E3F2]">
            Monitor annual call quotas, evaluator seat allocations, and persisted billing invoices.
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="bg-white dark:bg-[#1C364B] rounded-[12px] border border-[#D5E0EA] dark:border-[#244157] p-8 flex items-center justify-center gap-3 text-[#6B7A87] dark:text-[#9CB4C9]">
          <Loader2 className="w-5 h-5 animate-spin text-[#1F5F99] dark:text-[#6FAEE0]" />
          <span className="text-[14px]">Loading subscription and live usage counters...</span>
        </div>
      ) : error ? (
        <div className="bg-white dark:bg-[#1C364B] rounded-[12px] border border-rose-200 dark:border-rose-900 p-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-[14px] text-rose-700 dark:text-rose-300">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={loadBilling}
            className="px-4 py-2 bg-[#1F5F99] hover:bg-[#184c7a] text-white rounded-[6px] text-[13px] font-medium cursor-pointer shrink-0"
          >
            Retry
          </button>
        </div>
      ) : !sub ? (
        <div className="bg-white dark:bg-[#1C364B] rounded-[12px] border border-[#D5E0EA] dark:border-[#244157] p-8 text-center text-[#6B7A87] text-[14px] dark:text-[#9CB4C9]">
          No active subscription plan found in database.
        </div>
      ) : (
        <div className="space-y-6">
          {/* Active Subscription Card */}
          <div className="bg-white dark:bg-[#1C364B] rounded-[12px] border border-[#D5E0EA] dark:border-[#244157] p-6 space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-[12px] text-[#1F5F99] font-medium bg-[#EAF2FA] px-2 py-0.5 rounded-[4px] capitalize dark:bg-[#162C3D] dark:text-[#6FAEE0]">
                  {sub.status} subscription
                </span>
                <h3 className="font-heading font-semibold text-[22px] text-[#10212E] dark:text-white">
                  {sub.planName}
                </h3>
              </div>
              <div className="text-right">
                <div className="font-heading font-semibold text-[24px] text-[#10212E] dark:text-white tabular-nums">
                  {sub.currency} {sub.price.toLocaleString()}{' '}
                  <span className="text-[13px] text-[#6B7A87] font-normal dark:text-[#9CB4C9]">/ {sub.billingInterval}</span>
                </div>
                <span className="text-[12px] text-[#2F8F5B]">
                  {sub.currentPeriodEnd
                    ? `Current period ends ${formatDate(sub.currentPeriodEnd)}`
                    : 'Standard organization allocation'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-4 border-t border-[#D5E0EA] dark:border-[#244157] text-[14px]">
              <div className="p-4 bg-[#F7FAFD] dark:bg-[#10212E] rounded-[8px] space-y-2">
                <div className="flex items-center justify-between text-[12px] text-[#6B7A87] dark:text-[#9CB4C9]">
                  <span>Tender calls created this year</span>
                  <span className="tabular-nums font-semibold text-[#10212E] dark:text-white">
                    {usage.callsPublishedThisYear}
                    {sub.maxCallsPerYear !== null ? ` / ${sub.maxCallsPerYear}` : ' (Unlimited)'}
                  </span>
                </div>
                <div className="h-2 w-full bg-[#EAF2FA] dark:bg-[#244157] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#1F5F99] transition-all"
                    style={{ width: sub.maxCallsPerYear !== null ? `${callsPct}%` : '100%' }}
                  />
                </div>
              </div>

              <div className="p-4 bg-[#F7FAFD] dark:bg-[#10212E] rounded-[8px] space-y-2">
                <div className="flex items-center justify-between text-[12px] text-[#6B7A87] dark:text-[#9CB4C9]">
                  <span>Active officer &amp; evaluator seats</span>
                  <span className="tabular-nums font-semibold text-[#10212E] dark:text-white">
                    {usage.activeSeatsUsed}
                    {sub.maxUsers !== null ? ` / ${sub.maxUsers}` : ' (Unlimited)'}
                  </span>
                </div>
                <div className="h-2 w-full bg-[#EAF2FA] dark:bg-[#244157] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#2F8F5B] transition-all"
                    style={{ width: sub.maxUsers !== null ? `${seatsPct}%` : '100%' }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Organization Invoices Table */}
          <div className="bg-white dark:bg-[#1C364B] rounded-[12px] border border-[#D5E0EA] dark:border-[#244157] overflow-hidden">
            <div className="p-5 border-b border-[#D5E0EA] dark:border-[#244157] flex items-center gap-2">
              <Receipt className="w-5 h-5 text-[#1F5F99] dark:text-[#6FAEE0]" />
              <h2 className="font-heading font-semibold text-[18px] text-[#10212E] dark:text-white">
                Platform Billing Invoices
              </h2>
            </div>
            {invoices.length === 0 ? (
              <div className="p-8 text-center text-[13px] text-[#6B7A87] dark:text-[#9CB4C9]">
                No billing invoices have been issued to your organization yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[13px] divide-y divide-[#D5E0EA] dark:divide-[#244157]">
                  <thead className="bg-[#F7FAFD] dark:bg-[#10212E] text-[#6B7A87] dark:text-[#9CB4C9]">
                    <tr>
                      <th className="p-3.5">Invoice No</th>
                      <th className="p-3.5">Issued</th>
                      <th className="p-3.5">Due Date</th>
                      <th className="p-3.5">Amount</th>
                      <th className="p-3.5">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D5E0EA] dark:divide-[#244157] text-[#10212E] dark:text-white">
                    {invoices.map((inv) => (
                      <tr key={inv.id}>
                        <td className="p-3.5 tabular-nums font-medium">{inv.invoiceNumber}</td>
                        <td className="p-3.5">{formatDate(inv.issuedAt)}</td>
                        <td className="p-3.5">{formatDate(inv.dueAt)}</td>
                        <td className="p-3.5 tabular-nums font-semibold">
                          {inv.currency} {inv.amount.toLocaleString()}
                        </td>
                        <td className="p-3.5 capitalize">{inv.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
