-- Pakke-integration: gem hvilken tilbudsmotor-pakke kunden valgte + den tilbudte
-- md-pris på abonnementet. Additivt: kun nye nullable kolonner → sikkert for alle
-- eksisterende rækker (håndlavede abonnementer har simpelthen NULL).
ALTER TABLE "Subscription" ADD COLUMN "packageId" TEXT;
ALTER TABLE "Subscription" ADD COLUMN "packageName" TEXT;
ALTER TABLE "Subscription" ADD COLUMN "quotedMonthly" INTEGER;
