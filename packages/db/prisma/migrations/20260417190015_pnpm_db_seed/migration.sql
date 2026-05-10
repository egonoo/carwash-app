-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "citext";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('owner', 'admin', 'staff', 'readonly');

-- CreateEnum
CREATE TYPE "addon_pricing_mode" AS ENUM ('fixed', 'starting_at', 'per_unit', 'quote_on_site');

-- CreateEnum
CREATE TYPE "deposit_policy_type" AS ENUM ('fixed', 'percentage');

-- CreateEnum
CREATE TYPE "appointment_status" AS ENUM ('draft', 'pending_deposit', 'confirmed', 'on_the_way', 'arrived', 'in_progress', 'completed', 'cancelled', 'no_show', 'rescheduled');

-- CreateEnum
CREATE TYPE "appointment_item_kind" AS ENUM ('package', 'addon', 'manual_extra');

-- CreateEnum
CREATE TYPE "payment_kind" AS ENUM ('deposit', 'final', 'refund', 'tip', 'extra');

-- CreateEnum
CREATE TYPE "payment_method" AS ENUM ('card_online', 'card_terminal', 'cash', 'zelle', 'venmo', 'cashapp', 'other');

-- CreateEnum
CREATE TYPE "discount_kind" AS ENUM ('loyalty', 'promo', 'manual');

-- CreateEnum
CREATE TYPE "discount_value_type" AS ENUM ('percentage', 'fixed');

-- CreateEnum
CREATE TYPE "evidence_phase" AS ENUM ('pre_service_customer', 'pre_service_admin', 'in_progress', 'post_service');

-- CreateEnum
CREATE TYPE "notification_channel" AS ENUM ('email', 'sms', 'push');

-- CreateEnum
CREATE TYPE "notification_status" AS ENUM ('queued', 'sent', 'failed', 'cancelled');

-- CreateEnum
CREATE TYPE "audit_action" AS ENUM ('create', 'update', 'delete', 'state_change', 'grant', 'revoke', 'adjust');

-- CreateTable
CREATE TABLE "business" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legal_name" TEXT,
    "email" CITEXT NOT NULL,
    "phone" TEXT,
    "timezone" TEXT NOT NULL DEFAULT 'America/New_York',
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "locale" TEXT NOT NULL DEFAULT 'en',
    "logo_storage_key" TEXT,
    "brand_color" TEXT,
    "address_line1" TEXT,
    "address_city" TEXT,
    "address_state" TEXT,
    "address_zip" TEXT,
    "tax_rate_bps" INTEGER NOT NULL DEFAULT 0,
    "deposit_policy_type" "deposit_policy_type" NOT NULL DEFAULT 'fixed',
    "deposit_policy_value" INTEGER NOT NULL DEFAULT 2000,
    "deposit_min_cents" INTEGER NOT NULL DEFAULT 2000,
    "features" JSONB NOT NULL DEFAULT '{"loyalty":true,"photos":true,"promo_codes":true,"multiple_resources":false,"custom_domain":false,"sms":false,"google_calendar":true}',
    "default_travel_time_min" INTEGER NOT NULL DEFAULT 20,
    "reschedule_max_free" INTEGER NOT NULL DEFAULT 1,
    "reschedule_min_hours" INTEGER NOT NULL DEFAULT 24,
    "evidence_min_photos" INTEGER NOT NULL DEFAULT 1,
    "evidence_max_photos_cust" INTEGER NOT NULL DEFAULT 12,
    "evidence_max_photos_admin" INTEGER NOT NULL DEFAULT 30,
    "evidence_retention_days" INTEGER NOT NULL DEFAULT 730,
    "photo_scrub_exif" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'active',
    "plan" TEXT NOT NULL DEFAULT 'free',
    "stripe_customer_id" TEXT,
    "stripe_account_id" TEXT,
    "stripe_account_ready" BOOLEAN NOT NULL DEFAULT false,
    "google_calendar_id" TEXT,
    "google_refresh_token_enc" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "business_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "business_domain" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "host" TEXT NOT NULL,
    "verified_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_domain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "app_user" (
    "id" UUID NOT NULL,
    "email" CITEXT NOT NULL,
    "password_hash" TEXT,
    "full_name" TEXT,
    "phone" TEXT,
    "avatar_key" TEXT,
    "totp_secret_enc" TEXT,
    "totp_enabled" BOOLEAN NOT NULL DEFAULT false,
    "last_login_at" TIMESTAMPTZ,
    "email_verified_at" TIMESTAMPTZ,
    "is_super_admin" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "app_user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_business_role" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "role" "user_role" NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_business_role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "email" CITEXT NOT NULL,
    "phone_e164" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT,
    "preferred_locale" TEXT DEFAULT 'en',
    "marketing_consent" BOOLEAN NOT NULL DEFAULT false,
    "blocked_at" TIMESTAMPTZ,
    "block_reason" TEXT,
    "internal_notes" TEXT,
    "address_line1_enc" BYTEA,
    "address_line2_enc" BYTEA,
    "address_city" TEXT,
    "address_state" TEXT,
    "address_zip" TEXT,
    "address_lat" DOUBLE PRECISION,
    "address_lng" DOUBLE PRECISION,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMPTZ,

    CONSTRAINT "customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "vehicle_type_id" UUID NOT NULL,
    "internal_code" TEXT NOT NULL,
    "vin" TEXT,
    "plate" TEXT,
    "plate_state" TEXT,
    "make" TEXT,
    "model" TEXT,
    "year" INTEGER,
    "color" TEXT,
    "nickname" TEXT,
    "notes" TEXT,
    "archived_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vehicle_type" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "examples" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "archived_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "vehicle_type_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "package" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "short_benefits" JSONB,
    "image_key" TEXT,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "deposit_policy_type" "deposit_policy_type",
    "deposit_policy_value" INTEGER,
    "deposit_min_cents" INTEGER,
    "archived_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "package_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "package_price" (
    "package_id" UUID NOT NULL,
    "vehicle_type_id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "price_cents" INTEGER NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "is_available" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "package_price_pkey" PRIMARY KEY ("package_id","vehicle_type_id")
);

-- CreateTable
CREATE TABLE "addon" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "pricing_mode" "addon_pricing_mode" NOT NULL,
    "base_price_cents" INTEGER NOT NULL DEFAULT 0,
    "duration_minutes" INTEGER NOT NULL DEFAULT 0,
    "default_quantity" INTEGER NOT NULL DEFAULT 1,
    "max_quantity" INTEGER NOT NULL DEFAULT 10,
    "requires_admin_quote" BOOLEAN NOT NULL DEFAULT false,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "image_key" TEXT,
    "archived_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "addon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zone" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "color" TEXT,
    "description" TEXT,
    "zip_codes" TEXT[],
    "geojson" JSONB,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "archived_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "zone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zone_travel_time" (
    "business_id" UUID NOT NULL,
    "from_zone_id" UUID NOT NULL,
    "to_zone_id" UUID NOT NULL,
    "minutes" INTEGER NOT NULL,

    CONSTRAINT "zone_travel_time_pkey" PRIMARY KEY ("from_zone_id","to_zone_id")
);

-- CreateTable
CREATE TABLE "promo_code" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "discount_type" "discount_value_type" NOT NULL,
    "discount_value" INTEGER NOT NULL,
    "applies_to_package_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "applies_to_addons" BOOLEAN NOT NULL DEFAULT false,
    "min_subtotal_cents" INTEGER NOT NULL DEFAULT 0,
    "max_uses_total" INTEGER,
    "max_uses_per_customer" INTEGER NOT NULL DEFAULT 1,
    "uses_count" INTEGER NOT NULL DEFAULT 0,
    "active_from" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "active_until" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "archived_at" TIMESTAMPTZ,

    CONSTRAINT "promo_code_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_template" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "window_start" TIME NOT NULL,
    "window_end" TIME NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schedule_template_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_template_zone" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "day_of_week" INTEGER NOT NULL,
    "zone_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schedule_template_zone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_exception" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "exception_date" DATE NOT NULL,
    "kind" TEXT NOT NULL,
    "payload" JSONB NOT NULL DEFAULT '{}',
    "note" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "schedule_exception_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "schedule_block" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "starts_at" TIMESTAMPTZ NOT NULL,
    "ends_at" TIMESTAMPTZ NOT NULL,
    "reason" TEXT,
    "zone_id" UUID,
    "resource_id" UUID,
    "created_by" UUID,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "schedule_block_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "resource" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "archived_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "resource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_program" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT false,
    "applies_to_addons" BOOLEAN NOT NULL DEFAULT false,
    "count_packages_only" BOOLEAN NOT NULL DEFAULT true,
    "reset_on_redemption" BOOLEAN NOT NULL DEFAULT false,
    "auto_apply" BOOLEAN NOT NULL DEFAULT true,
    "name" TEXT DEFAULT 'Loyalty Rewards',
    "description" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loyalty_program_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_tier" (
    "id" UUID NOT NULL,
    "program_id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "name" TEXT,
    "visits_required" INTEGER NOT NULL,
    "discount_type" "discount_value_type" NOT NULL,
    "discount_value" INTEGER NOT NULL,
    "applies_to_package_ids" UUID[] DEFAULT ARRAY[]::UUID[],
    "max_redemptions_per_vehicle" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loyalty_tier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_progress" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "completed_visits" INTEGER NOT NULL DEFAULT 0,
    "last_completed_appointment_id" UUID,
    "first_service_at" TIMESTAMPTZ,
    "last_service_at" TIMESTAMPTZ,
    "lifetime_revenue_cents" BIGINT NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loyalty_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_adjustment" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "delta" INTEGER NOT NULL,
    "reason" TEXT NOT NULL,
    "before_count" INTEGER NOT NULL,
    "after_count" INTEGER NOT NULL,
    "adjusted_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loyalty_adjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loyalty_redemption" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "appointment_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "tier_id" UUID,
    "tier_snapshot" JSONB NOT NULL,
    "visit_count_at_redemption" INTEGER NOT NULL,
    "discount_type" "discount_value_type" NOT NULL,
    "discount_value" INTEGER NOT NULL,
    "discount_applied_cents" INTEGER NOT NULL,
    "granted_manually" BOOLEAN NOT NULL DEFAULT false,
    "granted_by_user_id" UUID,
    "revoked_at" TIMESTAMPTZ,
    "revoked_by_user_id" UUID,
    "revoke_reason" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "loyalty_redemption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointment" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "zone_id" UUID NOT NULL,
    "resource_id" UUID NOT NULL,
    "starts_at" TIMESTAMPTZ NOT NULL,
    "ends_at" TIMESTAMPTZ NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "status" "appointment_status" NOT NULL DEFAULT 'draft',
    "cancellation_reason" TEXT,
    "no_show_reason" TEXT,
    "reschedule_count" INTEGER NOT NULL DEFAULT 0,
    "previous_appointment_id" UUID,
    "service_address_line1_enc" BYTEA,
    "service_address_line2_enc" BYTEA,
    "service_address_city" TEXT,
    "service_address_state" TEXT,
    "service_address_zip" TEXT,
    "service_address_lat" DOUBLE PRECISION,
    "service_address_lng" DOUBLE PRECISION,
    "service_address_place_id" TEXT,
    "customer_instructions" TEXT,
    "internal_notes" TEXT,
    "subtotal_cents" INTEGER NOT NULL DEFAULT 0,
    "discount_total_cents" INTEGER NOT NULL DEFAULT 0,
    "tax_cents" INTEGER NOT NULL DEFAULT 0,
    "total_cents" INTEGER NOT NULL DEFAULT 0,
    "deposit_policy_type_snapshot" "deposit_policy_type" NOT NULL,
    "deposit_policy_value_snapshot" INTEGER NOT NULL,
    "deposit_amount_cents" INTEGER NOT NULL DEFAULT 0,
    "deposit_paid_cents" INTEGER NOT NULL DEFAULT 0,
    "deposit_paid_at" TIMESTAMPTZ,
    "deposit_stripe_payment_intent_id" TEXT,
    "balance_due_cents" INTEGER NOT NULL DEFAULT 0,
    "evidence_photo_count" INTEGER NOT NULL DEFAULT 0,
    "loyalty_redemption_id" UUID,
    "confirmed_at" TIMESTAMPTZ,
    "on_the_way_at" TIMESTAMPTZ,
    "arrived_at" TIMESTAMPTZ,
    "started_at" TIMESTAMPTZ,
    "completed_at" TIMESTAMPTZ,
    "cancelled_at" TIMESTAMPTZ,
    "no_show_at" TIMESTAMPTZ,
    "idempotency_key" TEXT,
    "manage_token_hash" TEXT,
    "source" TEXT NOT NULL DEFAULT 'web',
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_user_id" UUID,
    "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "appointment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointment_item" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "appointment_id" UUID NOT NULL,
    "kind" "appointment_item_kind" NOT NULL,
    "ref_id" UUID,
    "name_snapshot" TEXT NOT NULL,
    "description_snapshot" TEXT,
    "pricing_mode_snapshot" "addon_pricing_mode",
    "unit_price_cents" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "line_total_cents" INTEGER NOT NULL,
    "duration_minutes" INTEGER NOT NULL DEFAULT 0,
    "pricing_notes" TEXT,
    "requires_admin_quote" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_user_id" UUID,
    "display_order" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "appointment_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointment_status_history" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "appointment_id" UUID NOT NULL,
    "from_status" "appointment_status",
    "to_status" "appointment_status" NOT NULL,
    "changed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "changed_by_user_id" UUID,
    "reason" TEXT,

    CONSTRAINT "appointment_status_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "applied_discount" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "appointment_id" UUID NOT NULL,
    "kind" "discount_kind" NOT NULL,
    "source_id" UUID,
    "label" TEXT NOT NULL,
    "discount_type" "discount_value_type" NOT NULL,
    "discount_value" INTEGER NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by_user_id" UUID,

    CONSTRAINT "applied_discount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence_photo" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "appointment_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "vehicle_id" UUID NOT NULL,
    "phase" "evidence_phase" NOT NULL,
    "slot_tag" TEXT,
    "note" TEXT,
    "storage_bucket" TEXT NOT NULL DEFAULT 'splash-evidence',
    "storage_key" TEXT NOT NULL,
    "thumb_key" TEXT,
    "mime_type" TEXT NOT NULL,
    "bytes" INTEGER NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "exif_scrubbed" BOOLEAN NOT NULL DEFAULT true,
    "scan_status" TEXT NOT NULL DEFAULT 'pending',
    "scan_result" TEXT,
    "marketing_consent" BOOLEAN NOT NULL DEFAULT false,
    "marketing_consent_given_at" TIMESTAMPTZ,
    "marketing_consent_revoked_at" TIMESTAMPTZ,
    "uploaded_by_user_id" UUID,
    "uploaded_by_customer_id" UUID,
    "uploaded_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "soft_deleted_at" TIMESTAMPTZ,
    "soft_deleted_by_user_id" UUID,

    CONSTRAINT "evidence_photo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "evidence_consent" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "appointment_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "current_state_accepted" BOOLEAN NOT NULL,
    "current_state_text_version" TEXT NOT NULL,
    "current_state_accepted_at" TIMESTAMPTZ NOT NULL,
    "non_refundable_deposit_accepted" BOOLEAN NOT NULL,
    "non_refundable_text_version" TEXT NOT NULL,
    "non_refundable_accepted_at" TIMESTAMPTZ NOT NULL,
    "marketing_use_consent" BOOLEAN NOT NULL DEFAULT false,
    "marketing_text_version" TEXT,
    "marketing_accepted_at" TIMESTAMPTZ,
    "marketing_revoked_at" TIMESTAMPTZ,
    "signed_ip" INET,
    "signed_user_agent" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "evidence_consent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "appointment_id" UUID NOT NULL,
    "kind" "payment_kind" NOT NULL,
    "method" "payment_method" NOT NULL,
    "amount_cents" INTEGER NOT NULL,
    "currency" CHAR(3) NOT NULL DEFAULT 'USD',
    "processed_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "received_by_user_id" UUID,
    "stripe_payment_intent_id" TEXT,
    "stripe_charge_id" TEXT,
    "stripe_refund_id" TEXT,
    "stripe_fee_cents" INTEGER,
    "external_reference" TEXT,
    "notes" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receipt" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "appointment_id" UUID NOT NULL,
    "number" TEXT NOT NULL,
    "issued_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "total_cents" INTEGER NOT NULL,
    "pdf_key" TEXT,
    "thermal_text" TEXT,
    "qr_token" TEXT NOT NULL,
    "emailed_at" TIMESTAMPTZ,
    "printed_at" TIMESTAMPTZ,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "appointment_id" UUID,
    "customer_id" UUID,
    "user_id" UUID,
    "channel" "notification_channel" NOT NULL,
    "template" TEXT NOT NULL,
    "status" "notification_status" NOT NULL DEFAULT 'queued',
    "scheduled_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sent_at" TIMESTAMPTZ,
    "failed_at" TIMESTAMPTZ,
    "error" TEXT,
    "external_provider" TEXT,
    "external_id" TEXT,
    "qstash_schedule_id" TEXT,
    "payload" JSONB,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "actor_user_id" UUID,
    "actor_customer_id" UUID,
    "actor_type" TEXT NOT NULL,
    "action" "audit_action" NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" UUID NOT NULL,
    "diff" JSONB,
    "metadata" JSONB,
    "ip" INET,
    "user_agent" TEXT,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_data_request" (
    "id" UUID NOT NULL,
    "business_id" UUID NOT NULL,
    "customer_id" UUID NOT NULL,
    "kind" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requested_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMPTZ,
    "download_key" TEXT,
    "notes" TEXT,

    CONSTRAINT "customer_data_request_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "business_slug_key" ON "business"("slug");

-- CreateIndex
CREATE INDEX "idx_business_slug" ON "business"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "business_domain_host_key" ON "business_domain"("host");

-- CreateIndex
CREATE INDEX "idx_business_domain_host" ON "business_domain"("host");

-- CreateIndex
CREATE UNIQUE INDEX "app_user_email_key" ON "app_user"("email");

-- CreateIndex
CREATE INDEX "idx_ubr_business" ON "user_business_role"("business_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_business_role_user_id_business_id_key" ON "user_business_role"("user_id", "business_id");

-- CreateIndex
CREATE INDEX "idx_customer_business" ON "customer"("business_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_business_id_email_key" ON "customer"("business_id", "email");

-- CreateIndex
CREATE UNIQUE INDEX "customer_business_id_phone_e164_key" ON "customer"("business_id", "phone_e164");

-- CreateIndex
CREATE INDEX "idx_vehicle_customer" ON "vehicle"("business_id", "customer_id");

-- CreateIndex
CREATE UNIQUE INDEX "idx_vehicle_code" ON "vehicle"("business_id", "internal_code");

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_type_business_id_slug_key" ON "vehicle_type"("business_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "package_business_id_slug_key" ON "package"("business_id", "slug");

-- CreateIndex
CREATE INDEX "idx_package_price_business" ON "package_price"("business_id");

-- CreateIndex
CREATE UNIQUE INDEX "addon_business_id_slug_key" ON "addon"("business_id", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "zone_business_id_slug_key" ON "zone"("business_id", "slug");

-- CreateIndex
CREATE INDEX "idx_ztt_business" ON "zone_travel_time"("business_id");

-- CreateIndex
CREATE INDEX "idx_schedule_template_business" ON "schedule_template"("business_id", "day_of_week");

-- CreateIndex
CREATE UNIQUE INDEX "schedule_template_zone_business_id_day_of_week_zone_id_key" ON "schedule_template_zone"("business_id", "day_of_week", "zone_id");

-- CreateIndex
CREATE UNIQUE INDEX "schedule_exception_business_id_exception_date_kind_key" ON "schedule_exception"("business_id", "exception_date", "kind");

-- CreateIndex
CREATE INDEX "idx_schedule_block_range" ON "schedule_block"("business_id", "starts_at", "ends_at");

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_program_business_id_key" ON "loyalty_program"("business_id");

-- CreateIndex
CREATE INDEX "idx_loyalty_tier_program" ON "loyalty_tier"("program_id", "visits_required");

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_progress_vehicle_id_key" ON "loyalty_progress"("vehicle_id");

-- CreateIndex
CREATE INDEX "idx_loyalty_progress_business_customer" ON "loyalty_progress"("business_id", "customer_id");

-- CreateIndex
CREATE INDEX "idx_loyalty_adj_vehicle" ON "loyalty_adjustment"("business_id", "vehicle_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_redemption_vehicle" ON "loyalty_redemption"("business_id", "vehicle_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_redemption_tier" ON "loyalty_redemption"("tier_id");

-- CreateIndex
CREATE UNIQUE INDEX "loyalty_redemption_appointment_id_tier_id_key" ON "loyalty_redemption"("appointment_id", "tier_id");

-- CreateIndex
CREATE UNIQUE INDEX "appointment_deposit_stripe_payment_intent_id_key" ON "appointment"("deposit_stripe_payment_intent_id");

-- CreateIndex
CREATE UNIQUE INDEX "appointment_idempotency_key_key" ON "appointment"("idempotency_key");

-- CreateIndex
CREATE INDEX "idx_appointment_business_date" ON "appointment"("business_id", "starts_at");

-- CreateIndex
CREATE INDEX "idx_appointment_status" ON "appointment"("business_id", "status", "starts_at");

-- CreateIndex
CREATE INDEX "idx_appointment_customer" ON "appointment"("business_id", "customer_id", "starts_at" DESC);

-- CreateIndex
CREATE INDEX "idx_appointment_vehicle" ON "appointment"("business_id", "vehicle_id", "starts_at" DESC);

-- CreateIndex
CREATE INDEX "idx_appointment_resource_day" ON "appointment"("business_id", "resource_id", "starts_at");

-- CreateIndex
CREATE INDEX "idx_item_appointment" ON "appointment_item"("appointment_id");

-- CreateIndex
CREATE INDEX "idx_ash_appt" ON "appointment_status_history"("appointment_id", "changed_at");

-- CreateIndex
CREATE INDEX "idx_applied_discount_appt" ON "applied_discount"("appointment_id");

-- CreateIndex
CREATE INDEX "idx_evidence_appt_phase" ON "evidence_photo"("appointment_id", "phase");

-- CreateIndex
CREATE INDEX "idx_evidence_vehicle" ON "evidence_photo"("business_id", "vehicle_id", "uploaded_at" DESC);

-- CreateIndex
CREATE INDEX "idx_evidence_business_date" ON "evidence_photo"("business_id", "uploaded_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "evidence_consent_appointment_id_key" ON "evidence_consent"("appointment_id");

-- CreateIndex
CREATE INDEX "idx_payment_appt" ON "payment"("appointment_id");

-- CreateIndex
CREATE UNIQUE INDEX "receipt_appointment_id_key" ON "receipt"("appointment_id");

-- CreateIndex
CREATE UNIQUE INDEX "receipt_business_id_number_key" ON "receipt"("business_id", "number");

-- CreateIndex
CREATE INDEX "idx_notification_appt" ON "notification"("appointment_id");

-- CreateIndex
CREATE INDEX "idx_notification_scheduled" ON "notification"("status", "scheduled_at");

-- CreateIndex
CREATE INDEX "idx_audit_entity" ON "audit_log"("business_id", "entity_type", "entity_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_audit_actor" ON "audit_log"("business_id", "actor_user_id", "created_at");

-- AddForeignKey
ALTER TABLE "business_domain" ADD CONSTRAINT "business_domain_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_business_role" ADD CONSTRAINT "user_business_role_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_business_role" ADD CONSTRAINT "user_business_role_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer" ADD CONSTRAINT "customer_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle" ADD CONSTRAINT "vehicle_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle" ADD CONSTRAINT "vehicle_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle" ADD CONSTRAINT "vehicle_vehicle_type_id_fkey" FOREIGN KEY ("vehicle_type_id") REFERENCES "vehicle_type"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vehicle_type" ADD CONSTRAINT "vehicle_type_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package" ADD CONSTRAINT "package_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_price" ADD CONSTRAINT "package_price_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "package"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_price" ADD CONSTRAINT "package_price_vehicle_type_id_fkey" FOREIGN KEY ("vehicle_type_id") REFERENCES "vehicle_type"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "package_price" ADD CONSTRAINT "package_price_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "addon" ADD CONSTRAINT "addon_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zone" ADD CONSTRAINT "zone_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zone_travel_time" ADD CONSTRAINT "zone_travel_time_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zone_travel_time" ADD CONSTRAINT "zone_travel_time_from_zone_id_fkey" FOREIGN KEY ("from_zone_id") REFERENCES "zone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zone_travel_time" ADD CONSTRAINT "zone_travel_time_to_zone_id_fkey" FOREIGN KEY ("to_zone_id") REFERENCES "zone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "promo_code" ADD CONSTRAINT "promo_code_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_template" ADD CONSTRAINT "schedule_template_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_template_zone" ADD CONSTRAINT "schedule_template_zone_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_template_zone" ADD CONSTRAINT "schedule_template_zone_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zone"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_exception" ADD CONSTRAINT "schedule_exception_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_exception" ADD CONSTRAINT "schedule_exception_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_block" ADD CONSTRAINT "schedule_block_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_block" ADD CONSTRAINT "schedule_block_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zone"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_block" ADD CONSTRAINT "schedule_block_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resource"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "schedule_block" ADD CONSTRAINT "schedule_block_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "resource" ADD CONSTRAINT "resource_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_program" ADD CONSTRAINT "loyalty_program_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_tier" ADD CONSTRAINT "loyalty_tier_program_id_fkey" FOREIGN KEY ("program_id") REFERENCES "loyalty_program"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_tier" ADD CONSTRAINT "loyalty_tier_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_progress" ADD CONSTRAINT "loyalty_progress_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_progress" ADD CONSTRAINT "loyalty_progress_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_progress" ADD CONSTRAINT "loyalty_progress_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_progress" ADD CONSTRAINT "loyalty_progress_last_completed_appointment_id_fkey" FOREIGN KEY ("last_completed_appointment_id") REFERENCES "appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_adjustment" ADD CONSTRAINT "loyalty_adjustment_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_adjustment" ADD CONSTRAINT "loyalty_adjustment_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_adjustment" ADD CONSTRAINT "loyalty_adjustment_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_adjustment" ADD CONSTRAINT "loyalty_adjustment_adjusted_by_user_id_fkey" FOREIGN KEY ("adjusted_by_user_id") REFERENCES "app_user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_redemption" ADD CONSTRAINT "loyalty_redemption_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_redemption" ADD CONSTRAINT "loyalty_redemption_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_redemption" ADD CONSTRAINT "loyalty_redemption_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_redemption" ADD CONSTRAINT "loyalty_redemption_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_redemption" ADD CONSTRAINT "loyalty_redemption_tier_id_fkey" FOREIGN KEY ("tier_id") REFERENCES "loyalty_tier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_redemption" ADD CONSTRAINT "loyalty_redemption_granted_by_user_id_fkey" FOREIGN KEY ("granted_by_user_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loyalty_redemption" ADD CONSTRAINT "loyalty_redemption_revoked_by_user_id_fkey" FOREIGN KEY ("revoked_by_user_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment" ADD CONSTRAINT "appointment_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment" ADD CONSTRAINT "appointment_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment" ADD CONSTRAINT "appointment_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment" ADD CONSTRAINT "appointment_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "zone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment" ADD CONSTRAINT "appointment_resource_id_fkey" FOREIGN KEY ("resource_id") REFERENCES "resource"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment" ADD CONSTRAINT "appointment_previous_appointment_id_fkey" FOREIGN KEY ("previous_appointment_id") REFERENCES "appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment" ADD CONSTRAINT "appointment_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_item" ADD CONSTRAINT "appointment_item_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_item" ADD CONSTRAINT "appointment_item_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_item" ADD CONSTRAINT "appointment_item_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_status_history" ADD CONSTRAINT "appointment_status_history_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_status_history" ADD CONSTRAINT "appointment_status_history_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointment_status_history" ADD CONSTRAINT "appointment_status_history_changed_by_user_id_fkey" FOREIGN KEY ("changed_by_user_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applied_discount" ADD CONSTRAINT "applied_discount_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applied_discount" ADD CONSTRAINT "applied_discount_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "applied_discount" ADD CONSTRAINT "applied_discount_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_photo" ADD CONSTRAINT "evidence_photo_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_photo" ADD CONSTRAINT "evidence_photo_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_photo" ADD CONSTRAINT "evidence_photo_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_photo" ADD CONSTRAINT "evidence_photo_vehicle_id_fkey" FOREIGN KEY ("vehicle_id") REFERENCES "vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_photo" ADD CONSTRAINT "evidence_photo_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_photo" ADD CONSTRAINT "evidence_photo_uploaded_by_customer_id_fkey" FOREIGN KEY ("uploaded_by_customer_id") REFERENCES "customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_photo" ADD CONSTRAINT "evidence_photo_soft_deleted_by_user_id_fkey" FOREIGN KEY ("soft_deleted_by_user_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_consent" ADD CONSTRAINT "evidence_consent_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_consent" ADD CONSTRAINT "evidence_consent_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "evidence_consent" ADD CONSTRAINT "evidence_consent_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment" ADD CONSTRAINT "payment_received_by_user_id_fkey" FOREIGN KEY ("received_by_user_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt" ADD CONSTRAINT "receipt_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipt" ADD CONSTRAINT "receipt_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification" ADD CONSTRAINT "notification_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "app_user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "app_user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_customer_id_fkey" FOREIGN KEY ("actor_customer_id") REFERENCES "customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_data_request" ADD CONSTRAINT "customer_data_request_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_data_request" ADD CONSTRAINT "customer_data_request_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
