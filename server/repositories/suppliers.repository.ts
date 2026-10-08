import { query, withTransaction } from '../db/client';

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

export class SuppliersRepository {
  async calculateCompleteness(supplierId: string): Promise<number> {
    try {
      const sRes = await query(
        `SELECT s.legal_name, s.trading_name, s.burs_tin, s.physical_address, s.city, s.district_id,
                s.primary_phone, s.email, s.bank_name, s.bank_branch, s.account_number_masked AS bank_account_number,
                s.citizen_owned_percentage
         FROM suppliers s WHERE s.id = $1`,
        [supplierId]
      );
      if (sRes.rows.length === 0) return 0;
      const s = sRes.rows[0];

      let completedCount = 0;

      // 10 Company items
      if (s.legal_name && s.legal_name.trim()) completedCount++;
      if (s.trading_name && s.trading_name.trim()) completedCount++;
      if (s.burs_tin && s.burs_tin.trim()) completedCount++;
      if (s.physical_address && s.physical_address.trim()) completedCount++;
      if (s.city && s.city.trim()) completedCount++;
      if (s.district_id) completedCount++;
      if (s.primary_phone && s.primary_phone.trim()) completedCount++;
      if (s.email && s.email.trim()) completedCount++;
      if (s.bank_name && (s.bank_branch || s.bank_account_number)) completedCount++;
      if (s.citizen_owned_percentage !== null && Number(s.citizen_owned_percentage) > 0) completedCount++;

      // 1 People item: at least 1 director with sum ownership = 100%
      const pRes = await query(
        `SELECT ownership_percent FROM supplier_people WHERE supplier_id = $1 AND is_active = TRUE`,
        [supplierId]
      );
      if (pRes.rows.length > 0) {
        const totalOwnership = pRes.rows.reduce((sum: number, r: any) => sum + (parseFloat(r.ownership_percent) || 0), 0);
        if (Math.round(totalOwnership) === 100) {
          completedCount++;
        }
      }

      // 4 Document items: CIPA, Tax Clearance, Workers Comp, Public Liability
      const dRes = await query(
        `SELECT dt.code, dt.name, sd.status, sdv.expiry_date AS valid_until
         FROM supplier_documents sd
         JOIN document_types dt ON dt.id = sd.document_type_id
         LEFT JOIN supplier_document_versions sdv ON sdv.id = sd.current_version_id
         WHERE sd.supplier_id = $1 AND sd.status != 'rejected'`,
        [supplierId]
      );

      const isValid = (keywords: string[]) => {
        return dRes.rows.some((d: any) => {
          const name = ((d.code || '') + ' ' + (d.name || '')).toLowerCase();
          const matches = keywords.some((k: string) => name.includes(k.toLowerCase()));
          if (!matches) return false;
          if (d.status === 'expired') return false;
          if (d.valid_until && new Date(d.valid_until) < new Date()) return false;
          return true;
        });
      };

      if (isValid(['cipa', 'incorporation', 'company_reg'])) completedCount++;
      if (isValid(['tax', 'burs'])) completedCount++;
      if (isValid(['safety', 'compensation', 'wca'])) completedCount++;
      if (isValid(['insurance', 'liability'])) completedCount++;

      return Math.round((completedCount / 15) * 100);
    } catch (err) {
      console.warn('[RECALCULATE COMPLETENESS ERROR]', err);
      return 0;
    }
  }

  async getById(supplierId: string): Promise<SupplierProfile | null> {
    const score = await this.calculateCompleteness(supplierId);
    await query(
      `UPDATE suppliers SET profile_completeness = $1 WHERE id = $2`,
      [score, supplierId]
    );

    const res = await query<SupplierProfile>(
      `SELECT s.id, s.legal_name AS "legalName", s.trading_name AS "tradingName",
              s.cipa_uin AS "cipaUin", s.cipa_uin AS "cipaNumber", s.burs_tin AS "bursTin", s.burs_tin AS "tinNumber",
              s.ppra_registration_no AS "ppraRegistrationNo", s.ppra_registration_no AS "ppraCode",
              s.company_type AS "companyType", s.year_established AS "yearEstablished", s.description,
              s.physical_address AS "physicalAddress", s.postal_address AS "postalAddress", s.city,
              s.district_id AS "districtId", gd.name AS "districtName",
              s.primary_phone AS "primaryPhone", s.email, s.website,
              s.bank_name AS "bankName", s.bank_branch AS "bankBranch", s.account_number_masked AS "accountNumberMasked",
              s.employee_count_band AS "employeeCountBand", s.citizen_owned_percentage AS "citizenOwnedPercentage",
              s.youth_owned AS "youthOwned", s.women_owned AS "womenOwned", s.disability_owned AS "disabilityOwned",
              s.edd_certified AS "eddCertified", s.edd_certificate_no AS "eddCertificateNo", s.edd_valid_until AS "eddValidUntil",
              s.status, s.verification_status AS "verificationStatus", s.compliance_status AS "complianceStatus",
              s.profile_completeness AS "profileCompleteness"
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

    if (data.legalName !== undefined) {
      params.push(data.legalName);
      fields.push(`legal_name = $${params.length}`);
    }
    if (data.tradingName !== undefined) {
      params.push(data.tradingName);
      fields.push(`trading_name = $${params.length}`);
    }
    if (data.bursTin !== undefined || data.tinNumber !== undefined) {
      params.push(data.bursTin || data.tinNumber);
      fields.push(`burs_tin = $${params.length}`);
    }
    if (data.cipaUin !== undefined || data.cipaNumber !== undefined) {
      params.push(data.cipaUin || data.cipaNumber);
      fields.push(`cipa_uin = $${params.length}`);
    }
    if (data.ppraRegistrationNo !== undefined || data.ppraCode !== undefined) {
      params.push(data.ppraRegistrationNo || data.ppraCode);
      fields.push(`ppra_registration_no = $${params.length}`);
    }
    if (data.bankName !== undefined) {
      params.push(data.bankName);
      fields.push(`bank_name = $${params.length}`);
    }
    if (data.bankBranch !== undefined) {
      params.push(data.bankBranch);
      fields.push(`bank_branch = $${params.length}`);
    }
    if (data.accountNumberMasked !== undefined) {
      params.push(data.accountNumberMasked);
      fields.push(`account_number_masked = $${params.length}`);
    }
    if (data.companyType !== undefined) {
      params.push(data.companyType);
      fields.push(`company_type = $${params.length}`);
    }
    if (data.yearEstablished !== undefined) {
      params.push(data.yearEstablished);
      fields.push(`year_established = $${params.length}`);
    }
    if (data.description !== undefined) {
      params.push(data.description);
      fields.push(`description = $${params.length}`);
    }
    if (data.physicalAddress !== undefined) {
      params.push(data.physicalAddress);
      fields.push(`physical_address = $${params.length}`);
    }
    if (data.postalAddress !== undefined) {
      params.push(data.postalAddress);
      fields.push(`postal_address = $${params.length}`);
    }
    if (data.city !== undefined) {
      params.push(data.city);
      fields.push(`city = $${params.length}`);
    }
    if (data.districtId !== undefined || data.district !== undefined) {
      params.push(data.districtId || data.district);
      fields.push(`district_id = $${params.length}`);
    }
    if (data.primaryPhone !== undefined) {
      params.push(data.primaryPhone);
      fields.push(`primary_phone = $${params.length}`);
    }
    if (data.email !== undefined) {
      params.push(data.email);
      fields.push(`email = $${params.length}`);
    }
    if (data.website !== undefined) {
      params.push(data.website);
      fields.push(`website = $${params.length}`);
    }
    if (data.citizenOwnedPercentage !== undefined) {
      params.push(data.citizenOwnedPercentage);
      fields.push(`citizen_owned_percentage = $${params.length}`);
    }
    if (data.youthOwned !== undefined) {
      params.push(data.youthOwned);
      fields.push(`youth_owned = $${params.length}`);
    }
    if (data.womenOwned !== undefined) {
      params.push(data.womenOwned);
      fields.push(`women_owned = $${params.length}`);
    }
    if (data.disabilityOwned !== undefined) {
      params.push(data.disabilityOwned);
      fields.push(`disability_owned = $${params.length}`);
    }
    if (data.eddCertified !== undefined) {
      params.push(data.eddCertified);
      fields.push(`edd_certified = $${params.length}`);
    }
    if (data.eddCertificateNo !== undefined) {
      params.push(data.eddCertificateNo);
      fields.push(`edd_certificate_no = $${params.length}`);
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

    const updated = await this.getById(supplierId);
    if (!updated) throw new Error('Supplier not found after update.');
    return updated;
  }

  async listPeople(supplierId: string): Promise<SupplierPerson[]> {
    const res = await query<SupplierPerson>(
      `SELECT id, supplier_id AS "supplierId", full_name AS "fullName",
              person_role AS "personRole", ownership_percent AS "ownershipPercent",
              identity_type AS "identityType", nationality, is_citizen AS "isCitizen",
              email, phone, kyc_status AS "kycStatus"
       FROM supplier_people
       WHERE supplier_id = $1 AND is_active = TRUE
       ORDER BY created_at ASC`,
      [supplierId]
    );
    return res.rows;
  }

  async addPerson(supplierId: string, person: { fullName: string; personRole: string; email?: string; phone?: string; ownershipPercent?: number }): Promise<SupplierPerson> {
    const res = await query<SupplierPerson>(
      `INSERT INTO supplier_people (supplier_id, full_name, person_role, email, phone, ownership_percent, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE)
       RETURNING id, supplier_id AS "supplierId", full_name AS "fullName",
                 person_role AS "personRole", ownership_percent AS "ownershipPercent",
                 identity_type AS "identityType", nationality, is_citizen AS "isCitizen",
                 email, phone, kyc_status AS "kycStatus"`,
      [supplierId, person.fullName.trim(), person.personRole, person.email || null, person.phone || null, person.ownershipPercent || null]
    );
    return res.rows[0];
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
