# 05 — Kartotek (Register / Records)

Spec for the `Kartotek` menu of the Fenster Partner Portal (https://www.fenster.dk), captured live from a logged-in session (partner: KRLTFL ApS, user "kristianklercke") on 2026-07-03. All Danish UI strings are verbatim in backticks with English translations in parentheses. All observations are from the real DOM (accessibility tree + JavaScript form-field dumps); nothing was saved or submitted.

## Kartotek menu (top navigation)

Top nav item `Kartotek` (Register) is a dropdown with exactly four entries:

| Danish | English | Route |
|---|---|---|
| `Kunder` | Customers | `/contact_list/` |
| `Abonnementer` | Subscriptions | `/subscription_list` |
| `Fastprisaftaler` | Fixed-price agreements | `/fixed_prices_times_list/` |
| `Ordrer` | Orders | `/order_event_list` |

Shared page chrome on every list page: blue navbar (`Kalender`, `Dagsprogram`, `Indstillinger`, `Funktioner`, `Kartotek`, `Rapportering`, `Hjælp`, and right-aligned account menu `KRLTFL ApS` → `Fenster konto` /account/, `Skift password` /change_password/, `Log ud`), white content card centered on grey background, footer `Copyright © 2026 · Powered by Fenster`, Intercom chat bubble bottom-right.

Common list-page skeleton: `<h1>` heading, one-line grey description, primary create button, search form (magnifier icon + text input + `Søg` (Search) submit button), striped table with uppercase grey column headers, per-row dropdown-caret action menu in the first cell, and pagination `forrige` (previous) / numbered pages / `næste` (next). Search is a single free-text field (no separate filter dropdowns anywhere in Kartotek); it submits as query-string param `q`.

---

## Kunder — customer list (`/contact_list/`)

**Purpose:** `Oversigt over kunder` (Overview of customers). Description: `Oversigten viser alle kunder, dvs. kontakter med én eller flere ordrer eller abonnementer.` (Shows all customers, i.e. contacts with one or more orders or subscriptions.) Note the data model distinction: a *contact* only appears here once it has ≥1 order or subscription.

### Columns

| Column (DA) | Tooltip/full label | English | Cell content |
|---|---|---|---|
| `KUNDENR.` | `Kundenr.` | Customer no. | Numeric id (e.g. 201482); links to customer detail |
| `KUNDE` | `Kunde` | Customer | Multi-line block: name (may include company suffix in parentheses), street address line, postcode + city, optional `Att: <name>` line, phone (`+45 …`), email. Name links to detail (`Se kundedetaljer`); address has an `Åbn i Google Maps` pin-icon link (`https://www.google.com/maps/dir/?api=1&destination=<address>`) |
| `OMSÆTNING ÅTD` | `Omsætning år-til-dato` | Revenue year-to-date | Amount `kr. N` or `-` when zero |
| `GNS. OMS/ÅR FRA ABO.` | `Gennemsnitlig omsætning per år fra abonnement` | Avg. yearly revenue from subscriptions | `kr. N` (e.g. `kr. 34.852`) |
| `ANTAL ABO.` | `Antal abonnementer` | Number of subscriptions | Integer |

Rows sort by customer number descending (newest first) by default; no visible sort controls.

### Filters/Search

- Single search input, placeholder: `Kundenr, navn, email, tlf, vejnavn, husnr., postnr.` (customer no., name, email, phone, street name, house no., postcode) + `Søg` submit button. No other filters.

### Row actions (caret dropdown, first cell)

- `Se kundedetaljer` (View customer details) → `/contact_details/{id}?back_url=/contact_list/`
- `Slet kunde...` (Delete customer…) → opens one of two modals:
  - Guard modal `Kunden kan ikke slettes` (Customer cannot be deleted) with one of three messages: `Kunden kan ikke slettes, da der findes en eller flere uafsluttede ordrer på kunden. …` (uncompleted orders exist) / `…et eller flere aktive abonnementer på kunden. …` (active subscriptions exist) / `…et eller flere aktive abonnementer samt uafsluttede ordrer på kunden…` (both). Button: `Luk` (Close).
  - Confirm modal `Bekræftelse` (Confirmation): `Er du sikker på at du vil slette kunden? Ordrer på kunden, som allerede er afsluttede…` Buttons: `Luk`, `Slet kunde` (Delete customer, red).

### Header actions

- `Opret ny kontakt` (Create new contact) button above the search → opens `/contact_create/` in a new tab.

### Pagination

`forrige` · page numbers (`1`, `2`, `...`) · `næste`.

---

## Customer detail (`/contact_details/{id}/`)

Observed URL: `https://www.fenster.dk/contact_details/201482/` (server adds trailing slash; list links carry `?back_url=/contact_list/`). Top-right button `Gå tilbage` (Go back) returns to `back_url`.

Heading `Kundedetaljer` (Customer details). Description: `Denne side viser informationer om en specifik kunde, bl.a. kundens abonnementer, fastprisaftaler og ordrer.`

The page is a single scrolling page with 5 sections (no tabs). Note: the rendered page body is embedded in an iframe of the same URL.

### Section 1: `Kundens kontaktinfo` (Customer's contact info) — top-left

- Read-only summary box showing: name, `street, postcode city`, `phone, email` (e.g. "Hospitalsgade 6-8 (Nordic Sport Invest 2) / Hospitalsgade 6, 8700 Horsens / +45 51202040, kristian@karltoffel.dk").
- The box doubles as a contact picker: a textarea (name `billing_textarea`-style widget) with placeholder `Klik for at fremsøge eller oprette ny kontakt` (Click to search for or create a new contact) and helper `Vælg eksisterende kontakt eller opret ny kontakt via dropdown listen`. Choosing a different contact re-assigns the record (button `Benyt denne kontakt` (Use this contact) exists in the picker flow).
- Buttons: `Rediger kontaktinfo` (Edit contact info) → opens **`/contact_edit/{id}/?callback_id=contact_info_wrap&contact_role=none`** in a new tab; `Opret ny kontakt` → `/contact_create/`.
- Validation string present in template: `Udfyld venligst feltet for "Anden leveringsadresse", eller fravælg feltet igen.` (Fill the "Different delivery address" field or untick it.)

### Section 2: `Kundens indstillinger` (Customer settings) — top-right

- Text: `Klik for at redigere kundens indstillinger`; button `Rediger indstillinger` (Edit settings) → opens **`/contact_settings/{id}/`** in a new tab (see below).

### Section 3: `Kundens abonnementer` (Customer's subscriptions)

- Description: `Viser alle kundens abonnementer.`
- Button `Opret nyt abonnement på kunden` (Create new subscription for the customer) → `/subscription_create/?back_url=<this page>&for_contact={id}` (customer pre-filled).
- Table columns: `ABO. NR.` (subscription no.), `KUNDE` (customer), `LEVERINGSADRESSE` (delivery address, with Google Maps pin), `OPGAVER` (tasks — one line per task, each prefixed with a colored square letter icon whose tooltip is `Kategori: <category>`, e.g. `Kategori: Viceværtservice`), `INTERVAL` (one per task, e.g. `Hver 2. uge`), `PRIS` (one per task, e.g. `811 kr`), `FAST MEDARBEJDER` (fixed employee; `Ingen` = none), `AFSLUTTEDE ORDRER` (completed orders), `FREMTIDIGE ORDRER` (future orders: next week `Uge 29` + link `(uge 29, 31, 33 ...)` = `Se fremtidige ordrer for abonnementet` → `/order_event_list?q=%23<id>,%23<id>,…` and `Se alle ordrer` = `Se alle ordrer for abonnementet` → same pattern with historic ids included).
- Row caret menu: `Rediger abonnement` (Edit subscription) → `/subscription_edit/{sub_pk}?back_url=/contact_details/{id}/`; `Stop abonnement...` (Stop subscription…) → modal:
  - Heading `Vil du stoppe abonnementet?` (Do you want to stop the subscription?), body `Er du sikker på, at du vil stoppe abonnementet?` plus checkbox `Klik her, hvis du vil beholde den førstkommende ordre fra dette abonnement i kalenderen ().` (keep the next upcoming order in the calendar) with conditional notes `Kunden er allerede blevet notificeret.` / `Kunden er ikke blevet notificeret.` Buttons: `Luk`, `Stop abonnement` (red).
- **Important id mapping:** displayed `Abo. nr.` (235844) differs from the URL pk (`/subscription_edit/378378`). Lists display the abo number; links use the internal pk.

### Section 4: `Kundens fastprisaftaler` (Customer's fixed-price agreements)

- Description: `Viser kundens fastprisaftaler. En fastprisaftale er knyttet til en leveringsadresse og anvendes, når du opretter en manuel ordre (f.eks. ringekunde), eller hvis der bliver lagt en online bestilling på adressen.`
- Table columns: `AFTALE NR.` (agreement no.), `LEVERINGSADRESSE`, `OPGAVER`, `PRIS`. Empty state: `Ingen fastprisaftaler fundet for kunden`.
- Delete confirm modal exists: `Bekræftelse` — `Er du sikker på, at du vil slette fastprisaftalen?` Buttons `Luk` / `Slet fastprisaftale`.

### Section 5: `Kundens ordrer` (Customer's orders)

- Description: `Viser alle online og manuelle ordrer, samt førstkommende og historiske abonnementsordrer for kunden.` (Shows all online and manual orders plus next-upcoming and historic subscription orders. NB: only the *next* order of each subscription cycle exists as a row; far-future ones are materialized progressively.)
- Button `Opret ny ordre på kunden` (Create new order for the customer) → navigates same-tab to `/order_create/?back_url=<this page>&for_contact={id}`.
- Table columns: `ORDRE NR.`, `KUNDE`, `LEVERINGSADRESSE` (with Google Maps pin), `LEVERINGS-DATO` (delivery date, ISO `2026-07-13`; rendered orange/highlighted with tooltip `Ordren er ikke afsluttet` (order not completed) when date is past, tooltip `Ordren ligger i fremtiden` (order is in the future) otherwise), `OPGAVER` (task lines with category icons), `PRIS` (per task), `MEDARBEJDER` (employee full name), `ORDRESTATUS` (e.g. `Afventer levering, ikke afsluttet eller indmeldt` = awaiting delivery, not completed or reported), `KILDE` (source, e.g. `Abo. #235844` as a link that opens the subscription editor).
- Row caret menu (6 items): `Vis ordre i kalender` (Show order in calendar), `Rediger ordre` (Edit order) → `/order_edit/{order_id}?back_url=/contact_details/{id}/`, `Afslut ordre...` (Complete order…), `Slet ordre...` (Delete order… → confirm modal `Er du sikker på, at du vil slette ordren?` with `Luk`/`Slet ordre`), `Opret ny ordre` (Create new order), `Rediger abonnement` (Edit the source subscription).

---

## Contact create / edit form (`/contact_create/`, `/contact_edit/{id}/`)

Both render the identical form; create is titled `Opret ny kontakt`, edit is titled `Rediger kontakt #201482`. Edit is opened with `?callback_id=contact_info_wrap&contact_role=none` when launched from the detail page (callback updates the opener).

### Fields

| Label (DA) | English | Input name | Type | Notes |
|---|---|---|---|---|
| `Kontakttype` → `Virksomhed` | Contact type → Company | `is_company` | checkbox | When checked, reveals the 3 company fields below |
| `Virksomhedsnavn` | Company name | `company_name` | text | hidden until `is_company` |
| `CVR-nummer` | CVR (business reg.) number | `cvr` | text | hidden until `is_company` |
| `EAN-nummer` | EAN number | `ean` | text | hidden until `is_company`; help: `Faktura sendes elektronisk via EAN, såfremt et EAN-nummer er angivet.` (Invoice is sent electronically via EAN if an EAN number is provided.) |
| `Navn` | Name | `name` | text | contact person name |
| `E-mail` | E-mail | `email` | email | |
| `Telefon` | Phone | `phone` | text | |
| `Adresse` | Address | `address_string` | text | address autocomplete; duplicate-address validation message: `Adressen er allerede i brug` (The address is already in use) |
| `Adressebemærkning` | Address remark | `note` | textarea | help: `Internt notat, der relaterer sig til adressen (kontakten)` (Internal note relating to the address (the contact)) |

### Actions

- `Luk` (Close, grey) — closes without saving.
- `Opret kontakt` (Create contact) on create / `Opdater kontakt` (Update contact) on edit — submit (never triggered during capture).
- Hidden in-picker button `Benyt denne kontakt` (Use this contact).

---

## Contact settings (`/contact_settings/{id}/`)

Modal-style page titled `Rediger indstillinger for <name>` (Edit settings for <name>). Per-customer invoicing overrides.

### Fields

| Label (DA) | English | Input name | Type | Help text |
|---|---|---|---|---|
| `Fjern leveringsadresse fra fakturalinje` — checkbox label `Ja` | Remove delivery address from invoice line | `skip_delivery_address_on_invoice_item` | checkbox | `Hvis markeret, så fjernes leveringsadressen fra fakturalinjen, hvor den normalt bliver vist sammen med ordrenummer og leveringsdato.` |
| `Tilføj leverings-kontaktnavn til fakturalinje` — checkbox label `Ja` | Add delivery contact name to invoice line | `show_delivery_name_on_invoice_item` | checkbox | `Hvis markeret, så tilføjes leveringskontaktens navn til fakturalinjen, så den bliver vist sammen med ordrenummer, leveringsdato og leveringsadresse.` |
| `Undlad at sende faktura via SMS` — checkbox label `Send ikke via SMS` | Do not send invoice via SMS | `skip_sending_invoice_over_sms` | checkbox | `Hvis markeret, så undlader Fenster at sende fakturaen via SMS, selvom SMS er valgt under generelle indstillinger. Det kan f.eks. bruges til erhvervskunder, der ikke ønsker SMS.` |
| `Forudindstilling for 'Betaling og fakturering'` | Preset for "Payment and invoicing" | `invoice_choice_preselect` | radio group (7) | `Vælg hvordan sektionen "Betaling og Fakturering" på siden "Afslut ordre" skal forudindstilles for denne kunde. Indstillingen overskriver den generelle standardindstilling.` |

Radio options (default = first): `Anvend standardindstilling` (Use default setting) · `Blank (ingen forudindstilling)` · `Send faktura - ubetalt` (Send invoice - unpaid) · `Send faktura - betalt kontant` (Send invoice - paid cash) · `Send ikke faktura fra Fenster` (Do not send invoice from Fenster) · `Opret fakturakladde` (Create invoice draft) · `Registrer på et senere tidspunkt` (Register at a later time).

### Actions

`Luk` · `Gem kontaktindstillinger` (Save contact settings).

---

## Abonnementer — subscription list (`/subscription_list`)

**Purpose:** `Oversigt over abonnementer`. Description: `Oversigten viser alle aktive abonnementer.` (Shows all *active* subscriptions — stopped ones disappear from this list.)

### Columns

| Column (DA) | English | Cell content |
|---|---|---|
| `ABO. NR.` | Subscription no. | Display number (e.g. 235844), links to editor |
| `KUNDE` | Customer | Full contact block (name, address, `Att:`, phone, email); name = `Se kundedetaljer` link → `/contact_details/{contact_id}?back_url=` |
| `LEVERINGSADRESSE` | Delivery address | Name + address + `Åbn i Google Maps` pin |
| `OPGAVER` | Tasks | One line per task line with colored category letter icon (tooltip `Kategori: <cat>`) |
| `INTERVAL` | Interval | Per task, e.g. `Hver uge`, `Hver 2. uge`, `Hver 48. uge` |
| `PRIS` | Price | Per task, `NNN kr` (incl. VAT) |
| `FAST MEDARBEJDER` | Fixed employee | `Ingen` or employee name |
| `AFSLUTTEDE ORDRER` | Completed orders | count/blank |
| `FREMTIDIGE ORDRER` | Future orders | `Uge NN` + `(uge 28, 30, 32 ...)` link (`Se fremtidige ordrer for abonnementet`) + `Se alle ordrer` link (`Se alle ordrer for abonnementet`), both → `/order_event_list?q=%23<orderid>,%23<orderid>,…` |

### Filters/Search

- Search input placeholder: `Abo. nr, dato, kundenavn, kundenr, email, tlf, vejnavn, husnr, postnr, opgave` + `Søg`. No other filters.

### Row actions (caret dropdown)

- `Rediger abonnement` → `/subscription_edit/{pk}?back_url=/subscription_list`
- `Stop abonnement...` → same stop-confirmation modal as described under customer detail.

### Header actions

- `Opret nyt abonnement` (Create new subscription) → `/subscription_create/`.

### Pagination

`forrige` / `1` / `næste`.

---

## Subscription detail/editor (`/subscription_edit/{pk}`)

Observed: `https://www.fenster.dk/subscription_edit/378378?back_url=…` renders `Rediger abonnement #235844` — **URL pk (378378) ≠ displayed abo. nr. (235844)**. The create twin is **`/subscription_create/`**, optional `?for_contact={contact_id}` pre-fills the customer (verified: billing picker pre-populated). Sections in order:

### Section: `Status` (edit only)

Info panel, e.g.: `Næste ordre på dette abonnement er planlagt til uge 29.` (Next order planned for week 29) and `Næste ordre (uge 29) er ikke fastlåst endnu.` (Next order not locked yet.)

### Section: `Kunde` (Customer)

- `Fakturerings- og leveringsadresse` (Billing and delivery address): contact-picker textarea (name `billing_textarea`, placeholder `Klik for at fremsøge eller oprette ny kontakt`) showing the selected contact's summary; button `Rediger kontaktinfo` (edit page only) and `Opret ny kontakt` in the picker.
- Checkbox `Anden leveringsadresse` (`delivery_different_contact`, label `Ja`) — when checked reveals a second contact picker `delivery_textarea` for a separate delivery address.

### Section: `Opgaver på abonnementet` (Tasks on the subscription)

- Button `Vælg basis-interval og startuge` (Choose base interval and start week) opens a chooser; result shown in read-only textbox `base_interval_start_week_display`, e.g. `Basis-interval: Hver 2. uge med startuge 29`. Backing selects:
  - `base_interval` options: `` (blank), `Hver uge`, `Hver 2. uge`, `Hver 3. uge`, `Hver 4. uge`, `Hver 5. uge`, `Hver 6. uge`, `Hver 8. uge`, `Hver 10. uge`, `Hver 12. uge`, `Hver 13. uge`, `Hver 16. uge`, `Hver 24. uge`, `Hver 26. uge`, `Hver 36. uge`, `Hver 48. uge`, `Hver 52. uge`.
  - `base_start_week` options: coming weeks as `Uge 27, 2026 (29/6 - 5/7)` …, value = ISO Monday date (e.g. `2026-07-13`).
- **Task lines** (Django-style formset, field prefix `task_form-{n}-`), table headers: `Opgavebeskrivelse` (Task description) · person-icon column (`Kunde tilstede`) · `Pris (inkl. moms)` (Price incl. VAT) · `Varighed (min.)` (Duration min.) · `Interval` · `Næste gang` (Next time). Per line:
  - `description` (text, placeholder `Fremsøg eller opret ny opgave` = Search for or create new task; autocompletes standard tasks; badge `Dette er en standardopgave` (This is a standard task) when linked, and a computed hourly rate `Timepris NNNN kr/t` under the line).
  - `customer_presence_required` (checkbox, label `Kunde tilstede` = customer present).
  - `price` (number), `duration` (number, minutes).
  - `interval_multiplier` (select, 26 options): `På anmodning - (skjult i abo. bekræftelse)` (On request – hidden in subscription confirmation), `På anmodning - (synlig i abo. bekræftelse)` (…visible…), `Hver gang (hver 2. uge)`, `Hver 2. gang (hver 4. uge)`, `Hver 3. gang (hver 6. uge)`, `Hver 4. gang (hver 8. uge)`, `Hver 5. gang (hver 10. uge)`, `Hver 6. gang (hver 12. uge)`, `Hver 7. gang (hver 14. uge)`, `Hver 8. gang (hver 16. uge)`, `Hver 9. gang (hver 18. uge)`, `Hver 10. gang (hver 20. uge)`, `Hver 11. gang (hver 22. uge)`, `Hver 12. gang (hver 24. uge)`, `Hver 13. gang (hver 26. uge)`, `Hver 14. gang (hver 28. uge)`, `Hver 15. gang (hver 30. uge)`, `Hver 16. gang (hver 32. uge)`, `Hver 24. gang (hver 48. uge)`, `Hver 26. gang (hver 52. uge)`, `Hver 36. gang (hver 72. uge)`, `Hver 48. gang (hver 96. uge)`, `Hver 52. gang (hver 104. uge)`, `Hver 78. gang (hver 156. uge)`, `Hver 104. gang (hver 208. uge)` — i.e. multiplier × base interval; parenthetical week counts are computed from the base interval (on `/subscription_create/` before a base is chosen they render without parentheses). Help below: `Dvs. hver X. uge` (i.e. every X weeks).
  - `start_week` (select, `Næste gang`): upcoming allowed weeks `Uge 29, 2026 (13/7 - 19/7)` … help below: `Dvs. uge 29, 31, 33, ...` (i.e. weeks …).
  - `…` (ellipsis) dropdown per line (field `save_as`): `Opret som ny standardopgave` (Create as new standard task) / `Rediger standardopgave` (Edit standard task).
  - Trash icon = `Fjern opgave` (Remove task; backing `DELETE` checkbox).
  - Hidden per-line fields: `category`, `letter`, `color`, `staged`, `task_pk`, `semantic_meaning`.
- Button `Tilføj opgave` (Add task) — appends another blank line inline (no modal).
- Standard-task categories (radio `task_category`, value format `Name___#hex`, used when saving a line as a new standard task): `Vinduespudsning` #257BB6, `Rentvandsvask` #469990, `Tagrenderens` #911eb4, `Overfladerens` #e5c700, `Algebehandling` #f58231, `Overfladebeskyttelse` #e6194B, `Privatrengøring` #3cb44b, `Ejendomsrengøring` #f032e6, `Viceværtservice` #000075, `Grøn service` #acd542, `Ukrudtsbekæmpelse` #800000, `Skadedyrsbekæmpelse` #42d4f4, `Bilpleje` #c593fe, `Administrativt` #9A6324, `Andet` #000000. (The category gives each task its colored letter icon.)
- Auxiliary modal buttons observed in the DOM for the standard-task pick flow: `Afbryd` (Cancel), `Overskriv eksisterende med ny` (Overwrite existing with new), `Behold eksisterende og indsæt ny` (Keep existing and insert new), `Vælg` (Choose), `Forsæt` (Continue), `Tilbage` (Back); concurrency guard buttons `Luk uden at gemme` (Close without saving) / `Hent nyeste version` (Fetch latest version).

### Section: `Billeder` (Images)

- Empty state `Der er ingen billeder på abonnementet` (There are no images on the subscription); button `Tilføj/rediger billeder` (Add/edit images) → upload modal with `Tilføj billeder ()` and `Færdig` (Done).

### Section: `Særlige betingelser for planlægning` (Special planning conditions)

- `Ugedage` (Weekdays): dropdown widget defaulting to `Vælges automatisk` (Chosen automatically); multi-select of weekdays backed by hidden input `fixed_weekdays` (digit string, observed `1234560` = Mon–Sun). Tooltip: `Valgfrit: Vælg hvilke ugedage, som den automatiske planlægning må anvende. Brug evt. shift-knappen.`
- `Klokkeslæt` (Time of day): text `fixed_time_of_day`; checkbox `til` (to, `fixed_time_of_day_interval_checkbox`) converts it to a from/to interval revealing `fixed_time_of_day_interval_start` / `fixed_time_of_day_interval_end` (sub-label `Klokkeslæt/interval`).
- `Medarbejder` (Employee): select `fixed_employee` — options `Vælges automatisk` + one entry per employee (here `Kristian Klercke`).
- Checkbox `Særlige betingelser for ugedage og klokkeslæt/interval skal kun tages i brug, når kunden skal være tilstede` (only apply the weekday/time constraints when customer presence is required), name `time_constraints_only_apply_when_customer_presence_required`, label `Ja`.

### Section: `Notifikationer` (Notifications)

- Intro: `Notifikationer sendes til leveringsadressen (såfremt det er indstillet, at der skal afsendes notifikationer).`
- Checkbox `Overskriv standard-indstillinger` (Override default settings), name `noti_override_generic_settings` — when checked reveals:
  - Channel checkboxes `SMS` (`noti_send_as_sms`) and `E-mail` (`noti_send_as_email`).
  - `noti_when_customer_presence_required` (select): `Nej, send ikke` (No, don't send), `Ja, med dato` (Yes, with date), `Ja, med dato og tidsinterval (-1t → +2t)`, `Ja, med dato og tidsinterval (-1t → +1t)`, `Ja, med dato og klokkeslæt` (…with date and exact time). Paired `noti_days_before_delivery_when_customer_presence_required` (number, default 3).
  - Identical pair for when presence is NOT required: `noti_when_customer_presence_not_required` (same 5 options) + `noti_days_before_delivery_when_customer_presence_not_required` (number, default 3).
  - Checkbox `noti_send_after_delivery`, label `Ja` (send after-delivery notification).

### Section: `Adressebemærkning` (Address remark)

- Textarea `address_comment`, help `Valgfrit, internt notat, der relaterer sig til leveringsadressen` (optional internal note relating to the delivery address). Observed value: "Det er både nummer 6 og 8".

### Section: `Abonnementsbekræftelse` (Subscription confirmation)

- `send_confirm_email` checkbox — edit: `Send opdateret bekræftelse til kunden på email` (Send updated confirmation by email); create: `Send bekræftelse til kunden på email`.
- `send_confirm_sms` checkbox — `Send (opdateret) bekræftelse til kunden på SMS`.
- `send_confirm_attach_tos` checkbox — `Vedhæft handelsbetingelser til bekræftelsen (email/sms)` (Attach terms & conditions).

### Footer actions

- `Luk` (grey) · `Stop abonnement` (red, edit only; same stop modal) · `Opdater abonnement` (Update subscription, blue) / on create: `Opret abonnement` (Create subscription).

---

## Fastprisaftaler — fixed-price agreements list (`/fixed_prices_times_list/`)

**Purpose:** `Oversigt over fastprisaftaler`. Description: `En fastprisaftale er knyttet til en leveringsadresse. Den anvendes for kunder, der ikke har et abonnement, f.eks., hvis man opretter en manuel ordre i kalenderen, eller hvis kunden afgiver en online bestilling.` (A fixed-price agreement is tied to a delivery address; used for non-subscription customers when creating a manual order or when the customer places an online booking — it pre-fills the price for the address.)

### Columns

| Column (DA) | English |
|---|---|
| `AFTALE NR.` | Agreement no. |
| `LEVERINGSADRESSE` | Delivery address |
| `OPGAVER` | Tasks |
| `PRIS` | Price |

Empty state observed: `Ingen fastprisaftaler fundet` (No fixed-price agreements found). **No records existed in this account**, so the row layout/actions and the edit route could not be observed directly; per the customer-detail page a delete action exists (`Slet fastprisaftale` confirm modal), and rows presumably mirror the subscription-list pattern (edit + delete in a caret menu).

### Filters/Search

- Search input placeholder: `kundenavn, kundenr, email, tlf, vejnavn, husnr, postnr` + `Søg`.

### Header actions

- `Opret ny fastprisaftale` (Create new fixed-price agreement) → navigates same-tab to **`/fixed_prices_times_agreement_create/?back_url=https://www.fenster.dk/fixed_prices_times_list/`**.

## Fixed-price agreement create (`/fixed_prices_times_agreement_create/`)

Modal-style page, blue header bar `Opret fastprisaftale`.

### Fields

- `Leveringsadresse` (Delivery address): contact picker textarea (`contact_textarea`, placeholder `Klik for at fremsøge eller oprette ny kontakt`).
- Help: `En fastprisaftale indeholder en eller flere opgaver, der er knyttet til en leveringsadresse. Den anvendes for kunder, der ikke har et abonnement, f.eks., hvis man opretter en manuel ordre i kalenderen, eller hvis kunden afgiver en online bestilling.`
- Section `Pris og varighed` (Price and duration): task-line formset (`task_form-{n}-…`, same hidden fields as subscriptions but **no** interval/start-week): `Opgavebeskrivelse` (`description`, placeholder `Fremsøg eller opret ny opgave`) · `Kunde tilstede` checkbox (`customer_presence_required`, person icon) · `Pris (inkl. moms)` (`price`) · `Varighed (min.)` (`duration`) · `…` save-as menu · trash (`DELETE`). Button `Tilføj opgave` adds a line.

### Actions

`Luk` (grey) · `Opret fastprisaftale` (blue). Edit route not observed (no data); expected sibling `/fixed_prices_times_agreement_edit/{id}` — **unverified**.

---

## Ordrer — orders list (`/order_event_list`)

**Purpose:** `Oversigt over ordrer`. Description: `Oversigten viser alle ordrer i kalenderen både i fortiden og fremtiden. Du kan søge på f.eks. ordrenr, dato, kundenavn, email, telefon, vejnavn, husnummer, postnummer mv.` (Shows all orders in the calendar, past and future.)

### Columns

| Column (DA) | English | Cell content |
|---|---|---|
| `ORDRE NR.` | Order no. | e.g. 2080056; links to `/order_edit/{id}` |
| `KUNDE` | Customer | Full contact block (name, address, `Att:`, phone, email) |
| `LEVERINGSADRESSE` | Delivery address | Name + address + Google Maps pin |
| `LEVERINGS-DATO` | Delivery date | ISO date `2027-01-04`; orange when overdue (tooltip `Ordren er ikke afsluttet`), normal with tooltip `Ordren ligger i fremtiden` for future |
| `OPGAVER` | Tasks | Task lines with colored category letter icons |
| `PRIS` | Price | Per task, `NNN kr` |
| `MEDARBEJDER` | Employee | e.g. `Kristian Klercke` |
| `ORDRESTATUS` | Order status | e.g. `Afventer levering, ikke afsluttet eller indmeldt` (Awaiting delivery, not completed or reported) |
| `KILDE` | Source | `Abo. #235837` (link → edit the subscription) for subscription orders; manual/online orders show their origin |

Default sort: delivery date descending (furthest future first).

### Filters/Search

- Single search input, name `q`, placeholder `Ordrenr, dato, kundenavn, kundenr, email, tlf, vejnavn, husnr, postnr, opgave` + `Søg` button. **No separate status- or date-filter dropdowns exist** — status/date filtering is done via free-text search terms. Deep-linkable via query string: `/order_event_list?q=…`; supports comma-separated order-id lists with `#` prefix (URL-encoded `%23`), e.g. `?q=%231969944,%231969945,…` — this is how "Se alle ordrer for abonnementet" links work.

### Row actions (caret dropdown, 6 items)

- `Vis ordre i kalender` (Show order in calendar)
- `Rediger ordre` (Edit order) → `/order_edit/{id}?back_url=/order_event_list`
- `Afslut ordre...` (Complete order…)
- `Slet ordre...` (Delete order…) → confirm modal `Bekræftelse`: `Er du sikker på, at du vil slette ordren?`, buttons `Luk` / `Slet ordre`
- `Opret ny ordre` (Create new order)
- `Rediger abonnement` (Edit subscription — only for subscription-sourced orders)

### Header actions

None (no create button on this list; orders are created from the calendar, from a customer detail page, or via row menu `Opret ny ordre`).

### Pagination

`forrige` · `1` `2` `...` · `næste`.

---

## Order detail/editor (`/order_edit/{id}`) — reference

(The full order editor is primarily part of the calendar flows, but it is the detail page of the `Ordrer` entity; captured at `/order_edit/1969944?back_url=/order_event_list`, heading `Rediger ordre #1969944`. Order display number = URL id.)

### Sections/Fields

- `Kunde`: `Fakturerings- og leveringsadresse` contact picker (`billing_textarea`) + `Rediger kontaktinfo` button + `Anden leveringsadresse` checkbox (`delivery_different_contact`, label `Nej`/`Ja`) revealing `delivery_textarea`.
- `Ordreinfo`: read-only `Planlagt leveringstidspunkt` (Planned delivery time, e.g. `Uge 29, mandag d. 13/7-26, kl. 9:44 - 11:14`); `Ordrestatus` (e.g. `Afventer levering, ikke afsluttet eller indmeldt`); `Ordrehistorik og -kilde` (Order history and source, e.g. `Kilde: Abo. #235844 (Hver 2. uge)`); `Notifikation` status line (e.g. `Indstillingerne gør at denne ordre ikke skal have en notifikation.`); `Ordrekommentar` textarea (`new_order_comment`, help `Tilføj valgfri, intern kommentar vedr. denne ordre, f.eks. en kommentar om leveringen`).
- `Opgaver på ordren` (Tasks on the order): task-line formset with `Opgavebeskrivelse` / `Pris (inkl. moms)` / `Varighed (min.)`, badge `Dette er en opgave fra abonnementet` (This is a task from the subscription), `Timepris NNNN kr/t`, `…` save-as menu (`Opret som ny standardopgave`/`Rediger standardopgave`), `Tilføj opgave` button. `Sum` block: `task_sum_price` + `task_sum_duration` (read-only sums), `Overskriv sum` (Override sum: `manualPrice`, `manualTime`), `Total` (`billedPrice`, `used_time`) + computed `Timepris`.
- `Planlægning i kalender` (Planning in calendar): checkbox `Skal ordren fastlåses helt?` (`locked_checkbox`, Fully lock the order?, label `Ja`); label `Overskriv abo.` (Override subscription) on the per-field overrides; `Uge` select (`week`) whose options are annotated `Uge 27, 29/6 - 5/7 <-- Forrige ordre på abo. ligger her` and `Uge 31, 27/7 - 2/8 <-- Næste ordre på abo. ligger her`, helper `Anvender abonnementets ugerytme` (Uses the subscription's weekly rhythm); `Ugedage` (`Vælges automatisk`, helper `Anvender abonnementets indstilling`); `Klokkeslæt` + `til`; `Medarbejder` select — each with helper `Anvender abonnementets indstilling` (Uses the subscription's setting).
- `Andet` (Other): `Adressebemærkning` textarea.
- Footer: `Luk` · `Andre handlinger` (Other actions) dropdown: `Vis ordre i kalender`, `Afslut ordre ...`, `Gå til kundedetaljer` (Go to customer details), `Slet ordre ...`, `Opret abonnement på kunden ...` (Create subscription for the customer…), `Rediger abonnement for ordren ...` · `Gem ordre` (Save order, blue).

### Order create (`/order_create/?back_url=…&for_contact={contact_id}`)

Same layout minus status/history/notification blocks. Differences: heading `Opret ny ordre`; extra button `Åbn prisberegner` (Open price calculator) beside `Tilføj opgave`; `Uge` select offers the next 52 weeks (`Uge 27, 29/6 - 5/7` … `Uge 26, 28/6 - 4/7`); checkbox `Send ordrebekræftelse på e-mail` (Send order confirmation by e-mail); footer `Luk` / `Opret ordre`. `for_contact` pre-fills the customer picker.

---

## URL pattern summary (all observed live)

| Entity | List | Detail/Edit | Create |
|---|---|---|---|
| Kunde (contact/customer) | `/contact_list/` | detail: `/contact_details/{contact_id}/` · contact form: `/contact_edit/{contact_id}/?callback_id=…&contact_role=…` · settings: `/contact_settings/{contact_id}/` | `/contact_create/` |
| Abonnement (subscription) | `/subscription_list` | `/subscription_edit/{pk}` (pk ≠ displayed abo. nr.) | `/subscription_create/` (+ `?for_contact={contact_id}`) |
| Fastprisaftale (fixed-price agreement) | `/fixed_prices_times_list/` | not observed (no records); delete modal exists | `/fixed_prices_times_agreement_create/?back_url=…` |
| Ordre (order) | `/order_event_list` (+ `?q=`) | `/order_edit/{order_id}?back_url=…` | `/order_create/?back_url=…&for_contact={contact_id}` |

Cross-cutting conventions: `?back_url=<path>` is appended to every drill-down link and drives the `Gå tilbage`/`Luk` return navigation; list search boxes submit `q`; all delete/stop actions are two-step (dropdown item ending in `...` → Bootstrap confirm modal with grey `Luk` + red destructive button); contact pickers are the same reusable widget everywhere (`Klik for at fremsøge eller oprette ny kontakt`); every address rendered anywhere gets an `Åbn i Google Maps` pin link; task lines everywhere are the same `task_form-{n}-*` formset with colored category letter icons.
