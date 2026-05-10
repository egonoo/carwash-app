-- =============================================================================
-- Constraints que Prisma no puede expresar.
-- =============================================================================

-- Anti-solape de citas por recurso (excepto estados inactivos)
ALTER TABLE appointment DROP CONSTRAINT IF EXISTS appointment_no_resource_overlap;
ALTER TABLE appointment
  ADD CONSTRAINT appointment_no_resource_overlap
  EXCLUDE USING gist (
    business_id WITH =,
    resource_id WITH =,
    tstzrange(starts_at, ends_at, '[)') WITH &&
  ) WHERE (status NOT IN ('cancelled', 'no_show', 'draft', 'rescheduled'));

-- Vehicle: VIN único por negocio si presente
CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicle_vin_per_business
  ON vehicle (business_id, upper(vin)) WHERE vin IS NOT NULL;

-- Vehicle: plate+state único por negocio (si ambos presentes y no archivado)
CREATE UNIQUE INDEX IF NOT EXISTS idx_vehicle_plate_per_business
  ON vehicle (business_id, upper(plate), upper(plate_state))
  WHERE plate IS NOT NULL AND plate_state IS NOT NULL AND archived_at IS NULL;

-- Promo code único por negocio (case-insensitive)
CREATE UNIQUE INDEX IF NOT EXISTS idx_promo_code_unique_per_business
  ON promo_code (business_id, upper(code));

-- Payment: stripe_payment_intent_id único si presente
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_stripe_pi
  ON payment (stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL;

-- Evidence photo: solo un uploader (user xor customer)
ALTER TABLE evidence_photo DROP CONSTRAINT IF EXISTS evidence_photo_uploader_check;
ALTER TABLE evidence_photo ADD CONSTRAINT evidence_photo_uploader_check CHECK (
  (uploaded_by_user_id IS NOT NULL AND uploaded_by_customer_id IS NULL) OR
  (uploaded_by_user_id IS NULL AND uploaded_by_customer_id IS NOT NULL)
);

-- Appointment: ends_at > starts_at
ALTER TABLE appointment DROP CONSTRAINT IF EXISTS appointment_time_order;
ALTER TABLE appointment ADD CONSTRAINT appointment_time_order CHECK (ends_at > starts_at);
