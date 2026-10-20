import React, { useState } from 'react';
import { useApp } from '../../context/AppContext';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { RingMotif } from '../ui/RingMotif';
import { Accordion, AccordionItem } from '../ui/Accordion';
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
  Scan,
  Copy,
  X,
  RefreshCw,
} from 'lucide-react';

// Strictly Demo Data for Hero Product Preview (Safe from client confidential data)
const DEMO_PASSPORT_DOCS = [
  {
    id: 'doc-cipa',
    title: 'CIPA Certificate of Incorporation',
    filename: 'CIPA_Cert_BW00008492019.pdf',
    authority: 'Companies and Intellectual Property Authority (CIPA)',
    type: 'Statutory Registry',
    status: 'Verified (API Sync)',
    size: '1.4 MB',
    date: '02 Oct 2026',
    expiry: 'Perpetual Standing',
    sha256: '9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08',
    ocrConfidence: '99.8%',
  },
  {
    id: 'doc-tax',
    title: 'BURS Tax Clearance Certificate',
    filename: 'BURS_TCC_Q4_2026.pdf',
    authority: 'Botswana Unified Revenue Service (BURS)',
    type: 'Revenue & Tax Compliance',
    status: 'Valid to 31 Dec 2026',
    size: '820 KB',
    date: '04 Oct 2026',
    expiry: '31 Dec 2026',
    sha256: '5e884898da28047151d0e56f8dc6292773603d0d6aabbdd62a11ef721d1542d8',
    ocrConfidence: '100%',
  },
  {
    id: 'doc-ppra',
    title: 'PPRA Contractor Registration',
    filename: 'PPRA_Code01_Building_GradeE.pdf',
    authority: 'Public Procurement Regulatory Authority (PPRA)',
    type: 'Works Contractor Accreditation',
    status: 'Grade E Active',
    size: '1.8 MB',
    date: '05 Oct 2026',
    expiry: '30 Sep 2027',
    sha256: '4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a',
    ocrConfidence: '99.4%',
  },
  {
    id: 'doc-bank',
    title: 'Bank Account Confirmation Letter',
    filename: 'Absa_Bank_Letter_Confirmed.pdf',
    authority: 'Absa Bank Botswana Limited',
    type: 'Financial Soundness',
    status: 'KYC Cleared',
    size: '410 KB',
    date: '01 Oct 2026',
    expiry: 'Valid (Issued < 3 months)',
    sha256: 'ef2d127de37b942baad06145e54b0c619a1f22327b2ebbcfbec78f5564afe39d',
    ocrConfidence: '99.1%',
  },
  {
    id: 'doc-omang',
    title: 'Certified Omang IDs (Resident Directors)',
    filename: 'Directors_Omang_Certified_2026.pdf',
    authority: 'Department of Civil & National Registration',
    type: 'Beneficial Ownership Verification',
    status: '100% Equity Verified',
    size: '2.6 MB',
    date: '01 Oct 2026',
    expiry: 'Valid to 14 Aug 2031',
    sha256: '8c6976e5b5410415bde908bd4dee15dfb167a9c873fc4bb8a81f6f2ab448a918',
    ocrConfidence: '99.9%',
  },
];

export const PublicAbout: React.FC = () => {
  const { calls, setRole, setActiveNav, setSelectedCallId } = useApp();
  const [howItWorksTab, setHowItWorksTab] = useState<'suppliers' | 'buyers'>('suppliers');
  const [previewTab, setPreviewTab] = useState<'documents' | 'sharing' | 'security'>('documents');
  const [isScanning, setIsScanning] = useState(false);
  const [scanSuccess, setScanSuccess] = useState(false);
  const [copiedHash, setCopiedHash] = useState(false);
  const [selectedDemoDoc, setSelectedDemoDoc] = useState<any | null>(null);

  const handleTriggerScan = () => {
    if (isScanning) return;
    setIsScanning(true);
    setScanSuccess(false);
    setTimeout(() => {
      setIsScanning(false);
      setScanSuccess(true);
      setTimeout(() => setScanSuccess(false), 4000);
    }, 1600);
  };

  const openAuth = (tenant: 'supplier' | 'buyer', mode: 'signin' | 'signup') => {
    if (tenant === 'buyer') {
      setActiveNav(mode === 'signup' ? 'buyer-signup' : 'buyer-login');
    } else {
      setActiveNav(mode === 'signup' ? 'supplier-signup' : 'supplier-login');
    }
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

            <h1 className="text-4xl sm:text-5xl font-heading font-semibold text-[#3e3b3b] dark:text-[#de0606] tracking-tight leading-[1.12]">
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

            {/* Buyer Path Link */}
            <div className="pt-1">
              <button
                type="button"
                onClick={() => {
                  setHowItWorksTab('buyers');
                  const el = document.getElementById('how-it-works-section');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                  else setActiveNav('buyers');
                }}
                className="text-[14px] text-[#1F5F99] dark:text-[#6FAEE0] font-medium hover:underline inline-flex items-center gap-1 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8]"
              >
                <span>Are you a buyer? See how it works for buyers →</span>
              </button>
            </div>

            {/* Micro Trust Proof */}
            <div id="how-it-works-section" className="pt-4 flex flex-wrap items-center gap-4 sm:gap-6 text-[14px] text-[#334155] border-t border-[#D5E0EA] dark:border-[#1E364A]">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="w-[18px] h-[18px] text-[#2F8F5B]" strokeWidth={1.5} />
                <span className="text-[14px] text-[#334155] font-medium">CIPA & BURS sync</span>
              </span>
              <span className="flex items-center gap-2">
                <Lock className="w-[18px] h-[18px] text-[#1F5F99] dark:text-[#6FAEE0]" strokeWidth={1.5} />
                <span className="text-[14px] text-[#334155] font-medium">Asymmetric sealed bids</span>
              </span>
              <span className="flex items-center gap-2">
                <Shield className="w-[18px] h-[18px] text-[#B45309]" strokeWidth={1.5} />
                <span className="text-[14px] text-[#334155] font-medium">PPRA compliant</span>
              </span>
            </div>
          </div>

          {/* Right Column: Composed Product Preview Built With Demo-Only Data & Fluid Animations */}
          <div className="lg:col-span-6">
            <div className="relative group">
              {/* Animated Ambient Backlight Glow */}
              <div className="absolute -inset-1.5 bg-gradient-to-r from-[#1F5F99]/25 via-[#2F8F5B]/20 to-[#6FAEE0]/25 rounded-[16px] blur-xl opacity-70 group-hover:opacity-100 transition-opacity duration-700 motion-reduce:animate-none -z-10 pointer-events-none" />

              {/* Outer Frame with Smooth Hover Elevation - treated as illustration illustration role="img" */}
              <div
                role="img"
                aria-label="Illustration of a verified supplier passport showing prequalification documents (demo data)"
              >
                <Card
                  variant="default"
                  padding="none"
                  className="overflow-hidden shadow-elevated border-hairline transition-all duration-300 hover:shadow-2xl hover:border-[#1F5F99]/40 relative bg-white dark:bg-[#132635]"
                >
                  <div aria-hidden="true">
                    {/* Active Laser Scanner Beam across the card during scan */}
                    {isScanning && (
                      <div className="absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-[#2F8F5B] to-transparent shadow-[0_0_18px_#2F8F5B] z-30 pointer-events-none motion-reduce:animate-none animate-scan-beam" />
                    )}

                    {/* Simulated UI Window Header */}
                    <div className="bg-[#F7FAFD] dark:bg-[#10212E] px-4 py-3 border-b border-[#D5E0EA] dark:border-[#1E364A] flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="w-2.5 h-2.5 rounded-full bg-[#E5484D]/80 hover:scale-125 transition-transform cursor-pointer" />
                        <span className="w-2.5 h-2.5 rounded-full bg-[#E8A33D]/80 hover:scale-125 transition-transform cursor-pointer" />
                        <span className="w-2.5 h-2.5 rounded-full bg-[#2F8F5B]/80 hover:scale-125 transition-transform cursor-pointer" />
                        <span className="ml-2 text-xs font-mono font-medium text-[#475569] truncate hidden sm:inline">
                          bidready360.co.bw / supplier-passport / BW00008492019
                        </span>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {/* Interactive Scan Trigger Button */}
                        <button
                          type="button"
                          onClick={handleTriggerScan}
                          disabled={isScanning}
                          className="px-2 py-1 rounded-[6px] text-xs font-semibold bg-[#1F5F99]/10 hover:bg-[#1F5F99]/20 text-[#1F5F99] dark:text-[#6FAEE0] border border-[#1F5F99]/30 flex items-center gap-1.5 transition-all cursor-pointer shadow-xs disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8]"
                          title="Trigger real-time cryptographic vault verification"
                        >
                          <Scan className={`w-3.5 h-3.5 ${isScanning ? 'motion-reduce:animate-none animate-radar-spin text-[#2F8F5B]' : ''}`} />
                          <span>{isScanning ? 'Verifying...' : 'Scan Vault'}</span>
                        </button>

                        <span className="px-2 py-0.5 rounded text-xs font-mono font-semibold bg-[#DCFCE7] text-[#166534] border border-[#86EFAC] flex items-center gap-1.5">
                          <span className="relative flex h-2 w-2">
                            <span className="motion-reduce:animate-none animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                          </span>
                          DEMO VERIFIED
                        </span>
                      </div>
                    </div>

                    {/* Scan Success Animated Alert */}
                    {scanSuccess && (
                      <div className="bg-emerald-600 text-white px-4 py-2 text-xs font-medium flex items-center justify-between gap-2 motion-reduce:transition-none shadow-inner">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="w-4 h-4 shrink-0 text-white" />
                          <span>All 4 SHA-256 cryptographic hashes verified untampered via live CIPA API!</span>
                        </div>
                        <span className="font-mono text-xs bg-emerald-700 px-1.5 py-0.5 rounded text-white">
                          0.04s
                        </span>
                      </div>
                    )}

                    {/* Composed Passport Preview Content - Strictly Demo Data */}
                    <div className="p-5 sm:p-6 space-y-4 bg-white dark:bg-[#132635] relative">
                      {/* Company Profile Header Row */}
                      <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#D5E0EA] dark:border-[#1E364A]">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 rounded-[8px] bg-gradient-to-br from-[#1F5F99] via-[#164875] to-[#10212E] text-white flex items-center justify-center font-heading font-bold text-sm shrink-0 shadow-md relative overflow-hidden group/avatar">
                            <span>MS</span>
                            <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent group-hover/avatar:translate-x-full transition-transform duration-700 motion-reduce:transition-none" />
                          </div>
                          <div className="space-y-0.5 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <h2 className="text-sm sm:text-base font-heading font-semibold text-[#10212E] dark:text-white leading-tight">
                                Morama Solutions (Pty) Ltd
                              </h2>
                              <span className="font-mono text-xs px-2 py-0.5 rounded-[4px] bg-[#DCFCE7] text-[#166534] border border-[#86EFAC] font-semibold">
                                Citizen-owned
                              </span>
                            </div>
                            <p className="text-xs text-[#475569]">
                              CIPA: <span className="font-mono text-[#10212E] dark:text-slate-300 font-medium">BW00008492019</span> · BURS TIN: <span className="font-mono text-[#10212E] dark:text-slate-300 font-medium">C9018472-01</span>
                            </p>
                            <p className="text-xs text-[#475569]">
                              Gaborone West Industrial · Building Works, Civil Engineering & ICT Supplies
                            </p>
                          </div>
                        </div>

                        <div className="text-right shrink-0 pl-2">
                          <span className="text-xs uppercase font-semibold tracking-wider text-[#475569] block">
                            Passport Score
                          </span>
                          <div className="relative overflow-hidden inline-block px-2 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 my-0.5">
                            <span className="text-base sm:text-lg font-heading font-bold text-[#166534] dark:text-emerald-400 tabular-nums">
                              100%
                            </span>
                            <span className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent motion-reduce:animate-none animate-shimmer pointer-events-none" />
                          </div>
                          <span className="text-xs font-semibold text-[#166534] dark:text-emerald-400 block">
                            Audit Cleared
                          </span>
                        </div>
                      </div>

                      {/* Interactive Tab Navigation with role="tablist" */}
                      <div role="tablist" aria-label="Passport preview tabs" className="flex items-center gap-1 p-1 bg-[#F7FAFD] dark:bg-[#10212E] rounded-[8px] border border-[#D5E0EA] dark:border-[#1E364A] text-xs">
                        <button
                          role="tab"
                          aria-selected={previewTab === 'documents'}
                          tabIndex={previewTab === 'documents' ? 0 : -1}
                          type="button"
                          onClick={() => setPreviewTab('documents')}
                          className={`flex-1 py-1.5 px-2.5 rounded-[6px] font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8] ${
                            previewTab === 'documents'
                              ? 'bg-white dark:bg-[#1F5F99] text-[#1F5F99] dark:text-white shadow-xs font-semibold scale-[1.01]'
                              : 'text-[#475569] hover:text-[#10212E] dark:hover:text-white'
                          }`}
                        >
                          <FileCheck2 className="w-3.5 h-3.5" />
                          <span>Uploaded Docs (4)</span>
                        </button>
                        <button
                          role="tab"
                          aria-selected={previewTab === 'sharing'}
                          tabIndex={previewTab === 'sharing' ? 0 : -1}
                          type="button"
                          onClick={() => setPreviewTab('sharing')}
                          className={`flex-1 py-1.5 px-2.5 rounded-[6px] font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8] ${
                            previewTab === 'sharing'
                              ? 'bg-white dark:bg-[#1F5F99] text-[#1F5F99] dark:text-white shadow-xs font-semibold scale-[1.01]'
                              : 'text-[#475569] hover:text-[#10212E] dark:hover:text-white'
                          }`}
                        >
                          <Share2 className="w-3.5 h-3.5" />
                          <span>Buyer Sharing (3)</span>
                        </button>
                        <button
                          role="tab"
                          aria-selected={previewTab === 'security'}
                          tabIndex={previewTab === 'security' ? 0 : -1}
                          type="button"
                          onClick={() => setPreviewTab('security')}
                          className={`flex-1 py-1.5 px-2.5 rounded-[6px] font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8] ${
                            previewTab === 'security'
                              ? 'bg-white dark:bg-[#1F5F99] text-[#1F5F99] dark:text-white shadow-xs font-semibold scale-[1.01]'
                              : 'text-[#475569] hover:text-[#10212E] dark:hover:text-white'
                          }`}
                        >
                          <ShieldCheck className="w-3.5 h-3.5" />
                          <span>Vault Integrity</span>
                        </button>
                      </div>

                      {/* TAB 1: UPLOADED DOCUMENTS LIST (First 4 docs, no nested scrollbar) */}
                      {previewTab === 'documents' && (
                        <div className="space-y-2 motion-reduce:animate-none animate-fade-in">
                          <div className="flex items-center justify-between text-xs text-[#475569] px-0.5">
                            <span className="font-semibold uppercase tracking-wider text-xs">
                              Statutory & Prequalification Vault
                            </span>
                            <span className="text-xs text-[#166534] font-semibold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5 text-[#166534]" />
                              4 verified files
                            </span>
                          </div>

                          <div className="space-y-2">
                            {DEMO_PASSPORT_DOCS.slice(0, 4).map((doc) => (
                              <div
                                key={doc.id}
                                onClick={() => setSelectedDemoDoc(doc)}
                                className="p-3.5 rounded-[8px] bg-[#F7FAFD] dark:bg-[#10212E] border border-[#D5E0EA] dark:border-[#1E364A] flex items-center justify-between gap-3 text-xs hover:border-[#1F5F99] hover:bg-white dark:hover:bg-[#162C3E] hover:-translate-y-0.5 hover:shadow-xs transition-all duration-200 cursor-pointer group/row focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8]"
                                title="Click to inspect cryptographic seal & OCR confidence"
                              >
                                <div className="flex items-center gap-3 min-w-0">
                                  <div className="w-8 h-8 rounded-[6px] bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900 flex items-center justify-center shrink-0 font-bold text-xs group-hover/row:scale-105 transition-transform">
                                    PDF
                                  </div>
                                  <div className="min-w-0 space-y-0.5">
                                    <span className="font-semibold text-[#10212E] dark:text-white truncate block group-hover/row:text-[#1F5F99] dark:group-hover/row:text-[#38BDF8] transition-colors text-xs">
                                      {doc.title}
                                    </span>
                                    <div className="text-xs text-[#475569] flex items-center gap-2 truncate">
                                      <span>{doc.filename}</span>
                                      <span>·</span>
                                      <span>{doc.size}</span>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  <span className="px-2 py-0.5 rounded bg-[#DCFCE7] text-[#166534] text-xs font-semibold border border-[#86EFAC] flex items-center gap-1">
                                    <Check className="w-3.5 h-3.5 text-[#166534]" />
                                    {doc.status}
                                  </span>
                                  <ChevronRight className="w-4 h-4 text-[#475569] opacity-0 group-hover/row:opacity-100 group-hover/row:translate-x-0.5 transition-all" />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* TAB 2: BUYER SHARING */}
                      {previewTab === 'sharing' && (
                        <div className="space-y-2 motion-reduce:animate-none animate-fade-in">
                          <div className="flex items-center justify-between text-xs text-[#475569] px-0.5">
                            <span className="font-semibold uppercase tracking-wider text-xs">
                              Authorized Public & Private Buyers
                            </span>
                            <span className="text-xs text-[#1F5F99] dark:text-[#38BDF8] font-medium flex items-center gap-1">
                              <span className="w-1.5 h-1.5 rounded-full bg-[#1F5F99] dark:bg-[#38BDF8] animate-pulse motion-reduce:animate-none" />
                              3 Active Consents
                            </span>
                          </div>

                          <div className="space-y-2">
                            <div className="p-3.5 rounded-[8px] bg-[#F7FAFD] dark:bg-[#10212E] border border-[#D5E0EA] dark:border-[#1E364A] space-y-1 hover:border-[#1F5F99]/50 transition-colors">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-semibold text-[#10212E] dark:text-white text-xs">
                                  Gaborone Regional Council (GRC)
                                </span>
                                <span className="px-2 py-0.5 rounded bg-[#DCFCE7] text-[#166534] text-xs font-semibold border border-[#86EFAC] flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#166534]" />
                                  Consent Active
                                </span>
                              </div>
                              <p className="text-xs text-[#475569]">
                                Scope: Statutory documents & bank details · Valid until Sep 2027
                              </p>
                            </div>

                            <div className="p-3.5 rounded-[8px] bg-[#F7FAFD] dark:bg-[#10212E] border border-[#D5E0EA] dark:border-[#1E364A] space-y-1 hover:border-[#1F5F99]/50 transition-colors">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-semibold text-[#10212E] dark:text-white text-xs">
                                  Debswana Diamond Company
                                </span>
                                <span className="px-2 py-0.5 rounded bg-[#DCFCE7] text-[#166534] text-xs font-semibold border border-[#86EFAC] flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#166534]" />
                                  Consent Active
                                </span>
                              </div>
                              <p className="text-xs text-[#475569]">
                                Scope: Prequalification Vault & PPRA certificates · Valid until Mar 2027
                              </p>
                            </div>

                            <div className="p-3.5 rounded-[8px] bg-[#F7FAFD] dark:bg-[#10212E] border border-[#D5E0EA] dark:border-[#1E364A] space-y-1 hover:border-[#1F5F99]/50 transition-colors">
                              <div className="flex items-center justify-between text-xs">
                                <span className="font-semibold text-[#10212E] dark:text-white text-xs">
                                  Water Utilities Corporation (WUC)
                                </span>
                                <span className="px-2 py-0.5 rounded bg-[#DCFCE7] text-[#166534] text-xs font-semibold border border-[#86EFAC] flex items-center gap-1">
                                  <span className="w-1.5 h-1.5 rounded-full bg-[#166534]" />
                                  Consent Active
                                </span>
                              </div>
                              <p className="text-xs text-[#475569]">
                                Scope: Full compliance passport · Valid until Oct 2027
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* TAB 3: VAULT INTEGRITY */}
                      {previewTab === 'security' && (
                        <div className="space-y-3 motion-reduce:animate-none animate-fade-in">
                          <div className="p-3.5 rounded-[8px] bg-[#F7FAFD] dark:bg-[#10212E] border border-[#D5E0EA] dark:border-[#1E364A] space-y-2 text-xs">
                            <div className="flex items-center gap-2 text-[#10212E] dark:text-white font-semibold text-xs">
                              <div className="p-1 rounded bg-[#1F5F99]/10 text-[#1F5F99] dark:text-[#38BDF8]">
                                <Lock className="w-4 h-4 motion-reduce:animate-none animate-pulse" />
                              </div>
                              <span>Asymmetric Sealed Bidding</span>
                            </div>
                            <p className="text-[#475569] text-xs leading-relaxed">
                              Tender bids and commercial envelopes remain client-side encrypted until the official tender closing date and dual-key opening ceremony.
                            </p>
                          </div>

                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div className="p-3 rounded-[8px] bg-[#F7FAFD] dark:bg-[#10212E] border border-[#D5E0EA] dark:border-[#1E364A] space-y-1 hover:border-[#1F5F99]/50 transition-colors">
                              <span className="text-xs text-[#475569] block">Ledger Integrity</span>
                              <span className="font-mono text-xs font-semibold text-[#1F5F99] dark:text-[#38BDF8] flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-[#166534]" />
                                SHA-256 Hashed
                              </span>
                            </div>
                            <div className="p-3 rounded-[8px] bg-[#F7FAFD] dark:bg-[#10212E] border border-[#D5E0EA] dark:border-[#1E364A] space-y-1 hover:border-[#1F5F99]/50 transition-colors">
                              <span className="text-xs text-[#475569] block">Access Control</span>
                              <span className="text-xs font-semibold text-[#166534] flex items-center gap-1">
                                <ShieldCheck className="w-3.5 h-3.5 text-[#166534]" />
                                Consent-Gated
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Confidential Data Protection Footer */}
                      <div className="p-3 rounded-[6px] bg-[#F0F5FA] dark:bg-[#162C3E] border border-[#D5E0EA] dark:border-[#1E364A] flex items-center justify-between text-xs text-[#475569]">
                        <div className="flex items-center gap-2">
                          <Shield className="w-4 h-4 text-[#1F5F99] dark:text-[#6FAEE0] shrink-0" strokeWidth={1.5} />
                          <span className="text-xs">
                            Demo data only. Live client data is never exposed.
                          </span>
                        </div>
                      </div>

                      {/* Interactive Document Inspection Modal (Opens on document click) */}
                      {selectedDemoDoc && (
                        <div className="absolute inset-0 z-40 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 motion-reduce:animate-none animate-fade-in">
                          <div className="bg-white dark:bg-[#132635] border border-[#D5E0EA] dark:border-[#1E364A] rounded-[10px] shadow-2xl max-w-sm w-full p-4 space-y-3 motion-reduce:animate-none animate-fade-in text-xs">
                            <div className="flex items-start justify-between gap-2 pb-2 border-b border-[#D5E0EA] dark:border-[#1E364A]">
                              <div className="space-y-0.5">
                                <span className="font-heading font-semibold text-sm text-[#10212E] dark:text-white block">
                                  {selectedDemoDoc.title}
                                </span>
                                <span className="text-xs text-[#475569] block">
                                  {selectedDemoDoc.authority}
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => setSelectedDemoDoc(null)}
                                className="p-1 rounded text-[#475569] hover:text-[#10212E] dark:hover:text-white cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8]"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>

                            <div className="space-y-2">
                              <div className="p-2.5 rounded bg-[#F7FAFD] dark:bg-[#10212E] border border-[#D5E0EA] dark:border-[#1E364A] space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="text-xs font-semibold text-[#475569]">
                                    Cryptographic SHA-256 Hash
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      navigator.clipboard.writeText(selectedDemoDoc.sha256);
                                      setCopiedHash(true);
                                      setTimeout(() => setCopiedHash(false), 2000);
                                    }}
                                    className="text-xs text-[#1F5F99] dark:text-[#38BDF8] hover:underline font-semibold flex items-center gap-1 cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8]"
                                  >
                                    <Copy className="w-3.5 h-3.5" />
                                    <span>{copiedHash ? 'Copied!' : 'Copy'}</span>
                                  </button>
                                </div>
                                <span className="font-mono text-xs text-slate-700 dark:text-slate-300 break-all block leading-tight">
                                  {selectedDemoDoc.sha256}
                                </span>
                              </div>

                              <div className="grid grid-cols-2 gap-2">
                                <div className="p-2.5 rounded bg-[#F7FAFD] dark:bg-[#10212E] border border-[#D5E0EA] dark:border-[#1E364A]">
                                  <span className="text-xs text-[#475569] block">OCR Confidence</span>
                                  <span className="font-semibold text-emerald-600 dark:text-emerald-400 text-xs">
                                    {selectedDemoDoc.ocrConfidence}
                                  </span>
                                </div>
                                <div className="p-2.5 rounded bg-[#F7FAFD] dark:bg-[#10212E] border border-[#D5E0EA] dark:border-[#1E364A]">
                                  <span className="text-xs text-[#475569] block">File Size</span>
                                  <span className="font-semibold text-[#10212E] dark:text-white text-xs">
                                    {selectedDemoDoc.size}
                                  </span>
                                </div>
                              </div>

                              <div className="p-2.5 rounded bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-800 dark:text-emerald-300 flex items-center gap-1.5">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                                <span>Digital Signature & Timestamp Validated</span>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => setSelectedDemoDoc(null)}
                              className="w-full py-2 bg-[#1F5F99] hover:bg-[#184c7a] text-white rounded-[6px] font-semibold text-xs transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8]"
                            >
                              Close Details
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ======================================================== */}
      {/* 2. HOW IT WORKS: DUAL SEQUENCE (FOR SUPPLIERS / BUYERS)   */}
      {/* ======================================================== */}
      <section className="space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-[#D5E0EA] dark:border-[#1E364A] pb-4">
          <div className="space-y-2 max-w-xl">
            <Badge variant="pula" size="md">
              Sequential Workflow
            </Badge>
            <h2 className="text-2xl sm:text-3xl font-heading font-semibold text-[#10212E] dark:text-white tracking-tight">
              How BidReady360 works
            </h2>
            <p className="text-sm text-[#475569]">
              A structured lifecycle designed for transparency and zero paperwork redundancy.
            </p>
          </div>

          {/* Segmented Switcher with role="tablist" */}
          <div role="tablist" aria-label="Workflow tabs" className="flex items-center p-1 bg-[#F7FAFD] dark:bg-[#10212E] border border-[#D5E0EA] dark:border-[#1E364A] rounded-[8px] shrink-0">
            <button
              role="tab"
              aria-selected={howItWorksTab === 'suppliers'}
              tabIndex={howItWorksTab === 'suppliers' ? 0 : -1}
              type="button"
              onClick={() => setHowItWorksTab('suppliers')}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                  setHowItWorksTab(howItWorksTab === 'suppliers' ? 'buyers' : 'suppliers');
                }
              }}
              className={`px-4 py-1.5 rounded-[6px] text-xs font-semibold transition-all flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8] ${
                howItWorksTab === 'suppliers'
                  ? 'bg-white dark:bg-[#132635] text-[#10212E] dark:text-white shadow-subtle border border-[#D5E0EA] dark:border-[#1E364A]'
                  : 'text-[#475569] hover:text-[#10212E] dark:hover:text-white'
              }`}
            >
              <Building2 className="w-3.5 h-3.5" strokeWidth={1.5} />
              <span>For Suppliers</span>
            </button>
            <button
              role="tab"
              aria-selected={howItWorksTab === 'buyers'}
              tabIndex={howItWorksTab === 'buyers' ? 0 : -1}
              type="button"
              onClick={() => setHowItWorksTab('buyers')}
              onKeyDown={(e) => {
                if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
                  setHowItWorksTab(howItWorksTab === 'suppliers' ? 'buyers' : 'suppliers');
                }
              }}
              className={`px-4 py-1.5 rounded-[6px] text-xs font-semibold transition-all flex items-center gap-1.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1D4ED8] ${
                howItWorksTab === 'buyers'
                  ? 'bg-white dark:bg-[#132635] text-[#10212E] dark:text-white shadow-subtle border border-[#D5E0EA] dark:border-[#1E364A]'
                  : 'text-[#475569] hover:text-[#10212E] dark:hover:text-white'
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
                <p className="text-xs text-[#475569] leading-relaxed">
                  {step.description}
                </p>
              </div>

              <div className="pt-2 border-t border-[#D5E0EA] dark:border-[#1E364A] text-xs text-[#1F5F99] dark:text-[#6FAEE0] font-medium flex items-center gap-1">
                <span>{howItWorksTab === 'suppliers' ? 'Supplier Gateway' : 'Buyer Console'}</span>
                <ChevronRight className="w-3.5 h-3.5" strokeWidth={1.5} />
              </div>
            </Card>
          ))}
        </div>
      </section>

      {/* ======================================================== */}
      {/* 3. TRUST & SECURITY LAYER                                 */}
      {/* ======================================================== */}
      <section className="space-y-8">
        <div className="border-b border-[#D5E0EA] dark:border-[#1E364A] pb-4 space-y-2 max-w-2xl">
          <Badge variant="pula" size="md">
            The Trust Layer
          </Badge>
          <h2 className="text-2xl sm:text-3xl font-heading font-semibold text-[#10212E] dark:text-white tracking-tight">
            Security, auditability, and data sovereignty
          </h2>
          <p className="text-sm text-[#475569]">
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
            <p className="text-xs text-[#475569] leading-relaxed">
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
            <p className="text-xs text-[#475569] leading-relaxed">
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
            <p className="text-xs text-[#475569] leading-relaxed">
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
            <p className="text-xs text-[#475569] leading-relaxed">
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
          <div className="space-y-2">
            <Badge variant="pula" size="md">
              Active Procurement Calls
            </Badge>
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
                  <span className="font-mono text-xs text-[#475569]">
                    {call.callNumber}
                  </span>
                  <Badge variant={call.type === 'RFP' ? 'pula' : 'neutral'} size="sm">
                    {call.type}
                  </Badge>
                </div>

                <h3 className="text-sm font-heading font-semibold text-[#10212E] dark:text-white line-clamp-2 leading-snug">
                  {call.title}
                </h3>

                <p className="text-xs text-[#475569]">
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
          <div className="space-y-2">
            <Badge variant="pula" size="md">
              Clear Answers
            </Badge>
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
    </div>
  );
};
