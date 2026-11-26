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
 * Must be present, verified/approved (not pending, rejected, expired, or unverifiable), and not past its UTC expiry date.
 * Supports both real document type codes and descriptive names.
 */
function isDocumentValid(
  documents: SupplierDocument[],
  typeKeywordsOrCodes: string[]
): boolean {
  const todayUtcMs = Date.UTC(
    new Date().getUTCFullYear(),
    new Date().getUTCMonth(),
    new Date().getUTCDate()
  );

  return (documents || []).some((doc) => {
    const code = ((doc as any).documentTypeCode || (doc as any).doc_type_code || (doc as any).code || '').toUpperCase();
    const typeLower = (doc.documentType || '').toLowerCase();
    const titleLower = (doc.title || '').toLowerCase();

    const matches = typeKeywordsOrCodes.some((kw) => {
      const kwUpper = kw.toUpperCase();
      const kwLower = kw.toLowerCase();
      return (
        (code && code === kwUpper) ||
        (code && code.includes(kwUpper)) ||
        typeLower.includes(kwLower) ||
        titleLower.includes(kwLower)
      );
    });

    if (!matches) return false;

    const statusLower = String(doc.status || '').toLowerCase();
    const verStatusUpper = String((doc as any).verificationStatus || (doc as any).verification_status || '').toUpperCase();
    const expiryStateUpper = String((doc as any).expiryState || (doc as any).expiry_state || '').toUpperCase();

    const isExpired = statusLower === 'expired' || verStatusUpper === 'EXPIRED' || expiryStateUpper === 'EXPIRED';
    const isRejected = statusLower === 'rejected' || verStatusUpper === 'REJECTED';
    const isUnverifiable = statusLower === 'cannot verify' || verStatusUpper === 'UNVERIFIABLE';
    const isVerified =
      verStatusUpper === 'VERIFIED' ||
      verStatusUpper === 'APPROVED' ||
      statusLower === 'verified' ||
      statusLower === 'expiring soon';

    if (!isVerified || isExpired || isRejected || isUnverifiable) {
      return false;
    }

    // Check UTC calendar date boundary if expiryDate is set
    const expVal = doc.expiryDate || (doc as any).expiry_date || (doc as any).valid_until;
    if (expVal) {
      const expStr = String(expVal).slice(0, 10);
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(expStr);
      if (match) {
        const expUtcMs = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
        if (expUtcMs < todayUtcMs) return false;
      } else {
        const exp = new Date(expVal);
        if (!isNaN(exp.getTime()) && exp.getTime() < todayUtcMs) {
          return false;
        }
      }
    }

    return true;
  });
}

/**
 * Calculates the exact 15-item completeness score for a supplier:
 * - Company (10): legal name, trading name, tax number, physical address, city, district, phone, email, bank details, citizen ownership %.
 * - People (1): at least one director, with ownership totalling 100%.
 * - Documents (4): CIPA certificate, tax clearance, directors' & shareholders' ID, bank confirmation letter (plus trading licence if declared). Each counts only when Verified and valid.
 *
 * Completeness = completed items / total items * 100, rounded.
 */
export function calculateSupplierCompleteness(
  supplier: Partial<Supplier>,
  documents: SupplierDocument[] = []
): SupplierCompletenessResult {
  const docs = documents || supplier.documents || [];
  const directors = supplier.directors || [];

  // 1. Legal Name
  const hasLegalName = Boolean(supplier.legalName && supplier.legalName.trim().length > 0);

  // 2. Trading Name
  const hasTradingName = Boolean(supplier.tradingName && supplier.tradingName.trim().length > 0);

  // 3. Tax Number (BURS TIN)
  const tinVal = supplier.tinNumber || (supplier as any).bursTin || (supplier as any).burs_tin;
  const hasTaxNumber = Boolean(tinVal && String(tinVal).trim().length > 0);

  // 4. Physical Address
  const hasPhysicalAddress = Boolean(supplier.physicalAddress && supplier.physicalAddress.trim().length > 0);

  // 5. City
  const hasCity = Boolean(supplier.city && supplier.city.trim().length > 0);

  // 6. District
  const districtVal = supplier.district || (supplier as any).districtName || (supplier as any).district_id || (supplier as any).districtId;
  const hasDistrict = Boolean(districtVal && String(districtVal).trim().length > 0);

  // 7. Phone
  const rawPhone = (supplier.primaryPhone || '').replace(/\D/g, '');
  const hasPhone = Boolean(supplier.primaryPhone && rawPhone.length >= 7);

  // 8. Email
  const hasEmail = Boolean(
    supplier.email &&
    supplier.email.trim().length > 0 &&
    supplier.email.includes('@')
  );

  // 9. Bank Details (must have bank name and either branch or account number)
  const hasBankDetails = Boolean(
    supplier.bankName &&
    supplier.bankName.trim().length > 0 &&
    ((supplier.bankBranch && supplier.bankBranch.trim().length > 0) ||
      (supplier.accountNumberMasked && supplier.accountNumberMasked.trim().length > 0))
  );

  // 10. Citizen Ownership %
  const citizenNum = Number(supplier.citizenOwnedPercentage ?? (supplier as any).citizen_owned_percentage);
  const hasCitizenOwnership = Boolean(!isNaN(citizenNum) && citizenNum > 0 && citizenNum <= 100);

  // 11. People (1 item): at least one director, with ownership totalling 100%
  const totalOwnership = directors.reduce(
    (sum, d: any) => sum + (Number(d.shareholdingPercentage ?? d.ownershipPercent ?? d.ownership_percent) || 0),
    0
  );
  const hasDirectors100Percent = directors.length > 0 && Math.round(totalOwnership) === 100;

  // 12. CIPA Certificate (uploaded, verified, not expired, not rejected)
  const hasCipaDoc = isDocumentValid(docs, ['cipa', 'cipa_cert', 'incorporation', 'company registration', 'company_registration']);

  // 13. Tax Clearance (BURS) (uploaded, verified, not expired, not rejected)
  const hasTaxDoc = isDocumentValid(docs, ['tax clearance', 'tax_clearance', 'burs', 'tax certificate']);

  // 14. Workers Compensation & Safety (uploaded, verified, not expired, not rejected)
  const hasSafetyDoc = isDocumentValid(docs, ['workers compensation', 'workers_compensation', 'safety', 'wca', 'occupational health']);

  // 15. Public Liability Insurance (uploaded, verified, not expired, not rejected)
  const hasInsuranceDoc = isDocumentValid(docs, ['public liability', 'liability insurance', 'public_liability', 'indemnity insurance']);

  // 16. Directors' and Shareholders' ID (uploaded, verified, not expired, not rejected)
  const hasDirectorsIdDoc = isDocumentValid(docs, [
    'directors and shareholders id',
    'director id',
    'director_id',
    'shareholder id',
    'directors id',
    'director identity',
    'director',
    'shareholder',
    'omang',
    'passport',
  ]);

  // 17. Bank Confirmation Letter (uploaded, verified, not expired, not rejected)
  const hasBankConfirmationDoc = isDocumentValid(docs, [
    'bank confirmation',
    'bank_letter',
    'bank rating',
    'bank confirmation letter',
    'bank letter',
    'bank statement',
  ]);

  // 18. Trading Licence (conditional - only required if supplier explicitly selected "Yes, I'll upload it")
  const hasTradingLicenceDoc = isDocumentValid(docs, ['trading licence', 'trading_licence', 'trading_license', 'business licence', 'licence']);
  const isTradingLicenceRequired = supplier.hasTradingLicence === true;

  const baseItems: OnboardingChecklistItem[] = [
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
      value: districtVal || undefined,
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
      id: 'docDirectorsId',
      label: "Directors' and shareholders' ID",
      shortLabel: "Directors' ID",
      category: 'Documents',
      isComplete: hasDirectorsIdDoc,
      targetSection: 'vault',
      fieldId: 'field-doc-directors-id',
      description: 'Certified national identity documents or passports for registered directors and shareholders.',
    },
    {
      id: 'docBankLetter',
      label: 'Bank confirmation letter',
      shortLabel: 'Bank letter',
      category: 'Documents',
      isComplete: hasBankConfirmationDoc,
      targetSection: 'vault',
      fieldId: 'field-doc-bank-letter',
      description: 'Active commercial bank account confirmation letter issued within past 3 months.',
    },
  ];

  // Trading licence is strictly conditional: it is only added to the required checklist
  // if the supplier explicitly answered "Yes, I'll upload it". Unanswered or "Not required" blocks nothing.
  if (isTradingLicenceRequired) {
    baseItems.push({
      id: 'docTradingLicence',
      label: 'Trading Licence',
      shortLabel: 'Trading licence',
      category: 'Documents',
      isComplete: hasTradingLicenceDoc,
      targetSection: 'vault',
      fieldId: 'field-doc-trading-licence',
      description: 'Active municipal or local authority trading licence.',
    });
  }

  const optionalDocumentItems: OnboardingChecklistItem[] = [];
  if (hasSafetyDoc) {
    optionalDocumentItems.push({
      id: 'docSafety',
      label: 'Workers Compensation & Safety Certificate',
      shortLabel: 'Workers comp & safety',
      category: 'Documents',
      isComplete: hasSafetyDoc,
      targetSection: 'vault',
      fieldId: 'field-doc-safety',
      description: 'Occupational health and workers compensation compliance certificate.',
    });
  }
  if (hasInsuranceDoc) {
    optionalDocumentItems.push({
      id: 'docInsurance',
      label: 'Public Liability Insurance Policy',
      shortLabel: 'Public liability insurance',
      category: 'Documents',
      isComplete: hasInsuranceDoc,
      targetSection: 'vault',
      fieldId: 'field-doc-insurance',
      description: 'Active commercial third-party public liability insurance schedule.',
    });
  }

  const items = [...baseItems];
  const totalCount = items.length;
  const completedCount = items.filter((i) => i.isComplete).length;
  const score = Math.round((completedCount / Math.max(1, totalCount)) * 100);
  const missingItems = items.filter((i) => !i.isComplete);

  return {
    score,
    completedCount,
    totalCount,
    items,
    missingItems,
    isComplete: score === 100,
  };
}
