-- CreateEnum
CREATE TYPE "deposit_status" AS ENUM ('pending', 'awaiting_zelle', 'paid');

-- CreateEnum
CREATE TYPE "balance_status" AS ENUM ('unpaid', 'paid');

-- AlterEnum
ALTER TYPE "appointment_status" ADD VALUE 'awaiting_zelle';

-- AlterTable
ALTER TABLE "appointment" ADD COLUMN     "balance_method" "payment_method",
ADD COLUMN     "balance_paid_at" TIMESTAMPTZ,
ADD COLUMN     "balance_status" "balance_status" NOT NULL DEFAULT 'unpaid',
ADD COLUMN     "deposit_method" "payment_method",
ADD COLUMN     "deposit_status" "deposit_status" NOT NULL DEFAULT 'pending';
