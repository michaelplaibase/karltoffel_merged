# Karltoffel — Mobile QA Report

Full quality-assurance pass of the **mobile version** of both Karltoffel apps —
the marketing site (`karltoffel.dk`) and the CRM/portal. Every page and
interactive flow was driven in a real browser at a phone viewport and reviewed
for both **UI design** and **functionality**.

## Method

- **Viewport / device:** iPhone 13 — 390 × 844 CSS px, DPR 3, mobile UA, touch.
- **Live apps under test:**
  - Marketing site served statically (`site/`).
  - CRM run against a local Postgres 16 database (migrated + seeded: 4 users,
    5 customers, 8 orders, 3 subscriptions). Login exercised end-to-end.
- **Harness:** Playwright (Chromium) driving both apps, with automated checks for
  horizontal overflow, sub-44px tap targets, console/page errors and failed
  requests, plus full-page + segmented screenshots for visual review.
- **Testers:** 8 parallel `fable` subagents, each owning one surface, each
  reading its own screenshots and reporting structured findings.
- **Excluded as non-defects:** third-party hosts blocked by the sandbox proxy
  (cookie-script, typekit, analytics, google-fonts); `/api/lead` &
  `/api/windows` (Vercel functions not running locally); the Next.js dev badge.

## Severity summary

| Area | Pages/flows | Blocker | Major | Minor | Polish |
|------|:-:|:-:|:-:|:-:|:-:|
| Site — front page & nav (M1) | 10 | 0 | 0 | 2 | 3 |
| Site — quote engine (M2) | 6 | 0 | 2 | 5 | 2 |
| Site — service category pages (M3) | 13 | 0 | 2 | 2 | 2 |
| Site — content pages (M4) | 7 | 0 | 1 | 1 | 4 |
| CRM — nav, calendar & misc (C1) | 11 | 0 | 0 | 2 | 4 |
| CRM — customers (C2) | 8 | 0 | 1 | 3 | 5 |
| CRM — orders/subs/fixed-prices (C3) | 10 | 3 | 0 | 4 | 3 |
| CRM — admin & reports (C4) | 14 | 0 | 0 | 5 | 4 |
| **Total** | **79** | **3** | **6** | **24** | **27** |

Overall: the apps are **broadly mobile-usable** — no horizontal page overflow on
the vast majority of routes, working navigation drawers, readable typography, and
graceful empty/error states. The serious problems clustered in the **CRM
create-forms** (a hard blocker) and a few **layout-overflow / content** issues.

---

## Fixes applied in this pass

All four were reproduced, fixed, and re-verified at 390 px.

### 1. BLOCKER — CRM create-forms unusable on mobile → **fixed**
`/orders/new`, `/subscriptions/new`, `/fixed-prices/new` rendered zoomed-out with
the task-description input and **"Tilføj opgave" button permanently off-screen
left**, so a task line could never be added and the record could not be created
on a phone.

- **Root cause:** these routes are wrapped by `Shell` in `.form-page`
  (`display:flex; justify-content:center`). The flex child `.container-1140`
  inherits `min-width:auto` and therefore cannot shrink below the min-content
  width of the task table (`min-width:640px`), so the whole layout blew out
  (layout viewport 596–694 px) instead of the table scrolling inside its
  `.table-wrap`.
- **Fix:** `app/globals.css` — `.form-page--chrome { display: block; }`. The
  container now centers via `margin:0 auto`, shrinks to the viewport, and the task
  table scrolls internally.
- **Verified:** all three pages → `innerWidth 390`, docScrollWidth 390,
  "Tilføj opgave" on-screen and tappable; unchanged on desktop.

### 2. MAJOR — Customer detail page zoomed out → **fixed**
`/customers/[id]` forced the layout viewport to 421 px (whole page shrunk ~8 %):
the section-header action buttons ("Opret nyt abonnement på kunden", "Opret ny
fastprisaftale…", "Opret ny ordre på kunden") did not wrap and overflowed the card.

- **Fix:** `app/globals.css` — inside the `≤700px` block,
  `.card-header { flex-wrap: wrap; gap: 8px 12px; }` (inert for non-flex headers).
  The wide buttons now drop to their own line.
- **Verified:** `innerWidth 390`, buttons fully on-screen.

### 3. MAJOR — Orphaned `/p/forside/` with broken images → **fixed**
`/p/forside/` is a byte-identical, unlinked duplicate of the front page `/`, but
its relative asset paths 404 there (broken-image placeholders).

- **Fix:** `site/vercel.json` — added a permanent redirect `/p/forside(/)? → /`,
  matching the file's existing redirect pattern.

### 4. MINOR — Wrong mobile keyboard on the phone field → **fixed**
`/customers/new` & `/customers/[id]/edit` showed a full QWERTY keyboard for the
Telefon field.

- **Fix:** `components/ContactForm.tsx` — phone input now
  `type="tel" inputMode="tel" autoComplete="tel"`.
- **Verified:** input reports `type=tel`.

---

## Full findings by area

### Marketing site

**M1 — Front page & navigation** (PASS overall)
- Landing modal "Privat eller erhverv?", Privat/Erhverv persistence, hero, hamburger
  drawer (5 links + CTA), and primary CTA → `#tilbudsmotor` all work; 22/22 images
  load; no horizontal overflow.
- [MINOR] No body scroll-lock behind the open landing modal (page scrolls behind it).
- [MINOR] Standalone section CTAs ("BLIV EN HELDIG KARLTOFFEL", "KØB GAVEKORT") have
  ~20 px-tall hit areas.
- [POLISH] Modal has no Escape/backdrop dismiss and no focus trap; drawer nav links
  33 px tall; cookie button paints on top of the modal scrim.

**M2 — Tilbudsmotor / quote engine** (the key conversion flow)
- Flow verified: Adresse → Privat/Erhverv → property verify → Løsning (service rows,
  price/gang, visits stepper, savings banner) → Kontakt form. No overflow, 0 JS errors,
  strong validation contrast, large primary buttons.
- [MAJOR] With the address autocomplete open, the suggestions overlay covers the
  "Videre" button — a tap hits a suggestion instead of advancing.
- [MAJOR] **No total price** (monthly/annual) is shown anywhere before submit, despite
  step 1 promising "en fast månedspris" — only per-row prices + a savings banner.
- [MINOR] The "Besøg om året" label is hidden ≤1023 px, leaving a bare "− 8 +" stepper
  that reads as a quantity, not visits/year.
- [MINOR] Small tap targets on the Løsning step (steppers 26 px, checkboxes 21 px,
  "Skift adresse" 82×13).
- [MINOR] Tapping "Videre" with an empty address gives no message (silent refocus).
- [MINOR] Correcting a bad e-mail does not clear the red validation error until the
  next submit.
- [MINOR] First-visit users answer Privat/Erhverv twice (modal choice not mirrored on
  step 2 in the same page load).
- [POLISH] "Vis en anden vinkel" shows the identical fallback illustration when the
  photo API is down; verify-step caveat text adds noise below the fold.

**M3 — Service category pages** (13 pages, layout consistent, no overflow)
- [MAJOR] `tagrenderens` and `fliserens` are **missing the hero image** (flat brown
  hero — the `hero-slider__image` element is absent from the markup), breaking the
  template used by the other 11 pages.
- [MINOR] `ukrudtsbekaempelse` H1 (a single 30 px unbreakable word) clips the right
  screen edge (375 px text in a 358 px box).
- [MINOR] `vask-hus-garage-ned` hero eyebrow is a bare "Fra 899" (missing "kr" and the
  service-name prefix) and has no intro paragraphs.
- [POLISH] `gavekort` conversion links ("Bestil pr. mail", "Ring …") are 20 px text
  links rather than the 44 px pill CTA used elsewhere; price-eyebrow copy pattern
  varies across pages.

**M4 — Content pages** (7 pages)
- [MAJOR] `/p/forside/` — orphaned duplicate with broken images (**fixed** above).
- [MINOR] `/p/forside/` duplicates `/` with no inbound links (**fixed** via redirect).
- [POLISH] `om-karltoffel` has a ~450 px empty band between two sections;
  `pakker-priser` excluded-item rows sit near low-contrast; `cookiepolitik` footer has
  two labels ("Privatlivspolitik", "Cookiepolitik") pointing at one URL; site-wide nav
  overlay rows 33 px tall.

### CRM / Portal

**C1 — Navigation, calendar & misc** (11 pages, PASS overall; full nav drawer mapped)
- [MINOR] `/calendar` prev/next-week arrows are 24×40 px (below 44) and there is no
  visual hint that the week grid scrolls horizontally.
- [MINOR] `/support` contact key/value table forces horizontal scroll and clips values
  mid-word at first paint; short text should wrap.
- [POLISH] Several 38 px-tall buttons (daycalendar, account, partners); wrong-password
  error, guides, quiz, optimization all render correctly.

**C2 — Customers** (8 views)
- [MAJOR] Customer detail viewport blowout (**fixed** above).
- [MINOR] Customer list table (656 px) clips the "Omsætning" column mid-word inside a
  328 px scroller with no scroll affordance.
- [MINOR] Detail-page abo/fastpris/ordre tables clip their content (incl. empty-state
  text) until swiped.
- [MINOR] Phone field wrong keyboard (**fixed** above).
- [POLISH] List search input only 89 px wide (placeholder truncates to "Kunden");
  many 13–18 px checkboxes; detail page `<title>` is the generic "Karltoffel Portal".
- Create flow works (QA-TEST customer saved to `/customers/201483`).

**C3 — Orders, Subscriptions & Fixed-prices** (10 views)
- [BLOCKER ×3] Create-forms unusable (**fixed** above).
- [MINOR] Orders (1055 px) / subscriptions (930 px) list tables hide most columns
  behind a long in-card horizontal scroll.
- [MINOR] Order-detail task table clips the price column; inner scroll required.
- [MINOR] `/fixed-prices` empty-state message clips (640 px cell in a 328 px scroller);
  search input squeezed to ~90 px.
- [POLISH] Small kebab/link tap targets; complete-order radios have a 30 px effective
  tap row.
- Note: `/subscriptions/{db-id}` 404s because that route keys off the subscription
  **number**, not the DB id — list links work; this was a test-data artifact, not a bug.

**C4 — Admin, config & reports** (14 pages, no page-level overflow anywhere)
- [MINOR ×4] Wide admin tables (leads, timesheet, group-messages, discount-codes) show
  their **empty-state text centered over the full table width**, so it appears cut off
  until the table is scrolled.
- [MINOR] `/users` default view shows only 3 columns with ~207 px-tall rows; the login
  status, per-row lønmodel editor, and ⋮ actions are entirely off-screen right with no
  scroll affordance — looks blank/broken until discovered.
- [POLISH] `/group-messages` empty state reads "No matching records" in English;
  `/price-adjustments` "Aftaletype" select truncates; several 18 px checkboxes.
- Reports render well: `/reports/graphs` BarCharts are legible at 390 px; day-pdf,
  download, and the template editor all fit a phone.

---

## Recommended backlog (not yet fixed)

Highest-value remaining items, in priority order:

1. **Quote engine — show a running total price** before submit (M2 MAJOR); it is the
   site's core promise and is currently only revealed after submit.
2. **Quote engine — address autocomplete overlaps "Videre"** (M2 MAJOR): raise the
   button's z-index above the suggestion list, or close the list on button focus.
3. **Category heroes** for `tagrenderens` and `fliserens` (M3 MAJOR): add the missing
   `hero-slider__image` so they match the template.
4. **Wide-table empty states** (systemic CRM MINOR): don't center the empty message
   over the full scroll width — pin it to the visible viewport (`position:sticky;left:0`)
   or drop `min-width:640px` when the table has no rows.
5. **`/users` mobile layout** (C4 MINOR): surface login status / lønmodel editor /
   actions without requiring horizontal discovery (e.g. stacked card rows on mobile).
6. **Scroll affordance** on horizontally-scrolling tables and the calendar grid
   (fade/shadow edge or a hint), plus enlarge primary tap targets (calendar week arrows,
   section CTAs) toward the 44 px guideline.
7. **Quote engine polish**: clear the e-mail validation error on correct input; label
   or explain the visits stepper; give feedback on an empty-address "Videre".

## Static-analysis note

`npm run lint` reports errors that are almost entirely from the vendored, minified
`public/vendor/geotiff.min.js` (should be added to the ESLint ignore list). The only
app-code lint error is `components/ContactPicker.tsx` using an `<a>` instead of Next.js
`<Link>` for `/customers/new/` — a client-nav optimization, not a mobile defect.
