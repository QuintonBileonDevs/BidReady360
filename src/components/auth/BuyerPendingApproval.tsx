import React from 'react';
import { AuthLayout } from './AuthLayout';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { useApp } from '../../context/AppContext';
import { CheckCircle2, ArrowRight } from 'lucide-react';

interface BuyerPendingApprovalProps {
  onNavigate: (route: string) => void;
}

export const BuyerPendingApproval: React.FC<BuyerPendingApprovalProps> = ({ onNavigate }) => {
  const { setRole, setActiveNav, buyerOrgStatus, registeredBuyerOrgName, registeredBuyerEmail, approveBuyerOrg } = useApp();

  const handleSimulateSystemApproval = () => {
    approveBuyerOrg(registeredBuyerOrgName || 'Procuring Organization');
    setRole('buyer');
    setActiveNav('dashboard');
  };

  return (
    <AuthLayout
      leftMessage="Run fair, transparent procurement."
      tagline="Your procuring organization registration has been submitted and is currently in review."
    >
      <div className="space-y-6">
        <div className="space-y-2">
          <Badge variant="warning" size="md">
            Review in progress
          </Badge>

          <h2 className="text-[24px] font-heading font-semibold text-[#10212E] dark:text-white tracking-tight">
            Registration submitted
          </h2>
          <p className="text-[14px] text-[#6B7A87] leading-relaxed">
            Thank you for registering <strong>{registeredBuyerOrgName || 'your organization'}</strong> ({registeredBuyerEmail || 'official account'}). 
            In compliance with the Public Procurement Act, new buying entities must be verified by the platform system administration before publishing tenders or evaluating bids.
          </p>
        </div>

        {/* Three-step timeline */}
        <div className="p-4 rounded-[8px] bg-[#F7FAFD] dark:bg-[#10212E] border border-[#D5E0EA] dark:border-[#1E364A] space-y-4">
          <span className="text-[13px] font-semibold text-[#6B7A87] uppercase tracking-wider block">
            Verification timeline
          </span>

          <div className="space-y-4 relative pl-6 border-l-2 border-[#D5E0EA] dark:border-[#1E364A]">
            {/* Step 1: Submitted */}
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
              <p className="text-[13px] text-[#6B7A87]">
                Official entity name: <strong>{registeredBuyerOrgName || 'New Entity'}</strong>
              </p>
            </div>

            {/* Step 2: Under review */}
            <div className="relative space-y-0.5">
              <span className="absolute -left-[31px] top-0.5 w-4 h-4 rounded-full bg-[#E8A33D] text-white flex items-center justify-center text-[10px] font-bold">
                •
              </span>
              <div className="flex items-center justify-between">
                <span className="text-[14px] font-semibold text-[#1F5F99] dark:text-[#6FAEE0]">
                  2. System verification in progress
                </span>
                <span className="text-[12px] text-[#E8A33D] font-medium">Pending verification</span>
              </div>
              <p className="text-[13px] text-[#6B7A87]">
                Platform registrar verifies institutional authority standing and email domain. All tender creation and bidder evaluation controls remain locked until verified.
              </p>
            </div>

            {/* Step 3: Approved */}
            <div className="relative space-y-0.5 opacity-60">
              <span className="absolute -left-[31px] top-0.5 w-4 h-4 rounded-full bg-slate-300 dark:bg-slate-700 text-slate-600 flex items-center justify-center text-[10px] font-bold">
                3
              </span>
              <div className="flex items-center justify-between">
                <span className="text-[14px] font-semibold text-[#10212E] dark:text-white">
                  3. Workspace activation
                </span>
                <span className="text-[12px] text-[#6B7A87]">Pending</span>
              </div>
              <p className="text-[13px] text-[#6B7A87]">
                Unlocks tender publishing, multi-evaluator scoring panels, and sealed bid opening tools.
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="pt-2 space-y-2.5">
          <Button
            type="button"
            variant="primary"
            size="lg"
            className="w-full"
            onClick={handleSimulateSystemApproval}
            rightIcon={<CheckCircle2 className="w-4 h-4" />}
          >
            Simulate System Approval (Verify & Activate Workspace)
          </Button>

          <Button
            type="button"
            variant="secondary"
            size="md"
            className="w-full"
            onClick={() => {
              setRole('public');
              setActiveNav('about');
            }}
          >
            Return to public portal
          </Button>
        </div>
      </div>
    </AuthLayout>
  );
};
