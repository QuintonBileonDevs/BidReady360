import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  adminApi,
  AdminQueuePerson,
  AdminQueueDocument,
} from '../../services/api';
import {
  FileCheck2,
  Eye,
  Check,
  Clock,
  ShieldCheck,
  AlertCircle,
  Users,
  FileText,
  Loader2,
  RefreshCw,
  X,
} from 'lucide-react';
import { DocumentVaultPreview } from '../common/DocumentVaultPreview';

type QueueEntry =
  | { kind: 'person'; id: string; person: AdminQueuePerson }
  | { kind: 'document'; id: string; document: AdminQueueDocument };

function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString('en-BW', { year: 'numeric', month: 'short', day: 'numeric' });
}

function getPersonStatusMeta(status: string) {
  if (status === 'verified') {
    return { label: 'Verified', className: 'bg-[#ECFDF5] text-[#2F8F5B]' };
  }
  if (status === 'failed') {
    return { label: 'Rejected', className: 'bg-[#FEF2F2] text-[#C2412D]' };
  }
  if (status === 'pending') {
    return { label: 'Pending review', className: 'bg-[#FFFBEB] text-[#92400E]' };
  }
  return { label: 'Unverified', className: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300' };
}

function getDocumentStatusMeta(status: string) {
  const upper = (status || '').toUpperCase();
  if (upper === 'VERIFIED') {
    return { label: 'Verified', className: 'bg-[#ECFDF5] text-[#2F8F5B]' };
  }
  if (upper === 'REJECTED') {
    return { label: 'Rejected', className: 'bg-[#FEF2F2] text-[#C2412D]' };
  }
  if (upper === 'UNVERIFIABLE') {
    return { label: 'Cannot verify', className: 'bg-slate-100 text-slate-700' };
  }
  return { label: 'Pending review', className: 'bg-[#FFFBEB] text-[#92400E]' };
}

export const AdminVerification: React.FC = () => {
  const [people, setPeople] = useState<AdminQueuePerson[]>([]);
  const [documents, setDocuments] = useState<AdminQueueDocument[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const [filterKind, setFilterKind] = useState<'ALL' | 'PEOPLE' | 'DOCUMENTS'>('ALL');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRejectModalOpen, setIsRejectModalOpen] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  // Inline document preview state
  const [previewDoc, setPreviewDoc] = useState<{
    versionId: string;
    title: string;
    fileName: string;
    mimeType: string;
    blob: Blob;
    objectUrl: string;
  } | null>(null);
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [activePreviewVersionId, setActivePreviewVersionId] = useState<string | null>(null);
  const previewUrlRef = useRef<string | null>(null);
  const previewRequestIdRef = useRef<number>(0);

  const revokePreview = useCallback(() => {
    previewRequestIdRef.current += 1;
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreviewDoc(null);
    setPreviewError(null);
    setActivePreviewVersionId(null);
    setIsLoadingPreview(false);
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  const loadQueue = useCallback(async () => {
    setIsLoading(true);
    setErrorMessage(null);
    try {
      const data = await adminApi.getVerificationQueue();
      const loadedPeople = Array.isArray(data.people) ? data.people : [];
      const loadedDocs = Array.isArray(data.documents) ? data.documents : [];
      setPeople(loadedPeople);
      setDocuments(loadedDocs);
      setSelectedId((prev) => {
        if (prev) return prev;
        if (loadedDocs.length > 0) return `doc:${loadedDocs[0].versionId}`;
        if (loadedPeople.length > 0) return `person:${loadedPeople[0].id}`;
        return null;
      });
    } catch (err: any) {
      setErrorMessage(err?.message || 'Unable to load the verification queue.');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const entries: QueueEntry[] = [
    ...(filterKind === 'ALL' || filterKind === 'PEOPLE'
      ? people.map((person): QueueEntry => ({ kind: 'person', id: `person:${person.id}`, person }))
      : []),
    ...(filterKind === 'ALL' || filterKind === 'DOCUMENTS'
      ? documents.map((document): QueueEntry => ({ kind: 'document', id: `doc:${document.versionId}`, document }))
      : []),
  ];

  const selectedEntry = entries.find((e) => e.id === selectedId) || entries[0] || null;

  const handleOpenPreview = useCallback(async (versionId: string, title: string) => {
    const reqId = ++previewRequestIdRef.current;
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreviewDoc(null);
    setPreviewError(null);
    setActivePreviewVersionId(versionId);
    setIsLoadingPreview(true);
    try {
      const result = await adminApi.fetchDocumentBlob(versionId);
      if (previewRequestIdRef.current !== reqId) {
        URL.revokeObjectURL(result.objectUrl);
        return;
      }
      previewUrlRef.current = result.objectUrl;
      setPreviewDoc({
        versionId,
        title,
        fileName: result.fileName,
        mimeType: result.mimeType,
        blob: result.blob,
        objectUrl: result.objectUrl,
      });
    } catch (err: any) {
      if (previewRequestIdRef.current !== reqId) return;
      setPreviewError(err?.message || 'Could not load document file.');
    } finally {
      if (previewRequestIdRef.current === reqId) {
        setIsLoadingPreview(false);
      }
    }
  }, []);

  // Automatically load the actual document preview whenever a queue item is selected
  useEffect(() => {
    if (!selectedEntry) {
      revokePreview();
      return;
    }

    if (selectedEntry.kind === 'document') {
      const doc = selectedEntry.document;
      handleOpenPreview(doc.versionId, doc.documentTypeName);
      return;
    }

    const docs = selectedEntry.person.supportingDocuments || [];
    const preferred =
      docs.find(
        (d) =>
          d.hasFile !== false &&
          (String(d.documentTypeCode || '').toUpperCase() === 'DIRECTOR_ID' ||
            /director|shareholder|omang|identity/i.test(d.documentTypeName || d.title || ''))
      ) || docs.find((d) => d.hasFile !== false);

    if (preferred) {
      handleOpenPreview(preferred.versionId, preferred.documentTypeName);
    } else {
      revokePreview();
    }
  }, [selectedEntry?.id, handleOpenPreview, revokePreview]);

  const handleSelectEntry = (entry: QueueEntry) => {
    setSelectedId(entry.id);
  };

  const showSuccess = (msg: string) => {
    setFeedbackMessage(msg);
    setTimeout(() => setFeedbackMessage(null), 4000);
  };

  const handleVerifyPerson = async (person: AdminQueuePerson, status: 'verified' | 'failed' | 'pending', notes?: string) => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const updated = await adminApi.verifyPerson(person.id, { status, notes });
      setPeople((prev) =>
        prev.map((p) =>
          p.id === person.id
            ? {
                ...p,
                kycStatus: updated.kycStatus,
                kycVerifiedAt: updated.kycVerifiedAt,
                kycReference: updated.kycReference,
              }
            : p
        )
      );
      showSuccess(
        status === 'verified'
          ? `${person.fullName} marked as verified.`
          : status === 'failed'
          ? `${person.fullName} marked as rejected.`
          : `${person.fullName} reset to pending review.`
      );
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to update director verification status.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyDocument = async (
    doc: AdminQueueDocument,
    status: 'VERIFIED' | 'REJECTED' | 'UNVERIFIABLE' | 'PENDING_VERIFICATION',
    rejectionReason?: string
  ) => {
    setIsSubmitting(true);
    setErrorMessage(null);
    try {
      const updated = await adminApi.verifyDocument(doc.versionId, {
        status,
        rejectionReason,
        notes: rejectionReason,
      });
      setDocuments((prev) =>
        prev.map((d) =>
          d.versionId === doc.versionId
            ? {
                ...d,
                verificationStatus: updated.verificationStatus,
                verifiedAt: updated.verifiedAt,
                rejectionReason: updated.rejectionReason,
              }
            : d
        )
      );
      showSuccess(
        status === 'VERIFIED'
          ? `${doc.documentTypeName} marked as verified.`
          : status === 'REJECTED'
          ? `${doc.documentTypeName} marked as rejected.`
          : `${doc.documentTypeName} status updated.`
      );
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to update document verification status.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRejectSubmit = async () => {
    if (!selectedEntry) return;
    const trimmed = rejectReason.trim();
    if (!trimmed) {
      setErrorMessage('Please enter a clear reason before confirming rejection.');
      return;
    }

    if (selectedEntry.kind === 'person') {
      await handleVerifyPerson(selectedEntry.person, 'failed', trimmed);
    } else {
      await handleVerifyDocument(selectedEntry.document, 'REJECTED', trimmed);
    }
    setIsRejectModalOpen(false);
    setRejectReason('');
  };

  const pendingPeopleCount = people.filter((p) => p.kycStatus !== 'verified').length;
  const pendingDocsCount = documents.filter((d) => (d.verificationStatus || '').toUpperCase() !== 'VERIFIED').length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#D5E0EA] dark:border-[#1E364A]">
        <div className="space-y-1">
          <h1 className="font-heading font-semibold text-[30px] leading-tight text-[#10212E] dark:text-white">
            Verification queue
          </h1>
          <p className="text-[15px] text-[#43525F] dark:text-[#B2C3D2]">
            Review uploaded identity and statutory documents before verifying supplier directors and records.
          </p>
        </div>

        <button
          type="button"
          onClick={loadQueue}
          disabled={isLoading}
          className="px-3.5 py-2 border border-[#D5E0EA] dark:border-[#1E364A] bg-white dark:bg-[#132635] hover:bg-[#F7FAFD] text-[#10212E] dark:text-white rounded-[6px] text-[13px] font-medium inline-flex items-center gap-1.5 cursor-pointer self-start sm:self-auto"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          <span>Refresh queue</span>
        </button>
      </div>

      {errorMessage && (
        <div className="p-3.5 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 rounded-[8px] text-red-800 dark:text-red-200 text-[14px] flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {feedbackMessage && (
        <div className="p-3.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-[8px] text-emerald-800 dark:text-emerald-200 text-[14px] flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 shrink-0 text-[#2F8F5B]" />
          <span>{feedbackMessage}</span>
        </div>
      )}

      {/* Filter Bar */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setFilterKind('ALL')}
          className={`px-3 py-1.5 rounded-[6px] text-[13px] font-medium transition-colors cursor-pointer ${
            filterKind === 'ALL'
              ? 'bg-[#1F5F99] text-white'
              : 'bg-white dark:bg-[#132635] text-[#43525F] dark:text-[#B2C3D2] border border-[#D5E0EA] dark:border-[#1E364A] hover:bg-[#F7FAFD]'
          }`}
        >
          All checks ({people.length + documents.length})
        </button>
        <button
          type="button"
          onClick={() => setFilterKind('PEOPLE')}
          className={`px-3 py-1.5 rounded-[6px] text-[13px] font-medium transition-colors inline-flex items-center gap-1.5 cursor-pointer ${
            filterKind === 'PEOPLE'
              ? 'bg-[#1F5F99] text-white'
              : 'bg-white dark:bg-[#132635] text-[#43525F] dark:text-[#B2C3D2] border border-[#D5E0EA] dark:border-[#1E364A] hover:bg-[#F7FAFD]'
          }`}
        >
          <Users className="w-3.5 h-3.5" />
          <span>Directors &amp; KYC ({people.length}{pendingPeopleCount > 0 ? ` · ${pendingPeopleCount} awaiting` : ''})</span>
        </button>
        <button
          type="button"
          onClick={() => setFilterKind('DOCUMENTS')}
          className={`px-3 py-1.5 rounded-[6px] text-[13px] font-medium transition-colors inline-flex items-center gap-1.5 cursor-pointer ${
            filterKind === 'DOCUMENTS'
              ? 'bg-[#1F5F99] text-white'
              : 'bg-white dark:bg-[#132635] text-[#43525F] dark:text-[#B2C3D2] border border-[#D5E0EA] dark:border-[#1E364A] hover:bg-[#F7FAFD]'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Statutory documents ({documents.length}{pendingDocsCount > 0 ? ` · ${pendingDocsCount} awaiting` : ''})</span>
        </button>
      </div>

      {/* Side-by-Side Queue & Inspection Viewer */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Queue List (5 Cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] divide-y divide-[#D5E0EA] dark:divide-[#1E364A] overflow-hidden">
          <div className="p-4 bg-[#F7FAFD] dark:bg-[#10212E] font-semibold text-[14px] text-[#10212E] dark:text-white">
            Queue items ({entries.length})
          </div>

          {isLoading ? (
            <div className="p-8 flex items-center justify-center gap-2 text-[14px] text-[#6B7A87]">
              <Loader2 className="w-4 h-4 animate-spin text-[#1F5F99]" />
              <span>Loading verification queue...</span>
            </div>
          ) : entries.length === 0 ? (
            <div className="p-8 text-center text-[14px] text-[#6B7A87]">
              No director or document records found in this queue.
            </div>
          ) : (
            <div className="max-h-[680px] overflow-y-auto divide-y divide-[#D5E0EA] dark:divide-[#1E364A]">
              {entries.map((entry) => {
                const isSelected = selectedEntry?.id === entry.id;
                if (entry.kind === 'person') {
                  const { person } = entry;
                  const badge = getPersonStatusMeta(person.kycStatus);
                  return (
                    <div
                      key={entry.id}
                      onClick={() => handleSelectEntry(entry)}
                      className={`p-4 transition-colors cursor-pointer space-y-1 ${
                        isSelected
                          ? 'bg-[#EAF2FA] dark:bg-[#162C3E] border-l-4 border-l-[#1F5F99]'
                          : 'hover:bg-[#F7FAFD] dark:hover:bg-[#10212E]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-[14px] text-[#10212E] dark:text-white truncate">
                          Director KYC: {person.fullName}
                        </span>
                        <span className={`text-[12px] px-2 py-0.5 rounded-[4px] font-medium shrink-0 ${badge.className}`}>
                          {badge.label}
                        </span>
                      </div>
                      <div className="text-[13px] text-[#43525F] dark:text-[#B2C3D2] truncate">
                        {person.supplierName}
                      </div>
                      <div className="text-[12px] text-[#6B7A87]">
                        {person.identityType || 'OMANG'} {person.idLast4 ? `ending ${person.idLast4}` : '— no ID'} · {person.supportingDocuments.length} uploaded doc{person.supportingDocuments.length === 1 ? '' : 's'}
                      </div>
                    </div>
                  );
                }

                const { document } = entry;
                const badge = getDocumentStatusMeta(document.verificationStatus);
                return (
                  <div
                    key={entry.id}
                    onClick={() => handleSelectEntry(entry)}
                    className={`p-4 transition-colors cursor-pointer space-y-1 ${
                      isSelected
                        ? 'bg-[#EAF2FA] dark:bg-[#162C3E] border-l-4 border-l-[#1F5F99]'
                        : 'hover:bg-[#F7FAFD] dark:hover:bg-[#10212E]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-semibold text-[14px] text-[#10212E] dark:text-white truncate">
                        {document.documentTypeName}
                      </span>
                      <span className={`text-[12px] px-2 py-0.5 rounded-[4px] font-medium shrink-0 ${badge.className}`}>
                        {badge.label}
                      </span>
                    </div>
                    <div className="text-[13px] text-[#43525F] dark:text-[#B2C3D2] truncate">
                      {document.supplierName}
                    </div>
                    <div className="text-[12px] text-[#6B7A87]">
                      Uploaded {formatDate(document.uploadedAt)} · {document.fileName}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Inspection Panel (7 Cols) */}
        <div className="lg:col-span-7 bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 space-y-6">
          {!selectedEntry ? (
            <div className="p-12 text-center text-[#6B7A87]">
              Select a director or document from the queue to inspect and verify.
            </div>
          ) : selectedEntry.kind === 'person' ? (
            (() => {
              const { person } = selectedEntry;
              const badge = getPersonStatusMeta(person.kycStatus);
              return (
                <>
                  <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#D5E0EA] dark:border-[#1E364A]">
                    <div className="space-y-1">
                      <span className="text-[12px] text-[#6B7A87]">Director identity verification</span>
                      <h3 className="font-heading font-semibold text-[20px] text-[#10212E] dark:text-white">
                        {person.fullName}
                      </h3>
                      <p className="text-[13px] text-[#43525F] dark:text-[#B2C3D2]">
                        {person.supplierName} {person.supplierCipa ? `· CIPA ${person.supplierCipa}` : ''}
                      </p>
                    </div>
                    <span className={`text-[13px] font-medium px-2.5 py-1 rounded-[6px] shrink-0 ${badge.className}`}>
                      {badge.label}
                    </span>
                  </div>

                  {/* Director Metadata Grid */}
                  <div className="grid grid-cols-2 gap-4 p-4 rounded-[8px] bg-[#F7FAFD] dark:bg-[#10212E] text-[14px]">
                    <div>
                      <span className="text-[12px] text-[#6B7A87] block">Role &amp; ownership</span>
                      <span className="font-semibold text-[#10212E] dark:text-white capitalize">
                        {person.personRole.replace('_', ' ')} ({person.ownershipPercent ?? 0}%)
                      </span>
                    </div>
                    <div>
                      <span className="text-[12px] text-[#6B7A87] block">Identity document</span>
                      <div className="flex items-center flex-wrap gap-2">
                        <span className="font-semibold text-[#10212E] dark:text-white tabular-nums">
                          {person.identityType || 'OMANG'} {person.idLast4 ? `ending ${person.idLast4}` : '(Not provided)'}
                        </span>
                        {person.omangValid === true && (
                          <span className="text-[11px] px-2 py-0.5 rounded-[4px] bg-[#ECFDF5] text-[#2F8F5B] font-medium">
                            Omang valid
                          </span>
                        )}
                        {person.omangValid === false && (
                          <span
                            className="text-[11px] px-2 py-0.5 rounded-[4px] bg-[#FEF2F2] text-[#C2412D] font-medium"
                            title={person.omangMessage || 'Invalid Omang format'}
                          >
                            {person.omangMessage || 'Omang check failed'}
                          </span>
                        )}
                      </div>
                    </div>
                    <div>
                      <span className="text-[12px] text-[#6B7A87] block">Gender</span>
                      <span className="font-semibold text-[#10212E] dark:text-white capitalize">
                        {person.gender || 'Not specified'}
                      </span>
                    </div>
                    <div>
                      <span className="text-[12px] text-[#6B7A87] block">Nationality</span>
                      <span className="font-semibold text-[#10212E] dark:text-white">
                        {person.nationality || (person.isCitizen ? 'Motswana' : 'Foreign')}
                      </span>
                    </div>
                    {person.kycVerifiedAt && (
                      <div className="col-span-2">
                        <span className="text-[12px] text-[#6B7A87] block">Last verified</span>
                        <span className="font-semibold text-[#2F8F5B]">
                          {formatDate(person.kycVerifiedAt)} {person.kycReference ? `· ${person.kycReference}` : ''}
                        </span>
                      </div>
                    )}
                    {person.kycStatus === 'failed' && person.kycReference && (
                      <div className="col-span-2">
                        <span className="text-[12px] text-[#C2412D] block">Rejection note</span>
                        <span className="font-medium text-[#C2412D]">{person.kycReference}</span>
                      </div>
                    )}
                  </div>

                  {/* Supporting Documents Uploaded by Supplier */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <h4 className="font-semibold text-[14px] text-[#10212E] dark:text-white">
                        Supporting documents uploaded by supplier
                      </h4>
                      <span className="text-[12px] text-[#6B7A87]">
                        {person.supportingDocuments.length} file{person.supportingDocuments.length === 1 ? '' : 's'}
                      </span>
                    </div>

                    {person.supportingDocuments.length === 0 ? (
                      <div className="p-4 border border-dashed border-amber-300 dark:border-amber-800 rounded-[8px] bg-amber-50/60 dark:bg-amber-950/30 text-[13px] text-amber-800 dark:text-amber-300 flex items-center gap-2">
                        <Clock className="w-4 h-4 shrink-0" />
                        <span>This supplier has not uploaded any supporting identity or statutory documents yet.</span>
                      </div>
                    ) : (
                      <div className="divide-y divide-[#D5E0EA] dark:divide-[#1E364A] border border-[#D5E0EA] dark:border-[#1E364A] rounded-[8px] overflow-hidden">
                        {person.supportingDocuments.map((doc) => {
                          const isActiveDoc = activePreviewVersionId === doc.versionId;
                          return (
                            <div
                              key={doc.versionId}
                              className={`p-3 flex items-center justify-between gap-3 text-[13px] ${
                                isActiveDoc
                                  ? 'bg-[#EAF2FA]/60 dark:bg-[#162C3E]'
                                  : 'bg-white dark:bg-[#10212E]'
                              }`}
                            >
                              <div className="min-w-0">
                                <span className="font-semibold text-[#10212E] dark:text-white block truncate">
                                  {doc.documentTypeName}
                                </span>
                                <span className="text-[12px] text-[#6B7A87] block truncate">
                                  {doc.fileName} · Uploaded {formatDate(doc.uploadedAt)}
                                  {doc.hasFile === false ? ' · File bytes missing' : ''}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleOpenPreview(doc.versionId, doc.documentTypeName)}
                                className={`px-2.5 py-1.5 border rounded-[6px] text-[12px] font-medium inline-flex items-center gap-1 shrink-0 cursor-pointer ${
                                  isActiveDoc
                                    ? 'bg-[#1F5F99] border-[#1F5F99] text-white'
                                    : 'border-[#D5E0EA] dark:border-[#1E364A] hover:bg-[#F7FAFD] dark:hover:bg-[#162C3E] text-[#1F5F99] dark:text-[#38BDF8]'
                                }`}
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>{isActiveDoc ? 'Viewing' : 'Preview file'}</span>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Inline Document Preview */}
                  {(isLoadingPreview || previewError || previewDoc) && (
                    <div className="border border-[#D5E0EA] dark:border-[#1E364A] rounded-[8px] overflow-hidden">
                      <div className="px-4 py-2.5 bg-[#F7FAFD] dark:bg-[#10212E] flex items-center justify-between border-b border-[#D5E0EA] dark:border-[#1E364A]">
                        <span className="text-[13px] font-semibold text-[#10212E] dark:text-white truncate">
                          {previewDoc ? `${previewDoc.title} — ${previewDoc.fileName}` : 'Loading document preview...'}
                        </span>
                        <button
                          type="button"
                          onClick={revokePreview}
                          className="text-[#6B7A87] hover:text-[#10212E] cursor-pointer"
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
                        isLoading={isLoadingPreview}
                        error={previewError}
                        onRetry={
                          activePreviewVersionId
                            ? () => handleOpenPreview(activePreviewVersionId, previewDoc?.title || 'Document')
                            : undefined
                        }
                        maxHeightClass="h-[460px]"
                      />
                    </div>
                  )}

                  {/* Admin Verification Decision Buttons */}
                  <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-[#D5E0EA] dark:border-[#1E364A]">
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleVerifyPerson(person, 'verified')}
                      className="flex-1 py-2.5 px-4 bg-[#1F5F99] hover:bg-[#184c7a] text-white font-medium rounded-[6px] text-[14px] flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      <span>Approve &amp; mark verified</span>
                    </button>

                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => setIsRejectModalOpen(true)}
                      className="py-2.5 px-4 bg-rose-50 hover:bg-rose-100 text-[#C2412D] border border-rose-200 font-medium rounded-[6px] text-[14px] cursor-pointer disabled:opacity-50"
                    >
                      Reject...
                    </button>

                    {person.kycStatus !== 'pending' && (
                      <button
                        type="button"
                        disabled={isSubmitting}
                        onClick={() => handleVerifyPerson(person, 'pending')}
                        className="py-2.5 px-4 border border-[#D5E0EA] dark:border-[#1E364A] hover:bg-[#F7FAFD] dark:hover:bg-[#10212E] text-[#43525F] dark:text-[#B2C3D2] rounded-[6px] text-[14px] cursor-pointer disabled:opacity-50"
                      >
                        Set pending
                      </button>
                    )}
                  </div>
                </>
              );
            })()
          ) : (
            (() => {
              const { document } = selectedEntry;
              const badge = getDocumentStatusMeta(document.verificationStatus);
              return (
                <>
                  <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#D5E0EA] dark:border-[#1E364A]">
                    <div className="space-y-1">
                      <span className="text-[12px] text-[#6B7A87]">Statutory document verification</span>
                      <h3 className="font-heading font-semibold text-[20px] text-[#10212E] dark:text-white">
                        {document.documentTypeName}: {document.supplierName}
                      </h3>
                    </div>
                    <span className={`text-[13px] font-medium px-2.5 py-1 rounded-[6px] shrink-0 ${badge.className}`}>
                      {badge.label}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-4 p-4 rounded-[8px] bg-[#F7FAFD] dark:bg-[#10212E] text-[14px]">
                    <div>
                      <span className="text-[12px] text-[#6B7A87] block">Document reference / PIN</span>
                      <span className="font-semibold text-[#10212E] dark:text-white">{document.documentNumber || '—'}</span>
                    </div>
                    <div>
                      <span className="text-[12px] text-[#6B7A87] block">Recorded expiry date</span>
                      <span className="font-semibold text-[#10212E] dark:text-white tabular-nums">{formatDate(document.expiryDate)}</span>
                    </div>
                    <div>
                      <span className="text-[12px] text-[#6B7A87] block">Supplier CIPA</span>
                      <span className="font-semibold text-[#10212E] dark:text-white">{document.supplierCipa || '—'}</span>
                    </div>
                    <div>
                      <span className="text-[12px] text-[#6B7A87] block">Uploaded</span>
                      <span className="font-semibold text-[#10212E] dark:text-white">{formatDate(document.uploadedAt)}</span>
                    </div>
                  </div>

                  {/* Document Preview Viewer (auto-loaded with actual uploaded file contents) */}
                  <div className="space-y-3">
                    <div className="border border-[#D5E0EA] dark:border-[#1E364A] rounded-[8px] overflow-hidden">
                      <div className="px-4 py-2.5 bg-[#F7FAFD] dark:bg-[#10212E] flex items-center justify-between gap-3 border-b border-[#D5E0EA] dark:border-[#1E364A]">
                        <div className="flex items-center gap-2 min-w-0">
                          <FileCheck2 className="w-4 h-4 text-[#1F5F99] shrink-0" />
                          <span className="text-[13px] font-semibold text-[#10212E] dark:text-white truncate">
                            {previewDoc ? previewDoc.fileName : document.fileName}
                          </span>
                          <span className="text-[11px] text-[#6B7A87] shrink-0">
                            v{document.versionNo}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleOpenPreview(document.versionId, document.documentTypeName)}
                          className="px-2.5 py-1 bg-white dark:bg-[#132635] border border-[#D5E0EA] dark:border-[#1E364A] hover:bg-[#EAF2FA] text-[#1F5F99] dark:text-[#38BDF8] rounded-[5px] text-[12px] font-medium inline-flex items-center gap-1 shrink-0 cursor-pointer"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${isLoadingPreview ? 'animate-spin' : ''}`} />
                          <span>Reload</span>
                        </button>
                      </div>
                      <DocumentVaultPreview
                        blob={previewDoc?.blob || null}
                        objectUrl={previewDoc?.objectUrl || null}
                        fileName={previewDoc?.fileName || document.fileName}
                        mimeType={previewDoc?.mimeType || document.mimeType}
                        title={document.documentTypeName}
                        isLoading={isLoadingPreview}
                        error={previewError}
                        onRetry={() => handleOpenPreview(document.versionId, document.documentTypeName)}
                        maxHeightClass="h-[480px]"
                      />
                    </div>
                  </div>

                  {/* Verification Decision Action Buttons */}
                  <div className="flex flex-wrap items-center gap-3 pt-4 border-t border-[#D5E0EA] dark:border-[#1E364A]">
                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleVerifyDocument(document, 'VERIFIED')}
                      className="flex-1 py-2.5 px-4 bg-[#1F5F99] hover:bg-[#184c7a] text-white font-medium rounded-[6px] text-[14px] flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
                    >
                      {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      <span>Approve &amp; mark verified</span>
                    </button>

                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => setIsRejectModalOpen(true)}
                      className="py-2.5 px-4 bg-rose-50 hover:bg-rose-100 text-[#C2412D] border border-rose-200 font-medium rounded-[6px] text-[14px] cursor-pointer disabled:opacity-50"
                    >
                      Reject...
                    </button>

                    <button
                      type="button"
                      disabled={isSubmitting}
                      onClick={() => handleVerifyDocument(document, 'UNVERIFIABLE')}
                      className="py-2.5 px-4 border border-[#D5E0EA] dark:border-[#1E364A] hover:bg-[#F7FAFD] text-[#43525F] dark:text-[#B2C3D2] rounded-[6px] text-[14px] cursor-pointer disabled:opacity-50"
                    >
                      Cannot verify
                    </button>
                  </div>
                </>
              );
            })()
          )}
        </div>
      </div>

      {/* Reject Modal */}
      {isRejectModalOpen && selectedEntry && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#10212E]/70 backdrop-blur-xs">
          <div className="w-full max-w-md bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 space-y-4">
            <h3 className="font-heading font-semibold text-[18px] text-[#10212E] dark:text-white">
              Reject verification:{' '}
              {selectedEntry.kind === 'person'
                ? selectedEntry.person.fullName
                : selectedEntry.document.documentTypeName}
            </h3>
            <p className="text-[13px] text-[#6B7A87]">
              Provide a clear reason for the supplier explaining what needs to be corrected or re-uploaded.
            </p>
            <textarea
              rows={3}
              placeholder="e.g. Uploaded Omang copy is unclear or does not match the recorded director name."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full p-3 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] bg-white dark:bg-[#10212E] text-[#10212E] dark:text-white"
            />
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setIsRejectModalOpen(false)}
                className="px-4 py-2 text-[14px] text-[#43525F] dark:text-[#B2C3D2] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isSubmitting || !rejectReason.trim()}
                onClick={handleRejectSubmit}
                className="px-4 py-2 bg-[#C2412D] text-white rounded-[6px] text-[14px] font-medium cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? 'Saving...' : 'Confirm rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
