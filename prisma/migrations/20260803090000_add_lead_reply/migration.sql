-- AI-svarudkast paa leads, godkendt af et menneske i Slack foer afsendelse.
-- Additivt: kun en ny tabel med FK til Lead (ON DELETE CASCADE), ingen aendring
-- af eksisterende kolonner, saa alle nuvaerende raekker er uberoerte.
CREATE TABLE "LeadReply" (
    "id" SERIAL NOT NULL,
    "leadId" INTEGER NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "feedback" TEXT,
    "model" TEXT,
    "slackChannel" TEXT,
    "slackTs" TEXT,
    "approvedBy" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadReply_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "LeadReply_leadId_idx" ON "LeadReply"("leadId");

ALTER TABLE "LeadReply" ADD CONSTRAINT "LeadReply_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;
