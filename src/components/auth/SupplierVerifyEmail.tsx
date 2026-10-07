import React, { useState, useEffect } from 'react';
import { AuthLayout } from './AuthLayout';
import { Button } from '../ui/Button';
import { DigitCodeInput } from './DigitCodeInput';
import { Mail, CheckCircle2, ArrowRight } from 'lucide-react';

interface SupplierVerifyEmailProps {
  onNavigate: (route: string) => void;
}

export const SupplierVerifyEmail: React.FC<SupplierVerifyEmailProps> = ({ onNavigate }) => {
  const [resendCountdown, setResendCountdown] = useState(45);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerified, setIsVerified] = useState(false);

  useEffect(() => {
    if (resendCountdown > 0) {
      const timer = setInterval(() => setResendCountdown((c) => c - 1), 1000);
      return () => clearInterval(timer);
    }
  }, [resendCountdown]);

  const handleComplete = (code: string) => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setIsVerified(true);
      setTimeout(() => {
        onNavigate('supplier-welcome');
      }, 700);
    }, 700);
  };

  const handleResend = () => {
    setResendCountdown(45);
  };

  return (
    <AuthLayout
      leftMessage="Register once. Bid anywhere."
      tagline="Check your email to verify your address and activate your supplier company account."
    >
      <div className="space-y-6 text-center">
        <div className="w-12 h-12 rounded-[8px] bg-[#EAF2FA] dark:bg-[#162C3E] text-[#1F5F99] dark:text-[#6FAEE0] border border-[#D5E0EA] dark:border-[#1E364A] flex items-center justify-center mx-auto">
          <Mail className="w-6 h-6" strokeWidth={1.5} />
        </div>

        <div className="space-y-2">
          <h2 className="text-[24px] font-heading font-semibold text-[#10212E] dark:text-white tracking-tight">
            Check your email
          </h2>
          <p className="text-[14px] text-[#6B7A87] max-w-sm mx-auto leading-relaxed">
            We have sent a 6-digit confirmation code to your email address. Enter the code below to verify your account.
          </p>
        </div>

        <div className="py-2">
          <DigitCodeInput onComplete={handleComplete} disabled={isLoading || isVerified} />
        </div>

        {isVerified && (
          <div className="p-3 bg-[#ECFDF5] dark:bg-[#065F46]/20 border border-[#A7F3D0] dark:border-[#065F46]/40 rounded-[6px] text-[14px] text-[#065F46] dark:text-[#6EE7B7] flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>Email verified. Taking you to your welcome screen...</span>
          </div>
        )}

        <div className="pt-2 text-[14px] text-[#6B7A87] space-y-3">
          <div>
            Didn't receive the email?{' '}
            {resendCountdown > 0 ? (
              <span className="text-[#1F5F99] dark:text-[#6FAEE0] font-semibold tabular-nums">
                Resend in {resendCountdown}s
              </span>
            ) : (
              <button
                type="button"
                onClick={handleResend}
                className="font-semibold text-[#1F5F99] dark:text-[#6FAEE0] hover:underline cursor-pointer"
              >
                Resend code
              </button>
            )}
          </div>

          <div className="pt-2 border-t border-[#D5E0EA] dark:border-[#1E364A]">
            <Button
              type="button"
              variant="secondary"
              size="md"
              className="w-full"
              onClick={() => onNavigate('supplier-welcome')}
            >
              Continue to welcome screen
            </Button>
          </div>
        </div>
      </div>
    </AuthLayout>
  );
};
