import React, { useState } from 'react';
import { Logo } from '../common/Logo';
import { useApp } from '../../context/AppContext';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { DigitCodeInput } from './DigitCodeInput';
import {
  ShieldAlert,
  Lock,
  Mail,
  Eye,
  EyeOff,
  ArrowRight,
  ShieldCheck,
  KeyRound,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface AdminLoginProps {
  onNavigate: (route: string) => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onNavigate }) => {
  const { setRole, setActiveNav } = useApp();

  const [step, setStep] = useState<'credentials' | 'mfa'>('credentials');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isDemoAccessOpen, setIsDemoAccessOpen] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  const handleFillDemo = () => {
    setEmail('admin@bidready360.gov.bw');
    setPassword('SuperAdmin2026!');
    setErrors({});
  };

  const handleCredentialsSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: { email?: string; password?: string } = {};
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Enter an official administrator email address.';
    }
    if (!password) {
      newErrors.password = 'Enter your administrator password.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setStep('mfa');
    }, 600);
  };

  const handleMfaComplete = (code: string) => {
    setIsLoading(true);
    setTimeout(() => {
      setIsLoading(false);
      setRole('admin');
      setActiveNav('admin-dashboard');
    }, 700);
  };

  return (
    <div className="min-h-screen bg-[#F7FAFD] dark:bg-[#0D1A25] text-[#10212E] dark:text-white flex flex-col justify-center p-4 sm:p-8">
      {/* Centered Single Card (No Marketing Panel per requirements) */}
      <div className="max-w-[440px] w-full mx-auto space-y-6">
        <div className="text-center space-y-2">
          <Logo theme="light" size="lg" className="mx-auto" />
          <h1 className="text-[26px] font-heading font-semibold text-[#10212E] dark:text-white tracking-tight">
            Platform admin sign in
          </h1>
        </div>

        {/* Short notice per user requirement: "Restricted access. Activity is recorded." */}
        <div className="p-3.5 rounded-[8px] bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-[14px] text-[#C2412D] flex items-center gap-2.5">
          <ShieldAlert className="w-4 h-4 shrink-0" strokeWidth={1.5} />
          <span>Restricted access. Activity is recorded.</span>
        </div>

        {/* Form Card */}
        <div className="bg-white dark:bg-[#132635] border border-[#D5E0EA] dark:border-[#1E364A] rounded-[12px] p-6 sm:p-8 shadow-none space-y-6">
          {step === 'credentials' ? (
            <form onSubmit={handleCredentialsSubmit} className="space-y-4">
              <Input
                label="Administrator email *"
                type="email"
                placeholder="admin@bidready360.gov.bw"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={errors.email}
                leftIcon={<Mail className="w-4 h-4" />}
                autoComplete="username"
              />

              <div className="space-y-1">
                <Input
                  label="Password *"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter administrator password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
          ) : (
            <div className="space-y-6 text-center">
              <div className="w-12 h-12 rounded-[8px] bg-[#EAF2FA] dark:bg-[#162C3E] text-[#1F5F99] dark:text-[#6FAEE0] border border-[#D5E0EA] dark:border-[#1E364A] flex items-center justify-center mx-auto">
                <ShieldCheck className="w-6 h-6" strokeWidth={1.5} />
              </div>

              <div className="space-y-1.5">
                <h3 className="text-[20px] font-heading font-semibold text-[#10212E] dark:text-white">
                  Enter 6-digit administrator code
                </h3>
                <p className="text-[14px] text-[#6B7A87]">
                  Enter the code from your registered security key or device.
                </p>
              </div>

              <DigitCodeInput onComplete={handleMfaComplete} disabled={isLoading} />

              <div className="pt-2 flex items-center justify-center gap-3">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setStep('credentials')}
                  leftIcon={<ArrowLeft />}
                >
                  Back
                </Button>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleMfaComplete('999888')}
                  isLoading={isLoading}
                >
                  Simulate code entry
                </Button>
              </div>
            </div>
          )}

          {/* Collapsible Demo Access */}
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
                <div className="text-[13px] text-[#43525F] dark:text-[#B2C3D2] space-y-1">
                  <div>Email: <span className="font-semibold text-[#10212E] dark:text-white">admin@bidready360.gov.bw</span></div>
                  <div>Password: <span className="font-semibold text-[#10212E] dark:text-white">SuperAdmin2026!</span></div>
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
        </div>

        {/* Minimal Footer (No external links) */}
        <div className="text-center text-[13px] text-[#6B7A87]">
          <span>BidReady360 Platform Administration Desk</span>
        </div>
      </div>
    </div>
  );
};
