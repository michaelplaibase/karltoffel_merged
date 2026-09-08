import { prisma } from "@/lib/db";
import { parseWeekLabelParts, generateForSubscriptionId } from "@/lib/recurrence";
import { weekMondayToday } from "@/lib/calendar";
import { weekLabel } from "@/lib/weeks";
import { isoWeek } from "@/lib/planner";

// Selvlærende data-reparation (Thomas, 2026-09-07): aktive abonnementer hvis
// startuge ligger i et FREMTIDIGT år (årstal-bump-bugens følger) eller er en
// årløs PASSERET uge, mens de har NUL kommende ordrer, er brudte — startugen
// skal betyde "kør nu" (passeret uge = skulle allerede køre; fremtids-årstal
// gælder først ved årsskifte). Delagtig logik mellem:
//  - "Ret manglende ordrer"-knappen (app/actions/fix-stale-weeks.ts), og
//  - det natlige selvhelende værn (app/api/calendar-consistency/route.ts),
// der reparerer FØR alarm-mailen sendes. Idempotent: en række kan kun rykkes én
// gang; anden kørsel ser ikke længere problemet og rapporterer intet.

export type StaleSub = {
  id: number;
  displayNo: number;
  startWeek: string | null;
  nextWeek: string | null;
  tasks: { id: number; startWeek: string | null }[];
};

/** Er startugen "brudt" (fremtids-årstal eller årløs passeret uge)? */
export function isBrokenStartWeek(startWeek: string | null, currentWeek: number, currentYear: number): boolean {
  const parts = parseWeekLabelParts(startWeek);
  if (!parts) return false;
  const isFutureYear = !!parts.year && parts.year > currentYear;
  const isPassedYearless = !parts.year && parts.week < currentWeek;
  return isFutureYear || isPassedYearless;
}

/** Find aktive, ikke-afventende abonnementer med brudt startuge og nul kommende ordrer. */
export async function listStaleSubs(): Promise<StaleSub[]> {
  const currentWeek = isoWeek(weekMondayToday());
  const currentYear = new Date().getUTCFullYear();
  const from = new Date(`${weekMondayToday()}T00:00:00Z`);

  const subs = await prisma.subscription.findMany({
    where: { active: true, pending: false },
    select: {
      id: true, displayNo: true, startWeek: true, nextWeek: true,
      tasks: { select: { id: true, startWeek: true } },
    },
  });
  if (!subs.length) return [];

  const [futureCounts, brokenStarts] = await Promise.all([
    prisma.order.groupBy({
      by: ["subscriptionId"],
      where: { subscriptionId: { in: subs.map((s) => s.id) }, plannedAt: { gte: from }, status: "Afventer levering" },
      _count: { _all: true },
    }),
    Promise.resolve(subs.filter((s) => isBrokenStartWeek(s.startWeek, currentWeek, currentYear))),
  ]);
  const futureBySub = new Map(futureCounts.map((g) => [g.subscriptionId, g._count._all]));
  return brokenStarts.filter((s) => (futureBySub.get(s.id) ?? 0) === 0);
}

/**
 * Reparér ét brudt abonnement: ryk startugen/nextWeek til indeværende uge,
 * snap brudte opgave-uger med, og regenerér de kommende ordrer.
 * Returnerer antallet af oprettede ordrer (0 er stadig en vellykket reparation
 * af etiketten — fx kun-"På anmodning"-abonnementer).
 */
export async function repairStaleSub(sub: StaleSub): Promise<number> {
  const nowLabel = weekLabel(weekMondayToday());
  const currentWeek = isoWeek(weekMondayToday());
  const currentYear = new Date().getUTCFullYear();

  await prisma.$transaction([
    prisma.subscription.update({ where: { id: sub.id }, data: { startWeek: nowLabel, nextWeek: nowLabel } }),
    prisma.taskLine.updateMany({
      where: { subscriptionId: sub.id, startWeek: sub.startWeek ?? undefined },
      data: { startWeek: nowLabel },
    }),
  ]);
  for (const t of sub.tasks) {
    if (isBrokenStartWeek(t.startWeek, currentWeek, currentYear)) {
      await prisma.taskLine.update({ where: { id: t.id }, data: { startWeek: nowLabel } });
    }
  }
  return generateForSubscriptionId(sub.id);
}
