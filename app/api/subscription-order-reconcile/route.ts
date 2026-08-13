import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getSessionUser, unauthorized } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import { getSubscriptionOrderAudit } from "@/lib/subscription-order-audit";
import { planSubscriptionOrderReconciliation } from "@/lib/subscription-order-reconciliation";

export const dynamic = "force-dynamic";
const REFERENCE_DATE = new Date("2026-08-13T12:00:00.000Z");
const HORIZON_WEEKS = 26;
const CONFIRM = "APPLY_ALL_FUTURE_SUBSCRIPTION_ORDERS";
const stable = (value: unknown) => JSON.stringify(value, (_key, item) => item instanceof Date ? item.toISOString() : item);
const hash = (value: unknown) => createHash("sha256").update(stable(value)).digest("hex");

function reviveAudit(source: Awaited<ReturnType<typeof getSubscriptionOrderAudit>>) {
  const employee = new Map(source.users.map((user) => [user.name, user.id]));
  const fallbackEmployeeId = source.users.find((user) => user.active)?.id ?? null;
  return {
    subscriptions: source.subscriptions.map((sub) => ({
      ...sub,
      customer: sub.contact.name,
      phone: null,
      fixedEmployeeId: sub.fixedEmployee !== "Ingen" ? employee.get(sub.fixedEmployee) ?? fallbackEmployeeId : fallbackEmployeeId,
    })),
    orders: source.orders,
    weekSkips: source.skips,
    holidays: source.holidays,
  };
}

const taskData = (task: NonNullable<ReturnType<typeof planSubscriptionOrderReconciliation>["actions"][number]["desired"]>["tasks"][number], orderId: number) => ({
  category: task.category,
  letter: task.letter,
  color: task.color,
  description: task.description,
  price: task.price,
  durationMin: task.durationMin,
  customerPresenceRequired: task.customerPresenceRequired,
  isStandardTask: task.isStandardTask,
  fromSubscription: true,
  intervalMultiplier: task.intervalMultiplier,
  startWeek: task.startWeek,
  pauseActive: task.pauseActive,
  pauseStart: task.pauseStart,
  pauseEnd: task.pauseEnd,
  pauseYearly: task.pauseYearly,
  sort: task.sort,
  orderId,
});

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (!user.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const body = await request.json().catch(() => null) as { confirm?: string; snapshotHash?: string } | null;
  if (body?.confirm !== CONFIRM || !body.snapshotHash) return NextResponse.json({ error: "Confirmation and snapshot hash required" }, { status: 400 });

  const result = await prisma.$transaction(async (tx) => {
    const source = await getSubscriptionOrderAudit(REFERENCE_DATE, HORIZON_WEEKS, tx);
    if (source.snapshotHash !== body.snapshotHash) throw new Error("Snapshot changed; apply refused before mutation");
    const input = reviveAudit(source);
    const plan = planSubscriptionOrderReconciliation({
      referenceDate: REFERENCE_DATE,
      horizonWeeks: HORIZON_WEEKS,
      subscriptions: input.subscriptions,
      orders: input.orders,
      weekSkips: input.weekSkips,
      holidays: input.holidays,
    });
    if (plan.actions.some((action) => action.kind === "locked")) throw new Error("Unresolved locked actions; apply refused");
    const planHash = hash(plan);
    const run = await tx.orderReconciliationRun.create({ data: {
      snapshotHash: source.snapshotHash,
      planHash,
      snapshot: stable(source),
      plan: stable(plan),
      createdOrderIds: "[]",
    } });
    const createdOrderIds: number[] = [];
    for (const action of plan.actions) {
      if (action.kind === "delete") {
        await tx.taskLine.deleteMany({ where: { orderId: action.orderId! } });
        await tx.order.delete({ where: { id: action.orderId! } });
      } else if (action.kind === "update") {
        const target = action.desired!;
        await tx.taskLine.deleteMany({ where: { orderId: action.orderId! } });
        await tx.order.update({ where: { id: action.orderId! }, data: {
          contactId: target.contactId,
          deliveryAddress: target.deliveryAddress,
          employeeId: target.employeeId,
          sourceWeek: new Date(`${target.sourceWeek}T00:00:00.000Z`),
        } });
        await tx.taskLine.createMany({ data: target.tasks.map((task) => taskData(task, action.orderId!)) });
      } else if (action.kind === "create") {
        const target = action.desired!;
        const created = await tx.order.create({ data: {
          contactId: target.contactId,
          deliveryAddress: target.deliveryAddress,
          plannedAt: new Date(`${target.sourceWeek}T10:00:00.000Z`),
          sourceWeek: new Date(`${target.sourceWeek}T00:00:00.000Z`),
          status: "Afventer levering",
          sourceType: "subscription",
          subscriptionId: target.subscriptionId,
          employeeId: target.employeeId,
        } });
        createdOrderIds.push(created.id);
        await tx.taskLine.createMany({ data: target.tasks.map((task) => taskData(task, created.id)) });
      }
    }
    await tx.orderReconciliationRun.update({ where: { id: run.id }, data: { createdOrderIds: JSON.stringify(createdOrderIds) } });
    return { runId: run.id, snapshotHash: source.snapshotHash, planHash, summary: plan.summary, actionCount: plan.actions.length, createdOrderIds };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 120000 });

  return NextResponse.json(result, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
