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
 * Supports both real document type codes and descriptive names.
 */
function isDocumentValid(
  documents: SupplierDocument[],
  typeKeywordsOrCodes: string[]
): boolean {
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

    // Must not be expired or rejected
    const isExpired = doc.status === 'Expired' || (doc as any).status === 'expired';
    const isRejected = doc.status === 'Rejected' || (doc as any).status === 'rejected';

    // Also check date if expiryDate is set and in the past
    let dateExpired = false;
    const expVal = doc.expiryDate || (doc as any).expiry_date || (doc as any).valid_until;
    if (expVal) {
      try {
        const exp = new Date(expVal);
        if (!isNaN(exp.getTime()) && exp.getTime() < Date.now()) {
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

  // 16. Directors' and Shareholders' ID (uploaded, not expired, not rejected)
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

  // 17. Bank Confirmation Letter (uploaded, not expired, not rejected)
  const hasBankConfirmationDoc = isDocumentValid(docs, [
    'bank confirmation',
    'bank_letter',
    'bank rating',
    'bank confirmation letter',
    'bank letter',
    'bank statement',
  ]);

  // 18. Trading Licence (conditional - only required if supplier explicitly selected "Yes, I'll upload it")
  const hasTradingLicenceDoc = isDocumentValid(docs, ['trading licence', 'trading_licence', 'business licence', 'licence']);
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

  // Document and profile completeness is strictly for items required for everyone.
  // Conditional and preference documents do not make up part of the completeness.
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
    isComplete: completedCount === totalCount && totalCount > 0,
  };
}

export interface DistrictRegionGroup {
  region: string;
  districts: string[];
}

export const BOTSWANA_DISTRICTS_BY_REGION: DistrictRegionGroup[] = [
  {
    region: 'Central Region',
    districts: [
      'Central District',
      'Bobirwa District',
      'Boteti District',
      'Mahalapye District',
      'Orapa District',
      'Palapye District',
      'Selibe-Phikwe District',
      'Serowe District',
      'Sowa Town District',
      'Tutume District',
    ],
  },
  {
    region: 'Chobe Region',
    districts: ['Chobe District'],
  },
  {
    region: 'Ghanzi Region',
    districts: ['Ghanzi District', 'Charles Hill District'],
  },
  {
    region: 'Kgalagadi Region',
    districts: [
      'Kgalagadi District',
      'Hukuntsi District',
      'Lethakeng District',
      'Tsabong District',
    ],
  },
  {
    region: 'Kgatleng Region',
    districts: ['Kgatleng District'],
  },
  {
    region: 'Kweneng Region',
    districts: ['Kweneng District', 'Mogoditshane-Thamaga District'],
  },
  {
    region: 'North-East Region',
    districts: ['North-East District', 'Francistown District', 'Tonota District'],
  },
  {
    region: 'North-West Region',
    districts: ['North-West District', 'Okavango District'],
  },
  {
    region: 'South-East Region',
    districts: [
      'South-East District',
      'Gaborone District',
      'Lobatse District',
      'Ramotswa District',
      'Tlokweng District',
    ],
  },
  {
    region: 'Southern Region',
    districts: [
      'Southern District',
      'Goodhope District',
      'Jwaneng District',
      'Kanye District',
      'Mabutsane District',
      'Moshupa District',
    ],
  },
  {
    region: 'South-West Region',
    districts: ['South-West District'],
  },
];

export const BOTSWANA_DISTRICTS_FLAT: string[] = BOTSWANA_DISTRICTS_BY_REGION.flatMap(
  (g) => g.districts
);

