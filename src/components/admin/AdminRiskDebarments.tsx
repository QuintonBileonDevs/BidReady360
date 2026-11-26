import React, { useState, useEffect, useCallback } from 'react';
import {
  adminApi,
  AdminRiskFlagRecord,
  AdminDebarmentRecord,
  AdminSupplierRecord,
} from '../../services/api';
import {
  ShieldAlert,
  CheckCircle2,
  Plus,
  AlertCircle,
  Loader2,
  RefreshCw,
  Ban,
} from 'lucide-react';

function formatDate(iso?: string | null): string {
  if (!iso) return 'Permanent';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString('en-BW', { year: 'numeric', month: 'short', day: 'numeric' });
}

export const AdminRiskDebarments: React.FC = () => {
  const [flags, setFlags] = useState<AdminRiskFlagRecord[]>([]);
  const [debarments, setDebarments] = useState<AdminDebarmentRecord[]>([]);
  const [suppliers, setSuppliers] = useState<AdminSupplierRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  // New Risk Flag Modal
  const [isFlagModalOpen, setIsFlagModalOpen] = useState(false);
  const [flagSupplierId, setFlagSupplierId] = useState('');
  const [flagType, setFlagType] = useState<'shared_director' | 'shared_address' | 'shared_phone' | 'duplicate_document' | 'price_pattern' | 'other'>('other');
  const [flagSeverity, setFlagSeverity] = useState<'low' | 'medium' | 'high'>('high');
  const [flagDesc, setFlagDesc] = useState('');
  const [isSubmittingModal, setIsSubmittingModal] = useState(false);

  // New Debarment Modal
  const [isDebarModalOpen, setIsDebarModalOpen] = useState(false);
  const [debarSupplierId, setDebarSupplierId] = useState('');
  const [debarPermanent, setDebarPermanent] = useState(false);
  const [debarStartsOn, setDebarStartsOn] = useState(() => new Date().toISOString().slice(0, 10));
  const [debarEndsOn, setDebarEndsOn] = useState('');
  const [debarReason, setDebarReason] = useState('');
  const [debarEvidence, setDebarEvidence] = useState('');

  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [riskData, supData] = await Promise.all([
        adminApi.getRiskAndDebarments(),
        adminApi.listSuppliers(),
      ]);
      setFlags(Array.isArray(riskData.flags) ? riskData.flags : []);
      setDebarments(Array.isArray(riskData.debarments) ? riskData.debarments : []);
      setSuppliers(Array.isArray(supData) ? supData : []);
    } catch (err: any) {
      setError(err?.message || 'Unable to load risk flags and debarment records.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const showSuccess = (msg: string) => {
    setFeedback(msg);
    setTimeout(() => setFeedback(null), 4500);
  };

  const handleUpdateFlagStatus = async (id: string, status: 'resolved' | 'dismissed' | 'reviewed') => {
    setBusyId(id);
    setError(null);
    try {
      await adminApi.updateRiskFlagStatus(id, status);
      await loadData();
      showSuccess(`Risk flag marked as ${status}.`);
    } catch (err: any) {
      setError(err?.message || 'Failed to update risk flag.');
    } finally {
      setBusyId(null);
    }
  };

  const handleCreateFlag = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!flagSupplierId || !flagDesc.trim()) return;
    setIsSubmittingModal(true);
    setError(null);
    try {
      await adminApi.createRiskFlag({
        supplierId: flagSupplierId,
        flagType,
        severity: flagSeverity,
        description: flagDesc.trim(),
      });
      setIsFlagModalOpen(false);
      setFlagDesc('');
      await loadData();
      showSuccess('High-risk integrity flag recorded and logged.');
    } catch (err: any) {
      setError(err?.message || 'Failed to create risk flag.');
    } finally {
      setIsSubmittingModal(false);
    }
  };

  const handleCreateDebarment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!debarSupplierId || debarReason.trim().length < 5) {
      setError('Select a supplier and enter a debarment reason (min 5 characters).');
      return;
    }
    if (!debarPermanent && !debarEndsOn) {
      setError('Specify an end date for a temporary debarment, or mark it permanent.');
      return;
    }
    setIsSubmittingModal(true);
    setError(null);
    try {
      await adminApi.createDebarment({
        supplierId: debarSupplierId,
        reason: debarReason.trim(),
        startsOn: debarStartsOn,
        endsOn: debarPermanent ? null : debarEndsOn,
        evidenceRef: debarEvidence.trim() || undefined,
      });
      setIsDebarModalOpen(false);
      setDebarReason('');
      setDebarEvidence('');
      setDebarEndsOn('');
      await loadData();
      showSuccess('Debarment order applied. Supplier is now blocked from submitting bids.');
    } catch (err: any) {
      setError(err?.message || 'Failed to apply debarment.');
    } finally {
      setIsSubmittingModal(false);
    }
  };

  const handleLiftDebarment = async (deb: AdminDebarmentRecord) => {
    setBusyId(deb.id);
    setError(null);
    try {
      await adminApi.liftDebarment(deb.id, 'Lifted by platform administrator');
      await loadData();
      showSuccess(`Lifted debarment order for "${deb.entityName}".`);
    } catch (err: any) {
      setError(err?.message || 'Failed to lift debarment.');
    } finally {
      setBusyId(null);
    }
  };

  const activeDebarmentsCount = debarments.filter((d) => d.isActive).length;

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#D5E0EA] dark:border-[#1E364A]">
        <div className="space-y-1">
          <h1 className="font-heading font-semibold text-[30px] leading-tight text-[#10212E] dark:text-white">
            Risk &amp; debarments
          </h1>
          <p className="text-[15px] text-[#43525F] dark:text-[#B2C3D2]">
            Flag high-risk suppliers and issue statutory debarments. Actively debarred suppliers are automatically blocked from bidding.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              if (!flagSupplierId && suppliers[0]) setFlagSupplierId(suppliers[0].id);
              setIsFlagModalOpen(true);
            }}
            className="px-3.5 py-2 border border-[#D5E0EA] dark:border-[#1E364A] bg-white dark:bg-[#132635] hover:bg-[#F7FAFD] text-[#10212E] dark:text-white rounded-[6px] text-[13px] font-medium inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Flag supplier</span>
          </button>
          <button
            type="button"
            onClick={() => {
              if (!debarSupplierId && suppliers[0]) setDebarSupplierId(suppliers[0].id);
              setIsDebarModalOpen(true);
            }}
            className="px-3.5 py-2 bg-[#C2412D] hover:bg-[#a63423] text-white rounded-[6px] text-[13px] font-medium inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Ban className="w-4 h-4" />
            <span>Apply debarment</span>
          </button>
          <button
            type="button"
            onClick={loadData}
            disabled={isLoading}
            className="p-2 border border-[#D5E0EA] dark:border-[#1E364A] bg-white dark:bg-[#132635] rounded-[6px] text-[#43525F] cursor-pointer"
            aria-label="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {error && (
        <div className="p-3.5 rounded-[8px] bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-[#C2412D] dark:text-rose-200 text-[14px] flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {feedback && (
        <div className="p-3.5 rounded-[8px] bg-[#ECFDF5] border border-[#A7F3D0] text-[#065F46] text-[14px] flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-[#2F8F5B] shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {isLoading ? (
        <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-12 flex items-center justify-center gap-2 text-[#6B7A87]">
          <Loader2 className="w-5 h-5 animate-spin text-[#1F5F99]" />
          <span>Loading risk flags and debarments...</span>
        </div>
      ) : (
        <>
          {/* 1. Risk Flags Section */}
          <div className="space-y-4">
            <h2 className="font-heading font-semibold text-[22px] text-[#10212E] dark:text-white">
              Integrity risk flags ({flags.length})
            </h2>

            <div className="space-y-4">
              {flags.length === 0 ? (
                <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-8 text-center text-[#6B7A87]">
                  No integrity risk flags recorded.
                </div>
              ) : (
                flags.map((flag) => {
                  const isClosed = flag.status === 'resolved' || flag.status === 'dismissed';
                  return (
                    <div
                      key={flag.id}
                      className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 space-y-3"
                    >
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center flex-wrap gap-2.5">
                          <span
                            className={`text-[12px] px-2.5 py-0.5 rounded-[4px] font-semibold capitalize ${
                              flag.severity === 'high'
                                ? 'bg-[#FEF2F2] text-[#C2412D]'
                                : flag.severity === 'medium'
                                ? 'bg-[#FFFBEB] text-[#92400E]'
                                : 'bg-[#EAF2FA] text-[#1F5F99]'
                            }`}
                          >
                            {flag.severity} severity
                          </span>
                          <h3 className="font-heading font-semibold text-[16px] text-[#10212E] dark:text-white capitalize">
                            {flag.flagType.replace(/_/g, ' ')} — {flag.supplierName}
                          </h3>
                        </div>
                        <span className="text-[13px] text-[#6B7A87]">
                          Recorded {formatDate(flag.createdAt)}
                        </span>
                      </div>

                      <p className="text-[14px] text-[#43525F] dark:text-[#B2C3D2] leading-relaxed">
                        {flag.details?.description || JSON.stringify(flag.details || {})}
                      </p>

                      <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#D5E0EA] dark:border-[#1E364A]">
                        <span className="text-[13px] text-[#6B7A87] capitalize">
                          Status: <strong>{flag.status}</strong>
                          {flag.reviewedByName ? ` · Reviewed by ${flag.reviewedByName}` : ''}
                        </span>
                        {!isClosed ? (
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              disabled={busyId === flag.id}
                              onClick={() => handleUpdateFlagStatus(flag.id, 'resolved')}
                              className="px-3.5 py-1.5 bg-[#1F5F99] hover:bg-[#184c7a] text-white text-[13px] font-medium rounded-[4px] cursor-pointer disabled:opacity-50"
                            >
                              Mark resolved
                            </button>
                            <button
                              type="button"
                              disabled={busyId === flag.id}
                              onClick={() => handleUpdateFlagStatus(flag.id, 'dismissed')}
                              className="px-3 py-1.5 border border-[#D5E0EA] dark:border-[#1E364A] text-[#43525F] dark:text-[#B2C3D2] text-[13px] font-medium rounded-[4px] cursor-pointer disabled:opacity-50"
                            >
                              Dismiss
                            </button>
                          </div>
                        ) : (
                          <span className="text-[13px] text-[#2F8F5B] font-medium inline-flex items-center gap-1 capitalize">
                            <CheckCircle2 className="w-4 h-4" />
                            <span>{flag.status}</span>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 2. Debarment Registry */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-heading font-semibold text-[22px] text-[#10212E] dark:text-white">
                Statutory debarment registry
              </h2>
              <span className="text-[13px] text-[#6B7A87]">
                {activeDebarmentsCount} active debarment order{activeDebarmentsCount === 1 ? '' : 's'}
              </span>
            </div>

            <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] overflow-hidden">
              {debarments.length === 0 ? (
                <div className="p-8 text-center text-[#6B7A87] text-[14px]">
                  No debarment orders recorded.
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-[14px] divide-y divide-[#D5E0EA] dark:divide-[#1E364A]">
                    <thead className="bg-[#F7FAFD] dark:bg-[#10212E] text-[#6B7A87] font-medium text-[13px]">
                      <tr>
                        <th className="p-4">Supplier</th>
                        <th className="p-4">Scope</th>
                        <th className="p-4">Effective period</th>
                        <th className="p-4">Reason</th>
                        <th className="p-4">Status</th>
                        <th className="p-4 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#D5E0EA] dark:divide-[#1E364A] text-[#10212E] dark:text-white">
                      {debarments.map((deb) => (
                        <tr key={deb.id} className="hover:bg-[#F7FAFD] dark:hover:bg-[#10212E]">
                          <td className="p-4">
                            <div className={`font-semibold ${deb.isActive ? 'text-[#C2412D]' : ''}`}>
                              {deb.entityName}
                            </div>
                            <div className="text-[12px] text-[#6B7A87]">{deb.cipaNumber || '—'}</div>
                          </td>
                          <td className="p-4 text-[13px]">{deb.scope}</td>
                          <td className="p-4 tabular-nums text-[13px] text-[#43525F] dark:text-[#B2C3D2]">
                            {formatDate(deb.startsOn)} – {formatDate(deb.endsOn)}
                          </td>
                          <td className="p-4 text-[13px] text-[#43525F] dark:text-[#B2C3D2] max-w-xs">
                            {deb.reason}
                            {deb.evidenceRef && (
                              <div className="text-[11px] text-[#6B7A87] mt-0.5">Ref: {deb.evidenceRef}</div>
                            )}
                          </td>
                          <td className="p-4">
                            {deb.liftedAt ? (
                              <span className="bg-[#ECFDF5] text-[#2F8F5B] text-[12px] px-2 py-0.5 rounded-[4px] font-medium">
                                Lifted
                              </span>
                            ) : deb.isActive ? (
                              <span className="bg-[#FEF2F2] text-[#C2412D] text-[12px] px-2 py-0.5 rounded-[4px] font-medium">
                                Active block
                              </span>
                            ) : (
                              <span className="bg-slate-100 text-slate-700 text-[12px] px-2 py-0.5 rounded-[4px] font-medium">
                                Scheduled / Expired
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-right">
                            {!deb.liftedAt && (
                              <button
                                type="button"
                                disabled={busyId === deb.id}
                                onClick={() => handleLiftDebarment(deb)}
                                className="px-3 py-1 border border-[#D5E0EA] dark:border-[#1E364A] hover:bg-[#F7FAFD] text-[#1F5F99] text-[13px] font-medium rounded-[4px] cursor-pointer disabled:opacity-50"
                              >
                                {busyId === deb.id ? 'Lifting...' : 'Lift order'}
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Create Risk Flag Modal */}
      {isFlagModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#10212E]/70 backdrop-blur-xs">
          <form
            onSubmit={handleCreateFlag}
            className="w-full max-w-md bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 space-y-4 text-[14px]"
          >
            <h3 className="font-heading font-semibold text-[18px] text-[#10212E] dark:text-white">
              Flag high-risk supplier
            </h3>

            <div className="space-y-1">
              <label className="font-medium block">Supplier *</label>
              <select
                required
                value={flagSupplierId}
                onChange={(e) => setFlagSupplierId(e.target.value)}
                className="w-full p-2.5 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] bg-white dark:bg-[#10212E]"
              >
                <option value="">Select a supplier...</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.legalName} ({s.cipaNumber || 'No CIPA'})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-medium block">Flag category</label>
                <select
                  value={flagType}
                  onChange={(e) => setFlagType(e.target.value as any)}
                  className="w-full p-2.5 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] bg-white dark:bg-[#10212E]"
                >
                  <option value="shared_director">Shared director</option>
                  <option value="shared_address">Shared address</option>
                  <option value="shared_phone">Shared phone</option>
                  <option value="duplicate_document">Duplicate document</option>
                  <option value="price_pattern">Price pattern</option>
                  <option value="other">Other compliance risk</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="font-medium block">Severity</label>
                <select
                  value={flagSeverity}
                  onChange={(e) => setFlagSeverity(e.target.value as any)}
                  className="w-full p-2.5 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] bg-white dark:bg-[#10212E]"
                >
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-medium block">Investigation details *</label>
              <textarea
                required
                rows={3}
                value={flagDesc}
                onChange={(e) => setFlagDesc(e.target.value)}
                placeholder="Describe the integrity anomaly or evidence..."
                className="w-full p-2.5 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] bg-white dark:bg-[#10212E]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsFlagModalOpen(false)}
                className="px-4 py-2 text-[#43525F] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingModal}
                className="px-4 py-2 bg-[#1F5F99] text-white rounded-[6px] font-medium cursor-pointer disabled:opacity-50"
              >
                {isSubmittingModal ? 'Saving...' : 'Create risk flag'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Apply Debarment Modal */}
      {isDebarModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#10212E]/70 backdrop-blur-xs">
          <form
            onSubmit={handleCreateDebarment}
            className="w-full max-w-md bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 space-y-4 text-[14px]"
          >
            <div className="flex items-center gap-2 text-[#C2412D]">
              <ShieldAlert className="w-5 h-5" />
              <h3 className="font-heading font-semibold text-[18px]">Apply supplier debarment</h3>
            </div>

            <div className="space-y-1">
              <label className="font-medium block">Supplier *</label>
              <select
                required
                value={debarSupplierId}
                onChange={(e) => setDebarSupplierId(e.target.value)}
                className="w-full p-2.5 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] bg-white dark:bg-[#10212E]"
              >
                <option value="">Select a supplier...</option>
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.legalName} ({s.cipaNumber || 'No CIPA'})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-medium block">Effective start date</label>
                <input
                  type="date"
                  value={debarStartsOn}
                  onChange={(e) => setDebarStartsOn(e.target.value)}
                  className="w-full p-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] bg-white dark:bg-[#10212E]"
                />
              </div>
              <div className="space-y-1">
                <label className="font-medium block">End date</label>
                <input
                  type="date"
                  disabled={debarPermanent}
                  value={debarPermanent ? '' : debarEndsOn}
                  onChange={(e) => setDebarEndsOn(e.target.value)}
                  className="w-full p-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] bg-white dark:bg-[#10212E] disabled:opacity-50"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 text-[13px] cursor-pointer">
              <input
                type="checkbox"
                checked={debarPermanent}
                onChange={(e) => setDebarPermanent(e.target.checked)}
              />
              <span>Permanent debarment (no automatic expiry date)</span>
            </label>

            <div className="space-y-1">
              <label className="font-medium block">Statutory reason *</label>
              <textarea
                required
                rows={3}
                value={debarReason}
                onChange={(e) => setDebarReason(e.target.value)}
                placeholder="e.g. Submission of falsified tax clearance certificate under Section 109."
                className="w-full p-2.5 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] bg-white dark:bg-[#10212E]"
              />
            </div>

            <div className="space-y-1">
              <label className="font-medium block">Order / Gazette reference (optional)</label>
              <input
                type="text"
                value={debarEvidence}
                onChange={(e) => setDebarEvidence(e.target.value)}
                placeholder="e.g. PPRA-DEB-2026-014"
                className="w-full p-2.5 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] bg-white dark:bg-[#10212E]"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsDebarModalOpen(false)}
                className="px-4 py-2 text-[#43525F] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmittingModal}
                className="px-4 py-2 bg-[#C2412D] hover:bg-[#a63423] text-white rounded-[6px] font-medium cursor-pointer disabled:opacity-50"
              >
                {isSubmittingModal ? 'Applying...' : 'Issue debarment order'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
