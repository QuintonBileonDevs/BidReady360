import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { buyerApi } from '../../services/api';
import { Call, Application } from '../../types';
import { BuyerCallsByStageChart, BuyerSpendByCategoryChart } from './BuyerCharts';
import {
  ArrowRight,
  Plus,
} from 'lucide-react';

interface BuyerDashboardProps {
  onNavigate: (tabId: string) => void;
  onSelectCall: (callId: string) => void;
}

export const BuyerDashboard: React.FC<BuyerDashboardProps> = ({
  onNavigate,
  onSelectCall,
}) => {
  const {
    calls: contextCalls,
    applications: contextApps,
    buyerSubRole,
    auditEvents,
    clarifications: contextClarifications,
    profileSummary,
    registeredBuyerOrgName,
  } = useApp();

  const [orgCalls, setOrgCalls] = useState<Call[]>([]);
  const [orgApps, setOrgApps] = useState<Application[]>([]);
  const [orgClarifications, setOrgClarifications] = useState<any[]>([]);
  const [orgAwards, setOrgAwards] = useState<any[]>([]);

  useEffect(() => {
    let active = true;
    Promise.allSettled([
      buyerApi.listCalls(),
      buyerApi.listApplications(),
      buyerApi.listClarifications(),
      buyerApi.listAwards(),
    ]).then(([callsRes, appsRes, clarRes, awardsRes]) => {
      if (!active) return;
      if (callsRes.status === 'fulfilled' && Array.isArray(callsRes.value)) {
        const mappedCalls: Call[] = callsRes.value.map((c: any) => {
          const closesAt = c.closesAt || c.closingDate;
          const daysRemaining = closesAt
            ? Math.ceil((new Date(closesAt).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
            : 0;
          const rawStatus = String(c.status || 'open').toLowerCase();
          const status: Call['status'] =
            rawStatus === 'draft'
              ? 'Draft'
              : rawStatus === 'closed'
              ? 'Closed'
              : rawStatus === 'under evaluation' || rawStatus === 'under_evaluation'
              ? 'Under evaluation'
              : rawStatus === 'awarded'
              ? 'Awarded'
              : 'Open';
          return {
            id: c.id,
            callNumber: c.callNumber || c.referenceNo || '',
            title: c.title || '',
            type: c.type || c.callType || 'RFP',
            organizationId: c.organizationId || '',
            organizationName: c.organizationName || registeredBuyerOrgName || 'Procuring Organization',
            category: c.category || 'General Procurement',
            subcategories: Array.isArray(c.subcategories) ? c.subcategories : [],
            location: c.location || 'Botswana',
            openingDate: c.opensAt ? String(c.opensAt).slice(0, 10) : '',
            clarificationDeadline: c.clarificationDeadline ? String(c.clarificationDeadline).slice(0, 10) : '',
            closingDate: closesAt ? String(closesAt).slice(0, 10) : '',
            closingTimeCAT: c.closingTimeCAT || '16:30 CAT',
            daysRemaining,
            estimatedBudgetBWP: c.estimatedValue || c.estimatedBudgetBWP || undefined,
            isSealed: Boolean(c.isSealed),
            status,
            visibility: c.visibility || 'open',
            summary: c.description || c.summary || '',
            requiredDocumentTypes: c.requiredDocumentTypes || [],
            documentsCount: c.documentsCount || 0,
            applicationsCount: Number(c.bidsCount ?? c.applicationsCount ?? 0),
            addenda: Array.isArray(c.addenda) ? c.addenda : [],
          };
        });
        setOrgCalls(mappedCalls);
      }
      if (appsRes.status === 'fulfilled' && Array.isArray(appsRes.value)) {
        const mappedApps: Application[] = appsRes.value.map((r: any) => ({
          id: r.id,
          callId: r.callId,
          callNumber: r.callNumber || '',
          callTitle: r.callTitle || '',
          callType: r.callType || 'RFP',
          supplierId: r.supplierId,
          supplierName: r.supplierLegalName || r.supplierName || 'Supplier',
          organizationId: r.organizationId,
          organizationName: r.organizationName || '',
          status: r.status || 'Submitted',
          receiptNumber: r.receiptNumber || undefined,
          submittedAt: r.submittedAt
            ? new Date(r.submittedAt).toISOString().slice(0, 10)
            : '',
          sharedDocumentIds: [],
          responses: [],
          timeline: [],
        }));
        setOrgApps(mappedApps);
      }
      if (clarRes.status === 'fulfilled' && Array.isArray(clarRes.value)) {
        setOrgClarifications(clarRes.value);
      }
      if (awardsRes.status === 'fulfilled' && Array.isArray(awardsRes.value)) {
        setOrgAwards(awardsRes.value);
      }
    });
    return () => {
      active = false;
    };
  }, [registeredBuyerOrgName]);

  const calls = orgCalls.length > 0 ? orgCalls : contextCalls;
  const applications = orgApps.length > 0 ? orgApps : contextApps;
  const clarifications = orgClarifications.length > 0 ? orgClarifications : contextClarifications;
  const orgDisplayName =
    profileSummary?.supplierOrOrgName || registeredBuyerOrgName || 'Procuring Organization';

  const pendingApps = useMemo(
    () => applications.filter((a) => a.status === 'Submitted' || a.status === 'Under review'),
    [applications]
  );
  const openCalls = useMemo(
    () => calls.filter((c) => c.status === 'Open'),
    [calls]
  );
  const closingSoonCalls = useMemo(
    () => openCalls.filter((c) => c.daysRemaining >= 0 && c.daysRemaining <= 3),
    [openCalls]
  );
  const closedCalls = useMemo(
    () => calls.filter((c) => c.status === 'Closed'),
    [calls]
  );
  const evalCalls = useMemo(
    () => calls.filter((c) => c.status === 'Under evaluation'),
    [calls]
  );
  const pendingAwards = useMemo(
    () => orgAwards.filter((a) => String(a.status || '').toLowerCase() === 'pending_approval'),
    [orgAwards]
  );
  const unansweredClarifications = useMemo(
    () => clarifications.filter((c: any) => !c.answer && String(c.status || '').toLowerCase() !== 'answered'),
    [clarifications]
  );
  const approvedSuppliersCount = useMemo(
    () => new Set(applications.filter((a) => a.status === 'Approved').map((a) => a.supplierId)).size,
    [applications]
  );
  const totalAwardedBWP = useMemo(
    () =>
      orgAwards
        .filter((a) => String(a.status || '').toLowerCase() === 'approved')
        .reduce((sum, a) => sum + Number(a.awardedAmount || a.awardValue || 0), 0),
    [orgAwards]
  );

  const needsAttentionItems = [
    {
      id: 'att-1',
      count: pendingApps.length,
      label: 'Applications to review',
      sublabel: pendingApps.length > 0 ? `${pendingApps.length} awaiting screening` : 'Queue clear',
      target: 'applications',
      border: 'border-l-[#1F5F99]',
    },
    {
      id: 'att-2',
      count: closingSoonCalls.length,
      label: 'Calls closing within 3 days',
      sublabel: closingSoonCalls[0]?.title || 'No urgent deadlines',
      target: 'calls',
      border: 'border-l-[#E8A33D]',
    },
    {
      id: 'att-3',
      count: closedCalls.length,
      label: 'Bids awaiting opening',
      sublabel: closedCalls[0]?.title || 'No closed tenders',
      target: 'bids-opening',
      border: 'border-l-[#C2412D]',
    },
    {
      id: 'att-4',
      count: evalCalls.length,
      label: 'Calls in evaluation',
      sublabel: evalCalls.length > 0 ? 'Scoring in progress' : 'None active',
      target: 'evaluation',
      border: 'border-l-[#E8A33D]',
    },
    {
      id: 'att-5',
      count: pendingAwards.length,
      label: 'Awards awaiting approval',
      sublabel: pendingAwards.length > 0 ? 'Pending approver sign-off' : 'None pending',
      target: 'awards',
      border: 'border-l-[#1F5F99]',
    },
    {
      id: 'att-6',
      count: unansweredClarifications.length,
      label: 'Unanswered clarifications',
      sublabel: unansweredClarifications.length > 0 ? 'Requires official reply' : 'All answered',
      target: 'clarifications',
      border: 'border-l-[#C2412D]',
    },
  ];

  const avgBidsPerCall =
    calls.length > 0
      ? (calls.reduce((s, c) => s + (c.applicationsCount || 0), 0) / calls.length).toFixed(1)
      : '0.0';

  const keyFigures = [
    { label: 'Active calls', value: String(openCalls.length), change: `${calls.length} total calls` },
    { label: 'Applications received', value: String(applications.length), change: `${pendingApps.length} pending review` },
    { label: 'Unanswered clarifications', value: String(unansweredClarifications.length), change: 'Published on reply' },
    { label: 'Approved suppliers', value: String(approvedSuppliersCount), change: 'Roster admitted' },
    {
      label: 'Awarded value',
      value: totalAwardedBWP >= 1_000_000
        ? `BWP ${(totalAwardedBWP / 1_000_000).toFixed(2)}M`
        : `BWP ${totalAwardedBWP.toLocaleString()}`,
      change: `${orgAwards.filter((a) => String(a.status || '').toLowerCase() === 'approved').length} approved awards`,
    },
    { label: 'Average bids per tender', value: avgBidsPerCall, change: 'Across organization calls' },
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
            {orgDisplayName} · Signed in as <strong>{buyerSubRole}</strong>
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3.5">
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
                <div className="text-[12px] text-[#6B7A87] leading-tight line-clamp-1">
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
          <BuyerCallsByStageChart calls={calls} />
        </div>

        <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 space-y-4">
          <h3 className="font-heading font-semibold text-[18px] text-[#10212E] dark:text-white">
            Value by category
          </h3>
          <BuyerSpendByCategoryChart calls={calls} awards={orgAwards} />
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
                {calls.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-6 text-center text-[13px] text-[#6B7A87]">
                      No procurement calls published yet for {orgDisplayName}.
                    </td>
                  </tr>
                ) : (
                  calls.slice(0, 4).map((c) => {
                    const budgetText = c.estimatedBudgetBWP
                      ? `BWP ${c.estimatedBudgetBWP.toLocaleString()}`
                      : 'Not disclosed';

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
                          {c.closingDate} ({c.daysRemaining >= 0 ? `${c.daysRemaining} days left` : 'Closed'})
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
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* 6. Applications Awaiting Review & Governance */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Panel 1: Applications to review */}
        <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-heading font-semibold text-[18px] text-[#10212E] dark:text-white">
                Applications awaiting review
              </h3>
              <span className="bg-[#EAF2FA] text-[#1F5F99] text-[12px] px-2 py-0.5 rounded-[4px] font-medium">
                {pendingApps.length} pending
              </span>
            </div>

            {pendingApps.length === 0 ? (
              <p className="text-[13px] text-[#6B7A87] py-4">
                No supplier applications awaiting review right now.
              </p>
            ) : (
              <div className="divide-y divide-[#D5E0EA] dark:divide-[#1E364A]">
                {pendingApps.slice(0, 3).map((app) => (
                  <div key={app.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <span className="font-semibold text-[14px] text-[#10212E] dark:text-white block">
                        {app.supplierName}
                      </span>
                      <span className="text-[12px] text-[#6B7A87]">
                        {app.callNumber} · Submitted {app.submittedAt || 'Recently'}
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
            )}
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

        {/* Panel 2: Governance Safeguards & Clarification Queue */}
        <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-heading font-semibold text-[18px] text-[#10212E] dark:text-white">
                Governance safeguards
              </h3>
              <button
                type="button"
                onClick={() => onNavigate('clarifications')}
                className="text-[13px] font-medium text-[#1F5F99] dark:text-[#6FAEE0] hover:underline"
              >
                Clarifications ({unansweredClarifications.length})
              </button>
            </div>

            <div className="p-4 rounded-[8px] bg-[#F7FAFD] dark:bg-[#10212E] space-y-3 text-[14px]">
              <div className="flex items-center justify-between">
                <span className="text-[#43525F] dark:text-[#B2C3D2]">Unanswered clarifications</span>
                <span
                  className={`text-[12px] px-2 py-0.5 rounded-[4px] font-medium ${
                    unansweredClarifications.length > 0
                      ? 'bg-[#FEF2F2] text-[#C2412D]'
                      : 'bg-[#ECFDF5] text-[#2F8F5B]'
                  }`}
                >
                  {unansweredClarifications.length} awaiting reply
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#43525F] dark:text-[#B2C3D2]">Awards pending approval</span>
                <span className="bg-[#FFFBEB] text-[#92400E] text-[12px] px-2 py-0.5 rounded-[4px] font-medium">
                  {pendingAwards.length} pending
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-[#43525F] dark:text-[#B2C3D2]">Cryptographic sealed envelopes</span>
                <span className="bg-[#ECFDF5] text-[#2F8F5B] text-[12px] px-2 py-0.5 rounded-[4px] font-medium">
                  SHA-256 Sealed
                </span>
              </div>
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

      {/* 7. Audit Events Summary */}
      <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 space-y-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="font-heading font-semibold text-[18px] text-[#10212E] dark:text-white">
              Procurement fairness & audit trail
            </h2>
            <p className="text-[13px] text-[#6B7A87]">
              Chronological audit entries recorded for {orgDisplayName}.
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

        {auditEvents.length === 0 ? (
          <p className="text-[13px] text-[#6B7A87] py-2">
            No recent audit events loaded in this session.
          </p>
        ) : (
          <div className="divide-y divide-[#D5E0EA] dark:divide-[#1E364A] text-[13px]">
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
        )}
      </div>
    </div>
  );
};
