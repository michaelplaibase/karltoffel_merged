"use server";

// Manuelt vedligeholdelsesgreb (Thomas): "Genberegn varigheder" på /settings.
// Går alle TaskLines med pris > 0 igennem og sætter durationMin ud fra den
// aktuelle minutpris — samme formel som TaskLineEditor bruger client-side.
// Idempotent: kald den igen uden ændringer, og der rapporteres 0 ændringer.
// Overskriver manuelt justerede varigheder BEVIDST (Thomas har godkendt det).
import { prisma } from "@/lib/db";
import { recalculateTaskLineDurations } from "@/lib/duration-recalc";
import { guardAction, getSessionUser } from "@/lib/api-auth";
import { revalidatePath } from "next/cache";

export type RecalcResult = {
  ok: boolean;
  error?: string;
  scanned: number; // linjer med pris > 0 (genberegningskandidater)
  changed: number; // linjer hvor varigheden faktisk ændrede sig
};

export async function recalculateDurations(): Promise<RecalcResult> {
  const user = await getSessionUser();
  if (!user?.isAdmin) {
    return { ok: false, error: "Kun administratorer kan genberegne varigheder.", scanned: 0, changed: 0 };
  }
  await guardAction();

  const company = await prisma.company.findFirst({ select: { minutePriceOere: true } });
  if (!company) return { ok: false, error: "Ingen virksomhed fundet.", scanned: 0, changed: 0 };

  const { scanned, changed } = await recalculateTaskLineDurations(company.minutePriceOere);

  revalidatePath("/settings");
  revalidatePath("/orders");
  revalidatePath("/subscriptions");
  revalidatePath("/daycalendar");
  return { ok: true, scanned, changed };
}
