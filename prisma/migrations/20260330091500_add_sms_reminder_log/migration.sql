-- CreateTable
CREATE TABLE "SmsReminderLog" (
    "id" TEXT NOT NULL,
    "groupId" TEXT NOT NULL,
    "billingMonth" DATE NOT NULL,
    "studentId" TEXT NOT NULL,
    "studentName" TEXT NOT NULL,
    "parentPhone" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "externalId" TEXT,
    "errorMessage" TEXT,
    "sentById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SmsReminderLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SmsReminderLog_groupId_billingMonth_createdAt_idx" ON "SmsReminderLog"("groupId", "billingMonth", "createdAt");

-- CreateIndex
CREATE INDEX "SmsReminderLog_studentId_createdAt_idx" ON "SmsReminderLog"("studentId", "createdAt");

-- AddForeignKey
ALTER TABLE "SmsReminderLog" ADD CONSTRAINT "SmsReminderLog_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "Group"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsReminderLog" ADD CONSTRAINT "SmsReminderLog_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SmsReminderLog" ADD CONSTRAINT "SmsReminderLog_sentById_fkey" FOREIGN KEY ("sentById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
