import React, { useState, useEffect } from 'react';
import { AuthLayout } from './AuthLayout';
import { useApp } from '../../context/AppContext';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Checkbox } from '../ui/Checkbox';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  KeyRound,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface SupplierLoginProps {
  onNavigate: (route: string) => void;
}

export const SupplierLogin: React.FC<SupplierLoginProps> = ({ onNavigate }) => {
  const { setRole, setActiveNav } = useApp();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [isDemoAccessOpen, setIsDemoAccessOpen] = useState(false);

  // Validation & Lockout State
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({});
  const [failedAttempts, setFailedAttempts] = useState(0);

  const handleBlur = (field: 'email' | 'password') => {
    const newErrors = { ...errors };
    if (field === 'email') {
      if (!email.trim()) {
        newErrors.email = 'Enter an email address like name@company.co.bw';
      } else if (!/\S+@\S+\.\S+/.test(email)) {
        newErrors.email = 'Enter a valid email address like name@company.co.bw';
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
    setEmail('tenders@kopano.co.bw');
    setPassword('Password123!');
    setErrors({});
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: { email?: string; password?: string; general?: string } = {};
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Enter an email address like name@company.co.bw';
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

      // Simulate sign in check
      if (email.toLowerCase() === 'tenders@kopano.co.bw' || password === 'Password123!') {
        setRole('supplier');
        setActiveNav('dashboard');
      } else {
        const nextAttempts = failedAttempts + 1;
        setFailedAttempts(nextAttempts);

        if (nextAttempts >= 5) {
          onNavigate('account-locked');
        } else {
          newErrors.general = `Invalid email or password. Attempt ${nextAttempts} of 5 before account lock.`;
          setErrors(newErrors);
        }
      }
    }, 700);
  };

  return (
    <AuthLayout
      leftMessage="Register once. Bid anywhere."
      tagline="Sign in to your supplier portal to manage documents, track expressions of interest, and submit bids across Botswana."
    >
      <div className="space-y-6">
        <div className="space-y-1.5">
          <h2 className="text-[24px] font-heading font-semibold text-[#10212E] dark:text-white tracking-tight">
            Supplier sign in
          </h2>
          <p className="text-[14px] text-[#6B7A87]">
            Enter your credentials to access your company bids and document vault.
          </p>
        </div>

        {/* Error Alert */}
        {errors.general && (
          <div
            className="p-3.5 rounded-[8px] text-[14px] flex items-start gap-2.5 bg-rose-50 dark:bg-rose-950/40 text-[#C2412D] border border-rose-200 dark:border-rose-900"
            role="alert"
          >
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" strokeWidth={1.5} />
            <span>{errors.general}</span>
          </div>
        )}

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Email address *"
            type="email"
            placeholder="e.g. name@company.co.bw"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={() => handleBlur('email')}
            error={errors.email}
            disabled={isLoading}
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
              disabled={isLoading}
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
            <Checkbox
              checked={keepSignedIn}
              onChange={(e) => setKeepSignedIn(e.target.checked)}
              label="Keep me signed in"
            />

            <button
              type="button"
              onClick={() => onNavigate('forgot-password')}
              className="text-[14px] text-[#1F5F99] dark:text-[#6FAEE0] hover:underline font-semibold cursor-pointer"
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
            Sign in
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
                Use these demo credentials to test the supplier portal:
              </p>
              <div className="text-[13px] text-[#43525F] dark:text-[#B2C3D2] space-y-1">
                <div>Email: <span className="font-semibold text-[#10212E] dark:text-white">tenders@kopano.co.bw</span></div>
                <div>Password: <span className="font-semibold text-[#10212E] dark:text-white">Password123!</span></div>
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

        {/* Bottom Switcher Link */}
        <div className="pt-4 border-t border-[#D5E0EA] dark:border-[#1E364A] text-center text-[14px] text-[#6B7A87]">
          Don't have an account?{' '}
          <button
            type="button"
            onClick={() => onNavigate('supplier-signup')}
            className="font-semibold text-[#1F5F99] dark:text-[#6FAEE0] hover:underline cursor-pointer"
          >
            Register company
          </button>
        </div>
      </div>
    </AuthLayout>
  );
};
