-- CreateTable
CREATE TABLE "GiftCardOrder" (
    "id" TEXT NOT NULL,
    "stripeSessionId" TEXT,
    "stripePaymentIntentId" TEXT,
    "amountMinor" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'dkk',
    "design" TEXT NOT NULL,
    "occasion" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "recipientName" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL,
    "buyerName" TEXT NOT NULL,
    "buyerEmail" TEXT NOT NULL,
    "buyerPhone" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'awaiting_payment',
    "code" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GiftCardOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "GiftCardOrder_stripeSessionId_key" ON "GiftCardOrder"("stripeSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "GiftCardOrder_code_key" ON "GiftCardOrder"("code");

-- CreateIndex
CREATE INDEX "GiftCardOrder_status_idx" ON "GiftCardOrder"("status");

-- CreateIndex
CREATE INDEX "GiftCardOrder_buyerEmail_idx" ON "GiftCardOrder"("buyerEmail");

