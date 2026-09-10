// MOMS-hjælpere — ÉN KILDE TIL SANDHED for moms-beregning i Karltoffel CRM.
//
// Baggrund (moms-planen, trin 1): priser gemmes I DAG inkl. moms overalt
// (TaskLine.price, Order, Subscription, FixedPrice, service-katalog) som
// HELTAL I KRONER. Indtil datamigreringen/cutover (IKKE del af dette trin)
// er 'incl' derfor default priceBasis; cutover skal senere blot skifte
// ét flag ('excl') — al logik går gennem computeInvoiceTotals.
//
// ─── Afrundingsregel (dokumenteret) ──────────────────────────────────────────
// Alle beregninger sker i ØRE (integer). Brøkdele afrundes ALTID
// round-half-up (0,5 øre og opefter rundes op; "banker's rounding" bruges
// IKKE): roundHalfUp(2,5) = 3, roundHalfUp(2,4) = 2, roundHalfUp(-2,5) = -3.
// Moms beregnes på den SAMLEDE ekskl.-moms-sum (total-niveau), ikke pr.
// linje — så linjerækkefølge aldrig kan ændre totalen, og roundtrip
// excl→incl→excl er stabil for hele kurven.
import { MOMS } from "./data";

export const VAT_RATE = MOMS; // 0,25 — dansk moms

/** Round-half-up til nærmeste heltal (i øre). Negativer afrundes væk fra nul
 *  (symmetrisk half-up): -2,5 → -3. */
export function roundHalfUp(x: number): number {
  if (!Number.isFinite(x)) return NaN;
  return Math.sign(x) * Math.floor(Math.abs(x) + 0.5);
}

/** Ekskl.-moms øre → inkl.-moms øre (integer). */
export function exclToIncl(oereExcl: number): number {
  return roundHalfUp(oereExcl * (1 + VAT_RATE));
}

/** Inkl.-moms øre → ekskl.-moms øre (integer, round-half-up). */
export function inclToExcl(oereIncl: number): number {
  return roundHalfUp(oereIncl / (1 + VAT_RATE));
}

/** Formater et inkl.-moms-beløb (i ØRE) som dual pris-tekst:
 *  "1.000 kr. (800 kr. u. moms)". Bruges overalt hvor priser vises. */
export function formatPriceDual(oereIncl: number): string {
  const kr = (oere: number) => (oere / 100).toLocaleString("da-DK");
  return `${kr(oereIncl)} kr. (${kr(inclToExcl(oereIncl))} kr. u. moms)`;
}

export type VatLine = { /** pris i KRONER som gemt (TaskLine.price-konvention). */ price: number };
export type VatTotals = { exclTotal: number; vatTotal: number; inclTotal: number };
export type PriceBasis = "incl" | "excl";

/** Kastes når en linje HAR en pris, men momsen ikke kan beregnes — faktura-
 *  pipelinen (lib/dinero.ts, lib/business-invoicing.ts) skal ALDRIG oprette en
 *  faktura med en linje uden korrekt moms (fail-closed). */
export class VatComputationError extends Error {
  lineIndex: number;
  constructor(message: string, lineIndex: number) {
    super(message);
    this.name = "VatComputationError";
    this.lineIndex = lineIndex;
  }
}

/**
 * Beregn faktura-totaler for et sæt linjer. Retur: { exclTotal, vatTotal,
 * inclTotal } — alle i HELE ØRE (integer). Linjepriser angives i KRONER som
 * gemt (TaskLine.price; kan være decimaler efter fremtidig cutover) og
 * konverteres til øre med round-half-up.
 *
 * priceBasis ('incl' | 'excl') fortæller hvordan linjepriserne skal LÆSES:
 * - 'incl' (default indtil datamigrering): pris er inkl. moms. exclTotal =
 *   roundHalfUp(sum / 1,25); vatTotal = sum − exclTotal; inclTotal = sum
 *   (inkl.-totalen bevares eksakt — ingen reel differens mod Dinero).
 * - 'excl' (efter cutover): pris er ekskl. moms. vatTotal =
 *   roundHalfUp(sum × 0,25) på total-niveau; inclTotal = sum + vatTotal.
 *
 * Fail-closed: kaster VatComputationError hvis en linje har en pris der ikke
 * kan give en gyldig moms-beregning (mangler, NaN/Infinity, negativ) —
 * kaldere i faktureringspipelinen skal afvikle/skippe med fejl i rapporten,
 * ALDRIG oprette en faktura uden moms.
 */
export function computeInvoiceTotals(lines: VatLine[], priceBasis: PriceBasis = "incl"): VatTotals {
  if (!Array.isArray(lines)) {
    throw new VatComputationError("computeInvoiceTotals: lines skal være et array", -1);
  }
  let sumOere = 0;
  for (let i = 0; i < lines.length; i++) {
    const p = lines[i]?.price;
    if (p === null || p === undefined) {
      throw new VatComputationError(`Linje ${i + 1} har en pris, men moms kan ikke beregnes (pris mangler).`, i);
    }
    const n = typeof p === "number" ? p : Number(p);
    if (!Number.isFinite(n)) {
      throw new VatComputationError(`Linje ${i + 1} har en pris, men moms kan ikke beregnes (ugyldigt tal).`, i);
    }
    if (n < 0) {
      throw new VatComputationError(`Linje ${i + 1} har negativ pris — moms kan ikke beregnes.`, i);
    }
    sumOere += roundHalfUp(n * 100);
  }
  if (priceBasis === "excl") {
    const exclTotal = sumOere;
    const vatTotal = roundHalfUp(exclTotal * VAT_RATE);
    return { exclTotal, vatTotal, inclTotal: exclTotal + vatTotal };
  }
  // 'incl' (dagens datamodell): inkl.-summen er den gemte sandhed.
  const inclTotal = sumOere;
  const exclTotal = inclToExcl(inclTotal);
  return { exclTotal, vatTotal: inclTotal - exclTotal, inclTotal };
}