import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { buyerApi } from '../../services/api';
import { Lock, Unlock, CheckCircle2, AlertCircle, ShieldCheck, Users, Plus, Trash2 } from 'lucide-react';

interface OrgMemberOption {
  userId: string;
  fullName: string;
  email: string;
  roleName: string;
}

interface ExternalWitnessRow {
  name: string;
  witnessRole: string;
}

export const BuyerBidsOpening: React.FC = () => {
  const { calls, buyerSubRole, addAuditEvent, registeredBuyerOrgName, profileSummary, currentUser } = useApp();

  const [buyerCalls, setBuyerCalls] = useState<any[]>([]);
  const [selectedCallId, setSelectedCallId] = useState<string>('');
  const [isOpeningSessionOpen, setIsOpeningSessionOpen] = useState(false);

  const [members, setMembers] = useState<OrgMemberOption[]>([]);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [externalWitnesses, setExternalWitnesses] = useState<ExternalWitnessRow[]>([]);

  const [bids, setBids] = useState<any[]>([]);
  const [openingSession, setOpeningSession] = useState<any | null>(null);
  const [isLoadingBids, setIsLoadingBids] = useState(false);
  const [isSubmittingOpening, setIsSubmittingOpening] = useState(false);
  const [openingSuccess, setOpeningSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const officerName = currentUser?.fullName || profileSummary?.displayName || 'Procurement Officer';
  const orgName = profileSummary?.supplierOrOrgName || registeredBuyerOrgName || 'Procuring Organization';

  const loadCallsAndMembers = useCallback(async () => {
    try {
      const [callsRes, memRes] = await Promise.all([
        buyerApi.listCalls().catch(() => null),
        buyerApi.listMembers().catch(() => []),
      ]);
      const rawCalls = Array.isArray(callsRes)
        ? callsRes.map((c: any) => ({
            id: c.id,
            callNumber: c.referenceNo,
            title: c.title,
            type: c.callType === 'eoi' ? 'EOI' : c.callType === 'registration_drive' ? 'Registration drive' : 'RFP',
            status: c.status,
            closesAt: c.closesAt,
            closingDate: c.closesAt ? String(c.closesAt).slice(0, 10) : '',
            daysRemaining: c.closesAt
              ? Math.max(0, Math.ceil((new Date(c.closesAt).getTime() - Date.now()) / 86400000))
              : 0,
          }))
        : calls.filter((c) => c.type === 'RFP');
      const rfpCalls = rawCalls.filter((c: any) => c.type === 'RFP');
      setBuyerCalls(rfpCalls);
      setSelectedCallId((prev) => (prev && rfpCalls.some((c: any) => c.id === prev) ? prev : rfpCalls[0]?.id || ''));

      if (Array.isArray(memRes)) {
        setMembers(memRes);
        if (currentUser?.id && memRes.some((m: any) => m.userId === currentUser.id)) {
          setSelectedMemberIds((prev) => (prev.length > 0 ? prev : [currentUser.id]));
        }
      }
    } catch {
      const fallback = calls.filter((c) => c.type === 'RFP');
      setBuyerCalls(fallback);
      if (fallback[0]) setSelectedCallId(fallback[0].id);
    }
  }, [calls, currentUser?.id]);

  useEffect(() => {
    loadCallsAndMembers();
  }, [loadCallsAndMembers]);

  const selectedCall = buyerCalls.find((c) => c.id === selectedCallId) || buyerCalls[0];

  const loadBidsAndSession = useCallback(async (callId: string) => {
    if (!callId) {
      setBids([]);
      setOpeningSession(null);
      return;
    }
    setIsLoadingBids(true);
    try {
      const [list, session] = await Promise.all([
        buyerApi.listBids(callId).catch(() => []),
        buyerApi.getOpeningSession(callId).catch(() => null),
      ]);
      setBids(Array.isArray(list) ? list : []);
      setOpeningSession(session || null);
    } catch {
      setBids([]);
      setOpeningSession(null);
    } finally {
      setIsLoadingBids(false);
    }
  }, []);

  useEffect(() => {
    if (selectedCall?.id) {
      loadBidsAndSession(selectedCall.id);
    }
  }, [selectedCall?.id, loadBidsAndSession]);

  const isOpened = Boolean(openingSession?.sessionStatus === 'completed') || (bids.length > 0 && bids.some((b) => b.status === 'opened'));
  const hasOpeningPermission = buyerSubRole === 'Org admin' || buyerSubRole === 'Procurement officer';
  const urgentSealedCallsCount = buyerCalls.filter((c) => (c.status === 'Open' || c.status === 'open') && c.daysRemaining <= 3).length;
  const isBeforeClosing = Boolean(selectedCall?.closesAt && Date.now() < new Date(selectedCall.closesAt).getTime());
  const submittedBidsCount = bids.filter((b) => b.status === 'submitted').length;

  const effectiveMemberWitnesses = new Set<string>(selectedMemberIds);
  if (currentUser?.id && members.some((m) => m.userId === currentUser.id)) {
    effectiveMemberWitnesses.add(currentUser.id);
  }
  const validExternalCount = externalWitnesses.filter((w) => w.name.trim().length >= 2).length;
  const totalSelectedWitnesses = effectiveMemberWitnesses.size + (currentUser?.id && members.some((m) => m.userId === currentUser.id) ? 0 : 1) + validExternalCount;
  const quorumSatisfied =
    members.length >= 2 ? effectiveMemberWitnesses.size >= 2 : totalSelectedWitnesses >= 2;

  const toggleMemberWitness = (userId: string) => {
    if (userId === currentUser?.id) return; // presiding officer always included
    setSelectedMemberIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]
    );
  };

  const handleStartOpeningSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCall || isSubmittingOpening) return;
    if (!quorumSatisfied) {
      setErrorMsg('Quorum requires at least 2 distinct organization officers/witnesses to co-sign the opening.');
      return;
    }

    setIsSubmittingOpening(true);
    setErrorMsg(null);
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
      await loadBidsAndSession(selectedCall.id);
      setIsOpeningSessionOpen(false);
      setOpeningSuccess(true);

      addAuditEvent({
        action: 'Sealed Bid Opening Session Executed',
        actorName: officerName,
        actorRole: 'Procurement Officer',
        organizationName: orgName,
        entityType: 'Call',
        entityId: selectedCall.callNumber,
        details: `Formal unsealing session conducted for ${selectedCall.callNumber} (${selectedCall.title}) with ${payloadWitnesses.length} witnesses.`,
      });

      setTimeout(() => setOpeningSuccess(false), 5000);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Unable to execute bid opening session.');
    } finally {
      setIsSubmittingOpening(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#D5E0EA] dark:border-[#1E364A]">
        <div className="space-y-1">
          <h1 className="font-heading font-semibold text-[30px] leading-tight text-[#10212E] dark:text-white">
            Bids & sealed envelope opening
          </h1>
          <p className="text-[15px] text-[#43525F] dark:text-[#B2C3D2]">
            Statutory sealed-bid protocol under the Public Procurement Act. Price proposals remain cryptographically sealed until an authorized witnessed opening session after closing time.
          </p>
        </div>
      </div>

      {/* Mandatory Sealed Bid Safeguard Alert */}
      <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] border-l-4 border-l-[#1F5F99] p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="text-[#1F5F99] shrink-0 mt-0.5">
            <Lock className="w-5 h-5" strokeWidth={1.5} />
          </div>
          <div className="space-y-1">
            <h2 className="text-[16px] font-semibold text-[#10212E] dark:text-white">
              {urgentSealedCallsCount > 0
                ? `${urgentSealedCallsCount} sealed tender${urgentSealedCallsCount === 1 ? '' : 's'} closing within 3 days`
                : `${buyerCalls.length} sealed tender${buyerCalls.length === 1 ? '' : 's'} tracked in vault`}
            </h2>
            <p className="text-[15px] text-[#43525F] dark:text-[#B2C3D2]">
              Bids stay sealed until an authorised 2-witness opening ceremony is held after closing time. Pre-closing inspection or tampering is blocked by database triggers.
            </p>
          </div>
        </div>
      </div>

      {openingSuccess && (
        <div className="p-4 bg-[#ECFDF5] border border-[#A7F3D0] rounded-[12px] text-[#065F46] text-[14px] flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-[#2F8F5B]" />
          <span>
            Opening session executed successfully. Bids have been unsealed, witness register SHA-256 committed to audit log, and financial proposals are now visible to evaluators.
          </span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-[#FEF2F2] border border-[#FCA5A5] rounded-[12px] text-[#8E2A1B] text-[14px] flex items-center gap-2">
          <AlertCircle className="w-5 h-5 text-[#C2412D]" />
          <span>{errorMsg}</span>
        </div>
      )}

      {/* Tender Selection & Status Panel */}
      <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <label className="text-[13px] font-medium text-[#6B7A87] block">
              Select tender call to review envelopes
            </label>
            <select
              value={selectedCallId}
              onChange={(e) => {
                setSelectedCallId(e.target.value);
                setErrorMsg(null);
              }}
              className="p-2.5 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] bg-[#F7FAFD] dark:bg-[#10212E] text-[14px] font-semibold text-[#10212E] dark:text-white"
            >
              {buyerCalls.length === 0 && <option value="">No sealed RFPs found</option>}
              {buyerCalls.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.callNumber} — {c.title}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {isOpened ? (
              <span className="bg-[#ECFDF5] text-[#2F8F5B] px-3 py-1.5 rounded-[6px] text-[13px] font-semibold flex items-center gap-1.5">
                <Unlock className="w-4 h-4" />
                <span>Envelopes unsealed & logged</span>
              </span>
            ) : (
              <span className="bg-[#FEF2F2] text-[#C2412D] px-3 py-1.5 rounded-[6px] text-[13px] font-semibold flex items-center gap-1.5">
                <Lock className="w-4 h-4" />
                <span>Sealed (Locked prior to opening ceremony)</span>
              </span>
            )}

            {!isOpened && hasOpeningPermission && submittedBidsCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  setErrorMsg(null);
                  setIsOpeningSessionOpen(true);
                }}
                className="px-4 py-2 bg-[#1F5F99] hover:bg-[#184c7a] text-white text-[14px] font-medium rounded-[6px] transition-colors cursor-pointer"
              >
                Start opening session
              </button>
            )}

            {!isOpened && !hasOpeningPermission && (
              <span className="text-[13px] text-[#6B7A87]">
                Opening restricted to Procurement Officers
              </span>
            )}
          </div>
        </div>

        {/* Opening Ceremony Certificate */}
        {openingSession && (
          <div className="p-4 rounded-[10px] bg-[#ECFDF5]/60 dark:bg-[#065F46]/20 border border-[#A7F3D0] dark:border-[#065F46]/40 space-y-3 text-[13px]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 font-semibold text-[#065F46] dark:text-[#A7F3D0]">
                <ShieldCheck className="w-4 h-4 text-[#2F8F5B]" />
                <span>Official Opening Ceremony Certificate ({openingSession.protocolType?.replace(/_/g, ' ') || 'Dual-Key Statutory Quorum'})</span>
              </div>
              <span className="font-mono text-[11px] text-[#065F46]/80 dark:text-[#A7F3D0]/80">
                Opened {new Date(openingSession.openedAt).toLocaleString('en-BW')} · Presiding: {openingSession.conductedByName}
              </span>
            </div>
            {openingSession.registerSha256 && (
              <div className="text-[12px] font-mono text-[#10212E] dark:text-white bg-white/80 dark:bg-[#10212E]/80 p-2 rounded border border-[#A7F3D0]/60 break-all">
                Register SHA-256: {openingSession.registerSha256}
              </div>
            )}
            {Array.isArray(openingSession.witnesses) && openingSession.witnesses.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {openingSession.witnesses.map((w: any, idx: number) => (
                  <div
                    key={`${w.userId || w.name}-${idx}`}
                    className="p-2.5 rounded-[6px] bg-white dark:bg-[#10212E] border border-[#D5E0EA] dark:border-[#1E364A] flex items-center justify-between gap-2"
                  >
                    <div>
                      <div className="font-semibold text-[#10212E] dark:text-white">{w.name}</div>
                      <div className="text-[11px] text-[#6B7A87]">{w.witnessRole}</div>
                    </div>
                    {w.signatureHash && (
                      <span className="font-mono text-[10px] text-[#2F8F5B]" title={w.signatureHash}>
                        Sig {String(w.signatureHash).slice(0, 10)}…
                      </span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Bidders Envelope Table */}
        <div className="border border-[#D5E0EA] dark:border-[#1E364A] rounded-[8px] overflow-x-auto">
          <table className="w-full text-left text-[14px] divide-y divide-[#D5E0EA] dark:divide-[#1E364A]">
            <thead className="bg-[#F7FAFD] dark:bg-[#10212E] text-[#6B7A87] font-medium text-[13px]">
              <tr>
                <th className="p-4">Bidder legal name</th>
                <th className="p-4">CIPA / Receipt</th>
                <th className="p-4">Timestamp received</th>
                <th className="p-4">Cryptographic hash</th>
                <th className="p-4 text-right">Price proposal (BWP)</th>
                <th className="p-4">Envelope status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#D5E0EA] dark:divide-[#1E364A] text-[#10212E] dark:text-white">
              {isLoadingBids ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-[#6B7A87]">
                    Loading bid envelopes...
                  </td>
                </tr>
              ) : bids.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-6 text-center text-[#6B7A87]">
                    No bid envelopes recorded for this tender call yet.
                  </td>
                </tr>
              ) : (
                bids.map((b) => (
                  <tr key={b.id} className="hover:bg-[#F7FAFD] dark:hover:bg-[#10212E]">
                    <td className="p-4 font-semibold">{b.supplierName}</td>
                    <td className="p-4 text-[#43525F] dark:text-[#B2C3D2] text-[13px]">
                      <div>{b.cipaNumber || '—'}</div>
                      {b.receiptNumber && <div className="font-mono text-[11px] text-[#6B7A87]">{b.receiptNumber}</div>}
                    </td>
                    <td className="p-4 tabular-nums text-[#43525F] dark:text-[#B2C3D2] text-[13px]">
                      {b.submittedAt ? new Date(b.submittedAt).toLocaleString() : '—'}
                    </td>
                    <td className="p-4 text-[12px] text-[#6B7A87] font-mono truncate max-w-[160px]" title={b.payloadSha256 || ''}>
                      {b.payloadSha256 ? `${String(b.payloadSha256).slice(0, 16)}...` : 'Recorded'}
                    </td>
                    <td className="p-4 text-right font-semibold tabular-nums">
                      {b.status === 'opened' && b.totalPrice != null ? (
                        <span className="text-[#10212E] dark:text-white">
                          {b.currency || 'BWP'} {Number(b.totalPrice).toLocaleString()}
                        </span>
                      ) : b.status === 'withdrawn' ? (
                        <span className="text-[#6B7A87] italic">Withdrawn pre-closing</span>
                      ) : (
                        <span className="text-[#6B7A87] italic">[Cryptographically Sealed]</span>
                      )}
                    </td>
                    <td className="p-4">
                      <span
                        className={`text-[12px] px-2 py-0.5 rounded-[4px] font-medium ${
                          b.status === 'opened'
                            ? 'bg-[#ECFDF5] text-[#2F8F5B]'
                            : b.status === 'withdrawn'
                            ? 'bg-slate-100 text-slate-600'
                            : 'bg-[#FEF2F2] text-[#C2412D]'
                        }`}
                      >
                        {b.status === 'opened' ? 'Unsealed' : b.status === 'withdrawn' ? 'Withdrawn' : 'Sealed & Locked'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Opening Session Modal */}
      {isOpeningSessionOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#10212E]/70 backdrop-blur-xs">
          <div className="w-full max-w-xl bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="space-y-1 pb-3 border-b border-[#D5E0EA] dark:border-[#1E364A]">
              <span className="text-[12px] text-[#1F5F99] font-medium">Official dual-key unsealing protocol</span>
              <h3 className="font-heading font-semibold text-[20px] text-[#10212E] dark:text-white">
                Conduct Bid Opening Ceremony
              </h3>
            </div>

            {isBeforeClosing && (
              <div className="p-3 rounded-[8px] bg-[#FEF2F2] border border-[#FCA5A5] text-[13px] text-[#8E2A1B]">
                Notice: The closing deadline ({selectedCall?.closesAt ? new Date(selectedCall.closesAt).toLocaleString() : 'Not set'}) has not elapsed yet. The server will block unsealing before closing time.
              </div>
            )}

            <p className="text-[14px] text-[#43525F] dark:text-[#B2C3D2] leading-relaxed">
              Unsealing decrypts submitted commercial offers for <strong>{selectedCall?.callNumber}</strong> ({submittedBidsCount} sealed envelope{submittedBidsCount === 1 ? '' : 's'}) and requires a quorum of at least <strong>2 distinct witnesses</strong>.
            </p>

            <form onSubmit={handleStartOpeningSession} className="space-y-4 text-[14px]">
              <div className="space-y-1">
                <label className="font-medium text-[#10212E] dark:text-white block">
                  Presiding procurement officer (Witness #1)
                </label>
                <input
                  type="text"
                  value={officerName}
                  disabled
                  className="w-full p-2.5 bg-[#F7FAFD] dark:bg-[#10212E] border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[#6B7A87]"
                />
              </div>

              {members.length > 0 && (
                <div className="space-y-2">
                  <label className="font-medium text-[#10212E] dark:text-white flex items-center gap-1.5">
                    <Users className="w-4 h-4 text-[#1F5F99]" />
                    <span>Select organization co-witnesses (select at least 1 additional officer)</span>
                  </label>
                  <div className="max-h-40 overflow-y-auto divide-y divide-[#D5E0EA] dark:divide-[#1E364A] border border-[#D5E0EA] dark:border-[#1E364A] rounded-[8px]">
                    {members.map((m) => {
                      const isPresiding = m.userId === currentUser?.id;
                      const checked = effectiveMemberWitnesses.has(m.userId);
                      return (
                        <label
                          key={m.userId}
                          className={`flex items-center justify-between p-2.5 text-[13px] ${isPresiding ? 'bg-[#EAF2FA]/60 dark:bg-[#1E364A]/40' : 'cursor-pointer hover:bg-[#F7FAFD] dark:hover:bg-[#10212E]'}`}
                        >
                          <div className="flex items-center gap-2.5">
                            <input
                              type="checkbox"
                              checked={checked}
                              disabled={isPresiding}
                              onChange={() => toggleMemberWitness(m.userId)}
                            />
                            <span className="font-medium text-[#10212E] dark:text-white">
                              {m.fullName} {isPresiding ? '(Presiding)' : ''}
                            </span>
                          </div>
                          <span className="text-[11px] font-mono text-[#6B7A87]">{m.roleName}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-medium text-[#10212E] dark:text-white text-[13px]">
                    External / committee co-witnesses {members.length < 2 ? '(Required if <2 internal members)' : '(Optional)'}
                  </label>
                  <button
                    type="button"
                    onClick={() => setExternalWitnesses((prev) => [...prev, { name: '', witnessRole: 'External Witness' }])}
                    className="text-xs font-semibold text-[#1F5F99] hover:underline inline-flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Add external witness</span>
                  </button>
                </div>

                {externalWitnesses.map((ew, idx) => (
                  <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                    <input
                      type="text"
                      placeholder="Full Name"
                      value={ew.name}
                      onChange={(e) =>
                        setExternalWitnesses((prev) =>
                          prev.map((row, i) => (i === idx ? { ...row, name: e.target.value } : row))
                        )
                      }
                      className="col-span-6 p-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[13px]"
                    />
                    <input
                      type="text"
                      placeholder="Designation / Role"
                      value={ew.witnessRole}
                      onChange={(e) =>
                        setExternalWitnesses((prev) =>
                          prev.map((row, i) => (i === idx ? { ...row, witnessRole: e.target.value } : row))
                        )
                      }
                      className="col-span-5 p-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[13px]"
                    />
                    <button
                      type="button"
                      onClick={() => setExternalWitnesses((prev) => prev.filter((_, i) => i !== idx))}
                      className="col-span-1 p-1.5 text-[#C2412D] hover:bg-rose-50 rounded cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              <div className={`p-3 rounded-[8px] text-[12px] ${quorumSatisfied ? 'bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0]' : 'bg-[#FFFBEB] text-[#92400E] border border-[#FDE68A]'}`}>
                {quorumSatisfied
                  ? 'Quorum verified: 2 or more distinct witnesses selected.'
                  : 'Quorum pending: select at least 2 distinct witnesses to authorize unsealing.'}
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#D5E0EA] dark:border-[#1E364A]">
                <button
                  type="button"
                  onClick={() => setIsOpeningSessionOpen(false)}
                  className="px-4 py-2 text-[14px] text-[#43525F] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingOpening || !quorumSatisfied}
                  className="px-4 py-2 bg-[#1F5F99] hover:bg-[#184c7a] disabled:opacity-50 text-white text-[14px] font-medium rounded-[6px] cursor-pointer"
                >
                  {isSubmittingOpening ? 'Unsealing...' : 'Unseal bids & log opening'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
