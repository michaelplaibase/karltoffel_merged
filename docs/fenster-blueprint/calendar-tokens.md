# Fenster Portal — Calendar & Day-program visual tokens (measured)

Measured live with `getComputedStyle` on the logged-in portal (FullCalendar 3.9.0 + shards.css + calendar.css), 2026-07-03.
Pages: `https://www.fenster.dk/calendar?date=2026-11-16` and `https://www.fenster.dk/daycalendar?date=2026-11-16`.
All rgb values converted to hex. Base page: `body` bg `#FFFFFF`, font `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial`, 16px, weight 300, color `#5A6169`.

## Calendar

### Page shell
- Whole calendar sits in a shards card: `.card.py-3.px-3.border.border-light` — bg `#FFFFFF`, border `1px solid #E9ECEF`, border-radius `10px`, padding `16px`, box-shadow `0 7.5px 35px rgba(90,97,105,.1), 0 ...` (shards default card shadow).
- Left sidebar `.col-3.sidebar.w-sidebar`: **width 220px**, padding 0, transparent bg, position relative.

### Week grid (agendaWeek, `.fc-time-grid`)
- **Time-axis column** (`.fc-axis`): measured width **36.5px** (border-box), `padding: 0 4px`, `text-align: right`, font-size `12px`, color `#5A6169`, border `1px #DEE2E6`.
- **Slot rows** (`.fc-slats tr`): **96 rows = 15-minute slots** over 24h. Measured row height **18.5–19px** (sub-pixel alternation; ≈ 18.75px each, **≈ 75px per hour**).
  - Hour row (first of each group of 4): `td` border-top `1px solid #DEE2E6`.
  - Minor rows (`tr.fc-minor`, rows 2–4 of each hour): `td` border-top `1px dotted #DEE2E6`.
  - Axis label only on the hour row, format `0:00`, `1:00` … (minor rows empty).
- **Grid line / widget border color** (`.fc-widget-content`, all fc borders): `#DEE2E6`, 1px.
- **Header axis cell** (top-left, above time axis): text `Uge` + week number ("Uge 47"), 12px, weight 600, `#5A6169`.
- **Current-time indicator** (`.fc-now-indicator-line`): border-top `1px solid #257BB6`.

### Day header (`.fc-day-header`)
- Cell: height **68px**, transparent bg, `text-align: center`, padding 0, border-top `1px #DEE2E6`, border-bottom `2px` (fc head divider), base font 16px / 700 / `#5A6169`.
- Contents (stacked, centered):
  1. Dropdown trigger top-left corner of each column: `a.actions-menu > i.bi.bi-caret-down-square` (16px, `#5A6169`); its `.dropdown-menu` items (`Gå til dato i dagsprogram`, `Flyt ordrer ...`, `Fastlås ordrer ...`, `Fastlås og send notifikationer ...`) are `button.dropdown-item` 15px / 300 / `#212529`.
  2. Day link `<a>`: day name + date ("man" / "16" on two lines), **16px, weight 700, color `#257BB6`**, no underline (links to that date's dagsprogram).
  3. Revenue line `p.col_revenue.mb-1`: "Kr. 2.898", **12px, weight 400, `#5A6169`**, margin `0 0 4px`.

### Event block (`.fc-time-grid-event.fc-event`)
- Background: **`#A4D5EE`** (rgb 164,213,238).
- Border: **2px solid, all four sides, in the STATUS color** (not left-only — the full 2px border carries the status):
  - `orderClosed` (Afsluttet): `#1CBD6B`
  - `orderNotClosedInTime` (Ikke afsluttet): `#FFB400`
  - `orderOverflowed` (Mislykket planl.): `#C4183C`
  - `orderUnscheduled` (Afventer planl.): `#C4183C` (dotted rendering in legend)
  - Not-yet-actionable future orders: border color = bg (`#A4D5EE`), i.e. no visible status ring.
- Border-radius: **3px**. Padding 0, margin 0. Box-shadow none, opacity 1.
- Lock-state overlay (`background-image` on the event):
  - `order_background_partly_locked` (Delvist frigjort): `repeating-linear-gradient(105deg, transparent 0, transparent 5px, #F8F8FF 6px, #F8F8FF 11px, transparent 12px)`
  - `order_background_not_locked` (Helt frigjort): `repeating-linear-gradient(105deg, transparent 0, transparent 1px, #F8F8FF 2px, #F8F8FF 11px, transparent 12px)`
  - Helt fastlåst: no stripes (solid bg).
- Text: `.fc-time` and `.fc-title` both `display:block`, **12px, weight 300, color `#000000`**, padding `0 1px`, line-height 17.68px. Time renders as `8:30 - 9:30`; title lines = postcode/city, customer/location name.
- Small icon badges (order type `A`/`O`/`M` squares, notification envelope) render top-right inside the event at ~16px.
- Draggable (`fc-draggable`), each has `order-id-<n>` class.

### Background shading
- **Closed hours / Lukketid** (`.ruleHours-Closed.fc-bgevent`): bg `#A4D5EE` + `repeating-linear-gradient(45deg, transparent 0, transparent 10px, rgba(150,150,150,0.4) 10px, rgba(150,150,150,0.4) 20px)`, **opacity 0.7**.
- **Arbejdstid** (working hours): plain white `#FFFFFF` (unshaded).
- **Driving blocks** (`.driving_time.driving_time_before[...back_to_back]`): bg **`rgba(164,213,238,0.5)`**, border `1px` sides (top 1px on first segment), no radius; rendered as column-wide blocks butting the event.

### Toolbar (custom header row; `.fc-toolbar` itself is empty)
- Left group `.switch-date-buttons.btn-group`: `[‹ chevron] [Idag] [› chevron]` — `button.btn.btn-light`: bg **`#E9ECEF`**, border `1px solid #E9ECEF`, color `#212529`, **font-size 12px, weight 300, padding 5.6px 16px, height ≈31px**; group corners 6px (first `6px 0 0 6px`, last `0 6px 6px 0`, middle 0). Chevrons are FontAwesome SVG (`fa-chevron-left/right`).
- `Uge ▾` dropdown: same `btn btn-light dropdown-toggle`, bg `#E9ECEF`, 12px.
- Title `h2.calendar-title`: e.g. "Nov. 2026" — **20.8px (1.3rem), weight 400, `#212529`**, inline next to the nav group.
- Right group `.agenda-view-buttons.btn-group`: `Dag | 5 dg | 7 dg` + search-icon button — identical `btn btn-light` styling; the active view button gets `.active` (same `#E9ECEF` computed bg; visual difference is minimal/darker per bootstrap active shading).

### Sidebar
- Section headings `h6`: **16px, weight 400, `#212529`**, margin-bottom 8px. Sections: `Planlægning`, `Medarbejdere`, `Planlagt omsætning`, `Planlagt kørsel`, `Vis i kalender`, `Forklaringer` (collapse-link toggling `#collapse-legend`).
- Body text (revenue/driving lines, e.g. "Uge 47: kr. 2.898", "Nov.: kr. 14.849", "Man.: 1 t 14 min"): **14.4px (0.9rem), weight 300, `#5A6169`** (label left, amount right on same line).
- `Genplanlæg uge` button: `button.btn.btn-light` (customized) — bg **`#E8E8E8`**, border `1px solid #B0B0B0`, color `#212529`, radius `6px`, padding `12px 20px`, **14px weight 300**, ~160×42px. Below it: "Planlagt 28/6 kl. 05:16" in the 14.4px body style.
- Employees: `div.form-check.form-check-in-sidebar` rows — checkbox + name label.
- "Vis i kalender": checkboxes `Vis arbejdstider`, `Vis kørsel`.

### Legend (`#collapse-legend`) — swatch = inline-block **24×16px**, margin-right 6px, no radius; label 14.4px/300/`#5A6169`
| Group | Label | Swatch |
|---|---|---|
| Ordreplanlægning | Helt fastlåst | solid `#A3DBF6` |
| | Delvist frigjort | `#A3DBF6` + 105° stripes `#F8F8FF` (5px blue / 5px white) |
| | Helt frigjort | `#A3DBF6` + 105° stripes `#F8F8FF` (1px blue / 9px white) |
| Ordrestatus | Afsluttet | 2px border `#1CBD6B` (transparent fill) |
| | Ikke afsluttet | 2px border `#FFB400` |
| | Mislykket planl. | 2px border `#C4183C` |
| | Afventer planl. | 2px border `#C4183C` (dotted style) |
| Ordretype | Abonnement / Online / Manuel | glyph icons (square-letter icons, `#5A6169`/`#257BB6`) |
| Notifikation | Deaktiveret / Planlagt / Afsendt / Fejl / Kun dato / Dato og klokkeslæt | envelope glyph icons |
| Andet | Arbejdstid | solid `#FFFFFF` |
| | Fleksibel arbejdstid / Lukketid | `#A3DBF6` + 45° stripes `rgba(150,150,150,0.4)` (10px/10px), opacity 0.7 |
| | Kørsel | solid `rgba(163,219,246,0.5)` |

Note the two blues: legend swatches use `#A3DBF6`; the actual grid events/shading render `#A4D5EE`.

## Day program (`/daycalendar?date=...`, FullCalendar list view)

### Card & header
- `.fc-view.fc-listDay-view.fc-list-view.card`: **width 418px** (centered), bg `#FFFFFF`, border **`1px solid #BECAD6`**, border-radius **10px**.
- Above the list: prev/next `btn btn-light` group (bg `#E9ECEF`, ~51×42px each, radius 6px on outer corners, FA chevrons) + a caret-square dropdown icon; right-aligned date block `a.daycalendar_date_link`: line 1 "mandag (uge 47)" **16px / 300 / `#5A6169`**, line 2 "16. nov. 2026" **25px / 400 / `#5A6169`**.

### Summary heading row (`.fc-list-heading > td.table-active`)
- bg **`rgba(0,0,0,0.075)`** (over white ≈ `#ECECEC`), padding `8px 14px`, cell base 16px/700/`#5A6169`.
- Inside: two `p.revenue_text` — "Planlagt omsætning (dag/uge/måned):" and "Kr. 2.898 / 2.898 / 14.849", plus "Planlagt kørsel: 1 t 14 min" — **14px, weight 400, `#5A6169`**.

### Stop row (`.fc-list-item`, sample height 153px, 3 cells, border-top `1px solid #DEE2E6` per cell)
1. **Left icon cell** `.fc-list-item-time` — width **46px**, padding `6px 8px 4px`. Vertical stack of icon buttons in `p.wrap_button` (margin `0 0 5px`): `button.btn.btn-sm.btn-outline-primary.auxButtonDayCalendar` — **30×30px**, padding 0, transparent bg, border+color **`#257BB6`**, radius **5.6px**, icons `bi-geo-alt-fill`, chat, phone, `@` at 16px.
2. **Content cell** `.fc-list-item-title` — width ~249px, padding `8px 3px`, base **14px / 300 / `#5A6169`**:
   - `<b>08:30 - 09:00</b>` time window: 14px, **weight 500**, `#5A6169`.
   - order-type / notification icons inline after the time: `i.fa-solid.fa-square-u`, `fa-square-minus` etc., 16px, `#257BB6` (or dark navy for type badges).
   - Address (line 2, links to maps — plain text style, no underline, `#5A6169`), customer/location name (line 3), `Kr. 940` (line 4) — all inherit 14px/300/`#5A6169`.
   - Bottom icon row: `a.popover-icon` glyphs at **19.2px (1.2rem)** — `bi-info-circle-fill` `#257BB6`, `bi-image` `#257BB6`, card/envelope icons (muted `#5A6169` when inactive, amber for pending notification states).
3. **Actions cell** (also `.fc-list-item-time`) — width **121px**, padding `6px 8px 4px`. Stacked full-width buttons, each in `p.wrap_button` (mb 5px): `Afslut ordre`, `Rediger ordre`, `Rediger abo.`, `Mere ▾` (`dropdown-toggle`) — all `button.btn.btn-outline-primary.btn-sm`: transparent bg, color+border **`#257BB6`** 1px, radius **5.6px**, **font-size 12px, weight 300, padding 5.6px 8px, 105×30px**. Hover = solid `#257BB6` bg / white text (bootstrap outline behavior).

## CSS tokens

```css
:root {
  /* palette */
  --cal-primary: #257BB6;            /* links, now-indicator, outline buttons, day-header link */
  --cal-text: #5A6169;               /* default text (body 16px/300) */
  --cal-text-dark: #212529;          /* headings, btn-light text */
  --cal-grid-line: #DEE2E6;          /* all fc borders; dotted for .fc-minor */
  --cal-card-bg: #FFFFFF;
  --cal-card-border: #E9ECEF;        /* calendar card */
  --cal-card-radius: 10px;

  /* week grid */
  --cal-axis-width: 36.5px;          /* .fc-axis, padding 0 4px, 12px right-aligned */
  --cal-slot-height: 18.75px;        /* one 15-min slat row (measured 18.5–19) */
  --cal-hour-height: 75px;           /* 4 slots */
  --cal-dayheader-height: 68px;
  --cal-dayheader-link: 700 16px/1 #257BB6;   /* "man 16" */
  --cal-dayheader-revenue: 400 12px #5A6169;  /* "Kr. 2.898" */

  /* events */
  --cal-event-bg: #A4D5EE;
  --cal-event-radius: 3px;
  --cal-event-border-width: 2px;     /* ALL sides, colored by status */
  --cal-event-font: 300 12px #000;   /* .fc-time & .fc-title, padding 0 1px */
  --cal-status-closed: #1CBD6B;
  --cal-status-late: #FFB400;
  --cal-status-failed: #C4183C;      /* also 'afventer' (dotted) */
  --cal-stripe-color: #F8F8FF;       /* lock-state 105deg stripes */
  --cal-closed-hours-stripe: rgba(150,150,150,0.4); /* 45deg, 10px/10px, opacity .7 over #A4D5EE */
  --cal-driving-bg: rgba(164,213,238,0.5);
  --cal-now-indicator: 1px solid #257BB6;

  /* toolbar */
  --cal-btn-bg: #E9ECEF;             /* btn-light: border 1px #E9ECEF, text #212529 */
  --cal-btn-font: 300 12px;
  --cal-btn-pad: 5.6px 16px;         /* h ≈ 31px */
  --cal-btn-radius: 6px;             /* on btn-group outer corners */
  --cal-title-font: 400 20.8px #212529; /* h2.calendar-title */

  /* sidebar */
  --cal-sidebar-width: 220px;
  --cal-sidebar-heading: 400 16px #212529;   /* h6, mb 8px */
  --cal-sidebar-text: 300 14.4px #5A6169;
  --cal-legend-swatch: 24px 16px;    /* inline-block, mr 6px */
  --cal-legend-blue: #A3DBF6;

  /* day program */
  --daycal-card-width: 418px;
  --daycal-card-border: #BECAD6;     /* 1px, radius 10px */
  --daycal-heading-bg: rgba(0,0,0,0.075);
  --daycal-heading-pad: 8px 14px;
  --daycal-heading-font: 400 14px #5A6169;   /* p.revenue_text */
  --daycal-date-title: 400 25px #5A6169;     /* "16. nov. 2026" */
  --daycal-date-sub: 300 16px #5A6169;       /* "mandag (uge 47)" */
  --daycal-row-border: 1px solid #DEE2E6;
  --daycal-icon-col-width: 46px;     /* pad 6px 8px 4px */
  --daycal-actions-col-width: 121px;
  --daycal-content-pad: 8px 3px;     /* base 300 14px #5A6169; time <b> 500 */
  --daycal-btn: #257BB6;             /* btn-outline-primary btn-sm: 12px/300, pad 5.6px 8px, r 5.6px, 105x30 (icons 30x30) */
}
```

## Screenshots
Captured via the browser tool with `save_to_disk:true`; the tool returned capture IDs but no filesystem path in this environment (no file found on disk):
- Calendar week view (Nov 2026, sidebar + legend expanded): capture ID `ss_2475vyfh9`
- Day program 2026-11-16 (3 stops): capture IDs `ss_99506wq8o`, `ss_84729d7ow`
