import test from "node:test";
import assert from "node:assert/strict";
import { planSubscriptionOrderReconciliation, applyPlanToFixture, rollbackFixture } from "../lib/subscription-order-reconciliation";

const task = (id: number, overrides: Record<string, unknown> = {}) => ({
  id, category: "Vinduer", letter: "V", color: "#123456", description: `Task ${id}`,
  price: 500, durationMin: 60, customerPresenceRequired: false, isStandardTask: false,
  intervalMultiplier: "Hver gang", startWeek: "Uge 34", pauseActive: false,
  pauseStart: null, pauseEnd: null, pauseYearly: true, sort: id,
  ...overrides,
});
const sub = (overrides: Record<string, unknown> = {}) => ({
  id: 1, displayNo: 1001, contactId: 7, customer: "Kunde", phone: null,
  deliveryAddress: "Ny adresse", baseInterval: "Hver 1. uge", startWeek: "Uge 34",
  fixedWeekdays: "1", fixedEmployee: "Ada Lovelace", fixedEmployeeId: 9,
  active: true, tasks: [task(11)], ...overrides,
});
const order = (overrides: Record<string, unknown> = {}) => ({
  id: 100, contactId: 7, deliveryAddress: "Gammel adresse",
  plannedAt: new Date("2026-08-17T10:00:00.000Z"), startAt: null,
  status: "Afventer levering", sourceType: "subscription", subscriptionId: 1,
  employeeId: 3, lockedFully: false, sourceWeek: new Date("2026-08-17T00:00:00.000Z"),
  tasks: [{ ...task(91), orderId: 100, fromSubscription: true }],
  ...overrides,
});
const input = (overrides: Record<string, unknown> = {}) => ({
  referenceDate: new Date("2026-08-13T12:00:00.000Z"), horizonWeeks: 2,
  subscriptions: [sub()], orders: [order()], weekSkips: [], holidays: [], ...overrides,
});

test("updates stale authoritative fields and tasks but preserves an intentional move", () => {
  const moved = order({ plannedAt: new Date("2026-08-19T10:00:00.000Z"), startAt: new Date("2026-08-19T08:30:00.000Z") });
  const plan = planSubscriptionOrderReconciliation(input({ orders: [moved] }));
  assert.equal(plan.cutoffWeek, "2026-08-17");
  assert.equal(plan.actions.length, 1);
  assert.deepEqual(plan.actions[0].kind, "update");
  assert.deepEqual(plan.actions[0].preserve, { plannedAt: true, startAt: true, sourceWeek: true });
  assert.deepEqual(plan.actions[0].reasons.sort(), ["deliveryAddress", "employeeId", "tasks"]);
});

test("backfills a missing legacy sourceWeek while preserving the placed date", () => {
  const legacy = order({ sourceWeek: null, plannedAt: new Date("2026-08-19T10:00:00.000Z") });
  const plan = planSubscriptionOrderReconciliation(input({ orders: [legacy] }));
  assert.equal(plan.actions[0].kind, "update");
  assert.equal(plan.actions[0].sourceWeek, "2026-08-17");
  assert.deepEqual(plan.actions[0].reasons.sort(), ["deliveryAddress", "employeeId", "sourceWeek", "tasks"]);
  assert.deepEqual(plan.actions[0].preserve, { plannedAt: true, startAt: true, sourceWeek: false });
});

test("repairs locked future rows but preserves completed, current-week, tombstoned, and moved-from-history orders", () => {
  const plan = planSubscriptionOrderReconciliation(input({
    horizonWeeks: 4,
    orders: [
      order({ id: 1, lockedFully: true }),
      order({ id: 2, status: "Udført", plannedAt: new Date("2026-08-24T10:00:00Z"), sourceWeek: new Date("2026-08-24T00:00:00Z") }),
      order({ id: 3, plannedAt: new Date("2026-08-13T10:00:00Z"), sourceWeek: new Date("2026-08-10T00:00:00Z") }),
      order({ id: 4, plannedAt: new Date("2026-08-20T10:00:00Z"), sourceWeek: new Date("2026-08-03T00:00:00Z") }),
    ],
    weekSkips: [{ id: 8, subscriptionId: 1, week: new Date("2026-08-31T00:00:00Z") }],
  }));
  assert.deepEqual(plan.actions.map((a) => [a.orderId, a.kind]), [[1, "update"]]);
  assert.equal(plan.summary.create, 0);
  assert.equal(plan.classifications.completed, 1);
  assert.equal(plan.classifications.currentWeek, 1);
  assert.equal(plan.classifications.movedFromHistory, 1);
  assert.equal(plan.classifications.tombstoned, 1);
});

test("removes locked future rows whose recurrence slot is no longer due", () => {
  const stale = order({ id: 40, lockedFully: true, sourceWeek: new Date("2026-08-24T00:00:00Z"), plannedAt: new Date("2026-08-24T10:00:00Z") });
  const plan = planSubscriptionOrderReconciliation(input({ subscriptions: [sub({ baseInterval: "Hver 52. uge" })], orders: [stale], horizonWeeks: 4 }));
  assert.deepEqual(plan.actions.map((a) => [a.orderId, a.kind, a.reasons]), [
    [null, "create", ["missing"]],
    [40, "delete", ["notDue"]],
  ]);
});

test("deletes stale in-window pending rows, creates missing expected rows, and is idempotent", () => {
  const stale = order({ id: 20, sourceWeek: new Date("2026-08-24T00:00:00Z"), plannedAt: new Date("2026-08-24T10:00:00Z") });
  const plan = planSubscriptionOrderReconciliation(input({
    subscriptions: [sub({ baseInterval: "Hver 2. uge" })], orders: [stale], horizonWeeks: 3,
  }));
  assert.deepEqual(plan.actions.map((a) => [a.kind, a.sourceWeek]), [["create", "2026-08-17"], ["delete", "2026-08-24"]]);
  const fixture = { orders: [stale], nextOrderId: 101 };
  const applied = applyPlanToFixture(fixture, plan);
  const second = planSubscriptionOrderReconciliation(input({ subscriptions: [sub({ baseInterval: "Hver 2. uge" })], orders: applied.orders, horizonWeeks: 3 }));
  assert.deepEqual(second.actions, []);
});

test("fixture rollback restores an exact canonical snapshot", () => {
  const before = { orders: [order()], nextOrderId: 101 };
  const plan = planSubscriptionOrderReconciliation(input());
  const applied = applyPlanToFixture(before, plan);
  const restored = rollbackFixture(applied, before);
  assert.deepEqual(restored, before);
});

test("rejects duplicate sourceWeek rows instead of guessing", () => {
  assert.throws(() => planSubscriptionOrderReconciliation(input({ orders: [order({ id: 1 }), order({ id: 2 })] })), /duplicate/i);
});
