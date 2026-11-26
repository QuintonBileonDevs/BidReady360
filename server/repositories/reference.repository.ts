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
  requiresNumber: boolean;
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
  private docTypesHasRequiresNumber: boolean | null = null;

  private async hasDocumentTypesRequiresNumber(): Promise<boolean> {
    if (this.docTypesHasRequiresNumber === true) return true;
    const res = await query<{ exists: boolean }>(
      `SELECT EXISTS (
         SELECT 1
         FROM information_schema.columns
         WHERE table_schema = 'public'
           AND table_name = 'document_types'
           AND column_name = 'requires_number'
       ) AS exists`
    );
    const exists = Boolean(res.rows[0]?.exists);
    if (exists) this.docTypesHasRequiresNumber = true;
    return exists;
  }

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
      const hasRequiresNumber = await this.hasDocumentTypesRequiresNumber();
      const requiresNumberSelect = hasRequiresNumber
        ? 'requires_number AS "requiresNumber"'
        : 'TRUE AS "requiresNumber"';
      const res = await query<DocumentType>(
        `SELECT id, organization_id AS "organizationId", code, name, description, issuing_authority AS "issuingAuthority",
                requires_expiry AS "requiresExpiry", ${requiresNumberSelect}, default_validity_days AS "defaultValidityDays",
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

  // =========================================================================
  // Admin Catalogue & Plan Management (with cache invalidation)
  // =========================================================================

  async listAllCategoriesAdmin(): Promise<any[]> {
    const res = await query(
      `SELECT id, parent_id AS "parentId", code, name, description, level,
              sort_order AS "sortOrder", is_active AS "isActive",
              created_at AS "createdAt", updated_at AS "updatedAt"
       FROM categories
       WHERE organization_id IS NULL
       ORDER BY level ASC, sort_order ASC, code ASC`
    );
    return res.rows;
  }

  async createCategory(data: {
    code: string;
    name: string;
    description?: string | null;
    parentId?: string | null;
    level?: number;
    sortOrder?: number;
  }): Promise<any> {
    const code = data.code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '_');
    const name = data.name.trim();
    const level = data.parentId ? Math.max(2, Number(data.level) || 2) : Math.max(1, Math.min(5, Number(data.level) || 1));
    const sortOrder = Number(data.sortOrder) || 0;
    const res = await query(
      `INSERT INTO categories (parent_id, organization_id, code, name, description, level, sort_order, is_active)
       VALUES ($1, NULL, $2, $3, $4, $5, $6, TRUE)
       RETURNING id, parent_id AS "parentId", code, name, description, level,
                 sort_order AS "sortOrder", is_active AS "isActive"`,
      [data.parentId || null, code, name, data.description?.trim() || null, level, sortOrder]
    );
    clearReferenceCache('categories');
    return res.rows[0];
  }

  async updateCategory(
    id: string,
    data: { name?: string; description?: string | null; isActive?: boolean; sortOrder?: number }
  ): Promise<any | null> {
    const res = await query(
      `UPDATE categories
       SET name = COALESCE($2, name),
           description = CASE WHEN $3::boolean THEN $4 ELSE description END,
           is_active = COALESCE($5, is_active),
           sort_order = COALESCE($6, sort_order),
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, parent_id AS "parentId", code, name, description, level,
                 sort_order AS "sortOrder", is_active AS "isActive"`,
      [
        id,
        data.name !== undefined ? data.name.trim() : null,
        data.description !== undefined,
        data.description !== undefined ? (data.description ? data.description.trim() : null) : null,
        data.isActive !== undefined ? Boolean(data.isActive) : null,
        data.sortOrder !== undefined ? Number(data.sortOrder) : null,
      ]
    );
    clearReferenceCache('categories');
    return res.rows[0] || null;
  }

  async listAllDocumentTypesAdmin(): Promise<any[]> {
    const hasRequiresNumber = await this.hasDocumentTypesRequiresNumber();
    const requiresNumberSelect = hasRequiresNumber
      ? 'requires_number AS "requiresNumber"'
      : 'TRUE AS "requiresNumber"';
    const res = await query(
      `SELECT id, organization_id AS "organizationId", code, name, description,
              issuing_authority AS "issuingAuthority", requires_expiry AS "requiresExpiry",
              ${requiresNumberSelect}, default_validity_days AS "defaultValidityDays",
              max_file_size_mb AS "maxFileSizeMb", verification_method AS "verificationMethod",
              is_mandatory_default AS "isMandatoryDefault", is_active AS "isActive",
              sort_order AS "sortOrder"
       FROM document_types
       WHERE organization_id IS NULL
       ORDER BY sort_order ASC, name ASC`
    );
    return res.rows;
  }

  async createDocumentType(data: {
    code: string;
    name: string;
    description?: string | null;
    issuingAuthority?: string | null;
    requiresExpiry?: boolean;
    requiresNumber?: boolean;
    defaultValidityDays?: number | null;
    verificationMethod?: string;
    isMandatoryDefault?: boolean;
    sortOrder?: number;
  }): Promise<any> {
    const hasRequiresNumber = await this.hasDocumentTypesRequiresNumber();
    const code = data.code.trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '_');
    const name = data.name.trim();
    const allowedMethods = ['manual', 'registry_api', 'ai_assisted', 'hybrid'];
    const verificationMethod = allowedMethods.includes(String(data.verificationMethod || '').toLowerCase())
      ? String(data.verificationMethod).toLowerCase()
      : 'manual';

    const res = hasRequiresNumber
      ? await query(
          `INSERT INTO document_types (
             organization_id, code, name, description, issuing_authority,
             requires_expiry, requires_number, default_validity_days,
             verification_method, is_mandatory_default, is_active, sort_order
           ) VALUES (NULL, $1, $2, $3, $4, $5, $6, $7, $8, $9, TRUE, $10)
           RETURNING id, code, name, description, issuing_authority AS "issuingAuthority",
                     requires_expiry AS "requiresExpiry", requires_number AS "requiresNumber",
                     default_validity_days AS "defaultValidityDays", verification_method AS "verificationMethod",
                     is_mandatory_default AS "isMandatoryDefault", is_active AS "isActive", sort_order AS "sortOrder"`,
          [
            code,
            name,
            data.description?.trim() || null,
            data.issuingAuthority?.trim() || null,
            Boolean(data.requiresExpiry),
            data.requiresNumber !== undefined ? Boolean(data.requiresNumber) : true,
            data.defaultValidityDays ?? null,
            verificationMethod,
            Boolean(data.isMandatoryDefault),
            Number(data.sortOrder) || 0,
          ]
        )
      : await query(
          `INSERT INTO document_types (
             organization_id, code, name, description, issuing_authority,
             requires_expiry, default_validity_days,
             verification_method, is_mandatory_default, is_active, sort_order
           ) VALUES (NULL, $1, $2, $3, $4, $5, $6, $7, $8, TRUE, $9)
           RETURNING id, code, name, description, issuing_authority AS "issuingAuthority",
                     requires_expiry AS "requiresExpiry", TRUE AS "requiresNumber",
                     default_validity_days AS "defaultValidityDays", verification_method AS "verificationMethod",
                     is_mandatory_default AS "isMandatoryDefault", is_active AS "isActive", sort_order AS "sortOrder"`,
          [
            code,
            name,
            data.description?.trim() || null,
            data.issuingAuthority?.trim() || null,
            Boolean(data.requiresExpiry),
            data.defaultValidityDays ?? null,
            verificationMethod,
            Boolean(data.isMandatoryDefault),
            Number(data.sortOrder) || 0,
          ]
        );

    clearReferenceCache('documentTypes');
    return res.rows[0];
  }

  async updateDocumentType(
    id: string,
    data: {
      name?: string;
      description?: string | null;
      issuingAuthority?: string | null;
      requiresExpiry?: boolean;
      defaultValidityDays?: number | null;
      verificationMethod?: string;
      isMandatoryDefault?: boolean;
      isActive?: boolean;
    }
  ): Promise<any | null> {
    const allowedMethods = ['manual', 'registry_api', 'ai_assisted', 'hybrid'];
    const method =
      data.verificationMethod && allowedMethods.includes(data.verificationMethod.toLowerCase())
        ? data.verificationMethod.toLowerCase()
        : null;
    const hasRequiresNumber = await this.hasDocumentTypesRequiresNumber();
    const requiresNumberSelect = hasRequiresNumber
      ? 'requires_number AS "requiresNumber"'
      : 'TRUE AS "requiresNumber"';

    const res = await query(
      `UPDATE document_types
       SET name = COALESCE($2, name),
           description = CASE WHEN $3::boolean THEN $4 ELSE description END,
           issuing_authority = CASE WHEN $5::boolean THEN $6 ELSE issuing_authority END,
           requires_expiry = COALESCE($7, requires_expiry),
           default_validity_days = CASE WHEN $8::boolean THEN $9::int ELSE default_validity_days END,
           verification_method = COALESCE($10, verification_method),
           is_mandatory_default = COALESCE($11, is_mandatory_default),
           is_active = COALESCE($12, is_active),
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, code, name, description, issuing_authority AS "issuingAuthority",
                 requires_expiry AS "requiresExpiry", ${requiresNumberSelect},
                 default_validity_days AS "defaultValidityDays", verification_method AS "verificationMethod",
                 is_mandatory_default AS "isMandatoryDefault", is_active AS "isActive", sort_order AS "sortOrder"`,
      [
        id,
        data.name !== undefined ? data.name.trim() : null,
        data.description !== undefined,
        data.description !== undefined ? (data.description ? data.description.trim() : null) : null,
        data.issuingAuthority !== undefined,
        data.issuingAuthority !== undefined ? (data.issuingAuthority ? data.issuingAuthority.trim() : null) : null,
        data.requiresExpiry !== undefined ? Boolean(data.requiresExpiry) : null,
        data.defaultValidityDays !== undefined,
        data.defaultValidityDays !== undefined ? data.defaultValidityDays : null,
        method,
        data.isMandatoryDefault !== undefined ? Boolean(data.isMandatoryDefault) : null,
        data.isActive !== undefined ? Boolean(data.isActive) : null,
      ]
    );
    clearReferenceCache('documentTypes');
    return res.rows[0] || null;
  }

  async updatePlan(
    id: string,
    data: { price?: number; maxCallsPerYear?: number | null; features?: Record<string, any> }
  ): Promise<any | null> {
    const res = await query(
      `UPDATE plans
       SET price = COALESCE($2, price),
           max_calls_per_year = CASE WHEN $3::boolean THEN $4::int ELSE max_calls_per_year END,
           features = CASE WHEN $5::boolean THEN COALESCE(features, '{}'::jsonb) || $6::jsonb ELSE features END
       WHERE id = $1
       RETURNING id, code, name, audience, price, currency, billing_interval AS "billingInterval",
                 max_users AS "maxUsers", max_calls_per_year AS "maxCallsPerYear", features, sort_order AS "sortOrder"`,
      [
        id,
        data.price !== undefined ? Number(data.price) : null,
        data.maxCallsPerYear !== undefined,
        data.maxCallsPerYear !== undefined ? data.maxCallsPerYear : null,
        data.features !== undefined,
        data.features !== undefined ? JSON.stringify(data.features) : null,
      ]
    );
    clearReferenceCache('plans');
    return res.rows[0] || null;
  }
}

export const referenceRepository = new ReferenceRepository();
