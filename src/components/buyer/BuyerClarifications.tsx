import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '../../context/AppContext';
import { buyerApi } from '../../services/api';
import { Send, CheckCircle2, AlertCircle } from 'lucide-react';

interface BuyerClarificationRow {
  id: string;
  callId: string;
  callNumber?: string;
  callTitle?: string;
  supplierName: string;
  question: string;
  answer?: string;
  answeredBy?: string;
  submittedAt: string;
  answeredAt?: string;
  status: 'Pending' | 'Answered';
  isPublished?: boolean;
}

export const BuyerClarifications: React.FC = () => {
  const { clarifications: contextClarifications, calls, publishClarificationAnswer, buyerSubRole, profileSummary, currentUser } = useApp();

  const [clarifications, setClarifications] = useState<BuyerClarificationRow[]>(() =>
    contextClarifications.map((c) => ({
      id: c.id,
      callId: c.callId,
      supplierName: c.supplierName,
      question: c.question,
      answer: c.answer,
      answeredBy: c.answeredBy,
      submittedAt: c.submittedAt,
      answeredAt: c.answeredAt,
      status: c.status,
      isPublished: c.isPublished,
    }))
  );
  const [selectedClarId, setSelectedClarId] = useState<string | null>(clarifications[0]?.id || null);
  const [answerText, setAnswerText] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successNotice, setSuccessNotice] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadClarifications = useCallback(async () => {
    try {
      const rows = await buyerApi.listClarifications();
      if (Array.isArray(rows)) {
        const mapped: BuyerClarificationRow[] = rows.map((cl: any) => ({
          id: cl.id,
          callId: cl.callId,
          callNumber: cl.callNumber,
          callTitle: cl.callTitle,
          supplierName: cl.supplierName || 'Prospective Bidder',
          question: cl.question,
          answer: cl.answer || undefined,
          answeredBy: cl.responderTitle || undefined,
          submittedAt: cl.askedAt ? new Date(cl.askedAt).toLocaleString() : '',
          answeredAt: cl.answeredAt ? new Date(cl.answeredAt).toLocaleString() : undefined,
          status: cl.status === 'Answered' ? 'Answered' : 'Pending',
          isPublished: Boolean(cl.isPublished),
        }));
        setClarifications(mapped);
        setSelectedClarId((prev) => (prev && mapped.some((m) => m.id === prev) ? prev : mapped[0]?.id || null));
      }
    } catch {}
  }, []);

  useEffect(() => {
    loadClarifications();
  }, [loadClarifications]);

  const selectedClar = clarifications.find((c) => c.id === selectedClarId) || clarifications[0];

  const getCallNumber = (item: BuyerClarificationRow) => {
    if (item.callNumber) return item.callNumber;
    const found = calls.find((c) => c.id === item.callId);
    return found?.callNumber || 'Tender Call';
  };

  const handleAnswerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClar || !answerText.trim() || isSubmitting) return;

    setIsSubmitting(true);
    setErrorMsg(null);
    const responder = currentUser?.fullName || profileSummary?.displayName || 'Procurement Officer';

    try {
      await buyerApi.answerClarification(selectedClar.id, answerText.trim(), responder);
      publishClarificationAnswer(selectedClar.id, answerText.trim(), responder);
      setAnswerText('');
      setSuccessNotice(true);
      await loadClarifications();
      setTimeout(() => setSuccessNotice(false), 4000);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Failed to publish clarification response.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const hasAnswerPermission = buyerSubRole === 'Org admin' || buyerSubRole === 'Procurement officer';

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#D5E0EA] dark:border-[#244157]">
        <div className="space-y-1">
          <h1 className="font-heading font-semibold text-[30px] leading-tight text-[#10212E] dark:text-white">
            Tender clarifications desk
          </h1>
          <p className="text-[15px] text-[#43525F] dark:text-[#D3E3F2]">
            Review private bidder inquiries and publish official responses to all prospective bidders.
          </p>
        </div>
      </div>

      {successNotice && (
        <div className="p-4 bg-[#ECFDF5] border border-[#A7F3D0] rounded-[12px] text-[#065F46] text-[14px] flex items-center gap-2 dark:bg-[#2F8F5B]/20 dark:text-[#6EE7B7] dark:border-[#2F8F5B]/40">
          <CheckCircle2 className="w-5 h-5 text-[#2F8F5B]" />
          <span>Clarification answer published publicly and notified to all registered bidders.</span>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 bg-[#FEF2F2] border border-[#FCA5A5] rounded-[12px] text-[#8E2A1B] text-[14px] flex items-center gap-2 dark:bg-[#C2412D]/20">
          <AlertCircle className="w-5 h-5 text-[#C2412D]" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left List */}
        <div className="lg:col-span-5 bg-white dark:bg-[#1C364B] rounded-[12px] border border-[#D5E0EA] dark:border-[#244157] divide-y divide-[#D5E0EA] dark:divide-[#244157] overflow-hidden">
          <div className="p-4 bg-[#F7FAFD] dark:bg-[#10212E] font-semibold text-[14px] text-[#10212E] dark:text-white">
            Clarification questions ({clarifications.length})
          </div>

          {clarifications.length === 0 ? (
            <div className="p-8 text-center text-[13px] text-[#6B7A87] dark:text-[#9CB4C9]">
              No clarification inquiries submitted for your organization's calls yet.
            </div>
          ) : (
            clarifications.map((item) => {
              const isSelected = selectedClar?.id === item.id;
              const isAnswered = item.status === 'Answered';
              return (
                <div
                  key={item.id}
                  onClick={() => setSelectedClarId(item.id)}
                  className={`p-4 transition-colors cursor-pointer space-y-1 ${
                    isSelected
                      ? 'bg-[#EAF2FA] dark:bg-[#162C3D] border-l-4 border-l-[#1F5F99]'
                      : 'hover:bg-[#F7FAFD] dark:hover:bg-[#10212E]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[14px] text-[#10212E] dark:text-white">
                      {getCallNumber(item)}
                    </span>
                    <span
                      className={`text-[12px] px-2 py-0.5 rounded-[4px] font-medium ${
                        isAnswered
                          ? 'bg-[#ECFDF5] text-[#2F8F5B]'
                          : 'bg-[#FFFBEB] text-[#92400E]'
                      }`}
                    >
                      {isAnswered ? 'Answered' : 'Pending response'}
                    </span>
                  </div>
                  <p className="text-[13px] text-[#43525F] dark:text-[#D3E3F2] line-clamp-2">
                    {item.question}
                  </p>
                  <span className="text-[12px] text-[#6B7A87] block dark:text-[#9CB4C9]">
                    Asked {item.submittedAt}
                  </span>
                </div>
              );
            })
          )}
        </div>

        {/* Right Detail & Reply */}
        <div className="lg:col-span-7 bg-white dark:bg-[#1C364B] rounded-[12px] border border-[#D5E0EA] dark:border-[#244157] p-6 space-y-6">
          {selectedClar ? (
            <>
              <div className="space-y-1 pb-4 border-b border-[#D5E0EA] dark:border-[#244157]">
                <span className="text-[12px] text-[#1F5F99] font-medium dark:text-[#6FAEE0]">
                  Question for {getCallNumber(selectedClar)}
                </span>
                <h3 className="font-heading font-semibold text-[18px] text-[#10212E] dark:text-white">
                  Bidder inquiry details
                </h3>
              </div>

              <div className="p-4 bg-[#F7FAFD] dark:bg-[#10212E] rounded-[8px] space-y-2">
                <span className="text-[12px] text-[#6B7A87] block dark:text-[#9CB4C9]">Inquiry received on {selectedClar.submittedAt}:</span>
                <p className="text-[14px] text-[#10212E] dark:text-white leading-relaxed font-medium">
                  "{selectedClar.question}"
                </p>
              </div>

              {selectedClar.status === 'Answered' ? (
                <div className="p-4 border border-[#A7F3D0] bg-[#ECFDF5] dark:bg-[#065F46]/20 rounded-[8px] space-y-2 dark:border-[#2F8F5B]/40">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-semibold text-[#065F46] dark:text-[#A7F3D0]">
                      Published official response:
                    </span>
                    <span className="text-[12px] text-[#6B7A87] dark:text-[#9CB4C9]">{selectedClar.answeredAt}</span>
                  </div>
                  <p className="text-[14px] text-[#10212E] dark:text-white leading-relaxed">
                    {selectedClar.answer}
                  </p>
                  <span className="text-[12px] text-[#6B7A87] block pt-1 dark:text-[#9CB4C9]">
                    Answered by: {selectedClar.answeredBy || 'Procurement Officer'}
                  </span>
                </div>
              ) : (
                hasAnswerPermission ? (
                  <form onSubmit={handleAnswerSubmit} className="space-y-4">
                    <div className="space-y-1">
                      <label className="font-semibold text-[14px] text-[#10212E] dark:text-white block">
                        Official clarification response *
                      </label>
                      <textarea
                        rows={4}
                        placeholder="Draft the formal technical clarification. Publishing this response makes it visible on the public tender bulletin..."
                        value={answerText}
                        onChange={(e) => setAnswerText(e.target.value)}
                        className="w-full p-3 border border-[#D5E0EA] dark:border-[#244157] rounded-[6px] text-[14px]"
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="px-4 py-2 bg-[#1F5F99] hover:bg-[#184c7a] disabled:opacity-50 text-white rounded-[6px] text-[14px] font-medium flex items-center gap-2"
                    >
                      <Send className="w-4 h-4" />
                      <span>{isSubmitting ? 'Publishing...' : 'Publish addendum answer'}</span>
                    </button>
                  </form>
                ) : (
                  <div className="p-4 bg-[#FFFBEB] text-[#92400E] rounded-[8px] text-[13px] dark:bg-[#E8A33D]/20 dark:text-[#FCD34D]">
                    Signed in as {buyerSubRole}. Publishing clarification answers requires Procurement Officer privileges.
                  </div>
                )
              )}
            </>
          ) : (
            <div className="p-12 text-center text-[#6B7A87] dark:text-[#9CB4C9]">
              Select a clarification question to inspect.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
