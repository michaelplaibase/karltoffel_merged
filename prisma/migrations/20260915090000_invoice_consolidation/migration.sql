-- Faktura-konsolidering (2026-09-15): én åben faktura pr. kunde + manuelle linjer.
CREATE TABLE "OpenInvoice" (
    "id" SERIAL NOT NULL,
    "contactId" INTEGER NOT NULL,
    "guid" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "OpenInvoice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "InvoiceManualLine" (
    "id" SERIAL NOT NULL,
    "openInvoiceId" INTEGER NOT NULL,
    "guid" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "priceInclVat" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceManualLine_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OpenInvoice_contactId_key" ON "OpenInvoice"("contactId");
CREATE UNIQUE INDEX "OpenInvoice_guid_key" ON "OpenInvoice"("guid");
CREATE INDEX "OpenInvoice_guid_idx" ON "OpenInvoice"("guid");

CREATE INDEX "InvoiceManualLine_openInvoiceId_idx" ON "InvoiceManualLine"("openInvoiceId");
CREATE INDEX "InvoiceManualLine_guid_idx" ON "InvoiceManualLine"("guid");

ALTER TABLE "OpenInvoice" ADD CONSTRAINT "OpenInvoice_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "Contact"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "InvoiceManualLine" ADD CONSTRAINT "InvoiceManualLine_openInvoiceId_fkey" FOREIGN KEY ("openInvoiceId") REFERENCES "OpenInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
