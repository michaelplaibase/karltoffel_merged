// Moms-planen trin 1: unit-tests for lib/vat.ts — én kilde til sandhed for
// moms. Alle beløb i ØRE (integer), round-half-up, dokumenteret regel.
import test from "node:test";
import assert from "node:assert/strict";
import {
  VAT_RATE, roundHalfUp, exclToIncl, inclToExcl, formatPriceDual,
  computeInvoiceTotals, VatComputationError,
} from "../lib/vat";

test("VAT_RATE matcher MOMS-konstanten i lib/data (0,25)", () => {
  assert.equal(VAT_RATE, 0.25);
});

test("roundHalfUp: 0,5 runder ALTID op (ingen banker's rounding)", () => {
  assert.equal(roundHalfUp(2.5), 3);
  assert.equal(roundHalfUp(2.4), 2);
  assert.equal(roundHalfUp(1.5), 2);
  assert.equal(roundHalfUp(0.5), 1);
  assert.equal(roundHalfUp(-2.5), -3); // symmetrisk væk fra nul
  assert.equal(roundHalfUp(0), 0);
});

test("exclToIncl: hele øre ind, hele øre ud (integer)", () => {
  assert.equal(exclToIncl(10000), 12500); // 100 kr → 125 kr
  assert.equal(exclToIncl(0), 0);
  assert.equal(exclToIncl(1), 1); // 1 øre × 1,25 = 1,25 → 1 (half-up på .25)
  assert.equal(exclToIncl(2), 3); // 2 øre → 2,5 øre → 3 (half-up)
  assert.equal(exclToIncl(3), 4); // 3 øre → 3,75 → 4
});

test("inclToExcl: round-half-down-halve runder korrekt", () => {
  assert.equal(inclToExcl(12500), 10000); // 125 kr → 100 kr
  assert.equal(inclToExcl(0), 0);
  assert.equal(inclToExcl(125), 100); // 1,25 kr → 1 kr
  assert.equal(inclToExcl(3), 2); // 3 øre / 1,25 = 2,4 → 2
  assert.equal(inclToExcl(2), 2); // 2 øre / 1,25 = 1,6 → 2
});

test("roundtrip: incl → excl → incl er stabil på tværs af typiske priser", () => {
  for (const kr of [1, 100, 326, 1000, 1250, 375, 999, 25000]) {
    assert.equal(exclToIncl(inclToExcl(kr * 100)), kr * 100, `${kr} kr roundtrip`);
  }
});

test("formatPriceDual: '1.000 kr. (800 kr. u. moms)'", () => {
  assert.equal(formatPriceDual(1000 * 100), "1.000 kr. (800 kr. u. moms)");
  assert.equal(formatPriceDual(125 * 100), "125 kr. (100 kr. u. moms)");
  assert.equal(formatPriceDual(0), "0 kr. (0 kr. u. moms)");
});

test("computeInvoiceTotals ('incl' = dagens datamodell): hele øre, total-niveau moms", () => {
  // Priser i KRONER som gemt (TaskLine.price-konvention, inkl. moms).
  const t = computeInvoiceTotals([{ price: 400 }, { price: 600 }]);
  assert.equal(t.inclTotal, 100000); // 1.000 kr i øre
  assert.equal(t.exclTotal, 80000); // 800 kr i øre
  assert.equal(t.vatTotal, 20000); // 200 kr i øre
  assert.equal(Number.isInteger(t.exclTotal) && Number.isInteger(t.vatTotal) && Number.isInteger(t.inclTotal), true);
});

test("computeInvoiceTotals med priceBasis 'excl' (efter cutover): moms = roundHalfUp på totalen", () => {
  const t = computeInvoiceTotals([{ price: 100 }], "excl"); // 100 kr ekskl.
  assert.equal(t.exclTotal, 10000);
  assert.equal(t.vatTotal, 2500); // 25 kr moms
  assert.equal(t.inclTotal, 12500);
  // Cutover-ekvivalens: samme linjer aflæst som inkl. giver samme inkl.-total.
  const t2 = computeInvoiceTotals([{ price: 125 }], "incl");
  assert.equal(t2.inclTotal, t.inclTotal);
});

test("computeInvoiceTotals: afrunding af ulige beløb er round-half-up (hele øre)", () => {
  // 33,33 kr ekskl. → 41,6625 kr incl → 41,66 kr (4166,25 øre → 4166, half-up)
  const t = computeInvoiceTotals([{ price: 33.33 }], "excl");
  assert.equal(t.inclTotal, 4166);
  // 33,34 kr ekskl. → 41,675 kr → 4167,5 øre → 4168 (half-up)
  const t2 = computeInvoiceTotals([{ price: 33.34 }], "excl");
  assert.equal(t2.inclTotal, 4168);
});

test("FAIL-CLOSED: afvis når en linje har pris men moms ikke kan beregnes", () => {
  // Pris mangler (null/undefined) — linjen findes, moms kan ikke beregnes.
  assert.throws(() => computeInvoiceTotals([{ price: 100 }, { price: null as unknown as number }]), VatComputationError);
  assert.throws(() => computeInvoiceTotals([{ price: undefined as unknown as number }]), VatComputationError);
  // Ugyldigt tal.
  assert.throws(() => computeInvoiceTotals([{ price: NaN }]), VatComputationError);
  assert.throws(() => computeInvoiceTotals([{ price: Infinity }]), VatComputationError);
  // Negativ pris.
  assert.throws(() => computeInvoiceTotals([{ price: -50 }]), VatComputationError);
});

test("VatComputationError bærer linje-indeks (så log/rapport kan pege på linjen)", () => {
  try {
    computeInvoiceTotals([{ price: 100 }, { price: NaN }]);
    assert.fail("skulle kaste");
  } catch (e) {
    assert.ok(e instanceof VatComputationError);
    assert.equal((e as VatComputationError).lineIndex, 1);
    assert.match((e as Error).message, /Linje 2/);
  }
});