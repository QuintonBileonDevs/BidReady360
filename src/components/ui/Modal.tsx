import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  className?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  maxWidth = 'lg',
  className = '',
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidthStyles = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#10212E]/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="fixed inset-0"
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className={`relative w-full ${maxWidthStyles[maxWidth]} bg-white dark:bg-[#132635] border border-[#D5E0EA] dark:border-[#1E364A] rounded-[10px] shadow-elevated overflow-hidden z-10 max-h-[90vh] flex flex-col ${className}`}
        role="dialog"
        aria-modal="true"
      >
        {(title || description) && (
          <div className="px-6 pt-6 pb-4 border-b border-[#D5E0EA] dark:border-[#1E364A] flex items-start justify-between gap-4">
            <div className="space-y-1 pr-6">
              {title && (
                <h3 className="text-lg font-heading font-semibold text-[#10212E] dark:text-white">
                  {title}
                </h3>
              )}
              {description && (
                <p className="text-xs text-[#6B7A87] leading-relaxed">
                  {description}
                </p>
              )}
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-[6px] text-[#6B7A87] hover:text-[#10212E] dark:hover:text-white hover:bg-[#F7FAFD] dark:hover:bg-[#10212E] transition-colors"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" strokeWidth={1.5} />
            </button>
          </div>
        )}

        <div className="p-6 overflow-y-auto flex-1">
          {children}
        </div>
      </div>
    </div>
  );
};
