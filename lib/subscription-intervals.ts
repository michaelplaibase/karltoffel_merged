// Delte abonnements-interval-konstanter og årsbeløgs-beregning (Thomas,
// 2026-09-11): tilbud og abonnement SKAL bruge præcis samme interval-muligheder
// og samme årsbeløgs-matematik, så tal aldrig afviger mellem de to flader.
// Ren funktion — ingen prisma — kan bruges både i client-komponenter og tests.
//
// PAUSE-FRADRAG (Thomas, 2026-09-21): når en opgavelinje er sat på pause,
// reducerer ÅRSBELØBET med prisen på det antal besøg, pausevinduet fjerner i
// reference-året. Fradraget bruger den DELTE pause-logik (lib/pause.ts) og
// PRÆCIS samme besøgs-placering som årshjulet (bygAarshjul i lib/tilbud.mts),
// så det beløb, der vises, ALTID svarer til de besøg hjulet viser.
import { isPausedOnIso, isoMondayOfIsoWeek, type PauseTimings } from "./pause";

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

/** Feltmønsteret for pause pr. opgavelinje (TilbudLine/TaskLine) — deles af
 *  årsbeløbs-beregningen og årshjulet (bygAarshjul). pauseYearly=true =
 *  "Hvert år" (vinduet gentages hvert år, kun måned/dag sammenlignes); false =
 *  "kun denne sæson" (absolutte ISO-datoer). */
export type PauseFelt = {
  pauseActive?: boolean;
  pauseStart?: string | null;
  pauseEnd?: string | null;
  pauseYearly?: boolean;
};

/** Linje-typen der bruges til årsbeløbs-beregning — samt en valgfri startuge
 *  (nødvendig for at placere besøgene og finde pausefradraget) og pause-felter. */
export type AarsbelobLinje = {
  price: number;
  description?: string;
  interval?: string | null;
  startWeek?: string | null;
} & PauseFelt;

/** Ugenummer fra en startuge-etiket ('Uge 29' eller 'Uge 29, 2026' → 29;
 *  gyldig 1–53). Samme regex som parseUgeNr i lib/tilbud.mts (gentaget her for
 *  at undgå en cirkulær import) — de to holdes synkroniseret ved TEST
 *  ("konsistent med bygAarshjul" nedenfor). */
function startUgeNr(startWeek: string | null | undefined): number | null {
  const m = (startWeek ?? "").match(/Uge\s*(\d{1,2})/i);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= 53 ? n : null;
}

/** Antal besøg i reference-året som opgavens PAUSEVINDUE fjerner — PRÆCIS den
 *  besøgs-placering årshjulet bruger (bygAarshjul i lib/tilbud.mts):
 *    besog = besogPrAar(interval), step = round(52/besog), fra startugen,
 *    uge-wrap over 52, og pause-test på mandagens ISO-dato mod den DELTE
 *    pause-logik (lib/pause.ts).
 *  Returnerer 0 når linjen ikke har interval, ikke er aktivt pauset, ELLER når
 *  den ikke kan placeres (manglende/ugyldig startuge) — så vi aldrig gætter på
 *  et fradrag vi ikke kan regne ud (konservativt: intet fradrag). */
export function pauseBesogFradragPrAar(
  line: { interval?: string | null; startWeek?: string | null } & PauseFelt,
  opts: { now?: Date } = {},
): number {
  const besog = besogPrAar(line.interval);
  if (besog == null) return 0; // ingen interval → intet årsbeløb at reducere
  const p: PauseTimings = {
    pauseActive: line.pauseActive ?? false,
    pauseStart: line.pauseStart ?? null,
    pauseEnd: line.pauseEnd ?? null,
    pauseYearly: line.pauseYearly ?? true,
  };
  if (!p.pauseActive || !p.pauseStart || !p.pauseEnd) return 0;
  const start = startUgeNr(line.startWeek);
  if (start == null) return 0; // kan ikke placere besøgene → intet fradrag
  const refYear = (opts.now ?? new Date()).getUTCFullYear();
  const step = Math.max(1, Math.round(52 / besog));
  let paused = 0;
  for (let i = 0; i < besog; i++) {
    const raa = start + step * i;
    const uge = ((raa - 1) % 52) + 1; // wrap over 52 → samme uge næste år
    const naesteAar = raa > 52;
    const iso = isoMondayOfIsoWeek(naesteAar ? refYear + 1 : refYear, uge);
    if (isPausedOnIso(p, iso)) paused++;
  }
  return paused;
}

/** Thomas, 2026-09-11 (korrektion): interval kan nu sættes PR. OPGAVELINJE på
 *  tilbud — ikke kun for hele tilbuddet. Årsbeløbet bliver derfor SUMMEN PR.
 *  LINJE: hver linje med interval bidrager med pris × besøg pr. år; linjer
 *  uden interval er engangsopgaver og tæller IKKE med. Ingen linjer med
 *  interval → null (ingen årsbeløbs-bundlinje).
 *
 *  Thomas, 2026-09-21 (pause-fradrag): er en linje sat på pause, fratrækkes
 *  prisen på de besøg, pausevinduet fjerner i reference-året
 *  (pris × (besogPrAar − pauseBesogFradragPrAar)) — konsistent med årshjulet.
 *  `opts.now` bestemmer reference-året (default: i dag, samme som årshjulet). */
export function tilbudLinjeAarsbelob(line: AarsbelobLinje, opts: { now?: Date } = {}): number | null {
  if (!line.interval) return null;
  const besog = besogPrAar(line.interval) as number;
  return line.price * (besog - pauseBesogFradragPrAar(line, opts));
}

/** Summen af linje-årsbeløbene (kun linjer med interval). null = ingen linjer
 *  med interval → ingen årsbeløb skal vises. Pause-bevidst: hver linjes
 *  årsbeløb reduceres med dens pause-fradrag (se tilbudLinjeAarsbelob). */
export function tilbudAarsbelobSum(lines: AarsbelobLinje[], opts: { now?: Date } = {}): number | null {
  const dele = lines.map((l) => tilbudLinjeAarsbelob(l, opts)).filter((v): v is number => v != null);
  return dele.length ? dele.reduce((a, b) => a + b, 0) : null;
}