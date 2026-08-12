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

test("read-only viser ingen mutationer, kontekstmenuer eller redigeringslinks", async () => {
  const component = await source("components/TeamCalendarClient.tsx");
  assert.match(component, /onClick=\{readOnly \? undefined :/);
  assert.match(component, /\{!readOnly && menu &&/);
  assert.match(component, /\{!readOnly && confirmDel &&/);
  assert.match(component, /readOnly \? "default" : "pointer"/);
  assert.doesNotMatch(await source("app/calendar-2/page.tsx"), /setOrderLock|moveOrderWeeks|replanWeek|deleteOrder|\/orders\/|\/subscriptions\//);
});
