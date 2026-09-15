// Faktura-konsolidering (2026-09-15): en kunde skal kun have ÉN ÅBEN
// (uafsluttet/ikke-sendt) Dinero-faktura ad gangen, som sendes på kundens
// faktureringsdag (pr_gang → straks ved afslutning, maaned/kvartal → d. 20.
// via samlefaktura-cronen). Når en ny opgave lukkes og kunden allerede har en
// åben faktura, tilføjes de nye linjer den EKSISTERENDE åbne faktura i stedet
// for at oprette en ny.
//
// DB-kilden til sandhed er OpenInvoice-tabellen (schema.prisma): rækken
// oprettes når en kladde oprettes, og SLETTES når fakturaen bogføres — en
// bogført faktura er aldrig åben og må ALDRIG ændres. Manuelle linjer på den
// åbne faktura gemmes i InvoiceManualLine, så bogførings-momskontrollerne
// (som sammenligner Dinero-total vs. linjer) stadig stemmer.
//
// Alle tre faktura-maskiner (lib/dinero.ts pr.-ordre-flowet,
// lib/business-invoicing.ts samlefaktura, lib/invoice-all.ts "Fakturér alle")
// bruger denne fil til at ADOPTERE en eksisterende åben kladde frem for at
// oprette en ny — og til at registrere/frigive OpenInvoice-rækken.
//
// Filen er bevidst SELVSTÆNDIG (rå fetch, ingen import fra lib/dinero.ts) —
// lib/dinero.ts importerer herfra, og cirkulær runtime-import er en fælde.
import { prisma } from "./db";

const API_BASE = "https://api.dinero.dk";

/** Minimal kopi af Dinero InvoiceRef (type-only — ingen runtime-cirkulær import). */
export type ConsolidationInvoiceRef = { guid: string; timeStamp: string; number: number | null; totalInclVat: number | null };

export type DraftLine = { description: string; price: number; quantity?: number };

async function fetchInvoiceDetail(access: string, org: string, guid: string): Promise<ConsolidationInvoiceRef> {
  const res = await fetch(`${API_BASE}/v1/${org}/invoices/${guid}`, {
    headers: { Authorization: `Bearer ${access}`, accept: "application/json" },
  });
  const raw = await res.text().catch(() => "");
  if (!res.ok) throw new Error(`Dinero GET invoice fejlede (${res.status}): ${raw.slice(0, 300)}`);
  const d = JSON.parse(raw) as Record<string, unknown>;
  const ci = (o: Record<string, unknown>, k: string) => Object.entries(o).find(([key]) => key.toLowerCase() === k.toLowerCase())?.[1];
  return {
    guid: (ci(d, "Guid") as string) ?? guid,
    timeStamp: (ci(d, "TimeStamp") as string) ?? "",
    number: (ci(d, "Number") as number | null) ?? null,
    totalInclVat: (ci(d, "TotalInclVat") as number | null) ?? null,
  };
}

/** Tilføj produktlinjer til en Dinero KLADDE (POST /invoices/{guid}/productlines).
 *  Kaster ved fejl — kaldere har deres egen fejl-håndtering/status-persist. */
export async function addProductLinesToDraft(
  access: string,
  org: string,
  guid: string,
  lines: DraftLine[],
  salesAccountNumber: number,
): Promise<void> {
  for (const line of lines) {
    const body = {
      Description: line.description,
      Quantity: line.quantity ?? 1,
      AccountNumber: salesAccountNumber,
      Unit: "parts",
      Discount: 0,
      LineType: "Product",
      BaseAmountValue: line.price, // kr INCL. moms — samme konvention som createDraftInvoice
    };
    const res = await fetch(`${API_BASE}/v1/${org}/invoices/${guid}/productlines`, {
      method: "POST",
      headers: { Authorization: `Bearer ${access}`, accept: "application/json", "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const raw = await res.text().catch(() => "");
      throw new Error(`Kunne ikke tilføje linje til åben faktura (${res.status}): ${raw.slice(0, 300)}`);
    }
  }
}

/** Find kontaktens ÅBNE Dinero-kladde — men STOL ALDRIG blindt på DB-rækken:
 *  Dinero bekræftes at fakturaen stadig er en kladde (intet fakturanummer =
 *  ikke bogført). En forældet række (fakturaen er alligevel bogført i Dinero)
 *  ryddes op og der returneres null — en bogført faktura må aldrig få tilføjet
 *  linjer. Ved Dinero-fejl returneres null (fail-open, samme afvejning som
 *  invoiceHasPayment i lib/dinero.ts) — kalderen opretter så en ny kladde. */
export async function findOpenDraftForContact(
  access: string,
  org: string,
  contactId: number,
): Promise<{ guid: string; timeStamp: string; totalInclVat: number | null } | null> {
  const row = await prisma.openInvoice.findUnique({ where: { contactId } });
  if (!row) return null;
  try {
    const detail = await fetchInvoiceDetail(access, org, row.guid);
    if (detail.number != null) {
      // Fakturaen er bogført i Dinero — rækken er forældet; ryd op (best-effort).
      await prisma.openInvoice.deleteMany({ where: { contactId, guid: row.guid } }).catch(() => {});
      return null;
    }
    return { guid: row.guid, timeStamp: detail.timeStamp || "", totalInclVat: detail.totalInclVat ?? null };
  } catch {
    return null; // kan ikke verificere → adopter IKKE (se kommentar ovenfor)
  }
}

/** Registrér en ny åben kladde for kontakten (højst ÉN række pr. kontakt —
 *  en evt. ældre række erstattes). */
export async function registerOpenInvoice(contactId: number, guid: string): Promise<void> {
  await prisma.openInvoice.deleteMany({ where: { contactId, NOT: { guid } } });
  await prisma.openInvoice.upsert({
    where: { contactId },
    create: { contactId, guid, status: "Draft" },
    update: { guid, status: "Draft" },
  });
}

/** Frigiv den åbne faktura (kaldes efter bogføring — fakturaen er ikke længere
 *  åben). Sletter KUN rækken hvis guid'en matcher, så en samtidig ny kladde
 *  aldrig fejlagtigt ryddes væk. */
export async function releaseOpenInvoice(contactId: number, guid: string): Promise<void> {
  await prisma.openInvoice.deleteMany({ where: { contactId, guid } }).catch(() => {});
}

/** Sum (kr inkl. moms) af manuelle linjer på fakturaen — bruges af
 *  momskontrollerne så en manuel linje aldrig får bogføring til at afvise. */
export async function manualLinesSumKr(guid: string): Promise<number> {
  const lines = await prisma.invoiceManualLine.findMany({
    where: { guid },
    select: { quantity: true, priceInclVat: true },
  });
  return lines.reduce((a, l) => a + Number(l.quantity) * l.priceInclVat, 0);
}

/** Forventet Dinero-total (kr inkl. moms) ved bogføring af en ADOPTERET kladde:
 *  kladdens total FRA før de nye linjer blev tilføjet (den inkluderer allerede
 *  manuelle linjer) + de nye linjers sum. */
export function expectedTotalKr(currentTotalInclVat: number | null, newLines: DraftLine[]): number {
  return (currentTotalInclVat ?? 0) + newLines.reduce((a, l) => a + l.price * (l.quantity ?? 1), 0);
}
