// Ren aggregeringstest for den daglige faktura-rapport — ingen DB, ingen
// netværk. Dækker buildInvoiceReport (alle fem rapportdele), cphYesterdayWindow
// (dansk-tids-vindue) og formatInvoiceReportText (mail-teksten).
import test from "node:test";
import assert from "node:assert/strict";
import { buildInvoiceReport, formatInvoiceReportText, cphYesterdayWindow, type ReportOrder } from "../lib/invoice-report";

function order(over: Partial<ReportOrder>): ReportOrder {
  return {
    id: 1, customer: "Test Kunde", price: 500, status: "Udført", plannedAt: new Date("2026-09-01T12:00:00Z"),
    invoiceDecision: null,
    dineroInvoiceGuid: null, dineroInvoiceStatus: null, dineroInvoiceNumber: null, dineroError: null, invoicedAt: null,
    businessBatchInvoiceGuid: null, businessBatchInvoiceStatus: null, businessBatchInvoiceNumber: null, businessBatchError: null, businessBatchInvoicedAt: null,
    ...over,
  };
}

// Vindue: hele 1. september 2026 (UTC til testformål).
const FROM = new Date("2026-09-01T00:00:00Z");
const TO = new Date("2026-09-02T00:00:00Z");

test("pr.-ordre-faktura sendt i vinduet bliver talt med kunde, beløb og nummer", () => {
  const r = buildInvoiceReport([
    order({ id: 10, customer: "Bager Jensen", price: 1200, dineroInvoiceGuid: "g1", dineroInvoiceStatus: "Sent", dineroInvoiceNumber: 1042, invoicedAt: new Date("2026-09-01T14:00:00Z") }),
  ], FROM, TO);
  assert.equal(r.sentPerOrder.length, 1);
  assert.deepEqual(r.sentPerOrder[0], { id: 10, customer: "Bager Jensen", price: 1200, label: "Faktura sendt (#1042)", number: 1042 });
  assert.equal(r.totalSent, 1200);
});

test("faktura sendt UDEN for vinduet (i forgårs / i dag) tælles ikke", () => {
  const r = buildInvoiceReport([
    order({ id: 11, dineroInvoiceGuid: "g", dineroInvoiceStatus: "Sent", invoicedAt: new Date("2026-08-31T23:59:59Z") }),
    order({ id: 12, dineroInvoiceGuid: "g", dineroInvoiceStatus: "Sent", invoicedAt: new Date("2026-09-02T00:00:00Z") }),
  ], FROM, TO);
  assert.equal(r.sentPerOrder.length, 0);
  assert.equal(r.totalSent, 0);
});

test("samlefaktura (erhverv) sendt i vinduet lander i sentBatches med sit nummer", () => {
  const r = buildInvoiceReport([
    order({ id: 20, customer: "Erhverv A/S", price: 7500, businessBatchInvoiceGuid: "b1", businessBatchInvoiceStatus: "Booked", businessBatchInvoiceNumber: 2001, businessBatchInvoicedAt: new Date("2026-09-01T05:00:00Z") }),
  ], FROM, TO);
  assert.equal(r.sentBatches.length, 1);
  assert.equal(r.sentBatches[0].label, "Samlefaktura sendt");
  assert.equal(r.sentBatches[0].number, 2001);
  assert.equal(r.totalSent, 7500);
});

test("'Udført' uden faktura er et problem; 'Ingen faktura (valgt)' er det IKKE", () => {
  const r = buildInvoiceReport([
    order({ id: 30, status: "Udført" }),
    order({ id: 31, status: "Udført", invoiceDecision: "Send ikke faktura fra Karltoffel" }),
    order({ id: 32, status: "Ikke meldt færdigt" }),
  ], FROM, TO);
  assert.deepEqual(r.readyNotInvoiced.map((p) => p.id), [30]);
  assert.equal(r.readyNotInvoiced[0].detail, "Udført, men ingen faktura");
});

test("gemte fejl rapporteres for begge flows (dineroError først)", () => {
  const r = buildInvoiceReport([
    order({ id: 40, dineroError: "Dinero afviste bogføring" }),
    order({ id: 41, businessBatchError: "Samlefaktura kunne ikke oprettes" }),
  ], FROM, TO);
  assert.deepEqual(r.errors.map((e) => e.id), [40, 41]);
  assert.equal(r.errors[0].detail, "Dinero afviste bogføring");
  assert.equal(r.errors[1].detail, "Samlefaktura kunne ikke oprettes");
});

test("totalbeløb summer pr.-ordre og samlefaktura sammen", () => {
  const r = buildInvoiceReport([
    order({ id: 50, price: 300, dineroInvoiceGuid: "g", dineroInvoiceStatus: "Sent", invoicedAt: new Date("2026-09-01T10:00:00Z") }),
    order({ id: 51, price: 450, businessBatchInvoiceGuid: "b", businessBatchInvoiceStatus: "Sent", businessBatchInvoicedAt: new Date("2026-09-01T10:00:00Z") }),
    order({ id: 52, price: 999, status: "Udført" }), // ikke sendt — tælles ikke
  ], FROM, TO);
  assert.equal(r.totalSent, 750);
});

test("tom ordreliste giver en pæn, tom rapport", () => {
  const r = buildInvoiceReport([], FROM, TO);
  assert.equal(r.totalSent, 0);
  const text = formatInvoiceReportText(r, "2026-09-01");
  assert.match(text, /Ingen pr.-ordre-fakturaer/);
  assert.match(text, /Ingen fejl registreret/);
  assert.match(text, /Total sendt i går: 0 kr/);
});

test("mail-teksten nævner kundenavn, beløb og antal der skal følges op", () => {
  const r = buildInvoiceReport([
    order({ id: 60, customer: "Cafe Blå", price: 1250, dineroInvoiceGuid: "g", dineroInvoiceStatus: "Sent", dineroInvoiceNumber: 900, invoicedAt: new Date("2026-09-01T09:00:00Z") }),
    order({ id: 61, status: "Udført", price: 200 }),
  ], FROM, TO);
  const text = formatInvoiceReportText(r, "2026-09-01");
  assert.match(text, /Cafe Blå: 1\.250 kr/);
  assert.match(text, /Antal: 1/);
  assert.match(text, /1 ordrer venter på faktura/);
  assert.match(text, /#61 — Test Kunde/);
});

test("cphYesterdayWindow følger den danske kalenderdag (sommer- og vintertid)", () => {
  // Kørsel kl. 06:00 UTC den 3. sept 2026 = 08:00 dansk → "i går" = 2. sept.
  const { from, to, day } = cphYesterdayWindow(new Date("2026-09-03T06:00:00Z"));
  assert.equal(day, "2026-09-02");
  assert.equal(new Date(from.getTime() + 2 * 3600e3).toISOString(), "2026-09-02T00:00:00.000Z"); // start = dansk midnat (CEST)
  assert.equal(to.getTime() - from.getTime(), 864e5);
  // Vintertid (CET, +1t): samme klokkeslæt giver 1. januar som "i går".
  const winter = cphYesterdayWindow(new Date("2026-01-02T06:00:00Z"));
  assert.equal(winter.day, "2026-01-01");
  assert.equal(new Date(winter.from.getTime() + 3600e3).toISOString(), "2026-01-01T00:00:00.000Z");
});
