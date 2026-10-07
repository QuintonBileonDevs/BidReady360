import React from 'react';
import { useApp } from '../../context/AppContext';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { RingMotif } from '../ui/RingMotif';
import {
  Building2,
  CheckCircle2,
  ShieldCheck,
  FileCheck2,
  ArrowRight,
  Clock,
  Sparkles,
  RefreshCw,
  FolderLock,
  Lock,
} from 'lucide-react';

interface PublicForSuppliersProps {
  onOpenAuth?: (tenant: 'supplier', mode: 'signin' | 'signup') => void;
}

export const PublicForSuppliers: React.FC<PublicForSuppliersProps> = ({ onOpenAuth }) => {
  const { setRole, setActiveNav } = useApp();

  const handleRegister = () => {
    if (onOpenAuth) {
      onOpenAuth('supplier', 'signup');
    } else {
      setRole('supplier');
      setActiveNav('vault');
    }
  };

  const steps = [
    {
      num: '01',
      title: 'Build your Supplier Passport once',
      description:
        'Enter your CIPA registration UIN, BURS tax clearance, and PPRA contractor codes. Upload statutory documents once to your private, encrypted Document Vault.',
      details: ['CIPA verified company standing', 'PPRA grading & codes A through E', 'EDD citizen ownership certification'],
    },
    {
      num: '02',
      title: 'Discover matched tenders automatically',
      description:
        'The platform continuously monitors published procurement calls from regional councils, parastatals, and commercial buyers, alerting you only to eligible opportunities.',
      details: ['Zero noise matching by commodity code', 'Advance deadline alerts', 'Eligibility pre-check before bidding'],
    },
    {
      num: '03',
      title: 'Apply with consent-based sharing',
      description:
        'When responding to an EOI or RFP, grant selective access to your verified passport. Your price proposal is cryptographically sealed with asymmetric encryption.',
      details: ['Zero repetitive document uploads', 'Cryptographic sealed bid envelope', 'Revocable access permissions anytime'],
    },
    {
      num: '04',
      title: 'Track evaluations & maintain standing',
      description:
        'Monitor your submission through review, technical scoring, and award stages. Automatic 30-day alerts notify you before tax or safety certificates expire.',
      details: ['Real-time status updates', '30-day certificate expiry alerts', 'One-click update sync to all buyers'],
    },
  ];

  return (
    <div className="space-y-12 sm:space-y-16 py-4">
      {/* Editorial Header */}
      <div className="relative border-b border-[#D5E0EA] dark:border-[#1E364A] pb-10 sm:pb-12 overflow-hidden">
        <RingMotif size={360} dotAngle={45} opacity={0.3} position="top-right" />

        <div className="max-w-3xl space-y-4 relative z-10">
          <Badge variant="pula" size="md">
            For Suppliers & Contractors
          </Badge>

          <h1 className="text-3xl sm:text-4xl font-heading font-semibold text-[#10212E] dark:text-white tracking-tight">
            Register once. Reuse everywhere. Bid with confidence.
          </h1>

          <p className="text-base sm:text-lg text-[#43525F] dark:text-[#B2C3D2] leading-relaxed">
            Eliminate the repetitive cycle of certifying, printing, and resubmitting identical statutory documentation for every procurement opportunity in Botswana.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <Button
              variant="primary"
              size="lg"
              onClick={handleRegister}
              rightIcon={<ArrowRight />}
            >
              Create your Supplier Passport
            </Button>
            <Button
              variant="secondary"
              size="lg"
              onClick={() => setActiveNav('opportunities')}
            >
              Browse active tenders
            </Button>
          </div>
        </div>
      </div>

      {/* Core Benefits 3-Column */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card variant="default" padding="md" className="space-y-3">
          <div className="w-9 h-9 rounded-[6px] bg-[#EAF2FA] dark:bg-[#1F5F99]/20 text-[#1F5F99] dark:text-[#6FAEE0] flex items-center justify-center">
            <FileCheck2 className="w-5 h-5" strokeWidth={1.5} />
          </div>
          <h3 className="text-base font-heading font-semibold text-[#10212E] dark:text-white">
            Single Verified Profile
          </h3>
          <p className="text-xs text-[#6B7A87] leading-relaxed">
            Your statutory standing is verified once against CIPA, BURS, and PPRA standards. Buying organizations verify compliance in seconds.
          </p>
        </Card>

        <Card variant="default" padding="md" className="space-y-3">
          <div className="w-9 h-9 rounded-[6px] bg-[#EAF2FA] dark:bg-[#1F5F99]/20 text-[#1F5F99] dark:text-[#6FAEE0] flex items-center justify-center">
            <Lock className="w-5 h-5" strokeWidth={1.5} />
          </div>
          <h3 className="text-base font-heading font-semibold text-[#10212E] dark:text-white">
            Sealed-Bid Cryptography
          </h3>
          <p className="text-xs text-[#6B7A87] leading-relaxed">
            Commercial price submissions are locked with public-key cryptography and cannot be viewed by any buyer until the official opening deadline.
          </p>
        </Card>

        <Card variant="default" padding="md" className="space-y-3">
          <div className="w-9 h-9 rounded-[6px] bg-[#EAF2FA] dark:bg-[#1F5F99]/20 text-[#1F5F99] dark:text-[#6FAEE0] flex items-center justify-center">
            <Sparkles className="w-5 h-5 text-[#E8A33D]" strokeWidth={1.5} />
          </div>
          <h3 className="text-base font-heading font-semibold text-[#10212E] dark:text-white">
            Citizen Empowerment (EDD)
          </h3>
          <p className="text-xs text-[#6B7A87] leading-relaxed">
            Automatic application of Economic Diversification Drive (EDD) preference margins and registered contractor tier matching.
          </p>
        </Card>
      </div>

      {/* Step Sequence */}
      <div className="space-y-6">
        <div className="border-b border-[#D5E0EA] dark:border-[#1E364A] pb-3">
          <h2 className="text-xl sm:text-2xl font-heading font-semibold text-[#10212E] dark:text-white">
            How the Supplier Passport works
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {steps.map((step) => (
            <Card key={step.num} variant="default" padding="md" className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-[#1F5F99] dark:text-[#6FAEE0] bg-[#EAF2FA] dark:bg-[#1F5F99]/20 px-2 py-1 rounded-[4px]">
                  STEP {step.num}
                </span>
                <span className="text-[11px] text-[#6B7A87]">Passport Workflow</span>
              </div>

              <div className="space-y-1.5">
                <h3 className="text-base font-heading font-semibold text-[#10212E] dark:text-white">
                  {step.title}
                </h3>
                <p className="text-xs text-[#6B7A87] leading-relaxed">
                  {step.description}
                </p>
              </div>

              <ul className="space-y-2 pt-2 border-t border-[#D5E0EA] dark:border-[#1E364A] text-xs text-[#43525F] dark:text-[#B2C3D2]">
                {step.details.map((detail, i) => (
                  <li key={i} className="flex items-center gap-2">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#2F8F5B] shrink-0" strokeWidth={1.5} />
                    <span>{detail}</span>
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </div>

      {/* Single Clear Call To Action */}
      <Card variant="dark" padding="lg" className="relative overflow-hidden">
        <RingMotif size={360} dotAngle={90} color="#1E364A" position="bottom-right" />
        <div className="relative z-10 max-w-xl space-y-4">
          <h3 className="text-2xl font-heading font-semibold text-white">
            Ready to simplify your tender applications?
          </h3>
          <p className="text-sm text-[#B2C3D2] leading-relaxed">
            Join hundreds of verified contractors and suppliers across Botswana. Create your company profile in under ten minutes.
          </p>
          <div className="pt-2">
            <Button
              variant="primary"
              size="lg"
              onClick={handleRegister}
              rightIcon={<ArrowRight />}
            >
              Register your company now
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};
