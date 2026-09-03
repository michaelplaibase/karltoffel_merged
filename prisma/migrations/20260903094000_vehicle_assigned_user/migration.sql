-- Bil-tilknytning (Thomas, 2026-09-03): en bils udgifter kan målrettes én
-- medarbejder (userId; null = fordelt ligeligt på alle aktive).
ALTER TABLE "Vehicle" ADD COLUMN IF NOT EXISTS "userId" INTEGER;
DO $$ BEGIN
  ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
