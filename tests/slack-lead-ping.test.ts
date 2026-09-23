// Unit-tests for lib/slack-lead-ping.ts (slack-ping med retry + udfald) og de
// additive slackStatus/-Error/-PostedAt-felter i tilbudsmotor-pricing.
//   node --import tsx --test tests/slack-lead-ping.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { pingSlack, type SlackResult } from "@/lib/slack-lead-ping";
import { parseLeadPayload, serializeLeadPayload, type LeadPayload } from "@/lib/tilbudsmotor-pricing";
import type { LeadLike } from "@/lib/slack-lead";

const lead: LeadLike = {
  id: 41, name: "Maria Bekker Larsen", email: "maria@example.dk",
  phone: "12345678", address: "Hovedgaden 1, 8700", message: null,
};

const payload = serializeLeadPayload({
  kundetype: "privat", betaling: "abonnement", services: [
    { id: "haek", navn: "Hækklipning", wm: null, qty: 100, enhed: "m hæk", freq: 1, pris: 10 },
  ],
  rabatkode: null, rabatOk: false, rabatPct: null, tilbudSendtAt: null,
});

test("posted: postMessage ok → status posted, og payload bærer slackStatus=posted", async () => {
  const post: (i: { text: string; blocks?: unknown[] }) => Promise<SlackResult> = async () => ({ ok: true, ts: "123.456", channel: "C0" });
  const o = await pingSlack(lead, payload, undefined, post);
  assert.equal(o.status, "posted");
  assert.equal(o.error, undefined);
  const p = parseLeadPayload(o.payload);
  assert.equal(p.slackStatus, "posted");
  assert.ok(p.slackPostedAt);
  // Kernedata bevares gennem round-trippen.
  assert.equal(p.services.length, 1);
  assert.equal(p.services[0].qty, 100);
});

test("simulated: dry-run uden token → status simulated, payload uændret", async () => {
  const post: (i: { text: string; blocks?: unknown[] }) => Promise<SlackResult> = async () => ({ ok: true, simulated: true });
  const o = await pingSlack(lead, payload, undefined, post);
  assert.equal(o.status, "simulated");
  assert.equal(o.payload, payload);
});

test("retry: én transient fejl → genkørslen lykkes → posted (to forsøg)", async () => {
  let calls = 0;
  const post: (i: { text: string; blocks?: unknown[] }) => Promise<SlackResult> = async () => {
    calls += 1;
    return calls === 1 ? { ok: false, error: "rate_limited" } : { ok: true, ts: "1.1" };
  };
  const o = await pingSlack(lead, payload, undefined, post);
  assert.equal(calls, 2);
  assert.equal(o.status, "posted");
});

test("failed: to fejl → status failed, error + payload bærer slackStatus=failed/slackError", async () => {
  const post: (i: { text: string; blocks?: unknown[] }) => Promise<SlackResult> = async () => ({ ok: false, error: "not_in_channel" });
  const o = await pingSlack(lead, payload, undefined, post);
  assert.equal(o.status, "failed");
  assert.equal(o.error, "not_in_channel");
  const p = parseLeadPayload(o.payload);
  assert.equal(p.slackStatus, "failed");
  assert.equal(p.slackError, "not_in_channel");
  assert.ok(p.slackPostedAt);
});

test("exception: post kaster → status failed, fejl fanget", async () => {
  const post: (i: { text: string; blocks?: unknown[] }) => Promise<SlackResult> = async () => { throw new Error("nettet døde"); };
  const o = await pingSlack(lead, payload, undefined, post);
  assert.equal(o.status, "failed");
  assert.equal(o.error, "nettet døde");
  assert.equal(parseLeadPayload(o.payload).slackError, "nettet døde");
});

test("tomt payload (venteliste-lead uden services): ping fejler IKKE, blocks kan bygges", async () => {
  let built = 0;
  const post: (i: { text: string; blocks?: unknown[] }) => Promise<SlackResult> = async (i) => {
    built += 1;
    assert.ok(Array.isArray(i.blocks) && i.blocks.length > 0, "blocks bygges for tomt lead");
    return { ok: true, ts: "2.2" };
  };
  const o = await pingSlack(lead, null, undefined, post);   // venteliste: payload = null
  assert.equal(o.status, "posted");
  assert.equal(built, 1);
  assert.equal(parseLeadPayload(o.payload).slackStatus, "posted");
});

test("round-trip: serialize→parse bevarer slackStatus/slackError/slackPostedAt", () => {
  const withSlack: LeadPayload = {
    kundetype: null, betaling: null, services: [],
    rabatkode: null, rabatOk: false, rabatPct: null, tilbudSendtAt: null,
    slackStatus: "failed", slackError: "channel_not_found", slackPostedAt: "2026-09-21T08:00:00.000Z",
  };
  const round = parseLeadPayload(serializeLeadPayload(withSlack));
  assert.equal(round.slackStatus, "failed");
  assert.equal(round.slackError, "channel_not_found");
  assert.equal(round.slackPostedAt, "2026-09-21T08:00:00.000Z");
});