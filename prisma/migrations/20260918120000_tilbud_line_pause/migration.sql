-- Sæsonpause pr. opgavelinje på et tilbud (Thomas, 2026-09-18): markér en
-- enkelt opgave på tilbuddet som "på pause" i et vindue (31/10 → 30/03 osv.).
-- SAMME felter som abonnementets TaskLine (pauseActive/pauseStart/pauseEnd/
-- pauseYearly), så tilbuds-årshjulet kan udelade pausebesøg (via den delte
-- lib/pause.ts) og pausen følger opgaven over ved konvertering til abonnement.
-- pauseActive=1 stopper, at opgaven får besøg i vinduet; pauseYearly=true
-- gentager hvert år (kun måned/dag), false = kun denne sæson (absolutte datoer).
ALTER TABLE "TilbudLine" ADD COLUMN IF NOT EXISTS "pauseActive" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "TilbudLine" ADD COLUMN IF NOT EXISTS "pauseStart" TEXT;
ALTER TABLE "TilbudLine" ADD COLUMN IF NOT EXISTS "pauseEnd" TEXT;
ALTER TABLE "TilbudLine" ADD COLUMN IF NOT EXISTS "pauseYearly" BOOLEAN NOT NULL DEFAULT true;