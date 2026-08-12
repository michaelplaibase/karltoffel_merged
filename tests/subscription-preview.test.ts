import test from "node:test";
import assert from "node:assert/strict";
import { projectSubscriptionVisits } from "../lib/subscription-preview";

const task = (overrides: Partial<{
  id: number; category: string; description: string; price: number; durationMin: number;
  intervalMultiplier: string | null; startWeek: string | null;
}> = {}) => ({
  id: 10,
  category: "Vinduespolering",
  description: "Udvendig polering",
  price: 500,
  durationMin: 60,
  intervalMultiplier: "Hver gang",
  startWeek: null,
  ...overrides,
});

const subscription = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  displayNo: 101,
  contactId: 7,
  customer: "Testkunde",
  phone: "+45 12 34 56 78",
  deliveryAddress: "Testvej 1, 8000 Aarhus C",
  baseInterval: "Hver 2. uge",
  startWeek: "Uge 2",
  fixedWeekdays: "1",
  fixedEmployeeId: 3,
  tasks: [task()],
  ...overrides,
});

test("projekterer abonnementets rytme og opgaverytme uden at mutere input", () => {
  const input = Object.freeze([
    Object.freeze(subscription({
      tasks: Object.freeze([
        Object.freeze(task()),
        Object.freeze(task({ id: 11, description: "Indvendig polering", intervalMultiplier: "Hver 2. gang", startWeek: "Uge 4" })),
        Object.freeze(task({ id: 12, description: "Kun efter aftale", intervalMultiplier: "På anmodning" })),
      ]),
    })),
  ]);

  const visits = projectSubscriptionVisits(input, {
    referenceDate: new Date("2026-01-05T12:00:00Z"),
    horizonWeeks: 8,
    holidays: [],
  });

  assert.deepEqual(visits.map((visit) => ({
    week: visit.week,
    taskIds: visit.tasks.map((item) => item.id),
  })), [
    { week: "2026-01-05", taskIds: [10] },
    { week: "2026-01-19", taskIds: [10, 11] },
    { week: "2026-02-02", taskIds: [10] },
    { week: "2026-02-16", taskIds: [10, 11] },
    { week: "2026-03-02", taskIds: [10] },
  ]);
});

test("udelader ferieuger og inaktive abonnementer, men arver ikke gamle kalender-sletninger", () => {
  const visits = projectSubscriptionVisits([
    subscription(),
    subscription({ id: 2, displayNo: 102, active: false }),
  ], {
    referenceDate: new Date("2026-01-05T12:00:00Z"),
    horizonWeeks: 6,
    holidays: [{ startWeek: new Date("2026-01-19T00:00:00Z"), endWeek: new Date("2026-01-19T00:00:00Z") }],
  });

  assert.deepEqual(visits.map((visit) => visit.week), ["2026-01-05", "2026-02-02", "2026-02-16"]);
  assert.ok(visits.every((visit) => visit.subscriptionId === 1));
});

test("pure preview kræver ingen write-klient eller mutations-callback", () => {
  const before = structuredClone(subscription());
  const source = subscription();

  const visits = projectSubscriptionVisits([source], {
    referenceDate: new Date("2026-01-05T12:00:00Z"),
    horizonWeeks: 0,
    holidays: [],
  });

  assert.equal(visits.length, 1);
  assert.deepEqual(source, before);
});
