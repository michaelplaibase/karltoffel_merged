-- Data-fix (Thomas, 2026-09-03): Ejelauget for Arthus Andersens Gård
-- (kundenr. 201615, cs@horsensboligudlejning.dk) skal på faktureringsreglen
-- KVARTAL. Idempotent + backup-table så rollback er mulig.
CREATE TABLE IF NOT EXISTS "Contact_invoiceFrequency_backup_20260903" AS
  SELECT id, name, "invoiceFrequency" FROM "Contact" WHERE id = 201615;
UPDATE "Contact"
  SET "invoiceFrequency" = 'kvartal'
  WHERE id = 201615 AND ("invoiceFrequency" IS NULL OR "invoiceFrequency" = '' OR "invoiceFrequency" <> 'kvartal');
