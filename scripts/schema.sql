-- =====================================================================
-- BidReady360: PostgreSQL 15+ Production Schema
-- Designed for Botswana Public Procurement & Transparent Tendering
-- =====================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "citext";

-- Helper function: current timestamp in CAT (UTC+2)
CREATE OR REPLACE FUNCTION cat_now() RETURNS TIMESTAMPTZ AS $$
BEGIN
  RETURN NOW() AT TIME ZONE 'Africa/Gaborone';
END;
$$ LANGUAGE plpgsql STABLE;

-- Helper function: generate a UUID v7 or v4 fallback
CREATE OR REPLACE FUNCTION uuid_generate_v7() RETURNS UUID AS $$
BEGIN
  RETURN gen_random_uuid();
END;
$$ LANGUAGE plpgsql VOLATILE;

-- Helper function: compute SHA-256 hash of text
CREATE OR REPLACE FUNCTION sha256_hash(input_text TEXT) RETURNS CHAR(64) AS $$
BEGIN
  RETURN encode(digest(input_text, 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Helper function: compute HMAC-SHA-256 for keyed hashing
CREATE OR REPLACE FUNCTION hmac_sha256(key TEXT, message TEXT) RETURNS CHAR(64) AS $$
BEGIN
  RETURN encode(hmac(message, key, 'sha256'), 'hex');
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================================================
-- 2. IDENTITY AND ACCESS CONTROL
-- =====================================================================

CREATE TABLE IF NOT EXISTS users (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  email                 CITEXT NOT NULL,
  password_hash         VARCHAR(255),
  full_name             VARCHAR(200) NOT NULL,
  phone                 VARCHAR(32),
  preferred_language    VARCHAR(10) NOT NULL DEFAULT 'en' CHECK (preferred_language IN ('en', 'tn')),
  status                VARCHAR(20) NOT NULL DEFAULT 'pending' 
                        CHECK (status IN ('pending', 'active', 'suspended', 'deleted')),
  is_platform_admin     BOOLEAN NOT NULL DEFAULT FALSE,
  email_verified_at     TIMESTAMPTZ,
  phone_verified_at     TIMESTAMPTZ,
  mfa_enabled           BOOLEAN NOT NULL DEFAULT FALSE,
  mfa_secret_encrypted  BYTEA,
  mfa_type              VARCHAR(20) CHECK (mfa_type IN ('authenticator', 'sms', 'pending')),
  last_login_at         TIMESTAMPTZ,
  last_login_ip         INET,
  failed_login_attempts SMALLINT NOT NULL DEFAULT 0,
  locked_until          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at            TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_email ON users (email) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_status ON users (status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_users_platform_admin ON users (is_platform_admin) WHERE is_platform_admin = TRUE;

-- Geographic reference data
CREATE TABLE IF NOT EXISTS geographic_districts (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  name                  VARCHAR(100) NOT NULL,
  administrative_region VARCHAR(100),
  country_code          CHAR(2) NOT NULL DEFAULT 'BW',
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order            SMALLINT NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_districts_name ON geographic_districts (name, country_code);

-- Buying entities (Procuring Organizations)
CREATE TABLE IF NOT EXISTS organizations (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  name                  VARCHAR(255) NOT NULL,
  slug                  VARCHAR(100) NOT NULL,
  registration_number   VARCHAR(100),
  organization_type     VARCHAR(50) NOT NULL DEFAULT 'other'
                        CHECK (organization_type IN (
                          'ministry', 'parastatal', 'local_authority', 
                          'private_company', 'ngo', 'ppp', 'other'
                        )),
  status                VARCHAR(20) NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'active', 'suspended', 'closed')),
  
  -- Verification Gate Post-Registration
  verification_status   VARCHAR(20) NOT NULL DEFAULT 'pending_review'
                        CHECK (verification_status IN ('pending_review', 'verified', 'rejected')),
  verification_submitted_at TIMESTAMPTZ DEFAULT NOW(),
  official_domain_verified  BOOLEAN NOT NULL DEFAULT FALSE,
  
  contact_email         CITEXT,
  contact_phone         VARCHAR(32),
  physical_address      VARCHAR(500),
  city                  VARCHAR(100),
  district              VARCHAR(100),
  country_code          CHAR(2) NOT NULL DEFAULT 'BW',
  logo_storage_key      VARCHAR(512),
  logo_sha256           CHAR(64),
  brand_primary_color   CHAR(7),
  brand_subtext         VARCHAR(255),
  custom_domain         VARCHAR(255),
  settings              JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  approved_by_user_id   UUID REFERENCES users(id),
  approved_at           TIMESTAMPTZ,
  rejection_reason      VARCHAR(1000),
  
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at            TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_slug ON organizations (slug) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_organizations_domain ON organizations (custom_domain) WHERE custom_domain IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_organizations_status ON organizations (status) WHERE deleted_at IS NULL;

-- Organization Settings
CREATE TABLE IF NOT EXISTS organization_settings (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  organization_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  setting_key           VARCHAR(100) NOT NULL,
  setting_value         JSONB NOT NULL,
  setting_type          VARCHAR(20) NOT NULL DEFAULT 'string'
                        CHECK (setting_type IN ('string', 'number', 'boolean', 'array', 'object', 'enum')),
  description           VARCHAR(500),
  updated_by_user_id    UUID REFERENCES users(id),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_org_settings_key ON organization_settings (organization_id, setting_key);

-- Suppliers (Vendors)
CREATE TABLE IF NOT EXISTS suppliers (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  legal_name            VARCHAR(255) NOT NULL,
  trading_name          VARCHAR(255),
  cipa_uin              VARCHAR(32) NOT NULL,
  burs_tin              VARCHAR(32),
  ppra_registration_no  VARCHAR(100),
  company_type          VARCHAR(50) NOT NULL DEFAULT 'private_company'
                        CHECK (company_type IN (
                          'sole_proprietor', 'partnership', 'private_company',
                          'public_company', 'cooperative', 'ngo', 'joint_venture', 'other'
                        )),
  year_established      SMALLINT CHECK (year_established BETWEEN 1800 AND 2100),
  description           TEXT,
  physical_address      VARCHAR(500),
  postal_address        VARCHAR(255),
  city                  VARCHAR(100),
  district_id           UUID REFERENCES geographic_districts(id),
  country_code          CHAR(2) NOT NULL DEFAULT 'BW',
  primary_phone         VARCHAR(32),
  email                 CITEXT,
  website               VARCHAR(255),
  employee_count_band   VARCHAR(20) CHECK (employee_count_band IN ('1-5', '6-20', '21-50', '51-200', '201+')),
  citizen_owned_percentage NUMERIC(5,2) CHECK (citizen_owned_percentage BETWEEN 0 AND 100),
  youth_owned           BOOLEAN NOT NULL DEFAULT FALSE,
  women_owned           BOOLEAN NOT NULL DEFAULT FALSE,
  disability_owned      BOOLEAN NOT NULL DEFAULT FALSE,
  edd_certified         BOOLEAN NOT NULL DEFAULT FALSE,
  edd_certificate_no    VARCHAR(100),
  edd_valid_until       DATE,
  bank_name             VARCHAR(128),
  bank_branch           VARCHAR(128),
  account_number_encrypted BYTEA,
  account_number_masked VARCHAR(32),
  status                VARCHAR(20) NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'active', 'suspended', 'closed')),
  verification_status   VARCHAR(20) NOT NULL DEFAULT 'unverified'
                        CHECK (verification_status IN ('unverified', 'pending', 'verified', 'rejected')),
  compliance_status     VARCHAR(20) NOT NULL DEFAULT 'Non-compliant'
                        CHECK (compliance_status IN ('Fully compliant', 'Action required', 'Non-compliant')),
  profile_completeness  SMALLINT NOT NULL DEFAULT 0 CHECK (profile_completeness BETWEEN 0 AND 100),
  missing_items         TEXT[],
  verified_at           TIMESTAMPTZ,
  verified_by_user_id   UUID REFERENCES users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at            TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_suppliers_cipa_uin ON suppliers (cipa_uin) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_suppliers_status ON suppliers (status, verification_status) WHERE deleted_at IS NULL;

-- Permissions and Roles
CREATE TABLE IF NOT EXISTS permissions (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  code                  VARCHAR(100) NOT NULL,
  scope                 VARCHAR(20) NOT NULL CHECK (scope IN ('organization', 'supplier', 'platform')),
  category              VARCHAR(50) NOT NULL,
  description           VARCHAR(255),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_permissions_code ON permissions (code);

CREATE TABLE IF NOT EXISTS roles (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  scope                 VARCHAR(20) NOT NULL CHECK (scope IN ('organization', 'supplier')),
  organization_id       UUID REFERENCES organizations(id) ON DELETE CASCADE,
  name                  VARCHAR(100) NOT NULL,
  description           VARCHAR(500),
  color                 CHAR(7),
  is_system             BOOLEAN NOT NULL DEFAULT FALSE,
  approval_limit_bwp    NUMERIC(15,2),
  sort_order            SMALLINT NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_roles_name_org ON roles (scope, COALESCE(organization_id, '00000000-0000-0000-0000-000000000000'::UUID), name);

CREATE TABLE IF NOT EXISTS role_permissions (
  role_id               UUID NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id         UUID NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  granted_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  granted_by_user_id    UUID REFERENCES users(id),
  PRIMARY KEY (role_id, permission_id)
);

CREATE TABLE IF NOT EXISTS organization_members (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  organization_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id               UUID NOT NULL REFERENCES roles(id),
  is_owner              BOOLEAN NOT NULL DEFAULT FALSE,
  status                VARCHAR(20) NOT NULL DEFAULT 'active'
                        CHECK (status IN ('invited', 'active', 'suspended', 'removed')),
  department            VARCHAR(128),
  job_title             VARCHAR(128),
  mfa_enforced          BOOLEAN NOT NULL DEFAULT TRUE,
  invited_by_user_id    UUID REFERENCES users(id),
  invited_at            TIMESTAMPTZ,
  joined_at             TIMESTAMPTZ,
  last_active_at        TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_org_members_unique ON organization_members (organization_id, user_id);

CREATE TABLE IF NOT EXISTS supplier_members (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  supplier_id           UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role_id               UUID NOT NULL REFERENCES roles(id),
  is_owner              BOOLEAN NOT NULL DEFAULT FALSE,
  status                VARCHAR(20) NOT NULL DEFAULT 'active'
                        CHECK (status IN ('invited', 'active', 'suspended', 'removed')),
  job_title             VARCHAR(128),
  invited_by_user_id    UUID REFERENCES users(id),
  invited_at            TIMESTAMPTZ,
  joined_at             TIMESTAMPTZ,
  last_active_at        TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_supplier_members_unique ON supplier_members (supplier_id, user_id);

CREATE TABLE IF NOT EXISTS invitations (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  organization_id       UUID REFERENCES organizations(id) ON DELETE CASCADE,
  supplier_id           UUID REFERENCES suppliers(id) ON DELETE CASCADE,
  email                 CITEXT NOT NULL,
  role_id               UUID NOT NULL REFERENCES roles(id),
  token_hash            CHAR(64) NOT NULL,
  invited_by_user_id    UUID NOT NULL REFERENCES users(id),
  department            VARCHAR(128),
  job_title             VARCHAR(128),
  approval_limit_bwp    NUMERIC(15,2),
  expires_at            TIMESTAMPTZ NOT NULL,
  accepted_at           TIMESTAMPTZ,
  revoked_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_invitation_one_tenant CHECK (
    (organization_id IS NOT NULL) <> (supplier_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_invitations_token ON invitations (token_hash);

CREATE TABLE IF NOT EXISTS legal_acceptances (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  document_code         VARCHAR(50) NOT NULL,
  document_version      VARCHAR(20) NOT NULL,
  accepted_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address            INET,
  user_agent            VARCHAR(300)
);

-- =====================================================================
-- 3. SUPPLIER PROFILE (PASSPORT)
-- =====================================================================

CREATE TABLE IF NOT EXISTS categories (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  parent_id             UUID REFERENCES categories(id),
  organization_id       UUID REFERENCES organizations(id) ON DELETE CASCADE,
  code                  VARCHAR(50) NOT NULL,
  name                  VARCHAR(200) NOT NULL,
  description           VARCHAR(500),
  level                 SMALLINT NOT NULL DEFAULT 1 CHECK (level BETWEEN 1 AND 5),
  sort_order            INTEGER NOT NULL DEFAULT 0,
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_categories_code ON categories (COALESCE(organization_id, '00000000-0000-0000-0000-000000000000'::UUID), code);

CREATE TABLE IF NOT EXISTS procurement_disciplines (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  code                  VARCHAR(20) NOT NULL,
  title                 VARCHAR(200) NOT NULL,
  description           VARCHAR(1000),
  parent_id             UUID REFERENCES procurement_disciplines(id),
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order            INTEGER NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_disciplines_code ON procurement_disciplines (code);

CREATE TABLE IF NOT EXISTS capability_tiers (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  code                  VARCHAR(20) NOT NULL,
  name                  VARCHAR(100) NOT NULL,
  description           VARCHAR(500),
  min_contract_value    NUMERIC(15,2),
  max_contract_value    NUMERIC(15,2),
  sort_order            INTEGER NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_capability_tiers_code ON capability_tiers (code);

CREATE TABLE IF NOT EXISTS supplier_people (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  supplier_id           UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  full_name             VARCHAR(200) NOT NULL,
  person_role           VARCHAR(30) NOT NULL
                        CHECK (person_role IN ('director', 'owner', 'shareholder', 'authorised_signatory', 'other')),
  ownership_percent     NUMERIC(5,2) CHECK (ownership_percent BETWEEN 0 AND 100),
  national_identity_number_encrypted BYTEA,
  national_identity_hash CHAR(64),
  identity_type         VARCHAR(20) CHECK (identity_type IN ('OMANG', 'PASSPORT')),
  nationality           VARCHAR(50) DEFAULT 'Motswana',
  is_citizen            BOOLEAN NOT NULL DEFAULT TRUE,
  date_of_birth         DATE,
  email                 CITEXT,
  phone                 VARCHAR(32),
  kyc_status            VARCHAR(20) NOT NULL DEFAULT 'not_started'
                        CHECK (kyc_status IN ('not_started', 'pending', 'verified', 'failed')),
  kyc_verified_at       TIMESTAMPTZ,
  kyc_reference         VARCHAR(100),
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_supplier_people_supplier ON supplier_people (supplier_id) WHERE is_active = TRUE;

CREATE TABLE IF NOT EXISTS supplier_projects (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  supplier_id           UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  client_name           VARCHAR(255) NOT NULL,
  client_organization_id UUID REFERENCES organizations(id),
  project_title         VARCHAR(255) NOT NULL,
  description           TEXT,
  contract_value        NUMERIC(15,2),
  currency              CHAR(3) NOT NULL DEFAULT 'BWP',
  start_date            DATE,
  end_date              DATE,
  reference_name        VARCHAR(200),
  reference_contact     VARCHAR(255),
  reference_verified    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- 4. SUPPLIER DOCUMENTS AND VERSIONS
-- =====================================================================

CREATE TABLE IF NOT EXISTS document_types (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  organization_id       UUID REFERENCES organizations(id) ON DELETE CASCADE,
  code                  VARCHAR(60) NOT NULL,
  name                  VARCHAR(200) NOT NULL,
  description           VARCHAR(500),
  issuing_authority     VARCHAR(200),
  requires_expiry       BOOLEAN NOT NULL DEFAULT FALSE,
  default_validity_days INTEGER,
  max_file_size_mb      SMALLINT NOT NULL DEFAULT 10,
  allowed_mime_types    TEXT[],
  verification_method   VARCHAR(30) DEFAULT 'manual'
                        CHECK (verification_method IN ('manual', 'registry_api', 'ai_assisted', 'hybrid')),
  is_mandatory_default  BOOLEAN NOT NULL DEFAULT FALSE,
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order            INTEGER NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_document_types_code ON document_types (COALESCE(organization_id, '00000000-0000-0000-0000-000000000000'::UUID), code);

CREATE TABLE IF NOT EXISTS supplier_documents (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  supplier_id           UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  document_type_id      UUID NOT NULL REFERENCES document_types(id),
  title                 VARCHAR(255) NOT NULL,
  current_version_id    UUID,
  status                VARCHAR(20) NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'archived', 'deleted')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS supplier_document_versions (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  document_id           UUID NOT NULL REFERENCES supplier_documents(id) ON DELETE CASCADE,
  version_no            INTEGER NOT NULL CHECK (version_no >= 1),
  storage_key           VARCHAR(512) NOT NULL,
  file_name             VARCHAR(255) NOT NULL,
  mime_type             VARCHAR(100) NOT NULL,
  file_size_bytes       BIGINT NOT NULL,
  sha256                CHAR(64) NOT NULL,
  document_number       VARCHAR(128),
  issue_date            DATE,
  expiry_date           DATE,
  uploaded_by_user_id   UUID NOT NULL REFERENCES users(id),
  uploaded_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  verification_status   VARCHAR(20) NOT NULL DEFAULT 'pending'
                        CHECK (verification_status IN (
                          'PENDING_VERIFICATION', 'VERIFIED', 'EXPIRING_SOON', 
                          'EXPIRED', 'REJECTED', 'UNVERIFIABLE'
                        )),
  verified_via          VARCHAR(30) CHECK (verified_via IN ('manual', 'registry_api', 'ai_assisted')),
  verified_by_user_id   UUID REFERENCES users(id),
  verified_at           TIMESTAMPTZ,
  verification_notes    VARCHAR(1000),
  rejection_reason      VARCHAR(500),
  extracted_data        JSONB,
  extraction_confidence NUMERIC(5,2) CHECK (extraction_confidence BETWEEN 0 AND 100),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_sdv_version ON supplier_document_versions (document_id, version_no);

-- Attach foreign keys for supplier_documents current_version
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE constraint_name = 'fk_supplier_documents_current_version'
  ) THEN
    ALTER TABLE supplier_documents
      ADD CONSTRAINT fk_supplier_documents_current_version
      FOREIGN KEY (current_version_id) REFERENCES supplier_document_versions(id);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS supplier_discipline_allocations (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  supplier_id           UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  discipline_id         UUID NOT NULL REFERENCES procurement_disciplines(id),
  capability_tier_id    UUID REFERENCES capability_tiers(id),
  is_primary            BOOLEAN NOT NULL DEFAULT FALSE,
  verified_at           TIMESTAMPTZ,
  verified_by_user_id   UUID REFERENCES users(id),
  evidence_document_id  UUID REFERENCES supplier_document_versions(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_supplier_discipline ON supplier_discipline_allocations (supplier_id, discipline_id);

CREATE TABLE IF NOT EXISTS supplier_attributes (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  supplier_id           UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  attribute_code        VARCHAR(60) NOT NULL,
  claimed_value         VARCHAR(200),
  verified_value        VARCHAR(200),
  status                VARCHAR(20) NOT NULL DEFAULT 'claimed'
                        CHECK (status IN ('claimed', 'verified', 'rejected', 'expired')),
  evidence_document_id  UUID REFERENCES supplier_document_versions(id),
  verified_at           TIMESTAMPTZ,
  verified_by_user_id   UUID REFERENCES users(id),
  valid_until           DATE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_supplier_attributes ON supplier_attributes (supplier_id, attribute_code);

CREATE TABLE IF NOT EXISTS document_verification_attempts (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  document_version_id   UUID NOT NULL REFERENCES supplier_document_versions(id) ON DELETE CASCADE,
  external_registry_name VARCHAR(100) NOT NULL,
  transaction_ref       VARCHAR(100),
  status                VARCHAR(20) NOT NULL
                        CHECK (status IN ('pending', 'success', 'failed', 'timeout', 'error')),
  raw_response          JSONB,
  error_message         VARCHAR(500),
  attempted_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at          TIMESTAMPTZ,
  duration_ms           INTEGER
);

-- =====================================================================
-- 5. CONSENT AND DATA SHARING
-- =====================================================================

CREATE TABLE IF NOT EXISTS consent_grants (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  supplier_id           UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  organization_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  share_company_details BOOLEAN NOT NULL DEFAULT TRUE,
  share_directors_owners BOOLEAN NOT NULL DEFAULT FALSE,
  share_past_projects   BOOLEAN NOT NULL DEFAULT FALSE,
  share_tax_compliance  BOOLEAN NOT NULL DEFAULT FALSE,
  share_financial_statements BOOLEAN NOT NULL DEFAULT FALSE,
  share_key_personnel   BOOLEAN NOT NULL DEFAULT FALSE,
  share_past_contracts  BOOLEAN NOT NULL DEFAULT FALSE,
  share_banking_details BOOLEAN NOT NULL DEFAULT FALSE,
  purpose               VARCHAR(500),
  status                VARCHAR(20) NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'revoked', 'expired')),
  granted_by_user_id    UUID NOT NULL REFERENCES users(id),
  granted_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at            TIMESTAMPTZ,
  revoked_by_user_id    UUID REFERENCES users(id),
  revoked_at            TIMESTAMPTZ,
  revocation_reason     VARCHAR(500),
  last_accessed_at      TIMESTAMPTZ,
  access_count          INTEGER NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS consent_grant_documents (
  consent_grant_id      UUID NOT NULL REFERENCES consent_grants(id) ON DELETE CASCADE,
  document_id           UUID NOT NULL REFERENCES supplier_documents(id) ON DELETE CASCADE,
  attached_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (consent_grant_id, document_id)
);

CREATE TABLE IF NOT EXISTS organization_data_access_logs (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  organization_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  supplier_id           UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  consent_grant_id      UUID REFERENCES consent_grants(id),
  accessed_by_user_id   UUID NOT NULL REFERENCES users(id),
  accessed_data_scope   TEXT[] NOT NULL,
  ip_address            INET,
  user_agent            VARCHAR(300),
  accessed_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- 6. FORM BUILDER AND QUESTIONNAIRES
-- =====================================================================

CREATE TABLE IF NOT EXISTS form_templates (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  organization_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name                  VARCHAR(200) NOT NULL,
  purpose               VARCHAR(30) NOT NULL DEFAULT 'registration'
                        CHECK (purpose IN ('registration', 'eoi', 'rfp_questionnaire', 'other')),
  description           VARCHAR(500),
  status                VARCHAR(20) NOT NULL DEFAULT 'active'
                        CHECK (status IN ('draft', 'active', 'archived')),
  created_by_user_id    UUID NOT NULL REFERENCES users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS form_template_versions (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  template_id           UUID NOT NULL REFERENCES form_templates(id) ON DELETE CASCADE,
  version_no            INTEGER NOT NULL CHECK (version_no >= 1),
  label                 VARCHAR(100),
  schema_json           JSONB NOT NULL,
  status                VARCHAR(20) NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'published', 'retired')),
  published_by_user_id  UUID REFERENCES users(id),
  published_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ftv_version ON form_template_versions (template_id, version_no);

CREATE TABLE IF NOT EXISTS form_fields (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  form_version_id       UUID NOT NULL REFERENCES form_template_versions(id) ON DELETE CASCADE,
  field_key             VARCHAR(100) NOT NULL,
  label                 VARCHAR(255) NOT NULL,
  field_type            VARCHAR(30) NOT NULL
                        CHECK (field_type IN (
                          'text', 'number', 'dropdown', 'date', 'file_upload', 
                          'yes_no', 'textarea', 'email', 'phone', 'currency'
                        )),
  is_required           BOOLEAN NOT NULL DEFAULT FALSE,
  placeholder           VARCHAR(255),
  help_text             VARCHAR(1000),
  default_value         VARCHAR(500),
  validation_pattern    VARCHAR(500),
  min_length            INTEGER,
  max_length            INTEGER,
  min_value             NUMERIC,
  max_value             NUMERIC,
  options               JSONB,
  conditional_on_field_id UUID REFERENCES form_fields(id),
  conditional_value     VARCHAR(128),
  sort_order            INTEGER NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- 7. CALLS (EOI / RFP / REGISTRATION DRIVES)
-- =====================================================================

CREATE TABLE IF NOT EXISTS calls (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  organization_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  reference_no          VARCHAR(100) NOT NULL,
  title                 VARCHAR(300) NOT NULL,
  call_type             VARCHAR(30) NOT NULL
                        CHECK (call_type IN ('registration_drive', 'eoi', 'rfp', 'rfq')),
  summary               VARCHAR(1000),
  description           TEXT,
  visibility            VARCHAR(30) NOT NULL DEFAULT 'open'
                        CHECK (visibility IN ('open', 'approved_suppliers', 'category_restricted', 'invite_only')),
  status                VARCHAR(20) NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'open', 'closed', 'evaluating', 'awarded', 'cancelled')),
  opens_at              TIMESTAMPTZ,
  clarification_deadline TIMESTAMPTZ,
  closes_at             TIMESTAMPTZ,
  display_timezone      VARCHAR(50) NOT NULL DEFAULT 'Africa/Gaborone',
  estimated_value       NUMERIC(15,2),
  currency              CHAR(3) NOT NULL DEFAULT 'BWP',
  registration_valid_months SMALLINT,
  application_form_version_id UUID REFERENCES form_template_versions(id),
  scoring_template_id   UUID,
  billing_mode          VARCHAR(20) NOT NULL DEFAULT 'subscription'
                        CHECK (billing_mode IN ('subscription', 'pay_per_call')),
  sealed_bid_protocol_enforced BOOLEAN NOT NULL DEFAULT TRUE,
  default_closing_time_cat TIME NOT NULL DEFAULT '14:00',
  clarification_deadline_days_offset SMALLINT NOT NULL DEFAULT 7,
  created_by_user_id    UUID NOT NULL REFERENCES users(id),
  published_by_user_id  UUID REFERENCES users(id),
  published_at          TIMESTAMPTZ,
  applications_count    INTEGER NOT NULL DEFAULT 0,
  documents_count       INTEGER NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_calls_reference ON calls (organization_id, reference_no);

CREATE TABLE IF NOT EXISTS call_categories (
  call_id               UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  category_id           UUID NOT NULL REFERENCES categories(id),
  is_primary            BOOLEAN NOT NULL DEFAULT FALSE,
  PRIMARY KEY (call_id, category_id)
);

CREATE TABLE IF NOT EXISTS call_required_documents (
  call_id               UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  document_type_id      UUID NOT NULL REFERENCES document_types(id),
  is_mandatory          BOOLEAN NOT NULL DEFAULT TRUE,
  min_validity_days     INTEGER,
  PRIMARY KEY (call_id, document_type_id)
);

CREATE TABLE IF NOT EXISTS call_attachments (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  call_id               UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  title                 VARCHAR(255) NOT NULL,
  storage_key           VARCHAR(512) NOT NULL,
  file_name             VARCHAR(255) NOT NULL,
  mime_type             VARCHAR(100) NOT NULL,
  file_size_bytes       BIGINT NOT NULL,
  sha256                CHAR(64) NOT NULL,
  uploaded_by_user_id   UUID NOT NULL REFERENCES users(id),
  uploaded_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS call_invitations (
  call_id               UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  supplier_id           UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  invited_by_user_id    UUID NOT NULL REFERENCES users(id),
  invited_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (call_id, supplier_id)
);

CREATE TABLE IF NOT EXISTS call_price_items (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  call_id               UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  line_no               INTEGER NOT NULL CHECK (line_no >= 1),
  description           VARCHAR(500) NOT NULL,
  unit                  VARCHAR(30),
  quantity              NUMERIC(15,3) NOT NULL DEFAULT 1,
  sort_order            INTEGER NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_cpi_line ON call_price_items (call_id, line_no);

CREATE TABLE IF NOT EXISTS call_addenda (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  call_id               UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  addendum_no           INTEGER NOT NULL CHECK (addendum_no >= 1),
  title                 VARCHAR(255) NOT NULL,
  body                  TEXT NOT NULL,
  new_closes_at         TIMESTAMPTZ,
  published_by_user_id  UUID NOT NULL REFERENCES users(id),
  published_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS call_addendum_acknowledgements (
  addendum_id           UUID NOT NULL REFERENCES call_addenda(id) ON DELETE CASCADE,
  supplier_id           UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  acknowledged_by_user_id UUID NOT NULL REFERENCES users(id),
  acknowledged_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (addendum_id, supplier_id)
);

CREATE TABLE IF NOT EXISTS clarifications (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  call_id               UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  asked_by_supplier_id  UUID NOT NULL REFERENCES suppliers(id),
  asked_by_user_id      UUID NOT NULL REFERENCES users(id),
  topic                 VARCHAR(100),
  responder_title       VARCHAR(150),
  supplier_name_snapshot VARCHAR(255),
  question              TEXT NOT NULL,
  published_question    TEXT,
  answer                TEXT,
  answered_by_user_id   UUID REFERENCES users(id),
  asked_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  answered_at           TIMESTAMPTZ,
  is_published          BOOLEAN NOT NULL DEFAULT FALSE,
  status                VARCHAR(20) NOT NULL DEFAULT 'Pending'
                        CHECK (status IN ('Pending', 'Answered'))
);

-- =====================================================================
-- 8. APPLICATIONS AND REVIEW WORKFLOW
-- =====================================================================

CREATE TABLE IF NOT EXISTS workflow_stages (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  organization_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  applies_to            VARCHAR(20) NOT NULL DEFAULT 'registration'
                        CHECK (applies_to IN ('registration', 'eoi', 'rfp')),
  name                  VARCHAR(100) NOT NULL,
  sequence_no           INTEGER NOT NULL CHECK (sequence_no >= 1),
  stage_type            VARCHAR(20) NOT NULL DEFAULT 'review'
                        CHECK (stage_type IN ('review', 'approval')),
  required_role_id      UUID REFERENCES roles(id),
  sla_days              SMALLINT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS applications (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  call_id               UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  supplier_id           UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  organization_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  form_version_id       UUID REFERENCES form_template_versions(id),
  consent_grant_id      UUID REFERENCES consent_grants(id),
  status                VARCHAR(30) NOT NULL DEFAULT 'Draft'
                        CHECK (status IN (
                          'Draft', 'Submitted', 'Under review', 'More information requested',
                          'Approved', 'Rejected', 'Withdrawn'
                        )),
  current_stage_id      UUID REFERENCES workflow_stages(id),
  answers               JSONB,
  completeness_check    JSONB,
  receipt_number        VARCHAR(40),
  submitted_by_user_id  UUID REFERENCES users(id),
  submitted_at          TIMESTAMPTZ,
  decided_by_user_id    UUID REFERENCES users(id),
  decided_at            TIMESTAMPTZ,
  decision_note         VARCHAR(1000),
  status_reason         VARCHAR(500),
  withdrawn_at          TIMESTAMPTZ,
  withdrawal_reason     VARCHAR(500),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_applications_pair ON applications (call_id, supplier_id);

-- Normalized junction table for consent grants (now applications exists)
CREATE TABLE IF NOT EXISTS consent_grant_applications (
  consent_grant_id      UUID NOT NULL REFERENCES consent_grants(id) ON DELETE CASCADE,
  application_id        UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  attached_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (consent_grant_id, application_id)
);

CREATE TABLE IF NOT EXISTS application_documents (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  application_id        UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  document_version_id   UUID NOT NULL REFERENCES supplier_document_versions(id),
  document_type_id      UUID NOT NULL REFERENCES document_types(id),
  pinned_version_no     INTEGER NOT NULL DEFAULT 1,
  pinned_sha256         CHAR(64) NOT NULL,
  document_number_snapshot VARCHAR(128),
  expiry_date_snapshot  DATE,
  attached_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS application_attachments (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  application_id        UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  field_key             VARCHAR(100) NOT NULL,
  storage_key           VARCHAR(512) NOT NULL,
  file_name             VARCHAR(255) NOT NULL,
  mime_type             VARCHAR(100) NOT NULL,
  file_size_bytes       BIGINT NOT NULL,
  sha256                CHAR(64) NOT NULL,
  uploaded_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS application_reviews (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  application_id        UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  stage_id              UUID REFERENCES workflow_stages(id),
  reviewer_user_id      UUID NOT NULL REFERENCES users(id),
  decision              VARCHAR(30) NOT NULL
                        CHECK (decision IN ('approved', 'rejected', 'info_requested', 'comment')),
  checklist             JSONB,
  comment               VARCHAR(2000),
  decided_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS application_info_requests (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  application_id        UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  requested_by_user_id  UUID NOT NULL REFERENCES users(id),
  message               VARCHAR(2000) NOT NULL,
  requested_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  due_at                TIMESTAMPTZ,
  responded_at          TIMESTAMPTZ,
  response_note         VARCHAR(2000),
  responded_by_user_id  UUID REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS application_reviewer_messages (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  application_id        UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  sender_user_id        UUID NOT NULL REFERENCES users(id),
  sender_name           VARCHAR(200) NOT NULL,
  sender_role           VARCHAR(100),
  message               TEXT NOT NULL,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS application_timeline (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  application_id        UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  stage                 VARCHAR(30) NOT NULL,
  note                  VARCHAR(500),
  created_by_user_id    UUID REFERENCES users(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS approved_suppliers (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  organization_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  supplier_id           UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  source_application_id UUID REFERENCES applications(id),
  status                VARCHAR(20) NOT NULL DEFAULT 'active'
                        CHECK (status IN ('active', 'suspended', 'expired', 'removed')),
  valid_from            DATE NOT NULL,
  valid_until           DATE,
  approved_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  suspended_reason      VARCHAR(500),
  last_reviewed_at      TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_approved_suppliers ON approved_suppliers (organization_id, supplier_id);

CREATE TABLE IF NOT EXISTS debarments (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  organization_id       UUID REFERENCES organizations(id) ON DELETE CASCADE,
  supplier_id           UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  reason                VARCHAR(1000) NOT NULL,
  starts_on             DATE NOT NULL,
  ends_on               DATE,
  evidence_ref          VARCHAR(255),
  created_by_user_id    UUID NOT NULL REFERENCES users(id),
  lifted_at             TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- 9. VERIFICATION AND RISK ASSESSMENT
-- =====================================================================

CREATE TABLE IF NOT EXISTS verification_checks (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  supplier_id           UUID REFERENCES suppliers(id) ON DELETE CASCADE,
  supplier_person_id    UUID REFERENCES supplier_people(id) ON DELETE CASCADE,
  document_version_id   UUID REFERENCES supplier_document_versions(id) ON DELETE CASCADE,
  check_type            VARCHAR(40) NOT NULL
                        CHECK (check_type IN (
                          'company_registry', 'tax_clearance', 'identity_kyc',
                          'document_authenticity', 'debarment_screen', 'other'
                        )),
  provider              VARCHAR(100),
  status                VARCHAR(20) NOT NULL DEFAULT 'requested'
                        CHECK (status IN ('requested', 'passed', 'failed', 'inconclusive', 'error')),
  requested_by_user_id  UUID REFERENCES users(id),
  requested_by_org_id   UUID REFERENCES organizations(id),
  requested_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at          TIMESTAMPTZ,
  result_json           JSONB,
  fee_amount            NUMERIC(12,2),
  fee_currency          CHAR(3) NOT NULL DEFAULT 'BWP'
);

CREATE TABLE IF NOT EXISTS risk_flags (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  supplier_id           UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  call_id               UUID REFERENCES calls(id),
  flag_type             VARCHAR(50) NOT NULL
                        CHECK (flag_type IN (
                          'shared_director', 'shared_address', 'shared_phone',
                          'duplicate_document', 'price_pattern', 'other'
                        )),
  severity              VARCHAR(10) NOT NULL DEFAULT 'medium'
                        CHECK (severity IN ('low', 'medium', 'high')),
  details               JSONB,
  status                VARCHAR(20) NOT NULL DEFAULT 'open'
                        CHECK (status IN ('open', 'reviewed', 'dismissed', 'resolved')),
  reviewed_by_user_id   UUID REFERENCES users(id),
  reviewed_at           TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- 10. BIDS AND SEALED ENVELOPE HANDLING
-- =====================================================================

CREATE TABLE IF NOT EXISTS bid_opening_sessions (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  call_id               UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  opened_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  conducted_by_user_id  UUID NOT NULL REFERENCES users(id),
  notes                 TEXT,
  register_storage_key  VARCHAR(512),
  register_sha256       CHAR(64),
  session_status        VARCHAR(20) NOT NULL DEFAULT 'in_progress'
                        CHECK (session_status IN ('scheduled', 'in_progress', 'completed', 'adjourned')),
  protocol_type         VARCHAR(50) NOT NULL DEFAULT 'dual_key_quorum',
  quorum_verified       BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS bid_opening_witnesses (
  session_id            UUID NOT NULL REFERENCES bid_opening_sessions(id) ON DELETE CASCADE,
  user_id               UUID NOT NULL REFERENCES users(id),
  witness_role          VARCHAR(50) NOT NULL DEFAULT 'Observer',
  digital_signature_hash CHAR(64),
  ip_address            INET,
  signed_at             TIMESTAMPTZ,
  PRIMARY KEY (session_id, user_id)
);

CREATE TABLE IF NOT EXISTS bids (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  call_id               UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  supplier_id           UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  application_id        UUID REFERENCES applications(id),
  status                VARCHAR(20) NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'submitted', 'withdrawn', 'opened', 'disqualified')),
  receipt_number        VARCHAR(40),
  sealed_payload_key    VARCHAR(512),
  envelope_key_ref      VARCHAR(255),
  payload_sha256        CHAR(64),
  total_price           NUMERIC(15,2),
  currency              CHAR(3) NOT NULL DEFAULT 'BWP',
  validity_days         SMALLINT,
  submitted_by_user_id  UUID REFERENCES users(id),
  submitted_at          TIMESTAMPTZ,
  opened_in_session_id  UUID REFERENCES bid_opening_sessions(id),
  opened_at             TIMESTAMPTZ,
  unsealed_by_user_id   UUID REFERENCES users(id),
  disqualification_reason VARCHAR(1000),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bids_receipt ON bids (receipt_number) WHERE receipt_number IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_bids_pair ON bids (call_id, supplier_id);

CREATE TABLE IF NOT EXISTS bid_files (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  bid_id                UUID NOT NULL REFERENCES bids(id) ON DELETE CASCADE,
  file_role             VARCHAR(20) NOT NULL
                        CHECK (file_role IN ('technical', 'financial', 'supporting')),
  storage_key           VARCHAR(512) NOT NULL,
  file_name             VARCHAR(255) NOT NULL,
  mime_type             VARCHAR(100) NOT NULL,
  file_size_bytes       BIGINT NOT NULL,
  sha256                CHAR(64) NOT NULL,
  uploaded_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS bid_price_items (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  bid_id                UUID NOT NULL REFERENCES bids(id) ON DELETE CASCADE,
  call_price_item_id    UUID REFERENCES call_price_items(id),
  line_no               INTEGER NOT NULL,
  description           VARCHAR(500) NOT NULL,
  unit                  VARCHAR(30),
  quantity              NUMERIC(15,3) NOT NULL,
  unit_price            NUMERIC(15,2) NOT NULL,
  line_total            NUMERIC(15,2) GENERATED ALWAYS AS (ROUND(quantity * unit_price, 2)) STORED
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_bpi_line ON bid_price_items (bid_id, line_no);

CREATE TABLE IF NOT EXISTS bid_sealing_receipts (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  bid_id                UUID NOT NULL REFERENCES bids(id) ON DELETE CASCADE,
  receipt_number        VARCHAR(40) NOT NULL,
  sealed_hash           CHAR(64) NOT NULL,
  file_fingerprints     JSONB NOT NULL,
  generated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  downloaded_at         TIMESTAMPTZ,
  downloaded_by_user_id UUID REFERENCES users(id)
);

-- =====================================================================
-- 11. EVALUATION AND SCORING
-- =====================================================================

CREATE TABLE IF NOT EXISTS evaluation_criteria (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  call_id               UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  parent_id             UUID REFERENCES evaluation_criteria(id),
  name                  VARCHAR(255) NOT NULL,
  description           VARCHAR(1000),
  criterion_type        VARCHAR(20) NOT NULL DEFAULT 'scored'
                        CHECK (criterion_type IN ('pass_fail', 'scored', 'price')),
  stage                 VARCHAR(20) NOT NULL DEFAULT 'technical'
                        CHECK (stage IN ('preliminary', 'technical', 'financial')),
  weight                NUMERIC(6,2) NOT NULL DEFAULT 0 CHECK (weight >= 0),
  max_score             NUMERIC(6,2) NOT NULL DEFAULT 100 CHECK (max_score >= 0),
  is_mandatory_gate     BOOLEAN NOT NULL DEFAULT FALSE,
  sort_order            INTEGER NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS evaluator_assignments (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  call_id               UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  user_id               UUID NOT NULL REFERENCES users(id),
  organization_id       UUID NOT NULL REFERENCES organizations(id),
  evaluator_role        VARCHAR(20) NOT NULL DEFAULT 'evaluator'
                        CHECK (evaluator_role IN ('chair', 'evaluator', 'observer')),
  assigned_by_user_id   UUID NOT NULL REFERENCES users(id),
  assigned_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  coi_status            VARCHAR(20) NOT NULL DEFAULT 'pending'
                        CHECK (coi_status IN ('pending', 'none', 'conflict')),
  coi_declared_at       TIMESTAMPTZ,
  coi_details           VARCHAR(1000),
  scorecard_locked      BOOLEAN NOT NULL DEFAULT FALSE,
  scorecard_locked_at   TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_eval_assignments ON evaluator_assignments (call_id, user_id);

CREATE TABLE IF NOT EXISTS evaluator_bid_access (
  evaluator_assignment_id UUID NOT NULL REFERENCES evaluator_assignments(id) ON DELETE CASCADE,
  bid_id                UUID NOT NULL REFERENCES bids(id) ON DELETE CASCADE,
  PRIMARY KEY (evaluator_assignment_id, bid_id)
);

CREATE TABLE IF NOT EXISTS conflict_declarations (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  evaluator_assignment_id UUID NOT NULL REFERENCES evaluator_assignments(id) ON DELETE CASCADE,
  supplier_id           UUID REFERENCES suppliers(id),
  has_conflict          BOOLEAN NOT NULL DEFAULT FALSE,
  details               VARCHAR(1000),
  declared_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS evaluation_scores (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  criterion_id          UUID NOT NULL REFERENCES evaluation_criteria(id) ON DELETE CASCADE,
  bid_id                UUID NOT NULL REFERENCES bids(id) ON DELETE CASCADE,
  evaluator_assignment_id UUID NOT NULL REFERENCES evaluator_assignments(id) ON DELETE CASCADE,
  score_value           NUMERIC(8,2),
  pass_fail             VARCHAR(10) CHECK (pass_fail IN ('pass', 'fail')),
  comment               VARCHAR(2000),
  submitted_at          TIMESTAMPTZ,
  locked_at             TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_eval_scores ON evaluation_scores (criterion_id, bid_id, evaluator_assignment_id);

CREATE TABLE IF NOT EXISTS evaluation_results (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  call_id               UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  bid_id                UUID NOT NULL REFERENCES bids(id) ON DELETE CASCADE,
  application_id        UUID REFERENCES applications(id),
  technical_score       NUMERIC(8,2),
  financial_score       NUMERIC(8,2),
  preference_points     NUMERIC(8,2),
  citizen_preference_points NUMERIC(8,2) NOT NULL DEFAULT 0.00,
  edd_preference_points NUMERIC(8,2) NOT NULL DEFAULT 0.00,
  youth_preference_points NUMERIC(8,2) NOT NULL DEFAULT 0.00,
  total_score           NUMERIC(8,2),
  evaluator_count       SMALLINT NOT NULL DEFAULT 0,
  score_variance        NUMERIC(6,2),
  rank_no               INTEGER,
  outcome               VARCHAR(20) NOT NULL DEFAULT 'pending'
                        CHECK (outcome IN ('pending', 'qualified', 'shortlisted', 'disqualified')),
  disqualification_reason VARCHAR(1000),
  consolidated_by_user_id UUID REFERENCES users(id),
  computed_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_eval_results ON evaluation_results (call_id, bid_id);

-- =====================================================================
-- 12. AWARDS, CONTRACTS, AND PERFORMANCE
-- =====================================================================

CREATE TABLE IF NOT EXISTS awards (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  call_id               UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  bid_id                UUID NOT NULL REFERENCES bids(id),
  supplier_id           UUID NOT NULL REFERENCES suppliers(id),
  status                VARCHAR(30) NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'pending_approval', 'approved', 'rejected', 'issued')),
  award_value           NUMERIC(15,2),
  currency              CHAR(3) NOT NULL DEFAULT 'BWP',
  justification         TEXT,
  is_public_notice      BOOLEAN NOT NULL DEFAULT FALSE,
  recommended_by_user_id UUID NOT NULL REFERENCES users(id),
  issued_at             TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS award_approvals (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  award_id              UUID NOT NULL REFERENCES awards(id) ON DELETE CASCADE,
  sequence_no           INTEGER NOT NULL DEFAULT 1,
  approver_user_id      UUID NOT NULL REFERENCES users(id),
  decision              VARCHAR(20) NOT NULL DEFAULT 'pending'
                        CHECK (decision IN ('pending', 'approved', 'rejected')),
  comment               VARCHAR(1000),
  decided_at            TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS complaints (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  call_id               UUID NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  supplier_id           UUID NOT NULL REFERENCES suppliers(id),
  submitted_by_user_id  UUID NOT NULL REFERENCES users(id),
  subject               VARCHAR(255) NOT NULL,
  body                  TEXT NOT NULL,
  status                VARCHAR(20) NOT NULL DEFAULT 'received'
                        CHECK (status IN ('received', 'under_review', 'upheld', 'dismissed', 'withdrawn')),
  resolution            TEXT,
  resolved_by_user_id   UUID REFERENCES users(id),
  resolved_at           TIMESTAMPTZ,
  submitted_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contracts (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  organization_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  supplier_id           UUID NOT NULL REFERENCES suppliers(id),
  award_id              UUID REFERENCES awards(id),
  contract_no           VARCHAR(100) NOT NULL,
  title                 VARCHAR(300) NOT NULL,
  status                VARCHAR(30) NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'sent_for_signature', 'active', 'completed', 'terminated')),
  start_date            DATE,
  end_date              DATE,
  contract_value        NUMERIC(15,2),
  currency              CHAR(3) NOT NULL DEFAULT 'BWP',
  retention_percentage  NUMERIC(5,2) DEFAULT 0.00,
  performance_bond_ref  VARCHAR(100),
  advance_payment_bwp   NUMERIC(15,2) DEFAULT 0.00,
  document_storage_key  VARCHAR(512),
  document_sha256       CHAR(64),
  signed_at             TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS contract_signatures (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  contract_id           UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  signer_user_id        UUID NOT NULL REFERENCES users(id),
  signer_party          VARCHAR(20) NOT NULL CHECK (signer_party IN ('buyer', 'supplier')),
  signed_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip_address            INET,
  signature_ref         VARCHAR(255)
);

CREATE TABLE IF NOT EXISTS contract_milestones (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  contract_id           UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  title                 VARCHAR(255) NOT NULL,
  due_date              DATE,
  amount                NUMERIC(15,2),
  status                VARCHAR(20) NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'delivered', 'accepted', 'overdue', 'paid')),
  accepted_at           TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS contract_invoices (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  contract_id           UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  milestone_id          UUID REFERENCES contract_milestones(id),
  invoice_no            VARCHAR(100) NOT NULL,
  amount                NUMERIC(15,2) NOT NULL,
  currency              CHAR(3) NOT NULL DEFAULT 'BWP',
  retention_deducted    NUMERIC(15,2) DEFAULT 0.00,
  vat_amount            NUMERIC(15,2) NOT NULL DEFAULT 0.00,
  issued_on             DATE NOT NULL,
  due_on                DATE,
  status                VARCHAR(20) NOT NULL DEFAULT 'submitted'
                        CHECK (status IN ('submitted', 'approved', 'rejected', 'paid')),
  paid_at               TIMESTAMPTZ,
  document_storage_key  VARCHAR(512)
);

CREATE TABLE IF NOT EXISTS performance_reviews (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  contract_id           UUID NOT NULL REFERENCES contracts(id) ON DELETE CASCADE,
  reviewer_user_id      UUID NOT NULL REFERENCES users(id),
  delivery_score        SMALLINT NOT NULL CHECK (delivery_score BETWEEN 1 AND 5),
  quality_score         SMALLINT NOT NULL CHECK (quality_score BETWEEN 1 AND 5),
  responsiveness_score  SMALLINT NOT NULL CHECK (responsiveness_score BETWEEN 1 AND 5),
  comments              TEXT,
  status                VARCHAR(20) NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'final')),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS supplier_performance_scores (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  supplier_id           UUID NOT NULL REFERENCES suppliers(id) ON DELETE CASCADE,
  organization_id       UUID REFERENCES organizations(id) ON DELETE CASCADE,
  average_score         NUMERIC(3,2) NOT NULL,
  review_count          INTEGER NOT NULL,
  computed_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- 13. PLATFORM BILLING AND SUBSCRIPTIONS
-- =====================================================================

CREATE TABLE IF NOT EXISTS plans (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  code                  VARCHAR(50) NOT NULL,
  name                  VARCHAR(100) NOT NULL,
  audience              VARCHAR(20) NOT NULL CHECK (audience IN ('buyer', 'supplier')),
  price                 NUMERIC(12,2) NOT NULL DEFAULT 0,
  currency              CHAR(3) NOT NULL DEFAULT 'BWP',
  billing_interval      VARCHAR(20) NOT NULL DEFAULT 'monthly'
                        CHECK (billing_interval IN ('monthly', 'yearly')),
  max_users             INTEGER,
  max_calls_per_year    INTEGER,
  features              JSONB,
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order            INTEGER NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_plans_code ON plans (code);

CREATE TABLE IF NOT EXISTS platform_financial_configs (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  config_key            VARCHAR(100) NOT NULL,
  config_value          JSONB NOT NULL,
  description           VARCHAR(500),
  effective_from        DATE NOT NULL,
  effective_to          DATE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS subscriptions (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  organization_id       UUID REFERENCES organizations(id) ON DELETE CASCADE,
  supplier_id           UUID REFERENCES suppliers(id) ON DELETE CASCADE,
  plan_id               UUID NOT NULL REFERENCES plans(id),
  status                VARCHAR(20) NOT NULL DEFAULT 'active'
                        CHECK (status IN ('trialing', 'active', 'past_due', 'cancelled', 'expired')),
  current_period_start  DATE NOT NULL,
  current_period_end    DATE NOT NULL,
  cancel_at             DATE,
  external_ref          VARCHAR(100),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_subscription_one_tenant CHECK (
    (organization_id IS NOT NULL) <> (supplier_id IS NOT NULL)
  )
);

CREATE TABLE IF NOT EXISTS platform_invoices (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  invoice_no            VARCHAR(50) NOT NULL,
  organization_id       UUID REFERENCES organizations(id),
  supplier_id           UUID REFERENCES suppliers(id),
  subscription_id       UUID REFERENCES subscriptions(id),
  status                VARCHAR(20) NOT NULL DEFAULT 'draft'
                        CHECK (status IN ('draft', 'issued', 'paid', 'overdue', 'void')),
  currency              CHAR(3) NOT NULL DEFAULT 'BWP',
  subtotal              NUMERIC(15,2) NOT NULL DEFAULT 0,
  tax_amount            NUMERIC(15,2) NOT NULL DEFAULT 0,
  total                 NUMERIC(15,2) GENERATED ALWAYS AS (subtotal + tax_amount) STORED,
  issued_at             TIMESTAMPTZ,
  due_at                TIMESTAMPTZ,
  paid_at               TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_invoice_one_tenant CHECK (
    (organization_id IS NOT NULL) <> (supplier_id IS NOT NULL)
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_platform_invoices_no ON platform_invoices (invoice_no);

CREATE TABLE IF NOT EXISTS platform_invoice_lines (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  invoice_id            UUID NOT NULL REFERENCES platform_invoices(id) ON DELETE CASCADE,
  line_type             VARCHAR(30) NOT NULL
                        CHECK (line_type IN (
                          'subscription', 'per_call', 'onboarding', 
                          'verification', 'supplier_premium', 'other'
                        )),
  description           VARCHAR(500) NOT NULL,
  quantity              NUMERIC(10,2) NOT NULL DEFAULT 1,
  unit_price            NUMERIC(12,2) NOT NULL,
  line_total            NUMERIC(15,2) GENERATED ALWAYS AS (ROUND(quantity * unit_price, 2)) STORED
);

CREATE TABLE IF NOT EXISTS payments (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  platform_invoice_id   UUID NOT NULL REFERENCES platform_invoices(id) ON DELETE CASCADE,
  amount                NUMERIC(15,2) NOT NULL,
  currency              CHAR(3) NOT NULL DEFAULT 'BWP',
  method                VARCHAR(20) NOT NULL
                        CHECK (method IN ('card', 'bank_transfer', 'mobile_money', 'cash', 'other')),
  reference             VARCHAR(150),
  status                VARCHAR(20) NOT NULL DEFAULT 'pending'
                        CHECK (status IN ('pending', 'succeeded', 'failed', 'refunded')),
  paid_at               TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS usage_records (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  organization_id       UUID REFERENCES organizations(id),
  supplier_id           UUID REFERENCES suppliers(id),
  usage_type            VARCHAR(30) NOT NULL
                        CHECK (usage_type IN (
                          'call_published', 'verification_check', 
                          'onboarding', 'supplier_premium'
                        )),
  reference_table       VARCHAR(50),
  reference_id          UUID,
  quantity              NUMERIC(10,2) NOT NULL DEFAULT 1,
  recorded_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  invoice_line_id       UUID REFERENCES platform_invoice_lines(id)
);

-- =====================================================================
-- 14. NOTIFICATIONS AND DELIVERY TRACKING
-- =====================================================================

CREATE TABLE IF NOT EXISTS notification_templates (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  organization_id       UUID REFERENCES organizations(id) ON DELETE CASCADE,
  code                  VARCHAR(100) NOT NULL,
  channel               VARCHAR(20) NOT NULL
                        CHECK (channel IN ('email', 'sms', 'whatsapp', 'in_app')),
  locale                VARCHAR(10) NOT NULL DEFAULT 'en',
  subject               VARCHAR(255),
  body                  TEXT NOT NULL,
  variables             TEXT[],
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notifications (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  organization_id       UUID REFERENCES organizations(id),
  supplier_id           UUID REFERENCES suppliers(id),
  event_type            VARCHAR(100) NOT NULL,
  title                 VARCHAR(255) NOT NULL,
  body                  VARCHAR(1000),
  link_url              VARCHAR(500),
  data                  JSONB,
  priority              VARCHAR(20) NOT NULL DEFAULT 'info'
                        CHECK (priority IN ('urgent', 'info', 'success', 'warning')),
  read_at               TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS notification_preferences (
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  channel               VARCHAR(20) NOT NULL
                        CHECK (channel IN ('in_app', 'email', 'sms', 'whatsapp')),
  event_type            VARCHAR(100) NOT NULL,
  enabled               BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (user_id, channel, event_type)
);

CREATE TABLE IF NOT EXISTS message_deliveries (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  notification_id       UUID REFERENCES notifications(id) ON DELETE SET NULL,
  user_id               UUID REFERENCES users(id),
  channel               VARCHAR(20) NOT NULL
                        CHECK (channel IN ('email', 'sms', 'whatsapp')),
  recipient             VARCHAR(255) NOT NULL,
  template_code         VARCHAR(100),
  status                VARCHAR(20) NOT NULL DEFAULT 'queued'
                        CHECK (status IN ('queued', 'sent', 'delivered', 'failed')),
  provider_ref          VARCHAR(150),
  error_message         VARCHAR(500),
  retry_count           SMALLINT NOT NULL DEFAULT 0,
  queued_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at               TIMESTAMPTZ
);

-- =====================================================================
-- 15. INTEGRATIONS (API KEYS, WEBHOOKS)
-- =====================================================================

CREATE TABLE IF NOT EXISTS api_clients (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  organization_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name                  VARCHAR(150) NOT NULL,
  key_prefix            VARCHAR(12) NOT NULL,
  key_hash              CHAR(64) NOT NULL,
  scopes                JSONB,
  created_by_user_id    UUID NOT NULL REFERENCES users(id),
  last_used_at          TIMESTAMPTZ,
  revoked_at            TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS webhook_endpoints (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  organization_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  url                   VARCHAR(500) NOT NULL,
  secret_hash           CHAR(64) NOT NULL,
  event_types           JSONB NOT NULL,
  is_active             BOOLEAN NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS webhook_deliveries (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  endpoint_id           UUID NOT NULL REFERENCES webhook_endpoints(id) ON DELETE CASCADE,
  event_type            VARCHAR(100) NOT NULL,
  payload               JSONB NOT NULL,
  response_status       SMALLINT,
  attempts              SMALLINT NOT NULL DEFAULT 0,
  last_attempt_at       TIMESTAMPTZ,
  delivered_at          TIMESTAMPTZ,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- 16. AUDIT LOG, FORENSICS, AND EXPORT TRACKING
-- =====================================================================

CREATE TABLE IF NOT EXISTS audit_log (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  occurred_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  actor_type            VARCHAR(20) NOT NULL DEFAULT 'user'
                        CHECK (actor_type IN ('user', 'system', 'api')),
  actor_user_id         UUID REFERENCES users(id),
  actor_name            VARCHAR(200),
  actor_role            VARCHAR(50),
  organization_id       UUID REFERENCES organizations(id),
  supplier_id           UUID REFERENCES suppliers(id),
  organization_name     VARCHAR(255),
  action                VARCHAR(100) NOT NULL,
  entity_type           VARCHAR(60),
  entity_id             UUID,
  ip_address            INET,
  user_agent            VARCHAR(300),
  before_json           JSONB,
  after_json            JSONB,
  details               TEXT,
  prev_hash             CHAR(64),
  row_hash              CHAR(64)
);

CREATE INDEX IF NOT EXISTS idx_audit_log_org ON audit_log (organization_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_supplier ON audit_log (supplier_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log (entity_type, entity_id);

CREATE TABLE IF NOT EXISTS audit_exports (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v7(),
  organization_id       UUID REFERENCES organizations(id) ON DELETE CASCADE,
  exported_by_user_id   UUID NOT NULL REFERENCES users(id),
  export_type           VARCHAR(50) NOT NULL CHECK (export_type IN ('audit_trail_csv', 'forensic_ledger_json', 'statutory_report_csv')),
  records_count         INTEGER NOT NULL,
  filter_parameters     JSONB,
  checksum_sha256       CHAR(64) NOT NULL,
  ip_address            INET,
  user_agent            VARCHAR(300),
  exported_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =====================================================================
-- 17. VIEWS FOR REPORTING AND DISCOVERY
-- =====================================================================

CREATE OR REPLACE VIEW v_open_calls AS
SELECT 
  c.id,
  c.reference_no,
  c.title,
  c.call_type,
  c.summary,
  c.closes_at,
  c.estimated_value,
  c.currency,
  o.name AS organization_name,
  o.slug AS organization_slug,
  EXTRACT(DAY FROM c.closes_at - NOW()) AS days_remaining
FROM calls c
JOIN organizations o ON o.id = c.organization_id AND o.status = 'active'
WHERE c.status = 'open'
  AND c.visibility = 'open'
  AND (c.opens_at IS NULL OR c.opens_at <= NOW())
  AND (c.closes_at IS NULL OR c.closes_at > NOW());

-- =====================================================================
-- 18. SEED REFERENCE DATA
-- =====================================================================

INSERT INTO permissions (code, scope, category, description) VALUES
('org.manage', 'organization', 'settings', 'Edit organization settings and branding'),
('org.members.manage', 'organization', 'settings', 'Invite and remove members'),
('org.roles.manage', 'organization', 'settings', 'Create and edit custom roles'),
('org.billing.manage', 'organization', 'settings', 'View and manage subscription and invoices'),
('forms.manage', 'organization', 'configuration', 'Build and publish form templates'),
('categories.manage', 'organization', 'configuration', 'Extend the category tree'),
('workflows.manage', 'organization', 'configuration', 'Configure review and approval stages'),
('calls.create', 'organization', 'calls', 'Create calls'),
('calls.publish', 'organization', 'calls', 'Publish calls and addenda'),
('calls.manage', 'organization', 'calls', 'Manage clarifications and call settings'),
('applications.view', 'organization', 'applications', 'View applications'),
('applications.review', 'organization', 'applications', 'Review applications'),
('applications.approve', 'organization', 'applications', 'Approve or reject applications'),
('suppliers.view', 'organization', 'suppliers', 'View the supplier database'),
('suppliers.manage', 'organization', 'suppliers', 'Suspend, renew and debar suppliers'),
('bids.view', 'organization', 'bids', 'View opened bids'),
('bids.open', 'organization', 'bids', 'Open sealed bids after closing'),
('evaluation.assign', 'organization', 'evaluation', 'Assign evaluators'),
('evaluation.score', 'organization', 'evaluation', 'Score assigned bids'),
('evaluation.consolidate', 'organization', 'evaluation', 'Consolidate scores and rank'),
('awards.recommend', 'organization', 'awards', 'Draft award recommendations'),
('awards.approve', 'organization', 'awards', 'Approve awards'),
('contracts.manage', 'organization', 'contracts', 'Manage contracts and milestones'),
('performance.review', 'organization', 'contracts', 'Rate supplier performance'),
('audit.view', 'organization', 'audit', 'View the audit log'),
('reports.view', 'organization', 'reports', 'View dashboards and reports'),
('integrations.manage', 'organization', 'integrations', 'Manage API keys and webhooks'),
('supplier.profile.edit', 'supplier', 'profile', 'Edit company profile and people'),
('supplier.documents.manage', 'supplier', 'documents', 'Upload and replace documents'),
('supplier.consent.manage', 'supplier', 'consent', 'Grant and revoke sharing'),
('supplier.apply', 'supplier', 'applications', 'Apply to calls'),
('supplier.bid.submit', 'supplier', 'bids', 'Submit and withdraw bids'),
('supplier.members.manage', 'supplier', 'settings', 'Invite and remove company users'),
('supplier.billing.manage', 'supplier', 'settings', 'Manage supplier subscription'),
('platform.admin', 'platform', 'admin', 'Platform super administrator')
ON CONFLICT (code) DO NOTHING;

INSERT INTO roles (scope, organization_id, name, description, is_system, approval_limit_bwp) VALUES
('organization', NULL, 'Org Admin', 'Full control of the organization workspace', TRUE, NULL),
('organization', NULL, 'Procurement Officer', 'Publishes calls and runs reviews', TRUE, 2500000.00),
('organization', NULL, 'Evaluator', 'Scores assigned bids', TRUE, NULL),
('organization', NULL, 'Approver', 'Approves registrations and awards', TRUE, 15000000.00),
('organization', NULL, 'Auditor', 'Read-only access to records and audit log', TRUE, NULL),
('supplier', NULL, 'Supplier Admin', 'Full control of the supplier account', TRUE, NULL),
('supplier', NULL, 'Supplier Staff', 'Prepares profile, documents and applications', TRUE, NULL)
ON CONFLICT DO NOTHING;

INSERT INTO geographic_districts (name, administrative_region, country_code, sort_order) VALUES
('South-East District', 'South-East', 'BW', 1),
('North-East District', 'North-East', 'BW', 2),
('Central District', 'Central', 'BW', 3),
('Kweneng District', 'Kweneng', 'BW', 4),
('Kgatleng District', 'Kgatleng', 'BW', 5),
('Southern District', 'Southern', 'BW', 6),
('South-West District', 'South-West', 'BW', 7),
('North-West District', 'North-West', 'BW', 8),
('Chobe District', 'Chobe', 'BW', 9),
('Ghanzi District', 'Ghanzi', 'BW', 10),
('Kgalagadi District', 'Kgalagadi', 'BW', 11),
('Lobatse District', 'South-East', 'BW', 12),
('Francistown District', 'North-East', 'BW', 13),
('Selibe-Phikwe District', 'Central', 'BW', 14),
('Jwaneng District', 'Southern', 'BW', 15),
('Orapa District', 'Central', 'BW', 16),
('Sowa Town District', 'Central', 'BW', 17)
ON CONFLICT DO NOTHING;

INSERT INTO document_types (
  organization_id, code, name, description, issuing_authority, 
  requires_expiry, default_validity_days, verification_method, is_mandatory_default
) VALUES
(NULL, 'COMPANY_REGISTRATION', 'CIPA Certificate of Incorporation', 'Proof the company is legally registered', 'Companies and Intellectual Property Authority (CIPA)', FALSE, NULL, 'registry_api', TRUE),
(NULL, 'TAX_CLEARANCE', 'BURS Tax Clearance Certificate', 'Proof of tax compliance', 'Botswana Unified Revenue Service (BURS)', TRUE, 365, 'registry_api', TRUE),
(NULL, 'VAT_REGISTRATION', 'VAT Registration Certificate', 'Proof of VAT registration', 'Botswana Unified Revenue Service (BURS)', FALSE, NULL, 'manual', FALSE),
(NULL, 'BUSINESS_LICENCE', 'Trading Licence', 'Licence to operate in the sector or locality', 'Licensing authority', TRUE, 365, 'manual', FALSE),
(NULL, 'PPRA_REGISTRATION', 'PPRA Registration Certificate', 'Public procurement registration', 'Public Procurement Regulatory Authority (PPRA)', TRUE, 730, 'registry_api', TRUE),
(NULL, 'PROOF_OF_ADDRESS', 'Proof of Address', 'Evidence of business premises', NULL, FALSE, NULL, 'manual', FALSE),
(NULL, 'BANK_CONFIRMATION', 'Bank Confirmation Letter', 'Letter confirming the company bank account', 'Bank', FALSE, NULL, 'manual', FALSE),
(NULL, 'FINANCIAL_STATEMENTS', 'Audited Financial Statements', 'Recent audited accounts', NULL, FALSE, NULL, 'manual', FALSE),
(NULL, 'COMPANY_PROFILE', 'Company Profile', 'Capability statement or company profile', NULL, FALSE, NULL, 'manual', FALSE),
(NULL, 'DIRECTOR_ID', 'Director Identity Document', 'Copy of each director identity document', NULL, TRUE, NULL, 'manual', FALSE),
(NULL, 'WORKERS_COMPENSATION', 'Workers Compensation & Safety Compliance', 'Safety compliance evidence', 'Department of Occupational Health & Safety', TRUE, 365, 'manual', TRUE),
(NULL, 'PROFESSIONAL_LICENCE', 'Professional or Trade Licence', 'Sector-specific professional registration', NULL, TRUE, NULL, 'manual', FALSE),
(NULL, 'PUBLIC_LIABILITY_INSURANCE', 'Public Liability Insurance Policy', 'Proof of public liability cover', 'Insurance company', TRUE, 365, 'manual', TRUE),
(NULL, 'BANK_RATING_LETTER', 'Bank Rating Letter', 'Bank-issued credit rating', 'Bank', TRUE, 365, 'manual', FALSE),
(NULL, 'PREFERENCE_EVIDENCE', 'Preference Status Evidence', 'Evidence for preference claims', NULL, FALSE, NULL, 'manual', FALSE),
(NULL, 'EDD_CERTIFICATE', 'EDD Certificate', 'Economic Diversification Drive certificate', 'Ministry of Investment, Trade and Industry', TRUE, 365, 'manual', FALSE)
ON CONFLICT DO NOTHING;

INSERT INTO procurement_disciplines (code, title, description, sort_order) VALUES
('01', 'Building Construction', 'General building construction works', 1),
('02', 'Electrical Engineering', 'Electrical installation and maintenance', 2),
('03', 'Civil Engineering', 'Roads, bridges, and civil infrastructure', 3),
('04', 'Mechanical Engineering', 'Mechanical systems and equipment', 4),
('05', 'Water & Sanitation', 'Water supply and sanitation infrastructure', 5),
('06', 'ICT & Technology', 'Information and communication technology', 6),
('07', 'General Supplies', 'General goods and supplies', 7),
('08', 'Professional Services', 'Consultancy and professional services', 8),
('09', 'Facilities Management', 'Facilities and property management', 9),
('10', 'Transport & Logistics', 'Transportation and logistics services', 10),
('11', 'Security Services', 'Security and guarding services', 11),
('12', 'Cleaning Services', 'Cleaning and hygiene services', 12),
('13', 'Catering Services', 'Catering and food services', 13),
('14', 'Printing & Publishing', 'Printing and publishing services', 14),
('15', 'Medical Supplies', 'Medical and pharmaceutical supplies', 15)
ON CONFLICT (code) DO NOTHING;

INSERT INTO capability_tiers (code, name, description, min_contract_value, max_contract_value, sort_order) VALUES
('E', 'Grade E (Unlimited)', 'Unlimited capacity for any contract value', NULL, NULL, 1),
('D', 'Grade D', 'Large capacity contracts', 10000000.00, NULL, 2),
('C', 'Grade C', 'Medium-large capacity contracts', 5000000.00, 10000000.00, 3),
('B', 'Grade B', 'Medium capacity contracts', 1000000.00, 5000000.00, 4),
('A', 'Grade A', 'Small-medium capacity contracts', 500000.00, 1000000.00, 5),
('MICRO', 'Micro Enterprise', 'Micro enterprise contracts', NULL, 500000.00, 6),
('SMALL', 'Small Enterprise', 'Small enterprise contracts', NULL, 1000000.00, 7)
ON CONFLICT (code) DO NOTHING;

INSERT INTO plans (code, name, audience, price, currency, billing_interval, max_users, max_calls_per_year, features, sort_order) VALUES
('BUYER_STARTER', 'Starter', 'buyer', 1500.00, 'BWP', 'monthly', 3, 5, '{"registration": true, "eoi": true, "rfp": false}', 1),
('BUYER_LOCAL_AUTHORITY', 'Local Authority', 'buyer', 4500.00, 'BWP', 'monthly', 10, 20, '{"registration": true, "eoi": true, "rfp": true, "evaluation": true}', 2),
('BUYER_PARASTATAL', 'Parastatal', 'buyer', 12500.00, 'BWP', 'monthly', 25, 50, '{"registration": true, "eoi": true, "rfp": true, "evaluation": true, "api": true}', 3),
('BUYER_ENTERPRISE', 'Enterprise', 'buyer', 25000.00, 'BWP', 'monthly', NULL, NULL, '{"registration": true, "eoi": true, "rfp": true, "evaluation": true, "sso": true, "api": true, "custom_domain": true}', 4),
('SUPPLIER_FREE', 'Supplier Free', 'supplier', 0.00, 'BWP', 'monthly', NULL, NULL, '{"profile": true, "apply": true}', 5),
('SUPPLIER_PREMIUM', 'Supplier Premium', 'supplier', 150.00, 'BWP', 'monthly', NULL, NULL, '{"priority_alerts": true, "analytics": true, "verified_badge": true}', 6)
ON CONFLICT (code) DO NOTHING;

INSERT INTO platform_financial_configs (config_key, config_value, description, effective_from) VALUES
('vat_rate', '0.14', 'Statutory VAT rate (14%) in Botswana', '2020-04-01'),
('currency', '"BWP"', 'Default currency code', '2020-01-01'),
('timezone', '"Africa/Gaborone"', 'Default timezone for display', '2020-01-01'),
('default_closing_time', '"14:00"', 'Standard statutory closing time CAT', '2020-01-01'),
('clarification_deadline_days', '7', 'Days before closing when clarifications close', '2020-01-01')
ON CONFLICT DO NOTHING;
