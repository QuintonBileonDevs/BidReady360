import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { BuyerCallsByStageChart, BuyerSpendByCategoryChart } from './BuyerCharts';
import {
  FileText,
  Clock,
  Lock,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
  Send,
  Plus,
  ChevronRight,
  ShieldCheck,
  Building2,
  Users,
  Eye,
  Check,
  Bell,
  Sparkles,
} from 'lucide-react';

interface BuyerDashboardProps {
  onNavigate: (tabId: string) => void;
  onSelectCall: (callId: string) => void;
}

export const BuyerDashboard: React.FC<BuyerDashboardProps> = ({
  onNavigate,
  onSelectCall,
}) => {
  const { calls, applications, buyerSubRole, auditEvents, clarifications } = useApp();
  const [notifiedSupplierIds, setNotifiedSupplierIds] = useState<string[]>([]);

  const handleNotify = (supId: string) => {
    setNotifiedSupplierIds((prev) => [...prev, supId]);
  };

  const needsAttentionItems = [
    { id: 'att-1', count: 3, label: 'Applications to review', sublabel: 'Oldest waiting 4 days', target: 'applications', border: 'border-l-[#1F5F99]' },
    { id: 'att-2', count: 1, label: 'Calls closing within 3 days', sublabel: 'Streetlighting tender', target: 'calls', border: 'border-l-[#E8A33D]' },
    { id: 'att-3', count: 1, label: 'Bids awaiting opening', sublabel: 'Municipal culverts RFP', target: 'bids-opening', border: 'border-l-[#C2412D]' },
    { id: 'att-4', count: 2, label: 'Evaluations outstanding', sublabel: '2 evaluator scores pending', target: 'evaluation', border: 'border-l-[#E8A33D]' },
    { id: 'att-5', count: 1, label: 'Awards awaiting approval', sublabel: 'High-mast lighting award', target: 'awards', border: 'border-l-[#1F5F99]' },
    { id: 'att-6', count: 5, label: 'Supplier documents expiring', sublabel: 'Tax & insurance policies', target: 'roster', border: 'border-l-[#E8A33D]' },
    { id: 'att-7', count: 4, label: 'Unanswered clarifications', sublabel: 'Response due in 24h', target: 'clarifications', border: 'border-l-[#C2412D]' },
  ];

  const keyFigures = [
    { label: 'Active calls', value: '4', change: '+1 vs last month' },
    { label: 'Applications this month', value: '47', change: '+18% vs last month' },
    { label: 'Average decision time', value: '6 days', change: 'Target: 10 days' },
    { label: 'Approved suppliers', value: '24', change: '+3 vs last month' },
    { label: 'Awarded this year', value: 'BWP 14.4M', change: '+BWP 2.8M vs last month' },
    { label: 'Average bids per tender', value: '5.2', change: '+0.6 vs last month' },
  ];

  const expiringSupplierDocs = [
    { id: 'exp-1', supplier: 'Kopano Building Supplies', docName: 'Workers compensation policy', expiry: '17 Oct 2026' },
    { id: 'exp-2', supplier: 'Tsodilo Civil Engineering', docName: 'BURS Tax Clearance PIN', expiry: '22 Oct 2026' },
    { id: 'exp-3', supplier: 'Kalahari Electrical & Plant', docName: 'Bank confirmation letter', expiry: '31 Oct 2026' },
  ];

  return (
    <div className="space-y-12">
      {/* 1. Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#D5E0EA] dark:border-[#1E364A]">
        <div className="space-y-1">
          <h1 className="font-heading font-semibold text-[30px] leading-tight text-[#10212E] dark:text-white">
            Dashboard
          </h1>
          <p className="text-[15px] text-[#43525F] dark:text-[#B2C3D2]">
            Gaborone Regional Council · Signed in as <strong>{buyerSubRole}</strong>
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => onNavigate('form-builder')}
            className="px-4 py-2.5 border border-[#D5E0EA] dark:border-[#1E364A] text-[#10212E] dark:text-white hover:bg-[#F7FAFD] dark:hover:bg-[#132635] rounded-[6px] text-[15px] font-medium transition-colors cursor-pointer"
          >
            Form builder
          </button>
          <button
            type="button"
            onClick={() => onNavigate('create-call')}
            className="px-4 py-2.5 bg-[#1F5F99] hover:bg-[#184c7a] text-white rounded-[6px] text-[15px] font-medium transition-colors cursor-pointer flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            <span>Publish call</span>
          </button>
        </div>
      </div>

      {/* 2. Needs Attention Row (Compact Cards) */}
      <div className="space-y-3">
        <h2 className="font-heading font-semibold text-[22px] text-[#10212E] dark:text-white">
          Needs attention
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-3.5">
          {needsAttentionItems.map((item) => (
            <div
              key={item.id}
              onClick={() => onNavigate(item.target)}
              className={`bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] ${
                item.count > 0 ? `border-l-4 ${item.border}` : ''
              } p-3.5 flex flex-col justify-between hover:bg-[#F7FAFD] dark:hover:bg-[#10212E] transition-colors cursor-pointer group`}
            >
              <div className="space-y-1">
                <div className="font-heading font-semibold text-[26px] text-[#10212E] dark:text-white leading-none">
                  {item.count}
                </div>
                <div className="text-[13px] font-medium text-[#10212E] dark:text-white leading-snug">
                  {item.label}
                </div>
                <div className="text-[12px] text-[#6B7A87] leading-tight">
                  {item.sublabel}
                </div>
              </div>
              <div className="pt-2 text-[12px] font-medium text-[#1F5F99] dark:text-[#6FAEE0] group-hover:underline flex items-center gap-1">
                <span>Open</span>
                <ArrowRight className="w-3 h-3" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Key Figures (6 Cards) */}
      <div className="space-y-3">
        <h2 className="font-heading font-semibold text-[22px] text-[#10212E] dark:text-white">
          Key procurement metrics
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {keyFigures.map((fig, idx) => (
            <div
              key={idx}
              className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 space-y-2"
            >
              <div className="text-[14px] text-[#43525F] dark:text-[#B2C3D2]">
                {fig.label}
              </div>
              <div className="font-heading font-semibold text-[32px] text-[#10212E] dark:text-white tabular-nums leading-none">
                {fig.value}
              </div>
              <div className="text-[13px] text-[#2F8F5B] pt-1 font-medium">
                {fig.change}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Two Charts Side-by-Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 space-y-4">
          <h3 className="font-heading font-semibold text-[18px] text-[#10212E] dark:text-white">
            Calls by stage
          </h3>
          <BuyerCallsByStageChart />
        </div>

        <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 space-y-4">
          <h3 className="font-heading font-semibold text-[18px] text-[#10212E] dark:text-white">
            Spend awarded by category
          </h3>
          <BuyerSpendByCategoryChart />
        </div>
      </div>

      {/* 5. Active Calls Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-heading font-semibold text-[22px] text-[#10212E] dark:text-white">
            Active procurement calls
          </h2>
          <button
            type="button"
            onClick={() => onNavigate('calls')}
            className="text-[14px] font-medium text-[#1F5F99] dark:text-[#6FAEE0] hover:underline"
          >
            View all calls →
          </button>
        </div>

        <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[14px] divide-y divide-[#D5E0EA] dark:divide-[#1E364A]">
              <thead className="bg-[#F7FAFD] dark:bg-[#10212E] text-[#6B7A87] font-medium text-[13px]">
                <tr>
                  <th className="p-4">Call reference</th>
                  <th className="p-4">Title</th>
                  <th className="p-4">Type</th>
                  <th className="p-4 text-right">Estimated budget</th>
                  <th className="p-4 text-center">Bids / Apps</th>
                  <th className="p-4">Closing date</th>
                  <th className="p-4">Status</th>
                  <th className="p-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D5E0EA] dark:divide-[#1E364A] text-[#10212E] dark:text-white">
                {calls.slice(0, 4).map((c) => {
                  const budgetText = c.estimatedBudgetBWP
                    ? `BWP ${c.estimatedBudgetBWP.toLocaleString()}`
                    : 'Not applicable';

                  return (
                    <tr key={c.id} className="hover:bg-[#F7FAFD] dark:hover:bg-[#10212E] transition-colors">
                      <td className="p-4 font-semibold text-[#1F5F99] dark:text-[#6FAEE0]">
                        {c.callNumber}
                      </td>
                      <td className="p-4 font-medium max-w-xs line-clamp-1">{c.title}</td>
                      <td className="p-4">
                        <span className="bg-[#EAF2FA] text-[#1F5F99] text-[12px] px-2 py-0.5 rounded-[4px] font-medium">
                          {c.type}
                        </span>
                      </td>
                      <td className="p-4 text-right font-semibold tabular-nums text-[#10212E] dark:text-white">
                        {budgetText}
                      </td>
                      <td className="p-4 text-center tabular-nums font-semibold">
                        {c.applicationsCount}
                      </td>
                      <td className="p-4 tabular-nums text-[#43525F] dark:text-[#B2C3D2]">
                        {c.closingDate} ({c.daysRemaining} days left)
                      </td>
                      <td className="p-4">
                        <span
                          className={`text-[12px] px-2 py-0.5 rounded-[4px] font-medium ${
                            c.status === 'Open'
                              ? 'bg-[#ECFDF5] text-[#2F8F5B]'
                              : c.status === 'Under evaluation'
                              ? 'bg-[#EAF2FA] text-[#1F5F99]'
                              : 'bg-[#FFFBEB] text-[#92400E]'
                          }`}
                        >
                          {c.status}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            onSelectCall(c.id);
                            onNavigate('calls');
                          }}
                          className="px-3 py-1.5 border border-[#D5E0EA] hover:bg-[#F7FAFD] text-[#10212E] dark:text-white text-[13px] font-medium rounded-[4px] cursor-pointer"
                        >
                          Manage
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 6. Two Panels Side-by-Side: Applications to Review & Expiring Docs */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Panel 1: Applications to review */}
        <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-heading font-semibold text-[18px] text-[#10212E] dark:text-white">
                Applications awaiting review
              </h3>
              <span className="bg-[#EAF2FA] text-[#1F5F99] text-[12px] px-2 py-0.5 rounded-[4px] font-medium">
                3 pending
              </span>
            </div>

            <div className="divide-y divide-[#D5E0EA] dark:divide-[#1E364A]">
              {applications.slice(0, 3).map((app) => (
                <div key={app.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="space-y-0.5">
                    <span className="font-semibold text-[14px] text-[#10212E] dark:text-white block">
                      {app.supplierName}
                    </span>
                    <span className="text-[12px] text-[#6B7A87]">
                      {app.callNumber} · Submitted {app.submittedAt} (Waiting 4 days)
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onNavigate('applications')}
                    className="px-3 py-1.5 bg-[#1F5F99] hover:bg-[#184c7a] text-white text-[13px] font-medium rounded-[4px] shrink-0"
                  >
                    Review
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-4 border-t border-[#D5E0EA] dark:border-[#1E364A] mt-4">
            <button
              type="button"
              onClick={() => onNavigate('applications')}
              className="text-[14px] font-medium text-[#1F5F99] dark:text-[#6FAEE0] hover:underline"
            >
              Open review queue →
            </button>
          </div>
        </div>

        {/* Panel 2: Supplier documents expiring */}
        <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-heading font-semibold text-[18px] text-[#10212E] dark:text-white">
                Supplier documents expiring
              </h3>
              <span className="bg-[#FFFBEB] text-[#92400E] text-[12px] px-2 py-0.5 rounded-[4px] font-medium">
                5 expiring soon
              </span>
            </div>

            <div className="divide-y divide-[#D5E0EA] dark:divide-[#1E364A]">
              {expiringSupplierDocs.map((doc) => {
                const isNotified = notifiedSupplierIds.includes(doc.id);
                return (
                  <div key={doc.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <span className="font-semibold text-[14px] text-[#10212E] dark:text-white block">
                        {doc.supplier}
                      </span>
                      <span className="text-[12px] text-[#6B7A87]">
                        {doc.docName} · Expires {doc.expiry}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleNotify(doc.id)}
                      disabled={isNotified}
                      className={`px-3 py-1.5 text-[13px] font-medium rounded-[4px] shrink-0 transition-colors ${
                        isNotified
                          ? 'bg-[#ECFDF5] text-[#2F8F5B]'
                          : 'border border-[#D5E0EA] hover:bg-[#F7FAFD] text-[#10212E] dark:text-white'
                      }`}
                    >
                      {isNotified ? 'Notified ✓' : 'Notify'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-4 border-t border-[#D5E0EA] dark:border-[#1E364A] mt-4">
            <button
              type="button"
              onClick={() => onNavigate('roster')}
              className="text-[14px] font-medium text-[#1F5F99] dark:text-[#6FAEE0] hover:underline"
            >
              Manage supplier roster →
            </button>
          </div>
        </div>
      </div>

      {/* 7. Fairness and Audit Panel */}
      <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="font-heading font-semibold text-[18px] text-[#10212E] dark:text-white">
              Procurement fairness & audit trail
            </h2>
            <p className="text-[13px] text-[#6B7A87]">
              Real-time governance alerts, clarification deadlines, and chronological audit entries.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('audit-log')}
            className="text-[14px] font-medium text-[#1F5F99] dark:text-[#6FAEE0] hover:underline"
          >
            View audit log →
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Left: Fairness safeguards */}
          <div className="p-4 rounded-[8px] bg-[#F7FAFD] dark:bg-[#10212E] space-y-3 text-[14px]">
            <span className="font-semibold text-[#10212E] dark:text-white block">
              Governance safeguards
            </span>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[#43525F] dark:text-[#B2C3D2]">Unanswered clarifications near deadline</span>
                <span className="bg-[#FEF2F2] text-[#C2412D] text-[12px] px-2 py-0.5 rounded-[4px] font-medium">4 due today</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#43525F] dark:text-[#B2C3D2]">Conflict-of-interest declarations</span>
                <span className="bg-[#FFFBEB] text-[#92400E] text-[12px] px-2 py-0.5 rounded-[4px] font-medium">1 pending signature</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#43525F] dark:text-[#B2C3D2]">Cryptographic sealed envelopes</span>
                <span className="bg-[#ECFDF5] text-[#2F8F5B] text-[12px] px-2 py-0.5 rounded-[4px] font-medium">100% SHA-256 Locked</span>
              </div>
            </div>
          </div>

          {/* Right: Recent Audit Events */}
          <div className="space-y-2 text-[13px]">
            <span className="font-semibold text-[#10212E] dark:text-white block text-[14px]">
              Latest audit events
            </span>
            <div className="divide-y divide-[#D5E0EA] dark:divide-[#1E364A]">
              {auditEvents.slice(0, 4).map((evt) => (
                <div key={evt.id} className="py-2 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="font-medium text-[#10212E] dark:text-white block line-clamp-1">
                      {evt.action}: {evt.details}
                    </span>
                    <span className="text-[12px] text-[#6B7A87]">
                      {evt.actorName} · {evt.timestamp}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* 8. Plan Usage */}
      <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <h3 className="font-semibold text-[16px] text-[#10212E] dark:text-white">
            Plan usage & subscription allowance
          </h3>
          <p className="text-[14px] text-[#43525F] dark:text-[#B2C3D2]">
            <strong>14 of 25</strong> annual procurement calls published · <strong>6 of 10</strong> evaluator seats assigned
          </p>
        </div>

        <button
          type="button"
          onClick={() => onNavigate('billing')}
          className="px-4 py-2 border border-[#D5E0EA] dark:border-[#1E364A] text-[#10212E] dark:text-white hover:bg-[#F7FAFD] rounded-[6px] text-[14px] font-medium whitespace-nowrap cursor-pointer"
        >
          Manage subscription & billing →
        </button>
      </div>
    </div>
  );
};
