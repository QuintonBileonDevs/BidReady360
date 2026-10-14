import React from 'react';
import { Clock, ShieldAlert, LogOut, CheckCircle2 } from 'lucide-react';
import { Button } from '../ui/Button';

interface InactivityWarningModalProps {
  isOpen: boolean;
  secondsRemaining: number;
  totalWarningSeconds?: number;
  onStaySignedIn: () => void;
  onSignOut: () => void;
}

export const InactivityWarningModal: React.FC<InactivityWarningModalProps> = ({
  isOpen,
  secondsRemaining,
  totalWarningSeconds = 120,
  onStaySignedIn,
  onSignOut,
}) => {
  if (!isOpen) return null;

  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const percentRemaining = Math.max(0, Math.min(100, (secondsRemaining / totalWarningSeconds) * 100));
  const isUrgent = secondsRemaining <= 30;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#10212E]/75 backdrop-blur-xs animate-in fade-in duration-200"
      role="dialog"
      aria-modal="true"
      aria-labelledby="inactivity-warning-title"
    >
      <div className="relative w-full max-w-md bg-white dark:bg-[#132635] border border-[#D5E0EA] dark:border-[#1E364A] rounded-[12px] shadow-2xl overflow-hidden p-6 sm:p-7 text-center">
        {/* Warning Icon Badge */}
        <div
          className={`w-14 h-14 rounded-full mx-auto flex items-center justify-center mb-4 transition-colors ${
            isUrgent
              ? 'bg-[#FEE2E2] dark:bg-[#991B1B]/30 text-[#DC2626] dark:text-[#F87171] border border-[#FCA5A5]'
              : 'bg-[#FFFBEB] dark:bg-[#78350F]/30 text-[#D97706] dark:text-[#FBBF24] border border-[#FDE68A]'
          }`}
        >
          {isUrgent ? (
            <ShieldAlert className="w-7 h-7 animate-pulse" strokeWidth={1.75} />
          ) : (
            <Clock className="w-7 h-7" strokeWidth={1.75} />
          )}
        </div>

        {/* Heading & Notice */}
        <h2
          id="inactivity-warning-title"
          className="text-[20px] font-heading font-semibold text-[#10212E] dark:text-white tracking-tight"
        >
          Session Inactivity Warning
        </h2>
        <p className="text-[14px] text-[#43525F] dark:text-[#B2C3D2] mt-2 leading-relaxed">
          You have been inactive for a while. For your security and to protect sensitive procurement data, your session will automatically end in:
        </p>

        {/* Big Countdown Timer */}
        <div className="my-5 p-4 bg-[#F7FAFD] dark:bg-[#0D1A25] rounded-[10px] border border-[#D5E0EA] dark:border-[#1E364A]">
          <div
            className={`text-[36px] font-mono font-bold tracking-wider tabular-nums ${
              isUrgent
                ? 'text-[#DC2626] dark:text-[#F87171] animate-pulse'
                : 'text-[#1F5F99] dark:text-[#6FAEE0]'
            }`}
          >
            {formattedTime}
          </div>
          <div className="text-[12px] uppercase font-semibold tracking-wider text-[#6B7A87] mt-0.5">
            Minutes : Seconds
          </div>

          {/* Progress bar */}
          <div className="w-full bg-[#E2E8F0] dark:bg-[#1E364A] h-2 rounded-full mt-3 overflow-hidden">
            <div
              className={`h-full transition-all duration-1000 rounded-full ${
                isUrgent ? 'bg-[#DC2626]' : 'bg-[#1F5F99]'
              }`}
              style={{ width: `${percentRemaining}%` }}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="space-y-2.5">
          <Button
            type="button"
            variant="primary"
            size="lg"
            className="w-full flex items-center justify-center gap-2 text-[15px] font-medium"
            onClick={onStaySignedIn}
            leftIcon={<CheckCircle2 className="w-4 h-4" />}
          >
            Stay signed in
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="md"
            className="w-full flex items-center justify-center gap-2 text-[#6B7A87] hover:text-[#DC2626]"
            onClick={onSignOut}
            leftIcon={<LogOut className="w-4 h-4" />}
          >
            Sign out now
          </Button>
        </div>

        <p className="text-[12px] text-[#8C9BA8] dark:text-[#718496] mt-4">
          Clicking "Stay signed in" will immediately refresh your active session.
        </p>
      </div>
    </div>
  );
};
