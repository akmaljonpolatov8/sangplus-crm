-- AlterTable
ALTER TABLE "SmsLog"
ADD COLUMN "month" DATE,
ADD COLUMN "provider" TEXT,
ADD COLUMN "externalId" TEXT,
ADD COLUMN "errorMessage" TEXT;

-- Backfill month for existing rows from sentAt
UPDATE "SmsLog"
SET "month" = DATE_TRUNC('month', "sentAt")::date
WHERE "month" IS NULL;

-- Make month required after backfill
ALTER TABLE "SmsLog"
ALTER COLUMN "month" SET NOT NULL;

-- CreateIndex
CREATE INDEX "SmsLog_studentId_month_idx" ON "SmsLog"("studentId", "month");
