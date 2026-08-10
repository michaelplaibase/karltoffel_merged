-- Faktisk afslutningstidspunkt pr. ordre — grundlaget for at rykke resten af
-- medarbejderens dag frem, når en opgave afsluttes hurtigere end planlagt.
ALTER TABLE "Order" ADD COLUMN "completedAt" TIMESTAMP(3);
