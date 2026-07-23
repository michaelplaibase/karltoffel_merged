-- Dinero (Visma) invoicing integration.
--
-- Contact: a Dinero contact guid (set on first invoice; @unique guards against
-- creating the same Dinero contact twice). Nullable → existing rows stay NULL,
-- and Postgres allows many NULLs under a unique index.
ALTER TABLE "Contact" ADD COLUMN "dineroContactGuid" TEXT;
CREATE UNIQUE INDEX "Contact_dineroContactGuid_key" ON "Contact"("dineroContactGuid");

-- Order: the "Afslut ordre" invoice decision + the Dinero invoice/payment
-- bookkeeping. dineroInvoiceGuid @unique is the DB-level double-invoicing guard.
-- All nullable → safe for every existing row (no backfill).
ALTER TABLE "Order" ADD COLUMN "invoiceDecision" TEXT;
ALTER TABLE "Order" ADD COLUMN "dineroInvoiceGuid" TEXT;
ALTER TABLE "Order" ADD COLUMN "dineroInvoiceTimeStamp" TEXT;
ALTER TABLE "Order" ADD COLUMN "dineroInvoiceNumber" INTEGER;
ALTER TABLE "Order" ADD COLUMN "dineroInvoiceStatus" TEXT;
ALTER TABLE "Order" ADD COLUMN "dineroPaymentGuid" TEXT;
ALTER TABLE "Order" ADD COLUMN "dineroError" TEXT;
ALTER TABLE "Order" ADD COLUMN "invoicedAt" TIMESTAMP(3);
CREATE UNIQUE INDEX "Order_dineroInvoiceGuid_key" ON "Order"("dineroInvoiceGuid");

-- DineroConnection: one row per Company (single-tenant). Holds the Visma Connect
-- OAuth result — chosen organization + rotating (encrypted) tokens + the two
-- chart-of-accounts numbers invoices/payments post to.
CREATE TABLE "DineroConnection" (
    "id" SERIAL NOT NULL,
    "companyId" INTEGER NOT NULL,
    "organizationId" TEXT NOT NULL,
    "orgName" TEXT,
    "isPro" BOOLEAN NOT NULL DEFAULT false,
    "refreshTokenEnc" TEXT NOT NULL,
    "accessToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "scopes" TEXT,
    "salesAccountNumber" INTEGER NOT NULL DEFAULT 1000,
    "cashAccountNumber" INTEGER NOT NULL DEFAULT 55040,
    "status" TEXT NOT NULL DEFAULT 'connected',
    "connectedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DineroConnection_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DineroConnection_companyId_key" ON "DineroConnection"("companyId");

ALTER TABLE "DineroConnection" ADD CONSTRAINT "DineroConnection_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
