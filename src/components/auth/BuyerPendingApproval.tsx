import React, { useState } from 'react';
import { AuthLayout } from './AuthLayout';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { useApp } from '../../context/AppContext';
import { RefreshCw, AlertTriangle, LogOut } from 'lucide-react';

interface BuyerPendingApprovalProps {
  onNavigate: (route: string) => void;
}

export const BuyerPendingApproval: React.FC<BuyerPendingApprovalProps> = ({ onNavigate }) => {
  const {
    setRole,
    setActiveNav,
    buyerOrgStatus,
    buyerOrgRejectionReason,
    registeredBuyerOrgName,
    registeredBuyerEmail,
    runBootstrap,
    logout,
    isAuthenticated,
  } = useApp();

  const [isChecking, setIsChecking] = useState(false);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);

  const isRejectedOrSuspended = buyerOrgStatus === 'Rejected';

  const handleCheckApprovalStatus = async () => {
    setIsChecking(true);
    setStatusNotice(null);
    try {
      await runBootstrap({ force: true });
      setStatusNotice(
        isRejectedOrSuspended
          ? 'Status refreshed. Your organization remains restricted — please contact BidReady360 administration.'
          : 'Status refreshed. If an administrator has approved your organization, your workspace will unlock automatically.'
      );
    } catch {
      setStatusNotice('Could not refresh approval status. Please try signing in again.');
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <AuthLayout
      leftMessage="Run fair, transparent procurement."
      tagline={
        isRejectedOrSuspended
          ? 'Access for this procuring organization is currently restricted by platform administration.'
          : 'Your procuring organization registration has been submitted and is currently under administrator review.'
      }
    >
      <div className="space-y-6">
        <div className="space-y-2">
          <Badge variant={isRejectedOrSuspended ? 'alert' : 'warning'} size="md">
            {isRejectedOrSuspended ? 'Organization restricted' : 'Review in progress'}
          </Badge>

          <h2 className="text-[24px] font-heading font-semibold text-[#10212E] dark:text-white tracking-tight">
            {isRejectedOrSuspended ? 'Organization access suspended or rejected' : 'Awaiting administrator approval'}
          </h2>
          <p className="text-[14px] text-[#6B7A87] leading-relaxed dark:text-[#9CB4C9]">
            {isRejectedOrSuspended ? (
              <>
                <strong>{registeredBuyerOrgName || 'Your organization'}</strong> ({registeredBuyerEmail || 'official account'}) does not currently have active procuring entity approval. Publishing tenders and managing calls is blocked until reinstated by a platform administrator.
              </>
            ) : (
              <>
                Thank you for registering <strong>{registeredBuyerOrgName || 'your organization'}</strong> ({registeredBuyerEmail || 'official account'}).
                In compliance with the Public Procurement Act, new buying entities must be verified and approved by a BidReady360 platform administrator before publishing tenders or managing calls.
              </>
            )}
          </p>
        </div>

        {isRejectedOrSuspended && buyerOrgRejectionReason && (
          <div className="p-4 rounded-[8px] bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900 flex items-start gap-2.5 text-[13px] text-[#C2412D]">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold block">Administrator reason</span>
              <span>{buyerOrgRejectionReason}</span>
            </div>
          </div>
        )}

        {/* Three-step timeline */}
        <div className="p-4 rounded-[8px] bg-[#F7FAFD] dark:bg-[#10212E] border border-[#D5E0EA] dark:border-[#244157] space-y-4">
          <span className="text-[13px] font-semibold text-[#6B7A87] uppercase tracking-wider block dark:text-[#9CB4C9]">
            Verification status
          </span>

          <div className="space-y-4 relative pl-6 border-l-2 border-[#D5E0EA] dark:border-[#244157]">
            <div className="relative space-y-0.5">
              <span className="absolute -left-[31px] top-0.5 w-4 h-4 rounded-full bg-[#2F8F5B] text-white flex items-center justify-center text-[10px] font-bold">
                ✓
              </span>
              <div className="flex items-center justify-between">
                <span className="text-[14px] font-semibold text-[#10212E] dark:text-white">
                  1. Registration submitted
                </span>
                <span className="text-[12px] text-[#2F8F5B] font-medium">Completed</span>
              </div>
              <p className="text-[13px] text-[#6B7A87] dark:text-[#9CB4C9]">
                Official entity name: <strong>{registeredBuyerOrgName || 'Procuring Organization'}</strong>
              </p>
            </div>

            <div className="relative space-y-0.5">
              <span
                className={`absolute -left-[31px] top-0.5 w-4 h-4 rounded-full text-white flex items-center justify-center text-[10px] font-bold ${
                  isRejectedOrSuspended ? 'bg-[#C2412D]' : 'bg-[#E8A33D]'
                }`}
              >
                {isRejectedOrSuspended ? '!' : '•'}
              </span>
              <div className="flex items-center justify-between">
                <span className="text-[14px] font-semibold text-[#1F5F99] dark:text-[#6FAEE0]">
                  2. Platform administrator verification
                </span>
                <span className={`text-[12px] font-medium ${isRejectedOrSuspended ? 'text-[#C2412D]' : 'text-[#E8A33D]'}`}>
                  {isRejectedOrSuspended ? 'Rejected / Suspended' : 'Pending approval'}
                </span>
              </div>
              <p className="text-[13px] text-[#6B7A87] dark:text-[#9CB4C9]">
                All tender creation, application review, and bid evaluation endpoints are enforced server-side and remain locked until approved in the Admin portal.
              </p>
            </div>

            <div className="relative space-y-0.5 opacity-60">
              <span className="absolute -left-[31px] top-0.5 w-4 h-4 rounded-full bg-slate-300 dark:bg-slate-700 text-slate-600 flex items-center justify-center text-[10px] font-bold dark:text-[#D3E3F2]">
                3
              </span>
              <div className="flex items-center justify-between">
                <span className="text-[14px] font-semibold text-[#10212E] dark:text-white">
                  3. Workspace activation
                </span>
                <span className="text-[12px] text-[#6B7A87] dark:text-[#9CB4C9]">Locked</span>
              </div>
              <p className="text-[13px] text-[#6B7A87] dark:text-[#9CB4C9]">
                Once approved by an administrator, click &ldquo;Check approval status&rdquo; below to enter your buyer workspace immediately.
              </p>
            </div>
          </div>
        </div>

        {statusNotice && (
          <div className="p-3 rounded-[8px] bg-[#EAF2FA] dark:bg-[#244157]/40 border border-[#D5E0EA] dark:border-[#244157] text-[13px] text-[#10212E] dark:text-[#D3E3F2]">
            {statusNotice}
          </div>
        )}

        {/* Actions */}
        <div className="pt-2 space-y-2.5">
          {isAuthenticated ? (
            <Button
              type="button"
              variant="primary"
              size="lg"
              className="w-full"
              disabled={isChecking}
              isLoading={isChecking}
              onClick={handleCheckApprovalStatus}
              leftIcon={!isChecking ? <RefreshCw className="w-4 h-4" /> : undefined}
            >
              {isChecking ? 'Checking status...' : 'Check approval status'}
            </Button>
          ) : (
            <Button
              type="button"
              variant="primary"
              size="lg"
              className="w-full"
              onClick={() => onNavigate('buyer-login')}
            >
              Go to buyer sign in
            </Button>
          )}

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="md"
              className="flex-1"
              onClick={() => {
                setRole('public');
                setActiveNav('about');
              }}
            >
              Return to public portal
            </Button>

            {isAuthenticated && (
              <Button
                type="button"
                variant="ghost"
                size="md"
                onClick={() => logout('user_initiated')}
                leftIcon={<LogOut className="w-4 h-4" />}
              >
                Sign out
              </Button>
            )}
          </div>
        </div>
      </div>
    </AuthLayout>
  );
};

