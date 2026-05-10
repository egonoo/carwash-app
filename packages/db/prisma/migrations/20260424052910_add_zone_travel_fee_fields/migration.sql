-- AlterTable
ALTER TABLE "zone" ADD COLUMN     "extra_fee_cents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "travel_time_minutes" INTEGER;
