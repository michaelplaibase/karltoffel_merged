import test from "node:test";
import assert from "node:assert/strict";
import {
  tilbudTotal, nyAcceptToken, buildTilbudPdfData, statusLabel, acceptTokenUdløber, linjeKundeTekst, linjeStartugeTekst,
  bygAarshjul, parseUgeNr, kortNavn, tasklineMedarbejdere,
} from "../lib/tilbud.mts";
import {
  aarsbelob, besogPrAar, BASE_INTERVALS, tilbudLinjeAarsbelob, tilbudAarsbelobSum,
} from "../lib/subscription-intervals";
import { isTilbudTableMissing, TILBUD_TABELLER_MANGLER } from "../lib/db";

function p2021(table: string): Error {
  return Object.assign(new Error("Table does not exist"), { code: "P2021", meta: { table } });
}

test("isTilbudTableMissing: fanger P2021 for Tilbud/TilbudLine/TilbudPhoto — og ingenting andet", () => {
  assert.equal(isTilbudTableMissing(p2021("public.Tilbud")), true);
  assert.equal(isTilbudTableMissing(p2021("public.TilbudLine")), true);
  assert.equal(isTilbudTableMissing(p2021("public.TilbudPhoto")), true);
  // andre tabeller / fejlkoder / almindelige fejl er IKKE tilbud-tabeller
  assert.equal(isTilbudTableMissing(p2021("public.Contact")), false);
  assert.equal(isTilbudTableMissing(Object.assign(new Error("duplikat"), { code: "P2002", meta: { table: "public.Tilbud" } })), false);
  assert.equal(isTilbudTableMissing(new Error("noget gik galt")), false);
  assert.equal(isTilbudTableMissing(null), false);
  assert.equal(TILBUD_TABELLER_MANGLER.includes("Tilbud-tabellerne"), true);
});

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

test("BASE_INTERVALS er de præcis samme muligheder som abonnementet tilbyder + '1 gang om året'", () => {
  assert.ok(BASE_INTERVALS.includes("Hver 4. uge"));
  // Thomas, 2026-09-11 (korrektion): "1 gang om året" SKAL kunne vælges på
  // tilbudslinjer (fx tagrender — kun én gang om året).
  assert.ok(BASE_INTERVALS.includes("1 gang om året"));
  assert.equal(BASE_INTERVALS.length, 17);
  assert.ok(!BASE_INTERVALS.some((iv) => iv !== "1 gang om året" && !/^Hver \d*\.? ?uge$/.test(iv.replace("Hver uge", "Hver 1. uge"))));
});

test("'1 gang om året' giver præcis 1 besøg pr. år (aldrig multiplikations-fejl)", () => {
  assert.equal(besogPrAar("1 gang om året"), 1);
  assert.equal(aarsbelob("1 gang om året", 566), 566);
  assert.equal(tilbudLinjeAarsbelob({ price: 566, interval: "1 gang om året" }), 566);
});

test("årsbeløb pr. linje: linjer uden interval tæller IKKE med (engangsopgaver)", () => {
  assert.equal(tilbudLinjeAarsbelob({ price: 500, interval: null }), null);
  assert.equal(tilbudLinjeAarsbelob({ price: 500 }), null);
  assert.equal(tilbudLinjeAarsbelob({ price: 500, interval: "Hver 4. uge" }), 6500);
});

test("THOMAS' EKSEMPEL: 566 hver 6. uge + 566 1 gang om året → 5660 kr./år", () => {
  // 52/6 = 8.667 → afrundet til 9 besøg pr. år (besogPrAar-afrundningen)
  assert.equal(besogPrAar("Hver 6. uge"), 9);
  const sum = tilbudAarsbelobSum([
    { description: "Vinduespudsning", price: 566, interval: "Hver 6. uge" },
    { description: "Tagrender", price: 566, interval: "1 gang om året" },
  ]);
  assert.equal(sum, 566 * 9 + 566 * 1); // 5094 + 566 = 5660
  assert.equal(sum, 5660);
});

test("tilbudAarsbelobSum: blandede linjer — kun linjer med interval tæller med", () => {
  const sum = tilbudAarsbelobSum([
    { description: "Vinduespudsning", price: 566, interval: "Hver 6. uge" },
    { description: "Engangsopgave", price: 999, interval: null }, // tæller IKKE med
    { description: "Tagrender", price: 566, interval: "1 gang om året" },
  ]);
  assert.equal(sum, 5660);
  // ingen linjer med interval → null (ingen årsbeløbs-bundlinje)
  assert.equal(tilbudAarsbelobSum([{ description: "X", price: 100, interval: null }]), null);
  assert.equal(tilbudAarsbelobSum([]), null);
});

test("linjeKundeTekst giver kundevenlig frekvenstekst pr. linje", () => {
  assert.equal(
    linjeKundeTekst({ description: "Vinduespudsning", price: 566, interval: "Hver 6. uge" }),
    "Vinduespudsning — 566 kr. pr. gang — hver 6. uge",
  );
  assert.equal(
    linjeKundeTekst({ description: "Tagrender", price: 566, interval: "1 gang om året" }),
    "Tagrender — 566 kr. pr. gang — 1 gang om året",
  );
  // engangsopgave: ingen frekvens
  assert.equal(linjeKundeTekst({ description: "Tagrender", price: 566 }), "Tagrender — 566 kr. pr. gang");
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
    lines: [{ description: "Græsplæneklipning", price: 300, interval: "Hver 2. uge" }],
  });
  assert.equal(med.startWeek, "Uge 29"); // trimmet
  assert.equal(med.baseInterval, "Hver 2. uge");
  // Thomas' korrektion: årsbeløbet er nu summen pr. linje
  assert.equal(med.aarsbelob, 300 * 26); // pris pr. gang × besøg pr. år (deles med abonnementet)

  const uden = buildTilbudPdfData({
    contact: { name: "Kunde", companyName: null, att: null },
    title: "Tilbud", note: null,
    startWeek: "", baseInterval: null,
    lines: [{ description: "Græsplæneklipning", price: 300, interval: null }],
  });
  assert.equal(uden.startWeek, null); // tomme felter udelades af PDF'en
  assert.equal(uden.baseInterval, null);
  assert.equal(uden.aarsbelob, null); // ingen bundbeløb uden interval
});

test("buildTilbudPdfData: to linjer med forskellige intervaller → korrekt årsbeløb (sum pr. linje)", () => {
  const d = buildTilbudPdfData({
    contact: { name: "Kunde", companyName: null, att: null },
    title: "Tilbud", note: null,
    lines: [
      { description: "Vinduespudsning", price: 566, interval: "Hver 6. uge" },
      { description: "Tagrender", price: 566, interval: "1 gang om året" },
    ],
  });
  assert.equal(d.linjer[0].interval, "Hver 6. uge");
  assert.equal(d.linjer[1].interval, "1 gang om året");
  assert.equal(d.aarsbelob, 566 * 9 + 566); // 5094 + 566 = 5660
});

test("statusLabel dækker alle tilbudstatusser", () => {
  for (const s of ["udkast", "sendt", "accepteret", "afvist", "konverteret"]) {
    assert.ok(statusLabel(s).length > 0, `mangler label for ${s}`);
  }
  assert.equal(statusLabel("accepteret"), "Accepteret");
  assert.equal(statusLabel("konverteret"), "Konverteret til abonnement");
});

// ─── ÅRSHJUL (Thomas, 2026-09-11): alle besøgene over året pr. uge ──────────
test("parseUgeNr: 'Uge 29'/'Uge 29, 2026' → 29 — ugyldig → null", () => {
  assert.equal(parseUgeNr("Uge 29"), 29);
  assert.equal(parseUgeNr("Uge 29, 2026"), 29);
  assert.equal(parseUgeNr("uge 5"), 5);
  assert.equal(parseUgeNr(null), null);
  assert.equal(parseUgeNr(""), null);
  assert.equal(parseUgeNr("Uge 99"), null);
  assert.equal(parseUgeNr("Snart"), null);
});

test("kortNavn: 'Vinduespudsning' → 'V', 'Tagrender + nedløbskontrol' → 'TN'", () => {
  assert.equal(kortNavn("Vinduespudsning"), "V");
  assert.equal(kortNavn("Tagrender + nedløbskontrol"), "TN");
  assert.equal(kortNavn(""), "?");
});

test("ÅRSHJUL Thomas' eksempel: Vindue hver 4. uge fra uge 29 + Tagrender uge 38", () => {
  const hjul = bygAarshjul([
    { description: "Vinduespudsning", interval: "Hver 4. uge", startWeek: "Uge 29" },
    { description: "Tagrender", interval: "1 gang om året", startWeek: "Uge 38" },
  ]);
  // Vindue: 13 besøg (52/4), træder 4 uger ad gangen fra uge 29 —
  // uge 29, 33, 37, 41, 45, 49, derefter ruller over 52 (→ næste år: 1, 5, …)
  const vinduesUger = hjul.filter((u) => u.opgaver.some((o) => o.titel === "Vinduespudsning")).map((u) => u.uge);
  assert.equal(vinduesUger.length, 13);
  // 13 besøg, træder 4 uger ad gangen fra uge 29; efter uge 49 ruller over
  // 52 → næste år (uge 1, 5, …). Ugerne kommer sorteret stigende.
  assert.deepEqual(vinduesUger, [1, 5, 9, 13, 17, 21, 25, 29, 33, 37, 41, 45, 49]);
  // Tagrender: præcis 1 besøg i uge 38
  const tagUge = hjul.find((u) => u.opgaver.some((o) => o.titel === "Tagrender"));
  assert.equal(tagUge?.uge, 38);
  assert.equal(tagUge?.opgaver.length, 1);
  // kort-initialer med i hvert besøg
  const v29 = hjul.find((u) => u.uge === 29);
  assert.equal(v29?.opgaver[0].kort, "V");
  // naesteAar er sat på besøg efter årsskiftet (raa > 52)
  assert.ok(hjul.find((u) => u.uge === 1)?.opgaver[0].naesteAar);
  assert.ok(!v29?.opgaver[0].naesteAar);
});

test("bygAarshjul: engangsopgave (uden interval) placeres på sin startuge; linjer uden startuge udelades", () => {
  const hjul = bygAarshjul([
    { description: "Trappevask", interval: null, startWeek: "Uge 12" },
    { description: "Uden startuge", interval: "Hver 2. uge", startWeek: null },
    { description: "", interval: "Hver uge", startWeek: "Uge 3" },
  ]);
  assert.equal(hjul.length, 1);
  assert.equal(hjul[0].uge, 12);
  assert.equal(hjul[0].opgaver.length, 1);
  assert.equal(hjul[0].opgaver[0].titel, "Trappevask");
  assert.equal(hjul[0].opgaver[0].naesteAar, undefined);
});

test("bygAarshjul: uger er sorteret stigende og samler opgaver på samme uge", () => {
  const hjul = bygAarshjul([
    { description: "Vinduespudsning", interval: "Hver 4. uge", startWeek: "Uge 29" },
    { description: "Sten-søm", interval: null, startWeek: "Uge 29" },
  ]);
  const uger = hjul.map((u) => u.uge);
  assert.deepEqual([...uger].sort((a, b) => a - b), uger);
  const u29 = hjul.find((u) => u.uge === 29);
  assert.equal(u29?.opgaver.length, 2); // vindue + sten-søm samme uge
  assert.equal(bygAarshjul([]).length, 0);
});

// Thomas, 2026-09-11 (korrektion 2): valgfri STARTUGE PR. OPGAVELINJE.
test("linjeStartugeTekst: 'Uge 29' → 'Starter uge 29' — tom/null → null", () => {
  assert.equal(linjeStartugeTekst("Uge 29"), "Starter uge 29");
  assert.equal(linjeStartugeTekst("Uge 29, 2026"), "Starter uge 29, 2026");
  assert.equal(linjeStartugeTekst(" Uge 29 "), "Starter uge 29"); // trimmes
  assert.equal(linjeStartugeTekst(null), null);
  assert.equal(linjeStartugeTekst(""), null);
  assert.equal(linjeStartugeTekst(undefined), null);
});

test("linjeKundeTekst viser startuge diskret på linjen — kun når den er sat", () => {
  assert.equal(
    linjeKundeTekst({ description: "Vinduespudsning", price: 566, interval: "Hver 6. uge", startWeek: "Uge 29" }),
    "Vinduespudsning — 566 kr. pr. gang — hver 6. uge — Starter uge 29",
  );
  // ingen startuge → intet ekstra vist (samme tekst som før korrektionen)
  assert.equal(
    linjeKundeTekst({ description: "Tagrender", price: 566 }),
    "Tagrender — 566 kr. pr. gang",
  );
});

test("buildTilbudPdfData: startuge pr. linje gennemgår til PDF-data (tomme = null)", () => {
  const d = buildTilbudPdfData({
    contact: { name: "Kunde", companyName: null, att: null },
    title: "Tilbud", note: null,
    startWeek: "Uge 40", baseInterval: null,
    lines: [
      { description: "Vinduespudsning", price: 566, interval: "Hver 6. uge", startWeek: "Uge 29" },
      { description: "Tagrender", price: 566, interval: null, startWeek: "" },
    ],
  });
  assert.equal(d.linjer[0].startWeek, "Uge 29");
  assert.equal(d.linjer[1].startWeek, null); // tom → intet vist på linjen
  // startuge påvirker IKKE årsbeløbet (kun opstartstidspunkt)
  assert.equal(d.aarsbelob, 566 * 9); // kun vinduespudsning tæller med
});
// ─── Medarbejder pr. opgavelinje (Thomas, 2026-09-11) ───────────────────────
// Intern tilknytning: overføres KUN til TaskLine.employeeId ved konvertering —
// ALDRIG synlig i PDF-data, accept-side eller årshjul.

test("tasklineMedarbejdere: tilknytning → konvertering overfører til TaskLine.employeeId", () => {
  // Linjer med valg følger med; linjer uden valg = null (vælges automatisk).
  assert.deepEqual(
    tasklineMedarbejdere([
      { description: "Vinduespudsning", price: 566, interval: "Hver 6. uge", startWeek: "Uge 29", employeeId: 7 },
      { description: "Tagrender", price: 566, interval: null, employeeId: null },
      { description: "Terrasse", price: 300, employeeId: 12 },
    ]),
    [7, null, 12],
  );
  // Sikkerhedsnet-linjen uden employeeId-felt (inkonverteret objekt) → null.
  assert.deepEqual(tasklineMedarbejdere([{ description: "Serviceaftale", price: 0 } as never]), [null]);
  assert.deepEqual(tasklineMedarbejdere([]), []);
});

test("intet medarbejder-felt i PDF-data — selv hvis input-linjer har employeeId", () => {
  const d = buildTilbudPdfData({
    contact: { name: "Kunde", companyName: null, att: null },
    title: "Tilbud", note: null,
    startWeek: "Uge 29", baseInterval: null,
    lines: [
      { description: "Vinduespudsning", price: 566, interval: "Hver 6. uge", startWeek: "Uge 29", employeeId: 7 } as never,
      { description: "Tagrender", price: 566, employeeId: null } as never,
    ],
  });
  for (const linje of d.linjer) {
    assert.ok(!("employeeId" in linje), "PDF-linje må ikke indeholde employeeId");
    assert.ok(!("employee" in linje), "PDF-linje må ikke indeholde employee");
  }
  const helesData = JSON.stringify(d);
  assert.ok(!/"employeeId"/.test(helesData), "hele PDF-data må ikke indeholde employeeId");
  assert.ok(!/"employee"/.test(helesData), "hele PDF-data må ikke indeholde employee");
});
