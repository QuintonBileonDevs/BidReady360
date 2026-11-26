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
  Users,
  Send,
  Plus,
  Trash2,
  ShieldCheck,
} from 'lucide-react';

export const BuyerRFPManagement: React.FC = () => {
  const { calls: contextCalls, clarifications: contextClarifications, publishClarificationAnswer, profileSummary, currentUser } = useApp();

  const [orgCalls, setOrgCalls] = useState<Call[]>(contextCalls);
  const [orgClarifications, setOrgClarifications] = useState<Clarification[]>(contextClarifications);
  const [selectedCallId, setSelectedCallId] = useState<string>(contextCalls[0]?.id || '');
  const [activeTab, setActiveTab] = useState<'clarifications' | 'addenda' | 'sealed_bids' | 'invitations'>('sealed_bids');
  const [bidsList, setBidsList] = useState<any[]>([]);
  const [openingSession, setOpeningSession] = useState<any | null>(null);
  const [isLoadingBids, setIsLoadingBids] = useState(false);

  // Witness modal for Opening Ceremony
  const [members, setMembers] = useState<any[]>([]);
  const [isOpeningModalOpen, setIsOpeningModalOpen] = useState(false);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [externalWitnesses, setExternalWitnesses] = useState<{ name: string; witnessRole: string }[]>([]);
  const [isOpeningCeremony, setIsOpeningCeremony] = useState(false);

  // Invitations state
  const [callInvitations, setCallInvitations] = useState<any[]>([]);
  const [orgSuppliers, setOrgSuppliers] = useState<any[]>([]);
  const [selectedInviteIds, setSelectedInviteIds] = useState<string[]>([]);
  const [isLoadingInvitations, setIsLoadingInvitations] = useState(false);
  const [isSendingInvites, setIsSendingInvites] = useState(false);

  // Answer state
  const [replyingClarId, setReplyingClarId] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState('');
  const [isPublishingAnswer, setIsPublishingAnswer] = useState(false);

  // Addendum creation state
  const [isCreatingAddendum, setIsCreatingAddendum] = useState(false);
  const [addendumTitle, setAddendumTitle] = useState('');
  const [addendumSummary, setAddendumSummary] = useState('');
  const [addendumNewClosesAt, setAddendumNewClosesAt] = useState('');
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
      const [callsRes, clarsRes, memRes, supRes] = await Promise.all([
        buyerApi.listCalls().catch(() => null),
        buyerApi.listClarifications().catch(() => null),
        buyerApi.listMembers().catch(() => []),
        buyerApi.listSuppliers().catch(() => []),
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
            newClosesAt: a.newClosesAt || undefined,
            acknowledgementsCount: typeof a.acknowledgementsCount === 'number' ? a.acknowledgementsCount : 0,
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

      if (Array.isArray(memRes)) {
        setMembers(memRes);
        if (currentUser?.id && memRes.some((m: any) => m.userId === currentUser.id)) {
          setSelectedMemberIds((prev) => (prev.length > 0 ? prev : [currentUser.id]));
        }
      }
      if (Array.isArray(supRes)) {
        setOrgSuppliers(supRes);
      }
    } catch {}
  }, [currentUser?.id]);

  useEffect(() => {
    loadBuyerWorkspaceData();
  }, [loadBuyerWorkspaceData]);

  const selectedCall = orgCalls.find((c) => c.id === selectedCallId) || orgCalls[0];

  const loadBidsForSelectedCall = useCallback(async (callId: string) => {
    if (!callId) return;
    setIsLoadingBids(true);
    try {
      const [list, session] = await Promise.all([
        buyerApi.listBids(callId).catch(() => []),
        buyerApi.getOpeningSession(callId).catch(() => null),
      ]);
      setBidsList(Array.isArray(list) ? list : []);
      setOpeningSession(session || null);
    } catch {
      setBidsList([]);
      setOpeningSession(null);
    } finally {
      setIsLoadingBids(false);
    }
  }, []);

  const loadInvitationsForSelectedCall = useCallback(async (callId: string) => {
    if (!callId) return;
    setIsLoadingInvitations(true);
    try {
      const list = await buyerApi.listCallInvitations(callId);
      setCallInvitations(Array.isArray(list) ? list : []);
    } catch {
      setCallInvitations([]);
    } finally {
      setIsLoadingInvitations(false);
    }
  }, []);

  useEffect(() => {
    if (selectedCall?.id) {
      loadBidsForSelectedCall(selectedCall.id);
      loadInvitationsForSelectedCall(selectedCall.id);
    }
  }, [selectedCall?.id, loadBidsForSelectedCall, loadInvitationsForSelectedCall]);

  const callClarifications = orgClarifications.filter((c) => c.callId === selectedCall?.id);
  const areAllOpened = Boolean(openingSession?.sessionStatus === 'completed') || (bidsList.length > 0 && bidsList.some((b) => b.status === 'opened'));

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
        newClosesAt: addendumNewClosesAt ? new Date(addendumNewClosesAt).toISOString() : undefined,
      });
      setIsCreatingAddendum(false);
      setAddendumTitle('');
      setAddendumSummary('');
      setAddendumNewClosesAt('');
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

  const effectiveMemberWitnesses = new Set<string>(selectedMemberIds);
  if (currentUser?.id && members.some((m) => m.userId === currentUser.id)) {
    effectiveMemberWitnesses.add(currentUser.id);
  }
  const validExternalCount = externalWitnesses.filter((w) => w.name.trim().length >= 2).length;
  const totalSelectedWitnesses =
    effectiveMemberWitnesses.size +
    (currentUser?.id && members.some((m) => m.userId === currentUser.id) ? 0 : 1) +
    validExternalCount;
  const quorumSatisfied = members.length >= 2 ? effectiveMemberWitnesses.size >= 2 : totalSelectedWitnesses >= 2;

  const handleExecuteOpeningSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCall || isOpeningCeremony) return;
    if (!quorumSatisfied) {
      setErrorMessage('Opening quorum requires at least 2 distinct organization officers/witnesses.');
      return;
    }
    setIsOpeningCeremony(true);
    setErrorMessage(null);
    try {
      const payloadWitnesses = [
        ...Array.from(effectiveMemberWitnesses).map((uid) => {
          const m = members.find((mem) => mem.userId === uid);
          return {
            userId: uid,
            name: m?.fullName,
            witnessRole: uid === currentUser?.id ? 'Presiding Officer' : m?.roleName || 'Co-Witness',
          };
        }),
        ...externalWitnesses
          .filter((w) => w.name.trim().length >= 2)
          .map((w) => ({
            name: w.name.trim(),
            witnessRole: w.witnessRole.trim() || 'External Witness',
          })),
      ];

      await buyerApi.conductOpeningSession(selectedCall.id, payloadWitnesses);
      setIsOpeningModalOpen(false);
      await loadBidsForSelectedCall(selectedCall.id);
      await loadBuyerWorkspaceData();
      showToast('Sealed bid opening ceremony executed and witness register committed to audit ledger.');
    } catch (err: any) {
      setErrorMessage(err?.message || 'Unable to unseal bids for this call.');
    } finally {
      setIsOpeningCeremony(false);
    }
  };

  const handleSendInvitations = async () => {
    if (!selectedCall || selectedInviteIds.length === 0 || isSendingInvites) return;
    setIsSendingInvites(true);
    setErrorMessage(null);
    try {
      await buyerApi.inviteSuppliers(selectedCall.id, selectedInviteIds);
      setSelectedInviteIds([]);
      await loadInvitationsForSelectedCall(selectedCall.id);
      showToast(`Sent ${selectedInviteIds.length} formal tender invitation${selectedInviteIds.length === 1 ? '' : 's'}.`);
    } catch (err: any) {
      setErrorMessage(err?.message || 'Failed to dispatch supplier invitations.');
    } finally {
      setIsSendingInvites(false);
    }
  };

  const invitedSupplierIds = new Set(callInvitations.map((inv) => inv.supplierId));

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
            <span className="text-xs tabular-nums font-bold text-[#1F5F99] dark:text-[#6FAEE0] bg-[#EAF2FA] dark:bg-slate-800 px-2.5 py-0.5 rounded-md">
              RFP Control Center
            </span>
            <span className="text-xs text-slate-500 dark:text-slate-400">· Clarifications, Addenda, Invitations & Sealed Envelopes</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-heading font-bold text-slate-900 dark:text-white">
            RFP Governance & Sealed Bid Opening
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 max-w-2xl leading-relaxed">
            Oversee sealed tender packages, answer bidder questions, issue addenda, and dispatch formal supplier invitations.
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
      <div className="border-b border-slate-200 flex items-center gap-2 overflow-x-auto dark:border-[#244157]">
        <button
          onClick={() => setActiveTab('sealed_bids')}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'sealed_bids'
              ? 'border-[#1F5F99] text-[#1F5F99]'
              : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-[#D3E3F2] dark:hover:text-white'
          }`}
        >
          <Lock className="w-4 h-4" />
          <span>Sealed Bid Vault & Opening Room</span>
        </button>

        <button
          onClick={() => setActiveTab('clarifications')}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'clarifications'
              ? 'border-[#1F5F99] text-[#1F5F99]'
              : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-[#D3E3F2] dark:hover:text-white'
          }`}
        >
          <HelpCircle className="w-4 h-4" />
          <span>Clarification Board ({callClarifications.length})</span>
        </button>

        <button
          onClick={() => setActiveTab('addenda')}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'addenda'
              ? 'border-[#1F5F99] text-[#1F5F99]'
              : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-[#D3E3F2] dark:hover:text-white'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Addenda ({selectedCall?.addenda.length || 0})</span>
        </button>

        <button
          onClick={() => setActiveTab('invitations')}
          className={`pb-3 px-4 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 whitespace-nowrap cursor-pointer ${
            activeTab === 'invitations'
              ? 'border-[#1F5F99] text-[#1F5F99]'
              : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-[#D3E3F2] dark:hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          <span>Invitations ({callInvitations.length})</span>
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
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-emerald-500/20 text-[#2F8F5B] border border-emerald-500/40 text-xs font-bold tabular-nums">
                      <Unlock className="w-4 h-4" /> VAULT FORMALLY UNSEALED
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md bg-amber-500/20 text-[#E8A33D] border border-amber-500/40 text-xs font-bold tabular-nums">
                      <Lock className="w-4 h-4" /> CRYPTOGRAPHICALLY SEALED ENVELOPE
                    </span>
                  )}
                  <span className="text-xs text-slate-400 tabular-nums">
                    Ref: {selectedCall.callNumber}
                  </span>
                </div>

                <h2 className="text-xl sm:text-2xl font-heading font-bold text-white">
                  {selectedCall.title}
                </h2>

                <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
                  {areAllOpened
                    ? 'The tender box has been unsealed by a witnessed procurement opening session. Financial offers are decrypted for evaluation.'
                    : `Bidder pricing remains cryptographically sealed until closing time: ${selectedCall.closingDate} (${selectedCall.closingTimeCAT}) and a 2-witness opening ceremony.`}
                </p>
              </div>

              <div className="p-5 bg-white/10 rounded-2xl backdrop-blur-xs border border-white/10 text-center space-y-3 shrink-0">
                <div className="text-xs text-slate-300 tabular-nums">
                  {areAllOpened ? 'Opening Presiding Officer:' : 'Statutory Closing Countdown:'}
                </div>
                {areAllOpened ? (
                  <div className="font-bold text-sm text-[#2F8F5B] tabular-nums">
                    {openingSession?.conductedByName || officerDisplay}
                  </div>
                ) : (
                  <div className="text-2xl font-bold text-[#E8A33D] tabular-nums">
                    {selectedCall.daysRemaining} Days Remaining
                  </div>
                )}

                {!areAllOpened && (
                  <button
                    type="button"
                    disabled={isOpeningCeremony || bidsList.filter((b) => b.status === 'submitted').length === 0}
                    onClick={() => setIsOpeningModalOpen(true)}
                    className="w-full px-4 py-2 bg-[#E8A33D] hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors shadow-xs cursor-pointer"
                  >
                    <Key className="w-4 h-4" />
                    <span>Configure Witnesses & Open</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {openingSession && (
            <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-2 text-xs dark:border-[#2F8F5B]/40">
              <div className="flex flex-wrap items-center justify-between gap-2 text-[#065F46] font-semibold dark:text-[#6EE7B7]">
                <span className="inline-flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#2F8F5B]" />
                  Official Opening Session Record ({openingSession.witnesses?.length || 0} witnesses verified)
                </span>
                <span className="tabular-nums text-[11px]">
                  {new Date(openingSession.openedAt).toLocaleString('en-BW')}
                </span>
              </div>
              {openingSession.registerSha256 && (
                <div className="tabular-nums text-[11px] text-slate-700 bg-white p-2 rounded border border-emerald-200 break-all dark:bg-[#1C364B] dark:text-[#D3E3F2] dark:border-[#2F8F5B]/40">
                  Register SHA-256: {openingSession.registerSha256}
                </div>
              )}
            </div>
          )}

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs space-y-4 p-6 dark:bg-[#1C364B] dark:border-[#244157]">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-heading font-semibold text-base text-[#10212E] dark:text-white">
                  Submitted Bid Envelopes ({bidsList.length})
                </h3>
                <p className="text-xs text-slate-500 dark:text-[#9CB4C9]">
                  {areAllOpened
                    ? 'Decrypted itemized financial proposals.'
                    : 'Encrypted SHA256 hashes verifying package integrity without revealing amounts.'}
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold dark:bg-[#162C3D] dark:text-[#D3E3F2] dark:border-[#244157]">
                    <th className="py-2.5 px-3">Bidder Company</th>
                    <th className="py-2.5 px-3">Cryptographic Seal</th>
                    <th className="py-2.5 px-3">Submission Timestamp</th>
                    <th className="py-2.5 px-3 text-right">Decrypted Bid Offer (BWP)</th>
                    <th className="py-2.5 px-3 text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-[#244157]">
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
                      <tr key={bid.id} className="hover:bg-slate-50 dark:hover:bg-[#162C3D]">
                        <td className="py-3 px-3">
                          <div className="font-bold text-[#10212E] dark:text-white">{bid.supplierName}</div>
                          <span className="text-[11px] text-slate-400 tabular-nums">
                            Receipt: {bid.receiptNumber || bid.id}
                          </span>
                        </td>

                        <td className="py-3 px-3 tabular-nums text-slate-500 truncate max-w-xs dark:text-[#9CB4C9]">
                          {bid.payloadSha256 || 'Recorded'}
                        </td>

                        <td className="py-3 px-3 text-slate-600 tabular-nums dark:text-[#D3E3F2]">
                          {bid.submittedAt ? new Date(bid.submittedAt).toLocaleString() : '—'}
                        </td>

                        <td className="py-3 px-3 text-right tabular-nums font-bold">
                          {bid.status === 'opened' && bid.totalPrice != null ? (
                            <span className="text-base text-[#1F5F99] dark:text-[#6FAEE0]">
                              {bid.currency || 'BWP'} {Number(bid.totalPrice).toLocaleString()}
                            </span>
                          ) : bid.status === 'withdrawn' ? (
                            <span className="text-slate-400 italic">Withdrawn</span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-slate-400 font-medium">
                              <Lock className="w-3.5 h-3.5 text-[#E8A33D]" /> Sealed
                            </span>
                          )}
                        </td>

                        <td className="py-3 px-3 text-right">
                          <StatusChip status={bid.status === 'opened' ? 'Approved' : bid.status === 'withdrawn' ? 'Withdrawn' : 'Under review'} />
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
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 dark:bg-[#1C364B] dark:border-[#244157]">
            <h3 className="font-heading font-semibold text-base text-[#10212E] dark:text-white">
              Clarifications & Bidder Inquiries
            </h3>

            {callClarifications.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-xs">
                No clarification inquiries received for this tender.
              </div>
            ) : (
              <div className="space-y-4">
                {callClarifications.map((clar) => (
                  <div key={clar.id} className="p-5 border border-slate-200 rounded-xl space-y-3 bg-white dark:bg-[#1C364B] dark:border-[#244157]">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="text-[11px] font-bold text-slate-400 block tabular-nums">
                          QUESTION FROM {clar.supplierName.toUpperCase()} · {clar.submittedAt}
                        </span>
                        <p className="font-semibold text-sm text-[#10212E] mt-1 dark:text-white">
                          "{clar.question}"
                        </p>
                      </div>
                      <span
                        className={`text-xs font-semibold px-2.5 py-0.5 rounded ${
                          clar.isPublished ? 'bg-emerald-50 text-[#2F8F5B] dark:bg-[#2F8F5B]/20' : 'bg-amber-50 text-amber-900 dark:bg-[#E8A33D]/20'
                        }`}
                      >
                        {clar.isPublished ? 'Published to Bidders' : 'Private (Pending Response)'}
                      </span>
                    </div>

                    {clar.isPublished ? (
                      <div className="p-3 bg-slate-50 border-l-2 border-[#1F5F99] rounded-r-lg space-y-1 text-xs dark:bg-[#162C3D]">
                        <span className="font-bold text-[#1F5F99] block dark:text-[#6FAEE0]">
                          OFFICIAL RESPONSE ({clar.answeredBy || officerDisplay})
                        </span>
                        <p className="text-slate-700 dark:text-[#D3E3F2]">{clar.answer}</p>
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
                              className="w-full p-2.5 border border-slate-300 rounded-lg text-xs dark:border-[#244157]"
                            />
                            <div className="flex justify-end gap-2">
                              <button
                                type="button"
                                onClick={() => setReplyingClarId(null)}
                                className="px-3 py-1.5 text-xs text-slate-600 dark:text-[#D3E3F2]"
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
                            className="px-3 py-1.5 bg-[#EAF2FA] text-[#1F5F99] hover:bg-[#1F5F99] hover:text-white rounded-lg text-xs font-semibold transition-colors dark:bg-[#162C3D] dark:text-[#6FAEE0]"
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
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4 dark:bg-[#1C364B] dark:border-[#244157]">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-heading font-semibold text-base text-[#10212E] dark:text-white">
                  Formal Tender Addenda
                </h3>
                <p className="text-xs text-slate-500 dark:text-[#9CB4C9]">
                  Published modifications, specification updates, or deadline extensions.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setIsCreatingAddendum(true)}
                className="px-4 py-2 bg-[#1F5F99] hover:bg-[#184a77] text-white text-xs font-semibold rounded-xl flex items-center gap-1.5 cursor-pointer"
              >
                <FilePlus className="w-4 h-4" />
                <span>Issue New Addendum</span>
              </button>
            </div>

            {isCreatingAddendum && (
              <form onSubmit={handleAddAddendum} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 text-xs dark:bg-[#162C3D] dark:border-[#244157]">
                <h4 className="font-bold text-slate-800 dark:text-white">Issue Addendum No. {selectedCall.addenda.length + 1}</h4>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1 dark:text-[#D3E3F2]">Addendum Title</label>
                  <input
                    type="text"
                    required
                    value={addendumTitle}
                    onChange={(e) => setAddendumTitle(e.target.value)}
                    placeholder="e.g. Revised Staging Schedule & Technical Specs"
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs dark:bg-[#1C364B] dark:border-[#244157]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1 dark:text-[#D3E3F2]">Summary / Notification Text</label>
                  <textarea
                    rows={3}
                    required
                    value={addendumSummary}
                    onChange={(e) => setAddendumSummary(e.target.value)}
                    placeholder="Explain the changes to tender requirements..."
                    className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs dark:bg-[#1C364B] dark:border-[#244157]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1 dark:text-[#D3E3F2]">Extend Closing Deadline (Optional)</label>
                  <input
                    type="datetime-local"
                    value={addendumNewClosesAt}
                    onChange={(e) => setAddendumNewClosesAt(e.target.value)}
                    className="w-full sm:w-auto p-2 bg-white border border-slate-300 rounded-lg text-xs dark:bg-[#1C364B] dark:border-[#244157]"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsCreatingAddendum(false)}
                    className="px-3 py-1.5 text-slate-600 font-semibold dark:text-[#D3E3F2]"
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
                  <div key={add.id} className="p-4 border border-slate-200 rounded-xl bg-white flex flex-col sm:flex-row sm:items-start justify-between gap-4 text-xs dark:bg-[#1C364B] dark:border-[#244157]">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-bold text-[#10212E] dark:text-white">{add.title}</span>
                        <span className="text-slate-400 tabular-nums">Issued {add.issuedDate}</span>
                        {typeof add.acknowledgementsCount === 'number' && (
                          <span className="tabular-nums text-[11px] bg-[#EAF2FA] text-[#1F5F99] px-2 py-0.5 rounded dark:bg-[#162C3D] dark:text-[#6FAEE0]">
                            {add.acknowledgementsCount} supplier ack{add.acknowledgementsCount === 1 ? '' : 's'}
                          </span>
                        )}
                      </div>
                      <p className="text-slate-600 leading-relaxed dark:text-[#D3E3F2]">{add.summary}</p>
                      {add.newClosesAt && (
                        <p className="tabular-nums text-[11px] text-[#92400E] dark:text-[#FCD34D]">
                          New Closing Deadline: {new Date(add.newClosesAt).toLocaleString('en-BW')}
                        </p>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Invitations */}
      {activeTab === 'invitations' && selectedCall && (
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5 text-xs dark:bg-[#1C364B] dark:border-[#244157]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-heading font-semibold text-base text-[#10212E] dark:text-white">
                  Formal Supplier Tender Invitations ({selectedCall.visibility || 'open'})
                </h3>
                <p className="text-slate-500 dark:text-[#9CB4C9]">
                  Invite qualified suppliers to participate in this tender call. Required for Invite-Only tenders.
                </p>
              </div>
              <button
                type="button"
                disabled={selectedInviteIds.length === 0 || isSendingInvites}
                onClick={handleSendInvitations}
                className="px-4 py-2 bg-[#1F5F99] hover:bg-[#184a77] disabled:opacity-50 text-white font-semibold rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isSendingInvites ? 'Sending...' : `Send Invitations (${selectedInviteIds.length})`}</span>
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {/* Select Suppliers */}
              <div className="space-y-2">
                <h4 className="font-bold text-slate-700 uppercase text-[11px] dark:text-[#D3E3F2]">Available Suppliers</h4>
                <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl dark:border-[#244157] dark:divide-[#244157]">
                  {orgSuppliers.length === 0 ? (
                    <div className="p-6 text-center text-slate-400">No active suppliers available.</div>
                  ) : (
                    orgSuppliers.map((sup) => {
                      const alreadyInvited = invitedSupplierIds.has(sup.id);
                      const checked = selectedInviteIds.includes(sup.id);
                      return (
                        <label
                          key={sup.id}
                          className={`p-3 flex items-center justify-between gap-2 ${alreadyInvited ? 'bg-slate-50 opacity-70 dark:bg-[#162C3D]' : 'cursor-pointer hover:bg-slate-50 dark:hover:bg-[#162C3D]'}`}
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              disabled={alreadyInvited}
                              checked={alreadyInvited || checked}
                              onChange={() =>
                                setSelectedInviteIds((prev) =>
                                  prev.includes(sup.id) ? prev.filter((id) => id !== sup.id) : [...prev, sup.id]
                                )
                              }
                            />
                            <div>
                              <div className="font-semibold text-slate-900 dark:text-white">{sup.legalName}</div>
                              <div className="text-[11px] text-slate-500 dark:text-[#9CB4C9]">
                                {sup.city || 'Botswana'} · {sup.verificationStatus || 'active'}
                              </div>
                            </div>
                          </div>
                          {alreadyInvited && (
                            <span className="text-[10px] font-semibold bg-emerald-50 text-[#2F8F5B] px-2 py-0.5 rounded dark:bg-[#2F8F5B]/20">
                              Invited
                            </span>
                          )}
                        </label>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Sent Invitations Register */}
              <div className="space-y-2">
                <h4 className="font-bold text-slate-700 uppercase text-[11px] dark:text-[#D3E3F2]">
                  Dispatched Invitations ({callInvitations.length})
                </h4>
                <div className="max-h-72 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-xl dark:border-[#244157] dark:divide-[#244157]">
                  {isLoadingInvitations ? (
                    <div className="p-6 text-center text-slate-400">Loading invitations...</div>
                  ) : callInvitations.length === 0 ? (
                    <div className="p-6 text-center text-slate-400">No formal invitations dispatched for this call yet.</div>
                  ) : (
                    callInvitations.map((inv) => (
                      <div key={inv.id} className="p-3 flex items-center justify-between gap-2">
                        <div>
                          <div className="font-semibold text-slate-900 dark:text-white">{inv.supplierName}</div>
                          <div className="text-[11px] text-slate-500 tabular-nums dark:text-[#9CB4C9]">
                            Invited {inv.invitedAt ? new Date(inv.invitedAt).toLocaleDateString('en-BW') : '—'}
                          </div>
                        </div>
                        <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-[#EAF2FA] text-[#1F5F99] capitalize dark:bg-[#162C3D] dark:text-[#6FAEE0]">
                          {inv.status || 'invited'}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Witness Quorum Modal */}
      {isOpeningModalOpen && selectedCall && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#10212E]/70 backdrop-blur-xs">
          <div className="w-full max-w-xl bg-white rounded-2xl border border-slate-200 p-6 space-y-4 text-xs max-h-[90vh] overflow-y-auto dark:bg-[#1C364B] dark:border-[#244157]">
            <div className="pb-3 border-b border-slate-200 dark:border-[#244157]">
              <span className="text-[11px] font-bold text-[#1F5F99] uppercase dark:text-[#6FAEE0]">Statutory Opening Quorum (&gt;= 2 Witnesses)</span>
              <h3 className="font-heading font-bold text-lg text-[#10212E] dark:text-white">
                Execute Opening Ceremony — {selectedCall.callNumber}
              </h3>
            </div>

            <form onSubmit={handleExecuteOpeningSession} className="space-y-4">
              {members.length > 0 && (
                <div className="space-y-2">
                  <label className="font-semibold text-slate-800 block dark:text-white">Organization Co-Witnesses</label>
                  <div className="max-h-40 overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded-lg dark:border-[#244157] dark:divide-[#244157]">
                    {members.map((m) => {
                      const isPresiding = m.userId === currentUser?.id;
                      const checked = effectiveMemberWitnesses.has(m.userId);
                      return (
                        <label
                          key={m.userId}
                          className={`flex items-center justify-between p-2.5 ${isPresiding ? 'bg-[#EAF2FA]/60' : 'cursor-pointer hover:bg-slate-50 dark:hover:bg-[#162C3D]'}`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={isPresiding}
                              onChange={() =>
                                setSelectedMemberIds((prev) =>
                                  prev.includes(m.userId) ? prev.filter((id) => id !== m.userId) : [...prev, m.userId]
                                )
                              }
                            />
                            <span className="font-medium text-slate-900 dark:text-white">
                              {m.fullName} {isPresiding ? '(Presiding Officer)' : ''}
                            </span>
                          </div>
                          <span className="tabular-nums text-slate-500 dark:text-[#9CB4C9]">{m.roleName}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-semibold text-slate-800 dark:text-white">External Witnesses</label>
                  <button
                    type="button"
                    onClick={() => setExternalWitnesses((prev) => [...prev, { name: '', witnessRole: 'External Witness' }])}
                    className="text-[#1F5F99] font-semibold inline-flex items-center gap-1 cursor-pointer dark:text-[#6FAEE0]"
                  >
                    <Plus className="w-3.5 h-3.5" /> Add External Witness
                  </button>
                </div>
                {externalWitnesses.map((ew, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2">
                    <input
                      type="text"
                      placeholder="Full Name"
                      value={ew.name}
                      onChange={(e) =>
                        setExternalWitnesses((prev) => prev.map((r, i) => (i === idx ? { ...r, name: e.target.value } : r)))
                      }
                      className="col-span-6 p-2 border border-slate-300 rounded-lg dark:border-[#244157]"
                    />
                    <input
                      type="text"
                      placeholder="Role / Title"
                      value={ew.witnessRole}
                      onChange={(e) =>
                        setExternalWitnesses((prev) => prev.map((r, i) => (i === idx ? { ...r, witnessRole: e.target.value } : r)))
                      }
                      className="col-span-5 p-2 border border-slate-300 rounded-lg dark:border-[#244157]"
                    />
                    <button
                      type="button"
                      onClick={() => setExternalWitnesses((prev) => prev.filter((_, i) => i !== idx))}
                      className="col-span-1 text-[#C2412D] flex items-center justify-center"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              <div className={`p-3 rounded-lg ${quorumSatisfied ? 'bg-emerald-50 text-[#065F46] dark:bg-[#2F8F5B]/20 dark:text-[#6EE7B7]' : 'bg-amber-50 text-amber-900 dark:bg-[#E8A33D]/20'}`}>
                {quorumSatisfied
                  ? 'Quorum verified: >= 2 witnesses selected.'
                  : 'Select at least 2 distinct witnesses to proceed.'}
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-200 dark:border-[#244157]">
                <button
                  type="button"
                  onClick={() => setIsOpeningModalOpen(false)}
                  className="px-3 py-1.5 text-slate-600 dark:text-[#D3E3F2]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isOpeningCeremony || !quorumSatisfied}
                  className="px-4 py-2 bg-[#E8A33D] hover:bg-amber-600 text-slate-950 font-bold rounded-lg disabled:opacity-50"
                >
                  {isOpeningCeremony ? 'Unsealing...' : 'Confirm Witnesses & Unseal'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
