import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// Data-fix (Thomas, 2026-09-07): "Ret manglende ordrer"-knap + delte kriterier
// med det selvhellende natvægn i lib/fix-stale-weeks.ts. Admin-guards bor i
// app/actions/fix-stale-weeks.ts; kriterier/repair bor i lib/.

const root = new URL("../", import.meta.url);
const src = (p: string) => readFile(new URL(p, root), "utf8");

test("lib/fix-stale-weeks: brudte-kriterier (fremtids-år / årløs passeret) + nul-kommende-filter", async () => {
  const a = await src("lib/fix-stale-weeks.ts");
  assert.match(a, /isFutureYear/);
  assert.match(a, /isPassedYearless/);
  assert.match(a, /futureBySub\.get\(s\.id\) \?\? 0\) === 0/);
  // 'Kommende ordrer' tæller kun inden for genereringens horisont (26 uger) —
  // ellers tæller 2027-ordre som dækning og reparationen springer over (Purhus).
  assert.match(a, /lt: horizonEnd/);
  assert.match(a, /startWeek: nowLabel, nextWeek: nowLabel/);
  assert.match(a, /generateForSubscriptionId\(sub\.id\)/);
  // Gamle fejlplacerede ordrer (2027) slettes før regenerering — ellers dubletter.
  assert.match(a, /lockedFully: false/);
  assert.match(a, /order\.deleteMany/);
});

test("knappen er admin-only og bruger det delte bibliotek", async () => {
  const actions = await src("app/actions/fix-stale-weeks.ts");
  assert.match(actions, /getSessionUser/);
  assert.match(actions, /user\?\.isAdmin/);
  assert.match(actions, /listStaleSubs/);
  assert.match(actions, /repairStaleSub/);
});

test("knappen er monteret på Abonnementer-siden ved siden af Generér", async () => {
  const page = await src("app/subscriptions/page.tsx");
  assert.match(page, /FixStaleWeeksButton/);
  const btn = await src("components/FixStaleWeeksButton.tsx");
  assert.match(btn, /useActionState/);
  assert.match(btn, /fixStaleFutureWeeks/);
});
