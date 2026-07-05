# fb_connector.md — Frontend tilbudsmotor → karltoffel-crm connector

> **Formål (DA):** Dette dokument beskriver "linket" mellem tilbudsmotoren på frontenden og
> karltoffel-crm, som automatiserer kunde-/emne-oprettelsen. Modtager-endpointet er **bygget og
> live i produktion**. Dokumentet er et handoff, så arbejdet kan fortsætte i en frisk session.
>
> **Purpose (EN):** Reference + handoff for the connector that lets a frontend quote engine push
> enquiries into the CRM automatically. The receiving endpoint (`POST /api/leads`) is built and
> live; the frontend just needs to call it. Everything below is exact to the code as of this
> writing — treat the linked source files as the source of truth.

**Repo:** `karltoffel_crm` (Next.js 16 App Router, React 19, Prisma 6, Neon Postgres)
**Production:** https://karltoffel-crm.vercel.app
**Endpoint:** `POST https://karltoffel-crm.vercel.app/api/leads`

## Status at a glance

| Piece | State |
|---|---|
| Receiving endpoint `POST /api/leads` | ✅ **Built & live** (dormant until the secret is set — fail-closed 503) |
| `Lead` model + migration | ✅ Applied in production (`20260705120000_add_lead`) |
| Emner UI (Kartotek → Emner) + convert-to-customer | ✅ Live |
| Quote e-mail feature (`/orders/[id]/send-tilbud`) | ✅ Live (dry-runs until a mail provider is set) |
| `LEAD_WEBHOOK_SECRET` set in Vercel | ⏳ **Pending** — endpoint 503s until done |
| Frontend server calling the endpoint | ⏳ **Pending** — the frontend team's task |
| Automation level (Variant A / B / C) | ⏳ **Decision needed** — see "Integration variants" |

---

## API contract — POST /api/leads

Implemented in `app/api/leads/route.ts` (helpers: `lib/api-auth.ts`, `lib/rate-limit.ts`). Live at `https://karltoffel-crm.vercel.app/api/leads`.

| | |
|---|---|
| **Method / URL** | `POST https://karltoffel-crm.vercel.app/api/leads` |
| **Auth** | Shared-secret header `x-karltoffel-secret` |
| **Body** | JSON, effectively max 10,240 bytes (`Content-Length` header checked) |
| **Caller** | The website's **server** (form relay) only — never the browser. A browser POST would expose the secret in devtools; no CORS headers are emitted, which also keeps browsers out. |

### Authentication

- The `x-karltoffel-secret` header value is compared against the env var `LEAD_WEBHOOK_SECRET` on the CRM side.
- Comparison is constant-time: both values are SHA-256 hashed (`crypto.subtle.digest`) and the fixed-length digests are XOR-compared byte-by-byte (same idiom as `lib/session.ts`).
- **Fail-closed:** if `LEAD_WEBHOOK_SECRET` is unset **or shorter than 32 characters**, every request gets `503 {"error":"Lead intake not configured"}` — the endpoint is never silently open. This check runs before the header is even looked at.
- Missing or wrong header → `401 {"error":"Unauthorized"}` (from `unauthorized()` in `lib/api-auth.ts`), and the failure is counted against the auth rate limit.

### Rate limits

In-memory fixed-window limiter (`lib/rate-limit.ts`), keyed by client IP (first entry of `x-forwarded-for`, fallback `"local"`). Both windows are 60 seconds. `underLimit` never mutates; only `recordHit` counts.

| Key | Limit | What is counted |
|---|---|---|
| `leads:auth:{ip}` | 20 / 60 s | **Failed** auth attempts only — successful auth is never penalised |
| `leads:create:{ip}` | 10 / 60 s | Accepted submissions (counted after validation passes and a company exists — dedup merges count too) |

Exceeding either window → `429 {"error":"Too many requests"}`. The `leads:auth` check runs **before** the secret check, so a flooded IP can get 429 even with a valid secret. Caveat (documented in `lib/rate-limit.ts`): the limiter is per serverless instance, so under multi-instance deployment each instance has its own counters.

### Request body

Send JSON. The handler never inspects the request `Content-Type` header — it just attempts `req.json()` and returns `400 {"error":"Invalid JSON"}` on parse failure. If the `Content-Length` header exceeds 10,240 bytes → `400 {"error":"Payload too large"}`. All string fields are trimmed then truncated to their max length; non-string values are treated as absent.

| Field | Required | Max len | Rules |
|---|---|---|---|
| `name` | **yes** | 200 | Missing/empty → `400 {"error":"name is required"}` |
| `email` | one of email/phone | 320 | Lowercased before validation/storage. Validated against `/.+@.+\..+/` — failure → `400 {"error":"invalid email"}` |
| `phone` | one of email/phone | 32 (raw input) | Normalised: strip all non-digits, then strip a leading `45` or `0045` only when exactly 8 digits follow (`.replace(/[^\d]/g,"").replace(/^(45|0045)(?=\d{8}$)/,"")`). E.g. `"+45 12 34 56 78"` → `"12345678"` |
| `address` | no | 300 | Free text, stored as submitted (trimmed) |
| `message` | no | 2000 | Free text |
| `source` | no | 50 | Defaults to `"website"` when absent/empty |
| `utm` | no | 100 per value | Must be an object (else ignored). Only keys `source`, `medium`, `campaign`, `term`, `content` are kept; empty values dropped; stored as a JSON string |

If both `email` and `phone` are absent after normalisation → `400 {"error":"email or phone is required"}`.

The CRM is single-tenant: the lead attaches to the first `Company` row; if none exists → `503 {"error":"No company configured"}`. The submitter IP is stored on the lead for abuse forensics.

### Deduplication and contact pre-link

1. **Dedup — merge into an open lead.** If a lead exists with the same company, status `new` or `contacted`, `createdAt` within the last 30 days, and a matching normalised `email` OR `phone` (most recent match wins), the new submission is merged into it instead of creating a row:
   - `message`: if the new submission has one, it is appended to the existing message with a `\n---\n` separator (or becomes the message if there was none).
   - `email`, `phone`, `address`: backfilled only where the existing lead's field is `null`. `name`, `source`, `utm` of the duplicate submission are discarded.
   - Response: `200` with `deduplicated: true` and the **existing** lead's id.
2. **Contact pre-link.** For a genuinely new lead, an existing `Contact` matching the normalised email or phone is looked up and its id stored as `contactId`, so the CRM UI can badge the lead as an existing customer ("eksisterende kunde"). This does not change the response shape.

### Responses

All responses are JSON (`content-type: application/json`). Lead ids are integers (Prisma autoincrement).

| Status | Body | When |
|---|---|---|
| `201` | `{"id": <int>, "deduplicated": false}` | New lead created |
| `200` | `{"id": <int>, "deduplicated": true}` | Merged into an existing open lead (id of that lead) |
| `400` | `{"error": "Payload too large"}` | `Content-Length` > 10,240 bytes |
| `400` | `{"error": "Invalid JSON"}` | Body failed JSON parsing |
| `400` | `{"error": "name is required"}` | `name` missing/empty |
| `400` | `{"error": "email or phone is required"}` | Neither contact field present |
| `400` | `{"error": "invalid email"}` | Email fails `/.+@.+\..+/` |
| `401` | `{"error": "Unauthorized"}` | Missing/wrong `x-karltoffel-secret` (counts toward auth rate limit) |
| `429` | `{"error": "Too many requests"}` | >20 failed-auth hits/min or >10 accepted submissions/min per IP |
| `503` | `{"error": "Lead intake not configured"}` | `LEAD_WEBHOOK_SECRET` unset or < 32 chars |
| `503` | `{"error": "No company configured"}` | No `Company` row in the database |

Check order: auth-window 429 → 503 (unconfigured) → 401 → create-window 429 → 400s → 503 (no company) → 200/201.

### Example

```bash
curl -i -X POST https://karltoffel-crm.vercel.app/api/leads \
  -H "content-type: application/json" \
  -H "x-karltoffel-secret: $LEAD_WEBHOOK_SECRET" \
  -d '{
    "name": "Mette Hansen",
    "email": "Mette.Hansen@Example.dk",
    "phone": "+45 12 34 56 78",
    "address": "Solvej 12, 8000 Aarhus C",
    "message": "Vinduespudsning hver 4. uge, hus i to etager.",
    "source": "tilbudsmotor",
    "utm": { "source": "facebook", "medium": "cpc", "campaign": "forår2026" }
  }'
```

First call returns `201 {"id":42,"deduplicated":false}` (email stored as `mette.hansen@example.dk`, phone as `12345678`). Repeating it within 30 days while the lead is still `new`/`contacted` returns `200 {"id":42,"deduplicated":true}` with the message appended after `\n---\n`.


---


## Data model & lead lifecycle

### The `Lead` table

Defined in `prisma/schema.prisma` (model `Lead`), created by `prisma/migrations/20260705120000_add_lead/migration.sql`. A lead is an inbound sales enquiry from the public website form / webhook (`POST /api/leads`). It is deliberately separate from `Contact`: a lead has almost no required fields and its own lifecycle; converting one creates a real `Contact`.

| Field | Type (Postgres) | Required | Default | Meaning |
|---|---|---|---|---|
| `id` | `SERIAL` PK | yes | autoincrement | Primary key. |
| `companyId` | `INTEGER` FK → `Company.id` | yes | — | Owning tenant. FK is `ON DELETE RESTRICT ON UPDATE CASCADE`. |
| `status` | `TEXT` | yes | `'new'` | Lifecycle state: `new` \| `contacted` \| `converted` \| `rejected` (plain string — the schema avoids enums for SQLite/Postgres portability). |
| `name` | `TEXT` | yes | — | Submitter's name. The only required payload field. |
| `email` | `TEXT` | no | — | Stored lowercased/trimmed (normalised at intake). |
| `phone` | `TEXT` | no | — | Stored normalised: digits only, `+45` prefix stripped (normalised at intake). |
| `address` | `TEXT` | no | — | Free text exactly as submitted (not split into street/city until conversion). |
| `message` | `TEXT` | no | — | The enquiry text. |
| `source` | `TEXT` | yes | `'website'` | Origin channel: `website` \| `manual` \| `partner` \| … |
| `utm` | `TEXT` | no | — | UTM parameters as a JSON blob **string** (schema uses no native `Json` type). |
| `ip` | `TEXT` | no | — | Submitter IP, kept for abuse forensics. |
| `contactId` | `INTEGER` FK → `Contact.id` | no | — | Set when the lead is linked to a customer — either pre-linked at intake (existing-customer match) or on conversion. FK is `ON DELETE SET NULL ON UPDATE CASCADE`. |
| `createdAt` | `TIMESTAMP(3)` | yes | `CURRENT_TIMESTAMP` | Submission time. |
| `updatedAt` | `TIMESTAMP(3)` | yes | `@updatedAt` | Maintained by Prisma on every update. |

**Indexes** (all three in the migration):

```sql
CREATE INDEX "Lead_companyId_status_idx" ON "Lead"("companyId", "status");  -- list page filtering
CREATE INDEX "Lead_email_idx"  ON "Lead"("email");   -- duplicate / existing-customer lookup
CREATE INDEX "Lead_phone_idx"  ON "Lead"("phone");   -- duplicate / existing-customer lookup
```

Relations on the other side: `Company.leads Lead[]` and `Contact.leads Lead[]`.

### Status lifecycle

```
            markLeadContacted            convertLead
  new ─────────────────────► contacted ─────────────► converted   (terminal in the UI)
   │                              │
   │ rejectLead                   │ rejectLead
   ▼                              ▼
              rejected   (can still be contacted/converted later)
```

All transitions are driven by server actions in `app/actions/leads.ts`, each guarded by `guardAction()` from `lib/api-auth` (anonymous callers bounce to `/login`):

| Action | Effect | Revalidates |
|---|---|---|
| `markLeadContacted(id)` | `status = "contacted"` | `/leads` |
| `rejectLead(id)` | `status = "rejected"` | `/leads` |
| `convertLead(id)` | `status = "converted"` + Contact creation/linking (below) | `/leads` (+ `/customers` on the create path) |

The actions themselves impose no state-machine preconditions (any lead can be updated); the allowed transitions are enforced by which menu items the UI renders (see RowMenu rules below). Practically: `converted` is terminal (the UI offers no further status actions), while a `rejected` lead can still be marked contacted or converted.

### `convertLead` behaviour (`app/actions/leads.ts`)

1. `guardAction()`, then load the lead; silently return if it does not exist.
2. **Pre-linked path** — if `lead.contactId` is already set (lead was matched to an existing customer at intake): set `status = "converted"`, revalidate `/leads`, and `redirect("/customers/" + lead.contactId)`. No new Contact is created; the action just opens the existing customer. (`redirect()` throws, so execution stops here.)
3. **Create path** — otherwise:
   - Resolve the company via `prisma.company.findFirst()` (single-tenant assumption; return silently if none).
   - Split the free-text address with `splitAddress(lead.address ?? "")` — the same "one free-text address → street + city on the first comma" rule the contact create flow uses (`app/actions/contacts.ts`): everything before the first comma becomes `street`, everything after becomes `city`; with no comma, the whole string is `street` and `city` is `""`.
   - In a single `prisma.$transaction`: create the `Contact` (`companyId`, `name`, `email`, `phone`, `street`, `city` — all copied from the lead) and update the lead to `status = "converted"`, `contactId = <new contact id>`.
   - Revalidate `/leads` and `/customers`, then `redirect("/customers/" + contact.id)` — the user lands directly on the new customer's detail page.

### The Emner UI (`app/leads/page.tsx`)

Reached via the top nav **Kartotek → Emner** (`lib/nav.ts`: menu "Kartotek" / en "Register" → item "Emner" / en "Leads" → `/leads`). Page title: "Emner"; description: "Indkomne emner fra hjemmesiden. Konvertér et emne til en kunde, når I går videre med det."

**Status filter** — a toolbar of buttons linking to `/leads?status=<key>`: `Alle` (no param), `Ny` (`new`), `Kontaktet` (`contacted`), `Konverteret` (`converted`), `Afvist` (`rejected`). An unknown `status` query value falls back to "Alle". The query is `prisma.lead.findMany` with the status filter, `orderBy createdAt desc`, `take: 200`.

**Table columns**: row-menu cell, `Dato` (ISO date `YYYY-MM-DD`), `Navn`, `Kontakt` (email and phone joined with `" · "`, or `—`), `Besked` (message truncated to 60 chars + `…`, or `—`), `Kilde` (`source` verbatim), `Status`. Empty list renders "Ingen emner".

**Status badges**: `new` → "Ny" (`badge-soft-warning`), `contacted` → "Kontaktet" (`badge-soft-muted`), `converted` → "Konverteret" (`badge-soft-success`), `rejected` → "Afvist" (`badge-soft-danger`); unknown statuses render the raw value with `badge-soft-muted`.

**"eksisterende kunde" badge** — when `lead.contactId` is set (the intake pre-linked the lead to an existing customer), a muted `eksisterende kunde` badge is shown next to the name in the `Navn` column.

**RowMenu actions per row** (built conditionally from `status` and `contactId`):

| Item | Shown when | Behaviour |
|---|---|---|
| "Vis kunde" | `contactId` set (any status) | Plain link to `/customers/[contactId]`. |
| "Markér som kontaktet" | `status !== "converted"` | Calls `markLeadContacted`. |
| "Åbn som kunde" (pre-linked) / "Konvertér til kunde…" (not linked) | `status !== "converted"` | Calls `convertLead` behind a confirm dialog: title "Konvertér emne", body ``Opret `${name}` som kunde ud fra dette emne?``, confirm label "Konvertér". |
| "Afvis emne…" (danger) | `status !== "converted" && status !== "rejected"` | Calls `rejectLead` behind a confirm dialog: title "Afvis emne", body ``Afvis emnet fra `${name}`?``, confirm label "Afvis emne". |

Net effect per status: **new/contacted** rows offer contact-mark, convert, and reject; **rejected** rows offer contact-mark and convert (no reject); **converted** rows offer only "Vis kunde" (or no menu at all if somehow unlinked).


---


## Integration variants & recommendation

How automatic should the tilbudsmotor → CRM link be? Three variants, ordered by increasing automation. All of them ride on the same authenticated webhook (`POST /api/leads`, shared-secret header `x-karltoffel-secret`, see `app/api/leads/route.ts`) — they differ in what the CRM *does* with the submission.

### Variant A — Lead → manual convert (LIVE today)

**Flow:** frontend server relay → `POST /api/leads` → row in the `Lead` register (status `new`) → office reviews on `/leads` and calls `convertLead` (`app/actions/leads.ts`), which creates the `Contact` and marks the lead `converted` in one transaction, then redirects to `/customers/{id}`.

**What exists (no work needed):**

| Piece | File | Behaviour |
|---|---|---|
| Intake endpoint | `app/api/leads/route.ts` | Validates `name` (required) + `email` or `phone` (at least one), normalises email (lowercase) and phone (digits only, leading `45`/`0045` stripped only when exactly 8 digits follow — i.e. from 10-digit `45…` / 12-digit `0045…` numbers), caps payload at 10 KiB, rate-limits per IP (20/min failed auth, 10/min accepted) |
| Dedup | same file | Merges into an open lead (status `new`/`contacted`, ≤ 30 days) with the same normalised email/phone → `200 {id, deduplicated: true}`; otherwise creates → `201 {id, deduplicated: false}` |
| Existing-customer pre-link | same file | Sets `Lead.contactId` when a `Contact` with the same email/phone exists, so the UI can badge the lead as an existing customer |
| Convert action | `app/actions/leads.ts` (`convertLead`) | If pre-linked, just marks `converted`; else creates the Contact (free-text `address` split into `street`/`city` on the first comma) and links it |

**Pros:** human review step; junk/spam never reaches the customer register; dedup and existing-customer matching already handle the common repeat-enquiry cases.
**Cons:** every enquiry needs a manual click before it becomes a customer, and the quoted tasks/prices computed by the tilbudsmotor are lost — at best they arrive flattened into the free-text `message`.

**Effort:** zero — this is production behaviour.

### Variant B — Auto-create the Contact at intake (skip review)

**What changes:** in `app/api/leads/route.ts`, after the existing-customer lookup (`known`), when no match is found create the `Contact` immediately and store the lead as already `status: "converted"` with `contactId` set (keep writing the Lead row — it remains the audit trail, dedup window, and UTM record). Reuse the same comma-split address logic as `convertLead` — extract `splitAddress` from `app/actions/leads.ts` into a shared helper so route and action stay identical.

**Concrete changes:**
- `app/api/leads/route.ts`: ~20–30 lines — wrap Contact-create + Lead-create in `prisma.$transaction`, mirroring the body of `convertLead`.
- `app/actions/leads.ts`: import the shared `splitAddress` helper instead of its private copy.
- No schema change, no payload change. Optionally gate per request (`autoConvert: true` in the payload, or an env flag) so the website form and the tilbudsmotor can behave differently against the same endpoint.

**When appropriate:** only when the submitting source is trusted and pre-validated — e.g. the tilbudsmotor requires a verified email/phone before submitting. Otherwise every bot submission that clears the shared secret lands directly in the customer register, and near-duplicate contacts accumulate whenever email/phone differ slightly (Contact matching is exact-match on the normalised values).

**Effort:** small — well under a day.

### Variant C — Tilbudsmotor sends tasks + prices → Contact + draft Order (`sourceType: "online"`)

The richest "quote engine → CRM" flow: the quote the customer configured arrives in the CRM as a priced, plannable draft order — the office can drop it into the calendar and fire the tilbudsmail without re-typing anything.

**Payload addition** (the tilbudsmotor already computes these to show the customer a price):

```json
{
  "name": "…", "email": "…", "phone": "…", "address": "…",
  "tasks": [
    { "description": "Vinduespudsning, 8 fag", "price": 450, "durationMin": 45 },
    { "description": "Udhæng, 1. sal", "price": 200 }
  ]
}
```

`price` is an integer in whole kroner incl. VAT and `durationMin` an integer — matching `TaskLine.price Int` / `TaskLine.durationMin Int` in `prisma/schema.prisma`. An optional `category` per task can map onto `TaskLine.category`; default it to `"Andet"` like `readTaskLines` does in `app/actions/orders.ts`.

**Why the data model is already there:** `Order` and `TaskLine` exist and `Order.sourceType` already enumerates `subscription | fixed | manual | online` in `prisma/schema.prisma` — no app **write** path creates `"online"` orders yet (the read side — reports, calendar labels, group messages, seed — already handles them), so it is waiting for exactly this. The nested create in `createOrder` (`app/actions/orders.ts`) is the template: per line set `category`, `letter` (first char of category, uppercased), `color` via `categoryColor` from `lib/categories.ts`, `description`, `price`, `durationMin`, `sort` index; on the order set `deliveryAddress` from the contact's `street`/`city`, `plannedAt` (required, no default — use the enquiry date or a requested week), `status: "Afventer levering"`.

**Concrete changes:**
1. **Schema:** add `tasksJson String?` to `Lead` (the schema deliberately avoids the `Json` type — same convention as `Lead.utm` and `Company.settings`). One nullable column, one migration.
2. **`app/api/leads/route.ts`:** validate and store `body.tasks` — bound the array (e.g. ≤ 20 lines), trim/limit `description`, coerce `price`/`durationMin` to non-negative integers, serialise to `tasksJson`. The 10 KiB `content-length` cap comfortably fits ~20 lines. Decide dedup semantics for a re-quote (simplest: replace `tasksJson` with the newest submission when merging).
3. **`app/actions/leads.ts` (`convertLead`):** inside the existing transaction, when `lead.tasksJson` is present also create the draft `Order` with `sourceType: "online"` and the nested `TaskLine`s (copy the `createOrder` mapping), then redirect to `/orders/{id}` instead of `/customers/{id}`.
4. **`/leads` UI:** render the quoted lines + total on the lead card so the office sees the quote before converting.
5. **No new quote-email code:** once the draft order exists, the existing page `app/orders/[id]/send-tilbud/page.tsx` already builds the tilbudsmail from the order's priced task lines (`buildQuoteDraft` in `lib/quote.ts`, editable in `components/QuoteComposer.tsx`, sent via `sendQuoteEmail` in `app/actions/quotes.ts`). Variant C plugs the webhook straight into that pipeline.

Variant C composes with A or B: keep the review step (order is created at `convertLead` time — recommended), or combine with B for a fully automatic Contact + Order at intake.

**Effort:** roughly 1–2 days including migration, validation, the `/leads` UI addition, and tests.

### Recommendation

**Choose Variant C** if the tilbudsmotor already computes an itemised price — which is its purpose. It is the only variant where the quote survives the hop: task lines land as a draft `Order (sourceType: "online")`, the planner can schedule it, and the tilbudsmail goes out from `/orders/[id]/send-tilbud` with zero re-keying. Implement it in the C-on-top-of-A shape (tasks stored on the `Lead`, order materialised at `convertLead`) so the review gate that keeps junk out of the customer register is preserved.

If the engine ships before it can emit structured tasks, stay on **Variant A** (already live — the frontend only needs to POST the existing payload). Move to **Variant B** only for trusted, pre-validated sources where the manual convert click is pure overhead.


---


## Setup, security & operations

### Enabling the endpoint (env var)

The endpoint is **fail-closed**: until `LEAD_WEBHOOK_SECRET` is set to a 32+ character value, every
request returns `503 {"error":"Lead intake not configured"}`.

1. Vercel → project → **Settings → Environment Variables** → add `LEAD_WEBHOOK_SECRET` (scope: Production).
2. Use the secret generated during the build session (shared with the project owner in chat — **not**
   stored in this repo). To mint a fresh one:
   `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
3. Redeploy so the value takes effect.

> ⚠️ **Never commit the secret** to the repo and never expose it in the browser. Keep it only in
> Vercel and in the frontend server's own secret store.

### Security rules

- **Server-to-server only.** The website's *backend* calls the endpoint with the `x-karltoffel-secret`
  header. A browser call would leak the secret in devtools/network. No CORS headers are emitted, which
  also blocks browser calls by default.
- `middleware.ts` excludes `/api` from the session gate, so the route authenticates itself via the
  shared-secret header (constant-time compare, same idiom as `lib/session.ts`).
- **Rotation:** change the Vercel env var, redeploy, and update the caller's stored secret to match.
- The submitter IP (`x-forwarded-for`) is stored on each lead for abuse forensics.

### Operational caveat

`lib/rate-limit.ts` is an **in-memory, per-instance** limiter (documented in the file). Under multiple
Vercel instances each keeps its own counters, so effective limits can be a multiple of the configured
20/min (failed auth) and 10/min (accepted). Fine for low volume; move to a shared store (e.g. Upstash
Redis) if abuse becomes a problem.

### Test end-to-end

```bash
SECRET="<the LEAD_WEBHOOK_SECRET you set in Vercel>"
BASE="https://karltoffel-crm.vercel.app"

# 1) happy path -> 201 {"id":…, "deduplicated":false}
curl -s -X POST "$BASE/api/leads" \
  -H "content-type: application/json" -H "x-karltoffel-secret: $SECRET" \
  -d '{"name":"Test Testesen","email":"test@example.dk","message":"Prøve"}'

# 2) same call again within 30 days -> 200 {"id":…, "deduplicated":true}
# 3) wrong secret            -> 401 {"error":"Unauthorized"}
# 4) secret unset in Vercel  -> 503 {"error":"Lead intake not configured"}
```

---

## Open decisions (needed before/while building the frontend link)

1. **Automation level — Variant A, B, or C?** (see the variants section). If the tilbudsmotor already
   computes an itemised price, **C** is recommended (the quote lands as a plannable draft order and the
   tilbudsmail flows out with no re-keying). Decision hinges on what the engine actually emits.
2. **What does the engine produce?** Just name/email? Or also address + selected tasks + a computed
   price? This directly determines A/B vs C.
3. **Requested execution week?** `Order.plannedAt` is required with no default. If the engine knows a
   desired week, send it (Variant C) so the order lands in the right week instead of the enquiry date.
4. **Trust level of the source** — Variant B (auto-create customer, no review) is only appropriate for a
   pre-validated engine; otherwise keep the review gate (A/C-on-A).

## Still pending in the wider project (not blocking the connector)

- 🔑 **Rotate the Neon role password** — it was exposed in an earlier transcript. Neon → Roles → reset,
  then update `DATABASE_URL` + `DIRECT_URL` in Vercel and the local `.env`, and redeploy.
- ✉️ **Set `RESEND_API_KEY` + `EMAIL_FROM`** in Vercel to make quote e-mails (tilbudsmails) actually
  send — they dry-run (simulate) until then. Requires a verified sender domain at Resend.

## Key files (source of truth)

| Concern | File |
|---|---|
| Intake endpoint | `app/api/leads/route.ts` |
| Auth helpers | `lib/api-auth.ts` (`unauthorized`), `lib/session.ts` (compare idiom) |
| Rate limiter | `lib/rate-limit.ts` |
| Lead model + migration | `prisma/schema.prisma` (`model Lead`), `prisma/migrations/20260705120000_add_lead/migration.sql` |
| Lead actions (convert etc.) | `app/actions/leads.ts` |
| Emner UI | `app/leads/page.tsx`, nav entry in `lib/nav.ts` |
| Order/TaskLine (for Variant C) | `prisma/schema.prisma`, `app/actions/orders.ts` (`createOrder`), `lib/categories.ts` |
| Quote-email pipeline | `app/orders/[id]/send-tilbud/page.tsx`, `lib/quote.ts`, `components/QuoteComposer.tsx`, `app/actions/quotes.ts`, `lib/email.ts` |

## How to continue in a fresh session

1. Read this file, then read `app/api/leads/route.ts` and `app/actions/leads.ts` to ground yourself.
2. Confirm `LEAD_WEBHOOK_SECRET` is set in Vercel (endpoint returns 503 if not).
3. Decide the variant (A/B/C) with the project owner based on what the tilbudsmotor emits.
4. If Variant C: add `tasksJson` to `Lead` (+ migration via `prisma migrate diff` offline, applied by
   `prisma/migrate-prod.mjs` on deploy), extend the route validation, and materialise the draft order in
   `convertLead` — then it plugs straight into the existing `/orders/[id]/send-tilbud` pipeline.
5. Give the frontend team the API contract section above + the secret (out of band).

*Generated as a handoff; the linked source files are authoritative if anything here drifts.*
