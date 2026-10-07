import React, { useState, useEffect } from 'react';
import { AuthLayout } from './AuthLayout';
import { Button } from '../ui/Button';
import { ShieldAlert, ArrowRight, RotateCcw } from 'lucide-react';

interface AccountLockedProps {
  onNavigate: (route: string) => void;
  initialCountdown?: number;
}

export const AccountLocked: React.FC<AccountLockedProps> = ({
  onNavigate,
  initialCountdown = 60,
}) => {
  const [countdown, setCountdown] = useState(initialCountdown);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setInterval(() => setCountdown((c) => c - 1), 1000);
      return () => clearInterval(timer);
    }
  }, [countdown]);

  return (
    <AuthLayout
      leftMessage="Account security protection"
      tagline="To protect verified procurement accounts, access is temporarily locked after consecutive unsuccessful sign-in attempts."
    >
      <div className="space-y-6 text-center">
        <div className="w-12 h-12 rounded-[8px] bg-rose-50 dark:bg-rose-950/40 text-[#C2412D] border border-rose-200 dark:border-rose-900 flex items-center justify-center mx-auto">
          <ShieldAlert className="w-6 h-6" strokeWidth={1.5} />
        </div>

        <div className="space-y-2">
          <h2 className="text-[24px] font-heading font-semibold text-[#10212E] dark:text-white tracking-tight">
            Account temporarily locked
          </h2>
          <p className="text-[14px] text-[#43525F] dark:text-[#B2C3D2] leading-relaxed">
            We detected five unsuccessful sign-in attempts. Your account has been temporarily locked to prevent unauthorized access.
          </p>
        </div>

        <div className="p-4 rounded-[8px] bg-[#F7FAFD] dark:bg-[#10212E] border border-[#D5E0EA] dark:border-[#1E364A] space-y-1">
          <span className="text-[13px] text-[#6B7A87] block">Unlock cooldown</span>
          <div className="text-[20px] font-heading font-semibold text-[#10212E] dark:text-white tabular-nums">
            {countdown > 0 ? `Retry available in ${countdown}s` : 'Cooldown completed'}
          </div>
        </div>

        <div className="space-y-3 pt-2">
          <Button
            type="button"
            variant="primary"
            size="lg"
            className="w-full"
            disabled={countdown > 0}
            onClick={() => onNavigate('supplier-login')}
          >
            {countdown > 0 ? `Locked (${countdown}s)` : 'Return to sign in'}
          </Button>

          <div className="text-[14px] text-[#6B7A87]">
            Forgotten your credentials?{' '}
            <button
              type="button"
              onClick={() => onNavigate('forgot-password')}
              className="font-semibold text-[#1F5F99] dark:text-[#6FAEE0] hover:underline cursor-pointer"
            >
              Reset password
            </button>
          </div>
        </div>
      </div>
    </AuthLayout>
  );
};
