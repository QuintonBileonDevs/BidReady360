import React, { useState, useMemo } from 'react';
import { useApp } from '../../context/AppContext';
import { SupplierDocument, DocumentVersion } from '../../mockData';
import { StatusChip } from '../common/StatusChip';
import {
  FileText,
  Upload,
  Download,
  Eye,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  X,
  Search,
  History,
  MoreVertical,
  ShieldAlert,
  Clock,
  Info,
  ChevronRight,
  FileCheck,
  RotateCw,
} from 'lucide-react';

type FilterCategory = 'ALL' | 'VALID' | 'EXPIRING' | 'EXPIRED' | 'PENDING';

interface ExtractedFieldValues {
  documentNumber: string;
  issueDate: string;
  expiryDate: string;
  authorityName: string;
  pinNumber: string;
}

const USUAL_CHECKLIST_DOCUMENTS: {
  type: SupplierDocument['documentType'];
  title: string;
  description: string;
  validityNote: string;
}[] = [
  {
    type: 'BURS Tax Clearance Certificate',
    title: 'BURS tax clearance certificate',
    description: 'Mandatory certificate evidencing statutory tax standing with Botswana Unified Revenue Service.',
    validityNote: 'Valid for 12 months from date of issue',
  },
  {
    type: 'PPRA Registration Certificate',
    title: 'PPRA registration certificate',
    description: 'Contractor grading and registered supply discipline codes issued by the Public Procurement Regulatory Authority.',
    validityNote: 'Valid for 24 months',
  },
  {
    type: 'CIPA Certificate of Incorporation',
    title: 'CIPA certificate of incorporation',
    description: 'Official corporate registration certificate establishing legal identity and UIN under the Companies Act.',
    validityNote: 'Perpetual corporate identity',
  },
  {
    type: 'Workers Compensation & Safety Compliance',
    title: 'Workers compensation and safety compliance',
    description: 'Statutory occupational health and safety insurance cover covering all direct and contracted personnel.',
    validityNote: 'Annual renewal required',
  },
  {
    type: 'Public Liability Insurance Policy',
    title: 'Public liability insurance policy',
    description: 'Third-party indemnity cover to satisfy minimum contract performance guarantees across Botswana.',
    validityNote: 'Annual renewal required',
  },
  {
    type: 'Audited Financial Statements',
    title: 'Audited financial statements',
    description: 'Most recent certified annual financial report signed by a registered chartered accountant.',
    validityNote: 'Submitted annually for financial threshold grading',
  },
];

export const SupplierVault: React.FC = () => {
  const { documents, uploadDocument, replaceDocument, supplier, addAuditEvent } = useApp();

  const [filterCategory, setFilterCategory] = useState<FilterCategory>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Drawers & Modals state
  const [isUploadDrawerOpen, setIsUploadDrawerOpen] = useState(false);
  const [replacingDoc, setReplacingDoc] = useState<SupplierDocument | null>(null);
  const [previewDoc, setPreviewDoc] = useState<SupplierDocument | null>(null);
  const [versionHistoryDoc, setVersionHistoryDoc] = useState<SupplierDocument | null>(null);
  const [openActionMenuId, setOpenActionMenuId] = useState<string | null>(null);

  // Demo empty state toggle
  const [showDemoEmptyState, setShowDemoEmptyState] = useState(false);

  // Upload Drawer Form State
  const [drawerDocType, setDrawerDocType] = useState<SupplierDocument['documentType']>(
    'BURS Tax Clearance Certificate'
  );
  const [drawerFileName, setDrawerFileName] = useState('');
  const [drawerFileSize, setDrawerFileSize] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [isFileUploaded, setIsFileUploaded] = useState(false);

  // "Fields we read from your document" state
  const [extractedFields, setExtractedFields] = useState<ExtractedFieldValues>({
    documentNumber: '',
    issueDate: '2026-10-01',
    expiryDate: '2027-09-30',
    authorityName: 'Botswana Unified Revenue Service',
    pinNumber: supplier.tinNumber || 'C12894002',
  });

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 5000);
  };

  // Helper: calculate days remaining from reference date (5 Oct 2026)
  const getDaysLeft = (expiryDateStr: string): number => {
    try {
      const target = new Date(expiryDateStr).getTime();
      const ref = new Date('2026-10-05').getTime();
      return Math.round((target - ref) / (1000 * 60 * 60 * 24));
    } catch {
      return 0;
    }
  };

  // Summary strip metrics
  const activeDocsList = showDemoEmptyState ? [] : documents;

  const validCount = useMemo(() => {
    return activeDocsList.filter((d) => {
      const days = getDaysLeft(d.expiryDate);
      return d.status === 'Verified' && days > 0;
    }).length;
  }, [activeDocsList]);

  const expiringWithin90Count = useMemo(() => {
    return activeDocsList.filter((d) => {
      const days = getDaysLeft(d.expiryDate);
      return days >= 0 && days <= 90 && d.status !== 'Expired';
    }).length;
  }, [activeDocsList]);

  const expiredCount = useMemo(() => {
    return activeDocsList.filter((d) => {
      const days = getDaysLeft(d.expiryDate);
      return d.status === 'Expired' || days < 0;
    }).length;
  }, [activeDocsList]);

  const pendingCount = useMemo(() => {
    return activeDocsList.filter((d) => d.status === 'Pending').length;
  }, [activeDocsList]);

  // Filtered documents
  const filteredDocs = useMemo(() => {
    return activeDocsList.filter((d) => {
      const matchesSearch =
        d.documentType.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.documentNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.fileName.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      const days = getDaysLeft(d.expiryDate);

      if (filterCategory === 'VALID') {
        return d.status === 'Verified' && days > 0;
      }
      if (filterCategory === 'EXPIRING') {
        return days >= 0 && days <= 90 && d.status !== 'Expired';
      }
      if (filterCategory === 'EXPIRED') {
        return d.status === 'Expired' || days < 0;
      }
      if (filterCategory === 'PENDING') {
        return d.status === 'Pending';
      }
      return true;
    });
  }, [activeDocsList, searchQuery, filterCategory]);

  // Open drawer in fresh upload mode
  const handleOpenUploadDrawer = (preselectedType?: SupplierDocument['documentType']) => {
    setReplacingDoc(null);
    const selected = preselectedType || 'BURS Tax Clearance Certificate';
    setDrawerDocType(selected);
    setDrawerFileName('');
    setDrawerFileSize('');
    setIsFileUploaded(false);
    setExtractedFields({
      documentNumber: `CERT-${Date.now().toString().slice(-6)}`,
      issueDate: '2026-10-01',
      expiryDate: selected === 'CIPA Certificate of Incorporation' ? '2030-12-31' : '2027-09-30',
      authorityName: getAuthorityForType(selected),
      pinNumber: supplier.tinNumber || 'C12894002',
    });
    setIsUploadDrawerOpen(true);
  };

  // Open drawer in replace mode (e.g. for expired or rejected document)
  const handleOpenReplaceDrawer = (doc: SupplierDocument) => {
    setReplacingDoc(doc);
    setDrawerDocType(doc.documentType);
    setDrawerFileName(`Renewed_${doc.fileName}`);
    setDrawerFileSize('1.8 MB');
    setIsFileUploaded(true);
    setExtractedFields({
      documentNumber: `${doc.documentNumber}-R26`,
      issueDate: '2026-10-01',
      expiryDate: '2027-09-30',
      authorityName: getAuthorityForType(doc.documentType),
      pinNumber: supplier.tinNumber || 'C12894002',
    });
    setIsUploadDrawerOpen(true);
  };

  const getAuthorityForType = (type: SupplierDocument['documentType']): string => {
    switch (type) {
      case 'BURS Tax Clearance Certificate':
        return 'Botswana Unified Revenue Service';
      case 'PPRA Registration Certificate':
        return 'Public Procurement Regulatory Authority';
      case 'CIPA Certificate of Incorporation':
        return 'Companies and Intellectual Property Authority';
      case 'Workers Compensation & Safety Compliance':
        return 'Department of Occupational Health & Safety';
      case 'Public Liability Insurance Policy':
        return 'Botswana Insurance Company (BIC)';
      case 'Audited Financial Statements':
        return 'Registered Public Accounting Firm';
      case 'Bank Rating Letter':
        return 'First National Bank of Botswana';
      default:
        return 'Statutory Regulatory Authority';
    }
  };

  // Simulate file selection/drop
  const handleSimulateFileSelect = (name: string, size: string) => {
    setDrawerFileName(name);
    setDrawerFileSize(size);
    setIsFileUploaded(true);
  };

  // Submit Upload or Replacement
  const handleSaveDrawerDocument = (e: React.FormEvent) => {
    e.preventDefault();

    if (!extractedFields.documentNumber || !extractedFields.issueDate) {
      alert('Please fill out the required certificate fields.');
      return;
    }

    const finalFileName =
      drawerFileName || `${drawerDocType.replace(/\s+/g, '_')}_2026.pdf`;
    const finalFileSize = drawerFileSize || '1.7 MB';

    if (replacingDoc) {
      // Replace existing document
      replaceDocument(replacingDoc.id, {
        documentNumber: extractedFields.documentNumber,
        fileName: finalFileName,
        fileSize: finalFileSize,
        issueDate: extractedFields.issueDate,
        expiryDate: extractedFields.expiryDate,
        status: 'Pending',
        statusMessage: 'Pending verification by procurement registry officers.',
        rejectionReason: undefined,
      });

      addAuditEvent({
        action: 'Document Replaced in Vault',
        actorName: 'Kagiso Molosiwa (Supplier admin)',
        actorRole: 'Supplier',
        organizationName: supplier.legalName,
        entityType: 'Document',
        entityId: replacingDoc.id,
        details: `Replaced ${replacingDoc.documentType} with new copy (File: ${finalFileName}). Submitted for verification.`,
        ipAddress: '168.167.23.41',
      });

      showToast(`Replacement uploaded for ${replacingDoc.documentType}. Submitted for verification.`);
    } else {
      // Upload new document
      uploadDocument({
        supplierId: supplier.id,
        documentType: drawerDocType,
        documentNumber: extractedFields.documentNumber,
        fileName: finalFileName,
        fileSize: finalFileSize,
        issueDate: extractedFields.issueDate,
        expiryDate: extractedFields.expiryDate,
        status: 'Pending',
        statusMessage: 'Pending verification by procurement registry officers.',
        downloadUrl: '#',
        versionHistory: [
          {
            version: 1,
            uploadedBy: 'Kagiso Molosiwa (Supplier admin)',
            uploadedAt: '5 Oct 2026, 14:30',
            fileFingerprint: `SHA-256: ${Math.random().toString(36).substring(2, 8)}...${Math.random().toString(36).substring(2, 6)}`,
            fileName: finalFileName,
            fileSize: finalFileSize,
            usedInApplications: [],
          },
        ],
        extractedFields: {
          'Document number': extractedFields.documentNumber,
          'Issuing authority': extractedFields.authorityName,
          'Issue date': extractedFields.issueDate,
          'Valid through': extractedFields.expiryDate,
        },
      });

      addAuditEvent({
        action: 'New Document Uploaded to Vault',
        actorName: 'Kagiso Molosiwa (Supplier admin)',
        actorRole: 'Supplier',
        organizationName: supplier.legalName,
        entityType: 'Document',
        entityId: `doc-${Date.now()}`,
        details: `Uploaded ${drawerDocType} (Doc #${extractedFields.documentNumber}). Submitted for verification.`,
        ipAddress: '168.167.23.41',
      });

      showToast(`Uploaded ${drawerDocType} to vault. Submitted for verification.`);
    }

    setIsUploadDrawerOpen(false);
    setReplacingDoc(null);
  };

  // Mock download
  const handleDownload = (doc: SupplierDocument) => {
    addAuditEvent({
      action: 'Document Downloaded from Vault',
      actorName: 'Kagiso Molosiwa (Supplier admin)',
      actorRole: 'Supplier',
      organizationName: supplier.legalName,
      entityType: 'Document',
      entityId: doc.id,
      details: `Downloaded ${doc.fileName} (${doc.documentType}).`,
      ipAddress: '168.167.23.41',
    });
    showToast(`Downloading ${doc.fileName}...`);
  };

  // Check if expiry date is required for a type
  const isExpiryRequired = (type: SupplierDocument['documentType']): boolean => {
    return type !== 'CIPA Certificate of Incorporation';
  };

  return (
    <div className="space-y-8">
      {/* 1. Page Header with Single Primary Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#D5E0EA] dark:border-[#1E364A]">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-semibold text-[#1F5F99] bg-[#EAF2FA] dark:bg-[#1E364A] dark:text-[#6FAEE0] px-3 py-1 rounded-[4px]">
              Compliance vault
            </span>
            <span className="text-[14px] text-[#6B7A87]">· Reusable for all public tenders</span>
          </div>
          <h1 className="font-heading font-semibold text-[30px] leading-tight text-[#10212E] dark:text-white">
            Document vault
          </h1>
          <p className="text-[15px] text-[#43525F] dark:text-[#B2C3D2]">
            Store statutory certificates once. Share verified credentials securely across Botswana buying organizations.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0 flex-wrap">
          <button
            type="button"
            onClick={() => setShowDemoEmptyState(!showDemoEmptyState)}
            className="px-3.5 py-2.5 border border-[#D5E0EA] dark:border-[#1E364A] bg-white dark:bg-[#132635] text-[#43525F] dark:text-[#B2C3D2] hover:bg-[#F7FAFD] dark:hover:bg-[#10212E] rounded-[6px] text-[14px] font-medium transition-colors cursor-pointer"
            title="Toggle between populated vault and new supplier onboarding checklist"
          >
            {showDemoEmptyState ? 'Show populated vault' : 'Preview new supplier checklist'}
          </button>

          {/* Primary Action Button in Pula Deep */}
          <button
            type="button"
            onClick={() => handleOpenUploadDrawer()}
            className="px-5 py-2.5 bg-[#1F5F99] hover:bg-[#184c7a] text-white rounded-[6px] text-[14px] font-medium inline-flex items-center gap-2 cursor-pointer transition-colors"
          >
            <Upload className="w-4 h-4" />
            <span>Upload document</span>
          </button>
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
            className="text-[#065F46] hover:opacity-75 text-[14px] cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* 2. Summary Strip with Four Clickable Counts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Valid */}
        <button
          type="button"
          onClick={() => setFilterCategory(filterCategory === 'VALID' ? 'ALL' : 'VALID')}
          className={`bg-white dark:bg-[#132635] rounded-[12px] border p-5 space-y-1.5 text-left transition-all cursor-pointer ${
            filterCategory === 'VALID'
              ? 'border-[#1F5F99] ring-2 ring-[#1F5F99]/20'
              : 'border-[#D5E0EA] dark:border-[#1E364A] hover:border-[#1F5F99]/60'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[14px] text-[#6B7A87]">Valid</span>
            {filterCategory === 'VALID' && (
              <span className="text-[14px] font-medium text-[#1F5F99]">Active filter</span>
            )}
          </div>
          <div className="font-heading font-semibold text-[28px] text-[#10212E] dark:text-white tabular-nums">
            {validCount}
          </div>
          <span className="text-[14px] text-[#43525F] dark:text-[#B2C3D2] block">
            Approved and active certificates
          </span>
        </button>

        {/* Expiring within 90 days */}
        <button
          type="button"
          onClick={() => setFilterCategory(filterCategory === 'EXPIRING' ? 'ALL' : 'EXPIRING')}
          className={`bg-white dark:bg-[#132635] rounded-[12px] border p-5 space-y-1.5 text-left transition-all cursor-pointer ${
            filterCategory === 'EXPIRING'
              ? 'border-[#1F5F99] ring-2 ring-[#1F5F99]/20'
              : 'border-[#D5E0EA] dark:border-[#1E364A] hover:border-[#1F5F99]/60'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[14px] text-[#6B7A87]">Expiring within 90 days</span>
            {filterCategory === 'EXPIRING' && (
              <span className="text-[14px] font-medium text-[#1F5F99]">Active filter</span>
            )}
          </div>
          <div className="font-heading font-semibold text-[28px] text-[#10212E] dark:text-white tabular-nums">
            {expiringWithin90Count}
          </div>
          <span className="text-[14px] text-[#43525F] dark:text-[#B2C3D2] block">
            Initiate renewal with issuer
          </span>
        </button>

        {/* Expired */}
        <button
          type="button"
          onClick={() => setFilterCategory(filterCategory === 'EXPIRED' ? 'ALL' : 'EXPIRED')}
          className={`bg-white dark:bg-[#132635] rounded-[12px] border p-5 space-y-1.5 text-left transition-all cursor-pointer ${
            filterCategory === 'EXPIRED'
              ? 'border-[#1F5F99] ring-2 ring-[#1F5F99]/20'
              : 'border-[#D5E0EA] dark:border-[#1E364A] hover:border-[#1F5F99]/60'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[14px] text-[#6B7A87]">Expired</span>
            {filterCategory === 'EXPIRED' && (
              <span className="text-[14px] font-medium text-[#1F5F99]">Active filter</span>
            )}
          </div>
          <div className="font-heading font-semibold text-[28px] text-[#10212E] dark:text-white tabular-nums">
            {expiredCount}
          </div>
          <span className="text-[14px] text-[#43525F] dark:text-[#B2C3D2] block">
            Upload renewed copy
          </span>
        </button>

        {/* Pending verification */}
        <button
          type="button"
          onClick={() => setFilterCategory(filterCategory === 'PENDING' ? 'ALL' : 'PENDING')}
          className={`bg-white dark:bg-[#132635] rounded-[12px] border p-5 space-y-1.5 text-left transition-all cursor-pointer ${
            filterCategory === 'PENDING'
              ? 'border-[#1F5F99] ring-2 ring-[#1F5F99]/20'
              : 'border-[#D5E0EA] dark:border-[#1E364A] hover:border-[#1F5F99]/60'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-[14px] text-[#6B7A87]">Pending verification</span>
            {filterCategory === 'PENDING' && (
              <span className="text-[14px] font-medium text-[#1F5F99]">Active filter</span>
            )}
          </div>
          <div className="font-heading font-semibold text-[28px] text-[#10212E] dark:text-white tabular-nums">
            {pendingCount}
          </div>
          <span className="text-[14px] text-[#43525F] dark:text-[#B2C3D2] block">
            Awaiting registry review
          </span>
        </button>
      </div>

      {/* 3. Search and Active Filter Indicator */}
      <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-4 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#6B7A87]" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search documents by certificate name, registration number, or file..."
            className="w-full pl-9 pr-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] bg-[#F7FAFD] dark:bg-[#10212E] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99]"
          />
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <span className="text-[14px] text-[#6B7A87]">
            Showing {filteredDocs.length} {filteredDocs.length === 1 ? 'document' : 'documents'}
          </span>
          {filterCategory !== 'ALL' && (
            <button
              type="button"
              onClick={() => setFilterCategory('ALL')}
              className="text-[14px] text-[#1F5F99] dark:text-[#6FAEE0] hover:underline font-medium cursor-pointer ml-1"
            >
              Clear filter
            </button>
          )}
        </div>
      </div>

      {/* 4. Empty State for New Supplier (Checklist) */}
      {(showDemoEmptyState || (activeDocsList.length === 0 && filterCategory === 'ALL')) ? (
        <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-6 sm:p-8 space-y-6">
          <div className="space-y-1 pb-4 border-b border-[#D5E0EA] dark:border-[#1E364A]">
            <h2 className="font-heading font-semibold text-[22px] text-[#10212E] dark:text-white">
              Standard compliance checklist for new suppliers
            </h2>
            <p className="text-[15px] text-[#43525F] dark:text-[#B2C3D2]">
              Upload the standard statutory documents below to qualify for bidding across Botswana parastatals, councils, and government ministries.
            </p>
          </div>

          <div className="space-y-4">
            {USUAL_CHECKLIST_DOCUMENTS.map((item, index) => (
              <div
                key={item.type}
                className="p-5 rounded-[8px] border border-[#D5E0EA] dark:border-[#1E364A] bg-[#F7FAFD]/60 dark:bg-[#10212E]/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              >
                <div className="flex items-start gap-3.5">
                  <div className="w-8 h-8 rounded-full bg-[#EAF2FA] dark:bg-[#1E364A] text-[#1F5F99] dark:text-[#6FAEE0] font-heading font-semibold text-[14px] flex items-center justify-center shrink-0">
                    {index + 1}
                  </div>
                  <div className="space-y-1">
                    <h3 className="font-heading font-semibold text-[16px] text-[#10212E] dark:text-white">
                      {item.title}
                    </h3>
                    <p className="text-[14px] text-[#43525F] dark:text-[#B2C3D2]">
                      {item.description}
                    </p>
                    <span className="text-[14px] text-[#6B7A87] block">
                      Requirement note: {item.validityNote}
                    </span>
                  </div>
                </div>

                <div className="shrink-0 self-start sm:self-center">
                  <button
                    type="button"
                    onClick={() => handleOpenUploadDrawer(item.type)}
                    className="px-4 py-2 bg-[#1F5F99] hover:bg-[#184c7a] text-white text-[14px] font-medium rounded-[6px] inline-flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Upload className="w-4 h-4" />
                    <span>Upload</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : filteredDocs.length === 0 ? (
        /* Filter returned 0 documents */
        <div className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-12 text-center space-y-3">
          <FileText className="w-10 h-10 text-[#6B7A87] mx-auto" />
          <h3 className="font-heading font-semibold text-[18px] text-[#10212E] dark:text-white">
            No documents matching filter
          </h3>
          <p className="text-[14px] text-[#43525F] dark:text-[#B2C3D2] max-w-md mx-auto">
            No documents matched your search query or selected status filter.
          </p>
          <button
            type="button"
            onClick={() => {
              setFilterCategory('ALL');
              setSearchQuery('');
            }}
            className="px-4 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] font-medium text-[#10212E] dark:text-white hover:bg-[#F7FAFD] dark:hover:bg-[#10212E] cursor-pointer"
          >
            Show all documents
          </button>
        </div>
      ) : (
        /* 5. Document List: Desktop Table & Mobile Cards */
        <div className="space-y-4">
          {/* Desktop Table View */}
          <div className="hidden md:block bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] overflow-visible">
            <table className="w-full text-left text-[14px] divide-y divide-[#D5E0EA] dark:divide-[#1E364A]">
              <thead className="bg-[#F7FAFD] dark:bg-[#10212E] text-[#6B7A87] font-medium">
                <tr>
                  <th className="p-4">Document name</th>
                  <th className="p-4">Type</th>
                  <th className="p-4">Issue date</th>
                  <th className="p-4">Expiry date & days left</th>
                  <th className="p-4">Verification</th>
                  <th className="p-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#D5E0EA] dark:divide-[#1E364A] text-[#10212E] dark:text-white">
                {filteredDocs.map((doc) => {
                  const daysLeft = getDaysLeft(doc.expiryDate);
                  const isRejected = doc.status === 'Rejected';
                  const isExpired = doc.status === 'Expired' || daysLeft < 0;

                  return (
                    <React.Fragment key={doc.id}>
                      <tr className="hover:bg-[#F7FAFD] dark:hover:bg-[#10212E] transition-colors">
                        {/* Document Name */}
                        <td className="p-4">
                          <div className="flex items-start gap-2.5">
                            <FileText className="w-4 h-4 text-[#1F5F99] dark:text-[#6FAEE0] mt-1 shrink-0" />
                            <div className="space-y-0.5">
                              <span className="font-semibold block">{doc.fileName}</span>
                              <span className="text-[14px] text-[#6B7A87] block">
                                Cert #{doc.documentNumber} · {doc.fileSize}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Type */}
                        <td className="p-4 text-[#43525F] dark:text-[#B2C3D2] font-medium">
                          {doc.documentType}
                        </td>

                        {/* Issue Date */}
                        <td className="p-4 text-[#43525F] dark:text-[#B2C3D2] tabular-nums">
                          {doc.issueDate}
                        </td>

                        {/* Expiry Date with "days left" */}
                        <td className="p-4">
                          <div className="space-y-0.5 tabular-nums">
                            <span className="font-medium block">{doc.expiryDate}</span>
                            {isExpired ? (
                              <span className="text-[14px] text-[#C2412D] block font-medium">
                                Expired {Math.abs(daysLeft)} days ago
                              </span>
                            ) : daysLeft === 0 ? (
                              <span className="text-[14px] text-[#D97706] block font-medium">
                                Expires today
                              </span>
                            ) : daysLeft <= 90 ? (
                              <span className="text-[14px] text-[#D97706] block font-medium">
                                {daysLeft} days left
                              </span>
                            ) : (
                              <span className="text-[14px] text-[#6B7A87] block">
                                {daysLeft} days left
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Verification Chip (Pending, Verified, Rejected, Cannot verify) */}
                        <td className="p-4">
                          <StatusChip
                            status={doc.status}
                            customLabel={
                              doc.status === 'Pending'
                                ? 'Pending verification'
                                : doc.status
                            }
                          />
                        </td>

                        {/* Actions Menu */}
                        <td className="p-4 text-right">
                          <div className="inline-flex items-center gap-1.5 relative">
                            <button
                              type="button"
                              onClick={() => setPreviewDoc(doc)}
                              className="px-2.5 py-1 text-[14px] font-medium text-[#43525F] dark:text-[#B2C3D2] hover:text-[#10212E] dark:hover:text-white hover:bg-[#F7FAFD] dark:hover:bg-[#10212E] rounded border border-[#D5E0EA] dark:border-[#1E364A] cursor-pointer"
                              title="View document"
                            >
                              View
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenReplaceDrawer(doc)}
                              className="px-2.5 py-1 text-[14px] font-medium text-[#1F5F99] dark:text-[#6FAEE0] hover:bg-[#EAF2FA] dark:hover:bg-[#1E364A] rounded border border-[#D5E0EA] dark:border-[#1E364A] cursor-pointer"
                              title="Replace with updated certificate"
                            >
                              Replace
                            </button>

                            <button
                              type="button"
                              onClick={() => setVersionHistoryDoc(doc)}
                              className="px-2.5 py-1 text-[14px] font-medium text-[#43525F] dark:text-[#B2C3D2] hover:text-[#10212E] hover:bg-[#F7FAFD] dark:hover:bg-[#10212E] rounded border border-[#D5E0EA] dark:border-[#1E364A] cursor-pointer inline-flex items-center gap-1"
                              title="Version history"
                            >
                              <History className="w-3.5 h-3.5" />
                              <span>History</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleDownload(doc)}
                              className="p-1.5 text-[#43525F] dark:text-[#B2C3D2] hover:text-[#10212E] hover:bg-[#F7FAFD] dark:hover:bg-[#10212E] rounded border border-[#D5E0EA] dark:border-[#1E364A] cursor-pointer"
                              title="Download document"
                            >
                              <Download className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>

                      {/* Prominent Rejected Callout row if rejected */}
                      {isRejected && (
                        <tr className="bg-[#FEF2F2]/60 dark:bg-[#7F1D1D]/10">
                          <td colSpan={6} className="px-4 py-3 border-t border-[#FCA5A5]/40">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-[14px]">
                              <div className="flex items-start gap-2.5">
                                <ShieldAlert className="w-5 h-5 text-[#C2412D] shrink-0 mt-0.5" />
                                <div className="space-y-0.5">
                                  <strong className="text-[#8E2A1B] dark:text-red-300 font-semibold">
                                    Rejection reason:
                                  </strong>
                                  <span className="text-[#8E2A1B] dark:text-red-300 ml-1">
                                    {doc.rejectionReason || 'Certificate details could not be validated with statutory authority.'}
                                  </span>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleOpenReplaceDrawer(doc)}
                                className="px-3.5 py-1.5 bg-[#C2412D] hover:bg-[#A12B1B] text-white rounded-[6px] font-medium text-[14px] inline-flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors"
                              >
                                <Upload className="w-3.5 h-3.5" />
                                <span>Upload a corrected copy</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards View */}
          <div className="block md:hidden space-y-4">
            {filteredDocs.map((doc) => {
              const daysLeft = getDaysLeft(doc.expiryDate);
              const isRejected = doc.status === 'Rejected';
              const isExpired = doc.status === 'Expired' || daysLeft < 0;

              return (
                <div
                  key={doc.id}
                  className="bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] p-5 space-y-4 text-[14px]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-[#1F5F99]" />
                        <h3 className="font-heading font-semibold text-[16px] text-[#10212E] dark:text-white">
                          {doc.fileName}
                        </h3>
                      </div>
                      <span className="text-[14px] text-[#6B7A87] block">
                        {doc.documentType}
                      </span>
                    </div>

                    <StatusChip
                      status={doc.status}
                      customLabel={
                        doc.status === 'Pending'
                          ? 'Pending verification'
                          : doc.status
                      }
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2 border-t border-[#D5E0EA] dark:border-[#1E364A] text-[14px]">
                    <div>
                      <span className="text-[#6B7A87] block">Issue date</span>
                      <span className="font-medium text-[#10212E] dark:text-white tabular-nums">
                        {doc.issueDate}
                      </span>
                    </div>

                    <div>
                      <span className="text-[#6B7A87] block">Expiry date</span>
                      <span className="font-medium text-[#10212E] dark:text-white tabular-nums">
                        {doc.expiryDate}
                      </span>
                      {isExpired ? (
                        <span className="text-[#C2412D] text-[14px] block font-medium">
                          Expired {Math.abs(daysLeft)}d ago
                        </span>
                      ) : (
                        <span className="text-[#6B7A87] text-[14px] block">
                          {daysLeft} days left
                        </span>
                      )}
                    </div>
                  </div>

                  {isRejected && (
                    <div className="p-3 bg-[#FEF2F2] text-[#8E2A1B] rounded-[8px] space-y-2 border border-[#FCA5A5]/60">
                      <div className="flex items-start gap-2">
                        <ShieldAlert className="w-4 h-4 text-[#C2412D] shrink-0 mt-0.5" />
                        <div>
                          <strong className="font-semibold">Rejection reason: </strong>
                          <span>{doc.rejectionReason}</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleOpenReplaceDrawer(doc)}
                        className="w-full py-1.5 bg-[#C2412D] text-white rounded-[6px] font-medium text-[14px] cursor-pointer"
                      >
                        Upload a corrected copy
                      </button>
                    </div>
                  )}

                  {/* Actions Bar */}
                  <div className="pt-3 border-t border-[#D5E0EA] dark:border-[#1E364A] flex items-center justify-between gap-2 flex-wrap">
                    <button
                      type="button"
                      onClick={() => setPreviewDoc(doc)}
                      className="px-3 py-1.5 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] font-medium text-[#43525F] dark:text-[#B2C3D2] text-[14px] cursor-pointer"
                    >
                      View
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenReplaceDrawer(doc)}
                      className="px-3 py-1.5 border border-[#D5E0EA] dark:border-[#1E364A] text-[#1F5F99] rounded-[6px] font-medium text-[14px] cursor-pointer"
                    >
                      Replace
                    </button>
                    <button
                      type="button"
                      onClick={() => setVersionHistoryDoc(doc)}
                      className="px-3 py-1.5 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] font-medium text-[#43525F] dark:text-[#B2C3D2] text-[14px] cursor-pointer"
                    >
                      History
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDownload(doc)}
                      className="p-1.5 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[#43525F] cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =========================================================================
          6. UPLOAD / REPLACE SLIDE-OVER DRAWER
          ========================================================================= */}
      {isUploadDrawerOpen && (
        <div className="fixed inset-0 z-50 flex justify-end">
          {/* Backdrop */}
          <div
            className="fixed inset-0 bg-[#10212E]/40 backdrop-blur-xs transition-opacity"
            onClick={() => setIsUploadDrawerOpen(false)}
          />

          {/* Drawer container */}
          <div className="relative w-full max-w-xl bg-white dark:bg-[#132635] shadow-2xl h-full flex flex-col z-10 border-l border-[#D5E0EA] dark:border-[#1E364A] overflow-y-auto">
            {/* Header */}
            <div className="p-6 border-b border-[#D5E0EA] dark:border-[#1E364A] flex items-center justify-between">
              <div>
                <h2 className="font-heading font-semibold text-[20px] text-[#10212E] dark:text-white">
                  {replacingDoc ? 'Replace document' : 'Upload document to vault'}
                </h2>
                <span className="text-[14px] text-[#6B7A87]">
                  {replacingDoc
                    ? `Uploading a new certified version for ${replacingDoc.documentType}`
                    : 'Add a statutory compliance certificate to your digital passport'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsUploadDrawerOpen(false)}
                className="p-2 rounded-full text-[#6B7A87] hover:bg-[#F7FAFD] dark:hover:bg-[#10212E] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSaveDrawerDocument} className="p-6 space-y-6 flex-1">
              {/* Document Type Select */}
              <div className="space-y-1.5">
                <label className="text-[14px] font-semibold text-[#10212E] dark:text-white block">
                  Document type *
                </label>
                <select
                  disabled={Boolean(replacingDoc)}
                  value={drawerDocType}
                  onChange={(e) => {
                    const newType = e.target.value as SupplierDocument['documentType'];
                    setDrawerDocType(newType);
                    setExtractedFields((prev) => ({
                      ...prev,
                      authorityName: getAuthorityForType(newType),
                      expiryDate: newType === 'CIPA Certificate of Incorporation' ? '2030-12-31' : '2027-09-30',
                    }));
                  }}
                  className="w-full px-3 py-2.5 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] bg-white dark:bg-[#132635] text-[#10212E] dark:text-white focus:outline-none focus:border-[#1F5F99]"
                >
                  <option value="BURS Tax Clearance Certificate">BURS Tax Clearance Certificate</option>
                  <option value="PPRA Registration Certificate">PPRA Registration Certificate</option>
                  <option value="CIPA Certificate of Incorporation">CIPA Certificate of Incorporation</option>
                  <option value="Workers Compensation & Safety Compliance">Workers Compensation & Safety Compliance</option>
                  <option value="Public Liability Insurance Policy">Public Liability Insurance Policy</option>
                  <option value="Audited Financial Statements">Audited Financial Statements</option>
                  <option value="Bank Rating Letter">Bank Rating Letter</option>
                  <option value="Trading Licence">Trading Licence</option>
                </select>
              </div>

              {/* Drag and Drop Zone + Choose File Button */}
              <div className="space-y-2">
                <label className="text-[14px] font-semibold text-[#10212E] dark:text-white block">
                  Certificate file *
                </label>
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragOver(true);
                  }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setIsDragOver(false);
                    const file = e.dataTransfer.files[0];
                    if (file) {
                      handleSimulateFileSelect(file.name, `${(file.size / (1024 * 1024)).toFixed(1)} MB`);
                    } else {
                      handleSimulateFileSelect(`${drawerDocType.replace(/\s+/g, '_')}_Uploaded.pdf`, '1.9 MB');
                    }
                  }}
                  className={`border-2 border-dashed rounded-[10px] p-6 text-center space-y-3 transition-colors ${
                    isDragOver
                      ? 'border-[#1F5F99] bg-[#EAF2FA]/50'
                      : 'border-[#D5E0EA] dark:border-[#1E364A] bg-[#F7FAFD]/40 dark:bg-[#10212E]/40'
                  }`}
                >
                  <div className="w-12 h-12 rounded-full bg-[#EAF2FA] dark:bg-[#1E364A] text-[#1F5F99] dark:text-[#6FAEE0] flex items-center justify-center mx-auto">
                    <Upload className="w-6 h-6" />
                  </div>
                  <div>
                    <span className="font-semibold text-[14px] text-[#10212E] dark:text-white block">
                      Drag and drop your certificate here
                    </span>
                    <span className="text-[14px] text-[#6B7A87]">or choose a file from your device</span>
                  </div>

                  <div>
                    <button
                      type="button"
                      onClick={() =>
                        handleSimulateFileSelect(
                          `${drawerDocType.replace(/\s+/g, '_')}_Scanned_Copy.pdf`,
                          '2.1 MB'
                        )
                      }
                      className="px-4 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] font-medium bg-white dark:bg-[#132635] text-[#10212E] dark:text-white hover:bg-[#F7FAFD] cursor-pointer"
                    >
                      Choose file
                    </button>
                  </div>
                </div>

                {/* File Check Limits Notice */}
                <div className="flex items-center gap-2 text-[14px] text-[#6B7A87]">
                  <Info className="w-4 h-4 text-[#1F5F99] shrink-0" />
                  <span>Accepted formats: PDF, PNG, JPG (maximum 15 MB). Scanned copies must be clear and legible.</span>
                </div>

                {isFileUploaded && drawerFileName && (
                  <div className="p-3 rounded-[8px] bg-[#ECFDF5] border border-[#A7F3D0] flex items-center justify-between text-[14px]">
                    <div className="flex items-center gap-2">
                      <FileCheck className="w-4 h-4 text-[#2F8F5B]" />
                      <span className="font-semibold text-[#065F46]">{drawerFileName}</span>
                      <span className="text-[#065F46]">({drawerFileSize || '1.8 MB'})</span>
                    </div>
                    <span className="text-[#2F8F5B] font-medium">Ready</span>
                  </div>
                )}
              </div>

              {/* Dates */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[14px] font-semibold text-[#10212E] dark:text-white block">
                    Issue date *
                  </label>
                  <input
                    type="date"
                    required
                    value={extractedFields.issueDate}
                    onChange={(e) =>
                      setExtractedFields({ ...extractedFields, issueDate: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] bg-white dark:bg-[#132635] text-[#10212E] dark:text-white tabular-nums"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[14px] font-semibold text-[#10212E] dark:text-white block">
                    Expiry date {isExpiryRequired(drawerDocType) ? '*' : '(if applicable)'}
                  </label>
                  <input
                    type="date"
                    required={isExpiryRequired(drawerDocType)}
                    value={extractedFields.expiryDate}
                    onChange={(e) =>
                      setExtractedFields({ ...extractedFields, expiryDate: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] bg-white dark:bg-[#132635] text-[#10212E] dark:text-white tabular-nums"
                  />
                </div>
              </div>

              {/* "Fields we read from your document" Box */}
              <div className="p-4 rounded-[10px] bg-[#F7FAFD] dark:bg-[#10212E] border border-[#D5E0EA] dark:border-[#1E364A] space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-[#D5E0EA] dark:border-[#1E364A]">
                  <div>
                    <h3 className="font-heading font-semibold text-[15px] text-[#10212E] dark:text-white">
                      Fields we read from your document
                    </h3>
                    <span className="text-[14px] text-[#6B7A87]">
                      Check these before saving.
                    </span>
                  </div>
                  <span className="text-[14px] font-medium text-[#1F5F99] bg-[#EAF2FA] dark:bg-[#1E364A] px-2.5 py-0.5 rounded">
                    OCR extracted
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[14px] font-medium text-[#6B7A87] block">
                      Certificate / document number
                    </label>
                    <input
                      type="text"
                      value={extractedFields.documentNumber}
                      onChange={(e) =>
                        setExtractedFields({ ...extractedFields, documentNumber: e.target.value })
                      }
                      className="w-full px-3 py-1.5 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] bg-white dark:bg-[#132635] text-[#10212E] dark:text-white"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[14px] font-medium text-[#6B7A87] block">
                      Issuing authority
                    </label>
                    <input
                      type="text"
                      value={extractedFields.authorityName}
                      onChange={(e) =>
                        setExtractedFields({ ...extractedFields, authorityName: e.target.value })
                      }
                      className="w-full px-3 py-1.5 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] bg-white dark:bg-[#132635] text-[#10212E] dark:text-white"
                    />
                  </div>
                </div>
              </div>

              {/* Crucial Verification Notice: Never imply verified until confirmed */}
              <div className="p-4 rounded-[8px] bg-[#FFFBEB] dark:bg-[#78350F]/20 border border-[#FDE68A] dark:border-[#78350F]/40 flex items-start gap-3 text-[14px]">
                <Clock className="w-5 h-5 text-[#D97706] shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <strong className="text-[#92400E] dark:text-amber-300 font-semibold block">
                    Review and certification notice
                  </strong>
                  <p className="text-[#92400E] dark:text-amber-200">
                    Uploaded documents are saved with status <strong>Pending verification</strong>. Compliance registry reviewers confirm validity before tender evaluations proceed.
                  </p>
                </div>
              </div>

              {/* Drawer Footer Actions */}
              <div className="pt-4 border-t border-[#D5E0EA] dark:border-[#1E364A] flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setIsUploadDrawerOpen(false)}
                  className="px-4 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] text-[#43525F] dark:text-[#B2C3D2] hover:bg-[#F7FAFD] dark:hover:bg-[#10212E] cursor-pointer"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  className="px-5 py-2 bg-[#1F5F99] hover:bg-[#184c7a] text-white rounded-[6px] text-[14px] font-medium inline-flex items-center gap-1.5 cursor-pointer  transition-colors"
                >
                  <span>Save document</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          7. VERSION HISTORY DRAWER / MODAL
          ========================================================================= */}
      {versionHistoryDoc && (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div
            className="fixed inset-0 bg-[#10212E]/40 backdrop-blur-xs transition-opacity"
            onClick={() => setVersionHistoryDoc(null)}
          />

          <div className="relative w-full max-w-xl bg-white dark:bg-[#132635] shadow-2xl h-full flex flex-col z-10 border-l border-[#D5E0EA] dark:border-[#1E364A] overflow-y-auto">
            {/* Header */}
            <div className="p-6 border-b border-[#D5E0EA] dark:border-[#1E364A] flex items-center justify-between">
              <div>
                <h2 className="font-heading font-semibold text-[20px] text-[#10212E] dark:text-white">
                  Version history
                </h2>
                <span className="text-[14px] text-[#6B7A87]">
                  {versionHistoryDoc.documentType} · Cert #{versionHistoryDoc.documentNumber}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setVersionHistoryDoc(null)}
                className="p-2 rounded-full text-[#6B7A87] hover:bg-[#F7FAFD] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Versions List */}
            <div className="p-6 space-y-6 flex-1">
              <div className="space-y-4">
                {(versionHistoryDoc.versionHistory && versionHistoryDoc.versionHistory.length > 0
                  ? [...versionHistoryDoc.versionHistory].reverse()
                  : [
                      {
                        version: 1,
                        uploadedBy: 'Kagiso Molosiwa (Supplier admin)',
                        uploadedAt: '15 Jan 2026, 11:20',
                        fileFingerprint: 'SHA-256: 7f8a9b...3c12',
                        fileName: versionHistoryDoc.fileName,
                        fileSize: versionHistoryDoc.fileSize,
                        usedInApplications: ['GRC/2026/W04'],
                      },
                    ]
                ).map((ver, idx) => (
                  <div
                    key={ver.version}
                    className={`p-5 rounded-[10px] border space-y-3 ${
                      idx === 0
                        ? 'border-[#1F5F99] bg-[#EAF2FA]/20 dark:bg-[#1E364A]/30'
                        : 'border-[#D5E0EA] dark:border-[#1E364A] bg-[#F7FAFD]/40 dark:bg-[#10212E]/40'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-heading font-semibold text-[16px] text-[#10212E] dark:text-white">
                          Version {ver.version}
                        </span>
                        {idx === 0 && (
                          <span className="bg-[#ECFDF5] text-[#2F8F5B] text-[14px] font-medium px-2 py-0.5 rounded">
                            Active in vault
                          </span>
                        )}
                      </div>
                      <span className="text-[14px] text-[#6B7A87] tabular-nums">
                        {ver.uploadedAt}
                      </span>
                    </div>

                    <div className="space-y-1 text-[14px]">
                      <div className="flex items-center justify-between text-[#43525F] dark:text-[#B2C3D2]">
                        <span>File:</span>
                        <strong className="text-[#10212E] dark:text-white">
                          {ver.fileName} ({ver.fileSize})
                        </strong>
                      </div>

                      <div className="flex items-center justify-between text-[#43525F] dark:text-[#B2C3D2]">
                        <span>Uploaded by:</span>
                        <span className="text-[#10212E] dark:text-white font-medium">
                          {ver.uploadedBy}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[#43525F] dark:text-[#B2C3D2]">
                        <span>Digital fingerprint:</span>
                        <span className="tabular-nums text-[#6B7A87]">
                          {ver.fileFingerprint}
                        </span>
                      </div>
                    </div>

                    {/* Applications that used this version */}
                    <div className="pt-2 border-t border-[#D5E0EA] dark:border-[#1E364A] text-[14px]">
                      <span className="text-[#6B7A87] block mb-1">
                        Applications using this version:
                      </span>
                      {ver.usedInApplications && ver.usedInApplications.length > 0 ? (
                        <div className="flex flex-wrap gap-1.5">
                          {ver.usedInApplications.map((app) => (
                            <span
                              key={app}
                              className="bg-[#EAF2FA] dark:bg-[#1E364A] text-[#1F5F99] dark:text-[#6FAEE0] px-2.5 py-0.5 rounded text-[14px] font-medium"
                            >
                              {app}
                            </span>
                          ))}
                        </div>
                      ) : (
                        <span className="text-[#6B7A87] italic">
                          Not attached to any submitted tender bids yet
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Footer */}
            <div className="p-6 border-t border-[#D5E0EA] dark:border-[#1E364A] flex justify-end">
              <button
                type="button"
                onClick={() => setVersionHistoryDoc(null)}
                className="px-4 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] font-medium text-[#10212E] dark:text-white hover:bg-[#F7FAFD] cursor-pointer"
              >
                Close history
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          8. DOCUMENT PREVIEW MODAL
          ========================================================================= */}
      {previewDoc && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="fixed inset-0 bg-[#10212E]/40 backdrop-blur-xs"
            onClick={() => setPreviewDoc(null)}
          />

          <div className="relative w-full max-w-2xl bg-white dark:bg-[#132635] rounded-[12px] border border-[#D5E0EA] dark:border-[#1E364A] shadow-2xl p-6 space-y-6 z-10 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-4 border-b border-[#D5E0EA] dark:border-[#1E364A]">
              <div>
                <h3 className="font-heading font-semibold text-[20px] text-[#10212E] dark:text-white">
                  {previewDoc.documentType}
                </h3>
                <span className="text-[14px] text-[#6B7A87]">
                  File: {previewDoc.fileName} · Cert #{previewDoc.documentNumber}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPreviewDoc(null)}
                className="p-1 rounded-full text-[#6B7A87] hover:bg-[#F7FAFD] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Preview Body */}
            <div className="space-y-4 text-[14px]">
              <div className="p-8 bg-[#F7FAFD] dark:bg-[#10212E] rounded-[8px] border border-[#D5E0EA] dark:border-[#1E364A] text-center space-y-3">
                <FileCheck className="w-12 h-12 text-[#1F5F99] mx-auto" />
                <div>
                  <h4 className="font-heading font-semibold text-[17px] text-[#10212E] dark:text-white">
                    Official statutory credential
                  </h4>
                  <p className="text-[14px] text-[#6B7A87]">
                    Cryptographic hash registered in BidReady360 passport.
                  </p>
                </div>
                <div className="inline-flex items-center gap-2">
                  <StatusChip status={previewDoc.status} />
                  <span className="text-[14px] text-[#6B7A87]">
                    Issue date: {previewDoc.issueDate}
                  </span>
                </div>
              </div>

              {previewDoc.extractedFields && (
                <div className="space-y-2">
                  <span className="font-semibold text-[#10212E] dark:text-white block">
                    Certified index details
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-[8px] bg-[#F7FAFD] dark:bg-[#10212E] border border-[#D5E0EA] dark:border-[#1E364A]">
                    {Object.entries(previewDoc.extractedFields).map(([k, v]) => (
                      <div key={k}>
                        <span className="text-[14px] text-[#6B7A87] block">{k}</span>
                        <span className="font-medium text-[#10212E] dark:text-white block">{v}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-4 border-t border-[#D5E0EA] dark:border-[#1E364A] flex items-center justify-between">
              <button
                type="button"
                onClick={() => {
                  setPreviewDoc(null);
                  handleOpenReplaceDrawer(previewDoc);
                }}
                className="px-4 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] font-medium text-[#1F5F99] hover:bg-[#EAF2FA] cursor-pointer"
              >
                Replace document
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDownload(previewDoc)}
                  className="px-4 py-2 border border-[#D5E0EA] dark:border-[#1E364A] rounded-[6px] text-[14px] font-medium text-[#10212E] dark:text-white hover:bg-[#F7FAFD] inline-flex items-center gap-1.5 cursor-pointer"
                >
                  <Download className="w-4 h-4" />
                  <span>Download</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPreviewDoc(null)}
                  className="px-4 py-2 bg-[#1F5F99] text-white rounded-[6px] text-[14px] font-medium cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
