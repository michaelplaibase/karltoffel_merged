import assert from "node:assert/strict";
import test from "node:test";
import { facebookLeadSmsMessage, isFacebookLeadSource } from "../lib/facebook-lead-contact";

 test("Facebook lead kilder genkendes uden hensyn til store bogstaver eller whitespace", () => {
  assert.equal(isFacebookLeadSource(" facebook "), true);
  assert.equal(isFacebookLeadSource("Meta"), true);
  assert.equal(isFacebookLeadSource("facebook-lead-ads"), true);
  assert.equal(isFacebookLeadSource("Facebook Lead Form"), true);
  assert.equal(isFacebookLeadSource("website"), false);
  assert.equal(isFacebookLeadSource("sociale medier"), false);
});

test("SMS-kladde har den aftalte vinduesvaskforespørgsel og afsender", () => {
  const message = facebookLeadSmsMessage("Katrine");
  assert.match(message, /^Hej Katrine,/);
  assert.match(message, /vinduer og døre/);
  assert.match(message, /4\., 6\., 8\. eller 12\. uge/);
  assert.match(message, /3\. eller 6\. måned/);
  assert.match(message, /Mvh Thomas\nwww\.karltoffel\.dk$/);
});

test("SMS-navn kan ikke injicere ekstra linjer og er begrænset i længden", () => {
  const message = facebookLeadSmsMessage("Ada\nMvh Kriminel" + "x".repeat(120));
  assert.match(message, /^Hej Ada Mvh Kriminelx{64},/);
  assert.equal(message.split("\n").length, 4);
});

test("quick-action UI bruger mail/telefonen kun til eksplicitte knapper; ingen SMS API-afsendelse", async () => {
  const { readFile } = await import("node:fs/promises");
  const root = new URL("../", import.meta.url);
  const page = await readFile(new URL("app/leads/page.tsx", root), "utf8");
  const button = await readFile(new URL("components/CopyLeadSmsButton.tsx", root), "utf8");
  assert.match(page, /isFacebookLead && phoneHref/);
  assert.match(page, /href=\{phoneHref\}>Ring/);
  assert.match(button, /navigator\.clipboard\.writeText\(message\)/);
  assert.doesNotMatch(button, /fetch\(|sendSms|sendEmail|sendEmail\(/);
  assert.match(page, /<td>\{l\.source\}<\/td>/);
});
