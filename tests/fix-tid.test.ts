import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { cphDayISO, utcFromCphWall, udLabel } from "../lib/timesheet";

const root = new URL("../", import.meta.url);
const source = (path: string) => readFile(new URL(path, root), "utf8");

// --- KRITISK: erhvervsordrer må ALDRIG dobbeltfaktureres (pr. ordre + samlefaktura) ---

test("issueInvoiceForOrder afviser pr.-ordre-fakturering for erhvervskontakter", async () => {
  const dinero = await source("lib/dinero.ts");
  // Autoritativt værn (2026-09-03): kunder med faktureringsreglen maaned/kvartal
  // (og erhverv via auto-afledning, se goesToBatch/effectiveInvoiceFrequency)
  // uden allerede bogført pr.-ordre-faktura → status "Samlefaktura", intet Dinero-kald.
  assert.match(dinero, /goesToBatch = effectiveInvoiceFrequency\(order\.contact\) !== "pr_gang"/);
  assert.match(dinero, /goesToBatch && !perOrderBooked/);
  assert.match(dinero, /dineroInvoiceStatus: "Samlefaktura"/);
  assert.match(dinero, /return \{ ok: true, status: "Samlefaktura" \}/);
  // Undtagelsen gælder kun ordrer der ALLEREDE bærer en bogført pr.-ordre-faktura.
  assert.match(dinero, /perOrderBooked = BOOKED_STATES\.has\(order\.dineroInvoiceStatus \?\? ""\) \|\| order\.dineroInvoiceNumber != null/);
  // Værnet ligger FØR både dry-run og det rigtige Dinero-flow.
  const body = dinero.slice(dinero.indexOf("export async function issueInvoiceForOrder"));
  assert.ok(body.indexOf('status: "Samlefaktura"') < body.indexOf("loadActiveConfig()"));
});

test("samlefaktura-batchen udelukker ordrer med en pr.-ordre-faktura (andet ben af værnet)", async () => {
  const batch = await source("lib/business-invoicing.ts");
  assert.match(batch, /status: "Udført",\s*\n\s*businessBatchInvoiceGuid: null,\s*\n\s*dineroInvoiceGuid: null,/);
});

// --- HØJ: /reports/graphs må ikke prerendere/build-fryse tal ---

test("/reports/graphs er force-dynamic og admin-afgrænset uden kort-attrap", async () => {
  const page = await source("app/reports/graphs/page.tsx");
  assert.match(page, /export const dynamic = "force-dynamic"/);
  assert.match(page, /getSessionUser/);
  assert.match(page, /Kun administratorer har adgang til rapporterne\./);
  // 'Interaktivt kundekort'-attrappen og dens legende er fjernet.
  assert.doesNotMatch(page, /MAP_LEGEND|Interaktivt kundekort|map-box/);
});

test("getReportData defaulter til dags dato i dansk tid (ikke build-frossen UTC)", async () => {
  const data = await source("lib/reports-data.ts");
  assert.match(data, /getReportData\(refISO = todayCphISO\(\)\)/);
  assert.doesNotMatch(data, /new Date\(\)\.toISOString\(\)\.slice\(0, 10\)/);
  assert.doesNotMatch(data, /MAP_LEGEND/);
});

// --- Check ind-race: atomisk pr.-bruger-lås + checkOut lukker alle åbne ---

test("checkIn serialiserer find-then-create under en advisory lock pr. bruger", async () => {
  const actions = await source("app/actions/timesheet.ts");
  assert.match(actions, /pg_advisory_xact_lock\(\$\{TIME_LOCK_NS\}::int, \$\{userId\}::int\)/);
  // Låsen tages i transaktionen FØR findFirst.
  const checkInBody = actions.slice(actions.indexOf("export async function checkIn"), actions.indexOf("export async function checkOut"));
  assert.ok(checkInBody.indexOf("pg_advisory_xact_lock") < checkInBody.indexOf("findFirst"));
});

test("checkOut lukker ALLE brugerens åbne registreringer (ingen evig 'Åben'-række)", async () => {
  const actions = await source("app/actions/timesheet.ts");
  assert.match(actions, /timeEntry\.updateMany\(\{ where: \{ userId, checkOut: null \}, data: \{ checkOut: new Date\(\) \} \}\)/);
});

// --- Glemt check-ud: dato i badgen + lukning med angivet sluttid ---

test("CheckInOut viser dato for gamle check-ind og har 'Glemte du at tjekke ud?'-formular", async () => {
  const comp = await source("components/CheckInOut.tsx");
  assert.match(comp, /Checket ind \$\{shownInfo\.dato\} kl\. \$\{shownInfo\.tid\}/);
  assert.match(comp, /Glemte du at tjekke ud/);
  // React 19 form-reset: indtastet sluttid overlever en valideringsfejl.
  assert.match(comp, /defaultValue=\{state\.values\?\.tid \?\? ""\}/);
});

test("checkOutAt validerer sluttiden mod check-ind-dagen og fremtiden", async () => {
  const actions = await source("app/actions/timesheet.ts");
  assert.match(actions, /utcFromCphWall\(dayISO, hh, mm\)/);
  // Natvagt (verifikationsfund): klokkeslæt FØR check-ind = dagen efter.
  assert.match(actions, /nextDayISO/);
  assert.match(actions, /slut = utcFromCphWall\(nextDayISO, hh, mm\)/);
  assert.match(actions, /Sluttiden skal være efter check ind/);
  assert.match(actions, /Sluttiden ligger i fremtiden/);
  // Kun rækker sluttiden reelt dækker lukkes (checkIn <= slut).
  assert.match(actions, /checkIn: \{ lte: slut \}/);
});

test("utcFromCphWall rammer dansk vægur på begge sider af sommertid", () => {
  // Sommertid (UTC+2): 24.08 kl. 15:02 dansk tid = 13:02Z.
  assert.equal(utcFromCphWall("2026-08-24", 15, 2).toISOString(), "2026-08-24T13:02:00.000Z");
  // Normaltid (UTC+1): 15.01 kl. 08:00 dansk tid = 07:00Z.
  assert.equal(utcFromCphWall("2026-01-15", 8, 0).toISOString(), "2026-01-15T07:00:00.000Z");
  // Rundtur: den beregnede UTC-instans ligger på den ønskede danske kalenderdag.
  assert.equal(cphDayISO(utcFromCphWall("2026-08-24", 0, 5)), "2026-08-24");
  assert.equal(cphDayISO(utcFromCphWall("2026-08-24", 23, 55)), "2026-08-24");
});

test("udLabel markerer check-ud på en senere dansk dato med '+1 dag'", () => {
  const ind = new Date("2026-08-24T20:00:00Z"); // 22:00 dansk tid
  assert.match(udLabel(ind, new Date("2026-08-25T00:30:00Z")), /\(\+1 dag\)/); // 02:30 næste dag
  assert.doesNotMatch(udLabel(ind, new Date("2026-08-24T21:30:00Z")), /dag/); // samme aften
});

// --- Rapportens omsætning = udførte ordrer (afstemmelig med lønrapporten) ---

test("getReportData filtrerer omsætning på status 'Udført' og medtager hele ÅTD-dagen", async () => {
  const data = await source("lib/reports-data.ts");
  assert.match(data, /orders\.filter\(\(o\) => o\.status === "Udført"\)/);
  assert.match(data, /kpisForOrders\(completed\)/);
  assert.match(data, /const refEnd = new Date\(ref\.getTime\(\) \+ 864e5\)/);
  assert.match(data, /completed\.filter\(\(o\) => o\.plannedAt >= jan1 && o\.plannedAt < refEnd\)/);
});

// --- CSV: formel-injektion + admin-afgrænsning ---

test("begge CSV-ruter neutraliserer formelceller og kræver admin", async () => {
  for (const p of ["app/api/reports/orders/route.ts", "app/api/reports/subscriptions/route.ts"]) {
    const src = await source(p);
    assert.match(src, /typeof v === "string" && \/\^\[=\+\\-@\]\/\.test\(s\)/, p);
    assert.match(src, /\[",\\n\\r;\]/, p);
    assert.match(src, /if \(me == null\) return unauthorized\(\);\s*\n\s*if \(!me\.isAdmin\) return forbidden\(\);/, p);
    assert.match(src, /status: 403/, p);
  }
});

// --- /reports/download: dynamiske default-datoer i dansk tid ---

test("/reports/download er force-dynamic og bruger todayCphISO til månedsinterval", async () => {
  const page = await source("app/reports/download/page.tsx");
  assert.match(page, /export const dynamic = "force-dynamic"/);
  assert.match(page, /todayCphISO\(\)\.split\("-"\)\.map\(Number\)/);
  assert.doesNotMatch(page, /new Date\(\)\.getUTCFullYear|now\.getUTCMonth/);
});

// --- Toggles kan betjenes med tastatur (rigtige <button> + aria-pressed) ---

test("BarChart og KpiSection bruger SegButton (button + aria-pressed) i stedet for span onClick", async () => {
  const bar = await source("components/BarChart.tsx");
  assert.match(bar, /export function SegButton/);
  assert.match(bar, /aria-pressed=\{on\}/);
  assert.match(bar, /type="button"/);
  assert.doesNotMatch(bar, /<span className=\{gran|<span className=\{mode/);
  const kpi = await source("components/KpiSection.tsx");
  assert.match(kpi, /SegButton on=\{period === "12"\}/);
  assert.doesNotMatch(kpi, /<span className=\{period/);
});

// --- Timesedlen: grænse PR. bruger, ikke 100 på tværs ---

test("getTimesheet henter pr. medarbejder med take pr. bruger", async () => {
  const lib = await source("lib/timesheet.ts");
  assert.match(lib, /const PER_USER_LIMIT = 100/);
  assert.match(lib, /where: \{ userId: u\.id \},\s*\n\s*orderBy: \{ checkIn: "desc" \},\s*\n\s*take: PER_USER_LIMIT/);
  const page = await source("app/timesheet/page.tsx");
  assert.match(page, /groups\.filter\(\(g\) => g\.rows\.length > 0\)\.map/);
});

// --- Dinero-kontonumre: valideringsfejl med bevaret indtastning, aldrig stille default ---

test("saveDineroAccounts afviser ugyldigt/tomt kontonummer og ekkoer values", async () => {
  const actions = await source("app/actions/dinero.ts");
  assert.match(actions, /Angiv et gyldigt kontonummer \(positivt heltal\) til salgskontoen\./);
  assert.match(actions, /Angiv et gyldigt kontonummer \(positivt heltal\) til indbetalingskontoen\./);
  assert.match(actions, /!Number\.isInteger\(salesN\) \|\| salesN <= 0/);
  // Ingen stille fallback til standardkontiene.
  assert.doesNotMatch(actions, /: 1000;|: 55040;/);
  const form = await source("components/DineroAccountsForm.tsx");
  assert.match(form, /name="salesAccountNumber" type="number" min="1" required/);
  assert.match(form, /defaultValue=\{state\.values\?\.salesAccountNumber \?\? salesAccountNumber\}/);
  assert.match(form, /defaultValue=\{state\.values\?\.cashAccountNumber \?\? cashAccountNumber\}/);
});

// --- Påmindelser: hele danske kalenderdøgn (i dag + i morgen), ikke +36 timer ---

test("påmindelsesvinduet er danske kalenderdøgn og retry-vinduet dækker 'i dag'", async () => {
  const route = await source("app/api/reminders/route.ts");
  assert.match(route, /function cphMidnightUtc\(now: Date, addDays: number\)/);
  assert.match(route, /const tomorrowStart = cphMidnightUtc\(now, 1\)/);
  assert.match(route, /const end = cphMidnightUtc\(now, 2\)/);
  // +36-timers-vinduet (og +12-timers-anker-hacket) er væk.
  assert.doesNotMatch(route, /36 \* 3600|\+ 12 \* 3600/);
  // Mailtekst afgøres pr. ordre: aldrig "i morgen" for en ordre i dag/overmorgen.
  assert.match(route, /\(o\.startAt \?\? o\.plannedAt\) >= tomorrowStart \? "i morgen" : "i dag"/);
  assert.match(route, /subject: `Vi kommer \$\{dagOrd\}`/);
  // Fejlet mail ruller stadig tilbage — og kommentaren lover et reelt nyt forsøg.
  assert.match(route, /data: \{ reminderSentAt: null \}/);
});
