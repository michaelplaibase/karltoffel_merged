-- Engangs-token til Ja/Måske/Nej-links i tilbudsmailen.
CREATE TABLE "QuoteToken" (
    "id" SERIAL NOT NULL,
    "token" TEXT NOT NULL,
    "leadId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "choice" TEXT,

    CONSTRAINT "QuoteToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "QuoteToken_token_key" ON "QuoteToken"("token");
CREATE INDEX "QuoteToken_leadId_idx" ON "QuoteToken"("leadId");

ALTER TABLE "QuoteToken" ADD CONSTRAINT "QuoteToken_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Idempotens-værn for "vi kommer i morgen"-påmindelsen: nullable, ingen backfill.
ALTER TABLE "Order" ADD COLUMN "reminderSentAt" TIMESTAMP(3);
