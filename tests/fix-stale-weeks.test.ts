import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// Data-fix (Thomas, 2026-09-07): "Ret manglende ordrer"-knap + fixStaleFutureWeeks.
// Fixer årstal-bump-bug-følgerne: aktive abonnementer med startWeek-ÅR > indeværende
// år OG nul kommende ordrer får startugen rykket til nu + ordrer genereret.

const root = new URL("../", import.meta.url);
const src = (p: string) => readFile(new URL(p, root), "utf8");

test("fixStaleFutureWeeks: admin-only, årstal-krav, fremtids-guard, regenererer og rapporterer", async () => {
  const a = await src("app/actions/fix-stale-weeks.ts");
  // Admin-only (samme mønster som cleanup-descriptions).
  assert.match(a, /getSessionUser/);
  assert.match(a, /user\?\.isAdmin/);
  // Rører KUN startuger med eksplicit år > indeværende år.
  assert.match(a, /parts\?\.year \|\| parts\.year <= currentYear\) continue/);
  // Legitime sæsonstarter (inden for horisonten, har kommende ordrer) er tavse.
  assert.match(a, /anchorMs <= horizonEndMs\) continue/);
  assert.match(a, /futureCount > 0\) continue/);
  // Rykker startugen + nulstiller opgave-uger og regenererer ordrer.
  assert.match(a, /startWeek: nowLabel, nextWeek: nowLabel/);
  assert.match(a, /generateForSubscriptionId\(sub\.id\)/);
  // Idempotent rapport: per-abo detaljer.
  assert.match(a, /details\.push\(`Abo\. \$\{sub\.displayNo\}/);
});

test("knappen er monteret på Abonnementer-siden ved siden af Generér", async () => {
  const page = await src("app/subscriptions/page.tsx");
  assert.match(page, /FixStaleWeeksButton/);
  const btn = await src("components/FixStaleWeeksButton.tsx");
  assert.match(btn, /useActionState/);
  assert.match(btn, /fixStaleFutureWeeks/);
});
