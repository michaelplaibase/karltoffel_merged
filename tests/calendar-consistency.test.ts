import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stopInstant, isoWeek } from "../lib/planner";

const root = new URL("../", import.meta.url);
const source = (path: string) => readFile(new URL(path, root), "utf8");

// --- Ren enhedstest: persisteret tidspunkt afledes af ugens mandag + dag + startminutter ---

test("stopInstant giver ordredagens starttid (ikke mandag 10:00)", () => {
  // Uge 2026-I: mandag 2026-08-24. Torsdag = weekday 3, start 09:30.
  const d = stopInstant("2026-08-24", 3, 9 * 60 + 30);
  assert.equal(d.toISOString(), "2026-08-27T09:30:00.000Z");
  // Stadig inden for samme uge (aldrig næste mandag).
  assert.ok(d.getTime() < Date.parse("2026-08-31T00:00:00Z"));
});

test("stopInstant håndterer søndag og midnat-grænser uden uge-forskydning", () => {
  assert.equal(stopInstant("2026-08-24", 0, 0).toISOString(), "2026-08-24T00:00:00.000Z");
  assert.equal(stopInstant("2026-08-24", 6, 23 * 60).toISOString(), "2026-08-30T23:00:00.000Z");
  // ISO-ugen for den persisterede torsdag matcher ugens mandag.
  assert.equal(isoWeek("2026-08-24"), isoWeek("2026-08-27"));
});

// --- Konsistens: /calendar og /daycalendar deler ÉN beregningspipeline ---

test("/calendar bruger samme ordre-baserede pipeline som /daycalendar (buildWeekPlan)", async () => {
  const page = await source("app/calendar/page.tsx");
  assert.match(page, /getCalendarMonth,\s*getCalendarWeek\s*}\s*from\s*"@\/lib\/queries"/);
  assert.doesNotMatch(page, /subscription-preview-calendar/);
});

test("natlig plan-cron bruger kalender-pipelinen og persister dag/tid/medarbejder", async () => {
  const route = await source("app/api/plan/route.ts");
  assert.match(route, /planAndPersistWeek/);
  assert.doesNotMatch(route, /getPlannerJobs|planWeek\(/);

  const queries = await source("lib/queries.ts");
  assert.match(queries, /plannedAt:\s*stopInstant\(weekMonday,\s*d\.weekday,\s*s\.startMin\)/);
  assert.match(queries, /employeeId:\s*d\.employeeId/);
});

// --- Tidszone-konsistens (efter PR #22): alle "i dag/måned"-faldbacker i Europe/Copenhagen ---

test("kalender-faldbacker bruger todayCphISO, ikke UTC 'now'", async () => {
  const queries = await source("lib/queries.ts");
  assert.match(queries, /const \[y, m\] = todayCphISO\(\)\.split\("-"\)\.map\(Number\);/);

  const preview = await source("lib/subscription-preview-calendar.ts");
  assert.match(preview, /const today = todayCphISO\(\)/);
  assert.match(preview, /todayCphISO\(\)\.split\("-"\)\.map\(Number\)/);

  const page = await source("app/calendar/page.tsx");
  assert.match(page, /todayCphISO\(\)\.slice\(0, 7\)/);
});
