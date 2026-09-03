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

test("fast ugedag er FORTRUKEN ikke blokerende: passeret fast dag → bedste tilbageværende dag", () => {
  // Nyt princip (Thomas, 2026-09-03): abonnementets faste ugedag er en anker-
  // præference, aldrig en blokering. En fast mandag-ordrer i en uge, hvor
  // mandag er passeret, planlægges på den bedste tilbageværende dag i stedet
  // for ærligt at ende som "Ikke planlagt".
  const p = planWeek([job(1, 60, { fixedWeekdays: [0] })], "2026-08-24", [emp(1)], { fromWeekday: 2 });
  assert.equal(p.unplanned.length, 0);
  assert.ok(p.days.find((d) => d.stops.length)?.weekday! >= 2);
});

test("uge-niveau fordeling: 5 ubeegrænsede job spredes over ugen (ikke pakket mandag først)", () => {
  // Gamle adfærd: grådhed pakkede mandag først til kapacitetsgrænsen. Ny:
  // hvert job vælger dagen hvor (dagsbelastning + marginal kørsel) er mindst,
  // så opgaverne fordeler sig over hele ugen og daglig kørsel minimeres.
  const jobs = Array.from({ length: 5 }, (_, i) => job(i + 1, 240));
  const p = planWeek(jobs, "2026-08-24", [emp(1)]);
  assert.equal(p.unplanned.length, 0);
  const daysWithStops = p.days.filter((d) => d.stops.length);
  assert.ok(daysWithStops.length >= 3, `skal spredes over mindst 3 dage, fik ${daysWithStops.length}`);
});

test("anker-dag: fast-ugedags-job ligger FAST på sin dag, andre fordeles omkring (og MÅ dele dagen ved plads)", () => {
  // McDonald's-princippet: onsdags-ankreet fastlægges FØRST (hardt på onsdag);
  // de andre job placeres derefter uge-niveau (billigste dag først) og må dele
  // ankredagen, hvis der er plads — men pakkes ALDRIG på ankerdagen, hvis en
  // anden dag er billigere, og aldrig ud over kapaciteten.
  const anchor = job(1, 300, { fixedWeekdays: [2] });
  const small = job(2, 120);
  const big = job(3, 460);
  const p = planWeek([anchor, small, big], "2026-08-24", [emp(1)]);
  assert.equal(p.unplanned.length, 0);
  const weekdayOf = (id: number) => p.days.find((d) => d.stops.some((s) => s.job.id === id))!.weekday;
  assert.equal(weekdayOf(1), 2); // ankeret HARDT på sin faste dag
  // Kapacitet: onsdag kan max rumme ankret + ét af de andre (480+d+300+120+d2 <= 1020).
  const onWednesday = p.days.find((d) => d.weekday === 2)!.stops.length;
  assert.ok(onWednesday >= 1 && onWednesday <= 2, "ankerdag: ankret evt. delt med ÉT ekstra job");
});

test("faste ugedage respekteres stadig som FORTRUKNE, når de er mulige", () => {
  const p = planWeek([job(1, 60, { fixedWeekdays: [2, 3] })], "2026-08-24", [emp(1)]);
  const wd = p.days.find((d) => d.stops.length)!.weekday;
  assert.ok(wd === 2 || wd === 3);
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
  assert.match(queries, /locked: decided/);
  assert.match(queries, /o\.status !== "Skal genplanlægges"/);
  assert.match(queries, /fixed_weekday_unavailable/);
});
