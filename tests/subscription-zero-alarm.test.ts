import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { subscriptionOutlookProblem } from "../lib/recurrence";

const root = new URL("../", import.meta.url);
const source = (path: string) => readFile(new URL(path, root), "utf8");

// STILLE-NUL-VAGTEN (uge 35-hændelsen): genereringen fejler stille (returnerer
// 0 uden fejl), så et aktivt abonnement kan forsvinde fra kalenderen i ugevis,
// mens kunde og abonnement ser intakte ud. Vagten skal fange præcis dét — og
// samtidig IKKE støje på de legitime nul-tilfælde (sæsonstart uden for
// horisonten, "På anmodning", afventende abonnementer).

const REF = new Date("2026-08-26T10:00:00Z"); // onsdag i uge 35
const task = (interval = "Hver gang") => ({ intervalMultiplier: interval });
const sub = (over: Partial<Parameters<typeof subscriptionOutlookProblem>[0]> = {}) => ({
  active: true, pending: false, startWeek: "35", nextWeek: "35", baseInterval: "Hver 2. uge", tasks: [task()],
  ...over,
});

test("igangværende abonnement uden kommende ordrer alarmerer — hændelsens kerne", () => {
  const p = subscriptionOutlookProblem(sub(), 0, 12, REF);
  assert.match(p ?? "", /igangværende abonnement/);
});

test("nyt abonnement med startuge inden for horisonten alarmerer", () => {
  const p = subscriptionOutlookProblem(sub({ startWeek: "36" }), 0, 0, REF);
  assert.match(p ?? "", /inden for horisonten/);
});

test("ulæselig startuge OG nextWeek alarmerer med format-hjælp", () => {
  const p = subscriptionOutlookProblem(sub({ startWeek: "engang til foråret", nextWeek: null }), 0, 0, REF);
  assert.match(p ?? "", /startugen kan ikke læses/);
});

test("ulæselig startuge reddes af læselig nextWeek — og alarmerer stadig ved nul ordrer", () => {
  const p = subscriptionOutlookProblem(sub({ startWeek: null, nextWeek: "36" }), 0, 0, REF);
  assert.match(p ?? "", /inden for horisonten/);
});

test("legitime nul-tilfælde er TAVSE", () => {
  // Har kommende ordrer → intet problem.
  assert.equal(subscriptionOutlookProblem(sub(), 3, 10, REF), null);
  // Afventende eller stoppet → ikke vagtens bord.
  assert.equal(subscriptionOutlookProblem(sub({ pending: true }), 0, 0, REF), null);
  assert.equal(subscriptionOutlookProblem(sub({ active: false }), 0, 0, REF), null);
  // Kun "På anmodning"-opgaver planlægges aldrig automatisk.
  assert.equal(subscriptionOutlookProblem(sub({ tasks: [task("På anmodning")] }), 0, 5, REF), null);
  // Nyt abonnement med bevidst sæsonstart NÆSTE forår (uge 20 > 26 uger ude).
  assert.equal(subscriptionOutlookProblem(sub({ startWeek: "Uge 20" }), 0, 0, REF), null);
  // Igangværende men med interval længere end horisonten og fjern startuge.
  assert.equal(subscriptionOutlookProblem(sub({ startWeek: "Uge 20", baseInterval: "Hver 40. uge" }), 0, 4, REF), null);
});

// --- Ledningsføringen: vagten skal være aktiv i både UI og natligt tjek ---

test("abonnements-listerne beregner advarslen og oversigten viser den", async () => {
  const queries = await source("lib/queries.ts");
  assert.match(queries, /generationWarningsByPk/);
  assert.match(queries, /subscriptionOutlookProblem/);
  const page = await source("app/subscriptions/page.tsx");
  assert.match(page, /generationWarning/);
  assert.match(page, /Ingen kommende ordrer/);
});

test("det natlige tjek alarmerer (log + mail) på stille nul-generering", async () => {
  const route = await source("app/api/calendar-consistency/route.ts");
  assert.match(route, /subscriptionOutlookProblem/);
  assert.match(route, /STILLE NUL-GENERERING/);
  assert.match(route, /står uden kommende ordrer/);
  // Fundet skal påvirke ok-status, så overvågning/screenshots viser rødt.
  assert.match(route, /ok: broken\.length === 0 && starvedSubs\.length === 0/);
});
