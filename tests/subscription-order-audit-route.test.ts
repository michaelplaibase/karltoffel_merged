import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const source = (path: string) => readFile(new URL(path, root), "utf8");

test("global subscription-order audit is authenticated, GET-only and no-store", async () => {
  const route = await source("app/api/subscription-order-audit/route.ts");
  assert.match(route, /export async function GET/);
  assert.doesNotMatch(route, /export async function (POST|PUT|PATCH|DELETE)/);
  assert.match(route, /requireSession/);
  assert.match(route, /unauthorized/);
  assert.match(route, /Cache-Control["']:\s*["']no-store/);
});

test("audit reads authoritative subscriptions and future orders without writes", async () => {
  const audit = await source("lib/subscription-order-audit.ts");
  assert.match(audit, /prisma\.subscription\.findMany/);
  assert.match(audit, /prisma\.order\.findMany/);
  assert.match(audit, /prisma\.subscriptionWeekSkip\.findMany/);
  assert.match(audit, /sourceWeek/);
  assert.match(audit, /lockedFully/);
  assert.doesNotMatch(audit, /\.(create|update|delete|upsert|executeRaw|transaction)\(/);
});