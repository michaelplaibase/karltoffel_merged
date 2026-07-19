-- Add nullable clock start-time to Order. Nullable + no default → safe for all
-- existing rows (they stay NULL = legacy/date-only; no backfill required).
ALTER TABLE "Order" ADD COLUMN "startAt" TIMESTAMP(3);
