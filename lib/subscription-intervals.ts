// Delte abonnements-interval-konstanter og årsbeløgs-beregning (Thomas,
// 2026-09-11): tilbud og abonnement SKAL bruge præcis samme interval-muligheder
// og samme årsbeløgs-matematik, så tal aldrig afviger mellem de to flader.
// Ren funktion — ingen prisma — kan bruges både i client-komponenter og tests.

/** Basis-interval-mulighederne — KILDE for både abonnements-formularen
 *  (components/SubscriptionForm.tsx) og tilbud-formularen (TilbudForm.tsx).
 *  Thomas, 2026-09-11 (korrektion): "1 gang om året" er tilføjet, så den kan
 *  vælges PR. OPGAVELINJE på tilbud (fx tagrender — kun én gang om året). */
export const BASE_INTERVALS = [
  "Hver uge", "Hver 2. uge", "Hver 3. uge", "Hver 4. uge", "Hver 5. uge", "Hver 6. uge",
  "Hver 8. uge", "Hver 10. uge", "Hver 12. uge", "Hver 13. uge", "Hver 16. uge",
  "Hver 24. uge", "Hver 26. uge", "Hver 36. uge", "Hver 48. uge", "Hver 52. uge",
  "1 gang om året",
];

/** År-interval-etiketten ("1 gang om året") → svarer til 52 uger (1 besøg/år). */
const AAR_INTERVAL = "1 gang om året";

/** "Hver uge" → 1, "Hver 4. uge" → 4, "1 gang om året" → 52. Ugen kendte
 *  etiketter giver intervallet i uger. Etiketten er ikke en uge-rytme (fx
 *  "Hver måned" eller fritekst) → null, medmindre `fallback` er angivet
 *  (lead-calc bruger 1, som hidtil). */
export function parseBaseIntervalWeeks(label: string | null | undefined, fallback?: number): number | null {
  if (!label) return fallback ?? null;
  if (label.trim() === AAR_INTERVAL) return 52;
  const m = label.match(/Hver\s+(?:(\d+)\.?\s*)?uge/i);
  if (m) return Math.max(1, Number(m[1]) || 1);
  return fallback ?? null;
}

/** Antal besøg pr. år ved et uge-interval: 52 ÷ interval i uger, afrundet til
 *  nærmeste heltal (Hver 4. uge → 13, Thomas' eksempel; "1 gang om året" → 1).
 *  Ikke-ugentligt eller manglende interval → null (ingen årsbeløb). */
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

/** Thomas, 2026-09-11 (korrektion): interval kan nu sættes PR. OPGAVELINJE på
 *  tilbud — ikke kun for hele tilbuddet. Årsbeløbet bliver derfor SUMMEN PR.
 *  LINJE: hver linje med interval bidrager med pris × besøg pr. år; linjer
 *  uden interval er engangsopgaver og tæller IKKE med. Ingen linjer med
 *  interval → null (ingen årsbeløbs-bundlinje). */
export function tilbudLinjeAarsbelob(
  line: { price: number; description?: string; interval?: string | null },
): number | null {
  if (!line.interval) return null;
  return aarsbelob(line.interval, line.price);
}

/** Summen af linje-årsbeløbene (kun linjer med interval). null = ingen linjer
 *  med interval → ingen årsbeløb skal vises. */
export function tilbudAarsbelobSum(
  lines: { price: number; description?: string; interval?: string | null }[],
): number | null {
  const dele = lines.map(tilbudLinjeAarsbelob).filter((v): v is number => v != null);
  return dele.length ? dele.reduce((a, b) => a + b, 0) : null;
}