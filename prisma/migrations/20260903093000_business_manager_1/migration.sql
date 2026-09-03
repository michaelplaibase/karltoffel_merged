-- Business Manager 1.0 (Thomas, 2026-09-03): biler, maskiner og budget.
CREATE TABLE IF NOT EXISTS "Vehicle" (
  "id" SERIAL PRIMARY KEY,
  "companyId" INTEGER NOT NULL REFERENCES "Company"("id"),
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "leaseMonthly" INTEGER NOT NULL DEFAULT 0,
  "insuranceMonthly" INTEGER NOT NULL DEFAULT 0,
  "fuelMonthly" INTEGER NOT NULL DEFAULT 0,
  "serviceMonthly" INTEGER NOT NULL DEFAULT 0,
  "otherMonthly" INTEGER NOT NULL DEFAULT 0,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "Vehicle_companyId_idx" ON "Vehicle"("companyId");

CREATE TABLE IF NOT EXISTS "Machine" (
  "id" SERIAL PRIMARY KEY,
  "companyId" INTEGER NOT NULL REFERENCES "Company"("id"),
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "purchasePrice" INTEGER NOT NULL DEFAULT 0,
  "lifetimeYears" INTEGER NOT NULL DEFAULT 0,
  "serviceMonthly" INTEGER NOT NULL DEFAULT 0,
  "otherMonthly" INTEGER NOT NULL DEFAULT 0,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "Machine_companyId_idx" ON "Machine"("companyId");

CREATE TABLE IF NOT EXISTS "Budget" (
  "id" SERIAL PRIMARY KEY,
  "companyId" INTEGER NOT NULL REFERENCES "Company"("id"),
  "year" INTEGER NOT NULL,
  "month" INTEGER NOT NULL,
  "revenueBudget" INTEGER NOT NULL DEFAULT 0,
  "costBudget" INTEGER NOT NULL DEFAULT 0,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Budget_companyId_year_month_key" UNIQUE ("companyId","year","month")
);
CREATE INDEX IF NOT EXISTS "Budget_companyId_idx" ON "Budget"("companyId");
