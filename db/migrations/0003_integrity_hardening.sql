-- ============================================================
-- Custom migration: data integrity and deployment hardening.
-- ============================================================

ALTER TABLE users
  ADD CONSTRAINT users_email_lowercase_check CHECK (email = lower(email));

ALTER TABLE verification_logs
  DROP CONSTRAINT vl_rejection_note_check,
  ADD CONSTRAINT vl_rejection_note_check CHECK (
    decision != 'REJECTED'
    OR (rejection_note IS NOT NULL AND btrim(rejection_note) <> '')
  ),
  ADD CONSTRAINT vl_attempt_no_check CHECK (attempt_no > 0);

CREATE OR REPLACE FUNCTION enforce_verification_component_recipe()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM cutting_orders AS orders
    INNER JOIN recipe_components AS components
      ON components.recipe_id = orders.recipe_id
     AND components.id = NEW.component_id
    WHERE orders.id = NEW.order_id
  ) THEN
    RAISE EXCEPTION
      'verification_items component does not belong to the order recipe (order_id: %, component_id: %)',
      NEW.order_id, NEW.component_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_verification_component_recipe
  BEFORE INSERT OR UPDATE OF order_id, component_id ON verification_items
  FOR EACH ROW EXECUTE FUNCTION enforce_verification_component_recipe();
