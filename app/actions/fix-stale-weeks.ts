"use server";

// Data-fix (Thomas, 2026-09-07): "Vil du sørge for og rette alle som ingen
// kommende ordre har" — retter alle aktive abonnementer, hvis startuge/
// opgave-uger blev skubbet til NÆSTE ÅR af årstal-bump-bugen (normalizeWeekLabel
// før fix dd60deb): startWeek med årstal > indeværende år OG ingen kommende
// ordrer → startuge rykkes til indeværende uge (catch-up), opgave-linjernes
// startWeek nulstilles i samme træk (de følger ellers rytmen fra abonnementet),
// og kommende ordrer regenereres. Idempotent: andet tryk rapporterer "0 rettet".
//
// KUN årstal > indeværende år røres — bevidste sæsonstart i NÆSTE år med
// ordrer i sigtefeltet, eller yearless fremtidige uger, er legitime.
import { prisma } from "@/lib/db";
import { guardAction, getSessionUser } from "@/lib/api-auth";
import { revalidatePath } from "next/cache";
import { parseWeekLabelParts, generateForSubscriptionId } from "@/lib/recurrence";
import { weekMondayToday } from "@/lib/calendar";
import { weekLabel } from "@/lib/weeks";

export type FixStaleResult = {
  ok: boolean;
  error?: string;
  scanned: number;
  fixed: number;
  details: string[];
};

export async function fixStaleFutureWeeks(): Promise<FixStaleResult> {
  const user = await getSessionUser();
  if (!user?.isAdmin) {
    return { ok: false, error: "Kun administratorer kan køre denne rettelse.", scanned: 0, fixed: 0, details: [] };
  }
  await guardAction();

  const currentYear = new Date().getUTCFullYear();
  const horizonEndMs = Date.parse(`${weekMondayToday()}T00:00:00Z`) + 26 * 7 * 864e5; // genereringens horisont (26 uger)
  const nowLabel = weekLabel(weekMondayToday());

  const subs = await prisma.subscription.findMany({
    where: { active: true, pending: false },
    select: { id: true, displayNo: true, startWeek: true, nextWeek: true, tasks: { select: { id: true, startWeek: true } } },
  });

  const details: string[] = [];
  let fixed = 0;

  for (const sub of subs) {
    const parts = parseWeekLabelParts(sub.startWeek);
    if (!parts?.year || parts.year <= currentYear) continue; // årystart eller årløs — ikke vores tilfælde
    const anchorMs = Date.parse(`${parts.year}-01-04T00:00:00Z`);
    if (anchorMs <= horizonEndMs) continue; // år-langt væk men stadig inden for horisonten — legitim sæsonstart, lad være
    // Verificér at abonnementet reelt er tørret: ingen kommende ordrer.
    const from = new Date(`${weekMondayToday()}T00:00:00Z`);
    const futureCount = await prisma.order.count({
      where: { subscriptionId: sub.id, plannedAt: { gte: from }, status: "Afventer levering" },
    });
    if (futureCount > 0) continue;

    // Ryk startugen til nu, nulstil opgave-uger og regenerér.
    await prisma.$transaction([
      prisma.subscription.update({ where: { id: sub.id }, data: { startWeek: nowLabel, nextWeek: nowLabel } }),
      prisma.taskLine.updateMany({
        where: { subscriptionId: sub.id, startWeek: sub.startWeek ?? undefined },
        data: { startWeek: nowLabel },
      }),
    ]);
    // Opgave-linjer med ANDEN fremtids-år (fx "Uge 20, 2027" fra samme bump)
    // rykkes også til nu — de var med i samme fejlgem.
    for (const t of sub.tasks) {
      const tp = parseWeekLabelParts(t.startWeek);
      if (tp?.year && tp.year > currentYear) {
        await prisma.taskLine.update({ where: { id: t.id }, data: { startWeek: nowLabel } });
      }
    }
    const created = await generateForSubscriptionId(sub.id);
    fixed++;
    details.push(`Abo. ${sub.displayNo}: startuge ${sub.startWeek} → ${nowLabel}, ${created} ordrer oprettet`);
  }

  revalidatePath("/subscriptions");
  revalidatePath("/orders");
  revalidatePath("/calendar");
  revalidatePath("/daycalendar");
  return { ok: true, scanned: subs.length, fixed, details };
}
