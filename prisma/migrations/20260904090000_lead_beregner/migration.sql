-- Lead-beregner (Thomas, 2026-09-03): erhvervelser af nye kunder + marketingforbrug.
CREATE TABLE IF NOT EXISTS "LeadAcquisition" (
  "id" SERIAL PRIMARY KEY,
  "companyId" INTEGER NOT NULL REFERENCES "Company"("id"),
  "contactId" INTEGER NOT NULL REFERENCES "Contact"("id"),
  "category" TEXT NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'Direkte',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeadAcquisition_contactId_category_key" UNIQUE ("contactId","category")
);
CREATE INDEX IF NOT EXISTS "LeadAcquisition_companyId_startedAt_idx" ON "LeadAcquisition"("companyId","startedAt");
CREATE INDEX IF NOT EXISTS "LeadAcquisition_companyId_source_idx" ON "LeadAcquisition"("companyId","source");

CREATE TABLE IF NOT EXISTS "MarketingSpend" (
  "id" SERIAL PRIMARY KEY,
  "companyId" INTEGER NOT NULL REFERENCES "Company"("id"),
  "channel" TEXT NOT NULL,
  "year" INTEGER NOT NULL,
  "month" INTEGER NOT NULL,
  "amount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "MarketingSpend_companyId_channel_year_month_key" UNIQUE ("companyId","channel","year","month")
);
CREATE INDEX IF NOT EXISTS "MarketingSpend_companyId_year_month_idx" ON "MarketingSpend"("companyId","year","month");
