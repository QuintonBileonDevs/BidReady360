import dotenv from 'dotenv';
dotenv.config();

import { getClient } from '../server/db/client.js';

async function setup() {
  const client = await getClient();
  try {
    await client.query('BEGIN');

    console.log('1. Creating or replacing compute_supplier_completeness...');
    await client.query(`
      CREATE OR REPLACE FUNCTION compute_supplier_completeness(p_supplier_id UUID)
      RETURNS INTEGER AS $$
      DECLARE
        v_supplier RECORD;
        v_total_count INTEGER := 15;
        v_completed_count INTEGER := 0;
        v_ownership_sum NUMERIC := 0;
        v_active_directors_count INTEGER := 0;
        v_has_cipa BOOLEAN := FALSE;
        v_has_tax BOOLEAN := FALSE;
        v_has_director_id BOOLEAN := FALSE;
        v_has_bank_letter BOOLEAN := FALSE;
        v_has_trading_licence_doc BOOLEAN := FALSE;
        v_raw_phone TEXT;
      BEGIN
        SELECT * INTO v_supplier FROM suppliers WHERE id = p_supplier_id;
        IF NOT FOUND THEN
          RETURN 0;
        END IF;

        -- 1. Legal Name
        IF TRIM(COALESCE(v_supplier.legal_name, '')) <> '' THEN
          v_completed_count := v_completed_count + 1;
        END IF;

        -- 2. Trading Name
        IF TRIM(COALESCE(v_supplier.trading_name, '')) <> '' THEN
          v_completed_count := v_completed_count + 1;
        END IF;

        -- 3. Tax Number (BURS TIN)
        IF TRIM(COALESCE(v_supplier.burs_tin, '')) <> '' THEN
          v_completed_count := v_completed_count + 1;
        END IF;

        -- 4. Physical Address
        IF TRIM(COALESCE(v_supplier.physical_address, '')) <> '' THEN
          v_completed_count := v_completed_count + 1;
        END IF;

        -- 5. City
        IF TRIM(COALESCE(v_supplier.city, '')) <> '' THEN
          v_completed_count := v_completed_count + 1;
        END IF;

        -- 6. District
        IF v_supplier.district_id IS NOT NULL THEN
          v_completed_count := v_completed_count + 1;
        END IF;

        -- 7. Phone (at least 7 digits)
        v_raw_phone := REGEXP_REPLACE(COALESCE(v_supplier.primary_phone, ''), '\\D', '', 'g');
        IF LENGTH(v_raw_phone) >= 7 THEN
          v_completed_count := v_completed_count + 1;
        END IF;

        -- 8. Email (valid email containing @)
        IF POSITION('@' IN COALESCE(v_supplier.email, '')) > 0 THEN
          v_completed_count := v_completed_count + 1;
        END IF;

        -- 9. Bank Details (bank name + either branch or account number)
        IF TRIM(COALESCE(v_supplier.bank_name, '')) <> '' AND
           (TRIM(COALESCE(v_supplier.bank_branch, '')) <> '' OR TRIM(COALESCE(v_supplier.account_number_masked, '')) <> '') THEN
          v_completed_count := v_completed_count + 1;
        END IF;

        -- 10. Citizen Ownership % (> 0 and <= 100)
        IF v_supplier.citizen_owned_percentage IS NOT NULL AND
           v_supplier.citizen_owned_percentage::numeric > 0 AND
           v_supplier.citizen_owned_percentage::numeric <= 100 THEN
          v_completed_count := v_completed_count + 1;
        END IF;

        -- 11. Directors: at least one active director with sum ownership = 100%
        SELECT COUNT(*), COALESCE(SUM(COALESCE(ownership_percent::numeric, 0)), 0)
        INTO v_active_directors_count, v_ownership_sum
        FROM supplier_people
        WHERE supplier_id = p_supplier_id AND is_active = TRUE;

        IF v_active_directors_count > 0 AND ROUND(v_ownership_sum) = 100 THEN
          v_completed_count := v_completed_count + 1;
        END IF;

        -- Document requirements: check valid, verified, non-expired documents
        -- 12. CIPA Certificate
        SELECT EXISTS (
          SELECT 1
          FROM supplier_documents sd
          JOIN document_types dt ON dt.id = sd.document_type_id
          LEFT JOIN supplier_document_versions sdv ON sdv.id = sd.current_version_id
          WHERE sd.supplier_id = p_supplier_id
            AND sd.status = 'active'
            AND sdv.verification_status IN ('VERIFIED', 'APPROVED')
            AND (sdv.expiry_date IS NULL OR sdv.expiry_date >= CURRENT_DATE)
            AND (dt.code IN ('COMPANY_REGISTRATION', 'CIPA_CERT', 'CIPA') OR dt.name ILIKE '%cipa%' OR dt.name ILIKE '%incorporation%')
        ) INTO v_has_cipa;
        IF v_has_cipa THEN v_completed_count := v_completed_count + 1; END IF;

        -- 13. Tax Clearance
        SELECT EXISTS (
          SELECT 1
          FROM supplier_documents sd
          JOIN document_types dt ON dt.id = sd.document_type_id
          LEFT JOIN supplier_document_versions sdv ON sdv.id = sd.current_version_id
          WHERE sd.supplier_id = p_supplier_id
            AND sd.status = 'active'
            AND sdv.verification_status IN ('VERIFIED', 'APPROVED')
            AND (sdv.expiry_date IS NULL OR sdv.expiry_date >= CURRENT_DATE)
            AND (dt.code IN ('TAX_CLEARANCE', 'BURS_TAX') OR dt.name ILIKE '%tax%' OR dt.name ILIKE '%burs%')
        ) INTO v_has_tax;
        IF v_has_tax THEN v_completed_count := v_completed_count + 1; END IF;

        -- 14. Directors ID
        SELECT EXISTS (
          SELECT 1
          FROM supplier_documents sd
          JOIN document_types dt ON dt.id = sd.document_type_id
          LEFT JOIN supplier_document_versions sdv ON sdv.id = sd.current_version_id
          WHERE sd.supplier_id = p_supplier_id
            AND sd.status = 'active'
            AND sdv.verification_status IN ('VERIFIED', 'APPROVED')
            AND (sdv.expiry_date IS NULL OR sdv.expiry_date >= CURRENT_DATE)
            AND (dt.code IN ('DIRECTOR_ID', 'DIRECTORS_ID', 'OMANG') OR dt.name ILIKE '%director%' OR dt.name ILIKE '%omang%' OR dt.name ILIKE '%passport%')
        ) INTO v_has_director_id;
        IF v_has_director_id THEN v_completed_count := v_completed_count + 1; END IF;

        -- 15. Bank Confirmation Letter
        SELECT EXISTS (
          SELECT 1
          FROM supplier_documents sd
          JOIN document_types dt ON dt.id = sd.document_type_id
          LEFT JOIN supplier_document_versions sdv ON sdv.id = sd.current_version_id
          WHERE sd.supplier_id = p_supplier_id
            AND sd.status = 'active'
            AND sdv.verification_status IN ('VERIFIED', 'APPROVED')
            AND (sdv.expiry_date IS NULL OR sdv.expiry_date >= CURRENT_DATE)
            AND (dt.code IN ('BANK_CONFIRMATION', 'BANK_LETTER') OR dt.name ILIKE '%bank confirmation%' OR dt.name ILIKE '%bank letter%')
        ) INTO v_has_bank_letter;
        IF v_has_bank_letter THEN v_completed_count := v_completed_count + 1; END IF;

        -- Conditional: Trading Licence
        IF v_supplier.has_trading_licence IS TRUE THEN
          v_total_count := v_total_count + 1;
          SELECT EXISTS (
            SELECT 1
            FROM supplier_documents sd
            JOIN document_types dt ON dt.id = sd.document_type_id
            LEFT JOIN supplier_document_versions sdv ON sdv.id = sd.current_version_id
            WHERE sd.supplier_id = p_supplier_id
              AND sd.status = 'active'
              AND sdv.verification_status IN ('VERIFIED', 'APPROVED')
              AND (sdv.expiry_date IS NULL OR sdv.expiry_date >= CURRENT_DATE)
              AND (dt.code IN ('BUSINESS_LICENCE', 'TRADING_LICENCE') OR dt.name ILIKE '%trading%' OR dt.name ILIKE '%business licence%')
          ) INTO v_has_trading_licence_doc;
          IF v_has_trading_licence_doc THEN v_completed_count := v_completed_count + 1; END IF;
        END IF;

        RETURN LEAST(100, GREATEST(0, ROUND((v_completed_count::numeric / v_total_count::numeric) * 100)::integer));
      END;
      $$ LANGUAGE plpgsql STABLE;
    `);

    console.log('2. Creating or replacing compute_supplier_missing_items...');
    await client.query(`DROP FUNCTION IF EXISTS compute_supplier_missing_items(uuid) CASCADE;`);
    await client.query(`
      CREATE OR REPLACE FUNCTION compute_supplier_missing_items(p_supplier_id UUID)
      RETURNS TEXT[] AS $$
      DECLARE
        v_supplier RECORD;
        v_missing TEXT[] := ARRAY[]::TEXT[];
        v_ownership_sum NUMERIC := 0;
        v_active_directors_count INTEGER := 0;
        v_has_cipa BOOLEAN := FALSE;
        v_has_tax BOOLEAN := FALSE;
        v_has_director_id BOOLEAN := FALSE;
        v_has_bank_letter BOOLEAN := FALSE;
        v_has_trading_licence_doc BOOLEAN := FALSE;
        v_raw_phone TEXT;
      BEGIN
        SELECT * INTO v_supplier FROM suppliers WHERE id = p_supplier_id;
        IF NOT FOUND THEN
          RETURN ARRAY[]::TEXT[];
        END IF;

        -- 1. Legal Name
        IF TRIM(COALESCE(v_supplier.legal_name, '')) = '' THEN
          v_missing := array_append(v_missing, 'Legal company name');
        END IF;

        -- 2. Trading Name
        IF TRIM(COALESCE(v_supplier.trading_name, '')) = '' THEN
          v_missing := array_append(v_missing, 'Trading name');
        END IF;

        -- 3. Tax Number
        IF TRIM(COALESCE(v_supplier.burs_tin, '')) = '' THEN
          v_missing := array_append(v_missing, 'BURS Tax Identification Number (TIN)');
        END IF;

        -- 4. Physical Address
        IF TRIM(COALESCE(v_supplier.physical_address, '')) = '' THEN
          v_missing := array_append(v_missing, 'Physical plot & street address');
        END IF;

        -- 5. City
        IF TRIM(COALESCE(v_supplier.city, '')) = '' THEN
          v_missing := array_append(v_missing, 'City or town of operation');
        END IF;

        -- 6. District
        IF v_supplier.district_id IS NULL THEN
          v_missing := array_append(v_missing, 'Administrative district');
        END IF;

        -- 7. Phone
        v_raw_phone := REGEXP_REPLACE(COALESCE(v_supplier.primary_phone, ''), '\\D', '', 'g');
        IF LENGTH(v_raw_phone) < 7 THEN
          v_missing := array_append(v_missing, 'Primary contact telephone');
        END IF;

        -- 8. Email
        IF POSITION('@' IN COALESCE(v_supplier.email, '')) = 0 THEN
          v_missing := array_append(v_missing, 'Official corporate email');
        END IF;

        -- 9. Bank Details
        IF TRIM(COALESCE(v_supplier.bank_name, '')) = '' OR
           (TRIM(COALESCE(v_supplier.bank_branch, '')) = '' AND TRIM(COALESCE(v_supplier.account_number_masked, '')) = '') THEN
          v_missing := array_append(v_missing, 'Commercial banking details');
        END IF;

        -- 10. Citizen Ownership %
        IF v_supplier.citizen_owned_percentage IS NULL OR
           v_supplier.citizen_owned_percentage::numeric <= 0 OR
           v_supplier.citizen_owned_percentage::numeric > 100 THEN
          v_missing := array_append(v_missing, 'Citizen equity ownership percentage');
        END IF;

        -- 11. Directors
        SELECT COUNT(*), COALESCE(SUM(COALESCE(ownership_percent::numeric, 0)), 0)
        INTO v_active_directors_count, v_ownership_sum
        FROM supplier_people
        WHERE supplier_id = p_supplier_id AND is_active = TRUE;

        IF v_active_directors_count = 0 OR ROUND(v_ownership_sum) <> 100 THEN
          v_missing := array_append(v_missing, 'Registered directors with 100% total ownership');
        END IF;

        -- Documents:
        -- 12. CIPA Certificate
        SELECT EXISTS (
          SELECT 1
          FROM supplier_documents sd
          JOIN document_types dt ON dt.id = sd.document_type_id
          LEFT JOIN supplier_document_versions sdv ON sdv.id = sd.current_version_id
          WHERE sd.supplier_id = p_supplier_id
            AND sd.status = 'active'
            AND sdv.verification_status IN ('VERIFIED', 'APPROVED')
            AND (sdv.expiry_date IS NULL OR sdv.expiry_date >= CURRENT_DATE)
            AND (dt.code IN ('COMPANY_REGISTRATION', 'CIPA_CERT', 'CIPA') OR dt.name ILIKE '%cipa%' OR dt.name ILIKE '%incorporation%')
        ) INTO v_has_cipa;
        IF NOT v_has_cipa THEN
          v_missing := array_append(v_missing, 'CIPA Certificate of Incorporation (Verified)');
        END IF;

        -- 13. Tax Clearance
        SELECT EXISTS (
          SELECT 1
          FROM supplier_documents sd
          JOIN document_types dt ON dt.id = sd.document_type_id
          LEFT JOIN supplier_document_versions sdv ON sdv.id = sd.current_version_id
          WHERE sd.supplier_id = p_supplier_id
            AND sd.status = 'active'
            AND sdv.verification_status IN ('VERIFIED', 'APPROVED')
            AND (sdv.expiry_date IS NULL OR sdv.expiry_date >= CURRENT_DATE)
            AND (dt.code IN ('TAX_CLEARANCE', 'BURS_TAX') OR dt.name ILIKE '%tax%' OR dt.name ILIKE '%burs%')
        ) INTO v_has_tax;
        IF NOT v_has_tax THEN
          v_missing := array_append(v_missing, 'BURS Tax Clearance Certificate (Verified)');
        END IF;

        -- 14. Directors ID
        SELECT EXISTS (
          SELECT 1
          FROM supplier_documents sd
          JOIN document_types dt ON dt.id = sd.document_type_id
          LEFT JOIN supplier_document_versions sdv ON sdv.id = sd.current_version_id
          WHERE sd.supplier_id = p_supplier_id
            AND sd.status = 'active'
            AND sdv.verification_status IN ('VERIFIED', 'APPROVED')
            AND (sdv.expiry_date IS NULL OR sdv.expiry_date >= CURRENT_DATE)
            AND (dt.code IN ('DIRECTOR_ID', 'DIRECTORS_ID', 'OMANG') OR dt.name ILIKE '%director%' OR dt.name ILIKE '%omang%' OR dt.name ILIKE '%passport%')
        ) INTO v_has_director_id;
        IF NOT v_has_director_id THEN
          v_missing := array_append(v_missing, 'Directors and shareholders ID (Verified)');
        END IF;

        -- 15. Bank Letter
        SELECT EXISTS (
          SELECT 1
          FROM supplier_documents sd
          JOIN document_types dt ON dt.id = sd.document_type_id
          LEFT JOIN supplier_document_versions sdv ON sdv.id = sd.current_version_id
          WHERE sd.supplier_id = p_supplier_id
            AND sd.status = 'active'
            AND sdv.verification_status IN ('VERIFIED', 'APPROVED')
            AND (sdv.expiry_date IS NULL OR sdv.expiry_date >= CURRENT_DATE)
            AND (dt.code IN ('BANK_CONFIRMATION', 'BANK_LETTER') OR dt.name ILIKE '%bank confirmation%' OR dt.name ILIKE '%bank letter%')
        ) INTO v_has_bank_letter;
        IF NOT v_has_bank_letter THEN
          v_missing := array_append(v_missing, 'Bank confirmation letter (Verified)');
        END IF;

        -- Conditional: Trading Licence
        IF v_supplier.has_trading_licence IS TRUE THEN
          SELECT EXISTS (
            SELECT 1
            FROM supplier_documents sd
            JOIN document_types dt ON dt.id = sd.document_type_id
            LEFT JOIN supplier_document_versions sdv ON sdv.id = sd.current_version_id
            WHERE sd.supplier_id = p_supplier_id
              AND sd.status = 'active'
              AND sdv.verification_status IN ('VERIFIED', 'APPROVED')
              AND (sdv.expiry_date IS NULL OR sdv.expiry_date >= CURRENT_DATE)
              AND (dt.code IN ('BUSINESS_LICENCE', 'TRADING_LICENCE') OR dt.name ILIKE '%trading%' OR dt.name ILIKE '%business licence%')
          ) INTO v_has_trading_licence_doc;
          IF NOT v_has_trading_licence_doc THEN
            v_missing := array_append(v_missing, 'Trading Licence (Verified)');
          END IF;
        END IF;

        RETURN v_missing;
      END;
      $$ LANGUAGE plpgsql STABLE;
    `);

    console.log('3. Creating or replacing recalc_supplier_completeness...');
    await client.query(`
      CREATE OR REPLACE FUNCTION recalc_supplier_completeness(p_supplier_id UUID)
      RETURNS INTEGER AS $$
      DECLARE
        v_new_score INTEGER;
        v_new_missing TEXT[];
        v_new_compliance TEXT;
        v_cur_score INTEGER;
        v_cur_missing TEXT[];
        v_cur_compliance TEXT;
      BEGIN
        IF p_supplier_id IS NULL THEN
          RETURN 0;
        END IF;

        v_new_score := compute_supplier_completeness(p_supplier_id);
        v_new_missing := compute_supplier_missing_items(p_supplier_id);
        v_new_compliance := CASE WHEN v_new_score >= 80 THEN 'Fully compliant' ELSE 'Action required' END;

        SELECT profile_completeness, missing_items, compliance_status
        INTO v_cur_score, v_cur_missing, v_cur_compliance
        FROM suppliers
        WHERE id = p_supplier_id;

        IF v_cur_score IS DISTINCT FROM v_new_score
           OR v_cur_missing IS DISTINCT FROM v_new_missing
           OR v_cur_compliance IS DISTINCT FROM v_new_compliance
           OR (SELECT profile_completeness_updated_at FROM suppliers WHERE id = p_supplier_id) IS NULL THEN
          UPDATE suppliers
          SET profile_completeness = v_new_score,
              missing_items = v_new_missing,
              compliance_status = v_new_compliance,
              profile_completeness_updated_at = NOW()
          WHERE id = p_supplier_id;
        END IF;

        RETURN v_new_score;
      END;
      $$ LANGUAGE plpgsql VOLATILE;
    `);

    console.log('4. Creating trigger functions...');

    // Trigger function for suppliers table
    await client.query(`
      CREATE OR REPLACE FUNCTION trg_fn_suppliers_completeness_recalc()
      RETURNS TRIGGER AS $$
      BEGIN
        IF pg_trigger_depth() <= 1 THEN
          PERFORM recalc_supplier_completeness(NEW.id);
        END IF;
        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Trigger function for supplier_people table
    await client.query(`
      CREATE OR REPLACE FUNCTION trg_fn_people_completeness_recalc()
      RETURNS TRIGGER AS $$
      BEGIN
        IF TG_OP = 'DELETE' THEN
          PERFORM recalc_supplier_completeness(OLD.supplier_id);
          RETURN OLD;
        ELSIF TG_OP = 'UPDATE' THEN
          PERFORM recalc_supplier_completeness(NEW.supplier_id);
          IF OLD.supplier_id <> NEW.supplier_id THEN
            PERFORM recalc_supplier_completeness(OLD.supplier_id);
          END IF;
          RETURN NEW;
        ELSE
          PERFORM recalc_supplier_completeness(NEW.supplier_id);
          RETURN NEW;
        END IF;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Trigger function for supplier_documents table
    await client.query(`
      CREATE OR REPLACE FUNCTION trg_fn_documents_completeness_recalc()
      RETURNS TRIGGER AS $$
      BEGIN
        IF TG_OP = 'DELETE' THEN
          PERFORM recalc_supplier_completeness(OLD.supplier_id);
          RETURN OLD;
        ELSIF TG_OP = 'UPDATE' THEN
          PERFORM recalc_supplier_completeness(NEW.supplier_id);
          IF OLD.supplier_id <> NEW.supplier_id THEN
            PERFORM recalc_supplier_completeness(OLD.supplier_id);
          END IF;
          RETURN NEW;
        ELSE
          PERFORM recalc_supplier_completeness(NEW.supplier_id);
          RETURN NEW;
        END IF;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Trigger function for supplier_document_versions table
    await client.query(`
      CREATE OR REPLACE FUNCTION trg_fn_doc_versions_completeness_recalc()
      RETURNS TRIGGER AS $$
      DECLARE
        v_sup_id UUID;
      BEGIN
        IF TG_OP = 'DELETE' THEN
          SELECT supplier_id INTO v_sup_id FROM supplier_documents WHERE id = OLD.document_id;
          IF v_sup_id IS NOT NULL THEN
            PERFORM recalc_supplier_completeness(v_sup_id);
          END IF;
          RETURN OLD;
        ELSE
          SELECT supplier_id INTO v_sup_id FROM supplier_documents WHERE id = NEW.document_id;
          IF v_sup_id IS NOT NULL THEN
            PERFORM recalc_supplier_completeness(v_sup_id);
          END IF;
          RETURN NEW;
        END IF;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Trigger function for supplier_attributes
    await client.query(`
      CREATE OR REPLACE FUNCTION trg_fn_attributes_completeness_recalc()
      RETURNS TRIGGER AS $$
      BEGIN
        IF TG_OP = 'DELETE' THEN
          PERFORM recalc_supplier_completeness(OLD.supplier_id);
          RETURN OLD;
        ELSE
          PERFORM recalc_supplier_completeness(NEW.supplier_id);
          RETURN NEW;
        END IF;
      END;
      $$ LANGUAGE plpgsql;
    `);

    // Trigger function for supplier_discipline_allocations
    await client.query(`
      CREATE OR REPLACE FUNCTION trg_fn_allocations_completeness_recalc()
      RETURNS TRIGGER AS $$
      BEGIN
        IF TG_OP = 'DELETE' THEN
          PERFORM recalc_supplier_completeness(OLD.supplier_id);
          RETURN OLD;
        ELSE
          PERFORM recalc_supplier_completeness(NEW.supplier_id);
          RETURN NEW;
        END IF;
      END;
      $$ LANGUAGE plpgsql;
    `);

    console.log('5. Attaching triggers to tables...');

    // Suppliers table trigger
    await client.query(`DROP TRIGGER IF EXISTS trg_suppliers_completeness_recalc ON suppliers`);
    await client.query(`
      CREATE TRIGGER trg_suppliers_completeness_recalc
      AFTER INSERT OR UPDATE OF legal_name, trading_name, burs_tin, physical_address, city, district_id,
                                primary_phone, email, bank_name, bank_branch, account_number_masked,
                                citizen_owned_percentage, has_trading_licence, employee_count_band
      ON suppliers
      FOR EACH ROW
      EXECUTE FUNCTION trg_fn_suppliers_completeness_recalc();
    `);

    // Supplier_people trigger
    await client.query(`DROP TRIGGER IF EXISTS trg_supplier_people_completeness_recalc ON supplier_people`);
    await client.query(`
      CREATE TRIGGER trg_supplier_people_completeness_recalc
      AFTER INSERT OR UPDATE OR DELETE
      ON supplier_people
      FOR EACH ROW
      EXECUTE FUNCTION trg_fn_people_completeness_recalc();
    `);

    // Supplier_documents trigger
    await client.query(`DROP TRIGGER IF EXISTS trg_supplier_documents_completeness_recalc ON supplier_documents`);
    await client.query(`
      CREATE TRIGGER trg_supplier_documents_completeness_recalc
      AFTER INSERT OR UPDATE OR DELETE
      ON supplier_documents
      FOR EACH ROW
      EXECUTE FUNCTION trg_fn_documents_completeness_recalc();
    `);

    // Supplier_document_versions trigger
    await client.query(`DROP TRIGGER IF EXISTS trg_supplier_doc_versions_completeness_recalc ON supplier_document_versions`);
    await client.query(`
      CREATE TRIGGER trg_supplier_doc_versions_completeness_recalc
      AFTER INSERT OR UPDATE OR DELETE
      ON supplier_document_versions
      FOR EACH ROW
      EXECUTE FUNCTION trg_fn_doc_versions_completeness_recalc();
    `);

    // Supplier_attributes trigger
    await client.query(`DROP TRIGGER IF EXISTS trg_supplier_attributes_completeness_recalc ON supplier_attributes`);
    await client.query(`
      CREATE TRIGGER trg_supplier_attributes_completeness_recalc
      AFTER INSERT OR UPDATE OR DELETE
      ON supplier_attributes
      FOR EACH ROW
      EXECUTE FUNCTION trg_fn_attributes_completeness_recalc();
    `);

    // Supplier_discipline_allocations trigger
    await client.query(`DROP TRIGGER IF EXISTS trg_supplier_allocations_completeness_recalc ON supplier_discipline_allocations`);
    await client.query(`
      CREATE TRIGGER trg_supplier_allocations_completeness_recalc
      AFTER INSERT OR UPDATE OR DELETE
      ON supplier_discipline_allocations
      FOR EACH ROW
      EXECUTE FUNCTION trg_fn_allocations_completeness_recalc();
    `);

    console.log('6. Creating Step 3 audit_log immutability & sealed bid protection triggers...');
    await client.query(`
      ALTER TABLE bid_opening_sessions ADD COLUMN IF NOT EXISTS witness_summary JSONB;
      ALTER TABLE consent_grants ADD COLUMN IF NOT EXISTS selected_document_names TEXT[];
      CREATE INDEX IF NOT EXISTS idx_consent_grants_pair ON consent_grants (supplier_id, organization_id);
      CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications (user_id, created_at DESC);
    `);

    await client.query(`
      CREATE OR REPLACE FUNCTION trg_fn_audit_log_immutable()
      RETURNS TRIGGER AS $$
      BEGIN
        RAISE EXCEPTION 'Audit log records are strictly append-only and cannot be %d.', TG_OP
          USING ERRCODE = '42501';
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trg_audit_log_immutable ON audit_log;
      CREATE TRIGGER trg_audit_log_immutable
      BEFORE UPDATE OR DELETE ON audit_log
      FOR EACH ROW
      EXECUTE FUNCTION trg_fn_audit_log_immutable();
    `);

    await client.query(`
      CREATE OR REPLACE FUNCTION trg_fn_bids_seal_protection()
      RETURNS TRIGGER AS $$
      DECLARE
        v_closes_at TIMESTAMPTZ;
      BEGIN
        IF TG_OP = 'DELETE' THEN
          IF OLD.status IN ('submitted', 'opened', 'disqualified') THEN
            RAISE EXCEPTION 'Sealed or opened bids cannot be deleted (bid %).', OLD.id
              USING ERRCODE = '42501';
          END IF;
          RETURN OLD;
        END IF;

        SELECT closes_at INTO v_closes_at FROM calls WHERE id = NEW.call_id;

        IF TG_OP = 'UPDATE' THEN
          IF OLD.status IN ('opened', 'disqualified') THEN
            IF NEW.status IS DISTINCT FROM OLD.status
               OR NEW.total_price IS DISTINCT FROM OLD.total_price
               OR NEW.payload_sha256 IS DISTINCT FROM OLD.payload_sha256
               OR NEW.sealed_payload_hash IS DISTINCT FROM OLD.sealed_payload_hash THEN
              RAISE EXCEPTION 'Opened or disqualified bid % is immutable and cannot be modified.', OLD.id
                USING ERRCODE = '42501';
            END IF;
          END IF;

          IF OLD.status = 'submitted' AND NEW.status = 'withdrawn' THEN
            IF v_closes_at IS NOT NULL AND NOW() > v_closes_at THEN
              RAISE EXCEPTION 'Bids cannot be withdrawn after the tender closing deadline (%).', v_closes_at
                USING ERRCODE = 'P0001';
            END IF;
          END IF;
        END IF;

        IF NEW.status = 'opened' OR NEW.opened_in_session_id IS NOT NULL THEN
          IF v_closes_at IS NULL OR NOW() < v_closes_at THEN
            RAISE EXCEPTION 'Bids cannot be unsealed prior to the tender closing deadline (%).', v_closes_at
              USING ERRCODE = 'P0001';
          END IF;
        END IF;

        RETURN NEW;
      END;
      $$ LANGUAGE plpgsql;

      DROP TRIGGER IF EXISTS trg_bids_seal_protection ON bids;
      CREATE TRIGGER trg_bids_seal_protection
      BEFORE INSERT OR UPDATE OR DELETE ON bids
      FOR EACH ROW
      EXECUTE FUNCTION trg_fn_bids_seal_protection();
    `);

    console.log('7. Running one-time backfill on all suppliers...');
    const backfill = await client.query(`
      SELECT id, legal_name, recalc_supplier_completeness(id) AS completeness 
      FROM suppliers;
    `);
    console.log('Backfilled suppliers:', backfill.rows);

    await client.query('COMMIT');
    console.log('Setup successfully completed!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Setup failed:', err);
    throw err;
  } finally {
    client.release();
    process.exit(0);
  }
}

setup();
