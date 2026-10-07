import React from 'react';
import { AuthLayout } from './AuthLayout';
import { useApp } from '../../context/AppContext';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { CheckCircle2, ArrowRight, FileText, Upload } from 'lucide-react';

interface SupplierWelcomeProps {
  onNavigate: (route: string) => void;
}

export const SupplierWelcome: React.FC<SupplierWelcomeProps> = ({ onNavigate }) => {
  const { supplier, setRole, setActiveNav } = useApp();

  const handleCompleteProfile = () => {
    setRole('supplier');
    setActiveNav('profile');
  };

  return (
    <AuthLayout
      leftMessage="Register once. Bid anywhere."
      tagline="Your company account is now created. Follow the next steps to complete your profile and prepare your document vault."
    >
      <div className="space-y-6">
        <div className="space-y-2">
          <Badge variant="verified" size="md">
            Account active
          </Badge>

          <h2 className="text-[24px] font-heading font-semibold text-[#10212E] dark:text-white tracking-tight">
            Welcome to BidReady360
          </h2>
          <p className="text-[14px] text-[#6B7A87] leading-relaxed">
            Your supplier account for <strong>{supplier.legalName}</strong> has been initialized. Here is what you need to complete next:
          </p>
        </div>

        {/* Next steps list */}
        <div className="p-4 rounded-[8px] bg-[#F7FAFD] dark:bg-[#10212E] border border-[#D5E0EA] dark:border-[#1E364A] space-y-3.5 text-[14px]">
          <span className="font-heading font-semibold text-[15px] text-[#10212E] dark:text-white block border-b border-[#D5E0EA] dark:border-[#1E364A] pb-2">
            Onboarding checklist
          </span>

          <div className="space-y-3 text-[14px]">
            <div className="flex items-start gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-[#2F8F5B] shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold text-[#10212E] dark:text-white block">
                  1. Company registration
                </span>
                <span className="text-[#6B7A87]">CIPA registration number {supplier.cipaNumber} recorded.</span>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-full border border-[#D5E0EA] dark:border-[#1E364A] flex items-center justify-center shrink-0 mt-0.5 text-[12px] text-[#6B7A87] font-semibold">
                2
              </div>
              <div>
                <span className="font-semibold text-[#10212E] dark:text-white block">
                  2. Upload tax clearance certificate
                </span>
                <span className="text-[#6B7A87]">Store your BURS tax clearance in your private document vault.</span>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-full border border-[#D5E0EA] dark:border-[#1E364A] flex items-center justify-center shrink-0 mt-0.5 text-[12px] text-[#6B7A87] font-semibold">
                3
              </div>
              <div>
                <span className="font-semibold text-[#10212E] dark:text-white block">
                  3. Select your service categories
                </span>
                <span className="text-[#6B7A87]">Pick the procurement categories matching your trade to see relevant calls.</span>
              </div>
            </div>
          </div>
        </div>

        {/* Clear Next Step Primary Action */}
        <div className="pt-2">
          <Button
            type="button"
            variant="primary"
            size="lg"
            className="w-full"
            onClick={handleCompleteProfile}
            rightIcon={<ArrowRight />}
          >
            Complete your company profile
          </Button>
        </div>
      </div>
    </AuthLayout>
  );
};
