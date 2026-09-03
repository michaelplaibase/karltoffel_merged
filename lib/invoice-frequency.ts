// Faktureringsregel pr. kunde (Thomas, 2026-09-03):
//   pr_gang  = faktura pr. gennemført opgave (sendes automatisk kl. 23 hver aften)
//   maaned   = opgaver samlet pr. måned, sendes automatisk d. 20.
//   kvartal  = opgaver samlet pr. kvartal, sendes automatisk d. 20. i måneden
//              EFTER kvartalets udløb (apr/jul/okt/jan).
// ''/'auto' = afled af isCompany: privat → pr_gang, erhverv → maaned.
// Egen lille fil, fordi BÅDE lib/dinero.ts (pr.-ordre-værnet) og
// lib/business-invoicing.ts (samlefaktura-flowet) skal bruge den — og
// business-invoicing allerede importerer fra dinero, så hjælperen må ikke
// bo i en af dem (cirkulært import-fælden).

export type InvoiceFrequency = "pr_gang" | "maaned" | "kvartal";

export function effectiveInvoiceFrequency(contact: { isCompany: boolean; invoiceFrequency: string | null }): InvoiceFrequency {
  const v = contact.invoiceFrequency ?? "";
  if (v === "pr_gang" || v === "maaned" || v === "kvartal") return v;
  return contact.isCompany ? "maaned" : "pr_gang";
}

/** [start, end) for den kvartalsperiode der sluttede lige før `now` — kørsel
 *  d. 20. i jan/apr/jul/okt sender Foregående kvartal (fx 20. apr → 1. jan-31.
 *  mar). Returnerer null udenfor de fire kørselsdager. */
export function quarterlyPeriodEndingBefore(now: Date): { start: Date; end: Date; label: string } | null {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth(); // 0-indexed
  if (now.getUTCDate() !== 20 || m % 3 !== 0) return null; // kun d. 20. i jan/apr/jul/okt
  const end = new Date(Date.UTC(y, m, 1)); // eksklusiv slut = kvartalets sidste dag + 1
  const start = new Date(Date.UTC(y, m - 3, 1));
  const fmt = (d: Date) => `${String(d.getUTCDate()).padStart(2, "0")}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${d.getUTCFullYear()}`;
  const lastDay = new Date(end.getTime() - 864e5);
  return { start, end, label: `${fmt(start)} til ${fmt(lastDay)}` };
}
