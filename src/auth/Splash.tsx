import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useAuth } from './AuthProvider';

export const Splash: React.FC = () => {
  const { status } = useAuth();
  const [slow, setSlow] = useState(false);
  const cardRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setSlow(false);
    if (status === 'booting' || status === 'signing-in' || status === 'signing-out') {
      const timer = setTimeout(() => setSlow(true), 6000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  const isActive = status === 'booting' || status === 'signing-in' || status === 'signing-out' || status === 'error';
  if (!isActive) return null;

  const getHeading = () => {
    if (status === 'signing-in') return 'Signing you in';
    if (status === 'signing-out') return 'Signing you out';
    if (status === 'error') return 'We could not load your profile.';
    return 'Loading your profile';
  };

  const getSubtext = () => {
    if (status === 'signing-in') return 'Checking your details.';
    if (status === 'signing-out') return 'Clearing this device.';
    if (status === 'error') return 'Check your connection, then try again.';
    return slow ? 'Still working. Slow connections can take longer.' : 'This takes a few seconds.';
  };

  const isError = status === 'error';

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
      style={{
        backgroundColor: 'rgba(234, 242, 250, 0.7)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
      }}
    >
      <div
        ref={cardRef}
        tabIndex={-1}
        className="w-full max-w-[360px] bg-white rounded-xl shadow-lg p-7 text-center flex flex-col items-center outline-none"
      >
        <div className="sr-only" role="status" aria-live="polite">
          {getHeading()}. {getSubtext()}
        </div>

        <div className="relative w-16 h-16 flex items-center justify-center mb-5" aria-hidden="true">
          <svg className={`w-16 h-16 ${!isError ? 'animate-spin' : ''}`} viewBox="0 0 56 56" fill="none">
             <circle cx="28" cy="28" r="22" stroke={isError ? "#C2412D" : "#1F5F99"} strokeWidth="4" strokeLinecap="round" strokeDasharray="115 25" />
          </svg>
          <div className="absolute w-3 h-3 rounded-full bg-[#E8A33D]" />
        </div>

        <h2 className="text-lg font-semibold text-[#10212E] mb-1">{getHeading()}</h2>
        <p className="text-[15px] text-[#10212E] leading-relaxed mb-6">{getSubtext()}</p>

        {isError && (
          <div className="flex gap-3">
             {/* Buttons would go here */}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
};
