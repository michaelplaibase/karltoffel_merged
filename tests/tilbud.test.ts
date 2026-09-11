import test from "node:test";
import assert from "node:assert/strict";
import {
  tilbudTotal, nyAcceptToken, buildTilbudPdfData, statusLabel, acceptTokenUdløber,
} from "../lib/tilbud.mts";
import { aarsbelob, besogPrAar, BASE_INTERVALS } from "../lib/subscription-intervals";

test("tilbudTotal summerer linjepriserne præcist", () => {
  assert.equal(tilbudTotal([{ price: 1200 }, { price: 350 }, { price: 0 }]), 1550);
  assert.equal(tilbudTotal([]), 0);
  // ikke-numeriske/NaN-priser tæller som 0 — aldrig NaN i totalen
  assert.equal(tilbudTotal([{ price: Number.NaN }, { price: 100 }]), 100);
});

test("årsbeløb: Thomas' eksempel — Hver 4. uge à 100 kr = 13 besøg = 1300 kr", () => {
  assert.equal(besogPrAar("Hver 4. uge"), 13); // 52/4
  assert.equal(besogPrAar("Hver uge"), 52);
  assert.equal(besogPrAar("Hver 2. uge"), 26);
  assert.equal(aarsbelob("Hver 4. uge", 100), 1300);
  assert.equal(aarsbelob("Hver 2. uge", 300), 7800);
  // ingen/ugyldigt interval → intet årsbeløb (kun opgavelinjerne)
  assert.equal(besogPrAar(null), null);
  assert.equal(besogPrAar("Hver måned"), null);
  assert.equal(aarsbelob(null, 100), null);
});

test("BASE_INTERVALS er de præcis samme muligheder som abonnementet tilbyder", () => {
  assert.ok(BASE_INTERVALS.includes("Hver 4. uge"));
  assert.equal(BASE_INTERVALS.length, 16);
  assert.ok(!BASE_INTERVALS.some((iv) => !/^Hver \d*\.? ?uge$/.test(iv.replace("Hver uge", "Hver 1. uge"))));
});

test("nyAcceptToken er URL-sikkert og unikt (engangs-token)", () => {
  const a = nyAcceptToken();
  const b = nyAcceptToken();
  assert.equal(a.length, 32); // 24 bytes base64url
  assert.match(a, /^[A-Za-z0-9_-]+$/);
  assert.notEqual(a, b);
});

test("acceptTokenUdløber er 30 dage frem", () => {
  const now = new Date("2026-09-11T10:00:00Z");
  const exp = acceptTokenUdløber(now);
  assert.equal(exp.getTime() - now.getTime(), 30 * 86_400_000);
});

test("buildTilbudPdfData mapper kunde, linjer og total korrekt", () => {
  const d = buildTilbudPdfData({
    contact: { name: "Lasse Jensen", companyName: "PHC Ejendomme ApS", att: "Morten" },
    title: "Tilbud på fast ejendomsservice",
    note: null,
    lines: [{ description: "Trappevask", price: 950 }, { description: "Tagrenderens", price: 600 }],
  });
  assert.equal(d.kundeNavn, "PHC Ejendomme ApS"); // firmanavn vinder over privat navn
  assert.equal(d.hilsenNavn, "Morten"); // att-personen hilses
  assert.equal(d.aarsbelob, null); // uden interval: ingen bundlinje med årsbeløb
  assert.equal(d.linjer.length, 2);
  assert.equal(d.fotosPerLinje.length, 2);
});

test("valgfri startuge/interval gennemgår til PDF-data (tomme = null)", () => {
  const med = buildTilbudPdfData({
    contact: { name: "Kunde", companyName: null, att: null },
    title: "Tilbud", note: null,
    startWeek: " Uge 29 ", baseInterval: "Hver 2. uge",
    lines: [{ description: "Græsplæneklipning", price: 300 }],
  });
  assert.equal(med.startWeek, "Uge 29"); // trimmet
  assert.equal(med.baseInterval, "Hver 2. uge");
  assert.equal(med.aarsbelob, 300 * 26); // pris pr. gang × besøg pr. år (deles med abonnementet)

  const uden = buildTilbudPdfData({
    contact: { name: "Kunde", companyName: null, att: null },
    title: "Tilbud", note: null,
    startWeek: "", baseInterval: null,
    lines: [{ description: "Græsplæneklipning", price: 300 }],
  });
  assert.equal(uden.startWeek, null); // tomme felter udelades af PDF'en
  assert.equal(uden.baseInterval, null);
  assert.equal(uden.aarsbelob, null); // ingen bundbeløb uden interval
});

test("statusLabel dækker alle tilbudstatusser", () => {
  for (const s of ["udkast", "sendt", "accepteret", "afvist", "konverteret"]) {
    assert.ok(statusLabel(s).length > 0, `mangler label for ${s}`);
  }
  assert.equal(statusLabel("accepteret"), "Accepteret");
  assert.equal(statusLabel("konverteret"), "Konverteret til abonnement");
});