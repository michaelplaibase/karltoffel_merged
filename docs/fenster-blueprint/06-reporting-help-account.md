# Fenster Partner Portal — Reporting, Day-program, Help & Account pages

Spec captured 2026-07-03 from the logged-in portal (account `KRLTFL ApS`, user `kristianklercke`, single employee `Kristian Klercke`, plan `Fenster Pro`). All pages share the standard portal chrome:

- **Top navbar** (left): brand link `Fenster Portal` (→ `/home`), then menus `Kalender` (/calendar), `Dagsprogram` (/daycalendar), `Indstillinger` (dropdown: Generelt, Udseende, Brugere, Arbejdstider, Planlægning, Rabatkoder, Standardopgaver, Regnskab, E-mail og SMS skabeloner submenu with 8 templates), `Funktioner` (Gruppebeskeder, Ferieplanlægning, Abonnementsoptimering, Prisjustering), `Kartotek` (Kunder, Abonnementer, Fastprisaftaler, Ordrer), `Rapportering` (dropdown: `Grafer og nøgletal` → /graph_reports, `Rapporter` → /report_download, `Dagsprogram i PDF` → /daycalendar_export), `Hjælp` (dropdown: `Hjælpecenter` → https://help.fenster.dk, `Kom godt i gang` → https://help.fenster.dk/da/getting-started, `Hjælpevideoer` → https://help.fenster.dk/da/videos, `Facebook gruppe` → https://www.facebook.com/groups/fensterpartnere/, `Samarbejdspartnere` → /businesspartners/, `Fenster quiz` → /quiz/, `Kontakt support` → /support/).
- **Top navbar** (right): company-name dropdown `KRLTFL ApS` with items `Fenster konto` (/account/), `Skift password` (/change_password/), `Log ud`.
- **Footer**: `Copyright © 2026` / `Powered by Fenster`.
- **Intercom messenger** bubble bottom-right (`Open Intercom Messenger`) — the primary support channel.
- Hidden global modal templates present on every page: "Internet Explorer 11 er ikke understøttet" warning, and (feature-gating) `Denne funktion er ikke inkluderet i dit Fenster abonnement` (this feature is not included in your Fenster subscription) + `Opgradering gennemført` (upgrade completed) — i.e. plan-tier gating is implemented as a global modal.

---

## Dagsprogram (`/daycalendar`)

### Purpose
Daily work-program / route list for a single day: an ordered list of the day's stops (orders) with planned time windows, addresses, customers, prices and per-order actions. This is the "driver view" of the calendar (rendered with FullCalendar list view, `table.fc-list-table`). Accepts `?date=YYYY-MM-DD` (default `?date=today`).

### Contents / Layout
- **Day toolbar** (FullCalendar toolbar):
  - `prev` / `next` icon buttons (fa-chevron-left / fa-chevron-right) — step one day back/forward.
  - An actions caret dropdown (`actions-menu`) containing one item: `Gå til ugen i kalender` (go to this week in the calendar).
  - Title block: date heading e.g. `16. nov. 2026` plus a relative subtitle line, e.g. `i dag, fredag (uge 27)` / `mandag denne uge (uge 27)` / `fredag forrige uge (uge 26)` / `mandag (uge 47)` (relative wording + ISO week number). The heading links `Gå til kalender` → `/calendar?date=<date>`.
- **Summary header row** (first row of the list table, class `fc-list-heading`):
  - `Planlagt omsætning (dag/uge/måned):` (planned revenue day/week/month) — e.g. `Kr. 2.898 / 2.898 / 14.849`.
  - `Planlagt kørsel: 1 t 14 min` (planned driving time for the day).
- **Per-stop rows** (one `tr.fc-list-item.daycal_event_view` per order, ordered by time; each stop also has a second, collapsed companion row used for the expanded/compact view). Each main row has 3 cells:
  1. (empty time cell)
  2. **Content cell** (`fc-list-item-title`): planned time window `08:30 - 09:00`; delivery address `Ørstedsvej 4, 8660 Skanderborg` (link — opens map/directions); customer name `McDonalds Stilling`; order total `Kr. 940`; and a row of small status icon-links with tooltips:
     - `Ordrens opgaver` (the order's tasks) — one small square icon per task (e.g. `fa-square-u`, `fa-square-minus` task glyphs).
     - image icon (bi-image) — order photos.
     - `Bemærkninger` (remarks/notes, bi-info-circle).
     - `Ordrehistorik` (order history, bi-card-checklist, warning color).
     - `Notifikation` (customer notification status; state class e.g. `no_order_notification`).
  3. **Action cell**: buttons
     - `Afslut ordre` (complete/close order — report the order as delivered).
     - `Rediger ordre` (edit order).
     - `Rediger abo.` (edit subscription) — link to `/subscription_edit/<id>?back_url=<current daycalendar url>`; only for subscription orders.
     - `Mere` (more) dropdown (`moreActionsMenuDayCal`) with items:
       - `Rediger næste ordre på abonnement (uge 48) ...` (edit next order on the subscription, shows its week no.)
       - `Rediger næste ordre på kunden ...` (edit customer's next order)
       - `Opret ny ordre på kunden ...` (create new order for the customer)
       - `Gå til kundedetaljer` (go to customer details)
- **Empty state**: `Ingen ordrer denne dag` (no orders this day).
- **Alert banners** (conditionally shown, dismissible ×):
  - `Planlægningen er mislykket for en eller flere ordrer i denne uge. Disse ordrer er markeret med rød k…` + `Gå til ugekalenderen for at løse det.` (planning failed for orders this week, marked with red border — go to week calendar to fix).
  - `Stor risiko for dårlig ruteplanlægning.` + link to `ugekalenderen` (high risk of poor route planning).
  - Error card `Dagsprogrammet kan ikke indlæses ordentligt` (day program cannot load properly — check connection, contact support@fenster.dk) with `Genindlæs` (reload) button.
  - `Ferielukket` (holiday-closed): "Dette er en ferieuge og kalenderen er derfor lukket. Alle abonnementsordrer er skubbet frem til efte…" (holiday week; subscription orders pushed forward).
- **Modal: `Optimér tilbageværende ordrer på dagen (beta funktion)`** (optimize remaining orders of the day, beta): re-route-optimizes all remaining (non-completed) orders of the day. Warning bullet list: all remaining orders are included incl. fully locked ones; completed/reported orders are NOT included; failed-planning (red border) orders get moved onto the day and included; time locks will not be respected; times promised via notifications will not be respected; optimization is based on current GPS location or given address; working hours are not respected (orders may be placed outside them); the action CANNOT be undone. Fields: `Vælg medarbejder` (select employee, combobox, validation `Vælg venligst en medarbejder.`), `Medarbejderens nuværende lokation` (employee's current location, text/address autocomplete) with checkbox `Brug nuværende GPS-lokation` (use current GPS location) and validation "Vælg venligst en adresse … eller brug din nuværende GPS-lokation.". Buttons: `Luk` (close), `Optimér tilbageværende ordrer` (run optimization).
- **Modals (hidden templates)**: `Genplanlægningsfunktion ikke tilgængelig` (replanning unavailable — nightly automatic replanning window; and a variant for technical maintenance).

### Fields/Filters
- URL param `date` (`today` or `YYYY-MM-DD`); no on-page employee selector on this single-employee account (employee filtering exists in the optimization modal and in the week calendar's `Medarbejdere` filter).

### Actions
- Prev/next day; `Gå til ugen i kalender`; `Gå til kalender` (same date); per-order: Afslut ordre / Rediger ordre / Rediger abo. / Mere-menu items above; route optimization (beta) modal.

### Notes
- Content loads via AJAX after page render.
- No print button on this page — printing/PDF is handled by the separate `/daycalendar_export` page.
- Revenue summary shows day / week / month planned revenue in one line; driving time is for the displayed day.

---

## Grafer og nøgletal (`/graph_reports`)

### Purpose
Charts & KPI dashboard for the business: customer counts, revenue, subscription economics, delivered-order charts and a customer map.

### Contents
Page heading `Grafer og nøgletal` (h1), then sections:

1. **`Antal kunder`** (number of customers) — KPI card group with period toggle `Sidste 12 mdr` | `År til dato` (last 12 months | year to date). 4 KPI cards (big number + title + description):
   - `Antal unikke kunder totalt` — "Unikke kunder med omsætning i perioden" (unique customers with revenue in the period).
   - `Abonnementskunder` — "Abonnementskunder med omsætning i perioden, inkl. abonnementer, der er stoppet" (subscription customers incl. stopped subscriptions).
   - `Online kunder` — "Kunder, der har bestilt online og har omsætning i perioden".
   - `Manuelt oprettede kunder` — "Kunder med manuelle ordrer og omsætning i perioden".
2. **`Omsætning`** (revenue) — same `Sidste 12 mdr` | `År til dato` toggle. 4 KPI cards (values in `DKK`):
   - `Omsætning totalt` — total revenue from all customer types.
   - `Omsætning fra abonnementskunder` — incl. stopped subscriptions.
   - `Omsætning fra online kunder` — from online orders in the period.
   - `Omsætning fra manuelt oprettede kunder` — from manually created orders.
3. **`Abonnementskunder`** (subscription customers) — 4 KPI cards, no period toggle:
   - `Gns. månedlig omsætning` (avg. monthly revenue from subscription customers) — e.g. `DKK 13.623`.
   - `Vækst i gns. månedlig omsætning` (growth in avg. monthly revenue in the current calendar year) — e.g. `DKK 13.623`.
   - `Aktive abonnementskunder` (total number of subscription customers created) — e.g. `5`.
   - `Vækst i aktive abonnementskunder` (growth in active subscription customers in the current calendar year) — e.g. `5`.
4. **Chart: `Omsætning per kundetype`** (revenue per customer type) — toggles `Uge`|`Måned` (week/month granularity) and `Søjle`|`Linje` (bar/line). X axis: months (rolling ~13, e.g. Aug…Sep); Y axis label `DKK (inkl. moms)`; X axis label `Måned`. 6 series: `Manuelle kunder (planlagt)`, `Online kunder (planlagt)`, `Abonnementskunder (planlagt)`, `Manuelle kunder (leveret)`, `Online kunder (leveret)`, `Abonnementskunder (leveret)` — i.e. planned vs delivered revenue split by customer type.
5. **Chart: `Antal leverede ordrer`** (number of delivered orders) — same `Uge`/`Måned` + `Søjle`/`Linje` toggles. Y axis `Antal ordrer`, X `Måned`. 3 series: `Manuelle kunder`, `Online kunder`, `Abonnementskunder`.
6. **Chart: `Gns. timepris og ordrestørrelse for leverede ordrer`** (avg. hourly rate and order size for delivered orders) — same toggles. Y axis `DKK (inkl. moms)`, X `Måned`. 2 series: `Gns. timepris` (avg. hourly price), `Gns. ordrestørrelse` (avg. order size).
7. **Map: `Kort over kunder med omsætning de sidste 12 mdr.`** (map of customers with revenue over last 12 months) — zoom `+`/`−` controls; marker legend by property type: `Lejlighed` (apartment), `Hus` (house), `Rækkehus` (terraced house), `Ukendt` (unknown); and by revenue bucket: `$ 0-500 DKK`, `$$ 500-1000 DKK`, `$$$ 1000+ DKK`.

### Fields/Filters
- Per-section period toggles: `Sidste 12 mdr` / `År til dato` (sections 1–2).
- Per-chart toggles: granularity `Uge`/`Måned`; chart type `Søjle`/`Linje` (charts 4–6).
- No date-picker and no employee filter on this page.

### Actions
- Toggle buttons only; charts are SVG (Plotly-style) with hover tooltips. Data loads asynchronously (title flashes "Updating…").

### Notes
- "Delivered" KPIs count only orders with revenue in the chosen period; subscription figures include stopped subscriptions (explicit in the descriptions).
- All money formatted `DKK x.xxx`, incl. VAT on the charts.

---

## Rapporter (`/report_download`)

### Purpose
Download page for data exports (no report is generated on-screen).

### Contents
Heading `Rapporter`, two report cards:

1. **`Hent ordrerapport`** (get order report) — "Download ordrerapport i Excelformat for den valgte periode" (order report in **Excel** format for the chosen period).
   - Fields: `Startdato` (start date, date input with calendar-icon picker button; defaults to first day of previous month, e.g. `2026-06-01`), `Slutdato` (end date, same, defaults to last day of previous month, e.g. `2026-06-30`).
   - Button: `Hent rapport` (submit → downloads the Excel file).
2. **`Hent abonnementer`** (get subscriptions) — "Download en rapport over alle dine aktive abonnementer i CSV format." (all active subscriptions, **CSV** format).
   - No parameters.
   - Button: `Hent rapport` (submit → downloads the CSV).

### Fields/Filters
- Only the order-report date range (`Startdato`/`Slutdato`). No format choice (fixed: Excel for orders, CSV for subscriptions), no employee filter.

### Actions
- Two `Hent rapport` submit buttons (file downloads; not exercised during this capture).

### Notes
- The PDF day program lives on its own page (below), not here.

---

## Dagsprogram i PDF (`/daycalendar_export`)

### Purpose
Export the day program as a PDF for one employee and one date.

### Contents
Heading `Dagsprogram`, one card: **`Hent dagsprogram i PDF`** — "Download dagsprogram i PDF format for den valgte medarbejder og dato" (download day program as PDF for the selected employee and date).

### Fields/Filters
- `Medarbejder` (employee) — select; options = employees (here 1 option: `Kristian Klercke`, value `1535`; preselected).
- `Dato` (date) — date input with calendar-icon picker button (empty by default; placeholder `Dato`).

### Actions
- `Hent dagsprogram` (submit → downloads the PDF; not exercised).

### Notes
- This is the print/export counterpart of `/daycalendar`; parameters are exactly employee + date, format fixed to PDF.

---

## Fenster konto (`/account/`)

### Purpose
Company/account profile: registered company info, Fenster subscription plan & legal terms, usage vs plan capacity, and billing.

### Contents
Heading `Din Fenster konto`, four sections:

1. **`Virksomhedsoplysninger`** (company information) — read-only list "Virksomheden er tilmeldt med følgende oplysninger:":
   - `Virksomhedsnavn:` KRLTFL ApS
   - `CVR:` 40941894
   - `Telefonnummer:` 51202040
   - `Email:` kristian@karltoffel.dk
   - Button `Opdatér virksomhedsoplysninger...` (update company info) → external Fillout form `https://form.fillout.com/t/qeQ8eeAmZBus?supplier=<slug>&supplier_email=<email>` (changes handled via form, not in-app).
2. **`Abonnement & vilkår`** (subscription & terms):
   - Text: "Virksomheden er tilmeldt et `Fenster Pro abonnement`." — plan tier shown inline; link `Fensters hjemmeside` → https://partner.fenster.dk/priser/ (package pricing).
   - Legal links: `privatlivspolitik` (…/legal/privacypolicy/), `forretningsbetingelser` (…/legal/termsconditions/), `databehandleraftale` (…/legal/dpa/), `liste over underdatabehandlere` (…/legal/subprocessors/).
   - Promo paragraph: `Ønsker du 10% rabat på dit Fenster abonnement?` — trial scheme: annual payment of subscription (and extra employees) for 10% discount; contact `Fenster Support` (/support/).
   - Button `Skift dit Fenster abonnement...` (change plan) → Fillout form `https://form.fillout.com/t/8CRQzd6pHBus?current_tier=Pro&supplier=<slug>&supplier_email=<email>`.
   - Button `Opsig dit Fenster abonnement` (cancel subscription) → Fillout form `https://form.fillout.com/t/ciNHhyKs97us?current_tier=Pro&…`; caption `Senest 2 arbejdsdage før fornyelse` (at latest 2 working days before renewal).
3. **`Forbrug`** (usage) — capacity meters (percent + "x af kapacitet på y", rendered as progress indicators):
   - `Antal kunder i kartoteket:` 1% (5 af kapacitet på **500**) — customers vs plan cap.
   - `Antal abonnementsaftaler i kartoteket:` 2% (5 af kapacitet på **250**) — subscription agreements vs cap.
   - `Antal online bestillinger i denne måned (juli):` 0% (0 af **50**) — online bookings this month vs monthly cap.
   - `Antal online bestillinger i sidste måned (juni):` 0% (0 af **50**).
4. **`Fakturering og betaling`** (billing & payment):
   - Button (form submit) `Opdatér betalingskort og se fakturahistorik...` (update payment card and see invoice history) → opens the Stripe customer/billing portal (POST form with hidden token).
   - Text: subscription is prepaid monthly unless otherwise agreed; ditto extra employees. SMS usage billed monthly in arrears at `37,5 øre eks. moms per SMS` (160-char SMS definition; link "her" → Twilio SMS character-limit doc). "Fenster anvender Stripe som sikker betalingsløsning" — card charged automatically when invoices are issued.

### Fields/Filters
- None editable in-app; all changes route to external Fillout forms or the Stripe portal.

### Actions
- 3 Fillout-form buttons (update company info / change plan / cancel plan) and 1 Stripe-portal submit button.

### Notes
- Plan tier (`Pro`) is passed to the Fillout forms as `current_tier` query param.
- Invoice history is NOT rendered in-app — it lives in the Stripe portal.

---

## Skift password (`/change_password/`)

### Purpose
Change the logged-in user's password. Bare Django-style form page (untranslated English labels, no portal styling on labels).

### Fields
- `Old password:` (password input)
- `New password:` (password input) with help text bullets: "Your password can't be too similar to your other personal information."; "Your password must contain at least 8 characters."; "Your password can't be a commonly used password."; "Your password can't be entirely numeric."
- `New password confirmation:` (password input)

### Actions
- `Skift password` (submit).

### Notes
- Rendered without the normal portal chrome/nav (source element `<body>`); validation texts are Django defaults in English.

---

## Samarbejdspartnere (`/businesspartners/`)

### Purpose
Curated list of partner companies offering Fenster Partners discounts/services.

### Contents
Heading `Samarbejdspartnere` + intro ("Fenster har indgået en række samarbejdsaftaler … nøje udvalgte … kvalitet, integritet og fokus på kundetilfredshed"). 4 partner cards, each with logo, one-line description and a `Læs mere...` link opening an in-page modal (`#modal-<partner>`):

1. **Dinero** — "Regnskabsprogram til selvstændige og mindre virksomheder, som kan integrere med Fenster." Modal: save **33% on Dinero Pro** for 12 months when a Fenster Partner (then normal price); requires not already being a paying Dinero user and choosing annual billing; step-by-step "Sådan gør du" starting with a free Dinero Starter account.
2. **Nordic Glass Repair** — "Professionel polering og reparation af glas, når uheldet har været ude." Modal: **10% discount** + fast help for glass damage at customers, as alternative to an insurance case (typically a few thousand kroner).
3. **Beckmann Vejledning** — "Tag din virksomhed til næste niveau med 1-1 sparring, strategi og markedsføring." (1-1 coaching, strategy, marketing.)
4. **Borgholt** — "Hos Borgholt bygger vi professionelle vinduespudserbiler, der er skræddersyet til dit arbejde og din hverdag." (custom-built window-cleaning vans.)

Footer note: suggestions for other relevant companies → write to `Fenster Support`.

### Actions
- 4 `Læs mere...` modal links; support link.

---

## Fenster quiz (`/quiz/`)

### Purpose
Self-test / learning quiz about using Fenster.

### Contents
Heading `Fenster quiz`, subheading `Hvor god du til at bruge Fenster?`. Intro copy: 20 questions total ("hverken super svære … heller ikke super nemme"); good starting point if you have practical experience or used the Hjælpecenter recently; wrong answers immediately show the correct answer so you learn; unclear questions → screenshot to Fenster Support. "Er du klar?" bullet list:
- unlimited time (`Du kan bruge lige så meget tid, som du vil`)
- unlimited retakes (`Du kan tage quiz'en ligeså mange gange, som du ønsker`)
- questions can have **multiple correct answers** (`Hvert spørgsmål kan have flere rigtige svar…`)

### Actions
- Single `Start quiz` button (inside a form; starts the 20-question flow on the same route). Questions were not exercised to avoid submitting answers.

---

## Kontakt support (`/support/`)

### Purpose
Support/contact information page. There is **no support form** — contact is via the Intercom widget or email.

### Contents
Heading `Support`, sections:
- **`Sådan kan du få hjælp`** (how to get help) — self-service resources to check first: `Fensters hjælpecenter` (https://help.fenster.dk — answers to typical questions), `Kom godt i gang` (…/da/getting-started — set up logo, areas, mobile installation etc.), `Hjælpevideoer` (…/da/videos — how the essential parts work).
- **`Kontakt`** — best contacted via "den lille runde support knap … nederst til højre på skærmen" (the round Intercom button bottom-right); alternatively email `support@fenster.dk` (mailto link). Phone/screen-sharing arranged after first writing by email.
- **`Åbningstid`** (opening hours) — normally Mon–Fri 9–15; exceptions (sickness, holiday, meetings); holidays announced in the `Facebook gruppen` (link).
- **`Svartid`** (response time) — usually within a couple of hours; small team caveat.

### Actions
- Links only (help-center links, mailto, Facebook group) + the global Intercom launcher.
