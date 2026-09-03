// Unit tests for varigheds-genberegnelsen (lib/duration-recalc).
// Ren formel-test — kræver ingen database. Formlen skal matche TaskLineEditor
// client-side: durationMin = max(1, round((pris inkl. moms / 1,25) / kr-pr-min)).
import { test } from "node:test";
import assert from "node:assert/strict";
import { durationFromPrice } from "../lib/duration-recalc";

test("default-sats 860 øre/min: 860 kr inkl. moms → 80 minutter", () => {
  // (860 / 1,25) / 8,6 = 688 / 8,6 = 80
  assert.equal(durationFromPrice(860, 860), 80);
});

test("default-sats: 100 kr inkl. moms → 9 min (afrundet)", () => {
  // (100 / 1,25) / 8,6 = 80 / 8,6 ≈ 9,30 → 9
  assert.equal(durationFromPrice(100, 860), 9);
});

test("lave priser floors til minimum 1 minut", () => {
  // (5 / 1,25) / 8,6 ≈ 0,46 → 0 uden floor; skal være 1
  assert.equal(durationFromPrice(5, 860), 1);
  assert.equal(durationFromPrice(1, 860), 1);
});

test("afrunding følger Math.round (0,5 op)", () => {
  // sats 1000 øre = 10 kr/min: (56,25 / 1,25) / 10 = 45 / 10 = 4,5 → 5 (0,5 rundes op)
  assert.equal(durationFromPrice(56.25, 1000), 5);
  // (53,75 / 1,25) / 10 = 43 / 10 = 4,3 → 4
  assert.equal(durationFromPrice(53.75, 1000), 4);
});

test("anden sats: 1000 øre/min, 250 kr inkl. moms → 20 min", () => {
  // (250 / 1,25) / 10 = 200 / 10 = 20
  assert.equal(durationFromPrice(250, 1000), 20);
});

test("idempotent: samme input giver altid samme output", () => {
  const first = durationFromPrice(1234, 750);
  assert.equal(durationFromPrice(1234, 750), first);
});

test("ugyldig sats (0/negativ) falder tilbage på default 8,60 kr/min", () => {
  // 860 kr inkl. moms ved default-sats = 80 min (samme som første test)
  assert.equal(durationFromPrice(860, 0), 80);
  assert.equal(durationFromPrice(860, -5), 80);
});
