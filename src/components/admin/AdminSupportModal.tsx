import React, { useState } from 'react';
import { ShieldAlert, X } from 'lucide-react';
import { adminApi } from '../../services/api';

interface AdminSupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetEntityId?: string | null;
  targetEntityName: string;
  targetType: 'Supplier' | 'Organization' | 'Document' | 'Audit Dossier';
  onGrantAccess: (reason: string) => void;
}

export const AdminSupportModal: React.FC<AdminSupportModalProps> = ({
  isOpen,
  onClose,
  targetEntityId,
  targetEntityName,
  targetType,
  onGrantAccess,
}) => {
  const [ticketRef, setTicketRef] = useState('');
  const [justification, setJustification] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!ticketRef.trim()) {
      setError('Please provide a support ticket or formal statutory reference.');
      return;
    }
    if (!justification.trim() || justification.trim().length < 10) {
      setError('Please provide a detailed justification reason (min 10 characters).');
      return;
    }
    if (!acknowledged) {
      setError('You must acknowledge that all session interactions will be audited.');
      return;
    }

    setIsSubmitting(true);
    try {
      await adminApi.startSupportSession({
        targetType,
        targetId: targetEntityId || null,
        targetName: targetEntityName,
        ticketRef: ticketRef.trim(),
        justification: justification.trim(),
      });
      const fullReason = `${ticketRef.trim()} - ${justification.trim()}`;
      setTicketRef('');
      setJustification('');
      setAcknowledged(false);
      onGrantAccess(fullReason);
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Unable to authorize support session.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#10212E]/70 backdrop-blur-xs">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      <div className="relative w-full max-w-lg bg-white dark:bg-[#1C364B] border border-[#D5E0EA] dark:border-[#244157] rounded-[12px] p-6 z-10 space-y-5">
        <div className="flex items-start justify-between gap-3 border-b border-[#D5E0EA] dark:border-[#244157] pb-4">
          <div className="space-y-1">
            <div className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#C2412D]">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>Privileged access authorization</span>
            </div>
            <h3 className="text-[20px] font-heading font-semibold text-[#10212E] dark:text-white leading-tight">
              Request support access: {targetEntityName}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-[#6B7A87] hover:text-[#10212E] dark:hover:text-white p-1 rounded-[6px] cursor-pointer dark:text-[#9CB4C9]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-4 rounded-[8px] bg-[#FFFBEB] dark:bg-[#92400E]/20 border border-[#FDE68A] dark:border-[#92400E]/40 text-[14px] text-[#92400E] dark:text-[#FCD34D] space-y-1.5">
          <span className="font-semibold block">Privacy &amp; audit safeguard</span>
          <p className="leading-relaxed text-[13px]">
            To protect tender confidentiality, administrative access to private entity workspaces is restricted. This action is permanently recorded in the PostgreSQL statutory audit log.
          </p>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 text-[#C2412D] border border-rose-200 rounded-[6px] text-[13px] dark:bg-[#C2412D]/20 dark:border-[#C2412D]/40">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-[14px]">
          <div className="space-y-1.5">
            <label className="font-medium text-[#10212E] dark:text-white block">
              Support ticket or reference number *
            </label>
            <input
              type="text"
              placeholder="e.g. TICKET-4892 / AUDIT-REQ-2026"
              value={ticketRef}
              onChange={(e) => setTicketRef(e.target.value)}
              className="w-full px-3 py-2 border border-[#D5E0EA] dark:border-[#244157] rounded-[6px] bg-white dark:bg-[#10212E] text-[#10212E] dark:text-white focus:border-[#1F5F99]"
            />
          </div>

          <div className="space-y-1.5">
            <label className="font-medium text-[#10212E] dark:text-white block">
              Written justification *
            </label>
            <textarea
              rows={3}
              placeholder="Explain the technical or compliance purpose for accessing this account..."
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              className="w-full px-3 py-2 border border-[#D5E0EA] dark:border-[#244157] rounded-[6px] bg-white dark:bg-[#10212E] text-[#10212E] dark:text-white focus:border-[#1F5F99]"
            />
          </div>

          <div className="pt-1">
            <label className="flex items-start gap-2.5 cursor-pointer text-[13px] text-[#43525F] dark:text-[#D3E3F2]">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="mt-1 rounded-[4px] border-[#D5E0EA] text-[#1F5F99] focus:ring-0 dark:text-[#6FAEE0] dark:border-[#244157]"
              />
              <span>
                I certify that I am accessing this account solely for authorized diagnostic or regulatory assistance.
              </span>
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#D5E0EA] dark:border-[#244157]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-[14px] text-[#43525F] dark:text-[#D3E3F2] hover:text-[#10212E] cursor-pointer dark:hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-[#1F5F99] hover:bg-[#184c7a] text-white text-[14px] font-medium rounded-[6px] transition-colors cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? 'Authorizing...' : 'Authorize & start logged session'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
