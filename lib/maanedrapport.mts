// Månedrapport (Thomas 2026-09-09, godkendt layout v3): én PDF pr. erhvervskunde —
// besøg med opgavebeskrivelser (INGEN priser) + KS-fotos i gitter + salgssektion.
// @react-pdf/renderer indlæses LAZY via dynamic import(): pakken er ESM-only og
// kan ikke requires fra dette CJS-repo — dynamic import virker begge veje (også
// i Next.js server-runtime og under node --import tsx --test).
import type { RapportData } from "./maanedrapport-types";

// 8 service-kort — TEKST ER GODKENDT AF THOMAS (2026-09-09), ændr ikke uden OK
export const SERVICES: Array<[string, string]> = [
  ["Hækklipning og beskæring", "Fast pris pr. meter — affaldet kørt væk"],
  ["Græspleje (Greenkeeper)", "Gødning, frø og pleje hele sæsonen"],
  ["Robotplæneklipper-service", "Opsætning, vinterklar og reparation"],
  ["Vinduesvask", "Ude og inde — også høje facader"],
  ["Facade- og fliserens", "Algebehandling, solceller og tagrender"],
  ["Ukrudtsbekæmpelse", "Fortove, indkørsler og bede"],
  ["Viceværts- og ejendomsservice", "Fast aftale — ét sted til det hele"],
  ["Bortskaffelse af haveaffald", "Vi tager det grønne med — du skal ikk' røre en finger"],
];

export type { RapportData };
export type { RapportBesog } from "./maanedrapport-types";

/** "Tirsdag d. 3. september" fra en Date (da-DK, ugedag + dato). */
export function formatBesogDato(d: Date): string {
  const ugedag = new Intl.DateTimeFormat("da-DK", { weekday: "long", timeZone: "Europe/Copenhagen" }).format(d);
  const dato = new Intl.DateTimeFormat("da-DK", { day: "numeric", month: "long", timeZone: "Europe/Copenhagen" }).format(d);
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
  return `${cap(ugedag)} d. ${dato}`;
}

/** Måned-afgrænsning i dansk lokal tid (Europe/Copenhagen) — aldrig UTC-udskæring. */
export function maanedWindow(year: number, month1based: number): { start: Date; end: Date } {
  const p2 = (n: number) => String(n).padStart(2, "0");
  const start = new Date(`${year}-${p2(month1based)}-01T00:00:00+02:00`);
  const nm = month1based === 12 ? `${year + 1}-01-01` : `${year}-${p2(month1based + 1)}-01`;
  const end = new Date(`${nm}T00:00:00+02:00`);
  return { start, end };
}

/** Pilot-gate: MAANEDSRAPPORT_PILOT_CONTACTS (comma-sep contactId'er). Tom/udefineret = ALLE erhverv. */
export function pilotGateAktiv(pilotEnv: string | undefined): boolean {
  return !!pilotEnv && pilotEnv.trim().length > 0;
}
export function contactErIPilot(contactId: number, pilotEnv: string | undefined): boolean {
  if (!pilotGateAktiv(pilotEnv)) return true;
  const ids = pilotEnv!.split(",").map((s) => s.trim()).filter(Boolean).map(Number);
  return ids.includes(contactId);
}

/** Byg rapport-PDF i hukommelsen (Buffer). Kaldes fra cron-flowet d. 20. */
export async function genererMaanedrapportPdf(data: RapportData): Promise<Uint8Array> {
  // Lazy ESM-import: @react-pdf/renderer er ESM-only, repoet er CJS — require() fejler.
  const { renderMaanedrapportDocument } = await import("./maanedrapport-doc.mts");
  return await renderMaanedrapportDocument(data);
}
