import React, { useState } from 'react';
import { AuthLayout } from './AuthLayout';
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
  AlertCircle,
  ShieldCheck,
} from 'lucide-react';

interface SupplierLoginProps {
  onNavigate: (route: string) => void;
}

export const SupplierLogin: React.FC<SupplierLoginProps> = ({ onNavigate }) => {
  const { setRole, setActiveNav, updateSupplierProfile, loginSuccess } = useApp();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  // MFA Challenge State
  const [isMfaRequired, setIsMfaRequired] = useState(false);
  const [mfaUserId, setMfaUserId] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [mfaError, setMfaError] = useState('');

  // Validation & Lockout State
  const [errors, setErrors] = useState<{ email?: string; password?: string; general?: string }>({});

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

  const handleSubmit = async (e: React.FormEvent) => {
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

    try {
      const res = await authApi.login(email.trim().toLowerCase(), password);

      if (res.requiresMfa && res.mfaUserId) {
        setIsMfaRequired(true);
        setMfaUserId(res.mfaUserId);
        return;
      }

      const supplierMembership = res.user?.memberships?.find((m: any) => m.tenantType === 'supplier');
      if (supplierMembership) {
        updateSupplierProfile({
          id: supplierMembership.tenantId,
          legalName: supplierMembership.tenantName,
          tradingName: supplierMembership.tenantName,
          email: res.user.email,
        });
      }

      loginSuccess(
        {
          user: res.user,
          activeTenant: supplierMembership || {
            tenantType: 'supplier',
            tenantId: 'sup-1',
            tenantName: res.user?.fullName || 'Registered Supplier',
          },
          token: res.token,
        },
        'supplier'
      );
    } catch (err: any) {
      console.error('[LOGIN ERROR]', err);
      const msg = err.message || 'Invalid email or password.';
      if (msg.toLowerCase().includes('locked')) {
        onNavigate('account-locked');
      } else {
        setErrors({ general: msg });
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleVerifyMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!totpCode || totpCode.length < 6) {
      setMfaError('Enter the 6-digit code from your authenticator app.');
      return;
    }

    setIsLoading(true);
    setMfaError('');

    try {
      const mfaRes = await authApi.verifyMfa(mfaUserId, totpCode.trim());
      const supplierMembership = mfaRes.user?.memberships?.find((m: any) => m.tenantType === 'supplier');
      loginSuccess(
        {
          user: mfaRes.user,
          activeTenant: supplierMembership || {
            tenantType: 'supplier',
            tenantId: 'sup-1',
            tenantName: mfaRes.user?.fullName || 'Registered Supplier',
          },
          token: mfaRes.token,
        },
        'supplier'
      );
    } catch (err: any) {
      setMfaError(err.message || 'Invalid or expired MFA code.');
    } finally {
      setIsLoading(false);
    }
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

        {/* MFA Challenge View */}
        {isMfaRequired ? (
          <form onSubmit={handleVerifyMfa} className="space-y-4">
            <div className="p-4 bg-[#EAF2FA] dark:bg-[#162C3E] rounded-[8px] border border-[#1F5F99]/20 space-y-2">
              <div className="flex items-center gap-2 text-[#1F5F99] dark:text-[#6FAEE0] font-semibold text-[14px]">
                <ShieldCheck className="w-5 h-5" />
                <span>Multi-Factor Authentication Required</span>
              </div>
              <p className="text-[13px] text-[#43525F] dark:text-[#B2C3D2]">
                Enter the 6-digit verification code generated by your Authenticator app.
              </p>
            </div>

            {mfaError && (
              <div className="p-3 bg-rose-50 text-[#C2412D] text-[13px] rounded-[6px] border border-rose-200">
                {mfaError}
              </div>
            )}

            <Input
              label="6-Digit Verification Code *"
              type="text"
              maxLength={6}
              placeholder="123456"
              value={totpCode}
              onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
              disabled={isLoading}
              autoFocus
            />

            <Button type="submit" variant="primary" size="lg" className="w-full mt-2" isLoading={isLoading}>
              Verify & Complete Sign In
            </Button>

            <button
              type="button"
              onClick={() => {
                setIsMfaRequired(false);
                setTotpCode('');
                setMfaError('');
              }}
              className="w-full text-center text-[13px] text-[#6B7A87] hover:underline cursor-pointer"
            >
              Back to email & password
            </button>
          </form>
        ) : (
          /* Login Form */
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
        )}

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
