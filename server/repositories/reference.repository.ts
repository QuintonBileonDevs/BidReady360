import { query } from '../db/client';

export interface GeographicDistrict {
  id: string;
  name: string;
  administrativeRegion: string | null;
  countryCode: string;
  sortOrder: number;
}

export interface DocumentType {
  id: string;
  organizationId: string | null;
  code: string;
  name: string;
  description: string | null;
  issuingAuthority: string | null;
  requiresExpiry: boolean;
  defaultValidityDays: number | null;
  maxFileSizeMb: number;
  allowedMimeTypes: string[] | null;
  verificationMethod: string;
  isMandatoryDefault: boolean;
  sortOrder: number;
}

export interface ProcurementDiscipline {
  id: string;
  code: string;
  title: string;
  description: string | null;
  sortOrder: number;
}

export interface CapabilityTier {
  id: string;
  code: string;
  name: string;
  description: string | null;
  minContractValue: string | null;
  maxContractValue: string | null;
  sortOrder: number;
}

export interface Plan {
  id: string;
  code: string;
  name: string;
  audience: 'buyer' | 'supplier';
  price: string;
  currency: string;
  billingInterval: 'monthly' | 'yearly';
  maxUsers: number | null;
  maxCallsPerYear: number | null;
  features: Record<string, any> | null;
  sortOrder: number;
}

export interface Permission {
  id: string;
  code: string;
  scope: 'organization' | 'supplier' | 'platform';
  category: string;
  description: string | null;
}

export interface Role {
  id: string;
  scope: 'organization' | 'supplier';
  organizationId: string | null;
  name: string;
  description: string | null;
  color: string | null;
  isSystem: boolean;
  approvalLimitBwp: string | null;
}

export interface PlatformFinancialConfig {
  id: string;
  configKey: string;
  configValue: any;
  description: string | null;
}

export interface NotificationTemplate {
  id: string;
  organizationId: string | null;
  code: string;
  channel: 'email' | 'sms' | 'whatsapp' | 'in_app';
  locale: string;
  subject: string | null;
  body: string;
  variables: string[] | null;
}

export interface FullReferenceData {
  districts: GeographicDistrict[];
  documentTypes: DocumentType[];
  disciplines: ProcurementDiscipline[];
  capabilityTiers: CapabilityTier[];
  plans: Plan[];
  permissions: Permission[];
  roles: Role[];
  financialConfigs: PlatformFinancialConfig[];
  notificationTemplates: NotificationTemplate[];
  loadedAt: string;
}

export class ReferenceRepository {
  /**
   * Loads all reference data from PostgreSQL in parallel.
   */
  async loadAll(): Promise<FullReferenceData> {
    const [
      districtsRes,
      docTypesRes,
      disciplinesRes,
      tiersRes,
      plansRes,
      permsRes,
      rolesRes,
      finConfigsRes,
      notifTemplatesRes,
    ] = await Promise.all([
      query<GeographicDistrict>(
        `SELECT id, name, administrative_region AS "administrativeRegion", country_code AS "countryCode", sort_order AS "sortOrder"
         FROM geographic_districts WHERE is_active = TRUE ORDER BY sort_order ASC, name ASC`
      ),
      query<DocumentType>(
        `SELECT id, organization_id AS "organizationId", code, name, description, issuing_authority AS "issuingAuthority",
                requires_expiry AS "requiresExpiry", default_validity_days AS "defaultValidityDays",
                max_file_size_mb AS "maxFileSizeMb", allowed_mime_types AS "allowedMimeTypes",
                verification_method AS "verificationMethod", is_mandatory_default AS "isMandatoryDefault", sort_order AS "sortOrder"
         FROM document_types WHERE is_active = TRUE ORDER BY sort_order ASC, name ASC`
      ),
      query<ProcurementDiscipline>(
        `SELECT id, code, title, description, sort_order AS "sortOrder"
         FROM procurement_disciplines WHERE is_active = TRUE ORDER BY sort_order ASC, code ASC`
      ),
      query<CapabilityTier>(
        `SELECT id, code, name, description, min_contract_value AS "minContractValue", max_contract_value AS "maxContractValue", sort_order AS "sortOrder"
         FROM capability_tiers ORDER BY sort_order ASC`
      ),
      query<Plan>(
        `SELECT id, code, name, audience, price, currency, billing_interval AS "billingInterval",
                max_users AS "maxUsers", max_calls_per_year AS "maxCallsPerYear", features, sort_order AS "sortOrder"
         FROM plans WHERE is_active = TRUE ORDER BY sort_order ASC`
      ),
      query<Permission>(
        `SELECT id, code, scope, category, description FROM permissions ORDER BY scope ASC, category ASC, code ASC`
      ),
      query<Role>(
        `SELECT id, scope, organization_id AS "organizationId", name, description, color, is_system AS "isSystem", approval_limit_bwp AS "approvalLimitBwp"
         FROM roles WHERE is_system = TRUE ORDER BY scope ASC, sort_order ASC, name ASC`
      ),
      query<PlatformFinancialConfig>(
        `SELECT id, config_key AS "configKey", config_value AS "configValue", description
         FROM platform_financial_configs`
      ),
      query<NotificationTemplate>(
        `SELECT id, organization_id AS "organizationId", code, channel, locale, subject, body, variables
         FROM notification_templates WHERE is_active = TRUE`
      ),
    ]);

    return {
      districts: districtsRes.rows,
      documentTypes: docTypesRes.rows,
      disciplines: disciplinesRes.rows,
      capabilityTiers: tiersRes.rows,
      plans: plansRes.rows,
      permissions: permsRes.rows,
      roles: rolesRes.rows,
      financialConfigs: finConfigsRes.rows,
      notificationTemplates: notifTemplatesRes.rows,
      loadedAt: new Date().toISOString(),
    };
  }
}

export const referenceRepository = new ReferenceRepository();
