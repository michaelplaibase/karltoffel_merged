-- Tilbud-modul: tilbud + opgavelinjer + fotos (Thomas, 2026-09-11).
CREATE TABLE IF NOT EXISTS "Tilbud" (
    "id" SERIAL NOT NULL,
    "contactId" INTEGER NOT NULL,
    "title" TEXT NOT NULL DEFAULT 'Tilbud',
    "note" TEXT,
    "startWeek" TEXT,
    "baseInterval" TEXT,
    "status" TEXT NOT NULL DEFAULT 'udkast',
    "sentAt" TIMESTAMP(3),
    "sentTo" TEXT,
    "acceptToken" TEXT NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "acceptMethod" TEXT,
    "convertedSubscriptionId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Tilbud_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TilbudLine" (
    "id" SERIAL NOT NULL,
    "tilbudId" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "interval" TEXT,
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TilbudLine_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TilbudPhoto" (
    "id" SERIAL NOT NULL,
    "tilbudId" INTEGER NOT NULL,
    "lineId" INTEGER,
    "url" TEXT NOT NULL,
    "pathname" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TilbudPhoto_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "Tilbud_acceptToken_key" ON "Tilbud"("acceptToken");
CREATE INDEX IF NOT EXISTS "Tilbud_contactId_idx" ON "Tilbud"("contactId");
CREATE INDEX IF NOT EXISTS "TilbudLine_tilbudId_idx" ON "TilbudLine"("tilbudId");
CREATE INDEX IF NOT EXISTS "TilbudPhoto_tilbudId_idx" ON "TilbudPhoto"("tilbudId");
CREATE INDEX IF NOT EXISTS "TilbudPhoto_lineId_idx" ON "TilbudPhoto"("lineId");

DO $$ BEGIN
    ALTER TABLE "Tilbud" ADD CONSTRAINT "Tilbud_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
    ALTER TABLE "TilbudLine" ADD CONSTRAINT "TilbudLine_tilbudId_fkey" FOREIGN KEY ("tilbudId") REFERENCES "Tilbud"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;

-- Thomas, 2026-09-11 (korrektion 2): valgfri STARTUGE PR. OPGAVELINJE — samme
-- format som tilbud-niveau startuge ('Uge 29' / 'Uge 29, 2026'). Idempotent
-- (ADD COLUMN IF NOT EXISTS), så migrationen kan køre igen sikkert.
ALTER TABLE "TilbudLine" ADD COLUMN IF NOT EXISTS "startWeek" TEXT;
DO $$ BEGIN
    ALTER TABLE "TilbudPhoto" ADD CONSTRAINT "TilbudPhoto_tilbudId_fkey" FOREIGN KEY ("tilbudId") REFERENCES "Tilbud"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;
DO $$ BEGIN
    ALTER TABLE "TilbudPhoto" ADD CONSTRAINT "TilbudPhoto_lineId_fkey" FOREIGN KEY ("lineId") REFERENCES "TilbudLine"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN null; END $$;