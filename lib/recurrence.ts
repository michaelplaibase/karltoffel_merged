// Subscription → order recurrence. Materialises the upcoming orders for active
// subscriptions from the base interval + per-task interval multiplier + start
// week, so the calendar reflects recurring work automatically. Idempotent:
// re-running skips weeks that already have an order for the subscription; visits
// falling in holiday weeks are pushed to the first open week after the holiday.
// Server-only (Node) — used by the subscription actions,
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
export function parseWeekLabel(label: string | null): number | null {
  if (!label) return null;
  const m = label.match(/Uge\s+(\d+)/i);
  return m ? Number(m[1]) : null;
}

/** Sæsonpause ("Måneder på pause"): er opgaven på pause i ugen med mandag `v`
 *  (ms-tidsstempel, UTC midnat)? Vinduet må krydse nytår (fx 31/10 → 30/03) —
 *  derfor sammenlignes wrap-bevidst. pauseYearly=true gentager hvert år (kun
 *  måned/dag sammenlignes); false er "kun denne sæson" (absolutte ISO-datoer). */
function isPausedOn(
  t: { pauseActive: boolean; pauseStart: string | null; pauseEnd: string | null; pauseYearly: boolean },
  v: number,
): boolean {
  if (!t.pauseActive || !t.pauseStart || !t.pauseEnd) return false;
  const d = new Date(v);
  const pad = (n: number) => String(n).padStart(2, "0");
  const mmdd = pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate());
  if (t.pauseYearly) {
    const s = t.pauseStart.slice(5), e = t.pauseEnd.slice(5);
    return s <= e ? mmdd >= s && mmdd <= e : mmdd >= s || mmdd <= e;
  }
  const iso = d.getUTCFullYear() + "-" + mmdd;
  return iso >= t.pauseStart && iso <= t.pauseEnd;
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
    // Fast medarbejder uden aktivt match (deaktiveret/ukendt navn): ordren
    // efterlades UDEN medarbejder (synligt "Ikke planlagt" i kalender/
    // dagsprogram) — aldrig stille tildelt en vilkårlig første aktiv bruger.
    return match ? match.id : null;
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

  // Existing orders keyed by the week they were generated FOR (sourceWeek) —
  // NOT their current plannedAt: a moved order must keep claiming its rhythm
  // week, otherwise the nightly run re-creates it and double-books the customer.
  // (plannedAt-fallback covers rows from before the sourceWeek migration.)
  const existing = await prisma.order.findMany({ where: { subscriptionId: sub.id }, select: { plannedAt: true, sourceWeek: true } });
  const existingWeeks = new Set(existing.map((o) => (o.sourceWeek ?? mondayOf(o.plannedAt)).getTime()));
  // Leveringsuger, der allerede er optaget (ordrens FAKTISKE placering) —
  // bruges så et ferie-skubbet besøg ikke lander oven i en eksisterende ordre.
  const usedDeliveryWeeks = new Set(existing.map((o) => mondayOf(o.plannedAt).getTime()));

  // Tombstones: uger hvor brugeren har SLETTET abonnements-ordren — genopliv aldrig.
  const skips = await prisma.subscriptionWeekSkip.findMany({ where: { subscriptionId: sub.id }, select: { week: true } });
  for (const s of skips) existingWeeks.add(mondayOf(s.week).getTime());

  // Anchor at week N. Labels are year-less, so the week is resolved year-aware:
  //  - NYT abonnement (endnu ingen ordrer/tombstones): startugen er den NÆSTE
  //    forekomst af uge N — "Uge 40" oprettet i januar starter til efteråret
  //    (uden for horisonten ⇒ 0 ordrer nu; cron/knappen genererer når
  //    horisonten når ugen), og "Uge 2" oprettet i august er januar næste år.
  //  - IGANGVÆRENDE abonnement (har ordrer): rytme-fasen er uge-N uafhængigt af
  //    år — ligger årets forekomst uden for horisonten, er abonnementet
  //    videreført fra sidste år, og første besøg rykkes fasejusteret frem.
  const hasOrders = existing.length > 0 || skips.length > 0;
  let anchor = mondayOfIsoWeek(refYear, subWeek).getTime();
  if (hasOrders) {
    if (anchor > horizonEnd) anchor = mondayOfIsoWeek(refYear - 1, subWeek).getTime();
  } else if (anchor < thisMonday) {
    anchor = mondayOfIsoWeek(refYear + 1, subWeek).getTime();
  }

  // Per task: its multiplier m and the visit offset j0 from the subscription
  // start, derived from the week-number difference. Årløst uge-tal LAVERE end
  // startugen er næste års forekomst (fx "Uge 2" på et uge-40-abonnement er
  // januar) — ikke et negativt offset, der ville medtage opgaven fra første besøg.
  const tasks = sub.tasks.map((t) => {
    const taskWeek = parseWeekLabel(t.startWeek) ?? subWeek;
    const weekDiff = taskWeek >= subWeek ? taskWeek - subWeek : taskWeek - subWeek + 52;
    return { t, m: parseMultiplier(t.intervalMultiplier), j0: Math.round(weekDiff / base) };
  });

  const holidays = await prisma.holidayWeek.findMany();
  const isHoliday = (ms: number) => holidays.some((h) => ms >= h.startWeek.getTime() && ms <= h.endWeek.getTime());

  const employeeId = await defaultEmployeeId(sub.fixedEmployee);

  // First visit at or after the current week, keeping the base rhythm.
  let v = anchor;
  if (v < thisMonday) v += Math.ceil((thisMonday - v) / step) * step;

  // Tasks due at a visit index (i base-steps from the anchor): a task recurs
  // every m visits from its own offset j0. "På anmodning" (m == null) is skipped,
  // og sæsonpausede opgaver udelades i deres pausevindue (rytmen — besøgsindeks
  // i — tæller videre gennem pausen, så opgaven genoptages på sin fase).
  const dueAt = (i: number, weekMs: number) =>
    tasks.filter((x) => x.m != null && i >= x.j0 && (i - x.j0) % x.m === 0 && !isPausedOn(x.t, weekMs)).map((x) => x.t);
  // Opgaver fra et ferie-skubbet besøg, der flettes ind i rytmens eget næste
  // besøg (nøgle: målugens rytme-uge). UNION frem for skip: opgaver, der kun
  // var due på det skubbede besøg (fx "Hver 13. gang"), må ikke mistes.
  const carriedByWeek = new Map<number, SubWithTasks["tasks"]>();

  let created = 0;
  for (; v <= horizonEnd; v += step) {
    if (existingWeeks.has(v)) continue;

    // Ferielukket uge: besøget mistes IKKE — det skubbes til den første LEDIGE
    // åbne uge efter ferien (som /holidays-forklaringen lover). sourceWeek
    // forbliver rytme-ugen, så dedup/tombstones stadig virker, og rytmen
    // fortsætter uændret fra næste besøg. Rammer skubbet rytmens eget næste
    // besøg, flettes opgaverne ind i det (carriedByWeek) i stedet for at
    // besøget slettes; er ugen optaget/tombstonet, prøves den næste uge.
    let deliveryWeek = v;
    let mergedInto: number | null = null;
    let placeable = false;
    for (let guard = 0; guard < 53; guard++) {
      if (isHoliday(deliveryWeek)) { deliveryWeek += WEEK_MS; continue; }
      if (deliveryWeek === v) { placeable = true; break; }
      const stepsFromAnchor = Math.round((deliveryWeek - anchor) / WEEK_MS);
      const isRhythmWeek = stepsFromAnchor % base === 0;
      if (isRhythmWeek && !existingWeeks.has(deliveryWeek)) { mergedInto = deliveryWeek; break; }
      if (isRhythmWeek || usedDeliveryWeeks.has(deliveryWeek)) { deliveryWeek += WEEK_MS; continue; }
      placeable = true; break;
    }

    const i = Math.round((v - anchor) / step);
    if (mergedInto != null) {
      const dueHere = dueAt(i, v);
      if (dueHere.length) carriedByWeek.set(mergedInto, [...(carriedByWeek.get(mergedInto) ?? []), ...dueHere]);
      continue;
    }
    if (!placeable) continue; // 52+ ugers sammenhængende blokering — opgiv besøget

    const due = dueAt(i, v);
    // Flet opgaver båret med fra et ferie-skubbet besøg ind (dedup på id) —
    // kunden skal have ÉN samlet ordre i ugen, uden at noget udgår.
    for (const t of carriedByWeek.get(v) ?? []) if (!due.some((d) => d.id === t.id)) due.push(t);
    if (!due.length) continue; // alle ugens opgaver på pause/"På anmodning"

    try {
      await prisma.order.create({
        data: {
          contactId: sub.contactId,
          deliveryAddress: sub.deliveryAddress,
          plannedAt: new Date(deliveryWeek + 10 * 3600 * 1000), // Monday 10:00 UTC (evt. ferie-skubbet uge)
          sourceWeek: new Date(v),                              // rytme-ugen — dedup-nøgle, flytning rører den ikke
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
    usedDeliveryWeeks.add(deliveryWeek);
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
 * NEXT week onward that are still pending (history, completed orders, and the
 * current week's plan are left untouched), then
 * regenerate from the updated template.
 *
 * Fully-locked future imports are included: the lock preserves manual calendar
 * placement during normal use, but must not preserve a stale recurrence after
 * the authoritative subscription has been edited.
 */
export async function regenerateFutureOrders(
  id: number,
  ref: Date = new Date(),
  horizonWeeks = DEFAULT_HORIZON_WEEKS
): Promise<{ generated: number }> {
  // Defensiv guard: kan skabelonen slet ikke generere (abonnementet er slettet,
  // eller startugen er i et format genereringen ikke forstår), må de
  // eksisterende fremtidige ordrer IKKE slettes — en ugyldig redigering ville
  // ellers tømme kalenderen uden at genskabe noget.
  const sub = await prisma.subscription.findUnique({ where: { id }, select: { startWeek: true } });
  if (!sub || parseWeekLabel(sub.startWeek) == null) return { generated: 0 };

  const nextMonday = new Date(mondayOf(ref).getTime() + WEEK_MS);
  const stale = await prisma.order.findMany({
    where: { subscriptionId: id, plannedAt: { gte: nextMonday }, status: "Afventer levering" },
    select: { id: true },
  });
  const ids = stale.map((o) => o.id);
  if (ids.length) {
    await prisma.$transaction([
      prisma.taskLine.deleteMany({ where: { orderId: { in: ids } } }),
      prisma.order.deleteMany({ where: { id: { in: ids } } }),
    ]);
  }
  const generated = await generateForSubscriptionId(id, ref, horizonWeeks);
  return { generated };
}
