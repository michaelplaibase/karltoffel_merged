// Unit-tests for 'gratis vinduesvask'-kampagnen: normalisering af
// kampagnenavnet (så en stump '*' i UTM'en ikke dræber kampagnen) + at
// freeVindue giver 0 kr ved freq==1 og korrekt blandet beløb ved freq>1.
//   node --import tsx --test tests/free-vindue-campaign.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normaliserKampagne,
  GRATIS_VINDUE_CAMPAIGN,
  beregn,
  linjeAar,
  type PricedService,
} from "../lib/tilbudsmotor-pricing";

const vinduer = (freq: number, overrides: Partial<PricedService> = {}): PricedService => ({
  id: "vinduer", navn: "Vinduesvask udvendig", wm: null,
  qty: 10, enhed: "vinduer", freq, pris: 17, min: null, ...overrides,
});
const haek = (): PricedService => ({
  id: "haek", navn: "Hækklipning", wm: null,
  qty: 65, enhed: "m hæk", freq: 1, pris: 33.75, min: 1350,
});

test("normaliserKampagne trimmer, lowercase og stripper efterstillet tegnsætning", () => {
  assert.equal(normaliserKampagne("inkluderet-vinduesvask"), "inkluderet-vinduesvask");
  assert.equal(normaliserKampagne("inkluderet-vinduesvask*"), "inkluderet-vinduesvask");
  assert.equal(normaliserKampagne("inkluderet-vinduesvask "), "inkluderet-vinduesvask");
  assert.equal(normaliserKampagne("Inkluderet-Vinduesvask"), "inkluderet-vinduesvask");
  assert.equal(normaliserKampagne("  inkluderet-vinduesvask!! "), "inkluderet-vinduesvask");
  // når den er tom/undefined → kan aldrig matche en rigtig værdi
  assert.equal(normaliserKampagne(""), "");
  assert.equal(normaliserKampagne(undefined), "");
  assert.equal(normaliserKampagne(null), "");
});

test("GRATIS_VINDUE_CAMPAIGN er normaliseret og matcher UTM'er med stump '*'", () => {
  const canon = normaliserKampagne(GRATIS_VINDUE_CAMPAIGN);
  assert.equal(canon, GRATIS_VINDUE_CAMPAIGN); // idempotent/lagret normaliseret
  // de værdier stakeholderen kom ind med — alle skal matche
  for (const utm of ["inkluderet-vinduesvask*", "inkluderet-vinduesvask ", "Inkluderet-Vinduesvask"]) {
    assert.equal(normaliserKampagne(utm), canon, `utm ${JSON.stringify(utm)} burde matche`);
  }
  // en fremmed kampagne matcher IKKE
  assert.notEqual(normaliserKampagne("sommer-tilbud"), canon);
});

const tæt = (a: number, b: number, eps = 1e-6) => assert.ok(Math.abs(a - b) < eps, `${a} ≈ ${b}`);

test("freeVindue + freq==1 → vinduesvask-linjen er 0 kr (kanonisk kampagnesymptom)", () => {
  const services = [haek(), vinduer(1)];
  const normal = beregn(services, false);
  const gratis = beregn(services, true);
  // Ingen kampagne: haek 2193,75 + vinduer 170 → brutto 2363,75, -6 % rabat = 2221,925
  tæt(normal.aar, (2193.75 + 170) * 0.94);
  // Med fri vinduesvask (freq==1): vinduerne bidrager 0, så brutto = haek 2193,75, -6 % = 2062,125
  tæt(gratis.aar, 2193.75 * 0.94);
  // Nettoeffekten af kampagnen: vinduer-nettodelen (170 kr efter 6 % rabat) forsvinder
  tæt(gratis.aar, normal.aar - 170 * 0.94);
  assert.equal(linjeAar(vinduer(1), true), 0);
});

test("freeVindue + freq>1 → kun det 1. besøg er gratis (freq-1 faktureres)", () => {
  assert.equal(linjeAar(vinduer(1), true), 0);
  assert.equal(linjeAar(vinduer(2), true), 17 * 10 * (2 - 1)); // 170 — besøg 2 faktureres
  assert.equal(linjeAar(vinduer(4), true), 17 * 10 * (4 - 1)); // 510 — besøg 2..4 faktureres
  // uafhængigt af kampagnen er linjen fuldt betalt
  assert.equal(linjeAar(vinduer(2), false), 17 * 10 * 2);
});