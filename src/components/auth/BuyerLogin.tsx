import React, { useState, useEffect } from 'react';
import { AuthLayout } from './AuthLayout';
import { useApp } from '../../context/AppContext';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { DigitCodeInput } from './DigitCodeInput';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  KeyRound,
  AlertCircle,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface BuyerLoginProps {
  onNavigate: (route: string) => void;
}

export const BuyerLogin: React.FC<BuyerLoginProps> = ({ onNavigate }) => {
  const { setRole, setActiveNav } = useApp();

  const [step, setStep] = useState<'credentials' | 'mfa'>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDemoAccessOpen, setIsDemoAccessOpen] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({});

  const [mfaCountdown, setMfaCountdown] = useState(60);

  useEffect(() => {
    if (step === 'mfa' && mfaCountdown > 0) {
      const timer = setInterval(() => setMfaCountdown((c) => c - 1), 1000);
      return () => clearInterval(timer);
    }
  }, [step, mfaCountdown]);

  const handleBlur = (field: 'email' | 'password') => {
    const newErrors = { ...errors };
    if (field === 'email') {
      if (!email.trim()) {
        newErrors.email = 'Enter an official work email like name@council.gov.bw';
      } else if (!/\S+@\S+\.\S+/.test(email)) {
        newErrors.email = 'Enter a valid work email address.';
      } else {
        delete newErrors.email;
      }
    }
    if (field === 'password') {
      if (!password) {
        newErrors.password = 'Enter your account password.';
      } else {
        delete newErrors.password;
      }
    }
    setErrors(newErrors);
  };

  const handleFillDemo = () => {
    setEmail('k.tau@grc.gov.bw');
    setPassword('Procure2026!');
    setErrors({});
  };

  const handleCredentialsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { email?: string; password?: string } = {};
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Enter an official work email like name@council.gov.bw';
    }
    if (!password) {
      newErrors.password = 'Enter your account password.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);
    setErrors({});

    setTimeout(() => {
      setIsLoading(false);
      setStep('mfa');
      setMfaCountdown(60);
    }, 600);
  };

  const handleMfaComplete = (code: string) => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setRole('buyer');
      setActiveNav('dashboard');
    }, 700);
  };

  return (
    <AuthLayout
      leftMessage="Run fair, transparent procurement."
      tagline="Sign in with your official work email and verify your identity with a 6-digit confirmation code."
    >
      <div className="space-y-6">
        {step === 'credentials' ? (
          <>
            <div className="space-y-1.5">
              <h2 className="text-[24px] font-heading font-semibold text-[#10212E] dark:text-white tracking-tight">
                Organization sign in
              </h2>
              <p className="text-[14px] text-[#6B7A87]">
                Sign in to manage your organization's calls, applications, and bids.
              </p>
            </div>

            {errors.general && (
              <div className="p-3.5 bg-rose-50 dark:bg-rose-950/40 text-[#C2412D] border border-rose-200 dark:border-rose-900 rounded-[8px] text-[14px] flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errors.general}</span>
              </div>
            )}

            <form onSubmit={handleCredentialsSubmit} className="space-y-4">
              <Input
                label="Official work email *"
                type="email"
                placeholder="e.g. name@council.gov.bw"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => handleBlur('email')}
                error={errors.email}
                leftIcon={<Mail className="w-4 h-4" />}
                autoComplete="username"
              />

              <div className="space-y-1">
                <Input
                  label="Password *"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  onBlur={() => handleBlur('password')}
                  error={errors.password}
                  leftIcon={<Lock className="w-4 h-4" />}
                  rightIcon={
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="focus:outline-none hover:text-[#10212E] dark:hover:text-white"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  }
                  autoComplete="current-password"
                />
              </div>

              <div className="flex items-center justify-between text-[14px] pt-1">
                <span className="text-[#6B7A87]">Two-step verification required</span>
                <button
                  type="button"
                  onClick={() => onNavigate('forgot-password')}
                  className="font-semibold text-[#1F5F99] dark:text-[#6FAEE0] hover:underline cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full mt-2"
                isLoading={isLoading}
                rightIcon={<ArrowRight />}
              >
                Continue to verification code
              </Button>
            </form>

            {/* Demo Access Panel (Small collapsible) */}
            <div className="border border-[#D5E0EA] dark:border-[#1E364A] rounded-[8px] overflow-hidden text-[14px]">
              <button
                type="button"
                onClick={() => setIsDemoAccessOpen(!isDemoAccessOpen)}
                className="w-full p-3 bg-[#F7FAFD] dark:bg-[#10212E] flex items-center justify-between font-medium text-[#10212E] dark:text-white cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <KeyRound className="w-4 h-4 text-[#1F5F99]" />
                  <span>Demo access (Demo data only)</span>
                </div>
                {isDemoAccessOpen ? <ChevronUp className="w-4 h-4 text-[#6B7A87]" /> : <ChevronDown className="w-4 h-4 text-[#6B7A87]" />}
              </button>

              {isDemoAccessOpen && (
                <div className="p-3 bg-white dark:bg-[#132635] border-t border-[#D5E0EA] dark:border-[#1E364A] space-y-2">
                  <p className="text-[13px] text-[#6B7A87]">
                    Use these sample credentials to test the buyer console:
                  </p>
                  <div className="text-[13px] text-[#43525F] dark:text-[#B2C3D2] space-y-1">
                    <div>Email: <span className="font-semibold text-[#10212E] dark:text-white">k.tau@grc.gov.bw</span></div>
                    <div>Password: <span className="font-semibold text-[#10212E] dark:text-white">Procure2026!</span></div>
                  </div>
                  <button
                    type="button"
                    onClick={handleFillDemo}
                    className="text-[13px] font-semibold text-[#1F5F99] dark:text-[#6FAEE0] hover:underline cursor-pointer"
                  >
                    Auto-fill demo credentials
                  </button>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-[#D5E0EA] dark:border-[#1E364A] text-center text-[14px] text-[#6B7A87]">
              Need to register your organization?{' '}
              <button
                type="button"
                onClick={() => onNavigate('buyer-signup')}
                className="font-semibold text-[#1F5F99] dark:text-[#6FAEE0] hover:underline cursor-pointer"
              >
                Register organization
              </button>
            </div>
          </>
        ) : (
          /* STEP 2: 6-DIGIT CODE INPUT */
          <div className="space-y-6 text-center">
            <div className="w-12 h-12 rounded-[8px] bg-[#EAF2FA] dark:bg-[#162C3E] text-[#1F5F99] dark:text-[#6FAEE0] border border-[#D5E0EA] dark:border-[#1E364A] flex items-center justify-center mx-auto">
              <ShieldCheck className="w-6 h-6" strokeWidth={1.5} />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-[24px] font-heading font-semibold text-[#10212E] dark:text-white tracking-tight">
                Enter verification code
              </h2>
              <p className="text-[14px] text-[#6B7A87] max-w-sm mx-auto">
                We sent a 6-digit code to <strong>{email}</strong>. Enter it below to sign in.
              </p>
            </div>

            <div className="py-2">
              <DigitCodeInput onComplete={handleMfaComplete} disabled={isLoading} />
            </div>

            <div className="pt-2 text-[14px] text-[#6B7A87] space-y-3">
              <div>
                Resend code in{' '}
                <span className="text-[#1F5F99] dark:text-[#6FAEE0] font-semibold tabular-nums">
                  {mfaCountdown}s
                </span>
              </div>

              <div className="flex items-center justify-center gap-3 pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStep('credentials')}
                  leftIcon={<ArrowLeft />}
                >
                  Change email
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleMfaComplete('123456')}
                  isLoading={isLoading}
                >
                  Simulate code entry
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AuthLayout>
  );
};
