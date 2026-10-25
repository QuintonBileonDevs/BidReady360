import React, { useState } from 'react';
import { AuthLayout } from './AuthLayout';
import { DigitCodeInput } from './DigitCodeInput';
import { useApp } from '../../context/AppContext';
import { authApi } from '../../services/api';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Checkbox } from '../ui/Checkbox';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  ShieldCheck,
} from 'lucide-react';

interface SupplierLoginProps {
  onNavigate: (route: string) => void;
}

export const SupplierLogin: React.FC<SupplierLoginProps> = ({ onNavigate }) => {
  const { loginSuccess } = useApp();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  // MFA Challenge State
  const [isMfaRequired, setIsMfaRequired] = useState(false);
  const [mfaUserId, setMfaUserId] = useState('');

  // Validation & Lockout State
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({});
  const [isUnverified, setIsUnverified] = useState(false);

  const handleBlur = (field: 'email' | 'password') => {
    const newErrors = { ...errors };
    if (field === 'email') {
      if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) {
        newErrors.email = 'Enter a valid email address.';
      } else {
        delete newErrors.email;
      }
    }
    if (field === 'password') {
      if (!password) {
        newErrors.password = 'Enter your password.';
      } else {
        delete newErrors.password;
      }
    }
    setErrors(newErrors);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    const newErrors: { email?: string; password?: string; general?: string } = {};
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) {
      newErrors.email = 'Enter a valid email address.';
    }
    if (!password) {
      newErrors.password = 'Enter your password.';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setIsLoading(true);
    setErrors({});
    setIsUnverified(false);

    try {
      const res = await authApi.login(email.trim().toLowerCase(), password);
      if (res.requiresMfa && res.mfaUserId) {
        setIsMfaRequired(true);
        setMfaUserId(res.mfaUserId);
        return;
      }

      const memberships = res.user?.memberships || [];
      const orgMembership = memberships.find((m: any) => m.tenantType === 'organization');
      const supplierMembership = memberships.find((m: any) => m.tenantType === 'supplier');
      const activeTenant = orgMembership || supplierMembership || memberships[0] || {
        tenantType: 'supplier',
        tenantId: 'sup-1',
        tenantName: res.user?.fullName || 'User Account',
      };
      const determinedRole = res.user?.isPlatformAdmin
        ? 'admin'
        : activeTenant?.tenantType === 'organization'
        ? 'buyer'
        : 'supplier';

      loginSuccess(
        {
          user: res.user,
          activeTenant,
          token: res.token,
          profileSummary: (res as any).profileSummary,
        },
        determinedRole
      );
    } catch (err: any) {
      const msg = err.message || '';
      if (msg.toLowerCase().includes('verify') || err.code === 'UNVERIFIED_EMAIL') {
        setIsUnverified(true);
        setErrors({ general: 'Please verify your email address before signing in.' });
      } else {
        setErrors({ general: err.message || 'Email or password is incorrect.' });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleMfaComplete = async (code: string) => {
    setIsLoading(true);
    setErrors({});

    try {
      const res = await authApi.verifyMfa(mfaUserId, code.trim());
      const memberships = res.user?.memberships || [];
      const orgMembership = memberships.find((m: any) => m.tenantType === 'organization');
      const supplierMembership = memberships.find((m: any) => m.tenantType === 'supplier');
      const activeTenant = orgMembership || supplierMembership || memberships[0] || {
        tenantType: 'supplier',
        tenantId: 'sup-1',
        tenantName: res.user?.fullName || 'User Account',
      };
      const determinedRole = res.user?.isPlatformAdmin
        ? 'admin'
        : activeTenant?.tenantType === 'organization'
        ? 'buyer'
        : 'supplier';

      loginSuccess(
        {
          user: res.user,
          activeTenant,
          token: res.token,
          profileSummary: (res as any).profileSummary,
        },
        determinedRole
      );
    } catch (err: any) {
      setErrors({ general: err.message || 'Invalid or expired verification code.' });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      leftMessage="Register once. Bid anywhere."
      tagline="Access your profile, manage documents, and participate in procurement across Botswana."
      onBack={() => onNavigate('about')}
    >
      <div className="space-y-6">
        {!isMfaRequired ? (
          <>
            {/* Header Block */}
            <div className="space-y-1.5">
              <h2 className="text-[24px] font-heading font-semibold text-[#10212E] dark:text-white tracking-tight">
                Sign in
              </h2>
              <p className="text-[14px] text-[#6B7A87]">
                Enter your credentials to access your account.
              </p>
            </div>

            {/* General Error Notice */}
            {errors.general && (
              <div className="p-3.5 rounded-[8px] bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-[14px] text-[#C2412D] flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errors.general}</span>
              </div>
            )}

            {/* Unverified Email Warning */}
            {isUnverified && (
              <div className="p-3.5 rounded-[8px] bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-[14px] text-[#92400E] dark:text-[#FCD34D] space-y-2">
                <div className="flex items-center gap-2 font-semibold">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>Email verification pending</span>
                </div>
                <p className="text-[13px] text-[#78350F] dark:text-[#FDE68A] leading-snug">
                  Please verify your email address to activate your account.
                </p>
                <button
                  type="button"
                  onClick={() => onNavigate('supplier-verify-email')}
                  className="text-xs font-semibold underline text-[#92400E] dark:text-[#FCD34D] hover:opacity-80 cursor-pointer"
                >
                  Verify email now →
                </button>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Email address *"
                type="email"
                placeholder="name@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => handleBlur('email')}
                error={errors.email}
                leftIcon={<Mail className="w-4 h-4" />}
                autoComplete="email"
                required
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
                      className="focus:outline-none hover:text-[#10212E] dark:hover:text-white cursor-pointer"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  }
                  autoComplete="current-password"
                  required
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                <Checkbox
                  label="Keep me signed in"
                  checked={keepSignedIn}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => setKeepSignedIn(e.target.checked)}
                />
                <button
                  type="button"
                  onClick={() => onNavigate('forgot-password')}
                  className="text-xs font-semibold text-[#1F5F99] dark:text-[#6FAEE0] hover:underline cursor-pointer"
                >
                  Forgot password?
                </button>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full mt-2"
                disabled={isLoading}
                isLoading={isLoading}
                rightIcon={!isLoading ? <ArrowRight className="w-4 h-4" /> : undefined}
              >
                {isLoading ? 'Signing in...' : 'Sign in'}
              </Button>
            </form>

            {/* Bottom Switcher */}
            <div className="pt-4 border-t border-[#D5E0EA] dark:border-[#1E364A] text-center text-[14px] text-[#6B7A87]">
              Don't have an account?{' '}
              <button
                type="button"
                onClick={() => onNavigate('supplier-signup')}
                className="font-semibold text-[#1F5F99] dark:text-[#6FAEE0] hover:underline cursor-pointer"
              >
                Sign up
              </button>
            </div>
          </>
        ) : (
          /* MFA Challenge View */
          <div className="space-y-6 text-center">
            <div className="w-12 h-12 rounded-[8px] bg-[#EAF2FA] dark:bg-[#1E364A] text-[#1F5F99] dark:text-[#6FAEE0] flex items-center justify-center mx-auto">
              <ShieldCheck className="w-6 h-6" strokeWidth={1.5} />
            </div>

            <div className="space-y-1.5">
              <h2 className="text-[24px] font-heading font-semibold text-[#10212E] dark:text-white tracking-tight">
                Enter verification code
              </h2>
              <p className="text-[14px] text-[#6B7A87] max-w-sm mx-auto">
                We sent a 6-digit security code to <strong>{email}</strong>. Enter it below to complete sign in.
              </p>
            </div>

            {errors.general && (
              <div className="p-3.5 rounded-[8px] bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-[14px] text-[#C2412D] flex items-center gap-2.5 text-left">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errors.general}</span>
              </div>
            )}

            <div className="py-2">
              <DigitCodeInput onComplete={handleMfaComplete} disabled={isLoading} />
            </div>

            <div className="pt-2 text-[14px] text-[#6B7A87] space-y-3">
              <div className="flex items-center justify-center gap-3 pt-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsMfaRequired(false)}
                  leftIcon={<ArrowLeft className="w-4 h-4" />}
                >
                  Back to sign in
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

export const Login = SupplierLogin;

