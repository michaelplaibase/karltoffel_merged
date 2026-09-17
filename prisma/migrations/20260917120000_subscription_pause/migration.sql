-- Pause-funktion for abonnementer (Thomas, 2026-09-17): sæt et abonnement på
-- pause indtil det genoptages manuelt. `paused=1` stopper ordre-genereringen
-- og rydder kommende ulåste ordrer; `active` forbliver true så abonnementet
-- stadig vises (med pausemarkering) og kan genoptages fra listene.
ALTER TABLE "Subscription" ADD COLUMN "paused" BOOLEAN NOT NULL DEFAULT false;