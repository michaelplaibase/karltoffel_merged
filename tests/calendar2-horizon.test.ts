import test from "node:test";
import assert from "node:assert/strict";
import {
  calendar2RejectedTasks,
  planCalendar2Horizon,
  type Calendar2Employee,
  type Calendar2Job,
  type Calendar2Series,
  type TravelMatrix,
} from "../lib/calendar2-routing";

const employee = (overrides: Partial<Calendar2Employee> = {}): Calendar2Employee => ({
  id: 7, name: "Planlægger", homeAddress: "Hjem", workStartMin: 8 * 60,
  workEndMin: 18 * 60, flexMin: 0, workdays: [0, 1, 2, 3, 4], ...overrides,
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
  return Array.from({ length: 5 }, (_, day) => series(firstId + day, [week], { durationMin: 600, fixedWeekdays: [day] }));
}

test("fuld sourcedag flytter faseanker og interval 2 til første efterfølgende hverdag", () => {
  const source = series(1, ["2026-08-10", "2026-08-24", "2026-09-07"]);
  const before = structuredClone(source);
  const input = [...blockers("2026-08-10", 10), source];
  const result = planCalendar2Horizon(input, "2026-08-10", 26, [employee()], matrixFor(input));
  assert.deepEqual(placed(result, 1), ["2026-08-17", "2026-08-31", "2026-09-14"]);
  assert.equal(result.seriesAudit.find((item) => item.seriesId === 1)?.previewStartWeek, "2026-08-17");
  assert.equal(result.seriesAudit.find((item) => item.seriesId === 1)?.reason, "capacity_shifted_to_earliest_day");
  assert.deepEqual(source, before, "kildeserien må ikke muteres");
});

test("ledig anden hverdag bevarer sourceStartWeek", () => {
  const result = planCalendar2Horizon([series(1, ["2026-08-10"], { fixedWeekdays: [4] })], "2026-08-10", 26, [employee()], matrix(["Hjem", "A100"]));
  assert.deepEqual(placed(result, 1), ["2026-08-10"]);
});

test("to fulde uger udskyder til tredje uge", () => {
  const input = [...blockers("2026-08-10", 10), ...blockers("2026-08-17", 20), series(1, ["2026-08-10"])];
  const result = planCalendar2Horizon(input, "2026-08-10", 26, [employee()], matrixFor(input));
  assert.deepEqual(placed(result, 1), ["2026-08-17"]);
});

test("ISO uge 53 og årsskifte bruger kalenderdatoer uden ugearitmetik", () => {
  const input = [...blockers("2026-12-28", 10), series(1, ["2026-12-28", "2027-01-11"])];
  const result = planCalendar2Horizon(input, "2026-12-28", 26, [employee()], matrixFor(input));
  assert.deepEqual(placed(result, 1), ["2027-01-04", "2027-01-18"]);
});

test("26-ugers grænsen er kun visning og kapacitet ruller til første dag udenfor", () => {
  const all = Array.from({ length: 26 }, (_, index) => {
    const d = new Date(Date.UTC(2026, 7, 10 + index * 7)).toISOString().slice(0, 10);
    return blockers(d, 100 + index * 10);
  }).flat();
  const input = [...all, series(1, ["2027-02-01"])];
  const result = planCalendar2Horizon(input, "2026-08-10", 26, [employee()], matrixFor(input));
  assert.equal(result.seriesAudit.find((item) => item.seriesId === 1)?.reason, "capacity_deferred_outside_display_horizon");
  assert.equal(placed(result, 1).length, 0);
  assert.deepEqual(result.outOfHorizon.filter((item) => item.seriesId === 1).map((item) => item.previewWeek), ["2027-02-08"]);
  assert.equal(result.unplanned.length, 0);
});

test("defer ændrer aldrig medarbejder, weekend eller overtid", () => {
  const input = [...blockers("2026-08-10", 10), series(1, ["2026-08-10"])];
  const result = planCalendar2Horizon(input, "2026-08-10", 26, [employee()], matrixFor(input));
  const stop = result.weeks.flatMap((week) => week.plan.days).flatMap((day) => day.stops.map((s) => ({ day, stop: s }))).find(({ stop }) => stop.job.id === 100)!;
  assert.equal(stop.day.employeeId, 7);
  assert.ok(stop.day.weekday >= 0 && stop.day.weekday <= 4);
  assert.ok(stop.stop.endMin + stop.day.returnHomeMin <= 18 * 60);
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
  assert.deepEqual(placed(a, 2), ["2026-08-17"]);
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

test("source-afvisning publicerer alle ægte task-identiteter med effektiv 60-minutters standard", () => {
  const sourceJob = job(900, {
    address: "Ukendt",
    durationMin: 180,
    sourceTasks: [{ id: "task-a", durationMin: 120 }, { id: "task-b", durationMin: 0 }],
  });
  assert.deepEqual(calendar2RejectedTasks(sourceJob), [
    { sourceTaskId: "task-a", effectiveMinutes: 120 },
    { sourceTaskId: "task-b", effectiveMinutes: 60 },
  ]);
  const result = planCalendar2Horizon([{ seriesId: 9, sourceStartWeek: "2026-08-10", occurrences: [{ sourceWeek: "2026-08-10", job: sourceJob }] }], "2026-08-10", 1, [employee()], matrix(["Hjem"]));
  assert.equal(result.unplanned[0].reason, "unverified_address");
  assert.deepEqual(result.unplanned[0].rejectedTasks, calendar2RejectedTasks(sourceJob));
});

test("lang task ruller videre uden kapacitetsafvisning selv ved kort visningshorisont", () => {
  const sourceJob = job(901, {
    durationMin: 700,
    sourceTasks: [{ id: "task-long", durationMin: 700 }],
  });
  const result = planCalendar2Horizon([{ seriesId: 10, sourceStartWeek: "2026-08-10", occurrences: [{ sourceWeek: "2026-08-10", job: sourceJob }] }], "2026-08-10", 1, [employee({ workdays: [0] })], matrix(["Hjem", "A901"]));
  assert.equal(result.unplanned.length, 0);
  assert.equal(result.outOfHorizon.length, 1);
});

test("taskminutter bevares eksakt uden tab eller dubletter på tværs af planlagt og afvist", () => {
  const sourceJob = job(902, {
    durationMin: 1020,
    sourceTasks: [
      { id: "task-a", durationMin: 400 },
      { id: "task-default", durationMin: 0 },
      { id: "task-b", durationMin: 560 },
    ],
  });
  const expected = new Map([["task-a", 400], ["task-default", 60], ["task-b", 560]]);
  const result = planCalendar2Horizon(
    [{ seriesId: 11, sourceStartWeek: "2026-08-10", occurrences: [{ sourceWeek: "2026-08-10", job: sourceJob }] }],
    "2026-08-10", 1, [employee({ workdays: [0] })], matrix(["Hjem", "A902"]),
  );
  const actual = new Map<string, number>();
  for (const stop of result.weeks.flatMap((week) => week.plan.days.flatMap((day) => day.stops))) {
    assert.ok(stop.audit.sourceTaskId, "planlagt segment skal have ægte task-ID");
    actual.set(stop.audit.sourceTaskId, (actual.get(stop.audit.sourceTaskId) ?? 0) + (stop.audit.segmentMinutes ?? stop.job.durationMin));
  }
  for (const segment of result.outOfHorizon.flatMap((item) => item.segments)) actual.set(segment.sourceTaskId, (actual.get(segment.sourceTaskId) ?? 0) + segment.minutes);
  assert.deepEqual(actual, expected);
  assert.equal(result.unplanned.length, 0);
});

test("fuld mandag vælger ledig onsdag før torsdag", () => {
  const input = [
    series(10, ["2026-08-10"], { durationMin: 600, fixedWeekdays: [0] }),
    series(11, ["2026-08-10"], { durationMin: 600, fixedWeekdays: [1] }),
    series(1, ["2026-08-10"], { durationMin: 60, fixedWeekdays: [0] }),
  ];
  const result = planCalendar2Horizon(input, "2026-08-10", 26, [employee()], matrixFor(input));
  const target = result.weeks[0].plan.days.flatMap((day) => day.stops.map((stop) => ({ day, stop }))).find(({ stop }) => stop.job.id === 100)!;
  assert.equal(target.day.weekday, 2);
  assert.equal(result.unplanned.length, 0);
});

test("fredags-overflow ruller til mandag og aldrig weekend", () => {
  const input = [series(10, ["2026-08-10"], { durationMin: 600, fixedWeekdays: [4] }), series(1, ["2026-08-10"], { fixedWeekdays: [4] })];
  const result = planCalendar2Horizon(input, "2026-08-10", 2, [employee()], matrixFor(input));
  const target = result.weeks[1].plan.days.flatMap((day) => day.stops.map((stop) => ({ day, stop }))).find(({ stop }) => stop.job.id === 100)!;
  assert.equal(target.day.weekday, 0);
  assert.ok(result.weeks.flatMap((week) => week.plan.days).every((day) => day.weekday < 5));
});

test("recurrence rephaser til samme forskudte ugedag", () => {
  const recurring = series(1, ["2026-08-10", "2026-08-24"], { fixedWeekdays: [0] });
  const input = [series(10, ["2026-08-10"], { durationMin: 600, fixedWeekdays: [0] }), recurring];
  const result = planCalendar2Horizon(input, "2026-08-10", 4, [employee()], matrixFor(input));
  const targetDays = result.weeks.flatMap((week) => week.plan.days.flatMap((day) => day.stops.filter((stop) => stop.job.id === 100 || stop.job.id === 101).map(() => day.weekday)));
  assert.deepEqual(targetDays, [1, 1]);
});

test("kapacitetsrelateret unplanned er altid nul under kaskade", () => {
  const input = Array.from({ length: 40 }, (_, id) => series(id + 1, ["2026-08-10"], { durationMin: 600, fixedWeekdays: [0] }));
  const result = planCalendar2Horizon(input, "2026-08-10", 1, [employee()], matrixFor(input));
  assert.equal(result.unplanned.length, 0);
  assert.ok(result.outOfHorizon.length > 0);
});

test("routefejl før segmentering afviser én række pr. ægte source task", () => {
  const sourceJob = job(903, {
    durationMin: 180,
    sourceTasks: [{ id: "route-a", durationMin: 120 }, { id: "route-default", durationMin: null }],
  });
  const brokenRoute: TravelMatrix = {
    ...matrix(["Hjem", "A903"]),
    durations: [[0, Number.POSITIVE_INFINITY], [Number.POSITIVE_INFINITY, 0]],
  };
  const result = planCalendar2Horizon(
    [{ seriesId: 12, sourceStartWeek: "2026-08-10", occurrences: [{ sourceWeek: "2026-08-10", job: sourceJob }] }],
    "2026-08-10", 1, [employee()], brokenRoute,
  );
  assert.equal(result.unplanned[0].reason, "unverified_route");
  assert.deepEqual(result.unplanned[0].rejectedTasks, [
    { sourceTaskId: "route-a", effectiveMinutes: 120 },
    { sourceTaskId: "route-default", effectiveMinutes: 60 },
  ]);
  assert.equal(result.weeks.flatMap((week) => week.plan.unplanned).length, 0);
});
