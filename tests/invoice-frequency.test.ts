// Tests for faktureringsregler pr. kunde (Thomas, 2026-09-03):
// pr_gang / maaned / kvartal + auto-afledning + kvartalsperiode.
import test from "node:test";
import assert from "node:assert/strict";
import { effectiveInvoiceFrequency, quarterlyPeriodEndingBefore } from "../lib/invoice-frequency";

test("auto ('') afledes af isCompany: erhverv → maaned, privat → pr_gang", () => {
  assert.equal(effectiveInvoiceFrequency({ isCompany: true, invoiceFrequency: "" }), "maaned");
  assert.equal(effectiveInvoiceFrequency({ isCompany: false, invoiceFrequency: "" }), "pr_gang");
  assert.equal(effectiveInvoiceFrequency({ isCompany: true, invoiceFrequency: null }), "maaned");
  assert.equal(effectiveInvoiceFrequency({ isCompany: false, invoiceFrequency: null }), "pr_gang");
});

test("eksplicit regel vinder altid over auto", () => {
  // Ejerslægtslaug-analog: erhvervskunde med kvartalsregel → kvartal.
  assert.equal(effectiveInvoiceFrequency({ isCompany: true, invoiceFrequency: "kvartal" }), "kvartal");
  assert.equal(effectiveInvoiceFrequency({ isCompany: true, invoiceFrequency: "pr_gang" }), "pr_gang");
  assert.equal(effectiveInvoiceFrequency({ isCompany: false, invoiceFrequency: "maaned" }), "maaned");
  assert.equal(effectiveInvoiceFrequency({ isCompany: false, invoiceFrequency: "kvartal" }), "kvartal");
  // Ukendt værdi = auto.
  assert.equal(effectiveInvoiceFrequency({ isCompany: true, invoiceFrequency: "junk" }), "maaned");
});

test("kvartalsperioden dækker det kvartal der lige er slut (20. jan/apr/jul/okt)", () => {
  const p = quarterlyPeriodEndingBefore(new Date(Date.UTC(2026, 3, 20))); // 20. april
  assert.ok(p, "20. april skal give en kvartalsperiode");
  assert.equal(p.start.toISOString().slice(0, 10), "2026-01-01");
  assert.equal(p.end.toISOString().slice(0, 10), "2026-04-01");
  assert.equal(p.label, "01-01-2026 til 31-03-2026");
});

test("kvartalsperioden er null udenfor 20. i jan/apr/jul/okt", () => {
  assert.equal(quarterlyPeriodEndingBefore(new Date(Date.UTC(2026, 4, 20))), null, "20. maj: nej");
  assert.equal(quarterlyPeriodEndingBefore(new Date(Date.UTC(2026, 3, 21))), null, "21. april: nej");
  assert.equal(quarterlyPeriodEndingBefore(new Date(Date.UTC(2026, 3, 19))), null, "19. april: nej");
  // 20. januar samler Q4 (okt-dec) fra SIDSTE år:
  const q4 = quarterlyPeriodEndingBefore(new Date(Date.UTC(2027, 0, 20)));
  assert.ok(q4);
  assert.equal(q4.start.toISOString().slice(0, 10), "2026-10-01");
  assert.equal(q4.end.toISOString().slice(0, 10), "2027-01-01");
});
