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

export interface CategoryTreeNode {
  id: string;
  code: string;
  name: string;
  description: string | null;
  level: number;
  parentId: string | null;
  sortOrder: number;
  children: {
    id: string;
    code: string;
    name: string;
    description: string | null;
    level: number;
    parentId: string | null;
    sortOrder: number;
  }[];
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

// Per-instance in-memory cache: 5 minutes, keyed by reference name,
// ONLY populated for non-empty successful database results. Never caches errors or empty results.
const CACHE_TTL_MS = 5 * 60 * 1000;
const referenceCache = new Map<string, { rows: any[]; expiresAt: number }>();

export function clearReferenceCache(key?: string): void {
  if (key) {
    referenceCache.delete(key);
  } else {
    referenceCache.clear();
  }
}

async function cachedReferenceQuery<T>(key: string, fetcher: () => Promise<T[]>): Promise<T[]> {
  const entry = referenceCache.get(key);
  if (entry && entry.expiresAt > Date.now()) {
    console.log('[ref] cache hit', key);
    return entry.rows as T[];
  }
  if (entry) {
    referenceCache.delete(key);
  }

  const rows = await fetcher();
  if (Array.isArray(rows) && rows.length > 0) {
    referenceCache.set(key, {
      rows,
      expiresAt: Date.now() + CACHE_TTL_MS,
    });
  }
  return rows;
}

export class ReferenceRepository {
  async getDistricts(): Promise<GeographicDistrict[]> {
    return cachedReferenceQuery<GeographicDistrict>('districts', async () => {
      const res = await query<GeographicDistrict>(
        `SELECT id, name, administrative_region AS "administrativeRegion", country_code AS "countryCode", sort_order AS "sortOrder"
         FROM geographic_districts WHERE is_active = TRUE ORDER BY sort_order ASC, name ASC`
      );
      return res.rows;
    });
  }

  async getDocumentTypes(): Promise<DocumentType[]> {
    return cachedReferenceQuery<DocumentType>('documentTypes', async () => {
      const res = await query<DocumentType>(
        `SELECT id, organization_id AS "organizationId", code, name, description, issuing_authority AS "issuingAuthority",
                requires_expiry AS "requiresExpiry", requires_number AS "requiresNumber", default_validity_days AS "defaultValidityDays",
                max_file_size_mb AS "maxFileSizeMb", allowed_mime_types AS "allowedMimeTypes",
                verification_method AS "verificationMethod", is_mandatory_default AS "isMandatoryDefault", sort_order AS "sortOrder"
         FROM document_types WHERE is_active = TRUE ORDER BY sort_order ASC, name ASC`
      );
      return res.rows;
    });
  }

  async getDisciplines(): Promise<ProcurementDiscipline[]> {
    return cachedReferenceQuery<ProcurementDiscipline>('disciplines', async () => {
      const res = await query<ProcurementDiscipline>(
        `SELECT id, code, title, description, sort_order AS "sortOrder"
         FROM procurement_disciplines WHERE is_active = TRUE ORDER BY sort_order ASC, code ASC`
      );
      return res.rows;
    });
  }

  async getCapabilityTiers(): Promise<CapabilityTier[]> {
    return cachedReferenceQuery<CapabilityTier>('capabilityTiers', async () => {
      const res = await query<CapabilityTier>(
        `SELECT id, code, name, description, min_contract_value AS "minContractValue", max_contract_value AS "maxContractValue", sort_order AS "sortOrder"
         FROM capability_tiers ORDER BY sort_order ASC`
      );
      return res.rows;
    });
  }

  async getPlans(): Promise<Plan[]> {
    return cachedReferenceQuery<Plan>('plans', async () => {
      const res = await query<Plan>(
        `SELECT id, code, name, audience, price, currency, billing_interval AS "billingInterval",
                max_users AS "maxUsers", max_calls_per_year AS "maxCallsPerYear", features, sort_order AS "sortOrder"
         FROM plans WHERE is_active = TRUE ORDER BY sort_order ASC`
      );
      return res.rows;
    });
  }

  async getPermissions(): Promise<Permission[]> {
    return cachedReferenceQuery<Permission>('permissions', async () => {
      const res = await query<Permission>(
        `SELECT id, code, scope, category, description FROM permissions ORDER BY scope ASC, category ASC, code ASC`
      );
      return res.rows;
    });
  }

  async getRoles(): Promise<Role[]> {
    return cachedReferenceQuery<Role>('roles', async () => {
      const res = await query<Role>(
        `SELECT id, scope, organization_id AS "organizationId", name, description, color, is_system AS "isSystem", approval_limit_bwp AS "approvalLimitBwp"
         FROM roles WHERE is_system = TRUE ORDER BY scope ASC, sort_order ASC, name ASC`
      );
      return res.rows;
    });
  }

  async getFinancialConfigs(): Promise<PlatformFinancialConfig[]> {
    return cachedReferenceQuery<PlatformFinancialConfig>('financialConfigs', async () => {
      const res = await query<PlatformFinancialConfig>(
        `SELECT id, config_key AS "configKey", config_value AS "configValue", description
         FROM platform_financial_configs`
      );
      return res.rows;
    });
  }

  async getNotificationTemplates(): Promise<NotificationTemplate[]> {
    return cachedReferenceQuery<NotificationTemplate>('notificationTemplates', async () => {
      const res = await query<NotificationTemplate>(
        `SELECT id, organization_id AS "organizationId", code, channel, locale, subject, body, variables
         FROM notification_templates WHERE is_active = TRUE`
      );
      return res.rows;
    });
  }

  /**
   * Loads all reference data from PostgreSQL in parallel.
   * Throws on any database error; never returns fallback or empty cached data.
   */
  async loadAll(): Promise<FullReferenceData> {
    const [
      districts,
      documentTypes,
      disciplines,
      capabilityTiers,
      plans,
      permissions,
      roles,
      financialConfigs,
      notificationTemplates,
    ] = await Promise.all([
      this.getDistricts(),
      this.getDocumentTypes(),
      this.getDisciplines(),
      this.getCapabilityTiers(),
      this.getPlans(),
      this.getPermissions(),
      this.getRoles(),
      this.getFinancialConfigs(),
      this.getNotificationTemplates(),
    ]);

    return {
      districts,
      documentTypes,
      disciplines,
      capabilityTiers,
      plans,
      permissions,
      roles,
      financialConfigs,
      notificationTemplates,
      loadedAt: new Date().toISOString(),
    };
  }

  /**
   * Loads category codes and sub-codes from the PostgreSQL categories table
   * structured as hierarchical category tree nodes.
   * Throws on any database error; never returns hardcoded rows.
   */
  async getCategoriesTree(): Promise<CategoryTreeNode[]> {
    return cachedReferenceQuery<CategoryTreeNode>('categories', async () => {
      const res = await query<{
        id: string;
        parentId: string | null;
        code: string;
        name: string;
        description: string | null;
        level: number;
        sortOrder: number;
      }>(
        `SELECT id, parent_id AS "parentId", code, name, description, level, sort_order AS "sortOrder"
         FROM categories
         WHERE is_active = TRUE
         ORDER BY level ASC, sort_order ASC, code ASC`
      );

      const rows = res.rows;
      const level1 = rows.filter((r) => r.level === 1);
      const level2 = rows.filter((r) => r.level === 2);

      return level1.map((parent) => {
        const children = level2
          .filter(
            (c) =>
              c.parentId === parent.id ||
              (c.code && parent.code && c.code.startsWith(parent.code + '_'))
          )
          .map((c) => ({
            id: c.id,
            code: c.code,
            name: c.name,
            description: c.description,
            level: c.level,
            parentId: c.parentId,
            sortOrder: c.sortOrder,
          }));

        return {
          id: parent.id,
          code: parent.code,
          name: parent.name,
          description: parent.description,
          level: parent.level,
          parentId: parent.parentId,
          sortOrder: parent.sortOrder,
          children,
        };
      });
    });
  }
}

export const referenceRepository = new ReferenceRepository();
