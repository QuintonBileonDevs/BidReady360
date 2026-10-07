import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { RingMotif } from '../ui/RingMotif';
import { Accordion, AccordionItem } from '../ui/Accordion';
import { AuthModal, AuthTenant } from '../auth/AuthModal';
import {
  Building2,
  Briefcase,
  ShieldCheck,
  CheckCircle2,
  Lock,
  Eye,
  FileCheck2,
  ArrowRight,
  Sparkles,
  Search,
  Share2,
  Clock,
  Calendar,
  Layers,
  ChevronRight,
  ExternalLink,
  Shield,
  FileText,
  UserCheck,
  Check,
} from 'lucide-react';

export const PublicAbout: React.FC = () => {
  const { calls, setRole, setActiveNav, supplier, setSelectedCallId } = useApp();
  const [howItWorksTab, setHowItWorksTab] = useState<'suppliers' | 'buyers'>('suppliers');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authTenant, setAuthTenant] = useState<AuthTenant>('supplier');
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signup');

  const openAuth = (tenant: AuthTenant, mode: 'signin' | 'signup') => {
    setAuthTenant(tenant);
    setAuthMode(mode);
    setIsAuthModalOpen(true);
  };

  const handleSelectCall = (callId: string) => {
    setSelectedCallId(callId);
    setActiveNav('opportunities');
  };

  // 4 Steps for Suppliers
  const supplierSteps = [
    {
      num: '01',
      title: 'Build your Supplier Passport once',
      description:
        'Enter CIPA company details, tax registration, and PPRA contractor codes. Upload statutory documents once to your secure Document Vault.',
    },
    {
      num: '02',
      title: 'Receive automated tender matches',
      description:
        'The platform matches your commodity codes and district location against active calls published by councils, parastatals, and commercial buyers.',
    },
    {
      num: '03',
      title: 'Apply with consent-based sharing',
      description:
        'Grant selective access to your verified passport. Price bids and bills of quantities are cryptographically locked until the tender closing milestone.',
    },
    {
      num: '04',
      title: 'Track evaluations & maintain standing',
      description:
        'Receive automated status alerts as evaluations proceed. Automated reminders notify you 30 days before any statutory certificate expires.',
    },
  ];

  // 4 Steps for Buyers
  const buyerSteps = [
    {
      num: '01',
      title: 'Configure rubrics & approval workflows',
      description:
        'Set custom technical criteria, scoring weights, and multi-tier approval hierarchies tailored to your institutional procurement policy.',
    },
    {
      num: '02',
      title: 'Publish calls with automated completeness gates',
      description:
        'Publish EOIs, registration drives, and RFPs. Incomplete or non-compliant statutory submissions are filtered out automatically before evaluation.',
    },
    {
      num: '03',
      title: 'Conduct blind, multi-evaluator scoring',
      description:
        'Panel members score technical bids independently with signed conflict-of-interest declarations. Commercial pricing remains sealed.',
    },
    {
      num: '04',
      title: 'Generate tamper-evident award dossiers',
      description:
        'Produce one-click audit dossiers capturing every score, addendum, and timestamped event for accounting officers and statutory auditors.',
    },
  ];

  // Selected Latest 3 Calls
  const latestCalls = calls.slice(0, 3);

  // Home FAQ teaser items
  const homeFaqItems: AccordionItem[] = [
    {
      id: 'faq-home-1',
      title: 'What is the BidReady360 Supplier Passport?',
      content: (
        <p>
          The Supplier Passport is a verified digital company profile for Botswana enterprises. Instead of recertifying and printing physical documentation for every public tender, you verify your standing once and share structured credentials across all buying organizations.
        </p>
      ),
    },
    {
      id: 'faq-home-2',
      title: 'How does sealed-bid asymmetric encryption work?',
      content: (
        <p>
          Commercial price schedules are encrypted at submission using public-key cryptography. Neither buying officers nor administrators can decrypt or inspect proposals until the official deadline has passed and the evaluation panel unlocks the sealed ledger.
        </p>
      ),
    },
    {
      id: 'faq-home-3',
      title: 'How does BidReady360 integrate with Botswana statutory standards?',
      content: (
        <p>
          The platform natively supports CIPA Unique Identification Numbers (UIN), BURS Tax Identification Numbers (TIN), PPRA Contractor Registration across all supply disciplines, and Economic Diversification Drive (EDD) citizen equity preferences.
        </p>
      ),
    },
  ];

  return (
    <div className="space-y-16 sm:space-y-20 py-4">
      {/* ======================================================== */}
      {/* 1. HERO SECTION WITH COMPOSED PRODUCT PREVIEW (NO IMAGE) */}
      {/* ======================================================== */}
      <section className="relative border-b border-[#D5E0EA] dark:border-[#1E364A] pb-14 sm:pb-16 overflow-hidden">
        {/* Signature Brand Motif in Background */}
        <RingMotif
          size={480}
          dotAngle={45}
          opacity={0.35}
          position="top-right"
        />

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center relative z-10">
          {/* Left Column: Headline & Editorial Copy */}
          <div className="lg:col-span-6 space-y-5">
            <div className="inline-flex items-center gap-2">
              <Badge variant="pula" size="md">
                Botswana Unified Procurement Platform
              </Badge>
            </div>

            <h1 className="text-4xl sm:text-5xl font-heading font-semibold text-[#10212E] dark:text-white tracking-tight leading-[1.12]">
              A 360° picture of procurement.
            </h1>

            <p className="text-base sm:text-lg text-[#43525F] dark:text-[#B2C3D2] leading-relaxed max-w-xl">
              Connect suppliers and buying organizations in one verified, auditable procurement platform — from single-profile registration to sealed-bid evaluation and award.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <Button
                variant="primary"
                size="lg"
                onClick={() => openAuth('supplier', 'signup')}
                rightIcon={<ArrowRight />}
              >
                Register your company
              </Button>

              <Button
                variant="secondary"
                size="lg"
                onClick={() => setActiveNav('opportunities')}
              >
                Browse opportunities
              </Button>
            </div>

            {/* Micro Trust Proof */}
            <div className="pt-4 flex flex-wrap items-center gap-4 text-xs text-[#6B7A87] border-t border-[#D5E0EA] dark:border-[#1E364A]">
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#2F8F5B]" strokeWidth={1.5} />
                <span>CIPA & BURS sync</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-[#1F5F99] dark:text-[#6FAEE0]" strokeWidth={1.5} />
                <span>Asymmetric sealed bids</span>
              </span>
              <span className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-[#E8A33D]" strokeWidth={1.5} />
                <span>PPRA compliant</span>
              </span>
            </div>
          </div>

          {/* Right Column: Composed Product Preview Built In Code From Real UI Pieces */}
          <div className="lg:col-span-6">
            <div className="relative">
              {/* Outer Subtle Frame */}
              <Card variant="default" padding="none" className="overflow-hidden shadow-elevated border-hairline">
                {/* Simulated UI Window Header */}
                <div className="bg-[#F7FAFD] dark:bg-[#10212E] px-4 py-3 border-b border-[#D5E0EA] dark:border-[#1E364A] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#D5E0EA] dark:bg-slate-700" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#D5E0EA] dark:bg-slate-700" />
                    <span className="w-2.5 h-2.5 rounded-full bg-[#D5E0EA] dark:bg-slate-700" />
                    <span className="ml-2 text-[11px] font-mono font-medium text-[#6B7A87]">
                      bidready360.co.bw / supplier-passport
                    </span>
                  </div>
                  <Badge variant="verified" size="sm">
                    Verified Standing
                  </Badge>
                </div>

                {/* Composed Passport Preview Content */}
                <div className="p-5 sm:p-6 space-y-4 bg-white dark:bg-[#132635]">
                  {/* Company Header Row */}
                  <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#D5E0EA] dark:border-[#1E364A]">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-heading font-semibold text-[#10212E] dark:text-white">
                          {supplier.legalName || 'Kgalagadi Heavy Infrastructure (Pty) Ltd'}
                        </h4>
                        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded-[4px] bg-[#EAF2FA] dark:bg-[#1F5F99]/20 text-[#1F5F99] dark:text-[#6FAEE0]">
                          100% Citizen (EDD)
                        </span>
                      </div>
                      <p className="text-xs text-[#6B7A87]">
                        CIPA: {supplier.cipaNumber || 'BW00001234567'} · Building & Civil Construction
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-[11px] text-[#6B7A87] block">Profile score</span>
                      <span className="text-sm font-bold text-[#1F5F99] dark:text-[#6FAEE0]">
                        {supplier.profileCompleteness > 0 ? `${supplier.profileCompleteness}%` : '94%'}
                      </span>
                    </div>
                  </div>

                  {/* Status Chips List */}
                  <div className="space-y-2">
                    <span className="text-[11px] font-semibold text-[#6B7A87] uppercase tracking-wider block">
                      Statutory vault compliance
                    </span>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                      <div className="p-2 rounded-[6px] bg-[#F7FAFD] dark:bg-[#10212E] border border-[#D5E0EA] dark:border-[#1E364A] flex items-center justify-between">
                        <span className="text-[#43525F] dark:text-[#B2C3D2]">CIPA registration</span>
                        <Badge variant="verified" size="sm">Active</Badge>
                      </div>

                      <div className="p-2 rounded-[6px] bg-[#F7FAFD] dark:bg-[#10212E] border border-[#D5E0EA] dark:border-[#1E364A] flex items-center justify-between">
                        <span className="text-[#43525F] dark:text-[#B2C3D2]">BURS tax clearance</span>
                        <Badge variant="verified" size="sm">Valid</Badge>
                      </div>

                      <div className="p-2 rounded-[6px] bg-[#F7FAFD] dark:bg-[#10212E] border border-[#D5E0EA] dark:border-[#1E364A] flex items-center justify-between">
                        <span className="text-[#43525F] dark:text-[#B2C3D2]">PPRA contractor registration</span>
                        <Badge variant="verified" size="sm">Verified</Badge>
                      </div>

                      <div className="p-2 rounded-[6px] bg-[#F7FAFD] dark:bg-[#10212E] border border-[#D5E0EA] dark:border-[#1E364A] flex items-center justify-between">
                        <span className="text-[#43525F] dark:text-[#B2C3D2]">Sealed Bid Envelope</span>
                        <Badge variant="pula" size="sm">SHA-256</Badge>
                      </div>
                    </div>
                  </div>

                  {/* Active Consent Shared strip */}
                  <div className="p-2.5 rounded-[6px] bg-[#EAF2FA]/70 dark:bg-[#162C3E] border border-[#C9D9E8] dark:border-[#1E364A] flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2 text-[#1F5F99] dark:text-[#6FAEE0] font-medium">
                      <Share2 className="w-3.5 h-3.5" strokeWidth={1.5} />
                      <span>Shared with 4 Buying Roster Databases</span>
                    </div>
                    <span className="text-[11px] text-[#6B7A87]">Consent Active</span>
                  </div>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* 2. HOW IT WORKS: DUAL SEQUENCE (FOR SUPPLIERS / BUYERS)   */}
      {/* ======================================================== */}
      <section className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#D5E0EA] dark:border-[#1E364A] pb-4">
          <div className="space-y-1 max-w-xl">
            <span className="text-xs font-semibold text-[#1F5F99] dark:text-[#6FAEE0] uppercase tracking-wider block">
              Sequential Workflow
            </span>
            <h2 className="text-2xl sm:text-3xl font-heading font-semibold text-[#10212E] dark:text-white tracking-tight">
              How BidReady360 works
            </h2>
            <p className="text-sm text-[#6B7A87]">
              A structured lifecycle designed for transparency and zero paperwork redundancy.
            </p>
          </div>

          {/* Segmented Switcher */}
          <div className="flex items-center p-1 bg-[#F7FAFD] dark:bg-[#10212E] border border-[#D5E0EA] dark:border-[#1E364A] rounded-[8px] shrink-0">
            <button
              type="button"
              onClick={() => setHowItWorksTab('suppliers')}
              className={`px-4 py-1.5 rounded-[6px] text-xs font-semibold transition-all flex items-center gap-1.5 ${
                howItWorksTab === 'suppliers'
                  ? 'bg-white dark:bg-[#132635] text-[#10212E] dark:text-white shadow-subtle border border-[#D5E0EA] dark:border-[#1E364A]'
                  : 'text-[#6B7A87] hover:text-[#10212E] dark:hover:text-white'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>For Suppliers</span>
            </button>
            <button
              type="button"
              onClick={() => setHowItWorksTab('buyers')}
              className={`px-4 py-1.5 rounded-[6px] text-xs font-semibold transition-all flex items-center gap-1.5 ${
                howItWorksTab === 'buyers'
                  ? 'bg-white dark:bg-[#132635] text-[#10212E] dark:text-white shadow-subtle border border-[#D5E0EA] dark:border-[#1E364A]'
                  : 'text-[#6B7A87] hover:text-[#10212E] dark:hover:text-white'
              }`}
            >
              <Briefcase className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>For Buyers</span>
            </button>
          </div>
        </div>

        {/* 4 Step Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {(howItWorksTab === 'suppliers' ? supplierSteps : buyerSteps).map((step) => (
            <Card key={step.num} variant="default" padding="md" className="space-y-3 flex flex-col justify-between">
              <div className="space-y-2.5">
                <span className="font-mono text-xs font-bold text-[#1F5F99] dark:text-[#6FAEE0] bg-[#EAF2FA] dark:bg-[#1F5F99]/20 px-2 py-0.5 rounded-[4px] inline-block">
                  STEP {step.num}
                </span>
                <h3 className="text-base font-heading font-semibold text-[#10212E] dark:text-white leading-snug">
                  {step.title}
                </h3>
                <p className="text-xs text-[#6B7A87] leading-relaxed">
                  {step.description}
                </p>
              </div>

              <div className="pt-2 border-t border-[#D5E0EA] dark:border-[#1E364A] text-[11px] text-[#1F5F99] dark:text-[#6FAEE0] font-medium flex items-center gap-1">
                <span>{howItWorksTab === 'suppliers' ? 'Supplier Gateway' : 'Buyer Console'}</span>
                <ChevronRight className="w-3 h-3" strokeWidth={1.5} />
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* ======================================================== */}
      {/* 3. TRUST & SECURITY LAYER                                 */}
      {/* ======================================================== */}
      <section className="space-y-8">
        <div className="border-b border-[#D5E0EA] dark:border-[#1E364A] pb-4 space-y-1 max-w-2xl">
          <span className="text-xs font-semibold text-[#1F5F99] dark:text-[#6FAEE0] uppercase tracking-wider block">
            The Trust Layer
          </span>
          <h2 className="text-2xl sm:text-3xl font-heading font-semibold text-[#10212E] dark:text-white tracking-tight">
            Security, auditability, and data sovereignty
          </h2>
          <p className="text-sm text-[#6B7A87]">
            Trust in public and corporate procurement is built on immutable cryptography and transparent audit records.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* Pillar 1: Cryptographic Sealed Bids */}
          <Card variant="surface" padding="md" className="space-y-3">
            <div className="w-9 h-9 rounded-[6px] bg-white dark:bg-[#132635] text-[#1F5F99] dark:text-[#6FAEE0] border border-[#D5E0EA] dark:border-[#1E364A] flex items-center justify-center">
              <Lock className="w-5 h-5" strokeWidth={1.5} />
            </div>
            <h3 className="text-base font-heading font-semibold text-[#10212E] dark:text-white">
              Cryptographic Sealed Bids
            </h3>
            <p className="text-xs text-[#6B7A87] leading-relaxed">
              Price schedules are encrypted with public-key cryptography upon submission. Decryption is technically impossible before the official opening milestone.
            </p>
          </Card>

          {/* Pillar 2: Verified Statutory Standing */}
          <Card variant="surface" padding="md" className="space-y-3">
            <div className="w-9 h-9 rounded-[6px] bg-white dark:bg-[#132635] text-[#1F5F99] dark:text-[#6FAEE0] border border-[#D5E0EA] dark:border-[#1E364A] flex items-center justify-center">
              <FileCheck2 className="w-5 h-5 text-[#2F8F5B]" strokeWidth={1.5} />
            </div>
            <h3 className="text-base font-heading font-semibold text-[#10212E] dark:text-white">
              Verified Documents
            </h3>
            <p className="text-xs text-[#6B7A87] leading-relaxed">
              SHA-256 checksum stamping and expiration tracking ensure all certificates in the Document Vault are authentic, unexpired, and tamper-evident.
            </p>
          </Card>

          {/* Pillar 3: Consent-Based Sharing */}
          <Card variant="surface" padding="md" className="space-y-3">
            <div className="w-9 h-9 rounded-[6px] bg-white dark:bg-[#132635] text-[#1F5F99] dark:text-[#6FAEE0] border border-[#D5E0EA] dark:border-[#1E364A] flex items-center justify-center">
              <Share2 className="w-5 h-5 text-[#E8A33D]" strokeWidth={1.5} />
            </div>
            <h3 className="text-base font-heading font-semibold text-[#10212E] dark:text-white">
              Consent-Based Sharing
            </h3>
            <p className="text-xs text-[#6B7A87] leading-relaxed">
              Suppliers maintain full ownership of their data. Grant selective access to specific buying entities and revoke permissions at any time.
            </p>
          </Card>

          {/* Pillar 4: Immutable Forensic Audit Trail */}
          <Card variant="surface" padding="md" className="space-y-3">
            <div className="w-9 h-9 rounded-[6px] bg-white dark:bg-[#132635] text-[#1F5F99] dark:text-[#6FAEE0] border border-[#D5E0EA] dark:border-[#1E364A] flex items-center justify-center">
              <Eye className="w-5 h-5" strokeWidth={1.5} />
            </div>
            <h3 className="text-base font-heading font-semibold text-[#10212E] dark:text-white">
              Immutable Audit Trail
            </h3>
            <p className="text-xs text-[#6B7A87] leading-relaxed">
              Append-only event ledger records every document view, evaluator score submission, addendum bulletin, and formal award decision.
            </p>
          </Card>
        </div>
      </section>

      {/* ======================================================== */}
      {/* 4. LATEST OPPORTUNITIES STRIP (LIVE-LOOKING FROM DATA)    */}
      {/* ======================================================== */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#D5E0EA] dark:border-[#1E364A] pb-4">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-[#1F5F99] dark:text-[#6FAEE0] uppercase tracking-wider block">
              Active Procurement Calls
            </span>
            <h2 className="text-2xl sm:text-3xl font-heading font-semibold text-[#10212E] dark:text-white tracking-tight">
              Latest opportunities
            </h2>
          </div>

          <Button
            variant="secondary"
            size="sm"
            onClick={() => setActiveNav('opportunities')}
            rightIcon={<ArrowRight />}
          >
            View all {calls.length} tenders
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {latestCalls.map((call) => (
            <Card
              key={call.id}
              variant="interactive"
              padding="md"
              onClick={() => handleSelectCall(call.id)}
              className="space-y-3 flex flex-col justify-between"
            >
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-[11px] text-[#6B7A87]">
                    {call.callNumber}
                  </span>
                  <Badge variant={call.type === 'RFP' ? 'pula' : 'neutral'} size="sm">
                    {call.type}
                  </Badge>
                </div>

                <h3 className="text-sm font-heading font-semibold text-[#10212E] dark:text-white line-clamp-2 leading-snug">
                  {call.title}
                </h3>

                <p className="text-xs text-[#6B7A87]">
                  {call.organizationName}
                </p>
              </div>

              <div className="pt-3 border-t border-[#D5E0EA] dark:border-[#1E364A] flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5 text-[#43525F] dark:text-[#B2C3D2]">
                  <Clock className="w-3.5 h-3.5 text-[#E8A33D]" strokeWidth={1.5} />
                  <span>Closes {call.closingDate}</span>
                </div>
                <span className="font-semibold text-[#1F5F99] dark:text-[#6FAEE0]">
                  View call →
                </span>
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* ======================================================== */}
      {/* 5. FREQUENTLY ASKED QUESTIONS PREVIEW                     */}
      {/* ======================================================== */}
      <section className="space-y-6">
        <div className="border-b border-[#D5E0EA] dark:border-[#1E364A] pb-4 flex items-center justify-between gap-4">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-[#1F5F99] dark:text-[#6FAEE0] uppercase tracking-wider block">
              Clear Answers
            </span>
            <h2 className="text-2xl sm:text-3xl font-heading font-semibold text-[#10212E] dark:text-white tracking-tight">
              Frequently asked questions
            </h2>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveNav('help')}
            rightIcon={<ArrowRight />}
          >
            All questions
          </Button>
        </div>

        <div className="max-w-3xl">
          <Accordion items={homeFaqItems} allowMultiple />
        </div>
      </section>

      {/* ======================================================== */}
      {/* 6. EDITORIAL CALL TO ACTION FOOTER BANNER                 */}
      {/* ======================================================== */}
      <section>
        <Card variant="dark" padding="lg" className="relative overflow-hidden">
          <RingMotif
            size={400}
            dotAngle={75}
            color="#1E364A"
            position="bottom-right"
          />

          <div className="relative z-10 max-w-xl space-y-4">
            <h3 className="text-2xl sm:text-3xl font-heading font-semibold text-white tracking-tight">
              Ready to modernize your procurement process?
            </h3>
            <p className="text-sm text-[#B2C3D2] leading-relaxed">
              Create your company’s verified Supplier Passport or launch a configured workspace for your procuring entity.
            </p>

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <Button
                variant="primary"
                size="md"
                onClick={() => openAuth('supplier', 'signup')}
                rightIcon={<ArrowRight />}
              >
                Register as a supplier
              </Button>
              <Button
                variant="outline-dark"
                size="md"
                onClick={() => openAuth('buyer', 'signin')}
              >
                Sign in to buyer console
              </Button>
            </div>
          </div>
        </Card>
      </section>

      {/* Auth Modal Trigger */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        initialTenant={authTenant}
        initialMode={authMode}
      />
    </div>
  );
};
