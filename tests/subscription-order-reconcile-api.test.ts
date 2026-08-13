import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const source = (path: string) => readFile(new URL(path, root), "utf8");

test("one-shot apply is admin-only, hash-gated, transactional and journaled", async () => {
  const route = await source("app/api/subscription-order-reconcile/route.ts");
  assert.match(route, /getSessionUser/);
  assert.match(route, /isAdmin/);
  assert.match(route, /snapshotHash/);
  assert.match(route, /APPLY_ALL_FUTURE_SUBSCRIPTION_ORDERS/);
  assert.match(route, /Serializable/);
  assert.match(route, /orderReconciliationRun\.create/);
  assert.match(route, /orderReconciliationRun\.update/);
  assert.doesNotMatch(route, /export async function GET/);
});

test("apply preserves placed timestamps and order ids while replacing authoritative content", async () => {
  const route = await source("app/api/subscription-order-reconcile/route.ts");
  assert.doesNotMatch(route, /plannedAt:\s*target/);
  assert.doesNotMatch(route, /startAt:\s*target/);
  assert.match(route, /sourceWeek:\s*new Date/);
  assert.match(route, /taskLine\.deleteMany/);
  assert.match(route, /taskLine\.createMany/);
});
