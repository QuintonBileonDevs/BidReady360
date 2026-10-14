import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { referenceApi, apiRequest } from '../../services/api';
import { SupplierDocument } from '../../types';
import {
  FileText,
  Upload,
  Download,
  Eye,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  X,
  ShieldAlert,
  Clock,
  Info,
  RotateCw,
  Trash2,
  Building2,
  MapPin,
  ExternalLink,
  Award,
  Sparkles,
  FileCheck,
  AlertCircle,
  HelpCircle,
  Check,
  Layers,
  Plus,
} from 'lucide-react';

interface ExtractedFieldValues {
  documentNumber: string;
  issueDate: string;
  expiryDate: string;
  authorityName: string;
}

export const SupplierVault: React.FC = () => {
  const {
    documents,
    uploadDocument,
    replaceDocument,
    deleteDocument,
    supplier,
    updateSupplierProfile,
    addAuditEvent,
    setActiveNav,
  } = useApp();

  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Business Attribute Switches (Persisted to supplier profile on change)
  const [vatRegistered, setVatRegistered] = useState<boolean>(supplier.vatRegistered ?? false);
  const [citizenOwned, setCitizenOwned] = useState<boolean>(
    (supplier.citizenOwnedPercentage && supplier.citizenOwnedPercentage > 0) || supplier.citizenOwnershipSet || false
  );
  const [youthOwned, setYouthOwned] = useState<boolean>(supplier.youthOwned ?? false);
  const [womenOwned, setWomenOwned] = useState<boolean>(supplier.womenOwned ?? false);
  const [disabilityOwned, setDisabilityOwned] = useState<boolean>(supplier.disabilityOwned ?? false);
  const [eddCertified, setEddCertified] = useState<boolean>(supplier.eddCertified ?? false);
  const [biddingPublicTenders, setBiddingPublicTenders] = useState<boolean>(supplier.biddingPublicTenders ?? false);

  // Drawers & Modals state
  const [isUploadDrawerOpen, setIsUploadDrawerOpen] = useState(false);
  const [replacingDoc, setReplacingDoc] = useState<SupplierDocument | null>(null);
  const [previewDoc, setPreviewDoc] = useState<SupplierDocument | null>(null);
  const [dbDocumentTypes, setDbDocumentTypes] = useState<any[]>([]);
  const [activeOptionalDocs, setActiveOptionalDocs] = useState<string[]>([]);
  const [isAddingOptional, setIsAddingOptional] = useState<boolean>(false);
  const [selectedOptionalType, setSelectedOptionalType] = useState<string>('Company Profile');

  useEffect(() => {
    referenceApi.loadAll().then(data => {
      if (data && data.documentTypes) {
        setDbDocumentTypes(data.documentTypes);
      }
    }).catch(err => console.error('Failed to load document types from database', err));
  }, []);

  // Upload Drawer Form State
  const [drawerDocType, setDrawerDocType] = useState<string>('CIPA Certificate of Incorporation');
  const [customDocType, setCustomDocType] = useState<string>('');
  const [drawerDocNumber, setDrawerDocNumber] = useState('');
  const [drawerIssueDate, setDrawerIssueDate] = useState('2026-01-15');
  const [drawerExpiryDate, setDrawerExpiryDate] = useState('2027-01-15');
  const [drawerFileName, setDrawerFileName] = useState('');
  const [drawerFileSize, setDrawerFileSize] = useState('');
  const [drawerCertifiedCopy, setDrawerCertifiedCopy] = useState(false);
  const [drawerCertificationDate, setDrawerCertificationDate] = useState('2026-09-20');
  const [isFileUploaded, setIsFileUploaded] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const selectedDocTypeObj = dbDocumentTypes.find(dt => dt.name === drawerDocType || dt.code === drawerDocType);
  const requiresNumber = selectedDocTypeObj ? (selectedDocTypeObj.requiresNumber ?? true) : true;
  const requiresExpiry = selectedDocTypeObj ? (selectedDocTypeObj.requiresExpiry ?? true) : true;

  const processSelectedFile = (file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      showToast('File size exceeds 10 MB limit.');
      return;
    }
    const validTypes = ['application/pdf', 'image/png', 'image/jpeg', 'image/jpg'];
    if (!validTypes.includes(file.type)) {
      showToast('Please upload a PDF, PNG, or JPG file.');
      return;
    }

    setIsFileUploaded(true);
    setDrawerFileName(file.name);
    setDrawerFileSize(`${(file.size / (1024 * 1024)).toFixed(1)} MB`);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processSelectedFile(file);
    }
  };

  // "Check the values we read before saving" AI readout
  const [extractedFields, setExtractedFields] = useState<ExtractedFieldValues>({
    documentNumber: '',
    issueDate: '2026-01-15',
    expiryDate: '2027-01-15',
    authorityName: 'Botswana Regulatory Authority',
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 5000);
  };

  const handleToggleAttribute = (key: string, value: boolean) => {
    switch (key) {
      case 'vatRegistered':
        setVatRegistered(value);
        updateSupplierProfile({ vatRegistered: value });
        showToast(value ? 'VAT registered toggled ON. Requirement added below.' : 'VAT requirement hidden.');
        break;
      case 'citizenOwned':
        setCitizenOwned(value);
        if (value && (!supplier.citizenOwnedPercentage || supplier.citizenOwnedPercentage === 0)) {
          updateSupplierProfile({ citizenOwnedPercentage: 100, citizenOwnershipSet: true });
        } else if (!value) {
          updateSupplierProfile({ citizenOwnedPercentage: 0, citizenOwnershipSet: false });
        }
        showToast(value ? 'Citizen ownership toggled ON. Share certificate requirement added.' : 'Citizen ownership requirement hidden.');
        break;
      case 'youthOwned':
        setYouthOwned(value);
        updateSupplierProfile({ youthOwned: value });
        showToast(value ? 'Youth-owned preference claim activated.' : 'Youth-owned preference claim deactivated.');
        break;
      case 'womenOwned':
        setWomenOwned(value);
        updateSupplierProfile({ womenOwned: value });
        showToast(value ? 'Women-owned preference claim activated.' : 'Women-owned preference claim deactivated.');
        break;
      case 'disabilityOwned':
        setDisabilityOwned(value);
        updateSupplierProfile({ disabilityOwned: value });
        showToast(value ? 'Disability-owned preference claim activated.' : 'Disability-owned preference claim deactivated.');
        break;
      case 'eddCertified':
        setEddCertified(value);
        updateSupplierProfile({ eddCertified: value });
        showToast(value ? 'EDD preference claim activated.' : 'EDD preference claim deactivated.');
        break;
      case 'biddingPublicTenders':
        setBiddingPublicTenders(value);
        updateSupplierProfile({ biddingPublicTenders: value });
        showToast(value ? 'Public tenders toggled ON. PPRA requirement added.' : 'Public tenders toggled OFF.');
        break;
    }
  };

  // Helper: Find document in vault matching keywords
  const findDoc = (typeKeywords: string[]): SupplierDocument | undefined => {
    return documents.find((doc) => {
      const typeLower = (doc.documentType || '').toLowerCase();
      const titleLower = (doc.title || '').toLowerCase();
      return typeKeywords.some(
        (kw) => typeLower.includes(kw.toLowerCase()) || titleLower.includes(kw.toLowerCase())
      );
    });
  };

  // Derived Document Status Chip & Readiness
  const getDerivedStatus = (doc?: SupplierDocument | null) => {
    if (!doc) {
      return {
        label: 'Missing',
        chipClass: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700',
        isReady: false,
      };
    }

    if (doc.status === 'Rejected') {
      return {
        label: 'Rejected',
        chipClass: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800',
        isReady: false,
      };
    }

    if (doc.status === 'Cannot verify') {
      return {
        label: 'Cannot verify',
        chipClass: 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800',
        isReady: false,
      };
    }

    if (doc.expiryDate) {
      try {
        const exp = new Date(doc.expiryDate);
        const now = new Date('2026-10-05');
        if (!isNaN(exp.getTime())) {
          if (exp < now) {
            return {
              label: 'Expired',
              chipClass: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800',
              isReady: false,
            };
          }
          const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays <= 90) {
            return {
              label: `Expiring soon (${diffDays}d)`,
              chipClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800',
              isReady: true,
            };
          }
        }
      } catch {}
    }

    if (doc.status === 'Verified') {
      return {
        label: 'Verified',
        chipClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800',
        isReady: true,
      };
    }

    return {
      label: 'Pending review',
      chipClass: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800',
      isReady: true,
    };
  };

  // Preference Claim Status
  const getPreferenceStatus = (isClaimed: boolean, doc?: SupplierDocument | null) => {
    if (!isClaimed) {
      return {
        label: 'Not claimed',
        chipClass: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700',
        isReady: true,
      };
    }
    if (!doc) {
      return {
        label: 'Claimed (evidence missing)',
        chipClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800',
        isReady: false,
      };
    }
    const derived = getDerivedStatus(doc);
    if (derived.label === 'Verified') {
      return {
        label: 'Verified',
        chipClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800',
        isReady: true,
      };
    }
    if (derived.label === 'Rejected') {
      return {
        label: 'Rejected',
        chipClass: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800',
        isReady: false,
      };
    }
    if (derived.label === 'Expired') {
      return {
        label: 'Expired',
        chipClass: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800',
        isReady: false,
      };
    }
    return {
      label: 'Pending review',
      chipClass: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800',
      isReady: true,
    };
  };

  // Check Directors' and Shareholders' ID readiness (Smart Logic with Actual Uploads & Multiple Directors)
  const directorsList = supplier.directors || [];
  const directorsCount = directorsList.length;
  const directorDocs = documents.filter((doc) => {
    const t = (doc.documentType || '').toLowerCase();
    const title = (doc.title || '').toLowerCase();
    return t.includes('director') || t.includes('shareholder') || t.includes('identity') || title.includes('director') || title.includes('shareholder');
  });
  const directorDoc = directorDocs[0];
  const isDirectorsReady = directorsCount > 0 && directorDocs.length > 0 && (directorDoc?.status === 'Verified' || directorDoc?.status === 'Pending' || directorDoc?.status === 'Expiring soon');

  const directorsStatusLabel = directorsCount === 0
    ? 'Missing (No directors registered)'
    : directorDocs.length === 0
    ? 'Missing (Not uploaded)'
    : directorDocs.length >= directorsCount
    ? (directorDoc?.status || 'Verified')
    : `Incomplete (${directorDocs.length}/${directorsCount} IDs uploaded)`;

  // Documents matching
  const cipaDoc = findDoc(['cipa', 'incorporation']);
  const bursDoc = findDoc(['tax clearance', 'burs', 'tax_clearance']);
  const tradingLicenceDoc = findDoc(['trading licence', 'trading_licence', 'licence']);
  const bankLetterDoc = findDoc(['bank confirmation', 'bank_letter', 'bank rating']);

  const vatDoc = findDoc(['vat']);
  const shareCertDoc = findDoc(['share certificate', 'shareholding']);
  const youthDoc = findDoc(['youth']);
  const womenDoc = findDoc(['women']);
  const disabilityDoc = findDoc(['disability']);
  const eddDoc = findDoc(['edd', 'economic diversification']);
  const ppraDoc = findDoc(['ppra']);

  const sectorLicenceDoc = findDoc(['sector licence', 'practising certificate', 'professional licence']);
  const workersSafetyDoc = findDoc(['workers compensation', 'safety', 'wca']);
  const publicLiabilityDoc = findDoc(['public liability', 'liability insurance']);

  const companyProfileDoc = findDoc(['company profile']);
  const cipaExtractDoc = findDoc(['company extract', 'cipa extract']);
  const auditedFinancialsDoc = findDoc(['financial statements', 'audited']);

  // Required Item Readiness evaluation
  const mandatoryItems = [
    { name: 'CIPA certificate of incorporation', isReady: getDerivedStatus(cipaDoc).isReady },
    { name: 'BURS tax clearance certificate', isReady: getDerivedStatus(bursDoc).isReady },
    { name: "Directors' and shareholders' ID", isReady: isDirectorsReady },
    { name: 'Trading licence', isReady: getDerivedStatus(tradingLicenceDoc).isReady },
    { name: 'Bank confirmation letter', isReady: getDerivedStatus(bankLetterDoc).isReady },
  ];

  // Conditional Active Items
  const conditionalItems: { name: string; isReady: boolean }[] = [];
  if (vatRegistered) {
    conditionalItems.push({ name: 'VAT registration certificate', isReady: getDerivedStatus(vatDoc).isReady });
  }
  if (citizenOwned) {
    conditionalItems.push({ name: 'Share certificates', isReady: getDerivedStatus(shareCertDoc).isReady });
  }
  if (youthOwned) {
    conditionalItems.push({ name: 'Youth ownership preference evidence', isReady: getPreferenceStatus(true, youthDoc).isReady });
  }
  if (disabilityOwned) {
    conditionalItems.push({ name: 'Disability ownership preference evidence', isReady: getPreferenceStatus(true, disabilityDoc).isReady });
  }
  if (eddCertified) {
    conditionalItems.push({ name: 'EDD certificate & preference evidence', isReady: getPreferenceStatus(true, eddDoc).isReady });
  }
  if (supplier.categories?.length || supplier.category) {
    conditionalItems.push({ name: 'Sector licence or practising certificate', isReady: getDerivedStatus(sectorLicenceDoc).isReady });
    conditionalItems.push({ name: "Workers' compensation & safety", isReady: getDerivedStatus(workersSafetyDoc).isReady });
    conditionalItems.push({ name: 'Public liability insurance', isReady: getDerivedStatus(publicLiabilityDoc).isReady });
  }
  if (biddingPublicTenders) {
    conditionalItems.push({ name: 'PPRA registration certificate', isReady: getDerivedStatus(ppraDoc).isReady });
  }

  const allActiveItems = [...mandatoryItems, ...conditionalItems];
  const totalActiveCount = allActiveItems.length;
  const readyCount = allActiveItems.filter((i) => i.isReady).length;
  const missingItemNames = allActiveItems.filter((i) => !i.isReady).map((i) => i.name);
  const isReadyToApply = missingItemNames.length === 0;

  // Open Drawer Helper
  const handleOpenUploadDrawer = (docType: string, existingDoc?: SupplierDocument) => {
    setReplacingDoc(existingDoc || null);

    const actualType = existingDoc?.documentType || docType;
    const matchedDt = dbDocumentTypes.find(dt => 
      dt.name.toLowerCase() === actualType.toLowerCase() || 
      dt.code?.toLowerCase() === actualType.toLowerCase() ||
      dt.name.toLowerCase().includes(actualType.toLowerCase()) ||
      actualType.toLowerCase().includes(dt.name.toLowerCase())
    );

    let resolvedType = 'CIPA Certificate of Incorporation';
    let resolvedCustom = '';

    if (matchedDt) {
      resolvedType = matchedDt.name;
    } else if (actualType) {
      const found = dbDocumentTypes.find(dt => dt.name === actualType);
      if (found) {
        resolvedType = found.name;
      } else {
        resolvedType = 'Other (Custom)';
        resolvedCustom = actualType;
      }
    }

    setDrawerDocType(resolvedType);
    setCustomDocType(resolvedCustom);

    setDrawerDocNumber(existingDoc?.documentNumber || '');
    setDrawerIssueDate(existingDoc?.issueDate || '2026-01-15');
    setDrawerExpiryDate(existingDoc?.expiryDate || '2027-01-15');
    setDrawerFileName(existingDoc ? existingDoc.fileName : '');
    setDrawerFileSize(existingDoc ? existingDoc.fileSize : '');
    setDrawerCertifiedCopy(existingDoc?.certifiedCopy || false);
    setDrawerCertificationDate(existingDoc?.certificationDate || '2026-09-20');
    setIsFileUploaded(Boolean(existingDoc));

    setExtractedFields({
      documentNumber: existingDoc?.documentNumber || '',
      issueDate: existingDoc?.issueDate || '2026-01-15',
      expiryDate: existingDoc?.expiryDate || '2027-01-15',
      authorityName: getAuthorityForType(resolvedType === 'Other (Custom)' ? resolvedCustom : resolvedType),
    });

    setIsUploadDrawerOpen(true);
  };

  const getAuthorityForType = (type: string): string => {
    const t = type.toLowerCase();
    if (t.includes('cipa')) return 'Companies & Intellectual Property Authority';
    if (t.includes('burs') || t.includes('tax') || t.includes('vat')) return 'Botswana Unified Revenue Service';
    if (t.includes('ppra')) return 'Public Procurement Regulatory Authority';
    if (t.includes('edd')) return 'Ministry of Trade & Industry (EDD)';
    if (t.includes('bank')) return 'Commercial Banking Provider';
    if (t.includes('trading') || t.includes('licence')) return 'Gaborone City Council / Local Authority';
    if (t.includes('workers') || t.includes('safety')) return 'Department of Occupational Health & Safety';
    if (t.includes('insurance') || t.includes('liability')) return 'Commercial Insurance Underwriter';
    return 'Statutory Regulatory Authority';
  };

  const handleSaveDrawerDocument = (e: React.FormEvent) => {
    e.preventDefault();

    if (!drawerIssueDate) {
      alert('Please fill out issue date.');
      return;
    }

    const finalDocType = drawerDocType === 'Other (Custom)' ? (customDocType.trim() || 'Custom Document') : drawerDocType;
    const finalFileName = drawerFileName || `${finalDocType.replace(/[^a-zA-Z0-9]/g, '_')}.pdf`;
    const finalFileSize = drawerFileSize || '1.5 MB';

    if (replacingDoc) {
      replaceDocument(replacingDoc.id, {
        documentType: finalDocType,
        documentNumber: drawerDocNumber || undefined,
        fileName: finalFileName,
        fileSize: finalFileSize,
        issueDate: drawerIssueDate,
        expiryDate: requiresExpiry ? drawerExpiryDate : undefined,
        status: 'Pending',
        statusMessage: 'Pending verification by procurement registry officers.',
        rejectionReason: undefined,
        certifiedCopy: drawerCertifiedCopy,
        certificationDate: drawerCertifiedCopy ? drawerCertificationDate : undefined,
      });
      showToast(`Replaced version for ${finalDocType}. Status set to Pending review.`);
    } else {
      uploadDocument({
        supplierId: supplier.id,
        documentType: finalDocType,
        documentNumber: drawerDocNumber || undefined,
        fileName: finalFileName,
        fileSize: finalFileSize,
        issueDate: drawerIssueDate,
        expiryDate: requiresExpiry ? drawerExpiryDate : undefined,
        status: 'Pending',
        statusMessage: 'Pending verification by procurement registry officers.',
        downloadUrl: '#',
        certifiedCopy: drawerCertifiedCopy,
        certificationDate: drawerCertifiedCopy ? drawerCertificationDate : undefined,
        extractedFields: {
          ...(drawerDocNumber ? { 'Document number': drawerDocNumber } : {}),
          'Issue date': drawerIssueDate,
          ...(requiresExpiry ? { 'Valid through': drawerExpiryDate } : { 'Validity': 'Does not expire (Perpetual)' }),
        },
      });
      showToast(`Uploaded ${finalDocType} to vault. Status set to Pending review.`);
    }

    setIsUploadDrawerOpen(false);
    setReplacingDoc(null);
  };

  return (
    <div className="space-y-8 py-2">
      {/* 1. Header with Progress & Readiness Chip */}
      <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 sm:p-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-semibold text-[#1F5F99] dark:text-[#38BDF8] bg-[#EAF2FA] dark:bg-[#1E364A] px-2.5 py-0.5 rounded-[4px]">
                Vault & Qualification
              </span>
              <span className="text-[13px] text-[#6B7A87]">· Dynamic supplier passport</span>
            </div>
            <h1 className="font-heading font-semibold text-[26px] sm:text-[30px] leading-tight text-[#10212E] dark:text-white">
              Documents and eligibility
            </h1>
            <p className="text-[15px] text-[#43525F] dark:text-[#B2C3D2]">
              Manage mandatory statutory compliance, business eligibility declarations, and preference margin evidence.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            {isReadyToApply ? (
              <span className="px-3.5 py-1.5 bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 font-semibold text-[13px] rounded-full flex items-center gap-1.5 border border-emerald-300 dark:border-emerald-700">
                <CheckCircle2 className="w-4 h-4" /> Ready to apply
              </span>
            ) : (
              <span className="px-3.5 py-1.5 bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 font-semibold text-[13px] rounded-full flex items-center gap-1.5 border border-amber-300 dark:border-amber-700">
                <AlertTriangle className="w-4 h-4" /> Not ready yet
              </span>
            )}
          </div>
        </div>

        {/* Progress Bar */}
        <div className="p-5 rounded-[10px] bg-[#F7FAFD] dark:bg-[#182C3A] border border-[#D5E0EA] dark:border-[#1E364A] space-y-3">
          <div className="flex items-center justify-between text-[14px]">
            <span className="font-semibold text-[#10212E] dark:text-white">
              {readyCount} of {totalActiveCount} required documents ready
            </span>
            <span className="text-[#6B7A87] font-mono text-[13px]">
              {Math.round((readyCount / Math.max(1, totalActiveCount)) * 100)}%
            </span>
          </div>
          <div className="w-full h-2.5 bg-[#D5E0EA] dark:bg-[#1E364A] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#1F5F99] dark:bg-[#38BDF8] transition-all duration-300 rounded-full"
              style={{ width: `${Math.round((readyCount / Math.max(1, totalActiveCount)) * 100)}%` }}
            />
          </div>

          {missingItemNames.length > 0 && (
            <div className="flex items-start gap-2 text-[13px] text-amber-800 dark:text-amber-300 pt-1">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                <strong>Action needed:</strong> Missing or requiring renewal: {missingItemNames.join(', ')}.
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Toast Alert */}
      {toastMessage && (
        <div className="p-4 rounded-[12px] bg-[#ECFDF5] text-[#065F46] border border-[#A7F3D0] flex items-center justify-between gap-3 text-[14px]">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="w-5 h-5 text-[#2F8F5B] shrink-0" />
            <span>{toastMessage}</span>
          </div>
          <button
            type="button"
            onClick={() => setToastMessage(null)}
            className="text-[#065F46] hover:opacity-75 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ================= SECTION 1: Required for everyone (5) ================= */}
      <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 sm:p-8 space-y-6">
        <div className="space-y-1 pb-4 border-b border-[#D5E0EA] dark:border-[#1E364A]">
          <h2 className="font-heading font-semibold text-[20px] text-[#10212E] dark:text-white flex items-center gap-2">
            <span>Required for everyone</span>
            <span className="text-[12px] bg-[#1F5F99] text-white px-2 py-0.5 rounded-full font-medium">5 items</span>
          </h2>
          <p className="text-[14px] text-[#6B7A87]">
            Mandatory statutory compliance documents required for basic qualification across all public and corporate procurement calls.
          </p>
        </div>

        <div className="space-y-4">
          {/* Row 1: CIPA */}
          <DocumentRow
            title="CIPA certificate of incorporation"
            whyNeeded="Confirms official company registration and UIN with CIPA."
            doc={cipaDoc}
            onUpload={() => handleOpenUploadDrawer('CIPA Certificate of Incorporation', cipaDoc)}
            onReplace={() => handleOpenUploadDrawer('CIPA Certificate of Incorporation', cipaDoc)}
            onView={() => setPreviewDoc(cipaDoc || null)}
            onDelete={() => cipaDoc && deleteDocument(cipaDoc.id)}
          />

          {/* Row 2: BURS */}
          <DocumentRow
            title="BURS tax clearance certificate"
            whyNeeded="Proves statutory tax standing with Botswana Unified Revenue Service."
            doc={bursDoc}
            onUpload={() => handleOpenUploadDrawer('BURS Tax Clearance Certificate', bursDoc)}
            onReplace={() => handleOpenUploadDrawer('BURS Tax Clearance Certificate', bursDoc)}
            onView={() => setPreviewDoc(bursDoc || null)}
            onDelete={() => bursDoc && deleteDocument(bursDoc.id)}
          />

          {/* Row 3: Directors & Shareholders ID (Multi-document support) */}
          <div className="p-4 sm:p-5 rounded-[8px] border border-[#D5E0EA] dark:border-[#1E364A] bg-[#F7FAFD] dark:bg-[#182C3A]/50 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-heading font-semibold text-[16px] text-[#10212E] dark:text-white">
                    Directors' and shareholders' ID
                  </h3>
                  <span className={`text-[12px] px-2.5 py-0.5 rounded-[4px] font-medium ${isDirectorsReady ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800' : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800'}`}>
                    {directorsStatusLabel}
                  </span>
                </div>
                <p className="text-[13px] text-[#43525F] dark:text-[#B2C3D2]">
                  Mandatory statutory identity documents / passports for all registered directors and beneficial shareholders. You can upload multiple ID documents (one for each director/shareholder).
                </p>
                {directorsCount > 0 && (
                  <span className="text-[12px] text-[#6B7A87] italic block">
                    Registered Directors ({directorsCount}): {directorsList.map(d => `${d.fullName} (${d.role}, ${d.shareholdingPercentage}%)`).join(' · ')}
                  </span>
                )}
              </div>
              <button
                type="button"
                onClick={() => handleOpenUploadDrawer('Directors and Shareholders ID')}
                className="px-3.5 py-1.5 bg-[#1F5F99] hover:bg-[#184c7a] text-white rounded-[6px] text-[13px] font-medium inline-flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Director/Shareholder ID</span>
              </button>
            </div>

            {/* List of uploaded director ID documents */}
            {directorDocs.length > 0 ? (
              <div className="space-y-2 pt-2 border-t border-[#D5E0EA] dark:border-[#1E364A]">
                {directorDocs.map((dDoc, idx) => (
                  <div key={dDoc.id || idx} className="flex items-center justify-between p-3 bg-white dark:bg-[#132635] rounded-[6px] border border-[#D5E0EA] dark:border-[#1E364A] gap-3">
                    <div className="space-y-0.5 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-[14px] text-[#10212E] dark:text-white truncate">
                          {dDoc.fileName}
                        </span>
                        <span className="text-[11px] px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 rounded font-medium">
                          #{dDoc.documentNumber}
                        </span>
                        <span className="text-[11px] px-2 py-0.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded font-medium">
                          {dDoc.status}
                        </span>
                      </div>
                      <p className="text-[12px] text-[#6B7A87]">
                        Size: {dDoc.fileSize} · Uploaded: {dDoc.issueDate || 'N/A'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => setPreviewDoc(dDoc)}
                        className="px-2.5 py-1 border border-[#D5E0EA] dark:border-[#1E364A] hover:bg-slate-50 dark:hover:bg-[#10212E] text-[#10212E] dark:text-white rounded-[4px] text-[12px] font-medium inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Eye className="w-3 h-3" />
                        <span>View</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleOpenUploadDrawer('Directors and Shareholders ID', dDoc)}
                        className="px-2.5 py-1 bg-[#1F5F99] hover:bg-[#184c7a] text-white rounded-[4px] text-[12px] font-medium inline-flex items-center gap-1 cursor-pointer"
                      >
                        <RotateCw className="w-3 h-3" />
                        <span>Replace</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteDocument(dDoc.id)}
                        className="p-1 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-[4px] cursor-pointer"
                        title="Remove ID document"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-3 text-center text-[13px] text-[#6B7A87] italic bg-white/50 dark:bg-[#132635]/50 rounded-[6px]">
                No director or shareholder ID documents uploaded yet. Click "Add Director/Shareholder ID" to upload.
              </div>
            )}
          </div>

          {/* Row 4: Trading Licence */}
          <DocumentRow
            title="Trading licence"
            whyNeeded="Authorizes commercial business operations in local municipal jurisdiction."
            doc={tradingLicenceDoc}
            onUpload={() => handleOpenUploadDrawer('Trading Licence', tradingLicenceDoc)}
            onReplace={() => handleOpenUploadDrawer('Trading Licence', tradingLicenceDoc)}
            onView={() => setPreviewDoc(tradingLicenceDoc || null)}
            onDelete={() => tradingLicenceDoc && deleteDocument(tradingLicenceDoc.id)}
          />

          {/* Row 5: Bank Confirmation Letter */}
          <DocumentRow
            title="Bank confirmation letter"
            whyNeeded="Verifies active commercial bank account details for electronic contract payments."
            doc={bankLetterDoc}
            onUpload={() => handleOpenUploadDrawer('Bank Confirmation Letter', bankLetterDoc)}
            onReplace={() => handleOpenUploadDrawer('Bank Confirmation Letter', bankLetterDoc)}
            onView={() => setPreviewDoc(bankLetterDoc || null)}
            onDelete={() => bankLetterDoc && deleteDocument(bankLetterDoc.id)}
          />
        </div>
      </div>

      {/* ================= SECTION 2: Tell us about your business ================= */}
      <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 sm:p-8 space-y-6">
        <div className="space-y-1 pb-4 border-b border-[#D5E0EA] dark:border-[#1E364A]">
          <h2 className="font-heading font-semibold text-[20px] text-[#10212E] dark:text-white">
            Tell us about your business
          </h2>
          <p className="text-[14px] text-[#6B7A87]">
            Switch on relevant business attributes to reveal conditional document requirements and preference margin evidence uploads.
          </p>
        </div>

        {/* Automatic District Location Bar */}
        <div className="p-4 rounded-[10px] bg-[#EAF2FA] dark:bg-[#1E364A]/70 border border-[#BDE0FE] dark:border-[#2C4D63] text-[14px] text-[#10212E] dark:text-[#EAF2FA] flex items-center gap-3">
          <MapPin className="w-5 h-5 text-[#1F5F99] dark:text-[#38BDF8] shrink-0" />
          <span>
            Located in <strong>{supplier.district || supplier.city || 'Gaborone District'}</strong> (automatically determined from your company profile).
          </span>
        </div>

        {/* Declarations & Switches Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          <SwitchCard
            label="VAT registered?"
            description="Are you registered for Value Added Tax with BURS?"
            checked={vatRegistered}
            onChange={(val) => handleToggleAttribute('vatRegistered', val)}
          />
          <SwitchCard
            label="Citizen-owned business?"
            description={`Citizen equity shareholding: ${supplier.citizenOwnedPercentage ?? 0}%`}
            checked={citizenOwned}
            onChange={(val) => handleToggleAttribute('citizenOwned', val)}
          />
          <SwitchCard
            label="Youth-owned business?"
            description="Is your company majority youth-owned or managed?"
            checked={youthOwned}
            onChange={(val) => handleToggleAttribute('youthOwned', val)}
          />
          <SwitchCard
            label="Women-owned business?"
            description="Is your company majority women-owned or managed?"
            checked={womenOwned}
            onChange={(val) => handleToggleAttribute('womenOwned', val)}
          />
          <SwitchCard
            label="Disability-owned business?"
            description="Is your company majority disability-owned or managed?"
            checked={disabilityOwned}
            onChange={(val) => handleToggleAttribute('disabilityOwned', val)}
          />
          <SwitchCard
            label="Economic Diversification (EDD) registered?"
            description="Are you certified under the EDD local manufacturing scheme?"
            checked={eddCertified}
            onChange={(val) => handleToggleAttribute('eddCertified', val)}
          />
          <SwitchCard
            label="Bidding on public-body tenders?"
            description="Do you submit tenders to central government and parastatals?"
            checked={biddingPublicTenders}
            onChange={(val) => handleToggleAttribute('biddingPublicTenders', val)}
          />
        </div>

        {/* Conditional Document Rows */}
        <div className="pt-6 space-y-4 border-t border-[#D5E0EA] dark:border-[#1E364A]">
          <h3 className="font-heading font-semibold text-[16px] text-[#10212E] dark:text-white">
            Conditional requirements & preference evidence
          </h3>

          {vatRegistered && (
            <DocumentRow
              title="VAT registration certificate"
              whyNeeded="Proves registration for Value Added Tax with BURS."
              doc={vatDoc}
              onUpload={() => handleOpenUploadDrawer('VAT Registration Certificate', vatDoc)}
              onReplace={() => handleOpenUploadDrawer('VAT Registration Certificate', vatDoc)}
              onView={() => setPreviewDoc(vatDoc || null)}
              onDelete={() => vatDoc && deleteDocument(vatDoc.id)}
            />
          )}

          {citizenOwned && (
            <DocumentRow
              title="Share certificates"
              whyNeeded="Demonstrates citizen equity and shareholding allocation."
              doc={shareCertDoc}
              onUpload={() => handleOpenUploadDrawer('Share Certificates', shareCertDoc)}
              onReplace={() => handleOpenUploadDrawer('Share Certificates', shareCertDoc)}
              onView={() => setPreviewDoc(shareCertDoc || null)}
              onDelete={() => shareCertDoc && deleteDocument(shareCertDoc.id)}
            />
          )}

          {youthOwned && (
            <PreferenceRow
              title="Youth ownership preference evidence"
              whyNeeded="Proves youth equity or management participation for empowerment preferences."
              isClaimed={true}
              doc={youthDoc}
              onUpload={() => handleOpenUploadDrawer('Youth Preference Evidence', youthDoc)}
              onReplace={() => handleOpenUploadDrawer('Youth Preference Evidence', youthDoc)}
              onView={() => setPreviewDoc(youthDoc || null)}
              onDelete={() => youthDoc && deleteDocument(youthDoc.id)}
            />
          )}

          {disabilityOwned && (
            <PreferenceRow
              title="Disability ownership preference evidence"
              whyNeeded="Proves disability equity or management participation for empowerment preferences."
              isClaimed={true}
              doc={disabilityDoc}
              onUpload={() => handleOpenUploadDrawer('Disability Preference Evidence', disabilityDoc)}
              onReplace={() => handleOpenUploadDrawer('Disability Preference Evidence', disabilityDoc)}
              onView={() => setPreviewDoc(disabilityDoc || null)}
              onDelete={() => disabilityDoc && deleteDocument(disabilityDoc.id)}
            />
          )}

          {eddCertified && (
            <PreferenceRow
              title="EDD certificate & preference evidence"
              whyNeeded="Proves certification under the Economic Diversification Drive initiative."
              isClaimed={true}
              doc={eddDoc}
              onUpload={() => handleOpenUploadDrawer('EDD Certificate', eddDoc)}
              onReplace={() => handleOpenUploadDrawer('EDD Certificate', eddDoc)}
              onView={() => setPreviewDoc(eddDoc || null)}
              onDelete={() => eddDoc && deleteDocument(eddDoc.id)}
            />
          )}

          {(supplier.categories?.length || supplier.category) && (
            <>
              <DocumentRow
                title="Sector licence or practising certificate"
                whyNeeded="Specialized professional or industry operational license required for your selected sector."
                doc={sectorLicenceDoc}
                onUpload={() => handleOpenUploadDrawer('Sector Licence', sectorLicenceDoc)}
                onReplace={() => handleOpenUploadDrawer('Sector Licence', sectorLicenceDoc)}
                onView={() => setPreviewDoc(sectorLicenceDoc || null)}
                onDelete={() => sectorLicenceDoc && deleteDocument(sectorLicenceDoc.id)}
              />
              <DocumentRow
                title="Workers' compensation & safety"
                whyNeeded="Proof of occupational health, safety compliance, and personnel insurance."
                doc={workersSafetyDoc}
                onUpload={() => handleOpenUploadDrawer('Workers Compensation & Safety Compliance', workersSafetyDoc)}
                onReplace={() => handleOpenUploadDrawer('Workers Compensation & Safety Compliance', workersSafetyDoc)}
                onView={() => setPreviewDoc(workersSafetyDoc || null)}
                onDelete={() => workersSafetyDoc && deleteDocument(workersSafetyDoc.id)}
              />
              <DocumentRow
                title="Public liability insurance"
                whyNeeded="Indemnity coverage for third-party liability across executed contracts."
                doc={publicLiabilityDoc}
                onUpload={() => handleOpenUploadDrawer('Public Liability Insurance Policy', publicLiabilityDoc)}
                onReplace={() => handleOpenUploadDrawer('Public Liability Insurance Policy', publicLiabilityDoc)}
                onView={() => setPreviewDoc(publicLiabilityDoc || null)}
                onDelete={() => publicLiabilityDoc && deleteDocument(publicLiabilityDoc.id)}
              />
            </>
          )}

          {biddingPublicTenders && (
            <DocumentRow
              title="PPRA registration certificate"
              whyNeeded="Contractor grading and code registration with Public Procurement Regulatory Authority."
              note="check the current requirement"
              doc={ppraDoc}
              onUpload={() => handleOpenUploadDrawer('PPRA Registration Certificate', ppraDoc)}
              onReplace={() => handleOpenUploadDrawer('PPRA Registration Certificate', ppraDoc)}
              onView={() => setPreviewDoc(ppraDoc || null)}
              onDelete={() => ppraDoc && deleteDocument(ppraDoc.id)}
            />
          )}

          {conditionalItems.length === 0 && (
            <div className="p-6 rounded-[8px] border border-dashed border-[#D5E0EA] dark:border-[#1E364A] text-center text-[14px] text-[#6B7A87]">
              No conditional requirements active. Switch on business declarations above to reveal relevant document requirements.
            </div>
          )}
        </div>
      </div>

      {/* ================= SECTION 3: Optional extras ================= */}
      <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 sm:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#D5E0EA] dark:border-[#1E364A]">
          <div className="space-y-1">
            <h2 className="font-heading font-semibold text-[20px] text-[#10212E] dark:text-white">
              Optional extras
            </h2>
            <p className="text-[14px] text-[#6B7A87]">
              Additional corporate documentation to enhance buyer evaluation, technical scoring, and financial threshold grading.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsAddingOptional(true)}
            className="px-3.5 py-2 bg-[#1F5F99] hover:bg-[#184c7a] text-white rounded-[6px] text-[13px] font-medium inline-flex items-center gap-1.5 shrink-0 cursor-pointer transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add optional document</span>
          </button>
        </div>

        {/* Modal / Selector for adding optional document */}
        {isAddingOptional && (
          <div className="p-4 rounded-[8px] bg-[#F7FAFD] dark:bg-[#182C3A] border border-[#D5E0EA] dark:border-[#1E364A] space-y-3">
            <h3 className="font-medium text-[14px] text-[#10212E] dark:text-white">Select optional document type to add</h3>
            <div className="flex items-center gap-3">
              <select
                value={selectedOptionalType}
                onChange={(e) => setSelectedOptionalType(e.target.value)}
                className="flex-1 px-3.5 py-2 rounded-[6px] border border-[#D5E0EA] dark:border-[#1E364A] bg-white dark:bg-[#10212E] text-[14px] text-[#10212E] dark:text-white"
              >
                <option value="Company Profile">Company profile</option>
                <option value="CIPA Company Extract">CIPA company extract</option>
                <option value="Audited Financial Statements">Audited financial statements</option>
                <option value="Bank Rating Letter">Bank rating letter</option>
                <option value="Professional or Trade Licence">Professional or trade licence</option>
              </select>
              <button
                type="button"
                onClick={() => {
                  if (!activeOptionalDocs.includes(selectedOptionalType)) {
                    setActiveOptionalDocs([...activeOptionalDocs, selectedOptionalType]);
                  }
                  setIsAddingOptional(false);
                }}
                className="px-4 py-2 bg-[#2F8F5B] hover:bg-[#25754b] text-white rounded-[6px] text-[13px] font-medium cursor-pointer"
              >
                Show document
              </button>
              <button
                type="button"
                onClick={() => setIsAddingOptional(false)}
                className="px-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] text-[#6B7A87] hover:bg-white rounded-[6px] text-[13px] cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {(Boolean(companyProfileDoc) || activeOptionalDocs.includes('Company Profile')) && (
            <DocumentRow
              title="Company profile"
              whyNeeded="Corporate capabilities, past performance summary, and executive presentation."
              doc={companyProfileDoc}
              onUpload={() => handleOpenUploadDrawer('Company Profile', companyProfileDoc)}
              onReplace={() => handleOpenUploadDrawer('Company Profile', companyProfileDoc)}
              onView={() => setPreviewDoc(companyProfileDoc || null)}
              onDelete={() => {
                if (companyProfileDoc) deleteDocument(companyProfileDoc.id);
                setActiveOptionalDocs(activeOptionalDocs.filter(t => t !== 'Company Profile'));
              }}
            />
          )}

          {(Boolean(cipaExtractDoc) || activeOptionalDocs.includes('CIPA Company Extract')) && (
            <DocumentRow
              title="CIPA company extract"
              whyNeeded="Detailed current company extract from CIPA registry."
              doc={cipaExtractDoc}
              onUpload={() => handleOpenUploadDrawer('CIPA Company Extract', cipaExtractDoc)}
              onReplace={() => handleOpenUploadDrawer('CIPA Company Extract', cipaExtractDoc)}
              onView={() => setPreviewDoc(cipaExtractDoc || null)}
              onDelete={() => {
                if (cipaExtractDoc) deleteDocument(cipaExtractDoc.id);
                setActiveOptionalDocs(activeOptionalDocs.filter(t => t !== 'CIPA Company Extract'));
              }}
            />
          )}

          {(Boolean(auditedFinancialsDoc) || activeOptionalDocs.includes('Audited Financial Statements')) && (
            <DocumentRow
              title="Audited financial statements"
              whyNeeded="Certified annual financial report signed by a registered accountant."
              doc={auditedFinancialsDoc}
              onUpload={() => handleOpenUploadDrawer('Audited Financial Statements', auditedFinancialsDoc)}
              onReplace={() => handleOpenUploadDrawer('Audited Financial Statements', auditedFinancialsDoc)}
              onView={() => setPreviewDoc(auditedFinancialsDoc || null)}
              onDelete={() => {
                if (auditedFinancialsDoc) deleteDocument(auditedFinancialsDoc.id);
                setActiveOptionalDocs(activeOptionalDocs.filter(t => t !== 'Audited Financial Statements'));
              }}
            />
          )}

          {!Boolean(companyProfileDoc) && !Boolean(cipaExtractDoc) && !Boolean(auditedFinancialsDoc) && activeOptionalDocs.length === 0 && (
            <div className="p-6 rounded-[8px] border border-dashed border-[#D5E0EA] dark:border-[#1E364A] text-center text-[14px] text-[#6B7A87]">
              No optional documents selected by default. Click "Add optional document" above to include company profile, extracts, or financial statements.
            </div>
          )}
        </div>
      </div>

      {/* ================= UPLOAD / REPLACE DRAWER ================= */}
      {isUploadDrawerOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/50 flex justify-end transition-opacity">
          <div className="w-full max-w-xl bg-white dark:bg-[#132635] h-full overflow-y-auto p-6 sm:p-8 space-y-6 shadow-2xl flex flex-col justify-between">
            <div className="space-y-6">
              <div className="flex items-center justify-between pb-4 border-b border-[#D5E0EA] dark:border-[#1E364A]">
                <div>
                  <h2 className="font-heading font-semibold text-[20px] text-[#10212E] dark:text-white">
                    {replacingDoc ? 'Replace document version' : 'Upload document to vault'}
                  </h2>
                  <p className="text-[13px] text-[#6B7A87]">
                    {drawerDocType}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsUploadDrawerOpen(false)}
                  className="p-2 text-[#6B7A87] hover:text-[#10212E] dark:hover:text-white cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form id="drawer-form" onSubmit={handleSaveDrawerDocument} className="space-y-5 text-[14px]">
                {/* Document Type */}
                <div className="space-y-2">
                  <label className="block text-[13px] font-medium text-[#10212E] dark:text-white">
                    Document type (from database catalogue or custom)
                  </label>
                  <select
                    value={drawerDocType}
                    onChange={(e) => setDrawerDocType(e.target.value)}
                    className="w-full px-3.5 py-2 rounded-[6px] border border-[#D5E0EA] dark:border-[#1E364A] bg-[#F7FAFD] dark:bg-[#182C3A] text-[#10212E] dark:text-white"
                  >
                    {dbDocumentTypes.length > 0 ? (
                      dbDocumentTypes.map((dt: any) => (
                        <option key={dt.code || dt.id} value={dt.name}>
                          {dt.name} {dt.category ? `(${dt.category})` : ''}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="CIPA Certificate of Incorporation">CIPA Certificate of Incorporation</option>
                        <option value="BURS Tax Clearance Certificate">BURS Tax Clearance Certificate</option>
                        <option value="Trading Licence">Trading Licence</option>
                        <option value="Bank Confirmation Letter">Bank Confirmation Letter</option>
                      </>
                    )}
                    <option value="Other (Custom)">Other (Specify custom document type)</option>
                  </select>

                  {drawerDocType === 'Other (Custom)' && (
                    <div className="pt-1">
                      <label className="block text-[12px] font-medium text-[#6B7A87] pb-1">
                        Enter custom document type name <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={customDocType}
                        onChange={(e) => setCustomDocType(e.target.value)}
                        placeholder="e.g. Environmental Impact Assessment Certificate"
                        required
                        className="w-full px-3.5 py-2 rounded-[6px] border border-[#D5E0EA] dark:border-[#1E364A] bg-white dark:bg-[#10212E] text-[#10212E] dark:text-white text-[13px]"
                      />
                    </div>
                  )}
                </div>

                {/* Document Number - Optional */}
                <div className="space-y-1">
                  <label className="block text-[13px] font-medium text-[#10212E] dark:text-white">
                    Document or certificate number <span className="text-[12px] font-normal text-[#6B7A87]">(optional if not applicable)</span>
                  </label>
                  <input
                    type="text"
                    value={drawerDocNumber}
                    onChange={(e) => setDrawerDocNumber(e.target.value)}
                    placeholder="e.g. BURS-TX-2026-9921 (leave blank if none)"
                    className="w-full px-3.5 py-2 rounded-[6px] border border-[#D5E0EA] dark:border-[#1E364A] bg-white dark:bg-[#10212E] text-[#10212E] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#1F5F99]"
                  />
                </div>

                {/* Dates - Conditional Expiry */}
                <div className={`grid ${requiresExpiry ? 'grid-cols-2' : 'grid-cols-1'} gap-4`}>
                  <div className="space-y-1">
                    <label className="block text-[13px] font-medium text-[#10212E] dark:text-white">
                      Issue date <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={drawerIssueDate}
                      onChange={(e) => setDrawerIssueDate(e.target.value)}
                      required
                      className="w-full px-3.5 py-2 rounded-[6px] border border-[#D5E0EA] dark:border-[#1E364A] bg-white dark:bg-[#10212E] text-[#10212E] dark:text-white"
                    />
                  </div>

                  {requiresExpiry ? (
                    <div className="space-y-1">
                      <label className="block text-[13px] font-medium text-[#10212E] dark:text-white">
                        Expiry date <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={drawerExpiryDate}
                        onChange={(e) => setDrawerExpiryDate(e.target.value)}
                        required
                        className="w-full px-3.5 py-2 rounded-[6px] border border-[#D5E0EA] dark:border-[#1E364A] bg-white dark:bg-[#10212E] text-[#10212E] dark:text-white"
                      />
                    </div>
                  ) : (
                    <div className="space-y-1 flex flex-col justify-end">
                      <div className="p-2.5 rounded-[6px] bg-[#EAF2FA] dark:bg-[#1E364A] border border-[#BDE0FE] dark:border-[#2C4D63] text-[12px] font-medium text-[#1F5F99] dark:text-[#38BDF8] flex items-center gap-1.5">
                        <span>♾️ Does not expire (Perpetual document)</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* File Upload Drop Zone */}
                <div className="space-y-1">
                  <label className="block text-[13px] font-medium text-[#10212E] dark:text-white">
                    Select file (PDF, PNG, JPG, max 10 MB)
                  </label>

                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileChange}
                    className="hidden"
                    accept=".pdf,.png,.jpg,.jpeg,.doc,.docx"
                  />

                  <div
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDragOver(true);
                    }}
                    onDragLeave={() => setIsDragOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDragOver(false);
                      const file = e.dataTransfer.files?.[0];
                      if (file) {
                        processSelectedFile(file);
                      }
                    }}
                    onClick={() => {
                      fileInputRef.current?.click();
                    }}
                    className={`p-6 border-2 border-dashed rounded-[8px] text-center cursor-pointer transition-colors ${
                      isDragOver
                        ? 'border-[#1F5F99] bg-[#EAF2FA]'
                        : isFileUploaded
                        ? 'border-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/20'
                        : 'border-[#D5E0EA] dark:border-[#1E364A] hover:border-[#1F5F99]'
                    }`}
                  >
                    {isFileUploaded ? (
                      <div className="space-y-1 text-emerald-800 dark:text-emerald-300">
                        <FileCheck className="w-8 h-8 text-emerald-600 dark:text-emerald-400 mx-auto" />
                        <p className="font-semibold">{drawerFileName || 'Certificate_Attached.pdf'}</p>
                        <p className="text-[12px] opacity-75">{drawerFileSize || '1.8 MB'} · Click or drag to replace file</p>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        <Upload className="w-8 h-8 text-[#1F5F99] dark:text-[#38BDF8] mx-auto" />
                        <p className="font-semibold text-[#10212E] dark:text-white">
                          Click to select or drag & drop certificate
                        </p>
                        <p className="text-[12px] text-[#6B7A87]">
                          PDF, PNG or JPG up to 10 MB.
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {/* Certified Copy Checkbox */}
                <div className="p-4 rounded-[8px] bg-[#F7FAFD] dark:bg-[#182C3A] border border-[#D5E0EA] dark:border-[#1E364A] space-y-3">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={drawerCertifiedCopy}
                      onChange={(e) => setDrawerCertifiedCopy(e.target.checked)}
                      className="w-4 h-4 text-[#1F5F99] rounded border-[#D5E0EA] focus:ring-[#1F5F99]"
                    />
                    <span className="font-medium text-[#10212E] dark:text-white text-[13px]">
                      This is a certified true copy
                    </span>
                  </label>

                  {drawerCertifiedCopy && (
                    <div className="space-y-1 pt-1">
                      <label className="block text-[12px] text-[#6B7A87]">
                        Date certified by Commissioner of Oaths / Police
                      </label>
                      <input
                        type="date"
                        value={drawerCertificationDate}
                        onChange={(e) => setDrawerCertificationDate(e.target.value)}
                        className="w-full px-3 py-1.5 rounded-[6px] border border-[#D5E0EA] dark:border-[#1E364A] bg-white dark:bg-[#10212E] text-[13px] text-[#10212E] dark:text-white"
                      />
                    </div>
                  )}
                </div>


              </form>
            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-[#D5E0EA] dark:border-[#1E364A]">
              <button
                type="button"
                onClick={() => setIsUploadDrawerOpen(false)}
                className="px-4 py-2 border border-[#D5E0EA] dark:border-[#1E364A] hover:bg-[#F7FAFD] dark:hover:bg-[#182C3A] text-[#10212E] dark:text-white rounded-[6px] text-[13px] font-medium cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                form="drawer-form"
                className="px-5 py-2 bg-[#1F5F99] hover:bg-[#184c7a] text-white rounded-[6px] text-[13px] font-medium cursor-pointer transition-colors"
              >
                Save document to vault
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= PREVIEW MODAL ================= */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 overflow-hidden bg-black/60 flex items-center justify-center p-4">
          <div className="w-full max-w-3xl bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 space-y-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-[#D5E0EA] dark:border-[#1E364A]">
              <div>
                <h3 className="font-heading font-semibold text-[18px] text-[#10212E] dark:text-white flex items-center gap-2">
                  <span>{previewDoc.documentType}</span>
                  <span className="text-[11px] px-2 py-0.5 bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 rounded font-medium">
                    {previewDoc.status}
                  </span>
                </h3>
                <p className="text-[13px] text-[#6B7A87]">
                  Document #{previewDoc.documentNumber} · File: {previewDoc.fileName}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                className="p-1.5 text-[#6B7A87] hover:text-[#10212E] dark:hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Document Viewer Screen */}
            <div className="p-6 rounded-[8px] bg-[#F7FAFD] dark:bg-[#182C3A] border border-[#D5E0EA] dark:border-[#1E364A] space-y-4">
              <div className="flex items-center justify-between border-b border-[#D5E0EA] dark:border-[#1E364A] pb-3">
                <div className="flex items-center gap-2 text-[13px] font-semibold text-[#10212E] dark:text-white">
                  <FileCheck className="w-4 h-4 text-[#1F5F99] dark:text-[#38BDF8]" />
                  <span>Secure Document Viewer & Metadata</span>
                </div>
                <span className="text-[12px] text-[#6B7A87]">
                  {previewDoc.fileSize} · Verified Secure Vault
                </span>
              </div>

              {/* Simulated Document Page Rendering */}
              <div className="p-8 bg-white dark:bg-[#10212E] rounded-[8px] border border-[#D5E0EA] dark:border-[#1E364A] shadow-inner space-y-4 text-center">
                <div className="w-16 h-16 mx-auto rounded-full bg-[#EAF2FA] dark:bg-[#1E364A] flex items-center justify-center text-[#1F5F99] dark:text-[#38BDF8] font-bold text-lg">
                  PDF
                </div>
                <div>
                  <h4 className="font-semibold text-[16px] text-[#10212E] dark:text-white">
                    {previewDoc.fileName}
                  </h4>
                  <p className="text-[13px] text-[#6B7A87] mt-0.5">
                    Official Regulatory Filing / Identity Document
                  </p>
                </div>
                <div className="pt-2 flex flex-wrap justify-center gap-6 text-[13px] text-[#43525F] dark:text-[#B2C3D2]">
                  <div><span className="text-[#6B7A87]">Document Number:</span> <strong>{previewDoc.documentNumber}</strong></div>
                  <div><span className="text-[#6B7A87]">Issue Date:</span> <strong>{previewDoc.issueDate || 'N/A'}</strong></div>
                  <div><span className="text-[#6B7A87]">Expiry Date:</span> <strong>{previewDoc.expiryDate || 'N/A'}</strong></div>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  const blob = new Blob([`Mock document content for ${previewDoc.fileName}\nDoc#: ${previewDoc.documentNumber}\nIssued: ${previewDoc.issueDate}`], { type: 'text/plain' });
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = previewDoc.fileName;
                  a.click();
                  URL.revokeObjectURL(url);
                  showToast(`Downloaded ${previewDoc.fileName} successfully.`);
                }}
                className="px-4 py-2 bg-[#1F5F99] hover:bg-[#184c7a] text-white rounded-[6px] text-[13px] font-medium inline-flex items-center gap-2 cursor-pointer transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Download Document</span>
              </button>

              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                className="px-4 py-2 border border-[#D5E0EA] dark:border-[#1E364A] text-[#10212E] dark:text-white rounded-[6px] text-[13px] font-medium cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Document Row Component
interface DocumentRowProps {
  title: string;
  whyNeeded: string;
  note?: string;
  doc?: SupplierDocument;
  onUpload: () => void;
  onReplace: () => void;
  onView: () => void;
  onDelete: () => void;
}

const DocumentRow: React.FC<DocumentRowProps> = ({
  title,
  whyNeeded,
  note,
  doc,
  onUpload,
  onReplace,
  onView,
  onDelete,
}) => {
  const statusInfo = useMemo(() => {
    if (!doc) {
      return {
        label: 'Missing',
        chipClass: 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border border-slate-200 dark:border-slate-700',
      };
    }
    if (doc.status === 'Rejected') {
      return {
        label: 'Rejected',
        chipClass: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800',
      };
    }
    if (doc.status === 'Cannot verify') {
      return {
        label: 'Cannot verify',
        chipClass: 'bg-purple-100 text-purple-800 dark:bg-purple-950/60 dark:text-purple-300 border border-purple-200 dark:border-purple-800',
      };
    }
    if (doc.expiryDate) {
      try {
        const exp = new Date(doc.expiryDate);
        const now = new Date('2026-10-05');
        if (!isNaN(exp.getTime())) {
          if (exp < now) {
            return {
              label: 'Expired',
              chipClass: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800',
            };
          }
          const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          if (diffDays <= 90) {
            return {
              label: `Expiring soon (${diffDays}d)`,
              chipClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800',
            };
          }
        }
      } catch {}
    }
    if (doc.status === 'Verified') {
      return {
        label: 'Verified',
        chipClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800',
      };
    }
    return {
      label: 'Pending review',
      chipClass: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800',
    };
  }, [doc]);

  return (
    <div className="p-4 sm:p-5 rounded-[8px] border border-[#D5E0EA] dark:border-[#1E364A] bg-[#F7FAFD] dark:bg-[#182C3A]/50 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-heading font-semibold text-[16px] text-[#10212E] dark:text-white">
              {title}
            </h3>
            <span className={`text-[12px] px-2.5 py-0.5 rounded-[4px] font-medium ${statusInfo.chipClass}`}>
              {statusInfo.label}
            </span>
            {doc?.certifiedCopy && (
              <span className="text-[11px] px-2 py-0.5 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 rounded font-medium">
                Certified copy
              </span>
            )}
          </div>
          <p className="text-[13px] text-[#43525F] dark:text-[#B2C3D2]">
            {whyNeeded}
          </p>
          {note && (
            <span className="text-[12px] text-[#6B7A87] italic block">
              Note: {note}
            </span>
          )}
          {doc?.expiryDate && (
            <div className="text-[12px] text-[#6B7A87] flex items-center gap-1.5 pt-0.5">
              <Calendar className="w-3.5 h-3.5" />
              <span>Expiry date: {doc.expiryDate}</span>
              {doc.documentNumber && <span>· Doc #{doc.documentNumber}</span>}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {doc ? (
            <>
              <button
                type="button"
                onClick={onView}
                className="px-3 py-1.5 border border-[#D5E0EA] dark:border-[#1E364A] hover:bg-white dark:hover:bg-[#10212E] text-[#10212E] dark:text-white rounded-[6px] text-[13px] font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>View</span>
              </button>
              <button
                type="button"
                onClick={onReplace}
                className="px-3 py-1.5 bg-[#1F5F99] hover:bg-[#184c7a] text-white rounded-[6px] text-[13px] font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Replace</span>
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-[6px] cursor-pointer"
                title="Remove document"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onUpload}
              className="px-3.5 py-1.5 bg-[#1F5F99] hover:bg-[#184c7a] text-white rounded-[6px] text-[13px] font-medium inline-flex items-center gap-1.5 cursor-pointer transition-colors"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload</span>
            </button>
          )}
        </div>
      </div>

      {doc?.status === 'Rejected' && doc.rejectionReason && (
        <div className="p-3 rounded-[6px] bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-[12px] text-rose-800 dark:text-rose-300 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-600" />
          <div>
            <strong>Rejection reason:</strong> {doc.rejectionReason}
          </div>
        </div>
      )}
    </div>
  );
};

// Preference Row Component
interface PreferenceRowProps {
  title: string;
  whyNeeded: string;
  isClaimed: boolean;
  doc?: SupplierDocument;
  onUpload: () => void;
  onReplace: () => void;
  onView: () => void;
  onDelete: () => void;
}

const PreferenceRow: React.FC<PreferenceRowProps> = ({
  title,
  whyNeeded,
  isClaimed,
  doc,
  onUpload,
  onReplace,
  onView,
  onDelete,
}) => {
  const prefStatus = useMemo(() => {
    if (!isClaimed) {
      return {
        label: 'Not claimed',
        chipClass: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border border-slate-200 dark:border-slate-700',
      };
    }
    if (!doc) {
      return {
        label: 'Claimed (evidence missing)',
        chipClass: 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border border-amber-200 dark:border-amber-800',
      };
    }
    if (doc.status === 'Verified') {
      return {
        label: 'Verified',
        chipClass: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800',
      };
    }
    if (doc.status === 'Rejected') {
      return {
        label: 'Rejected',
        chipClass: 'bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border border-rose-200 dark:border-rose-800',
      };
    }
    return {
      label: 'Pending review',
      chipClass: 'bg-blue-100 text-blue-800 dark:bg-blue-950/60 dark:text-blue-300 border border-blue-200 dark:border-blue-800',
    };
  }, [isClaimed, doc]);

  return (
    <div className="p-4 sm:p-5 rounded-[8px] border border-[#D5E0EA] dark:border-[#1E364A] bg-[#F7FAFD] dark:bg-[#182C3A]/50 space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-heading font-semibold text-[16px] text-[#10212E] dark:text-white">
              {title}
            </h3>
            <span className={`text-[12px] px-2.5 py-0.5 rounded-[4px] font-medium ${prefStatus.chipClass}`}>
              {prefStatus.label}
            </span>
          </div>
          <p className="text-[13px] text-[#43525F] dark:text-[#B2C3D2]">
            {whyNeeded}
          </p>
          <span className="text-[12px] text-[#6B7A87] italic block">
            Each buyer decides how to use these claims.
          </span>
          {doc?.expiryDate && (
            <div className="text-[12px] text-[#6B7A87] flex items-center gap-1.5 pt-0.5">
              <Calendar className="w-3.5 h-3.5" />
              <span>Expiry date: {doc.expiryDate}</span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 shrink-0 flex-wrap">
          {doc ? (
            <>
              <button
                type="button"
                onClick={onView}
                className="px-3 py-1.5 border border-[#D5E0EA] dark:border-[#1E364A] hover:bg-white dark:hover:bg-[#10212E] text-[#10212E] dark:text-white rounded-[6px] text-[13px] font-medium inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Eye className="w-3.5 h-3.5" />
                <span>View</span>
              </button>
              <button
                type="button"
                onClick={onReplace}
                className="px-3 py-1.5 bg-[#1F5F99] hover:bg-[#184c7a] text-white rounded-[6px] text-[13px] font-medium inline-flex items-center gap-1.5 cursor-pointer"
              >
                <RotateCw className="w-3.5 h-3.5" />
                <span>Replace</span>
              </button>
              <button
                type="button"
                onClick={onDelete}
                className="p-1.5 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-[6px] cursor-pointer"
                title="Remove evidence"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={onUpload}
              className="px-3.5 py-1.5 bg-[#1F5F99] hover:bg-[#184c7a] text-white rounded-[6px] text-[13px] font-medium inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>Upload evidence</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// Interactive Switch Card
interface SwitchCardProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (val: boolean) => void;
}

const SwitchCard: React.FC<SwitchCardProps> = ({
  label,
  description,
  checked,
  onChange,
}) => {
  return (
    <div className="p-4 rounded-[8px] border border-[#D5E0EA] dark:border-[#1E364A] bg-[#F7FAFD] dark:bg-[#182C3A]/40 flex items-center justify-between gap-3">
      <div className="space-y-0.5">
        <span className="font-semibold text-[14px] text-[#10212E] dark:text-white block">
          {label}
        </span>
        <p className="text-[12px] text-[#6B7A87]">
          {description}
        </p>
      </div>

      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 shrink-0 cursor-pointer ${
          checked ? 'bg-[#1F5F99] dark:bg-[#38BDF8]' : 'bg-[#D5E0EA] dark:bg-[#1E364A]'
        }`}
      >
        <div
          className={`w-4 h-4 rounded-full bg-white transition-transform duration-200 ${
            checked ? 'translate-x-5' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
};
