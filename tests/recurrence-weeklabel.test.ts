import test from "node:test";
import assert from "node:assert/strict";
import { parseWeekLabel } from "../lib/recurrence";

// HÆNDELSE uge 35 (2026-08-24): produktionens abonnementer bærer BÅDE "Uge 35"
// og rå ugetal ("35" — fra importen 15/7 og den gamle formulars rå input). Den
// strikse parser (kun "Uge N") lod ~30 abonnementer generere stille NUL ordrer:
// kunden og abonnementet så intakte ud, men kalenderen blev gradvist tommere.
// Parseren SKAL derfor forstå alle formater, produktionsdata faktisk indeholder.

test("parseWeekLabel forstår alle produktionens formater", () => {
  assert.equal(parseWeekLabel("Uge 29"), 29);
  assert.equal(parseWeekLabel("uge 29"), 29);
  assert.equal(parseWeekLabel("uge29"), 29); // uden mellemrum
  assert.equal(parseWeekLabel("Uge 8"), 8);
  assert.equal(parseWeekLabel("35"), 35); // rå ugetal — hændelsens kerne
  assert.equal(parseWeekLabel(" 35 "), 35);
  assert.equal(parseWeekLabel("7"), 7);
});

test("parseWeekLabel afviser ugyldige uger frem for at gætte", () => {
  assert.equal(parseWeekLabel(null), null);
  assert.equal(parseWeekLabel(""), null);
  assert.equal(parseWeekLabel("0"), null);
  assert.equal(parseWeekLabel("54"), null); // uge 54 findes ikke
  assert.equal(parseWeekLabel("Uge 54"), null);
  assert.equal(parseWeekLabel("W35"), null);
  assert.equal(parseWeekLabel("2026-08-24"), null); // en dato er ikke et ugetal
});

test("generateForSubscription falder tilbage på nextWeek når startugen mangler", async () => {
  const { readFile } = await import("node:fs/promises");
  const rec = await readFile(new URL("../lib/recurrence.ts", import.meta.url), "utf8");
  assert.match(rec, /parseWeekLabel\(sub\.startWeek\) \?\? parseWeekLabel\(sub\.nextWeek\)/);
});
