-- AlterTable
ALTER TABLE "schedule_template"
  ADD COLUMN "kind" TEXT NOT NULL DEFAULT 'work';

-- CreateIndex
CREATE INDEX "idx_schedule_template_kind"
  ON "schedule_template"("business_id", "kind", "day_of_week");
