import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Criterion, Evaluator, Score } from '../../mockData';
import {
  TrendingUp,
  ShieldCheck,
  CheckCircle2,
  Award,
  AlertTriangle,
  UserCheck,
  Percent,
  Sliders,
  Save,
  Trophy,
} from 'lucide-react';

export const BuyerEvaluation: React.FC = () => {
  const { criteria, evaluators, scores, saveScore, signConflictDeclaration, applications, calls, updateAwardDecision } = useApp();
  const [selectedCallId, setSelectedCallId] = useState<string>(calls[0]?.id || '');
  const [activeEvaluatorId, setActiveEvaluatorId] = useState<string>(evaluators[0]?.id || '');
  const [isSigningConflict, setIsSigningConflict] = useState(false);
  const [conflictNotes, setConflictNotes] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [lockedEvaluatorIds, setLockedEvaluatorIds] = useState<string[]>([]);

  const selectedCall = calls.find((c) => c.id === selectedCallId) || calls[0];
  const callCriteria = criteria.filter((c) => c.callId === selectedCall?.id);
  const currentEvaluator = evaluators.find((e) => e.id === activeEvaluatorId) || evaluators[0];
  const isScoreLocked = lockedEvaluatorIds.includes(currentEvaluator.id);

  const callApplications = applications.filter((a) => a.callId === selectedCall?.id);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  const handleScoreChange = (appId: string, critId: string, val: number) => {
    if (isScoreLocked || !currentEvaluator.hasDeclaredConflict) return;
    saveScore({
      callId: selectedCall.id,
      applicationId: appId,
      evaluatorId: currentEvaluator.id,
      evaluatorName: currentEvaluator.name,
      evaluatorRole: currentEvaluator.role,
      criterionId: critId,
      score: Math.min(100, Math.max(0, val)),
      comments: 'Evaluation verified by score sheet.',
    });
  };

  const handleLockScores = () => {
    setLockedEvaluatorIds((prev) => [...prev, currentEvaluator.id]);
    showToast(`Scorecard finalized and locked for ${currentEvaluator.name}. Scores cannot be modified.`);
  };

  const handleSignConflict = () => {
    signConflictDeclaration(currentEvaluator.id, conflictNotes || undefined);
    setIsSigningConflict(false);
    showToast(`Conflict of Interest statutory declaration signed by ${currentEvaluator.name}.`);
  };

  // Compute composite rankings
  const rankedBidders = useMemo(() => {
    return callApplications.map((app) => {
      let totalWeightedScore = 0;
      let totalWeights = 0;

      callCriteria.forEach((crit) => {
        // Average score across evaluators for this criterion
        const critScores = scores.filter(
          (s) => s.callId === selectedCall.id && s.applicationId === app.id && s.criterionId === crit.id
        );
        const avgCritScore = critScores.length > 0
          ? critScores.reduce((sum, s) => sum + s.score, 0) / critScores.length
          : 0;

        totalWeightedScore += (avgCritScore * (crit.weight / 100));
        totalWeights += crit.weight;
      });

      return {
        app,
        compositeScore: Number(totalWeightedScore.toFixed(1)),
        hasScores: scores.some((s) => s.callId === selectedCall.id && s.applicationId === app.id),
      };
    }).sort((a, b) => b.compositeScore - a.compositeScore);
  }, [callApplications, callCriteria, scores, selectedCall]);

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Toast */}
      {toastMessage && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 text-[#2F8F5B] dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 rounded-xl text-xs flex items-center gap-2 shadow-xs">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="card-elevated p-6 sm:p-8 flex flex-wrap items-center justify-between gap-6 border-l-4 border-l-[#1F5F99]">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-[#1F5F99] dark:text-[#6FAEE0] bg-[#EAF2FA] dark:bg-slate-800 px-2.5 py-0.5 rounded-md">
              Scoring Matrix
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">· Multi-Evaluator Weighted Composite</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-heading font-bold text-slate-900 dark:text-white">
            Tender Evaluation & Scoring Console
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
            Record committee marks against weighted statutory criteria and generate auto-ranked composite scorecards.
          </p>
        </div>

        <div>
          <select
            value={selectedCallId}
            onChange={(e) => setSelectedCallId(e.target.value)}
            className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-800 dark:text-white"
          >
            {calls.map((c) => (
              <option key={c.id} value={c.id}>
                {c.callNumber} — {c.title.substring(0, 30)}...
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Conflict of Interest Declaration Notice */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-2xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className={`p-2.5 rounded-xl shrink-0 ${currentEvaluator.hasDeclaredConflict ? 'bg-emerald-50 text-[#2F8F5B]' : 'bg-amber-50 text-[#E8A33D]'}`}>
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-[#10212E]">
                Active Evaluator: {currentEvaluator.name} ({currentEvaluator.role})
              </span>
              {currentEvaluator.hasDeclaredConflict ? (
                <span className="text-[11px] bg-emerald-50 text-[#2F8F5B] px-2 py-0.5 rounded font-bold border border-emerald-200">
                  Independence Declaration Signed
                </span>
              ) : (
                <span className="text-[11px] bg-amber-50 text-amber-900 px-2 py-0.5 rounded font-bold border border-[#E8A33D]">
                  Declaration Pending
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {currentEvaluator.hasDeclaredConflict
                ? `Signed on ${currentEvaluator.declarationDate}. "${currentEvaluator.conflictDetails}"`
                : 'Under Section 42 of the Botswana Public Procurement Act, evaluators must declare any commercial or family interest before scoring.'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {/* Switch active evaluator */}
          <select
            value={activeEvaluatorId}
            onChange={(e) => setActiveEvaluatorId(e.target.value)}
            className="p-2 bg-white border border-slate-300 rounded-lg text-xs font-medium"
          >
            {evaluators.map((e) => (
              <option key={e.id} value={e.id}>
                Switch Evaluator: {e.name}
              </option>
            ))}
          </select>

          {!currentEvaluator.hasDeclaredConflict && (
            <button
              onClick={() => setIsSigningConflict(true)}
              className="px-3.5 py-2 bg-[#E8A33D] hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-lg transition-colors"
            >
              Sign Declaration
            </button>
          )}
        </div>
      </div>

      {/* Conflict Modal */}
      {isSigningConflict && (
        <div className="fixed inset-0 z-50 bg-[#10212E]/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-xl text-xs">
            <h3 className="font-heading font-bold text-base text-[#10212E]">
              Statutory Conflict of Interest Declaration
            </h3>
            <p className="text-slate-600 leading-relaxed">
              I, <strong>{currentEvaluator.name}</strong>, serving as {currentEvaluator.role} for {selectedCall.organizationName}, hereby solemnly declare that I have no personal, financial, familial, or business connection to any bidding entity participating in tender {selectedCall.callNumber}.
            </p>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Additional Notes / Disclosures</label>
              <textarea
                rows={2}
                value={conflictNotes}
                onChange={(e) => setConflictNotes(e.target.value)}
                placeholder="Optional disclosure notes..."
                className="w-full p-2 border border-slate-300 rounded-lg"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsSigningConflict(false)}
                className="px-3 py-1.5 text-slate-600"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSignConflict}
                className="px-4 py-2 bg-[#2F8F5B] text-white font-bold rounded-lg hover:bg-emerald-700"
              >
                Sign & Authorize Scoring
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Criteria Breakdown Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        {callCriteria.map((crit) => (
          <div key={crit.id} className="p-4 bg-white border border-slate-200 rounded-xl space-y-1 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-800 truncate">{crit.title}</span>
              <span className="font-bold text-[#1F5F99] bg-[#EAF2FA] px-2 py-0.5 rounded font-mono">
                {crit.weight}%
              </span>
            </div>
            <p className="text-slate-500 text-[11px] leading-relaxed line-clamp-2">
              {crit.description}
            </p>
          </div>
        ))}
      </div>

      {/* Multi-Evaluator Scoring Matrix Table */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-heading font-semibold text-base text-[#10212E]">
                Evaluator Scoring Matrix ({currentEvaluator.name} Marks)
              </h3>
              {isScoreLocked && (
                <span className="text-[11px] bg-slate-100 text-slate-700 px-2.5 py-0.5 rounded font-bold border border-slate-300">
                  Scores Locked & Finalized
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500">
              {isScoreLocked
                ? 'Scores for this evaluator have been locked and cannot be changed.'
                : 'Enter individual scores (0-100) per candidate bidder.'}
            </p>
          </div>

          {!isScoreLocked && currentEvaluator.hasDeclaredConflict && (
            <button
              type="button"
              onClick={handleLockScores}
              className="px-3.5 py-1.5 bg-[#1F5F99] hover:bg-[#164673] text-white text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>Lock & Finalize Scorecard</span>
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                <th className="py-2.5 px-3">Candidate Bidder</th>
                {callCriteria.map((c) => (
                  <th key={c.id} className="py-2.5 px-3 text-center">
                    {c.title} ({c.weight}%)
                  </th>
                ))}
                <th className="py-2.5 px-3 text-right">Composite Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {callApplications.map((app) => {
                const appRank = rankedBidders.find((r) => r.app.id === app.id);
                return (
                  <tr key={app.id} className="hover:bg-slate-50">
                    <td className="py-3 px-3">
                      <div className="font-bold text-[#10212E]">{app.supplierName}</div>
                      <span className="text-[11px] text-slate-400 font-mono">ID: {app.id}</span>
                    </td>

                    {callCriteria.map((crit) => {
                      const existingScore = scores.find(
                        (s) =>
                          s.callId === selectedCall.id &&
                          s.applicationId === app.id &&
                          s.evaluatorId === currentEvaluator.id &&
                          s.criterionId === crit.id
                      );

                      return (
                        <td key={crit.id} className="py-3 px-3 text-center">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            disabled={!currentEvaluator.hasDeclaredConflict || isScoreLocked}
                            value={existingScore ? existingScore.score : ''}
                            onChange={(e) => handleScoreChange(app.id, crit.id, Number(e.target.value))}
                            placeholder="0-100"
                            className="w-16 p-1.5 text-center font-mono font-bold bg-white border border-slate-300 rounded-lg text-slate-900 disabled:bg-slate-100 disabled:text-slate-400"
                          />
                        </td>
                      );
                    })}

                    <td className="py-3 px-3 text-right font-mono font-bold text-sm text-[#1F5F99]">
                      {appRank?.compositeScore}%
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Auto-Ranked Results Leaderboard */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 shadow-2xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-[#E8A33D]" />
            <h3 className="font-heading font-semibold text-base text-[#10212E]">
              Auto-Ranked Evaluation Results & Preferred Bidder
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-mono">Weighted Total: 100%</span>
        </div>

        <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden">
          {rankedBidders.map((item, idx) => {
            const isWinner = idx === 0 && item.compositeScore > 0;
            return (
              <div
                key={item.app.id}
                className={`p-4 flex items-center justify-between gap-4 transition-colors ${
                  isWinner ? 'bg-amber-50/40' : 'bg-white'
                }`}
              >
                <div className="flex items-center gap-3.5">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center font-bold text-xs font-mono ${
                      isWinner ? 'bg-[#E8A33D] text-white' : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    #{idx + 1}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-[#10212E]">{item.app.supplierName}</span>
                      {isWinner && (
                        <span className="text-[10px] font-bold bg-[#E8A33D] text-slate-950 px-2 py-0.5 rounded">
                          Recommended for Award
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-slate-500 font-mono">
                      Offer: BWP {item.app.bid?.totalAmountBWP.toLocaleString() || 'N/A'} · Citizen 100%
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="text-lg font-bold font-mono text-[#1F5F99]">
                    {item.compositeScore}%
                  </span>
                  <span className="text-[11px] text-slate-400 block">Composite Score</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
