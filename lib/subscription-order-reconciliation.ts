import { projectSubscriptionVisits, mondayOf, ymd, type PreviewHoliday } from "./subscription-preview";

const WEEK_MS = 7 * 864e5;
const PENDING = "Afventer levering";

type TemplateTask = {
  id: number; category: string; letter: string; color: string; description: string; price: number;
  durationMin: number; customerPresenceRequired: boolean; isStandardTask: boolean;
  intervalMultiplier: string | null; startWeek: string | null; pauseActive: boolean;
  pauseStart: string | null; pauseEnd: string | null; pauseYearly: boolean; weekdays?: string | null; sort: number;
};
type Subscription = {
  id: number; displayNo: number; contactId: number; customer: string; phone: string | null;
  deliveryAddress: string; baseInterval: string; startWeek: string | null; fixedWeekdays: string | null;
  fixedEmployee: string; fixedEmployeeId: number | null; active: boolean; tasks: TemplateTask[];
};
type OrderTask = TemplateTask & { orderId?: number | null; fromSubscription?: boolean };
export type ReconcileOrder = {
  id: number; contactId: number; deliveryAddress: string; plannedAt: Date; startAt: Date | null;
  status: string; sourceType: string; subscriptionId: number | null; employeeId: number | null;
  lockedFully: boolean; sourceWeek: Date | null; tasks: OrderTask[];
};
type WeekSkip = { id: number; subscriptionId: number; week: Date };
export type ReconcileInput = {
  referenceDate: Date; horizonWeeks: number; subscriptions: Subscription[]; orders: ReconcileOrder[];
  weekSkips: WeekSkip[]; holidays: PreviewHoliday[];
};
type Desired = {
  subscriptionId: number; contactId: number; deliveryAddress: string; employeeId: number | null;
  sourceWeek: string; tasks: TemplateTask[];
};
export type ReconcileAction = {
  kind: "create" | "update" | "delete" | "locked"; orderId: number | null; subscriptionId: number;
  sourceWeek: string; reasons: string[]; desired?: Desired; preserve?: { plannedAt: true; startAt: true; sourceWeek: boolean };
};
export type ReconcilePlan = {
  version: "subscription-order-reconcile-v1"; cutoffWeek: string; horizonEndExclusive: string;
  actions: ReconcileAction[]; summary: Record<ReconcileAction["kind"], number>;
  classifications: { completed: number; currentWeek: number; movedFromHistory: number; tombstoned: number; nonSubscription: number };
};

const canonicalTask = (task: TemplateTask | OrderTask) => ({
  category: task.category, letter: task.letter, color: task.color, description: task.description,
  price: task.price, durationMin: task.durationMin, customerPresenceRequired: task.customerPresenceRequired,
  isStandardTask: task.isStandardTask, intervalMultiplier: task.intervalMultiplier, startWeek: task.startWeek,
  sort: task.sort,
});
const canonicalTasks = (tasks: (TemplateTask | OrderTask)[]) => JSON.stringify([...tasks].sort((a, b) => a.sort - b.sort).map(canonicalTask));
const weekOf = (order: ReconcileOrder) => ymd(mondayOf(order.sourceWeek ?? order.plannedAt));

export function planSubscriptionOrderReconciliation(input: ReconcileInput): ReconcilePlan {
  const currentMonday = mondayOf(input.referenceDate);
  const cutoff = new Date(currentMonday.getTime() + WEEK_MS);
  const horizonEnd = new Date(currentMonday.getTime() + Math.max(0, input.horizonWeeks) * WEEK_MS);
  const cutoffWeek = ymd(cutoff), horizonEndExclusive = ymd(horizonEnd);
  const subById = new Map(input.subscriptions.map((sub) => [sub.id, sub]));
  const skips = new Set(input.weekSkips.map((skip) => `${skip.subscriptionId}:${ymd(mondayOf(skip.week))}`));
  const visits = projectSubscriptionVisits(input.subscriptions.map((sub) => ({ ...sub, fixedEmployeeId: sub.fixedEmployeeId })), {
    referenceDate: input.referenceDate, horizonWeeks: input.horizonWeeks, holidays: input.holidays,
  });
  const desired = new Map<string, Desired>();
  for (const visit of visits) {
    if (visit.week < cutoffWeek || visit.week >= horizonEndExclusive || skips.has(`${visit.subscriptionId}:${visit.week}`)) continue;
    const sub = subById.get(visit.subscriptionId)!;
    desired.set(`${sub.id}:${visit.week}`, {
      subscriptionId: sub.id, contactId: sub.contactId, deliveryAddress: sub.deliveryAddress,
      employeeId: sub.fixedEmployeeId, sourceWeek: visit.week,
      tasks: visit.tasks.map((task) => sub.tasks.find((candidate) => candidate.id === task.id)!),
    });
  }

  const actions: ReconcileAction[] = [];
  const relevantTombstones = input.weekSkips.filter((skip) => {
    const week = ymd(mondayOf(skip.week));
    return week >= cutoffWeek && week < horizonEndExclusive;
  }).length;
  const classifications = { completed: 0, currentWeek: 0, movedFromHistory: 0, tombstoned: relevantTombstones, nonSubscription: 0 };
  const claimed = new Set<string>();
  for (const order of input.orders) {
    if (order.sourceType !== "subscription" || order.subscriptionId == null) { classifications.nonSubscription++; continue; }
    const sourceWeek = weekOf(order);
    const key = `${order.subscriptionId}:${sourceWeek}`;
    if (claimed.has(key)) throw new Error(`Duplicate subscription/sourceWeek encountered: ${key}`);
    claimed.add(key);
    if (sourceWeek < cutoffWeek) {
      if (ymd(mondayOf(order.plannedAt)) >= cutoffWeek) classifications.movedFromHistory++;
      else classifications.currentWeek++;
      continue;
    }
    if (order.status !== PENDING) { classifications.completed++; desired.delete(key); continue; }
    if (sourceWeek >= horizonEndExclusive) continue;
    if (skips.has(key)) {
      actions.push({ kind: "delete", orderId: order.id, subscriptionId: order.subscriptionId, sourceWeek, reasons: ["tombstoned"] });
      continue;
    }
    const target = desired.get(key);
    if (!target) {
      actions.push({ kind: "delete", orderId: order.id, subscriptionId: order.subscriptionId, sourceWeek, reasons: [subById.get(order.subscriptionId)?.active ? "notDue" : "inactiveSubscription"] });
      continue;
    }
    desired.delete(key);
    const reasons: string[] = [];
    if (order.contactId !== target.contactId) reasons.push("contactId");
    if (order.deliveryAddress !== target.deliveryAddress) reasons.push("deliveryAddress");
    if (order.employeeId !== target.employeeId) reasons.push("employeeId");
    if (order.sourceWeek == null) reasons.push("sourceWeek");
    if (canonicalTasks(order.tasks) !== canonicalTasks(target.tasks)) reasons.push("tasks");
    if (reasons.length) actions.push({
      kind: "update", orderId: order.id, subscriptionId: order.subscriptionId,
      sourceWeek, reasons, desired: target, preserve: { plannedAt: true, startAt: true, sourceWeek: order.sourceWeek != null },
    });
  }
  for (const target of desired.values()) actions.push({ kind: "create", orderId: null, subscriptionId: target.subscriptionId, sourceWeek: target.sourceWeek, reasons: ["missing"], desired: target });
  actions.sort((a, b) => a.sourceWeek.localeCompare(b.sourceWeek) || a.subscriptionId - b.subscriptionId || (a.orderId ?? 0) - (b.orderId ?? 0));
  return {
    version: "subscription-order-reconcile-v1", cutoffWeek, horizonEndExclusive, actions,
    summary: { create: actions.filter((a) => a.kind === "create").length, update: actions.filter((a) => a.kind === "update").length, delete: actions.filter((a) => a.kind === "delete").length, locked: actions.filter((a) => a.kind === "locked").length },
    classifications,
  };
}

export type Fixture = { orders: ReconcileOrder[]; nextOrderId: number };
export function applyPlanToFixture(fixture: Fixture, plan: ReconcilePlan): Fixture {
  const result = structuredClone(fixture);
  for (const action of plan.actions) {
    if (action.kind === "locked") continue;
    if (action.kind === "delete") result.orders = result.orders.filter((order) => order.id !== action.orderId);
    if (action.kind === "update") {
      const order = result.orders.find((item) => item.id === action.orderId)!;
      const target = action.desired!;
      order.contactId = target.contactId; order.deliveryAddress = target.deliveryAddress; order.employeeId = target.employeeId;
      if (!action.preserve?.sourceWeek) order.sourceWeek = new Date(`${target.sourceWeek}T00:00:00.000Z`);
      order.tasks = target.tasks.map((task) => ({ ...task, orderId: order.id, fromSubscription: true }));
    }
    if (action.kind === "create") {
      const target = action.desired!; const id = result.nextOrderId++;
      result.orders.push({ id, contactId: target.contactId, deliveryAddress: target.deliveryAddress,
        plannedAt: new Date(`${target.sourceWeek}T10:00:00.000Z`), startAt: null, status: PENDING,
        sourceType: "subscription", subscriptionId: target.subscriptionId, employeeId: target.employeeId,
        lockedFully: false, sourceWeek: new Date(`${target.sourceWeek}T00:00:00.000Z`),
        tasks: target.tasks.map((task) => ({ ...task, orderId: id, fromSubscription: true })) });
    }
  }
  return result;
}
export function rollbackFixture(_current: Fixture, backup: Fixture): Fixture { return structuredClone(backup); }
