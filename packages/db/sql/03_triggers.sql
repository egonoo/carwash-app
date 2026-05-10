-- =============================================================================
-- Triggers:
--  1. loyalty_progress: incrementa/decrementa al cambiar appointment.status
--  2. appointment_status_history: log automático de cambios
--  3. evidence_photo_count: contador denormalizado en appointment
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Loyalty progress
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION loyalty_on_appointment_status_change() RETURNS TRIGGER AS $$
DECLARE
  qualifies BOOLEAN;
  prog loyalty_program%ROWTYPE;
  has_package BOOLEAN;
BEGIN
  SELECT * INTO prog FROM loyalty_program WHERE business_id = NEW.business_id;
  IF NOT FOUND OR NOT prog.is_active THEN
    RETURN NEW;
  END IF;

  IF prog.count_packages_only THEN
    SELECT EXISTS (
      SELECT 1 FROM appointment_item
      WHERE appointment_id = NEW.id AND kind = 'package'
    ) INTO has_package;
    qualifies := has_package;
  ELSE
    qualifies := TRUE;
  END IF;

  IF NOT qualifies THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status <> 'completed' AND NEW.status = 'completed' THEN
    INSERT INTO loyalty_progress (
      id, business_id, vehicle_id, customer_id,
      completed_visits, last_completed_appointment_id,
      first_service_at, last_service_at, lifetime_revenue_cents, updated_at
    )
    VALUES (
      uuid_generate_v4(), NEW.business_id, NEW.vehicle_id, NEW.customer_id,
      1, NEW.id,
      COALESCE(NEW.completed_at, NOW()), COALESCE(NEW.completed_at, NOW()),
      NEW.total_cents, NOW()
    )
    ON CONFLICT (vehicle_id) DO UPDATE
      SET completed_visits = loyalty_progress.completed_visits + 1,
          last_completed_appointment_id = NEW.id,
          last_service_at = COALESCE(NEW.completed_at, NOW()),
          lifetime_revenue_cents = loyalty_progress.lifetime_revenue_cents + NEW.total_cents,
          updated_at = NOW();
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status = 'completed' AND NEW.status <> 'completed' THEN
    UPDATE loyalty_progress
      SET completed_visits = GREATEST(completed_visits - 1, 0),
          lifetime_revenue_cents = GREATEST(lifetime_revenue_cents - OLD.total_cents, 0),
          updated_at = NOW()
      WHERE vehicle_id = NEW.vehicle_id;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_loyalty_progress_status ON appointment;
CREATE TRIGGER trg_loyalty_progress_status
  AFTER UPDATE ON appointment
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION loyalty_on_appointment_status_change();

-- -----------------------------------------------------------------------------
-- 2. Appointment status history
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION log_appointment_status_change() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO appointment_status_history (id, business_id, appointment_id, from_status, to_status, changed_at)
      VALUES (uuid_generate_v4(), NEW.business_id, NEW.id, OLD.status, NEW.status, NOW());
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO appointment_status_history (id, business_id, appointment_id, from_status, to_status, changed_at)
      VALUES (uuid_generate_v4(), NEW.business_id, NEW.id, NULL, NEW.status, NOW());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_appt_status_history ON appointment;
CREATE TRIGGER trg_appt_status_history
  AFTER INSERT OR UPDATE ON appointment
  FOR EACH ROW EXECUTE FUNCTION log_appointment_status_change();

-- -----------------------------------------------------------------------------
-- 3. Evidence photo count
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_evidence_count() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE appointment SET evidence_photo_count = evidence_photo_count + 1
      WHERE id = NEW.appointment_id;
  ELSIF TG_OP = 'UPDATE' AND NEW.soft_deleted_at IS NOT NULL AND OLD.soft_deleted_at IS NULL THEN
    UPDATE appointment SET evidence_photo_count = GREATEST(evidence_photo_count - 1, 0)
      WHERE id = NEW.appointment_id;
  ELSIF TG_OP = 'UPDATE' AND NEW.soft_deleted_at IS NULL AND OLD.soft_deleted_at IS NOT NULL THEN
    UPDATE appointment SET evidence_photo_count = evidence_photo_count + 1
      WHERE id = NEW.appointment_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_evidence_count ON evidence_photo;
CREATE TRIGGER trg_evidence_count
  AFTER INSERT OR UPDATE ON evidence_photo
  FOR EACH ROW EXECUTE FUNCTION update_evidence_count();
