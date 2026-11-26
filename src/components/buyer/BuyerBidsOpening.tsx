import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { buyerApi } from '../../services/api';
import { Lock, Unlock, CheckCircle2, AlertCircle } from 'lucide-react';

export const BuyerBidsOpening: React.FC = () => {
  const { calls, buyerSubRole, addAuditEvent, registeredBuyerOrgName, profileSummary, currentUser } = useApp();

  const sealedCalls = calls.filter((c) => c.type === 'RFP');
  const [selectedCallId, setSelectedCallId] = useState<string>(sealedCalls[0]?.id || '');
  const [isOpeningSessionOpen, setIsOpeningSessionOpen] = useState(false);
  const [witnesses, setWitnesses] = useState<string>('');
  const [bids, setBids] = useState<any[]>([]);
  const [isLoadingBids, setIsLoadingBids] = useState(false);
  const [isSubmittingOpening, setIsSubmittingOpening] = useState(false);
  const [openingSuccess, setOpeningSuccess] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const selectedCall = calls.find((c) => c.id === selectedCallId) || sealedCalls[0];
  const officerName = currentUser?.fullName || profileSummary?.displayName || 'Procurement Officer';
  const orgName = profileSummary?.supplierOrOrgName || registeredBuyerOrgName || 'Procuring Organization';

  const loadBids = useCallback(async (callId: string) => {
    if (!callId) {
      setBids([]);
      return;
    }
    setIsLoadingBids(true);
    try {
      const list = await buyerApi.listBids(callId);
      setBids(Array.isArray(list) ? list : []);
    } catch {
      setBids([]);
    } finally {
      setIsLoadingBids(false);
    }
  }, []);

  useEffect(() => {
    if (selectedCall?.id) {
      loadBids(selectedCall.id);
    }
  }, [selectedCall?.id, loadBids]);

  const isOpened = bids.length > 0 && bids.some((b) => b.status === 'opened');
  const hasOpeningPermission = buyerSubRole === 'Org admin' || buyerSubRole === 'Procurement officer';
  const urgentSealedCallsCount = sealedCalls.filter((c) => c.status === 'Open' && c.daysRemaining <= 3).length;

  const handleStartOpeningSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCall || isSubmittingOpening) return;

    setIsSubmittingOpening(true);
    setErrorMsg(null);
    try {
      const witnessEntries = witnesses
        .split(',')
        .map((w) => w.trim())
        .filter(Boolean)
        .map((w) => ({ name: w, witnessRole: 'Witness' }));

      await buyerApi.conductOpeningSession(selectedCall.id, witnessEntries.length ? witnessEntries : undefined);
      await loadBids(selectedCall.id);
      setIsOpeningSessionOpen(false);
      setOpeningSuccess(true);

      addAuditEvent({
        action: 'Sealed Bid Opening Session Executed',
        actorName: officerName,
        actorRole: 'Procurement Officer',
        organizationName: orgName,
        entityType: 'Call',
        entityId: selectedCall.callNumber,
        details: `Formal unsealing session conducted for ${selectedCall.callNumber} (${selectedCall.title}). Recorded witnesses: ${witnesses}.`,
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
            Statutory sealed-bid protocol under the Public Procurement Act. Price proposals remain cryptographically sealed until an authorized opening session.
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
                : `${sealedCalls.length} sealed tender${sealedCalls.length === 1 ? '' : 's'} tracked in vault`}
            </h2>
            <p className="text-[15px] text-[#43525F] dark:text-[#B2C3D2]">
              Bids stay sealed until an authorised opening session is held after the closing time. Bids never open automatically.
            </p>
          </div>
        </div>
      </div>

      {openingSuccess && (
        <div className="p-4 bg-[#ECFDF5] border border-[#A7F3D0] rounded-[12px] text-[#065F46] text-[14px] flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-[#2F8F5B]" />
          <span>
            Opening session executed successfully. Bids have been unsealed, witness register committed to audit log, and financial proposals are now visible to the evaluation committee.
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
              onChange={(e) => setSelectedCallId(e.target.value)}
              className="p-2.5 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] bg-[#F7FAFD] dark:bg-[#10212E] text-[14px] font-semibold text-[#10212E] dark:text-white"
            >
              {sealedCalls.length === 0 && <option value="">No sealed RFPs found</option>}
              {sealedCalls.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.callNumber} — {c.title}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3">
            {isOpened ? (
              <span className="bg-[#ECFDF5] text-[#2F8F5B] px-3 py-1.5 rounded-[6px] text-[13px] font-semibold flex items-center gap-1.5">
                <Unlock className="w-4 h-4" />
                <span>Envelopes unsealed & logged</span>
              </span>
            ) : (
              <span className="bg-[#FEF2F2] text-[#C2412D] px-3 py-1.5 rounded-[6px] text-[13px] font-semibold flex items-center gap-1.5">
                <Lock className="w-4 h-4" />
                <span>Sealed (Locked prior to session)</span>
              </span>
            )}

            {!isOpened && hasOpeningPermission && bids.length > 0 && (
              <button
                type="button"
                onClick={() => setIsOpeningSessionOpen(true)}
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

        {/* Bidders Envelope Table */}
        <div className="border border-[#D5E0EA] dark:border-[#1E364A] rounded-[8px] overflow-hidden">
          <table className="w-full text-left text-[14px] divide-y divide-[#D5E0EA] dark:divide-[#1E364A]">
            <thead className="bg-[#F7FAFD] dark:bg-[#10212E] text-[#6B7A87] font-medium text-[13px]">
              <tr>
                <th className="p-4">Bidder legal name</th>
                <th className="p-4">CIPA number</th>
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
                    No sealed bid envelopes submitted for this tender call yet.
                  </td>
                </tr>
              ) : (
                bids.map((b) => (
                  <tr key={b.id} className="hover:bg-[#F7FAFD] dark:hover:bg-[#10212E]">
                    <td className="p-4 font-semibold">{b.supplierName}</td>
                    <td className="p-4 text-[#43525F] dark:text-[#B2C3D2] font-sans">{b.cipaNumber || '—'}</td>
                    <td className="p-4 tabular-nums text-[#43525F] dark:text-[#B2C3D2] text-[13px]">
                      {b.submittedAt ? new Date(b.submittedAt).toLocaleString() : '—'}
                    </td>
                    <td className="p-4 text-[12px] text-[#6B7A87] font-sans truncate max-w-[140px]" title={b.payloadSha256 || ''}>
                      {b.payloadSha256 ? `${String(b.payloadSha256).slice(0, 16)}...` : 'Recorded'}
                    </td>
                    <td className="p-4 text-right font-semibold tabular-nums">
                      {b.status === 'opened' && b.totalPrice != null ? (
                        <span className="text-[#10212E] dark:text-white">
                          {b.currency || 'BWP'} {Number(b.totalPrice).toLocaleString()}
                        </span>
                      ) : (
                        <span className="text-[#6B7A87] italic">
                          [Asymmetrically Sealed]
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      <span
                        className={`text-[12px] px-2 py-0.5 rounded-[4px] font-medium ${
                          b.status === 'opened'
                            ? 'bg-[#ECFDF5] text-[#2F8F5B]'
                            : 'bg-[#FEF2F2] text-[#C2412D]'
                        }`}
                      >
                        {b.status === 'opened' ? 'Unsealed' : 'Sealed & Locked'}
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
          <div className="w-full max-w-lg bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 space-y-5">
            <div className="space-y-1 pb-3 border-b border-[#D5E0EA] dark:border-[#1E364A]">
              <span className="text-[12px] text-[#1F5F99] font-medium">Official unsealing protocol</span>
              <h3 className="font-heading font-semibold text-[20px] text-[#10212E] dark:text-white">
                Start formal bid opening session
              </h3>
            </div>

            <p className="text-[14px] text-[#43525F] dark:text-[#B2C3D2] leading-relaxed">
              Executing this session decrypts the sealed financial proposals submitted for <strong>{selectedCall?.callNumber}</strong>. Official opening witnesses must be recorded in the audit log.
            </p>

            <form onSubmit={handleStartOpeningSession} className="space-y-4 text-[14px]">
              <div className="space-y-1">
                <label className="font-medium text-[#10212E] dark:text-white block">
                  Presiding procurement officer
                </label>
                <input
                  type="text"
                  value={officerName}
                  disabled
                  className="w-full p-2.5 bg-[#F7FAFD] dark:bg-[#10212E] border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[#6B7A87]"
                />
              </div>

              <div className="space-y-1">
                <label className="font-medium text-[#10212E] dark:text-white block">
                  Witnesses present (Names & Designations) *
                </label>
                <textarea
                  rows={2}
                  value={witnesses}
                  onChange={(e) => setWitnesses(e.target.value)}
                  className="w-full p-2.5 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px]"
                  required
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#D5E0EA] dark:border-[#1E364A]">
                <button
                  type="button"
                  onClick={() => setIsOpeningSessionOpen(false)}
                  className="px-4 py-2 text-[14px] text-[#43525F]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingOpening}
                  className="px-4 py-2 bg-[#1F5F99] hover:bg-[#184c7a] disabled:opacity-50 text-white text-[14px] font-medium rounded-[6px]"
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
