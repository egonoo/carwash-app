-- =============================================================================
-- SPLASH SaaS — Car Wash Móvil · Fase 2
-- PostgreSQL 16+ — schema consolidado
-- Incluye: multi-tenancy (RLS), identity, catálogo, agenda, operaciones,
--          finanzas, lealtad por vehículo, evidencia fotográfica multi-fase.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- EXTENSIONES
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";     -- encrypt PII (direcciones)
CREATE EXTENSION IF NOT EXISTS "btree_gist";   -- no_overlap EXCLUDE
CREATE EXTENSION IF NOT EXISTS "citext";       -- case-insensitive email
-- CREATE EXTENSION IF NOT EXISTS "postgis";   -- opcional, geo-zonas

-- -----------------------------------------------------------------------------
-- ENUMS
-- -----------------------------------------------------------------------------
CREATE TYPE user_role AS ENUM ('owner', 'admin', 'staff', 'readonly');

CREATE TYPE addon_pricing_mode AS ENUM (
  'fixed',          -- precio cerrado
  'starting_at',    -- "desde $X", admin ajusta al servir
  'per_unit',       -- × qty (ej. Rims detail $10 each × 4)
  'quote_on_site'   -- requiere cotización presencial, no suma online
);

CREATE TYPE deposit_policy_type AS ENUM ('fixed', 'percentage');

CREATE TYPE appointment_status AS ENUM (
  'draft',              -- wizard incompleto, expira
  'pending_deposit',    -- wizard completo, esperando cargo
  'confirmed',          -- depósito cobrado
  'on_the_way',         -- admin en ruta
  'arrived',            -- admin llegó
  'in_progress',        -- servicio iniciado
  'completed',          -- servicio terminado
  'cancelled',          -- cancelado
  'no_show',            -- cliente no apareció
  'rescheduled'         -- movido a otra cita
);

CREATE TYPE appointment_item_kind AS ENUM (
  'package',
  'addon',
  'manual_extra'        -- admin lo agregó al servir
);

CREATE TYPE payment_kind AS ENUM ('deposit', 'final', 'refund', 'tip', 'extra');

CREATE TYPE payment_method AS ENUM (
  'card_online',        -- Stripe
  'card_terminal',      -- tarjeta en persona
  'cash',
  'zelle',
  'venmo',
  'cashapp',
  'other'
);

CREATE TYPE discount_kind AS ENUM ('loyalty', 'promo', 'manual');
CREATE TYPE discount_value_type AS ENUM ('percentage', 'fixed');

CREATE TYPE evidence_phase AS ENUM (
  'pre_service_customer',  -- cliente al reservar
  'pre_service_admin',     -- admin al llegar
  'in_progress',           -- durante
  'post_service'           -- al finalizar
);

CREATE TYPE notification_channel AS ENUM ('email', 'sms', 'push');
CREATE TYPE notification_status AS ENUM ('queued', 'sent', 'failed', 'cancelled');

CREATE TYPE audit_action AS ENUM ('create', 'update', 'delete', 'state_change', 'grant', 'revoke', 'adjust');

-- =============================================================================
-- 1. IDENTITY — tenants, users, customers, vehicles
-- =============================================================================

-- -----------------------------------------------------------------------------
-- business (tenant)
-- -----------------------------------------------------------------------------
CREATE TABLE business (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  slug                      TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9-]{3,40}$'),
  name                      TEXT NOT NULL,
  legal_name                TEXT,
  email                     CITEXT NOT NULL,
  phone                     TEXT,
  timezone                  TEXT NOT NULL DEFAULT 'America/New_York',
  currency                  CHAR(3) NOT NULL DEFAULT 'USD',
  locale                    TEXT NOT NULL DEFAULT 'en',   -- 'en' | 'es'
  logo_storage_key          TEXT,
  brand_color               TEXT,
  address_line1             TEXT,
  address_city              TEXT,
  address_state             TEXT,
  address_zip               TEXT,
  tax_rate_bps              INTEGER NOT NULL DEFAULT 0 CHECK (tax_rate_bps >= 0 AND tax_rate_bps <= 3000), -- 700 = 7.00%
  deposit_policy_type       deposit_policy_type NOT NULL DEFAULT 'fixed',
  deposit_policy_value      INTEGER NOT NULL DEFAULT 2000 CHECK (deposit_policy_value >= 0), -- cents si fixed, bps si percentage
  deposit_min_cents         INTEGER NOT NULL DEFAULT 2000,
  -- feature flags por negocio (base para planes SaaS)
  features                  JSONB NOT NULL DEFAULT
    '{"loyalty":true,"photos":true,"promo_codes":true,"multiple_resources":false,"custom_domain":false,"sms":false,"google_calendar":true}'::jsonb,
  default_travel_time_min   INTEGER NOT NULL DEFAULT 20,
  reschedule_max_free       INTEGER NOT NULL DEFAULT 1,
  reschedule_min_hours      INTEGER NOT NULL DEFAULT 24,
  evidence_min_photos       INTEGER NOT NULL DEFAULT 1 CHECK (evidence_min_photos >= 0),
  evidence_max_photos_cust  INTEGER NOT NULL DEFAULT 12,
  evidence_max_photos_admin INTEGER NOT NULL DEFAULT 30,
  evidence_retention_days   INTEGER NOT NULL DEFAULT 730,
  photo_scrub_exif          BOOLEAN NOT NULL DEFAULT TRUE,
  status                    TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','trial','closed')),
  plan                      TEXT NOT NULL DEFAULT 'free',
  stripe_customer_id        TEXT,            -- suscripción del SaaS
  stripe_account_id         TEXT,            -- Connect Standard (cobros a clientes)
  stripe_account_ready      BOOLEAN NOT NULL DEFAULT FALSE,
  google_calendar_id        TEXT,
  google_refresh_token_enc  TEXT,            -- encriptado con pgcrypto
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at                TIMESTAMPTZ
);

CREATE INDEX idx_business_slug ON business(slug) WHERE deleted_at IS NULL;

-- -----------------------------------------------------------------------------
-- business_domain (custom domains opcionales)
-- -----------------------------------------------------------------------------
CREATE TABLE business_domain (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id    UUID NOT NULL REFERENCES business(id) ON DELETE CASCADE,
  host           TEXT NOT NULL UNIQUE,
  verified_at    TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_business_domain_host ON business_domain(host);

-- -----------------------------------------------------------------------------
-- user (admin de Splash y staff de cada negocio)
-- -----------------------------------------------------------------------------
CREATE TABLE app_user (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email            CITEXT NOT NULL UNIQUE,
  password_hash    TEXT,                   -- argon2id
  full_name        TEXT,
  phone            TEXT,
  avatar_key       TEXT,
  totp_secret_enc  TEXT,                   -- encriptado
  totp_enabled     BOOLEAN NOT NULL DEFAULT FALSE,
  last_login_at    TIMESTAMPTZ,
  email_verified_at TIMESTAMPTZ,
  is_super_admin   BOOLEAN NOT NULL DEFAULT FALSE,  -- staff de Splash
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at       TIMESTAMPTZ
);

-- -----------------------------------------------------------------------------
-- user_business_role — N:M con rol por negocio
-- -----------------------------------------------------------------------------
CREATE TABLE user_business_role (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id      UUID NOT NULL REFERENCES app_user(id) ON DELETE CASCADE,
  business_id  UUID NOT NULL REFERENCES business(id) ON DELETE CASCADE,
  role         user_role NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, business_id)
);
CREATE INDEX idx_ubr_business ON user_business_role(business_id);

-- -----------------------------------------------------------------------------
-- customer (cliente final del negocio — NO autenticado en el booking)
-- -----------------------------------------------------------------------------
CREATE TABLE customer (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id           UUID NOT NULL REFERENCES business(id) ON DELETE CASCADE,
  email                 CITEXT NOT NULL,
  phone_e164            TEXT NOT NULL,                    -- +13055551234
  first_name            TEXT NOT NULL,
  last_name             TEXT,
  preferred_locale      TEXT DEFAULT 'en',
  marketing_consent     BOOLEAN NOT NULL DEFAULT FALSE,
  blocked_at            TIMESTAMPTZ,
  block_reason          TEXT,
  internal_notes        TEXT,                             -- solo admin ve
  -- default address encriptado
  address_line1_enc     BYTEA,
  address_line2_enc     BYTEA,
  address_city          TEXT,
  address_state         TEXT,
  address_zip           TEXT,
  address_lat           DOUBLE PRECISION,
  address_lng           DOUBLE PRECISION,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at            TIMESTAMPTZ,
  -- uniqueness: mismo email y/o phone por negocio
  UNIQUE (business_id, email),
  UNIQUE (business_id, phone_e164)
);
CREATE INDEX idx_customer_business ON customer(business_id);
CREATE INDEX idx_customer_search ON customer(business_id, lower(first_name || ' ' || coalesce(last_name,'')));

-- -----------------------------------------------------------------------------
-- vehicle (anchor del programa de lealtad)
-- -----------------------------------------------------------------------------
CREATE TABLE vehicle (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id         UUID NOT NULL REFERENCES business(id) ON DELETE CASCADE,
  customer_id         UUID NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
  vehicle_type_id     UUID NOT NULL,                    -- FK to vehicle_type (definido abajo)
  internal_code       TEXT NOT NULL,                    -- VH-3F7A — legible
  vin                 TEXT,                              -- opcional, 17 chars
  plate               TEXT,
  plate_state         TEXT,                              -- 'FL', 'CA'...
  make                TEXT,                              -- Honda, Ford
  model               TEXT,                              -- Civic, F-150
  year                INTEGER CHECK (year BETWEEN 1900 AND 2100),
  color               TEXT,
  nickname            TEXT,                              -- "mi carro del trabajo"
  notes               TEXT,
  archived_at         TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- El VIN, si existe, debe ser único dentro del negocio
CREATE UNIQUE INDEX idx_vehicle_vin_per_business ON vehicle(business_id, upper(vin)) WHERE vin IS NOT NULL;
-- Plate+state únicos por negocio (si ambos existen)
CREATE UNIQUE INDEX idx_vehicle_plate_per_business ON vehicle(business_id, upper(plate), upper(plate_state))
  WHERE plate IS NOT NULL AND plate_state IS NOT NULL AND archived_at IS NULL;
-- Internal code único por negocio
CREATE UNIQUE INDEX idx_vehicle_code ON vehicle(business_id, internal_code);

CREATE INDEX idx_vehicle_customer ON vehicle(business_id, customer_id) WHERE archived_at IS NULL;

-- =============================================================================
-- 2. CATALOG — vehicle types, packages, addons, zones, promo
-- =============================================================================

-- -----------------------------------------------------------------------------
-- vehicle_type (Sedan, Small SUV, Medium SUV, XL SUV)
-- -----------------------------------------------------------------------------
CREATE TABLE vehicle_type (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id     UUID NOT NULL REFERENCES business(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL,
  description     TEXT,
  examples        TEXT,                  -- "civic, camry, audi a3..."
  display_order   INTEGER NOT NULL DEFAULT 0,
  archived_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (business_id, slug)
);

ALTER TABLE vehicle ADD CONSTRAINT fk_vehicle_vehicle_type
  FOREIGN KEY (vehicle_type_id) REFERENCES vehicle_type(id);

-- -----------------------------------------------------------------------------
-- package (Car Wash, Full Detail, Paint Correction...)
-- -----------------------------------------------------------------------------
CREATE TABLE package (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id     UUID NOT NULL REFERENCES business(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL,
  description     TEXT,
  short_benefits  JSONB,                        -- ["Exterior wash","Tire shine",...]
  image_key       TEXT,
  display_order   INTEGER NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  -- deposit policy por paquete (null = usa el global del negocio)
  deposit_policy_type   deposit_policy_type,
  deposit_policy_value  INTEGER,
  deposit_min_cents     INTEGER,
  archived_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (business_id, slug)
);
CREATE INDEX idx_package_active ON package(business_id) WHERE archived_at IS NULL AND is_active = TRUE;

-- -----------------------------------------------------------------------------
-- package_price — precio y duración POR COMBINACIÓN (paquete × tipo vehículo)
-- -----------------------------------------------------------------------------
CREATE TABLE package_price (
  package_id         UUID NOT NULL REFERENCES package(id) ON DELETE CASCADE,
  vehicle_type_id    UUID NOT NULL REFERENCES vehicle_type(id) ON DELETE CASCADE,
  business_id        UUID NOT NULL REFERENCES business(id) ON DELETE CASCADE,
  price_cents        INTEGER NOT NULL CHECK (price_cents >= 0),
  duration_minutes   INTEGER NOT NULL CHECK (duration_minutes > 0),
  is_available       BOOLEAN NOT NULL DEFAULT TRUE,  -- admin puede marcar N/A
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (package_id, vehicle_type_id)
);
CREATE INDEX idx_package_price_business ON package_price(business_id);

-- -----------------------------------------------------------------------------
-- addon (Pet hair, Engine wash, Overspray...)
-- -----------------------------------------------------------------------------
CREATE TABLE addon (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id       UUID NOT NULL REFERENCES business(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  slug              TEXT NOT NULL,
  description       TEXT,
  pricing_mode      addon_pricing_mode NOT NULL,
  base_price_cents  INTEGER NOT NULL DEFAULT 0 CHECK (base_price_cents >= 0),
  duration_minutes  INTEGER NOT NULL DEFAULT 0 CHECK (duration_minutes >= 0),
  -- per_unit: default_qty y max_qty
  default_quantity  INTEGER NOT NULL DEFAULT 1 CHECK (default_quantity >= 1),
  max_quantity      INTEGER NOT NULL DEFAULT 10 CHECK (max_quantity >= 1),
  -- si pricing_mode = 'quote_on_site', online suma 0 pero marca la cita
  requires_admin_quote BOOLEAN NOT NULL DEFAULT FALSE,
  display_order     INTEGER NOT NULL DEFAULT 0,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  image_key         TEXT,
  archived_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (business_id, slug)
);
CREATE INDEX idx_addon_active ON addon(business_id) WHERE archived_at IS NULL AND is_active = TRUE;

-- -----------------------------------------------------------------------------
-- zone (áreas geográficas de servicio)
-- -----------------------------------------------------------------------------
CREATE TABLE zone (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id     UUID NOT NULL REFERENCES business(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  slug            TEXT NOT NULL,
  color           TEXT,                              -- color en el calendario
  description     TEXT,
  zip_codes       TEXT[],                             -- ['33101','33102',...]
  -- polygon geoJSON como JSONB, o postgis geometry si se habilita
  geojson         JSONB,
  display_order   INTEGER NOT NULL DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  archived_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (business_id, slug)
);

-- -----------------------------------------------------------------------------
-- zone_travel_time (matriz A→B en minutos)
-- -----------------------------------------------------------------------------
CREATE TABLE zone_travel_time (
  business_id     UUID NOT NULL REFERENCES business(id) ON DELETE CASCADE,
  from_zone_id    UUID NOT NULL REFERENCES zone(id) ON DELETE CASCADE,
  to_zone_id      UUID NOT NULL REFERENCES zone(id) ON DELETE CASCADE,
  minutes         INTEGER NOT NULL CHECK (minutes >= 0),
  PRIMARY KEY (from_zone_id, to_zone_id),
  CHECK (from_zone_id <> to_zone_id)
);
CREATE INDEX idx_ztt_business ON zone_travel_time(business_id);

-- -----------------------------------------------------------------------------
-- promo_code
-- -----------------------------------------------------------------------------
CREATE TABLE promo_code (
  id                       UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id              UUID NOT NULL REFERENCES business(id) ON DELETE CASCADE,
  code                     TEXT NOT NULL,
  description              TEXT,
  discount_type            discount_value_type NOT NULL,
  discount_value           INTEGER NOT NULL CHECK (discount_value > 0),
  applies_to_package_ids   UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],   -- vacío = todos
  applies_to_addons        BOOLEAN NOT NULL DEFAULT FALSE,
  min_subtotal_cents       INTEGER NOT NULL DEFAULT 0,
  max_uses_total           INTEGER,                          -- null = ilimitado
  max_uses_per_customer    INTEGER NOT NULL DEFAULT 1,
  uses_count               INTEGER NOT NULL DEFAULT 0,
  active_from              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  active_until             TIMESTAMPTZ,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at              TIMESTAMPTZ,
  UNIQUE (business_id, upper(code))
);

-- =============================================================================
-- 3. SCHEDULING — templates, exceptions, resources
-- =============================================================================

-- -----------------------------------------------------------------------------
-- schedule_template — ventanas recurrentes por día de la semana
-- -----------------------------------------------------------------------------
CREATE TABLE schedule_template (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id       UUID NOT NULL REFERENCES business(id) ON DELETE CASCADE,
  day_of_week       INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=sun
  window_start      TIME NOT NULL,
  window_end        TIME NOT NULL,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (window_end > window_start)
);
CREATE INDEX idx_schedule_template_business ON schedule_template(business_id, day_of_week) WHERE is_active = TRUE;

-- zonas asignadas por día de la semana (default)
CREATE TABLE schedule_template_zone (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id       UUID NOT NULL REFERENCES business(id) ON DELETE CASCADE,
  day_of_week       INTEGER NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  zone_id           UUID NOT NULL REFERENCES zone(id) ON DELETE CASCADE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (business_id, day_of_week, zone_id)
);

-- -----------------------------------------------------------------------------
-- schedule_exception — overrides por fecha específica
-- -----------------------------------------------------------------------------
CREATE TABLE schedule_exception (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id       UUID NOT NULL REFERENCES business(id) ON DELETE CASCADE,
  exception_date    DATE NOT NULL,
  kind              TEXT NOT NULL CHECK (kind IN ('closed','special_hours','zone_change')),
  payload           JSONB NOT NULL DEFAULT '{}'::jsonb,
  -- para 'special_hours': { "windows": [{start:"08:00", end:"12:00"}] }
  -- para 'zone_change': { "zone_ids": ["uuid1","uuid2"] }
  note              TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by        UUID REFERENCES app_user(id),
  UNIQUE (business_id, exception_date, kind)
);

-- bloqueos manuales de horarios específicos (ej. "bloqueo 10:00–11:00 el 5 de mayo")
CREATE TABLE schedule_block (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id       UUID NOT NULL REFERENCES business(id) ON DELETE CASCADE,
  starts_at         TIMESTAMPTZ NOT NULL,
  ends_at           TIMESTAMPTZ NOT NULL,
  reason            TEXT,
  zone_id           UUID REFERENCES zone(id),
  resource_id       UUID,                     -- FK defined below; null = todos
  created_by        UUID REFERENCES app_user(id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_at > starts_at)
);
CREATE INDEX idx_schedule_block_range ON schedule_block(business_id, starts_at, ends_at);

-- -----------------------------------------------------------------------------
-- resource — "unidades" del negocio (admin, asistente, equipo extra)
-- -----------------------------------------------------------------------------
CREATE TABLE resource (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id     UUID NOT NULL REFERENCES business(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,          -- "Unit 1", "John", etc.
  color           TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  display_order   INTEGER NOT NULL DEFAULT 0,
  archived_at     TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE schedule_block ADD CONSTRAINT fk_schedule_block_resource
  FOREIGN KEY (resource_id) REFERENCES resource(id) ON DELETE CASCADE;

-- =============================================================================
-- 4. LOYALTY — programa por vehículo
-- =============================================================================

-- -----------------------------------------------------------------------------
-- loyalty_program — 1:1 con business
-- -----------------------------------------------------------------------------
CREATE TABLE loyalty_program (
  id                        UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id               UUID NOT NULL REFERENCES business(id) ON DELETE CASCADE UNIQUE,
  is_active                 BOOLEAN NOT NULL DEFAULT FALSE,
  applies_to_addons         BOOLEAN NOT NULL DEFAULT FALSE,
  count_packages_only       BOOLEAN NOT NULL DEFAULT TRUE,    -- solo paquetes cuentan como "visita"
  reset_on_redemption       BOOLEAN NOT NULL DEFAULT FALSE,    -- ¿reinicia contador al redimir?
  auto_apply                BOOLEAN NOT NULL DEFAULT TRUE,    -- aplicar automático en checkout
  name                      TEXT DEFAULT 'Loyalty Rewards',
  description               TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- -----------------------------------------------------------------------------
-- loyalty_tier (default: visit 5 y visit 10)
-- -----------------------------------------------------------------------------
CREATE TABLE loyalty_tier (
  id                           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  program_id                   UUID NOT NULL REFERENCES loyalty_program(id) ON DELETE CASCADE,
  business_id                  UUID NOT NULL REFERENCES business(id) ON DELETE CASCADE,
  display_order                INTEGER NOT NULL DEFAULT 0,
  name                         TEXT,                                 -- "Tier 1: 5 visits"
  visits_required              INTEGER NOT NULL CHECK (visits_required > 0),
  discount_type                discount_value_type NOT NULL,
  discount_value               INTEGER NOT NULL CHECK (discount_value > 0),  -- bps si %, cents si fixed
  applies_to_package_ids       UUID[] NOT NULL DEFAULT ARRAY[]::UUID[],  -- [] = todos
  max_redemptions_per_vehicle  INTEGER NOT NULL DEFAULT 1 CHECK (max_redemptions_per_vehicle >= 1),
  is_active                    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_loyalty_tier_program ON loyalty_tier(program_id, visits_required);

-- -----------------------------------------------------------------------------
-- loyalty_progress — 1:1 con vehicle
-- -----------------------------------------------------------------------------
CREATE TABLE loyalty_progress (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id                 UUID NOT NULL REFERENCES business(id) ON DELETE CASCADE,
  vehicle_id                  UUID NOT NULL REFERENCES vehicle(id) ON DELETE CASCADE UNIQUE,
  customer_id                 UUID NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
  completed_visits            INTEGER NOT NULL DEFAULT 0 CHECK (completed_visits >= 0),
  last_completed_appointment_id UUID,   -- FK appointment (definido abajo)
  first_service_at            TIMESTAMPTZ,
  last_service_at             TIMESTAMPTZ,
  lifetime_revenue_cents      BIGINT NOT NULL DEFAULT 0,
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_loyalty_progress_business_customer ON loyalty_progress(business_id, customer_id);

-- -----------------------------------------------------------------------------
-- loyalty_adjustment — ajustes manuales del contador (override admin)
-- -----------------------------------------------------------------------------
CREATE TABLE loyalty_adjustment (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id     UUID NOT NULL REFERENCES business(id) ON DELETE CASCADE,
  vehicle_id      UUID NOT NULL REFERENCES vehicle(id) ON DELETE CASCADE,
  customer_id     UUID NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
  delta           INTEGER NOT NULL,             -- +1, -1, +3, etc.
  reason          TEXT NOT NULL,                -- obligatorio
  before_count    INTEGER NOT NULL,
  after_count     INTEGER NOT NULL,
  adjusted_by_user_id UUID NOT NULL REFERENCES app_user(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_loyalty_adj_vehicle ON loyalty_adjustment(business_id, vehicle_id, created_at);

-- =============================================================================
-- 5. OPERATIONS — appointments, items, evidence, status history
-- =============================================================================

-- -----------------------------------------------------------------------------
-- appointment
-- -----------------------------------------------------------------------------
CREATE TABLE appointment (
  id                                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id                       UUID NOT NULL REFERENCES business(id) ON DELETE CASCADE,
  customer_id                       UUID NOT NULL REFERENCES customer(id),
  vehicle_id                        UUID NOT NULL REFERENCES vehicle(id),
  zone_id                           UUID NOT NULL REFERENCES zone(id),
  resource_id                       UUID NOT NULL REFERENCES resource(id),
  -- ventana programada
  starts_at                         TIMESTAMPTZ NOT NULL,
  ends_at                           TIMESTAMPTZ NOT NULL,
  duration_minutes                  INTEGER NOT NULL,
  -- estado
  status                            appointment_status NOT NULL DEFAULT 'draft',
  cancellation_reason               TEXT,
  no_show_reason                    TEXT,
  reschedule_count                  INTEGER NOT NULL DEFAULT 0,
  previous_appointment_id           UUID REFERENCES appointment(id),  -- si es re-agenda
  -- dirección de servicio
  service_address_line1_enc         BYTEA,
  service_address_line2_enc         BYTEA,
  service_address_city              TEXT,
  service_address_state             TEXT,
  service_address_zip               TEXT,
  service_address_lat               DOUBLE PRECISION,
  service_address_lng               DOUBLE PRECISION,
  service_address_place_id          TEXT,  -- Mapbox place
  -- notas
  customer_instructions             TEXT,
  internal_notes                    TEXT,
  -- precios (snapshot al crear / recalculado tras extras)
  subtotal_cents                    INTEGER NOT NULL DEFAULT 0,
  discount_total_cents              INTEGER NOT NULL DEFAULT 0,
  tax_cents                         INTEGER NOT NULL DEFAULT 0,
  total_cents                       INTEGER NOT NULL DEFAULT 0,
  deposit_policy_type_snapshot      deposit_policy_type NOT NULL,
  deposit_policy_value_snapshot     INTEGER NOT NULL,
  deposit_amount_cents              INTEGER NOT NULL DEFAULT 0,
  deposit_paid_cents                INTEGER NOT NULL DEFAULT 0,
  deposit_paid_at                   TIMESTAMPTZ,
  deposit_stripe_payment_intent_id  TEXT UNIQUE,
  balance_due_cents                 INTEGER NOT NULL DEFAULT 0,
  -- evidencia & lealtad denormalizados (para listados)
  evidence_photo_count              INTEGER NOT NULL DEFAULT 0,
  loyalty_redemption_id             UUID,
  -- timestamps de eventos
  confirmed_at                      TIMESTAMPTZ,
  on_the_way_at                     TIMESTAMPTZ,
  arrived_at                        TIMESTAMPTZ,
  started_at                        TIMESTAMPTZ,
  completed_at                      TIMESTAMPTZ,
  cancelled_at                      TIMESTAMPTZ,
  no_show_at                        TIMESTAMPTZ,
  -- idempotencia del wizard
  idempotency_key                   TEXT UNIQUE,
  -- token firmado para reagenda/cancel via email
  manage_token_hash                 TEXT,
  -- origen
  source                            TEXT NOT NULL DEFAULT 'web' CHECK (source IN ('web','admin','phone','walk_in','api')),
  created_at                        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by_user_id                UUID REFERENCES app_user(id),   -- si source=admin
  updated_at                        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (ends_at > starts_at)
);

CREATE INDEX idx_appointment_business_date ON appointment(business_id, starts_at);
CREATE INDEX idx_appointment_status ON appointment(business_id, status, starts_at);
CREATE INDEX idx_appointment_customer ON appointment(business_id, customer_id, starts_at DESC);
CREATE INDEX idx_appointment_vehicle ON appointment(business_id, vehicle_id, starts_at DESC);
CREATE INDEX idx_appointment_resource_day ON appointment(business_id, resource_id, starts_at);

-- Anti-solape por recurso (salvo estados inactivos)
ALTER TABLE appointment
  ADD CONSTRAINT appointment_no_resource_overlap
  EXCLUDE USING gist (
    business_id WITH =,
    resource_id WITH =,
    tstzrange(starts_at, ends_at, '[)') WITH &&
  ) WHERE (status NOT IN ('cancelled', 'no_show', 'draft', 'rescheduled'));

-- FK a loyalty_progress y loyalty_redemption (tras crear appointment)
ALTER TABLE loyalty_progress
  ADD CONSTRAINT fk_lp_last_appt FOREIGN KEY (last_completed_appointment_id)
  REFERENCES appointment(id) ON DELETE SET NULL;

-- -----------------------------------------------------------------------------
-- appointment_item
-- -----------------------------------------------------------------------------
CREATE TABLE appointment_item (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id           UUID NOT NULL REFERENCES business(id) ON DELETE CASCADE,
  appointment_id        UUID NOT NULL REFERENCES appointment(id) ON DELETE CASCADE,
  kind                  appointment_item_kind NOT NULL,
  ref_id                UUID,                   -- package_id o addon_id; null si manual_extra
  -- snapshots
  name_snapshot         TEXT NOT NULL,
  description_snapshot  TEXT,
  pricing_mode_snapshot addon_pricing_mode,     -- solo si kind='addon'
  unit_price_cents      INTEGER NOT NULL CHECK (unit_price_cents >= 0),
  quantity              INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  line_total_cents      INTEGER NOT NULL CHECK (line_total_cents >= 0),
  duration_minutes      INTEGER NOT NULL DEFAULT 0,
  pricing_notes         TEXT,                   -- "starting at — admin to confirm"
  requires_admin_quote  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by_user_id    UUID REFERENCES app_user(id),
  display_order         INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_item_appointment ON appointment_item(appointment_id);

-- -----------------------------------------------------------------------------
-- appointment_status_history
-- -----------------------------------------------------------------------------
CREATE TABLE appointment_status_history (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id       UUID NOT NULL REFERENCES business(id) ON DELETE CASCADE,
  appointment_id    UUID NOT NULL REFERENCES appointment(id) ON DELETE CASCADE,
  from_status       appointment_status,
  to_status         appointment_status NOT NULL,
  changed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  changed_by_user_id UUID REFERENCES app_user(id),
  reason            TEXT
);
CREATE INDEX idx_ash_appt ON appointment_status_history(appointment_id, changed_at);

-- -----------------------------------------------------------------------------
-- applied_discount (snapshot de cada descuento aplicado a la cita)
-- -----------------------------------------------------------------------------
CREATE TABLE applied_discount (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id       UUID NOT NULL REFERENCES business(id) ON DELETE CASCADE,
  appointment_id    UUID NOT NULL REFERENCES appointment(id) ON DELETE CASCADE,
  kind              discount_kind NOT NULL,
  source_id         UUID,                              -- loyalty_tier_id, promo_code_id, null si manual
  label             TEXT NOT NULL,
  discount_type     discount_value_type NOT NULL,
  discount_value    INTEGER NOT NULL,
  amount_cents      INTEGER NOT NULL CHECK (amount_cents >= 0),
  snapshot          JSONB NOT NULL,                    -- todo el detalle al aplicar
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by_user_id UUID REFERENCES app_user(id)
);
CREATE INDEX idx_applied_discount_appt ON applied_discount(appointment_id);

-- -----------------------------------------------------------------------------
-- loyalty_redemption (detalle de redención — parte de operations/finance)
-- -----------------------------------------------------------------------------
CREATE TABLE loyalty_redemption (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id                 UUID NOT NULL REFERENCES business(id) ON DELETE CASCADE,
  appointment_id              UUID NOT NULL REFERENCES appointment(id) ON DELETE CASCADE,
  vehicle_id                  UUID NOT NULL REFERENCES vehicle(id) ON DELETE CASCADE,
  customer_id                 UUID NOT NULL REFERENCES customer(id) ON DELETE CASCADE,
  tier_id                     UUID REFERENCES loyalty_tier(id),  -- puede ser null si admin otorgó manual
  tier_snapshot               JSONB NOT NULL,                    -- copia completa del tier al momento
  visit_count_at_redemption   INTEGER NOT NULL,
  discount_type               discount_value_type NOT NULL,
  discount_value              INTEGER NOT NULL,
  discount_applied_cents      INTEGER NOT NULL,
  granted_manually            BOOLEAN NOT NULL DEFAULT FALSE,
  granted_by_user_id          UUID REFERENCES app_user(id),
  revoked_at                  TIMESTAMPTZ,
  revoked_by_user_id          UUID REFERENCES app_user(id),
  revoke_reason               TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (appointment_id, tier_id)   -- máximo una redención del mismo tier por cita
);
CREATE INDEX idx_redemption_vehicle ON loyalty_redemption(business_id, vehicle_id, created_at);
CREATE INDEX idx_redemption_tier ON loyalty_redemption(tier_id);

ALTER TABLE appointment ADD CONSTRAINT fk_appointment_loyalty_redemption
  FOREIGN KEY (loyalty_redemption_id) REFERENCES loyalty_redemption(id) ON DELETE SET NULL;

-- -----------------------------------------------------------------------------
-- evidence_photo (multi-fase)
-- -----------------------------------------------------------------------------
CREATE TABLE evidence_photo (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id                 UUID NOT NULL REFERENCES business(id) ON DELETE CASCADE,
  appointment_id              UUID NOT NULL REFERENCES appointment(id) ON DELETE CASCADE,
  customer_id                 UUID NOT NULL REFERENCES customer(id),
  vehicle_id                  UUID NOT NULL REFERENCES vehicle(id),
  phase                       evidence_phase NOT NULL,
  slot_tag                    TEXT,            -- 'front','rear','side_driver','interior','damage_X'
  note                        TEXT,
  storage_bucket              TEXT NOT NULL DEFAULT 'splash-evidence',
  storage_key                 TEXT NOT NULL,
  thumb_key                   TEXT,            -- thumbnail generado async
  mime_type                   TEXT NOT NULL CHECK (mime_type IN ('image/jpeg','image/png','image/heic','image/webp')),
  bytes                       INTEGER NOT NULL CHECK (bytes > 0),
  width                       INTEGER,
  height                      INTEGER,
  exif_scrubbed               BOOLEAN NOT NULL DEFAULT TRUE,
  scan_status                 TEXT NOT NULL DEFAULT 'pending' CHECK (scan_status IN ('pending','clean','infected')),
  scan_result                 TEXT,
  marketing_consent           BOOLEAN NOT NULL DEFAULT FALSE,
  marketing_consent_given_at  TIMESTAMPTZ,
  marketing_consent_revoked_at TIMESTAMPTZ,
  uploaded_by_user_id         UUID REFERENCES app_user(id),
  uploaded_by_customer_id     UUID REFERENCES customer(id),
  uploaded_at                 TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  soft_deleted_at             TIMESTAMPTZ,
  soft_deleted_by_user_id     UUID REFERENCES app_user(id),
  CHECK (
    (uploaded_by_user_id IS NOT NULL AND uploaded_by_customer_id IS NULL) OR
    (uploaded_by_user_id IS NULL AND uploaded_by_customer_id IS NOT NULL)
  )
);
CREATE INDEX idx_evidence_appt_phase ON evidence_photo(appointment_id, phase) WHERE soft_deleted_at IS NULL;
CREATE INDEX idx_evidence_vehicle ON evidence_photo(business_id, vehicle_id, uploaded_at DESC) WHERE soft_deleted_at IS NULL;
CREATE INDEX idx_evidence_business_date ON evidence_photo(business_id, uploaded_at DESC);

-- -----------------------------------------------------------------------------
-- evidence_consent (1:1 con appointment)
-- -----------------------------------------------------------------------------
CREATE TABLE evidence_consent (
  id                                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id                             UUID NOT NULL REFERENCES business(id) ON DELETE CASCADE,
  appointment_id                          UUID NOT NULL REFERENCES appointment(id) ON DELETE CASCADE UNIQUE,
  customer_id                             UUID NOT NULL REFERENCES customer(id),
  -- obligatorio al reservar
  current_state_accepted                  BOOLEAN NOT NULL,
  current_state_text_version              TEXT NOT NULL,
  current_state_accepted_at               TIMESTAMPTZ NOT NULL,
  -- obligatorio: acepta política no-reembolso
  non_refundable_deposit_accepted         BOOLEAN NOT NULL,
  non_refundable_text_version             TEXT NOT NULL,
  non_refundable_accepted_at              TIMESTAMPTZ NOT NULL,
  -- opcional: consentimiento marketing
  marketing_use_consent                   BOOLEAN NOT NULL DEFAULT FALSE,
  marketing_text_version                  TEXT,
  marketing_accepted_at                   TIMESTAMPTZ,
  marketing_revoked_at                    TIMESTAMPTZ,
  signed_ip                               INET,
  signed_user_agent                       TEXT,
  created_at                              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- 6. FINANCIAL — payments, receipts
-- =============================================================================

-- -----------------------------------------------------------------------------
-- payment
-- -----------------------------------------------------------------------------
CREATE TABLE payment (
  id                          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id                 UUID NOT NULL REFERENCES business(id) ON DELETE CASCADE,
  appointment_id              UUID NOT NULL REFERENCES appointment(id) ON DELETE CASCADE,
  kind                        payment_kind NOT NULL,
  method                      payment_method NOT NULL,
  amount_cents                INTEGER NOT NULL,           -- refund puede ser negativo
  currency                    CHAR(3) NOT NULL DEFAULT 'USD',
  processed_at                TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  received_by_user_id         UUID REFERENCES app_user(id),
  -- Stripe
  stripe_payment_intent_id    TEXT,
  stripe_charge_id            TEXT,
  stripe_refund_id            TEXT,
  stripe_fee_cents            INTEGER,
  -- externo (zelle tx id, etc.)
  external_reference          TEXT,
  notes                       TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_payment_appt ON payment(appointment_id);
CREATE UNIQUE INDEX idx_payment_stripe_pi ON payment(stripe_payment_intent_id) WHERE stripe_payment_intent_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- receipt
-- -----------------------------------------------------------------------------
CREATE TABLE receipt (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id       UUID NOT NULL REFERENCES business(id) ON DELETE CASCADE,
  appointment_id    UUID NOT NULL REFERENCES appointment(id) ON DELETE CASCADE UNIQUE,
  number            TEXT NOT NULL,                 -- ej. "2026-0001"
  issued_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  total_cents       INTEGER NOT NULL,
  pdf_key           TEXT,                           -- A4 PDF en R2
  thermal_text      TEXT,                           -- representación plana para printer 80mm
  qr_token          TEXT NOT NULL,                  -- lleva a galería + detalle
  emailed_at        TIMESTAMPTZ,
  printed_at        TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (business_id, number)
);

-- =============================================================================
-- 7. SYSTEM — notifications, audit
-- =============================================================================

-- -----------------------------------------------------------------------------
-- notification
-- -----------------------------------------------------------------------------
CREATE TABLE notification (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id         UUID NOT NULL REFERENCES business(id) ON DELETE CASCADE,
  appointment_id      UUID REFERENCES appointment(id) ON DELETE CASCADE,
  customer_id         UUID REFERENCES customer(id) ON DELETE CASCADE,
  user_id             UUID REFERENCES app_user(id) ON DELETE CASCADE,
  channel             notification_channel NOT NULL,
  template            TEXT NOT NULL,              -- 'confirmation','reminder_24h',...
  status              notification_status NOT NULL DEFAULT 'queued',
  scheduled_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  sent_at             TIMESTAMPTZ,
  failed_at           TIMESTAMPTZ,
  error               TEXT,
  external_provider   TEXT,                       -- 'resend','twilio'
  external_id         TEXT,                       -- message id del proveedor
  qstash_schedule_id  TEXT,                        -- para cancelar si la cita se cancela
  payload             JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_notification_appt ON notification(appointment_id);
CREATE INDEX idx_notification_scheduled ON notification(status, scheduled_at) WHERE status = 'queued';

-- -----------------------------------------------------------------------------
-- audit_log
-- -----------------------------------------------------------------------------
CREATE TABLE audit_log (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id     UUID NOT NULL REFERENCES business(id) ON DELETE CASCADE,
  actor_user_id   UUID REFERENCES app_user(id),
  actor_customer_id UUID REFERENCES customer(id),
  actor_type      TEXT NOT NULL CHECK (actor_type IN ('user','customer','system','webhook')),
  action          audit_action NOT NULL,
  entity_type     TEXT NOT NULL,    -- 'appointment','payment','vehicle','loyalty_redemption',...
  entity_id       UUID NOT NULL,
  diff            JSONB,
  metadata        JSONB,
  ip              INET,
  user_agent      TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_audit_entity ON audit_log(business_id, entity_type, entity_id, created_at);
CREATE INDEX idx_audit_actor ON audit_log(business_id, actor_user_id, created_at);

-- -----------------------------------------------------------------------------
-- customer_data_request (GDPR/CCPA)
-- -----------------------------------------------------------------------------
CREATE TABLE customer_data_request (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  business_id     UUID NOT NULL REFERENCES business(id) ON DELETE CASCADE,
  customer_id     UUID NOT NULL REFERENCES customer(id),
  kind            TEXT NOT NULL CHECK (kind IN ('export','delete')),
  status          TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','processing','done','rejected')),
  requested_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at    TIMESTAMPTZ,
  download_key    TEXT,        -- si export
  notes           TEXT
);

-- =============================================================================
-- 8. TRIGGERS — lealtad, auditoría, timestamps
-- =============================================================================

-- -----------------------------------------------------------------------------
-- updated_at automático
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- aplicar a todas las tablas con updated_at:
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN
    SELECT table_name FROM information_schema.columns
    WHERE column_name = 'updated_at' AND table_schema = current_schema()
  LOOP
    EXECUTE format('CREATE TRIGGER trg_%I_updated_at BEFORE UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION set_updated_at()', t, t);
  END LOOP;
END$$;

-- -----------------------------------------------------------------------------
-- Lealtad: incrementar / decrementar contador al cambiar status
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION loyalty_on_appointment_status_change() RETURNS TRIGGER AS $$
DECLARE
  qualifies BOOLEAN;
  prog loyalty_program%ROWTYPE;
  has_package BOOLEAN;
BEGIN
  -- Buscar programa activo del negocio
  SELECT * INTO prog FROM loyalty_program WHERE business_id = NEW.business_id;
  IF NOT FOUND OR NOT prog.is_active THEN
    RETURN NEW;
  END IF;

  -- ¿El appointment tiene al menos un item de kind='package'? (si count_packages_only)
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

  -- Increment: TG_OP UPDATE, status pasa a 'completed' desde algo distinto
  IF TG_OP = 'UPDATE' AND OLD.status <> 'completed' AND NEW.status = 'completed' THEN
    INSERT INTO loyalty_progress (business_id, vehicle_id, customer_id, completed_visits, last_completed_appointment_id, first_service_at, last_service_at, lifetime_revenue_cents)
      VALUES (NEW.business_id, NEW.vehicle_id, NEW.customer_id, 1, NEW.id, NEW.completed_at, NEW.completed_at, NEW.total_cents)
      ON CONFLICT (vehicle_id) DO UPDATE
        SET completed_visits = loyalty_progress.completed_visits + 1,
            last_completed_appointment_id = NEW.id,
            last_service_at = NEW.completed_at,
            lifetime_revenue_cents = loyalty_progress.lifetime_revenue_cents + NEW.total_cents,
            updated_at = NOW();
  END IF;

  -- Decrement: UPDATE, status cambia DESDE 'completed' a otro (undo)
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

CREATE TRIGGER trg_loyalty_progress_status
  AFTER UPDATE ON appointment
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION loyalty_on_appointment_status_change();

-- -----------------------------------------------------------------------------
-- appointment_status_history — auto-insert en cada cambio de status
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION log_appointment_status_change() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
    INSERT INTO appointment_status_history (business_id, appointment_id, from_status, to_status, changed_at)
      VALUES (NEW.business_id, NEW.id, OLD.status, NEW.status, NOW());
  ELSIF TG_OP = 'INSERT' THEN
    INSERT INTO appointment_status_history (business_id, appointment_id, from_status, to_status, changed_at)
      VALUES (NEW.business_id, NEW.id, NULL, NEW.status, NOW());
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_appt_status_history
  AFTER INSERT OR UPDATE ON appointment
  FOR EACH ROW EXECUTE FUNCTION log_appointment_status_change();

-- -----------------------------------------------------------------------------
-- evidence_photo_count en appointment — contador denormalizado
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

CREATE TRIGGER trg_evidence_count
  AFTER INSERT OR UPDATE ON evidence_photo
  FOR EACH ROW EXECUTE FUNCTION update_evidence_count();

-- =============================================================================
-- 9. ROW-LEVEL SECURITY — aplicada a cada tabla con business_id
-- =============================================================================

-- Helper para simplificar:
DO $$
DECLARE t TEXT;
BEGIN
  FOR t IN
    SELECT table_name FROM information_schema.columns
    WHERE column_name = 'business_id' AND table_schema = current_schema()
  LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I
        USING (business_id = current_setting(''app.current_business_id'', true)::uuid)
        WITH CHECK (business_id = current_setting(''app.current_business_id'', true)::uuid)',
      t
    );
  END LOOP;
END$$;

-- -----------------------------------------------------------------------------
-- Roles y permisos
-- -----------------------------------------------------------------------------
-- Rol de app: no puede desactivar RLS ni BYPASSRLS
-- CREATE ROLE splash_app NOINHERIT LOGIN PASSWORD '...';
-- Rol de migración: SUPERUSER temporal (o CREATEDB + OWNER)
-- CREATE ROLE splash_migrator SUPERUSER LOGIN PASSWORD '...';
-- Rol admin interno de Splash para ops cross-tenant: BYPASSRLS, SOLO PARA HERRAMIENTAS
-- CREATE ROLE splash_ops BYPASSRLS LOGIN PASSWORD '...';

-- =============================================================================
-- 10. SEED DATA EJEMPLO (valores del brief original)
-- =============================================================================
-- Se incluye como referencia en packages/db/prisma/seed.ts para cada negocio nuevo:
-- vehicle_type: Sedan, Small SUV, Medium SUV / Pickup, XL SUV / XL Pickup
-- package: Car Wash, Car Wash + Interior Detail, Upholstery Shampoo + Car Wash,
--          Full Detail, Paint Enhancement, Paint Correction
-- package_price: las 24 combinaciones (6 paquetes × 4 tipos)
-- addon: 14 add-ons con sus pricing_mode correspondientes
-- zones: configuración por negocio
-- resources: al menos "Unit 1"
-- loyalty_program + loyalty_tier: 5 visits=15%, 10 visits=25%

-- =============================================================================
-- FIN
-- =============================================================================
