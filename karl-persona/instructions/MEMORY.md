
## CRM-adgang: brug ALTID karl-crm MCP (2026-07-19) — KANONISK
- Hver gang Karl skal slå noget op i eller skrive til Karltoffels CRM (leads, kunder, kalender/ledig tid, bookinger, bekræftelser, service-stats, dagligt overblik), SKAL det ske via `karl-crm` MCP-serveren. Ikke direkte DB, ikke gæt, ikke opdigtede tal.
- Endpoint: `https://karltoffel-crm.vercel.app/api/mcp` (JSON-RPC/MCP, bearer `KARL_MCP_TOKEN`). Registreret i OpenClaw som MCP-server `karl-crm`.
- 7 værktøjer: `list_availability` (ledig tid), `create_booking` (opret ordre/booking), `get_customer` (slå kunde op), `send_confirmation` (send bekræftelse), `list_leads`, `service_stats`, `daily_overview` (morgenbriefing).
- Læse-opgaver → brug read-værktøjerne. Skrive-opgaver (booking/bekræftelse) → brug de tilsvarende write-værktøjer. Ingen CRM-handling uden om MCP.
- Verificeret live 2026-07-19: `daily_overview` svarer med rigtige data.

## Content pipeline (2026-07-16)
- Decision: Canva Brand Kit + Bulk Create is the primary ad-production tool (brand-exact fonts/hex/logo). Higgsfield rejected as ad-maker - generative models cannot enforce exact brand fonts/logo/hex; only usable for raw imagery/backgrounds.
- Higgsfield CLI is installed + authed as michael@plaibase.dk (starter plan). Karltoffel Soul id 8fd37fe5-c1b0-4d9b-a5e7-4babe33f3284 (weak at Danish text). Brand-kit auto-fetch from URL returned junk.
- Brand master: karltoffel/BRAND_MANUAL.md (from "Karltoffel Design guide.pdf"). Palette: Friture #FFF87B, Jordnær #4C3718, Kartoffelmos #FFFFF0, Let ristet #AE8642, Ristet #8A6931, Spire #616711, Muld #1C140B. Fonts: Snaga Uni (Black) headings, Hanken Grotesk (Semibold) body.
- Staged assets in karltoffel/brand_assets/: snaga_font/ (SnagaUniText-Black otf/ttf), logo/ (karltoffel-logo.svg, karltoffel-logo-gul.svg, appicon.png potato icon). Font came from Michael's Drive; logos pulled from karltoffel.dk/f/design/.
- Canva Pro account logged in via isolated browser. Drive brand folder: 1fEoj-52iS2BHZXftQrZyYlm10AUbZDYJ (images + 2 PDFs only, no font/logo).

## Auto-booking spec - tilbud accepteret -> kalender (2026-07-19, fra Kristian)
- Flow: kunde accepterer tilbud -> Karl finder foerste ledige hul -> viser kunden dato + ca. tidspunkt -> booker den foerste mulige tid medmindre kunden oensker andet -> opretter event i Karltoffels eget CRM-kalender -> sender bekraeftelse til kunden.
- CRM: Karltoffels eget system, har API-adgang. Michael skal give Karl adgang (kan aflaese kalendertider + skrive bookinger). BLOKERENDE forudsaetning.
- Kalender-owner lige nu: Kristian.
- Udfoerende medarbejder: "den anden Mikael", ansat som handyman. Bekraeftelse til kunden sendes DIREKTE fra den udfoerendes CRM-bruger (ikke central kundeservice - undgaa flaskehals, medarbejder ejer korrespondancen hele vejen).
- Arbejdsdag: 07-15.
- Ca. tidspunkt (vindue) er fint, ikke praecist klokkeslaet.
- Estimater: Karl estimerer varighed ud fra tilgaengelige data, human-in-the-loop indtil estimaterne sidder rigtigt.
- Book bare ind; teamet flytter rundt bagefter hvis det ikke passer.
- Event skal indeholde ALT saa udfoerende + kunde foeler sig trygge: kundenavn, adresse, opgavebeskrivelse (udfoerlig), tlf, pris.
- AFVENTER: tilbudsmail er ikke opsat endnu (kommer). Byg naar tilbudsmail + CRM-API-adgang er klar.
- KICKOFF: Karltoffel starter op mandag 2026-08-04. Karl skal minde Kristian den dag om at faa CRM-API-adgang + tilbudsmail sat op (reminder ligger i HEARTBEAT.md).
- Dagligt overblik (Kristian oensker): leads (nye i gaar + uge), performance vs i gaar, vs samme ugedag sidste uge, services mest/mindst valgt, efterspoergsel udenfor sortiment, hvad kraever handling nu, mersalg/fastholdelse. Live CRM-read - ingen tal opdigtes. Start naar CRM-adgang er live.
- Ugentlig oekonomi: mandag 09:00 beder Karl Kristian om Excel-udtraek af indtaegter (CRM har ikke udgifter) -> Karl giver indtaegt/udgift/resultat. Starter uge 2026-08-04.

## Canva MCP (2026-07-17)
- Official Canva account going forward: hej@karltoffel.dk (creds in karltoffel/CREDENTIALS.md). Replaces the old personal Pro login (mlsbrg95@gmail.com) that the managed browser was previously signed into.
- Canva MCP connected: OpenClaw server name "canva", url https://mcp.canva.com/mcp (streamable-http, OAuth), 33 tools (brand kits, brand templates, designs, export, editing, folders, assets, comments). Bound to hej@karltoffel.dk after a clean re-auth.
- Re-auth method: managed openclaw browser signed into hej@karltoffel.dk -> `openclaw mcp login canva` prints authorize URL -> open in managed browser -> approve ("Tillad") -> capture code from 127.0.0.1:8989 callback -> `openclaw mcp login canva --code <code>`.
- Canva login for hej@ needs an emailed 6-digit code. Retrieved via Karl Gmail service-account DWD impersonating hej@karltoffel.dk (scopes gmail.modify+gmail.send; readonly NOT granted). hej@ is a real impersonable mailbox.
- MCP tools were config-added mid-session; live tool exposure in an agent session needs a gateway reload/restart to pick up canva__* tools.

## Karl MCP server + auto-booking engine (2026-07-19)
Branch `feat/karl-mcp-server` → PR https://github.com/michaelplaibase/karltoffel_merged/pull/15 (base main, NOT merged).
Repo: karltoffel_merged (crm_repo), Next 16 + Prisma 6.

Files added: `lib/booking.ts` (engine), `lib/mcp-tools.ts` (tool impls), `app/api/mcp/route.ts` (JSON-RPC/MCP), `scripts/booking-smoke.ts` (10 passing assertions, `npm run smoke:booking`). Changed: `.env.example` (+KARL_MCP_TOKEN), `package.json` (+smoke script).

Engine: `findFirstAvailableSlot` = earliest free 07:00–15:00 workday slot per handyman from their existing open Orders; pure core `findSlotInSchedule` is tested. `createBooking` writes manual Order+TaskLines to the handyman. `estimateLineDurations` derives missing durations from price via Company.minutePriceOere and sets `needsConfirmation` (human-in-the-loop hook; also written into order comment "[AUTO-BOOKET af Karl — ... BEKRÆFT]").

MCP tools: list_availability, create_booking, get_customer, send_confirmation, daily_overview, list_leads, service_stats. Auth: KARL_MCP_TOKEN, constant-time (safeEqual) every request, fail-closed 503 if unset. No new npm dep (hand-rolled JSON-RPC 2.0, matches repo's SDK-free style).

KEY GAPS before 4 Aug go-live:
1. Availability is a DAILY-CAPACITY model, not true clock slots — CRM doesn't persist per-order start time (plannedAt = date at UTC midday; times are planner-derived on read). True slot availability needs a stored start-time field on Order.
2. send_confirmation can't send FROM Mikael's own address — lib/email.ts uses a single verified Resend EMAIL_FROM. Currently: handyman name in body + reply-to = employee email. Needs per-user verified sender + from-override in lib/email.ts.
3. needsConfirmation only in comment/tool result — no queryable schema field.
4. Build: prisma generate + next build compile + typecheck CLEAN; only failure is prerender of pre-existing /account (needs live DB; placeholder DATABASE_URL used). Unrelated to this change; MCP route is dynamic. Verify Vercel preview builds green with real DB.
5. Set KARL_MCP_TOKEN, and (for real sends/bookings) RESEND_API_KEY/EMAIL_FROM + GCAL vars on Vercel.

### Follow-up (2026-07-19) — GAP 1 & GAP 2 closed (same branch/PR #15, still NOT merged)
GAP 1 (true clock slots): added nullable `Order.startAt` (precise booked time within 07:00–15:00; `plannedAt` unchanged = delivery date). Migration `prisma/migrations/20260719120000_add_order_start_at/migration.sql` = nullable `ADD COLUMN` (safe, null = legacy/date-only, no backfill; not run against real DB). `findSlotInSchedule` reworked from capacity-sum to INTERVAL PACKING: legacy date-only orders reserve front-of-day capacity, orders w/ startAt occupy exact interval, new work fills earliest fitting gap, never overlaps. `findFirstAvailableSlot` reads startAt; `createBooking` persists startAt + returns startLabel/startAt. Smoke test now 15/15 (added real-clock packing: two 90-min jobs → 07:00 & 08:30, gap-fill, no-overlap, legacy+fixed mix).
GAP 2 (send AS handyman): `lib/email.ts` gained `from`/`senderName` params + `senderForUser()`. New env `KARL_SENDER_DOMAIN` (verified Resend domain) → sends from `<username>@<domain>` w/ handyman name + reply-to=their email; else falls back to EMAIL_FROM stamped w/ handyman name + reply-to. NO new User column (derives from existing username). `send_confirmation` uses employee identity + shows booked time. Documented in .env.example.
Files changed this pass: lib/booking.ts, lib/email.ts, lib/mcp-tools.ts, scripts/booking-smoke.ts, prisma/schema.prisma, .env.example, + new migration. Verified: `prisma generate` OK, `next build` compile+typecheck CLEAN (only pre-existing /account prerender fails w/o DB — expected), `npm run smoke:booking` 15/15. Commit da508d1 pushed; PR #15 body updated.
Still open: needsConfirmation still not a queryable schema field (GAP 3 unchanged); migration not applied to real DB (apply via Vercel/prisma migrate deploy); set KARL_SENDER_DOMAIN on Vercel for real per-handyman sends.

### Follow-up (2026-07-19) — Weekend auto-reply on inbound leads (same branch/PR #15, still NOT merged)
Added approved Danish weekend auto-reply to `app/api/leads/route.ts` POST. New pure helper `lib/weekend-autoreply.ts`: `isWithinWeekendWindow(date)` (Fri>=16:00 → Mon<08:00, Europe/Copenhagen via Intl.formatToParts so CEST/CET handled by tz DB, no hard-coded offset), `firstName()`, `buildWeekendAutoReply()` (subject+text, plain-text only since lib/email.ts has no HTML field). Fires ONLY on brand-new leads (dedup-merge returns early at {deduplicated:true} → auto-reply block never reached = once-per-lead). Skips if no email ("no-email"). try/catch, never blocks lead creation; response gains `autoReply: sent|skipped|outside-window|no-email|failed` mirroring existing `call` status. Sends AS company EMAIL_FROM via sendEmail (not per-handyman). Route only has full `name`; {fornavn} = first word (drops greeting name if blank). New smoke `scripts/weekend-window-smoke.ts` (`npm run smoke:weekend`) 21/21 incl. CEST+CET boundary proof (Fri 14:30 UTC = inside CEST, outside CET). Verified: prisma generate OK, next build compile+typecheck CLEAN (only pre-existing /account prerender fails w/o DB — expected). Files: lib/weekend-autoreply.ts (new), scripts/weekend-window-smoke.ts (new), app/api/leads/route.ts, package.json. Commit 5612252 pushed. Set RESEND_API_KEY/EMAIL_FROM on Vercel for real sends (else dry-run).
