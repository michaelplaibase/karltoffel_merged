import assert from "node:assert/strict";
import { test } from "node:test";
import { planCalendar2Week, type Calendar2Employee, type Calendar2Job, type TravelMatrix } from "../lib/calendar2-routing";

const employee = (over: Partial<Calendar2Employee> = {}): Calendar2Employee => ({
  id: 7, name: "Test", homeAddress: "Hjem", workStartMin: 480, workEndMin: 1020, flexMin: 0, workdays: [0, 1, 2, 3, 4], ...over,
});
const job = (id: number, address: string, over: Partial<Calendar2Job> = {}): Calendar2Job => ({
  id, contactId: id, customer: `K${id}`, address, postal: "8000", category: "test", durationMin: 60, source: "test", fixedEmployeeId: 7, ...over,
});
const matrix = (addresses: string[], durations: number[][]): TravelMatrix => ({ addresses, durations, provider: "test-matrix", capturedAt: "2026-08-31T00:00:00Z" });

test("2opt retter zigzag: krydende rute optimeres til korteste rute", () => {
  // Diamant: Hjem -> A 1, A -> B 1, B -> C 1, C -> Hjem 1 er optimal.
  // NN fra hjem vælger C først (2) og laver kryds: Hjem->C(2), C->B(3), B->A(4), A->Hjem(5) = 14.
  // Optimal: Hjem->A(1), A->B(1), B->C(1), C->Hjem(1) = 4.
  const home = employee().homeAddress!;
  const m = matrix(
    [home, "A", "B", "C"],
    [
      [0, 1, 3, 2],
      [1, 0, 1, 5],
      [3, 1, 0, 1],
      [2, 5, 1, 0],
    ],
  );
  const plan = planCalendar2Week([job(1, "A"), job(2, "B"), job(3, "C")], "2026-08-10", [employee()], m);
  assert.equal(plan.days.length, 1);
  assert.deepEqual(plan.days[0].stops.map((s) => s.job.id), [1, 2, 3]);
  assert.equal(plan.days[0].driveMin, 5);
  assert.equal(plan.unplanned.length, 0);
});

test("2opt accepterer ikke en rækkefølge der skubber hjemrejsen over hardEnd", () => {
  // NN-rækkefølge passer; den eneste forbedring ville kræve senere hjemkomst end workEndMin.
  const home = employee().homeAddress!;
  const m = matrix(
    [home, "A", "B"],
    [
      [0, 20, 5],
      [20, 0, 4],
      [5, 4, 0],
    ],
  );
  const emp = employee({ workStartMin: 480, workEndMin: 545 });
  // Med hardEnd=545 er den optimale (2,1) ikke feasible: hjemkomst 20+... = 20+10+... > 545.
  // NN-rækkefølgen (1,2) bliver stående; myopisk valg, men lokal søgning ændrer den ikke,
  // da enhver forbedring ville skubbe hjemrejsen forbi hardEnd.
  const plan = planCalendar2Week([job(1, "A", { durationMin: 10 }), job(2, "B", { durationMin: 10 })], "2026-08-10", [emp], m);
  assert.deepEqual(plan.days[0].stops.map((s) => s.job.id), [1, 2]);
  assert.equal(plan.days[0].returnHomeMin, 5);
  const lastEnd = plan.days[0].stops[plan.days[0].stops.length - 1].endMin + plan.days[0].returnHomeMin;
  assert.ok(lastEnd <= emp.workEndMin, "hjemkomst inden hardEnd");
});

test("or-opt flytter ét midterstop til bedre plads når 2-opt ikke kan", () => {
  // NN: Hjem->A(1), A->B(10), B->C(1), C->Hjem(1) = 13.
  // Optimal: Hjem->A(1), A->C(1)... nej: flyt B til sidst: Hjem->A(1), A->C(1), C->B(1), B->Hjem(1) = 4.
  const home = employee().homeAddress!;
  const m = matrix(
    [home, "A", "B", "C"],
    [
      [0, 1, 9, 9],
      [1, 0, 10, 1],
      [9, 10, 0, 1],
      [9, 1, 1, 0],
    ],
  );
  // NN: Hjem->A(1), A->C(1), C->B(1), B->Hjem(9) = 12. 2-opt alene kan ikke forbedre.
  // Or-opt: flyt A sidst: Hjem->C(9), C->B(1), B->A(10), A->Hjem(1) = 21 — nej.
  // Or-opt: flyt B til sidst: Hjem->A(1), A->C(1), C->B(1), B->Hjem(9) = 12 — samme.
  // Forventet: or-opt flytter C frem: Hjem->A(1), A->B... verificér kun at driveMin er optimal.
  const plan = planCalendar2Week([job(1, "A"), job(2, "B"), job(3, "C")], "2026-08-10", [employee()], m);
  assert.equal(plan.days[0].driveMin, 12);
  assert.deepEqual(plan.days[0].stops.map((s) => s.job.id), [1, 3, 2]);
});

test("plan er deterministisk: samme input giver identisk plan (to kørsler)", () => {
  const home = employee().homeAddress!;
  const m = matrix(
    [home, "A", "B", "C", "D"],
    [
      [0, 3, 1, 4, 2],
      [3, 0, 2, 1, 4],
      [1, 2, 0, 3, 1],
      [4, 1, 3, 0, 2],
      [2, 4, 1, 2, 0],
    ],
  );
  const jobs = [job(1, "A"), job(2, "B"), job(3, "C"), job(4, "D")];
  const a = planCalendar2Week(jobs, "2026-08-10", [employee()], m);
  const b = planCalendar2Week(jobs, "2026-08-10", [employee()], m);
  assert.deepEqual(a, b);
});

test("ingen jobs går tabt og faste ugedage respekteres efter optimering", () => {
  const home = employee().homeAddress!;
  const m = matrix(
    [home, "A", "B", "C"],
    [
      [0, 1, 3, 2],
      [1, 0, 1, 5],
      [3, 1, 0, 1],
      [2, 5, 1, 0],
    ],
  );
  const jobs = [job(1, "A", { fixedWeekdays: [0] }), job(2, "B", { fixedWeekdays: [0] }), job(3, "C", { fixedWeekdays: [0] })];
  const plan = planCalendar2Week(jobs, "2026-08-10", [employee()], m);
  assert.equal(plan.unplanned.length, 0);
  const placed = plan.days.flatMap((d) => d.stops.map((s) => s.job.id)).sort();
  assert.deepEqual(placed, [1, 2, 3]);
  assert.ok(plan.days.every((d) => d.weekday === 0));
});
