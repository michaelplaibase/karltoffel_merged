// ÉN kilde til sandhed for invarianten "dagskalenderen er ALTID synkron med
// den overordnede kalender". Kernen er en REN sammenligner (unit-testbar uden
// database); checkWeekConsistency er IO-wrapperen, der bruges af BÅDE det
// natlige produktions-tjek (app/api/calendar-consistency) og udvikler-scriptet
// (scripts/calendar-daycal-consistency-check.ts) — så selve tjekket aldrig
// kan drive fra hinanden mellem miljøerne.
import { prisma } from "./db";
import { getCalendarWeek, getDayProgram } from "./queries";
import { fmtTime } from "./planner";
import type { CalendarWeek, DayProgram } from "./calendar";

export type ConsistencyProblem = { kind: string; detail: string };
export type WeekConsistency = {
  week: string;
  ok: boolean;
  orders: number;
  planned: number;
  unplanned: number;
  problems: ConsistencyProblem[];
};

const sortNum = (xs: number[]) => [...xs].sort((a, b) => a - b);
const sameIds = (a: number[], b: number[]) => JSON.stringify(sortNum(a)) === JSON.stringify(sortNum(b));

/** Ren sammenligner: ugekalender (admin-visning) vs de 7 dagsprogrammer vs
 *  databasens ordre-id'er for ugen. Returnerer ALLE uoverensstemmelser. */
export function diffWeekAgainstDays(week: CalendarWeek, days: DayProgram[], dbOrderIds: number[]): ConsistencyProblem[] {
  const problems: ConsistencyProblem[] = [];
  const eventIds = week.events.map((e) => e.id);
  const unplannedIds = week.unplanned.map((u) => u.id);

  // 1) PARTITION — hjertet i invarianten: hver DB-ordre i ugen vises præcis
  //    én gang (planlagt ELLER "Ikke planlagt"), aldrig nul og aldrig to.
  const union = [...eventIds, ...unplannedIds];
  if (new Set(union).size !== union.length) {
    const seen = new Set<number>();
    const dup = union.filter((id) => (seen.has(id) ? true : (seen.add(id), false)));
    problems.push({ kind: "dublet", detail: `ordrer vist mere end én gang: ${sortNum(dup).join(", ")}` });
  }
  if (!sameIds(union, dbOrderIds)) {
    const shown = new Set(union);
    const missing = dbOrderIds.filter((id) => !shown.has(id));
    const ghost = union.filter((id) => !dbOrderIds.includes(id));
    if (missing.length) problems.push({ kind: "usynlig", detail: `ordrer i databasen men IKKE i kalenderen: ${sortNum(missing).join(", ")}` });
    if (ghost.length) problems.push({ kind: "spoegelse", detail: `ordrer i kalenderen men ikke i databasen: ${sortNum(ghost).join(", ")}` });
  }

  // 2) DAG == UGE — hvert dagsprogram matcher ugekalenderens kolonne på både
  //    ordre-id OG klokkeslæt; unplanned-sektionerne dækker ugens liste.
  for (let i = 0; i < 7; i++) {
    const evs = week.events.filter((e) => e.day === i)
      .map((e) => `${e.id}@${fmtTime(Math.round(e.start * 60))}-${fmtTime(Math.round(e.end * 60))}`).sort();
    const stops = days[i].stops.map((s) => `${s.orderId}@${s.from}-${s.to}`).sort();
    if (JSON.stringify(evs) !== JSON.stringify(stops)) {
      problems.push({ kind: "dag-afvigelse", detail: `dag ${i}: uge=[${evs.join(", ")}] dagsprogram=[${stops.join(", ")}]` });
    }
  }
  const dayUnplanned = days.flatMap((d) => d.unplanned.map((u) => u.orderId));
  if (!sameIds(dayUnplanned, unplannedIds)) {
    problems.push({ kind: "unplanned-afvigelse", detail: `uge=[${sortNum(unplannedIds).join(", ")}] dagsprogrammer=[${sortNum(dayUnplanned).join(", ")}]` });
  }

  // 3) TAL — dagsomsætning og kørsel skal stemme mellem visningerne.
  for (let i = 0; i < 7; i++) {
    if (week.days[i].revenue !== days[i].revenueDay) {
      problems.push({ kind: "omsaetning", detail: `dag ${i}: uge=${week.days[i].revenue} dagsprogram=${days[i].revenueDay}` });
    }
    const wkDrive = week.days[i].driving ?? "0 t 0 min";
    if (wkDrive !== days[i].driving) {
      problems.push({ kind: "koersel", detail: `dag ${i}: uge='${wkDrive}' dagsprogram='${days[i].driving}'` });
    }
  }
  return problems;
}

const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * 864e5).toISOString().slice(0, 10);

/** Kør invariant-tjekket for ugen, der starter `weekMonday` (admin-visning —
 *  viewer-delmængder er pr. definition delmængder af denne). */
export async function checkWeekConsistency(weekMonday: string): Promise<WeekConsistency> {
  const week = await getCalendarWeek(weekMonday);
  const days = await Promise.all(Array.from({ length: 7 }, (_, i) => getDayProgram(addDays(weekMonday, i))));
  const start = new Date(`${weekMonday}T00:00:00Z`);
  const dbOrders = await prisma.order.findMany({
    where: { plannedAt: { gte: start, lt: new Date(start.getTime() + 7 * 864e5) } },
    select: { id: true },
  });
  const problems = diffWeekAgainstDays(week, days, dbOrders.map((o) => o.id));
  return {
    week: weekMonday,
    ok: problems.length === 0,
    orders: dbOrders.length,
    planned: week.events.length,
    unplanned: week.unplanned.length,
    problems,
  };
}
