// Smoke: Slack-lead-flowet. Kører uden DB, uden netværk, uden Slack.
//   npx tsx scripts/slack-lead-smoke.ts
//
// Det vigtigste tjek er det første: PRICING-blokken hentes ud af
// site/assets/js/tilbudsmotor.js og køres side om side med TS-porten i
// lib/tilbudsmotor-pricing.ts på tilfældige mængder. Afviger de bare 0,01 kr,
// fejler testen — for så ville et Slack-godkendt tilbud vise et andet tal end
// det kunden selv stod og så i beregneren.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  beregn, medRabatkode, parseLeadPayload, serializeLeadPayload,
  erPakkeYdelse, kr, type PricedService,
} from "../lib/tilbudsmotor-pricing";
import { renderQuoteHtml, renderQuoteText, esc } from "../lib/quote-html";
import { buildLeadBlocks, buildEditModal, applyEditedQuantities, QTY_BLOCK_PREFIX } from "../lib/slack-lead";

let fejl = 0;
function ok(navn: string, betingelse: boolean, detalje = "") {
  if (betingelse) { console.log(`  ✓ ${navn}`); return; }
  fejl++;
  console.error(`  ✗ ${navn}${detalje ? ` — ${detalje}` : ""}`);
}

// ---------------------------------------------------------------------------
console.log("\n1) TS-porten regner identisk med tilbudsmotor.js");

const motorSrc = readFileSync(join(process.cwd(), "site/assets/js/tilbudsmotor.js"), "utf8");
const blok = motorSrc.match(/\/\*PRICING-START\*\/([\s\S]*?)\/\*PRICING-END\*\//);
ok("PRICING-blokken kan findes i tilbudsmotor.js", !!blok);

if (blok) {
  // Kør motorens egen kode i en funktion og hent beregn() ud. Ingen browser-API
  // bruges i blokken, så den kører direkte i Node.
  const hentBeregn = new Function(`${blok[1]}; return { beregn: beregn, rabatPct: rabatPct, linjeMd: linjeMd };`);
  const motor = hentBeregn() as {
    beregn: (p: unknown[]) => { aar: number; aarBrutto: number; rabatPct: number; md: number; snit: number; count: number; visits: number };
  };

  // Deterministisk "tilfældig" generator, så en fejl kan reproduceres.
  let seed = 20260730;
  const rnd = () => ((seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff);

  let værsteAfvigelse = 0;
  for (let iter = 0; iter < 500; iter++) {
    const antal = 1 + Math.floor(rnd() * 12);
    const services: PricedService[] = Array.from({ length: antal }, (_, i) => ({
      id: `s${i}`,
      navn: `Ydelse ${i}`,
      wm: null,
      qty: Math.floor(rnd() * 800),
      enhed: "m",
      freq: 1 + Math.floor(rnd() * 12),
      // ~20 % uprisede linjer, så "indeholdt"-stien også dækkes.
      pris: rnd() < 0.2 ? null : Math.round(rnd() * 5000) / 100,
    }));

    const mine = beregn(services);
    const deres = motor.beregn(services.map((s) => ({ ...s, on: true })));

    for (const felt of ["aar", "aarBrutto", "rabatPct", "md", "snit", "count", "visits"] as const) {
      værsteAfvigelse = Math.max(værsteAfvigelse, Math.abs(mine[felt] - deres[felt]));
    }
  }
  ok("500 tilfældige pakker giver samme tal i begge motorer", værsteAfvigelse < 1e-9,
    `største afvigelse ${værsteAfvigelse}`);
}

// ---------------------------------------------------------------------------
console.log("\n2) Rabatstakning: kode oven på mængderabat");

const toServices: PricedService[] = [
  { id: "haek", navn: "Hækklipning", wm: null, qty: 100, enhed: "m hæk", freq: 1, pris: 10 },
];
const r2 = beregn(toServices);
ok("brutto = 1.000 kr", r2.aarBrutto === 1000, String(r2.aarBrutto));
ok("mængderabat = 6 % ved 2 ydelser", r2.rabatPct === 6, String(r2.rabatPct));
ok("aar = 1.880 kr", Math.abs(r2.aar - 1880) < 1e-9, String(r2.aar));
const { aarNet } = medRabatkode(r2, 10);
ok("rabatkode 10 % trækkes EFTER mængderabat → 1.692 kr", Math.abs(aarNet - 1692) < 1e-9, String(aarNet));
ok("md er FØR rabatkode (motorens kontrakt)", Math.abs(r2.md - 1880 / 12) < 1e-9);

// ---------------------------------------------------------------------------
console.log("\n3) Payload ind og ud");

const rundtur = serializeLeadPayload({
  kundetype: "privat", betaling: "abonnement", services: toServices,
  rabatkode: "SOMMER", rabatOk: true, rabatPct: 10, tilbudSendtAt: null,
});
const læst = parseLeadPayload(rundtur);
ok("services bevares", læst.services.length === 2);
ok("rabatkode bevares", læst.rabatkode === "SOMMER" && læst.rabatOk && læst.rabatPct === 10);
ok("kundetype bevares", læst.kundetype === "privat");
ok("tilbudSendtAt udelades når null", !rundtur.includes("tilbudSendtAt"));
ok("tilbudSendtAt bevares når sat",
  parseLeadPayload(serializeLeadPayload({ ...læst, tilbudSendtAt: "2026-07-30T10:00:00.000Z" })).tilbudSendtAt === "2026-07-30T10:00:00.000Z");
ok("ugyldig JSON giver tomt payload uden at kaste", parseLeadPayload("{ikke json").services.length === 0);
ok("null payload giver tomt payload", parseLeadPayload(null).services.length === 0);

// ---------------------------------------------------------------------------
console.log("\n4) Tilbudsmailen");

const designServices: PricedService[] = [
  { id: "vinduer", navn: "Vinduespudsning udvendig", wm: null, qty: 14, enhed: "glas", freq: 8, pris: 15.3 },
  { id: "haek", navn: "Hækklipning", wm: null, qty: 65, enhed: "m hæk", freq: 1, pris: 27.5 },
  { id: "robot", navn: "Robotplæneklipper service", wm: null, qty: 1, enhed: "", freq: 1, pris: null },
  { id: "ukrudt", navn: "Ukrudtsbekæmpelse", wm: null, qty: 60, enhed: "m² fliser", freq: 1, pris: 1.5 },
  { id: "stub", navn: "Stubfræsning", wm: null, qty: 1, enhed: "", freq: 1, pris: null },
];
const mailInput = {
  fornavn: "Katrine",
  adresse: "Fjordparken 9, 8700 Horsens",
  services: designServices,
  total: 2300,
  gyldigTil: "29. august 2026",
  acceptUrl: "https://karltoffel.dk/accepter?lead=1",
  firma: { navn: "Karltoffel", telefon: "51 20 20 40", email: "hej@karltoffel.dk" },
};
const html = renderQuoteHtml(mailInput);

ok("ingen display:flex (Outlook renderer via Word og kan det ikke)", !html.includes("display:flex"));
ok("ingen vw-enheder", !/\d(vw|vh)\b/.test(html));
ok("bruger tabel-layout", html.includes("<table") && html.includes('role="presentation"'));
ok("pakke-sektion med overskrift", html.includes("Pakke: Villapakken"));
ok("tilvalgs-sektion med overskrift", html.includes("Ekstra ydelser til ekstra heldige karltofler"));
ok("uprisede pakkelinjer står som Indeholdt", html.includes("Indeholdt"));
ok("uprisede tilvalg står som Pris ved besøg", html.includes("Pris ved besøg"));
ok("total vises", html.includes("2.300 kr"));
ok("gyldighedsdato vises", html.includes("29. august 2026"));
ok("accept-knap peger på url'en", html.includes("https://karltoffel.dk/accepter?lead=1"));
ok("firmaets kontaktinfo i footeren", html.includes("51 20 20 40") && html.includes("hej@karltoffel.dk"));
ok("robot havnede i pakken, ukrudt i tilvalg", erPakkeYdelse("robot") && !erPakkeYdelse("ukrudt"));

const ondtNavn = renderQuoteHtml({ ...mailInput, fornavn: `Ka"<img src=x onerror=alert(1)>` });
ok("kundenavn escapes, så markup ikke kan injiceres",
  !ondtNavn.includes("<img src=x") && ondtNavn.includes("&lt;img"));
ok("esc() dækker alle fem tegn", esc(`<>&"'`) === "&lt;&gt;&amp;&quot;&#39;");

const tekst = renderQuoteText(mailInput);
ok("tekstudgaven har total", tekst.includes("2.300 kr"));
ok("tekstudgaven har begge sektioner", tekst.includes("Villapakken") && tekst.includes("Ekstra ydelser"));

// Regnestykket skal kunne følges: linjer -> sum -> rabatter -> total. Ellers
// lægger kunden linjepriserne sammen og faar et andet tal end totalen.
// Fixturen udledes af prismotoren — ikke af opdigtede tal — så testen faktisk
// beviser at det regnestykke kunden ser, går op.
const rDesign = beregn(designServices);
const kodePctDesign = 10;
const nettoDesign = medRabatkode(rDesign, kodePctDesign).aarNet;
const rabatterDesign = [
  { label: `Mængderabat (−${rDesign.rabatPct} %)`, beloeb: rDesign.rabatKr },
  { label: `Rabatkode SOMMER (−${kodePctDesign} %)`, beloeb: rDesign.aar - nettoDesign },
];
const medRabat = { ...mailInput, total: nettoDesign, rabatter: rabatterDesign };
const htmlRabat = renderQuoteHtml(medRabat);
ok("rabat: sum-række vises", htmlRabat.includes(">Sum<"));
ok("rabat: begge rabatlinjer vises",
  htmlRabat.includes(`Mængderabat (−${rDesign.rabatPct} %)`) && htmlRabat.includes("Rabatkode SOMMER (−10 %)"));
ok("rabat: fradrag vises med minus", htmlRabat.includes(`− ${kr(rDesign.rabatKr)}`));
const sumLinjer = designServices.reduce((a, s) => a + (s.pris == null ? 0 : s.pris * s.qty * s.freq), 0);
ok("rabat: sum matcher linjernes faktiske sum", htmlRabat.includes(kr(sumLinjer)), kr(sumLinjer));
ok("rabat: delsum er den samme som motorens brutto", Math.abs(sumLinjer - rDesign.aarBrutto) < 1e-9);
ok("rabat: regnestykket går op (sum − rabatter = total)",
  Math.abs(sumLinjer - rabatterDesign.reduce((a, x) => a + x.beloeb, 0) - nettoDesign) < 1e-9,
  `${sumLinjer} − ${rabatterDesign.reduce((a, x) => a + x.beloeb, 0)} != ${nettoDesign}`);
ok("rabat: også de AFRUNDEDE tal på mailen går op (det kunden lægger sammen)",
  Math.round(sumLinjer) - Math.round(rabatterDesign[0].beloeb) - Math.round(rabatterDesign[1].beloeb) === Math.round(nettoDesign),
  `${Math.round(sumLinjer)} − ${Math.round(rabatterDesign[0].beloeb)} − ${Math.round(rabatterDesign[1].beloeb)} != ${Math.round(nettoDesign)}`);
ok("rabat: tekstudgaven har sum og fradrag",
  renderQuoteText(medRabat).includes("Sum:") && renderQuoteText(medRabat).includes(`− ${kr(rDesign.rabatKr)}`));
ok("uden rabatter vises INGEN sum-række (delsum = total)", !html.includes(">Sum<"));
ok("nul-rabat filtreres væk",
  !renderQuoteHtml({ ...mailInput, rabatter: [{ label: "Ingenting", beloeb: 0 }] }).includes(">Sum<"));

const udenAccept = renderQuoteHtml({ ...mailInput, acceptUrl: undefined });
ok("uden acceptUrl er der ingen knap", !udenAccept.includes("<a href="));
ok("uden acceptUrl henviser teksten IKKE til en knap",
  !udenAccept.includes("Accepter tilbud") && udenAccept.includes("svarer du blot på denne mail"));
ok("med acceptUrl henviser teksten til knappen",
  html.includes("klikker du bare") && html.includes("<a href="));
ok("tekstudgaven uden acceptUrl beder om svar på mailen",
  renderQuoteText({ ...mailInput, acceptUrl: undefined }).includes("svarer du blot på denne mail"));

// ---------------------------------------------------------------------------
console.log("\n5) Slack-blokke");

const lead = { id: 42, name: "Katrine Holm", email: "katrine@example.dk", phone: "51202040", address: "Fjordparken 9, 8700 Horsens", message: "Kan I komme inden august?" };
const payload = parseLeadPayload(serializeLeadPayload({
  kundetype: "privat", betaling: "pr_gang", services: designServices, rabatkode: null, rabatOk: false, rabatPct: null, tilbudSendtAt: null,
}));

const blocks = buildLeadBlocks(lead, payload) as Record<string, unknown>[];
const json = JSON.stringify(blocks);
ok("højst 50 blokke (Slacks grænse)", blocks.length <= 50, String(blocks.length));
ok("har knapper når tilbuddet ikke er sendt", json.includes("lead_edit_qty") && json.includes("lead_approve_quote"));
ok("Godkend har bekræftelses-dialog", json.includes("Send tilbud?"));
ok("kundens besked er med", json.includes("Kan I komme inden august?"));

const låst = JSON.stringify(buildLeadBlocks(lead, payload, { låst: "Sendt" }));
ok("låst kort har INGEN knapper", !låst.includes("lead_approve_quote") && !låst.includes("lead_edit_qty"));

const modal = buildEditModal(lead, payload) as Record<string, unknown>;
const modalBlocks = modal.blocks as Record<string, unknown>[];
const inputs = modalBlocks.filter((b) => b.type === "input");
ok("ét felt pr. PRISSAT ydelse (3 af 5)", inputs.length === 3, String(inputs.length));
ok("felterne er number_input", inputs.every((b) => (b.element as Record<string, unknown>).type === "number_input"));
ok("modal bærer lead-id i private_metadata", modal.private_metadata === "42");
ok("højst 100 blokke i dialogen", modalBlocks.length <= 100);

// ---------------------------------------------------------------------------
console.log("\n6) Rettede mængder");

const state = {
  [`${QTY_BLOCK_PREFIX}haek`]: { qty: { value: "110" } },
  [`${QTY_BLOCK_PREFIX}vinduer`]: { qty: { value: "" } },        // tomt = behold
  [`${QTY_BLOCK_PREFIX}ukrudt`]: { qty: { value: "-5" } },       // ugyldigt = behold
};
const { services: rettet, ændringer } = applyEditedQuantities(designServices, state);
ok("hæk gik fra 65 til 110", rettet.find((s) => s.id === "haek")?.qty === 110);
ok("tomt felt lod vinduer stå på 14", rettet.find((s) => s.id === "vinduer")?.qty === 14);
ok("negativ værdi blev afvist", rettet.find((s) => s.id === "ukrudt")?.qty === 60);
ok("kun den faktiske ændring blev logget", ændringer.length === 1, ændringer.join(" | "));
ok("ændringsteksten er læsbar", ændringer[0]?.includes("65") && ændringer[0]?.includes("110"));

const førPris = beregn(designServices).aar;
const efterPris = beregn(rettet).aar;
ok("prisen steg da hækken blev længere", efterPris > førPris, `${kr(førPris)} → ${kr(efterPris)}`);
ok("stigningen er præcis 45 m × 27,50 kr × 1, minus 15 % mængderabat",
  Math.abs((efterPris - førPris) - 45 * 27.5 * 0.85) < 1e-9, String(efterPris - førPris));

const loft = applyEditedQuantities(designServices, { [`${QTY_BLOCK_PREFIX}haek`]: { qty: { value: "999999999" } } });
ok("mængden loftes ved 100.000 som ved lead-indtaget",
  loft.services.find((s) => s.id === "haek")?.qty === 100_000);

// ---------------------------------------------------------------------------
console.log(fejl === 0 ? "\nAlle tjek bestået.\n" : `\n${fejl} tjek FEJLEDE.\n`);
process.exit(fejl === 0 ? 0 : 1);
