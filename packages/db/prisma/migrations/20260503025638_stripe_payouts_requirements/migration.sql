-- AlterTable
ALTER TABLE "business" ADD COLUMN     "stripe_disabled_reason" TEXT,
ADD COLUMN     "stripe_payouts_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "stripe_requirements_due" TEXT[] DEFAULT ARRAY[]::TEXT[];
