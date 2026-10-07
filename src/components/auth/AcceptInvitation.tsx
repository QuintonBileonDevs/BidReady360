import React, { useState } from 'react';
import { AuthLayout } from './AuthLayout';
import { useApp } from '../../context/AppContext';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { PasswordRulesCheck } from './PasswordRulesCheck';
import {
  Building2,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
} from 'lucide-react';

interface AcceptInvitationProps {
  onNavigate: (route: string) => void;
}

export const AcceptInvitation: React.FC<AcceptInvitationProps> = ({ onNavigate }) => {
  const { setRole, setActiveNav } = useApp();

  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const invitation = {
    inviterName: 'Kgosi Tau',
    inviterTitle: 'Lead SCM Officer',
    organizationName: 'Gaborone Regional Council',
    assignedRole: 'Technical evaluation panelist',
    recipientEmail: 'panelist.evaluator@grc.gov.bw',
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 10) {
      setError('Password must meet all minimum criteria.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setTimeout(() => {
      setIsLoading(false);
      setRole('buyer');
      setActiveNav('evaluation');
    }, 700);
  };

  return (
    <AuthLayout
      leftMessage="Accept panel invitation"
      tagline="Join Gaborone Regional Council's procurement evaluation team on BidReady360."
    >
      <div className="space-y-6">
        <div className="space-y-1.5">
          <h2 className="text-[24px] font-heading font-semibold text-[#10212E] dark:text-white tracking-tight">
            Activate your account
          </h2>
          <p className="text-[14px] text-[#6B7A87]">
            You have been invited to join a procurement workspace.
          </p>
        </div>

        {/* Invitation Details Summary Card */}
        <div className="p-4 rounded-[8px] bg-[#F7FAFD] dark:bg-[#10212E] border border-[#D5E0EA] dark:border-[#1E364A] space-y-3 text-[14px]">
          <div className="flex items-center gap-2 font-semibold text-[#10212E] dark:text-white pb-2 border-b border-[#D5E0EA] dark:border-[#1E364A]">
            <Building2 className="w-4 h-4 text-[#1F5F99] dark:text-[#6FAEE0]" strokeWidth={1.5} />
            <span>{invitation.organizationName}</span>
          </div>

          <div className="space-y-2 text-[14px]">
            <div className="flex items-start justify-between">
              <span className="text-[#6B7A87]">Invited by:</span>
              <span className="font-medium text-[#10212E] dark:text-white text-right">
                {invitation.inviterName} ({invitation.inviterTitle})
              </span>
            </div>

            <div className="flex items-start justify-between">
              <span className="text-[#6B7A87]">Assigned role:</span>
              <span className="font-semibold text-[#1F5F99] dark:text-[#6FAEE0] text-right">
                {invitation.assignedRole}
              </span>
            </div>

            <div className="flex items-start justify-between">
              <span className="text-[#6B7A87]">Account email:</span>
              <span className="text-[#10212E] dark:text-white">
                {invitation.recipientEmail}
              </span>
            </div>
          </div>
        </div>

        {/* Set Password Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 rounded-[6px] bg-rose-50 text-[#C2412D] text-[14px]">
              {error}
            </div>
          )}

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
      </div>
    </AuthLayout>
  );
};
