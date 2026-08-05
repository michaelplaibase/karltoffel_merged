# Tilbudsmail — handoff brief (2026-07-30)

Context for whoever (Claude Code / a dev) picks up the remaining wiring on the
branded tilbudsmail-til-leads flow. Everything below reflects decisions made
with Michael in Slack #karltoffel-plaibase (thread "Vi skal have tilbudsmailen
op og køre").

## What's built and working

- `lib/quote-html.ts` — renders the branded HTML e-mail (Jordnær/Friture
  palette, Karltoffel wordmark). Bold system-sans fallback fonts (Snaga/Hanken
  don't survive email clients).
- `lib/quote.ts` → `buildLeadQuoteDraft(lead, company)` — builds
  `{to, subject, body, html}` from a `Lead` row's tilbudsmotor `payload` JSON.
  Groups tasks by package vs. extras (see rule below).
- `lib/email.ts` → `sendEmail()` now accepts an optional `html` field, passed
  to Resend alongside `text`.
- `app/api/mcp/route.ts` + `lib/mcp-tools.ts` — two MCP tools for Karl:
  - `draft_lead_quote(leadId)` → returns the draft incl. `html`.
  - `send_lead_quote(leadId, subject, body, html?)` → sends it, marks the lead
    `contacted`. **Hardcoded `from: "hej@karltoffel.dk"`** per Michael's
    instruction — that address must be a verified Resend sender or every send
    will fail.
- `site/assets/js/tilbudsmotor.js` — now records which pricing-page package
  the lead came in via (reusing the existing `selected_package` cookie the
  pricing page already sets on button click — see `script.js` line ~65) as
  `payload.pakke`, and tags each service with `erPakkevare` (true = one of the
  8 hardcoded Villapakken default items, false = an add-on the customer
  toggled on).
- `karltoffel/mockup/tilbudsmail_design.html` — the approved static mockup.
- `karltoffel/mockup/tilbudsmail_example_rendered.html` — actual output of
  `renderQuoteHtml()` with sample data, for reference.
- `karltoffel/karl_cs/LEAD_QUOTE_PLAYBOOK.md` — the approval loop Karl follows.

## The business rule (Michael, confirmed "approved")

- Privat kunder vælger: Villapakken, All Inclusive, eller Bland Selv.
- Erhverv kunder vælger: Erhvervspakken, eller Bland Selv.
- **Named package chosen** → show "Pakke: {navn}" clearly, then any add-ons
  under "Ekstra ydelser til ekstra heldige karltofler".
- **Bland Selv / Skræddersy selv** (no package) → flat numbered task list, no
  headers (today's behavior, unchanged).
- Known gap: `payload.pakke` is whatever pricing-page card the cookie was set
  from — there are more marketing package names on `/p/pakker-priser` (e.g.
  Sæsonpakken, Sommerhuspakken...) than the ones Michael listed. They'll all
  trigger the "package" layout too since the cookie mechanism is generic. Not
  yet confirmed whether that's desired for all of them or just the 4 named.

## The actual send flow (SUPERSEDED 2026-08-05 — see below)

The steps below describe the `karl_cs/LEAD_QUOTE_PLAYBOOK.md` MCP-tool path,
which Michael has since decided is NOT the canonical flow (2026-08-05). The
canonical, live flow is `app/api/slack/interactions/route.ts` +
`lib/slack-lead.ts`: `app/api/leads/route.ts`'s webhook already posts to
Slack synchronously on every new lead (button-driven "Godkend og send", with
rabatkode handling and the Ja/Måske/Nej accept/decline links via
`lib/quote-tokens.ts`) — no scheduler, no Karl agent wake needed. Kept below
for historical context only.

1. Lead comes in from the website (tilbudsmotoren).
2. **Kristian** gets pinged in Slack **#kundeservice** (`C0BEE4YBYCC`), tagging
   both Michael (`U0AFZKGUSKA`) and Kristian (`U0BDU2KJMDM`) — same channel/
   pattern as the existing customer-service loop (`karl_cs/PLAYBOOK.md`).
   NOT the dev channel #karltoffel-plaibase.
3. Kristian double-checks the lead details, replies "OK, send" (or edits).
4. Tilbudsmail sends from `hej@karltoffel.dk`.

## What's NOT done yet (blocked, Michael said "stop" mid-investigation)

- **No live trigger.** Nothing currently polls for new leads and wakes Karl.
  The existing Gmail customer-service loop uses a Windows Task Scheduler job
  (`karl_cs/run_check.cmd` → `run_check.py`, every 5 min) — but that job could
  not be found registered on this machine (`schtasks /query` returned
  nothing matching), so it's unclear if/where it's actually scheduled, or
  whether Karl now runs on Mac Mini instead (see `MIGRATION_WIN_TO_MACMINI.md`
  — unresolved).
- **`KARL_MCP_TOKEN` not found locally.** It's presumably Vercel-only env. A
  local polling script (mirroring `run_check.py`, calling `list_leads` over
  the MCP HTTP endpoint) needs this token available wherever the poll runs.
- **Email sending is still dry-run in practice** until `RESEND_API_KEY` is set
  on Vercel AND `hej@karltoffel.dk` is a verified Resend sender.
- No decision yet on whether *all* pricing-page package names should get the
  "package" email layout, or only the 4 Michael named.

## Suggested next steps

1. Confirm where Karl's runtime/scheduler actually lives now (Win vs Mac
   Mini) and how the existing 5-min Gmail poll is registered — copy that
   pattern for a lead-poll (`lead_check.py` + scheduled task, ~15 min
   interval, reading `KARL_MCP_TOKEN` from wherever the Gmail loop's secrets
   live).
2. Get `RESEND_API_KEY` + verify `hej@karltoffel.dk` in Resend, set both on
   Vercel.
3. Resolve the "which package names get the layout" question with Michael.
