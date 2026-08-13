import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { planSubscriptionOrderReconciliation } from "../lib/subscription-order-reconciliation";

const path = process.argv[2];
if (!path) throw new Error("Usage: tsx scripts/plan-from-audit-snapshot.ts SNAPSHOT.json");
const raw = readFileSync(path, "utf8");
const source = JSON.parse(raw);
const users = new Map(source.users.map((u: any) => [u.name, u.id]));
const fallbackEmployeeId = source.users.find((u: any) => u.active)?.id ?? null;
const subscriptions = source.subscriptions.map((sub: any) => ({
  ...sub,
  customer: sub.contact.name,
  phone: null,
  fixedEmployeeId: sub.fixedEmployee !== "Ingen" ? users.get(sub.fixedEmployee) ?? fallbackEmployeeId : fallbackEmployeeId,
  createdAt: new Date(sub.createdAt),
}));
const orders = source.orders.map((order: any) => ({
  ...order,
  plannedAt: new Date(order.plannedAt),
  startAt: order.startAt ? new Date(order.startAt) : null,
  sourceWeek: order.sourceWeek ? new Date(order.sourceWeek) : null,
  createdAt: new Date(order.createdAt),
}));
const weekSkips = source.skips.map((skip: any) => ({ ...skip, week: new Date(skip.week), createdAt: new Date(skip.createdAt) }));
const holidays = source.holidays.map((holiday: any) => ({ ...holiday, startWeek: new Date(holiday.startWeek), endWeek: new Date(holiday.endWeek) }));
const plan = planSubscriptionOrderReconciliation({ referenceDate: new Date("2026-08-13T12:00:00Z"), horizonWeeks: 26, subscriptions, orders, weekSkips, holidays });
const canonical = JSON.stringify(plan, (_key, value) => value instanceof Date ? value.toISOString() : value);
console.log(JSON.stringify({
  snapshotHash: source.snapshotHash ?? null,
  planHash: createHash("sha256").update(canonical).digest("hex"),
  summary: plan.summary,
  classifications: plan.classifications,
  actionCount: plan.actions.length,
  affectedSubscriptions: new Set(plan.actions.map((action) => action.subscriptionId)).size,
  actions: plan.actions,
}, null, 2));
