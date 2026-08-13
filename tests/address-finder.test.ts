import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ADDRESS_FINDER_DEBOUNCE_MS, ADDRESS_FINDER_ENDPOINT, addressForContactFields, parseAdressevaelgerHit } from "../lib/address-finder";

test("shared finder bevarer quote engine debounce bag same-origin endpoint",()=>{
  assert.equal(ADDRESS_FINDER_DEBOUNCE_MS,250);
  assert.equal(ADDRESS_FINDER_ENDPOINT,"/api/address-search?text=");
});
test("Grønhøjvej fixture bliver kanonisk uden schemaændring",()=>{
  const hit=parseAdressevaelgerHit({type:"husnummer",titel:"Grønhøjvej 5, 8700 Horsens",id:"sanitized",x:9.8,y:55.8})!;
  assert.deepEqual(addressForContactFields(hit),{street:"Grønhøjvej 5",city:"8700 Horsens"});
  assert.deepEqual(hit.coordinate,[55.8,9.8]);
});

test("produktionens adressevælger-shape med supplerende bynavn bliver kanonisk",()=>{
  const hit=parseAdressevaelgerHit({
    type:"husnummer",
    id:"0a3f508f-a293-32b8-e044-0003ba298018",
    titel:"Grønhøjvej 5, Hatting, 8700 Horsens",
    vejnavn:"Grønhøjvej",
    husnummer:"5",
  } as Parameters<typeof parseAdressevaelgerHit>[0] & { vejnavn: string; husnummer: string })!;
  assert.ok(hit);
  assert.equal(hit.label,"Grønhøjvej 5, Hatting, 8700 Horsens");
  assert.deepEqual(addressForContactFields(hit),{street:"Grønhøjvej 5",city:"8700 Horsens"});
});

test("Calendar2 har et bounded GET-only horizon-audit uden write-kald",async()=>{
  const [route,preview]=await Promise.all([
    readFile(new URL("../app/api/calendar-2/audit/route.ts",import.meta.url),"utf8"),
    readFile(new URL("../lib/subscription-preview-calendar.ts",import.meta.url),"utf8"),
  ]);
  assert.match(route,/export async function GET/);
  assert.match(route,/getCalendar2HorizonAudit/);
  assert.match(route,/Cache-Control.*no-store/);
  assert.doesNotMatch(route,/export async function (POST|PUT|PATCH|DELETE)|\.create\(|\.update\(|\.delete\(/);
  assert.match(preview,/export async function getCalendar2HorizonAudit/);
});

test("CRM bruger same-origin GET-proxy uden provider-token i klientbundlet",async()=>{
  const [finder,route]=await Promise.all([
    readFile(new URL("../lib/address-finder.ts",import.meta.url),"utf8"),
    readFile(new URL("../app/api/address-search/route.ts",import.meta.url),"utf8"),
  ]);
  assert.equal(ADDRESS_FINDER_ENDPOINT,"/api/address-search?text=");
  assert.doesNotMatch(finder,/adressevaelger123|token=/);
  assert.match(route,/export async function GET/);
  assert.doesNotMatch(route,/export async function (POST|PUT|PATCH|DELETE)|\.create\(|\.update\(|\.delete\(/);
  assert.match(route,/cache:\s*["']no-store["']/);
});
