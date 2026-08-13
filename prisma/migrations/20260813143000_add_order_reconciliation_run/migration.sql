CREATE TABLE "OrderReconciliationRun" (
  "id" TEXT NOT NULL,
  "snapshotHash" TEXT NOT NULL,
  "planHash" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'applied',
  "snapshot" TEXT NOT NULL,
  "plan" TEXT NOT NULL,
  "createdOrderIds" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "rolledBackAt" TIMESTAMP(3),
  CONSTRAINT "OrderReconciliationRun_pkey" PRIMARY KEY ("id")
);
