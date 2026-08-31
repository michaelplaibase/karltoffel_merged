-- Ugedage på abonnements-opgaver: digit-streng "0"-"6" (0=mandag … 6=søndag).
-- null = ingen begrænsning (opgaven må køre alle ugedage).
ALTER TABLE "TaskLine" ADD COLUMN "weekdays" TEXT;
