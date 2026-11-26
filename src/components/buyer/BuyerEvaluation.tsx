import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { buyerApi } from '../../services/api';
import {
  ShieldCheck,
  CheckCircle2,
  UserCheck,
  Trophy,
  AlertCircle,
  Lock,
  Loader2,
  Save,
} from 'lucide-react';

export const BuyerEvaluation: React.FC = () => {
  const { currentUser, profileSummary } = useApp();

  const [calls, setCalls] = useState<any[]>([]);
  const [selectedCallId, setSelectedCallId] = useState<string>('');
  const [bids, setBids] = useState<any[]>([]);
  const [criteria, setCriteria] = useState<any[]>([]);
  const [scores, setScores] = useState<any[]>([]);
  const [assignment, setAssignment] = useState<any | null>(null);

  const [draftScores, setDraftScores] = useState<Record<string, number>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [isSigningConflict, setIsSigningConflict] = useState(false);
  const [conflictNotes, setConflictNotes] = useState('');
  const [hasConflictChoice, setHasConflictChoice] = useState(false);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const evaluatorName = currentUser?.fullName || profileSummary?.displayName || 'Committee Evaluator';

  const showToast = (msg: string) => {
    setErrorMessage(null);
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  useEffect(() => {
    buyerApi
      .listCalls()
      .then((rows) => {
        const list = Array.isArray(rows) ? rows : [];
        setCalls(list);
        if (list[0]?.id) setSelectedCallId(list[0].id);
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, []);

  const loadEvaluationData = useCallback(async (callId: string) => {
    if (!callId) return;
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const [bidsRes, evalRes] = await Promise.all([
        buyerApi.listBids(callId).catch(() => []),
        buyerApi.getEvaluations(callId).catch(() => ({ criteria: [], scores: [], assignment: null })),
      ]);
      const openedBids = (Array.isArray(bidsRes) ? bidsRes : []).filter((b: any) => b.status === 'opened');
      setBids(openedBids);
      setCriteria(Array.isArray(evalRes?.criteria) ? evalRes.criteria : []);
      const fetchedScores = Array.isArray(evalRes?.scores) ? evalRes.scores : [];
      setScores(fetchedScores);
      setAssignment(evalRes?.assignment || null);

      const initialDraft: Record<string, number> = {};
      const myAssignId = evalRes?.assignment?.id;
      for (const s of fetchedScores) {
        if (!myAssignId || s.evaluatorAssignmentId === myAssignId) {
          if (s.scoreValue !== null && s.scoreValue !== undefined) {
            initialDraft[`${s.bidId}|${s.criterionId}`] = Number(s.scoreValue);
          }
        }
      }
      setDraftScores(initialDraft);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Unable to load evaluation matrix.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedCallId) {
      loadEvaluationData(selectedCallId);
    }
  }, [selectedCallId, loadEvaluationData]);

  const selectedCall = calls.find((c) => c.id === selectedCallId);
  const hasSignedIndependence = assignment?.coiStatus === 'none';
  const hasConflictFlag = assignment?.coiStatus === 'conflict';
  const isScoreLocked = Boolean(assignment?.scorecardLocked);

  const handleSignConflict = async () => {
    if (!selectedCallId || isSaving) return;
    setIsSaving(true);
    setErrorMessage(null);
    try {
      await buyerApi.declareConflict(selectedCallId, hasConflictChoice, conflictNotes.trim() || undefined);
      setIsSigningConflict(false);
      await loadEvaluationData(selectedCallId);
      showToast(
        hasConflictChoice
          ? 'Conflict of interest disclosure recorded. Scoring remains restricted.'
          : `Conflict of Interest independence declaration signed by ${evaluatorName}.`
      );
    } catch (err: any) {
      setErrorMessage(err?.message || 'Unable to record conflict declaration.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSaveScore = async (bidId: string, criterionId: string, maxScore: number, value: number) => {
    if (!selectedCallId || !hasSignedIndependence || isScoreLocked) return;
    const bounded = Math.min(maxScore || 100, Math.max(0, value));
    setDraftScores((prev) => ({ ...prev, [`${bidId}|${criterionId}`]: bounded }));
    try {
      await buyerApi.submitScore(selectedCallId, criterionId, bidId, bounded);
      const evalRes = await buyerApi.getEvaluations(selectedCallId);
      setScores(Array.isArray(evalRes?.scores) ? evalRes.scores : []);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to save evaluation score.');
    }
  };

  const handleLockScorecard = async () => {
    if (!selectedCallId || isSaving) return;
    setIsSaving(true);
    setErrorMessage(null);
    try {
      await buyerApi.lockScorecard(selectedCallId);
      await loadEvaluationData(selectedCallId);
      showToast(`Scorecard finalized and locked for ${evaluatorName}.`);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to lock scorecard.');
    } finally {
      setIsSaving(false);
    }
  };

  const rankedBidders = useMemo(() => {
    return bids
      .map((bid) => {
        let totalWeighted = 0;
        let hasAnyScore = false;
        for (const crit of criteria) {
          const critScores = scores.filter(
            (s) => s.bidId === bid.id && s.criterionId === crit.id && s.scoreValue !== null && s.scoreValue !== undefined
          );
          if (critScores.length > 0) hasAnyScore = true;
          const avgRaw =
            critScores.length > 0
              ? critScores.reduce((sum, s) => sum + Number(s.scoreValue || 0), 0) / critScores.length
              : 0;
          const maxScore = Number(crit.maxScore || 100) || 100;
          const normalizedPct = (avgRaw / maxScore) * 100;
          totalWeighted += normalizedPct * (Number(crit.weight || 0) / 100);
        }
        return {
          bid,
          compositeScore: Number(totalWeighted.toFixed(1)),
          hasScores: hasAnyScore,
        };
      })
      .sort((a, b) => b.compositeScore - a.compositeScore);
  }, [bids, criteria, scores]);

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
              Scoring Matrix
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">· Weighted Composite Evaluation</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-heading font-bold text-slate-900 dark:text-white">
            Tender Evaluation & Scoring Console
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
            Record committee marks against weighted statutory criteria on unsealed tender envelopes after signing independence declarations.
          </p>
        </div>

        <select
          value={selectedCallId}
          onChange={(e) => setSelectedCallId(e.target.value)}
          className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-800 dark:text-white"
        >
          {calls.length === 0 && <option value="">No tender calls</option>}
          {calls.map((c) => (
            <option key={c.id} value={c.id}>
              {c.referenceNo} — {String(c.title || '').slice(0, 40)}
            </option>
          ))}
        </select>
      </div>

      {/* Conflict of Interest Declaration Notice */}
      <div className="bg-white dark:bg-[#1C364B] border border-slate-200 dark:border-[#244157] rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div
            className={`p-2.5 rounded-xl shrink-0 ${
              hasSignedIndependence
                ? 'bg-emerald-50 text-[#2F8F5B] dark:bg-[#2F8F5B]/20'
                : hasConflictFlag
                ? 'bg-rose-50 text-[#C2412D] dark:bg-[#C2412D]/20'
                : 'bg-amber-50 text-[#E8A33D] dark:bg-[#E8A33D]/20'
            }`}
          >
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-bold text-sm text-[#10212E] dark:text-white">
                Evaluator: {evaluatorName}
              </span>
              {hasSignedIndependence ? (
                <span className="text-[11px] bg-emerald-50 text-[#2F8F5B] px-2 py-0.5 rounded font-bold border border-emerald-200 dark:bg-[#2F8F5B]/20 dark:border-[#2F8F5B]/40">
                  Independence Declaration Signed
                </span>
              ) : hasConflictFlag ? (
                <span className="text-[11px] bg-rose-50 text-[#C2412D] px-2 py-0.5 rounded font-bold border border-rose-200 dark:bg-[#C2412D]/20 dark:border-[#C2412D]/40">
                  Conflict Declared — Scoring Blocked
                </span>
              ) : (
                <span className="text-[11px] bg-amber-50 text-amber-900 px-2 py-0.5 rounded font-bold border border-[#E8A33D] dark:bg-[#E8A33D]/20">
                  Declaration Pending
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5 dark:text-[#9CB4C9]">
              {hasSignedIndependence
                ? `Signed on ${assignment.coiDeclaredAt ? new Date(assignment.coiDeclaredAt).toLocaleString() : 'record'}. Scoring authorized.`
                : 'Under Section 42 of the Public Procurement Act, evaluators must declare independence before scoring any bids.'}
            </p>
          </div>
        </div>

        {!isScoreLocked && (
          <button
            type="button"
            disabled={!selectedCallId}
            onClick={() => setIsSigningConflict(true)}
            className="px-3.5 py-2 bg-[#E8A33D] hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-lg transition-colors cursor-pointer shrink-0 disabled:opacity-50"
          >
            {assignment ? 'Update Declaration' : 'Sign Declaration'}
          </button>
        )}
      </div>

      {/* Conflict Modal */}
      {isSigningConflict && selectedCall && (
        <div className="fixed inset-0 z-50 bg-[#10212E]/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#1C364B] rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl text-xs">
            <h3 className="font-heading font-bold text-base text-[#10212E] dark:text-white">
              Statutory Conflict of Interest Declaration
            </h3>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              I, <strong>{evaluatorName}</strong>, evaluating tender <strong>{selectedCall.referenceNo}</strong>, declare whether I hold any personal, financial, or business relationship with participating bidders.
            </p>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={!hasConflictChoice}
                  onChange={() => setHasConflictChoice(false)}
                />
                <span className="font-medium text-slate-800 dark:text-white">I declare NO conflict of interest (Authorize scoring)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  checked={hasConflictChoice}
                  onChange={() => setHasConflictChoice(true)}
                />
                <span className="font-medium text-[#C2412D]">I declare a potential conflict of interest (Recuse from scoring)</span>
              </label>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 dark:text-slate-200 mb-1">Additional Notes / Disclosures</label>
              <textarea
                rows={2}
                value={conflictNotes}
                onChange={(e) => setConflictNotes(e.target.value)}
                placeholder="Optional disclosure notes..."
                className="w-full p-2 border border-slate-300 dark:border-[#244157] rounded-lg"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200 dark:border-[#244157]">
              <button
                type="button"
                onClick={() => setIsSigningConflict(false)}
                className="px-3 py-1.5 text-slate-600 cursor-pointer dark:text-[#D3E3F2]"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSaving}
                onClick={handleSignConflict}
                className="px-4 py-2 bg-[#2F8F5B] text-white font-bold rounded-lg hover:bg-emerald-700 cursor-pointer disabled:opacity-50"
              >
                {isSaving ? 'Recording...' : 'Record Declaration'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Criteria Breakdown Cards */}
      {criteria.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {criteria.map((crit) => (
            <div key={crit.id} className="p-4 bg-white dark:bg-[#1C364B] border border-slate-200 dark:border-[#244157] rounded-xl space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold text-slate-800 dark:text-white truncate">{crit.name}</span>
                <span className="font-bold text-[#1F5F99] bg-[#EAF2FA] px-2 py-0.5 rounded tabular-nums shrink-0 dark:bg-[#162C3D] dark:text-[#6FAEE0]">
                  {crit.weight}%
                </span>
              </div>
              <p className="text-slate-500 text-[11px] leading-relaxed line-clamp-2 dark:text-[#9CB4C9]">
                {crit.description || `Max score: ${crit.maxScore || 100}`}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Scoring Matrix Table */}
      <div className="bg-white dark:bg-[#1C364B] border border-slate-200 dark:border-[#244157] rounded-2xl p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-heading font-semibold text-base text-[#10212E] dark:text-white">
                Evaluator Scoring Matrix
              </h3>
              {isScoreLocked && (
                <span className="text-[11px] bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded font-bold border border-slate-300 dark:bg-[#162C3D] dark:text-[#D3E3F2] dark:border-[#244157]">
                  Scores Locked & Finalized
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 dark:text-[#9CB4C9]">
              {isScoreLocked
                ? 'Your scorecard is locked in PostgreSQL and protected by audit triggers.'
                : 'Enter scores against each criterion for unsealed bids (values persist immediately on change).'}
            </p>
          </div>

          {!isScoreLocked && hasSignedIndependence && bids.length > 0 && criteria.length > 0 && (
            <button
              type="button"
              disabled={isSaving}
              onClick={handleLockScorecard}
              className="px-3.5 py-1.5 bg-[#1F5F99] hover:bg-[#164673] text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{isSaving ? 'Locking...' : 'Lock & Finalize Scorecard'}</span>
            </button>
          )}
        </div>

        {isLoading ? (
          <div className="py-10 flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-[#9CB4C9]">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Loading evaluation workspace...</span>
          </div>
        ) : bids.length === 0 ? (
          <div className="p-6 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2">
            <Lock className="w-4 h-4 shrink-0" />
            <span>
              No unsealed bids are available to score for this tender. Sealed envelopes remain locked until an official Bid Opening Session is conducted.
            </span>
          </div>
        ) : criteria.length === 0 ? (
          <div className="p-6 text-center text-xs text-slate-500 border border-dashed border-slate-200 rounded-xl dark:text-[#9CB4C9] dark:border-[#244157]">
            No evaluation criteria have been defined for this tender call yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-50 dark:bg-[#10212E] border-b border-slate-200 dark:border-[#244157] text-slate-600 dark:text-slate-300 font-semibold">
                  <th className="py-2.5 px-3">Candidate Bidder</th>
                  {criteria.map((c) => (
                    <th key={c.id} className="py-2.5 px-3 text-center">
                      {c.name} ({c.weight}%)
                    </th>
                  ))}
                  <th className="py-2.5 px-3 text-right">Composite Score</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-[#244157]">
                {bids.map((bid) => {
                  const ranked = rankedBidders.find((r) => r.bid.id === bid.id);
                  return (
                    <tr key={bid.id} className="hover:bg-slate-50/60 dark:hover:bg-[#10212E]/60">
                      <td className="py-3 px-3">
                        <div className="font-bold text-[#10212E] dark:text-white">{bid.supplierName}</div>
                        <span className="text-[11px] text-slate-400 tabular-nums">
                          {bid.receiptNumber || bid.id}
                        </span>
                      </td>

                      {criteria.map((crit) => {
                        const val = draftScores[`${bid.id}|${crit.id}`];
                        const max = Number(crit.maxScore || 100);
                        return (
                          <td key={crit.id} className="py-3 px-3 text-center">
                            <input
                              type="number"
                              min={0}
                              max={max}
                              disabled={!hasSignedIndependence || isScoreLocked}
                              value={val !== undefined ? val : ''}
                              onChange={(e) => {
                                const num = Number(e.target.value);
                                setDraftScores((prev) => ({ ...prev, [`${bid.id}|${crit.id}`]: num }));
                              }}
                              onBlur={(e) => {
                                if (e.target.value !== '') {
                                  handleSaveScore(bid.id, crit.id, max, Number(e.target.value));
                                }
                              }}
                              placeholder={`0-${max}`}
                              className="w-16 p-1.5 text-center tabular-nums font-bold bg-white dark:bg-[#10212E] border border-slate-300 dark:border-[#244157] rounded-lg text-slate-900 dark:text-white disabled:bg-slate-100 disabled:text-slate-400"
                            />
                          </td>
                        );
                      })}

                      <td className="py-3 px-3 text-right tabular-nums font-bold text-sm text-[#1F5F99] dark:text-[#6FAEE0]">
                        {ranked?.compositeScore ?? 0}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Auto-Ranked Leaderboard */}
      {rankedBidders.length > 0 && (
        <div className="bg-white dark:bg-[#1C364B] border border-slate-200 dark:border-[#244157] rounded-2xl p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-[#E8A33D]" />
              <h3 className="font-heading font-semibold text-base text-[#10212E] dark:text-white">
                Auto-Ranked Evaluation Results
              </h3>
            </div>
            <span className="text-xs text-slate-500 tabular-nums dark:text-[#9CB4C9]">Multi-Evaluator Composite</span>
          </div>

          <div className="divide-y divide-slate-100 dark:divide-[#244157] border border-slate-200 dark:border-[#244157] rounded-xl overflow-hidden">
            {rankedBidders.map((item, idx) => {
              const isWinner = idx === 0 && item.compositeScore > 0;
              return (
                <div
                  key={item.bid.id}
                  className={`p-4 flex items-center justify-between gap-4 ${
                    isWinner ? 'bg-amber-50/40 dark:bg-amber-950/20' : ''
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <div
                      className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs tabular-nums ${
                        isWinner ? 'bg-[#E8A33D] text-white' : 'bg-slate-100 text-slate-600 dark:bg-[#162C3D] dark:text-[#D3E3F2]'
                      }`}
                    >
                      #{idx + 1}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-[#10212E] dark:text-white">{item.bid.supplierName}</span>
                        {isWinner && (
                          <span className="text-[10px] font-bold bg-[#E8A33D] text-slate-950 px-2 py-0.5 rounded">
                            Highest Ranked
                          </span>
                        )}
                      </div>
                      <span className="text-xs text-slate-500 tabular-nums dark:text-[#9CB4C9]">
                        Offer: {item.bid.currency || 'BWP'} {item.bid.totalPrice != null ? Number(item.bid.totalPrice).toLocaleString() : 'N/A'}
                      </span>
                    </div>
                  </div>

                  <div className="text-right">
                    <span className="text-lg font-bold tabular-nums text-[#1F5F99] dark:text-[#6FAEE0]">
                      {item.compositeScore}%
                    </span>
                    <span className="text-[11px] text-slate-400 block">Composite Score</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
