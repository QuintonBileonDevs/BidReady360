import { query } from './client';

/**
 * Idempotently applies Step 1 Foundation Safety schema columns and indexes
 * so existing PostgreSQL databases match scripts/schema.sql without manual intervention.
 */
export async function ensureFoundationSchema(): Promise<void> {
  const statements = [
    // suppliers
    `ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS profile_completeness_updated_at TIMESTAMPTZ`,
    `ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS vat_registered BOOLEAN NOT NULL DEFAULT FALSE`,
    `ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS citizen_ownership_set BOOLEAN NOT NULL DEFAULT FALSE`,
    `ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS bidding_public_tenders BOOLEAN NOT NULL DEFAULT TRUE`,
    `ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS secondary_categories TEXT[] NOT NULL DEFAULT '{}'::text[]`,
    `ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS ppra_subcodes TEXT[] NOT NULL DEFAULT '{}'::text[]`,
    `ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS ppra_grade VARCHAR(50)`,
    `ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS has_trading_licence BOOLEAN DEFAULT NULL`,
    `ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS trading_licence_reason TEXT DEFAULT NULL`,
    `ALTER TABLE suppliers ADD COLUMN IF NOT EXISTS year_established SMALLINT`,

    // document_types
    `ALTER TABLE document_types ADD COLUMN IF NOT EXISTS requires_number BOOLEAN NOT NULL DEFAULT TRUE`,
    `ALTER TABLE document_types ADD COLUMN IF NOT EXISTS validity_days INTEGER`,
    `UPDATE document_types SET validity_days = default_validity_days WHERE validity_days IS NULL AND default_validity_days IS NOT NULL`,

    // supplier_documents
    `ALTER TABLE supplier_documents ADD COLUMN IF NOT EXISTS extracted_fields JSONB`,
    `ALTER TABLE supplier_documents ADD COLUMN IF NOT EXISTS ocr_confidence NUMERIC(5,2)`,
    `ALTER TABLE supplier_documents ADD COLUMN IF NOT EXISTS file_size_bytes BIGINT`,

    // bids
    `ALTER TABLE bids ADD COLUMN IF NOT EXISTS sealed_payload_key VARCHAR(512)`,
    `ALTER TABLE bids ADD COLUMN IF NOT EXISTS sealed_payload_hash CHAR(64)`,
    `ALTER TABLE bids ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ`,
    `UPDATE bids SET sealed_payload_hash = payload_sha256 WHERE sealed_payload_hash IS NULL AND payload_sha256 IS NOT NULL`,

    // clarifications
    `ALTER TABLE clarifications ADD COLUMN IF NOT EXISTS is_published BOOLEAN NOT NULL DEFAULT FALSE`,

    // organizations
    `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ`,
    `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS approved_by UUID REFERENCES users(id)`,
    `ALTER TABLE organizations ADD COLUMN IF NOT EXISTS approved_by_user_id UUID REFERENCES users(id)`,
    `UPDATE organizations SET approved_by = approved_by_user_id WHERE approved_by IS NULL AND approved_by_user_id IS NOT NULL`,

    // awards unique index required by ON CONFLICT (bid_id)
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_awards_bid_id ON awards (bid_id)`,
  ];

  for (const sql of statements) {
    await query(sql);
  }
}
