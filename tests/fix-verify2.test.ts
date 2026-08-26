import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const source = (path: string) => readFile(new URL(path, root), "utf8");

// Anden adversarielle verifikationsrunde: kildetests der låser rettelserne fast.

test("godkendelse af afventende abonnement normaliserer en reelt passeret startuge", async () => {
  const actions = await source("app/actions/subscriptions.ts");
  assert.match(actions, /const stored = parseWeekLabel\(sub\.startWeek\)/);
  assert.match(actions, /const weeksUntil = \(\(stored - currentWeek\) \+ 52\) % 52/);
  assert.match(actions, /if \(weeksUntil > 26\)/);
  // Normaliseringen SKAL ske før genereringen — ellers fortolkes ugen som næste år.
  const body = actions.slice(actions.indexOf("export async function approveSubscription"));
  assert.ok(body.indexOf("weeksUntil") < body.indexOf("await generateForSubscriptionId"));
});

test("dinero-værnet undtager påbegyndte pr.-ordre-kladder og kontant betaling", async () => {
  const dinero = await source("lib/dinero.ts");
  assert.match(dinero, /const hasPerOrderDraft = order\.dineroInvoiceGuid != null/);
  assert.match(dinero, /isCompany && !perOrderBooked && !hasPerOrderDraft && decision !== D_SEND_CASH/);
});

test("Samlefaktura-status har en dansk label på ordresiden", async () => {
  const page = await source("app/orders/[id]/page.tsx");
  assert.match(page, /Samlefaktura: \{ label: "Faktureres på månedlig samlefaktura \(erhverv\)"/);
});

test("påmindelses-retry fanger fejlede mails med klokkeslæt før cron-kørslen", async () => {
  const route = await source("app/api/reminders/route.ts");
  assert.match(route, /const startFloor = new Date\(Math\.max\(todayStart\.getTime\(\), now\.getTime\(\) - 6 \* 3600 \* 1000\)\)/);
  assert.match(route, /startAt: \{ gte: startFloor, lt: end \}/);
});

test("timesheet-actions afviser deaktiverede brugere (getSessionUser, ikke kun token)", async () => {
  const actions = await source("app/actions/timesheet.ts");
  assert.doesNotMatch(actions, /await requireSession\(\)/);
  assert.equal((actions.match(/await getSessionUser\(\)/g) ?? []).length, 4, "alle fire actions guarder med getSessionUser");
});

test("settings-felter kan bære stabile nøgler, og de forskudte felter har fået dem", async () => {
  const cfg = await source("lib/settings-config.ts");
  assert.match(cfg, /key\?: string;/);
  assert.match(cfg, /key: "s0f0", l: "Luk automatisk kalenderen på helligdage"/);
  assert.match(cfg, /key: "s0f1", l: "Benyt fleksibel arbejdstid"/);
  assert.match(cfg, /key: `emp:\$\{navn\}:koersel`/);
  assert.match(cfg, /key: `emp:\$\{navn\}:kategorier`/);
  const form = await source("components/SettingsForm.tsx");
  assert.match(form, /const key = f\.key \?\? `s\$\{si\}f\$\{fi\}`/);
});
