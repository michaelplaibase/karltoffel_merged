// Tilbud-modul — rene hjælpefunktioner (ingen DB/prisma), så de kan testes
// med node --test uden database (samme mønster som lib/maanedrapport.mts).
import { randomBytes } from "node:crypto";
import { aarsbelob } from "./subscription-intervals";

export const TILBUD_STATUSES = ["udkast", "sendt", "accepteret", "afvist", "konverteret"] as const;
export type TilbudStatus = (typeof TILBUD_STATUSES)[number];

export type TilbudLineData = { description: string; price: number };

/** Total for tilbuddet — priser er inkl. moms (kr, heltal), samme model som
 *  den eksisterende "Send tilbud"-flow i CRM'et. */
export function tilbudTotal(lines: { price: number }[]): number {
  return lines.reduce((sum, l) => sum + (Number.isFinite(l.price) ? l.price : 0), 0);
}

/** Dansk formatering af pris: 12345 → "12.345 kr." */
export function kr(n: number): string {
  return n.toLocaleString("da-DK") + " kr.";
}

/** Engangs-token til det offentlige accept-link /t/{token} — samme mønster som
 *  lib/quote-tokens.ts (24 bytes base64url, udløber efter 30 dage). */
export function nyAcceptToken(): string {
  return randomBytes(24).toString("base64url");
}

export function acceptTokenUdløber(now: Date = new Date()): Date {
  return new Date(now.getTime() + 30 * 86_400_000);
}

/** Data-shape der sendes ind i PDF-rendereren (lib/tilbud-doc.mts). */
export type TilbudPdfData = {
  kundeNavn: string;
  hilsenNavn: string;
  titel: string;
  note: string | null;
  startWeek: string | null; // valgfri startuge — udelades hvis tom
  baseInterval: string | null; // valgfrit interval — udelades hvis tomt
  linjer: { description: string; price: number }[];
  /** Årligt beløb (pris pr. gang × besøg pr. år) — KUN når intervallet er sat
   *  (Thomas, 2026-09-11: det gamle 'samlet beløb' er fjernet fra tilbud,
   *  PDF og accept-side; beregningen deles med abonnementet via
   *  lib/subscription-intervals, så tallene aldrig afviger). */
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
  lines: { description: string; price: number }[];
};

export function buildTilbudPdfData(input: TilbudInput): TilbudPdfData {
  const navn = input.contact.companyName || input.contact.name || "Kunden";
  const fornavn = (input.contact.att || input.contact.name || "kunde").split(" ")[0];
  return {
    kundeNavn: navn,
    hilsenNavn: fornavn,
    titel: input.title || "Tilbud",
    note: input.note || null,
    startWeek: input.startWeek?.trim() || null,
    baseInterval: input.baseInterval?.trim() || null,
    linjer: input.lines,
    aarsbelob: aarsbelob(input.baseInterval, tilbudTotal(input.lines)),
    fotosForside: [],
    fotosPerLinje: input.lines.map(() => []),
  };
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