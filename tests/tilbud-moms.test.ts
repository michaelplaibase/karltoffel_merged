// Thomas, 2026-09-15: tilbud-moms — alle priser angives U. moms og moms (25%)
// lægges til i bunden. ÉN delt funktion (lib/vat.ts: tilbudMomsOgIalt) bruges
// af formular, detaljeside, oversigt, PDF og accept-side, så tallene aldrig
// kan afvige. Afskrivning: hele øre, round-half-up (samme regel som lib/vat).
import test from "node:test";
import assert from "node:assert/strict";
import { tilbudMomsOgIalt, krMoms } from "../lib/vat";

test("tilbudMomsOgIalt: 1.000 kr. u. moms → 250 kr. moms → 1.250 kr. ialt", () => {
  assert.deepEqual(tilbudMomsOgIalt(1000), { ekskl: 1000, moms: 250, ialt: 1250 });
});

test("tilbudMomsOgIalt: 566 kr. u. moms → 141,50 kr. moms → 707,50 kr. ialt (halve kroner bevares)", () => {
  assert.deepEqual(tilbudMomsOgIalt(566), { ekskl: 566, moms: 141.5, ialt: 707.5 });
});

test("tilbudMomsOgIalt: round-half-up i hele øre (fx 0,10 kr. → moms 0,03 kr.)", () => {
  // 10 øre × 0,25 = 2,5 øre → 3 øre (round-half-up, ikke banker's rounding)
  const m = tilbudMomsOgIalt(0.1);
  assert.equal(m.moms, 0.03);
  assert.equal(m.ialt, 0.13);
});

test("tilbudMomsOgIalt: moms beregnes på den SAMLEDE sum (total-niveau)", () => {
  // 26 besøg × 300 kr. = 7.800 kr. u. moms → 1.950 kr. moms → 9.750 kr.
  assert.deepEqual(tilbudMomsOgIalt(300 * 26), { ekskl: 7800, moms: 1950, ialt: 9750 });
});

test("krMoms: hele kroner uden decimaler, halve kroner med to", () => {
  assert.equal(krMoms(1250), "1.250 kr.");
  assert.equal(krMoms(707.5), "707,50 kr.");
});
