import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Application } from '../../mockData';
import { StatusChip } from '../common/StatusChip';
import {
  FileText,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Send,
  Building2,
  Calendar,
  Lock,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Check,
  Plus,
  MessageSquare,
  AlertCircle,
  HelpCircle,
  ChevronRight,
  ExternalLink,
  XCircle,
  Download,
  Info,
} from 'lucide-react';

interface SupplierApplicationsListProps {
  onNewApplication: () => void;
  onNavigateToCall?: (callId: string) => void;
}

type TabType = 'DRAFTS' | 'SUBMITTED' | 'DECISIONS';

export const SupplierApplicationsList: React.FC<SupplierApplicationsListProps> = ({
  onNewApplication,
  onNavigateToCall,
}) => {
  const {
    applications,
    documents,
    supplier,
    respondToInformationRequest,
    withdrawApplication,
    setSelectedCallId,
    setActiveNav,
  } = useApp();

  const [activeTab, setActiveTab] = useState<TabType>('SUBMITTED');
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);

  // Detail page reply state
  const [replyMessage, setReplyMessage] = useState('');
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [replySuccessMessage, setReplySuccessMessage] = useState<string | null>(null);

  // Withdraw state
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [withdrawReason, setWithdrawReason] = useState('');

  // Filter supplier's applications
  const supplierApps = applications.filter((a) => a.supplierId === supplier.id);

  // Tab categorization:
  // Drafts: status === 'Draft'
  // Submitted: status === 'Submitted' || status === 'Under review' || status === 'More information requested'
  // Decisions: status === 'Approved' || status === 'Rejected' || status === 'Withdrawn'
  const draftApps = supplierApps.filter((a) => a.status === 'Draft');
  const submittedApps = supplierApps.filter(
    (a) =>
      a.status === 'Submitted' ||
      a.status === 'Under review' ||
      a.status === 'More information requested'
  );
  const decisionApps = supplierApps.filter(
    (a) => a.status === 'Approved' || a.status === 'Rejected' || a.status === 'Withdrawn'
  );

  const displayedApps =
    activeTab === 'DRAFTS'
      ? draftApps
      : activeTab === 'SUBMITTED'
      ? submittedApps
      : decisionApps;

  const selectedApp = supplierApps.find((a) => a.id === selectedAppId);

  // Handle Response submission
  const handleSendResponse = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedApp || !replyMessage.trim()) return;

    setIsSubmittingReply(true);
    respondToInformationRequest(selectedApp.id, replyMessage.trim());

    setTimeout(() => {
      setIsSubmittingReply(false);
      setReplyMessage('');
      setReplySuccessMessage('Clarification submitted successfully. Status updated to Under review.');
      setTimeout(() => setReplySuccessMessage(null), 5000);
    }, 400);
  };

  // Handle Withdrawal
  const handleConfirmWithdraw = () => {
    if (!selectedApp) return;
    withdrawApplication(selectedApp.id, withdrawReason.trim() || 'Withdrawn by supplier.');
    setIsWithdrawModalOpen(false);
    setWithdrawReason('');
  };

  // Helper to determine next-step action label and handler
  const getNextStepAction = (app: Application) => {
    if (app.status === 'Draft') {
      return {
        label: 'Resume application',
        primary: true,
        action: () => {
          setSelectedCallId(app.callId);
          setActiveNav('apply');
        },
      };
    }

    if (app.status === 'More information requested') {
      return {
        label: 'Respond to request',
        primary: true,
        action: () => {
          setSelectedAppId(app.id);
        },
      };
    }

    if (app.status === 'Approved') {
      return {
        label: 'View decision note',
        primary: false,
        action: () => {
          setSelectedAppId(app.id);
        },
      };
    }

    if (app.status === 'Rejected') {
      return {
        label: 'Inspect decision note',
        primary: false,
        action: () => {
          setSelectedAppId(app.id);
        },
      };
    }

    return {
      label: 'View details',
      primary: false,
      action: () => {
        setSelectedAppId(app.id);
      },
    };
  };

  // --------------------------------------------------------------------------
  // DETAIL VIEW
  // --------------------------------------------------------------------------
  if (selectedApp) {
    const isInfoPending =
      selectedApp.status === 'More information requested' &&
      selectedApp.informationRequest?.status === 'Pending response';

    // Status timeline milestones definitions
    const stagesOrdered: Application['status'][] = [
      'Submitted',
      'Under review',
      'More information requested',
      selectedApp.status === 'Rejected' ? 'Rejected' : 'Approved',
    ];

    const currentStageIndex =
      selectedApp.status === 'Draft'
        ? -1
        : selectedApp.status === 'Submitted'
        ? 0
        : selectedApp.status === 'Under review'
        ? 1
        : selectedApp.status === 'More information requested'
        ? 2
        : 3;

    return (
      <div className="space-y-8">
        {/* Back button and Header */}
        <div className="space-y-4">
          <button
            type="button"
            onClick={() => {
              setSelectedAppId(null);
              setReplySuccessMessage(null);
            }}
            className="inline-flex items-center gap-2 text-[14px] font-medium text-[#1F5F99] dark:text-[#6FAEE0] hover:underline cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to applications list</span>
          </button>

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-[#D5E0EA] dark:border-[#1E364A]">
            <div className="space-y-1.5 max-w-3xl">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-[14px] text-[#1F5F99] dark:text-[#6FAEE0]">
                  {selectedApp.callNumber}
                </span>
                <span className="text-[14px] text-[#6B7A87]">· {selectedApp.organizationName}</span>
                <span className="text-[14px] bg-[#F7FAFD] dark:bg-[#10212E] border border-[#D5E0EA] dark:border-[#1E364A] text-[#10212E] dark:text-white px-2.5 py-0.5 rounded-[4px] font-medium">
                  {selectedApp.callType}
                </span>
                <StatusChip status={selectedApp.status} />
              </div>

              <h1 className="font-heading font-semibold text-[26px] sm:text-[30px] leading-tight text-[#10212E] dark:text-white">
                {selectedApp.callTitle}
              </h1>

              <div className="text-[14px] text-[#6B7A87] flex items-center gap-3 flex-wrap">
                <span>Submitted on {selectedApp.submittedAt}</span>
                {selectedApp.receiptNumber && (
                  <>
                    <span>·</span>
                    <span>Receipt: <strong className="text-[#10212E] dark:text-white font-medium">{selectedApp.receiptNumber}</strong></span>
                  </>
                )}
                {selectedApp.bid && (
                  <>
                    <span>·</span>
                    <span className="font-semibold text-[#10212E] dark:text-white tabular-nums">
                      Tender offer: BWP {selectedApp.bid.totalAmountBWP.toLocaleString()}
                    </span>
                    {selectedApp.bid.isSealed && (
                      <span className="bg-[#EAF2FA] text-[#1F5F99] dark:bg-[#1E364A] dark:text-[#6FAEE0] px-2 py-0.5 rounded-[4px] text-[14px] font-medium inline-flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        <span>Cryptographically sealed</span>
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="flex items-center gap-3 shrink-0">
              {/* If under review or submitted, allow withdrawal */}
              {(selectedApp.status === 'Submitted' ||
                selectedApp.status === 'Under review' ||
                selectedApp.status === 'More information requested') && (
                <button
                  type="button"
                  onClick={() => setIsWithdrawModalOpen(true)}
                  className="px-4 py-2.5 border border-[#EF4444]/40 text-[#DC2626] hover:bg-[#FEF2F2] dark:hover:bg-[#451A1A] rounded-[6px] text-[14px] font-medium transition-colors cursor-pointer"
                >
                  Withdraw application
                </button>
              )}

              {selectedApp.status === 'Draft' && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedCallId(selectedApp.callId);
                    setActiveNav('apply');
                  }}
                  className="px-5 py-2.5 bg-[#1F5F99] hover:bg-[#184c7a] text-white rounded-[6px] text-[14px] font-medium transition-colors cursor-pointer"
                >
                  Resume application
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Success Toast */}
        {replySuccessMessage && (
          <div className="p-4 rounded-[12px] bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0] flex items-center justify-between gap-3 text-[14px]">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-[#2F8F5B] shrink-0" />
              <span>{replySuccessMessage}</span>
            </div>
            <button
              type="button"
              onClick={() => setReplySuccessMessage(null)}
              className="text-[#065F46] hover:opacity-75 text-[14px] cursor-pointer"
            >
              ✕
            </button>
          </div>
        )}

        {/* 1. Status Timeline (Submitted, Under review, More information requested, Approved or Rejected) */}
        <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <h2 className="font-heading font-semibold text-[18px] text-[#10212E] dark:text-white">
                Application status timeline
              </h2>
              <p className="text-[14px] text-[#6B7A87]">
                Milestone tracking across procurement committee review stages
              </p>
            </div>
          </div>

          {/* Stepper Bar for 4 Milestones */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 pt-2">
            {[
              {
                stage: 'Submitted' as const,
                title: 'Submitted',
                desc: 'Proposal sealed and receipt issued',
              },
              {
                stage: 'Under review' as const,
                title: 'Under review',
                desc: 'Technical & compliance vetting',
              },
              {
                stage: 'More information requested' as const,
                title: 'More info requested',
                desc: 'Clarification query opened',
              },
              {
                stage: selectedApp.status === 'Rejected' ? ('Rejected' as const) : ('Approved' as const),
                title: selectedApp.status === 'Rejected' ? 'Rejected' : 'Approved',
                desc: selectedApp.status === 'Rejected' ? 'Formal decision note issued' : 'Admitted or recommended for award',
              },
            ].map((step, idx) => {
              const isPast = idx < currentStageIndex;
              const isCurrent = idx === currentStageIndex;
              const isFuture = idx > currentStageIndex;

              return (
                <div
                  key={step.stage}
                  className={`p-4 rounded-[10px] border transition-all ${
                    isCurrent
                      ? 'border-[#1F5F99] bg-[#EAF2FA]/50 dark:bg-[#1E364A]/50 ring-1 ring-[#1F5F99]/20'
                      : isPast
                      ? 'border-[#D5E0EA] dark:border-[#1E364A] bg-[#F7FAFD]/70 dark:bg-[#10212E]/70'
                      : 'border-[#D5E0EA]/60 dark:border-[#1E364A]/60 bg-transparent opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <span
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-[14px] font-semibold ${
                        isCurrent
                          ? 'bg-[#1F5F99] text-white'
                          : isPast
                          ? 'bg-[#2F8F5B] text-white'
                          : 'bg-[#D5E0EA] dark:bg-[#1E364A] text-[#6B7A87]'
                      }`}
                    >
                      {isPast ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                    </span>
                    <span
                      className={`text-[14px] font-semibold ${
                        isCurrent
                          ? 'text-[#1F5F99] dark:text-[#6FAEE0]'
                          : isPast
                          ? 'text-[#10212E] dark:text-white'
                          : 'text-[#6B7A87]'
                      }`}
                    >
                      {step.title}
                    </span>
                  </div>
                  <p className="text-[14px] text-[#6B7A87] leading-tight">
                    {step.desc}
                  </p>
                </div>
              );
            })}
          </div>

          {/* Historical timeline events */}
          <div className="pt-4 border-t border-[#D5E0EA] dark:border-[#1E364A] space-y-3">
            <span className="text-[14px] font-semibold text-[#10212E] dark:text-white block">
              Event history
            </span>
            <div className="relative pl-6 space-y-3 border-l-2 border-[#D5E0EA] dark:border-[#1E364A] ml-2">
              {selectedApp.timeline.map((item, idx) => (
                <div key={idx} className="relative">
                  <div className="absolute -left-[31px] top-1 w-3.5 h-3.5 rounded-full bg-[#1F5F99] border-2 border-white dark:border-[#132635]" />
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-[14px] text-[#10212E] dark:text-white">
                        {item.stage}
                      </span>
                      <span className="text-[14px] text-[#6B7A87] tabular-nums">
                        {item.timestamp}
                      </span>
                    </div>
                    {item.note && (
                      <p className="text-[14px] text-[#43525F] dark:text-[#B2C3D2] bg-[#F7FAFD] dark:bg-[#10212E] p-3 rounded-[6px] border border-[#D5E0EA] dark:border-[#1E364A]">
                        {item.note}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 2. Information Request with Due Date and Response Box (if applicable) */}
        {selectedApp.informationRequest && (
          <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D97706]/40 dark:border-[#D97706]/30 overflow-hidden">
            <div className="bg-[#FFFBEB] dark:bg-[#92400E]/20 p-5 border-b border-[#FDE68A] dark:border-[#92400E]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-[#D97706] shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <h3 className="font-heading font-semibold text-[17px] text-[#92400E] dark:text-[#FCD34D]">
                    Clarification request from procurement committee
                  </h3>
                  <p className="text-[14px] text-[#92400E] dark:text-[#FCD34D]">
                    Requested by {selectedApp.informationRequest.requestedBy} on {selectedApp.informationRequest.requestedAt}
                  </p>
                </div>
              </div>

              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-[6px] bg-[#FEF3C7] text-[#92400E] border border-[#FDE68A] text-[14px] font-semibold shrink-0">
                <Clock className="w-4 h-4" />
                <span>Response due by: {selectedApp.informationRequest.dueDate}</span>
              </div>
            </div>

            <div className="p-6 space-y-6">
              <div className="space-y-2">
                <span className="text-[14px] font-semibold text-[#10212E] dark:text-white block">
                  Question / clarification details
                </span>
                <div className="p-4 rounded-[8px] bg-[#F7FAFD] dark:bg-[#10212E] border border-[#D5E0EA] dark:border-[#1E364A] text-[14px] text-[#10212E] dark:text-white leading-relaxed">
                  {selectedApp.informationRequest.message}
                </div>
              </div>

              {/* If already responded */}
              {selectedApp.informationRequest.status === 'Responded' && (
                <div className="p-4 rounded-[8px] bg-[#ECFDF5] border border-[#A7F3D0] space-y-2">
                  <div className="flex items-center gap-2 text-[#065F46] font-semibold text-[14px]">
                    <CheckCircle2 className="w-4 h-4 text-[#2F8F5B]" />
                    <span>Your response submitted on {selectedApp.informationRequest.respondedAt}</span>
                  </div>
                  <p className="text-[14px] text-[#065F46] leading-relaxed">
                    "{selectedApp.informationRequest.responseMessage}"
                  </p>
                </div>
              )}

              {/* If response box is active */}
              {isInfoPending && (
                <form onSubmit={handleSendResponse} className="space-y-3">
                  <label className="text-[14px] font-semibold text-[#10212E] dark:text-white block">
                    Your clarification response
                  </label>
                  <textarea
                    rows={4}
                    value={replyMessage}
                    onChange={(e) => setReplyMessage(e.target.value)}
                    required
                    placeholder="Enter your official clarification response, warranty confirmations, or logistical schedule..."
                    className="w-full p-3.5 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[8px] bg-white dark:bg-[#132635] text-[14px] text-[#10212E] dark:text-white placeholder:text-[#6B7A87] focus:outline-none focus:border-[#1F5F99]"
                  />
                  <div className="flex items-center justify-between gap-4 pt-1">
                    <span className="text-[14px] text-[#6B7A87]">
                      Submitting updates your application status back to "Under review"
                    </span>
                    <button
                      type="submit"
                      disabled={isSubmittingReply || !replyMessage.trim()}
                      className="px-5 py-2.5 bg-[#1F5F99] hover:bg-[#184c7a] disabled:opacity-50 text-white rounded-[6px] text-[14px] font-medium inline-flex items-center gap-2 cursor-pointer transition-colors shrink-0"
                    >
                      <Send className="w-4 h-4" />
                      <span>{isSubmittingReply ? 'Submitting...' : 'Submit response'}</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        )}

        {/* 3. Decision Note (Approved or Rejected) */}
        {selectedApp.decisionNote && (
          <div
            className={`rounded-[12px] border p-6 space-y-3 ${
              selectedApp.status === 'Approved'
                ? 'bg-[#ECFDF5]/50 border-[#A7F3D0] dark:bg-[#064E3B]/20 dark:border-[#065F46]'
                : 'bg-[#FEF2F2]/50 border-[#FECACA] dark:bg-[#451A1A]/20 dark:border-[#991B1B]'
            }`}
          >
            <div className="flex items-center gap-2.5">
              {selectedApp.status === 'Approved' ? (
                <CheckCircle2 className="w-5 h-5 text-[#2F8F5B] shrink-0" />
              ) : (
                <XCircle className="w-5 h-5 text-[#DC2626] shrink-0" />
              )}
              <h3 className="font-heading font-semibold text-[18px] text-[#10212E] dark:text-white">
                {selectedApp.status === 'Approved' ? 'Official decision note: Approved' : 'Official decision note: Disqualified / Rejected'}
              </h3>
            </div>

            <p className="text-[14px] text-[#10212E] dark:text-white leading-relaxed">
              {selectedApp.decisionNote}
            </p>

            <div className="pt-2 text-[14px] text-[#6B7A87] flex items-center gap-3">
              <span>Reviewed by: <strong className="text-[#10212E] dark:text-white font-medium">{selectedApp.reviewedBy}</strong></span>
              {selectedApp.decisionDate && (
                <>
                  <span>·</span>
                  <span>Date: {selectedApp.decisionDate}</span>
                </>
              )}
            </div>
          </div>
        )}

        {/* 4. Reviewer Messages */}
        <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 space-y-4">
          <div className="flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-[#1F5F99]" />
            <h3 className="font-heading font-semibold text-[18px] text-[#10212E] dark:text-white">
              Reviewer messages & official correspondence
            </h3>
          </div>

          {selectedApp.reviewerMessages && selectedApp.reviewerMessages.length > 0 ? (
            <div className="space-y-3">
              {selectedApp.reviewerMessages.map((msg) => (
                <div
                  key={msg.id}
                  className="p-4 rounded-[8px] border border-[#D5E0EA] dark:border-[#1E364A] bg-[#F7FAFD]/60 dark:bg-[#10212E]/60 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className="font-semibold text-[14px] text-[#10212E] dark:text-white">
                      {msg.sender}
                    </span>
                    <span className="text-[14px] text-[#6B7A87] tabular-nums">
                      {msg.timestamp}
                    </span>
                  </div>
                  <p className="text-[14px] text-[#43525F] dark:text-[#B2C3D2] leading-relaxed">
                    {msg.message}
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-6 text-center text-[#6B7A87] text-[14px] bg-[#F7FAFD]/50 dark:bg-[#10212E]/50 rounded-[8px] border border-[#D5E0EA] dark:border-[#1E364A]">
              No written reviewer notices dispatched for this submission yet.
            </div>
          )}
        </div>

        {/* 5. Attached Documents and Question Responses */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Shared Documents */}
          <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 space-y-4">
            <h3 className="font-heading font-semibold text-[17px] text-[#10212E] dark:text-white">
              Shared vault documents
            </h3>
            <div className="space-y-2">
              {selectedApp.sharedDocumentIds.map((docId) => {
                const doc = documents.find((d) => d.id === docId);
                return (
                  <div
                    key={docId}
                    className="p-3 rounded-[6px] border border-[#D5E0EA] dark:border-[#1E364A] flex items-center justify-between gap-3 text-[14px]"
                  >
                    <div className="space-y-0.5">
                      <span className="font-medium text-[#10212E] dark:text-white block">
                        {doc?.documentType || 'Statutory certificate'}
                      </span>
                      <span className="text-[14px] text-[#6B7A87]">
                        Doc #{doc?.documentNumber || 'BW-REF'}
                      </span>
                    </div>
                    {doc && <StatusChip status={doc.status} />}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Proposal / Form Responses */}
          <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 space-y-4">
            <h3 className="font-heading font-semibold text-[17px] text-[#10212E] dark:text-white">
              Questionnaire responses
            </h3>
            <div className="space-y-3">
              {selectedApp.responses && selectedApp.responses.length > 0 ? (
                selectedApp.responses.map((resp, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-[6px] border border-[#D5E0EA] dark:border-[#1E364A] bg-[#F7FAFD]/40 dark:bg-[#10212E]/40 text-[14px] space-y-1"
                  >
                    <span className="text-[#6B7A87] block font-medium">
                      {resp.label}
                    </span>
                    <span className="text-[#10212E] dark:text-white font-medium block">
                      {typeof resp.value === 'boolean'
                        ? resp.value
                          ? 'Yes'
                          : 'No'
                        : String(resp.value || 'Not provided')}
                    </span>
                  </div>
                ))
              ) : (
                <div className="text-[14px] text-[#6B7A87]">
                  No custom questions required for this submission.
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Withdraw Confirmation Modal */}
        {isWithdrawModalOpen && (
          <div className="fixed inset-0 z-50 bg-[#10212E]/60 flex items-center justify-center p-4">
            <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] max-w-lg w-full p-6 space-y-4">
              <div className="flex items-center gap-3 text-[#DC2626]">
                <AlertTriangle className="w-6 h-6 shrink-0" />
                <h3 className="font-heading font-semibold text-[18px] text-[#10212E] dark:text-white">
                  Confirm application withdrawal
                </h3>
              </div>

              <p className="text-[14px] text-[#43525F] dark:text-[#B2C3D2] leading-relaxed">
                Are you sure you want to withdraw your submission for <strong>{selectedApp.callNumber}</strong>? Withdrawing removes your sealed bid from evaluation. This action cannot be reversed.
              </p>

              <div className="space-y-1.5">
                <label className="text-[14px] font-semibold text-[#10212E] dark:text-white block">
                  Reason for withdrawal (optional)
                </label>
                <input
                  type="text"
                  value={withdrawReason}
                  onChange={(e) => setWithdrawReason(e.target.value)}
                  placeholder="e.g. Inadvertent pricing error or lack of transport capacity"
                  className="w-full p-2.5 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] bg-white dark:bg-[#132635] text-[14px] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99]"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setIsWithdrawModalOpen(false)}
                  className="px-4 py-2 border border-[#D5E0EA] dark:border-[#1E364A] text-[#43525F] dark:text-[#B2C3D2] rounded-[6px] text-[14px] font-medium hover:bg-[#F7FAFD] cursor-pointer"
                >
                  Keep application
                </button>
                <button
                  type="button"
                  onClick={handleConfirmWithdraw}
                  className="px-4 py-2 bg-[#DC2626] hover:bg-[#b91c1c] text-white rounded-[6px] text-[14px] font-medium cursor-pointer"
                >
                  Withdraw proposal
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // --------------------------------------------------------------------------
  // LIST VIEW WITH TABS (Drafts, Submitted, Decisions)
  // --------------------------------------------------------------------------
  return (
    <div className="space-y-8">
      {/* 1. Header with Single Primary Action in Pula Deep */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#D5E0EA] dark:border-[#1E364A]">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-semibold text-[#1F5F99] bg-[#EAF2FA] dark:bg-[#1E364A] dark:text-[#6FAEE0] px-3 py-1 rounded-[4px]">
              Submissions
            </span>
            <span className="text-[14px] text-[#6B7A87]">· Tender bids & rosters</span>
          </div>
          <h1 className="font-heading font-semibold text-[30px] leading-tight text-[#10212E] dark:text-white">
            Applications
          </h1>
          <p className="text-[15px] text-[#43525F] dark:text-[#B2C3D2]">
            Monitor proposal evaluation, answer clarification requests, and inspect certified decisions.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={onNewApplication}
            className="px-5 py-2.5 bg-[#1F5F99] hover:bg-[#184c7a] text-white rounded-[6px] text-[14px] font-medium inline-flex items-center gap-2 cursor-pointer transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Apply for tender</span>
          </button>
        </div>
      </div>

      {/* 2. Three Tabs: Drafts, Submitted, Decisions */}
      <div className="flex items-center gap-2 border-b border-[#D5E0EA] dark:border-[#1E364A] pb-px">
        {[
          { id: 'SUBMITTED' as const, label: 'Submitted', count: submittedApps.length },
          { id: 'DECISIONS' as const, label: 'Decisions', count: decisionApps.length },
          { id: 'DRAFTS' as const, label: 'Drafts', count: draftApps.length },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`pb-3 px-4 text-[14px] font-medium border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
              activeTab === tab.id
                ? 'border-[#1F5F99] text-[#1F5F99] dark:text-[#6FAEE0] font-semibold'
                : 'border-transparent text-[#6B7A87] hover:text-[#10212E] dark:hover:text-white'
            }`}
          >
            <span>{tab.label}</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[14px] tabular-nums ${
                activeTab === tab.id
                  ? 'bg-[#EAF2FA] text-[#1F5F99] dark:bg-[#1E364A] dark:text-[#6FAEE0]'
                  : 'bg-[#F7FAFD] text-[#6B7A87] dark:bg-[#10212E]'
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* 3. Applications Table */}
      {displayedApps.length === 0 ? (
        <div className="bg-white dark:bg-[#132635] border border-[#D5E0EA] dark:border-[#1E364A] rounded-[12px] p-12 text-center space-y-3">
          <FileText className="w-10 h-10 text-[#6B7A87] mx-auto" />
          <h3 className="font-heading font-semibold text-[18px] text-[#10212E] dark:text-white">
            No applications in {activeTab.toLowerCase()}
          </h3>
          <p className="text-[14px] text-[#43525F] dark:text-[#B2C3D2] max-w-sm mx-auto">
            {activeTab === 'DRAFTS'
              ? 'You do not have any saved application drafts.'
              : activeTab === 'SUBMITTED'
              ? 'You currently do not have any applications actively under review.'
              : 'You do not have any approved or rejected decisions on record yet.'}
          </p>
          <button
            type="button"
            onClick={onNewApplication}
            className="px-4 py-2 bg-[#1F5F99] text-white text-[14px] font-medium rounded-[6px] cursor-pointer"
          >
            Browse open tenders
          </button>
        </div>
      ) : (
        <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] overflow-hidden">
          {/* Desktop Table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#D5E0EA] dark:border-[#1E364A] bg-[#F7FAFD] dark:bg-[#10212E] text-[14px] text-[#6B7A87]">
                  <th className="py-3.5 px-6 font-semibold">Call</th>
                  <th className="py-3.5 px-6 font-semibold">Organization</th>
                  <th className="py-3.5 px-6 font-semibold">Status</th>
                  <th className="py-3.5 px-6 font-semibold">
                    {activeTab === 'DRAFTS' ? 'Last saved' : 'Submitted date'}
                  </th>
                  <th className="py-3.5 px-6 font-semibold text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D5E0EA] dark:divide-[#1E364A] text-[14px]">
                {displayedApps.map((app) => {
                  const nextAction = getNextStepAction(app);

                  return (
                    <tr
                      key={app.id}
                      className="hover:bg-[#F7FAFD]/50 dark:hover:bg-[#10212E]/50 transition-colors"
                    >
                      {/* Call */}
                      <td className="py-4 px-6">
                        <div className="space-y-1 max-w-md">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-[#1F5F99] dark:text-[#6FAEE0]">
                              {app.callNumber}
                            </span>
                            <span className="text-[14px] bg-[#F7FAFD] dark:bg-[#10212E] border border-[#D5E0EA] dark:border-[#1E364A] text-[#10212E] dark:text-white px-2 py-0.5 rounded-[4px] font-medium">
                              {app.callType}
                            </span>
                          </div>
                          <span className="font-heading font-medium text-[#10212E] dark:text-white line-clamp-1 block">
                            {app.callTitle}
                          </span>
                        </div>
                      </td>

                      {/* Organization */}
                      <td className="py-4 px-6 text-[#10212E] dark:text-white">
                        <div className="flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-[#6B7A87] shrink-0" />
                          <span>{app.organizationName}</span>
                        </div>
                      </td>

                      {/* Status Chip */}
                      <td className="py-4 px-6">
                        <StatusChip status={app.status} />
                      </td>

                      {/* Submitted Date */}
                      <td className="py-4 px-6 text-[#43525F] dark:text-[#B2C3D2] whitespace-nowrap tabular-nums">
                        {app.submittedAt}
                      </td>

                      {/* Next-step Action */}
                      <td className="py-4 px-6 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={nextAction.action}
                          className={`px-3.5 py-1.5 rounded-[6px] text-[14px] font-medium transition-colors cursor-pointer inline-flex items-center gap-1.5 ${
                            nextAction.primary
                              ? 'bg-[#1F5F99] hover:bg-[#184c7a] text-white'
                              : 'border border-[#D5E0EA] dark:border-[#1E364A] bg-white dark:bg-[#132635] text-[#10212E] dark:text-white hover:bg-[#F7FAFD]'
                          }`}
                        >
                          <span>{nextAction.label}</span>
                          <ChevronRight className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card List */}
          <div className="md:hidden divide-y divide-[#D5E0EA] dark:divide-[#1E364A]">
            {displayedApps.map((app) => {
              const nextAction = getNextStepAction(app);

              return (
                <div key={app.id} className="p-5 space-y-3 text-[14px]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-0.5">
                      <span className="font-semibold text-[#1F5F99] dark:text-[#6FAEE0]">
                        {app.callNumber}
                      </span>
                      <h4 className="font-heading font-medium text-[#10212E] dark:text-white">
                        {app.callTitle}
                      </h4>
                    </div>
                    <StatusChip status={app.status} />
                  </div>

                  <div className="text-[14px] text-[#6B7A87] space-y-1">
                    <div className="flex items-center gap-2">
                      <Building2 className="w-4 h-4 shrink-0" />
                      <span>{app.organizationName}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 shrink-0" />
                      <span>{activeTab === 'DRAFTS' ? 'Saved' : 'Submitted'}: {app.submittedAt}</span>
                    </div>
                  </div>

                  <div className="pt-2">
                    <button
                      type="button"
                      onClick={nextAction.action}
                      className={`w-full py-2 px-3 rounded-[6px] text-[14px] font-medium transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
                        nextAction.primary
                          ? 'bg-[#1F5F99] text-white'
                          : 'border border-[#D5E0EA] dark:border-[#1E364A] bg-white text-[#10212E]'
                      }`}
                    >
                      <span>{nextAction.label}</span>
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
