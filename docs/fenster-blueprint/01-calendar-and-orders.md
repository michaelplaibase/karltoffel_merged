# 01 — Kalender, Dagsprogram & Order editor

## Kalender (`/calendar?date=YYYY-MM-DD`)
The default landing page. A week-grid scheduler (FullCalendar-style) showing planned window-cleaning jobs, with an auto-planning engine that re-optimizes routes nightly.

### Left sidebar
- **Planlægning** (Planning)
  - Button **`Genplanlæg uge`** (Replan week). Tooltip: *"Fenster genplanlægger automatisk alle uger hver nat. Klik her, hvis du ønsker at genplanlægge denne uge."* (auto-replans every night; click to replan this week now).
  - Status line: `Planlagt i dag kl. 03:01` (last auto-plan timestamp).
- **Medarbejdere** (Employees): one checkbox per employee (e.g. `Kristian Klercke`) → filters the grid to selected employees.
- **Planlagt omsætning** (Planned revenue): `Uge 27: kr. 2.329`, `Juni: kr. 20.849` (planned turnover this week / month).
- **Planlagt kørsel** (Planned driving): per weekday, e.g. `Man: 1 t 11 min` (drive time).
- **Vis i kalender** (Show in calendar): checkboxes `Vis arbejdstider` (show working hours), `Vis kørsel` (show driving).
- **Forklaringer** (Legend, collapsible `#collapse-legend`), color/icon key:
  - *Ordreplanlægning* (planning lock state): `Helt fastlåst` (fully locked), `Delvist frigjort` (partially freed), `Helt frigjort` (fully freed).
  - *Ordrestatus*: `Afsluttet` (completed), `Ikke afsluttet` (not completed), `Mislykket planl.` (failed to plan), `Afventer planl.` (awaiting planning).
  - *Ordretype*: `Abonnement` (subscription — "A" icon), `Online`, `Manuel`.
  - *Notifikation*: `Deaktiveret` (disabled), `Planlagt` (scheduled), `Afsendt` (sent), `Fejl` (error), `Kun dato` (date only), `Dato og klokkeslæt` (date + time).
  - *Andet*: `Arbejdstid` (working time), `Fleksibel arbejdstid` (flexible working time), `Lukketid` (closed time), `Kørsel` (driving).

### Top toolbar
- Prev arrow · **`Idag`** (Today) · Next arrow.
- Week/period label, e.g. `Jun. – Jul. 2026`, with left rail week number `UGE 27`.
- View dropdown **`Uge`** (Week) and quick buttons **`Dag`** (Day) · **`5 dg`** (5 days) · **`7 dg`** (7 days).
- **Search** icon (order/customer search).
- Day column headers: weekday + date + planned revenue (`Kr. 2.329` etc.); each header has a caret dropdown for per-day actions.

### Grid & events
- Time-of-day rows (~06:00–20:00). Working hours shaded; driving time blocks shown between jobs.
- Each **event block** shows: time range (`8:30 – 9:30`), postal code + city (`8660 Skanderborg`), customer/site name (`McDonalds Stilling`), an order-type icon (A = abonnement), and small status/notification/lock icons. Border color = status; fill = lock state (per legend).
- Drag to reschedule; blocks are draggable when not fully locked.

### Event context menu (click an event)
- **`Rediger ordre …`** (Edit order) → `/order_edit/{id}`.
- **`Lås helt op`** (Unlock fully) — let planner move it freely.
- **`Lås op, fastgør til ugedag`** (Unlock but pin to weekday).
- **`Flyt til anden uge …`** (Move to another week) ▸ submenu.
- **`Mere …`** (More) ▸ submenu (further order actions).

---

## Dagsprogram (`/daycalendar?date=YYYY-MM-DD`)
Daily work-program / route list for a single day (the driver's running order of stops). Reachable from each calendar day header and the top nav. Lighter page than the calendar. Exportable to PDF via `/daycalendar_export` (Reporting). *(Deeper field capture pending — see reporting agent / follow-up.)*

---

## Order editor (`/order_edit/{id}?back_url=…`)
Full-page editor for a single order/visit. Example captured: order `#1969863`.

- **Header:** `Rediger ordre #{id}`.
- **Alert (contextual):** e.g. `Obs: Ordren har overskredet leveringstidspunkt, men er ikke afsluttet endnu.` (past delivery time, not completed).

### Kunde (Customer)
- **`Fakturerings- og leveringsadresse`** (Billing & delivery address) — read-only block: name, street, postal+city, `Att:` contact, phone, email, `CVR:` (company reg. no.).
- Button **`Rediger kontaktinfo`** (Edit contact info) → opens contact edit.
- **`Anden leveringsadresse`** (Different delivery address): `Nej`/`Ja`.

### Ordreinfo (Order info)
- **`Planlagt leveringstidspunkt`** (Planned delivery time): e.g. `Uge 27, mandag d. 29/6-26, kl. 8:30 – 9:30`.
- **`Ordrestatus`** (Order status): e.g. `Afventer levering, ikke afsluttet eller indmeldt`.
- **`Ordrehistorik og -kilde`** (Order history & source): e.g. `Kilde: Abo. #235837 (Hver uge)` — links order to its originating subscription/recurrence.
- **`Notifikation`**: current notification decision, e.g. `Indstillingerne gør at denne ordre ikke skal have en notifikation.`
- **`Ordrekommentar`** (Order comment): textarea — *"Tilføj valgfri, intern kommentar vedr. denne ordre…"* (optional internal note).

### Opgaver på ordren (Tasks on the order)
Editable line-item table, columns: **`Opgavebeskrivelse`** (task description) · **`Pris (inkl. moms)`** (price incl. VAT) · **`Varighed (min.)`** (duration in minutes).
- Each row: a task-type icon (Vinduespudsning window-cleaning / Andet other), editable description, editable price, editable duration, per-row `…` menu + trash/delete icon. Rows sourced from a subscription show *"Dette er en opgave fra abonnementet"* (this task comes from the subscription) and an hourly-rate readout `Timepris 1880 kr/t`.
- Example rows: `Vinduespudsning udvendig` (exterior) 470.00 / 15 min; `Vinduespudsning indvendig` (interior) 470.00 / 15; `Andet – Fjernelse af spindelvæv…` (cobweb removal) 578.00 / 30.
- Button **`Tilføj opgave`** (Add task).
- **`Sum`** row: total price + total duration (e.g. 1518.00 / 60) with **`Timepris … kr/t`** effective hourly rate.
- **`Overskriv sum`** (Override sum): optional manual `Pris (inkl. moms)` + `Varighed (min.)` override → `Total`.

### Planlægning i kalender (Calendar planning)
- **`Skal ordren fastlåses helt?`** (Fully lock the order?): `Ja`/no.
- **`Klokkeslæt og dato`** (Time & date): datetime picker (`event` icon).
- **`Medarbejder`** (Employee): select — `Vælg medarbejder` / `Kristian Klercke`.

### Andet (Other)
- **`Adressebemærkning`** (Address note): textarea — *"Valgfrit, internt notat, der relaterer sig til leveringsadressen"* (optional internal note tied to the delivery address).

### Actions (footer)
- **`Luk`** (Close, back to `back_url`).
- **`Andre handlinger`** (Other actions) — dropdown (delete order, complete/afslut, etc.).
- **`Gem ordre`** (Save order).
