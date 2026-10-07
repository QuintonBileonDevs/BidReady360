import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { MessageSquare, Clock, Send, CheckCircle2, AlertCircle } from 'lucide-react';

export const BuyerClarifications: React.FC = () => {
  const { clarifications, calls, publishClarificationAnswer, buyerSubRole } = useApp();
  const [selectedClarId, setSelectedClarId] = useState<string | null>(clarifications[0]?.id || null);
  const [answerText, setAnswerText] = useState('');
  const [successNotice, setSuccessNotice] = useState(false);

  const selectedClar = clarifications.find((c) => c.id === selectedClarId) || clarifications[0];

  const getCallNumber = (callId: string) => {
    const found = calls.find((c) => c.id === callId);
    return found?.callNumber || 'GRC/ENG/2026/04';
  };

  const handleAnswerSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedClar || !answerText.trim()) return;

    publishClarificationAnswer(selectedClar.id, answerText.trim(), 'Kgosi Tau (Procurement Lead)');
    setAnswerText('');
    setSuccessNotice(true);
    setTimeout(() => setSuccessNotice(false), 4000);
  };

  const hasAnswerPermission = buyerSubRole === 'Org admin' || buyerSubRole === 'Procurement officer';

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#D5E0EA] dark:border-[#1E364A]">
        <div className="space-y-1">
          <h1 className="font-heading font-semibold text-[30px] leading-tight text-[#10212E] dark:text-white">
            Tender clarifications desk
          </h1>
          <p className="text-[15px] text-[#43525F] dark:text-[#B2C3D2]">
            Review bidder questions, publish formal addenda answers, and uphold strict statutory transparency.
          </p>
        </div>
      </div>

      {successNotice && (
        <div className="p-4 bg-[#ECFDF5] border border-[#A7F3D0] rounded-[12px] text-[#065F46] text-[14px] flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-[#2F8F5B]" />
          <span>Clarification answer published publicly and notified to all registered bidders.</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left List */}
        <div className="lg:col-span-5 bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] divide-y divide-[#D5E0EA] dark:divide-[#1E364A] overflow-hidden">
          <div className="p-4 bg-[#F7FAFD] dark:bg-[#10212E] font-semibold text-[14px] text-[#10212E] dark:text-white">
            Clarification questions ({clarifications.length})
          </div>

          {clarifications.map((item) => {
            const isSelected = selectedClar?.id === item.id;
            const isAnswered = item.status === 'Answered';
            return (
              <div
                key={item.id}
                onClick={() => setSelectedClarId(item.id)}
                className={`p-4 transition-colors cursor-pointer space-y-1 ${
                  isSelected
                    ? 'bg-[#EAF2FA] dark:bg-[#162C3E] border-l-4 border-l-[#1F5F99]'
                    : 'hover:bg-[#F7FAFD] dark:hover:bg-[#10212E]'
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[14px] text-[#10212E] dark:text-white">
                    {getCallNumber(item.callId)}
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
                <p className="text-[13px] text-[#43525F] dark:text-[#B2C3D2] line-clamp-2">
                  {item.question}
                </p>
                <span className="text-[12px] text-[#6B7A87] block">
                  Asked {item.submittedAt}
                </span>
              </div>
            );
          })}
        </div>

        {/* Right Detail & Reply */}
        <div className="lg:col-span-7 bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 space-y-6">
          {selectedClar ? (
            <>
              <div className="space-y-1 pb-4 border-b border-[#D5E0EA] dark:border-[#1E364A]">
                <span className="text-[12px] text-[#1F5F99] font-medium">
                  Question for {getCallNumber(selectedClar.callId)}
                </span>
                <h3 className="font-heading font-semibold text-[18px] text-[#10212E] dark:text-white">
                  Bidder inquiry details
                </h3>
              </div>

              <div className="p-4 bg-[#F7FAFD] dark:bg-[#10212E] rounded-[8px] space-y-2">
                <span className="text-[12px] text-[#6B7A87] block">Inquiry received on {selectedClar.submittedAt}:</span>
                <p className="text-[14px] text-[#10212E] dark:text-white leading-relaxed font-medium">
                  "{selectedClar.question}"
                </p>
              </div>

              {selectedClar.status === 'Answered' ? (
                <div className="p-4 border border-[#A7F3D0] bg-[#ECFDF5] dark:bg-[#065F46]/20 rounded-[8px] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-semibold text-[#065F46] dark:text-[#A7F3D0]">
                      Published official response:
                    </span>
                    <span className="text-[12px] text-[#6B7A87]">{selectedClar.answeredAt}</span>
                  </div>
                  <p className="text-[14px] text-[#10212E] dark:text-white leading-relaxed">
                    {selectedClar.answer}
                  </p>
                  <span className="text-[12px] text-[#6B7A87] block pt-1">
                    Answered by: {selectedClar.answeredBy}
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
                        placeholder="Draft the formal technical clarification. This response will be published as an addendum to all bidders..."
                        value={answerText}
                        onChange={(e) => setAnswerText(e.target.value)}
                        className="w-full p-3 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px]"
                        required
                      />
                    </div>

                    <button
                      type="submit"
                      className="px-4 py-2 bg-[#1F5F99] hover:bg-[#184c7a] text-white rounded-[6px] text-[14px] font-medium flex items-center gap-2"
                    >
                      <Send className="w-4 h-4" />
                      <span>Publish addendum answer</span>
                    </button>
                  </form>
                ) : (
                  <div className="p-4 bg-[#FFFBEB] text-[#92400E] rounded-[8px] text-[13px]">
                    Signed in as {buyerSubRole}. Publishing clarification answers requires Procurement Officer privileges.
                  </div>
                )
              )}
            </>
          ) : (
            <div className="p-12 text-center text-[#6B7A87]">
              Select a clarification question to inspect.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
