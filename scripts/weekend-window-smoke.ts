// Runnable smoke test for the PURE weekend auto-reply window (no DB, no email).
// Run with:  npx tsx scripts/weekend-window-smoke.ts
//
// Proves Europe/Copenhagen DST handling by testing across a CEST date (July,
// UTC+2) and a CET date (January, UTC+1): the same local wall-clock boundary
// must hold regardless of the offset, so the input UTC instants differ by an
// hour between the two seasons for the identical local time.
import assert from "node:assert";
import { isWithinWeekendWindow, buildWeekendAutoReply, firstName } from "../lib/weekend-autoreply";

let passed = 0;
function ok(name: string, cond: boolean) {
  assert.ok(cond, `FAIL: ${name}`);
  passed++;
  console.log(`  ✓ ${name}`);
}

// Helper: a UTC instant that corresponds to the given Copenhagen wall-clock.
// CEST (summer) = UTC+2, CET (winter) = UTC+1.
const cest = (localISO: string) => new Date(`${localISO}+02:00`);
const cet = (localISO: string) => new Date(`${localISO}+01:00`);

// --- CEST (July 2026): Fri 2026-07-17, Sat 18, Sun 19, Mon 20, Wed 22 ---
console.log("CEST (summer, UTC+2):");
ok("Fri 15:59 → outside", isWithinWeekendWindow(cest("2026-07-17T15:59:00")) === false);
ok("Fri 16:00 → inside", isWithinWeekendWindow(cest("2026-07-17T16:00:00")) === true);
ok("Sat midday → inside", isWithinWeekendWindow(cest("2026-07-18T12:00:00")) === true);
ok("Sun midday → inside", isWithinWeekendWindow(cest("2026-07-19T12:00:00")) === true);
ok("Mon 07:59 → inside", isWithinWeekendWindow(cest("2026-07-20T07:59:00")) === true);
ok("Mon 08:00 → outside", isWithinWeekendWindow(cest("2026-07-20T08:00:00")) === false);
ok("Wed midday → outside", isWithinWeekendWindow(cest("2026-07-22T12:00:00")) === false);

// --- CET (January 2026): Fri 2026-01-16, Sat 17, Sun 18, Mon 19, Wed 21 ---
console.log("CET (winter, UTC+1):");
ok("Fri 15:59 → outside", isWithinWeekendWindow(cet("2026-01-16T15:59:00")) === false);
ok("Fri 16:00 → inside", isWithinWeekendWindow(cet("2026-01-16T16:00:00")) === true);
ok("Sat midday → inside", isWithinWeekendWindow(cet("2026-01-17T12:00:00")) === true);
ok("Sun midday → inside", isWithinWeekendWindow(cet("2026-01-18T12:00:00")) === true);
ok("Mon 07:59 → inside", isWithinWeekendWindow(cet("2026-01-19T07:59:00")) === true);
ok("Mon 08:00 → outside", isWithinWeekendWindow(cet("2026-01-19T08:00:00")) === false);
ok("Wed midday → outside", isWithinWeekendWindow(cet("2026-01-21T12:00:00")) === false);

// --- DST proof: the SAME UTC instant maps to different local hours per season.
// 14:30 UTC is 16:30 CEST (inside Fri) but 15:30 CET (outside Fri).
console.log("DST offset proof:");
ok("Fri 14:30 UTC = 16:30 CEST → inside", isWithinWeekendWindow(new Date("2026-07-17T14:30:00Z")) === true);
ok("Fri 14:30 UTC = 15:30 CET → outside", isWithinWeekendWindow(new Date("2026-01-16T14:30:00Z")) === false);

// --- Copy / name derivation ---
console.log("copy + firstName:");
ok("firstName from full name", firstName("Anders Berg Hansen") === "Anders");
ok("firstName empty → null", firstName("   ") === null);
{
  const r = buildWeekendAutoReply("Anders Berg");
  ok("greeting uses first name", r.text.startsWith("Hej Anders,"));
  ok("subject verbatim", r.subject === "Tak - vi er tilbage mandag, klar til at gøre dig til en heldig kartoffel");
}
{
  const r = buildWeekendAutoReply(null);
  ok("no name → bare greeting", r.text.startsWith("Hej,"));
}

console.log(`\nAll ${passed} assertions passed ✅`);
