import { NextResponse } from "next/server";
import { checkWeekConsistency } from "@/lib/calendar-consistency";
import { requireSession, unauthorized } from "@/lib/api-auth";
import { weekMondayToday } from "@/lib/calendar";
import { sendEmail } from "@/lib/email";
import { prisma } from "@/lib/db";
import { subscriptionOutlookProblem } from "@/lib/recurrence";
import { listStaleSubs, repairStaleSub } from "@/lib/fix-stale-weeks";

// GET /api/calendar-consistency
// Natligt VAGTVÆRN (se vercel.json — kører efter /api/plan): verificerer mod
// den LEVENDE database, at dagskalenderen og den overordnede kalender er 100 %
// synkrone for indeværende + næste uge — hver ordre vises præcis én gang
// (planlagt eller "Ikke planlagt"), dag==uge på id og klokkeslæt, og tallene
// stemmer. Skrider invarianten: (1) console.error → fejlen lander i Vercels
// runtime-overvågning, (2) alarm-mail til kontoret. Svarer altid 200 med
// status-JSON (kun tal/id'er — ingen kundedata), så cron'en ikke retry-spammer.
//
// Access: Vercel-cron (Authorization: Bearer <CRON_SECRET>) eller logget-ind
// bruger — samme mønster som /api/plan.
const STAFF_EMAIL = process.env.STAFF_NOTIFY_EMAIL?.trim() || "kristian@karltoffel.dk";

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") || "";
  const isCron = !!cronSecret && auth.startsWith("Bearer ") && safeEqual(auth.slice(7), cronSecret);
  if (!isCron && (await requireSession()) == null) return unauthorized();

  const monday = weekMondayToday();
  const nextMonday = new Date(Date.parse(`${monday}T00:00:00Z`) + 7 * 864e5).toISOString().slice(0, 10);
  const weeks = await Promise.all([checkWeekConsistency(monday), checkWeekConsistency(nextMonday)]);
  const broken = weeks.filter((w) => !w.ok);

  // STILLE-NUL-VAGT (uge 35-hændelsen): et aktivt abonnement uden kommende
  // ordrer, når rytmen siger det burde have nogen, er et alarm-fund — det var
  // præcis sådan ~30 abonnementer forsvandt fra kalenderen uden én fejl i loggen.
  const subs = await prisma.subscription.findMany({
    where: { active: true, pending: false },
    select: { id: true, displayNo: true, active: true, pending: true, startWeek: true, nextWeek: true, baseInterval: true, tasks: { select: { intervalMultiplier: true } } },
  });
  const from = new Date(`${monday}T00:00:00Z`);
  const [futureCounts, totalCounts] = await Promise.all([
    prisma.order.groupBy({ by: ["subscriptionId"], where: { subscriptionId: { in: subs.map((s) => s.id) }, plannedAt: { gte: from } }, _count: { _all: true } }),
    prisma.order.groupBy({ by: ["subscriptionId"], where: { subscriptionId: { in: subs.map((s) => s.id) } }, _count: { _all: true } }),
  ]);
  const futureBySub = new Map(futureCounts.map((g) => [g.subscriptionId, g._count._all]));
  const totalBySub = new Map(totalCounts.map((g) => [g.subscriptionId, g._count._all]));
  // SELVHELLENDE VÆRN (Thomas, 2026-09-07: "systemet skal selv prøve at løse
  // problemet først"): aktive abonnementer med brudt startuge (fremtids-årstal
  // eller årløs passeret uge) og nul kommende ordrer repareres HER — startuge
  // rykkes til nu + ordrer genereres — før alarm-mailen overhovedet vurderes.
  // Kun det der STADIG er tørt efter reparationen alarmeres.
  const repaired: string[] = [];
  for (const stale of await listStaleSubs()) {
    try {
      const before = stale.startWeek ?? "?";
      const created = await repairStaleSub(stale);
      repaired.push(`Abo. ${stale.displayNo}: startuge ${before} → nu, ${created} ordrer oprettet (selvhelende)`);
    } catch (e) {
      console.error(`[kalender-konsistens] selvhelende reparation fejlede for abo ${stale.displayNo}:`, e);
    }
  }
  if (repaired.length) {
    console.log(`[kalender-konsistens] SELVHELLENDE: ${repaired.length} abonnement(er) repareret:\n${repaired.map((r) => "  - " + r).join("\n")}`);
    // Genindlæs ordrétællingerne så outlook-vurderingen nedenfor ser efter-reparation-verdenen.
    const [freshFuture, freshTotal] = await Promise.all([
      prisma.order.groupBy({ by: ["subscriptionId"], where: { subscriptionId: { in: subs.map((s) => s.id) }, plannedAt: { gte: from } }, _count: { _all: true } }),
      prisma.order.groupBy({ by: ["subscriptionId"], where: { subscriptionId: { in: subs.map((s) => s.id) } }, _count: { _all: true } }),
    ]);
    futureBySub.clear(); freshFuture.forEach((g) => futureBySub.set(g.subscriptionId, g._count._all));
    totalBySub.clear(); freshTotal.forEach((g) => totalBySub.set(g.subscriptionId, g._count._all));
    for (const s2 of subs) {
      if (!repaired.some((r) => r.startsWith(`Abo. ${s2.displayNo}:`))) continue;
      s2.startWeek = (await prisma.subscription.findUnique({ where: { id: s2.id }, select: { startWeek: true } }))?.startWeek ?? s2.startWeek;
    }
  }

  const starvedSubs = subs
    .map((s) => ({ aboNr: s.displayNo, problem: subscriptionOutlookProblem(s, futureBySub.get(s.id) ?? 0, totalBySub.get(s.id) ?? 0) }))
    .filter((s): s is { aboNr: number; problem: string } => s.problem != null);

  if (starvedSubs.length) {
    const detail = starvedSubs.map((s) => `  - Abo. nr. ${s.aboNr}: ${s.problem}`).join("\n");
    console.error(`[kalender-konsistens] STILLE NUL-GENERERING — aktive abonnementer uden kommende ordrer:\n${detail}`);
    try {
      const res = await sendEmail({
        to: STAFF_EMAIL,
        subject: `⚠️ Karltoffel: ${starvedSubs.length} abonnement(er) står uden kommende ordrer`,
        text:
          "Det natlige tjek fandt aktive abonnementer, der burde have kommende ordrer i kalenderen, men ingen har.\n\n" +
          detail +
          "\n\nÅbn Abonnementer i CRM'et (advarslen vises på rækken), tryk 'Generér kommende ordrer' og tjek abonnementets startuge.",
      });
      if (!res.ok) console.error(`[kalender-konsistens] alarm-mail (abonnementer) fejlede: ${res.error}`);
    } catch (e) {
      console.error("[kalender-konsistens] alarm-mail (abonnementer) exception:", e);
    }
  }

  if (broken.length) {
    const detail = broken
      .map((w) => `Uge ${w.week} (${w.orders} ordrer i DB, ${w.planned} planlagt, ${w.unplanned} ikke planlagt):\n` +
        w.problems.map((p) => `  - [${p.kind}] ${p.detail}`).join("\n"))
      .join("\n\n");
    console.error(`[kalender-konsistens] INVARIANT BRUDT — dagskalender og kalender er IKKE synkrone:\n${detail}`);
    try {
      const res = await sendEmail({
        to: STAFF_EMAIL,
        subject: "⚠️ Karltoffel: kalender og dagsprogram er ude af sync",
        text:
          "Det natlige konsistens-tjek fandt uoverensstemmelser mellem den overordnede kalender og dagsprogrammet.\n\n" +
          detail +
          "\n\nÅbn kalenderen og dagsprogrammet for ugen og sammenlign — fejlen er også logget i produktions-overvågningen.",
      });
      if (!res.ok) console.error(`[kalender-konsistens] alarm-mail fejlede: ${res.error}`);
    } catch (e) {
      console.error("[kalender-konsistens] alarm-mail exception:", e);
    }
  }

  return NextResponse.json({
    ok: broken.length === 0 && starvedSubs.length === 0,
    weeks,
    abonnementerUdenOrdrer: starvedSubs,
  });
}
