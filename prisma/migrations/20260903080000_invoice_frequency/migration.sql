-- Faktureringsregel pr. kunde (Thomas, 2026-09-03):
--   'pr_gang'  = faktura pr. gennemført opgave
--   'maaned'   = samlefaktura for måneden, sendes automatisk d. 20.
--   'kvartal'  = samlefaktura for kvartalet, sendes automatisk d. 20. i måneden
--                EFTER kvartalets udløb (jan/apr/jul/okt).
-- ''/NULL = automatisk: afled af isCompany (erhverv → maaned, privat → pr_gang).
-- Idempotent.
ALTER TABLE "Contact" ADD COLUMN IF NOT EXISTS "invoiceFrequency" TEXT NOT NULL DEFAULT '';
UPDATE "Contact" SET "invoiceFrequency" = '' WHERE "invoiceFrequency" IS NULL;
