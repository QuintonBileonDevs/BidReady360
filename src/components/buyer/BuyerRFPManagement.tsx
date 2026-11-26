import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { buyerApi } from '../../services/api';
import { Call, Clarification } from '../../types';
import { StatusChip } from '../common/StatusChip';
import {
  Lock,
  Unlock,
  HelpCircle,
  FilePlus,
  CheckCircle2,
  FileText,
  Key,
  AlertCircle,
} from 'lucide-react';

export const BuyerRFPManagement: React.FC = () => {
  const { calls: contextCalls, clarifications: contextClarifications, publishClarificationAnswer, profileSummary, currentUser } = useApp();

  const [orgCalls, setOrgCalls] = useState<Call[]>(contextCalls);
  const [orgClarifications, setOrgClarifications] = useState<Clarification[]>(contextClarifications);
  const [selectedCallId, setSelectedCallId] = useState<string>(contextCalls[0]?.id || '');
  const [activeTab, setActiveTab] = useState<'clarifications' | 'addenda' | 'sealed_bids'>('sealed_bids');
  const [bidsList, setBidsList] = useState<any[]>([]);
  const [isLoadingBids, setIsLoadingBids] = useState(false);
  const [isOpeningCeremony, setIsOpeningCeremony] = useState(false);

  // Answer state
  const [replyingClarId, setReplyingClarId] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState('');
  const [isPublishingAnswer, setIsPublishingAnswer] = useState(false);

  // Addendum creation state
  const [isCreatingAddendum, setIsCreatingAddendum] = useState(false);
  const [addendumTitle, setAddendumTitle] = useState('');
  const [addendumSummary, setAddendumSummary] = useState('');
  const [isSubmittingAddendum, setIsSubmittingAddendum] = useState(false);

  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const officerDisplay = currentUser?.fullName || profileSummary?.displayName || 'Procurement Officer';

  const showToast = (msg: string) => {
    setErrorMessage(null);
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4500);
  };

  const loadBuyerWorkspaceData = useCallback(async () => {
    try {
      const [callsRes, clarsRes] = await Promise.all([
        buyerApi.listCalls().catch(() => null),
        buyerApi.listClarifications().catch(() => null),
      ]);

      if (Array.isArray(callsRes)) {
        const mapped: Call[] = callsRes.map((c: any) => ({
          id: c.id,
          callNumber: c.referenceNo,
          organizationId: c.organizationId,
          organizationName: c.organizationName,
          title: c.title,
          summary: c.summary || c.description || '',
          type: c.callType === 'eoi' ? 'EOI' : c.callType === 'registration_drive' ? 'Registration drive' : 'RFP',
          category: c.categories?.[0]?.name || 'General Procurement',
          subcategories: [],
          location: 'Botswana',
          estimatedBudgetBWP: c.estimatedValue ? Number(c.estimatedValue) : undefined,
          openingDate: c.opensAt ? String(c.opensAt).slice(0, 10) : '',
          clarificationDeadline: c.clarificationDeadline ? String(c.clarificationDeadline).slice(0, 10) : '',
          closingDate: c.closesAt ? String(c.closesAt).slice(0, 10) : '',
          closingTimeCAT: '14:00 CAT',
          daysRemaining: c.closesAt
            ? Math.max(0, Math.ceil((new Date(c.closesAt).getTime() - Date.now()) / 86400000))
            : 0,
          status:
            c.status === 'closed' || c.status === 'cancelled'
              ? 'Closed'
              : c.status === 'evaluating'
              ? 'Under evaluation'
              : c.status === 'awarded'
              ? 'Awarded'
              : c.status === 'draft'
              ? 'Draft'
              : 'Open',
          visibility: c.visibility || 'open',
          isSealed: Boolean(c.isSealed),
          documentsCount: Number(c.documentsCount ?? (c.requiredDocuments || []).length),
          applicationsCount: Number(c.applicationsCount || 0),
          requiredDocumentTypes: (c.requiredDocuments || []).map((d: any) => d.name),
          addenda: (c.addenda || []).map((a: any) => ({
            id: a.id,
            number: a.addendumNo,
            title: a.title,
            issuedDate: a.publishedAt ? String(a.publishedAt).slice(0, 10) : '',
            summary: a.body || '',
            downloadUrl: '#',
          })),
        }));
        setOrgCalls(mapped);
        setSelectedCallId((prev) => (prev && mapped.some((m) => m.id === prev) ? prev : mapped[0]?.id || ''));
      }

      if (Array.isArray(clarsRes)) {
        const mappedClars: Clarification[] = clarsRes.map((cl: any) => ({
          id: cl.id,
          callId: cl.callId,
          supplierId: cl.supplierId || '',
          supplierName: cl.supplierName || 'Prospective Bidder',
          question: cl.question,
          answer: cl.answer || undefined,
          answeredBy: cl.responderTitle || undefined,
          submittedAt: cl.askedAt ? new Date(cl.askedAt).toLocaleString() : '',
          answeredAt: cl.answeredAt ? new Date(cl.answeredAt).toLocaleString() : undefined,
          isPublished: Boolean(cl.isPublished),
          status: cl.status === 'Answered' ? 'Answered' : 'Pending',
        }));
        setOrgClarifications(mappedClars);
      }
    } catch {}
  }, []);

  useEffect(() => {
    loadBuyerWorkspaceData();
  }, [loadBuyerWorkspaceData]);

  const selectedCall = orgCalls.find((c) => c.id === selectedCallId) || orgCalls[0];

  const loadBidsForSelectedCall = useCallback(async (callId: string) => {
    if (!callId) return;
    setIsLoadingBids(true);
    try {
      const list = await buyerApi.listBids(callId);
      setBidsList(Array.isArray(list) ? list : []);
    } catch {
      setBidsList([]);
    } finally {
      setIsLoadingBids(false);
    }
  }, []);

  useEffect(() => {
    if (selectedCall?.id) {
      loadBidsForSelectedCall(selectedCall.id);
    }
  }, [selectedCall?.id, loadBidsForSelectedCall]);

  const callClarifications = orgClarifications.filter((c) => c.callId === selectedCall?.id);
  const areAllOpened = bidsList.length > 0 && bidsList.some((b) => b.status === 'opened');

  const handlePublishAnswer = async (clarId: string) => {
    if (!answerText.trim() || isPublishingAnswer) return;
    setIsPublishingAnswer(true);
    setErrorMessage(null);
    try {
      await buyerApi.answerClarification(clarId, answerText.trim(), officerDisplay);
      publishClarificationAnswer(clarId, answerText.trim(), officerDisplay);
      setReplyingClarId(null);
      setAnswerText('');
      await loadBuyerWorkspaceData();
      showToast('Clarification answer published officially to tender bulletin.');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to publish clarification response.');
    } finally {
      setIsPublishingAnswer(false);
    }
  };

  const handleAddAddendum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCall || !addendumTitle.trim() || !addendumSummary.trim() || isSubmittingAddendum) return;
    setIsSubmittingAddendum(true);
    setErrorMessage(null);
    try {
      await buyerApi.createAddendum(selectedCall.id, {
        title: addendumTitle.trim(),
        body: addendumSummary.trim(),
      });
      setIsCreatingAddendum(false);
      setAddendumTitle('');
      setAddendumSummary('');
      await loadBuyerWorkspaceData();
      showToast('Addendum persisted and published to all participating bidders.');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to issue addendum.');
    } finally {
      setIsSubmittingAddendum(false);
    }
  };

  const handleUpdateCallSettings = async (updates: { status?: string; visibility?: string }) => {
    if (!selectedCall) return;
    setErrorMessage(null);
    try {
      await buyerApi.updateCall(selectedCall.id, updates);
      await loadBuyerWorkspaceData();
      showToast('Tender call settings updated.');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to update tender call.');
    }
  };

  const handleExecuteOpeningSession = async () => {
    if (!selectedCall || isOpeningCeremony) return;
    setIsOpeningCeremony(true);
    setErrorMessage(null);
    try {
      await buyerApi.conductOpeningSession(selectedCall.id);
      await loadBidsForSelectedCall(selectedCall.id);
      await loadBuyerWorkspaceData();
      showToast('Sealed bid opening ceremony executed and logged.');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Unable to unseal bids for this call.');
    } finally {
      setIsOpeningCeremony(false);
    }
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {toastMessage && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 text-[#2F8F5B] dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 rounded-xl text-xs flex items-center gap-2 shadow-xs">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-4 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-300 dark:border-rose-800 rounded-xl text-xs flex items-center gap-2 shadow-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="card-elevated p-6 sm:p-8 flex flex-wrap items-center justify-between gap-6 border-l-4 border-l-[#1F5F99]">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-mono font-bold text-[#1F5F99] dark:text-[#6FAEE0] bg-[#EAF2FA] dark:bg-slate-800 px-2.5 py-0.5 rounded-md">
              RFP Control Center
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">· Clarifications, Addenda & Cryptographic Sealed Envelopes</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-heading font-bold text-slate-900 dark:text-white">
            RFP Governance & Sealed Bid Opening
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
            Oversee sealed tender packages, answer bidder questions with formal audit trails, and manage call status, visibility, and addenda.
          </p>
        </div>

        {/* Call Selector & Quick Controls */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <select
            value={selectedCallId}
            onChange={(e) => setSelectedCallId(e.target.value)}
            className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-800 dark:text-white"
          >
            {orgCalls.length === 0 && <option value="">No tender calls yet</option>}
            {orgCalls.map((c) => (
              <option key={c.id} value={c.id}>
                {c.callNumber} — {c.title.substring(0, 35)} ({c.status})
              </option>
            ))}
          </select>

          {selectedCall && (
            <>
              <select
                value={
                  selectedCall.status === 'Draft'
                    ? 'draft'
                    : selectedCall.status === 'Closed'
                    ? 'closed'
                    : 'open'
                }
                onChange={(e) => handleUpdateCallSettings({ status: e.target.value })}
                className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-800 dark:text-white"
                title="Update Call Status"
              >
                <option value="draft">Status: Draft</option>
                <option value="open">Status: Open</option>
                <option value="closed">Status: Closed</option>
              </select>

              <select
                value={selectedCall.visibility || 'open'}
                onChange={(e) => handleUpdateCallSettings({ visibility: e.target.value })}
                className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-800 dark:text-white"
                title="Update Call Visibility"
              >
                <option value="open">Visibility: Public</option>
                <option value="approved_suppliers">Visibility: Approved Roster</option>
                <option value="category_restricted">Visibility: Category Restricted</option>
                <option value="invite_only">Visibility: Invite Only</option>
              </select>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-slate-200 flex items-center gap-2 overflow-x-auto">
        <button
          onClick={() => setActiveTab('sealed_bids')}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'sealed_bids'
              ? 'border-[#1F5F99] text-[#1F5F99]'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Lock className="w-4 h-4" />
          <span>Sealed Bid Vault & Opening Room</span>
        </button>

        <button
          onClick={() => setActiveTab('clarifications')}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'clarifications'
              ? 'border-[#1F5F99] text-[#1F5F99]'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <HelpCircle className="w-4 h-4" />
          <span>Clarification Board ({callClarifications.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('addenda')}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'addenda'
              ? 'border-[#1F5F99] text-[#1F5F99]'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Addenda ({selectedCall?.addenda.length || 0})</span>
        </button>
      </div>

      {/* Tab 1: Sealed Bids Room */}
      {activeTab === 'sealed_bids' && selectedCall && (
        <div className="space-y-6">
          <div
            className={`p-6 sm:p-8 rounded-2xl border text-white transition-all ${
              areAllOpened
                ? 'bg-gradient-to-r from-emerald-900 via-slate-900 to-slate-900 border-emerald-700'
                : 'bg-gradient-to-r from-[#10212E] via-slate-900 to-[#10212E] border-slate-700'
            }`}
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2 max-w-2xl">
                <div className="flex items-center gap-2">
                  {areAllOpened ? (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-emerald-500/20 text-[#2F8F5B] border border-emerald-500/40 text-xs font-bold font-mono">
                      <Unlock className="w-4 h-4" /> VAULT FORMALLY UNSEALED
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-amber-500/20 text-[#E8A33D] border border-amber-500/40 text-xs font-bold font-mono">
                      <Lock className="w-4 h-4" /> CRYPTOGRAPHICALLY SEALED ENVELOPE
                    </span>
                  )}
                  <span className="text-xs text-slate-400 font-mono">
                    Ref: {selectedCall.callNumber}
                  </span>
                </div>

                <h2 className="text-xl sm:text-2xl font-heading font-bold text-white">
                  {selectedCall.title}
                </h2>

                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  {areAllOpened
                    ? 'The tender box has been unsealed by the authorized procurement committee. Financial offers are decrypted for evaluation.'
                    : `In compliance with Botswana procurement laws, bidder pricing remains sealed until closing time: ${selectedCall.closingDate} (${selectedCall.closingTimeCAT}).`}
                </p>
              </div>

              <div className="p-5 bg-white/10 rounded-2xl backdrop-blur-xs border border-white/10 text-center space-y-3 shrink-0">
                <div className="text-xs text-slate-300 font-mono">
                  {areAllOpened ? 'Opening Officer:' : 'Statutory Closing Countdown:'}
                </div>
                {areAllOpened ? (
                  <div className="font-bold text-sm text-[#2F8F5B] font-mono">
                    {officerDisplay}
                  </div>
                ) : (
                  <div className="text-2xl font-bold font-mono text-[#E8A33D] tabular-nums">
                    {selectedCall.daysRemaining} Days Remaining
                  </div>
                )}

                {!areAllOpened && (
                  <button
                    type="button"
                    disabled={isOpeningCeremony || bidsList.length === 0}
                    onClick={handleExecuteOpeningSession}
                    className="w-full px-4 py-2 bg-[#E8A33D] hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors shadow-xs"
                  >
                    <Key className="w-4 h-4" />
                    <span>{isOpeningCeremony ? 'Unsealing...' : 'Execute Opening Ceremony'}</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs space-y-4 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-heading font-semibold text-base text-[#10212E]">
                  Submitted Bid Envelopes ({bidsList.length})
                </h3>
                <p className="text-xs text-slate-500">
                  {areAllOpened
                    ? 'Decrypted itemized financial proposals.'
                    : 'Encrypted SHA256 hashes verifying package integrity without revealing amounts.'}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold">
                    <th className="py-2.5 px-3">Bidder Company</th>
                    <th className="py-2.5 px-3">Cryptographic Seal</th>
                    <th className="py-2.5 px-3">Submission Timestamp</th>
                    <th className="py-2.5 px-3 text-right">Decrypted Bid Offer (BWP)</th>
                    <th className="py-2.5 px-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {isLoadingBids ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-400">
                        Loading sealed envelopes...
                      </td>
                    </tr>
                  ) : bidsList.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-400">
                        No sealed bids submitted for this call yet.
                      </td>
                    </tr>
                  ) : (
                    bidsList.map((bid) => (
                      <tr key={bid.id} className="hover:bg-slate-50">
                        <td className="py-3 px-3">
                          <div className="font-bold text-[#10212E]">{bid.supplierName}</div>
                          <span className="text-[11px] text-slate-400 font-mono">
                            Receipt: {bid.receiptNumber || bid.id}
                          </span>
                        </td>

                        <td className="py-3 px-3 font-mono text-slate-500 truncate max-w-xs">
                          {bid.payloadSha256 || 'Recorded'}
                        </td>

                        <td className="py-3 px-3 text-slate-600 font-mono">
                          {bid.submittedAt ? new Date(bid.submittedAt).toLocaleString() : '—'}
                        </td>

                        <td className="py-3 px-3 text-right font-mono font-bold">
                          {bid.status === 'opened' && bid.totalPrice != null ? (
                            <span className="text-base text-[#1F5F99]">
                              {bid.currency || 'BWP'} {Number(bid.totalPrice).toLocaleString()}
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-slate-400 font-medium">
                              <Lock className="w-3.5 h-3.5 text-[#E8A33D]" /> Sealed
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-3 text-right">
                          <StatusChip status={bid.status === 'opened' ? 'Approved' : 'Under review'} />
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 2: Clarification Q&A Moderation */}
      {activeTab === 'clarifications' && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
            <h3 className="font-heading font-semibold text-base text-[#10212E]">
              Clarifications & Bidder Inquiries
            </h3>

            {callClarifications.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                No clarification inquiries received for this tender.
              </div>
            ) : (
              <div className="space-y-4">
                {callClarifications.map((clar) => (
                  <div key={clar.id} className="p-5 border border-slate-200 rounded-xl space-y-3 bg-white">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="text-[11px] font-bold text-slate-400 block font-mono">
                          QUESTION FROM {clar.supplierName.toUpperCase()} · {clar.submittedAt}
                        </span>
                        <p className="font-semibold text-sm text-[#10212E] mt-1">
                          "{clar.question}"
                        </p>
                      </div>
                      <span
                        className={`text-xs font-semibold px-2.5 py-0.5 rounded ${
                          clar.isPublished ? 'bg-emerald-50 text-[#2F8F5B]' : 'bg-amber-50 text-amber-900'
                        }`}
                      >
                        {clar.isPublished ? 'Published to Bidders' : 'Private (Pending Response)'}
                      </span>
                    </div>

                    {clar.isPublished ? (
                      <div className="p-3 bg-slate-50 border-l-2 border-[#1F5F99] rounded-r-lg space-y-1 text-xs">
                        <span className="font-bold text-[#1F5F99] block">
                          OFFICIAL RESPONSE ({clar.answeredBy || officerDisplay})
                        </span>
                        <p className="text-slate-700">{clar.answer}</p>
                      </div>
                    ) : (
                      <div>
                        {replyingClarId === clar.id ? (
                          <div className="space-y-2 pt-2">
                            <textarea
                              rows={3}
                              value={answerText}
                              onChange={(e) => setAnswerText(e.target.value)}
                              placeholder="Type official clarification response to publish to all registered bidders..."
                              className="w-full p-2.5 border border-slate-300 rounded-lg text-xs"
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setReplyingClarId(null)}
                                className="px-3 py-1.5 text-xs text-slate-600"
                              >
                                Cancel
                              </button>
                              <button
                                type="button"
                                disabled={isPublishingAnswer}
                                onClick={() => handlePublishAnswer(clar.id)}
                                className="px-4 py-1.5 bg-[#1F5F99] text-white text-xs font-semibold rounded-lg hover:bg-[#184a77] disabled:opacity-50"
                              >
                                {isPublishingAnswer ? 'Publishing...' : 'Publish Response'}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => {
                              setReplyingClarId(clar.id);
                              setAnswerText('');
                            }}
                            className="px-3 py-1.5 bg-[#EAF2FA] text-[#1F5F99] hover:bg-[#1F5F99] hover:text-white rounded-lg text-xs font-semibold transition-colors"
                          >
                            Draft Official Response
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Addenda */}
      {activeTab === 'addenda' && selectedCall && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-heading font-semibold text-base text-[#10212E]">
                  Formal Tender Addenda
                </h3>
                <p className="text-xs text-slate-500">
                  Published modifications, specification updates, or deadline extensions.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsCreatingAddendum(true)}
                className="px-4 py-2 bg-[#1F5F99] hover:bg-[#184a77] text-white text-xs font-semibold rounded-xl flex items-center gap-1.5"
              >
                <FilePlus className="w-4 h-4" />
                <span>Issue New Addendum</span>
              </button>
            </div>

            {isCreatingAddendum && (
              <form onSubmit={handleAddAddendum} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 text-xs">
                <h4 className="font-bold text-slate-800">Issue Addendum No. {selectedCall.addenda.length + 1}</h4>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Addendum Title</label>
                  <input
                    type="text"
                    required
                    value={addendumTitle}
                    onChange={(e) => setAddendumTitle(e.target.value)}
                    placeholder="e.g. Revised Staging Schedule & Technical Specs"
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Summary / Notification Text</label>
                  <textarea
                    rows={3}
                    required
                    value={addendumSummary}
                    onChange={(e) => setAddendumSummary(e.target.value)}
                    placeholder="Explain the changes to tender requirements..."
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCreatingAddendum(false)}
                    className="px-3 py-1.5 text-slate-600 font-semibold"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingAddendum}
                    className="px-4 py-1.5 bg-[#1F5F99] text-white font-semibold rounded-lg hover:bg-[#184a77] disabled:opacity-50"
                  >
                    {isSubmittingAddendum ? 'Publishing...' : 'Publish Addendum'}
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-3">
              {selectedCall.addenda.length === 0 ? (
                <div className="py-6 text-center text-slate-400 text-xs">
                  No addenda have been issued for this call yet.
                </div>
              ) : (
                selectedCall.addenda.map((add) => (
                  <div key={add.id} className="p-4 border border-slate-200 rounded-xl bg-white flex items-start justify-between gap-4 text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-[#10212E]">{add.title}</span>
                        <span className="text-slate-400 font-mono">Issued {add.issuedDate}</span>
                      </div>
                      <p className="text-slate-600 leading-relaxed">{add.summary}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
