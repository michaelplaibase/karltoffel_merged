import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { planWeek, type Job, type Employee } from "../lib/planner";

const root = new URL("../", import.meta.url);
const source = (path: string) => readFile(new URL(path, root), "utf8");

const EMP: Employee = {
  id: 7, name: "Test Testesen", home: [55.88, 9.83],
  workStartMin: 8 * 60, workEndMin: 16 * 60, flexMin: 60, workdays: [0, 1, 2, 3, 4],
};
const job = (over: Partial<Job>): Job => ({
  id: 1, contactId: 1, customer: "Kunde", address: "Testvej 1, 8700 Horsens", postal: "8700 Horsens",
  category: "Andet", durationMin: 60, source: "Manuel ordre", fixedEmployeeId: 7, ...over,
});

// --- Enhedstests: planlæggeren efterlader disse ordrer som "unplanned" — de må
// --- derfor ALDRIG blive usynlige i dagsprogrammet (klagepunktet).

test("ordre låst til lørdag kan ikke placeres (man–fre) og ender som unplanned", () => {
  const plan = planWeek([job({ locked: true, lockedWeekday: 5 })], "2026-08-24", [EMP]);
  assert.equal(plan.days.length, 0);
  assert.equal(plan.unplanned.length, 1);
});

test("ordre der overskrider dagens kapacitet placeres som OVERARBEJDE — aldrig usynlig", () => {
  // Michaels beslutning efter uge 35-hændelsen: en bunden ordre uden plads
  // inden for arbejdstiden lægges som overarbejde på dagen med færrest timer
  // i stedet for at ende i "Ikke planlagt".
  const plan = planWeek([job({ durationMin: 3000 })], "2026-08-24", [EMP]);
  assert.equal(plan.unplanned.length, 0);
  const stop = plan.days.flatMap((d) => d.stops).find((s) => s.overtime);
  assert.ok(stop, "overarbejds-stoppet skal være markeret overtime");
});

// --- Kildetests: dagsprogrammet viser de ikke-planlagte ordrer på deres dag ---

test("getDayProgram medtager unplanned-ordrer på deres persisterede ugedag", async () => {
  const queries = await source("lib/queries.ts");
  // buildWeekPlan husker ordrens ugedag og skelner uassigneret/inaktiv kollega.
  assert.match(queries, /weekdayById\.set\(o\.id, \(o\.plannedAt\.getUTCDay\(\) \+ 6\) % 7\)/);
  assert.match(queries, /inactive_employee/);
  // getDayProgram bygger en unplanned-sektion afgrænset til dagen + viewer-reglen.
  assert.match(queries, /weekdayById\.get\(job\.id\) === weekdayIdx/);
  assert.match(queries, /!viewer \|\| viewer\.isAdmin \|\| job\.fixedEmployeeId === viewer\.id/);
  assert.match(queries, /DAY_UNPLANNED_REASON/);
  assert.match(queries, /stops,\s*\n\s*unplanned,\s*\n\s*};/);
});

test("dagsprogram-siden og PDF-rapporten viser unplanned-sektionen", async () => {
  const page = await source("app/daycalendar/page.tsx");
  assert.match(page, /day\.unplanned\.length > 0/);
  assert.match(page, /Ikke planlagt denne dag/);
  const pdf = await source("app/api/reports/day-pdf/route.ts");
  assert.match(pdf, /Ikke planlagt denne dag/);
});

test("DayStopCard kan vise et unplanned-kort med årsag i stedet for klokkeslæt", async () => {
  const card = await source("components/DayStopCard.tsx");
  assert.match(card, /"reason" in stop/);
  assert.match(card, /Ikke planlagt · \{stop\.reason\}/);
});

// --- Kildetests: ugekalenderens følgefejl ---

test("ugekalenderen kender ordre-pipelinens unplanned-årsager (ingen 'Ukendt årsag')", async () => {
  const component = await source("components/TeamCalendarClient.tsx");
  assert.match(component, /overflow: "Ingen mulig dag tilbage i ugen"/);
  assert.match(component, /fixed_weekday_unavailable: "Fast ugedag er ikke en tilbageværende arbejdsdag"/);
  assert.match(component, /holiday: "Ferielukket uge"/);
  assert.match(component, /inactive_employee: "Kollega ikke aktiv i kalenderen"/);
});

test("dagskørsel summeres over medarbejdere (ikke overskrives)", async () => {
  const queries = await source("lib/queries.ts");
  assert.match(queries, /dayDrive\[d\.weekday\] \+= d\.driveMin/);
  assert.doesNotMatch(queries, /dayDrive\[d\.weekday\] = d\.driveMin/);
});

test("/calendar håndhæver viewer-reglen som /daycalendar (medarbejder ser kun sig selv)", async () => {
  const page = await source("app/calendar/page.tsx");
  assert.match(page, /getSessionUser/);
  assert.match(page, /getCalendarWeek\(monday, viewer\)/);
  assert.match(page, /getCalendarMonth\(monthParam, viewer\)/);
});

test("fremrykning ved tidlig afslutning gælder kun afslutninger fra i dag (dansk tid)", async () => {
  const queries = await source("lib/queries.ts");
  assert.match(queries, /cphDateISO\(completedAt\) !== todayISO/);
});
