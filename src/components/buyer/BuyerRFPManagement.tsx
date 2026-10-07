import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Clarification, Call } from '../../mockData';
import { StatusChip } from '../common/StatusChip';
import {
  Lock,
  Unlock,
  HelpCircle,
  FilePlus,
  Send,
  Calendar,
  Clock,
  CheckCircle2,
  FileText,
  AlertCircle,
  ShieldCheck,
  Download,
  Key,
} from 'lucide-react';

export const BuyerRFPManagement: React.FC = () => {
  const { calls, clarifications, publishClarificationAnswer, applications } = useApp();
  const [selectedCallId, setSelectedCallId] = useState<string>(calls[0]?.id || '');
  const [activeTab, setActiveTab] = useState<'clarifications' | 'addenda' | 'sealed_bids'>('sealed_bids');

  // Answer state
  const [replyingClarId, setReplyingClarId] = useState<string | null>(null);
  const [answerText, setAnswerText] = useState('');

  // Addendum creation state
  const [isCreatingAddendum, setIsCreatingAddendum] = useState(false);
  const [addendumTitle, setAddendumTitle] = useState('');
  const [addendumSummary, setAddendumSummary] = useState('');

  // Simulated Tender Opening Ceremony State
  const [isUnlockedForCeremony, setIsUnlockedForCeremony] = useState(false);
  const [ceremonyOfficer, setCeremonyOfficer] = useState('K. Tau (Lead Procurement Specialist)');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const selectedCall = calls.find((c) => c.id === selectedCallId) || calls[0];
  const callClarifications = clarifications.filter((c) => c.callId === selectedCall?.id);
  const callApplications = applications.filter((a) => a.callId === selectedCall?.id && a.bid);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4500);
  };

  const handlePublishAnswer = (clarId: string) => {
    if (!answerText.trim()) return;
    publishClarificationAnswer(clarId, answerText.trim(), 'K. Tau (Lead Procurement Specialist)');
    setReplyingClarId(null);
    setAnswerText('');
    showToast('Clarification answer published officially to public tender board.');
  };

  const handleAddAddendum = (e: React.FormEvent) => {
    e.preventDefault();
    if (!addendumTitle.trim()) return;
    selectedCall.addenda.push({
      id: `add-${Date.now()}`,
      number: selectedCall.addenda.length + 1,
      title: addendumTitle.trim(),
      issuedDate: new Date().toISOString().substring(0, 10),
      summary: addendumSummary.trim(),
      downloadUrl: '#',
    });
    setIsCreatingAddendum(false);
    setAddendumTitle('');
    setAddendumSummary('');
    showToast('Addendum issued and dispatched to all participating bidders.');
  };

  return (
    <div className="space-y-8 max-w-7xl mx-auto">
      {/* Toast */}
      {toastMessage && (
        <div className="p-4 bg-emerald-50 dark:bg-emerald-950/40 text-[#2F8F5B] dark:text-emerald-300 border border-emerald-300 dark:border-emerald-800 rounded-xl text-xs flex items-center gap-2 shadow-xs">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{toastMessage}</span>
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
            Oversee sealed tender packages, answer bidder questions with formal audit trails, and manage addenda.
          </p>
        </div>

        {/* Call Selector */}
        <div>
          <select
            value={selectedCallId}
            onChange={(e) => {
              setSelectedCallId(e.target.value);
              setIsUnlockedForCeremony(false);
            }}
            className="p-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs font-semibold text-slate-800 dark:text-white"
          >
            {calls.map((c) => (
              <option key={c.id} value={c.id}>
                {c.callNumber} — {c.title.substring(0, 35)}...
              </option>
            ))}
          </select>
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
          {/* Lock Status Card */}
          <div
            className={`p-6 sm:p-8 rounded-2xl border text-white transition-all ${
              isUnlockedForCeremony
                ? 'bg-gradient-to-r from-emerald-900 via-slate-900 to-slate-900 border-emerald-700'
                : 'bg-gradient-to-r from-[#10212E] via-slate-900 to-[#10212E] border-slate-700'
            }`}
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="space-y-2 max-w-2xl">
                <div className="flex items-center gap-2">
                  {isUnlockedForCeremony ? (
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
                  {isUnlockedForCeremony
                    ? 'The tender box has been unsealed by the statutory procurement committee. Financial line item offers are now decrypted for evaluation.'
                    : `In compliance with Botswana procurement laws, bidder pricing remains sealed and hidden from all council officers until closing time: ${selectedCall.closingDate} at ${selectedCall.closingTimeCAT}.`}
                </p>
              </div>

              {/* Action / Countdown */}
              <div className="p-5 bg-white/10 rounded-2xl backdrop-blur-xs border border-white/10 text-center space-y-3 shrink-0">
                <div className="text-xs text-slate-300 font-mono">
                  {isUnlockedForCeremony ? 'Ceremony Executed By:' : 'Statutory Closing Countdown:'}
                </div>
                {isUnlockedForCeremony ? (
                  <div className="font-bold text-sm text-[#2F8F5B] font-mono">
                    {ceremonyOfficer}
                  </div>
                ) : (
                  <div className="text-2xl font-bold font-mono text-[#E8A33D] tabular-nums">
                    {selectedCall.daysRemaining} Days Remaining
                  </div>
                )}

                {!isUnlockedForCeremony ? (
                  <button
                    onClick={() => {
                      setIsUnlockedForCeremony(true);
                      showToast('Tender Opening Ceremony simulated. Bids unsealed for committee review.');
                    }}
                    className="w-full px-4 py-2 bg-[#E8A33D] hover:bg-amber-600 text-slate-950 font-bold text-xs rounded-xl flex items-center justify-center gap-2 transition-colors shadow-xs"
                  >
                    <Key className="w-4 h-4" />
                    <span>Execute Opening Ceremony</span>
                  </button>
                ) : (
                  <button
                    onClick={() => setIsUnlockedForCeremony(false)}
                    className="w-full px-3 py-1.5 bg-white/10 text-slate-300 hover:text-white text-xs rounded-lg"
                  >
                    Lock Vault Again
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Bids List Table */}
          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-2xs space-y-4 p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-heading font-semibold text-base text-[#10212E]">
                  Submitted Bid Envelopes ({callApplications.length})
                </h3>
                <p className="text-xs text-slate-500">
                  {isUnlockedForCeremony
                    ? 'Decrypted itemized financial proposals and technical attachments.'
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
                  {callApplications.map((app) => (
                    <tr key={app.id} className="hover:bg-slate-50">
                      <td className="py-3 px-3">
                        <div className="font-bold text-[#10212E]">{app.supplierName}</div>
                        <span className="text-[11px] text-slate-400 font-mono">App Ref: {app.id}</span>
                      </td>

                      <td className="py-3 px-3 font-mono text-slate-500 truncate max-w-xs">
                        {app.bid?.sealedHash}
                      </td>

                      <td className="py-3 px-3 text-slate-600 font-mono">
                        {app.submittedAt}
                      </td>

                      <td className="py-3 px-3 text-right font-mono font-bold">
                        {isUnlockedForCeremony && app.bid ? (
                          <span className="text-base text-[#1F5F99]">
                            BWP {app.bid.totalAmountBWP.toLocaleString()}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-slate-400 font-medium">
                            <Lock className="w-3.5 h-3.5 text-[#E8A33D]" /> Sealed
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-right">
                        <StatusChip status={app.status} />
                      </td>
                    </tr>
                  ))}
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
                        {clar.isPublished ? 'Published to Bidders' : 'Pending Response'}
                      </span>
                    </div>

                    {clar.isPublished ? (
                      <div className="p-3 bg-slate-50 border-l-2 border-[#1F5F99] rounded-r-lg space-y-1 text-xs">
                        <span className="font-bold text-[#1F5F99] block">
                          OFFICIAL RESPONSE ({clar.answeredBy})
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
                                onClick={() => setReplyingClarId(null)}
                                className="px-3 py-1.5 text-xs text-slate-600"
                              >
                                Cancel
                              </button>
                              <button
                                onClick={() => handlePublishAnswer(clar.id)}
                                className="px-4 py-1.5 bg-[#1F5F99] text-white text-xs font-semibold rounded-lg hover:bg-[#184a77]"
                              >
                                Publish Response
                              </button>
                            </div>
                          </div>
                        ) : (
                          <button
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
                    placeholder="e.g. Addendum No. 2: Revised Staging Schedule & Technical Specs"
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
                    className="px-4 py-1.5 bg-[#1F5F99] text-white font-semibold rounded-lg hover:bg-[#184a77]"
                  >
                    Publish Addendum
                  </button>
                </div>
              </form>
            )}

            <div className="space-y-3">
              {selectedCall.addenda.map((add) => (
                <div key={add.id} className="p-4 border border-slate-200 rounded-xl bg-white flex items-start justify-between gap-4 text-xs">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#10212E]">{add.title}</span>
                      <span className="text-slate-400 font-mono">Issued {add.issuedDate}</span>
                    </div>
                    <p className="text-slate-600 leading-relaxed">{add.summary}</p>
                  </div>
                  <button
                    onClick={() => showToast(`Downloaded ${add.title}`)}
                    className="px-3 py-1.5 bg-[#EAF2FA] text-[#1F5F99] rounded-lg font-semibold shrink-0"
                  >
                    Download PDF
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
