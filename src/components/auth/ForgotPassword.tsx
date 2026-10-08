import React, { useState } from 'react';
import { AuthLayout } from './AuthLayout';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Mail, CheckCircle2, ArrowRight, ArrowLeft } from 'lucide-react';

interface ForgotPasswordProps {
  onNavigate: (route: string) => void;
}

export const ForgotPassword: React.FC<ForgotPasswordProps> = ({ onNavigate }) => {
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim() || !/\S+@\S+\.\S+/.test(email)) {
      setError('Enter a valid email address.');
      return;
    }

    setIsLoading(true);
    setError(null);

    setTimeout(() => {
      setIsLoading(false);
      setIsSubmitted(true);
    }, 600);
  };

  return (
    <AuthLayout
      leftMessage="Reset your password"
      tagline="Enter your account email address and we will send you a secure link to reset your password."
    >
      <div className="space-y-6">
        <div className="space-y-1.5">
          <h2 className="text-[24px] font-heading font-semibold text-[#10212E] dark:text-white tracking-tight">
            Forgot password
          </h2>
          <p className="text-[14px] text-[#6B7A87]">
            Enter your email to receive password reset instructions.
          </p>
        </div>

        {isSubmitted ? (
          <div className="space-y-4 p-5 rounded-[8px] bg-[#F7FAFD] dark:bg-[#10212E] border border-[#D5E0EA] dark:border-[#1E364A]">
            <div className="flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 text-[#2F8F5B] shrink-0 mt-0.5" />
              <div className="space-y-1 text-[14px]">
                <span className="font-semibold text-[#10212E] dark:text-white block">
                  Check your inbox
                </span>
                {/* Neutral wording strictly required */}
                <p className="text-[#43525F] dark:text-[#B2C3D2] leading-relaxed">
                  If an account exists for this email, we've sent a reset link. Please check your inbox and spam folder.
                </p>
              </div>
            </div>

            <div className="pt-2 space-y-2">
              <Button
                variant="secondary"
                size="md"
                className="w-full"
                onClick={() => onNavigate('reset-password')}
              >
                Simulate clicking reset link →
              </Button>
              <Button
                variant="ghost"
                size="md"
                className="w-full"
                onClick={() => onNavigate('supplier-login')}
              >
                Return to sign in
              </Button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Input
                label="Email address *"
                type="email"
                placeholder="e.g. name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                error={error || undefined}
                leftIcon={<Mail className="w-4 h-4" />}
                autoComplete="email"
                required
              />
              {!error && (
                <p className="text-[12px] text-[#6B7A87] dark:text-[#8FA2B2] mt-1.5 leading-snug">
                  Use an email you check regularly. Company and personal addresses are both fine.
                </p>
              )}
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              className="w-full mt-2"
              isLoading={isLoading}
              rightIcon={<ArrowRight />}
            >
              Send reset link
            </Button>

            <div className="text-center pt-2">
              <button
                type="button"
                onClick={() => onNavigate('supplier-login')}
                className="text-[14px] text-[#6B7A87] hover:text-[#10212E] dark:hover:text-white inline-flex items-center gap-1 font-medium cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Return to sign in</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </AuthLayout>
  );
};
