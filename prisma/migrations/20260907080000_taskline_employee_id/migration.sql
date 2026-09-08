-- TaskLine.employeeId: per-opgave medarbejder-tilknytning (Thomas, 2026-09-07).
-- null = opgaven følger besøgets/abonnementets almindelige planlægning.
-- Idempotent: alle grene er guardede (IF NOT EXISTS / DO $$).
ALTER TABLE "TaskLine" ADD COLUMN IF NOT EXISTS "employeeId" INTEGER;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'TaskLine_employeeId_fkey'
  ) THEN
    ALTER TABLE "TaskLine" ADD CONSTRAINT "TaskLine_employeeId_fkey"
      FOREIGN KEY ("employeeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "TaskLine_employeeId_idx" ON "TaskLine"("employeeId");

-- Backup-reference (rollback mulig; kun første kørsel opretter den).
CREATE TABLE IF NOT EXISTS "TaskLine_employeeId_backup" AS
  SELECT id, "employeeId" FROM "TaskLine" WHERE false; -- tom: kolonnen er netop tilføjet
