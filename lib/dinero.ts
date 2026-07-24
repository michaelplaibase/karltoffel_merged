// Dinero (Visma) invoicing — raw fetch, no SDK (same deliberately dependency-free
// pattern as lib/email.ts / lib/gcal.ts). Node-only; never import from middleware
// or a client component.
//
// AUTH: a Dinero Personal API Client (client_credentials, machine-to-machine). The
// client id/secret live in the environment; there is NO browser consent, NO redirect
// URI, and NO refresh token — an access token is fetched on demand and cached in
// memory. The organization id is embedded in the client id (pcc_<orgId>_...).
//
// Dry-run by default: NOTHING is sent to api.dinero.dk / the token endpoint until
// DINERO_CLIENT_ID + DINERO_CLIENT_SECRET are set. DINERO_DRY_RUN=1 forces
// simulation even when configured — keep it "1" on preview/dev so a preview can
// never book a real invoice in the production org.
//
// ─── PROVENANCE / VERIFY BEFORE GO-LIVE ───────────────────────────────────────
// The Dinero REST shapes (endpoint VERSIONS, PascalCase field names, `fields`
// selectors, VAT semantics) AND the client_credentials token endpoint/scope were
// reconstructed from Dinero's docs + open-source clients; the live spec could not be
// fetched from this environment and Dinero has no sandbox. The token endpoint + scope
// are overridable via env (DINERO_TOKEN_URL / DINERO_SCOPE) precisely so they can be
// corrected without a code change once confirmed against the Dinero API-client page.
// Before flipping DINERO_DRY_RUN off in production, use "Test forbindelse" on
// /accounting and verify a full draft→book→send→pay cycle on the real org.
import { prisma } from "./db";
import type { DineroConnection } from "@prisma/client";

// ─── Endpoints (VERSIONS ARE PROVISIONAL — verify against the live OpenAPI) ────
const API_BASE = "https://api.dinero.dk";
const DEFAULT_TOKEN_URL = "https://connect.visma.com/connect/token";
const DEFAULT_SCOPE = "dineropublicapi:read dineropublicapi:write";
const V_ORGS = "v1";
const V_CONTACTS = "v1";
const V_INVOICES = "v1";
const FETCH_TIMEOUT_MS = 10_000;

// ─── The five "Betaling og fakturering" choices (MUST match CompleteOrderForm) ─
export const INVOICE_DECISIONS = [
  "Send faktura - ubetalt",
  "Send faktura - betalt kontant",
  "Send ikke faktura fra Fenster",
  "Opret fakturakladde",
  "Registrer på et senere tidspunkt",
] as const;
export type InvoiceDecision = (typeof INVOICE_DECISIONS)[number];
export function isInvoiceDecision(s: string): s is InvoiceDecision {
  return (INVOICE_DECISIONS as readonly string[]).includes(s);
}
const D_SEND_UNPAID: InvoiceDecision = "Send faktura - ubetalt";
const D_SEND_CASH: InvoiceDecision = "Send faktura - betalt kontant";
const D_NONE: InvoiceDecision = "Send ikke faktura fra Fenster";
const D_DRAFT: InvoiceDecision = "Opret fakturakladde";
const D_LATER: InvoiceDecision = "Registrer på et senere tidspunkt";

// ─── Config / dry-run detection ───────────────────────────────────────────────
export function envConfigured(): boolean {
  return Boolean(process.env.DINERO_CLIENT_ID?.trim() && process.env.DINERO_CLIENT_SECRET?.trim());
}
function dryRunForced(): boolean {
  return process.env.DINERO_DRY_RUN === "1";
}
/** The Dinero organization id: explicit env override, else parsed from the client
 *  id (pcc_<orgId>_...). Every resource path is scoped to it. */
export function resolveOrgId(): string | null {
  const explicit = process.env.DINERO_ORG_ID?.trim();
  if (explicit) return explicit;
  const m = (process.env.DINERO_CLIENT_ID ?? "").match(/^[a-z]+_(\d+)_/i);
  return m ? m[1] : null;
}

export async function currentCompanyId(): Promise<number> {
  const c = await prisma.company.findFirst({ select: { id: true } });
  return c?.id ?? 1;
}

type ActiveConfig = { orgId: string; salesAccountNumber: number; cashAccountNumber: number };
/** The config to use for real calls, or null when we must dry-run (env unconfigured,
 *  dry-run forced, or org id unresolvable). Account numbers come from the cached
 *  DineroConnection row if present, else the standard-chart defaults. */
async function loadActiveConfig(): Promise<ActiveConfig | null> {
  if (!envConfigured() || dryRunForced()) return null;
  const orgId = resolveOrgId();
  if (!orgId) return null;
  const conn = await prisma.dineroConnection.findFirst();
  return {
    orgId,
    salesAccountNumber: conn?.salesAccountNumber ?? 1000,
    cashAccountNumber: conn?.cashAccountNumber ?? 55040,
  };
}

// ─── Access token (client_credentials) with a small in-memory cache ───────────
// No refresh token, no rotation, no replay risk — we can fetch a fresh token
// whenever the cached one is near expiry. Cache is per serverless instance; that is
// fine (token requests are cheap and idempotent).
let tokenCache: { token: string; exp: number } | null = null;

async function getAccessToken(): Promise<string> {
  if (tokenCache && tokenCache.exp - Date.now() > 60_000) return tokenCache.token;
  const url = process.env.DINERO_TOKEN_URL?.trim() || DEFAULT_TOKEN_URL;
  const id = process.env.DINERO_CLIENT_ID ?? "";
  const secret = process.env.DINERO_CLIENT_SECRET ?? "";
  // Scope: default unless DINERO_SCOPE is set; empty or "none" omits it entirely
  // (Dinero's own server uses "read write"; Visma Connect uses "dineropublicapi:*").
  const scopeRaw = process.env.DINERO_SCOPE?.trim();
  const scope = scopeRaw == null ? DEFAULT_SCOPE : scopeRaw && scopeRaw.toLowerCase() !== "none" ? scopeRaw : "";
  // Client auth: Dinero's own auth server (authz.dinero.dk) wants an HTTP Basic
  // header; Visma Connect wants the credentials in the form body. Auto-detect by
  // host, overridable with DINERO_CLIENT_AUTH = "basic" | "body".
  const authStyle = process.env.DINERO_CLIENT_AUTH?.trim().toLowerCase() || (/authz\.dinero\.dk/i.test(url) ? "basic" : "body");
  const form = new URLSearchParams({ grant_type: "client_credentials" });
  if (scope) form.set("scope", scope);
  const headers: Record<string, string> = { "content-type": "application/x-www-form-urlencoded" };
  if (authStyle === "basic") {
    headers.Authorization = "Basic " + Buffer.from(`${id}:${secret}`).toString("base64");
  } else {
    form.set("client_id", id);
    form.set("client_secret", secret);
  }
  const res = await fetch(url, { method: "POST", headers, body: form.toString(), signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  const raw = await res.text().catch(() => "");
  if (!res.ok) throw new DineroApiError(res.status, `Token ${res.status}: ${raw.slice(0, 300)}`, raw);
  let data: { access_token?: string; expires_in?: number } = {};
  try { data = JSON.parse(raw); } catch { /* leave empty */ }
  if (!data.access_token) throw new Error("Token-svar uden access_token");
  tokenCache = { token: data.access_token, exp: Date.now() + (Math.max(60, data.expires_in ?? 3600) - 60) * 1000 };
  return data.access_token;
}

// ─── Low-level resource fetch + response helpers ──────────────────────────────
class DineroApiError extends Error {
  status: number;
  raw: string;
  constructor(status: number, message: string, raw: string) {
    super(message);
    this.status = status;
    this.raw = raw;
  }
}

async function dineroJson(
  method: string,
  url: string,
  access: string,
  body?: unknown,
): Promise<Record<string, unknown> | unknown[]> {
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${access}`,
      accept: "application/json",
      ...(body !== undefined ? { "content-type": "application/json" } : {}),
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new DineroApiError(res.status, `Dinero ${res.status}: ${detail}`.slice(0, 400), detail);
  }
  if (res.status === 204) return {};
  return (await res.json().catch(() => ({}))) as Record<string, unknown> | unknown[];
}

/** Case-insensitive property lookup — Dinero has shipped both PascalCase and
 *  camelCase responses; we read tolerantly. */
function ci(obj: unknown, key: string): unknown {
  if (!obj || typeof obj !== "object") return undefined;
  const o = obj as Record<string, unknown>;
  if (key in o) return o[key];
  const lk = key.toLowerCase();
  for (const k of Object.keys(o)) if (k.toLowerCase() === lk) return o[k];
  return undefined;
}
function numOr(v: unknown): number | null {
  if (v == null) return null; // JSON null must NOT coerce to 0 (Number(null) === 0)
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}
function strOr(v: unknown): string | null {
  return typeof v === "string" && v ? v : null;
}
function coll(data: Record<string, unknown> | unknown[]): unknown[] {
  return (Array.isArray(data) ? data : (ci(data, "Collection") as unknown[])) ?? [];
}

// ─── Small mapping helpers ────────────────────────────────────────────────────
function cphDate(now = new Date()): string {
  // en-CA formats as YYYY-MM-DD; Copenhagen wall-clock date (invoice date = today).
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Copenhagen",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
/** Contact.city stores "8660 Skanderborg" in one column — split the 4-digit zip. */
function splitZipCity(s: string | null): { zip: string; city: string } {
  const m = (s ?? "").trim().match(/^(\d{4})\s+(.*)$/);
  return m ? { zip: m[1], city: m[2] } : { zip: "", city: (s ?? "").trim() };
}
/** Escape a value for a Dinero queryFilter string literal (OData-style: double the
 *  single quotes) so an apostrophe in an email/CVR cannot break or shift the match. */
function qf(v: string): string {
  return v.replace(/'/g, "''");
}
const contactExtRef = (id: number) => `karltoffel-contact-${id}`;
const orderExtRef = (id: number) => `karltoffel-order-${id}`;

// ─── Contacts ─────────────────────────────────────────────────────────────────
async function findContactGuid(access: string, org: string, queryFilter: string): Promise<string | null> {
  const url = `${API_BASE}/${V_CONTACTS}/${org}/contacts?queryFilter=${encodeURIComponent(queryFilter)}&fields=ContactGuid`;
  const first = coll(await dineroJson("GET", url, access))[0];
  return first ? strOr(ci(first, "ContactGuid")) ?? strOr(ci(first, "Guid")) : null;
}

type ContactLike = {
  id: number; isCompany: boolean; companyName: string | null; name: string;
  cvr: string | null; ean: string | null; email: string | null; phone: string | null;
  street: string; city: string; att: string | null;
};

/** Reuse the stored guid, else dedup (externalReference → CVR → email), else create. */
async function ensureDineroContact(access: string, org: string, contact: ContactLike): Promise<string> {
  let guid = await findContactGuid(access, org, `ExternalReference eq '${qf(contactExtRef(contact.id))}'`);
  if (!guid && contact.isCompany && contact.cvr) guid = await findContactGuid(access, org, `VatNumber eq '${qf(contact.cvr)}'`);
  if (!guid && contact.email) guid = await findContactGuid(access, org, `Email eq '${qf(contact.email)}'`);
  if (guid) return guid;

  const { zip, city } = splitZipCity(contact.city);
  const body = {
    Name: contact.isCompany ? contact.companyName || contact.name : contact.name,
    CountryKey: "DK",
    IsPerson: !contact.isCompany,
    IsMember: false,
    UseCvr: false,
    Street: contact.street || undefined,
    ZipCode: zip || undefined,
    City: city || undefined,
    Email: contact.email || undefined,
    Phone: contact.phone || undefined,
    AttPerson: contact.isCompany ? contact.att || undefined : undefined,
    VatNumber: contact.isCompany ? contact.cvr || undefined : undefined,
    EanNumber: contact.ean || undefined,
    ExternalReference: contactExtRef(contact.id),
  };
  const data = await dineroJson("POST", `${API_BASE}/${V_CONTACTS}/${org}/contacts`, access, body);
  const newGuid = strOr(ci(data, "ContactGuid")) ?? strOr(ci(data, "Guid"));
  if (!newGuid) throw new Error("Dinero returnerede ingen ContactGuid");
  return newGuid;
}

// ─── Invoices ─────────────────────────────────────────────────────────────────
type InvoiceRef = { guid: string; timeStamp: string; number: number | null; totalInclVat: number | null };
function toInvoiceRef(o: unknown, guid: string, fallbackTs = ""): InvoiceRef {
  return {
    guid,
    timeStamp: strOr(ci(o, "TimeStamp")) ?? fallbackTs,
    number: numOr(ci(o, "Number")),
    totalInclVat: numOr(ci(o, "TotalInclVat")),
  };
}

async function findInvoiceByExternalRef(access: string, org: string, ref: string): Promise<InvoiceRef | null> {
  const filter = encodeURIComponent(`ExternalReference eq '${qf(ref)}'`);
  const url = `${API_BASE}/${V_INVOICES}/${org}/invoices?queryFilter=${filter}&fields=Guid,TimeStamp,Number,TotalInclVat`;
  const first = coll(await dineroJson("GET", url, access))[0];
  if (!first) return null;
  const guid = strOr(ci(first, "Guid"));
  return guid ? toInvoiceRef(first, guid) : null;
}

async function getInvoice(access: string, org: string, guid: string): Promise<InvoiceRef> {
  return toInvoiceRef(await dineroJson("GET", `${API_BASE}/${V_INVOICES}/${org}/invoices/${guid}`, access), guid);
}

async function createDraftInvoice(
  access: string,
  org: string,
  input: { contactGuid: string; orderId: number; salesAccountNumber: number; tasks: Array<{ description: string; price: number }> },
): Promise<InvoiceRef> {
  const body = {
    ContactGuid: input.contactGuid,
    Date: cphDate(),
    Currency: "DKK",
    Language: "da-DK",
    ShowLinesInclVat: true, // BaseAmountValue is kr INCL. VAT (TaskLine.price convention)
    Description: `Ordre #${input.orderId}`,
    ExternalReference: orderExtRef(input.orderId),
    ProductLines: input.tasks.map((t) => ({
      Description: t.description,
      Quantity: 1,
      AccountNumber: input.salesAccountNumber,
      Unit: "parts",
      Discount: 0,
      LineType: "Product",
      BaseAmountValue: t.price,
    })),
  };
  const data = await dineroJson("POST", `${API_BASE}/${V_INVOICES}/${org}/invoices`, access, body);
  const guid = strOr(ci(data, "Guid"));
  if (!guid) throw new Error("Dinero returnerede ingen faktura-Guid");
  return toInvoiceRef(data, guid);
}

async function bookInvoiceOnce(access: string, org: string, guid: string, timeStamp: string): Promise<InvoiceRef> {
  const data = await dineroJson("POST", `${API_BASE}/${V_INVOICES}/${org}/invoices/${guid}/book`, access, { Timestamp: timeStamp });
  return toInvoiceRef(data, guid, timeStamp);
}
/** Book, retrying once on a stale-timestamp error (Dinero error code 58). Matches a
 *  structured error code, not any stray "58"/"timestamp" in the body. */
async function bookInvoice(access: string, org: string, guid: string, timeStamp: string): Promise<InvoiceRef> {
  try {
    return await bookInvoiceOnce(access, org, guid, timeStamp);
  } catch (e) {
    if (e instanceof DineroApiError && /"?(errorcode|code)"?\s*:\s*58\b/i.test(e.raw)) {
      const fresh = await getInvoice(access, org, guid);
      return await bookInvoiceOnce(access, org, guid, fresh.timeStamp);
    }
    throw e;
  }
}

async function emailInvoice(access: string, org: string, guid: string, timeStamp: string): Promise<void> {
  // Dinero sends the mail (with a public invoice link) — the CRM must NOT also
  // email the invoice via Resend. Receiver defaults to the Dinero contact's email.
  await dineroJson("POST", `${API_BASE}/${V_INVOICES}/${org}/invoices/${guid}/email`, access, {
    Timestamp: timeStamp,
    AddVoucherAsPdfAttachment: true,
  });
}

/** Best-effort: does the invoice already have a payment registered? Avoids
 *  double-registering a cash payment if a prior run crashed after the POST. If the
 *  lookup itself fails we return false (proceed) — the narrow crash+lookup-fail race
 *  is accepted; the per-order lock covers the common double-click case. */
async function invoiceHasPayment(access: string, org: string, guid: string): Promise<boolean> {
  try {
    return coll(await dineroJson("GET", `${API_BASE}/${V_INVOICES}/${org}/invoices/${guid}/payments`, access)).length > 0;
  } catch {
    return false;
  }
}

async function registerPayment(
  access: string,
  org: string,
  guid: string,
  input: { amount: number; depositAccountNumber: number; timeStamp: string },
): Promise<string | null> {
  const data = await dineroJson("POST", `${API_BASE}/${V_INVOICES}/${org}/invoices/${guid}/payments`, access, {
    Timestamp: input.timeStamp,
    Amount: input.amount,
    DepositAccountNumber: input.depositAccountNumber,
    PaymentDate: cphDate(),
    Description: "Kontant betaling",
    RemainderIsFee: false,
  });
  return strOr(ci(data, "PaymentGuid")) ?? strOr(ci(data, "Guid"));
}

// ─── Organizations + connection test (used by /accounting "Test forbindelse") ─
async function fetchOrganizations(
  access: string,
): Promise<Array<{ organizationId: string; name: string | null; isPro: boolean }>> {
  // Request IsPro explicitly — list endpoints omit non-default fields otherwise.
  const data = await dineroJson("GET", `${API_BASE}/${V_ORGS}/organizations?fields=Name,Id,IsPro`, access);
  return coll(data)
    .map((o) => ({
      organizationId: String(ci(o, "Id") ?? ci(o, "organizationId") ?? ""),
      name: strOr(ci(o, "Name")),
      isPro: Boolean(ci(o, "IsPro")),
    }))
    .filter((o) => o.organizationId);
}

export type TestResult = { ok: boolean; organizationId?: string; orgName?: string | null; isPro?: boolean; error?: string };

/** Fetch a token and confirm the org is reachable; cache org name/isPro + status on
 *  the DineroConnection row. Surfaces the exact error so the token endpoint/scope can
 *  be corrected via env if the client_credentials assumption is off. */
export async function testDineroConnection(companyId: number): Promise<TestResult> {
  if (!envConfigured()) return { ok: false, error: "DINERO_CLIENT_ID/SECRET mangler i miljøet." };
  const orgId = resolveOrgId();
  if (!orgId) return { ok: false, error: "Kunne ikke udlede organisations-ID af client-id'et (forventet pcc_<id>_...). Sæt evt. DINERO_ORG_ID." };
  try {
    const access = await getAccessToken();
    const orgs = await fetchOrganizations(access);
    const match = orgs.find((o) => o.organizationId === orgId) ?? orgs[0];
    if (!match) return { ok: false, error: "Ingen Dinero-organisation tilgængelig for denne API-klient." };
    await prisma.dineroConnection.upsert({
      where: { companyId },
      create: { companyId, organizationId: match.organizationId, orgName: match.name, isPro: match.isPro, status: "connected" },
      update: { organizationId: match.organizationId, orgName: match.name, isPro: match.isPro, status: "connected" },
    });
    return { ok: true, organizationId: match.organizationId, orgName: match.name, isPro: match.isPro };
  } catch (e) {
    await prisma.dineroConnection.updateMany({ where: { companyId }, data: { status: "error" } }).catch(() => {});
    return { ok: false, error: (e instanceof Error ? e.message : "forbindelse fejlede").slice(0, 300) };
  }
}

// ─── Status for the /accounting page ──────────────────────────────────────────
export type DineroStatus = {
  envReady: boolean;
  dryRunForced: boolean;
  orgId: string | null;
  connection: DineroConnection | null;
};
export async function getDineroStatus(): Promise<DineroStatus> {
  return {
    envReady: envConfigured(),
    dryRunForced: dryRunForced(),
    orgId: resolveOrgId(),
    connection: await prisma.dineroConnection.findFirst(),
  };
}

// ─── The orchestration: invoice one order per its stored decision ─────────────
export type IssueResult = { ok: boolean; simulated?: boolean; status: string; error?: string };
const BOOKED_STATES = new Set(["Booked", "Sent", "Paid"]);

/**
 * Issue/advance the Dinero invoice for an order according to order.invoiceDecision.
 * NEVER throws — failures are caught, persisted (dineroError; status → 'Failed' only
 * when not already booked) and returned, so order completion is decoupled from
 * bookkeeping. Idempotent + resumable: draft creation is serialised per order under
 * a Postgres advisory lock and the guid is persisted inside that lock, so concurrent
 * runs and crash-recovery cannot create a second invoice; each later step is
 * persisted before the next.
 */
export async function issueInvoiceForOrder(orderId: number): Promise<IssueResult> {
  const order = await prisma.order.findUnique({ where: { id: orderId }, include: { contact: true, tasks: true } });
  if (!order) return { ok: false, status: "Failed", error: "Ordre ikke fundet" };

  const decision = order.invoiceDecision;
  if (!decision || !isInvoiceDecision(decision) || decision === D_NONE || decision === D_LATER) {
    return { ok: true, status: decision === D_LATER ? "later" : "none" };
  }

  const sumInclVat = order.tasks.reduce((a, t) => a + t.price, 0);

  const cfg = await loadActiveConfig();
  if (!cfg) {
    // Dry-run: log the would-be chain, mark simulated — but NEVER downgrade an order
    // that already carries a real Dinero invoice (guid present).
    console.log(`[dinero:dry-run] faktura ordre #${orderId} valg="${decision}" linjer=${order.tasks.length} sum=${sumInclVat}kr`);
    await prisma.order.updateMany({
      where: { id: orderId, dineroInvoiceGuid: null },
      data: { dineroInvoiceStatus: "simulated", dineroError: null, invoicedAt: new Date() },
    });
    return { ok: true, simulated: true, status: "simulated" };
  }

  // Resume markers taken from the pre-run snapshot (dineroInvoiceNumber is assigned
  // only at booking and is never cleared, so it survives a 'Failed' status write).
  const alreadyBooked = BOOKED_STATES.has(order.dineroInvoiceStatus ?? "") || order.dineroInvoiceNumber != null;

  try {
    const access = await getAccessToken();
    const org = cfg.orgId;

    // 1. Ensure a Dinero contact. Do not steal a guid already owned by another
    //    CRM contact (duplicate customers sharing an email/CVR) — that would violate
    //    Contact.dineroContactGuid @unique; use it transiently instead.
    let contactGuid = order.contact.dineroContactGuid;
    if (!contactGuid) {
      contactGuid = await ensureDineroContact(access, org, order.contact);
      const clash = await prisma.contact.findFirst({
        where: { dineroContactGuid: contactGuid, NOT: { id: order.contactId } },
        select: { id: true },
      });
      if (!clash) await prisma.contact.update({ where: { id: order.contactId }, data: { dineroContactGuid: contactGuid } });
    }

    // 2. Reuse / adopt / create the draft invoice, SERIALISED per order under an
    //    advisory lock and persisted inside it, so concurrent runs and crash-recovery
    //    cannot create a second invoice (@unique dineroInvoiceGuid alone can't).
    const ensured = await prisma.$transaction(
      async (tx) => {
        await tx.$queryRaw`SELECT pg_advisory_xact_lock(${BigInt(orderId)})`;
        const row = await tx.order.findUnique({
          where: { id: orderId },
          select: { dineroInvoiceGuid: true, dineroInvoiceTimeStamp: true, dineroInvoiceStatus: true },
        });
        let guid = row?.dineroInvoiceGuid ?? null;
        let timeStamp = row?.dineroInvoiceTimeStamp ?? "";
        if (!guid) {
          const found = await findInvoiceByExternalRef(access, org, orderExtRef(orderId));
          if (found) { guid = found.guid; timeStamp = found.timeStamp; }
        }
        if (!guid) {
          const draft = await createDraftInvoice(access, org, {
            contactGuid, orderId, salesAccountNumber: cfg.salesAccountNumber,
            tasks: order.tasks.map((t) => ({ description: t.description, price: t.price })),
          });
          guid = draft.guid;
          timeStamp = draft.timeStamp;
        }
        const keepBooked = row && BOOKED_STATES.has(row.dineroInvoiceStatus ?? "");
        await tx.order.update({
          where: { id: orderId },
          data: {
            dineroInvoiceGuid: guid,
            dineroInvoiceTimeStamp: timeStamp,
            dineroInvoiceStatus: keepBooked ? row.dineroInvoiceStatus : "Draft",
            dineroError: null,
          },
        });
        return { guid, timeStamp };
      },
      { timeout: 30_000 },
    );
    const guid = ensured.guid;
    let timeStamp = ensured.timeStamp;

    // 3. Draft-only: stop here (user finishes it in Dinero's Salg UI).
    if (decision === D_DRAFT) {
      await prisma.order.update({ where: { id: orderId }, data: { dineroInvoiceStatus: "Draft", invoicedAt: new Date(), dineroError: null } });
      return { ok: true, status: "Draft" };
    }

    // 4. Book (irreversible) — guarded by a fail-CLOSED VAT/total sanity check.
    let bookedTotal: number | null = null;
    if (!alreadyBooked) {
      const detail = await getInvoice(access, org, guid);
      if (detail.timeStamp) timeStamp = detail.timeStamp;
      if (detail.number != null) {
        // Already booked in Dinero (a prior book whose response was lost) — adopt it,
        // never re-book. A booked invoice carries an assigned Number; a draft does not.
        bookedTotal = detail.totalInclVat;
        await prisma.order.update({
          where: { id: orderId },
          data: { dineroInvoiceNumber: detail.number, dineroInvoiceTimeStamp: timeStamp, dineroInvoiceStatus: "Booked", dineroError: null },
        });
      } else {
        if (detail.totalInclVat == null) {
          throw new Error("Momskontrol umulig: Dinero returnerede ingen total — kladden er IKKE bogført.");
        }
        if (Math.abs(detail.totalInclVat - sumInclVat) > 1) {
          throw new Error(`Momskontrol fejlede: Dinero-total ${detail.totalInclVat} kr ≠ ordrens ${sumInclVat} kr. Kladden er IKKE bogført.`);
        }
        const booked = await bookInvoice(access, org, guid, timeStamp);
        timeStamp = booked.timeStamp || timeStamp;
        bookedTotal = booked.totalInclVat ?? detail.totalInclVat;
        await prisma.order.update({
          where: { id: orderId },
          data: {
            dineroInvoiceNumber: booked.number ?? order.dineroInvoiceNumber,
            dineroInvoiceTimeStamp: timeStamp,
            dineroInvoiceStatus: "Booked",
            dineroError: null,
          },
        });
      }
    } else {
      const detail = await getInvoice(access, org, guid);
      if (detail.timeStamp) timeStamp = detail.timeStamp;
      bookedTotal = detail.totalInclVat;
    }

    // 5. Send (email) — "Send faktura - ubetalt". Never downgrade a Paid invoice.
    if (decision === D_SEND_UNPAID) {
      if (order.dineroInvoiceStatus !== "Sent" && order.dineroInvoiceStatus !== "Paid") {
        await emailInvoice(access, org, guid, timeStamp);
      }
      await prisma.order.update({
        where: { id: orderId },
        data: { dineroInvoiceStatus: order.dineroInvoiceStatus === "Paid" ? "Paid" : "Sent", invoicedAt: new Date(), dineroError: null },
      });
      return { ok: true, status: order.dineroInvoiceStatus === "Paid" ? "Paid" : "Sent" };
    }

    // 6. Register cash payment — "Send faktura - betalt kontant" (idempotent).
    if (decision === D_SEND_CASH) {
      let paymentGuid = order.dineroPaymentGuid;
      if (order.dineroInvoiceStatus !== "Paid" && !(await invoiceHasPayment(access, org, guid))) {
        paymentGuid = await registerPayment(access, org, guid, {
          amount: bookedTotal ?? sumInclVat, // Dinero's own booked total, not the CRM Int sum
          depositAccountNumber: cfg.cashAccountNumber,
          timeStamp,
        });
      }
      await prisma.order.update({
        where: { id: orderId },
        data: { dineroPaymentGuid: paymentGuid, dineroInvoiceStatus: "Paid", invoicedAt: new Date(), dineroError: null },
      });
      return { ok: true, status: "Paid" };
    }

    return { ok: true, status: order.dineroInvoiceStatus ?? "Booked" };
  } catch (e) {
    const msg = (e instanceof Error ? e.message : "Fakturering fejlede").slice(0, 500);
    // Record the error, but NEVER downgrade a booked invoice to 'Failed' (a retry
    // would otherwise re-book it). dineroInvoiceNumber survives as the booked proof.
    const cur = await prisma.order.findUnique({
      where: { id: orderId },
      select: { dineroInvoiceStatus: true, dineroInvoiceNumber: true },
    });
    const isBooked = BOOKED_STATES.has(cur?.dineroInvoiceStatus ?? "") || cur?.dineroInvoiceNumber != null;
    await prisma.order.update({
      where: { id: orderId },
      data: { dineroError: msg, ...(isBooked ? {} : { dineroInvoiceStatus: "Failed" }) },
    });
    return { ok: false, status: isBooked ? cur?.dineroInvoiceStatus ?? "Booked" : "Failed", error: msg };
  }
}
