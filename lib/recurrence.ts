// Subscription → order recurrence. Materialises the upcoming orders for active
// subscriptions from the base interval + per-task interval multiplier + start
// week, so the calendar reflects recurring work automatically. Idempotent:
// re-running skips weeks that already have an order for the subscription, and
// skips holiday weeks. Server-only (Node) — used by the subscription actions,
// the manual "Generér" button and the nightly /api/plan cron.
import { prisma } from "./db";
import { Prisma } from "@prisma/client";

const WEEK_MS = 7 * 864e5;
const DEFAULT_HORIZON_WEEKS = 26;

/** Monday (UTC midnight) of ISO week `week` in `year`. */
function mondayOfIsoWeek(year: number, week: number): Date {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Weekday = (jan4.getUTCDay() + 6) % 7; // 0 = Monday
  const week1Monday = jan4.getTime() - jan4Weekday * 864e5;
  return new Date(week1Monday + (week - 1) * WEEK_MS);
}

/** Monday (UTC midnight) of the ISO week containing `d`. */
function mondayOf(d: Date): Date {
  const wd = (d.getUTCDay() + 6) % 7;
  const midnight = Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
  return new Date(midnight - wd * 864e5);
}

/** "Hver uge" → 1, "Hver 2. uge" → 2, … Floored at 1: a 0/garbage interval
 *  would make `step` 0 and hang order generation in an infinite loop. */
function parseBaseInterval(label: string): number {
  const m = label.match(/Hver\s+(\d+)\.\s*uge/i);
  if (m) return Math.max(1, Number(m[1]));
  return 1;
}

/** "Hver gang" → 1, "Hver 2. gang" → 2, "På anmodning" → null (not auto-scheduled). */
function parseMultiplier(label: string | null): number | null {
  if (!label) return 1;
  if (/anmodning/i.test(label)) return null;
  const m = label.match(/Hver\s+(\d+)\.\s*gang/i);
  if (m) return Math.max(1, Number(m[1]));
  return 1;
}

/** "Uge 29" → 29 (year-less; resolved against a reference year). */
function parseWeekLabel(label: string | null): number | null {
  if (!label) return null;
  const m = label.match(/Uge\s+(\d+)/i);
  return m ? Number(m[1]) : null;
}

type SubWithTasks = Awaited<ReturnType<typeof loadActiveSubs>>[number];
function loadActiveSubs() {
  return prisma.subscription.findMany({ where: { active: true }, include: { tasks: true } });
}

async function defaultEmployeeId(fixedEmployee: string): Promise<number | null> {
  // Kun aktive brugere — en deaktiveret medarbejder må hverken navne-matches
  // eller være første-bruger-fallback for nye abonnements-ordrer.
  const users = await prisma.user.findMany({ where: { active: true }, orderBy: { id: "asc" } });
  if (fixedEmployee && fixedEmployee !== "Ingen") {
    const match = users.find((u) => `${u.firstName} ${u.lastName}` === fixedEmployee);
    if (match) return match.id;
  }
  return users[0]?.id ?? null;
}

/** Generate the upcoming orders for one subscription. Returns the count created. */
export async function generateForSubscription(sub: SubWithTasks, ref: Date = new Date(), horizonWeeks = DEFAULT_HORIZON_WEEKS): Promise<number> {
  const base = parseBaseInterval(sub.baseInterval);
  const subWeek = parseWeekLabel(sub.startWeek);
  if (subWeek == null) return 0;

  const step = base * WEEK_MS;
  const thisMonday = mondayOf(ref).getTime();
  const horizonEnd = thisMonday + horizonWeeks * WEEK_MS;
  const refYear = ref.getUTCFullYear();

  // Anchor at week N. The label is year-less, so if this year's occurrence is
  // beyond the planning horizon the subscription is an ongoing one carried over
  // from a previous year — anchor there so the rhythm continues without a
  // year-boundary gap. (The rhythm phase is week-N, independent of which year.)
  let anchor = mondayOfIsoWeek(refYear, subWeek).getTime();
  if (anchor > horizonEnd) anchor = mondayOfIsoWeek(refYear - 1, subWeek).getTime();

  // Per task: its multiplier m and the visit offset j0 from the subscription
  // start, derived purely from the week-number difference (year-independent).
  const tasks = sub.tasks.map((t) => ({
    t,
    m: parseMultiplier(t.intervalMultiplier),
    j0: Math.round(((parseWeekLabel(t.startWeek) ?? subWeek) - subWeek) / base),
  }));

  // Existing orders keyed by the week they were generated FOR (sourceWeek) —
  // NOT their current plannedAt: a moved order must keep claiming its rhythm
  // week, otherwise the nightly run re-creates it and double-books the customer.
  // (plannedAt-fallback covers rows from before the sourceWeek migration.)
  const existing = await prisma.order.findMany({ where: { subscriptionId: sub.id }, select: { plannedAt: true, sourceWeek: true } });
  const existingWeeks = new Set(existing.map((o) => (o.sourceWeek ?? mondayOf(o.plannedAt)).getTime()));

  // Tombstones: uger hvor brugeren har SLETTET abonnements-ordren — genopliv aldrig.
  const skips = await prisma.subscriptionWeekSkip.findMany({ where: { subscriptionId: sub.id }, select: { week: true } });
  for (const s of skips) existingWeeks.add(mondayOf(s.week).getTime());

  const holidays = await prisma.holidayWeek.findMany();
  const isHoliday = (ms: number) => holidays.some((h) => ms >= h.startWeek.getTime() && ms <= h.endWeek.getTime());

  const employeeId = await defaultEmployeeId(sub.fixedEmployee);

  // First visit at or after the current week, keeping the base rhythm.
  let v = anchor;
  if (v < thisMonday) v += Math.ceil((thisMonday - v) / step) * step;

  let created = 0;
  for (; v <= horizonEnd; v += step) {
    if (isHoliday(v) || existingWeeks.has(v)) continue;

    // Tasks due at this visit index (i base-steps from the anchor): a task recurs
    // every m visits from its own offset j0. "På anmodning" (m == null) is skipped.
    const i = Math.round((v - anchor) / step);
    const due = tasks.filter((x) => x.m != null && i >= x.j0 && (i - x.j0) % x.m === 0).map((x) => x.t);
    if (!due.length) continue;

    try {
      await prisma.order.create({
        data: {
          contactId: sub.contactId,
          deliveryAddress: sub.deliveryAddress,
          plannedAt: new Date(v + 10 * 3600 * 1000), // Monday 10:00 UTC
          sourceWeek: new Date(v),                   // rytme-ugen — dedup-nøgle, flytning rører den ikke
          sourceType: "subscription",
          subscriptionId: sub.id,
          employeeId,
          tasks: {
            create: due.map((t, i) => ({
              category: t.category, letter: t.letter, color: t.color,
              description: t.description, price: t.price, durationMin: t.durationMin,
              intervalMultiplier: t.intervalMultiplier, startWeek: t.startWeek,
              isStandardTask: t.isStandardTask, fromSubscription: true, sort: i,
            })),
          },
        },
      });
    } catch (e) {
      // Unique (subscriptionId, sourceWeek): en parallel generering (cron +
      // manuel knap) nåede ugen først — det ER idempotens, spring videre.
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") { existingWeeks.add(v); continue; }
      throw e;
    }
    existingWeeks.add(v);
    created++;
  }
  return created;
}

/** Generate upcoming orders for every active subscription. Returns total created. */
export async function generateAllSubscriptionOrders(ref: Date = new Date(), horizonWeeks = DEFAULT_HORIZON_WEEKS): Promise<number> {
  const subs = await loadActiveSubs();
  let total = 0;
  for (const sub of subs) total += await generateForSubscription(sub, ref, horizonWeeks);
  return total;
}

/** Generate for a single subscription id (used after create/edit). */
export async function generateForSubscriptionId(id: number, ref: Date = new Date(), horizonWeeks = DEFAULT_HORIZON_WEEKS): Promise<number> {
  const sub = await prisma.subscription.findUnique({ where: { id }, include: { tasks: true } });
  if (!sub || !sub.active) return 0;
  return generateForSubscription(sub, ref, horizonWeeks);
}

/**
 * Propagate a subscription edit to its future orders: delete the sub's orders in
 * NEXT week onward that are still pending and not locked (history, completed and
 * locked orders, and the current week's plan, are left untouched), then
 * regenerate from the updated template.
 */
export async function regenerateFutureOrders(id: number, ref: Date = new Date(), horizonWeeks = DEFAULT_HORIZON_WEEKS): Promise<number> {
  const nextMonday = new Date(mondayOf(ref).getTime() + WEEK_MS);
  const stale = await prisma.order.findMany({
    where: { subscriptionId: id, plannedAt: { gte: nextMonday }, status: "Afventer levering", lockedFully: false },
    select: { id: true },
  });
  const ids = stale.map((o) => o.id);
  if (ids.length) {
    await prisma.$transaction([
      prisma.taskLine.deleteMany({ where: { orderId: { in: ids } } }),
      prisma.order.deleteMany({ where: { id: { in: ids } } }),
    ]);
  }
  return generateForSubscriptionId(id, ref, horizonWeeks);
}
