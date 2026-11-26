import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { callsApi } from '../../services/api';
import { Call } from '../../types';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import {
  ArrowLeft,
  Building2,
  Lock,
  FileCheck2,
  CheckCircle2,
  AlertCircle,
  Send,
  ChevronRight,
} from 'lucide-react';

interface PublicCallDetailProps {
  callId: string;
  onBack: () => void;
  onApply?: () => void;
}

export const PublicCallDetail: React.FC<PublicCallDetailProps> = ({ callId, onBack, onApply }) => {
  const {
    calls,
    clarifications: contextClarifications,
    role,
    supplier,
    documents,
    isAuthenticated,
    setIntendedRoute,
    setActiveNav,
    setSelectedCallId,
  } = useApp();

  const [questionText, setQuestionText] = useState('');
  const [questionSuccess, setQuestionSuccess] = useState(false);
  const [questionError, setQuestionError] = useState<string | null>(null);
  const [isSubmittingQuestion, setIsSubmittingQuestion] = useState(false);
  const [liveClarifications, setLiveClarifications] = useState<any[] | null>(null);
  const [liveDetail, setLiveDetail] = useState<any | null>(null);
  const [acknowledgingId, setAcknowledgingId] = useState<string | null>(null);
  const [addendumError, setAddendumError] = useState<string | null>(null);

  const contextCall = calls.find((c) => c.id === callId);

  const refreshDetail = async () => {
    if (!callId) return;
    try {
      const detail = await callsApi.getDetail(callId);
      if (detail) setLiveDetail(detail);
    } catch {}
  };

  useEffect(() => {
    let active = true;
    if (!callId) return;
    Promise.all([
      callsApi.listClarifications(callId).catch(() => null),
      callsApi.getDetail(callId).catch(() => null),
    ]).then(([clars, detail]) => {
      if (!active) return;
      if (Array.isArray(clars)) setLiveClarifications(clars);
      if (detail) setLiveDetail(detail);
    });
    return () => {
      active = false;
    };
  }, [callId]);

  const call = liveDetail
    ? {
        id: liveDetail.id,
        callNumber: liveDetail.referenceNo || contextCall?.callNumber || '',
        organizationId: liveDetail.organizationId || contextCall?.organizationId || '',
        organizationName: liveDetail.organizationName || contextCall?.organizationName || 'Procuring Organization',
        orgBrandPrimaryColor: liveDetail.orgBrandPrimaryColor || contextCall?.orgBrandPrimaryColor || '#1F5F99',
        orgBrandSubtext: liveDetail.orgBrandSubtext || contextCall?.orgBrandSubtext || '',
        orgCustomDomain: liveDetail.orgCustomDomain || contextCall?.orgCustomDomain || '',
        orgWelcomeNotice: liveDetail.orgWelcomeNotice || contextCall?.orgWelcomeNotice || '',
        title: liveDetail.title || contextCall?.title || '',
        summary: liveDetail.summary || liveDetail.description || contextCall?.summary || '',
        type:
          liveDetail.callType === 'rfp'
            ? 'RFP'
            : liveDetail.callType === 'registration_drive'
            ? 'Registration drive'
            : contextCall?.type || 'EOI',
        category:
          liveDetail.categories?.[0]?.name || contextCall?.category || 'General Procurement',
        openingDate: liveDetail.opensAt
          ? new Date(liveDetail.opensAt).toISOString().split('T')[0]
          : contextCall?.openingDate || '',
        closingDate: liveDetail.closesAt
          ? new Date(liveDetail.closesAt).toISOString().split('T')[0]
          : contextCall?.closingDate || '',
        closingTimeCAT: contextCall?.closingTimeCAT || '16:30 CAT',
        estimatedBudgetBWP:
          liveDetail.estimatedValue !== undefined && liveDetail.estimatedValue !== null
            ? Number(liveDetail.estimatedValue)
            : contextCall?.estimatedBudgetBWP,
        isSealed: liveDetail.isSealed ?? contextCall?.isSealed ?? true,
        requiredDocumentTypes: Array.isArray(liveDetail.requiredDocuments) && liveDetail.requiredDocuments.length > 0
          ? liveDetail.requiredDocuments.map((d: any) => d.name)
          : contextCall?.requiredDocumentTypes || [],
        addenda: Array.isArray(liveDetail.addenda)
          ? liveDetail.addenda.map((a: any) => ({
              id: a.id,
              number: a.addendumNo,
              title: a.title,
              body: a.body,
              summary: a.body || '',
              issuedDate: a.publishedAt ? new Date(a.publishedAt).toISOString().split('T')[0] : '',
              newClosesAt: a.newClosesAt || null,
              acknowledgementsCount: typeof a.acknowledgementsCount === 'number' ? a.acknowledgementsCount : 0,
              acknowledged: Boolean(a.acknowledged),
              downloadUrl: '#',
            }))
          : contextCall?.addenda || [],
      }
    : contextCall;

  if (!call) {
    return (
      <div className="py-12 text-center space-y-4 max-w-md mx-auto">
        <AlertCircle className="w-10 h-10 text-[#C2412D] mx-auto" strokeWidth={1.5} />
        <h3 className="font-heading font-semibold text-lg text-[#10212E] dark:text-white">
          Procurement call not found
        </h3>
        <p className="text-xs text-[#6B7A87]">
          The tender opportunity you requested is either expired, unpublished, or has an invalid reference.
        </p>
        <Button variant="secondary" size="sm" onClick={onBack} leftIcon={<ArrowLeft />}>
          Back to opportunities
        </Button>
      </div>
    );
  }

  const callClarifications = liveClarifications ?? contextClarifications.filter((c) => c.callId === call.id);

  const handleAcknowledgeAddendum = async (addendumId: string) => {
    if (!call) return;
    setAddendumError(null);
    setAcknowledgingId(addendumId);
    try {
      await callsApi.acknowledgeAddendum(call.id, addendumId);
      await refreshDetail();
    } catch (err: any) {
      setAddendumError(err?.message || 'Unable to acknowledge addendum.');
    } finally {
      setAcknowledgingId(null);
    }
  };

  const handleAskQuestion = async (e: React.FormEvent) => {
    e.preventDefault();
    setQuestionError(null);
    if (!questionText.trim()) return;
    if (!isAuthenticated || role !== 'supplier') {
      setIntendedRoute('opportunities');
      setSelectedCallId(call.id);
      if (onBack) onBack();
      setActiveNav('supplier-login');
      return;
    }

    setIsSubmittingQuestion(true);
    try {
      await callsApi.askClarification(call.id, questionText.trim());
      setQuestionText('');
      setQuestionSuccess(true);
      const updated = await callsApi.listClarifications(call.id).catch(() => null);
      if (Array.isArray(updated)) {
        setLiveClarifications(updated);
      }
      setTimeout(() => setQuestionSuccess(false), 5000);
    } catch (err: any) {
      setQuestionError(err?.message || 'Unable to submit clarification inquiry.');
    } finally {
      setIsSubmittingQuestion(false);
    }
  };

  const handleApply = () => {
    setSelectedCallId(call.id);
    if (!isAuthenticated || role !== 'supplier') {
      setIntendedRoute('apply');
      if (onBack) onBack();
      setActiveNav('supplier-login');
      return;
    }
    if (!supplier.emailVerified) {
      if (onBack) onBack();
      setActiveNav('supplier-verify-email');
      return;
    }
    if (onApply) {
      onApply();
    } else {
      if (onBack) onBack();
      setActiveNav('apply');
    }
  };

  const isDocVerifiedAndCurrent = (doc?: { status?: string; verificationStatus?: string | null; expiryDate?: string }) => {
    if (!doc) return false;
    const verUpper = String(doc.verificationStatus || '').toUpperCase();
    if (verUpper && verUpper !== 'VERIFIED' && verUpper !== 'APPROVED') return false;
    if (doc.status !== 'Verified' && doc.status !== 'Expiring soon') return false;
    if (doc.expiryDate) {
      const expStr = String(doc.expiryDate).slice(0, 10);
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(expStr);
      const now = new Date();
      const todayUtcMs = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
      const expUtcMs = match
        ? Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
        : Date.parse(doc.expiryDate);
      if (!Number.isNaN(expUtcMs) && expUtcMs < todayUtcMs) return false;
    }
    return true;
  };

  const hasCipa = (documents || []).some(
    (d) =>
      (d.documentTypeCode === 'COMPANY_REGISTRATION' ||
        d.documentType?.toLowerCase().includes('cipa') ||
        d.title?.toLowerCase().includes('cipa') ||
        d.documentType?.toLowerCase().includes('incorporation')) &&
      isDocVerifiedAndCurrent(d)
  );

  const hasTax = (documents || []).some(
    (d) =>
      (d.documentTypeCode === 'TAX_CLEARANCE' ||
        d.documentType?.toLowerCase().includes('tax') ||
        d.title?.toLowerCase().includes('tax') ||
        d.documentType?.toLowerCase().includes('burs')) &&
      isDocVerifiedAndCurrent(d)
  );

  const hasPpra = (documents || []).some(
    (d) =>
      (d.documentTypeCode === 'PPRA_REGISTRATION' ||
        d.documentType?.toLowerCase().includes('ppra') ||
        d.title?.toLowerCase().includes('ppra')) &&
      isDocVerifiedAndCurrent(d)
  );

  const hasSafety = (documents || []).some(
    (d) =>
      (d.documentTypeCode === 'WORKERS_COMPENSATION' ||
        d.documentType?.toLowerCase().includes('workers') ||
        d.documentType?.toLowerCase().includes('safety') ||
        d.documentType?.toLowerCase().includes('wca') ||
        d.documentType?.toLowerCase().includes('compensation') ||
        d.title?.toLowerCase().includes('workers') ||
        d.title?.toLowerCase().includes('safety') ||
        d.title?.toLowerCase().includes('compensation')) &&
      isDocVerifiedAndCurrent(d)
  );

  const getDaysRemaining = (deadlineStr: string) => {
    const now = new Date();
    const deadline = new Date(deadlineStr);
    const diffTime = deadline.getTime() - now.getTime();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  };

  const daysLeft = getDaysRemaining(call.closingDate);
  const isUrgent = daysLeft <= 5 && daysLeft >= 0;

  return (
    <div className="space-y-8 py-2">
      {/* Back Navigation Bar */}
      <div className="flex items-center justify-between gap-4 border-b border-[#D5E0EA] dark:border-[#1E364A] pb-4">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#43525F] dark:text-[#B2C3D2] hover:text-[#1F5F99] dark:hover:text-[#6FAEE0] transition-colors"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
          <span>Back to all opportunities</span>
        </button>

        <div className="flex items-center gap-2 font-mono text-[11px] text-[#6B7A87]">
          <span>Ref: {call.callNumber}</span>
          <span>·</span>
          <span>{call.category}</span>
        </div>
      </div>

      {/* Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* ======================================================== */}
        {/* LEFT COLUMN: DETAILED TENDER CONTENT (8 columns)          */}
        {/* ======================================================== */}
        <div className="lg:col-span-8 space-y-8">
          {/* Branded Procuring Organization Banner */}
          {(() => {
            const orgAccent =
              call.orgBrandPrimaryColor && /^#[0-9A-Fa-f]{6}$/.test(call.orgBrandPrimaryColor)
                ? call.orgBrandPrimaryColor
                : '#1F5F99';
            const orgInitials =
              String(call.organizationName || 'PO')
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((w: string) => w[0]?.toUpperCase() || '')
                .join('') || 'PO';
            return (
              <div
                className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] border-t-4 p-5 space-y-4"
                style={{ borderTopColor: orgAccent }}
              >
                <div className="flex items-start justify-between gap-4 flex-wrap pb-3 border-b border-[#D5E0EA]/70 dark:border-[#1E364A]">
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-10 h-10 rounded-[8px] text-white font-heading font-bold text-sm flex items-center justify-center shrink-0"
                      style={{ backgroundColor: orgAccent }}
                    >
                      {orgInitials}
                    </div>
                    <div className="min-w-0">
                      <div className="font-heading font-semibold text-sm text-[#10212E] dark:text-white truncate">
                        {call.organizationName}
                      </div>
                      <div className="text-xs text-[#6B7A87] truncate">
                        {call.orgBrandSubtext || 'Official Procuring Entity Portal'}
                        {call.orgCustomDomain ? ` · ${call.orgCustomDomain}` : ''}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs text-[#6B7A87]">Published {call.openingDate}</span>
                </div>

                {call.orgWelcomeNotice && (
                  <p className="text-xs text-[#43525F] dark:text-[#B2C3D2] bg-[#F7FAFD] dark:bg-[#10212E] border border-[#D5E0EA] dark:border-[#1E364A] rounded-[8px] px-3.5 py-2.5 leading-relaxed">
                    {call.orgWelcomeNotice}
                  </p>
                )}

                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={call.type === 'RFP' ? 'pula' : 'neutral'} size="md">
                      {call.type === 'RFP' ? 'Request for Proposal (RFP)' : 'Expression of Interest (EOI)'}
                    </Badge>
                    <Badge variant="outline" size="md">
                      {call.category}
                    </Badge>
                    {call.isSealed && (
                      <Badge variant="verified" size="md" icon={<Lock />}>
                        Cryptographic Sealed Bid
                      </Badge>
                    )}
                  </div>

                  <h1 className="text-2xl sm:text-3xl font-heading font-semibold text-[#10212E] dark:text-white tracking-tight leading-snug">
                    {call.title}
                  </h1>
                </div>
              </div>
            );
          })()}

          {/* Section 1: Overview & Scope of Work */}
          <Card variant="default" padding="md" className="space-y-4">
            <h2 className="text-base font-heading font-semibold text-[#10212E] dark:text-white border-b border-[#D5E0EA] dark:border-[#1E364A] pb-2.5">
              1. Tender Overview & Scope of Work
            </h2>
            <div className="text-sm text-[#43525F] dark:text-[#B2C3D2] leading-relaxed space-y-3">
              <p>{call.summary}</p>
              <p>
                Bidders must comply strictly with the Public Procurement Regulatory Authority (PPRA) Act and ensure all mandatory documentation is up to date in their BidReady360 Document Vault prior to the submission deadline.
              </p>
            </div>
          </Card>

          {/* Section 2: Mandatory Eligibility Criteria */}
          <Card variant="default" padding="md" className="space-y-4">
            <h2 className="text-base font-heading font-semibold text-[#10212E] dark:text-white border-b border-[#D5E0EA] dark:border-[#1E364A] pb-2.5">
              2. Mandatory Eligibility Criteria
            </h2>

            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                <div className="p-3 rounded-[6px] bg-[#F7FAFD] dark:bg-[#10212E] border border-[#D5E0EA] dark:border-[#1E364A] space-y-1">
                  <span className="text-[11px] text-[#6B7A87] block font-semibold">PPRA Contractor Category</span>
                  <span className="font-mono text-sm font-bold text-[#10212E] dark:text-white">
                    {call.category}
                  </span>
                </div>

                <div className="p-3 rounded-[6px] bg-[#F7FAFD] dark:bg-[#10212E] border border-[#D5E0EA] dark:border-[#1E364A] space-y-1">
                  <span className="text-[11px] text-[#6B7A87] block font-semibold">Citizen Ownership Preference</span>
                  <span className="text-sm font-semibold text-[#2F8F5B]">
                    100% Citizen Preference (EDD Margins Applicable)
                  </span>
                </div>
              </div>

              <ul className="space-y-2 pt-2 text-xs text-[#43525F] dark:text-[#B2C3D2]">
                {call.requiredDocumentTypes.map((req: string, index: number) => (
                  <li key={index} className="flex items-start gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#2F8F5B] shrink-0 mt-0.5" strokeWidth={1.5} />
                    <span>Mandatory submission requirement: {req}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Card>

          {/* Section 3: Required Vault Documents */}
          <Card variant="default" padding="md" className="space-y-4">
            <h2 className="text-base font-heading font-semibold text-[#10212E] dark:text-white border-b border-[#D5E0EA] dark:border-[#1E364A] pb-2.5">
              3. Required Statutory Documents from Vault
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-[6px] border border-[#D5E0EA] dark:border-[#1E364A] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileCheck2 className={`w-4 h-4 ${hasCipa ? 'text-[#2F8F5B]' : 'text-[#1F5F99] dark:text-[#6FAEE0]'}`} strokeWidth={1.5} />
                  <span className="font-medium text-[#10212E] dark:text-white">CIPA Certificate of Incorporation</span>
                </div>
                {hasCipa ? (
                  <Badge variant="verified" size="sm">Verified in Vault</Badge>
                ) : (
                  <Badge variant="neutral" size="sm">Mandatory</Badge>
                )}
              </div>

              <div className="p-3 rounded-[6px] border border-[#D5E0EA] dark:border-[#1E364A] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileCheck2 className={`w-4 h-4 ${hasTax ? 'text-[#2F8F5B]' : 'text-[#1F5F99] dark:text-[#6FAEE0]'}`} strokeWidth={1.5} />
                  <span className="font-medium text-[#10212E] dark:text-white">Valid BURS Tax Clearance PIN</span>
                </div>
                {hasTax ? (
                  <Badge variant="verified" size="sm">Verified in Vault</Badge>
                ) : (
                  <Badge variant="neutral" size="sm">Mandatory</Badge>
                )}
              </div>

              <div className="p-3 rounded-[6px] border border-[#D5E0EA] dark:border-[#1E364A] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileCheck2 className={`w-4 h-4 ${hasPpra ? 'text-[#2F8F5B]' : 'text-[#1F5F99] dark:text-[#6FAEE0]'}`} strokeWidth={1.5} />
                  <span className="font-medium text-[#10212E] dark:text-white">PPRA Registration Certificate</span>
                </div>
                {hasPpra ? (
                  <Badge variant="verified" size="sm">Active Code · Verified</Badge>
                ) : (
                  <Badge variant="neutral" size="sm">Active Code Required</Badge>
                )}
              </div>

              <div className="p-3 rounded-[6px] border border-[#D5E0EA] dark:border-[#1E364A] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileCheck2 className={`w-4 h-4 ${hasSafety ? 'text-[#2F8F5B]' : 'text-[#1F5F99] dark:text-[#6FAEE0]'}`} strokeWidth={1.5} />
                  <span className="font-medium text-[#10212E] dark:text-white">Workers Compensation / Safety</span>
                </div>
                {hasSafety ? (
                  <Badge variant="verified" size="sm">Verified in Vault</Badge>
                ) : (
                  <Badge variant="neutral" size="sm">Required</Badge>
                )}
              </div>
            </div>
          </Card>

          {/* Section 4: Addenda & Formal Bulletins */}
          {call.addenda && call.addenda.length > 0 && (
            <Card variant="default" padding="md" className="space-y-4">
              <h2 className="text-base font-heading font-semibold text-[#10212E] dark:text-white border-b border-[#D5E0EA] dark:border-[#1E364A] pb-2.5 flex items-center gap-2">
                <span>4. Addenda & Formal Bulletins</span>
                <span className="font-mono text-xs text-[#1F5F99] dark:text-[#6FAEE0]">({call.addenda.length})</span>
              </h2>

              {addendumError && (
                <div className="p-3 rounded-[6px] bg-[#FEF2F2] dark:bg-[#7F1D1D]/20 border border-[#FCA5A5] text-xs text-[#8E2A1B] dark:text-red-300">
                  {addendumError}
                </div>
              )}

              <div className="space-y-3">
                {call.addenda.map((ad: NonNullable<Call['addenda']>[number]) => (
                  <div
                    key={ad.id}
                    className="p-3.5 rounded-[6px] bg-[#FFFBEB] dark:bg-[#92400E]/15 border border-[#FDE68A] dark:border-[#92400E]/30 space-y-2 text-xs"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-heading font-semibold text-[#92400E] dark:text-[#FCD34D]">
                        {ad.title}
                      </span>
                      <div className="flex items-center gap-2">
                        {typeof ad.acknowledgementsCount === 'number' && ad.acknowledgementsCount > 0 && (
                          <span className="font-mono text-[10px] px-1.5 py-0.5 rounded bg-white/70 dark:bg-[#10212E]/70 text-[#92400E] dark:text-[#FCD34D]">
                            {ad.acknowledgementsCount} ack{ad.acknowledgementsCount === 1 ? '' : 's'}
                          </span>
                        )}
                        <span className="font-mono text-[10px] text-[#92400E]/80 dark:text-[#FCD34D]/80">
                          {ad.issuedDate}
                        </span>
                      </div>
                    </div>
                    <p className="text-[#43525F] dark:text-[#B2C3D2]">{ad.summary}</p>
                    {ad.newClosesAt && (
                      <p className="font-mono text-[11px] text-[#92400E] dark:text-[#FCD34D]">
                        Closing deadline extended to: {new Date(ad.newClosesAt).toLocaleString('en-BW', { dateStyle: 'medium', timeStyle: 'short' })}
                      </p>
                    )}
                    {isAuthenticated && role === 'supplier' && (
                      <div className="pt-1 flex items-center justify-end">
                        {ad.acknowledged ? (
                          <Badge variant="verified" size="sm">Acknowledged</Badge>
                        ) : (
                          <Button
                            variant="secondary"
                            size="sm"
                            isLoading={acknowledgingId === ad.id}
                            onClick={() => handleAcknowledgeAddendum(ad.id)}
                          >
                            Acknowledge Addendum
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Section 5: Clarification Q&A Bulletin */}
          <Card variant="default" padding="md" className="space-y-5">
            <div className="border-b border-[#D5E0EA] dark:border-[#1E364A] pb-2.5 flex items-center justify-between">
              <h2 className="text-base font-heading font-semibold text-[#10212E] dark:text-white">
                5. Public Clarification Q&A Bulletin
              </h2>
              <span className="text-xs font-mono text-[#6B7A87]">
                {callClarifications.length} threads
              </span>
            </div>

            {/* Q&A Thread List */}
            {callClarifications.length > 0 ? (
              <div className="space-y-4">
                {callClarifications.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-[8px] bg-[#F7FAFD] dark:bg-[#10212E] border border-[#D5E0EA] dark:border-[#1E364A] space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between text-[#6B7A87]">
                      <span className="font-medium text-[#10212E] dark:text-white">
                        Question from Verified Supplier ({item.supplierName})
                      </span>
                      <span className="font-mono text-[10px]">{item.submittedAt}</span>
                    </div>
                    <p className="text-[#43525F] dark:text-[#B2C3D2] italic font-serif">
                      "{item.question}"
                    </p>

                    {item.answer ? (
                      <div className="pt-2 border-t border-[#D5E0EA] dark:border-[#1E364A] space-y-1">
                        <span className="font-semibold text-[#1F5F99] dark:text-[#6FAEE0] block">
                          Official Buying Body Response ({item.answeredAt}):
                        </span>
                        <p className="text-[#10212E] dark:text-white">{item.answer}</p>
                      </div>
                    ) : (
                      <Badge variant="warning" size="sm">
                        Pending official answer from procuring entity
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-[#6B7A87]">
                No clarification inquiries have been raised yet for this call.
              </p>
            )}

            {/* Inquire Form */}
            <form onSubmit={handleAskQuestion} className="pt-2 border-t border-[#D5E0EA] dark:border-[#1E364A] space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-semibold text-[#10212E] dark:text-white block">
                  Submit a formal clarification question
                </label>
                <textarea
                  rows={3}
                  placeholder="Type your technical or statutory inquiry regarding this call..."
                  value={questionText}
                  onChange={(e) => setQuestionText(e.target.value)}
                  className="w-full p-3 rounded-[6px] text-xs bg-white dark:bg-[#132635] text-[#10212E] dark:text-white border border-[#D5E0EA] dark:border-[#1E364A] focus:border-[#1F5F99]"
                />
              </div>

              {questionError && (
                <div className="p-2.5 rounded-[6px] bg-rose-50 text-[#C2412D] text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{questionError}</span>
                </div>
              )}

              {questionSuccess && (
                <div className="p-2.5 rounded-[6px] bg-[#ECFDF5] text-[#065F46] text-xs flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                  <span>Your clarification inquiry was submitted privately to the procuring organization and will appear on the public bulletin once answered.</span>
                </div>
              )}

              <Button
                type="submit"
                variant="secondary"
                size="sm"
                disabled={isSubmittingQuestion}
                rightIcon={<Send className="w-3.5 h-3.5" />}
              >
                {isSubmittingQuestion ? 'Submitting...' : isAuthenticated && role === 'supplier' ? 'Submit Inquiry' : 'Sign in as Supplier to Inquire'}
              </Button>
            </form>
          </Card>
        </div>

        {/* ======================================================== */}
        {/* RIGHT COLUMN: STICKY SUMMARY CARD (4 columns on lg)       */}
        {/* ======================================================== */}
        <div className="lg:col-span-4 space-y-4 lg:sticky lg:top-20">
          <Card variant="default" padding="md" className="space-y-5 border-hairline shadow-subtle">
            {/* Countdown Badge & Closing Date */}
            <div className="space-y-2 pb-4 border-b border-[#D5E0EA] dark:border-[#1E364A]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-[#6B7A87] uppercase tracking-wider">
                  Submission Deadline
                </span>
                <Badge variant={isUrgent ? 'alert' : 'warning'} size="sm">
                  {daysLeft > 0 ? `${daysLeft} days remaining` : 'Submission closed'}
                </Badge>
              </div>

              <div className="space-y-0.5">
                <div className="font-heading font-semibold text-lg text-[#10212E] dark:text-white">
                  {call.closingDate}
                </div>
                <div className="text-xs text-[#6B7A87]">
                  Strict cutoff at {call.closingTimeCAT || '16:30 CAT'} (Botswana Time)
                </div>
              </div>
            </div>

            {/* Quick Metrics */}
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[#6B7A87]">Procuring Body</span>
                <span className="font-semibold text-[#10212E] dark:text-white truncate max-w-[170px] text-right">
                  {call.organizationName}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[#6B7A87]">Reference Number</span>
                <span className="font-mono font-medium text-[#10212E] dark:text-white">
                  {call.callNumber}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[#6B7A87]">Opportunity Format</span>
                <span className="font-medium text-[#10212E] dark:text-white">
                  {call.type} {call.isSealed ? '(Sealed Bidding)' : ''}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-[#6B7A87]">Estimated Budget</span>
                <span className="font-mono font-bold text-[#1F5F99] dark:text-[#6FAEE0]">
                  {call.estimatedBudgetBWP
                    ? `BWP ${(call.estimatedBudgetBWP / 1000).toLocaleString()}k`
                    : 'Disclosed in Call'}
                </span>
              </div>
            </div>

            {/* Apply Button Action */}
            <div className="pt-2 space-y-2 border-t border-[#D5E0EA] dark:border-[#1E364A]">
              <Button
                variant="primary"
                size="lg"
                className="w-full font-bold shadow-subtle"
                onClick={handleApply}
                rightIcon={<ChevronRight />}
              >
                Apply with Supplier Passport
              </Button>

              <p className="text-[11px] text-center text-[#6B7A87]">
                Requires verified CIPA and PPRA credentials in Document Vault
              </p>
            </div>
          </Card>

          {/* Sealed Security Assurance Card */}
          <Card variant="surface" padding="sm" className="space-y-2 text-xs">
            <div className="flex items-center gap-1.5 font-semibold text-[#1F5F99] dark:text-[#6FAEE0]">
              <Lock className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>Sealed Bid Cryptography Active</span>
            </div>
            <p className="text-[11px] text-[#6B7A87] leading-relaxed">
              Price schedules submitted for this opportunity are locked using asymmetric encryption. Unsealing is technically prevented until the official opening milestone.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
};
