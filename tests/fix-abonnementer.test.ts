import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { HOLIDAYS, PRICE_ADJUSTMENT } from "../lib/funktioner";

const src = (p: string) => readFile(new URL(`../${p}`, import.meta.url), "utf8");

// ---------------------------------------------------------------------------
// KRITISK: Prisjustering skal også ramme allerede genererede, ikke-afsluttede
// ordrer — og må ikke crashe på stale taskIds efter mellemliggende redigering
// ---------------------------------------------------------------------------

test("applyPriceAdjustment slår skabelonlinjerne op på ny (ingen P2025 på stale ids)", async () => {
  const actions = await src("app/actions/funktioner.ts");
  // Genopslag i stedet for blind update pr. klient-id …
  assert.match(actions, /prisma\.taskLine\.findMany\(\{\s*where: \{ id: \{ in: \[\.\.\.newPriceById\.keys\(\)\] \}/);
  // … og manglende linjer rapporteres som sprunget over i stedet for at kaste.
  assert.match(actions, /const skipped = adjustments\.length - lines\.length/);
  assert.match(actions, /sprunget over, fordi de er ændret siden beregningen/);
  assert.doesNotMatch(actions, /adjustments\.map\(\(a\) => prisma\.taskLine\.update/);
});

test("applyPriceAdjustment opdaterer ordrelinjer på ikke-afsluttede ordrer i samme transaktion", async () => {
  const actions = await src("app/actions/funktioner.ts");
  // Ordrelinjer (kopier uden subscriptionId) rammes via ordrens relation …
  assert.match(actions, /taskLine\.updateMany\(\{\s*where: \{ order: \{ is: \{ \.\.\.orderScope, status: "Afventer levering" \} \}, description: line\.description, price: line\.price \}/);
  // … og både skabelon- og ordre-opdateringer kører i ÉN transaktion.
  assert.match(actions, /await prisma\.\$transaction\(ops\)/);
  // Step 3-beskeden fortæller at planlagte ordrer også er opdateret.
  assert.match(actions, /gælder også allerede planlagte, ikke-afsluttede ordrer/);
});

test("prisjustering udelader STOPPEDE abonnementer i både beregning og gennemførelse", async () => {
  const actions = await src("app/actions/funktioner.ts");
  assert.match(actions, /VISIBLE_SUB = \{ subscription: \{ is: \{ OR: \[\{ active: true \}, \{ pending: true \}\] \} \} \}/);
  // Bruges begge steder (compute + apply).
  const uses = actions.match(/VISIBLE_SUB/g) ?? [];
  assert.ok(uses.length >= 3, `VISIBLE_SUB bruges ${uses.length} gange`);
  assert.doesNotMatch(actions, /OR: \[\{ subscriptionId: \{ not: null \} \}/);
});

// ---------------------------------------------------------------------------
// KRITISK: Ferie — besøg i ferielukkede uger skubbes til første åbne uge
// ---------------------------------------------------------------------------

test("generateForSubscription skubber ferieramte besøg i stedet for at droppe dem", async () => {
  const rec = await src("lib/recurrence.ts");
  // Det gamle 'if (isHoliday(v) ...) continue' er væk …
  assert.doesNotMatch(rec, /isHoliday\(v\) \|\| existingWeeks\.has\(v\)/);
  // … i stedet søges første åbne uge, med værn mod uendelig ferie.
  assert.match(rec, /for \(let guard = 0; isHoliday\(deliveryWeek\) && guard < 52; guard\+\+\) deliveryWeek \+= WEEK_MS/);
  // Ordren leveres i den skubbede uge, men sourceWeek forbliver rytme-ugen (dedup).
  assert.match(rec, /plannedAt: new Date\(deliveryWeek \+ 10 \* 3600 \* 1000\)/);
  assert.match(rec, /sourceWeek: new Date\(v\)/);
  // Skubbede besøg slås sammen med rytmens eget besøg/optagne uger.
  assert.match(rec, /stepsFromAnchor % base === 0 \|\| usedDeliveryWeeks\.has\(deliveryWeek\)/);
});

test("ferie-forklaringen matcher den faktiske adfærd (skub til første åbne uge)", () => {
  // Lover ikke længere en varig forskydning af ALLE efterfølgende uger …
  assert.doesNotMatch(HOLIDAYS.body, /alle efterfølgende uger/);
  assert.match(HOLIDAYS.body, /skubbet til den første åbne uge efter ferien/);
  // … og den ikke-håndhævede 1-uges-regel er væk fra punktlisten.
  for (const b of HOLIDAYS.bullets) assert.doesNotMatch(b, /minimum 1 uge|mindre end 1 uge/);
  assert.ok(!HOLIDAYS.historyCols.includes("Kan redigeres til og med"));
});

// ---------------------------------------------------------------------------
// KRITISK: Startuge valideres ved gem — og fortolkes år-bevidst
// ---------------------------------------------------------------------------

test("parse() afviser en startuge genereringen ikke forstår og ekkoer indtastningen", async () => {
  const actions = await src("app/actions/subscriptions.ts");
  assert.match(actions, /function normalizeWeekLabel/);
  // Normalisering: "29"/"uge29" → "Uge 29"; alt uforståeligt → fejl med values.
  assert.match(actions, /return \{ error: "Angiv startuge som fx 'Uge 29'\.", values \}/);
  // Ugyldig "Næste gang" på en opgavelinje ignoreres heller ikke stille.
  assert.match(actions, /Angiv 'Næste gang' som fx 'Uge 29' på opgaven/);
  // Der gemmes den validerede uge — ikke længere `p.startWeek || null`.
  assert.doesNotMatch(actions, /startWeek: p\.startWeek \|\| null/);
});

test("årløs startuge fortolkes år-bevidst: nyt abonnement starter ALDRIG før sin uge", async () => {
  const rec = await src("lib/recurrence.ts");
  // Nyt abonnement (ingen ordrer/tombstones): fremtidig uge bevares, forgangen
  // uge betyder næste års forekomst — kun igangværende abonnementer rykkes frem.
  assert.match(rec, /const hasOrders = existing\.length > 0 \|\| skips\.length > 0/);
  assert.match(rec, /if \(hasOrders\) \{\s*\n\s*if \(anchor > horizonEnd\) anchor = mondayOfIsoWeek\(refYear - 1, subWeek\)\.getTime\(\);\s*\n\s*\} else if \(anchor < thisMonday\) \{\s*\n\s*anchor = mondayOfIsoWeek\(refYear \+ 1, subWeek\)\.getTime\(\);/);
  // Opgave-uger FØR startugen er næste års forekomst — aldrig negativ j0.
  assert.match(rec, /taskWeek >= subWeek \? taskWeek - subWeek : taskWeek - subWeek \+ 52/);
});

// ---------------------------------------------------------------------------
// HØJ: redigering med ugyldig startuge må aldrig slette uden at genskabe
// ---------------------------------------------------------------------------

test("regenerateFutureOrders har defensiv guard FØR den destruktive sletning", async () => {
  const rec = await src("lib/recurrence.ts");
  const block = rec.slice(rec.indexOf("export async function regenerateFutureOrders"));
  assert.match(block, /if \(!sub \|\| parseWeekLabel\(sub\.startWeek\) == null\) return \{ generated: 0 \}/);
  // Guarden skal stå før sletningen.
  assert.ok(block.indexOf("return { generated: 0 }") < block.indexOf("order.deleteMany"));
});

// ---------------------------------------------------------------------------
// HØJ: deaktiveret fast medarbejder — synlig i formularen, aldrig stille tabt
// ---------------------------------------------------------------------------

test("SubscriptionForm viser en bevaret men deaktiveret fast medarbejder som eksplicit valg", async () => {
  const form = await src("components/SubscriptionForm.tsx");
  assert.match(form, /savedEmployee !== "Ingen" && !employees\.includes\(savedEmployee\)/);
  assert.match(form, /Nuværende: \{inactiveEmployee\} \(deaktiveret\)/);
});

test("ukendt/deaktiveret fast medarbejder giver employeeId null — ikke første aktive bruger", async () => {
  const rec = await src("lib/recurrence.ts");
  const block = rec.slice(rec.indexOf("async function defaultEmployeeId"), rec.indexOf("export async function generateForSubscription"));
  assert.match(block, /return match \? match\.id : null/);
  assert.doesNotMatch(block, /if \(match\) return match\.id;/);
});

// ---------------------------------------------------------------------------
// MELLEM: React 19 form-reset — Startuge/Interval/Medarbejder overlever fejl
// ---------------------------------------------------------------------------

test("SubscriptionState bærer values, og alle fejl-returer ekkoer dem", async () => {
  const actions = await src("app/actions/subscriptions.ts");
  assert.match(actions, /SubscriptionState = \{ error\?: string; values\?: \{ startWeek: string; baseInterval: string; fixedEmployee: string \} \}/);
  assert.match(actions, /return \{ error: "Vælg en kunde\.", values \}/);
  assert.match(actions, /return \{ error: "Vælg et basis-interval\.", values \}/);
  assert.match(actions, /return \{ error: "Tilføj mindst én opgave\.", values \}/);
  // Også kunde-ikke-fundet-fejlene i create/update (to forekomster).
  const notFound = actions.match(/error: "Kunden blev ikke fundet\.", values/g) ?? [];
  assert.equal(notFound.length, 2);
});

test("SubscriptionForm prefiller de tre topfelter fra state.values", async () => {
  const form = await src("components/SubscriptionForm.tsx");
  assert.match(form, /const v = state\.values/);
  assert.match(form, /v\?\.baseInterval \?\? initial\?\.baseInterval \?\? "Hver 2\. uge"/);
  assert.match(form, /defaultValue=\{v\?\.startWeek \?\? initial\?\.startWeek \?\? ""\}/);
  assert.match(form, /defaultValue=\{v\?\.fixedEmployee \?\? initial\?\.fixedEmployee \?\? "Ingen"\}/);
});

// ---------------------------------------------------------------------------
// MELLEM: pausefelter — ryddet dato er en valideringsfejl, aldrig stille ignoreret
// ---------------------------------------------------------------------------

test("sat pause med manglende/ugyldig dato afvises med fejl", async () => {
  const actions = await src("app/actions/subscriptions.ts");
  assert.match(actions, /l\.pauseActive === "1" && \(!ISO_DATE\.test\(l\.pauseStart\) \|\| !ISO_DATE\.test\(l\.pauseEnd\)\)/);
  assert.match(actions, /Angiv start- og slutdato for pausen på opgaven/);
  assert.doesNotMatch(actions, /Lempelig pause-validering/);
});

// ---------------------------------------------------------------------------
// MELLEM: gruppebeskeder — medarbejder-, kanal- og kombinerede kildevalg
// ---------------------------------------------------------------------------

test("resolveRecipients respekterer medarbejder- og kanalvalg", async () => {
  const actions = await src("app/actions/funktioner.ts");
  assert.match(actions, /resolveRecipients\(group: string, dateISO: string, weekISO: string, employee = "", channel = ""\)/);
  // Ordrer filtreres på employeeId (navneopslag), abonnementer på fixedEmployee.
  assert.match(actions, /empOrderWhere = \{ employeeId: \{ in: users\.filter/);
  assert.match(actions, /fixedEmployee: empName/);
  // Kanal: SMS kræver telefon, e-mail kræver e-mail.
  assert.match(actions, /channel === "Kun som SMS"\) return all\.filter\(\(r\) => r\.phone\)/);
  assert.match(actions, /channel === "Kun som e-mail"\) return all\.filter\(\(r\) => r\.email\)/);
});

test("'Alle manuelle kunder og online kunder' rammer BEGGE kilder (union)", async () => {
  const actions = await src("app/actions/funktioner.ts");
  assert.match(actions, /const sourceTypes = \[\.\.\.\(g\.includes\("online"\) \? \["online"\] : \[\]\), \.\.\.\(g\.includes\("manuel"\) \? \["manual"\] : \[\]\)\]/);
  assert.match(actions, /sourceType: \{ in: sourceTypes \}/);
  assert.doesNotMatch(actions, /else if \(g\.includes\("online"\)\)/);
});

test("GroupMessageForm sender medarbejder + kanal med til modtager-opslaget", async () => {
  const form = await src("components/GroupMessageForm.tsx");
  assert.match(form, /resolveRecipients\(group, date, week, employee, channel\)/);
});

// ---------------------------------------------------------------------------
// MELLEM: revalidering af /daycalendar + faktisk "Fremtidige ordrer"-kolonne
// ---------------------------------------------------------------------------

test("alle abonnements-mutationer revaliderer /daycalendar", async () => {
  const actions = await src("app/actions/subscriptions.ts");
  const hits = actions.match(/revalidatePath\("\/daycalendar"\)/g) ?? [];
  // regenerateOrders + stop + approve + create + update = 5
  assert.equal(hits.length, 5);
  const funk = await src("app/actions/funktioner.ts");
  const applyOpt = funk.slice(funk.indexOf("export async function applyOptimization"), funk.indexOf("// ---- Price adjustment"));
  assert.match(applyOpt, /revalidatePath\("\/daycalendar"\)/);
});

test("'Fremtidige ordrer'-kolonnen viser den faktiske næste ikke-afsluttede ordre", async () => {
  const page = await src("app/subscriptions/page.tsx");
  assert.match(page, /status: "Afventer levering"/);
  assert.match(page, /plannedAt: \{ gte: mondayOf\(new Date\(\)\) \}/);
  assert.match(page, /_min: \{ plannedAt: true \}/);
  assert.match(page, /\{nextOrderLabel\(s\.pk\)\}/);
  assert.doesNotMatch(page, /<td>\{s\.nextWeek\}<\/td>/);
});

// ---------------------------------------------------------------------------
// MELLEM/LAV: rabatkode-dubletter, afrundingsvalg, døde løfter, routeId, confirm
// ---------------------------------------------------------------------------

test("createDiscountCode afviser dubletkoder case-ufølsomt", async () => {
  const catalog = await src("app/actions/catalog.ts");
  assert.match(catalog, /discountCode\.findFirst\(\{ where: \{ code: \{ equals: code, mode: "insensitive" \} \} \}\)/);
  assert.match(catalog, /findes allerede/);
});

test("umulige ørevalg er fjernet fra afrundingslisten", async () => {
  const wizard = await src("components/PriceAdjustmentWizard.tsx");
  const rounding = wizard.match(/const ROUNDING = \[.*\];/)?.[0] ?? "";
  assert.doesNotMatch(rounding, /50 øre|9,95/);
  assert.match(rounding, /Ingen afrunding/);
  const opts = PRICE_ADJUSTMENT.sections.flatMap((s) => s.fields).flatMap((f) => ("opts" in f ? f.opts ?? [] : []));
  assert.ok(!opts.includes("50 øre") && !opts.includes("Slut på 9,95 kr."));
});

test("skippedLocked-banneret er fjernet, og id-siderne bruger routeId()", async () => {
  const subPage = await src("app/subscriptions/[id]/page.tsx");
  assert.doesNotMatch(subPage, /skippedLocked/);
  assert.match(subPage, /routeId\(id\)/);
  const fpPage = await src("app/fixed-prices/[id]/page.tsx");
  assert.match(fpPage, /routeId\(id\)/);
  assert.doesNotMatch(fpPage, /Number\(id\)/);
});

test("døde løfter er rettet: standardopgave-tekst og opgave-placeholder", async () => {
  const std = await src("components/StandardTaskManager.tsx");
  assert.doesNotMatch(std, /slår ændringen igennem alle steder/);
  const editor = await src("components/TaskLineEditor.tsx");
  assert.doesNotMatch(editor, /Fremsøg eller opret ny opgave/);
  assert.match(editor, /placeholder="Opgavebeskrivelse"/);
});

test("ferie- og rabatkode-sletning kræver bekræftelse (ConfirmButton)", async () => {
  const holidays = await src("components/HolidayManager.tsx");
  assert.match(holidays, /ConfirmButton/);
  assert.match(holidays, /action=\{deleteHoliday\.bind\(null, h\.id\)\}/);
  const codes = await src("components/DiscountCodeManager.tsx");
  assert.match(codes, /action=\{deleteDiscountCode\.bind\(null, c\.id\)\}/);
});
