-- Data fix: abonnement #8723 (displayNo) skal IKKE vaere laast til en fast ugedag.
-- Thomas 2026-09-03: jobbet skal kunne planlaegges frit mellem alle andre opgaver.
-- Idempotent: no-op hvis fixedWeekdays allerede er NULL.
-- Rollback: gendan den tidligere vaerdi i tabellen "Subscription_abo8723_backup".

-- 1) Backup gammel vaerdi (kun foerste koersel; senere koersler no-ops)
CREATE TABLE IF NOT EXISTS "Subscription_abo8723_backup" AS
SELECT "id", "displayNo", "fixedWeekdays" FROM "Subscription" WHERE "displayNo" = 8723;

-- 2) Ryd den faste ugedag
UPDATE "Subscription"
SET "fixedWeekdays" = NULL
WHERE "displayNo" = 8723 AND "fixedWeekdays" IS NOT NULL;
