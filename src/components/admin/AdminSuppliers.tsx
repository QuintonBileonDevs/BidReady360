import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  adminApi,
  AdminSupplierRecord,
  AdminSupplierDetail,
} from '../../services/api';
import {
  Search,
  AlertCircle,
  CheckCircle2,
  Lock,
  Eye,
  Loader2,
  RefreshCw,
  ShieldAlert,
  X,
} from 'lucide-react';
import { AdminSupportModal } from './AdminSupportModal';
import { DocumentVaultPreview } from '../common/DocumentVaultPreview';

interface AdminSuppliersProps {
  onStartSupportSession: (entityName: string, reason: string) => void;
}

function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString('en-BW', { year: 'numeric', month: 'short', day: 'numeric' });
}

function verificationBadge(status: string) {
  switch (status) {
    case 'verified':
      return { label: 'Verified', cls: 'bg-[#ECFDF5] text-[#2F8F5B]' };
    case 'rejected':
      return { label: 'Rejected', cls: 'bg-[#FEF2F2] text-[#C2412D]' };
    case 'pending':
      return { label: 'Pending review', cls: 'bg-[#FFFBEB] text-[#92400E]' };
    default:
      return { label: 'Unverified', cls: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' };
  }
}

export const AdminSuppliers: React.FC<AdminSuppliersProps> = ({
  onStartSupportSession,
}) => {
  const [suppliers, setSuppliers] = useState<AdminSupplierRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');

  // Detail Drawer state
  const [detail, setDetail] = useState<AdminSupplierDetail | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [newVerStatus, setNewVerStatus] = useState<'unverified' | 'pending' | 'verified' | 'rejected'>('verified');
  const [newCompStatus, setNewCompStatus] = useState<'Fully compliant' | 'Action required' | 'Non-compliant'>('Fully compliant');
  const [verNotes, setVerNotes] = useState('');
  const [isSavingVer, setIsSavingVer] = useState(false);

  // Document preview inside drawer
  const [previewDoc, setPreviewDoc] = useState<{ versionId: string; title: string; fileName: string; mimeType: string; blob: Blob; objectUrl: string } | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  // Support modal
  const [supportTarget, setSupportTarget] = useState<{ id: string; name: string } | null>(null);

  const revokePreview = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreviewDoc(null);
    setPreviewError(null);
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  const loadSuppliers = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const data = await adminApi.listSuppliers({
        verificationStatus: statusFilter === 'all' ? undefined : statusFilter,
      });
      setSuppliers(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err?.message || 'Unable to load registered suppliers.');
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    loadSuppliers();
  }, [loadSuppliers]);

  const openSupplierDrawer = async (supplierId: string) => {
    revokePreview();
    setIsLoadingDetail(true);
    setError(null);
    try {
      const data = await adminApi.getSupplierDetail(supplierId);
      setDetail(data);
      setNewVerStatus(data.supplier.verificationStatus);
      setNewCompStatus(data.supplier.complianceStatus);
      setVerNotes('');
    } catch (err: any) {
      setError(err?.message || 'Unable to load supplier compliance profile.');
    } finally {
      setIsLoadingDetail(false);
    }
  };

  const handleSaveVerification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detail) return;
    setIsSavingVer(true);
    setError(null);
    try {
      await adminApi.updateSupplierVerification(detail.supplier.id, {
        verificationStatus: newVerStatus,
        complianceStatus: newCompStatus,
        notes: verNotes.trim() || undefined,
      });
      setFeedback(`Updated verification status for "${detail.supplier.legalName}" to ${newVerStatus}.`);
      setTimeout(() => setFeedback(null), 4000);
      await Promise.all([loadSuppliers(), openSupplierDrawer(detail.supplier.id)]);
    } catch (err: any) {
      setError(err?.message || 'Failed to update supplier verification status.');
    } finally {
      setIsSavingVer(false);
    }
  };

  const handleInspectFile = async (versionId: string, title: string) => {
    revokePreview();
    setIsPreviewLoading(true);
    setPreviewError(null);
    try {
      const res = await adminApi.fetchDocumentBlob(versionId);
      previewUrlRef.current = res.objectUrl;
      setPreviewDoc({
        versionId,
        title,
        fileName: res.fileName,
        mimeType: res.mimeType,
        blob: res.blob,
        objectUrl: res.objectUrl,
      });
    } catch (err: any) {
      setPreviewError(err?.message || 'Failed to load document file.');
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const filteredSuppliers = suppliers.filter((s) => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return true;
    return (
      s.legalName.toLowerCase().includes(q) ||
      (s.cipaNumber || '').toLowerCase().includes(q) ||
      (s.tinNumber || '').toLowerCase().includes(q) ||
      (s.email || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#D5E0EA] dark:border-[#244157]">
        <div className="space-y-1">
          <h1 className="font-heading font-semibold text-[30px] leading-tight text-[#10212E] dark:text-white">
            Registered suppliers
          </h1>
          <p className="text-[15px] text-[#43525F] dark:text-[#D3E3F2]">
            Inspect supplier profiles, directors (Omang compliance), vault document health, and overall verification status.
          </p>
        </div>
        <button
          type="button"
          onClick={loadSuppliers}
          disabled={isLoading}
          className="px-3.5 py-2 border border-[#D5E0EA] dark:border-[#244157] bg-white dark:bg-[#1C364B] hover:bg-[#F7FAFD] text-[#10212E] dark:text-white rounded-[6px] text-[13px] font-medium inline-flex items-center gap-1.5 cursor-pointer self-start sm:self-auto dark:hover:bg-[#162C3D]"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {error && (
        <div className="p-3.5 rounded-[8px] bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-[#C2412D] dark:text-rose-200 text-[14px] flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {feedback && (
        <div className="p-3.5 rounded-[8px] bg-[#ECFDF5] border border-[#A7F3D0] text-[#065F46] text-[14px] flex items-center gap-2 dark:bg-[#2F8F5B]/20 dark:text-[#6EE7B7] dark:border-[#2F8F5B]/40">
          <CheckCircle2 className="w-4 h-4 text-[#2F8F5B] shrink-0" />
          <span>{feedback}</span>
        </div>
      )}

      {/* Filters & Search */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          {(['all', 'pending', 'unverified', 'verified', 'rejected'] as const).map((st) => (
            <button
              key={st}
              type="button"
              onClick={() => setStatusFilter(st)}
              className={`px-3 py-1.5 rounded-[6px] text-[13px] font-medium capitalize cursor-pointer ${
                statusFilter === st
                  ? 'bg-[#1F5F99] text-white'
                  : 'bg-white dark:bg-[#1C364B] text-[#43525F] dark:text-[#D3E3F2] border border-[#D5E0EA] dark:border-[#244157]'
              }`}
            >
              {st}
            </button>
          ))}
        </div>

        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-[#6B7A87] absolute left-3 top-1/2 -translate-y-1/2 dark:text-[#9CB4C9]" />
          <input
            type="text"
            placeholder="Search legal name, CIPA, TIN..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-[#D5E0EA] dark:border-[#244157] rounded-[6px] bg-white dark:bg-[#1C364B] text-[#10212E] dark:text-white text-[14px]"
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-[#1C364B] rounded-[12px] border border-[#D5E0EA] dark:border-[#244157] overflow-hidden">
        {isLoading ? (
          <div className="p-12 flex items-center justify-center gap-2 text-[#6B7A87] text-[14px] dark:text-[#9CB4C9]">
            <Loader2 className="w-4 h-4 animate-spin text-[#1F5F99] dark:text-[#6FAEE0]" />
            <span>Loading registered suppliers...</span>
          </div>
        ) : filteredSuppliers.length === 0 ? (
          <div className="p-12 text-center text-[#6B7A87] text-[15px] dark:text-[#9CB4C9]">
            No supplier profiles match your current filter.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[14px] divide-y divide-[#D5E0EA] dark:divide-[#244157]">
              <thead className="bg-[#F7FAFD] dark:bg-[#10212E] text-[#6B7A87] font-medium text-[13px] dark:text-[#9CB4C9]">
                <tr>
                  <th className="p-4">Company legal name</th>
                  <th className="p-4">CIPA UIN</th>
                  <th className="p-4">Verification</th>
                  <th className="p-4">Vault documents</th>
                  <th className="p-4">Directors KYC</th>
                  <th className="p-4">Citizen owned</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D5E0EA] dark:divide-[#244157] text-[#10212E] dark:text-white">
                {filteredSuppliers.map((sup) => {
                  const badge = verificationBadge(sup.verificationStatus);
                  return (
                    <tr key={sup.id} className="hover:bg-[#F7FAFD] dark:hover:bg-[#10212E] transition-colors">
                      <td className="p-4">
                        <button
                          type="button"
                          onClick={() => openSupplierDrawer(sup.id)}
                          className="font-semibold hover:text-[#1F5F99] text-left cursor-pointer block dark:hover:text-[#6FAEE0]"
                        >
                          {sup.legalName}
                        </button>
                        {sup.activeDebarments > 0 && (
                          <span className="inline-flex items-center gap-1 mt-1 text-[11px] font-semibold px-2 py-0.5 rounded-[4px] bg-[#FEF2F2] text-[#C2412D] dark:bg-[#C2412D]/20">
                            <ShieldAlert className="w-3 h-3" /> Debarred
                          </span>
                        )}
                      </td>
                      <td className="p-4 font-sans text-[#43525F] dark:text-[#D3E3F2]">{sup.cipaNumber || '—'}</td>
                      <td className="p-4">
                        <span className={`text-[12px] px-2 py-0.5 rounded-[4px] font-medium ${badge.cls}`}>
                          {badge.label}
                        </span>
                      </td>
                      <td className="p-4 text-[13px]">
                        <div className="text-[#10212E] dark:text-white font-medium tabular-nums">
                          {sup.verifiedDocs}/{sup.totalDocs} verified
                        </div>
                        {sup.expiredDocs > 0 && (
                          <span className="text-[11px] text-[#C2412D] font-medium">{sup.expiredDocs} expired</span>
                        )}
                      </td>
                      <td className="p-4 text-[13px] tabular-nums text-[#43525F] dark:text-[#D3E3F2]">
                        {sup.verifiedPeopleCount}/{sup.peopleCount} verified
                      </td>
                      <td className="p-4 tabular-nums text-[#43525F] dark:text-[#D3E3F2]">
                        {sup.citizenOwnedPercentage}%
                      </td>
                      <td className="p-4 text-right">
                        <button
                          type="button"
                          onClick={() => openSupplierDrawer(sup.id)}
                          className="px-3 py-1 border border-[#D5E0EA] dark:border-[#244157] hover:bg-[#F7FAFD] dark:hover:bg-[#10212E] text-[#10212E] dark:text-white text-[13px] font-medium rounded-[4px] cursor-pointer"
                        >
                          Inspect profile
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Supplier Compliance & Verification Drawer */}
      {(isLoadingDetail || detail) && (
        <div className="fixed inset-0 z-50 flex justify-end bg-[#10212E]/60 backdrop-blur-xs">
          <div className="w-full max-w-2xl bg-white dark:bg-[#1C364B] h-full shadow-lg p-6 overflow-y-auto space-y-6 text-[14px]">
            {isLoadingDetail || !detail ? (
              <div className="h-64 flex items-center justify-center gap-2 text-[#6B7A87] dark:text-[#9CB4C9]">
                <Loader2 className="w-5 h-5 animate-spin text-[#1F5F99] dark:text-[#6FAEE0]" />
                <span>Loading supplier compliance dossier...</span>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between pb-4 border-b border-[#D5E0EA] dark:border-[#244157]">
                  <div className="space-y-1">
                    <span className="text-[12px] text-[#6B7A87] dark:text-[#9CB4C9]">Supplier compliance inspection</span>
                    <h3 className="font-heading font-semibold text-[22px] text-[#10212E] dark:text-white">
                      {detail.supplier.legalName}
                    </h3>
                    <p className="text-[13px] text-[#6B7A87] dark:text-[#9CB4C9]">
                      CIPA {detail.supplier.cipaNumber || '—'} · BURS TIN {detail.supplier.tinNumber || '—'} · Completeness {detail.supplier.profileCompleteness}%
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      revokePreview();
                      setDetail(null);
                    }}
                    className="text-[#6B7A87] hover:text-[#10212E] p-1 cursor-pointer dark:text-[#9CB4C9] dark:hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Active Debarment Warning */}
                {detail.debarments.some((d) => !d.liftedAt) && (
                  <div className="p-3.5 rounded-[8px] bg-[#FEF2F2] border border-rose-200 text-[#C2412D] text-[13px] dark:bg-[#C2412D]/20 dark:border-[#C2412D]/40">
                    <strong>Active Debarment Order:</strong>{' '}
                    {detail.debarments.find((d) => !d.liftedAt)?.reason}
                  </div>
                )}

                {/* Overall Verification Status Update Form */}
                <form
                  onSubmit={handleSaveVerification}
                  className="p-4 rounded-[8px] bg-[#F7FAFD] dark:bg-[#10212E] border border-[#D5E0EA] dark:border-[#244157] space-y-3"
                >
                  <div className="font-semibold text-[#10212E] dark:text-white">
                    Overall supplier verification decision
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[12px] text-[#6B7A87] block mb-1 dark:text-[#9CB4C9]">Verification status</label>
                      <select
                        value={newVerStatus}
                        onChange={(e) => setNewVerStatus(e.target.value as any)}
                        className="w-full p-2 border border-[#D5E0EA] dark:border-[#244157] rounded-[6px] bg-white dark:bg-[#1C364B] text-[13px]"
                      >
                        <option value="unverified">Unverified</option>
                        <option value="pending">Pending review</option>
                        <option value="verified">Verified</option>
                        <option value="rejected">Rejected</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-[12px] text-[#6B7A87] block mb-1 dark:text-[#9CB4C9]">Compliance standing</label>
                      <select
                        value={newCompStatus}
                        onChange={(e) => setNewCompStatus(e.target.value as any)}
                        className="w-full p-2 border border-[#D5E0EA] dark:border-[#244157] rounded-[6px] bg-white dark:bg-[#1C364B] text-[13px]"
                      >
                        <option value="Fully compliant">Fully compliant</option>
                        <option value="Action required">Action required</option>
                        <option value="Non-compliant">Non-compliant</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="text-[12px] text-[#6B7A87] block mb-1 dark:text-[#9CB4C9]">Audit note (optional)</label>
                    <input
                      type="text"
                      value={verNotes}
                      onChange={(e) => setVerNotes(e.target.value)}
                      placeholder="e.g. All CIPA, BURS and director IDs checked."
                      className="w-full p-2 border border-[#D5E0EA] dark:border-[#244157] rounded-[6px] bg-white dark:bg-[#1C364B] text-[13px]"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isSavingVer}
                    className="px-4 py-2 bg-[#1F5F99] hover:bg-[#184c7a] text-white rounded-[6px] text-[13px] font-medium cursor-pointer disabled:opacity-50"
                  >
                    {isSavingVer ? 'Saving...' : 'Update supplier verification'}
                  </button>
                </form>

                {/* Directors & Omang Validation */}
                <div className="space-y-2">
                  <h4 className="font-semibold text-[#10212E] dark:text-white">
                    Directors &amp; Shareholders ({detail.directors.length})
                  </h4>
                  {detail.directors.length === 0 ? (
                    <div className="p-4 text-[13px] text-[#6B7A87] border border-dashed border-[#D5E0EA] rounded-[8px] dark:text-[#9CB4C9] dark:border-[#244157]">
                      No directors or shareholders registered yet.
                    </div>
                  ) : (
                    <div className="divide-y divide-[#D5E0EA] dark:divide-[#244157] border border-[#D5E0EA] dark:border-[#244157] rounded-[8px]">
                      {detail.directors.map((dir) => (
                        <div key={dir.id} className="p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[13px]">
                          <div>
                            <div className="font-semibold text-[#10212E] dark:text-white">
                              {dir.fullName}{' '}
                              <span className="font-normal text-[#6B7A87] capitalize dark:text-[#9CB4C9]">
                                ({dir.personRole.replace(/_/g, ' ')} · {dir.ownershipPercent ?? 0}%)
                              </span>
                            </div>
                            <div className="text-[12px] text-[#6B7A87] flex items-center flex-wrap gap-2 mt-0.5 dark:text-[#9CB4C9]">
                              <span>
                                {dir.identityType || 'OMANG'} {dir.idLast4 ? `•••••${dir.idLast4}` : 'not provided'}
                              </span>
                              <span>· Gender: {dir.gender || 'not specified'}</span>
                              {dir.omangValid === true && (
                                <span className="text-[#2F8F5B] font-medium">✓ Omang valid</span>
                              )}
                              {dir.omangValid === false && (
                                <span className="text-[#C2412D] font-medium">✗ {dir.omangMessage}</span>
                              )}
                            </div>
                          </div>
                          <span
                            className={`text-[11px] px-2 py-0.5 rounded-[4px] font-medium shrink-0 capitalize ${
                              dir.kycStatus === 'verified'
                                ? 'bg-[#ECFDF5] text-[#2F8F5B]'
                                : dir.kycStatus === 'failed'
                                ? 'bg-[#FEF2F2] text-[#C2412D]'
                                : 'bg-[#FFFBEB] text-[#92400E]'
                            }`}
                          >
                            {dir.kycStatus.replace(/_/g, ' ')}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Uploaded Vault Documents */}
                <div className="space-y-2">
                  <h4 className="font-semibold text-[#10212E] dark:text-white">
                    Vault Documents ({detail.documents.length})
                  </h4>
                  {detail.documents.length === 0 ? (
                    <div className="p-4 text-[13px] text-[#6B7A87] border border-dashed border-[#D5E0EA] rounded-[8px] dark:text-[#9CB4C9] dark:border-[#244157]">
                      No active vault documents uploaded yet.
                    </div>
                  ) : (
                    <div className="divide-y divide-[#D5E0EA] dark:divide-[#244157] border border-[#D5E0EA] dark:border-[#244157] rounded-[8px]">
                      {detail.documents.map((doc) => (
                        <div key={doc.versionId} className="p-3 flex items-center justify-between gap-3 text-[13px]">
                          <div className="min-w-0">
                            <div className="font-semibold text-[#10212E] dark:text-white truncate">
                              {doc.documentTypeName}
                            </div>
                            <div className="text-[12px] text-[#6B7A87] truncate dark:text-[#9CB4C9]">
                              {doc.fileName} · Ref: {doc.documentNumber || '—'} · Exp: {formatDate(doc.expiryDate)}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span
                              className={`text-[11px] px-2 py-0.5 rounded-[4px] font-medium ${
                                doc.verificationStatus === 'VERIFIED'
                                  ? 'bg-[#ECFDF5] text-[#2F8F5B]'
                                  : doc.verificationStatus === 'REJECTED'
                                  ? 'bg-[#FEF2F2] text-[#C2412D]'
                                  : 'bg-[#FFFBEB] text-[#92400E]'
                              }`}
                            >
                              {doc.verificationStatus}
                            </span>
                            <button
                              type="button"
                              onClick={() => handleInspectFile(doc.versionId, doc.documentTypeName)}
                              className="px-2.5 py-1 border border-[#D5E0EA] dark:border-[#244157] rounded-[4px] text-[#1F5F99] text-[12px] font-medium inline-flex items-center gap-1 cursor-pointer dark:text-[#6FAEE0]"
                            >
                              <Eye className="w-3.5 h-3.5" />
                              <span>View</span>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {(isPreviewLoading || previewError || previewDoc) && (
                    <div className="border border-[#D5E0EA] dark:border-[#244157] rounded-[8px] overflow-hidden mt-3">
                      <div className="px-3 py-2 bg-[#F7FAFD] dark:bg-[#10212E] flex items-center justify-between border-b border-[#D5E0EA] dark:border-[#244157]">
                        <span className="text-[12px] font-semibold truncate">
                          {previewDoc ? `${previewDoc.title} — ${previewDoc.fileName}` : 'Loading file...'}
                        </span>
                        <button type="button" onClick={revokePreview} className="text-[#6B7A87] cursor-pointer dark:text-[#9CB4C9]" title="Close preview">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                      <DocumentVaultPreview
                        blob={previewDoc?.blob || null}
                        objectUrl={previewDoc?.objectUrl || null}
                        fileName={previewDoc?.fileName || 'document'}
                        mimeType={previewDoc?.mimeType || ''}
                        title={previewDoc?.title}
                        isLoading={isPreviewLoading}
                        error={previewError}
                        maxHeightClass="h-[420px]"
                      />
                    </div>
                  )}
                </div>

                {/* Support Session Action */}
                <div className="pt-3 border-t border-[#D5E0EA] dark:border-[#244157]">
                  <button
                    type="button"
                    onClick={() => setSupportTarget({ id: detail.supplier.id, name: detail.supplier.legalName })}
                    className="w-full py-2 border border-[#1F5F99] text-[#1F5F99] hover:bg-[#EAF2FA] rounded-[6px] font-medium text-[13px] flex items-center justify-center gap-1.5 cursor-pointer dark:text-[#6FAEE0] dark:hover:bg-[#162C3D]"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Start logged support session for this supplier</span>
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      <AdminSupportModal
        isOpen={Boolean(supportTarget)}
        onClose={() => setSupportTarget(null)}
        targetEntityId={supportTarget?.id}
        targetEntityName={supportTarget?.name || ''}
        targetType="Supplier"
        onGrantAccess={(reason) => {
          if (supportTarget) onStartSupportSession(supportTarget.name, reason);
        }}
      />
    </div>
  );
};
