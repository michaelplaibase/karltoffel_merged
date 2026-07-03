# Fenster Partner Portal — Reverse-Engineering Spec (logged-in)

**What it is:** A Danish SaaS CRM + field-operations platform for **small/medium window-cleaning companies** (vinduespudsere, up to ~10 employees). Handles customers, subscriptions, fixed-price agreements, orders, automatic scheduling + route optimization, invoicing (Dinero integration), and customer communication (email/SMS). Marketing site: `partner.fenster.dk`; app: `www.fenster.dk`.

**Logged-in account (test):** user `kristianklercke` (Kristian Klercke), company **KRLTFL ApS**. One employee. Live data present.

**Tech signals:** Server-rendered (Bootstrap 3-ish), jQuery, FullCalendar-style week grid, Intercom support widget, Dinero accounting integration. Danish UI throughout.

---

## Global chrome (every logged-in page)

- **Top navbar (blue):** `Fenster Portal` logo (→ `/home`, which redirects to `/calendar`) · **Kalender** · **Dagsprogram** · **Indstillinger ▾** · **Funktioner ▾** · **Kartotek ▾** · **Rapportering ▾** · **Hjælp ▾** · (right) **account avatar `kristianklercke` ▾**.
- **Account dropdown:** `KRLTFL ApS` (company, → `/account/` Fenster konto) · `Skift password` (→ `/change_password/`) · `Log ud`.
- **Footer:** `Copyright © 2026 • Powered by Fenster`.
- **Support:** floating **Intercom** messenger button, bottom-right ("Open Intercom Messenger").

## Login page (`/login/`)
- Fenster logo + heading **`Partner Portal`**.
- Field `Brugernavn` (username, text).
- Field `Kodeord` (password) with show/hide eye toggle.
- Button **`Log ind`**.
- Footer link: `Er du ikke Fenster Partner? ` → **`Tilmeld dig her`** (sign-up).

---

## COMPLETE ROUTE MAP (all confirmed logged-in routes)

### Core
| Route | Menu label | English |
|---|---|---|
| `/home` | (logo) | redirects → `/calendar` |
| `/calendar` | Kalender | Calendar / scheduling grid |
| `/daycalendar` | Dagsprogram | Day program / daily route (`?date=YYYY-MM-DD`) |
| `/order_edit/{id}` | (from calendar) | Order editor (`?back_url=…`) |

### Indstillinger (Settings ▾)
| Route | Label | English |
|---|---|---|
| `/settings` | Generelt | General |
| `/funnel_settings` | Udseende | Appearance / online-booking funnel |
| `/user_accounts` | Brugere | Users / employees |
| `/working_hours/` | Arbejdstider | Working hours |
| `/planning_settings/` | Planlægning | Planning / routing |
| `/discount_codes` | Rabatkoder | Discount codes |
| `/standard_task_list/` | Standardopgaver | Standard tasks catalog |
| `/dinero_settings` | Regnskab | Accounting (Dinero) |

### E-mail og SMS skabeloner (Settings ▸ submenu — message templates)
| Route | Label | English |
|---|---|---|
| `/email_and_sms_settings_before_delivery` | Notifikation før levering | Notification before delivery |
| `/email_and_sms_settings_after_delivery` | Notifikation efter levering | Notification after delivery |
| `/email_and_sms_settings_subscription_confirmation` | Abonnementsbekræftelse | Subscription confirmation |
| `/email_and_sms_settings_subscription_defrag_notification` | Abonnementsflytning | Subscription move/optimization notice |
| `/email_and_sms_settings_order_confirmation` | Ordrebekræftelse | Order confirmation |
| `/email_and_sms_settings_order_reminder` | Påmindelse om genbestilling | Reorder reminder |
| `/email_and_sms_settings_invoice` | Fakturaafsendelse | Invoice sending |
| `/email_and_sms_settings_price_adjustment_notification` | Prisjustering | Price-adjustment notice |

### Funktioner (Functions ▾)
| Route | Label | English |
|---|---|---|
| `/custom_message_list` | Gruppebeskeder | Group/bulk messages |
| `/holiday_weeks_list/` | Ferieplanlægning | Holiday planning |
| `/subscription_defragmentation/` | Abonnementsoptimering | Subscription optimization |
| `/price_adjustment_list/` | Prisjustering | Price adjustment runs |

### Kartotek (Register ▾)
| Route | Label | English |
|---|---|---|
| `/contact_list/` | Kunder | Customers |
| `/subscription_list` | Abonnementer | Subscriptions |
| `/fixed_prices_times_list/` | Fastprisaftaler | Fixed-price agreements |
| `/order_event_list` | Ordrer | Orders |

### Rapportering (Reporting ▾)
| Route | Label | English |
|---|---|---|
| `/graph_reports` | Grafer og nøgletal | Charts & KPIs |
| `/report_download` | Rapporter | Downloadable reports |
| `/daycalendar_export` | Dagsprogram i PDF | Day program as PDF |

### Hjælp (Help ▾) + Account
| Route | Label | English |
|---|---|---|
| `/businesspartners/` | Samarbejdspartnere | Partners |
| `/quiz/` | Fenster quiz | Quiz |
| `/support/` | Kontakt support | Contact support |
| `/account/` | Fenster konto | Account/company profile |
| `/change_password/` | Skift password | Change password |
| (Help menu also: Hjælpecenter, Kom godt i gang, Hjælpevideoer, Facebook gruppe — external links) |

**Fetch-probe field/table density (server-rendered richness, for build sizing):**
settings f=33 · funnel_settings f=19 · user_accounts f=31 · working_hours f=31 · planning_settings f=5 · discount_codes t=2 · standard_task_list hl=257k (big) · dinero_settings t=2 · each email/sms template f≈6 · contact_list/subscription_list/order_event_list = data tables.
