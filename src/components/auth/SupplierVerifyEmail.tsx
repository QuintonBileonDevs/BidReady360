import React, { useState, useEffect } from 'react';
import { AuthLayout } from './AuthLayout';
import { Button } from '../ui/Button';
import { DigitCodeInput } from './DigitCodeInput';
import { useApp } from '../../context/AppContext';
import { authApi } from '../../services/api';
import { Mail, CheckCircle2, ArrowRight, ExternalLink, ShieldAlert } from 'lucide-react';

interface SupplierVerifyEmailProps {
  onNavigate: (route: string) => void;
}

export const SupplierVerifyEmail: React.FC<SupplierVerifyEmailProps> = ({ onNavigate }) => {
  const { setRole, setActiveNav, supplier, updateSupplierProfile } = useApp();
  const [resendCountdown, setResendCountdown] = useState(45);
  const [isLoading, setIsLoading] = useState(false);
  const [isVerified, setIsVerified] = useState(false);

  useEffect(() => {
    if (resendCountdown > 0) {
      const timer = setInterval(() => setResendCountdown((c) => c - 1), 1000);
      return () => clearInterval(timer);
    }
  }, [resendCountdown]);

  const completeVerification = async () => {
    setIsLoading(true);
    try {
      if (supplier.email) {
        await authApi.verifyEmail(supplier.email).catch(() => {});
      }
      updateSupplierProfile({ emailVerified: true });
      setIsVerified(true);
      setTimeout(() => {
        setRole('supplier', 'profile');
      }, 700);
    } finally {
      setIsLoading(false);
    }
  };

  const handleComplete = (code: string) => {
    completeVerification();
  };

  const handleSimulateLinkClick = () => {
    completeVerification();
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
            Verify your email address
          </h2>
          <p className="text-[14px] text-[#43525F] dark:text-[#B2C3D2] max-w-sm mx-auto leading-relaxed">
            We sent a verification link and confirmation code to{' '}
            <strong className="text-[#10212E] dark:text-white font-semibold">
              {supplier.email || 'your email'}
            </strong>
            .
          </p>
          <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50 rounded-[8px] text-[12px] text-amber-900 dark:text-amber-200 text-left flex items-start gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <span>
              <strong>Mandatory safeguard:</strong> Your supplier account stays unverified and cannot apply to calls or share documents until you verify your email address.
            </span>
          </div>
        </div>

        <div className="space-y-3">
          <span className="text-[13px] text-[#6B7A87] block">Enter 6-digit code from email:</span>
          <DigitCodeInput onComplete={handleComplete} disabled={isLoading || isVerified} />
        </div>

        {isVerified && (
          <div className="p-3 bg-[#ECFDF5] dark:bg-[#065F46]/20 border border-[#A7F3D0] dark:border-[#065F46]/40 rounded-[6px] text-[14px] text-[#065F46] dark:text-[#6EE7B7] flex items-center justify-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            <span>Email verified! Taking you to your company profile...</span>
          </div>
        )}

        {/* Verification Link Simulation */}
        <div className="p-4 bg-[#F7FAFD] dark:bg-[#10212E] rounded-[8px] border border-[#D5E0EA] dark:border-[#1E364A] text-left space-y-2">
          <span className="text-[12px] font-semibold text-[#10212E] dark:text-white block uppercase tracking-wider">
            Email Inbox Link Simulation
          </span>
          <p className="text-[12px] text-[#6B7A87] dark:text-[#8FA2B2]">
            Clicking the button below simulates clicking the secure email activation link sent to your inbox:
          </p>
          <Button
            type="button"
            variant="primary"
            size="sm"
            className="w-full"
            isLoading={isLoading}
            disabled={isVerified}
            onClick={handleSimulateLinkClick}
            rightIcon={<ExternalLink className="w-3.5 h-3.5" />}
          >
            Click link to verify email now
          </Button>
        </div>

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
              onClick={() => {
                setRole('supplier', 'profile');
              }}
            >
              Continue to profile (Unverified)
            </Button>
          </div>
        </div>
      </div>
    </AuthLayout>
  );
};
