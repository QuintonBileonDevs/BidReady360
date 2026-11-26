import React, { useState, useEffect, useCallback } from 'react';
import { AttentionItem, AdminMetric } from '../../types/admin';
import { adminApi, AdminOverviewResponse } from '../../services/api';
import { AdminGrowthChart, AdminRevenueChart } from './AdminCharts';
import {
  RefreshCw,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';

interface AdminOverviewProps {
  onNavigateTab: (tab: string) => void;
  onApproveOrg?: (orgId: string) => void;
}

function formatShortDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString('en-BW', { year: 'numeric', month: 'short', day: 'numeric' });
}

export const AdminOverview: React.FC<AdminOverviewProps> = ({
  onNavigateTab,
  onApproveOrg,
}) => {
  const [overview, setOverview] = useState<AdminOverviewResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  const fetchOverview = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    setIsRefreshing(true);
    setError(null);
    try {
      const data = await adminApi.getOverview();
      setOverview(data);
    } catch (err: any) {
      setError(err?.message || 'Unable to load platform overview metrics.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchOverview(false);
  }, [fetchOverview]);

  const handleQuickApprove = async (orgId: string, orgName: string) => {
    setApprovingId(orgId);
    setError(null);
    try {
      await adminApi.approveOrganization(orgId);
      onApproveOrg?.(orgId);
      setFeedback(`Approved "${orgName}". Buyer workspace is now active.`);
      setTimeout(() => setFeedback(null), 4000);
      await fetchOverview(true);
    } catch (err: any) {
      setError(err?.message || 'Failed to approve organization.');
    } finally {
      setApprovingId(null);
    }
  };

  const kpis = overview?.kpis;

  const attentionItems: AttentionItem[] = [
    {
      id: 'att-1',
      count: kpis?.pendingOrgsCount ?? 0,
      label: 'Buyer orgs awaiting approval',
      targetTab: 'organizations',
      colorBorder: 'border-l-[#E8A33D]',
    },
    {
      id: 'att-2',
      count: kpis?.verificationQueueCount ?? 0,
      label: 'Pending verifications',
      targetTab: 'verification',
      colorBorder: 'border-l-[#1F5F99]',
    },
    {
      id: 'att-3',
      count: kpis?.lockedUsersCount ?? 0,
      label: 'Locked user accounts',
      targetTab: 'admin-users',
      colorBorder: 'border-l-[#C2412D]',
    },
    {
      id: 'att-4',
      count: kpis?.openRiskFlagsCount ?? 0,
      label: 'Open risk flags',
      targetTab: 'risk-debarments',
      colorBorder: 'border-l-[#C2412D]',
    },
    {
      id: 'att-5',
      count: (kpis?.failedDeliveriesCount ?? 0) + (kpis?.overdueInvoicesCount ?? 0),
      label: 'Failed alerts / overdue bills',
      targetTab: (kpis?.failedDeliveriesCount ?? 0) > 0 ? 'notifications' : 'billing',
      colorBorder: 'border-l-[#E8A33D]',
    },
  ];

  const keyMetrics: AdminMetric[] = [
    {
      id: 'met-1',
      label: 'Active buyer organizations',
      value: String(kpis?.activeOrgsCount ?? 0),
      change: `${kpis?.pendingOrgsCount ?? 0} pending review · ${kpis?.suspendedOrgsCount ?? 0} suspended`,
      isPositive: true,
    },
    {
      id: 'met-2',
      label: 'Registered suppliers',
      value: (kpis?.totalSuppliersCount ?? 0).toLocaleString(),
      change: `${kpis?.verifiedSuppliersCount ?? 0} verified · ${kpis?.pendingSuppliersCount ?? 0} pending`,
      isPositive: true,
    },
    {
      id: 'met-3',
      label: 'Active tender calls',
      value: String(kpis?.activeCallsCount ?? 0),
      change: 'Published, open & evaluating',
      isPositive: true,
    },
    {
      id: 'met-4',
      label: 'Submitted & opened bids',
      value: (kpis?.totalBidsCount ?? 0).toLocaleString(),
      change: `${kpis?.activeDebarmentsCount ?? 0} active debarment order(s)`,
      isPositive: true,
    },
    {
      id: 'met-5',
      label: 'Active users & security',
      value: (kpis?.totalUsersCount ?? 0).toLocaleString(),
      change: `${kpis?.lockedUsersCount ?? 0} locked account(s)`,
      isPositive: (kpis?.lockedUsersCount ?? 0) === 0,
    },
    {
      id: 'met-6',
      label: 'Supplier compliance rate',
      value: `${kpis?.complianceRatePercent ?? 0}%`,
      change: `MRR: BWP ${(kpis?.monthlyMrrBwp ?? 0).toLocaleString()}`,
      isPositive: true,
    },
  ];

  const todayFormatted = new Date().toLocaleDateString('en-BW', {
    weekday: 'long',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });

  const lastUpdatedText = overview?.generatedAt
    ? new Date(overview.generatedAt).toLocaleTimeString('en-BW', { hour: '2-digit', minute: '2-digit' })
    : '—';

  return (
    <div className="space-y-12">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#D5E0EA] dark:border-[#1E364A]">
        <div className="space-y-1">
          <h1 className="font-heading font-semibold text-[30px] leading-tight text-[#10212E] dark:text-white">
            Platform overview
          </h1>
          <p className="text-[15px] text-[#43525F] dark:text-[#B2C3D2]">
            {todayFormatted} · Last updated {lastUpdatedText}
          </p>
        </div>

        <button
          type="button"
          onClick={() => fetchOverview(true)}
          disabled={isRefreshing}
          className="px-4 py-2 border border-[#D5E0EA] dark:border-[#1E364A] text-[#10212E] dark:text-white hover:bg-[#F7FAFD] dark:hover:bg-[#132635] rounded-[6px] text-[15px] font-medium transition-colors inline-flex items-center gap-2 cursor-pointer shrink-0 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-[10px] bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-[#C2412D] dark:text-rose-200 text-[14px] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => fetchOverview(false)}
            className="text-[13px] font-semibold underline cursor-pointer"
          >
            Retry
          </button>
        </div>
      )}

      {feedback && (
        <div className="p-4 rounded-[10px] bg-[#ECFDF5] border border-[#A7F3D0] text-[#065F46] text-[14px] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#2F8F5B] shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {isLoading && !overview ? (
        <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-12 flex items-center justify-center gap-3 text-[#6B7A87]">
          <Loader2 className="w-5 h-5 animate-spin text-[#1F5F99]" />
          <span className="text-[15px]">Loading live platform metrics...</span>
        </div>
      ) : (
        <>
          {/* 2. Needs Attention Row (5 Compact Cards) */}
          <div className="space-y-3">
            <h2 className="font-heading font-semibold text-[22px] text-[#10212E] dark:text-white">
              Needs attention
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
              {attentionItems.map((item) => (
                <div
                  key={item.id}
                  onClick={() => onNavigateTab(item.targetTab)}
                  className={`bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] ${
                    item.count > 0 ? `border-l-4 ${item.colorBorder}` : ''
                  } p-4 flex flex-col justify-between hover:bg-[#F7FAFD] dark:hover:bg-[#10212E] transition-colors cursor-pointer group`}
                >
                  <div className="space-y-1">
                    <div className="font-heading font-semibold text-[28px] text-[#10212E] dark:text-white leading-tight tabular-nums">
                      {item.count}
                    </div>
                    <div className="text-[14px] text-[#43525F] dark:text-[#B2C3D2] leading-snug">
                      {item.label}
                    </div>
                  </div>
                  <div className="pt-3 flex items-center text-[13px] font-medium text-[#1F5F99] dark:text-[#6FAEE0] group-hover:underline">
                    <span>Open queue</span>
                    <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 3. Key Figures (6 Cards) */}
          <div className="space-y-3">
            <h2 className="font-heading font-semibold text-[22px] text-[#10212E] dark:text-white">
              Key figures
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {keyMetrics.map((metric) => (
                <div
                  key={metric.id}
                  className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 space-y-2"
                >
                  <div className="text-[14px] text-[#43525F] dark:text-[#B2C3D2]">
                    {metric.label}
                  </div>
                  <div className="font-heading font-semibold text-[32px] text-[#10212E] dark:text-white tabular-nums leading-none">
                    {metric.value}
                  </div>
                  <div
                    className={`text-[13px] pt-1 ${
                      metric.isPositive ? 'text-[#2F8F5B]' : 'text-[#C2412D]'
                    }`}
                  >
                    {metric.change}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 4. Two Charts Side-by-Side */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
            <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 space-y-4">
              <h3 className="font-heading font-semibold text-[18px] text-[#10212E] dark:text-white">
                Platform growth
              </h3>
              <AdminGrowthChart data={overview?.monthlyGrowth} />
            </div>

            <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 space-y-4">
              <h3 className="font-heading font-semibold text-[18px] text-[#10212E] dark:text-white">
                Invoiced revenue
              </h3>
              <AdminRevenueChart data={overview?.monthlyRevenue} />
            </div>
          </div>

          {/* 5. Three Action Panels Side-by-Side */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
            {/* Panel 1: Organizations awaiting approval */}
            <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-heading font-semibold text-[16px] text-[#10212E] dark:text-white">
                    Organizations awaiting approval
                  </h3>
                  <span className="bg-[#FFFBEB] text-[#92400E] text-[13px] px-2 py-0.5 rounded-[4px] font-medium">
                    {kpis?.pendingOrgsCount ?? 0} pending
                  </span>
                </div>

                <div className="divide-y divide-[#D5E0EA] dark:divide-[#1E364A]">
                  {!overview?.pendingOrgs.length ? (
                    <div className="py-6 text-center text-[13px] text-[#6B7A87]">
                      All buyer organization registrations have been reviewed.
                    </div>
                  ) : (
                    overview.pendingOrgs.slice(0, 3).map((org) => (
                      <div key={org.id} className="py-3 space-y-2">
                        <div>
                          <span className="font-semibold text-[15px] text-[#10212E] dark:text-white block">
                            {org.name}
                          </span>
                          <span className="text-[13px] text-[#6B7A87]">
                            {org.type || 'Procuring entity'} · {formatShortDate(org.createdAt)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            disabled={approvingId === org.id}
                            onClick={() => handleQuickApprove(org.id, org.name)}
                            className="px-3 py-1 bg-[#1F5F99] hover:bg-[#184c7a] text-white text-[13px] font-medium rounded-[4px] transition-colors cursor-pointer disabled:opacity-50"
                          >
                            {approvingId === org.id ? 'Approving...' : 'Approve'}
                          </button>
                          <button
                            type="button"
                            onClick={() => onNavigateTab('organizations')}
                            className="px-3 py-1 border border-[#D5E0EA] text-[#10212E] dark:text-white hover:bg-[#F7FAFD] dark:hover:bg-[#10212E] text-[13px] font-medium rounded-[4px] transition-colors cursor-pointer"
                          >
                            Review
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-[#D5E0EA] dark:border-[#1E364A] mt-4">
                <button
                  type="button"
                  onClick={() => onNavigateTab('organizations')}
                  className="text-[14px] font-medium text-[#1F5F99] dark:text-[#6FAEE0] hover:underline cursor-pointer"
                >
                  View all organizations →
                </button>
              </div>
            </div>

            {/* Panel 2: Verification queue summary */}
            <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-heading font-semibold text-[16px] text-[#10212E] dark:text-white">
                    Verification queue
                  </h3>
                  <span className="bg-[#EAF2FA] text-[#1F5F99] text-[13px] px-2 py-0.5 rounded-[4px] font-medium">
                    {kpis?.verificationQueueCount ?? 0} in queue
                  </span>
                </div>

                <div className="space-y-3 text-[14px]">
                  <div className="p-3 rounded-[8px] bg-[#F7FAFD] dark:bg-[#10212E] flex items-center justify-between">
                    <span className="text-[#43525F] dark:text-[#B2C3D2]">Directors awaiting KYC</span>
                    <span className="font-semibold text-[#10212E] dark:text-white tabular-nums">
                      {kpis?.pendingPeopleCount ?? 0}
                    </span>
                  </div>
                  <div className="p-3 rounded-[8px] bg-[#F7FAFD] dark:bg-[#10212E] flex items-center justify-between">
                    <span className="text-[#43525F] dark:text-[#B2C3D2]">Vault documents pending</span>
                    <span className="font-semibold text-[#10212E] dark:text-white tabular-nums">
                      {kpis?.pendingDocumentsCount ?? 0}
                    </span>
                  </div>
                  <div className="p-3 rounded-[8px] bg-[#F7FAFD] dark:bg-[#10212E] flex items-center justify-between">
                    <span className="text-[#43525F] dark:text-[#B2C3D2]">Suppliers pending review</span>
                    <span className="font-semibold text-[#10212E] dark:text-white tabular-nums">
                      {kpis?.pendingSuppliersCount ?? 0}
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-[#D5E0EA] dark:border-[#1E364A] mt-4">
                <button
                  type="button"
                  onClick={() => onNavigateTab('verification')}
                  className="text-[14px] font-medium text-[#1F5F99] dark:text-[#6FAEE0] hover:underline cursor-pointer"
                >
                  Open verification queue →
                </button>
              </div>
            </div>

            {/* Panel 3: Open risk flags */}
            <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 flex flex-col justify-between">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-heading font-semibold text-[16px] text-[#10212E] dark:text-white">
                    Open risk flags
                  </h3>
                  <span className="bg-[#FEF2F2] text-[#C2412D] text-[13px] px-2 py-0.5 rounded-[4px] font-medium">
                    {kpis?.openRiskFlagsCount ?? 0} active
                  </span>
                </div>

                <div className="divide-y divide-[#D5E0EA] dark:divide-[#1E364A]">
                  {!overview?.openRiskFlags.length ? (
                    <div className="py-6 text-center text-[13px] text-[#6B7A87]">
                      No open risk flags detected.
                    </div>
                  ) : (
                    overview.openRiskFlags.slice(0, 3).map((flag) => (
                      <div key={flag.id} className="py-3 space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold text-[14px] text-[#10212E] dark:text-white truncate">
                            {flag.supplierName}
                          </span>
                          <span
                            className={`text-[12px] px-2 py-0.5 rounded-[4px] font-medium shrink-0 capitalize ${
                              flag.severity === 'high'
                                ? 'bg-[#FEF2F2] text-[#C2412D]'
                                : 'bg-[#FFFBEB] text-[#92400E]'
                            }`}
                          >
                            {flag.severity}
                          </span>
                        </div>
                        <p className="text-[13px] text-[#6B7A87] line-clamp-2">
                          {flag.details?.description || flag.flagType.replace(/_/g, ' ')}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="pt-4 border-t border-[#D5E0EA] dark:border-[#1E364A] mt-4">
                <button
                  type="button"
                  onClick={() => onNavigateTab('risk-debarments')}
                  className="text-[14px] font-medium text-[#1F5F99] dark:text-[#6FAEE0] hover:underline cursor-pointer"
                >
                  Manage risk &amp; debarments →
                </button>
              </div>
            </div>
          </div>

          {/* 6. Recent Audit Trail */}
          <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-heading font-semibold text-[18px] text-[#10212E] dark:text-white">
                Recent audit events
              </h2>
              <button
                type="button"
                onClick={() => onNavigateTab('audit-log')}
                className="text-[14px] font-medium text-[#1F5F99] dark:text-[#6FAEE0] hover:underline cursor-pointer"
              >
                View full audit log →
              </button>
            </div>

            {!overview?.recentAuditEvents.length ? (
              <div className="py-6 text-center text-[13px] text-[#6B7A87]">
                No audit events recorded yet.
              </div>
            ) : (
              <div className="divide-y divide-[#D5E0EA] dark:divide-[#1E364A] text-[14px]">
                {overview.recentAuditEvents.map((evt) => (
                  <div
                    key={evt.id}
                    className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="w-2 h-2 rounded-full bg-[#1F5F99] shrink-0" />
                      <div className="min-w-0">
                        <span className="text-[#10212E] dark:text-white font-medium mr-2">
                          {evt.action}
                        </span>
                        <span className="text-[#43525F] dark:text-[#B2C3D2] text-[13px] break-words">
                          {evt.details}
                        </span>
                      </div>
                    </div>
                    <div className="text-[13px] text-[#6B7A87] shrink-0">
                      {evt.actorName} · {evt.timestamp}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
};
