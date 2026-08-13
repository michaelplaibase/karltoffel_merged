import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "./db";
import {
  buildRecurrenceReconciliationPlan,
  type ReconciliationInput,
  type ReconciliationOrder,
  type ReconciliationPlan,
  type ReconciliationSubscription,
} from "./recurrence-reconciliation";

type Db = Prisma.TransactionClient | PrismaClient;
export type AuditOptions = { referenceDate?: Date; horizonWeeks?: number; subscriptionId?: number };
export type ApplyOptions = AuditOptions & { backupProof: string };

function nextMonday(referenceDate: Date): Date {
  const wd = (referenceDate.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(referenceDate.getUTCFullYear(), referenceDate.getUTCMonth(), referenceDate.getUTCDate()) + (7 - wd) * 864e5);
}
async function employeeMap(db: Db, fixedNames: string[]): Promise<Map<string, number>> {
  const wanted = new Set(fixedNames.filter(name => name && name !== "Ingen"));
  const users = await db.user.findMany({ where: { active: true }, select: { id: true, firstName: true, lastName: true }, orderBy: { id: "asc" } });
  const fallback = users[0]?.id;
  const map = new Map<string, number>();
  for (const user of users) { const name = `${user.firstName} ${user.lastName}`; if (wanted.has(name)) map.set(name, user.id); }
  if (fallback != null) map.set("Ingen", fallback);
  return map;
}
async function loadInput(db: Db, options: AuditOptions): Promise<ReconciliationInput> {
  const where = { active: true, ...(options.subscriptionId == null ? {} : { id: options.subscriptionId }) };
  const subscriptions = await db.subscription.findMany({ where, include: { tasks: { orderBy: { sort: "asc" } } }, orderBy: { id: "asc" } });
  const names = await employeeMap(db, subscriptions.map(s => s.fixedEmployee));
  const ids = subscriptions.map(s => s.id);
  const orders = ids.length ? await db.order.findMany({
    where: { subscriptionId: { in: ids } }, include: { tasks: { orderBy: { sort: "asc" } } }, orderBy: { id: "asc" },
  }) : [];
  const [tombstones, holidays] = await Promise.all([
    ids.length ? db.subscriptionWeekSkip.findMany({ where: { subscriptionId: { in: ids } } }) : [],
    db.holidayWeek.findMany({ orderBy: { startWeek: "asc" } }),
  ]);
  return {
    subscriptions: subscriptions.map((s): ReconciliationSubscription => ({
      id: s.id, contactId: s.contactId, deliveryAddress: s.deliveryAddress, baseInterval: s.baseInterval,
      startWeek: s.startWeek, fixedEmployeeId: names.get(s.fixedEmployee) ?? names.get("Ingen") ?? null,
      active: s.active, tasks: s.tasks,
    })),
    orders: orders as ReconciliationOrder[], tombstones, holidays,
  };
}

/** Read-only, all-customer consistency audit. No Prisma write method is called. */
export async function auditSubscriptionOrderConsistency(options: AuditOptions = {}, db: Db = prisma): Promise<ReconciliationPlan> {
  const referenceDate = options.referenceDate ?? nextMonday(new Date());
  return buildRecurrenceReconciliationPlan(await loadInput(db, options), { referenceDate, horizonWeeks: options.horizonWeeks ?? 26 });
}

export function assertRecurrenceBackupGate(proof: string): void {
  const expected = process.env.RECURRENCE_RECONCILIATION_BACKUP_PROOF;
  if (!expected || proof.length !== expected.length) throw new Error("A verified backup proof is required before recurrence reconciliation apply");
  let diff = 0; for (let i = 0; i < proof.length; i++) diff |= proof.charCodeAt(i) ^ expected.charCodeAt(i);
  if (diff !== 0) throw new Error("A verified backup proof is required before recurrence reconciliation apply");
}
async function applyPlan(tx: Prisma.TransactionClient, plan: ReconciliationPlan): Promise<void> {
  for (const change of plan.deletes) {
    await tx.taskLine.deleteMany({ where: { orderId: change.orderId } });
    await tx.order.delete({ where: { id: change.orderId } });
  }
  for (const change of plan.updates) {
    await tx.taskLine.deleteMany({ where: { orderId: change.orderId } });
    await tx.order.update({ where: { id: change.orderId }, data: {
      contactId: change.contactId, deliveryAddress: change.deliveryAddress, employeeId: change.employeeId,
      sourceType: "subscription", sourceWeek: change.sourceWeek,
      tasks: { create: change.tasks.map(t => ({ ...t, fromSubscription: true })) },
    } });
  }
  for (const change of plan.creates) await tx.order.create({ data: {
    subscriptionId: change.subscriptionId, contactId: change.contactId, deliveryAddress: change.deliveryAddress,
    plannedAt: change.plannedAt, sourceWeek: change.sourceWeek, employeeId: change.employeeId,
    sourceType: "subscription", tasks: { create: change.tasks.map(t => ({ ...t, fromSubscription: true })) },
  } });
}

/** Compose an authoritative subscription write and reconciliation atomically. */
export async function reconcileEditedSubscriptionInTransaction(
  tx: Prisma.TransactionClient,
  subscriptionId: number,
  referenceDate = nextMonday(new Date()),
): Promise<ReconciliationPlan> {
  const plan = await auditSubscriptionOrderConsistency({ subscriptionId, referenceDate, horizonWeeks: 26 }, tx);
  await applyPlan(tx, plan);
  return plan;
}

/**
 * Re-plans inside the same serializable transaction that applies it. A retry on
 * P2034 handles concurrent cron/edit races. Re-running after success is a no-op.
 */
export async function applySubscriptionOrderReconciliation(options: ApplyOptions): Promise<ReconciliationPlan> {
  assertRecurrenceBackupGate(options.backupProof);
  return reconcileInTransaction(options);
}

async function reconcileInTransaction(options: AuditOptions): Promise<ReconciliationPlan> {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await prisma.$transaction(async tx => {
        const plan = await auditSubscriptionOrderConsistency(options, tx);
        await applyPlan(tx, plan);
        return plan;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2034" || attempt === 2) throw error;
    }
  }
  throw new Error("unreachable");
}
