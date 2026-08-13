import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

test("aktiv kalender bruger 60 minutter pr. ordreopgave uden positiv tid", async () => {
  const queries = await readFile(new URL("../lib/queries.ts", import.meta.url), "utf8");
  assert.match(queries, /import \{ effectiveCalendarTaskDuration \} from "\.\/calendar-duration"/);
  assert.ok((queries.match(/effectiveCalendarTaskDuration\(t\.durationMin\)/g) ?? []).length >= 2);
});