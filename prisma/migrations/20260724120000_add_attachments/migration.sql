-- Vedhæftninger (billeder/videoer) på ordrer og abonnementer. Additiv: ny tabel
-- + nullable FK'er med ON DELETE CASCADE, så sletning af en ordre/et abonnement
-- rydder de tilhørende rækker (blob-objekterne GC'es separat). Ingen ændring af
-- eksisterende tabeller → sikkert for alle nuværende rækker.
CREATE TABLE "Attachment" (
    "id" SERIAL NOT NULL,
    "url" TEXT NOT NULL,
    "pathname" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "originalName" TEXT,
    "sort" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "orderId" INTEGER,
    "subscriptionId" INTEGER,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Attachment_orderId_idx" ON "Attachment"("orderId");

CREATE INDEX "Attachment_subscriptionId_idx" ON "Attachment"("subscriptionId");

ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "Subscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
