import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { mondayOfISO } from "../lib/calendar2-navigation";
import { weekLabel, weekOptions, isoWeekYear } from "../lib/weeks";

const root = new URL("../", import.meta.url);
const source = (path: string) => readFile(new URL(path, root), "utf8");

// --- Crash-guards på dato-parametre ---

test("mondayOfISO crasher ikke på formgyldig men ugyldig dato ('2026-13-01')", () => {
  const fallback = new Date("2026-08-26T00:00:00Z");
  assert.equal(mondayOfISO("2026-13-01", fallback), "2026-08-24");
  assert.equal(mondayOfISO("2026-01-99", fallback), "2026-08-24");
  assert.equal(mondayOfISO("2026-08-26", fallback), "2026-08-24"); // gyldig dato uændret adfærd
});

test("/daycalendar validerer datoen reelt (ikke kun formen)", async () => {
  const page = await source("app/daycalendar/page.tsx");
  assert.match(page, /!Number\.isNaN\(Date\.parse\(`\$\{sp\.date\}T00:00:00Z`\)\)/);
});

// --- ISO-ugeår ved årsskifte ---

test("uge-labels bruger ISO-ugeåret, ikke mandagens kalenderår", () => {
  // 2025-12-29 er mandag i ISO-uge 1 af 2026.
  assert.equal(isoWeekYear("2025-12-29"), 2026);
  assert.equal(weekLabel("2025-12-29"), "Uge 1, 2026");
  assert.equal(weekLabel("2026-08-24"), "Uge 35, 2026");
  const opts = weekOptions(new Date("2025-12-29T12:00:00Z"), 1);
  assert.equal(opts[0].label, "Uge 1, 2026");
});

test("ugekalenderens titel viser begge år i en årsskifte-uge", async () => {
  const queries = await source("lib/queries.ts");
  assert.match(queries, /year !== sunday\.getUTCFullYear\(\)/);
});

// --- Adgang: deaktiverede brugere og viewer-eskalering ---

test("kalender og dagsprogram redirecter når sessionen er ugyldig/deaktiveret (ingen 'vis alt'-fallback)", async () => {
  for (const path of ["app/calendar/page.tsx", "app/daycalendar/page.tsx"]) {
    const page = await source(path);
    assert.match(page, /if \(!me\) redirect\("\/login"\)/, path);
  }
});

test("guardAction afviser deaktiverede brugere (getSessionUser, ikke kun token-tjek)", async () => {
  const auth = await source("lib/api-auth.ts");
  assert.match(auth, /if \(\(await getSessionUser\(\)\) == null\) redirect\("\/login"\)/);
});

// --- Kalenderens handlinger er nået frem til admin, og 'Genplanlæg uge' virker ---

test("/calendar er redigerbar for alle — medarbejdere får flytterettigheder (moveOnly)", async () => {
  const page = await source("app/calendar/page.tsx");
  assert.match(page, /const moveOnly = !me\.isAdmin/);
  assert.match(page, /moveOnly=\{moveOnly\}/);
  // Flyt/lås-handlinger håndhæves server-side (guardAction); moveOnly skjuler
  // kun admin-funktionerne (genplanlæg uge, slet ordre) i UI'en.
  const client = await source("components/TeamCalendarClient.tsx");
  assert.match(client, /!moveOnly && confirmDel/, "moveOnly skjuler slet-dialogen");
  assert.match(client, /!readOnly && !moveOnly && \(/, "moveOnly skjuler 'Genplanlæg uge'");
});

test("'Genplanlæg uge' persisterer planen (ikke længere en no-op)", async () => {
  const actions = await source("app/actions/orders.ts");
  assert.match(actions, /export async function replanWeek[\s\S]{0,200}await planAndPersistWeek\(weekMonday\)/);
});

// --- Statusfarver: handlingskrævende statusser må ikke ligne 'Afventer' ---

test("calStatusOf skelner Skal genplanlægges / Sprunget over / Anden status", async () => {
  const queries = await source("lib/queries.ts");
  assert.match(queries, /status === "Skal genplanlægges" \|\| status\.startsWith\("Mislykk"\)/);
  assert.match(queries, /status === "Sprunget over" \|\| status === "Anden status"/);
});

// --- Ugevisningen viser medarbejderens EGNE ikke-planlagte ordrer ---

test("getCalendarWeek viser egne unplanned-ordrer for ikke-admin (som dagsprogrammet)", async () => {
  const queries = await source("lib/queries.ts");
  assert.match(queries, /rawUnplanned\.filter\(\(\{ job \}\) => job\.fixedEmployeeId === viewer\.id\)/);
});

// --- Dagsprogram-PDF: adgang, viewer, medarbejder-filter, paginering, dansk dato ---

test("day-pdf håndhæver viewer-reglen og et ægte medarbejder-filter", async () => {
  const route = await source("app/api/reports/day-pdf/route.ts");
  assert.match(route, /getSessionUser/);
  assert.match(route, /getDayProgram\(date, \{ id: me\.id, isAdmin: me\.isAdmin \}\)/);
  assert.match(route, /me\.isAdmin && \/\^\\d\+\$\/\.test\(employeeIdRaw\)/);
  assert.match(route, /todayCphISO\(\)/);
  assert.doesNotMatch(route, /weekMondayToday/);
});

test("day-pdf paginerer i stedet for at klippe lange dage", async () => {
  const route = await source("app/api/reports/day-pdf/route.ts");
  assert.match(route, /LINES_PER_PAGE/);
  assert.match(route, /fortsat - side/);
  assert.match(route, /Count \$\{n\}/);
});

test("day-pdf-formularen bruger dansk dags dato og rigtige medarbejdere fra databasen", async () => {
  const page = await source("app/reports/day-pdf/page.tsx");
  assert.match(page, /todayCphISO\(\)/);
  assert.match(page, /getEmployeeOptions\(\)/);
  assert.doesNotMatch(page, /Kristian Klercke/);
});

// --- Mobil: 'Mere ▾' i dagsprogrammet lukker ved tap udenfor ---

test("DayStopCard lukker 'Mere ▾' ved klik/tap udenfor (ikke kun mouseleave)", async () => {
  const card = await source("components/DayStopCard.tsx");
  assert.match(card, /document\.addEventListener\("click", close\)/);
  assert.match(card, /moreRef\.current\?\.contains/);
});
