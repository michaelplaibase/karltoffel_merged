// Genberegnelse af TaskLine-varigheder ud fra virksomhedens minutpris
// (Company.minutePriceOere). Samme formel som TaskLineEditor bruger
// client-side (components/TaskLineEditor.tsx:138):
//   durationMin = max(1, round((pris inkl. moms / 1,25) / minutpris i kr))
// Minutprisen gemmes i ØRE pr. minut EKSKL. moms (default 860 = 8,60 kr/min),
// så kr-satsen er minutePriceOere / 100 (samme konvertering som getMinuteRate).
import { prisma } from "@/lib/db";

const MOMS = 1.25; // pris på TaskLine er inkl. 25% moms — strippes før division

/** Ren beregning (unit-testes i tests/genberegn-varigheder.test.ts):
 *  varighed i minutter for én linje med pris inkl. moms og sats i øre/min. */
export function durationFromPrice(price: number, minutePriceOere: number): number {
  const rate = minutePriceOere > 0 ? minutePriceOere / 100 : 8.6; // kr/min ekskl. moms (fallback = default 860 øre)
  return Math.max(1, Math.round((price / MOMS) / rate));
}

export type RecalcSummary = { scanned: number; changed: number };

/** Genberegn durationMin for ALLE TaskLines med price > 0 mod den angivne sats.
 *  Linjer med pris 0 får ikke rørt deres varighed (der er intet at regne fra).
 *  Rækker hvor den beregnede varighed allerede matcher opdateres ikke, så
 *  kaldet er idempotent og `changed` rapporterer det reelle antal ændringer.
 *  OBS: Overskriver manuelt justerede varigheder — det er bevidst (Thomas). */
export async function recalculateTaskLineDurations(minutePriceOere: number): Promise<RecalcSummary> {
  const rows = await prisma.taskLine.findMany({
    where: { price: { gt: 0 } },
    select: { id: true, price: true, durationMin: true },
  });

  let changed = 0;
  for (const row of rows) {
    const durationMin = durationFromPrice(row.price, minutePriceOere);
    if (durationMin === row.durationMin) continue;
    await prisma.taskLine.update({ where: { id: row.id }, data: { durationMin } });
    changed++;
  }
  return { scanned: rows.length, changed };
}
