import React, { useState, useEffect, useCallback } from 'react';
import { Layers, Plus, CheckCircle2, Trash2, Save, Loader2, AlertCircle, Sliders } from 'lucide-react';
import { buyerApi } from '../../services/api';

interface WorkflowStageItem {
  id: string;
  appliesTo: 'registration' | 'eoi' | 'rfp';
  name: string;
  sequenceNo: number;
  stageType: 'review' | 'approval';
  requiredRoleId?: string | null;
  requiredRoleName?: string | null;
  slaDays?: number | null;
}

interface ScoringCriterion {
  id: string;
  label: string;
  weightPercent?: number | null;
  passFail?: boolean;
}

interface ScoringTemplate {
  id: string;
  name: string;
  badge: string;
  method: 'qcbs' | 'least_cost' | 'custom';
  isActive: boolean;
  criteria: ScoringCriterion[];
}

export const BuyerWorkflowsScoring: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'workflows' | 'templates'>('workflows');
  const [stages, setStages] = useState<WorkflowStageItem[]>([]);
  const [scoringTemplates, setScoringTemplates] = useState<ScoringTemplate[]>([]);
  const [roles, setRoles] = useState<any[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // Add workflow stage form
  const [stageAppliesTo, setStageAppliesTo] = useState<'registration' | 'eoi' | 'rfp'>('rfp');
  const [stageName, setStageName] = useState('');
  const [stageType, setStageType] = useState<'review' | 'approval'>('review');
  const [stageRoleId, setStageRoleId] = useState('');
  const [stageSlaDays, setStageSlaDays] = useState('5');

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await buyerApi.getWorkflows();
      setStages(Array.isArray(data?.stages) ? data.stages : []);
      setScoringTemplates(Array.isArray(data?.scoringTemplates) ? data.scoringTemplates : []);
      setRoles(Array.isArray(data?.roles) ? data.roles : []);
    } catch (err: any) {
      setError(err?.message || 'Unable to load workflow stages and scoring templates.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const showFeedback = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 4000);
  };

  const handleAddStage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stageName.trim()) return;
    setIsSaving(true);
    setError(null);
    try {
      const existingForType = stages.filter((s) => s.appliesTo === stageAppliesTo);
      const res = await buyerApi.createWorkflowStage({
        appliesTo: stageAppliesTo,
        name: stageName.trim(),
        sequenceNo: existingForType.length + 1,
        stageType,
        requiredRoleId: stageRoleId || null,
        slaDays: stageSlaDays ? Number(stageSlaDays) : null,
      });
      setStages(Array.isArray(res.stages) ? res.stages : []);
      setStageName('');
      showFeedback('Workflow stage saved to PostgreSQL.');
    } catch (err: any) {
      setError(err?.message || 'Failed to add workflow stage.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteStage = async (stageId: string) => {
    setError(null);
    try {
      await buyerApi.deleteWorkflowStage(stageId);
      setStages((prev) => prev.filter((s) => s.id !== stageId));
      showFeedback('Workflow stage removed.');
    } catch (err: any) {
      setError(err?.message || 'Failed to delete workflow stage.');
    }
  };

  const handleUpdateCriterionWeight = (templateId: string, criterionId: string, weight: number) => {
    setScoringTemplates((prev) =>
      prev.map((t) =>
        t.id === templateId
          ? {
              ...t,
              criteria: t.criteria.map((c) =>
                c.id === criterionId ? { ...c, weightPercent: weight } : c
              ),
            }
          : t
      )
    );
  };

  const handleAddCriterion = (templateId: string) => {
    setScoringTemplates((prev) =>
      prev.map((t) =>
        t.id === templateId
          ? {
              ...t,
              criteria: [
                ...t.criteria,
                { id: `c-${Date.now()}`, label: 'New Evaluation Criterion', weightPercent: 10 },
              ],
            }
          : t
      )
    );
  };

  const handleUpdateCriterionLabel = (templateId: string, criterionId: string, label: string) => {
    setScoringTemplates((prev) =>
      prev.map((t) =>
        t.id === templateId
          ? {
              ...t,
              criteria: t.criteria.map((c) =>
                c.id === criterionId ? { ...c, label } : c
              ),
            }
          : t
      )
    );
  };

  const handleSaveScoringTemplates = async () => {
    setIsSaving(true);
    setError(null);
    try {
      const res = await buyerApi.saveScoringTemplates(scoringTemplates);
      setScoringTemplates(res.scoringTemplates);
      showFeedback('Evaluation scoring templates saved to PostgreSQL.');
    } catch (err: any) {
      setError(err?.message || 'Failed to save scoring templates.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#D5E0EA] dark:border-[#244157]">
        <div className="space-y-1">
          <h1 className="font-heading font-semibold text-[30px] leading-tight text-[#10212E] dark:text-white">
            Workflows &amp; scoring templates
          </h1>
          <p className="text-[15px] text-[#43525F] dark:text-[#D3E3F2]">
            Standardize evaluation stages, multi-evaluator scoring matrices, and statutory approval gates.
          </p>
        </div>

        <div className="inline-flex rounded-[8px] border border-[#D5E0EA] dark:border-[#244157] bg-white dark:bg-[#1C364B] p-1">
          <button
            type="button"
            onClick={() => setActiveTab('workflows')}
            className={`px-3.5 py-1.5 rounded-[6px] text-[13px] font-medium inline-flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'workflows' ? 'bg-[#1F5F99] text-white' : 'text-[#43525F] dark:text-[#D3E3F2]'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Approval Workflows ({stages.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('templates')}
            className={`px-3.5 py-1.5 rounded-[6px] text-[13px] font-medium inline-flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'templates' ? 'bg-[#1F5F99] text-white' : 'text-[#43525F] dark:text-[#D3E3F2]'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>Scoring Matrices ({scoringTemplates.length})</span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-[12px] bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-[#C2412D] dark:text-rose-200 text-[14px] flex items-center gap-2">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {feedback && (
        <div className="p-4 rounded-[12px] bg-[#ECFDF5] border border-[#A7F3D0] text-[#065F46] text-[14px] flex items-center gap-2 dark:bg-[#2F8F5B]/20 dark:text-[#6EE7B7] dark:border-[#2F8F5B]/40">
          <CheckCircle2 className="w-5 h-5 text-[#2F8F5B] shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {isLoading ? (
        <div className="bg-white dark:bg-[#1C364B] rounded-[12px] border border-[#D5E0EA] dark:border-[#244157] p-10 flex items-center justify-center gap-2.5 text-[#6B7A87] dark:text-[#9CB4C9]">
          <Loader2 className="w-5 h-5 animate-spin text-[#1F5F99] dark:text-[#6FAEE0]" />
          <span className="text-[14px]">Loading workflows and scoring templates...</span>
        </div>
      ) : activeTab === 'workflows' ? (
        <div className="space-y-6">
          <form
            onSubmit={handleAddStage}
            className="bg-white dark:bg-[#1C364B] rounded-[12px] border border-[#D5E0EA] dark:border-[#244157] p-6 space-y-4 text-[14px]"
          >
            <h2 className="font-heading font-semibold text-[18px] text-[#10212E] dark:text-white">
              Add Review or Approval Gate
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              <select
                value={stageAppliesTo}
                onChange={(e) => setStageAppliesTo(e.target.value as any)}
                className="p-2.5 border border-[#D5E0EA] dark:border-[#244157] rounded-[6px] bg-white dark:bg-[#10212E]"
              >
                <option value="rfp">Competitive RFP</option>
                <option value="eoi">Expression of Interest</option>
                <option value="registration">Registration Drive</option>
              </select>
              <input
                type="text"
                required
                value={stageName}
                onChange={(e) => setStageName(e.target.value)}
                placeholder="Stage name (e.g. Tender Committee Approval)"
                className="sm:col-span-2 p-2.5 border border-[#D5E0EA] dark:border-[#244157] rounded-[6px] bg-white dark:bg-[#10212E]"
              />
              <select
                value={stageType}
                onChange={(e) => setStageType(e.target.value as any)}
                className="p-2.5 border border-[#D5E0EA] dark:border-[#244157] rounded-[6px] bg-white dark:bg-[#10212E]"
              >
                <option value="review">Review Stage</option>
                <option value="approval">Approval Gate</option>
              </select>
              <select
                value={stageRoleId}
                onChange={(e) => setStageRoleId(e.target.value)}
                className="p-2.5 border border-[#D5E0EA] dark:border-[#244157] rounded-[6px] bg-white dark:bg-[#10212E]"
              >
                <option value="">Any Authorized Role</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-[13px]">
                <label className="text-[#43525F] dark:text-[#D3E3F2]">SLA target (days):</label>
                <input
                  type="number"
                  min={1}
                  max={60}
                  value={stageSlaDays}
                  onChange={(e) => setStageSlaDays(e.target.value)}
                  className="w-20 p-1.5 border border-[#D5E0EA] dark:border-[#244157] rounded-[6px] bg-white dark:bg-[#10212E]"
                />
              </div>
              <button
                type="submit"
                disabled={isSaving || !stageName.trim()}
                className="px-4 py-2 bg-[#1F5F99] hover:bg-[#184c7a] text-white rounded-[6px] text-[13px] font-medium inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                <span>Add Stage</span>
              </button>
            </div>
          </form>

          {stages.length === 0 ? (
            <div className="bg-white dark:bg-[#1C364B] rounded-[12px] border border-[#D5E0EA] dark:border-[#244157] p-8 text-center text-[14px] text-[#6B7A87] dark:text-[#9CB4C9]">
              No custom workflow stages configured yet. Add your first review or approval gate above.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(['rfp', 'eoi', 'registration'] as const).map((kind) => {
                const kindStages = stages.filter((s) => s.appliesTo === kind);
                return (
                  <div
                    key={kind}
                    className="bg-white dark:bg-[#1C364B] rounded-[12px] border border-[#D5E0EA] dark:border-[#244157] p-5 space-y-3"
                  >
                    <h3 className="font-heading font-semibold text-[16px] text-[#10212E] dark:text-white uppercase">
                      {kind === 'rfp' ? 'RFP Tenders' : kind === 'eoi' ? 'EOI Calls' : 'Registration Drives'}
                    </h3>
                    {kindStages.length === 0 ? (
                      <p className="text-[12px] text-[#6B7A87] dark:text-[#9CB4C9]">No stages defined.</p>
                    ) : (
                      <div className="space-y-2">
                        {kindStages.map((s) => (
                          <div
                            key={s.id}
                            className="p-3 rounded-[8px] bg-[#F7FAFD] dark:bg-[#10212E] border border-[#D5E0EA] dark:border-[#244157] flex items-start justify-between gap-2 text-[13px]"
                          >
                            <div>
                              <div className="font-semibold text-[#10212E] dark:text-white">
                                {s.sequenceNo}. {s.name}
                              </div>
                              <div className="text-[11px] text-[#6B7A87] dark:text-[#9CB4C9]">
                                {s.stageType === 'approval' ? 'Approval Gate' : 'Review'} ·{' '}
                                {s.requiredRoleName || 'Any Role'}
                                {s.slaDays ? ` · ${s.slaDays}d SLA` : ''}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleDeleteStage(s.id)}
                              className="p-1 text-[#C2412D] hover:bg-rose-50 rounded cursor-pointer dark:hover:bg-[#C2412D]/20"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          <div className="flex justify-end">
            <button
              type="button"
              onClick={handleSaveScoringTemplates}
              disabled={isSaving}
              className="px-4 py-2 bg-[#1F5F99] hover:bg-[#184c7a] text-white rounded-[6px] text-[13px] font-medium inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              <span>Save scoring templates</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {scoringTemplates.map((tpl) => {
              const totalWeight = tpl.criteria
                .filter((c) => !c.passFail)
                .reduce((acc, c) => acc + (Number(c.weightPercent) || 0), 0);
              return (
                <div
                  key={tpl.id}
                  className="bg-white dark:bg-[#1C364B] rounded-[12px] border border-[#D5E0EA] dark:border-[#244157] p-6 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-medium text-[#1F5F99] bg-[#EAF2FA] px-2 py-0.5 rounded-[4px] dark:bg-[#162C3D] dark:text-[#6FAEE0]">
                      {tpl.badge}
                    </span>
                    <span
                      className={`text-[12px] tabular-nums font-semibold ${
                        totalWeight === 100 ? 'text-[#2F8F5B]' : 'text-[#92400E]'
                      }`}
                    >
                      Total weight: {totalWeight}%
                    </span>
                  </div>

                  <h3 className="font-heading font-semibold text-[18px] text-[#10212E] dark:text-white">
                    {tpl.name}
                  </h3>

                  <div className="space-y-2 text-[13px]">
                    {tpl.criteria.map((c) => (
                      <div
                        key={c.id}
                        className="flex items-center justify-between gap-2 py-1.5 border-b border-[#D5E0EA] dark:border-[#244157]"
                      >
                        <input
                          type="text"
                          value={c.label}
                          onChange={(e) => handleUpdateCriterionLabel(tpl.id, c.id, e.target.value)}
                          className="flex-1 bg-transparent text-[#10212E] dark:text-white focus:outline-none"
                        />
                        {c.passFail ? (
                          <strong className="text-[#10212E] dark:text-white text-[12px]">Mandatory (Pass/Fail)</strong>
                        ) : (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={c.weightPercent ?? 0}
                              onChange={(e) =>
                                handleUpdateCriterionWeight(tpl.id, c.id, Number(e.target.value) || 0)
                              }
                              className="w-16 p-1 text-right tabular-nums font-semibold border border-[#D5E0EA] dark:border-[#244157] rounded bg-[#F7FAFD] dark:bg-[#10212E]"
                            />
                            <span className="text-[#6B7A87] dark:text-[#9CB4C9]">%</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={() => handleAddCriterion(tpl.id)}
                    className="text-[12px] font-medium text-[#1F5F99] hover:underline inline-flex items-center gap-1 cursor-pointer dark:text-[#6FAEE0]"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add criterion</span>
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
