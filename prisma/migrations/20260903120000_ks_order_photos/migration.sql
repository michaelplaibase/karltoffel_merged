-- KS-fotos (Thomas 2026-09-03): kamera-billeder koblet på ordre + kunde.
CREATE TABLE IF NOT EXISTS "OrderPhoto" (
    "id" SERIAL PRIMARY KEY,
    "orderId" INTEGER NOT NULL REFERENCES "Order"(id),
    "contactId" INTEGER NOT NULL REFERENCES "Contact"(id),
    "uploadedById" INTEGER REFERENCES "User"(id),
    "url" TEXT NOT NULL,
    "pathname" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'ks',
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "OrderPhoto_orderId_idx" ON "OrderPhoto"("orderId");
CREATE INDEX IF NOT EXISTS "OrderPhoto_contactId_idx" ON "OrderPhoto"("contactId");
