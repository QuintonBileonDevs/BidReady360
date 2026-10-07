import React, { useState, useEffect, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { Call, FormField, PriceLineItem, ApplicationResponse, SupplierDocument } from '../../types';
import { StatusChip } from '../common/StatusChip';
import {
  CheckCircle2,
  AlertTriangle,
  FileCheck,
  ShieldCheck,
  Building2,
  ArrowRight,
  ArrowLeft,
  Lock,
  Upload,
  Calendar,
  Clock,
  Check,
  FileText,
  X,
  Download,
  ExternalLink,
  Edit3,
  AlertCircle,
  Info,
  XCircle,
  HelpCircle,
} from 'lucide-react';

interface SupplierApplicationStepperProps {
  initialCallId?: string | null;
  onFinished: (appId: string) => void;
  onCancel: () => void;
}

interface EligibilityItem {
  id: string;
  title: string;
  description: string;
  isMandatory: boolean;
  status: 'Passed' | 'Missing' | 'Expired';
  actionLabel?: string;
  requiredDocType?: SupplierDocument['documentType'];
  note: string;
}

export const SupplierApplicationStepper: React.FC<SupplierApplicationStepperProps> = ({
  initialCallId,
  onFinished,
  onCancel,
}) => {
  const {
    calls,
    documents,
    supplier,
    formTemplates,
    submitApplication,
    withdrawApplication,
    uploadDocument,
    selectedCallId,
    addAuditEvent,
  } = useApp();

  const activeCallId = initialCallId || selectedCallId || calls[0]?.id;
  const [selectedCall, setSelectedCall] = useState<Call | undefined>(
    calls.find((c) => c.id === activeCallId) || calls[0]
  );

  // Stepper state: 1: Check eligibility, 2: Choose what to share, 3: Answer questions, 4: Review, 5: Submit
  const [currentStep, setCurrentStep] = useState<number>(1);

  // Requirements drawer
  const [isRequirementsDrawerOpen, setIsRequirementsDrawerOpen] = useState<boolean>(false);

  // Inline Quick-Upload modal for Step 1 direct action
  const [quickUploadDocType, setQuickUploadDocType] = useState<SupplierDocument['documentType'] | null>(null);
  const [quickUploadFileName, setQuickUploadFileName] = useState('');
  const [quickUploadDocNumber, setQuickUploadDocNumber] = useState('');

  // Step 2: Selected documents to package with submission
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>(
    documents.filter((d) => d.status === 'Verified').map((d) => d.id)
  );

  // Step 3: Custom Form Responses
  const formTemplate = useMemo(() => {
    if (!selectedCall?.formTemplateId) return null;
    return formTemplates.find((t) => t.id === selectedCall.formTemplateId);
  }, [selectedCall, formTemplates]);

  const [formAnswers, setFormAnswers] = useState<Record<string, any>>({
    f1: 5,
    f2: true,
    f3: 'Plot 22019 G-West Industrial Park, Gaborone',
    f4: false,
    f5: '',
    f6: 'BW_LOCAL',
    f7: 'We maintain 45-day reserve stock at our Gaborone industrial facility with primary and secondary logistics trucks.',
    'nta-f1': 24,
    'nta-f2': true,
    'nta-f3': 'Kagiso Molosiwa (Managing Director)',
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  // Commercial BOQ line items (if RFP)
  const [lineItemsState, setLineItemsState] = useState<PriceLineItem[]>(
    selectedCall?.lineItems ? JSON.parse(JSON.stringify(selectedCall.lineItems)) : []
  );

  // Step 4: Mandatory Declaration
  const [declarationAgreed, setDeclarationAgreed] = useState(false);

  // Step 5: Submitted state details
  const [submittedReceipt, setSubmittedReceipt] = useState<{
    appId: string;
    receiptNumber: string;
    submittedAt: string;
    sealedHash: string;
  } | null>(null);

  // Withdraw application dialog
  const [isWithdrawDialogOpen, setIsWithdrawDialogOpen] = useState(false);

  // Autosave indicator
  const [autosaveTime, setAutosaveTime] = useState<string>('Just now');

  useEffect(() => {
    if (selectedCall?.lineItems) {
      setLineItemsState(JSON.parse(JSON.stringify(selectedCall.lineItems)));
    }
  }, [selectedCall]);

  // Handle BOQ Unit Price Changes
  const handleUnitPriceChange = (itemId: string, unitPrice: number) => {
    setLineItemsState((prev) =>
      prev.map((item) => {
        if (item.id === itemId) {
          const qty = item.quantity;
          return {
            ...item,
            unitPriceBWP: unitPrice,
            totalPriceBWP: unitPrice * qty,
          };
        }
        return item;
      })
    );
    setAutosaveTime('Just now');
  };

  const subtotalBidBWP = useMemo(() => {
    return lineItemsState.reduce((sum, item) => sum + (item.totalPriceBWP || 0), 0);
  }, [lineItemsState]);

  const vatAmountBWP = Math.round(subtotalBidBWP * 0.14);
  const totalCalculatedBidBWP = subtotalBidBWP + vatAmountBWP;

  // Helper: check if a doc in vault is valid
  const getDocStatusInVault = (
    type: SupplierDocument['documentType']
  ): { doc?: SupplierDocument; status: 'Passed' | 'Missing' | 'Expired' } => {
    const matched = documents.find((d) => d.documentType === type);
    if (!matched) return { status: 'Missing' };

    const ref = new Date('2026-10-05').getTime();
    const exp = new Date(matched.expiryDate).getTime();
    if (exp < ref || matched.status === 'Expired') {
      return { doc: matched, status: 'Expired' };
    }
    return { doc: matched, status: 'Passed' };
  };

  // Step 1: Automatic Eligibility Checklist
  const eligibilityChecklist = useMemo<EligibilityItem[]>(() => {
    const list: EligibilityItem[] = [];

    // 1. Tax clearance
    const taxCheck = getDocStatusInVault('BURS Tax Clearance Certificate');
    list.push({
      id: 'tax',
      title: 'BURS tax clearance certificate',
      description: 'Mandatory proof of good tax standing with Botswana Unified Revenue Service.',
      isMandatory: true,
      status: taxCheck.status,
      actionLabel: taxCheck.status !== 'Passed' ? 'Upload tax clearance' : undefined,
      requiredDocType: 'BURS Tax Clearance Certificate',
      note:
        taxCheck.status === 'Passed'
          ? `Verified valid until ${taxCheck.doc?.expiryDate}`
          : taxCheck.status === 'Expired'
          ? 'Certificate expired on 30 Sep 2026'
          : 'Certificate not found in digital vault',
    });

    // 2. PPRA registration
    const ppraCheck = getDocStatusInVault('PPRA Registration Certificate');
    list.push({
      id: 'ppra',
      title: 'PPRA registration certificate',
      description: 'Contractor discipline registration with Public Procurement Regulatory Authority.',
      isMandatory: true,
      status: ppraCheck.status,
      actionLabel: ppraCheck.status !== 'Passed' ? 'Upload PPRA certificate' : undefined,
      requiredDocType: 'PPRA Registration Certificate',
      note:
        ppraCheck.status === 'Passed'
          ? `Registration verified through ${ppraCheck.doc?.expiryDate}`
          : 'Valid contractor certificate required',
    });

    // 3. CIPA registration
    const cipaCheck = getDocStatusInVault('CIPA Certificate of Incorporation');
    list.push({
      id: 'cipa',
      title: 'CIPA certificate of incorporation',
      description: 'Corporate registration verifying legal status under the Companies Act.',
      isMandatory: true,
      status: cipaCheck.status,
      actionLabel: cipaCheck.status !== 'Passed' ? 'Upload CIPA certificate' : undefined,
      requiredDocType: 'CIPA Certificate of Incorporation',
      note:
        cipaCheck.status === 'Passed'
          ? `Registered UIN: ${supplier.cipaNumber}`
          : 'Statutory certificate required',
    });

    // 4. Workers Compensation & Safety
    const safetyCheck = getDocStatusInVault('Workers Compensation & Safety Compliance');
    list.push({
      id: 'safety',
      title: 'Workers compensation & safety compliance',
      description: 'Proof of occupational injury insurance and safety compliance.',
      isMandatory: true,
      status: safetyCheck.status,
      actionLabel: safetyCheck.status !== 'Passed' ? 'Upload safety compliance' : undefined,
      requiredDocType: 'Workers Compensation & Safety Compliance',
      note:
        safetyCheck.status === 'Passed'
          ? `Valid policy verified through ${safetyCheck.doc?.expiryDate}`
          : 'Lapsed certificate requires replacement',
    });

    // 5. Public Liability Insurance
    const insurCheck = getDocStatusInVault('Public Liability Insurance Policy');
    list.push({
      id: 'insur',
      title: 'Public liability insurance policy',
      description: 'Minimum indemnity guarantee cover of BWP 10,000,000.',
      isMandatory: false,
      status: insurCheck.status,
      actionLabel: insurCheck.status !== 'Passed' ? 'Upload insurance policy' : undefined,
      requiredDocType: 'Public Liability Insurance Policy',
      note:
        insurCheck.status === 'Passed'
          ? 'Active insurance cover on file'
          : 'Optional prior to tender award',
    });

    // 6. Citizen Ownership Threshold
    const isCitizenPassed = supplier.citizenOwnedPercentage >= 51;
    list.push({
      id: 'citizen',
      title: 'Citizen economic empowerment (100% citizen ownership)',
      description: 'Preference qualification under the Citizen Economic Empowerment Policy.',
      isMandatory: false,
      status: isCitizenPassed ? 'Passed' : 'Missing',
      note: isCitizenPassed ? '100% citizen shareholding verified via CIPA' : 'Non-citizen majority entity',
    });

    // 7. Operating track record
    const hasTrackRecord = supplier.yearEstablished <= 2021;
    list.push({
      id: 'years',
      title: 'Track record in business (Minimum 5 years)',
      description: 'Operational longevity in commercial supplies and construction works.',
      isMandatory: true,
      status: hasTrackRecord ? 'Passed' : 'Missing',
      note: hasTrackRecord
        ? `Established in ${supplier.yearEstablished} (14 years of commercial operations)`
        : 'Less than 5 years since incorporation',
    });

    return list;
  }, [documents, supplier]);

  // Block submission only for mandatory items
  const mandatoryItemsPassed = useMemo(() => {
    return eligibilityChecklist
      .filter((item) => item.isMandatory)
      .every((item) => item.status === 'Passed');
  }, [eligibilityChecklist]);

  // Quick upload handler from Step 1 direct action
  const handleSaveQuickUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickUploadDocType) return;

    const fileName =
      quickUploadFileName || `${quickUploadDocType.replace(/\s+/g, '_')}_2026.pdf`;
    const docNumber = quickUploadDocNumber || `CERT-${Date.now().toString().slice(-6)}`;

    uploadDocument({
      supplierId: supplier.id,
      documentType: quickUploadDocType,
      documentNumber: docNumber,
      fileName,
      fileSize: '1.8 MB',
      issueDate: '2026-10-01',
      expiryDate: '2027-09-30',
      status: 'Verified',
      statusMessage: 'Uploaded during tender qualification.',
      downloadUrl: '#',
      versionHistory: [
        {
          version: 1,
          uploadedBy: 'Kagiso Molosiwa (Supplier admin)',
          uploadedAt: '6 Oct 2026, 14:00',
          fileFingerprint: 'SHA-256: 44aa99...11bc',
          fileName,
          fileSize: '1.8 MB',
          usedInApplications: [selectedCall?.callNumber || 'Tender Submission'],
        },
      ],
    });

    addAuditEvent({
      action: 'Document Uploaded in Tender Flow',
      actorName: 'Kagiso Molosiwa (Supplier admin)',
      actorRole: 'Supplier',
      organizationName: supplier.legalName,
      entityType: 'Document',
      entityId: `doc-${Date.now()}`,
      details: `Directly uploaded ${quickUploadDocType} during application qualification.`,
      ipAddress: '168.167.23.41',
    });

    setQuickUploadDocType(null);
    setQuickUploadFileName('');
    setQuickUploadDocNumber('');
    setAutosaveTime('Just now');
  };

  // Step 3: Validate Question Form
  const validateFormAnswers = (): boolean => {
    if (!formTemplate) return true;
    const errors: Record<string, string> = {};

    formTemplate.fields.forEach((field) => {
      // Check conditional visibility
      if (field.conditionalOnFieldId) {
        const parentVal = formAnswers[field.conditionalOnFieldId];
        if (field.conditionalValue !== undefined && parentVal !== field.conditionalValue) {
          return; // skipped because conditional parent is not satisfied
        }
      }

      if (field.required) {
        const val = formAnswers[field.id];
        if (val === undefined || val === null || val === '') {
          errors[field.id] = 'This field is required by the procuring entity.';
        }
      }
    });

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Submit Application Handler
  const handleFinalSubmit = () => {
    if (!selectedCall) return;

    const receiptNum = `REC-2026-${selectedCall.organizationName.substring(0, 3).toUpperCase()}-${Date.now().toString().slice(-4)}`;
    const nowTime = '6 October 2026, 14:35 CAT';
    const sealedHash = `SHA-256: 9a2f7c00e1b8${Date.now().toString(16)}fa88`;

    const responsesPayload: ApplicationResponse[] = Object.entries(formAnswers).map(
      ([fieldId, value]) => ({
        fieldId,
        label: fieldId,
        value,
      })
    );

    const newAppId = submitApplication({
      callId: selectedCall.id,
      callNumber: selectedCall.callNumber,
      callTitle: selectedCall.title,
      callType: selectedCall.type,
      organizationId: selectedCall.organizationId,
      organizationName: selectedCall.organizationName,
      supplierId: supplier.id,
      supplierName: supplier.legalName,
      status: 'Submitted',
      statusReason: 'Electronic sealed submission verified. Stored in digital vault.',
      sharedDocumentIds: selectedDocIds,
      responses: responsesPayload,
      bid:
        selectedCall.type === 'RFP'
          ? {
              id: `bid-${Date.now()}`,
              applicationId: '',
              callId: selectedCall.id,
              supplierId: supplier.id,
              supplierName: supplier.legalName,
              currency: 'BWP',
              pricingLineItems: lineItemsState,
              totalAmountBWP: totalCalculatedBidBWP,
              technicalProposalFileName: 'Technical_Proposal_Kopano.pdf',
              financialProposalFileName: 'Commercial_Schedule_Sealed.pdf',
              isSealed: true,
              sealedHash,
            }
          : undefined,
      initialTimelineNote: `Application submitted by ${supplier.legalName}. Receipt ${receiptNum} issued on ledger.`,
    });

    addAuditEvent({
      action: 'Tender Application & Sealed Bid Submitted',
      actorName: 'Kagiso Molosiwa (Supplier admin)',
      actorRole: 'Supplier',
      organizationName: selectedCall.organizationName,
      entityType: 'Application',
      entityId: newAppId,
      details: `Submitted sealed tender application for ${selectedCall.callNumber}: ${selectedCall.title}. Receipt: ${receiptNum}.`,
      ipAddress: '168.167.23.41',
    });

    setSubmittedReceipt({
      appId: newAppId,
      receiptNumber: receiptNum,
      submittedAt: nowTime,
      sealedHash,
    });

    setCurrentStep(5);
  };

  // Withdraw newly submitted application
  const handleExecuteWithdraw = () => {
    if (!submittedReceipt) return;

    withdrawApplication(
      submittedReceipt.appId,
      'Application withdrawn voluntarily by supplier before evaluation committee review.'
    );

    setIsWithdrawDialogOpen(false);
    onFinished(submittedReceipt.appId);
  };

  const stepLabels = [
    { number: 1, title: 'Check eligibility' },
    { number: 2, title: 'Choose what to share' },
    { number: 3, title: 'Answer questions' },
    { number: 4, title: 'Review' },
    { number: 5, title: 'Submit' },
  ];

  if (!selectedCall) {
    return (
      <div className="bg-white dark:bg-[#132635] p-12 text-center rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] space-y-4">
        <p className="text-[14px] text-[#6B7A87]">Please select a tender call to begin application.</p>
        <button
          onClick={onCancel}
          className="px-4 py-2 bg-[#1F5F99] text-white rounded-[6px] text-[14px]"
        >
          Return to dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* =========================================================================
          1. HEADER SUMMARISING THE CALL
          ========================================================================= */}
      <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2.5 flex-wrap">
              <span className="text-[14px] font-semibold text-[#1F5F99] bg-[#EAF2FA] dark:bg-[#1E364A] dark:text-[#6FAEE0] px-3 py-0.5 rounded-[4px]">
                {selectedCall.organizationName}
              </span>
              <span className="text-[14px] text-[#6B7A87]">· Tender ref: {selectedCall.callNumber}</span>
              <StatusChip status={selectedCall.type} />
            </div>

            <h1 className="font-heading font-semibold text-[24px] sm:text-[28px] text-[#10212E] dark:text-white leading-tight">
              {selectedCall.title}
            </h1>

            <div className="flex items-center gap-4 text-[14px] text-[#6B7A87] flex-wrap">
              <span className="inline-flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-[#1F5F99]" />
                <span>Closing on {selectedCall.closingDate}</span>
              </span>
              <span className="inline-flex items-center gap-1.5 font-medium text-[#10212E] dark:text-white tabular-nums">
                <Clock className="w-4 h-4 text-[#D97706]" />
                <span>{selectedCall.daysRemaining} days left</span>
              </span>
              <span>·</span>
              <span>Location: {selectedCall.location}</span>
            </div>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <button
              type="button"
              onClick={() => setIsRequirementsDrawerOpen(true)}
              className="px-3.5 py-2 border border-[#D5E0EA] dark:border-[#1E364A] bg-[#F7FAFD] dark:bg-[#10212E] hover:bg-white text-[14px] font-medium text-[#1F5F99] dark:text-[#6FAEE0] rounded-[6px] inline-flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <ExternalLink className="w-4 h-4" />
              <span>Link to requirements</span>
            </button>
          </div>
        </div>

        {/* Stepper Progress Bar & Autosave Status */}
        <div className="pt-4 border-t border-[#D5E0EA] dark:border-[#1E364A] flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Mobile Compact Step Header */}
          <div className="md:hidden flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <span className="w-7 h-7 rounded-full bg-[#1F5F99] text-white flex items-center justify-center font-heading font-semibold text-[14px]">
                {currentStep}
              </span>
              <span className="font-heading font-semibold text-[15px] text-[#10212E] dark:text-white">
                Step {currentStep} of 5: {stepLabels[currentStep - 1]?.title}
              </span>
            </div>
            <div className="flex items-center gap-1.5 text-[14px] text-[#6B7A87]">
              <CheckCircle2 className="w-3.5 h-3.5 text-[#2F8F5B]" />
              <span>Saved</span>
            </div>
          </div>

          {/* Desktop Stepper Bar */}
          <div className="hidden md:flex items-center gap-2 sm:gap-4 overflow-x-auto pb-1 md:pb-0">
            {stepLabels.map((st) => {
              const isCurrent = currentStep === st.number;
              const isCompleted = currentStep > st.number;

              return (
                <div key={st.number} className="flex items-center gap-2 shrink-0">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center font-heading font-semibold text-[14px] transition-colors ${
                      isCurrent
                        ? 'bg-[#1F5F99] text-white'
                        : isCompleted
                        ? 'bg-[#ECFDF5] text-[#2F8F5B] border border-[#2F8F5B]'
                        : 'bg-[#F7FAFD] dark:bg-[#10212E] text-[#6B7A87] border border-[#D5E0EA] dark:border-[#1E364A]'
                    }`}
                  >
                    {isCompleted ? <Check className="w-4 h-4" /> : st.number}
                  </div>
                  <span
                    className={`text-[14px] font-medium whitespace-nowrap ${
                      isCurrent
                        ? 'text-[#10212E] dark:text-white font-semibold'
                        : isCompleted
                        ? 'text-[#2F8F5B]'
                        : 'text-[#6B7A87]'
                    }`}
                  >
                    {st.title}
                  </span>
                  {st.number < 5 && <span className="text-[#D5E0EA] dark:text-[#1E364A] ml-2">/</span>}
                </div>
              );
            })}
          </div>

          <div className="hidden md:flex items-center gap-2 text-[14px] text-[#6B7A87] shrink-0">
            <CheckCircle2 className="w-4 h-4 text-[#2F8F5B]" />
            <span>Saved just now</span>
          </div>
        </div>
      </div>

      {/* =========================================================================
          STEP 1: CHECK ELIGIBILITY
          ========================================================================= */}
      {currentStep === 1 && (
        <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 sm:p-8 space-y-6">
          <div className="space-y-1 pb-4 border-b border-[#D5E0EA] dark:border-[#1E364A]">
            <h2 className="font-heading font-semibold text-[22px] text-[#10212E] dark:text-white">
              Step 1: Check eligibility
            </h2>
            <p className="text-[14px] text-[#43525F] dark:text-[#B2C3D2]">
              Automatic verification of your corporate standing and vault compliance certificates against tender requirements.
            </p>
          </div>

          {/* Checklist of Requirements */}
          <div className="space-y-3">
            {eligibilityChecklist.map((item) => (
              <div
                key={item.id}
                className="p-5 rounded-[8px] border border-[#D5E0EA] dark:border-[#1E364A] bg-[#F7FAFD]/50 dark:bg-[#10212E]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4 text-[14px]"
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="font-semibold text-[16px] text-[#10212E] dark:text-white">
                      {item.title}
                    </span>
                    <span
                      className={`text-[14px] px-2 py-0.5 rounded font-medium ${
                        item.isMandatory
                          ? 'bg-[#FEF2F2] text-[#8E2A1B]'
                          : 'bg-[#F7FAFD] text-[#6B7A87]'
                      }`}
                    >
                      {item.isMandatory ? 'Mandatory' : 'Optional'}
                    </span>
                    <StatusChip status={item.status} />
                  </div>
                  <p className="text-[#43525F] dark:text-[#B2C3D2]">{item.description}</p>
                  <span className="text-[#6B7A87] block">{item.note}</span>
                </div>

                {/* Direct Action if Missing or Expired */}
                {item.actionLabel && (
                  <div className="shrink-0 self-start sm:self-center">
                    <button
                      type="button"
                      onClick={() => setQuickUploadDocType(item.requiredDocType || null)}
                      className="px-4 py-2 bg-[#1F5F99] hover:bg-[#184c7a] text-white rounded-[6px] font-medium text-[14px] inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <Upload className="w-4 h-4" />
                      <span>{item.actionLabel}</span>
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Mandatory blocking note */}
          {!mandatoryItemsPassed && (
            <div className="p-4 rounded-[8px] bg-[#FEF2F2] dark:bg-[#7F1D1D]/20 border border-[#FCA5A5] dark:border-[#7F1D1D]/40 flex items-start gap-3 text-[14px]">
              <AlertTriangle className="w-5 h-5 text-[#C2412D] shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <strong className="text-[#8E2A1B] dark:text-red-300 font-semibold block">
                  Mandatory requirements not yet satisfied
                </strong>
                <p className="text-[#8E2A1B] dark:text-red-200">
                  Please resolve all mandatory compliance items marked Missing or Expired before continuing. Non-mandatory items will not block submission.
                </p>
              </div>
            </div>
          )}

          {/* Footer Navigation */}
          <div className="pt-4 border-t border-[#D5E0EA] dark:border-[#1E364A] flex items-center justify-between">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] font-medium text-[#43525F] dark:text-[#B2C3D2] hover:bg-[#F7FAFD] cursor-pointer"
            >
              Cancel application
            </button>

            <button
              type="button"
              disabled={!mandatoryItemsPassed}
              onClick={() => setCurrentStep(2)}
              className={`px-5 py-2.5 rounded-[6px] text-[14px] font-medium inline-flex items-center gap-2 transition-colors ${
                mandatoryItemsPassed
                  ? 'bg-[#1F5F99] hover:bg-[#184c7a] text-white cursor-pointer'
                  : 'bg-[#D5E0EA] dark:bg-[#1E364A] text-[#6B7A87] cursor-not-allowed'
              }`}
            >
              <span>Choose what to share</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          STEP 2: CHOOSE WHAT TO SHARE
          ========================================================================= */}
      {currentStep === 2 && (
        <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 sm:p-8 space-y-6">
          <div className="space-y-1 pb-4 border-b border-[#D5E0EA] dark:border-[#1E364A]">
            <h2 className="font-heading font-semibold text-[22px] text-[#10212E] dark:text-white">
              Step 2: Choose what to share
            </h2>
            <p className="text-[14px] text-[#43525F] dark:text-[#B2C3D2]">
              Select which verified certificates from your digital vault to package with this tender submission.
            </p>
          </div>

          {/* Version freezing note */}
          <div className="p-4 rounded-[8px] bg-[#EAF2FA] dark:bg-[#1E364A]/50 border border-[#D5E0EA] dark:border-[#1E364A] flex items-start gap-3 text-[14px]">
            <Info className="w-5 h-5 text-[#1F5F99] dark:text-[#6FAEE0] shrink-0 mt-0.5" />
            <div className="space-y-1">
              <strong className="text-[#10212E] dark:text-white font-semibold block">
                Version snapshot note
              </strong>
              <p className="text-[#43525F] dark:text-[#B2C3D2] leading-relaxed">
                A specific version of each selected document is packaged with this submission. Later edits or renewals in your vault will not alter the certified copy sent to the evaluation committee.
              </p>
            </div>
          </div>

          {/* Document list with version and verification chip */}
          <div className="space-y-3">
            {documents.map((doc) => {
              const isChecked = selectedDocIds.includes(doc.id);
              const currentVersionNumber = doc.versionHistory ? doc.versionHistory.length : 1;

              return (
                <label
                  key={doc.id}
                  className={`p-4 rounded-[8px] border flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[14px] cursor-pointer transition-colors ${
                    isChecked
                      ? 'border-[#1F5F99] bg-[#EAF2FA]/20 dark:bg-[#1E364A]/30'
                      : 'border-[#D5E0EA] dark:border-[#1E364A] bg-[#F7FAFD]/30 hover:border-[#1F5F99]/60'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedDocIds([...selectedDocIds, doc.id]);
                        } else {
                          setSelectedDocIds(selectedDocIds.filter((id) => id !== doc.id));
                        }
                      }}
                      className="mt-1 rounded border-[#D5E0EA] text-[#1F5F99] focus:ring-[#1F5F99]"
                    />

                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-[#10212E] dark:text-white">
                          {doc.documentType}
                        </span>
                        <span className="bg-[#EAF2FA] dark:bg-[#1E364A] text-[#1F5F99] dark:text-[#6FAEE0] px-2 py-0.5 rounded text-[14px] font-medium">
                          Version {currentVersionNumber}
                        </span>
                        <StatusChip status={doc.status} />
                      </div>
                      <span className="text-[#6B7A87] block">
                        File: {doc.fileName} · Cert #{doc.documentNumber} · Expires {doc.expiryDate}
                      </span>
                    </div>
                  </div>

                  <span className="text-[#6B7A87] text-[14px] self-start sm:self-center">
                    {isChecked ? 'Included in submission bundle' : 'Not attached'}
                  </span>
                </label>
              );
            })}
          </div>

          {/* Footer Navigation */}
          <div className="pt-4 border-t border-[#D5E0EA] dark:border-[#1E364A] flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCurrentStep(1)}
              className="px-4 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] font-medium text-[#43525F] dark:text-[#B2C3D2] hover:bg-[#F7FAFD] inline-flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to eligibility</span>
            </button>

            <button
              type="button"
              onClick={() => setCurrentStep(3)}
              className="px-5 py-2.5 bg-[#1F5F99] hover:bg-[#184c7a] text-white rounded-[6px] text-[14px] font-medium inline-flex items-center gap-2 cursor-pointer transition-colors"
            >
              <span>Answer questions</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          STEP 3: ANSWER QUESTIONS (CUSTOM FORM & BOQ)
          ========================================================================= */}
      {currentStep === 3 && (
        <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 sm:p-8 space-y-6">
          <div className="space-y-1 pb-4 border-b border-[#D5E0EA] dark:border-[#1E364A]">
            <h2 className="font-heading font-semibold text-[22px] text-[#10212E] dark:text-white">
              Step 3: Answer questions
            </h2>
            <p className="text-[14px] text-[#43525F] dark:text-[#B2C3D2]">
              Complete {selectedCall.organizationName}'s statutory procurement questionnaire and commercial schedule.
            </p>
          </div>

          {/* Custom Form Template Fields */}
          {formTemplate && (
            <div className="space-y-5">
              {formTemplate.fields.map((field) => {
                // Conditional fields evaluation
                if (field.conditionalOnFieldId) {
                  const parentVal = formAnswers[field.conditionalOnFieldId];
                  if (field.conditionalValue !== undefined && parentVal !== field.conditionalValue) {
                    return null; // hide conditional field
                  }
                }

                const err = formErrors[field.id];

                return (
                  <div key={field.id} className="space-y-1.5 text-[14px]">
                    <label className="font-semibold text-[#10212E] dark:text-white block">
                      {field.label} {field.required && <span className="text-[#C2412D]">*</span>}
                    </label>

                    {field.helpText && (
                      <span className="text-[#6B7A87] text-[14px] block mb-1">
                        {field.helpText}
                      </span>
                    )}

                    {/* Field input variants */}
                    {field.type === 'text' && (
                      <input
                        type="text"
                        value={formAnswers[field.id] || ''}
                        onChange={(e) => {
                          setFormAnswers({ ...formAnswers, [field.id]: e.target.value });
                          if (formErrors[field.id]) {
                            const newErrors = { ...formErrors };
                            delete newErrors[field.id];
                            setFormErrors(newErrors);
                          }
                          setAutosaveTime('Just now');
                        }}
                        placeholder={field.placeholder || 'Enter text response...'}
                        className="w-full px-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] bg-white dark:bg-[#132635] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99]"
                      />
                    )}

                    {field.type === 'number' && (
                      <input
                        type="number"
                        value={formAnswers[field.id] ?? ''}
                        onChange={(e) => {
                          setFormAnswers({ ...formAnswers, [field.id]: Number(e.target.value) });
                          setAutosaveTime('Just now');
                        }}
                        className="w-full px-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] bg-white dark:bg-[#132635] text-[#10212E] dark:text-white tabular-nums focus:outline-none focus:border-[#1F5F99]"
                      />
                    )}

                    {field.type === 'dropdown' && (
                      <select
                        value={formAnswers[field.id] || ''}
                        onChange={(e) => {
                          setFormAnswers({ ...formAnswers, [field.id]: e.target.value });
                          setAutosaveTime('Just now');
                        }}
                        className="w-full px-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] bg-white dark:bg-[#132635] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99]"
                      >
                        <option value="">Select option...</option>
                        {field.options?.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    )}

                    {field.type === 'yes_no' && (
                      <div className="flex items-center gap-4 pt-1">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name={field.id}
                            checked={formAnswers[field.id] === true}
                            onChange={() => {
                              setFormAnswers({ ...formAnswers, [field.id]: true });
                              setAutosaveTime('Just now');
                            }}
                            className="text-[#1F5F99] focus:ring-[#1F5F99]"
                          />
                          <span className="font-medium text-[#10212E] dark:text-white">Yes</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="radio"
                            name={field.id}
                            checked={formAnswers[field.id] === false}
                            onChange={() => {
                              setFormAnswers({ ...formAnswers, [field.id]: false });
                              setAutosaveTime('Just now');
                            }}
                            className="text-[#1F5F99] focus:ring-[#1F5F99]"
                          />
                          <span className="font-medium text-[#10212E] dark:text-white">No</span>
                        </label>
                      </div>
                    )}

                    {field.type === 'textarea' && (
                      <textarea
                        rows={3}
                        value={formAnswers[field.id] || ''}
                        onChange={(e) => {
                          setFormAnswers({ ...formAnswers, [field.id]: e.target.value });
                          setAutosaveTime('Just now');
                        }}
                        className="w-full p-3 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] bg-white dark:bg-[#132635] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99]"
                      />
                    )}

                    {field.type === 'file_upload' && (
                      <div className="p-3 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] bg-[#F7FAFD]/40 dark:bg-[#10212E]/40 flex items-center justify-between">
                        <span className="text-[#6B7A87]">
                          {formAnswers[field.id] || 'Attached via digital vault bundle'}
                        </span>
                        <span className="text-[#1F5F99] font-medium">Included</span>
                      </div>
                    )}

                    {err && (
                      <span className="text-[#C2412D] text-[14px] block font-medium">
                        {err}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Pricing Schedule BOQ (if RFP) */}
          {selectedCall.type === 'RFP' && lineItemsState.length > 0 && (
            <div className="pt-6 border-t border-[#D5E0EA] dark:border-[#1E364A] space-y-4">
              <div>
                <h3 className="font-heading font-semibold text-[18px] text-[#10212E] dark:text-white">
                  Commercial pricing schedule (Bill of Quantities)
                </h3>
                <span className="text-[14px] text-[#6B7A87]">
                  Enter unit rates in BWP. Figures are sealed until public tender opening.
                </span>
              </div>

              <div className="overflow-x-auto border border-[#D5E0EA] dark:border-[#1E364A] rounded-[8px]">
                <table className="w-full text-left text-[14px] divide-y divide-[#D5E0EA] dark:divide-[#1E364A]">
                  <thead className="bg-[#F7FAFD] dark:bg-[#10212E] text-[#6B7A87] font-medium">
                    <tr>
                      <th className="p-3.5">#</th>
                      <th className="p-3.5">Description</th>
                      <th className="p-3.5 text-right">Quantity</th>
                      <th className="p-3.5 text-right">Unit rate (BWP)</th>
                      <th className="p-3.5 text-right">Total (BWP)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D5E0EA] dark:divide-[#1E364A] text-[#10212E] dark:text-white">
                    {lineItemsState.map((item) => (
                      <tr key={item.id} className="hover:bg-[#F7FAFD] dark:hover:bg-[#10212E]">
                        <td className="p-3.5 text-[#6B7A87] tabular-nums">{item.itemNumber}</td>
                        <td className="p-3.5 font-medium">{item.description}</td>
                        <td className="p-3.5 text-right tabular-nums">
                          {item.quantity} {item.unit}
                        </td>
                        <td className="p-3.5 text-right">
                          <input
                            type="number"
                            min="0"
                            value={item.unitPriceBWP || ''}
                            onChange={(e) =>
                              handleUnitPriceChange(item.id, Number(e.target.value))
                            }
                            placeholder="0.00"
                            className="w-32 px-2.5 py-1 text-right border border-[#D5E0EA] dark:border-[#1E364A] rounded-[4px] bg-white dark:bg-[#132635] text-[#10212E] dark:text-white font-medium tabular-nums focus:outline-none focus:border-[#1F5F99]"
                          />
                        </td>
                        <td className="p-3.5 text-right font-heading font-semibold text-[#10212E] dark:text-white tabular-nums">
                          BWP {(item.totalPriceBWP || 0).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-[#F7FAFD] dark:bg-[#10212E] border-t-2 border-[#D5E0EA] dark:border-[#1E364A] text-[#10212E] dark:text-white text-[14px]">
                    <tr>
                      <td colSpan={4} className="p-3 text-right font-medium text-[#6B7A87]">
                        Subtotal offer:
                      </td>
                      <td className="p-3 text-right font-heading font-semibold tabular-nums">
                        BWP {subtotalBidBWP.toLocaleString()}
                      </td>
                    </tr>
                    <tr>
                      <td colSpan={4} className="p-3 text-right font-medium text-[#6B7A87]">
                        14% statutory VAT:
                      </td>
                      <td className="p-3 text-right font-heading font-semibold tabular-nums">
                        BWP {vatAmountBWP.toLocaleString()}
                      </td>
                    </tr>
                    <tr className="border-t border-[#D5E0EA] dark:border-[#1E364A]">
                      <td colSpan={4} className="p-4 text-right font-semibold text-[#10212E] dark:text-white">
                        Grand total proposal:
                      </td>
                      <td className="p-4 text-right font-heading font-semibold text-[18px] text-[#10212E] dark:text-white tabular-nums">
                        BWP {totalCalculatedBidBWP.toLocaleString()}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          )}

          {/* Footer Navigation */}
          <div className="pt-4 border-t border-[#D5E0EA] dark:border-[#1E364A] flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCurrentStep(2)}
              className="px-4 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] font-medium text-[#43525F] dark:text-[#B2C3D2] hover:bg-[#F7FAFD] inline-flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to shared documents</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (validateFormAnswers()) {
                  setCurrentStep(4);
                }
              }}
              className="px-5 py-2.5 bg-[#1F5F99] hover:bg-[#184c7a] text-white rounded-[6px] text-[14px] font-medium inline-flex items-center gap-2 cursor-pointer transition-colors"
            >
              <span>Review proposal</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          STEP 4: REVIEW (SINGLE-PAGE SUMMARY WITH EDIT LINKS)
          ========================================================================= */}
      {currentStep === 4 && (
        <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 sm:p-8 space-y-6">
          <div className="space-y-1 pb-4 border-b border-[#D5E0EA] dark:border-[#1E364A]">
            <h2 className="font-heading font-semibold text-[22px] text-[#10212E] dark:text-white">
              Step 4: Review proposal
            </h2>
            <p className="text-[14px] text-[#43525F] dark:text-[#B2C3D2]">
              Carefully inspect your submission summary before providing your statutory declaration and final submission.
            </p>
          </div>

          <div className="space-y-6 text-[14px]">
            {/* Part 1: Eligibility Summary with Edit Link */}
            <div className="p-5 rounded-[10px] border border-[#D5E0EA] dark:border-[#1E364A] bg-[#F7FAFD]/40 dark:bg-[#10212E]/40 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-[#2F8F5B]" />
                  <h3 className="font-heading font-semibold text-[17px] text-[#10212E] dark:text-white">
                    Eligibility & compliance checklist
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setCurrentStep(1)}
                  className="text-[#1F5F99] dark:text-[#6FAEE0] hover:underline font-medium inline-flex items-center gap-1 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-2">
                {eligibilityChecklist.map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-2 rounded bg-white dark:bg-[#132635] border border-[#D5E0EA] dark:border-[#1E364A]">
                    <span className="font-medium text-[#10212E] dark:text-white">{item.title}</span>
                    <StatusChip status={item.status} />
                  </div>
                ))}
              </div>
            </div>

            {/* Part 2: Shared Documents Summary with Edit Link */}
            <div className="p-5 rounded-[10px] border border-[#D5E0EA] dark:border-[#1E364A] bg-[#F7FAFD]/40 dark:bg-[#10212E]/40 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileCheck className="w-5 h-5 text-[#1F5F99]" />
                  <h3 className="font-heading font-semibold text-[17px] text-[#10212E] dark:text-white">
                    Packaged vault documents ({selectedDocIds.length})
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setCurrentStep(2)}
                  className="text-[#1F5F99] dark:text-[#6FAEE0] hover:underline font-medium inline-flex items-center gap-1 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>
              </div>

              <div className="space-y-1.5 pt-1">
                {selectedDocIds.map((docId) => {
                  const doc = documents.find((d) => d.id === docId);
                  if (!doc) return null;
                  return (
                    <div
                      key={doc.id}
                      className="p-2.5 rounded bg-white dark:bg-[#132635] border border-[#D5E0EA] dark:border-[#1E364A] flex items-center justify-between text-[14px]"
                    >
                      <span className="font-medium text-[#10212E] dark:text-white">
                        {doc.documentType} ({doc.fileName})
                      </span>
                      <div className="flex items-center gap-2">
                        <span className="bg-[#EAF2FA] text-[#1F5F99] dark:bg-[#1E364A] dark:text-[#6FAEE0] px-2 py-0.5 rounded text-[14px] font-medium">
                          Version {doc.versionHistory ? doc.versionHistory.length : 1}
                        </span>
                        <StatusChip status={doc.status} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Part 3: Answered Questions with Edit Link */}
            <div className="p-5 rounded-[10px] border border-[#D5E0EA] dark:border-[#1E364A] bg-[#F7FAFD]/40 dark:bg-[#10212E]/40 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <HelpCircle className="w-5 h-5 text-[#1F5F99]" />
                  <h3 className="font-heading font-semibold text-[17px] text-[#10212E] dark:text-white">
                    Questionnaire & proposal responses
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setCurrentStep(3)}
                  className="text-[#1F5F99] dark:text-[#6FAEE0] hover:underline font-medium inline-flex items-center gap-1 cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Edit</span>
                </button>
              </div>

              <div className="space-y-2 pt-1">
                {formTemplate?.fields.map((field) => (
                  <div
                    key={field.id}
                    className="p-3 rounded bg-white dark:bg-[#132635] border border-[#D5E0EA] dark:border-[#1E364A] space-y-1"
                  >
                    <span className="text-[#6B7A87] block">{field.label}:</span>
                    <strong className="text-[#10212E] dark:text-white font-medium block">
                      {String(formAnswers[field.id] || '—')}
                    </strong>
                  </div>
                ))}
              </div>
            </div>

            {/* Part 4: Commercial Pricing (if RFP) */}
            {selectedCall.type === 'RFP' && lineItemsState.length > 0 && (
              <div className="p-5 rounded-[10px] border border-[#D5E0EA] dark:border-[#1E364A] bg-[#F7FAFD]/40 dark:bg-[#10212E]/40 flex items-center justify-between">
                <div>
                  <h3 className="font-heading font-semibold text-[17px] text-[#10212E] dark:text-white">
                    Commercial offer (Sealed)
                  </h3>
                  <span className="text-[#6B7A87]">
                    Includes {lineItemsState.length} BOQ items + 14% statutory VAT
                  </span>
                </div>
                <div className="text-right">
                  <span className="font-heading font-semibold text-[22px] text-[#10212E] dark:text-white tabular-nums block">
                    BWP {totalCalculatedBidBWP.toLocaleString()}
                  </span>
                  <span className="text-[#2F8F5B] font-medium block">Cryptographically locked</span>
                </div>
              </div>
            )}

            {/* Mandatory Declaration Checkbox */}
            <div className="p-5 rounded-[10px] bg-[#FFFBEB] dark:bg-[#78350F]/20 border border-[#FDE68A] dark:border-[#78350F]/40 space-y-2">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  required
                  checked={declarationAgreed}
                  onChange={(e) => setDeclarationAgreed(e.target.checked)}
                  className="mt-1 rounded border-[#D5E0EA] text-[#1F5F99] focus:ring-[#1F5F99]"
                />
                <div className="space-y-1">
                  <strong className="text-[#92400E] dark:text-amber-300 font-semibold block">
                    Statutory bidder declaration *
                  </strong>
                  <p className="text-[#92400E] dark:text-amber-200 leading-relaxed text-[14px]">
                    I declare that the statements, documents, and technical representations submitted in this bid are genuine, complete, and legally binding. I understand that fraudulent misrepresentation carries statutory disqualification and penalties under the Public Procurement Act.
                  </p>
                </div>
              </label>
            </div>
          </div>

          {/* Footer Navigation */}
          <div className="pt-4 border-t border-[#D5E0EA] dark:border-[#1E364A] flex items-center justify-between">
            <button
              type="button"
              onClick={() => setCurrentStep(3)}
              className="px-4 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] font-medium text-[#43525F] dark:text-[#B2C3D2] hover:bg-[#F7FAFD] inline-flex items-center gap-1.5 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to questions</span>
            </button>

            <button
              type="button"
              disabled={!declarationAgreed}
              onClick={handleFinalSubmit}
              className={`px-6 py-2.5 rounded-[6px] text-[14px] font-medium inline-flex items-center gap-2 transition-colors ${
                declarationAgreed
                  ? 'bg-[#1F5F99] hover:bg-[#184c7a] text-white cursor-pointer shadow-sm'
                  : 'bg-[#D5E0EA] dark:bg-[#1E364A] text-[#6B7A87] cursor-not-allowed'
              }`}
            >
              <Lock className="w-4 h-4" />
              <span>Submit sealed proposal</span>
            </button>
          </div>
        </div>
      )}

      {/* =========================================================================
          STEP 5: SUBMIT (CONFIRMATION SCREEN)
          ========================================================================= */}
      {currentStep === 5 && submittedReceipt && (
        <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 sm:p-10 space-y-8 animate-fade-in text-[14px]">
          {/* Header Banner */}
          <div className="text-center space-y-2 pb-6 border-b border-[#D5E0EA] dark:border-[#1E364A]">
            <div className="w-16 h-16 rounded-full bg-[#ECFDF5] text-[#2F8F5B] flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 className="w-10 h-10" />
            </div>
            <h2 className="font-heading font-semibold text-[26px] text-[#10212E] dark:text-white">
              Application submitted successfully
            </h2>
            <p className="text-[#43525F] dark:text-[#B2C3D2] max-w-lg mx-auto">
              Your sealed tender proposal has been recorded in the central procurement register.
            </p>
          </div>

          {/* Receipt Details Card */}
          <div className="p-6 rounded-[10px] bg-[#F7FAFD] dark:bg-[#10212E] border border-[#D5E0EA] dark:border-[#1E364A] space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="space-y-1">
                <span className="text-[#6B7A87] block">Receipt number</span>
                <span className="font-heading font-semibold text-[18px] text-[#10212E] dark:text-white block tabular-nums">
                  {submittedReceipt.receiptNumber}
                </span>
              </div>

              <div className="space-y-1">
                <span className="text-[#6B7A87] block">Date and time</span>
                <span className="font-medium text-[#10212E] dark:text-white block tabular-nums">
                  {submittedReceipt.submittedAt}
                </span>
              </div>

              <div className="space-y-1">
                <span className="text-[#6B7A87] block">Procuring entity</span>
                <span className="font-medium text-[#10212E] dark:text-white block">
                  {selectedCall.organizationName}
                </span>
              </div>
            </div>

            <div className="pt-3 border-t border-[#D5E0EA] dark:border-[#1E364A] flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[14px]">
              <span className="text-[#6B7A87]">Sealed cryptographic hash:</span>
              <span className="font-medium text-[#10212E] dark:text-white tabular-nums">
                {submittedReceipt.sealedHash}
              </span>
            </div>
          </div>

          {/* "What happens next" in three short steps */}
          <div className="space-y-3">
            <h3 className="font-heading font-semibold text-[18px] text-[#10212E] dark:text-white">
              What happens next
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 rounded-[8px] border border-[#D5E0EA] dark:border-[#1E364A] bg-white dark:bg-[#132635] space-y-1.5">
                <div className="w-7 h-7 rounded-full bg-[#EAF2FA] dark:bg-[#1E364A] text-[#1F5F99] dark:text-[#6FAEE0] font-heading font-semibold text-[14px] flex items-center justify-center">
                  1
                </div>
                <strong className="font-semibold text-[#10212E] dark:text-white block">
                  Automated compliance check
                </strong>
                <p className="text-[#43525F] dark:text-[#B2C3D2] leading-relaxed">
                  The registry automatically verifies your packaged certificates against BURS, PPRA, and CIPA databases.
                </p>
              </div>

              <div className="p-4 rounded-[8px] border border-[#D5E0EA] dark:border-[#1E364A] bg-white dark:bg-[#132635] space-y-1.5">
                <div className="w-7 h-7 rounded-full bg-[#EAF2FA] dark:bg-[#1E364A] text-[#1F5F99] dark:text-[#6FAEE0] font-heading font-semibold text-[14px] flex items-center justify-center">
                  2
                </div>
                <strong className="font-semibold text-[#10212E] dark:text-white block">
                  Committee evaluation
                </strong>
                <p className="text-[#43525F] dark:text-[#B2C3D2] leading-relaxed">
                  The evaluation panel unseals and scores technical submissions once the tender closing deadline arrives.
                </p>
              </div>

              <div className="p-4 rounded-[8px] border border-[#D5E0EA] dark:border-[#1E364A] bg-white dark:bg-[#132635] space-y-1.5">
                <div className="w-7 h-7 rounded-full bg-[#EAF2FA] dark:bg-[#1E364A] text-[#1F5F99] dark:text-[#6FAEE0] font-heading font-semibold text-[14px] flex items-center justify-center">
                  3
                </div>
                <strong className="font-semibold text-[#10212E] dark:text-white block">
                  Notice of decision
                </strong>
                <p className="text-[#43525F] dark:text-[#B2C3D2] leading-relaxed">
                  You will receive email notifications and dashboard updates if clarification questions are asked or when awards are announced.
                </p>
              </div>
            </div>
          </div>

          {/* Action buttons including "Withdraw application" */}
          <div className="pt-6 border-t border-[#D5E0EA] dark:border-[#1E364A] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <button
              type="button"
              onClick={() => setIsWithdrawDialogOpen(true)}
              className="px-4 py-2 border border-[#D5E0EA] dark:border-[#1E364A] text-[#C2412D] hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-[6px] font-medium text-[14px] inline-flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <XCircle className="w-4 h-4" />
              <span>Withdraw application</span>
            </button>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  addAuditEvent({
                    action: 'Downloaded Submission Receipt',
                    actorName: 'Kagiso Molosiwa (Supplier admin)',
                    actorRole: 'Supplier',
                    organizationName: selectedCall.organizationName,
                    entityType: 'Application',
                    entityId: submittedReceipt.appId,
                    details: `Downloaded certified submission receipt ${submittedReceipt.receiptNumber}.`,
                    ipAddress: '168.167.23.41',
                  });
                  alert(`Receipt ${submittedReceipt.receiptNumber} downloaded.`);
                }}
                className="px-4 py-2 border border-[#D5E0EA] dark:border-[#1E364A] text-[#10212E] dark:text-white hover:bg-[#F7FAFD] rounded-[6px] font-medium text-[14px] inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download receipt</span>
              </button>

              <button
                type="button"
                onClick={() => onFinished(submittedReceipt.appId)}
                className="px-5 py-2.5 bg-[#1F5F99] hover:bg-[#184c7a] text-white rounded-[6px] font-medium text-[14px] cursor-pointer transition-colors"
              >
                View my applications
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          SLIDE-OVER DRAWER: FULL TENDER REQUIREMENTS
          ========================================================================= */}
      {isRequirementsDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-[#10212E]/40 backdrop-blur-xs transition-opacity"
            onClick={() => setIsRequirementsDrawerOpen(false)}
          />

          <div className="relative w-full max-w-xl bg-white dark:bg-[#132635] shadow-2xl h-full flex flex-col z-10 border-l border-[#D5E0EA] dark:border-[#1E364A] overflow-y-auto">
            <div className="p-6 border-b border-[#D5E0EA] dark:border-[#1E364A] flex items-center justify-between">
              <div>
                <h2 className="font-heading font-semibold text-[20px] text-[#10212E] dark:text-white">
                  Tender requirements specification
                </h2>
                <span className="text-[14px] text-[#6B7A87]">
                  {selectedCall.organizationName} · {selectedCall.callNumber}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsRequirementsDrawerOpen(false)}
                className="p-2 rounded-full text-[#6B7A87] hover:bg-[#F7FAFD] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-6 flex-1 text-[14px]">
              <div className="space-y-2">
                <span className="font-semibold text-[#10212E] dark:text-white block">
                  Tender scope summary
                </span>
                <p className="text-[#43525F] dark:text-[#B2C3D2] leading-relaxed">
                  {selectedCall.summary}
                </p>
              </div>

              <div className="space-y-2">
                <span className="font-semibold text-[#10212E] dark:text-white block">
                  Mandatory certificate requirements
                </span>
                <ul className="list-disc list-inside space-y-1 text-[#43525F] dark:text-[#B2C3D2]">
                  {selectedCall.requiredDocumentTypes.map((req) => (
                    <li key={req}>{req}</li>
                  ))}
                </ul>
              </div>

              <div className="space-y-2">
                <span className="font-semibold text-[#10212E] dark:text-white block">
                  Procuring entity details
                </span>
                <div className="p-4 rounded-[8px] bg-[#F7FAFD] dark:bg-[#10212E] border border-[#D5E0EA] dark:border-[#1E364A] space-y-1">
                  <strong className="text-[#10212E] dark:text-white font-medium block">
                    {selectedCall.organizationName}
                  </strong>
                  <span className="text-[#6B7A87] block">Civic Centre, Supply Chain Directorate</span>
                  <span className="text-[#6B7A87] block">Location: {selectedCall.location}</span>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-[#D5E0EA] dark:border-[#1E364A] flex justify-end">
              <button
                type="button"
                onClick={() => setIsRequirementsDrawerOpen(false)}
                className="px-4 py-2 bg-[#1F5F99] text-white rounded-[6px] text-[14px] font-medium cursor-pointer"
              >
                Close requirements
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: DIRECT UPLOAD FOR STEP 1 ELIGIBILITY
          ========================================================================= */}
      {quickUploadDocType && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] max-w-md w-full p-6 space-y-6 shadow-xl animate-fade-in text-[14px]">
            <div className="flex items-start justify-between pb-4 border-b border-[#D5E0EA] dark:border-[#1E364A]">
              <div>
                <h3 className="font-heading font-semibold text-[20px] text-[#10212E] dark:text-white">
                  Upload certificate
                </h3>
                <span className="text-[#6B7A87]">{quickUploadDocType}</span>
              </div>
              <button
                type="button"
                onClick={() => setQuickUploadDocType(null)}
                className="p-1 text-[#6B7A87] hover:text-[#10212E] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveQuickUpload} className="space-y-4">
              <div className="space-y-1.5">
                <label className="font-semibold text-[#10212E] dark:text-white block">
                  Document / certificate number *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. TCC-2026-BURS-8849"
                  value={quickUploadDocNumber}
                  onChange={(e) => setQuickUploadDocNumber(e.target.value)}
                  className="w-full px-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] bg-white dark:bg-[#132635] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99]"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-[#10212E] dark:text-white block">
                  File name *
                </label>
                <input
                  type="text"
                  placeholder="e.g. Tax_Clearance_2026_Certified.pdf"
                  value={quickUploadFileName}
                  onChange={(e) => setQuickUploadFileName(e.target.value)}
                  className="w-full px-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] bg-white dark:bg-[#132635] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99]"
                />
              </div>

              <div className="p-3 bg-[#EAF2FA] dark:bg-[#1E364A]/50 rounded-[6px] text-[#1F5F99] dark:text-[#6FAEE0] text-[14px] flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Document will be verified and stored in your digital vault.</span>
              </div>

              <div className="pt-4 border-t border-[#D5E0EA] dark:border-[#1E364A] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setQuickUploadDocType(null)}
                  className="px-4 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] text-[#43525F] dark:text-[#B2C3D2] hover:bg-[#F7FAFD] cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#1F5F99] hover:bg-[#184c7a] text-white rounded-[6px] text-[14px] font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                >
                  <Upload className="w-4 h-4" />
                  <span>Upload certificate</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL: WITHDRAW APPLICATION CONFIRMATION DIALOG
          ========================================================================= */}
      {isWithdrawDialogOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] max-w-lg w-full p-6 sm:p-8 space-y-6 shadow-xl animate-fade-in text-[14px]">
            <div className="flex items-start justify-between pb-4 border-b border-[#D5E0EA] dark:border-[#1E364A]">
              <div className="space-y-1">
                <h3 className="font-heading font-semibold text-[20px] text-[#10212E] dark:text-white">
                  Withdraw tender application?
                </h3>
                <span className="text-[#6B7A87]">
                  {selectedCall.callNumber}: {selectedCall.title}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsWithdrawDialogOpen(false)}
                className="p-1 text-[#6B7A87] hover:text-[#10212E] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-[#43525F] dark:text-[#B2C3D2] leading-relaxed">
                Are you sure you want to withdraw your bid for <strong>{selectedCall.title}</strong>? Once withdrawn, your sealed proposal will be removed from evaluation and the committee will be notified. This action cannot be undone.
              </p>

              <div className="p-3.5 rounded-[8px] bg-[#FEF2F2] dark:bg-[#7F1D1D]/20 border border-[#FCA5A5] dark:border-[#7F1D1D]/40 text-[#8E2A1B] dark:text-red-300">
                Notice: Withdrawing frees any tied guarantees, but you must submit a new application before the deadline to be reconsidered.
              </div>
            </div>

            <div className="pt-4 border-t border-[#D5E0EA] dark:border-[#1E364A] flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setIsWithdrawDialogOpen(false)}
                className="px-4 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[#43525F] dark:text-[#B2C3D2] hover:bg-[#F7FAFD] cursor-pointer"
              >
                Keep application
              </button>
              <button
                type="button"
                onClick={handleExecuteWithdraw}
                className="px-5 py-2 bg-[#C2412D] hover:bg-[#A12B1B] text-white rounded-[6px] font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <span>Withdraw application</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
