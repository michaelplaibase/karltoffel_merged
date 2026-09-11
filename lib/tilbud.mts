// Tilbud-modul — rene hjælpefunktioner (ingen DB/prisma), så de kan testes
// med node --test uden database (samme mønster som lib/maanedrapport.mts).
import { randomBytes } from "node:crypto";
import { tilbudAarsbelobSum, besogPrAar } from "./subscription-intervals";

export const TILBUD_STATUSES = ["udkast", "sendt", "accepteret", "afvist", "konverteret"] as const;
export type TilbudStatus = (typeof TILBUD_STATUSES)[number];

export type TilbudLineData = { description: string; price: number; interval?: string | null; startWeek?: string | null };

/** Total for tilbuddet — priser er inkl. moms (kr, heltal), samme model som
 *  den eksisterende "Send tilbud"-flow i CRM'et. */
export function tilbudTotal(lines: { price: number }[]): number {
  return lines.reduce((sum, l) => sum + (Number.isFinite(l.price) ? l.price : 0), 0);
}

/** Dansk formatering af pris: 12345 → "12.345 kr." */
export function kr(n: number): string {
  return n.toLocaleString("da-DK") + " kr.";
}

/** Thomas, 2026-09-11 (korrektion): kundevenlig frekvens-tekst pr. linje —
 *  "Hver 6. uge" → "hver 6. uge", "1 gang om året" → "1 gang om året".
 *  null/tom interval → null (linjen er en engangsopgave og vises uden frekvens). */
export function frekvensTekst(interval: string | null | undefined): string | null {
  const t = (interval ?? "").trim();
  return t ? t.toLowerCase() : null;
}

/** Thomas, 2026-09-11 (korrektion 2): diskret startuge-tekst pr. linje —
 *  "Starter uge 29" (lowercase "uge" som frekvensen). null/tom → null. */
export function linjeStartugeTekst(startWeek: string | null | undefined): string | null {
  const t = (startWeek ?? "").trim();
  return t ? `Starter ${t.charAt(0).toLowerCase()}${t.slice(1)}` : null;
}

/** Én kundevenlig linjetekst: "Vinduespudsning — 566 kr. pr. gang — hver 6. uge".
 *  Uden interval: "Tagrender — 566 kr." (engangsopgave). Med startuge:
 *  "... — starter uge 29" (diskret, kun når linjen har en startuge). */
export function linjeKundeTekst(line: { description: string; price: number; interval?: string | null; startWeek?: string | null }): string {
  const frek = frekvensTekst(line.interval);
  const start = linjeStartugeTekst(line.startWeek);
  return `${line.description} — ${kr(line.price)} pr. gang${frek ? ` — ${frek}` : ""}${start ? ` — ${start}` : ""}`;
}

/** Engangs-token til det offentlige accept-link /t/{token} — samme mønster som
 *  lib/quote-tokens.ts (24 bytes base64url, udløber efter 30 dage). */
export function nyAcceptToken(): string {
  return randomBytes(24).toString("base64url");
}

export function acceptTokenUdløber(now: Date = new Date()): Date {
  return new Date(now.getTime() + 30 * 86_400_000);
}

/** Thomas, 2026-09-11: intern medarbejder pr. opgavelinje → TaskLine.employeeId
 *  ved konvertering (kunde-accept via link, manuel accept eller admin).
 *  SAMME felt som abonnements-opgaver (TaskLine.employeeId Int?, null = vælges
 *  automatisk). Medarbejderen skal ALDRIG ses i PDF/accept-side/årshjul — der
 *  bygger deres data ud fra eksplicitte feltlister uden employeeId. */
export function tasklineMedarbejdere<T extends { employeeId?: number | null | undefined }>(linjer: readonly T[]): (number | null)[] {
  return linjer.map((l) => (Number.isInteger(l.employeeId) ? (l.employeeId as number) : null));
}

/** Data-shape der sendes ind i PDF-rendereren (lib/tilbud-doc.mts). */
export type TilbudPdfData = {
  kundeNavn: string;
  hilsenNavn: string;
  titel: string;
  note: string | null;
  startWeek: string | null; // valgfri startuge — udelades hvis tom
  baseInterval: string | null; // valgfrit tilbud-niveau interval — udelades hvis tomt
  linjer: { description: string; price: number; interval: string | null; startWeek: string | null }[];
  /** Årligt beløb = SUMMEN PR. LINJE (pris × besøg pr. år for hver linje med
   *  interval) — KUN når mindst én linje har interval (Thomas, 2026-09-11
   *  korrektion: interval er nu pr. opgavelinje; beregningen deles med
   *  abonnementet via lib/subscription-intervals, så tallene aldrig afviger). */
  aarsbelob: number | null;
  fotosForside: string[]; // base64 data-URIs
  fotosPerLinje: string[][]; // samme index som linjer
};

export type TilbudInput = {
  contact: { name: string; companyName: string | null; att: string | null };
  title: string;
  note: string | null;
  startWeek?: string | null;
  baseInterval?: string | null;
  lines: { description: string; price: number; interval?: string | null; startWeek?: string | null }[];
};

export function buildTilbudPdfData(input: TilbudInput): TilbudPdfData {
  const navn = input.contact.companyName || input.contact.name || "Kunden";
  const fornavn = (input.contact.att || input.contact.name || "kunde").split(" ")[0];
  const linjer = input.lines.map((l) => ({
    description: l.description,
    price: l.price,
    interval: l.interval?.trim() || null,
    // Thomas, 2026-09-11 (korrektion 2): valgfri startuge pr. linje — vises
    // diskret på linjen ("Starter uge 29"); tom = intet vist.
    startWeek: l.startWeek?.trim() || null,
  }));
  return {
    kundeNavn: navn,
    hilsenNavn: fornavn,
    titel: input.title || "Tilbud",
    note: input.note || null,
    startWeek: input.startWeek?.trim() || null,
    baseInterval: input.baseInterval?.trim() || null,
    linjer,
    // Summen pr. linje: kun linjer med interval tæller med (linjer uden interval
    // er engangsopgaver — vises som "engangsopgave" uden årsbeløb).
    aarsbelob: tilbudAarsbelobSum(linjer),
    fotosForside: [],
    fotosPerLinje: input.lines.map(() => []),
  };
}

// ─── Årshjul (Thomas, 2026-09-11): alle opgaverne over året pr. uge ─────────
// Ud fra linjernes startuge + interval beregnes alle besøg i løbet af 12
// måneder (fx Vindue hver 4. uge fra uge 29 → uge 29, 33, 37, …; Tagrender
// "1 gang om året" i uge 38). Samme besøgs-matematik som årsbeløbet
// (besogPrAar) — spredt jevnt: uge = startuge + round(52/besøg) × i.
// Sendes SAMMEN MED TILBUDET: vises i formularen, på detaljesiden, i PDF'en
// (lib/tilbud-doc.mts) og på accept-siden (app/t/[token]).

/** 'Uge 29' / 'Uge 29, 2026' → 29. Ugyldig/manglende → null. */
export function parseUgeNr(startWeek: string | null | undefined): number | null {
  const m = (startWeek ?? "").match(/Uge\s*(\d{1,2})/i);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= 53 ? n : null;
}

/** Kort initial-tegn til årshjulet: "Vinduespudsning" → "V", "Tagrender +
 *  nedløbskontrol" → "TN" (to første ord, første bogstav, versal). */
export function kortNavn(titel: string): string {
  const ord = (titel ?? "").trim().split(/[\s,]+/).filter((o) => /[a-zæøå]/i.test(o));
  if (!ord.length) return "?";
  return ord.slice(0, 2).map((o) => o.charAt(0).toUpperCase()).join("");
}

export type AarshjulOpgave = { titel: string; kort: string; /** besøget falder i næste år (uger > 52) */ naesteAar?: boolean };
export type AarshjulUge = { uge: number; opgaver: AarshjulOpgave[] };

/** Byg årshjulet: [{uge, opgaver:[{titel, kort}]}] sorteret pr. uge (1–52).
 *  Besøg = besogPrAar(interval) (samme afrunding som årsbeløbet — "1 gang om
 *  året" → 1 besøg). Uden interval behandles linjen som EN engangsopgave på
 *  startugen. Linjer uden startuge kan ikke placeres og udelades. Besøg der
 *  ruller over uge 52 markeres naesteAar (årstalskift-note i UI/PDF). */
export function bygAarshjul(
  linjer: { description: string; interval?: string | null; startWeek?: string | null }[],
): AarshjulUge[] {
  const perUge = new Map<number, AarshjulOpgave[]>();
  for (const l of linjer) {
    const start = parseUgeNr(l.startWeek);
    const titel = (l.description ?? "").trim();
    if (start == null || !titel) continue;
    const besog = besogPrAar(l.interval) ?? 1;
    const step = Math.max(1, Math.round(52 / besog));
    for (let i = 0; i < besog; i++) {
      const raa = start + step * i;
      const uge = ((raa - 1) % 52) + 1; // wrap over 52 → samme uge næste år
      const liste = perUge.get(uge) ?? [];
      liste.push({ titel: l.description, kort: kortNavn(l.description), naesteAar: raa > 52 || undefined });
      perUge.set(uge, liste);
    }
  }
  return [...perUge.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([uge, opgaver]) => ({ uge, opgaver }));
}

/** Teknisk acceptetiket for status — bruges i lister og mails til staff. */
export function statusLabel(status: string): string {
  switch (status) {
    case "udkast": return "Udkast";
    case "sendt": return "Sendt";
    case "accepteret": return "Accepteret";
    case "afvist": return "Afvist";
    case "konverteret": return "Konverteret til abonnement";
    default: return status;
  }
}