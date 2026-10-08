import { Supplier, SupplierDocument } from '../types';

export interface OnboardingChecklistItem {
  id: string;
  label: string;
  shortLabel: string;
  category: 'Company' | 'People' | 'Documents';
  isComplete: boolean;
  targetSection: 'details' | 'directors' | 'vault';
  fieldId: string;
  description: string;
  value?: string | number | null;
}

export interface SupplierCompletenessResult {
  score: number; // 0 to 100 rounded
  completedCount: number;
  totalCount: number; // 15
  items: OnboardingChecklistItem[];
  missingItems: OnboardingChecklistItem[];
  isComplete: boolean;
}

/**
 * Validates whether a document in the vault fulfills a compliance requirement:
 * Must be present, not expired, and not rejected.
 */
function isDocumentValid(
  documents: SupplierDocument[],
  typeKeywords: string[]
): boolean {
  return documents.some((doc) => {
    const typeLower = (doc.documentType || '').toLowerCase();
    const titleLower = (doc.title || '').toLowerCase();
    const matchesType = typeKeywords.some(
      (kw) => typeLower.includes(kw.toLowerCase()) || titleLower.includes(kw.toLowerCase())
    );

    if (!matchesType) return false;

    // Must not be expired or rejected
    const isExpired = doc.status === 'Expired';
    const isRejected = doc.status === 'Rejected';

    // Also check date if expiryDate is set and in the past
    let dateExpired = false;
    if (doc.expiryDate) {
      try {
        const exp = new Date(doc.expiryDate);
        if (!isNaN(exp.getTime()) && exp < new Date()) {
          dateExpired = true;
        }
      } catch {
        // ignore date parse errors
      }
    }

    return !isExpired && !isRejected && !dateExpired;
  });
}

/**
 * Calculates the exact 15-item completeness score for a supplier:
 * - Company (10): legal name, trading name, tax number, physical address, city, district, phone, email, bank details, citizen ownership %.
 * - People (1): at least one director, with ownership totalling 100%.
 * - Documents (4): CIPA certificate, tax clearance, workers compensation & safety, public liability insurance. Each counts only when uploaded and not expired or rejected.
 *
 * Completeness = completed items / 15 * 100, rounded.
 */
export function calculateSupplierCompleteness(
  supplier: Partial<Supplier>,
  documents: SupplierDocument[] = []
): SupplierCompletenessResult {
  const docs = documents || supplier.documents || [];
  const directors = supplier.directors || [];

  // Newly registered accounts start at 0% completeness until company details are confirmed & saved.
  // Demo account or profiles with detailsSaved or full address & TIN are counted.
  const hasSavedDetails = Boolean(
    supplier.isDemoAccount ||
    supplier.detailsSaved === true ||
    (supplier.physicalAddress && supplier.tinNumber && supplier.bankName)
  );

  // 1. Legal Name
  const hasLegalName = Boolean(hasSavedDetails && supplier.legalName && supplier.legalName.trim().length > 0);

  // 2. Trading Name
  const hasTradingName = Boolean(hasSavedDetails && supplier.tradingName && supplier.tradingName.trim().length > 0);

  // 3. Tax Number (BURS TIN)
  const hasTaxNumber = Boolean(hasSavedDetails && supplier.tinNumber && supplier.tinNumber.trim().length > 0);

  // 4. Physical Address
  const hasPhysicalAddress = Boolean(hasSavedDetails && supplier.physicalAddress && supplier.physicalAddress.trim().length > 0);

  // 5. City
  const hasCity = Boolean(hasSavedDetails && supplier.city && supplier.city.trim().length > 0);

  // 6. District
  const hasDistrict = Boolean(hasSavedDetails && supplier.district && supplier.district.trim().length > 0);

  // 7. Phone
  const rawPhone = (supplier.primaryPhone || '').replace(/\D/g, '');
  const hasPhone = Boolean(hasSavedDetails && supplier.primaryPhone && rawPhone.length >= 7);

  // 8. Email
  const hasEmail = Boolean(
    hasSavedDetails &&
    supplier.email &&
    supplier.email.trim().length > 0 &&
    supplier.email.includes('@')
  );

  // 9. Bank Details (must have bank name and either branch or account number)
  const hasBankDetails = Boolean(
    hasSavedDetails &&
    supplier.bankName &&
    supplier.bankName.trim().length > 0 &&
    ((supplier.bankBranch && supplier.bankBranch.trim().length > 0) ||
      (supplier.accountNumberMasked && supplier.accountNumberMasked.trim().length > 0))
  );

  // 10. Citizen Ownership %
  // Must be explicitly confirmed or set
  const hasCitizenOwnership = Boolean(
    hasSavedDetails &&
    (supplier.citizenOwnershipSet === true ||
      (typeof supplier.citizenOwnedPercentage === 'number' &&
        supplier.citizenOwnedPercentage > 0 &&
        supplier.citizenOwnedPercentage <= 100))
  );

  // 11. People (1 item): at least one director, with ownership totalling 100%
  const totalOwnership = directors.reduce(
    (sum, d) => sum + (Number(d.shareholdingPercentage) || 0),
    0
  );
  const hasDirectors100Percent = directors.length > 0 && Math.round(totalOwnership) === 100;

  // 12. CIPA Certificate (uploaded, not expired, not rejected)
  const hasCipaDoc = isDocumentValid(docs, ['cipa', 'incorporation', 'company registration', 'company_registration']);

  // 13. Tax Clearance (BURS) (uploaded, not expired, not rejected)
  const hasTaxDoc = isDocumentValid(docs, ['tax clearance', 'tax_clearance', 'burs', 'tax certificate']);

  // 14. Workers Compensation & Safety (uploaded, not expired, not rejected)
  const hasSafetyDoc = isDocumentValid(docs, ['workers compensation', 'workers_compensation', 'safety', 'wca', 'occupational health']);

  // 15. Public Liability Insurance (uploaded, not expired, not rejected)
  const hasInsuranceDoc = isDocumentValid(docs, ['public liability', 'liability insurance', 'public_liability', 'indemnity insurance']);

  const items: OnboardingChecklistItem[] = [
    {
      id: 'legalName',
      label: 'Legal company name',
      shortLabel: 'Legal name',
      category: 'Company',
      isComplete: hasLegalName,
      targetSection: 'details',
      fieldId: 'field-legalName',
      description: 'Official corporate name registered with CIPA under the Companies Act.',
      value: supplier.legalName,
    },
    {
      id: 'tradingName',
      label: 'Trading name',
      shortLabel: 'Trading name',
      category: 'Company',
      isComplete: hasTradingName,
      targetSection: 'details',
      fieldId: 'field-tradingName',
      description: 'Commercial trading or business name used in procurement contracts.',
      value: supplier.tradingName,
    },
    {
      id: 'tinNumber',
      label: 'BURS Tax Identification Number (TIN)',
      shortLabel: 'Tax number',
      category: 'Company',
      isComplete: hasTaxNumber,
      targetSection: 'details',
      fieldId: 'field-tinNumber',
      description: 'Taxpayer identification number issued by Botswana Unified Revenue Service.',
      value: supplier.tinNumber,
    },
    {
      id: 'physicalAddress',
      label: 'Physical plot & street address',
      shortLabel: 'Physical address',
      category: 'Company',
      isComplete: hasPhysicalAddress,
      targetSection: 'details',
      fieldId: 'field-physicalAddress',
      description: 'Physical operating premises, commercial plot number, and street in Botswana.',
      value: supplier.physicalAddress,
    },
    {
      id: 'city',
      label: 'City or town of operation',
      shortLabel: 'City',
      category: 'Company',
      isComplete: hasCity,
      targetSection: 'details',
      fieldId: 'field-city',
      description: 'Municipality or town council where primary operations are located.',
      value: supplier.city,
    },
    {
      id: 'district',
      label: 'Administrative district',
      shortLabel: 'District',
      category: 'Company',
      isComplete: hasDistrict,
      targetSection: 'details',
      fieldId: 'field-district',
      description: 'Botswana administrative district used for local procurement preference margins.',
      value: supplier.district,
    },
    {
      id: 'primaryPhone',
      label: 'Primary contact telephone',
      shortLabel: 'Phone',
      category: 'Company',
      isComplete: hasPhone,
      targetSection: 'details',
      fieldId: 'field-primaryPhone',
      description: 'Official mobile or landline phone for tender notices and clarifications.',
      value: supplier.primaryPhone,
    },
    {
      id: 'email',
      label: 'Official corporate email',
      shortLabel: 'Email',
      category: 'Company',
      isComplete: hasEmail,
      targetSection: 'details',
      fieldId: 'field-email',
      description: 'Primary corporate address for dispatching RFPs and award notifications.',
      value: supplier.email,
    },
    {
      id: 'bankDetails',
      label: 'Commercial banking details',
      shortLabel: 'Bank details',
      category: 'Company',
      isComplete: hasBankDetails,
      targetSection: 'details',
      fieldId: 'field-bankDetails',
      description: 'Commercial bank name and branch/account for public procurement payment validation.',
      value: supplier.bankName ? `${supplier.bankName} (${supplier.bankBranch || 'Active account'})` : undefined,
    },
    {
      id: 'citizenOwnedPercentage',
      label: 'Citizen equity ownership percentage',
      shortLabel: 'Citizen ownership %',
      category: 'Company',
      isComplete: hasCitizenOwnership,
      targetSection: 'details',
      fieldId: 'field-citizenOwnedPercentage',
      description: 'Batswana citizen equity percentage for Citizen Economic Empowerment margins.',
      value: typeof supplier.citizenOwnedPercentage === 'number' ? `${supplier.citizenOwnedPercentage}%` : undefined,
    },
    {
      id: 'directors',
      label: 'Registered directors with 100% total ownership',
      shortLabel: 'Directors (100% equity)',
      category: 'People',
      isComplete: hasDirectors100Percent,
      targetSection: 'directors',
      fieldId: 'field-directors',
      description: 'At least one resident director registered with shareholdings totalling exactly 100%.',
      value: directors.length ? `${directors.length} director(s), ${totalOwnership}% allocated` : undefined,
    },
    {
      id: 'docCipa',
      label: 'CIPA Certificate of Incorporation',
      shortLabel: 'CIPA certificate',
      category: 'Documents',
      isComplete: hasCipaDoc,
      targetSection: 'vault',
      fieldId: 'field-doc-cipa',
      description: 'Certified company registration certificate uploaded in vault and active.',
    },
    {
      id: 'docTax',
      label: 'BURS Tax Clearance Certificate',
      shortLabel: 'Tax clearance',
      category: 'Documents',
      isComplete: hasTaxDoc,
      targetSection: 'vault',
      fieldId: 'field-doc-tax',
      description: 'Current Botswana Unified Revenue Service tax clearance certificate.',
    },
    {
      id: 'docSafety',
      label: 'Workers Compensation & Safety Certificate',
      shortLabel: 'Workers comp & safety',
      category: 'Documents',
      isComplete: hasSafetyDoc,
      targetSection: 'vault',
      fieldId: 'field-doc-safety',
      description: 'Occupational health and workers compensation compliance certificate.',
    },
    {
      id: 'docInsurance',
      label: 'Public Liability Insurance Policy',
      shortLabel: 'Public liability insurance',
      category: 'Documents',
      isComplete: hasInsuranceDoc,
      targetSection: 'vault',
      fieldId: 'field-doc-insurance',
      description: 'Active commercial third-party public liability insurance schedule.',
    },
  ];

  const completedCount = items.filter((i) => i.isComplete).length;
  const score = Math.round((completedCount / 15) * 100);
  const missingItems = items.filter((i) => !i.isComplete);

  return {
    score,
    completedCount,
    totalCount: 15,
    items,
    missingItems,
    isComplete: completedCount === 15,
  };
}
