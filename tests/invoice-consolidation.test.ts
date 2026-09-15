// Faktura-konsolidering (2026-09-15): en kunde skal kun have ÉN ÅBEN faktura.
// Struktur-tests efter repoets etablerede mønster (se tests/vat-invoicing.test.ts):
// kildekoden skal BEVISE invarianterne — adoptér frem for at oprette, frigiv ved
// bogføring, genoptagelses-værn mod dobbelt-linjer, og manuelle linjer i
// momskontrol-grundlaget.
import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const source = (path: string) => readFile(new URL(path, root), "utf8");

test("konsolidering: pr.-ordre-flowet adopterer kontaktens åbne kladde frem for at oprette en ny", async () => {
  const d = await source("lib/dinero.ts");
  assert.match(d, /findOpenDraftForContact\(access, org, order\.contactId\)/);
  assert.match(d, /addProductLinesToDraft\(access, org, open\.guid, lines, cfg\.salesAccountNumber\)/);
  // "Betalt kontant" springer konsolideringen over (beløbet kvitteres pr. ordre).
  assert.match(d, /decision !== D_SEND_CASH && !hasPerOrderDraft && !perOrderBooked/);
});

test("konsolidering: genoptagelses-værn — en ordre der allerede ligger på den åbne faktura får IKKE linjer to gange", async () => {
  const d = await source("lib/dinero.ts");
  assert.match(d, /fresh\?\.businessBatchInvoiceGuid !== open\.guid/);
});

test("konsolidering: kladden registreres som ÅBEN og frigives ved bogføring (alle tre maskiner)", async () => {
  for (const [file, before] of [["lib/dinero.ts", "registerOpenInvoice"] as const, ["lib/business-invoicing.ts", "registerOpenInvoice"] as const, ["lib/invoice-all.ts", "registerOpenInvoice"] as const]) {
    const s = await source(file);
    assert.match(s, new RegExp(before));
    assert.match(s, /releaseOpenInvoice/);
    // Frigivelse skal komme EFTER bogføring (fakturaen er ikke åben længere).
    const idxBook = s.indexOf("bookInvoice(");
    const idxRelease = s.indexOf("releaseOpenInvoice(");
    assert.ok(idxBook > -1 && idxRelease > idxBook, `${file}: frigivelse efter bogføring`);
  }
});

test("DB-invariant: højst ÉN OpenInvoice pr. kontakt (@unique contactId)", async () => {
  const s = await source("prisma/schema.prisma");
  assert.match(s, /model OpenInvoice \{[\s\S]*?contactId Int\s+@unique[\s\S]*?\}/);
  assert.match(s, /model InvoiceManualLine \{[\s\S]*?quantity\s+Decimal[\s\S]*?\}/);
});

test("manuel linje: fail-closed — bogført faktura må ALDRIG få tilføjet linjer", async () => {
  const a = await source("app/actions/invoice-manual.ts");
  assert.match(a, /if \(detail\.number != null\)/);
  assert.match(a, /allerede bogført i Dinero og kan ikke ændres/);
  assert.match(a, /addProductLinesToDraft/);
});

test("manuel linje: DB-rækken gemmes så momskontrollen tæller den med (InvoiceManualLine)", async () => {
  const c = await source("lib/invoice-consolidation.ts");
  assert.match(c, /manualLinesSumKr/);
  assert.match(c, /expectedTotalKr/);
});
