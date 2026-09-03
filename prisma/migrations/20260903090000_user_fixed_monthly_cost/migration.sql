-- Faste udgifter pr. medarbejder (Thomas, 2026-09-03): additiv nullable kolonne.
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "fixedMonthlyCost" INTEGER;
