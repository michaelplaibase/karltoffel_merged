-- Fraværsregistrering: sygdom (én dag, gælder straks) og ferie (ansøgning
-- med godkendelse). Idempotent: tabel oprettes kun hvis den ikke findes.
CREATE TABLE IF NOT EXISTS "Absence" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "type" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "decidedBy" INTEGER,
    "decidedAt" TIMESTAMP(3),
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Absence_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Absence_userId_type_date_key'
    ) THEN
        ALTER TABLE "Absence" ADD CONSTRAINT "Absence_userId_type_date_key" UNIQUE ("userId", "type", "date");
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "Absence_userId_idx" ON "Absence"("userId");
CREATE INDEX IF NOT EXISTS "Absence_date_idx" ON "Absence"("date");

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'Absence_userId_fkey'
    ) THEN
        ALTER TABLE "Absence" ADD CONSTRAINT "Absence_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;
