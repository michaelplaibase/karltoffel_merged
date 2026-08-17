import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const source = (path: string) => readFile(new URL(path, root), "utf8");

test("Kalender 2 loader pausefelter og alle opgavedetaljer til events og unplanned", async () => {
  const calendar = await source("lib/subscription-preview-calendar.ts");
  for (const field of ["pauseActive", "pauseStart", "pauseEnd", "pauseYearly"]) {
    assert.match(calendar, new RegExp(`${field}: task\\.${field}`));
  }
  assert.match(calendar, /tasks: visit\.tasks/);
  assert.match(calendar, /tasks: data\.visitById\.get\(job\.id\)\?\.tasks \?\? \[\]/);
});

test("read-only kort har keyboard-tilgængelige detaljer med kategori, beskrivelse, interval og varighed", async () => {
  const component = await source("components/TeamCalendarClient.tsx");
  assert.match(component, /function PreviewTaskDetails/);
  assert.match(component, /<details/);
  assert.match(component, /<summary/);
  for (const field of ["category", "description", "intervalMultiplier", "durationMin"]) {
    assert.match(component, new RegExp(`task\\.${field}`));
  }
  assert.ok((component.match(/<PreviewTaskDetails/g) ?? []).length >= 2, "både events og unplanned skal vise detaljer");
});

test("read-only markerer den effektive 60 minutters standardtid", async () => {
  const component = await source("components/TeamCalendarClient.tsx");
  assert.match(component, /task\.durationDefaulted/);
  assert.match(component, /60 min\. \(standardtid\)/);
});

test("read-only kort er klikbare som kalenderkort, men menuen indeholder kun sikre visningslinks", async () => {
  const component = await source("components/TeamCalendarClient.tsx");
  const previewPage = await source("app/calendar/page.tsx");
  assert.match(component, /function openReadOnlyMenu/);
  assert.match(component, /role=\{readOnly \? "button" : undefined\}/);
  assert.match(component, /tabIndex=\{readOnly \? 0 : undefined\}/);
  assert.match(component, /onKeyDown=\{readOnly \? \(e\) =>/);
  assert.ok((component.match(/openReadOnlyMenu\(e, /g) ?? []).length >= 2, "både planlagte og ikke-planlagte kort skal åbne menuen");
  assert.match(component, /Gå til kundedetaljer/);
  assert.match(component, /Gå til abonnement/);
  assert.match(component, /Ring kunden op/);
  assert.match(component, /\{readOnly && menu &&/);
  assert.doesNotMatch(previewPage, /setOrderLock|moveOrderWeeks|replanWeek|deleteOrder|\/orders\//);
});

test("read-only viser unplanned reasons sandfærdigt", async () => {
  const component = await source("components/TeamCalendarClient.tsx");
  assert.match(component, /unverified_address[\s\S]*Adresse ikke verificeret/);
  assert.match(component, /unverified_route[\s\S]*Køretidsmatrix ikke verificeret/);
  assert.match(component, /unassigned[\s\S]*Ikke tildelt kollega/);
  assert.match(component, /invalid_duration[\s\S]*Besøget mangler gyldig varighed/);
  assert.doesNotMatch(component, /no_capacity_in_horizon[\s\S]*Ingen plads i de næste 26 uger/);
  assert.match(component, /Arbejdsdag 08:00–18:00/);
  assert.match(component, /Ukendt årsag/);
  assert.doesNotMatch(component, /reason[^\n]*\?[^\n]*Ingen plads i ugen/);
});

test("alle ikke-planlagte kort viser fuld årsag på en selvstændig, tilgængelig linje", async () => {
  const component = await source("components/TeamCalendarClient.tsx");
  const css = await source("app/globals.css");
  assert.match(component, /className="unplanned-reason"/);
  assert.match(component, /aria-label=\{`Årsag: /);
  assert.match(component, /className="unplanned-reason-label">Årsag:<\/span>/);
  assert.match(css, /\.teamcal \.unplanned-reason[\s\S]*white-space:\s*normal/);
  assert.match(css, /\.teamcal \.unplanned-reason[\s\S]*overflow-wrap:\s*anywhere/);
  assert.doesNotMatch(component, /Ordrer uden kollega eller uden plads i ugen\./);
});

test("aktiv kalender bruger 60 minutter pr. manglende opgavetid og bevarer planneradfærd", async () => {
  const planner = await source("lib/planner.ts");
  const queries = await source("lib/queries.ts");
  assert.match(queries, /durationMin:\s*o\.tasks\.reduce\(\(a, t\) => a \+ effectiveCalendarTaskDuration\(t\.durationMin\), 0\)/g);
  assert.doesNotMatch(planner, /calendarJobDurationReason|invalidIds|\.\.\.invalid/);
});

test("Kalender 2 viser read-only preview overrides som forslag og korrekt ikke-planlagt titel", async () => {
  const component = await source("components/TeamCalendarClient.tsx");
  const preview = await source("lib/subscription-preview-calendar.ts");
  assert.match(component, /<b>Ikke planlagt<\/b><span>Se årsagen på hvert kort<\/span>/);
  assert.match(component, /previewSuggestion/);
  assert.match(await source("lib/calendar2-presentation.ts"), /Automatisk forslag/);
  assert.match(preview, /sourceWeekdayOverridden/);
  assert.match(preview, /overrideReason/);
  assert.doesNotMatch(preview, /durationMin:[^\n]*\|\| (?:30|60)/);
});

test("Kalender 2 bruger kun den additive matrixplanner og ændrer ikke aktiv /calendar", async () => {
  const preview = await source("lib/subscription-preview-calendar.ts");
  assert.match(preview, /createCalendar2Routing/);
  assert.match(preview, /planCalendar2Horizon/);
  assert.doesNotMatch(preview, /fallbackEmployeeId|coordFor|planWeek/);
  const active = await source("lib/queries.ts");
  assert.match(active, /from "\.\/planner"/);
  assert.match(active, /from "\.\/geo"/);
  assert.doesNotMatch(active, /calendar2-routing/);
});

test("segmenteret Calendar2-omsætning tæller sourcebesøgets pris præcis én gang", async () => {
  const preview = await source("lib/subscription-preview-calendar.ts");
  assert.match(preview, /segmentIndex\s*===\s*1/);
  assert.doesNotMatch(preview, /for \(const day of data\.plan\.days\) for \(const stop of day\.stops\) revenue\[day\.weekday\] \+= data\.priceById\.get\(stop\.job\.id\) \?\? 0/);
});

test("Calendar2 segmentkort bruger en sammensat React-nøgle", async () => {
  const component = await source("components/TeamCalendarClient.tsx");
  assert.doesNotMatch(component, /<div key=\{ev\.id\} className={`ev/);
  assert.match(component, /key=\{`\$\{ev\.id\}:/);
});

test("Kalender 2 output auditerer fixed weekdays, geocode, matrixben og eksplicitte reasons uden fulde adresser", async () => {
  const preview = await source("lib/subscription-preview-calendar.ts");
  for (const marker of ["fixedWeekdays", "geocodeStatus", "matrixDurations", "travelLegs", "unverified_address"]) {
    assert.match(preview, new RegExp(marker));
  }
  assert.match(preview, /fixedEmployeeId: employeeByName\.get\(row\.fixedEmployee\) \?\? null/);
  assert.doesNotMatch(preview, /matrixAddresses\s*:/);
});

test("uafhængig Kalender 2 source audit er auth-beskyttet GET-only og direkte fra Prisma", async () => {
  const route = await source("app/api/calendar-2/audit-source/route.ts");
  const auditSource = await source("lib/calendar2-audit-source.ts");
  assert.match(route, /export async function GET/);
  assert.doesNotMatch(route, /export async function (POST|PUT|PATCH|DELETE)/);
  assert.match(route, /requireSession/);
  assert.match(route, /unauthorized/);
  assert.match(route, /["']Cache-Control["']:\s*["']no-store/);
  assert.match(auditSource, /prisma\.subscription\.findMany/);
  assert.match(auditSource, /fixedWeekdays:\s*true/);
  for (const field of ["baseInterval", "startWeek", "intervalMultiplier", "pauseActive", "pauseStart", "pauseEnd", "pauseYearly"]) {
    assert.match(auditSource, new RegExp(`${field}:\\s*true`), `source audit mangler ${field}`);
  }
  assert.doesNotMatch(auditSource, /getSubscriptionPreview|routeAudit|deliveryAddress|contact:/);
  assert.doesNotMatch(auditSource, /create|update|delete|upsert|transaction/);
});

test("horizon-audit binder segmenter og afvisninger til source occurrence og task", async () => {
  const preview = await source("lib/subscription-preview-calendar.ts");
  assert.match(preview, /sourceWeek:\s*data\.placementByJob\.get\(stop\.job\.id\)\?\.sourceWeek/);
  assert.match(preview, /rejected:\s*data\.horizonPlan\.unplanned\.map/);
  assert.match(preview, /sourceWeek:\s*item\.sourceWeek/);
  assert.match(preview, /rejectedTasks:\s*item\.rejectedTasks/);
  assert.match(preview, /outsideDisplayHorizon:\s*data\.horizonPlan\.outOfHorizon\.map/);
  assert.match(preview, /segments:\s*item\.segments/);
});

test("horizon-audit publicerer bounded privacy-safe matrixceller og indekser for hvert ben", async () => {
  const preview = await source("lib/subscription-preview-calendar.ts");
  for (const marker of ["matrixVersion", "matrixHash", "matrixProvider", "matrixCapturedAt", "matrixPoints", "matrixDurations", "durationRounding", "fromIndex", "toIndex"]) {
    assert.match(preview, new RegExp(marker), `horizon audit mangler ${marker}`);
  }
  assert.match(preview, /durationRounding:\s*"ceil-seconds-to-whole-minutes"/);
  assert.match(preview, /fromIndex:\s*plan\.audit\.matrixAddresses\.indexOf\(leg\.from\)/);
  assert.match(preview, /toIndex:\s*plan\.audit\.matrixAddresses\.indexOf\(leg\.to\)/);
  assert.doesNotMatch(preview, /matrixAddresses\s*:/);
});

test("horizon-audit publicerer rejectedTasks med task-ID og effektive minutter uden null-identitet", async () => {
  const preview = await source("lib/subscription-preview-calendar.ts");
  assert.match(preview, /rejectedTasks:\s*item\.rejectedTasks/);
  assert.doesNotMatch(preview, /sourceTaskId:\s*item\.job\.previewSegment\?\.sourceTaskId\s*\?\?\s*null/);
});

test("horizon-audit binder hvert uge-unplanned segment til source task og segmentminutter", async () => {
  const preview = await source("lib/subscription-preview-calendar.ts");
  assert.match(preview, /unplanned:\s*plan\.unplanned\.map\(auditUnplannedSegment\)/);
  assert.match(preview, /function auditUnplannedSegment/);
  assert.match(preview, /if \(!segment\) throw new Error\("calendar2_audit_unplanned_missing_source_task"\)/);
  assert.match(preview, /sourceTaskId:\s*segment\.sourceTaskId/);
  assert.match(preview, /segmentMinutes:\s*segment\.minutes/);
  assert.doesNotMatch(preview, /sourceTaskId:\s*job\.previewSegment\?\.sourceTaskId\s*\?\?\s*null/);
});

test("route audit publicerer komplet privacy-safe matrixmapping og kanonisk binding", async () => {
  const preview = await source("lib/subscription-preview-calendar.ts");
  const types = await source("lib/calendar.ts");
  for (const marker of ["matrixPoints", "matrixHash", "matrixVersion", "matrixProvider", "matrixCapturedAt", "matrixDurations"]) {
    assert.match(preview, new RegExp(marker));
    assert.match(types, new RegExp(marker));
  }
  assert.match(types, /stableRef:\s*string/);
  assert.match(types, /stableRefs:\s*string\[\]/);
  assert.match(preview, /stableRefs/);
  assert.match(types, /kind:\s*"employee_home"\s*\|\s*"job"/);
  assert.doesNotMatch(preview, /matrixAddresses\s*:/);
  assert.doesNotMatch(preview, /process\.env|apiKey|secret/i);
});
