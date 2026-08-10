-- Erhvervs-samlefaktura (Michael, 2026-08-10): batch-fakturering af
-- erhvervskunders "Udført"-ordrer i perioden 20.-19., automatisk, ingen
-- godkendelse. Egne felter (ikke dineroInvoiceGuid) fordi flere ordrer deler
-- samme faktura-guid her, hvilket dineroInvoiceGuid's @unique-indeks forbyder.
ALTER TABLE "Order" ADD COLUMN "businessBatchInvoiceGuid" TEXT;
ALTER TABLE "Order" ADD COLUMN "businessBatchInvoiceTimeStamp" TEXT;
ALTER TABLE "Order" ADD COLUMN "businessBatchInvoiceNumber" INTEGER;
ALTER TABLE "Order" ADD COLUMN "businessBatchInvoiceStatus" TEXT;
ALTER TABLE "Order" ADD COLUMN "businessBatchInvoicedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN "businessBatchError" TEXT;

CREATE INDEX "Order_businessBatchInvoiceGuid_idx" ON "Order"("businessBatchInvoiceGuid");
