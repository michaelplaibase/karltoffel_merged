// Den daglige faktura-status-rapport (til Thomas, ejeren): en ren, testbar
// aggregering af ordrer til en dansk, ikke-teknisk mail. Læser KUN — funktionerne
// her kan aldrig udløse fakturering; de beregner bare tal og tekst ud fra data,
// der allerede ligger i databasen (først skrevet af Afslut ordre-flowet og
// lib/business-invoicing.ts). Klassificeringen genbruger lib/invoice-status.ts,
// som også driver faktureringsoversigtssiden.
import { invoiceLabel, invoiceTone, CLOSED_STATUSES } from "./invoice-status";

/** Rå ordre-linje som rapporten forstår den — præcis de felter vi select'er i
 *  API-ruten (tasks er allerede reduceret til en pris, så Prisma-typer holdes
 *  ude af de rene funktioner). */
export type ReportOrder = {
  id: number;
  customer: string;
  price: number; // sum af task-priser
  status: string;
  plannedAt: Date;
  invoiceDecision: string | null;
  dineroInvoiceGuid: string | null;
  dineroInvoiceStatus: string | null;
  dineroInvoiceNumber: number | null;
  dineroError: string | null;
  invoicedAt: Date | null;
  businessBatchInvoiceGuid: string | null;
  businessBatchInvoiceStatus: string | null;
  businessBatchInvoiceNumber: number | null;
  businessBatchError: string | null;
  businessBatchInvoicedAt: Date | null;
};

export type SentInvoiceLine = { id: number; customer: string; price: number; label: string; number: number | null };
export type ProblemLine = { id: number; customer: string; price: number; detail: string };

export type InvoiceReport = {
  /** Pr.-ordre-fakturaer sendt i vinduet ("i går"). */
  sentPerOrder: SentInvoiceLine[];
  /** Erhvervs-samlefakturaer (måned/kvartal-flow) sendt i vinduet. */
  sentBatches: SentInvoiceLine[];
  /** 'Udført' men stadig uden faktura — skal følges op. */
  readyNotInvoiced: ProblemLine[];
  /** Ordrer med en gemt fejl (dineroError / businessBatchError). */
  errors: ProblemLine[];
  /** Samlet beløb for alt sendt i vinduet (pr.-ordre + samlefaktura). */
  totalSent: number;
};

/** Er ordren "sendt" i vinduet? Pr.-ordre bruger invoicedAt, samlefaktura
 *  bruger businessBatchInvoicedAt (sat af lib/business-invoicing.ts). */
function sentInWindow(o: ReportOrder, from: Date, to: Date): "perOrder" | "batch" | null {
  if (o.invoicedAt && o.invoicedAt >= from && o.invoicedAt < to) return "perOrder";
  if (o.businessBatchInvoicedAt && o.businessBatchInvoicedAt >= from && o.businessBatchInvoicedAt < to) return "batch";
  return null;
}

/** Bygger rapport-data af rå ordrer + tidsvinduet [from, to) ("i går").
 *  Ren funktion — ingen DB, ingen netværk, let at teste. */
export function buildInvoiceReport(orders: ReportOrder[], from: Date, to: Date): InvoiceReport {
  const sentPerOrder: SentInvoiceLine[] = [];
  const sentBatches: SentInvoiceLine[] = [];
  const readyNotInvoiced: ProblemLine[] = [];
  const errors: ProblemLine[] = [];

  for (const o of orders) {
    const label = invoiceLabel(o);
    const which = sentInWindow(o, from, to);
    if (which === "perOrder") {
      sentPerOrder.push({ id: o.id, customer: o.customer, price: o.price, label: label ?? "Faktura sendt", number: o.dineroInvoiceNumber });
    } else if (which === "batch") {
      sentBatches.push({ id: o.id, customer: o.customer, price: o.price, label: label ?? "Samlefaktura sendt", number: o.businessBatchInvoiceNumber });
    }

    // Problem-ordrer: færdigmeldt men ingen faktura (samme regel som
    // "Klar til fakturering" på oversigtssiden: Udført + intet faktura-label —
    // dvs. "Ingen faktura (valgt)" tælles IKKE som problem).
    if (o.status === "Udført" && label === null) {
      readyNotInvoiced.push({ id: o.id, customer: o.customer, price: o.price, detail: "Udført, men ingen faktura" });
    }

    // Gemte fejl fra begge faktura-flows — rapporteres uanset vindue, så de
    // bliver ved med at stå i mailen indtil de er ryddet (ved vellykket forsøg).
    if (o.dineroError) {
      errors.push({ id: o.id, customer: o.customer, price: o.price, detail: o.dineroError });
    } else if (o.businessBatchError) {
      errors.push({ id: o.id, customer: o.customer, price: o.price, detail: o.businessBatchError });
    }
  }

  // Sortér: problem-ordrer ældst først (de har ventet længst), resten efter ordre-id.
  readyNotInvoiced.sort((a, b) => a.id - b.id);
  errors.sort((a, b) => a.id - b.id);

  const totalSent = [...sentPerOrder, ...sentBatches].reduce((a, l) => a + l.price, 0);
  return { sentPerOrder, sentBatches, readyNotInvoiced, errors, totalSent };
}

/** UTC-dato som "YYYY-MM-DD" (samme konvention som lib/queries.ts ymd). */
function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** Offset (ms) mellem UTC og dansk tid for en given dag — beregnet ved kl. 12
 *  UTC den dag (sikkert punkt: Danmark skifter aldrig sommer/vinter-tid midt
 *  på dagen). Positiv om sommeren (+2t), negativ-forhold om vinteren (+1t). */
function cphOffsetMs(dayISO: string): number {
  const noonUTC = new Date(`${dayISO}T12:00:00Z`).getTime();
  // "sv-SE" giver "YYYY-MM-DD HH:MM:SS" — parsebart som ISO efter et trick.
  const wall = new Date(noonUTC).toLocaleString("sv-SE", { timeZone: "Europe/Copenhagen" });
  return new Date(wall.replace(" ", "T") + "Z").getTime() - noonUTC;
}

/** "I går" i dansk tid (Europe/Copenhagen) som [start, slut)-vindue i UTC.
 *  Ordrer gemmes med UTC-middag, men invoicedAt er et rigtigt klokkeslæt, så
 *  vinduet skal følge den danske kalenderdag — ikke UTC-døgnet. */
export function cphYesterdayWindow(now: Date): { from: Date; to: Date; day: string } {
  const todayISO = new Date(now.getTime() - cphOffsetMs(ymd(now))).toISOString().slice(0, 10);
  const yesterdayISO = new Date(new Date(`${todayISO}T00:00:00Z`).getTime() - 864e5).toISOString().slice(0, 10);
  const from = new Date(Date.parse(`${yesterdayISO}T00:00:00Z`) - cphOffsetMs(yesterdayISO));
  const to = new Date(from.getTime() + 864e5);
  return { from, to, day: yesterdayISO };
}

const money = (n: number) => n.toLocaleString("da-DK") + " kr.";

/** Dansk, enkel tekst-version af rapporten (mailens text-del). */
export function formatInvoiceReportText(report: InvoiceReport, day: string): string {
  const L: string[] = [];
  L.push(`Daglig faktura-rapport — ${day}`);
  L.push("");
  L.push("=== Fakturaer sendt i går ===");
  if (report.sentPerOrder.length === 0) {
    L.push("Ingen pr.-ordre-fakturaer blev sendt i går.");
  } else {
    L.push(`Antal: ${report.sentPerOrder.length}`);
    for (const l of report.sentPerOrder) {
      L.push(`  Ordre #${l.id} — ${l.customer}: ${money(l.price)} (${l.label})`);
    }
  }
  L.push("");
  L.push("=== Samlefakturaer (måned/kvartal) sendt i går ===");
  if (report.sentBatches.length === 0) {
    L.push("Ingen samlefakturaer blev sendt i går (de går normalt ud den 20. i måneden).");
  } else {
    L.push(`Antal: ${report.sentBatches.length}`);
    for (const l of report.sentBatches) {
      L.push(`  Ordre #${l.id} — ${l.customer}: ${money(l.price)} (${l.label})`);
    }
  }
  L.push("");
  L.push("=== Skal følges op: Udført men IKKE faktureret ===");
  if (report.readyNotInvoiced.length === 0) {
    L.push("Ingen — alt færdigmeldt er faktureret. 🎉");
  } else {
    L.push(`${report.readyNotInvoiced.length} ordrer venter på faktura:`);
    for (const l of report.readyNotInvoiced) {
      L.push(`  Ordre #${l.id} — ${l.customer}: ${money(l.price)}`);
    }
  }
  L.push("");
  L.push("=== Fejl ===");
  if (report.errors.length === 0) {
    L.push("Ingen fejl registreret.");
  } else {
    L.push(`${report.errors.length} ordre(r) har en fejl:`);
    for (const l of report.errors) {
      L.push(`  Ordre #${l.id} — ${l.customer}: ${l.detail}`);
    }
  }
  L.push("");
  L.push(`=== Total sendt i går: ${money(report.totalSent)} ===`);
  L.push("");
  L.push("Se detaljer i CRM'et under Faktureringsoverblik. (Denne mail er kun en oversigt — den udløser ingen fakturering.)");
  return L.join("\n");
}
