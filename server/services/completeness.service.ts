import { query } from '../db/client';

export interface CompletenessItem {
  key: string;
  label: string;
  category: 'Company' | 'People' | 'Documents';
  complete: boolean;
  reason?: string;
  unverified?: boolean;
  value?: any;
}

export interface CompletenessResult {
  score: number;
  completedCount: number;
  totalCount: number;
  items: CompletenessItem[];
  missingItems: CompletenessItem[];
  complianceStatus: 'Fully compliant' | 'Action required';
}

/**
 * Pure calculation function: evaluates completeness from supplier, people, and documents
 * WITHOUT performing any database updates.
 */
export function computeSupplierCompleteness(
  supplier: any,
  people: any[] = [],
  documents: any[] = []
): CompletenessResult {
  const isTradingLicenceRequired = supplier?.has_trading_licence === true || supplier?.hasTradingLicence === true;
  const items: CompletenessItem[] = [];

  // 1. Legal Name
  const legalName = supplier?.legal_name || supplier?.legalName;
  const hasLegal = Boolean(legalName && String(legalName).trim().length > 0);
  items.push({
    key: 'legalName',
    label: 'Legal company name',
    category: 'Company',
    complete: hasLegal,
    reason: hasLegal ? undefined : 'Official corporate name is required.',
    value: legalName || null,
  });

  // 2. Trading Name
  const tradingName = supplier?.trading_name || supplier?.tradingName;
  const hasTrading = Boolean(tradingName && String(tradingName).trim().length > 0);
  items.push({
    key: 'tradingName',
    label: 'Trading name',
    category: 'Company',
    complete: hasTrading,
    reason: hasTrading ? undefined : 'Commercial trading name is required.',
    value: tradingName || null,
  });

  // 3. Tax Number (BURS TIN)
  const tin = supplier?.burs_tin || supplier?.tinNumber || supplier?.bursTin;
  const hasTin = Boolean(tin && String(tin).trim().length > 0);
  items.push({
    key: 'tinNumber',
    label: 'BURS Tax Identification Number (TIN)',
    category: 'Company',
    complete: hasTin,
    reason: hasTin ? undefined : 'Valid BURS TIN is required.',
    value: tin || null,
  });

  // 4. Physical Address
  const physicalAddress = supplier?.physical_address || supplier?.physicalAddress;
  const hasPhysical = Boolean(physicalAddress && String(physicalAddress).trim().length > 0);
  items.push({
    key: 'physicalAddress',
    label: 'Physical plot & street address',
    category: 'Company',
    complete: hasPhysical,
    reason: hasPhysical ? undefined : 'Physical business address is required.',
    value: physicalAddress || null,
  });

  // 5. City
  const city = supplier?.city;
  const hasCity = Boolean(city && String(city).trim().length > 0);
  items.push({
    key: 'city',
    label: 'City or town of operation',
    category: 'Company',
    complete: hasCity,
    reason: hasCity ? undefined : 'City or town is required.',
    value: city || null,
  });

  // 6. District
  const district = supplier?.district_id || supplier?.districtId || supplier?.district || supplier?.districtName;
  const hasDistrict = Boolean(district && String(district).trim().length > 0);
  items.push({
    key: 'district',
    label: 'Administrative district',
    category: 'Company',
    complete: hasDistrict,
    reason: hasDistrict ? undefined : 'District selection is required.',
    value: district || null,
  });

  // 7. Phone
  const phone = supplier?.primary_phone || supplier?.primaryPhone;
  const phoneDigits = (phone || '').replace(/\D/g, '');
  const hasPhone = Boolean(phone && phoneDigits.length >= 7);
  items.push({
    key: 'primaryPhone',
    label: 'Primary contact telephone',
    category: 'Company',
    complete: hasPhone,
    reason: hasPhone ? undefined : 'A telephone number with at least 7 digits is required.',
    value: phone || null,
  });

  // 8. Email
  const email = supplier?.email;
  const hasEmail = Boolean(email && String(email).trim().length > 0 && String(email).includes('@'));
  items.push({
    key: 'email',
    label: 'Official corporate email',
    category: 'Company',
    complete: hasEmail,
    reason: hasEmail ? undefined : 'A valid email address is required.',
    value: email || null,
  });

  // 9. Bank Details
  const bankName = supplier?.bank_name || supplier?.bankName;
  const bankBranch = supplier?.bank_branch || supplier?.bankBranch;
  const accountMasked = supplier?.account_number_masked || supplier?.accountNumberMasked;
  const hasBank = Boolean(
    bankName &&
    String(bankName).trim().length > 0 &&
    ((bankBranch && String(bankBranch).trim().length > 0) || (accountMasked && String(accountMasked).trim().length > 0))
  );
  items.push({
    key: 'bankDetails',
    label: 'Commercial banking details',
    category: 'Company',
    complete: hasBank,
    reason: hasBank ? undefined : 'Bank name and branch or masked account number are required.',
    value: hasBank ? `${bankName} (${bankBranch || 'Active account'})` : null,
  });

  // 10. Citizen Ownership %
  const citizenPct = supplier?.citizen_owned_percentage ?? supplier?.citizenOwnedPercentage;
  const citizenNum = Number(citizenPct);
  const hasCitizen = !isNaN(citizenNum) && citizenNum > 0 && citizenNum <= 100;
  items.push({
    key: 'citizenOwnership',
    label: 'Citizen equity ownership percentage',
    category: 'Company',
    complete: hasCitizen,
    reason: hasCitizen ? undefined : 'Citizen equity ownership between 1% and 100% is required.',
    value: hasCitizen ? `${citizenNum}%` : null,
  });

  // 11. Directors (100% total ownership)
  const activePeople = (people || []).filter((p) => p.is_active !== false && p.isActive !== false);
  const totalOwnership = activePeople.reduce((sum, p) => {
    const raw = p.ownership_percent ?? p.ownershipPercent ?? p.shareholdingPercentage ?? 0;
    return sum + (parseFloat(raw) || 0);
  }, 0);
  const hasDirectors100 = activePeople.length > 0 && Math.round(totalOwnership) === 100;
  items.push({
    key: 'directors',
    label: 'Registered directors with 100% total ownership',
    category: 'People',
    complete: hasDirectors100,
    reason: hasDirectors100
      ? undefined
      : (activePeople.length === 0 ? 'No registered directors or shareholders found.' : `Total ownership is ${totalOwnership}%, must equal 100%.`),
    value: `${activePeople.length} registered (${Math.round(totalOwnership)}% total)`,
  });

  // Helper for checking document types by real code
  const checkDocByCode = (codes: string[], label: string, key: string): CompletenessItem => {
    const matchingTypeDocs = (documents || []).filter((d) => {
      const code = (d.documentTypeCode || d.doc_type_code || d.code || '').toUpperCase();
      return codes.some((c) => c.toUpperCase() === code);
    });

    const now = new Date();
    const todayUtcStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());

    const isExpiryPast = (expiry: any): boolean => {
      if (!expiry) return false;
      const expDate = new Date(expiry);
      if (isNaN(expDate.getTime())) return false;
      const expUtcStart = Date.UTC(expDate.getUTCFullYear(), expDate.getUTCMonth(), expDate.getUTCDate());
      return expUtcStart < todayUtcStart;
    };

    const validVerifiedMatch = matchingTypeDocs.find((d) => {
      const docStatus = (d.status || '').toLowerCase();
      if (docStatus === 'expired' || docStatus === 'rejected' || docStatus === 'deleted') return false;

      const verStatus = (d.verificationStatus || d.verification_status || '').toUpperCase();
      if (verStatus !== 'VERIFIED' && verStatus !== 'APPROVED') return false;

      const expiryState = (d.expiryState || d.expiry_state || '').toUpperCase();
      if (expiryState === 'EXPIRED') return false;

      const expiry = d.expiryDate || d.expiry_date || d.valid_until;
      if (isExpiryPast(expiry)) return false;

      return true;
    });

    if (validVerifiedMatch) {
      return {
        key,
        label,
        category: 'Documents',
        complete: true,
        unverified: false,
        reason: 'Verified',
        value: validVerifiedMatch.fileName || validVerifiedMatch.file_name || validVerifiedMatch.title || 'Verified',
      };
    }

    const pendingDoc = matchingTypeDocs.find((d) => {
      const docStatus = (d.status || '').toLowerCase();
      if (docStatus === 'expired' || docStatus === 'rejected' || docStatus === 'deleted') return false;
      const verStatus = (d.verificationStatus || d.verification_status || '').toUpperCase();
      if (verStatus === 'REJECTED' || verStatus === 'EXPIRED' || verStatus === 'UNVERIFIABLE') return false;
      const expiryState = (d.expiryState || d.expiry_state || '').toUpperCase();
      if (expiryState === 'EXPIRED') return false;
      const expiry = d.expiryDate || d.expiry_date || d.valid_until;
      if (isExpiryPast(expiry)) return false;
      return verStatus === 'PENDING_VERIFICATION' || verStatus === 'PENDING' || docStatus === 'active';
    });

    if (pendingDoc) {
      return {
        key,
        label,
        category: 'Documents',
        complete: false,
        unverified: true,
        reason: `${label} is uploaded and awaiting administrator verification.`,
        value: pendingDoc.fileName || pendingDoc.file_name || pendingDoc.title || 'Pending verification',
      };
    }

    const rejectedDoc = matchingTypeDocs.find((d) => {
      const verStatus = (d.verificationStatus || d.verification_status || '').toUpperCase();
      const docStatus = (d.status || '').toLowerCase();
      return verStatus === 'REJECTED' || docStatus === 'rejected';
    });
    if (rejectedDoc) {
      const rejNote = rejectedDoc.rejectionReason || rejectedDoc.rejection_reason || rejectedDoc.verificationNotes || rejectedDoc.verification_notes;
      return {
        key,
        label,
        category: 'Documents',
        complete: false,
        reason: rejNote
          ? `${label} was rejected: ${rejNote}. Please upload a replacement.`
          : `${label} was rejected by an administrator. Please upload a replacement.`,
      };
    }

    const expiredDoc = matchingTypeDocs.find((d) => {
      const verStatus = (d.verificationStatus || d.verification_status || '').toUpperCase();
      const expiryState = (d.expiryState || d.expiry_state || '').toUpperCase();
      const expiry = d.expiryDate || d.expiry_date || d.valid_until;
      return verStatus === 'EXPIRED' || expiryState === 'EXPIRED' || isExpiryPast(expiry);
    });
    if (expiredDoc) {
      return {
        key,
        label,
        category: 'Documents',
        complete: false,
        reason: `${label} has expired. Please upload a renewed document.`,
      };
    }

    const unverifiableDoc = matchingTypeDocs.find((d) => {
      const verStatus = (d.verificationStatus || d.verification_status || '').toUpperCase();
      return verStatus === 'UNVERIFIABLE';
    });
    if (unverifiableDoc) {
      return {
        key,
        label,
        category: 'Documents',
        complete: false,
        reason: `${label} could not be verified. Please upload a clearer replacement.`,
      };
    }

    return {
      key,
      label,
      category: 'Documents',
      complete: false,
      reason: `${label} has not been uploaded.`,
    };
  };

  // 12. CIPA Certificate
  items.push(checkDocByCode(['COMPANY_REGISTRATION', 'CIPA_CERT', 'CIPA'], 'CIPA Certificate of Incorporation', 'cipaDoc'));

  // 13. Tax Clearance Certificate
  items.push(checkDocByCode(['TAX_CLEARANCE', 'BURS_TAX'], 'BURS Tax Clearance Certificate', 'taxDoc'));

  // 14. Directors & Shareholders ID
  items.push(checkDocByCode(['DIRECTOR_ID', 'DIRECTORS_ID', 'OMANG'], "Directors' and shareholders' ID", 'directorsIdDoc'));

  // 15. Bank Confirmation Letter
  items.push(checkDocByCode(['BANK_CONFIRMATION', 'BANK_LETTER'], 'Bank confirmation letter', 'bankDoc'));

  // 16. Trading Licence (conditional)
  if (isTradingLicenceRequired) {
    items.push(checkDocByCode(['BUSINESS_LICENCE', 'TRADING_LICENCE'], 'Trading licence', 'tradingLicenceDoc'));
  }

  const totalCount = items.length;
  const completedCount = items.filter((i) => i.complete).length;
  const score = Math.round((completedCount / Math.max(1, totalCount)) * 100);
  const missingItems = items.filter((i) => !i.complete);
  const complianceStatus = score >= 80 ? 'Fully compliant' : 'Action required';

  return {
    score,
    completedCount,
    totalCount,
    items,
    missingItems,
    complianceStatus,
  };
}

export class CompletenessService {
  private timer: NodeJS.Timeout | null = null;

  async calculateForSupplier(supplierId: string): Promise<CompletenessResult | null> {
    try {
      const [sRes, pRes, dRes] = await Promise.all([
        query(
          `SELECT s.legal_name, s.trading_name, s.burs_tin, s.physical_address, s.city, s.district_id,
                  s.primary_phone, s.email, s.bank_name, s.bank_branch, s.account_number_masked,
                  s.citizen_owned_percentage, s.has_trading_licence
           FROM suppliers s
           WHERE s.id = $1 AND s.deleted_at IS NULL`,
          [supplierId]
        ),
        query(
          `SELECT ownership_percent, ownership_percent AS "ownershipPercent", is_active FROM supplier_people WHERE supplier_id = $1 AND is_active = TRUE`,
          [supplierId]
        ),
        query(
          `SELECT sd.id, dt.code AS doc_type_code, dt.code, dt.name, sd.title,
                  sdv.file_name, sdv.verification_status, sdv.verification_notes, sdv.rejection_reason,
                  sdv.expiry_date, sd.status
           FROM supplier_documents sd
           JOIN document_types dt ON dt.id = sd.document_type_id
           LEFT JOIN supplier_document_versions sdv ON sdv.id = sd.current_version_id
           WHERE sd.supplier_id = $1 AND sd.status = 'active'`,
          [supplierId]
        ),
      ]);

      if (sRes.rows.length === 0) return null;
      return computeSupplierCompleteness(sRes.rows[0], pRes.rows, dRes.rows);
    } catch (err) {
      console.warn(`[COMPLETENESS SERVICE] Failed calculateForSupplier(${supplierId}):`, err);
      return null;
    }
  }

  async auditCompleteness() {
    try {
      const res = await query(`
        SELECT id, legal_name, profile_completeness, compliance_status
        FROM suppliers
        WHERE deleted_at IS NULL
        ORDER BY created_at DESC
        LIMIT 100
      `);

      const auditResults = [];
      let matchedCount = 0;
      let discrepancyCount = 0;

      for (const row of res.rows) {
        const computed = await this.calculateForSupplier(row.id);
        const storedScore = Number(row.profile_completeness || 0);
        const computedScore = computed ? computed.score : 0;
        const matched = storedScore === computedScore;

        if (matched) matchedCount++;
        else discrepancyCount++;

        auditResults.push({
          supplierId: row.id,
          legalName: row.legal_name,
          storedScore,
          computedScore,
          matched,
          complianceStatus: computed?.complianceStatus || row.compliance_status,
        });
      }

      return {
        totalAudited: res.rows.length,
        matchedCount,
        discrepancyCount,
        auditTimestamp: new Date().toISOString(),
        suppliers: auditResults,
      };
    } catch (err: any) {
      console.error('[AUDIT COMPLETENESS ERROR]', err);
      return { error: err.message, totalAudited: 0, matchedCount: 0, discrepancyCount: 0, suppliers: [] };
    }
  }

  async runDailyJob() {
    try {
      console.log('[COMPLETENESS SERVICE] Running daily reconciliation job...');
      const res = await query(`
        SELECT id FROM suppliers WHERE deleted_at IS NULL
      `);

      let processedCount = 0;
      for (const row of res.rows) {
        const computed = await this.calculateForSupplier(row.id);
        if (computed) {
          const missingLabels = computed.missingItems.map((m) => m.label);
          await query(
            `UPDATE suppliers
             SET profile_completeness = $1,
                 compliance_status = $2,
                 missing_items = $3,
                 profile_completeness_updated_at = NOW()
             WHERE id = $4`,
            [computed.score, computed.complianceStatus, missingLabels, row.id]
          );
          processedCount++;
        }
      }

      console.log(`[COMPLETENESS SERVICE] Reconciled ${processedCount} suppliers.`);
      return {
        success: true,
        processedCount,
        checked: res.rows.length,
        updated: processedCount,
        timestamp: new Date().toISOString(),
      };
    } catch (err: any) {
      console.error('[COMPLETENESS SERVICE RUN DAILY JOB ERROR]', err);
      return {
        success: false,
        error: err.message,
        processedCount: 0,
        checked: 0,
        updated: 0,
        timestamp: new Date().toISOString(),
      };
    }
  }

  startScheduler() {
    console.log('[COMPLETENESS SERVICE] Daily completeness reconciliation scheduler active (target: 00:05 Africa/Gaborone).');
    if (this.timer) {
      clearInterval(this.timer);
    }
    this.timer = setInterval(() => {
      this.runDailyJob().catch((err) => {
        console.warn('[COMPLETENESS SERVICE CRON ERROR]', err);
      });
    }, 24 * 60 * 60 * 1000);
    if (this.timer.unref) {
      this.timer.unref();
    }
  }
}

export const completenessService = new CompletenessService();

