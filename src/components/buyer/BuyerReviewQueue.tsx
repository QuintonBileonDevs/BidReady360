import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { buyerApi } from '../../services/api';
import { Application } from '../../types';
import { StatusChip } from '../common/StatusChip';
import { DocumentVaultPreview } from '../common/DocumentVaultPreview';
import {
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ShieldCheck,
  Eye,
  FileText,
  Search,
  X,
  Loader2,
  Clock,
} from 'lucide-react';

export const BuyerReviewQueue: React.FC = () => {
  const { updateApplicationStatus, calls, currentUser, profileSummary } = useApp();
  const [liveApplications, setLiveApplications] = useState<Application[]>([]);
  const [supplierConsentMap, setSupplierConsentMap] = useState<Record<string, any>>({});
  const [isLoadingApps, setIsLoadingApps] = useState(true);

  const [selectedAppId, setSelectedAppId] = useState<string>('');
  const [filterCallId, setFilterCallId] = useState<string>('ALL');
  const [filterStatus, setFilterStatus] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // Decision modal states
  const [isRequestingInfo, setIsRequestingInfo] = useState(false);
  const [infoRequestReason, setInfoRequestReason] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);
  const [isSubmittingDecision, setIsSubmittingDecision] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const reviewerDisplayName =
    currentUser?.fullName || profileSummary?.displayName || 'Procurement Officer';

  const loadQueue = useCallback(async () => {
    setIsLoadingApps(true);
    try {
      const [rows, sups] = await Promise.all([
        buyerApi.listApplications(),
        buyerApi.listSuppliers().catch(() => []),
      ]);

      if (Array.isArray(rows)) {
        const mapped: Application[] = rows.map((r: any) => ({
          id: r.id,
          callId: r.callId,
          callNumber: r.callNumber || '',
          callTitle: r.callTitle || '',
          callType: r.callType === 'eoi' ? 'EOI' : r.callType === 'registration_drive' ? 'Registration drive' : 'RFP',
          closesAt: r.closesAt || undefined,
          supplierId: r.supplierId,
          supplierName: r.supplierLegalName || r.supplierName || 'Supplier',
          organizationId: r.organizationId,
          organizationName: r.organizationName || '',
          consentGrantId: r.consentGrantId || undefined,
          status: r.status || 'Submitted',
          receiptNumber: r.receiptNumber || undefined,
          submittedAt: r.submittedAt
            ? new Date(r.submittedAt).toISOString().slice(0, 16).replace('T', ' ')
            : '',
          withdrawalReason: r.withdrawalReason || undefined,
          sharedDocumentIds: Array.isArray(r.documents)
            ? r.documents.map((d: any) => d.documentVersionId || d.documentTypeId)
            : [],
          documents: Array.isArray(r.documents) ? r.documents : [],
          answers: r.answers || {},
          responses: Array.isArray(r.responses)
            ? r.responses
            : r.answers && typeof r.answers === 'object'
            ? Object.entries(r.answers).map(([label, value]) => ({
                fieldId: label,
                label,
                value: value as string | number | boolean,
              }))
            : [],
          timeline: Array.isArray(r.timeline) ? r.timeline : [],
          informationRequest: r.informationRequest || undefined,
          bid: r.bid || undefined,
        }));
        setLiveApplications(mapped);
        setSelectedAppId((prev) => (prev && mapped.some((m) => m.id === prev) ? prev : mapped[0]?.id || ''));
      }

      if (Array.isArray(sups)) {
        const map: Record<string, any> = {};
        for (const s of sups) {
          map[s.id] = s;
        }
        setSupplierConsentMap(map);
      }
    } catch (err: any) {
      setActionError(err?.message || 'Could not load organization application queue.');
    } finally {
      setIsLoadingApps(false);
    }
  }, []);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  // Real inline document preview state
  const [previewDoc, setPreviewDoc] = useState<{
    title: string;
    fileName: string;
    mimeType: string;
    blob: Blob;
    objectUrl: string;
  } | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  const closePreview = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreviewDoc(null);
    setPreviewError(null);
    setIsPreviewLoading(false);
  }, []);

  useEffect(() => {
    closePreview();
  }, [selectedAppId, closePreview]);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  const handlePreviewSubmittedDoc = async (doc: {
    documentVersionId: string;
    name: string;
    code?: string;
  }) => {
    closePreview();
    setIsPreviewLoading(true);
    setPreviewError(null);
    try {
      const res = await buyerApi.fetchDocumentBlob(doc.documentVersionId);
      previewUrlRef.current = res.objectUrl;
      setPreviewDoc({
        title: doc.name,
        fileName: res.fileName || `${doc.code || 'document'}.pdf`,
        mimeType: res.mimeType || '',
        blob: res.blob,
        objectUrl: res.objectUrl,
      });
    } catch (err: any) {
      setPreviewError(err?.message || 'Unable to load uploaded document file.');
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const selectedApp = liveApplications.find((a) => a.id === selectedAppId) || liveApplications[0];
  const consentedSupplier = selectedApp ? supplierConsentMap[selectedApp.supplierId] : null;
  const attachedDocs = selectedApp?.documents || [];
  const isFinalized = selectedApp ? ['Approved', 'Rejected', 'Withdrawn'].includes(selectedApp.status) : false;

  const filteredApps = liveApplications.filter((a) => {
    const matchesCall = filterCallId === 'ALL' || a.callId === filterCallId;
    const matchesStatus = filterStatus === 'ALL' || a.status === filterStatus;
    const matchesSearch =
      a.supplierName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.callNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      a.callTitle.toLowerCase().includes(searchQuery.toLowerCase());

    return matchesCall && matchesStatus && matchesSearch;
  });

  const recordDecision = async (
    decision: 'Under review' | 'Approved' | 'Rejected' | 'More information requested',
    comment: string
  ) => {
    if (!selectedApp || isSubmittingDecision) return;
    setIsSubmittingDecision(true);
    setActionError(null);
    try {
      await buyerApi.reviewApplication(selectedApp.id, decision, comment);
      await loadQueue();
      updateApplicationStatus(selectedApp.id, decision, comment, reviewerDisplayName);
      setActionSuccess(
        decision === 'Approved'
          ? `Application for ${selectedApp.supplierName} Approved & admitted to roster.`
          : decision === 'Rejected'
          ? `Application rejected: ${selectedApp.supplierName}.`
          : decision === 'Under review'
          ? `Application marked Under review.`
          : `Requested supplementary details from ${selectedApp.supplierName}.`
      );
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err: any) {
      setActionError(err?.message || 'Unable to save review decision.');
    } finally {
      setIsSubmittingDecision(false);
    }
  };

  const handleRequestInfoSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApp || !infoRequestReason.trim()) return;
    await recordDecision('More information requested', infoRequestReason.trim());
    setIsRequestingInfo(false);
    setInfoRequestReason('');
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApp || !rejectReason.trim()) return;
    await recordDecision('Rejected', rejectReason.trim());
    setIsRejecting(false);
    setRejectReason('');
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {actionSuccess && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 text-[#2F8F5B] dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 rounded-xl text-xs flex items-center gap-2 shadow-xs">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}
      {actionError && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 text-[#C2412D] dark:text-rose-300 border border-rose-300 dark:border-rose-800 rounded-xl text-xs flex items-center gap-2 shadow-xs">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      {/* Header */}
      <div className="card-elevated p-6 sm:p-8 flex flex-wrap items-center justify-between gap-6 border-l-4 border-l-[#1F5F99]">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs tabular-nums font-bold text-[#1F5F99] dark:text-[#6FAEE0] bg-[#EAF2FA] dark:bg-slate-800 px-2.5 py-0.5 rounded-md">
              Evaluation Desk
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">· Submitted Dossier Snapshots & Consent Enforcement</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-heading font-bold text-slate-900 dark:text-white">
            Supplier Application Review Queue
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
            Inspect pinned vault dossier snapshots attached at submission, review questionnaire responses, and record audit-backed evaluation decisions.
          </p>
        </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-[#EAF2FA]/50 border border-slate-200 rounded-xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs dark:bg-[#162C3D] dark:border-[#244157]">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search candidate company or tender..."
            className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs dark:bg-[#1C364B] dark:border-[#244157]"
          />
        </div>

        <select
          value={filterCallId}
          onChange={(e) => setFilterCallId(e.target.value)}
          className="w-full p-1.5 bg-white border border-slate-300 rounded-lg text-xs dark:bg-[#1C364B] dark:border-[#244157]"
        >
          <option value="ALL">All Tenders & Drives</option>
          {calls.map((c) => (
            <option key={c.id} value={c.id}>
              {c.callNumber} — {c.title.substring(0, 30)}
            </option>
          ))}
        </select>

        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value)}
          className="w-full p-1.5 bg-white border border-slate-300 rounded-lg text-xs dark:bg-[#1C364B] dark:border-[#244157]"
        >
          <option value="ALL">All Application Statuses</option>
          <option value="Submitted">Submitted</option>
          <option value="Under review">Under review</option>
          <option value="More information requested">More information requested</option>
          <option value="Approved">Approved</option>
          <option value="Rejected">Rejected</option>
          <option value="Withdrawn">Withdrawn</option>
        </select>
      </div>

      {/* Split-View */}
      {isLoadingApps ? (
        <div className="p-12 bg-white border border-slate-200 rounded-2xl flex items-center justify-center gap-2 text-xs text-slate-500 dark:bg-[#1C364B] dark:text-[#9CB4C9] dark:border-[#244157]">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span>Loading application dossiers...</span>
        </div>
      ) : liveApplications.length === 0 ? (
        <div className="p-12 bg-white border border-slate-200 rounded-2xl text-center text-xs text-slate-500 dark:bg-[#1C364B] dark:text-[#9CB4C9] dark:border-[#244157]">
          No submitted applications found for your procuring organization yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-5 space-y-3">
            <h3 className="font-heading font-semibold text-sm text-[#10212E] dark:text-white">
              Submissions ({filteredApps.length})
            </h3>

            <div className="space-y-2.5 max-h-[700px] overflow-y-auto">
              {filteredApps.map((app) => {
                const isSelected = selectedApp?.id === app.id;
                return (
                  <div
                    key={app.id}
                    onClick={() => setSelectedAppId(app.id)}
                    className={`p-4 rounded-2xl border cursor-pointer transition-all ${
                      isSelected
                        ? 'bg-white border-[#1F5F99] ring-2 ring-[#1F5F99]/20 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-slate-300 dark:bg-[#1C364B] dark:border-[#244157]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <span className="font-semibold text-xs text-[#10212E] leading-snug dark:text-white">
                        {app.supplierName}
                      </span>
                      <StatusChip status={app.status} />
                    </div>

                    <p className="text-[11px] text-slate-500 tabular-nums mt-1 dark:text-[#9CB4C9]">
                      {app.callNumber} · {app.callType}
                    </p>

                    <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2 pt-2 border-t border-slate-100 dark:border-[#244157]">
                      <span>Submitted: {app.submittedAt || '—'}</span>
                      {app.bid && app.bid.totalAmountBWP != null && (
                        <span className="tabular-nums font-bold text-slate-800 dark:text-white">
                          BWP {Number(app.bid.totalAmountBWP).toLocaleString()}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Column */}
          {selectedApp && (
            <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-2xs dark:bg-[#1C364B] dark:border-[#244157]">
              <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-slate-100 dark:border-[#244157]">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs tabular-nums font-bold text-[#1F5F99] dark:text-[#6FAEE0]">{selectedApp.callNumber}</span>
                    <span className="text-xs text-slate-400">·</span>
                    <span className="text-xs text-slate-600 font-medium dark:text-[#D3E3F2]">{selectedApp.callType}</span>
                    {selectedApp.receiptNumber && (
                      <span className="text-[11px] tabular-nums text-slate-400">· {selectedApp.receiptNumber}</span>
                    )}
                  </div>
                  <h3 className="font-heading font-bold text-lg text-[#10212E] mt-0.5 dark:text-white">
                    {selectedApp.supplierName}
                  </h3>
                  <span className="text-xs text-slate-500 dark:text-[#9CB4C9]">
                    Target Call: {selectedApp.callTitle}
                  </span>
                </div>

                <StatusChip status={selectedApp.status} />
              </div>

              {/* Consent-Scoped Company Profile Summary */}
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3 text-xs dark:bg-[#162C3D] dark:border-[#244157]">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] flex items-center gap-2 dark:text-white">
                    <ShieldCheck className="w-4 h-4 text-[#2F8F5B]" />
                    <span>Supplier Profile & Consent Scope</span>
                  </h4>
                  <span
                    className={`text-[10px] font-semibold px-2 py-0.5 rounded capitalize ${
                      consentedSupplier?.consentStatus === 'active'
                        ? 'bg-emerald-50 text-[#2F8F5B] dark:bg-[#2F8F5B]/20'
                        : 'bg-amber-50 text-amber-900 dark:bg-[#E8A33D]/20'
                    }`}
                  >
                    Consent: {consentedSupplier?.consentStatus || 'Submitted dossier only'}
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <div>
                    <span className="text-slate-400 block text-[10px]">CIPA UIN</span>
                    <span className="tabular-nums font-bold text-slate-800 dark:text-white">
                      {consentedSupplier?.cipaNumber || '[Consent restricted]'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">BURS TIN</span>
                    <span className="tabular-nums font-bold text-slate-800 dark:text-white">
                      {consentedSupplier?.tinNumber || '[Consent restricted]'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">CITIZEN SHAREHOLDING</span>
                    <span className="font-bold text-[#2F8F5B]">
                      {consentedSupplier?.citizenOwnedPercentage != null
                        ? `${consentedSupplier.citizenOwnedPercentage}% Citizen`
                        : '—'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">CITY / ADDRESS</span>
                    <span className="text-slate-700 truncate block dark:text-[#D3E3F2]">
                      {consentedSupplier?.physicalAddress || consentedSupplier?.city || '[Consent restricted]'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">VERIFICATION STANDING</span>
                    <span className="font-medium text-slate-800 capitalize dark:text-white">
                      {consentedSupplier?.complianceStatus || 'Recorded on dossier'}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block text-[10px]">EDD STATUS</span>
                    <span className="font-bold text-[#1F5F99] dark:text-[#6FAEE0]">
                      {consentedSupplier?.eddCertified ? 'EDD Certified' : 'Standard'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Pinned Submitted Dossier Documents */}
              <div className="space-y-3 text-xs">
                <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] dark:text-white">
                  Pinned Dossier Compliance Documents ({attachedDocs.length})
                </h4>

                {attachedDocs.length === 0 ? (
                  <div className="p-4 border border-slate-200 rounded-xl text-slate-500 dark:text-[#9CB4C9] dark:border-[#244157]">
                    No pinned compliance documents were attached to this application.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100 border border-slate-200 rounded-xl overflow-hidden dark:border-[#244157] dark:divide-[#244157]">
                    {attachedDocs.map((doc) => (
                      <div key={doc.documentVersionId} className="p-3 bg-white flex items-center justify-between gap-3 dark:bg-[#1C364B]">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <FileText className="w-4 h-4 text-[#1F5F99] shrink-0 dark:text-[#6FAEE0]" />
                          <div className="min-w-0">
                            <span className="font-semibold text-slate-900 block truncate dark:text-white">
                              {doc.name} (v{doc.versionNo})
                            </span>
                            <span className="text-[11px] text-slate-500 tabular-nums block truncate dark:text-[#9CB4C9]">
                              Doc: {doc.documentNumber || '—'} · Exp: {doc.expiryDate ? String(doc.expiryDate).slice(0, 10) : 'None'} · SHA {String(doc.sha256 || '').slice(0, 10)}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <StatusChip
                            status={
                              String(doc.verificationStatus || '').toUpperCase() === 'VERIFIED'
                                ? 'Verified'
                                : String(doc.verificationStatus || '').toUpperCase() === 'REJECTED'
                                ? 'Rejected'
                                : 'Pending'
                            }
                          />
                          <button
                            type="button"
                            onClick={() => handlePreviewSubmittedDoc(doc)}
                            className="p-1.5 text-slate-500 hover:text-[#1F5F99] rounded hover:bg-slate-100 cursor-pointer dark:text-[#9CB4C9] dark:hover:bg-[#162C3D] dark:hover:text-[#6FAEE0]"
                            title="Preview pinned document"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {(isPreviewLoading || previewError || previewDoc) && (
                  <div className="border border-slate-200 rounded-xl overflow-hidden mt-3 dark:border-[#244157]">
                    <div className="px-3.5 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2 dark:bg-[#162C3D] dark:border-[#244157]">
                      <span className="font-semibold text-slate-800 truncate dark:text-white">
                        {previewDoc ? `${previewDoc.title} — ${previewDoc.fileName}` : 'Loading document preview...'}
                      </span>
                      <button
                        type="button"
                        onClick={closePreview}
                        className="text-slate-400 hover:text-slate-700 cursor-pointer"
                        title="Close preview"
                      >
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

              {/* Information Request History */}
              {selectedApp.informationRequest && (
                <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 space-y-1 text-xs dark:border-[#E8A33D]/40">
                  <span className="font-bold text-amber-900 block">Information Request Inquiry</span>
                  <p className="text-amber-950">{selectedApp.informationRequest.message}</p>
                  {selectedApp.informationRequest.responseNote && (
                    <p className="text-emerald-900 pt-1 border-t border-amber-200 dark:border-[#E8A33D]/40">
                      <strong>Supplier Response:</strong> {selectedApp.informationRequest.responseNote}
                    </p>
                  )}
                </div>
              )}

              {/* Questionnaire Responses */}
              {selectedApp.responses.length > 0 && (
                <div className="space-y-3 text-xs">
                  <h4 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] dark:text-white">
                    Questionnaire Responses
                  </h4>
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5 dark:bg-[#162C3D] dark:border-[#244157]">
                    {selectedApp.responses.map((resp, idx) => (
                      <div key={idx} className="pb-2 border-b border-slate-200/60 last:border-0 last:pb-0">
                        <span className="font-semibold text-slate-700 block text-[11px] dark:text-[#D3E3F2]">{resp.label}</span>
                        <span className="font-medium text-slate-900 block mt-0.5 dark:text-white">
                          {typeof resp.value === 'boolean'
                            ? resp.value
                              ? 'Yes'
                              : 'No'
                            : String(resp.value || 'N/A')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions Bar */}
              <div className="pt-4 border-t border-slate-200 space-y-3 dark:border-[#244157]">
                <span className="text-xs font-bold text-slate-700 block dark:text-[#D3E3F2]">Evaluation Decision & Status Action:</span>

                {isFinalized ? (
                  <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-600 dark:bg-[#162C3D] dark:text-[#D3E3F2] dark:border-[#244157]">
                    This application is in finalized status (<strong>{selectedApp.status}</strong>) and cannot transition further.
                    {selectedApp.withdrawalReason ? ` Reason: ${selectedApp.withdrawalReason}` : ''}
                  </div>
                ) : (
                  <div className="flex flex-wrap gap-2.5">
                    {selectedApp.status !== 'Under review' && (
                      <button
                        type="button"
                        disabled={isSubmittingDecision}
                        onClick={() => recordDecision('Under review', 'Dossier opened for compliance & technical committee review.')}
                        className="px-4 py-2 bg-[#EAF2FA] hover:bg-[#1F5F99] text-[#1F5F99] hover:text-white font-semibold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 dark:bg-[#162C3D] dark:text-[#6FAEE0]"
                      >
                        <Clock className="w-4 h-4" />
                        <span>Mark Under review</span>
                      </button>
                    )}

                    <button
                      type="button"
                      disabled={isSubmittingDecision}
                      onClick={() =>
                        recordDecision(
                          'Approved',
                          'Verified compliance documents and questionnaire responses. Approved by procurement officer.'
                        )
                      }
                      className="px-4 py-2 bg-[#2F8F5B] hover:bg-emerald-700 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer disabled:opacity-50"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Approve & Admit to Roster</span>
                    </button>

                    <button
                      type="button"
                      disabled={isSubmittingDecision}
                      onClick={() => setIsRequestingInfo(true)}
                      className="px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 font-semibold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 dark:bg-[#E8A33D]/20"
                    >
                      <AlertTriangle className="w-4 h-4 text-[#E8A33D]" />
                      <span>Request More Information</span>
                    </button>

                    <button
                      type="button"
                      disabled={isSubmittingDecision}
                      onClick={() => setIsRejecting(true)}
                      className="px-4 py-2 bg-rose-50 hover:bg-rose-100 text-[#C2412D] border border-rose-200 font-semibold text-xs rounded-xl flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50 dark:bg-[#C2412D]/20 dark:border-[#C2412D]/40"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Reject</span>
                    </button>
                  </div>
                )}
              </div>

              {isRequestingInfo && (
                <form onSubmit={handleRequestInfoSubmit} className="p-4 bg-amber-50 border border-amber-300 rounded-xl space-y-3 text-xs dark:bg-[#E8A33D]/20">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-amber-900">Specify Missing or Clarification Requirements:</span>
                    <button type="button" onClick={() => setIsRequestingInfo(false)} className="text-amber-800 dark:text-[#FCD34D]">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <textarea
                    rows={3}
                    required
                    value={infoRequestReason}
                    onChange={(e) => setInfoRequestReason(e.target.value)}
                    placeholder="e.g. Please provide updated bank rating certificate..."
                    className="w-full p-2.5 bg-white border border-amber-300 rounded-lg text-slate-900 dark:bg-[#1C364B] dark:text-white"
                  />

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsRequestingInfo(false)}
                      className="px-3 py-1.5 text-slate-600 dark:text-[#D3E3F2]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingDecision}
                      className="px-4 py-1.5 bg-[#1F5F99] text-white font-semibold rounded-lg hover:bg-[#184a77]"
                    >
                      Send Inquiry to Supplier
                    </button>
                  </div>
                </form>
              )}

              {isRejecting && (
                <form onSubmit={handleRejectSubmit} className="p-4 bg-rose-50 border border-rose-300 rounded-xl space-y-3 text-xs dark:bg-[#C2412D]/20">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-rose-900">Enter Statutory Reason for Rejection:</span>
                    <button type="button" onClick={() => setIsRejecting(false)} className="text-rose-800 dark:text-[#FCA5A5]">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  <textarea
                    rows={3}
                    required
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="e.g. Non-compliance with mandatory technical qualification criteria..."
                    className="w-full p-2.5 bg-white border border-rose-300 rounded-lg text-slate-900 dark:bg-[#1C364B] dark:text-white"
                  />

                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setIsRejecting(false)}
                      className="px-3 py-1.5 text-slate-600 dark:text-[#D3E3F2]"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSubmittingDecision}
                      className="px-4 py-1.5 bg-[#C2412D] text-white font-semibold rounded-lg hover:bg-rose-800"
                    >
                      Confirm Rejection
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
