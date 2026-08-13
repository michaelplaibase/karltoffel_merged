import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = readFile(new URL("../lib/recurrence.ts", import.meta.url), "utf8");

test("future pending regeneration includes locked imported rows so stale recurrence cannot survive", async () => {
  const block = (await source).slice((await source).indexOf("export async function regenerateFutureOrders"));
  assert.match(block, /status:\s*["']Afventer levering["']/);
  assert.match(block, /plannedAt:\s*\{\s*gte:\s*nextMonday/);
  assert.doesNotMatch(block, /lockedFully:\s*false/);
  assert.doesNotMatch(block, /skippedLocked/);
  assert.match(block, /taskLine\.deleteMany/);
  assert.match(block, /order\.deleteMany/);
  assert.match(block, /generateForSubscriptionId/);
});