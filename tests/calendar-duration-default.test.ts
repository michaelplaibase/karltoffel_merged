import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { effectiveCalendarTaskDuration } from "../lib/calendar-duration";

test("kun manglende, null og nul varighed får 60 minutter; usikre værdier maskeres ikke", () => {
  assert.equal(effectiveCalendarTaskDuration(undefined), 60);
  assert.equal(effectiveCalendarTaskDuration(null), 60);
  assert.equal(effectiveCalendarTaskDuration(0), 60);
  assert.equal(effectiveCalendarTaskDuration(30), 30);
  assert.equal(effectiveCalendarTaskDuration(-1), -1);
  assert.ok(Number.isNaN(effectiveCalendarTaskDuration(Number.NaN)));
  assert.equal(effectiveCalendarTaskDuration(Number.POSITIVE_INFINITY), Number.POSITIVE_INFINITY);
});

test("aktiv kalender bruger 60 minutter pr. ordreopgave uden positiv tid", async () => {
  const queries = await readFile(new URL("../lib/queries.ts", import.meta.url), "utf8");
  assert.match(queries, /import \{ effectiveCalendarTaskDuration \} from "\.\/calendar-duration"/);
  assert.ok((queries.match(/effectiveCalendarTaskDuration\(t\.durationMin\)/g) ?? []).length >= 2);
});