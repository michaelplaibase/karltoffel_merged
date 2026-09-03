// Fælles faktura-klassificering (Thomas' faktureringsoverblik + den daglige
// faktura-rapport). Flyttet ud af app/fakturering/page.tsx så begge overflader
// deler ÉN kilde til sandhed — ingen duplikeret logik.

/** Lukkede leveringsstatusser — spejler CLOSED_STATUSES i app/orders/page.tsx. */
export const CLOSED_STATUSES = new Set(["Afsluttet", "Udført", "Sprunget over"]);

export type InvoiceStatusInput = {
  dineroInvoiceGuid: string | null;
  dineroInvoiceStatus: string | null;
  dineroInvoiceNumber?: number | null;
  businessBatchInvoiceGuid: string | null;
  businessBatchInvoiceStatus: string | null;
  invoiceDecision: string | null;
};

/** Faktura-tone: rød = ikke afsendt, gul = afsendt, grøn = betalt.
 *  null = intet at vise (fx "ingen faktura valgt"). */
export function invoiceTone(o: InvoiceStatusInput): "red" | "yellow" | "green" | null {
  if (o.businessBatchInvoiceGuid) {
    const s = o.businessBatchInvoiceStatus ?? "";
    if (s === "Sent" || s === "Booked") return "yellow";
    if (s === "Draft") return "red";
    if (s === "Failed") return "red";
    return "yellow";
  }
  if (o.dineroInvoiceGuid) {
    const s = o.dineroInvoiceStatus ?? "";
    if (s === "Paid") return "green";
    if (s === "Sent" || s === "Booked") return "yellow";
    if (s === "Draft" || s === "Failed" || s === "simulated") return "red";
    return "yellow";
  }
  return null;
}

/** Kort dansk faktura-status for tabeller og rapporter. */
export function invoiceLabel(o: InvoiceStatusInput): string | null {
  if (o.businessBatchInvoiceGuid) {
    const s = o.businessBatchInvoiceStatus ?? "";
    if (s === "Sent" || s === "Booked") return "Samlefaktura sendt";
    if (s === "Draft") return "Samlefaktura-kladde";
    if (s === "Failed") return "Samlefaktura fejlede";
    return "På samlefaktura";
  }
  if (o.dineroInvoiceGuid) {
    const s = o.dineroInvoiceStatus ?? "";
    if (s === "Paid") return "Betalt (kontant)";
    if (s === "Sent" || s === "Booked") return `Faktura sendt${o.dineroInvoiceNumber ? ` (#${o.dineroInvoiceNumber})` : ""}`;
    if (s === "Draft") return "Kladde i Dinero";
    if (s === "Failed") return "Fakturering fejlede";
    if (s === "simulated") return "Simuleret (dry-run)";
  }
  if (o.invoiceDecision === "Send ikke faktura fra Karltoffel") return "Ingen faktura (valgt)";
  if (o.invoiceDecision === "Registrer på et senere tidspunkt") return "Registreres senere";
  return null;
}
