# Fenster Partner Portal — Gap flows: Afslut ordre, Standardopgave, Kalender-submenuer, Prisberegner

Captured 2026-07-03, logged in as `kristianklercke` (KRLTFL ApS). All flows were captured READ-ONLY: forms/modals were opened and read, then closed via `Luk` (Close) or Escape. **Nothing was submitted, saved, completed or deleted.**

---

## Afslut ordre

**Entry point:** `/order_event_list` ("Oversigt over ordrer") → caret action menu on an order row → `Afslut ordre...` (Complete order...).

The row caret menu contains: `Vis ordre i kalender` (Show order in calendar), `Rediger ordre` (Edit order), `Afslut ordre...` (Complete order...), `Slet ordre...` (Delete order..., red), `Opret ny ordre` (Create new order), `Rediger abonnement` (Edit subscription).

**Route:** full page (not a modal):
`/end_order_feedback_view/{order_id}?back_url={return_url}`
(observed: `/end_order_feedback_view/2080056?back_url=https://www.fenster.dk/order_event_list`)

**Page title:** `Afslut ordre` (Complete order)

### Sections and fields (in order)

1. **`Kundeinfo`** (Customer info) — read-only block: customer name, delivery address, `Att:` contact person, phone, email.
   (Observed: McDonalds Stilling, Ørstedsvej 4, 8660 Skanderborg, Att: Benita, +45 86570167, mcd-stilling@faktura-boks.dk)

2. **`Pris`** (Price) — read-only block:
   - `Pris uden kørsel kr. {amount}` (Price without driving)
   - `Kørselsgebyr kr. {amount}` (Driving fee)
   - `(Alle beløb er inkl. moms)` (All amounts incl. VAT)

3. **`Leveringsstatus`** (Delivery status) — radio group, 4 options (none preselected):
   - `Udført` (Completed/Done)
   - `Ikke udført, spring over` (Not done, skip)
   - `Ikke udført, skal genplanlægges` (Not done, must be rescheduled)
   - `Anden status` (Other status)

4. **`Betaling og fakturering`** (Payment and invoicing) — helper label: `Vælg om der skal faktureres via Dinero` (Choose whether to invoice via Dinero). Radio group, 5 options (none preselected):
   - `Send faktura - ubetalt` (Send invoice - unpaid)
   - `Send faktura - betalt kontant` (Send invoice - paid in cash)
   - `Send ikke faktura fra Fenster` (Do not send invoice from Fenster)
   - `Opret fakturakladde` (Create invoice draft)
   - `Registrer på et senere tidspunkt` (Register at a later time)

5. **`Ordrekommentar`** (Order comment) — multiline textarea, empty. Helper text: `Tilføj valgfri, intern kommentar vedr. denne ordre, f.eks. en kommentar om leveringen` (Add optional internal comment about this order, e.g. a comment about the delivery).

6. **`Adressebemærkning`** (Address note) — multiline textarea, prefilled with the existing address note (observed: "Mcd ved motorvejen"). Helper text: `Opdater valgfrit, internt notat, der relaterer sig til leveringsadressen og som er godt at huske til næste besøg hos kunden.` (Update optional internal note related to the delivery address, good to remember for the next visit.)

### Buttons (footer)

- `Tilbage` (Back) — link back to `back_url` (the order list)
- `Rediger ordre` (Edit order) — button, type=button
- `Meld status` (Report status) — submit button
- `Meld status og redig. ordre` (Report status and edit order) — submit button (present in DOM/accessibility tree; shown conditionally)
- `Afslut ordre` (Complete order) — submit button (final completion — NOT clicked)

### Notes / deviations from expectations

- **No photo upload section and no customer-notification section** exist on this form for this account — the form is exactly the six sections above. Selecting the `Udført` radio was tested and did NOT reveal any conditional extra fields (no photo upload, no notification options appeared).
- Payment options reflect the Dinero integration (account has Dinero settings); no MobilePay option present on this tenant.
- Leaving the page with unsaved changes triggers a confirm dialog: heading `Vil du fortsætte?` (Do you want to continue?), text "Du har foretaget ændringer på siden, som vil gå tabt, hvis du fortsætter..." with buttons `Tilbage` (Back) / `Fortsæt` (Continue).
- The form was exited WITHOUT submitting (navigated away; the selected radio was discarded).

---

## Standardopgave create/edit modal

**Entry point:** `/standard_task_list/` ("Oversigt over standardopgaver"). Page has: `Opret ny standardopgave` (Create new standard task) button, search field (placeholder `beskrivelse, kategori, bogstav` = description, category, letter) + `Søg` (Search), checkbox `Vis også deaktive standardopgaver` (Also show deactivated standard tasks — adds `?include_deactivated=on` and an extra column `ER DEAKTIV` (Is deactivated)). Table columns: `KATEGORI` (Category), `BESKRIVELSE` (Description), `KUNDEN SKAL VÆRE TILSTEDE` (Customer must be present). List is paginated (`forrige 1 2 næste`).

### Create view

Clicking `Opret ny standardopgave` opens a NEW TAB (not an in-page modal):
**Route:** `/standard_task_details/?add_message=true`
**Heading:** `Opret ny standardopgave` (Create new standard task)

Fields:
- `Kategori` (Category) — select, empty option preselected, 15 options:
  `Vinduespudsning` (1, Window cleaning), `Rentvandsvask` (2, Pure-water wash), `Tagrenderens` (3, Gutter cleaning), `Overfladerens` (4, Surface cleaning), `Algebehandling` (5, Algae treatment), `Overfladebeskyttelse` (6, Surface protection), `Privatrengøring` (7, Private cleaning), `Ejendomsrengøring` (8, Property cleaning), `Viceværtservice` (9, Caretaker service), `Grøn service` (10, Green service), `Ukrudtsbekæmpelse` (11, Weed control), `Skadedyrsbekæmpelse` (12, Pest control), `Bilpleje` (13, Car care), `Administrativt` (14, Administrative), `Andet` (15, Other)
- `Beskrivelse` (Description) — text input
- `Bogstav til ikon (valgfrit)` (Letter for icon, optional) — text input
- `Kunden skal være tilstede` (Customer must be present) — checkbox with `Ja` (Yes) label; helper text: `Anvendes bl.a. til at bestemme hvilken type notifikation, der skal sendes for ordrer, der indeholder...` (Used among other things to determine which type of notification is sent for orders containing [this task])
- `Opgavens udseende` (Appearance of the task) — read-only preview text field showing how the task chip will render
- Hidden section heading: `Standardopgaven benyttes allerede på følgende abonnementer/kontakter/ordrer` (The standard task is already used on the following subscriptions/contacts/orders) — usage panel with a `Close` link (shown in edit context)

Buttons: `Luk` (Close, link), `Opret standardopgave` (Create standard task — NOT clicked).

### Edit view

Row caret menu on each list row contains `Rediger standardopgave` (Edit standard task) and `Deaktiver standardopgave` (Deactivate standard task, red).
**Locked rows:** on some built-in tasks both items are disabled with tooltips `Denne standardopgave kan ikke redigeres` (This standard task cannot be edited) / `Denne standardopgave kan ikke deaktiveres` (…cannot be deactivated). DOM scan of page 1 (with deactivated shown): 94 rows editable, 6 rows locked (the locked ones are core tasks in use, e.g. `Pudsning udvendig`, `Pudsning indvendig`, `Pudsning forsatsvinduer`). There are no pencil icons — edit is only via the caret menu.

Clicking `Rediger standardopgave` on the first non-locked row (`Vinduespudsning / Afrensning af ruder`) opens a NEW TAB:
**Route:** `/standard_task_details/{task_id}?add_message=true` (observed id 142883)
**Heading:** `Rediger standardopgave` (Edit standard task)

Differences vs create:
- Same field set, but prefilled: `Kategori` = Vinduespudsning selected, description = "Afrensning af ruder", `Opgavens udseende` preview shows the category badge (`Vinduespudsning`) plus the task text.
- Extra button between `Luk` and save: `Deaktiver` (Deactivate) with tooltip `Når en standardopgave deaktiveres, vil den ikke længere fremgå af søgelister, men vil forblive uændret...` (When a standard task is deactivated it no longer appears in search lists but remains unchanged…)
- Save button label is `Gem standardopgave` (Save standard task) instead of `Opret standardopgave`.

Both views were closed via `Luk` without saving.

---

## Calendar event submenus

**Entry point:** `/calendar` (week view). Clicking an order event opens a context menu next to the event plus an info tooltip (times, customer, `Ordrens opgaver` task list with per-task prices, `Pris: kr. {amount}`, `Ordreplanlægning:` lock status e.g. `Låst til 29/6 kl. 8:30`, `Abonnementsindstillinger` (Basis-interval, Fast medarbejder, Faste ugedage, Fast klokkeslæt), `Adressebemærkning`).

### Top-level context menu (order event, subscription order)

- `Rediger ordre ...` (Edit order ...)
- `Lås helt op` (Unlock completely)
- `Lås op, fastgør til ugedag` (Unlock, pin to weekday)
- `Flyt til anden uge ...` ▸ (Move to another week ...)
- `Mere ...` ▸ (More ...)

### Submenu `Flyt til anden uge ...` (Move to another week)

- `1 uge frem` (1 week forward)
- `1 uge frem, lås helt op` (1 week forward, unlock completely)
- `2 uger frem` (2 weeks forward)
- `2 uger frem, lås helt op` (2 weeks forward, unlock completely)
- — separator —
- `1 uge tilbage` (1 week back)
- `2 uger tilbage` (2 weeks back)

### Submenu `Mere ...` (More)

- `Gå til kundedetaljer ...` (Go to customer details ...)
- `Rediger abonnement ...` (Edit subscription ...)
- `Rediger næste ordre på abo. (uge 28) ...` (Edit next order on subscription (week 28) ...) — week number is dynamic
- `Send notifikation nu` (Send notification now) — DISABLED/greyed for this event
- `Afslut ordre ...` (Complete order ...)
- `Slet ordre ...` (Delete order ..., red)

Menu closed with Escape; no submenu item was clicked.

---

## Prisberegner

**Entry point:** `/order_create/` ("Opret ny ordre") → section `Opgaver på ordren` (Tasks on the order) → buttons `Tilføj opgave` (Add task) and `Åbn prisberegner` (Open price calculator).

**Precondition:** `Åbn prisberegner` is DISABLED on a blank order; tooltip: `Vælg eller opret en kunde for at kunne benytte prisberegneren` (Select or create a customer to use the price calculator). After selecting a customer in `Fakturerings- og leveringsadresse` the button becomes enabled.

Clicking it opens a NEW TAB (not an in-page modal):
**Route:** `/price_calculator/{contact_id}/` (observed `/price_calculator/456473/` — id of the selected contact)
**Heading:** `Prisberegner for vinduespudsning` (Price calculator for window cleaning)

### Fields

- `Boligtype` (Dwelling type) — select, empty preselected: `Hus` (House, value `House`), `Rækkehus` (Townhouse, value `Townhouse`), `Lejlighed` (Apartment, value `Apartment`)
- `Antal plan` (Number of floors) — select: `1`, `2`, `3` (empty preselected)
- `Boligareal` (Dwelling area) — select, 20 range options (value = midpoint m2): `0 - 49 m2` (25), `50 - 59 m2` (55), `60 - 69 m2` (65), `70 - 79 m2` (75), `80 - 89 m2` (85), `90 - 99 m2` (95), `100 - 109 m2` (105), `110 - 119 m2` (115), `120 - 129 m2` (125), `130 - 139 m2` (135), `140 - 149 m2` (145), `150 - 159 m2` (155), `160 - 179 m2` (170), `180 - 219 m2` (200), `220 - 259 m2` (240), `260 - 299 m2` (280), `300 - 399 m2` (350), `400 - 599 m2` (500), `600 - 799 m2` (700), `800 - 1000 m2` (900)
- `Rudestørrelse` (Window pane size) — select: `Små ruder` (Small panes, value `Small`), `Mellemstore ruder` (Medium panes, value `Big`), `Store ruder` (Large panes, value `None`)
- `Pudsning` (Cleaning scope) — select: `Udvendig` (Exterior, value `o`), `Udvendig og indvendig` (Exterior and interior, value `oi`), `Udvendig, indvendig og forsats` (Exterior, interior and secondary glazing, value `oif`)
- `Online rabat` (Online discount) — text output field
- `Beregnet varighed (eks. kørsel)` (Calculated duration, excl. driving) — text output field
- `Beregnet pris (inkl. moms)` (Calculated price, incl. VAT) — text output field

### Buttons

- `Luk` (Close, link)
- `Beregn pris og varighed` (Calculate price and duration) — type=button, runs the calculation
- `Overfør opgave til ordren` (Transfer task to the order) — type=button (NOT clicked)

Closed via `Luk`; no calculation transferred, order not submitted.

### Notes

- The calculator is window-cleaning-specific (no task/category selector inside the calculator itself; the heading is fixed to `vinduespudsning`).
- The `Antal plan` field only appears in the accessibility tree/DOM alongside the others; it may render conditionally on `Boligtype`.

---

## Not reached / caveats

- **Afslut ordre:** expected photo-upload and customer-notification sections do not exist on this tenant's form (verified by full a11y read and by selecting the `Udført` radio — no conditional fields appeared). Possibly feature-flag or plan dependent.
- **Standardopgave:** create/edit open as full pages in a new tab rather than in-page modals; no pencil icon exists — edit lives in the row caret menu. First three rows are locked; first editable row used instead.
- **Calendar:** submenus were captured for a subscription-type order event (`Abonnement`). Menus for manual/online orders may differ slightly (e.g. no `Rediger abonnement ...`).
- Nothing was submitted, saved, completed or deleted in any flow.
