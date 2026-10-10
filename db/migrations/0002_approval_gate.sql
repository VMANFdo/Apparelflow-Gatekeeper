-- ============================================================
-- Custom migration: database-enforced approval gate.
-- An order cannot become VERIFIED while any component is uncounted,
-- RED, or missing from the verification set.
-- ============================================================

CREATE OR REPLACE FUNCTION enforce_approval_gate()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NOT (
    NEW.status = 'VERIFIED'
    AND OLD.status = 'PENDING_VERIFICATION'
  ) THEN
    RETURN NEW;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM verification_items
    WHERE order_id = NEW.id
  )
  OR EXISTS (
    SELECT 1
    FROM verification_items
    WHERE order_id = NEW.id
      AND (
        actual_qty IS NULL
        OR actual_qty < expected_qty
        OR status IS NULL
        OR status = 'RED'
      )
  ) THEN
    RAISE EXCEPTION
      'Order cannot be VERIFIED while components are uncounted or RED (order_id: %)',
      NEW.id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_enforce_approval_gate
  BEFORE UPDATE OF status ON cutting_orders
  FOR EACH ROW EXECUTE FUNCTION enforce_approval_gate();
