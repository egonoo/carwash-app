-- AlterTable
ALTER TABLE "business" ADD COLUMN     "stripe_charges_enabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "stripe_details_submitted" BOOLEAN NOT NULL DEFAULT false;
