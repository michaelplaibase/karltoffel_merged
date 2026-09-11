import test from "node:test";
import assert from "node:assert/strict";
import { genererMaanedrapportPdf, formatBesogDato, maanedWindow, contactErIPilot, pilotGateAktiv, SERVICES, type RapportData } from "../lib/maanedrapport.mts";

test("månedsvinduet klipper i Europe/Copenhagen — ikke UTC", () => {
  const { start, end } = maanedWindow(2026, 9);
  // 1. sep 2026 kl. 00:00 dansk = 31. aug 22:00 UTC
  assert.equal(start.toISOString(), "2026-08-31T22:00:00.000Z");
  // 1. okt 2026 kl. 00:00 lokal = 30. sep 22:00 UTC (CET +1)
  assert.equal(end.toISOString(), "2026-09-30T22:00:00.000Z");
});

test("formatBesogDato giver dansk ugedag + dato", () => {
  // 3. sep 2026 = torsdag
  const s = formatBesogDato(new Date("2026-09-03T10:00:00Z"));
  assert.ok(/Torsdag d\. 3\. september/i.test(s), "faktisk: " + s);
});

test("pilot-gate: tom liste = alle, sat liste = kun matches", () => {
  assert.equal(pilotGateAktiv(undefined), false);
  assert.equal(pilotGateAktiv(""), false);
  assert.equal(pilotGateAktiv("  "), false);
  assert.equal(contactErIPilot(42, undefined), true); // alle
  assert.equal(contactErIPilot(42, "1, 2,3"), false);
  assert.equal(contactErIPilot(2, "1, 2, 3"), true);
});

test("SERVICES har 8 godkendte kort med tekst", () => {
  assert.equal(SERVICES.length, 8);
  assert.equal(SERVICES[0][0], "Hækklipning og beskæring");
});

test("generér test-PDF med fiktive data", async () => {
  const data: RapportData = {
    kundeNavn: "Eksempel Ejendomsservice A/S",
    maanedLabel: "September 2026",
    hilsenNavn: "Kristian",
    besoeg: [
      { datoTekst: "Tirsdag d. 3. september", opgaver: ["Skiltevask — facade mod gaden", "Vinduesvask udvendig — alle vinduer i stueetage"], fotos: [] },
      { datoTekst: "Fredag d. 13. september", opgaver: ["Soignering af fortov — indgang + parkeringsplads", "Ukrudtsfjernelse — mellem belægningssten"], fotos: [] },
    ],
  };
  const buf = await genererMaanedrapportPdf(data);
  assert.ok(buf.length > 10000, "PDF for lille: " + buf.length);
  // PDF-signatur
  assert.equal(String.fromCharCode(buf[0], buf[1], buf[2], buf[3]), "%PDF");
});
