import React, { useState, useEffect } from 'react';
import { AuthLayout } from './AuthLayout';
import { useApp } from '../../context/AppContext';
import { authApi } from '../../services/api';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { PasswordRulesCheck } from './PasswordRulesCheck';
import {
  Building2,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  User,
  Loader2,
  AlertCircle,
} from 'lucide-react';

interface AcceptInvitationProps {
  onNavigate: (route: string) => void;
}

interface LiveInvitationDetails {
  id: string;
  email: string;
  tenantType: 'supplier' | 'organization';
  tenantId: string;
  tenantName: string;
  roleId: string;
  roleName: string;
  inviterName: string;
  expiresAt: string;
}

export const AcceptInvitation: React.FC<AcceptInvitationProps> = ({ onNavigate }) => {
  const { loginSuccess, setActiveNav } = useApp();

  const [token, setToken] = useState<string>(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('inviteToken') || params.get('token') || '';
  });
  const [invitation, setInvitation] = useState<LiveInvitationDetails | null>(null);
  const [loadingInvite, setLoadingInvite] = useState<boolean>(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchInvitation = async (inviteToken: string) => {
    const clean = inviteToken.trim();
    if (!clean) {
      setLoadingInvite(false);
      setInvitation(null);
      setLoadError('No invitation token was found in your link. Paste your invitation token below or request a new invite.');
      return;
    }

    setLoadingInvite(true);
    setLoadError(null);
    try {
      const data = await authApi.getInvitation(clean);
      setInvitation(data);
    } catch (err: any) {
      setInvitation(null);
      setLoadError(err?.message || 'This invitation link is invalid, already used, or has expired.');
    } finally {
      setLoadingInvite(false);
    }
  };

  useEffect(() => {
    fetchInvitation(token);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token.trim()) {
      setError('Invitation token is required.');
      return;
    }
    if (password.length < 10) {
      setError('Password must meet all minimum criteria (at least 10 characters).');
      return;
    }

    setIsLoading(true);
    setError(null);
    try {
      const res = await authApi.acceptInvite({
        token: token.trim(),
        password,
        fullName: fullName.trim() || undefined,
      });
      if (!res?.user) {
        throw new Error('Invitation accepted, but no active user session was returned.');
      }
      const targetRole = res.user.isPlatformAdmin
        ? 'admin'
        : res.activeTenant?.tenantType === 'organization'
        ? 'buyer'
        : 'supplier';
      loginSuccess({ ...res, user: res.user }, targetRole);
    } catch (err: any) {
      setError(err?.message || 'Unable to accept invitation. Please verify your token and password.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthLayout
      leftMessage="Accept workspace invitation"
      tagline="Join your team's procurement workspace on BidReady360."
    >
      <div className="space-y-6">
        <div className="space-y-1.5">
          <h2 className="text-[24px] font-heading font-semibold text-[#10212E] dark:text-white tracking-tight">
            Activate your account
          </h2>
          <p className="text-[14px] text-[#6B7A87]">
            Accept your workspace invitation by setting your account password.
          </p>
        </div>

        {loadingInvite ? (
          <div className="p-6 rounded-[8px] bg-[#F7FAFD] dark:bg-[#10212E] border border-[#D5E0EA] dark:border-[#1E364A] flex items-center justify-center gap-2.5 text-[14px] text-[#43525F] dark:text-[#B2C3D2]">
            <Loader2 className="w-4 h-4 animate-spin text-[#1F5F99]" />
            <span>Verifying invitation details...</span>
          </div>
        ) : loadError || !invitation ? (
          <div className="space-y-4">
            <div className="p-4 rounded-[8px] bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800/50 text-[13px] text-[#C2412D] dark:text-rose-300 flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{loadError || 'Invitation could not be verified.'}</span>
            </div>

            <div className="space-y-2">
              <Input
                label="Invitation token"
                placeholder="Paste invitation token"
                value={token}
                onChange={(e) => setToken(e.target.value)}
              />
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => fetchInvitation(token)}
                  disabled={!token.trim()}
                >
                  Verify invitation token
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => setActiveNav('supplier-login')}
                >
                  Back to sign in
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <>
            {/* Live Invitation Details Summary Card */}
            <div className="p-4 rounded-[8px] bg-[#F7FAFD] dark:bg-[#10212E] border border-[#D5E0EA] dark:border-[#1E364A] space-y-3 text-[14px]">
              <div className="flex items-center gap-2 font-semibold text-[#10212E] dark:text-white pb-2 border-b border-[#D5E0EA] dark:border-[#1E364A]">
                <Building2 className="w-4 h-4 text-[#1F5F99] dark:text-[#6FAEE0]" strokeWidth={1.5} />
                <span>{invitation.tenantName}</span>
              </div>

              <div className="space-y-2 text-[14px]">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[#6B7A87]">Invited by:</span>
                  <span className="font-medium text-[#10212E] dark:text-white text-right">
                    {invitation.inviterName}
                  </span>
                </div>

                <div className="flex items-start justify-between gap-2">
                  <span className="text-[#6B7A87]">Assigned role:</span>
                  <span className="font-semibold text-[#1F5F99] dark:text-[#6FAEE0] text-right">
                    {invitation.roleName}
                  </span>
                </div>

                <div className="flex items-start justify-between gap-2">
                  <span className="text-[#6B7A87]">Account email:</span>
                  <span className="text-[#10212E] dark:text-white text-right">
                    {invitation.email}
                  </span>
                </div>
              </div>
            </div>

            {/* Set Profile & Password Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="p-3 rounded-[6px] bg-rose-50 dark:bg-rose-950/30 text-[#C2412D] dark:text-rose-300 text-[14px]">
                  {error}
                </div>
              )}

              <Input
                label="Your full name"
                type="text"
                placeholder="Enter your full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                leftIcon={<User className="w-4 h-4" />}
                autoComplete="name"
              />

              <div className="space-y-1">
                <Input
                  label="Set your password *"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="At least 10 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
                  autoComplete="new-password"
                  required
                />
                <PasswordRulesCheck password={password} />
              </div>

              <Button
                type="submit"
                variant="primary"
                size="lg"
                className="w-full mt-2"
                isLoading={isLoading}
                rightIcon={<ArrowRight />}
              >
                Accept invitation
              </Button>
            </form>
          </>
        )}
      </div>
    </AuthLayout>
  );
};
