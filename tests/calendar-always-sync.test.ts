import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { diffWeekAgainstDays } from "../lib/calendar-consistency";
import type { CalendarWeek, DayProgram, CalEvent, DayStop } from "../lib/calendar";

const root = new URL("../", import.meta.url);
const source = (path: string) => readFile(new URL(path, root), "utf8");

// "Dagskalenderen skal ALTID være synkron med den overordnede kalender":
// invarianten håndhæves i tre lag — (1) disse tests i CI, (2) tripwiren i
// buildWeekPlan ved hver beregning, (3) det natlige produktions-tjek med
// alarm. Her testes den RENE sammenligner: den skal fange hver afvigelsestype.

const ev = (id: number, day: number, start = 8, end = 9): CalEvent => ({
  id, day, start, end, postal: "8700", customer: `Kunde ${id}`, category: "Andet",
  status: "afventer", type: "manuel", lock: "frigjort", employeeId: 7,
  contactId: 1, subscriptionNo: null, phone: null,
});
const stop = (id: number, from = "08:00", to = "09:00"): DayStop => ({
  from, to, address: "Vej 1", customer: `Kunde ${id}`, price: 100, employee: "E",
  source: "Manuel ordre", orderId: id, contactId: 1, subscriptionNo: null,
  phone: null, status: "Afventer levering", tasks: [], comment: "", addressNote: "",
});
function week(events: CalEvent[], unplannedIds: number[] = [], revenue = [100, 0, 0, 0, 0, 0, 0]): CalendarWeek {
  return {
    weekNo: 35, weekLabel: "Aug. 2026", monday: "2026-08-24", employees: [],
    days: Array.from({ length: 7 }, (_, i) => ({ label: "man", date: String(24 + i), revenue: revenue[i] })),
    events,
    unplanned: unplannedIds.map((id) => ({ id, postal: "8700", customer: `Kunde ${id}`, category: "Andet", status: "afventer" as const, contactId: 1, subscriptionNo: null, phone: null, reason: "unassigned" as const })),
    planned: { weekLabel: "Uge 35", week: 100, monthLabel: "August", month: 100 },
  };
}
function day(stops: DayStop[], unplannedIds: number[] = [], revenueDay = stops.reduce((a, s) => a + s.price, 0)): DayProgram {
  return {
    heading: "", relative: "", dateISO: "", weekMonday: "2026-08-24", prevISO: "", nextISO: "",
    revenueDay, revenueWeek: 100, revenueMonth: 100, driving: "0 t 0 min",
    stops,
    unplanned: unplannedIds.map((id) => ({ address: "Vej 1", customer: `Kunde ${id}`, price: 100, employee: "Ingen", source: "Manuel ordre", orderId: id, contactId: 1, subscriptionNo: null, phone: null, status: "Afventer levering", tasks: [], comment: "", addressNote: "", reason: "Ikke tildelt en kollega" })),
  };
}
const emptyDays = (d0: DayProgram) => [d0, ...Array.from({ length: 6 }, () => day([], [], 0))];

test("synkron uge giver nul problemer", () => {
  const problems = diffWeekAgainstDays(week([ev(1, 0)]), emptyDays(day([stop(1)])), [1]);
  assert.deepEqual(problems, []);
});

test("en ordre i databasen, som ingen visning viser, fanges som 'usynlig'", () => {
  const problems = diffWeekAgainstDays(week([ev(1, 0)]), emptyDays(day([stop(1)])), [1, 2]);
  assert.ok(problems.some((p) => p.kind === "usynlig" && p.detail.includes("2")));
});

test("en ordre vist både planlagt og som unplanned fanges som 'dublet'", () => {
  const problems = diffWeekAgainstDays(week([ev(1, 0)], [1]), emptyDays(day([stop(1)], [1])), [1]);
  assert.ok(problems.some((p) => p.kind === "dublet"));
});

test("dagsprogram der afviger fra ugekolonnen (id eller klokkeslæt) fanges som 'dag-afvigelse'", () => {
  // Forkert klokkeslæt i dagsprogrammet:
  const wrongTime = diffWeekAgainstDays(week([ev(1, 0)]), emptyDays(day([stop(1, "10:00", "11:00")])), [1]);
  assert.ok(wrongTime.some((p) => p.kind === "dag-afvigelse"));
  // Ordren ligger på en anden dag i dagsprogrammet end i ugen:
  const wrongDay = diffWeekAgainstDays(week([ev(1, 1)], [], [0, 100, 0, 0, 0, 0, 0]), emptyDays(day([stop(1)])), [1]);
  assert.ok(wrongDay.some((p) => p.kind === "dag-afvigelse"));
});

test("unplanned-sektionerne skal dække ugens 'Ikke planlagt'-liste præcist", () => {
  const problems = diffWeekAgainstDays(week([], [5], [0, 0, 0, 0, 0, 0, 0]), emptyDays(day([], [], 0)), [5]);
  assert.ok(problems.some((p) => p.kind === "unplanned-afvigelse"));
});

test("omsætnings-/kørselsafvigelser mellem visningerne fanges", () => {
  const problems = diffWeekAgainstDays(week([ev(1, 0)]), emptyDays(day([stop(1)], [], 999)), [1]);
  assert.ok(problems.some((p) => p.kind === "omsaetning"));
});

// --- Lagene omkring sammenligneren ---

test("tripwiren i buildWeekPlan logger ethvert invariant-brud ved hver beregning", async () => {
  const queries = await source("lib/queries.ts");
  assert.match(queries, /\[kalender-invariant\]/);
  assert.match(queries, /const invisible = jobs\.filter\(\(j\) => !placedIds\.has\(j\.id\) && !unplannedIds\.has\(j\.id\)\)/);
  assert.match(queries, /const doubled = jobs\.filter\(\(j\) => placedIds\.has\(j\.id\) && unplannedIds\.has\(j\.id\)\)/);
});

test("det natlige produktions-tjek kører som cron med CRON_SECRET og alarm-mail", async () => {
  const route = await source("app/api/calendar-consistency/route.ts");
  assert.match(route, /checkWeekConsistency/);
  assert.match(route, /CRON_SECRET/);
  assert.match(route, /sendEmail/);
  assert.match(route, /console\.error\(`\[kalender-konsistens\]/);
  const vercel = await source("vercel.json");
  assert.match(vercel, /"\/api\/calendar-consistency"/);
});

test("udvikler-scriptet bruger SAMME kerne som produktions-tjekket (ingen drift)", async () => {
  const script = await source("scripts/calendar-daycal-consistency-check.ts");
  assert.match(script, /checkWeekConsistency/);
  assert.doesNotMatch(script, /fmtTime/); // den gamle duplikerede sammenligning er væk
});
