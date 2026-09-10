// Moms-planen trin 3: integrationstests for moms-garantien i fakturerings-
// pipelinen (lib/dinero.ts issueInvoiceForOrder + lib/business-invoicing.ts
// runBatchForPeriod). Pipelinerne kræver DB + Dinero-API ved fuld kørsel, så
// den ikke-DB-del hærdes som ren logik (computeInvoiceTotals) og resten som
// struct-tests (repoets etablerede mønster, se tests/fix-ordrer.test.ts):
// kildekoden skal BEVISE garanterne — fail-closed, idempotens, moms altid
// beregnet server-side via lib/vat.ts.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { computeInvoiceTotals, VatComputationError } from "../lib/vat";

const root = new URL("../", import.meta.url);
const source = (path: string) => readFile(new URL(path, root), "utf8");

// ─── Ren integration: totaler pr. faktura ─────────────────────────────────────

test("faktura med moms: linjer → korrekte totaler i hele øre", () => {
  // Samme shape som issueInvoiceForOrder giver videre (order.tasks → {price}).
  const lines = [{ price: 326 }, { price: 674 }];
  const t = computeInvoiceTotals(lines);
  assert.equal(t.inclTotal, 100000);
  assert.equal(t.exclTotal, 80000);
  assert.equal(t.vatTotal, 20000);
});

test("afvisning uden moms: én uberegnelig linje kaster (fail-closed), selv blandt gyldige", () => {
  assert.throws(
    () => computeInvoiceTotals([{ price: 100 }, { price: null as unknown as number }, { price: 200 }]),
    VatComputationError,
  );
});

test("afrunding: batch af mange linjer runder kun på totalen, aldrig pr. linje-akku-drift", () => {
  const lines = Array.from({ length: 7 }, () => ({ price: 14.29 })); // 7 × 33,345 øre incl? — excl-basis
  const t = computeInvoiceTotals(lines, "excl"); // 100,03 kr ekskl. → 10003 øre
  assert.equal(t.exclTotal, 10003);
  assert.equal(t.vatTotal, 2501); // roundHalfUp(10003 × 0,25 = 2500,75) = 2501
  assert.equal(t.inclTotal, 12504);
  assert.equal(t.exclTotal + t.vatTotal, t.inclTotal);
});

// ─── lib/dinero.ts (privat / pr.-ordre-flowet) ────────────────────────────────

test("issueInvoiceForOrder beregner moms server-side via computeInvoiceTotals FØR fakturaoprettelse", async () => {
  const d = await source("lib/dinero.ts");
  // Import af den ene kilde til sandhed.
  assert.match(d, /import \{ computeInvoiceTotals \} from "\.\/vat"/);
  // Totalerne beregnes ud fra ordrens opgavelinjer.
  assert.match(d, /computeInvoiceTotals\(order\.tasks\.map\(\(t\) => \(\{ price: t\.price \}\)\)\)/);
  // sumInclVat (Dinero-momskontrolens sammenligningsgrundlag) kommer fra totals.
  assert.match(d, /const sumInclVat = totals\.inclTotal \/ 100/);
});

test("issueInvoiceForOrder er fail-closed: moms-fejl => Failed + dineroError + skip (ALDRIG faktura)", async () => {
  const d = await source("lib/dinero.ts");
  // try/catch omkring totals-beregningen ligger FØR loadActiveConfig/dry-run.
  const idxCompute = d.indexOf("computeInvoiceTotals(order.tasks");
  const idxCfg = d.indexOf("const cfg = await loadActiveConfig();", idxCompute);
  assert.ok(idxCfg > idxCompute, "moms-beregning skal ske før cfg/dry-run-gaten");
  const block = d.slice(idxCompute, idxCfg);
  assert.match(block, /catch \(vatErr\)/);
  assert.match(block, /dineroInvoiceStatus: "Failed"/);
  assert.match(block, /dineroError: msg/);
  assert.match(block, /ok: false/);
  // Fejlen logges (rapport) med tag.
  assert.match(d, /\[dinero:moms-garanti\]/);
});

// ─── lib/business-invoicing.ts (erhverv-samlefaktura) ─────────────────────────

test("runBatchForPeriod beregner moms via computeInvoiceTotals pr. kontakt før Dinero-kald", async () => {
  const b = await source("lib/business-invoicing.ts");
  assert.match(b, /import \{ computeInvoiceTotals \} from "\.\/vat"/);
  assert.match(b, /computeInvoiceTotals\(/);
  assert.match(b, /contactOrders\.flatMap\(\(o\) => o\.tasks\.map\(\(t\) => \(\{ price: t\.price \}\)\)\)/);
  assert.match(b, /const sumInclVat = totals\.inclTotal \/ 100/);
});

test("batch er fail-closed: moms-fejl => result.failed + fejl i rapport + ordrer markeret, batchen skipper", async () => {
  const b = await source("lib/business-invoicing.ts");
  const idx = b.indexOf("MOMS-GARANTI");
  const block = b.slice(idx, idx + 2600);
  assert.match(block, /result\.failed\+\+/);
  assert.match(block, /result\.errors\.push\(\{ contactId, error: msg \}\)/);
  assert.match(block, /businessBatchError: msg/);
  assert.match(block, /businessBatchInvoiceStatus: "Failed"/);
  assert.match(block, /continue;/);
  assert.match(b, /business-invoicing:moms-garanti/);
});

// ─── Idempotens ved batch-retry (samme kunde+periode må IKKE dobbeltfakturere) ─

test("batch-idempotens: begge dobbeltfakturerings-værn er i orden i where-filteret", async () => {
  const b = await source("lib/business-invoicing.ts");
  // Værn 1: ordren må ikke allerede være i en batch (genkørsel/crash-recovery).
  assert.match(b, /businessBatchInvoiceGuid: null/);
  // Værn 2: en ordre med pr.-ordre-faktura må aldrig også på samlefakturaen.
  assert.match(b, /dineroInvoiceGuid: null/);
});

test("batch-idempotens: genkørsel adopterer eksisterende draft via periodenøglen", async () => {
  const b = await source("lib/business-invoicing.ts");
  // Stabil nøgle pr. kunde+periode.
  assert.match(b, /karltoffel-batch-\$\{contactId\}-\$\{periodStartISO\}/);
  // findInvoiceByExternalRef bruges til at genfinde kladden FØR en ny oprettes.
  assert.match(b, /const existing = await findInvoiceByExternalRef\(access, org, ref\)/);
  assert.match(b, /let guid = existing\?\.guid \?\? null/);
  // ExternalReference patches på NY kladden (ellers matcher genkørslen aldrig).
  assert.match(b, /patchExternalReference\(access, org, guid, timeStamp, ref\)/);
});

test("batch-idempotens: guid persisteres på ALLE ordrer i batchen FØR bogføring", async () => {
  const b = await source("lib/business-invoicing.ts");
  const idxPersist = b.indexOf("businessBatchInvoiceGuid: guid");
  assert.ok(idxPersist > -1);
  const idxBook = b.indexOf("bookInvoice(access, org, guid", idxPersist);
  assert.ok(idxBook > idxPersist, "guid skal persisteres før book (crash-sikkert)");
});

test("momskontrol mod Dinero er bevaret: afvigelse > 1 kr stopper bogføring (fail-closed)", async () => {
  const b = await source("lib/business-invoicing.ts");
  assert.match(b, /Momskontrol umulig: Dinero returnerede ingen total/);
  assert.match(b, /Momskontrol fejlede: Dinero-total \$\{detail\.totalInclVat\} kr ≠ ordrernes sum \$\{sumInclVat\} kr/);
  const d = await source("lib/dinero.ts");
  assert.match(d, /Momskontrol fejlede: Dinero-total \$\{detail\.totalInclVat\} kr ≠ ordrens \$\{sumInclVat\} kr/);
});

// ─── priceBasis-klargøring til cutover (skal senere kun være ét flag) ─────────

test("computeInvoiceTotals understøtter priceBasis 'incl' | 'excl' (cutover = ét flag)", async () => {
  const v = await source("lib/vat.ts");
  assert.match(v, /priceBasis: PriceBasis = "incl"/);
  assert.match(v, /"incl" \| "excl"/);
});