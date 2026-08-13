import test from "node:test";
import assert from "node:assert/strict";
import {
  planCalendar2Horizon,
  type Calendar2Employee,
  type Calendar2Job,
  type Calendar2Series,
  type TravelMatrix,
} from "../lib/calendar2-routing";

const employee = (overrides: Partial<Calendar2Employee> = {}): Calendar2Employee => ({
  id: 7, name: "Planlægger", homeAddress: "Hjem", workStartMin: 8 * 60,
  workEndMin: 16 * 60, flexMin: 0, workdays: [0, 1, 2, 3, 4], ...overrides,
});
const job = (id: number, overrides: Partial<Calendar2Job> = {}): Calendar2Job => ({
  id, contactId: id, customer: `Kunde ${id}`, address: `A${id}`, postal: "8000",
  category: "Test", durationMin: 60, source: `Abo. #${id}`, fixedWeekdays: [0], fixedEmployeeId: 7,
  ...overrides,
});
const matrix = (addresses: string[], minutes = 0): TravelMatrix => ({
  addresses,
  durations: addresses.map((_, r) => addresses.map((__, c) => r === c ? 0 : minutes)),
  provider: "test-osrm", capturedAt: "2026-01-01T00:00:00.000Z",
});
const series = (id: number, weeks: string[], overrides: Partial<Calendar2Job> = {}): Calendar2Series => ({
  seriesId: id,
  sourceStartWeek: weeks[0],
  occurrences: weeks.map((sourceWeek, index) => ({ sourceWeek, job: job(id * 100 + index, overrides) })),
});
const matrixFor = (items: Calendar2Series[]) => matrix(["Hjem", ...items.flatMap((item) => item.occurrences.map((occurrence) => occurrence.job.address))]);
const placed = (result: ReturnType<typeof planCalendar2Horizon>, seriesId: number) => result.placements
  .filter((item) => item.seriesId === seriesId)
  .map((item) => item.previewWeek);

function blockers(week: string, firstId: number): Calendar2Series[] {
  return Array.from({ length: 5 }, (_, day) => series(firstId + day, [week], { durationMin: 480, fixedWeekdays: [day] }));
}

test("fuld sourceuge flytter faseanker og interval 2 til første fremtidige uge", () => {
  const source = series(1, ["2026-08-10", "2026-08-24", "2026-09-07"]);
  const before = structuredClone(source);
  const input = [...blockers("2026-08-10", 10), source];
  const result = planCalendar2Horizon(input, "2026-08-10", 26, [employee()], matrixFor(input));
  assert.deepEqual(placed(result, 1), ["2026-08-17", "2026-08-31", "2026-09-14"]);
  assert.equal(result.seriesAudit.find((item) => item.seriesId === 1)?.previewStartWeek, "2026-08-17");
  assert.equal(result.seriesAudit.find((item) => item.seriesId === 1)?.reason, "capacity_deferred_to_next_week");
  assert.deepEqual(source, before, "kildeserien må ikke muteres");
});

test("ledig anden hverdag bevarer sourceStartWeek", () => {
  const result = planCalendar2Horizon([series(1, ["2026-08-10"], { fixedWeekdays: [4] })], "2026-08-10", 26, [employee()], matrix(["Hjem", "A100"]));
  assert.deepEqual(placed(result, 1), ["2026-08-10"]);
});

test("to fulde uger udskyder til tredje uge", () => {
  const input = [...blockers("2026-08-10", 10), ...blockers("2026-08-17", 20), series(1, ["2026-08-10"])];
  const result = planCalendar2Horizon(input, "2026-08-10", 26, [employee()], matrixFor(input));
  assert.deepEqual(placed(result, 1), ["2026-08-24"]);
});

test("ISO uge 53 og årsskifte bruger kalenderdatoer uden ugearitmetik", () => {
  const input = [...blockers("2026-12-28", 10), series(1, ["2026-12-28", "2027-01-11"])];
  const result = planCalendar2Horizon(input, "2026-12-28", 26, [employee()], matrixFor(input));
  assert.deepEqual(placed(result, 1), ["2027-01-04", "2027-01-18"]);
});

test("ingen kapacitet i 26 positioner giver no_capacity_in_horizon", () => {
  const all = Array.from({ length: 26 }, (_, index) => {
    const d = new Date(Date.UTC(2026, 7, 10 + index * 7)).toISOString().slice(0, 10);
    return blockers(d, 100 + index * 10);
  }).flat();
  const input = [...all, series(1, ["2026-08-10"])];
  const result = planCalendar2Horizon(input, "2026-08-10", 26, [employee()], matrixFor(input));
  assert.equal(result.seriesAudit.find((item) => item.seriesId === 1)?.reason, "no_capacity_in_horizon");
  assert.equal(placed(result, 1).length, 0);
});

test("defer ændrer aldrig medarbejder, weekend eller overtid", () => {
  const input = [...blockers("2026-08-10", 10), series(1, ["2026-08-10"])];
  const result = planCalendar2Horizon(input, "2026-08-10", 26, [employee()], matrixFor(input));
  const stop = result.weeks.flatMap((week) => week.plan.days).flatMap((day) => day.stops.map((s) => ({ day, stop: s }))).find(({ stop }) => stop.job.id === 100)!;
  assert.equal(stop.day.employeeId, 7);
  assert.ok(stop.day.weekday >= 0 && stop.day.weekday <= 4);
  assert.ok(stop.stop.endMin + stop.day.returnHomeMin <= 16 * 60);
});

test("datafejl prioriteres og maskeres ikke af kapacitetssøgning", () => {
  const inputs = [
    series(1, ["2026-08-10"], { fixedEmployeeId: undefined }),
    series(2, ["2026-08-10"], { durationMin: 0 }),
    series(3, ["2026-08-10"], { durationMin: 481 }),
    series(4, ["2026-08-10"], { address: "Ukendt" }),
  ];
  const result = planCalendar2Horizon(inputs, "2026-08-10", 26, [employee()], matrix(["Hjem", "A100", "A200", "A300"]));
  assert.deepEqual(result.seriesAudit.map((item) => item.reason), ["unassigned", "invalid_duration", null, "unverified_address"]);
});

test("flere deferred serier deler reservationer deterministisk", () => {
  const input = [series(10, ["2026-08-10"], { durationMin: 480, fixedWeekdays: [0] }), series(1, ["2026-08-10"], { durationMin: 300 }), series(2, ["2026-08-10"], { durationMin: 300 })];
  const m = matrixFor(input);
  const a = planCalendar2Horizon(input, "2026-08-10", 26, [employee({ workdays: [0] })], m);
  const b = planCalendar2Horizon(structuredClone(input), "2026-08-10", 26, [employee({ workdays: [0] })], m);
  assert.deepEqual(a, b);
  assert.deepEqual(placed(a, 1), ["2026-08-17"]);
  assert.deepEqual(placed(a, 2), ["2026-08-24"]);
});

test("begrænset eksakt feasibility finder arrangement som greedy insertion overser", () => {
  const e = employee({ workEndMin: 12 * 60, workdays: [0, 1] });
  const jobs = [
    series(1, ["2026-08-10"], { durationMin: 240, fixedWeekdays: [0] }),
    series(2, ["2026-08-10"], { durationMin: 240, fixedWeekdays: [0] }),
  ];
  const result = planCalendar2Horizon(jobs, "2026-08-10", 1, [e], matrix(["Hjem", "A100", "A200"]));
  assert.equal(result.placements.length, 2);
  assert.deepEqual(result.weeks[0].plan.days.map((day) => day.weekday), [0, 1]);
});

test("phase shift uden for præcis 26 positioner rapporteres, ikke tabes eller duplikeres", () => {
  const last = "2027-02-01";
  const input = [...blockers("2026-08-10", 10), series(1, ["2026-08-10", last])];
  const result = planCalendar2Horizon(input, "2026-08-10", 26, [employee()], matrixFor(input));
  assert.equal(result.placements.filter((item) => item.seriesId === 1).length, 1);
  assert.deepEqual(result.outOfHorizon.map((item) => [item.seriesId, item.sourceWeek, item.previewWeek]), [[1, last, "2027-02-08"]]);
});
