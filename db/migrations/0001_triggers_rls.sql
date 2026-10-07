-- ============================================================
-- Custom migration: CHECK constraints, triggers, RLS, indexes
-- Run AFTER the Drizzle-generated schema migration (0000_*).
-- ============================================================

-- ─── 0. CHECK constraints (Drizzle doesn't serialize raw sql()) ──────────
ALTER TABLE cutting_orders
  ADD CONSTRAINT cutting_orders_target_qty_check   CHECK (target_qty > 0),
  ADD CONSTRAINT cutting_orders_actual_fabric_check  CHECK (actual_fabric_yds > 0),
  ADD CONSTRAINT cutting_orders_expected_fabric_check CHECK (expected_fabric_yds > 0);

ALTER TABLE recipe_components
  ADD CONSTRAINT recipe_components_pieces_check CHECK (pieces_per_garment > 0);

ALTER TABLE verification_items
  ADD CONSTRAINT vi_actual_qty_check   CHECK (actual_qty IS NULL OR actual_qty >= 0),
  ADD CONSTRAINT vi_expected_qty_check CHECK (expected_qty >= 0);

ALTER TABLE verification_logs
  ADD CONSTRAINT vl_rejection_note_check CHECK (
    decision != 'REJECTED' OR (rejection_note IS NOT NULL AND rejection_note != '')
  );

-- ─── 1. Immutable verification_logs (block UPDATE and DELETE) ──────────────
CREATE OR REPLACE FUNCTION block_log_mutations()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'verification_logs rows are immutable. Attempted operation: %', TG_OP;
END;
$$;

CREATE TRIGGER trg_immutable_verification_logs
  BEFORE UPDATE OR DELETE ON verification_logs
  FOR EACH ROW EXECUTE FUNCTION block_log_mutations();

-- ─── 2. Freeze verification_items once parent order is VERIFIED ──────────
CREATE OR REPLACE FUNCTION block_items_when_verified()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_status TEXT;
BEGIN
  SELECT status INTO v_status
  FROM cutting_orders
  WHERE id = NEW.order_id;

  IF v_status = 'VERIFIED' THEN
    RAISE EXCEPTION
      'verification_items cannot be modified when the parent order is VERIFIED (order_id: %)',
      NEW.order_id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_freeze_verified_items
  BEFORE UPDATE ON verification_items
  FOR EACH ROW EXECUTE FUNCTION block_items_when_verified();

-- ─── 3. Valid status transitions only ────────────────────────────────────
CREATE OR REPLACE FUNCTION enforce_status_transition()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  -- No-op: same status (e.g. updating other fields)
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  -- Allowed transitions:
  --   PENDING_VERIFICATION → VERIFIED
  --   PENDING_VERIFICATION → REJECTED
  --   REJECTED             → PENDING_VERIFICATION
  IF (OLD.status = 'PENDING_VERIFICATION' AND NEW.status = 'VERIFIED')   OR
     (OLD.status = 'PENDING_VERIFICATION' AND NEW.status = 'REJECTED')   OR
     (OLD.status = 'REJECTED'             AND NEW.status = 'PENDING_VERIFICATION') THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION
    'Invalid status transition: "%" → "%". Allowed: PENDING_VERIFICATION→VERIFIED, PENDING_VERIFICATION→REJECTED, REJECTED→PENDING_VERIFICATION',
    OLD.status, NEW.status;
END;
$$;

CREATE TRIGGER trg_valid_status_transition
  BEFORE UPDATE OF status ON cutting_orders
  FOR EACH ROW EXECUTE FUNCTION enforce_status_transition();

-- ─── 4. Row Level Security (no policies = only server connection works) ───
ALTER TABLE users               ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_components   ENABLE ROW LEVEL SECURITY;
ALTER TABLE cutting_orders      ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_items  ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_logs   ENABLE ROW LEVEL SECURITY;

-- ─── 5. Partial unique index: only ONE APPROVED log per order ─────────────
CREATE UNIQUE INDEX idx_one_approved_log_per_order
  ON verification_logs (order_id)
  WHERE decision = 'APPROVED';

-- ─── 6. Sequence for order_no (application formats as CO-YYYY-NNNN) ──────
CREATE SEQUENCE IF NOT EXISTS order_no_seq
  START WITH 1
  INCREMENT BY 1
  NO MINVALUE
  NO MAXVALUE
  CACHE 1;
