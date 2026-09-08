import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

// Selvhellende natvagt (Thomas, 2026-09-07: "systemet skal selv prøve at løse
// problemet først inden den sender mail"): calendar-consistency reparerer
// brudte startuger (fremtids-årstal / årløs passeret) FØR alarm vurderes,
// deler kriterier med knappen via lib/fix-stale-weeks.ts.

const root = new URL("../", import.meta.url);
const src = (p: string) => readFile(new URL(p, root), "utf8");

test("lib/fix-stale-weeks: kriterier — fremtids-årstal eller årløs passeret uge, nul kommende ordrer", async () => {
  const lib = await src("lib/fix-stale-weeks.ts");
  assert.match(lib, /isBrokenStartWeek/);
  assert.match(lib, /parts\.year > currentYear/);
  assert.match(lib, /!parts\.year && parts\.week < currentWeek/);
  assert.match(lib, /futureBySub\.get\(s\.id\) \?\? 0\) === 0/);
  assert.match(lib, /repairStaleSub/);
  assert.match(lib, /generateForSubscriptionId/);
});

test("natvagten reparerer FØR alarm — kun resterende tørre abonnementer mailes", async () => {
  const route = await src("app/api/calendar-consistency/route.ts");
  // Selvhelende blok findes og ligger FØR starvedSubs-vurderingen.
  const healIdx = route.indexOf("listStaleSubs");
  const alarmIdx = route.indexOf("const starvedSubs");
  assert.ok(healIdx !== -1, "selvhelende import/blok mangler");
  assert.ok(alarmIdx !== -1);
  assert.ok(healIdx < alarmIdx, "reparation skal ske FØR alarmvurderingen");
  assert.match(route, /repairStaleSub/);
  // Genindlæsning af tællinger efter reparation — vagten må ikke alarmere på gamle tal.
  assert.match(route, /freshFuture/);
});

test("knappen deler logik med vagten — ingen dublet-kriterier", async () => {
  const actions = await src("app/actions/fix-stale-weeks.ts");
  assert.match(actions, /from "@\/lib\/fix-stale-weeks"/);
  assert.match(actions, /listStaleSubs/);
  assert.match(actions, /repairStaleSub/);
});
