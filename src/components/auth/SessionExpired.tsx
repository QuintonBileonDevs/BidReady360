import React from 'react';
import { AuthLayout } from './AuthLayout';
import { Button } from '../ui/Button';
import { Clock } from 'lucide-react';

interface SessionExpiredProps {
  onNavigate: (route: string) => void;
}

export const SessionExpired: React.FC<SessionExpiredProps> = ({ onNavigate }) => {
  return (
    <AuthLayout
      leftMessage="Session expired"
      tagline="For your security and privacy, your authenticated procurement session has ended after a period of inactivity."
    >
      <div className="space-y-6 text-center">
        <div className="w-12 h-12 rounded-[8px] bg-[#FFFBEB] dark:bg-[#92400E]/20 text-[#92400E] dark:text-[#FCD34D] border border-[#FDE68A] dark:border-[#92400E]/40 flex items-center justify-center mx-auto">
          <Clock className="w-6 h-6" strokeWidth={1.5} />
        </div>

        <div className="space-y-2">
          <h2 className="text-[24px] font-heading font-semibold text-[#10212E] dark:text-white tracking-tight">
            Session expired
          </h2>
          <p className="text-[14px] text-[#6B7A87] max-w-sm mx-auto leading-relaxed">
            Your session has timed out due to inactivity. Please sign in again to continue managing your bids and calls.
          </p>
        </div>

        <div className="pt-2 space-y-3">
          <Button
            type="button"
            variant="primary"
            size="lg"
            className="w-full"
            onClick={() => onNavigate('supplier-login')}
          >
            Sign in again
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="md"
            className="w-full"
            onClick={() => onNavigate('buyer-login')}
          >
            Sign in as organization
          </Button>
        </div>
      </div>
    </AuthLayout>
  );
};
