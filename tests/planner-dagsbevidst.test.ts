import test from "node:test";
import assert from "node:assert/strict";
import { planWeek, type Job, type Employee } from "../lib/planner";
import { parseWeekLabelParts } from "../lib/recurrence";

// Kirkevej/LOXAM-hændelsen (uge 35): tre besluttede regler —
// (1) DAGSBEVIDSTHED: nye placeringer kun fra og med i dag,
// (2) OVERARBEJDS-FALLBACK: fuld bunden medarbejder → dagen med færrest timer,
// (3) ÅRSTAL på uge-etiketter: "Uge 33, 2026" er det entydige format.

const emp = (id: number, workdays = [0, 1, 2, 3, 4]): Employee => ({
  id, name: `E${id}`, home: [55.86, 9.85] as unknown as Employee["home"],
  workStartMin: 480, workEndMin: 960, flexMin: 60, workdays,
});
const job = (id: number, durationMin: number, extra: Partial<Job> = {}): Job => ({
  id, contactId: id, customer: `K${id}`, address: `Vej ${id}, 8700 Horsens`, postal: "8700",
  category: "G", durationMin, source: "abo", fixedEmployeeId: 1, ...extra,
});

test("fromWeekday: nye placeringer lander aldrig på passerede dage", () => {
  const p = planWeek([job(1, 60)], "2026-08-24", [emp(1)], { fromWeekday: 2 });
  assert.equal(p.days.find((d) => d.stops.length)?.weekday, 2);
});

test("låste/udførte ordrer beholder deres fortidige dag trods fromWeekday", () => {
  const p = planWeek([job(1, 60, { locked: true, lockedWeekday: 0 })], "2026-08-24", [emp(1)], { fromWeekday: 2 });
  assert.equal(p.days.find((d) => d.stops.length)?.weekday, 0);
});

test("overarbejds-fallback vælger den bundne medarbejders dag med FÆRREST minutter", () => {
  // Mandag fyldes af en låst 500-min ordre; tirsdag-fredag er tomme. Et job,
  // der ikke kan nå ind i mandagens rest, skal lande tirsdag (færrest minutter,
  // laveste ugedag ved lighed) — aldrig i "Ikke planlagt".
  const p = planWeek([
    job(1, 500, { locked: true, lockedWeekday: 0 }),
    ...Array.from({ length: 4 }, (_, i) => job(10 + i, 500)),
    job(99, 200),
  ], "2026-08-24", [emp(1)]);
  assert.equal(p.unplanned.length, 0);
  const ot = p.days.flatMap((d) => d.stops.map((s) => ({ s, weekday: d.weekday }))).filter((x) => x.s.overtime);
  assert.ok(ot.length >= 1, "mindst ét overarbejds-stop");
  for (const x of ot) assert.ok(x.s.job.fixedEmployeeId === 1);
});

test("fast ugedag uden tilbageværende arbejdsdag forbliver ærligt uplaceret", () => {
  const p = planWeek([job(1, 60, { fixedWeekdays: [0] })], "2026-08-24", [emp(1)], { fromWeekday: 2 });
  assert.equal(p.unplanned.length, 1);
});

test("ubunden ordre (ingen fixedEmployeeId) får aldrig overarbejds-fallback", () => {
  // buildWeekPlan sender kun bundne ordrer til ruteren, men planWeek må ikke
  // selv opfinde en tildeling: uden binding og uden plads → unplanned.
  const p = planWeek([job(1, 3000, { fixedEmployeeId: undefined })], "2026-08-24", [emp(1)]);
  assert.equal(p.unplanned.length, 1);
});

test("parseWeekLabelParts forstår årstemplede og årløse etiketter", () => {
  assert.deepEqual(parseWeekLabelParts("Uge 33, 2026"), { week: 33, year: 2026 });
  assert.deepEqual(parseWeekLabelParts("uge 33 2026"), { week: 33, year: 2026 });
  assert.deepEqual(parseWeekLabelParts("33, 2026"), { week: 33, year: 2026 });
  assert.deepEqual(parseWeekLabelParts("Uge 33"), { week: 33, year: null });
  assert.deepEqual(parseWeekLabelParts("33"), { week: 33, year: null });
  assert.equal(parseWeekLabelParts("Uge 54, 2026"), null);
  assert.equal(parseWeekLabelParts("Uge 33, 1999"), null);
  assert.equal(parseWeekLabelParts(null), null);
});

test("buildWeekPlan er dagsbevidst og pinner udførte ordrer (kildetjek)", async () => {
  const { readFile } = await import("node:fs/promises");
  const queries = await readFile(new URL("../lib/queries.ts", import.meta.url), "utf8");
  assert.match(queries, /planWeek\(placeable, weekMonday, plannerEmps, \{ fromWeekday: todayIdx \?\? 0 \}\)/);
  assert.match(queries, /locked: o\.lockedFully \|\| o\.status !== "Afventer levering"/);
  assert.match(queries, /fixed_weekday_unavailable/);
});
