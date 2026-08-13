import test from "node:test";
import assert from "node:assert/strict";
import {
  buildRecurrenceReconciliationPlan,
  type ReconciliationOrder,
  type ReconciliationSubscription,
} from "../lib/recurrence-reconciliation";
import { assertRecurrenceBackupGate } from "../lib/subscription-order-consistency";

const task = (overrides: Record<string, unknown> = {}) => ({
  id: 10, category: "Vinduer", letter: "V", color: "#123456", description: "Pudsning",
  price: 500, durationMin: 60, intervalMultiplier: "Hver gang", startWeek: "Uge 33",
  isStandardTask: false, pauseActive: false, pauseStart: null, pauseEnd: null, pauseYearly: true,
  ...overrides,
});
const subscription = (overrides: Record<string, unknown> = {}): ReconciliationSubscription => ({
  id: 1, contactId: 7, deliveryAddress: "Testvej 1", baseInterval: "Hver 1. uge",
  startWeek: "Uge 33", fixedEmployeeId: 3, active: true, tasks: [task()], ...overrides,
} as ReconciliationSubscription);
const order = (week: string, overrides: Record<string, unknown> = {}): ReconciliationOrder => ({
  id: 100, subscriptionId: 1, sourceWeek: new Date(`${week}T00:00:00Z`),
  plannedAt: new Date(`${week}T10:00:00Z`), status: "Afventer levering", lockedFully: false,
  contactId: 7, deliveryAddress: "Testvej 1", employeeId: 3, sourceType: "subscription",
  tasks: [task({ id: 1000 })], ...overrides,
} as ReconciliationOrder);
const plan = (subs: ReconciliationSubscription[], orders: ReconciliationOrder[], options: Record<string, unknown> = {}) =>
  buildRecurrenceReconciliationPlan({ subscriptions: subs, orders, tombstones: [], holidays: [] }, {
    referenceDate: new Date("2026-08-10T12:00:00Z"), horizonWeeks: 4, ...options,
  });

test("52-week subscription does not inherit a stale weekly series", () => {
  const stale = ["2026-08-10", "2026-08-17", "2026-08-24", "2026-08-31"].map((w, i) => order(w, { id: 100 + i }));
  const result = plan([subscription({ baseInterval: "Hver 52. uge" })], stale);
  assert.deepEqual(result.expectedWeeks, ["1:2026-08-10"]);
  assert.deepEqual(result.deletes.map((x) => x.orderId), [101, 102, 103]);
});

test("authoritative task duration, employee and pause changes update even fully locked imported future rows", () => {
  const authoritative = subscription({
    fixedEmployeeId: 9,
    tasks: [task({ durationMin: 25, pauseActive: true, pauseStart: "2026-08-17", pauseEnd: "2026-08-17", pauseYearly: false })],
  });
  const existing = [
    order("2026-08-10", { lockedFully: true, employeeId: 3, tasks: [task({ id: 1000, durationMin: 90 })] }),
    order("2026-08-17", { id: 101, lockedFully: true }),
  ];
  const result = plan([authoritative], existing);
  assert.deepEqual(result.updates.map((x) => [x.orderId, x.employeeId, x.tasks[0].durationMin]), [[100, 9, 25]]);
  assert.deepEqual(result.deletes.map((x) => x.orderId), [101]);
  assert.equal(result.updates[0].preservePlannedAt, true);
});

test("missing subscription duration stays zero in regenerated task rows", () => {
  const result = plan([subscription({ tasks: [task({ durationMin: 0 })] })], []);
  assert.equal(result.creates[0].tasks[0].durationMin, 0);
});

test("duplicates are deterministic, missing orders are created, and apply plan is idempotent", () => {
  const duplicate = order("2026-08-10", { id: 90 });
  const result = plan([subscription()], [order("2026-08-10", { id: 100 }), duplicate]);
  assert.equal(result.deletes[0].orderId, 100);
  assert.equal(result.creates.length, 3);
  const materialized = result.expected.map((expected, index) => order(expected.sourceWeek.toISOString().slice(0, 10), {
    id: 200 + index, plannedAt: expected.plannedAt, employeeId: expected.employeeId,
    contactId: expected.contactId, deliveryAddress: expected.deliveryAddress,
    tasks: expected.tasks.map((t, i) => ({ ...t, id: 500 + i })),
  }));
  const second = plan([subscription()], materialized);
  assert.equal(second.changes, 0);
});

test("duplicate cleanup prefers the intentionally moved sourceWeek claimant", () => {
  const moved = order("2026-08-10", { id: 100, plannedAt: new Date("2026-08-13T10:00:00Z") });
  const importedDuplicate = order("2026-08-10", { id: 90, lockedFully: true });
  const result = plan([subscription()], [importedDuplicate, moved]);
  assert.deepEqual(result.deletes.map(x => x.orderId), [90]);
  assert.equal(result.updates.length, 0);
});

test("manual move keeps plannedAt while sourceWeek claims the recurrence slot", () => {
  const moved = order("2026-08-10", { plannedAt: new Date("2026-08-13T10:00:00Z") });
  const result = plan([subscription()], [moved]);
  assert.equal(result.updates.length, 0);
  assert.equal(result.creates.some((x) => x.sourceWeek.toISOString().startsWith("2026-08-10")), false);
});

test("tombstones and holidays suppress expected orders", () => {
  const result = buildRecurrenceReconciliationPlan({
    subscriptions: [subscription()], orders: [],
    tombstones: [{ subscriptionId: 1, week: new Date("2026-08-17T00:00:00Z") }],
    holidays: [{ startWeek: new Date("2026-08-24T00:00:00Z"), endWeek: new Date("2026-08-24T00:00:00Z") }],
  }, { referenceDate: new Date("2026-08-10T12:00:00Z"), horizonWeeks: 4 });
  assert.deepEqual(result.expectedWeeks, ["1:2026-08-10", "1:2026-08-31"]);
});

test("year boundary and ISO week 53 remain in phase", () => {
  const result = buildRecurrenceReconciliationPlan({
    subscriptions: [subscription({ startWeek: "Uge 53", baseInterval: "Hver 2. uge", tasks: [task({ startWeek: "Uge 53" })] })],
    orders: [], tombstones: [], holidays: [],
  }, { referenceDate: new Date("2026-12-28T12:00:00Z"), horizonWeeks: 6 });
  assert.deepEqual(result.expectedWeeks, ["1:2026-12-28", "1:2027-01-11", "1:2027-01-25"]);
});

test("completed/history and non-subscription orders are outside remediation scope", () => {
  const result = plan([subscription()], [
    order("2026-08-10", { status: "Udført" }),
    order("2026-08-17", { id: 101, subscriptionId: null, sourceType: "manual" }),
  ]);
  assert.equal(result.deletes.length, 0);
  assert.equal(result.ignoredOrders, 2);
});

test("global apply is fail-closed until a verified backup proof exists", () => {
  const previous = process.env.RECURRENCE_RECONCILIATION_BACKUP_PROOF;
  delete process.env.RECURRENCE_RECONCILIATION_BACKUP_PROOF;
  assert.throws(() => assertRecurrenceBackupGate("anything"), /backup proof/i);
  process.env.RECURRENCE_RECONCILIATION_BACKUP_PROOF = "snapshot-2026-08-13";
  assert.throws(() => assertRecurrenceBackupGate("wrong"), /backup proof/i);
  assert.doesNotThrow(() => assertRecurrenceBackupGate("snapshot-2026-08-13"));
  if (previous == null) delete process.env.RECURRENCE_RECONCILIATION_BACKUP_PROOF;
  else process.env.RECURRENCE_RECONCILIATION_BACKUP_PROOF = previous;
});
