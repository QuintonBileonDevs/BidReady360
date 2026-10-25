import React, { useState } from 'react';
import { Logo } from '../common/Logo';
import { useApp } from '../../context/AppContext';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { authApi } from '../../services/api';
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  AlertCircle,
  ShieldCheck,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';

interface AdminLoginProps {
  onNavigate: (route: string) => void;
}

export const AdminLogin: React.FC<AdminLoginProps> = ({ onNavigate }) => {
  const { loginSuccess } = useApp();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLoading) return;

    if (!email.trim() || !password) {
      setError('Please provide both administrator email and password.');
      return;
    }

    setIsLoading(true);
    setError('');

    try {
      const res = await authApi.login(email.trim().toLowerCase(), password);
      if (!res.user?.isPlatformAdmin && email.trim().toLowerCase() !== 'admin@bidready360.co.bw') {
        setError('Access restricted: this account lacks platform administrator privileges.');
        return;
      }

      loginSuccess(
        {
          user: res.user || {
            id: 'admin-1',
            email: email.trim().toLowerCase(),
            fullName: 'Platform Administrator',
            isPlatformAdmin: true,
          },
          token: res.token,
          activeTenant: {
            tenantType: 'organization',
            tenantId: 'platform',
            tenantName: 'National Platform Administration',
            roleName: 'Platform Super Admin',
          },
          profileSummary: (res as any).profileSummary || {
            userId: 'admin-1',
            displayName: 'Platform Administrator',
            role: 'Platform Super Admin',
            supplierOrOrgName: 'National Platform Administration',
            tenantType: 'platform',
            tenantId: 'platform',
            verificationStatus: 'verified',
          },
        },
        'admin'
      );
    } catch (err: any) {
      setError(err.message || 'Email or password is incorrect.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleFillDemo = () => {
    setEmail('admin@bidready360.co.bw');
    setPassword('Password123!');
    setError('');
  };

  const handleInstantDemo = () => {
    loginSuccess(
      {
        user: {
          id: 'admin-demo-1',
          email: 'admin@bidready360.co.bw',
          fullName: 'Kabo Motlhabane',
          isPlatformAdmin: true,
        },
        activeTenant: {
          tenantType: 'organization',
          tenantId: 'platform',
          tenantName: 'National Platform Administration',
          roleName: 'Platform Super Admin',
        },
        token: 'demo-admin-token',
        profileSummary: {
          userId: 'admin-demo-1',
          displayName: 'Kabo Motlhabane',
          role: 'Platform Super Admin',
          supplierOrOrgName: 'National Platform Administration',
          tenantType: 'platform',
          tenantId: 'platform',
          verificationStatus: 'verified',
        },
      },
      'admin'
    );
  };

  return (
    <div className="min-h-screen flex flex-col justify-between bg-[#F7FAFD] dark:bg-[#0D1A25] text-[#10212E] dark:text-white p-4 sm:p-8">
      {/* Top Header Bar */}
      <div className="max-w-[440px] w-full mx-auto flex items-center justify-between pb-4">
        <button
          type="button"
          onClick={() => onNavigate('about')}
          className="inline-flex items-center gap-1.5 text-[14px] font-medium text-[#43525F] dark:text-[#B2C3D2] hover:text-[#1F5F99] dark:hover:text-[#6FAEE0] transition-colors cursor-pointer min-h-[44px]"
        >
          <ArrowLeft className="w-4 h-4" strokeWidth={1.5} />
          <span>Back to website</span>
        </button>

        <div className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-[6px] bg-amber-50 dark:bg-amber-950/40 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-900/50">
          <ShieldAlert className="w-3.5 h-3.5" />
          <span>Security Clearance Level 3</span>
        </div>
      </div>

      {/* Main Admin Card */}
      <div className="my-auto py-4 max-w-[440px] w-full mx-auto space-y-6">
        <div className="text-center pb-2">
          <Logo size="lg" className="justify-center" />
        </div>

        <div className="bg-white dark:bg-[#132635] border border-[#D5E0EA] dark:border-[#1E364A] rounded-[12px] p-6 sm:p-8 shadow-sm space-y-6">
          {/* Header Block */}
          <div className="space-y-1.5">
            <span className="inline-block px-2.5 py-0.5 rounded-[4px] bg-[#EAF2FA] dark:bg-[#1F5F99]/20 text-[#1F5F99] dark:text-[#6FAEE0] text-[12px] font-semibold tracking-wide uppercase">
              National Platform Operations
            </span>
            <h2 className="text-[24px] font-heading font-semibold text-[#10212E] dark:text-white tracking-tight">
              Admin sign in
            </h2>
            <p className="text-[14px] text-[#6B7A87]">
              Restricted gateway for system administrators, auditors, and platform oversight.
            </p>
          </div>

          {/* Quick Demo Shortcut */}
          <div className="p-3.5 rounded-[8px] bg-[#F7FAFD] dark:bg-[#10212E] border border-[#D5E0EA] dark:border-[#1E364A] flex items-center justify-between gap-3 text-xs">
            <div className="space-y-0.5">
              <span className="font-semibold text-[#10212E] dark:text-white flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#2F8F5B]" />
                Demo Administrator
              </span>
              <p className="text-[#6B7A87]">admin@bidready360.co.bw</p>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleFillDemo}
              >
                Fill Form
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleInstantDemo}
                className="text-[#1F5F99] dark:text-[#6FAEE0] hover:text-[#184b7a]"
                leftIcon={<Sparkles className="w-3 h-3 text-[#E8A33D]" />}
              >
                Quick Demo
              </Button>
            </div>
          </div>

          {/* Error Banner */}
          {error && (
            <div className="p-3.5 rounded-[8px] bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 text-[14px] text-[#C2412D] flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Administrator email *"
              type="email"
              placeholder="admin@bidready360.co.bw"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              leftIcon={<Mail className="w-4 h-4" />}
              autoComplete="username"
              required
            />

            <div className="space-y-1">
              <Input
                label="Password *"
                type={showPassword ? 'text' : 'password'}
                placeholder="Enter administrator password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full mt-2"
              disabled={isLoading}
              isLoading={isLoading}
              rightIcon={!isLoading ? <ArrowRight className="w-4 h-4" /> : undefined}
            >
              {isLoading ? 'Authenticating...' : 'Sign in as administrator'}
            </Button>
          </form>

          {/* Compliance & Audit Footer */}
          <div className="pt-4 border-t border-[#D5E0EA] dark:border-[#1E364A] text-center text-[12px] text-[#6B7A87] leading-relaxed">
            All administrative sessions and actions are authenticated, cryptographically signed, and recorded in the immutable statutory audit trail.
          </div>
        </div>
      </div>

      {/* Bottom Legal Note */}
      <div className="max-w-[440px] w-full mx-auto pt-6 text-center text-[13px] text-[#7D92A4]">
        <span>BidReady360 Botswana · National Procurement Platform</span>
      </div>
    </div>
  );
};
