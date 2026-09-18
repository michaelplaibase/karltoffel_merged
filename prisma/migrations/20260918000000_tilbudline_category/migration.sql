-- Kategori pr. opgavelinje på et tilbud (Thomas, 2026-09-18): holdet kan vælge
-- en opgavekategori pr. linje (samme liste/farver som abonnements-opgaverne),
-- så konverteringen til abonnement mapper korrekt i stedet for altid "Andet".
-- Eksisterende linjer får "Andet" (det hidtidige konverterings-resultat).
-- Idempotent (ADD COLUMN IF NOT EXISTS), så migrationen kan køres igen sikkert.
ALTER TABLE "TilbudLine" ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT 'Andet';