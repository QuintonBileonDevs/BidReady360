import React, { useState } from 'react';
import { AuthLayout } from './AuthLayout';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { PasswordRulesCheck } from './PasswordRulesCheck';
import { Lock, Eye, EyeOff, CheckCircle2, ArrowRight } from 'lucide-react';

interface ResetPasswordProps {
  onNavigate: (route: string) => void;
}

export const ResetPassword: React.FC<ResetPasswordProps> = ({ onNavigate }) => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 10) {
      setError('Password must meet all minimum criteria.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    setIsLoading(true);
    setError(null);

    setTimeout(() => {
      setIsLoading(false);
      setIsSuccess(true);
      setTimeout(() => {
        onNavigate('supplier-login');
      }, 1000);
    }, 700);
  };

  return (
    <AuthLayout
      leftMessage="Reset your password"
      tagline="Create a strong new password for your BidReady360 account."
    >
      <div className="space-y-6">
        <div className="space-y-1.5">
          <h2 className="text-[24px] font-heading font-semibold text-[#10212E] dark:text-white tracking-tight">
            Create new password
          </h2>
          <p className="text-[14px] text-[#6B7A87]">
            Your new password will take effect immediately.
          </p>
        </div>

        {isSuccess ? (
          <div className="p-4 rounded-[8px] bg-[#ECFDF5] dark:bg-[#065F46]/20 border border-[#A7F3D0] dark:border-[#065F46]/40 text-[14px] text-[#065F46] dark:text-[#6EE7B7] flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 shrink-0 text-[#2F8F5B]" />
            <div>
              <span className="font-semibold block">Password updated successfully</span>
              <span>Redirecting you to the sign in page...</span>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="p-3.5 rounded-[8px] bg-rose-50 text-[#C2412D] border border-rose-200 text-[14px]">
                {error}
              </div>
            )}

            <div className="space-y-1">
              <Input
                label="New password *"
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

            <Input
              label="Confirm new password *"
              type={showPassword ? 'text' : 'password'}
              placeholder="Re-enter password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              leftIcon={<Lock className="w-4 h-4" />}
              autoComplete="new-password"
              required
            />

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full mt-2"
              isLoading={isLoading}
              rightIcon={<ArrowRight />}
            >
              Update password
            </Button>
          </form>
        )}
      </div>
    </AuthLayout>
  );
};
