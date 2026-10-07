import React from 'react';
import { useApp } from '../../context/AppContext';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { RingMotif } from '../ui/RingMotif';
import {
  Briefcase,
  CheckCircle2,
  Lock,
  Eye,
  Sliders,
  Users,
  ShieldCheck,
  ArrowRight,
  FileSpreadsheet,
  FileCheck2,
} from 'lucide-react';

interface PublicForBuyersProps {
  onOpenAuth?: (tenant: 'buyer', mode: 'signin' | 'signup') => void;
}

export const PublicForBuyers: React.FC<PublicForBuyersProps> = ({ onOpenAuth }) => {
  const { role, isAuthenticated, setIntendedRoute, setActiveNav } = useApp();

  const handleOpenBuyer = () => {
    if (onOpenAuth) {
      onOpenAuth('buyer', 'signin');
    } else {
      if (!isAuthenticated || role !== 'buyer') {
        setIntendedRoute('buyer-dashboard');
        setActiveNav('buyer-login');
      } else {
        setActiveNav('dashboard');
      }
    }
  };

  const steps = [
    {
      num: '01',
      title: 'Configure evaluation rubrics & criteria',
      description:
        'Set custom scoring matrices, mandatory statutory hurdles, and multi-tier approval hierarchies tailored to your organization’s internal procurement thresholds.',
      details: ['Weighted scoring matrices', 'Automatic pass/fail statutory checks', 'Departmental permission scoping'],
    },
    {
      num: '02',
      title: 'Publish calls with automated completeness gates',
      description:
        'Publish registration drives, EOIs, and sealed RFPs. The platform checks supplier statutory credentials automatically, filtering out non-compliant submissions before evaluation.',
      details: ['Zero manual document screening', 'Public clarification Q&A bulletins', 'Configurable digital response questionnaires'],
    },
    {
      num: '03',
      title: 'Blind evaluation & cryptographic unsealing',
      description:
        'Evaluation panels score technical submissions independently with conflict-of-interest declarations. Pricing is unsealed only at the official opening milestone.',
      details: ['Dual-key committee unsealing', 'Conflict of interest audit lock', 'Blind technical evaluations'],
    },
    {
      num: '04',
      title: 'Generate tamper-evident award dossiers',
      description:
        'Generate statutory audit trails with one click for accounting officers, PPRA auditors, and internal oversight bodies. Move directly from award to contract tracking.',
      details: ['Exportable audit reports', 'Contract milestone management', 'Post-award supplier performance ratings'],
    },
  ];

  return (
    <div className="space-y-12 sm:space-y-16 py-4">
      {/* Editorial Header */}
      <div className="relative border-b border-[#D5E0EA] dark:border-[#1E364A] pb-10 sm:pb-12 overflow-hidden">
        <RingMotif size={360} dotAngle={135} opacity={0.3} position="top-right" />

        <div className="max-w-3xl space-y-4 relative z-10">
          <Badge variant="pula" size="md">
            For Procuring Entities & Buyers
          </Badge>

          <h1 className="text-3xl sm:text-4xl font-heading font-semibold text-[#10212E] dark:text-white tracking-tight">
            Configurable governance. Impartial evaluations. Complete auditability.
          </h1>

          <p className="text-base sm:text-lg text-[#43525F] dark:text-[#B2C3D2] leading-relaxed">
            Run expressions of interest, supplier pre-qualification drives, and sealed competitive tenders on an auditable digital workspace built for Botswana’s civic and corporate procuring entities.
          </p>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <Button
              variant="primary"
              size="lg"
              onClick={handleOpenBuyer}
              rightIcon={<ArrowRight />}
            >
              Access Buyer Workspace
            </Button>
            <Button
              variant="secondary"
              size="lg"
              onClick={() => setActiveNav('guidelines')}
            >
              Review PPRA alignment
            </Button>
          </div>
        </div>
      </div>

      {/* Core Benefits 3-Column */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card variant="default" padding="md" className="space-y-3">
          <div className="w-9 h-9 rounded-[6px] bg-[#EAF2FA] dark:bg-[#1F5F99]/20 text-[#1F5F99] dark:text-[#6FAEE0] flex items-center justify-center">
            <ShieldCheck className="w-5 h-5" strokeWidth={1.5} />
          </div>
          <h3 className="text-base font-heading font-semibold text-[#10212E] dark:text-white">
            100% Statutory Compliance
          </h3>
          <p className="text-xs text-[#6B7A87] leading-relaxed">
            Automated verification against CIPA and BURS eliminates non-compliant bidders before evaluation committees open responses.
          </p>
        </Card>

        <Card variant="default" padding="md" className="space-y-3">
          <div className="w-9 h-9 rounded-[6px] bg-[#EAF2FA] dark:bg-[#1F5F99]/20 text-[#1F5F99] dark:text-[#6FAEE0] flex items-center justify-center">
            <Users className="w-5 h-5" strokeWidth={1.5} />
          </div>
          <h3 className="text-base font-heading font-semibold text-[#10212E] dark:text-white">
            Multi-Evaluator Panels
          </h3>
          <p className="text-xs text-[#6B7A87] leading-relaxed">
            Assign panel members, capture conflict-of-interest declarations, and automatically consolidate weighted scores without spreadsheets.
          </p>
        </Card>

        <Card variant="default" padding="md" className="space-y-3">
          <div className="w-9 h-9 rounded-[6px] bg-[#EAF2FA] dark:bg-[#1F5F99]/20 text-[#1F5F99] dark:text-[#6FAEE0] flex items-center justify-center">
            <Eye className="w-5 h-5" strokeWidth={1.5} />
          </div>
          <h3 className="text-base font-heading font-semibold text-[#10212E] dark:text-white">
            Immutable Audit Trail
          </h3>
          <p className="text-xs text-[#6B7A87] leading-relaxed">
            Every document view, score submission, addendum publication, and award recommendation is immutably logged with timestamped signatures.
          </p>
        </Card>
      </div>

      {/* Step Sequence */}
      <div className="space-y-6">
        <div className="border-b border-[#D5E0EA] dark:border-[#1E364A] pb-3">
          <h2 className="text-xl sm:text-2xl font-heading font-semibold text-[#10212E] dark:text-white">
            The Buyer Procurement Workflow
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {steps.map((step) => (
            <Card key={step.num} variant="default" padding="md" className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-[#1F5F99] dark:text-[#6FAEE0] bg-[#EAF2FA] dark:bg-[#1F5F99]/20 px-2 py-1 rounded-[4px]">
                  STEP {step.num}
                </span>
                <span className="text-[11px] text-[#6B7A87]">Buyer Governance</span>
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
        <RingMotif size={360} dotAngle={210} color="#1E364A" position="bottom-right" />
        <div className="relative z-10 max-w-xl space-y-4">
          <h3 className="text-2xl font-heading font-semibold text-white">
            Equip your procurement unit with modern tooling
          </h3>
          <p className="text-sm text-[#B2C3D2] leading-relaxed">
            Transition your municipal council, parastatal, or corporate supply chain team to an auditable, sealed digital workspace.
          </p>
          <div className="pt-2">
            <Button
              variant="primary"
              size="lg"
              onClick={handleOpenBuyer}
              rightIcon={<ArrowRight />}
            >
              Launch buyer workspace console
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};
