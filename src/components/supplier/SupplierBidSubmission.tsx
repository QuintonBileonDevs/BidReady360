import React, { useState, useMemo, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Call, PriceLineItem, Application } from '../../types';
import { StatusChip } from '../common/StatusChip';
import {
  Lock,
  Clock,
  Building2,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Download,
  ArrowRight,
  ArrowLeft,
  FileText,
  Upload,
  ShieldCheck,
  RefreshCw,
  XCircle,
  FileCheck,
  Check,
  Eye,
  Info,
  ShieldAlert,
} from 'lucide-react';

interface SupplierBidSubmissionProps {
  initialCallId?: string | null;
  onFinished: (appId: string) => void;
  onCancel: () => void;
}

interface SupportingFileItem {
  id: string;
  name: string;
  type: string;
  size: string;
  fingerprint: string;
  mandatory: boolean;
  uploadedAt: string;
  fileName: string;
}

export const SupplierBidSubmission: React.FC<SupplierBidSubmissionProps> = ({
  initialCallId,
  onFinished,
  onCancel,
}) => {
  const {
    calls,
    supplier,
    submitApplication,
    applications,
    withdrawApplication,
    addAuditEvent,
    selectedCallId,
    setActiveNav,
  } = useApp();

  const activeCallId = initialCallId || selectedCallId || 'call-grc-rfp-08';
  const call = useMemo(
    () => calls.find((c) => c.id === activeCallId) || calls.find((c) => c.type === 'RFP') || calls[0],
    [calls, activeCallId]
  );

  // Check if call is closed
  const isCallClosed = useMemo(() => {
    if (!call) return false;
    const now = new Date('2026-10-06T00:45:00').getTime();
    const close = new Date(`${call.closingDate}T14:00:00`).getTime();
    return close < now || call.status === 'Closed';
  }, [call]);

  // Existing submitted bid for this call by the current supplier
  const existingApp = useMemo(() => {
    return applications.find((a) => a.callId === call?.id && a.supplierId === supplier.id && a.status !== 'Withdrawn');
  }, [applications, call, supplier.id]);

  // 5 Steps: 1: Price schedule, 2: Technical response, 3: Supporting files, 4: Review and seal, 5: Submit (Receipt)
  const [currentStep, setCurrentStep] = useState<number>(existingApp ? 5 : 1);

  // Price Schedule Line Items
  const [lineItems, setLineItems] = useState<PriceLineItem[]>(() => {
    if (existingApp?.bid?.pricingLineItems) {
      return JSON.parse(JSON.stringify(existingApp.bid.pricingLineItems));
    }
    if (call?.lineItems) {
      return JSON.parse(JSON.stringify(call.lineItems));
    }
    return [
      { id: 'li-1', itemNumber: 1, description: 'Treated Structural Timber (Pine 38x114mm x 6.0m SABS 1460)', unit: 'Length (6m)', quantity: 1200, unitPriceBWP: 175, totalPriceBWP: 210000 },
      { id: 'li-2', itemNumber: 2, description: 'Treated Structural Timber (Pine 50x228mm x 6.0m SABS 1460)', unit: 'Length (6m)', quantity: 650, unitPriceBWP: 390, totalPriceBWP: 253500 },
      { id: 'li-3', itemNumber: 3, description: 'Ordinary Portland Cement CEM II 42.5N (50kg Bags)', unit: 'Bag (50kg)', quantity: 4500, unitPriceBWP: 108, totalPriceBWP: 486000 },
      { id: 'li-4', itemNumber: 4, description: 'High Tensile Deformed Steel Rebar (Y12 x 12.0m)', unit: 'Bundle (10 bars)', quantity: 300, unitPriceBWP: 1390, totalPriceBWP: 417000 },
      { id: 'li-5', itemNumber: 5, description: 'IBR Galvanized Corrugated Roofing Sheets 0.5mm x 6.0m', unit: 'Sheet', quantity: 800, unitPriceBWP: 380, totalPriceBWP: 304000 },
      { id: 'li-6', itemNumber: 6, description: 'Transport, Offloading & Stacking to Designated GRC Depots', unit: 'Lump Sum', quantity: 1, unitPriceBWP: 90000, totalPriceBWP: 90000 },
    ];
  });

  // Step 2: Technical Response State
  const [technicalMethodology, setTechnicalMethodology] = useState<string>(() => {
    if (supplier.isDemoAccount) {
      return 'Kopano Building Supplies operates an established logistics and warehousing network in G-West Industrial, maintaining dedicated strategic buffer inventory under SABS 1460 timber standards. Delivery to all municipal depots will be serviced within 5 business days utilizing our dedicated Euro-5 fleet.';
    }
    return `${supplier.legalName || 'Our company'} operates an established operational footprint in Botswana. We maintain dedicated capacity and statutory compliance to fulfill this procurement contract in full accordance with all authority specifications.`;
  });
  const [deliveryLeadTimeDays, setDeliveryLeadTimeDays] = useState<number>(5);
  const [qualityAssurancePlan, setQualityAssurancePlan] = useState<string>(
    'All shipments undergo statutory quality verification and testing prior to dispatch. Material test certificates are delivered with each consignment.'
  );
  const [warrantyMonths, setWarrantyMonths] = useState<number>(24);

  // Step 3: Supporting Files
  const [supportingFiles, setSupportingFiles] = useState<SupportingFileItem[]>(() => {
    const compTag = (supplier.legalName || 'Company').replace(/[^a-zA-Z0-9]/g, '_');
    return [
      {
        id: 'file-tech',
        name: 'Technical proposal and methodology statement',
        type: 'PDF',
        size: '3.4 MB',
        fingerprint: 'SHA-256: 7f83b165...9069',
        mandatory: true,
        uploadedAt: 'Today',
        fileName: `${compTag}_Technical_Compliance_Schedule.pdf`,
      },
      {
        id: 'file-fin',
        name: 'Signed financial schedule and bill of quantities',
        type: 'PDF',
        size: '2.1 MB',
        fingerprint: 'SHA-256: e82d334c...182b',
        mandatory: true,
        uploadedAt: 'Today',
        fileName: `${compTag}_Signed_Financial_BOQ.pdf`,
      },
      {
        id: 'file-timber',
        name: 'Statutory compliance & standards certificate',
        type: 'PDF',
        size: '1.2 MB',
        fingerprint: 'SHA-256: b109ff82...99ee',
        mandatory: true,
        uploadedAt: 'Today',
        fileName: `${compTag}_Standards_Compliance_Cert.pdf`,
      },
      {
        id: 'file-fleet',
        name: 'Vehicle fleet schedule and logistics roadworthiness',
        type: 'PDF',
        size: '1.8 MB',
        fingerprint: 'SHA-256: c329a100...44aa',
        mandatory: false,
        uploadedAt: 'Today',
        fileName: `${compTag}_Fleet_Logistics_Capabilities.pdf`,
      },
    ];
  });

  // Step 4: Declarations
  const [declarationAgreed, setDeclarationAgreed] = useState<boolean>(true);
  const [nonCollusionAgreed, setNonCollusionAgreed] = useState<boolean>(true);

  // Receipt data after submission
  const [submittedReceipt, setSubmittedReceipt] = useState<{
    appId: string;
    receiptNumber: string;
    timestamp: string;
    sealedHash: string;
    fileFingerprints: { fileName: string; hash: string }[];
  } | null>(() => {
    if (existingApp) {
      return {
        appId: existingApp.id,
        receiptNumber: existingApp.receiptNumber || 'B360-GRC-2026-0929-8812',
        timestamp: existingApp.submittedAt || '2026-09-29 15:40 CAT',
        sealedHash: existingApp.bid?.sealedHash || 'SHA256:7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069',
        fileFingerprints: [
          { fileName: 'Kopano_Signed_Financial_BOQ.pdf', hash: 'SHA256:e82d334c891f7a02c5e4210998a0b12' },
          { fileName: 'Kopano_Technical_Compliance_Schedule_GRC.pdf', hash: 'SHA256:7f83b1657ff1fc53b92dc18148a1d65' },
          { fileName: 'FSC_Sawmill_Timber_Treatment_Cert.pdf', hash: 'SHA256:b109ff8203c9da5587ef00192841cca' },
        ],
      };
    }
    return null;
  });

  // Withdraw state
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Keyboard accessibility: close modal on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isWithdrawModalOpen) {
        setIsWithdrawModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isWithdrawModalOpen]);

  // Calculate totals
  const subtotalBWP = useMemo(() => {
    return lineItems.reduce((acc, item) => acc + (item.totalPriceBWP || 0), 0);
  }, [lineItems]);

  const vatAmountBWP = Math.round(subtotalBWP * 0.14);
  const grandTotalBWP = subtotalBWP + vatAmountBWP;

  // Unit price update
  const handleUnitPriceChange = (id: string, newUnitPrice: number) => {
    if (isCallClosed || (existingApp && currentStep === 5)) return;
    const cleanPrice = isNaN(newUnitPrice) ? 0 : Math.max(0, newUnitPrice);

    setLineItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const tot = cleanPrice * item.quantity;
          return {
            ...item,
            unitPriceBWP: cleanPrice,
            totalPriceBWP: tot,
          };
        }
        return item;
      })
    );
  };

  // Upload new supporting file
  const handleAddSupportingFile = () => {
    const fileId = `file-${Date.now()}`;
    const hash = `SHA-256: ${Math.random().toString(36).substring(2, 10)}...${Math.random().toString(36).substring(2, 6)}`;
    const newFile: SupportingFileItem = {
      id: fileId,
      name: 'Supplementary equipment schedule or manufacturer authorization',
      type: 'PDF',
      size: '1.5 MB',
      fingerprint: hash,
      mandatory: false,
      uploadedAt: '06 Oct 2026, 12:00',
      fileName: 'Manufacturer_Authorization_Letter_2026.pdf',
    };
    setSupportingFiles((prev) => [...prev, newFile]);
  };

  // Handle final sealing & submit
  const handleSubmitAndSeal = () => {
    if (!call || isCallClosed) return;
    if (!supplier.emailVerified) {
      alert('Email verification is mandatory before applying to calls or submitting bids. Please verify your email first.');
      return;
    }
    setIsSubmitting(true);

    const now = '2026-10-06 12:30 CAT';
    const generatedReceipt = `B360-SEAL-${call.callNumber.replace(/\//g, '-')}-${Date.now().toString().slice(-4)}`;
    const sealedHash = `SHA256:${Math.random().toString(36).substring(2, 12)}${Math.random().toString(36).substring(2, 12)}${Math.random().toString(36).substring(2, 12)}`;

    const fingerprints = supportingFiles.map((f) => ({
      fileName: f.fileName,
      hash: f.fingerprint,
    }));

    const newAppId = submitApplication({
      callId: call.id,
      callNumber: call.callNumber,
      callTitle: call.title,
      callType: 'RFP',
      organizationId: call.organizationId,
      organizationName: call.organizationName,
      supplierId: supplier.id,
      supplierName: supplier.legalName,
      receiptNumber: generatedReceipt,
      status: 'Submitted',
      sharedDocumentIds: ['doc-cipa-01', 'doc-tax-02', 'doc-ppra-03', 'doc-insur-05', 'doc-fin-06', 'doc-bank-07'],
      responses: [
        { fieldId: 'lead_time', label: 'Delivery lead time (calendar days)', value: deliveryLeadTimeDays },
        { fieldId: 'warranty', label: 'Warranty coverage (months)', value: warrantyMonths },
        { fieldId: 'methodology', label: 'Methodology statement', value: technicalMethodology },
      ],
      bid: {
        id: `bid-${Date.now()}`,
        applicationId: '',
        callId: call.id,
        supplierId: supplier.id,
        supplierName: supplier.legalName,
        currency: 'BWP',
        pricingLineItems: lineItems,
        totalAmountBWP: grandTotalBWP,
        technicalProposalFileName: supportingFiles[0]?.fileName || 'Technical_Proposal.pdf',
        financialProposalFileName: supportingFiles[1]?.fileName || 'Financial_Schedule.pdf',
        isSealed: true,
        sealedHash: sealedHash,
      },
      initialTimelineNote: `Sealed commercial bid (BWP ${grandTotalBWP.toLocaleString()}) and statutory schedules submitted. Receipt #${generatedReceipt}.`,
    });

    addAuditEvent({
      actorName: supplier.directors[0]?.fullName || 'Kagiso Molosiwa',
      actorRole: 'Supplier',
      organizationName: supplier.legalName,
      action: 'Sealed RFP Commercial Proposal Submitted',
      entityType: 'Bid',
      entityId: newAppId,
      details: `Submitted sealed tender offer of BWP ${grandTotalBWP.toLocaleString()} for ${call.callNumber}. Sealed hash: ${sealedHash}.`,
    });

    setTimeout(() => {
      setIsSubmitting(false);
      setSubmittedReceipt({
        appId: newAppId,
        receiptNumber: generatedReceipt,
        timestamp: now,
        sealedHash: sealedHash,
        fileFingerprints: fingerprints,
      });
      setCurrentStep(5);
    }, 600);
  };

  // Withdraw action
  const handleConfirmWithdraw = () => {
    if (!existingApp && !submittedReceipt) return;
    const targetId = existingApp?.id || submittedReceipt?.appId;
    if (targetId) {
      withdrawApplication(targetId, 'Withdrawn by supplier prior to tender closing deadline.');
    }
    setIsWithdrawModalOpen(false);
    onCancel();
  };

  // Replace bid action: reset to step 1 to revise prices before closing
  const handleReplaceBidBeforeClosing = () => {
    if (isCallClosed) return;
    setCurrentStep(1);
  };

  // Download receipt simulated
  const handleDownloadReceipt = () => {
    const content = `
=============================================================
BIDREADY360 CERTIFIED ELECTRONIC TENDER RECEIPT
=============================================================
Receipt Number: ${submittedReceipt?.receiptNumber || 'B360-GRC-2026-0929-8812'}
Submission Timestamp: ${submittedReceipt?.timestamp || '2026-09-29 15:40 CAT'}
Procuring Entity: ${call.organizationName}
Tender Reference: ${call.callNumber}
Tender Title: ${call.title}
Tender Closing Time: ${call.closingDate} at ${call.closingTimeCAT} (Central Africa Time / GMT+2)

Bidding Entity: ${supplier.legalName}
CIPA Registration: ${supplier.cipaNumber}
BURS Taxpayer TIN: ${supplier.tinNumber}

SEALED COMMERCIAL SPECIFICATION:
Total Evaluated Bid Value: BWP ${grandTotalBWP.toLocaleString()}
Cryptographic Sealing Checksum: ${submittedReceipt?.sealedHash || 'SHA256:7f83b1657ff1fc53b92dc18148a1d65dfc2d4b1fa3d677284addd200126d9069'}

ATTACHED FILE INTEGRITY FINGERPRINTS:
${submittedReceipt?.fileFingerprints.map((f) => `- ${f.fileName} [${f.hash}]`).join('\n')}

LEGAL NOTICE:
This sealed electronic receipt confirms that your commercial pricing and bill of quantities are securely stored in the BidReady360 vault. In compliance with the Public Procurement Act of Botswana, prices remain tamper-proof and inaccessible until the designated public opening session.
=============================================================
    `.trim();

    const element = document.createElement('a');
    const file = new Blob([content], { type: 'text/plain' });
    element.href = URL.createObjectURL(file);
    element.download = `Receipt_${call.callNumber.replace(/\//g, '_')}.txt`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  return (
    <div className="space-y-8">
      {/* 1. Header with Call Summary, Status & Countdown */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-6 border-b border-[#D5E0EA] dark:border-[#1E364A]">
        <div className="space-y-1.5 max-w-3xl">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={onCancel}
              className="inline-flex items-center gap-1 text-[14px] text-[#1F5F99] dark:text-[#6FAEE0] hover:underline cursor-pointer mr-2"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>
            <span className="font-semibold text-[14px] text-[#1F5F99] dark:text-[#6FAEE0]">
              {call.callNumber}
            </span>
            <span className="text-[14px] text-[#6B7A87]">· {call.organizationName}</span>
            <span className="bg-[#EAF2FA] text-[#1F5F99] dark:bg-[#1E364A] dark:text-[#6FAEE0] px-2.5 py-0.5 rounded-[4px] text-[14px] font-medium inline-flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              <span>Sealed RFP submission</span>
            </span>
            {isCallClosed && (
              <span className="bg-[#FEE2E2] text-[#DC2626] px-2 py-0.5 rounded-[4px] text-[14px] font-medium">
                Closed (Read-only)
              </span>
            )}
          </div>

          <h1 className="font-heading font-semibold text-[26px] sm:text-[30px] leading-tight text-[#10212E] dark:text-white">
            {call.title}
          </h1>

          <div className="text-[14px] text-[#6B7A87] flex items-center gap-3 flex-wrap">
            <span>Procuring entity: <strong className="text-[#10212E] dark:text-white font-medium">{call.organizationName}</strong></span>
            <span>·</span>
            <span className="inline-flex items-center gap-1 text-[#10212E] dark:text-white">
              <Calendar className="w-4 h-4 text-[#6B7A87]" />
              <span>Closing: {call.closingDate} at {call.closingTimeCAT} (Central Africa Time / CAT, GMT+2)</span>
            </span>
          </div>
        </div>

        {/* Closing Countdown & Timezone Card */}
        <div className="bg-white dark:bg-[#132635] p-4 rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] space-y-1 shrink-0 text-left sm:text-right">
          <span className="text-[14px] text-[#6B7A87] block">
            Time until tender closing
          </span>
          <div className="font-heading font-semibold text-[20px] text-[#10212E] dark:text-white flex items-center sm:justify-end gap-1.5 tabular-nums">
            <Clock className="w-4 h-4 text-[#1F5F99]" />
            <span>{isCallClosed ? 'Closed' : `${call.daysRemaining} days, 03:14:20`}</span>
          </div>
          <span className="text-[14px] text-[#6B7A87] block">
            Time zone: CAT (UTC+02:00)
          </span>
        </div>
      </div>

      {/* 2. Plain Language Sealed Notice Card */}
      <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 space-y-3">
        <div className="flex items-start gap-3.5">
          <div className="w-10 h-10 rounded-full bg-[#EAF2FA] dark:bg-[#1E364A] text-[#1F5F99] dark:text-[#6FAEE0] flex items-center justify-center shrink-0">
            <Lock className="w-5 h-5" />
          </div>
          <div className="space-y-1 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-heading font-semibold text-[18px] text-[#10212E] dark:text-white">
                Your bid is sealed. No one can read your prices until an authorised opening session is held after the closing time.
              </h2>
            </div>
            <p className="text-[14px] text-[#43525F] dark:text-[#B2C3D2] leading-relaxed">
              In accordance with statutory procurement guidelines, pricing line items remain tamper-proof until the tender closing countdown reaches zero. Tender evaluation officers cannot view bills of quantities during the open advertising period.
            </p>
          </div>
        </div>
      </div>

      {/* Safeguard: Email Verification Mandatory */}
      {!supplier.emailVerified && (
        <div className="p-4 rounded-[12px] bg-amber-50 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-700/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-[14px]">
          <div className="flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-0.5">
              <span className="font-semibold text-amber-900 dark:text-amber-200 block">
                Email verification mandatory to submit tender bids
              </span>
              <p className="text-amber-800 dark:text-amber-300 text-[13px]">
                Your supplier account is unverified. Submitting sealed proposals is locked until you verify your email address.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setActiveNav('supplier-verify-email')}
            className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-[6px] text-[13px] font-semibold shrink-0 cursor-pointer transition-colors"
          >
            Verify email now
          </button>
        </div>
      )}

      {/* Read-Only Notice if Call is Closed */}
      {isCallClosed && (
        <div className="p-4 rounded-[12px] bg-[#FFFBEB] dark:bg-[#92400E]/20 border border-[#FDE68A] dark:border-[#92400E]/40 flex items-center gap-3 text-[14px] text-[#92400E] dark:text-[#FCD34D]">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>This tender call has closed. The submission window has expired and your bid is now locked in read-only mode for official unsealing.</span>
        </div>
      )}

      {/* 3. Five Step Stepper Header */}
      <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-4 sm:p-5">
        {/* Mobile Compact Step Header */}
        <div className="sm:hidden flex items-center justify-between w-full">
          <div className="flex items-center gap-2">
            <span className="w-7 h-7 rounded-full bg-[#1F5F99] text-white flex items-center justify-center font-heading font-semibold text-[14px]">
              {currentStep}
            </span>
            <span className="font-heading font-semibold text-[15px] text-[#10212E] dark:text-white">
              Step {currentStep} of 5: {
                currentStep === 1
                  ? 'Price schedule'
                  : currentStep === 2
                  ? 'Technical response'
                  : currentStep === 3
                  ? 'Supporting files'
                  : currentStep === 4
                  ? 'Review and seal'
                  : 'Submit & receipt'
              }
            </span>
          </div>
          <span className="text-[14px] text-[#6B7A87]">Sealed bid</span>
        </div>

        {/* Desktop Step Buttons Grid */}
        <div className="hidden sm:grid grid-cols-5 gap-3">
          {[
            { step: 1, label: 'Price schedule' },
            { step: 2, label: 'Technical response' },
            { step: 3, label: 'Supporting files' },
            { step: 4, label: 'Review and seal' },
            { step: 5, label: 'Submit & receipt' },
          ].map((s) => {
            const isDone = currentStep > s.step;
            const isCurrent = currentStep === s.step;

            return (
              <button
                key={s.step}
                type="button"
                disabled={isCallClosed && currentStep === 5}
                onClick={() => {
                  if (currentStep !== 5 || !isCallClosed) {
                    setCurrentStep(s.step);
                  }
                }}
                className={`text-left p-3 rounded-[8px] border transition-all cursor-pointer ${
                  isCurrent
                    ? 'border-[#1F5F99] bg-[#EAF2FA]/50 dark:bg-[#1E364A]/50'
                    : isDone
                    ? 'border-[#D5E0EA] dark:border-[#1E364A] bg-[#F7FAFD]/70 dark:bg-[#10212E]/70'
                    : 'border-[#D5E0EA]/60 dark:border-[#1E364A]/60 opacity-60'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span
                    className={`w-5 h-5 rounded-full flex items-center justify-center text-[14px] font-semibold ${
                      isCurrent
                        ? 'bg-[#1F5F99] text-white'
                        : isDone
                        ? 'bg-[#2F8F5B] text-white'
                        : 'bg-[#D5E0EA] dark:bg-[#1E364A] text-[#6B7A87]'
                    }`}
                  >
                    {isDone ? <Check className="w-3 h-3" /> : s.step}
                  </span>
                  <span
                    className={`text-[14px] font-semibold ${
                      isCurrent
                        ? 'text-[#1F5F99] dark:text-[#6FAEE0]'
                        : isDone
                        ? 'text-[#10212E] dark:text-white'
                        : 'text-[#6B7A87]'
                    }`}
                  >
                    {s.label}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* ==================================================================== */}
      {/* STEP 1: PRICE SCHEDULE TABLE                                         */}
      {/* ==================================================================== */}
      {currentStep === 1 && (
        <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-[#D5E0EA] dark:border-[#1E364A]">
            <div className="space-y-0.5">
              <h2 className="font-heading font-semibold text-[18px] text-[#10212E] dark:text-white">
                Buyer price schedule and line items
              </h2>
              <p className="text-[14px] text-[#6B7A87]">
                Quantities are specified by the procuring entity (read-only). Enter unit prices in Botswana Pula (BWP).
              </p>
            </div>
            <span className="text-[14px] text-[#6B7A87] font-medium">
              Currency: BWP (Pula)
            </span>
          </div>

          {/* Desktop Line items table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#D5E0EA] dark:border-[#1E364A] bg-[#F7FAFD] dark:bg-[#10212E] text-[14px] text-[#6B7A87]">
                  <th className="py-3 px-4 font-semibold w-12">#</th>
                  <th className="py-3 px-4 font-semibold">Description</th>
                  <th className="py-3 px-4 font-semibold">Unit</th>
                  <th className="py-3 px-4 font-semibold text-right">Quantity (read-only)</th>
                  <th className="py-3 px-4 font-semibold text-right">Unit price (BWP)</th>
                  <th className="py-3 px-4 font-semibold text-right">Total (BWP)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D5E0EA] dark:divide-[#1E364A] text-[14px]">
                {lineItems.map((item) => (
                  <tr key={item.id} className="hover:bg-[#F7FAFD]/50 dark:hover:bg-[#10212E]/50">
                    <td className="py-4 px-4 font-medium text-[#6B7A87] tabular-nums">
                      {item.itemNumber}
                    </td>
                    <td className="py-4 px-4 font-medium text-[#10212E] dark:text-white max-w-sm">
                      {item.description}
                    </td>
                    <td className="py-4 px-4 text-[#6B7A87]">
                      {item.unit}
                    </td>
                    <td className="py-4 px-4 text-right font-medium text-[#10212E] dark:text-white tabular-nums">
                      {item.quantity.toLocaleString()}
                    </td>
                    <td className="py-4 px-4 text-right">
                      <div className="inline-flex items-center gap-1 justify-end">
                        <span className="text-[14px] text-[#6B7A87]">BWP</span>
                        <input
                          type="number"
                          disabled={isCallClosed}
                          min={0}
                          step={1}
                          value={item.unitPriceBWP || ''}
                          onChange={(e) => handleUnitPriceChange(item.id, parseFloat(e.target.value))}
                          className="w-28 p-2 text-right border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] bg-white dark:bg-[#132635] text-[14px] font-semibold text-[#10212E] dark:text-white tabular-nums focus:outline-none focus:border-[#1F5F99]"
                        />
                      </div>
                    </td>
                    <td className="py-4 px-4 text-right font-semibold text-[#10212E] dark:text-white tabular-nums">
                      BWP {(item.totalPriceBWP || 0).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Stacked Line Item Cards */}
          <div className="md:hidden divide-y divide-[#D5E0EA] dark:divide-[#1E364A]">
            {lineItems.map((item) => (
              <div key={item.id} className="py-4 space-y-3 text-[14px]">
                <div className="flex items-start justify-between gap-2">
                  <div className="space-y-0.5">
                    <span className="font-semibold text-[14px] text-[#1F5F99]">
                      Item #{item.itemNumber}
                    </span>
                    <h4 className="font-heading font-medium text-[15px] text-[#10212E] dark:text-white">
                      {item.description}
                    </h4>
                  </div>
                  <span className="text-[14px] bg-[#F7FAFD] dark:bg-[#10212E] px-2 py-0.5 rounded border border-[#D5E0EA] text-[#6B7A87]">
                    {item.unit}
                  </span>
                </div>

                <div className="flex items-center justify-between text-[#6B7A87]">
                  <span>Quantity (read-only):</span>
                  <span className="font-semibold text-[#10212E] dark:text-white tabular-nums">
                    {item.quantity.toLocaleString()} {item.unit}
                  </span>
                </div>

                <div className="flex items-center justify-between gap-2 pt-1">
                  <span className="font-medium text-[#10212E] dark:text-white">Unit price:</span>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[14px] text-[#6B7A87]">BWP</span>
                    <input
                      type="number"
                      disabled={isCallClosed}
                      min={0}
                      step={1}
                      value={item.unitPriceBWP || ''}
                      onChange={(e) => handleUnitPriceChange(item.id, parseFloat(e.target.value))}
                      className="w-28 p-2 text-right border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] bg-white dark:bg-[#132635] text-[14px] font-semibold text-[#10212E] dark:text-white tabular-nums focus:outline-none focus:border-[#1F5F99]"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-1 border-t border-[#D5E0EA]/40">
                  <span className="text-[#6B7A87]">Line total:</span>
                  <span className="font-semibold text-[15px] text-[#10212E] dark:text-white tabular-nums">
                    BWP {(item.totalPriceBWP || 0).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Pricing Totals Box */}
          <div className="pt-4 border-t border-[#D5E0EA] dark:border-[#1E364A] flex flex-col sm:flex-row justify-end">
            <div className="w-full sm:w-80 space-y-2.5 p-4 rounded-[10px] bg-[#F7FAFD] dark:bg-[#10212E] border border-[#D5E0EA] dark:border-[#1E364A]">
              <div className="flex items-center justify-between text-[14px] text-[#6B7A87]">
                <span>Net subtotal</span>
                <span className="font-semibold text-[#10212E] dark:text-white tabular-nums">
                  BWP {subtotalBWP.toLocaleString()}
                </span>
              </div>
              <div className="flex items-center justify-between text-[14px] text-[#6B7A87]">
                <span>VAT (14% statutory)</span>
                <span className="font-semibold text-[#10212E] dark:text-white tabular-nums">
                  BWP {vatAmountBWP.toLocaleString()}
                </span>
              </div>
              <div className="pt-2 border-t border-[#D5E0EA] dark:border-[#1E364A] flex items-center justify-between">
                <span className="font-semibold text-[15px] text-[#10212E] dark:text-white">
                  Grand total bid
                </span>
                <span className="font-heading font-semibold text-[20px] text-[#10212E] dark:text-white tabular-nums">
                  BWP {grandTotalBWP.toLocaleString()}
                </span>
              </div>
            </div>
          </div>

          {/* Step 1 Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-[#D5E0EA] dark:border-[#1E364A]">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2.5 border border-[#D5E0EA] dark:border-[#1E364A] text-[#43525F] dark:text-[#B2C3D2] rounded-[6px] text-[14px] font-medium hover:bg-[#F7FAFD] cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="px-6 py-2.5 bg-[#1F5F99] hover:bg-[#184c7a] text-white rounded-[6px] text-[14px] font-medium inline-flex items-center gap-2 cursor-pointer transition-colors"
            >
              <span>Continue to technical response</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* STEP 2: TECHNICAL RESPONSE                                           */}
      {/* ==================================================================== */}
      {currentStep === 2 && (
        <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 space-y-6">
          <div className="space-y-0.5 pb-4 border-b border-[#D5E0EA] dark:border-[#1E364A]">
            <h2 className="font-heading font-semibold text-[18px] text-[#10212E] dark:text-white">
              Technical response and methodology
            </h2>
            <p className="text-[14px] text-[#6B7A87]">
              Provide commitments regarding execution delivery timelines, quality control, and warranty coverage.
            </p>
          </div>

          <div className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-[14px] font-semibold text-[#10212E] dark:text-white block">
                Technical execution methodology
              </label>
              <textarea
                rows={4}
                disabled={isCallClosed}
                value={technicalMethodology}
                onChange={(e) => setTechnicalMethodology(e.target.value)}
                className="w-full p-3.5 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[8px] bg-white dark:bg-[#132635] text-[14px] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99]"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[14px] font-semibold text-[#10212E] dark:text-white block">
                  Delivery lead time to municipal depots (days)
                </label>
                <input
                  type="number"
                  disabled={isCallClosed}
                  value={deliveryLeadTimeDays}
                  onChange={(e) => setDeliveryLeadTimeDays(parseInt(e.target.value) || 0)}
                  className="w-full p-3 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[8px] bg-white dark:bg-[#132635] text-[14px] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[14px] font-semibold text-[#10212E] dark:text-white block">
                  Material defects warranty coverage (months)
                </label>
                <input
                  type="number"
                  disabled={isCallClosed}
                  value={warrantyMonths}
                  onChange={(e) => setWarrantyMonths(parseInt(e.target.value) || 0)}
                  className="w-full p-3 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[8px] bg-white dark:bg-[#132635] text-[14px] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99]"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[14px] font-semibold text-[#10212E] dark:text-white block">
                Quality assurance & timber compliance statement
              </label>
              <textarea
                rows={3}
                disabled={isCallClosed}
                value={qualityAssurancePlan}
                onChange={(e) => setQualityAssurancePlan(e.target.value)}
                className="w-full p-3.5 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[8px] bg-white dark:bg-[#132635] text-[14px] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99]"
              />
            </div>
          </div>

          {/* Step 2 Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-[#D5E0EA] dark:border-[#1E364A]">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="px-4 py-2.5 border border-[#D5E0EA] dark:border-[#1E364A] text-[#43525F] dark:text-[#B2C3D2] rounded-[6px] text-[14px] font-medium hover:bg-[#F7FAFD] cursor-pointer inline-flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to price schedule</span>
            </button>
            <button
              type="button"
              onClick={() => setCurrentStep(3)}
              className="px-6 py-2.5 bg-[#1F5F99] hover:bg-[#184c7a] text-white rounded-[6px] text-[14px] font-medium inline-flex items-center gap-2 cursor-pointer transition-colors"
            >
              <span>Continue to supporting files</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* STEP 3: SUPPORTING FILES                                             */}
      {/* ==================================================================== */}
      {currentStep === 3 && (
        <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-[#D5E0EA] dark:border-[#1E364A]">
            <div className="space-y-0.5">
              <h2 className="font-heading font-semibold text-[18px] text-[#10212E] dark:text-white">
                Supporting attachments and technical schedules
              </h2>
              <p className="text-[14px] text-[#6B7A87]">
                Attach certified technical literature, sawmill grading cards, and signed schedules.
              </p>
            </div>
            {!isCallClosed && (
              <button
                type="button"
                onClick={handleAddSupportingFile}
                className="px-4 py-2 border border-[#1F5F99] text-[#1F5F99] dark:text-[#6FAEE0] hover:bg-[#EAF2FA] rounded-[6px] text-[14px] font-medium inline-flex items-center gap-1.5 cursor-pointer shrink-0"
              >
                <Upload className="w-4 h-4" />
                <span>Upload additional file</span>
              </button>
            )}
          </div>

          <div className="space-y-3">
            {supportingFiles.map((file) => (
              <div
                key={file.id}
                className="p-4 rounded-[10px] border border-[#D5E0EA] dark:border-[#1E364A] bg-[#F7FAFD]/40 dark:bg-[#10212E]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-[14px]"
              >
                <div className="flex items-start gap-3">
                  <FileText className="w-5 h-5 text-[#1F5F99] shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-semibold text-[#10212E] dark:text-white">
                        {file.name}
                      </span>
                      {file.mandatory && (
                        <span className="text-[14px] px-2 py-0.5 rounded-[4px] bg-[#EAF2FA] text-[#1F5F99] font-medium">
                          Mandatory
                        </span>
                      )}
                    </div>
                    <div className="text-[14px] text-[#6B7A87] flex items-center gap-2 flex-wrap">
                      <span>{file.fileName}</span>
                      <span>·</span>
                      <span>{file.size}</span>
                      <span>·</span>
                      <span>Uploaded {file.uploadedAt}</span>
                    </div>
                    <div className="text-[14px] text-[#6B7A87]">
                      Integrity fingerprint: <span className="font-mono">{file.fingerprint}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span className="inline-flex items-center gap-1 text-[#2F8F5B] font-medium text-[14px]">
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Attached</span>
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Step 3 Actions */}
          <div className="flex items-center justify-between pt-4 border-t border-[#D5E0EA] dark:border-[#1E364A]">
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="px-4 py-2.5 border border-[#D5E0EA] dark:border-[#1E364A] text-[#43525F] dark:text-[#B2C3D2] rounded-[6px] text-[14px] font-medium hover:bg-[#F7FAFD] cursor-pointer inline-flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to technical response</span>
            </button>
            <button
              type="button"
              onClick={() => setCurrentStep(4)}
              className="px-6 py-2.5 bg-[#1F5F99] hover:bg-[#184c7a] text-white rounded-[6px] text-[14px] font-medium inline-flex items-center gap-2 cursor-pointer transition-colors"
            >
              <span>Continue to review and seal</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* STEP 4: REVIEW AND SEAL                                              */}
      {/* ==================================================================== */}
      {currentStep === 4 && (
        <div className="space-y-6">
          {/* Summary Box */}
          <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 space-y-6">
            <div className="space-y-0.5 pb-4 border-b border-[#D5E0EA] dark:border-[#1E364A]">
              <h2 className="font-heading font-semibold text-[18px] text-[#10212E] dark:text-white">
                Review and seal proposal
              </h2>
              <p className="text-[14px] text-[#6B7A87]">
                Review line pricing, technical parameters, and statutory checklists before generating your sealed submission.
              </p>
            </div>

            {/* Pricing Summary */}
            <div className="p-5 rounded-[10px] bg-[#F7FAFD] dark:bg-[#10212E] border border-[#D5E0EA] dark:border-[#1E364A] space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-[15px] text-[#10212E] dark:text-white">
                  Commercial bid offer summary
                </span>
                <span className="font-heading font-semibold text-[22px] text-[#10212E] dark:text-white tabular-nums">
                  BWP {grandTotalBWP.toLocaleString()}
                </span>
              </div>
              <p className="text-[14px] text-[#6B7A87]">
                Comprises {lineItems.length} line items across timber beams, trusses, cement, and steel bars including 14% statutory VAT.
              </p>
            </div>

            {/* Checklist of Mandatory Attachments */}
            <div className="space-y-3">
              <h3 className="font-heading font-semibold text-[16px] text-[#10212E] dark:text-white">
                Checklist of mandatory attachments
              </h3>
              <div className="space-y-2">
                {supportingFiles.map((file) => (
                  <div
                    key={file.id}
                    className="p-3 rounded-[6px] border border-[#D5E0EA] dark:border-[#1E364A] flex items-center justify-between gap-3 text-[14px]"
                  >
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 className="w-4 h-4 text-[#2F8F5B] shrink-0" />
                      <span className="font-medium text-[#10212E] dark:text-white">
                        {file.name}
                      </span>
                    </div>
                    <span className="font-mono text-[#6B7A87] text-[14px]">
                      {file.fingerprint}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Statutory Declarations Checkboxes */}
            <div className="space-y-3 pt-2 border-t border-[#D5E0EA] dark:border-[#1E364A]">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={declarationAgreed}
                  onChange={(e) => setDeclarationAgreed(e.target.checked)}
                  className="mt-1 w-4 h-4 text-[#1F5F99] rounded border-[#D5E0EA] focus:ring-[#1F5F99]"
                />
                <span className="text-[14px] text-[#10212E] dark:text-white leading-relaxed">
                  I confirm that all unit rates and pricing schedules quoted represent a binding, irrevocable tender offer open for acceptance for 90 days from the tender closing date.
                </span>
              </label>

              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={nonCollusionAgreed}
                  onChange={(e) => setNonCollusionAgreed(e.target.checked)}
                  className="mt-1 w-4 h-4 text-[#1F5F99] rounded border-[#D5E0EA] focus:ring-[#1F5F99]"
                />
                <span className="text-[14px] text-[#10212E] dark:text-white leading-relaxed">
                  Non-collusion and anti-corruption declaration: I certify under penalty of disqualification under the Public Procurement Act that this proposal has been compiled independently without collusion.
                </span>
              </label>
            </div>

            {/* Step 4 Actions */}
            <div className="flex items-center justify-between pt-4 border-t border-[#D5E0EA] dark:border-[#1E364A]">
              <button
                type="button"
                onClick={() => setCurrentStep(3)}
                className="px-4 py-2.5 border border-[#D5E0EA] dark:border-[#1E364A] text-[#43525F] dark:text-[#B2C3D2] rounded-[6px] text-[14px] font-medium hover:bg-[#F7FAFD] cursor-pointer inline-flex items-center gap-1.5"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Back to supporting files</span>
              </button>

              <button
                type="button"
                disabled={!declarationAgreed || !nonCollusionAgreed || isSubmitting || isCallClosed || !supplier.emailVerified}
                onClick={handleSubmitAndSeal}
                title={!supplier.emailVerified ? 'Email verification is mandatory before submitting bids' : undefined}
                className="px-6 py-2.5 bg-[#1F5F99] hover:bg-[#184c7a] disabled:opacity-50 text-white rounded-[6px] text-[14px] font-medium inline-flex items-center gap-2 cursor-pointer transition-colors"
              >
                <Lock className="w-4 h-4" />
                <span>{isSubmitting ? 'Sealing and submitting...' : 'Seal & submit tender bid'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==================================================================== */}
      {/* STEP 5: SUBMISSION RECEIPT & POST-SUBMISSION CONTROLS                 */}
      {/* ==================================================================== */}
      {currentStep === 5 && submittedReceipt && (
        <div className="space-y-6">
          {/* Certified Receipt Card */}
          <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#D5E0EA] dark:border-[#1E364A]">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#ECFDF5] text-[#2F8F5B] flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5" />
                </div>
                <div className="space-y-0.5">
                  <h2 className="font-heading font-semibold text-[20px] text-[#10212E] dark:text-white">
                    Tender bid sealed & registered
                  </h2>
                  <p className="text-[14px] text-[#2F8F5B] font-medium">
                    Official cryptographic receipt issued under the Public Procurement Act
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleDownloadReceipt}
                className="px-4 py-2.5 border border-[#1F5F99] text-[#1F5F99] dark:text-[#6FAEE0] hover:bg-[#EAF2FA] rounded-[6px] text-[14px] font-medium inline-flex items-center gap-2 cursor-pointer transition-colors shrink-0"
              >
                <Download className="w-4 h-4" />
                <span>Download receipt</span>
              </button>
            </div>

            {/* Key Receipt Parameters */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-[8px] bg-[#F7FAFD] dark:bg-[#10212E] border border-[#D5E0EA] dark:border-[#1E364A] space-y-1">
                <span className="text-[14px] text-[#6B7A87] block">Receipt number</span>
                <span className="font-heading font-semibold text-[17px] text-[#10212E] dark:text-white block">
                  {submittedReceipt.receiptNumber}
                </span>
              </div>

              <div className="p-4 rounded-[8px] bg-[#F7FAFD] dark:bg-[#10212E] border border-[#D5E0EA] dark:border-[#1E364A] space-y-1">
                <span className="text-[14px] text-[#6B7A87] block">Submission timestamp</span>
                <span className="font-semibold text-[15px] text-[#10212E] dark:text-white block tabular-nums">
                  {submittedReceipt.timestamp}
                </span>
              </div>

              <div className="p-4 rounded-[8px] bg-[#F7FAFD] dark:bg-[#10212E] border border-[#D5E0EA] dark:border-[#1E364A] space-y-1">
                <span className="text-[14px] text-[#6B7A87] block">Total evaluated offer</span>
                <span className="font-heading font-semibold text-[17px] text-[#10212E] dark:text-white block tabular-nums">
                  BWP {grandTotalBWP.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Cryptographic Hash */}
            <div className="p-4 rounded-[8px] bg-[#F7FAFD] dark:bg-[#10212E] border border-[#D5E0EA] dark:border-[#1E364A] space-y-1.5">
              <span className="text-[14px] font-semibold text-[#10212E] dark:text-white block">
                Sealed cryptographic fingerprint
              </span>
              <p className="font-mono text-[14px] text-[#43525F] dark:text-[#B2C3D2] break-all">
                {submittedReceipt.sealedHash}
              </p>
              <div className="flex items-center gap-2 pt-1 text-[14px] text-[#6B7A87]">
                <ShieldCheck className="w-4 h-4 text-[#2F8F5B]" />
                <span>Vault verification timestamp recorded in Gaborone regional registry</span>
              </div>
            </div>

            {/* Attached File Fingerprints */}
            <div className="space-y-3">
              <h3 className="font-heading font-semibold text-[16px] text-[#10212E] dark:text-white">
                Certified file fingerprints
              </h3>
              <div className="space-y-2">
                {submittedReceipt.fileFingerprints.map((item, idx) => (
                  <div
                    key={idx}
                    className="p-3 rounded-[6px] border border-[#D5E0EA] dark:border-[#1E364A] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[14px]"
                  >
                    <span className="font-medium text-[#10212E] dark:text-white">
                      {item.fileName}
                    </span>
                    <span className="font-mono text-[#6B7A87]">
                      {item.hash}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Post-submission Actions: Withdraw or Replace Before Closing */}
            <div className="pt-4 border-t border-[#D5E0EA] dark:border-[#1E364A] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-0.5">
                <span className="text-[14px] font-semibold text-[#10212E] dark:text-white block">
                  Modify or replace submission
                </span>
                <p className="text-[14px] text-[#6B7A87]">
                  {isCallClosed
                    ? 'The tender has reached its closing deadline. Bids are permanently locked.'
                    : `You may replace pricing line items or withdraw your proposal anytime before ${call.closingDate} at ${call.closingTimeCAT}.`}
                </p>
              </div>

              {!isCallClosed && (
                <div className="flex items-center gap-3 shrink-0">
                  <button
                    type="button"
                    onClick={() => setIsWithdrawModalOpen(true)}
                    className="px-4 py-2 border border-[#EF4444]/40 text-[#DC2626] hover:bg-[#FEF2F2] dark:hover:bg-[#451A1A] rounded-[6px] text-[14px] font-medium transition-colors cursor-pointer"
                  >
                    Withdraw bid
                  </button>
                  <button
                    type="button"
                    onClick={handleReplaceBidBeforeClosing}
                    className="px-4 py-2 bg-[#1F5F99] hover:bg-[#184c7a] text-white rounded-[6px] text-[14px] font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <RefreshCw className="w-4 h-4" />
                    <span>Replace before closing</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Withdraw Confirmation Modal */}
          {isWithdrawModalOpen && (
            <div className="fixed inset-0 z-50 bg-[#10212E]/60 flex items-center justify-center p-4">
              <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] max-w-lg w-full p-6 space-y-4">
                <div className="flex items-center gap-3 text-[#DC2626]">
                  <AlertTriangle className="w-6 h-6 shrink-0" />
                  <h3 className="font-heading font-semibold text-[18px] text-[#10212E] dark:text-white">
                    Confirm bid withdrawal
                  </h3>
                </div>

                <p className="text-[14px] text-[#43525F] dark:text-[#B2C3D2] leading-relaxed">
                  Are you sure you want to withdraw your bid for <strong>{call.callNumber}</strong>? Your sealed proposal and pricing schedule will be permanently cancelled. You may resubmit prior to the closing deadline.
                </p>

                <div className="flex items-center justify-end gap-3 pt-3">
                  <button
                    type="button"
                    onClick={() => setIsWithdrawModalOpen(false)}
                    className="px-4 py-2 border border-[#D5E0EA] dark:border-[#1E364A] text-[#43525F] dark:text-[#B2C3D2] rounded-[6px] text-[14px] font-medium hover:bg-[#F7FAFD] cursor-pointer"
                  >
                    Keep bid active
                  </button>
                  <button
                    type="button"
                    onClick={handleConfirmWithdraw}
                    className="px-4 py-2 bg-[#DC2626] hover:bg-[#b91c1c] text-white rounded-[6px] text-[14px] font-medium cursor-pointer"
                  >
                    Confirm withdrawal
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
