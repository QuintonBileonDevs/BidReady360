import React, { useState } from 'react';
import { ShieldAlert, AlertCircle, Lock, ArrowRight, X } from 'lucide-react';
import { useApp } from '../../context/AppContext';

interface AdminSupportModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetEntityName: string;
  targetType: 'Supplier' | 'Organization' | 'Document' | 'Audit Dossier';
  onGrantAccess: (reason: string) => void;
}

export const AdminSupportModal: React.FC<AdminSupportModalProps> = ({
  isOpen,
  onClose,
  targetEntityName,
  targetType,
  onGrantAccess,
}) => {
  const { addAuditEvent } = useApp();
  const [ticketRef, setTicketRef] = useState('');
  const [justification, setJustification] = useState('');
  const [acknowledged, setAcknowledged] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!ticketRef.trim()) {
      setError('Please provide a support ticket or formal statutory reference.');
      return;
    }
    if (!justification.trim() || justification.length < 10) {
      setError('Please provide a detailed justification reason (min 10 characters).');
      return;
    }
    if (!acknowledged) {
      setError('You must acknowledge that all session interactions will be audited.');
      return;
    }

    const fullReason = `${ticketRef.trim()} - ${justification.trim()}`;
    addAuditEvent({
      action: 'Administrative Support Access Granted',
      actorName: 'System Administrator (Lesedi Mokgweetsi)',
      actorRole: 'Super Admin',
      organizationName: 'BidReady360 Platform Administration',
      entityType: targetType === 'Supplier' ? 'Supplier' : 'Organization',
      entityId: targetEntityName,
      details: `Temporary read-only support session initiated for ${targetEntityName}. Justification: ${fullReason}`,
      ipAddress: '168.167.12.89',
    });

    onGrantAccess(fullReason);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#10212E]/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />

      <div className="relative w-full max-w-lg bg-white dark:bg-[#132635] border border-[#D5E0EA] dark:border-[#1E364A] rounded-[12px] p-6 shadow-none z-10 space-y-5">
        <div className="flex items-start justify-between gap-3 border-b border-[#D5E0EA] dark:border-[#1E364A] pb-4">
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
            className="text-[#6B7A87] hover:text-[#10212E] dark:hover:text-white p-1 rounded-[6px]"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Statutory Warning Box */}
        <div className="p-4 rounded-[8px] bg-[#FFFBEB] dark:bg-[#92400E]/20 border border-[#FDE68A] dark:border-[#92400E]/40 text-[14px] text-[#92400E] dark:text-[#FCD34D] space-y-1.5">
          <span className="font-semibold block">Privacy & audit safeguard</span>
          <p className="leading-relaxed text-[13px]">
            To protect tender confidentiality, administrative access to private entity workspaces is restricted. This action is permanently logged to the immutable statutory audit trail.
          </p>
        </div>

        {error && (
          <div className="p-3 bg-rose-50 text-[#C2412D] border border-rose-200 rounded-[6px] text-[13px]">
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
              className="w-full px-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] bg-white dark:bg-[#10212E] text-[#10212E] dark:text-white focus:border-[#1F5F99]"
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
              className="w-full px-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] bg-white dark:bg-[#10212E] text-[#10212E] dark:text-white focus:border-[#1F5F99]"
            />
          </div>

          <div className="pt-1">
            <label className="flex items-start gap-2.5 cursor-pointer text-[13px] text-[#43525F] dark:text-[#B2C3D2]">
              <input
                type="checkbox"
                checked={acknowledged}
                onChange={(e) => setAcknowledged(e.target.checked)}
                className="mt-1 rounded-[4px] border-[#D5E0EA] text-[#1F5F99] focus:ring-0"
              />
              <span>
                I certify that I am accessing this account solely for authorized diagnostic or regulatory assistance.
              </span>
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#D5E0EA] dark:border-[#1E364A]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-[14px] text-[#43525F] dark:text-[#B2C3D2] hover:text-[#10212E]"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-[#1F5F99] hover:bg-[#184c7a] text-white text-[14px] font-medium rounded-[6px] transition-colors"
            >
              Authorize & start logged session
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
