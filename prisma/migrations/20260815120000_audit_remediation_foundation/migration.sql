-- Audit remediation, foundation schema (findings F1, F2, F3, F8, F15, F16).
-- Fully ADDITIVE: every column is nullable or carries a default, and no existing
-- column is dropped or retyped. Safe to apply to a live database ahead of the
-- application code that reads the new fields.

-- ---------------------------------------------------------------------------
-- F8 — session revocation. A token issued before "sessionsValidFrom" is rejected.
-- F15 — working hours become per-user data instead of three hardcoded constants.
-- F3  — cached geocode for the employee home address.
-- ---------------------------------------------------------------------------
ALTER TABLE "User"
  ADD COLUMN "sessionsValidFrom"   TIMESTAMP(3),
  ADD COLUMN "workStartMin"        INTEGER NOT NULL DEFAULT 480,
  ADD COLUMN "workEndMin"          INTEGER NOT NULL DEFAULT 1080,
  ADD COLUMN "flexMin"             INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "workdays"            TEXT    NOT NULL DEFAULT '01234',
  ADD COLUMN "homeLat"             DOUBLE PRECISION,
  ADD COLUMN "homeLon"             DOUBLE PRECISION,
  ADD COLUMN "homeGeocodedAt"      TIMESTAMP(3),
  ADD COLUMN "homeGeocodeProvider" TEXT;

-- ---------------------------------------------------------------------------
-- F3 — cached geocode for the delivery address, so routing stops re-geocoding
-- every address on every cold start.
-- ---------------------------------------------------------------------------
ALTER TABLE "Contact"
  ADD COLUMN "geoLat"          DOUBLE PRECISION,
  ADD COLUMN "geoLon"          DOUBLE PRECISION,
  ADD COLUMN "geocodedAt"      TIMESTAMP(3),
  ADD COLUMN "geocodeStatus"   TEXT,
  ADD COLUMN "geocodeProvider" TEXT;

-- ---------------------------------------------------------------------------
-- F16 — money in minor units, VAT-exclusive, rate stored alongside.
-- "price" (whole kroner incl. VAT) is deliberately retained until the backfill
-- has been reconciled against Dinero. See prisma/backfill-money.mjs.
-- ---------------------------------------------------------------------------
ALTER TABLE "TaskLine"
  ADD COLUMN "priceOere" INTEGER,
  ADD COLUMN "vatRateBp" INTEGER;

-- ---------------------------------------------------------------------------
-- F3 — shared travel-matrix cache, keyed by a hash of the normalised address
-- set so it survives across serverless instances.
-- ---------------------------------------------------------------------------
CREATE TABLE "TravelMatrixCache" (
  "id"             SERIAL       NOT NULL,
  "addressSetHash" TEXT         NOT NULL,
  "provider"       TEXT         NOT NULL,
  "addresses"      TEXT         NOT NULL,
  "durations"      TEXT         NOT NULL,
  "capturedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastUsedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TravelMatrixCache_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "TravelMatrixCache_addressSetHash_key" ON "TravelMatrixCache"("addressSetHash");
CREATE INDEX "TravelMatrixCache_capturedAt_idx" ON "TravelMatrixCache"("capturedAt");

-- ---------------------------------------------------------------------------
-- F1 — materialised route plan. Planning moves out of the request path; the
-- calendar page reads rows instead of replanning a 26-week horizon per view.
-- ---------------------------------------------------------------------------
CREATE TABLE "Calendar2PlanDay" (
  "id"         SERIAL       NOT NULL,
  "weekMonday" TIMESTAMP(3) NOT NULL,
  "employeeId" INTEGER      NOT NULL,
  "weekday"    INTEGER      NOT NULL,
  "plan"       TEXT         NOT NULL,
  "inputHash"  TEXT         NOT NULL,
  "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Calendar2PlanDay_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Calendar2PlanDay_weekMonday_employeeId_weekday_key" ON "Calendar2PlanDay"("weekMonday", "employeeId", "weekday");
CREATE INDEX "Calendar2PlanDay_weekMonday_idx" ON "Calendar2PlanDay"("weekMonday");

-- ---------------------------------------------------------------------------
-- F2 — capacity deficit per employee per week. This is the number that tells
-- the owner they are overbooked, which previously existed nowhere.
-- ---------------------------------------------------------------------------
CREATE TABLE "Calendar2WeekCapacity" (
  "id"             SERIAL       NOT NULL,
  "weekMonday"     TIMESTAMP(3) NOT NULL,
  "employeeId"     INTEGER      NOT NULL,
  "demandMin"      INTEGER      NOT NULL,
  "capacityMin"    INTEGER      NOT NULL,
  "deficitMin"     INTEGER      NOT NULL,
  "deferredVisits" INTEGER      NOT NULL,
  "computedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "Calendar2WeekCapacity_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Calendar2WeekCapacity_weekMonday_employeeId_key" ON "Calendar2WeekCapacity"("weekMonday", "employeeId");
CREATE INDEX "Calendar2WeekCapacity_weekMonday_idx" ON "Calendar2WeekCapacity"("weekMonday");

-- ---------------------------------------------------------------------------
-- F2 — visits that could not be placed inside the policy horizon. Replaces the
-- old contract in which capacity exhaustion could never be reported and work
-- silently slid into a future nobody was looking at.
-- ---------------------------------------------------------------------------
CREATE TABLE "Calendar2UnschedulableVisit" (
  "id"             SERIAL       NOT NULL,
  "subscriptionId" INTEGER      NOT NULL,
  "sourceWeek"     TIMESTAMP(3) NOT NULL,
  "employeeId"     INTEGER,
  "customer"       TEXT         NOT NULL,
  "address"        TEXT         NOT NULL,
  "minutes"        INTEGER      NOT NULL,
  "reason"         TEXT         NOT NULL,
  "detectedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt"     TIMESTAMP(3),
  CONSTRAINT "Calendar2UnschedulableVisit_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Calendar2UnschedulableVisit_subscriptionId_sourceWeek_key" ON "Calendar2UnschedulableVisit"("subscriptionId", "sourceWeek");
CREATE INDEX "Calendar2UnschedulableVisit_resolvedAt_idx" ON "Calendar2UnschedulableVisit"("resolvedAt");
