// Thomas, 2026-09-17 — redigering af et ALLEREDE SENDT tilbud.
// Ren beslutnings-logik (ingen database) for, HVORNÅR holdet må redigere et
// tilbud internt, og OM redigeringen nulstiller det til udkast + roterer
// godkend-tokenet. Implementeret i app/actions/tilbud.ts (updateTilbud).
import test from "node:test";
import assert from "node:assert/strict";
import { tilbudKanRedigeres, tilbudEditReset } from "../lib/tilbud.mts";

test("tilbudKanRedigeres: kun 'udkast' og 'sendt' kan redigeres manuelt af holdet", () => {
  // udkast + sendt → JA (sendt er hele pointen: kunden vender tilbage og vil rykke startugen)
  assert.equal(tilbudKanRedigeres("udkast"), true);
  assert.equal(tilbudKanRedigeres("sendt"), true);
  // låste kontrakter → NEJ
  assert.equal(tilbudKanRedigeres("accepteret"), false);
  assert.equal(tilbudKanRedigeres("konverteret"), false);
  assert.equal(tilbudKanRedigeres("afvist"), false);
  // ukendt/fejl-status → defensivt nej
  assert.equal(tilbudKanRedigeres(""), false);
  assert.equal(tilbudKanRedigeres("slette"), false);
});

test("tilbudEditReset: redigering af et SENDT tilbud → nulstil til udkast + roter token", () => {
  // Det SENDTE tilbud skal nulstilles: det gamle godkend-link /t/<token> må
  // IKKE fortsætte med at vise/godkende det gamle (eller ændrede) indhold.
  assert.equal(tilbudEditReset("sendt"), true);
  // udkast: intet aktivt kunde-link — der er intet at ugyldiggøre → ingen reset
  assert.equal(tilbudEditReset("udkast"), false);
  // øvrige statusser (som alligevel ikke kan redigeres) resettes aldrig
  assert.equal(tilbudEditReset("accepteret"), false);
  assert.equal(tilbudEditReset("konverteret"), false);
  assert.equal(tilbudEditReset("afvist"), false);
});

test("konsistens: alt der MÅ redigeres, men kun sendt kræver reset — intet modstrid", () => {
  // Den eneste status der resettes er den, der også må redigeres — og af de
  // to redigerbare er det KUN 'sendt' (aktivt kunde-link) der nulstilles.
  for (const s of ["udkast", "sendt", "accepteret", "konverteret", "afvist", ""]) {
    if (tilbudEditReset(s)) {
      assert.equal(tilbudKanRedigeres(s), true, `reset-status ${JSON.stringify(s)} skal kunne redigeres`);
    }
  }
  // 'sendt' er præcis én gang både redigerbar OG reset — det er den, der har
  // et kundefacing godkend-link.
  assert.equal(tilbudEditReset("sendt"), true);
  assert.equal(tilbudKanRedigeres("sendt"), true);
});