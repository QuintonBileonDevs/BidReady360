import React, { useState } from 'react';
import { AttentionItem, AdminMetric, PendingOrg, VerificationQueueItem, RiskFlag } from '../../types/admin';
import { AdminGrowthChart, AdminRevenueChart } from './AdminCharts';
import {
  RefreshCw,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ShieldCheck,
  Server,
  Building2,
  FileCheck2,
  Database,
  Check,
  ExternalLink,
} from 'lucide-react';

interface AdminOverviewProps {
  onNavigateTab: (tab: string) => void;
  onApproveOrg: (orgId: string) => void;
}

const DEFAULT_ATTENTION_ITEMS: AttentionItem[] = [
  { id: 'att-1', count: 0, label: 'Organizations awaiting approval', targetTab: 'organizations', colorBorder: 'border-l-[#E8A33D]' },
  { id: 'att-2', count: 0, label: 'Verification queue', targetTab: 'verification', colorBorder: 'border-l-[#1F5F99]' },
  { id: 'att-3', count: 0, label: 'Open risk flags', targetTab: 'risk-debarments', colorBorder: 'border-l-[#C2412D]' },
  { id: 'att-4', count: 0, label: 'Failed deliveries', targetTab: 'notifications', colorBorder: 'border-l-[#E8A33D]' },
  { id: 'att-5', count: 0, label: 'Overdue invoices', targetTab: 'billing', colorBorder: 'border-l-[#C2412D]' },
];

const DEFAULT_KEY_METRICS: AdminMetric[] = [
  { id: 'met-1', label: 'Active organizations', value: '16', change: '+3 this month', isPositive: true },
  { id: 'met-2', label: 'Registered suppliers', value: '1,248', change: '+84 this month', isPositive: true },
  { id: 'met-3', label: 'Published tender calls', value: '42', change: '+12 this week', isPositive: true },
  { id: 'met-4', label: 'Sealed bids in vault', value: '196', change: '100% cryptographic integrity', isPositive: true },
  { id: 'met-5', label: 'Monthly billing MRR', value: 'BWP 214k', change: '+8.4% vs last period', isPositive: true },
  { id: 'met-6', label: 'Statutory compliance rate', value: '94.2%', change: '+1.8% vs benchmark', isPositive: true },
];

export const AdminOverview: React.FC<AdminOverviewProps> = ({
  onNavigateTab,
  onApproveOrg,
}) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState('Just now');
  const [approvedList, setApprovedList] = useState<string[]>([]);
  const [attentionItems] = useState<AttentionItem[]>(DEFAULT_ATTENTION_ITEMS);
  const [keyMetrics] = useState<AdminMetric[]>(DEFAULT_KEY_METRICS);
  const [pendingOrgs] = useState<PendingOrg[]>([]);
  const [verificationQueue] = useState<VerificationQueueItem[]>([]);
  const [riskFlags] = useState<RiskFlag[]>([]);

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
      setLastUpdated('Just now');
    }, 600);
  };

  const handleQuickApprove = (orgId: string) => {
    setApprovedList((prev) => [...prev, orgId]);
    onApproveOrg(orgId);
  };

  return (
    <div className="space-y-12">
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#D5E0EA] dark:border-[#1E364A]">
        <div className="space-y-1">
          <h1 className="font-heading font-semibold text-[30px] leading-tight text-[#10212E] dark:text-white">
            Platform overview
          </h1>
          <p className="text-[15px] text-[#43525F] dark:text-[#B2C3D2]">
            Monday, 5 Oct 2026 · Last updated {lastUpdated}
          </p>
        </div>

        <button
          type="button"
          onClick={handleRefresh}
          className="px-4 py-2 border border-[#D5E0EA] dark:border-[#1E364A] text-[#10212E] dark:text-white hover:bg-[#F7FAFD] dark:hover:bg-[#132635] rounded-[6px] text-[15px] font-medium transition-colors inline-flex items-center gap-2 cursor-pointer shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

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
                <div className="font-heading font-semibold text-[28px] text-[#10212E] dark:text-white leading-tight">
                  {item.count}
                </div>
                <div className="text-[14px] text-[#43525F] dark:text-[#B2C3D2] leading-snug">
                  {item.label}
                </div>
              </div>
              <div className="pt-3 flex items-center text-[13px] font-medium text-[#1F5F99] dark:text-[#6FAEE0] group-hover:underline">
                <span>Resolve now</span>
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
              <div className="text-[13px] text-[#2F8F5B] pt-1">
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
            Growth
          </h3>
          <AdminGrowthChart />
        </div>

        <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 space-y-4">
          <h3 className="font-heading font-semibold text-[18px] text-[#10212E] dark:text-white">
            Revenue by source
          </h3>
          <AdminRevenueChart />
        </div>
      </div>

      {/* 5. Three Panels Side-by-Side */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
        {/* Panel 1: Organizations awaiting approval */}
        <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-heading font-semibold text-[16px] text-[#10212E] dark:text-white">
                Organizations awaiting approval
              </h3>
              <span className="bg-[#FFFBEB] text-[#92400E] text-[13px] px-2 py-0.5 rounded-[4px] font-medium">
                {pendingOrgs.length} pending
              </span>
            </div>

            <div className="divide-y divide-[#D5E0EA] dark:divide-[#1E364A]">
              {pendingOrgs.slice(0, 3).map((org) => (
                <div key={org.id} className="py-3 space-y-2">
                  <div>
                    <span className="font-semibold text-[15px] text-[#10212E] dark:text-white block">
                      {org.name}
                    </span>
                    <span className="text-[13px] text-[#6B7A87]">
                      {org.type} · Submitted {org.submittedDate}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleQuickApprove(org.id)}
                      className="px-3 py-1 bg-[#1F5F99] hover:bg-[#184c7a] text-white text-[13px] font-medium rounded-[4px] transition-colors"
                    >
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => onNavigateTab('organizations')}
                      className="px-3 py-1 border border-[#D5E0EA] text-[#10212E] dark:text-white hover:bg-[#F7FAFD] text-[13px] font-medium rounded-[4px] transition-colors"
                    >
                      Review
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-[#D5E0EA] dark:border-[#1E364A] mt-4">
            <button
              type="button"
              onClick={() => onNavigateTab('organizations')}
              className="text-[14px] font-medium text-[#1F5F99] dark:text-[#6FAEE0] hover:underline"
            >
              View all organizations →
            </button>
          </div>
        </div>

        {/* Panel 2: Verification queue */}
        <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-heading font-semibold text-[16px] text-[#10212E] dark:text-white">
                Verification queue
              </h3>
              <span className="bg-[#EAF2FA] text-[#1F5F99] text-[13px] px-2 py-0.5 rounded-[4px] font-medium">
                14 in queue
              </span>
            </div>

            <div className="divide-y divide-[#D5E0EA] dark:divide-[#1E364A]">
              {verificationQueue.length === 0 ? (
                <div className="py-6 text-center text-[13px] text-[#6B7A87]">
                  No items in verification queue
                </div>
              ) : (
                verificationQueue.slice(0, 3).map((item) => (
                  <div key={item.id} className="py-3 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[14px] text-[#10212E] dark:text-white">
                        {item.checkType}
                      </span>
                      <span className="text-[13px] text-[#6B7A87]">
                        {item.waitingTime}
                      </span>
                    </div>
                    <div className="text-[13px] text-[#43525F] dark:text-[#B2C3D2]">
                      {item.supplierName}
                    </div>
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => onNavigateTab('verification')}
                        className="text-[13px] font-medium text-[#1F5F99] dark:text-[#6FAEE0] hover:underline"
                      >
                        Review document →
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
              onClick={() => onNavigateTab('verification')}
              className="text-[14px] font-medium text-[#1F5F99] dark:text-[#6FAEE0] hover:underline"
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
                {riskFlags.length} active
              </span>
            </div>

            <div className="divide-y divide-[#D5E0EA] dark:divide-[#1E364A]">
              {riskFlags.length === 0 ? (
                <div className="py-6 text-center text-[13px] text-[#6B7A87]">
                  No open risk flags detected
                </div>
              ) : (
                riskFlags.map((flag) => (
                  <div key={flag.id} className="py-3 space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[14px] text-[#10212E] dark:text-white line-clamp-1">
                        {flag.flagType}
                      </span>
                      <span
                        className={`text-[12px] px-2 py-0.5 rounded-[4px] font-medium shrink-0 ${
                          flag.severity === 'High'
                            ? 'bg-[#FEF2F2] text-[#C2412D]'
                            : 'bg-[#FFFBEB] text-[#92400E]'
                        }`}
                      >
                        {flag.severity}
                      </span>
                    </div>
                    <p className="text-[13px] text-[#6B7A87] line-clamp-2">
                      {flag.description}
                    </p>
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => onNavigateTab('risk-debarments')}
                        className="text-[13px] font-medium text-[#1F5F99] dark:text-[#6FAEE0] hover:underline"
                      >
                        Review risk case →
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
              onClick={() => onNavigateTab('risk-debarments')}
              className="text-[14px] font-medium text-[#1F5F99] dark:text-[#6FAEE0] hover:underline"
            >
              Manage risk & debarments →
            </button>
          </div>
        </div>
      </div>

      {/* 6. Platform Health Section */}
      <div className="space-y-4">
        <h2 className="font-heading font-semibold text-[22px] text-[#10212E] dark:text-white">
          Platform health
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Integration Statuses */}
          <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-5 space-y-3">
            <span className="text-[14px] font-semibold text-[#10212E] dark:text-white block">
              Statutory APIs
            </span>
            <div className="space-y-2 text-[14px]">
              <div className="flex items-center justify-between">
                <span className="text-[#43525F] dark:text-[#B2C3D2]">Company registry (CIPA)</span>
                <span className="bg-[#ECFDF5] text-[#2F8F5B] text-[12px] px-2 py-0.5 rounded-[4px] font-medium">Operational</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#43525F] dark:text-[#B2C3D2]">Tax authority (BURS)</span>
                <span className="bg-[#ECFDF5] text-[#2F8F5B] text-[12px] px-2 py-0.5 rounded-[4px] font-medium">Operational</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#43525F] dark:text-[#B2C3D2]">Identity check (Omang)</span>
                <span className="bg-[#ECFDF5] text-[#2F8F5B] text-[12px] px-2 py-0.5 rounded-[4px] font-medium">Operational</span>
              </div>
            </div>
          </div>

          {/* Delivery & Processing */}
          <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-5 space-y-3">
            <span className="text-[14px] font-semibold text-[#10212E] dark:text-white block">
              Communication & AI
            </span>
            <div className="space-y-2 text-[14px]">
              <div className="flex items-center justify-between">
                <span className="text-[#43525F] dark:text-[#B2C3D2]">Document AI OCR</span>
                <span className="bg-[#ECFDF5] text-[#2F8F5B] text-[12px] px-2 py-0.5 rounded-[4px] font-medium">Operational</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#43525F] dark:text-[#B2C3D2]">SMS gateway (Mascom/Orange)</span>
                <span className="bg-[#ECFDF5] text-[#2F8F5B] text-[12px] px-2 py-0.5 rounded-[4px] font-medium">Operational</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#43525F] dark:text-[#B2C3D2]">WhatsApp Business</span>
                <span className="bg-[#ECFDF5] text-[#2F8F5B] text-[12px] px-2 py-0.5 rounded-[4px] font-medium">Operational</span>
              </div>
            </div>
          </div>

          {/* Infrastructure Queues */}
          <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-5 space-y-3">
            <span className="text-[14px] font-semibold text-[#10212E] dark:text-white block">
              Job Queues & Storage
            </span>
            <div className="space-y-2 text-[14px]">
              <div className="flex items-center justify-between">
                <span className="text-[#43525F] dark:text-[#B2C3D2]">Active job queue size</span>
                <span className="font-semibold text-[#10212E] dark:text-white tabular-nums">14 pending</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#43525F] dark:text-[#B2C3D2]">Expiry cron run</span>
                <span className="text-[#6B7A87]">18 mins ago</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#43525F] dark:text-[#B2C3D2]">Vault storage used</span>
                <span className="font-semibold text-[#10212E] dark:text-white tabular-nums">418 GB (21%)</span>
              </div>
            </div>
          </div>

          {/* Integrity & Backup */}
          <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-5 space-y-3">
            <span className="text-[14px] font-semibold text-[#10212E] dark:text-white block">
              Integrity & Backup
            </span>
            <div className="space-y-2 text-[14px]">
              <div className="flex items-center justify-between">
                <span className="text-[#43525F] dark:text-[#B2C3D2]">Last database backup</span>
                <span className="text-[#2F8F5B] font-medium">02:00 CAT (Verified)</span>
              </div>
              <div className="pt-2 border-t border-[#D5E0EA] dark:border-[#1E364A] flex items-center gap-2 text-[13px] text-[#2F8F5B] font-medium">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Audit log integrity: verified, 4 minutes ago</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 7. Recent Activity Feed */}
      <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading font-semibold text-[18px] text-[#10212E] dark:text-white">
            Recent activity
          </h2>
          <button
            type="button"
            onClick={() => onNavigateTab('audit-log')}
            className="text-[14px] font-medium text-[#1F5F99] dark:text-[#6FAEE0] hover:underline"
          >
            View audit log →
          </button>
        </div>

        <div className="divide-y divide-[#D5E0EA] dark:divide-[#1E364A] text-[14px]">
          <div className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-[#2F8F5B]" />
              <span className="text-[#10212E] dark:text-white font-medium">
                Organization approved: National Training Authority
              </span>
            </div>
            <div className="text-[13px] text-[#6B7A87]">
              By Lesedi Mokgweetsi · Today, 08:30 CAT
            </div>
          </div>

          <div className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-[#E8A33D]" />
              <span className="text-[#10212E] dark:text-white font-medium">
                Risk flag created: Joint Venture physical directorship anomaly
              </span>
            </div>
            <div className="text-[13px] text-[#6B7A87]">
              Automated Integrity Service · Today, 07:15 CAT
            </div>
          </div>

          <div className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-[#1F5F99]" />
              <span className="text-[#10212E] dark:text-white font-medium">
                CIPA statutory gateway sync: 42 supplier company profiles updated
              </span>
            </div>
            <div className="text-[13px] text-[#6B7A87]">
              System Scheduler · Today, 04:00 CAT
            </div>
          </div>

          <div className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <div className="flex items-center gap-3">
              <span className="w-2 h-2 rounded-full bg-[#1F5F99]" />
              <span className="text-[#10212E] dark:text-white font-medium">
                Monthly subscription invoices generated for 16 active procuring organizations
              </span>
            </div>
            <div className="text-[13px] text-[#6B7A87]">
              Billing Engine · 1 Oct 2026, 00:01 CAT
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
