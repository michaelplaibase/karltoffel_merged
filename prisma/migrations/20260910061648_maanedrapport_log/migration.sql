-- Månedrapport dobbelt-send-værn (Thomas 2026-09-09): én rapport pr. kunde pr. måned.
CREATE TABLE IF NOT EXISTS "MonthlyReportLog" (
    "id" SERIAL PRIMARY KEY,
    "contactId" INTEGER NOT NULL REFERENCES "Contact"(id),
    "period" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'sent'
);
CREATE UNIQUE INDEX IF NOT EXISTS "MonthlyReportLog_contactId_period_key" ON "MonthlyReportLog"("contactId", "period");
CREATE INDEX IF NOT EXISTS "MonthlyReportLog_period_idx" ON "MonthlyReportLog"("period");
