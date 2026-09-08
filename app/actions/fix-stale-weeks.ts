"use server";

// Data-fix-knap (Thomas, 2026-09-07): "Vil du sørge for og rette alle som ingen
// kommende ordre har" — retter alle aktive abonnementer hvis startuge er skubbet
// til et fremtids-årstal eller er en årløs passeret uge, mens de har NUL kommende
// ordrer. Logikken bor i lib/fix-stale-weeks.ts, så det natlige vægn selvhelende
// kørsel (app/api/calendar-consistency) deler PRÆCIS samme kriterier og reparerer
// FØR alarm-mailen. Idempotent: andet tryk rapporterer "0 rettet".
import { guardAction, getSessionUser } from "@/lib/api-auth";
import { revalidatePath } from "next/cache";
import { listStaleSubs, repairStaleSub } from "@/lib/fix-stale-weeks";

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

  const stale = await listStaleSubs();
  const details: string[] = [];
  let fixed = 0;
  for (const sub of stale) {
    const before = sub.startWeek ?? "?";
    const created = await repairStaleSub(sub);
    fixed++;
    details.push(`Abo. ${sub.displayNo}: startuge ${before} → nu, ${created} ordrer oprettet`);
  }

  revalidatePath("/subscriptions");
  revalidatePath("/orders");
  revalidatePath("/calendar");
  revalidatePath("/daycalendar");
  return { ok: true, scanned: stale.length, fixed, details };
}
