import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { beregn, medRabatkode, type PricedService } from "../lib/tilbudsmotor-pricing";

const src = (p: string) => readFile(new URL(`../${p}`, import.meta.url), "utf8");

// ---------------------------------------------------------------------------
// KRITISK: AddressFinder må aldrig submitte tom adresse for fri indtastning
// ---------------------------------------------------------------------------

test("AddressFinder submitter den rå indtastning når intet forslag er valgt", async () => {
  const finder = await src("components/AddressFinder.tsx");
  assert.match(finder, /value=\{selected \|\| query\}/);
  assert.doesNotMatch(finder, /value=\{selected\}\s*\/>/);
});

test("createContact/updateContact validerer adresse serverside og ekkoer indtastningen ved fejl", async () => {
  const contacts = await src("app/actions/contacts.ts");
  // Tom adresse blokeres i BÅDE create- og edit-flow (to forekomster).
  const addrGuards = contacts.match(/Angiv en adresse\./g) ?? [];
  assert.equal(addrGuards.length, 2);
  // React 19-mønsteret: fejl-state bærer de indsendte værdier med tilbage.
  assert.match(contacts, /values\?: ContactFormValues/);
  assert.match(contacts, /error: "Angiv et navn\.", values: f/);
  assert.match(contacts, /error: "Angiv en adresse\.", values: f/);
});

// ---------------------------------------------------------------------------
// HØJ: kunderedigering må ikke slette+genskabe fremtidige abonnementsordrer
// ---------------------------------------------------------------------------

test("updateContact opdaterer eksisterende ordrer i stedet for at regenerere dem", async () => {
  const contacts = await src("app/actions/contacts.ts");
  assert.doesNotMatch(contacts, /regenerateFutureOrders/);
  // Kun rækker der fulgte den gamle adresse opdateres, og kun åbne ordrer.
  assert.match(contacts, /order\.updateMany\(\{\s*\n?\s*where: \{ contactId: id, deliveryAddress: oldAddress, status: "Afventer levering" \}/);
  assert.match(contacts, /subscription\.updateMany\(\{\s*\n?\s*where: \{ contactId: id, deliveryAddress: oldAddress \}/);
  // Propagerer også til fastprisaftaler, og kun når adressen faktisk er ændret.
  assert.match(contacts, /fixedPriceAgreement\.updateMany/);
  assert.match(contacts, /const addressChanged = newAddress !== oldAddress/);
});

test("deleteContact revaliderer alle berørte flader", async () => {
  const contacts = await src("app/actions/contacts.ts");
  const deleteBlock = contacts.slice(contacts.indexOf("export async function deleteContact"), contacts.indexOf("export async function updateContactSettings"));
  for (const p of ["/customers", "/orders", "/subscriptions", "/fixed-prices", "/calendar", "/daycalendar"]) {
    assert.match(deleteBlock, new RegExp(`revalidatePath\\("${p}"\\)`));
  }
});

test("telefonnumre normaliseres ved gem (rene cifre uden +45)", async () => {
  const contacts = await src("app/actions/contacts.ts");
  assert.match(contacts, /function normalizePhone\(raw: string\): string/);
  // Kun DANSKE numre normaliseres (8 cifre, evt. 45/0045-præfiks) — udenlandske
  // og maskerede numre bevares som indtastet (verifikationsfund: '+49…' blev
  // ellers uopringbar og '+45 •• …' blev til '45').
  assert.match(contacts, /\^\(\?:45\|0045\)\?\\d\{8\}\$/);
  assert.match(contacts, /digits\.slice\(-8\) : raw\.trim\(\)/);
  assert.match(contacts, /phone: normalizePhone\(f\.phone\) \|\| null/);
});

// ---------------------------------------------------------------------------
// HØJ: convertLeadCore-idempotens + tilbudspris + adresse-/erhvervsværn
// ---------------------------------------------------------------------------

test("convertLeadCore claimer status atomisk så dobbeltkonvertering ikke giver dubletter", async () => {
  const leads = await src("app/actions/leads.ts");
  // Atomisk værn: updateMany med status-betingelse, og count tjekkes.
  assert.match(leads, /lead\.updateMany\(\{\s*\n?\s*where: \{ id, status: \{ not: "converted" \} \}/);
  assert.match(leads, /where: \{ id, status: \{ not: "converted" \}, contactId: null \}/);
  assert.match(leads, /claim\.count === 0/);
  assert.match(leads, /alreadyConverted: true/);
});

test("lead-konvertering bruger tilbuddets rabatkæde (mængderabat + rabatkode)", async () => {
  const leads = await src("app/actions/leads.ts");
  assert.match(leads, /import \{ parseLeadPayload, beregn, medRabatkode/);
  assert.match(leads, /function rabatFaktor\(/);
  assert.match(leads, /medRabatkode\(r, kodePct\)/);
  assert.match(leads, /aarNet \/ r\.aarBrutto/);
});

test("rabatkæden skalerer linjepriserne så årssummen matcher det accepterede tilbud", () => {
  // 5 services → 15 % mængderabat; gyldig rabatkode −10 % oven på.
  const services: PricedService[] = [
    { id: "vinduer", navn: "Vinduespudsning", wm: null, qty: 20, enhed: "vinduer", freq: 12, pris: 15 },
    { id: "haek", navn: "Hækklipning", wm: null, qty: 80, enhed: "m", freq: 2, pris: 25 },
    { id: "alge", navn: "Algebehandling", wm: null, qty: 100, enhed: "m²", freq: 1, pris: 8 },
    { id: "tagrender", navn: "Tagrenderens", wm: null, qty: 30, enhed: "m", freq: 2, pris: 20 },
    { id: "green", navn: "Grøn service", wm: null, qty: 1, enhed: "stk", freq: 4, pris: 300 },
  ];
  const r = beregn(services);
  const { aarNet } = medRabatkode(r, 10);
  assert.equal(r.rabatPct, 15);
  const faktor = aarNet / r.aarBrutto;
  assert.ok(Math.abs(faktor - 0.85 * 0.9) < 1e-9);
  // Årssum af skalerede linjepriser (pris × qty × faktor × freq) rammer aarNet
  // på nær øre-afrunding pr. linje.
  const aarFraLinjer = services.reduce((a, s) => a + (s.pris ?? 0) * s.qty * faktor * s.freq, 0);
  assert.ok(Math.abs(aarFraLinjer - aarNet) < 1e-6);
  assert.ok(aarNet < r.aarBrutto); // brutto må aldrig faktureres
});

test("lead uden adresse fejler med tydelig besked i stedet for stille datotab", async () => {
  const leads = await src("app/actions/leads.ts");
  assert.match(leads, /harPakkevalg && !deliveryAddress/);
  assert.match(leads, /mangler en adresse/);
  // CRM-knappen viser fejlen på /leads i stedet for at fejle stille.
  assert.match(leads, /redirect\(`\/leads\?fejl=\$\{encodeURIComponent\(result\.error\)\}`\)/);
  const page = await src("app/leads/page.tsx");
  assert.match(page, /sp\.fejl/);
});

test("erhvervs-lead konverteres med companyName sat", async () => {
  const leads = await src("app/actions/leads.ts");
  assert.match(leads, /companyName: isCompany \? lead\.name : null/);
});

// ---------------------------------------------------------------------------
// HØJ: React 19-form-reset må ikke smide indtastning væk
// ---------------------------------------------------------------------------

test("ContactForm prefiller fra state.values ved fejl", async () => {
  const form = await src("components/ContactForm.tsx");
  assert.match(form, /const v = state\.values/);
  for (const felt of ["companyName", "cvr", "ean", "email", "phone", "note"]) {
    assert.match(form, new RegExp(`defaultValue=\\{v\\?\\.${felt} \\?\\? initial\\.${felt}\\}`));
  }
  assert.match(form, /const navnDefault = v \? v\.navn :/);
});

test("QuoteComposer-felterne er kontrollerede og overlever en fejl-runde", async () => {
  const composer = await src("components/QuoteComposer.tsx");
  assert.match(composer, /const \[toValue, setToValue\] = useState\(to\)/);
  assert.match(composer, /const \[subjectValue, setSubjectValue\] = useState\(subject\)/);
  assert.match(composer, /const \[bodyValue, setBodyValue\] = useState\(body\)/);
  assert.match(composer, /value=\{bodyValue\} onChange=/);
  assert.doesNotMatch(composer, /defaultValue=\{(to|subject|body)\}/);
  // Modtagerfeltet fanges nu også client-side før server-runden.
  assert.match(composer, /name="to" type="email" required/);
});

// ---------------------------------------------------------------------------
// MELLEM/LAV: Slack-race, Nej tak, Måske, routeId, separatorer, datoer, picker
// ---------------------------------------------------------------------------

test("Slack 'Godkend og send' claimer tilbudSendtAt atomisk (compare-and-swap på payload)", async () => {
  const route = await src("app/api/slack/interactions/route.ts");
  assert.match(route, /lead\.updateMany\(\{\s*\n?\s*where: \{ id: lead\.id, payload: lead\.payload \}/);
  assert.match(route, /claimed\.count === 0/);
});

test("'Nej tak' bevarer status for allerede konverterede leads", async () => {
  const route = await src("app/api/quote-response/route.ts");
  assert.match(route, /updateMany\(\{\s*\n?\s*where: \{ id: lead\.id, status: \{ not: "converted" \} \},\s*\n?\s*data: \{ status: "rejected" \}/);
  assert.match(route, /declined\.count > 0/);
  assert.match(route, /ALLEREDE konverteret/);
});

test("'Måske' forbruger ikke engangs-tokenet — Ja/Nej gør", async () => {
  const tokens = await src("lib/quote-tokens.ts");
  const maybeBlock = tokens.slice(tokens.indexOf('if (choice === "maybe")'), tokens.indexOf("const claimed"));
  assert.ok(maybeBlock.length > 0);
  assert.match(maybeBlock, /data: \{ choice \}/);
  assert.doesNotMatch(maybeBlock, /usedAt: new Date\(\)/);
  // Accept/decline beholder den atomiske engangs-semantik.
  assert.match(tokens, /where: \{ token, usedAt: null \},\s*\n?\s*data: \{ usedAt: new Date\(\), choice \}/);
});

test("alle /customers/[id]-sider bruger routeId (404 i stedet for Prisma-500)", async () => {
  for (const p of [
    "app/customers/[id]/page.tsx",
    "app/customers/[id]/edit/page.tsx",
    "app/customers/[id]/settings/page.tsx",
    "app/customers/[id]/send-tilbud/page.tsx",
  ]) {
    const page = await src(p);
    assert.match(page, /from "@\/lib\/route-ids"/, p);
    assert.match(page, /routeId\(id\)/, p);
  }
});

test("kundekort og kundeliste renderer separatorer kun mellem udfyldte felter", async () => {
  const detail = await src("app/customers/[id]/page.tsx");
  assert.match(detail, /\[c\.street, c\.city\]\.filter\(Boolean\)\.join\(", "\)/);
  assert.match(detail, /\[c\.phone, c\.email\]\.filter\(Boolean\)\.join\(" · "\)/);
  assert.doesNotMatch(detail, /\{c\.phone\} · \{c\.email\}/);
  const ui = await src("components/ui.tsx");
  assert.match(ui, /\[contact\.street, contact\.city\]\.filter\(Boolean\)\.join\(", "\)/);
  assert.match(ui, /\[contact\.phone, contact\.email\]\.filter\(Boolean\)\.join\(" · "\)/);
  assert.doesNotMatch(ui, /\{contact\.phone\} · \{contact\.email\}/);
});

test("/leads-datoer formateres i Europe/Copenhagen, ikke UTC", async () => {
  const page = await src("app/leads/page.tsx");
  assert.match(page, /timeZone: "Europe\/Copenhagen"/);
  assert.doesNotMatch(page, /createdAt\.toISOString\(\)\.slice/);
});

test("ContactPicker åbner kontaktoprettelse i ny fane og lover ikke søgning", async () => {
  const picker = await src("components/ContactPicker.tsx");
  assert.match(picker, /target="_blank" rel="noopener"/);
  assert.doesNotMatch(picker, /Klik for at fremsøge/);
});

test("konverter-menupunktet på /leads har retvisende tekst og bekræftelse", async () => {
  const page = await src("app/leads/page.tsx");
  assert.doesNotMatch(page, /"Åbn som kunde"/);
  assert.match(page, /afventende abonnement eller en afventende ordre/);
});
