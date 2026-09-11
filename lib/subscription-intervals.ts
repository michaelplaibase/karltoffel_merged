// Delte abonnements-interval-konstanter og årsbeløgs-beregning (Thomas,
// 2026-09-11): tilbud og abonnement SKAL bruge præcis samme interval-muligheder
// og samme årsbeløgs-matematik, så tal aldrig afviger mellem de to flader.
// Ren funktion — ingen prisma — kan bruges både i client-komponenter og tests.

/** Basis-interval-mulighederne — KILDE for både abonnements-formularen
 *  (components/SubscriptionForm.tsx) og tilbud-formularen (TilbudForm.tsx). */
export const BASE_INTERVALS = [
  "Hver uge", "Hver 2. uge", "Hver 3. uge", "Hver 4. uge", "Hver 5. uge", "Hver 6. uge",
  "Hver 8. uge", "Hver 10. uge", "Hver 12. uge", "Hver 13. uge", "Hver 16. uge",
  "Hver 24. uge", "Hver 26. uge", "Hver 36. uge", "Hver 48. uge", "Hver 52. uge",
];

/** "Hver uge" → 1, "Hver 4. uge" → 4. Ugen kendte etiketter giver intervallet i
 *  uger. Etiketten er ikke en uge-rytme (fx "Hver måned" eller fritekst) → null,
 *  medmindre `fallback` er angivet (lead-calc bruger 1, som hidtil). */
export function parseBaseIntervalWeeks(label: string | null | undefined, fallback?: number): number | null {
  if (!label) return fallback ?? null;
  const m = label.match(/Hver\s+(?:(\d+)\.?\s*)?uge/i);
  if (m) return Math.max(1, Number(m[1]) || 1);
  return fallback ?? null;
}

/** Antal besøg pr. år ved et uge-interval: 52 ÷ interval i uger, afrundet til
 *  nærmeste heltal (Hver 4. uge → 13, Thomas' eksempel). Ikke-ugentligt eller
 *  manglende interval → null (ingen årsbeløb). */
export function besogPrAar(baseInterval: string | null | undefined): number | null {
  const weeks = parseBaseIntervalWeeks(baseInterval);
  if (weeks == null) return null;
  return Math.round(52 / weeks);
}

/** Årsbeløb = pris pr. gang (summen af opgavelinjerne) × besøg pr. år.
 *  Deles af tilbud (PDF, formular, accept-side) og abonnements-beregningen. */
export function aarsbelob(baseInterval: string | null | undefined, prisPrGang: number): number | null {
  const besog = besogPrAar(baseInterval);
  if (besog == null) return null;
  return prisPrGang * besog;
}
