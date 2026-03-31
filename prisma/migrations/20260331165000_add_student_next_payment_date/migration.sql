-- AddColumn
ALTER TABLE "Student" ADD COLUMN "nextPaymentDate" DATE;

-- CreateIndex
CREATE INDEX "Student_nextPaymentDate_idx" ON "Student"("nextPaymentDate");
