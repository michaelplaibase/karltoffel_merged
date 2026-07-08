-- Append-only tidslinje for kunderejsen: system-hændelser + medarbejder-noter,
-- hængt på lead og/eller kontakt (begge valgfri), så forløbet overlever
-- konverteringen fra emne til kunde. meta = JSON-blob (text), som Lead.payload.

-- CreateTable
CREATE TABLE "LeadEvent" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "leadId" INTEGER,
    "contactId" INTEGER,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "meta" TEXT,
    "authorId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LeadEvent_leadId_createdAt_idx" ON "LeadEvent"("leadId", "createdAt");

-- CreateIndex
CREATE INDEX "LeadEvent_contactId_createdAt_idx" ON "LeadEvent"("contactId", "createdAt");

-- CreateIndex
CREATE INDEX "LeadEvent_companyId_createdAt_idx" ON "LeadEvent"("companyId", "createdAt");

-- AddForeignKey
ALTER TABLE "LeadEvent" ADD CONSTRAINT "LeadEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadEvent" ADD CONSTRAINT "LeadEvent_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadEvent" ADD CONSTRAINT "LeadEvent_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LeadEvent" ADD CONSTRAINT "LeadEvent_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
