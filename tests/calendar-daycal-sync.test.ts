import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { planWeek, type Job, type Employee } from "../lib/planner";

const root = new URL("../", import.meta.url);
const source = (path: string) => readFile(new URL(path, root), "utf8");

// Kalender og dagsprogram deler buildWeekPlan → de er ENIGE, præcis når
// planlæggeren (1) hverken taber eller dublerer ordrer og (2) er deterministisk.
// Invarianterne testes her uden database.

const emp = (id: number): Employee => ({
  id, name: `Medarbejder ${id}`, home: [55.88, 9.83],
  workStartMin: 8 * 60, workEndMin: 16 * 60, flexMin: 60, workdays: [0, 1, 2, 3, 4],
});

/** Deterministisk "tilfældig" jobliste — blandede varigheder, låse, faste
 *  ugedage (inkl. umulige weekend-låse) og to medarbejdere. */
function jobSet(): Job[] {
  const postals = ["8660 Skanderborg", "8700 Horsens", "8000 Aarhus C", "8300 Odder", "8600 Silkeborg"];
  return Array.from({ length: 40 }, (_, i) => {
    const postal = postals[i % postals.length];
    return {
      id: i + 1, contactId: 100 + i, customer: `Kunde ${i + 1}`,
      address: `Vej ${i + 1}, ${postal}`, postal,
      category: ["Have", "Vinduer", "Andet"][i % 3],
      durationMin: [30, 60, 90, 240, 800][i % 5],
      source: i % 4 === 0 ? `Abo. #${i}` : "Manuel ordre",
      fixedEmployeeId: i % 2 === 0 ? 7 : 8,
      ...(i % 7 === 0 ? { locked: true, lockedWeekday: i % 9 === 0 ? 5 : 2 } : {}),
      ...(i % 11 === 0 ? { fixedWeekdays: [1, 3] } : {}),
    };
  });
}

test("planWeek hverken taber eller dublerer ordrer (partition af input)", () => {
  const jobs = jobSet();
  const plan = planWeek(jobs, "2026-08-24", [emp(7), emp(8)]);
  const placed = plan.days.flatMap((d) => d.stops.map((s) => s.job.id));
  const unplanned = plan.unplanned.map((j) => j.id);
  const all = [...placed, ...unplanned].sort((a, b) => a - b);
  assert.deepEqual(all, jobs.map((j) => j.id).sort((a, b) => a - b));
  assert.equal(new Set(all).size, all.length, "ingen ordre må optræde to gange");
});

test("planWeek er deterministisk — to kørsler giver identisk plan (kalender == dagsprogram)", () => {
  const a = planWeek(jobSet(), "2026-08-24", [emp(7), emp(8)]);
  const b = planWeek(jobSet(), "2026-08-24", [emp(7), emp(8)]);
  assert.deepEqual(
    a.days.map((d) => ({ e: d.employeeId, w: d.weekday, s: d.stops.map((s) => [s.job.id, s.startMin, s.endMin]) })),
    b.days.map((d) => ({ e: d.employeeId, w: d.weekday, s: d.stops.map((s) => [s.job.id, s.startMin, s.endMin]) })),
  );
  assert.deepEqual(a.unplanned.map((j) => j.id), b.unplanned.map((j) => j.id));
});

test("planWeek respekterer hårde bindinger (fast medarbejder, låst ugedag, faste ugedage)", () => {
  const jobs = jobSet();
  const plan = planWeek(jobs, "2026-08-24", [emp(7), emp(8)]);
  const byId = new Map(jobs.map((j) => [j.id, j]));
  for (const d of plan.days) {
    for (const s of d.stops) {
      const j = byId.get(s.job.id)!;
      if (j.fixedEmployeeId) assert.equal(d.employeeId, j.fixedEmployeeId, `#${j.id}: forkert medarbejder`);
      if (j.locked) assert.equal(d.weekday, j.lockedWeekday, `#${j.id}: låst ordre flyttet fra sin dag`);
      if (!j.locked && j.fixedWeekdays) assert.ok(j.fixedWeekdays.includes(d.weekday), `#${j.id}: uden for faste ugedage`);
      assert.ok(d.weekday >= 0 && d.weekday <= 4, "aldrig planlagt i weekenden");
    }
  }
});

// --- Kildetests: aggregerings-tallene følger samme viewer-regel overalt ---

test("dagsprogrammets uge- og månedstal følger viewer-reglen (ikke hele teamet)", async () => {
  const queries = await source("lib/queries.ts");
  assert.match(queries, /const visibleWeekDays = plan\.days\.filter\(\(d\) => !viewer \|\| viewer\.isAdmin \|\| d\.employeeId === viewer\.id\)/);
  assert.match(queries, /for \(const d of visibleWeekDays\)/);
  assert.match(queries, /monthRevenue\(date\.getUTCFullYear\(\), date\.getUTCMonth\(\), viewer && !viewer\.isAdmin \? viewer\.id : undefined\)/);
  assert.match(queries, /monthRevenue\(year, monMonth, viewer && !viewer\.isAdmin \? viewer\.id : undefined\)/);
});

test("månedsvisningen viser også ikke-planlagte ordrer (markeret, på deres ugedag)", async () => {
  const queries = await source("lib/queries.ts");
  assert.match(queries, /chips\.push\(\.\.\.wp\.unplanned/);
  assert.match(queries, /unplanned: true, reason/);
  const component = await source("components/TeamCalendarClient.tsx");
  assert.match(component, /c\.unplanned \|\| selectedEmp\.has\(c\.employeeId\)/);
  assert.match(component, /Ikke planlagt: \$\{UNPLANNED_REASON_LABEL\[c\.reason \?\? ""\] \?\? "Ukendt årsag"\}/);
});
