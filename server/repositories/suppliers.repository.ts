import { query, withTransaction } from '../db/client';
import { computeSupplierCompleteness, CompletenessResult } from '../services/completeness.service';

export interface SupplierProfile {
  id: string;
  legalName: string;
  tradingName: string | null;
  cipaUin: string;
  bursTin: string | null;
  ppraRegistrationNo: string | null;
  companyType: string;
  yearEstablished: number | null;
  description: string | null;
  physicalAddress: string | null;
  postalAddress: string | null;
  city: string | null;
  districtId: string | null;
  districtName?: string | null;
  primaryPhone: string | null;
  email: string | null;
  website: string | null;
  employeeCountBand: string | null;
  citizenOwnedPercentage: string | null;
  youthOwned: boolean;
  womenOwned: boolean;
  disabilityOwned: boolean;
  eddCertified: boolean;
  eddCertificateNo: string | null;
  eddValidUntil: string | null;
  status: string;
  verificationStatus: string;
  complianceStatus: string;
  profileCompleteness: number;
  hasTradingLicence?: boolean | null;
  tradingLicenceReason?: string | null;
}

export interface SupplierPerson {
  id: string;
  supplierId: string;
  fullName: string;
  personRole: string;
  ownershipPercent: string | null;
  identityType: string | null;
  nationality: string;
  isCitizen: boolean;
  email: string | null;
  phone: string | null;
  kycStatus: string;
}

export interface SupplierProject {
  id: string;
  supplierId: string;
  clientName: string;
  projectTitle: string;
  description: string | null;
  contractValue: string | null;
  currency: string;
  startDate: string | null;
  endDate: string | null;
  referenceName: string | null;
  referenceContact: string | null;
  referenceVerified: boolean;
}

export interface SupplierDisciplineAllocation {
  id: string;
  supplierId: string;
  disciplineId: string;
  disciplineCode: string;
  disciplineTitle: string;
  capabilityTierId: string | null;
  capabilityTierCode?: string | null;
  capabilityTierName?: string | null;
  isPrimary: boolean;
}

export async function resolveDistrictId(input?: string | null): Promise<string | null> {
  if (!input || typeof input !== 'string') return null;
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Check if already a valid UUID
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(trimmed)) {
    try {
      const uuidCheck = await query<{ id: string }>(`SELECT id FROM geographic_districts WHERE id = $1 LIMIT 1`, [trimmed]);
      if (uuidCheck.rows.length > 0) return uuidCheck.rows[0].id;
    } catch {
      // ignore
    }
  }

  try {
    // Strip parenthetical text like "(Gaborone)" and trailing "District"
    const cleanName = trimmed.replace(/\s*\([^)]*\)/g, '').trim();
    const withoutDistrict = cleanName.replace(/\s+district$/i, '').trim();

    // Exact or partial name match against geographic_districts
    const res = await query<{ id: string }>(
      `SELECT id FROM geographic_districts 
       WHERE LOWER(name) = LOWER($1)
          OR LOWER(name) = LOWER($2)
          OR LOWER(name) = LOWER($3)
          OR LOWER(administrative_region) = LOWER($1)
          OR LOWER(administrative_region) = LOWER($2)
          OR LOWER(name) LIKE LOWER($4)
       ORDER BY CASE 
         WHEN LOWER(name) = LOWER($1) THEN 1
         WHEN LOWER(name) = LOWER($2) THEN 2
         WHEN LOWER(administrative_region) = LOWER($1) THEN 3
         ELSE 4 END
       LIMIT 1`,
      [trimmed, cleanName, withoutDistrict, `%${withoutDistrict || cleanName}%`]
    );
    if (res.rows.length > 0) {
      return res.rows[0].id;
    }

    // Common regional aliases in Botswana
    const lower = trimmed.toLowerCase();
    if (
      lower.includes('gaborone') ||
      lower.includes('south-east') ||
      lower.includes('south east') ||
      lower.includes('tlokweng') ||
      lower.includes('ramotswa')
    ) {
      const gRes = await query<{ id: string }>(
        `SELECT id FROM geographic_districts WHERE name ILIKE '%South-East%' LIMIT 1`
      );
      if (gRes.rows[0]) return gRes.rows[0].id;
    }
    if (lower.includes('francistown')) {
      const fRes = await query<{ id: string }>(
        `SELECT id FROM geographic_districts WHERE name ILIKE '%Francistown%' LIMIT 1`
      );
      if (fRes.rows[0]) return fRes.rows[0].id;
    }
    if (lower.includes('lobatse')) {
      const lRes = await query<{ id: string }>(
        `SELECT id FROM geographic_districts WHERE name ILIKE '%Lobatse%' LIMIT 1`
      );
      if (lRes.rows[0]) return lRes.rows[0].id;
    }
    if (lower.includes('jwaneng')) {
      const jRes = await query<{ id: string }>(
        `SELECT id FROM geographic_districts WHERE name ILIKE '%Jwaneng%' LIMIT 1`
      );
      if (jRes.rows[0]) return jRes.rows[0].id;
    }
    if (lower.includes('orapa')) {
      const oRes = await query<{ id: string }>(
        `SELECT id FROM geographic_districts WHERE name ILIKE '%Orapa%' LIMIT 1`
      );
      if (oRes.rows[0]) return oRes.rows[0].id;
    }
    if (lower.includes('selibe') || lower.includes('selebi') || lower.includes('phikwe')) {
      const sRes = await query<{ id: string }>(
        `SELECT id FROM geographic_districts WHERE name ILIKE '%Selibe%' LIMIT 1`
      );
      if (sRes.rows[0]) return sRes.rows[0].id;
    }
    if (lower.includes('sowa')) {
      const swRes = await query<{ id: string }>(
        `SELECT id FROM geographic_districts WHERE name ILIKE '%Sowa%' LIMIT 1`
      );
      if (swRes.rows[0]) return swRes.rows[0].id;
    }
    if (
      lower.includes('central') ||
      lower.includes('serowe') ||
      lower.includes('palapye') ||
      lower.includes('mahalapye') ||
      lower.includes('bobonong') ||
      lower.includes('tutume')
    ) {
      const cRes = await query<{ id: string }>(
        `SELECT id FROM geographic_districts WHERE name ILIKE '%Central%' LIMIT 1`
      );
      if (cRes.rows[0]) return cRes.rows[0].id;
    }
    if (
      lower.includes('kweneng') ||
      lower.includes('molepolole') ||
      lower.includes('mogoditshane') ||
      lower.includes('thamaga')
    ) {
      const kwRes = await query<{ id: string }>(
        `SELECT id FROM geographic_districts WHERE name ILIKE '%Kweneng%' LIMIT 1`
      );
      if (kwRes.rows[0]) return kwRes.rows[0].id;
    }
    if (lower.includes('kgatleng') || lower.includes('mochudi')) {
      const kgRes = await query<{ id: string }>(
        `SELECT id FROM geographic_districts WHERE name ILIKE '%Kgatleng%' LIMIT 1`
      );
      if (kgRes.rows[0]) return kgRes.rows[0].id;
    }
    if (lower.includes('southern') || lower.includes('kanye') || lower.includes('moshupa')) {
      const soRes = await query<{ id: string }>(
        `SELECT id FROM geographic_districts WHERE name ILIKE '%Southern%' LIMIT 1`
      );
      if (soRes.rows[0]) return soRes.rows[0].id;
    }
    if (lower.includes('north-east') || lower.includes('north east') || lower.includes('masunga')) {
      const neRes = await query<{ id: string }>(
        `SELECT id FROM geographic_districts WHERE name ILIKE '%North-East%' LIMIT 1`
      );
      if (neRes.rows[0]) return neRes.rows[0].id;
    }
    if (
      lower.includes('north-west') ||
      lower.includes('north west') ||
      lower.includes('maun') ||
      lower.includes('ngamiland')
    ) {
      const nwRes = await query<{ id: string }>(
        `SELECT id FROM geographic_districts WHERE name ILIKE '%North-West%' LIMIT 1`
      );
      if (nwRes.rows[0]) return nwRes.rows[0].id;
    }
    if (lower.includes('chobe') || lower.includes('kasane')) {
      const chRes = await query<{ id: string }>(
        `SELECT id FROM geographic_districts WHERE name ILIKE '%Chobe%' LIMIT 1`
      );
      if (chRes.rows[0]) return chRes.rows[0].id;
    }
    if (lower.includes('ghanzi')) {
      const ghRes = await query<{ id: string }>(
        `SELECT id FROM geographic_districts WHERE name ILIKE '%Ghanzi%' LIMIT 1`
      );
      if (ghRes.rows[0]) return ghRes.rows[0].id;
    }
    if (lower.includes('kgalagadi') || lower.includes('tsabong') || lower.includes('hukuntsi')) {
      const kglRes = await query<{ id: string }>(
        `SELECT id FROM geographic_districts WHERE name ILIKE '%Kgalagadi%' LIMIT 1`
      );
      if (kglRes.rows[0]) return kglRes.rows[0].id;
    }
    if (lower.includes('south-west') || lower.includes('south west')) {
      const swRes = await query<{ id: string }>(
        `SELECT id FROM geographic_districts WHERE name ILIKE '%South-West%' LIMIT 1`
      );
      if (swRes.rows[0]) return swRes.rows[0].id;
    }

    // If still not matched, persist custom district into geographic_districts so it's guaranteed to have a valid foreign key:
    try {
      const insertRes = await query<{ id: string }>(
        `INSERT INTO geographic_districts (name, administrative_region, country_code, is_active, sort_order)
         VALUES ($1, $1, 'BW', true, 0)
         RETURNING id`,
        [cleanName || trimmed]
      );
      if (insertRes.rows[0]?.id) {
        return insertRes.rows[0].id;
      }
    } catch {
      // If concurrent insert or collision, re-fetch
      const retry = await query<{ id: string }>(
        `SELECT id FROM geographic_districts WHERE LOWER(name) = LOWER($1) LIMIT 1`,
        [cleanName || trimmed]
      );
      if (retry.rows[0]?.id) return retry.rows[0].id;
    }

    // Safe fallback to first district in table
    const fallback = await query<{ id: string }>(`SELECT id FROM geographic_districts LIMIT 1`);
    if (fallback.rows[0]?.id) return fallback.rows[0].id;
  } catch (err) {
    console.warn('[RESOLVE DISTRICT ID NOTICE]', err);
  }

  return null;
}

export function normalizeCompanyType(input?: string | null): string {
  if (!input) return 'private_company';
  const lower = String(input).toLowerCase().trim();
  if (lower.includes('sole')) return 'sole_proprietor';
  if (lower.includes('partner')) return 'partnership';
  if (lower.includes('public')) return 'public_company';
  if (lower.includes('coop')) return 'cooperative';
  if (lower.includes('ngo') || lower.includes('non-profit')) return 'ngo';
  if (lower.includes('joint') || lower.includes('jv')) return 'joint_venture';
  if (lower.includes('other')) return 'other';
  if (lower.includes('private') || lower.includes('pty') || lower.includes('ltd') || lower.includes('close')) return 'private_company';
  const allowed = ['sole_proprietor', 'partnership', 'private_company', 'public_company', 'cooperative', 'ngo', 'joint_venture', 'other'];
  if (allowed.includes(lower)) return lower;
  return 'private_company';
}

export function normalizeComplianceStatus(input?: string | null): string {
  if (!input) return 'Action required';
  const trimmed = String(input).trim();
  if (trimmed === 'Fully compliant' || trimmed.toLowerCase() === 'compliant') return 'Fully compliant';
  if (trimmed === 'Non-compliant') return 'Non-compliant';
  return 'Action required';
}

export class SuppliersRepository {
  /**
   * Recalculates and persists completeness only when called on data mutation events.
   * Never called on read operations.
   */
  async calculateCompleteness(supplierId: string): Promise<number> {
    try {
      const [sRes, pRes, dRes] = await Promise.all([
        query(
          `SELECT s.legal_name, s.trading_name, s.burs_tin, s.physical_address, s.city, s.district_id,
                  s.primary_phone, s.email, s.bank_name, s.bank_branch, s.account_number_masked,
                  s.citizen_owned_percentage, s.has_trading_licence
           FROM suppliers s WHERE s.id = $1`,
          [supplierId]
        ),
        query(
          `SELECT ownership_percent, is_active FROM supplier_people WHERE supplier_id = $1 AND is_active = TRUE`,
          [supplierId]
        ),
        query(
          `SELECT dt.code, dt.name, sd.status, sdv.expiry_date, sdv.verification_status, sdv.file_name
           FROM supplier_documents sd
           JOIN document_types dt ON dt.id = sd.document_type_id
           LEFT JOIN supplier_document_versions sdv ON sdv.id = sd.current_version_id
           WHERE sd.supplier_id = $1 AND sd.status = 'active'`,
          [supplierId]
        ),
      ]);

      if (sRes.rows.length === 0) return 0;
      const s = sRes.rows[0];
      const people = pRes.rows;
      const docs = dRes.rows;

      const result = computeSupplierCompleteness(s, people, docs);
      const missingLabels = result.missingItems.map((m) => m.label);

      await query(
        `UPDATE suppliers
         SET profile_completeness = $1,
             compliance_status = $2,
             missing_items = $3,
             profile_completeness_updated_at = NOW()
         WHERE id = $4`,
        [result.score, result.complianceStatus, missingLabels, supplierId]
      );

      return result.score;
    } catch (err) {
      console.warn('[RECALCULATE COMPLETENESS ERROR]', err);
      return 0;
    }
  }

  /**
   * PURE READ: Returns the supplier profile row without mutating the database or updating completeness.
   */
  async getById(supplierId: string): Promise<SupplierProfile | null> {

    const res = await query<SupplierProfile>(
      `SELECT s.id, 
              s.legal_name AS "legalName", s.legal_name,
              s.trading_name AS "tradingName", s.trading_name,
              s.cipa_uin AS "cipaUin", s.cipa_uin AS "cipaNumber", s.cipa_uin,
              s.burs_tin AS "bursTin", s.burs_tin AS "tinNumber", s.burs_tin,
              s.ppra_registration_no AS "ppraRegistrationNo", s.ppra_registration_no AS "ppraCode", s.ppra_registration_no,
              s.company_type AS "companyType", s.company_type,
              s.year_established AS "yearEstablished", s.year_established,
              s.description,
              s.physical_address AS "physicalAddress", s.physical_address,
              s.postal_address AS "postalAddress", s.postal_address,
              s.city,
              s.district_id AS "districtId", s.district_id,
              gd.name AS "districtName", gd.name AS "district",
              s.primary_phone AS "primaryPhone", s.primary_phone,
              s.email,
              s.website,
              s.bank_name AS "bankName", s.bank_name,
              s.bank_branch AS "bankBranch", s.bank_branch,
              s.account_number_masked AS "accountNumberMasked", s.account_number_masked,
              s.employee_count_band AS "employeeCountBand",
              s.citizen_owned_percentage AS "citizenOwnedPercentage", s.citizen_owned_percentage,
              s.youth_owned AS "youthOwned", s.youth_owned,
              s.women_owned AS "womenOwned", s.women_owned,
              s.disability_owned AS "disabilityOwned", s.disability_owned,
              s.edd_certified AS "eddCertified", s.edd_certified,
              s.edd_certificate_no AS "eddCertificateNo", s.edd_certificate_no,
              s.edd_valid_until AS "eddValidUntil",
              s.has_trading_licence AS "hasTradingLicence", s.has_trading_licence,
              s.trading_licence_reason AS "tradingLicenceReason", s.trading_licence_reason,
              s.status,
              s.verification_status AS "verificationStatus", s.verification_status,
              s.compliance_status AS "complianceStatus", s.compliance_status,
              s.profile_completeness AS "profileCompleteness", s.profile_completeness,
              s.missing_items AS "missingItems", s.missing_items
       FROM suppliers s
       LEFT JOIN geographic_districts gd ON gd.id = s.district_id
       WHERE s.id = $1 AND s.deleted_at IS NULL`,
      [supplierId]
    );
    return res.rows[0] || null;
  }

  async updateProfile(supplierId: string, data: Partial<SupplierProfile> & Record<string, any>): Promise<SupplierProfile> {
    const fields: string[] = [];
    const params: any[] = [supplierId];

    // 1. legal_name
    const legalName = data.legal_name !== undefined ? data.legal_name : data.legalName;
    if (legalName !== undefined) {
      params.push(legalName ? String(legalName).trim() : null);
      fields.push(`legal_name = $${params.length}`);
    }

    // 2. trading_name
    const tradingName = data.trading_name !== undefined ? data.trading_name : data.tradingName;
    if (tradingName !== undefined) {
      params.push(tradingName ? String(tradingName).trim() : null);
      fields.push(`trading_name = $${params.length}`);
    }

    // 3. cipa_uin
    const cipaUin = data.cipa_uin !== undefined ? data.cipa_uin : (data.cipaUin !== undefined ? data.cipaUin : data.cipaNumber);
    if (cipaUin !== undefined) {
      params.push(cipaUin ? String(cipaUin).trim() : null);
      fields.push(`cipa_uin = $${params.length}`);
    }

    // 4. burs_tin
    const bursTin = data.burs_tin !== undefined ? data.burs_tin : (data.bursTin !== undefined ? data.bursTin : data.tinNumber);
    if (bursTin !== undefined) {
      params.push(bursTin ? String(bursTin).trim() : null);
      fields.push(`burs_tin = $${params.length}`);
    }

    // 5. ppra_registration_no
    const ppraReg = data.ppra_registration_no !== undefined ? data.ppra_registration_no : (data.ppraRegistrationNo !== undefined ? data.ppraRegistrationNo : data.ppraCode);
    if (ppraReg !== undefined) {
      params.push(ppraReg ? String(ppraReg).trim() : null);
      fields.push(`ppra_registration_no = $${params.length}`);
    }

    // 6. company_type
    const rawCompanyType = data.company_type !== undefined ? data.company_type : data.companyType;
    if (rawCompanyType !== undefined) {
      params.push(normalizeCompanyType(rawCompanyType));
      fields.push(`company_type = $${params.length}`);
    }

    // 7. year_established
    const yearEstablished = data.year_established !== undefined ? data.year_established : data.yearEstablished;
    if (yearEstablished !== undefined) {
      const num = Number(yearEstablished);
      params.push(!isNaN(num) && num > 0 ? num : null);
      fields.push(`year_established = $${params.length}`);
    }

    // 8. description
    if (data.description !== undefined) {
      params.push(data.description ? String(data.description).trim() : null);
      fields.push(`description = $${params.length}`);
    }

    // 9. physical_address
    const physicalAddress = data.physical_address !== undefined ? data.physical_address : data.physicalAddress;
    if (physicalAddress !== undefined) {
      params.push(physicalAddress ? String(physicalAddress).trim() : null);
      fields.push(`physical_address = $${params.length}`);
    }

    // 10. postal_address
    const postalAddress = data.postal_address !== undefined ? data.postal_address : data.postalAddress;
    if (postalAddress !== undefined) {
      params.push(postalAddress ? String(postalAddress).trim() : null);
      fields.push(`postal_address = $${params.length}`);
    }

    // 11. city
    if (data.city !== undefined) {
      params.push(data.city ? String(data.city).trim() : null);
      fields.push(`city = $${params.length}`);
    }

    // 12. district_id (safely resolved to geographic_districts foreign key UUID)
    const rawDistrict = (typeof data.district === 'string' && data.district.trim())
      ? data.district.trim()
      : (typeof data.district_id === 'string' && data.district_id.trim())
        ? data.district_id.trim()
        : (typeof data.districtId === 'string' && data.districtId.trim())
          ? data.districtId.trim()
          : (data.district !== undefined ? data.district : (data.district_id !== undefined ? data.district_id : data.districtId));
    if (rawDistrict !== undefined) {
      const resolvedDistrictId = await resolveDistrictId(rawDistrict);
      params.push(resolvedDistrictId);
      fields.push(`district_id = $${params.length}`);
    }

    // 13. primary_phone
    const primaryPhone = data.primary_phone !== undefined ? data.primary_phone : (data.primaryPhone !== undefined ? data.primaryPhone : data.phone);
    if (primaryPhone !== undefined) {
      params.push(primaryPhone ? String(primaryPhone).trim() : null);
      fields.push(`primary_phone = $${params.length}`);
    }

    // 14. email
    if (data.email !== undefined) {
      params.push(data.email ? String(data.email).trim().toLowerCase() : null);
      fields.push(`email = $${params.length}`);
    }

    // 15. website
    if (data.website !== undefined) {
      params.push(data.website ? String(data.website).trim() : null);
      fields.push(`website = $${params.length}`);
    }

    // 16. bank_name
    const bankName = data.bank_name !== undefined ? data.bank_name : data.bankName;
    if (bankName !== undefined) {
      params.push(bankName ? String(bankName).trim() : null);
      fields.push(`bank_name = $${params.length}`);
    }

    // 17. bank_branch
    const bankBranch = data.bank_branch !== undefined ? data.bank_branch : data.bankBranch;
    if (bankBranch !== undefined) {
      params.push(bankBranch ? String(bankBranch).trim() : null);
      fields.push(`bank_branch = $${params.length}`);
    }

    // 18. account_number_masked
    const accountMasked = data.account_number_masked !== undefined
      ? data.account_number_masked
      : (data.accountNumberMasked !== undefined
          ? data.accountNumberMasked
          : (data.bankAccountNumber !== undefined ? data.bankAccountNumber : data.accountNumber));
    if (accountMasked !== undefined) {
      params.push(accountMasked ? String(accountMasked).trim() : null);
      fields.push(`account_number_masked = $${params.length}`);
    }

    // 19. citizen_owned_percentage
    const citizenPct = data.citizen_owned_percentage !== undefined ? data.citizen_owned_percentage : data.citizenOwnedPercentage;
    if (citizenPct !== undefined) {
      const num = Number(citizenPct);
      params.push(!isNaN(num) ? num : 0);
      fields.push(`citizen_owned_percentage = $${params.length}`);
    }

    // 20. youth_owned
    const youthOwned = data.youth_owned !== undefined ? data.youth_owned : data.youthOwned;
    if (youthOwned !== undefined) {
      params.push(Boolean(youthOwned));
      fields.push(`youth_owned = $${params.length}`);
    }

    // 21. women_owned
    const womenOwned = data.women_owned !== undefined ? data.women_owned : data.womenOwned;
    if (womenOwned !== undefined) {
      params.push(Boolean(womenOwned));
      fields.push(`women_owned = $${params.length}`);
    }

    // 22. disability_owned
    const disabilityOwned = data.disability_owned !== undefined ? data.disability_owned : data.disabilityOwned;
    if (disabilityOwned !== undefined) {
      params.push(Boolean(disabilityOwned));
      fields.push(`disability_owned = $${params.length}`);
    }

    // 23. edd_certified
    const eddCertified = data.edd_certified !== undefined ? data.edd_certified : data.eddCertified;
    if (eddCertified !== undefined) {
      params.push(Boolean(eddCertified));
      fields.push(`edd_certified = $${params.length}`);
    }

    // 24. profile_completeness
    const profileCompleteness = data.profile_completeness !== undefined ? data.profile_completeness : data.profileCompleteness;
    if (profileCompleteness !== undefined) {
      const num = Math.min(100, Math.max(0, Math.round(Number(profileCompleteness) || 0)));
      params.push(num);
      fields.push(`profile_completeness = $${params.length}`);
    }

    // 25. compliance_status
    const rawComplianceStatus = data.compliance_status !== undefined ? data.compliance_status : data.complianceStatus;
    if (rawComplianceStatus !== undefined) {
      params.push(normalizeComplianceStatus(rawComplianceStatus));
      fields.push(`compliance_status = $${params.length}`);
    }

    // Optional auxiliary attributes:
    if (data.edd_certificate_no !== undefined || data.eddCertificateNo !== undefined) {
      const eddNo = data.edd_certificate_no !== undefined ? data.edd_certificate_no : data.eddCertificateNo;
      params.push(eddNo ? String(eddNo).trim() : null);
      fields.push(`edd_certificate_no = $${params.length}`);
    }

    if (data.missing_items !== undefined || data.missingItems !== undefined) {
      const missing = data.missing_items !== undefined ? data.missing_items : data.missingItems;
      params.push(Array.isArray(missing) ? missing : []);
      fields.push(`missing_items = $${params.length}`);
    }

    // 26. has_trading_licence
    const hasTradingLicence = data.has_trading_licence !== undefined ? data.has_trading_licence : data.hasTradingLicence;
    if (hasTradingLicence !== undefined) {
      params.push(hasTradingLicence === null ? null : Boolean(hasTradingLicence));
      fields.push(`has_trading_licence = $${params.length}`);
    }

    // 27. trading_licence_reason
    const tradingLicenceReason = data.trading_licence_reason !== undefined ? data.trading_licence_reason : data.tradingLicenceReason;
    if (tradingLicenceReason !== undefined) {
      params.push(tradingLicenceReason ? String(tradingLicenceReason).trim() : null);
      fields.push(`trading_licence_reason = $${params.length}`);
    }

    if (!fields.length) {
      const current = await this.getById(supplierId);
      if (!current) throw new Error('Supplier not found.');
      return current;
    }

    fields.push(`updated_at = NOW()`);

    await query(
      `UPDATE suppliers SET ${fields.join(', ')} WHERE id = $1`,
      params
    );

    const hasExplicitCompleteness = (data.profile_completeness !== undefined || data.profileCompleteness !== undefined);
    if (!hasExplicitCompleteness) {
      await this.calculateCompleteness(supplierId);
    }
    const updated = await this.getById(supplierId);
    if (!updated) throw new Error('Supplier not found after update.');
    return updated;
  }

  async listPeople(supplierId: string): Promise<SupplierPerson[]> {
    const res = await query<SupplierPerson>(
      `SELECT id, supplier_id AS "supplierId", full_name AS "fullName",
              person_role AS "personRole", ownership_percent AS "ownershipPercent",
              identity_type AS "identityType", nationality, is_citizen AS "isCitizen",
              email, phone, national_identity_hash AS "nationalIdOrPassport",
              national_identity_hash AS "idNumber", kyc_status AS "kycStatus"
       FROM supplier_people
       WHERE supplier_id = $1 AND is_active = TRUE
       ORDER BY created_at ASC`,
      [supplierId]
    );
    return res.rows;
  }

  async addPerson(supplierId: string, person: { fullName: string; personRole: string; email?: string; phone?: string; ownershipPercent?: number; nationality?: string; isCitizen?: boolean; identityType?: string; idNumber?: string; nationalIdOrPassport?: string }): Promise<SupplierPerson> {
    const ownership = person.ownershipPercent !== undefined && !isNaN(Number(person.ownershipPercent)) ? Number(person.ownershipPercent) : 0;
    const nationalId = person.idNumber || person.nationalIdOrPassport || null;
    const res = await query<SupplierPerson>(
      `INSERT INTO supplier_people (supplier_id, full_name, person_role, email, phone, ownership_percent, nationality, is_citizen, identity_type, national_identity_hash, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE)
       RETURNING id, supplier_id AS "supplierId", full_name AS "fullName",
                 person_role AS "personRole", ownership_percent AS "ownershipPercent",
                 identity_type AS "identityType", nationality, is_citizen AS "isCitizen",
                 email, phone, national_identity_hash AS "nationalIdOrPassport",
                 national_identity_hash AS "idNumber", kyc_status AS "kycStatus"`,
      [
        supplierId,
        person.fullName.trim(),
        person.personRole,
        person.email || null,
        person.phone || null,
        ownership,
        person.nationality || 'Motswana',
        person.isCitizen ?? true,
        person.identityType || 'OMANG',
        nationalId,
      ]
    );
    return res.rows[0];
  }

  async updatePerson(
    supplierId: string,
    personId: string,
    person: {
      fullName?: string;
      personRole?: string;
      email?: string;
      phone?: string;
      ownershipPercent?: number;
      nationality?: string;
      isCitizen?: boolean;
      identityType?: string;
      idNumber?: string;
      nationalIdOrPassport?: string;
    }
  ): Promise<SupplierPerson | null> {
    const nationalId = person.idNumber !== undefined ? person.idNumber : person.nationalIdOrPassport;
    const res = await query<SupplierPerson>(
      `UPDATE supplier_people
       SET full_name = COALESCE($3, full_name),
           person_role = COALESCE($4, person_role),
           email = COALESCE($5, email),
           phone = COALESCE($6, phone),
           ownership_percent = COALESCE($7, ownership_percent),
           nationality = COALESCE($8, nationality),
           is_citizen = COALESCE($9, is_citizen),
           identity_type = COALESCE($10, identity_type),
           national_identity_hash = COALESCE($11, national_identity_hash),
           updated_at = NOW()
       WHERE id = $2 AND supplier_id = $1
       RETURNING id, supplier_id AS "supplierId", full_name AS "fullName",
                 person_role AS "personRole", ownership_percent AS "ownershipPercent",
                 identity_type AS "identityType", nationality, is_citizen AS "isCitizen",
                 email, phone, national_identity_hash AS "nationalIdOrPassport",
                 national_identity_hash AS "idNumber", kyc_status AS "kycStatus"`,
      [
        supplierId,
        personId,
        person.fullName ? person.fullName.trim() : null,
        person.personRole || null,
        person.email || null,
        person.phone || null,
        person.ownershipPercent !== undefined && !isNaN(Number(person.ownershipPercent)) ? Number(person.ownershipPercent) : null,
        person.nationality || null,
        person.isCitizen !== undefined ? person.isCitizen : null,
        person.identityType || null,
        nationalId !== undefined ? nationalId : null,
      ]
    );
    return res.rows[0] || null;
  }

  async deletePerson(supplierId: string, personId: string): Promise<boolean> {
    const res = await query(
      `DELETE FROM supplier_people WHERE id = $1 AND supplier_id = $2`,
      [personId, supplierId]
    );
    if ((res.rowCount || 0) > 0) {
      await this.calculateCompleteness(supplierId);
      return true;
    }
    return false;
  }

  async listProjects(supplierId: string): Promise<SupplierProject[]> {
    const res = await query<SupplierProject>(
      `SELECT id, supplier_id AS "supplierId", client_name AS "clientName",
              project_title AS "projectTitle", description, contract_value AS "contractValue",
              currency, start_date AS "startDate", end_date AS "endDate",
              reference_name AS "referenceName", reference_contact AS "referenceContact",
              reference_verified AS "referenceVerified"
       FROM supplier_projects
       WHERE supplier_id = $1
       ORDER BY start_date DESC NULLS LAST, created_at DESC`,
      [supplierId]
    );
    return res.rows;
  }

  async addProject(supplierId: string, project: { clientName: string; projectTitle: string; contractValue?: number; currency?: string; description?: string; referenceName?: string; referenceContact?: string }): Promise<SupplierProject> {
    const res = await query<SupplierProject>(
      `INSERT INTO supplier_projects (supplier_id, client_name, project_title, contract_value, currency, description, reference_name, reference_contact)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, supplier_id AS "supplierId", client_name AS "clientName",
                 project_title AS "projectTitle", description, contract_value AS "contractValue",
                 currency, start_date AS "startDate", end_date AS "endDate",
                 reference_name AS "referenceName", reference_contact AS "referenceContact",
                 reference_verified AS "referenceVerified"`,
      [supplierId, project.clientName.trim(), project.projectTitle.trim(), project.contractValue || null, project.currency || 'BWP', project.description || null, project.referenceName || null, project.referenceContact || null]
    );
    return res.rows[0];
  }

  async getDisciplines(supplierId: string): Promise<SupplierDisciplineAllocation[]> {
    const res = await query<SupplierDisciplineAllocation>(
      `SELECT sda.id, sda.supplier_id AS "supplierId", sda.discipline_id AS "disciplineId",
              pd.code AS "disciplineCode", pd.title AS "disciplineTitle",
              sda.capability_tier_id AS "capabilityTierId", ct.code AS "capabilityTierCode", ct.name AS "capabilityTierName",
              sda.is_primary AS "isPrimary"
       FROM supplier_discipline_allocations sda
       JOIN procurement_disciplines pd ON pd.id = sda.discipline_id
       LEFT JOIN capability_tiers ct ON ct.id = sda.capability_tier_id
       WHERE sda.supplier_id = $1
       ORDER BY sda.is_primary DESC, pd.code ASC`,
      [supplierId]
    );
    return res.rows;
  }
}

export const suppliersRepository = new SuppliersRepository();
