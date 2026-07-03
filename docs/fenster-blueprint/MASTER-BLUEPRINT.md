# Fenster Partner Portal — MASTER BLUEPRINT (rebuild reference)

> Read-this-first synthesis for rebuilding the portal 1:1 as `karltoffel_crm`.
> Page-level detail lives in the numbered section specs (00–07). This doc captures the
> data model, relationships, and cross-cutting patterns that no single section file holds.

Captured 2026-07-03 from the live logged-in portal. Account: **KRLTFL ApS** (plan **Fenster Pro**), user `kristianklercke` / Kristian Klercke, 1 employee. Base app: `https://www.fenster.dk`.

---

## 1. What the product is

A vertical SaaS **CRM + automatic field-scheduling + billing** platform for **window-cleaning companies** (and adjacent outdoor/cleaning services). The core loop:

**Customers/contacts → Subscriptions (recurring) or Fixed-price agreements or Manual/Online orders → Orders (individual visits) → auto-planned onto a Calendar/route by an overnight optimizer → executed via the daily Dagsprogram → completed ("Afslut ordre") → invoiced via Dinero → customer notified via email/SMS.**

Differentiators to preserve: (a) a **nightly automatic route/calendar planner** with lock states, flexible working time, and driving-time modeling; (b) a **customer-facing online booking funnel** (`fenster.dk/{slug}`) with a time/price calculator; (c) deep **email/SMS notification** automation with merge variables; (d) bulk operational tools (holiday planning, subscription route optimization, price adjustments, group messages).

Tech signals (for parity, not mandatory): server-rendered Django (CSRF tokens, Django formsets `task_form-{n}-*`, Django auth password page), Bootstrap 3, jQuery, bootstrap-table (client DataTables), FullCalendar (week grid + list/day view), Plotly-style SVG charts, Google Maps links, Intercom support widget, **Dinero/Visma** accounting OAuth, **Stripe** billing portal, **Fillout** external forms for account changes.

---

## 2. Data model (entities & relationships)

```
Company/Supplier (KRLTFL ApS)  ──< User/Employee (Medarbejder)
   │  settings, plan tier, usage caps, service areas, hourly prices
   │
   ├──< Contact (Kontakt)                        # a person/company + ONE address
   │        │  is_company? → company_name, cvr, ean
   │        │  name, email, phone, address_string, note(address remark)
   │        │  per-contact invoice settings (contact_settings)
   │        │
   │        ├──< Subscription (Abonnement)        # recurring agreement at a delivery address
   │        │        base_interval + start_week; billing contact + optional different delivery contact
   │        │        special planning conditions (fixed weekdays/time/employee)
   │        │        notification overrides; images
   │        │        └──< TaskLine (Opgave)        # description, price(inkl moms), duration(min),
   │        │                                        category+color+letter, interval_multiplier, start_week
   │        │
   │        ├──< FixedPriceAgreement (Fastprisaftale)   # like a subscription but NO recurrence
   │        │        tied to a delivery address; used for manual/online orders to pre-fill price
   │        │        └──< TaskLine (no interval)
   │        │
   │        └──< Order (Ordre)                    # a single visit/event on the calendar
   │                 source (KILDE): subscription | fixed-price | manual | online
   │                 planned delivery datetime, status, employee, lock state, comment, address note
   │                 notification decision; sum + optional manual override
   │                 └──< TaskLine (Opgave)        # same shape as subscription task lines
   │
   ├──  StandardTask (Standardopgave)             # catalog of ~146 named tasks in 15 categories
   │        category, description, "customer must be present"; system tasks are locked
   │        editing propagates to everywhere the standard task is used
   │
   ├──  DiscountCode (Rabatkode)                  # code, percent, expiry — for online booking
   ├──  HolidayWeek (Ferie)                       # inclusive start/end week; closes calendar, shifts subs
   ├──  PriceAdjustmentRun (Prisjustering)        # bulk %/tiered price change of subs+fixed-price
   ├──  GroupMessage (Gruppebesked)               # one bulk email/SMS send to a customer segment
   └──  MessageTemplate (×8 types)                # email subject + shared body (email+SMS) + variables
```

Key relationship facts (verified):
- A **Contact appears as a "customer"** in `/contact_list/` only once it has ≥1 order or subscription.
- **One Contact = one address.** A separate delivery address on an order/subscription is modeled as *another Contact* selected via the reusable contact-picker (`Anden leveringsadresse` → `delivery_textarea`). The same picker widget is used everywhere.
- **Order display number = URL id** (`/order_edit/{id}`). **Subscription display "Abo. nr." ≠ URL pk** (`/subscription_edit/{pk}`; e.g. abo `235844` ↔ pk `378378`). Reproduce this id/pk split or unify deliberately.
- **TaskLine is the universal line item** — identical shape on orders, subscriptions, and fixed-price agreements (Django formset `task_form-{n}-*` with hidden `category, letter, color, staged, task_pk, semantic_meaning`). Subscriptions/orders add `interval_multiplier` + `start_week`; fixed-price omits them.
- **interval_multiplier is relative to the subscription's base_interval** (e.g. "Hver 2. gang (hver 4. uge)" when base = 2 weeks). Two special values: `På anmodning` (on request) hidden or visible in the confirmation.
- **15 task categories**, each with a fixed hex color that drives the colored letter icon everywhere: Vinduespudsning #257BB6, Rentvandsvask #469990, Tagrenderens #911eb4, Overfladerens #e5c700, Algebehandling #f58231, Overfladebeskyttelse #e6194B, Privatrengøring #3cb44b, Ejendomsrengøring #f032e6, Viceværtservice #000075, Grøn service #acd542, Ukrudtsbekæmpelse #800000, Skadedyrsbekæmpelse #42d4f4, Bilpleje #c593fe, Administrativt #9A6324, Andet #000000.

---

## 3. Complete sitemap (routes)

See `00-overview-and-routes.md` for the full table. Top-nav structure:
- **Kalender** `/calendar` · **Dagsprogram** `/daycalendar`
- **Indstillinger**: `/settings`, `/funnel_settings`, `/user_accounts`, `/working_hours/`, `/planning_settings/`, `/discount_codes`, `/standard_task_list/`, `/dinero_settings` + **E-mail/SMS skabeloner** (8 template routes)
- **Funktioner**: `/custom_message_list`, `/holiday_weeks_list/`, `/subscription_defragmentation/`, `/price_adjustment_list/`
- **Kartotek**: `/contact_list/`, `/subscription_list`, `/fixed_prices_times_list/`, `/order_event_list`
- **Rapportering**: `/graph_reports`, `/report_download`, `/daycalendar_export`
- **Hjælp** + account: `/businesspartners/`, `/quiz/`, `/support/`, `/account/`, `/change_password/`
- Entity CRUD routes: `/contact_details/{id}/`, `/contact_create/`, `/contact_edit/{id}/`, `/contact_settings/{id}/`, `/subscription_edit/{pk}`, `/subscription_create/`, `/fixed_prices_times_agreement_create/`, `/order_edit/{id}`, `/order_create/`, `/discount_code_add_new/`, `/holiday_week_details`, `/price_adjustment_create/`, `/custom_message_create`.

---

## 4. Cross-cutting UI conventions (build these ONCE, reuse everywhere)

1. **Global chrome**: fixed dark-blue top navbar with the 7 dropdown menus + right-aligned company/account menu; centered white content card on grey bg; footer `Copyright © 2026 · Powered by Fenster`; Intercom bubble bottom-right.
2. **List pages** all share one skeleton: `<h1>` + one-line grey description + a primary create button + a single free-text search (`q` param, magnifier + `Søg`) + a bootstrap-table with UPPERCASE grey headers + a first-cell caret dropdown of row actions + `forrige`/numbered/`næste` pagination. **No column filter dropdowns anywhere** — all filtering is free-text search.
3. **Settings/form pages** all share one skeleton: `<h1>` + stacked panels with `<h4>` section headings + label / control / small grey help-text per field + a single bottom **`Gem alle ændringer`** submit that persists the whole page.
4. **Contact picker** is one reusable widget used on every order/subscription/fixed-price/detail page: textarea placeholder `Klik for at fremsøge eller oprette ny kontakt`, search-or-create, `Benyt denne kontakt`.
5. **TaskLine editor** is one reusable formset component (description autocomplete against standard tasks, price, duration, computed `Timepris NNNN kr/t`, `…` save-as-standard-task menu, trash, `Tilføj opgave`). Colored category letter icon per line.
6. **Destructive/irreversible actions are two-step**: a caret menu item ending in `...` → a Bootstrap confirm modal with grey `Luk` + a red action button (`Slet …`, `Stop abonnement`). Truly irreversible ones say `kan ikke fortrydes` / `Denne handling kan ikke fortrydes`.
7. **`?back_url=<path>`** is appended to every drill-down link and drives the `Gå tilbage`/`Luk` return.
8. **Every address** anywhere renders an `Åbn i Google Maps` pin link (`maps/dir/?api=1&destination=`).
9. **Message templates**: subject input(s) + ONE plain `<textarea rows=13>` body shared by email & SMS (no WYSIWYG, no preview) + disabled `Afsender på SMS` + test-send (email/SMS) + save; `{{variable}}` merge tokens listed in a `Liste over variable felter` modal; form `submit_mode` = `send_test_email|send_test_sms|save`.
10. **Danish UI**, DKK incl. VAT (`inkl. moms`) throughout; weeks are first-class (ISO week numbers everywhere; week-selects value = Monday's ISO date). `Gem alle ændringer`, `Luk`, `Opret …`, `Rediger …`, `Slet …`, `Opdater …` are the standard verbs.

---

## 5. Plan-tier gating (Free/Pro/Premium)

Gating is implemented as a global modal `Denne funktion er ikke inkluderet i dit Fenster abonnement` (with a `kr/mdr` price table + `Opgrader`). Observed gates on the Pro account:
- **Planlægning → Tilladte opgavekategorier** (per-employee task categories): requires **Pro** (shown gated even here → likely a higher SKU nuance).
- **Abonnementsoptimering** (`/subscription_defragmentation/`): requires **Premium** AND ≥100 subscriptions (account has 5 → also shows a data-threshold disabled state).
- **SMS sender name change** + **advanced SMS**: requires **Premium** + Fenster Support.
- **SMS sending at all** is gated on an in-app approval flow (`Godkend brug af SMS`) before any SMS toggle/test works.
Usage caps on Pro: 500 customers, 250 subscriptions, 50 online bookings/month (shown as progress meters on `/account/`). Extra employee = 199 kr/mdr. SMS = 37,5 øre ex VAT each.

---

## 6. Notable behaviors to replicate

- **Nightly auto-planner**: "Planlagt i dag kl. 03:01"; `Genplanlæg uge` triggers on demand. Orders have lock states (Helt fastlåst / Delvist frigjort / Helt frigjort) governing whether the planner may move them.
- **Working hours + flexible time** feed the planner; per-employee 7-day grid with `Flekstid` (+30…+360 min).
- **Holiday planning** closes whole weeks and pushes ALL subscription orders forward from the holiday start (not just those inside it); manual/online orders are NOT auto-moved; customers NOT auto-notified; ≥1-week lead time enforced.
- **Subscription optimization** shifts week-rhythm (never intervals) to cluster nearby subs and balance weekly workload; ≤10 moves per round, each confirmed; notifies customers via the `Abonnementsflytning` template.
- **Price adjustment** is a 3-step wizard: flat or tiered-by-hourly-rate %, 8 rounding modes, agreement-type + 3 exclusion filters, customer messaging with 3 detail formats; two dates per run (notify date + effective Monday); step 1 submit is irreversible.
- **Order completion ("Afslut ordre")** presets configurable in `/settings` (Leveringsstatus / Betaling og fakturering / Betaling); per-contact override in `/contact_settings/`. → full flow captured in `07-gaps-*.md`.
- **Online booking**: public funnel at `/{slug}` (here `/krltfl`); booking notice (24h), reorder reminder (60 days), online customer referral network between partners; branding/colors/terms in `/funnel_settings`.

---

## 7. Known gaps / not directly observable (documented, mostly data/plan-gated)

- Fixed-price agreement **detail/edit** page (account had 0 agreements) — create form captured; edit route inferred `/fixed_prices_times_agreement_edit/{id}` (unverified).
- Price-adjustment wizard **steps 2–3** (irreversible step-1 submit — intentionally not entered).
- Subscription-optimization **enabled state** (Premium + ≥100 subs) — copy/dialogs captured, live maps/proposals not.
- Discount-code **row actions** (empty table).
- Standard-task **create/edit modal**, **Afslut ordre** flow, calendar event **submenus**, **prisberegner** → being captured in `07-gaps-*.md`.
- Public **booking funnel** (`/krltfl`) is customer-facing (out of the "logged-in" scope) but is the counterpart to `/funnel_settings`.

---

## 8. Suggested build approach for `karltoffel_crm`

- **Reuse-first**: implement the ~6 shared components in §4 first (AppShell/nav, ListPage, SettingsForm, ContactPicker, TaskLineEditor, ConfirmModal, TemplateEditor). Every page is a composition of these + entity-specific fields.
- **Data**: Contact, Subscription, FixedPriceAgreement, Order, TaskLine, StandardTask (+seed the 146-row catalog & 15 categories), User, DiscountCode, HolidayWeek, PriceAdjustmentRun, GroupMessage, MessageTemplate, CompanySettings.
- **Suggested stack** (confirm with user): Next.js + TypeScript + Tailwind + a component lib, Postgres/Prisma; FullCalendar for the week grid; a queue/cron for the nightly planner; keep Danish strings in an i18n dictionary from day one (all captured verbatim in the specs).
- **Phase order**: (1) shell + Kartotek CRUD (Contacts/Subscriptions/Orders) + TaskLine; (2) Calendar + Dagsprogram + Afslut ordre; (3) Settings + Templates; (4) Funktioner (holiday/optimize/price-adjust/group msg); (5) Reporting + Account; (6) planner engine + online funnel.
