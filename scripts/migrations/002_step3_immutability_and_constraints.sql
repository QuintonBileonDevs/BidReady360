-- Idempotent Step 3 Database Safety, Immutability & Sealed-Bid Protection
-- Safe to run multiple times in DBeaver or Aiven PostgreSQL console.

-- 1. Optional columns used by Step 3 controls (idempotent)
ALTER TABLE bid_opening_sessions
  ADD COLUMN IF NOT EXISTS witness_summary JSONB;

ALTER TABLE consent_grants
  ADD COLUMN IF NOT EXISTS selected_document_names TEXT[];

CREATE INDEX IF NOT EXISTS idx_consent_grants_pair
  ON consent_grants (supplier_id, organization_id);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON notifications (user_id, created_at DESC);

-- 2. Strict append-only immutability trigger on audit_log
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

-- 3. Sealed bid protection trigger on bids
--    a) Prevents unsealing/recording opened status or total_price before closes_at
--    b) Prevents tampering with or re-submitting already opened/disqualified bids
--    c) Prevents deleting submitted/opened bids directly
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
