# Fenster Partner Portal — Funktioner (Functions) section spec

Documented 2026-07-03 from the live logged-in portal (account: `KRLTFL ApS`, Fenster plan: `Pro`).
Base URL: `https://www.fenster.dk`. All UI is Danish; English translations in parentheses.

The `Funktioner` (Functions) top-nav dropdown contains exactly 4 items:

| Menu label | Route |
|---|---|
| `Gruppebeskeder` (Group messages) | `/custom_message_list` |
| `Ferieplanlægning` (Holiday planning) | `/holiday_weeks_list/` |
| `Abonnementsoptimering` (Subscription optimization) | `/subscription_defragmentation/` |
| `Prisjustering` (Price adjustment) | `/price_adjustment_list/` |

Shared page chrome (all pages): top navbar (`Kalender`, `Dagsprogram`, `Indstillinger`, `Funktioner`, `Kartotek`, `Rapportering`, `Hjælp`, account menu `KRLTFL ApS` → `Fenster konto` `/account/`, `Skift password` `/change_password/`, `Log ud`), footer `Copyright © 2026` / `Powered by Fenster`, Intercom chat bubble. Several pages also carry hidden reusable modals: an IE11-unsupported dialog, and a plan-upsell dialog `Denne funktion er ikke inkluderet i dit Fenster abonnement` (This feature is not included in your Fenster subscription) with a price table (`Fenster pakke`, `Ekstra medarbejder, stk`, `Gratis admin. medarbejder`, `Total` — each in `kr/mdr`), a link to `https://partner.fenster.dk/priser/`, a confirm checkbox `Jeg bekræfter, at jeg ønsker at opgradere til Fenster … til en samlet månedlig pris på … kr. eks. moms.` and buttons `Luk` (Close) / `Opgrader` (Upgrade), followed by an `Opgradering gennemført` (Upgrade completed) dialog with `Ok`.

---

## Gruppebeskeder — list (`/custom_message_list`)

### Purpose
History overview of manually sent bulk/group messages (email/SMS) to customer segments. Heading: `Oversigt over gruppebeskeder` (Overview of group messages). Subtext: `Oversigten viser historik over manuelt afsendte gruppebeskeder.` (The overview shows the history of manually sent group messages.)

### List/Table
DataTable (shows `No matching records found` when empty; has a `Loading, please wait` state). One row = one sent group-message run. Columns (headers rendered uppercase):

| Column | Meaning |
|---|---|
| `Besked-nr` (Message no.) | Sequential id of the message run |
| `Sendt som` (Sent as) | Channel used (SMS/e-mail combination) |
| `Modtagere` (Recipients) | The targeted customer group / recipient count |
| `E-mail emne` (E-mail subject) | Subject used for the e-mail variant |
| `Besked` (Message) | The message body |
| `Tidspunkt` (Time) | When it was sent |
| `Status` | Delivery status of the run |

No row action icons observed (empty table on this account; the table is history/read-only).

### Filters
None (no search box or filter controls on the page).

### Create/Edit form
Primary button: `Opret ny besked` (Create new message) — a link styled as button, `href="/custom_message_create"` (same tab). See next section.

### Actions
- `Opret ny besked` → `/custom_message_create`.

### Notes
- Pure history list; sending happens on the create page.

---

## Gruppebeskeder — create (`/custom_message_create`) — "Send gruppebesked"

### Purpose
Compose and send a one-off group message via e-mail and/or SMS to a chosen customer segment. Heading: `Send gruppebesked` (Send group message). Intro/help text: `Her kan du sende en gruppebesked via e-mail og SMS til en eller flere af dine kunder. Funktionen er beregnet til driftsmæssig kommunikation med eksisterende kunder, f.eks. servicebeskeder. Funktionen må ikke anvendes til marketing, reklame eller lign. med mindre du selv har indhentet samtygge jf. dansk lovgivning.` (For operational communication with existing customers, e.g. service messages; must not be used for marketing without consent per Danish law.)

### Create form — fields in order

1. **`Kundegruppe`** (Customer group) — `<select>`, required, placeholder `---------`. Help text: `Vælg hvilken gruppe af kunder, der skal modtage beskeden` (Choose which group of customers should receive the message). Options (label → option value):
   - `Alle ordrer på en bestemt dato` (All orders on a specific date) → `ORDERS_ON_DATE`
   - `Alle ordrer i en bestemt uge` (All orders in a specific week) → `ORDERS_IN_WEEK`
   - `Alle ikke-afsluttede ordrer på en bestemt dato` (All non-completed orders on a specific date) → `NON_CLOSED_ORDERS_ON_DATE`
   - `Alle ikke-afsluttede ordrer i en bestemt uge` (All non-completed orders in a specific week) → `NON_CLOSED_ORDERS_IN_WEEK`
   - `Alle abonnementskunder` (All subscription customers) → `ACTIVE_SUBSCRIPTIONS`
   - `Alle online kunder (uden abonnement)` (All online customers without subscription) → `CLOSED_ONLINE_ORDERS_NO_ACTIVE_SUBSCRIPTION`
   - `Alle manuelle kunder (uden abonnement)` (All manual customers without subscription) → `CLOSED_MANUAL_ORDERS_NO_ACTIVE_SUBSCRIPTION`
   - `Alle manuelle kunder og online kunder (uden abonnement)` (All manual and online customers without subscription) → `CLOSED_MANUAL_OR_ONLINE_ORDERS_NO_ACTIVE_SUBSCRIPTION`
   - `Alle aktive kunder i kartotek` (All active customers in the register) → `CLOSED_ORDERS_OR_ACTIVE_SUBSCRIPTIONS`

2. **`Dato`** (Date) — text input with calendar date-picker (icon button opens a month calendar widget). Conditional: used by the *…on a specific date* groups. Help text: `Beskeden sendes til de kunder, der har en ordre i kalenderen på den valgte dato` (Sent to customers having a calendar order on the chosen date).

3. **`Uge`** (Week) — `<select>` of weeks. Conditional: used by the *…in a specific week* groups. Help text: `Beskeden sendes til de kunder, der har en ordre i kalenderen i den valgte uge`. Option format `Uge <n>, <year> (<d/m> - <d/m>)`, value = ISO date of the week's Monday; the current week is suffixed ` indeværende uge` (current week). Observed range (today = week 27, 2026): from `Uge 23, 2026 (1/6 - 7/6)` (value `2026-06-01`) through `Uge 35, 2026 (24/8 - 30/8)` (value `2026-08-24`) — i.e. 4 weeks back through 8 weeks ahead, 13 options.

4. **`Medarbejder`** (Employee) — `<select>`, default `Alle medarbejdere` (All employees), plus one option per employee (observed: `Kristian Klercke` value `1535`). Conditional: shown for the date/week order groups. Help text: `Beskeden sendes til de kunder, der har en ordre i den valgte medarbejders kalender` (Sent to customers with an order in the chosen employee's calendar).

5. **`Send besked som`** (Send message as) — `<select>`, required, placeholder `---------`. Options:
   - `Både SMS og e-mail` (Both SMS and e-mail) → `SMS_AND_EMAIL`
   - `Kun som SMS` (Only as SMS) → `SMS`
   - `Kun som e-mail` (Only as e-mail) → `EMAIL`
   - `Som e-mail, hvis kunden har en email-adr., ellers som SMS` (As e-mail if the customer has an e-mail address, otherwise as SMS) → `EMAIL_IF_PRESENT_ELSE_SMS`

6. **`E-mail emne`** (E-mail subject) — text input, with inline label note `(anvendes ikke til SMS)` (not used for SMS). Help text: `Emnet på e-mailen` (The subject of the e-mail).

7. **`Besked`** (Message) — multi-line `<textarea>`. Label contains link `Se liste over variable felter, du kan anvende` (See list of variable fields you can use) which opens the **variable-fields modal** (below). Help text: `Beskeden, som skal sendes` (The message to be sent).

8. **`Afsender på SMS`** (SMS sender) — text input, prefilled `Service SMS`, read-only in practice. Help text: `Afsender på SMS. Kan være tekst eller dit mobilnummer. Maks 11 karakterer. Kontakt Fenster Support for at få feltet ændret (kræver Fenster Premium abonnement)` (Can be text or your mobile number. Max 11 characters. Contact Fenster Support to change — requires Fenster Premium subscription). `Fenster Support` is a link to `/support/`.

9. **`Send en test`** (Send a test) — two test controls:
   - Text input placeholder `Test e-mail` + help `Indtast en e-mail adresse for at afsende en test` (Enter an e-mail address to send a test) + submit button `Send test e-mail`.
   - Text input placeholder `Test SMS` + help `Indtast et mobilnummer for at afsende en test` (Enter a mobile number to send a test) + submit button `Send test SMS`. On this account the SMS button is disabled with tooltip/notice: `Brugen af SMS er ikke godkendt endnu. Gå til Indstillinger → Generelt og godkend brug af SMS` (SMS use is not yet approved. Go to Settings → General and approve SMS use).

### Variable-fields modal — `Liste over variable felter` (List of variable fields)
Template placeholders usable in the message body (each with description and example):
- `{{kunde_fornavn}}` — customer first name = first word of the name field (for companies the att. person is used). Example: `Peter`
- `{{kunde_fuldt_navn}}` — customer full name as entered (for companies the att. person is used). Example: `Peter Petersen`
- `{{dit_firmanavn}}` — your company name. Example: `KRLTFL ApS`
- `{{dit_telefonnummer}}` — your company phone number. Example: `51202040`
- `{{din_email}}` — your company e-mail address. Example: `kristian@karltoffel.dk`
Modal buttons: `Close` (X), `Tilbage` (Back).

### Actions / buttons (bottom of form)
- `Send besked til kundegruppen` (Send message to the customer group) — opens **confirmation dialog** `Bekræftelse` (Confirmation): body `Er du sikker på, at du vil sende beskeden til kundegruppen?` (Are you sure you want to send the message to the customer group?), buttons `Luk` (Close) and `Send besked til kundegruppen` (confirm-send).
- `Vis liste over modtagere` (Show list of recipients) — opens modal `Oversigt over modtagere af gruppebesked` (Overview of recipients of group message) listing the resolved recipients for the chosen group (requires a valid group selection; shows a technical-error message otherwise), button `Luk`.

### Notes
- Date/Week/Employee fields are conditionally relevant depending on the chosen `Kundegruppe` (date-based groups use `Dato`; week-based use `Uge`; both can be narrowed by `Medarbejder`).
- No scheduling — sending is immediate upon confirmation.

---

## Ferieplanlægning (`/holiday_weeks_list/`)

### Purpose
Holiday planning: closing the calendar for whole weeks and pushing all subscription orders forward in time. Heading: `Ferieplanlægning`.

### Explanation block (verbatim content, must be reproduced)
Section `Forklaring` (Explanation):
- Lead (bold warning): `Det er vigtigt, at du forstår, hvordan ferieplanlægningen virker, inden du tager den i brug, da ferieplanlægningen direkte påvirker din kalender, alle dine abonnementer samt relaterede ordrer.` (Important to understand before use — it directly affects the calendar, all subscriptions and related orders.)
- Body: `Når du indtaster en ferie vil kalenderen blive lukket i de pågældende uger, og alle abonnementsordrer fra dit kartotek blive skubbet frem i tid startende fra ferietidspunktet. Dvs. det er ikke kun ordrer i ferieperioden, der vil blive skubbet, men også ordrer fra alle efterfølgende uger vil blive skubbet frem i tid.` (Entering a holiday closes the calendar for those weeks and pushes ALL subscription orders forward from the holiday start — not only orders inside the holiday period.)
- `Vær opmærksom på:` (Be aware of:) bullet list:
  1. `Du skal oprette en ferie minimum 1 uge før ferien påbegyndes` (Create a holiday minimum 1 week before it starts)
  2. `Du kan ikke redigere eller slette en ferie, når der er mindre end 1 uge til ferien påbegyndes` (Cannot edit/delete a holiday when less than 1 week remains before it starts)
  3. `Ferieplanlægning gælder for alle medarbejdere i virksomheden` (Applies to all employees in the company)
  4. `Det er kun abonnementsordrer, der bliver skubbet frem i tid (manuelle ordrer og online ordrer skal du selv håndtere)` (Only subscription orders are pushed; manual and online orders must be handled manually)
  5. `Kunderne bliver ikke automatisk orienteret om, at du holder ferie (det skal du selv gøre)` (Customers are NOT automatically notified)
  6. `Hvis du tidligere har flyttet en abonnementsordre til en anden uge, end den oprindeligt var planlagt til, så vil ordren falde tilbage til sin normale placering/interval, når ferien bliver oprettet (såfremt den ligger efter ferietidspunktet)` (Previously moved subscription orders fall back to their normal position/interval when the holiday is created, if after the holiday start)
  7. `Du kan oprette ekstra arbejdstid oven i ferien, hvis du har nogle enkelte ordrer, der skal planlægges/leveres. Dette gøres ved at trække-slippe og så oprette ekstra arbejdstid` (You can create extra working time on top of the holiday via drag-and-drop)
- `Eksempel:` (Example:) bullet list:
  1. `Du opretter ferie i uge 23-24` (You create holiday in weeks 23–24)
  2. `Et 8-ugers abonnement, der normalt ville ligge i uge 12, 20, 28, 36, vil nu blive skubbet 2 uger frem fra ferietidspunktet, og vil derfor ligge med ordrer i uge 12, 20, 30, 38` (An 8-week subscription normally in weeks 12, 20, 28, 36 is pushed 2 weeks → 12, 20, 30, 38)
  3. `Et 8-ugers abonnement, der normalt ville ligge i uge 12, 20, 29*, 36 (*fordi du tidligere har flyttet ordren fra uge 28 til uge 29), vil ligge med ordrer i uge 12, 20, 30, 38` (Manually-moved order falls back into rhythm)
  4. `En online ordre, der ligger i uge 23 vil ligge uændret i uge 23` (An online order in week 23 stays unchanged)
  5. `En manuel, ikke-fastlåst ordre, der ligger i uge 23, vil blive liggende i ugen, men planlægningen vil fejle, fordi der er ferielukket. (Opret ekstra arbejdstid eller flyt ordren til en anden uge).` (A manual non-locked order stays but planning fails because of holiday closure — create extra working time or move it.)

### List/Table
Section heading: `Planlagte ferier` (Planned holidays). DataTable, empty state `Ingen planlagte ferier` (No planned holidays). One row = one planned holiday period. Columns (rendered uppercase):

| Column | Meaning |
|---|---|
| `Ferienr.` (Holiday no.) | Id of the holiday |
| `Ferieperiode (inklusiv)` (Holiday period, inclusive) | Start–end week range |
| `Kan redigeres til og med` (Can be edited up to and including) | Last date on which edit/delete is allowed (1 week before start) |

Row actions: delete (a `Slet ferie` danger button exists in the DOM wired to a `delete_confirm_click(this)` handler → opens the delete-confirmation dialog below). Rows presumably link to `/holiday_week_details` for editing while still editable.

### Filters
None.

### Create/Edit form
Primary button: `Opret ny ferie` (Create new holiday) — `<input type="button">` with `onclick="window.location.href = '/holiday_week_details?back_url=' + window.location.href"` → same-tab navigation to the create page (next section).

### Actions
- `Opret ny ferie` → `/holiday_week_details?back_url=<current url>`.
- Delete row → confirmation dialog `Vil du slette ferien?` (Do you want to delete the holiday?): body `Er du sikker på, at du vil slette ferien?` (Are you sure you want to delete the holiday?), buttons `Luk` (Close) and `Slet ferie` (Delete holiday, danger/red).

### Notes
- The 1-week lead time is enforced both in copy and in the create form's week options (see below).

---

## Ferieplanlægning — create (`/holiday_week_details`) — "Opret ferie"

### Purpose
Create (or edit) a holiday period defined by an inclusive start and end week. Heading: `Opret ferie` (Create holiday). Reached with query param `back_url` for the return navigation.

### Create form — fields

1. **`Startuge`** (Start week) — `<select>`, required (blank option selected initially). Option format `Uge <n>, <year>`, value = ISO date of that week's Monday. Observed range (today = Fri 2026-07-03, week 27): first option `Uge 29, 2026` (value `2026-07-13`) through `Uge 26, 2027` (value `2027-06-28`) — i.e. the earliest selectable start respects the ≥1-week lead time, and the horizon is ~50 weeks (~1 year) ahead.
2. **`Slutuge`** (End week) — `<select>`, required, identical option list/values as `Startuge`.

### Actions
- `Luk` (Close) — button/link back to `/holiday_weeks_list/` (uses `back_url`), no save.
- `Gem ferie` (Save holiday) — submit button; creates the holiday (closes calendar for those weeks and reschedules subscription orders as described on the list page).

### Notes
- No other fields (no per-employee choice — holidays are company-wide; no customer-notification option — customers are not notified automatically).
- No confirmation dialog was observed before save on the create form itself (deletion has one on the list page).

---

## Abonnementsoptimering (`/subscription_defragmentation/`)

### Purpose
Subscription route/week-rhythm optimization ("defragmentation"): Fenster proposes shifting selected subscriptions' week rhythm (forward or backward) so they fall in the same weeks as nearby subscriptions, evening out workload across weeks. Heading: `Abonnementsoptimering`. On load the page redirects itself to `?results=<uuid>` (an optimization-results/session id).

### Plan gating
Banner on this (Pro) account: `Abonnementsoptimering er ikke inkluderet i dit Fenster-abonnement: Pro` with text `Abonnementsoptimering kræver et Fenster Premium abonnement. Klik her for at opgradere.` (Requires Fenster Premium — click here to upgrade) → opens the shared upsell dialog.

### Introduction block (section `Introduktion`, verbatim meaning)
- `Abonnementsoptimering er en avanceret funktion, som kan hjælpe med at optimere din kørsel ved at flytte udvalgte abonnementer, dvs. ved at forskubbe ugerytmen.` (Advanced function optimizing driving by shifting selected subscriptions' week rhythm.)
- `Venstre kort viser den nuværende ugerytmer for alle dine abonnementer, mens det højre kort viser ugerytmerne efter optimering.` (Left map shows current week rhythms of all subscriptions; right map shows rhythms after optimization. Responsive variants of the copy swap `Venstre`/`højre` (left/right) for `Øverste`/`nederste` (top/bottom) on narrow layouts.)
- Fenster accounts for different intervals but never changes intervals — it only shifts the rhythm forward or backward.
- `Optimeringen tager også højde for fordeling af arbejdestid på tværs af uger, således at arbejdstiden jævnes ud.` (Also balances working time across weeks.)
- `Fenster foreslår flytning af op til 10 abonnementer ad gangen, hvor du skal bekræfte for hvert abonnement, om det må flyttes. Når flytningen er gennemført sender Fenster en besked til kunden med info om ændringen. Du kan tilpasse beskeden på denne side, hvis du ønsker det.` (Proposes up to 10 subscriptions at a time; each move must be confirmed; after moving, Fenster messages the customer; message template customizable) — `på denne side` links to `/email_and_sms_settings_subscription_defrag_notification` (the `Abonnementsflytning` e-mail/SMS template page).
- `Et abonnement kan ikke flyttes, hvis kunden skal have service i indeværende eller næste uge, eller hvis der er foretaget manuelle ændringer på abonnementets fremtidige ordrer. Hvis dette er tilfældet gemmes abonnementet til optimering på et senere tidspunkt… Kom derfor tilbage til denne side med jævne mellemrum…` (A subscription cannot be moved if the customer has service this or next week, or if future orders were manually changed; such subscriptions are saved for later — revisit the page regularly.)

### Main content — `Optimeringspotentiale` (Optimization potential)
On this account the section shows the **disabled state**:
- Heading: `Abonnementsoptimering er deaktiveret` (Subscription optimization is disabled)
- Text: `Systemet har detekteret en mulig udfordring med dine kundedata og funktionen er derfor deaktiveret.` (System detected a possible issue with your customer data, so the function is disabled.) `Fejlbeskeden er:` (The error message is:) followed by a bullet list, here: `Det kræver min. 100 abonnementer at udføre abonnementsoptimering. Der er pt. 5 abonnementer i kartoteket.` (Requires min. 100 subscriptions; there are currently 5 in the register.)

When enabled (per the intro copy) this section contains two maps (before/after week rhythms, colored by week), and a proposal list of up to 10 subscription moves each requiring per-subscription confirmation.

### List/Table
None on this account (no table in the disabled state). The enabled state presents move proposals rather than a conventional table.

### Filters
None.

### Create/Edit form
None — the workflow is: review proposals → confirm moves via the dialog below.

### Dialogs (present in DOM, used by the enabled flow)
1. **`Bekræft flytning af abonnementer`** (Confirm moving of subscriptions):
   - Body: `Du er ved at flytte ugerytmen på abonnementer.` (You are about to move the week rhythm of subscriptions.)
   - `Vælg hvordan kunderne skal informeres om ændringen:` (Choose how customers should be informed about the change:) — `<select>`, default `Både SMS og e-mail`:
     - `Både SMS og e-mail` → `SMS_AND_EMAIL`
     - `Kun som SMS` → `SMS`
     - `Kun som e-mail` → `EMAIL`
     - `Som e-mail, hvis kunden har en email-adr., ellers som SMS` → `EMAIL_IF_PRESENT_ELSE_SMS`
     - `Giv ikke besked` (Do not notify) → `NONE`
   - Validation hint: `Vælg venligst hvordan informationen skal afsendes.` (Please choose how the information should be sent.)
   - Warning: `Denne handling kan ikke fortrydes.` (This action cannot be undone.)
   - Checkbox: `Spørg ikke om bekræftelse igen i denne omgang` (Don't ask for confirmation again this round)
   - Buttons: `Luk` (Close), `Flyt abonnementer` (Move subscriptions).
2. **`Optimeringsgrundlaget er forældet`** (The optimization basis is outdated): body `Denne side skal genindlæses, før der kan flyttes flere abonnementer. Dette skyldes…` (Page must be reloaded before more subscriptions can be moved…), buttons `Luk`, `Genindlæs` (Reload).
3. Error panel `Siden for abonnementsoptimering kan ikke indlæses ordentligt` (The subscription-optimization page cannot load properly) with `Tjek din internetforbindelse og genindlæs siden…` + `support@fenster.dk` mailto link and `Genindlæs` button.

### Actions
- Upgrade banner link (opens upsell dialog).
- `Genindlæs` (Reload) in error/stale dialogs.
- (Enabled flow) per-subscription confirm + `Flyt abonnementer`.

### Notes
- Requirements to enable: Fenster **Premium** plan AND ≥ 100 subscriptions in the register.
- The customer notification template lives at `/email_and_sms_settings_subscription_defrag_notification` (`Abonnementsflytning`).
- URL carries a `results=<uuid>` query param identifying the computed optimization result set; moving subscriptions invalidates it (hence the "outdated basis" dialog).

---

## Prisjustering — list (`/price_adjustment_list/`)

### Purpose
Overview of bulk price-adjustment runs. Heading: `Prisjusteringer` (Price adjustments).

### List/Table
DataTable, empty state `Ingen prisjusteringer oprettet` (No price adjustments created). One row = one price-adjustment run. Columns (rendered uppercase):

| Column | Meaning |
|---|---|
| `Nr.` (No.) | Run id |
| `Status` | Run status |
| `Dato for informering af kunder` (Date for informing customers) | When customers are/were notified |
| `Dato for ikrafttrædelse` (Effective date) | When the new prices take effect |
| `Antal berørte kunder / opgaver` (Number of affected customers / tasks) | Scope of the run |

No row-action icons observed (empty table on this account).

### Filters
None.

### Create/Edit form
Primary button: `Opret prisjustering` (Create price adjustment) — link styled as button, `href="/price_adjustment_create/"` (same tab). See next section.

### Actions
- `Opret prisjustering` → `/price_adjustment_create/`.

### Notes
- Note the two distinct dates per run: customer notification date and effective date.

---

## Prisjustering — create wizard (`/price_adjustment_create/`)

### Purpose
Step 1 (`Indstillinger`, Settings) of a 3-step wizard for a bulk price adjustment of subscriptions and/or fixed-price agreements, with tiered percentage increases, rounding, customer-base filters and customer communication. Heading: `Prisjustering`.

### Wizard steps (breadcrumb at top)
1. `Indstillinger` (Settings) — current page, link `/price_adjustment_create/`
2. `❯ Tilpas opgaver` (Adjust tasks) — button (step 2: deselect specific customers / manually adjust prices)
3. `❯ Bekræft og sæt i gang` (Confirm and start) — button (step 3)

### Step-1 form — sections and fields

#### Section `Tidspunkt` (Time)
- **`Vælg, hvornår prisjusteringen skal træde i kraft`** (Choose when the price adjustment takes effect) — `<select>`, required, placeholder `----------`. Options are Mondays: format `Mandag uge <n> (<d/m-yyyy>)`, value = ISO date. Observed range: `Mandag uge 29 (13/7-2026)` (`2026-07-13`) through `Mandag uge 27 (5/7-2027)` (`2027-07-05`) — ~52 weekly options, starting ~1.5 weeks out. Help text: `Tidspunktet, hvor justeringen gennemføres og priserne opdateres` (The time when the adjustment is executed and prices are updated).

#### Section `Størrelse` (Size)
Radio choice between two adjustment modes:
1. **`Procentuel justering`** (Percentage adjustment) — radio + a single number input suffixed `%`. Simple flat percentage.
2. **`Procentuel justering baseret på opgavens timepris`** (Percentage adjustment based on the task's hourly price) — radio + a tier table of 5 bands, each with a number input for the percentage, and editable band-boundary number inputs (defaults 400 / 600 / 800 / 1000):
   - `Mindre end` \[`400`\] `kr/time` → \[%\] (Less than 400 kr/hour)
   - `Fra` \[`400`\] `til` \[`600`\] `kr/time` → \[%\] (From 400 to 600)
   - `Fra` \[`600`\] `til` \[`800`\] `kr/time` → \[%\]
   - `Fra` \[`800`\] `til` \[`1000`\] `kr/time` → \[%\]
   - `Mere end` \[`1000`\] `kr/time` → \[%\] (More than 1000 kr/hour)

#### Section `Afrunding` (Rounding)
- **`Vælg, om den nye pris skal afrundes`** (Choose whether the new price should be rounded) — `<select>`, default `Ingen afrunding`. Options (label → value):
  - `Ingen afrunding` (No rounding) → `NO_ROUNDING`
  - `50 øre` → `ORE_50`
  - `1 kr.` → `KR_1`
  - `2 kr.` → `KR_2`
  - `5 kr.` → `KR_5`
  - `Slut på 9,00 kr.` (End at 9.00 kr) → `END_AT_KR_9_00`
  - `Slut på 9,95 kr.` (End at 9.95 kr) → `END_AT_KR_9_95`
  - `10 kr.` → `KR_10`
- Help text: `Vælg fra listen for at se eksempler på afrunding` (Choose from the list to see rounding examples). A link/popover `Se eksempler på den valgte afrunding` opens dialog `Eksempler på den valgte afrunding` (Examples of the selected rounding) with a `Tilbage` (Back) button.

#### Section `Kundegrundlag` (Customer base)
- **`Aftaletype`** (Agreement type) — `<select>`, required, placeholder `----------`. Options:
  - `Juster både abonnementer og fastprisaftaler` (Adjust both subscriptions and fixed-price agreements) → `SUBSCRIPTIONS_AND_FIXED_PRICE_AGREEMENTS`
  - `Juster kun abonnementer` (Only subscriptions) → `SUBSCRIPTIONS`
  - `Juster kun fastprisaftaler` (Only fixed-price agreements) → `FIXED_PRICE_AGREEMENTS`
- **`Ekskludér kunder med opgaver, der er prisjusteret inden for`** (Exclude customers with tasks price-adjusted within) — `<select>`, placeholder `----------`. Options (label → value): `den sidste måned` → `1`, `de sidste 2 mdr.` → `2`, `de sidste 3 mdr.` → `3`, `de sidste 4 mdr.` → `4`, `de sidste 6 mdr.` → `6`, `de sidste 9 mdr.` → `9`, `de sidste 12 mdr.` → `12`, `de sidste 18 mdr.` → `18`, `de sidste 24 mdr.` → `24`, `de sidste 36 mdr.` → `36`.
- **`Ekskludér kunder med opgaver, der er oprettet inden for`** (Exclude customers with tasks created within) — `<select>`, identical options/values as above.
- **`Ekskludér kunder med opgaver, hvor prisen manuelt er ændret inden for`** (Exclude customers with tasks whose price was manually changed within) — `<select>`, identical options/values as above.
- Footer note: `Kundegrundlaget medtages til næste side, hvor du kan fravælge specifikke kunder og tilpasse priser manuelt.` (The customer base carries over to the next page where you can deselect specific customers and adjust prices manually.)

#### Section `Kundekommunikation` (Customer communication)
- Intro: `Kunderne modtager besked via e-mail/SMS, når prisjusteringen bekræftes og igangsættes. Du kan tilpasse beskeden via denne skabelon (åbner i nyt vindue).` (Customers are notified via e-mail/SMS when the adjustment is confirmed and started. Customize via this template — opens in new window.) — `denne skabelon` links to `/email_and_sms_settings_price_adjustment_notification`.
- **`Send besked som`** (Send message as) — `<select>`, required, placeholder `----------`. Options:
  - `Både SMS og e-mail` → `SMS_AND_EMAIL`
  - `Kun som SMS` → `SMS`
  - `Kun som e-mail` → `EMAIL`
  - `Som e-mail hvis kunden har en email-adr, ellers som SMS` → `EMAIL_IF_PRESENT_ELSE_SMS`
  - `Send ikke besked` (Do not send a message) → `DONT_SEND`
- **`Vælg hvilke detaljer om prisændringen, der skal indgå i beskeden:`** (Choose which details about the price change to include in the message:) — radio group, 3 options each with an example line:
  1. `Oplys om prisændringen for hver opgave` (State the price change for each task) — example: `F.eks. "Udvendig polering +25,00 kr."`
  2. `Oplys om prisen før og efter for hver opgave` (State the price before and after for each task) — example: `F.eks. "Udvendig polering, før 250 kr., ny pris 275 kr."`
  3. `Oplys om ny pris for hver opgave` (State the new price for each task) — example: `F.eks. "Udvendig polering, ny pris 275 kr."`
- **`Fravælg besked til kunder, som har en fastprisaftale, der ikke har været anvendt`** (Opt out of messaging customers whose fixed-price agreement has not been used) — `<select>`, default `Nej` (No). Options (label → value): `de sidste 3 måneder` → `3`, `de sidste 6 måneder` → `6`, `de sidste 9 måneder` → `9`, `de sidste 12 måneder` → `12`, `de sidste 15 måneder` → `15`, `de sidste 18 måneder` → `18`, `de sidste 24 måneder` → `24`, `de sidste 36 måneder` → `36`.

### Actions
- **`Gå videre (kan ikke fortrydes)`** (Continue — cannot be undone) — submit button at the bottom; proceeds to step 2 (`Tilpas opgaver`). Disabled with tooltip `Der er ingen kunder i denne prisjustering. Gå op på siden og rediger kundegrundlaget` (There are no customers in this price adjustment. Go up the page and edit the customer base) when the current filter selection matches zero customers.

### Notes
- Steps 2 (`Tilpas opgaver` — per-customer deselection and manual price tweaks) and 3 (`Bekræft og sæt i gang`) could not be entered without committing an irreversible step-1 submission ("kan ikke fortrydes"), so they were intentionally not executed.
- Percent inputs are plain `type="number"` fields; tier boundaries are editable, defaulting to 400/600/800/1000 kr/time.
- The customer-notification date shown in the list is when the run is confirmed/started; the effective date is the chosen Monday.
