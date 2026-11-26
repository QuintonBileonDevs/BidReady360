import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { buyerApi } from '../../services/api';
import { StatusChip } from '../common/StatusChip';
import {
  CheckCircle2,
  XCircle,
  AlertCircle,
  Send,
  ShieldAlert,
  FileCheck2,
  Loader2,
  RefreshCw,
} from 'lucide-react';

export const BuyerAwards: React.FC = () => {
  const { currentUser, buyerSubRole } = useApp();

  const [calls, setCalls] = useState<any[]>([]);
  const [selectedCallId, setSelectedCallId] = useState('');
  const [bids, setBids] = useState<any[]>([]);
  const [awards, setAwards] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const [selectedBidId, setSelectedBidId] = useState('');
  const [awardValue, setAwardValue] = useState<number>(0);
  const [justification, setJustification] = useState('');
  const [isSubmittingRec, setIsSubmittingRec] = useState(false);

  const [decisionComments, setDecisionComments] = useState<Record<string, string>>({});
  const [decidingAwardId, setDecidingAwardId] = useState<string | null>(null);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setErrorMessage(null);
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 5000);
  };

  const loadAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const [callsRes, awardsRes, contractsRes] = await Promise.all([
        buyerApi.listCalls().catch(() => []),
        buyerApi.listAwards().catch(() => []),
        buyerApi.listContracts().catch(() => []),
      ]);
      const callList = Array.isArray(callsRes) ? callsRes : [];
      setCalls(callList);
      setAwards(Array.isArray(awardsRes) ? awardsRes : []);
      setContracts(Array.isArray(contractsRes) ? contractsRes : []);
      setSelectedCallId((prev) => (prev && callList.some((c: any) => c.id === prev) ? prev : callList[0]?.id || ''));
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (!selectedCallId) {
      setBids([]);
      return;
    }
    buyerApi
      .listBids(selectedCallId)
      .then((rows) => {
        const opened = (Array.isArray(rows) ? rows : []).filter((b: any) => b.status === 'opened');
        setBids(opened);
        if (opened.length > 0) {
          setSelectedBidId(opened[0].id);
          setAwardValue(Number(opened[0].totalPrice || 0));
        } else {
          setSelectedBidId('');
          setAwardValue(0);
        }
      })
      .catch(() => setBids([]));
  }, [selectedCallId]);

  const selectedBid = bids.find((b) => b.id === selectedBidId);
  const canRecommend = buyerSubRole === 'Org admin' || buyerSubRole === 'Procurement officer';
  const canApprove = buyerSubRole === 'Org admin' || buyerSubRole === 'Approver';

  const handleSelectBid = (bidId: string) => {
    setSelectedBidId(bidId);
    const b = bids.find((item) => item.id === bidId);
    if (b && b.totalPrice != null) {
      setAwardValue(Number(b.totalPrice));
    }
  };

  const handleRecommendAward = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCallId || !selectedBid || !justification.trim() || isSubmittingRec) return;
    setIsSubmittingRec(true);
    setErrorMessage(null);
    try {
      await buyerApi.recommendAward({
        callId: selectedCallId,
        bidId: selectedBid.id,
        supplierId: selectedBid.supplierId,
        awardValue: Number(awardValue),
        justification: justification.trim(),
      });
      setJustification('');
      await loadAll();
      showToast('Award recommendation submitted and routed for independent Approver sign-off.');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Unable to submit award recommendation.');
    } finally {
      setIsSubmittingRec(false);
    }
  };

  const handleDecision = async (awardId: string, decision: 'approved' | 'rejected') => {
    if (decidingAwardId) return;
    setDecidingAwardId(awardId);
    setErrorMessage(null);
    try {
      await buyerApi.approveAward(awardId, decision, (decisionComments[awardId] || '').trim() || undefined);
      await loadAll();
      showToast(
        decision === 'approved'
          ? 'Award approved within delegation authority and contract record issued.'
          : 'Award recommendation rejected and returned to evaluation.'
      );
    } catch (err: any) {
      setErrorMessage(err?.message || 'Unable to record award approval decision.');
    } finally {
      setDecidingAwardId(null);
    }
  };

  const statusLabel = (st: string) => {
    switch (st) {
      case 'pending_approval':
        return 'Pending approval';
      case 'approved':
      case 'issued':
        return 'Approved & Published';
      case 'rejected':
        return 'Rejected';
      default:
        return 'Draft';
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {toastMessage && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 text-[#2F8F5B] dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 rounded-xl text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 text-[#C2412D] dark:text-rose-300 border border-rose-300 dark:border-rose-800 rounded-xl text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="card-elevated p-6 sm:p-8 flex flex-wrap items-center justify-between gap-6 border-l-4 border-l-[#1F5F99]">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs tabular-nums font-bold text-[#1F5F99] dark:text-[#6FAEE0] bg-[#EAF2FA] dark:bg-slate-800 px-2.5 py-0.5 rounded-md">
              Contract Award Studio
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">· Separation of Duties & Delegation Enforcement</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-heading font-bold text-slate-900 dark:text-white">
            Tender Award Decision & Approval Routing
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
            Recommend contract awards from unsealed bids and enforce independent executive sign-off within financial delegation thresholds.
          </p>
        </div>

        <button
          type="button"
          onClick={loadAll}
          disabled={isLoading}
          className="px-3.5 py-2 border border-slate-200 dark:border-slate-700 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {/* Recommend Award Form */}
      <div className="bg-white dark:bg-[#1C364B] border border-slate-200 dark:border-[#244157] rounded-2xl p-6 sm:p-8 space-y-6 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 dark:border-[#244157] pb-3">
          <div>
            <h2 className="font-heading font-bold text-base text-[#10212E] dark:text-white">
              Recommend Contract Award (Opened Bids Only)
            </h2>
            <p className="text-slate-500 dark:text-[#9CB4C9]">Select a tender call with formally unsealed bids to submit a statutory award recommendation.</p>
          </div>
          <select
            value={selectedCallId}
            onChange={(e) => setSelectedCallId(e.target.value)}
            className="p-2 bg-white dark:bg-[#10212E] border border-slate-300 dark:border-[#244157] rounded-lg text-xs font-semibold text-slate-900 dark:text-white"
          >
            {calls.length === 0 && <option value="">No tender calls</option>}
            {calls.map((c) => (
              <option key={c.id} value={c.id}>
                {c.referenceNo} — {c.title}
              </option>
            ))}
          </select>
        </div>

        {bids.length === 0 ? (
          <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl text-amber-900 dark:text-amber-200 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>
              No unsealed bids are available for this tender call yet. Sealed bids must first be opened in a witnessed Bid Opening Session before recommending an award.
            </span>
          </div>
        ) : (
          <form onSubmit={handleRecommendAward} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Recommended Winning Bid & Supplier
                </label>
                <select
                  value={selectedBidId}
                  onChange={(e) => handleSelectBid(e.target.value)}
                  className="w-full p-2.5 bg-white dark:bg-[#10212E] border border-slate-300 dark:border-[#244157] rounded-lg font-semibold text-slate-900 dark:text-white"
                >
                  {bids.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.supplierName} — {b.currency || 'BWP'} {Number(b.totalPrice || 0).toLocaleString()} ({b.receiptNumber || 'Unsealed'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Recommended Award Value (BWP)
                </label>
                <input
                  type="number"
                  min={1}
                  step="0.01"
                  required
                  value={awardValue}
                  onChange={(e) => setAwardValue(Number(e.target.value))}
                  className="w-full p-2.5 bg-white dark:bg-[#10212E] border border-slate-300 dark:border-[#244157] rounded-lg tabular-nums font-bold text-sm text-[#1F5F99] dark:text-[#6FAEE0]"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">
                  Statutory Technical & Economic Justification
                </label>
                <textarea
                  rows={3}
                  required
                  value={justification}
                  onChange={(e) => setJustification(e.target.value)}
                  placeholder="Detail composite evaluation score, technical compliance, and value-for-money rationale..."
                  className="w-full p-3 bg-white dark:bg-[#10212E] border border-slate-300 dark:border-[#244157] rounded-lg text-xs text-[#10212E] dark:text-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end">
              <button
                type="submit"
                disabled={!canRecommend || isSubmittingRec}
                className="px-4 py-2.5 bg-[#1F5F99] hover:bg-[#184a77] disabled:opacity-50 text-white font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                {isSubmittingRec ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                <span>{isSubmittingRec ? 'Submitting...' : 'Submit Award Recommendation'}</span>
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Award Queue & Independent Approval Sign-off */}
      <div className="bg-white dark:bg-[#1C364B] border border-slate-200 dark:border-[#244157] rounded-2xl p-6 sm:p-8 space-y-5 text-xs">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-heading font-bold text-base text-[#10212E] dark:text-white">
              Submitted Award Recommendations ({awards.length})
            </h2>
            <p className="text-slate-500 dark:text-[#9CB4C9]">
              Statutory separation of duties prevents the recommending officer from approving their own submission.
            </p>
          </div>
        </div>

        {isLoading ? (
          <div className="py-8 text-center text-slate-400">Loading award ledger...</div>
        ) : awards.length === 0 ? (
          <div className="py-8 text-center text-slate-400">No award recommendations recorded for your organization yet.</div>
        ) : (
          <div className="space-y-4">
            {awards.map((aw) => {
              const isSelfDrafter = currentUser?.id && aw.recommendedByUserId === currentUser.id;
              const isPending = aw.status === 'pending_approval';
              return (
                <div
                  key={aw.id}
                  className="p-5 rounded-xl border border-slate-200 dark:border-[#244157] bg-slate-50/50 dark:bg-[#10212E]/50 space-y-3"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="tabular-nums font-bold text-[#1F5F99] dark:text-[#6FAEE0]">{aw.callNumber}</span>
                        <span className="text-slate-400">·</span>
                        <span className="font-bold text-sm text-[#10212E] dark:text-white">{aw.supplierName}</span>
                      </div>
                      <div className="text-slate-600 dark:text-slate-300 mt-0.5">{aw.callTitle}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="tabular-nums font-bold text-sm text-[#10212E] dark:text-white">
                        {aw.currency || 'BWP'} {Number(aw.awardValue || 0).toLocaleString()}
                      </span>
                      <StatusChip status={statusLabel(aw.status)} />
                    </div>
                  </div>

                  {aw.justification && (
                    <p className="text-slate-700 dark:text-slate-300 bg-white dark:bg-[#1C364B] p-3 rounded-lg border border-slate-200 dark:border-[#244157]">
                      {aw.justification}
                    </p>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] text-slate-500 dark:text-[#9CB4C9]">
                    <div>
                      Recommended by: <strong className="text-slate-800 dark:text-slate-200">{aw.recommendedByName || 'Procurement Officer'}</strong>
                    </div>
                    <div>
                      Approver decision:{' '}
                      <strong className="text-slate-800 dark:text-slate-200">
                        {aw.approvedByName
                          ? `${aw.approvedByName}${aw.decisionComment ? ` — "${aw.decisionComment}"` : ''}`
                          : 'Awaiting independent Approver sign-off'}
                      </strong>
                    </div>
                  </div>

                  {isPending && (
                    <div className="pt-3 border-t border-slate-200 dark:border-[#244157] space-y-2.5">
                      {isSelfDrafter ? (
                        <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 flex items-center gap-2">
                          <ShieldAlert className="w-4 h-4 shrink-0" />
                          <span>
                            Separation of duties enforced: You drafted this recommendation and cannot approve or reject it. An independent officer with approval authority must act.
                          </span>
                        </div>
                      ) : !canApprove ? (
                        <div className="text-slate-500 italic dark:text-[#9CB4C9]">
                          Approval or rejection is restricted to authorized Approver or Organization Admin roles within delegation limits.
                        </div>
                      ) : (
                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                          <input
                            type="text"
                            placeholder="Optional approver decision comment..."
                            value={decisionComments[aw.id] || ''}
                            onChange={(e) =>
                              setDecisionComments((prev) => ({ ...prev, [aw.id]: e.target.value }))
                            }
                            className="flex-1 p-2 bg-white dark:bg-[#1C364B] border border-slate-300 dark:border-[#244157] rounded-lg text-xs"
                          />
                          <button
                            type="button"
                            disabled={decidingAwardId === aw.id}
                            onClick={() => handleDecision(aw.id, 'rejected')}
                            className="px-3.5 py-2 bg-rose-50 hover:bg-rose-100 text-[#C2412D] border border-rose-200 font-semibold rounded-lg inline-flex items-center gap-1 cursor-pointer disabled:opacity-50 dark:bg-[#C2412D]/20 dark:border-[#C2412D]/40"
                          >
                            <XCircle className="w-4 h-4" />
                            <span>Reject</span>
                          </button>
                          <button
                            type="button"
                            disabled={decidingAwardId === aw.id}
                            onClick={() => handleDecision(aw.id, 'approved')}
                            className="px-4 py-2 bg-[#2F8F5B] hover:bg-emerald-700 text-white font-bold rounded-lg inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            <span>{decidingAwardId === aw.id ? 'Recording...' : 'Approve & Issue Contract'}</span>
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Generated Contracts Register */}
      {contracts.length > 0 && (
        <div className="bg-white dark:bg-[#1C364B] border border-slate-200 dark:border-[#244157] rounded-2xl p-6 sm:p-8 space-y-4 text-xs">
          <div className="flex items-center gap-2">
            <FileCheck2 className="w-4 h-4 text-[#2F8F5B]" />
            <h2 className="font-heading font-bold text-base text-[#10212E] dark:text-white">
              Issued Contracts ({contracts.length})
            </h2>
          </div>

          <div className="overflow-x-auto border border-slate-200 dark:border-[#244157] rounded-xl">
            <table className="w-full text-left">
              <thead className="bg-slate-50 dark:bg-[#10212E] text-slate-600 dark:text-slate-300 font-semibold">
                <tr>
                  <th className="p-3">Contract No.</th>
                  <th className="p-3">Title</th>
                  <th className="p-3">Supplier</th>
                  <th className="p-3 text-right">Value</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#244157]">
                {contracts.map((ct) => (
                  <tr key={ct.id}>
                    <td className="p-3 tabular-nums font-bold text-[#1F5F99] dark:text-[#6FAEE0]">{ct.contractNo}</td>
                    <td className="p-3 text-slate-800 dark:text-white">{ct.title}</td>
                    <td className="p-3 text-slate-600 dark:text-slate-300">{ct.supplierName}</td>
                    <td className="p-3 text-right tabular-nums font-bold">
                      {ct.currency || 'BWP'} {Number(ct.contractValue || 0).toLocaleString()}
                    </td>
                    <td className="p-3 capitalize text-[#2F8F5B] font-semibold">
                      {String(ct.status || '').replace(/_/g, ' ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
