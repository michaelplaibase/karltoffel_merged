# Fenster Partner Portal — Settings Section (Indstillinger) UI/Functionality Spec

Documented 2026-07-03 against the live logged-in portal (account: `KRLTFL ApS`, user `Kristian Klercke`). Base URL: `https://www.fenster.dk`. All UI text is Danish; English translations in parentheses.

## Global layout & navigation (applies to every Settings page)

- **Top navbar** (dark, fixed): brand link `Fenster Portal` (→ `/home`), a `Toggle navigation` hamburger button (collapsed/mobile), then horizontal menu items:
  - `Kalender` (Calendar) → `/calendar`
  - `Dagsprogram` (Day program) → `/daycalendar`
  - `Indstillinger` (Settings) — dropdown containing:
    - `Generelt` (General) → `/settings`
    - `Udseende` (Appearance) → `/funnel_settings`
    - `Brugere` (Users) → `/user_accounts`
    - `Arbejdstider` (Working hours) → `/working_hours/`
    - `Planlægning` (Planning) → `/planning_settings/`
    - `Rabatkoder` (Discount codes) → `/discount_codes`
    - `Standardopgaver` (Standard tasks) → `/standard_task_list/`
    - `Regnskab` (Accounting) → `/dinero_settings`
    - `E-mail og SMS skabeloner` (E-mail and SMS templates) — nested sub-dropdown:
      - `Notifikation før levering` (Notification before delivery) → `/email_and_sms_settings_before_delivery`
      - `Notifikation efter levering` (Notification after delivery) → `/email_and_sms_settings_after_delivery`
      - `Abonnementsbekræftelse` (Subscription confirmation) → `/email_and_sms_settings_subscription_confirmation`
      - `Abonnementsflytning` (Subscription move) → `/email_and_sms_settings_subscription_defrag_notification`
      - `Ordrebekræftelse` (Order confirmation) → `/email_and_sms_settings_order_confirmation`
      - `Påmindelse om genbestilling` (Re-order reminder) → `/email_and_sms_settings_order_reminder`
      - `Fakturaafsendelse` (Invoice sending) → `/email_and_sms_settings_invoice`
      - `Prisjustering` (Price adjustment) → `/email_and_sms_settings_price_adjustment_notification`
  - `Funktioner` (Features) dropdown: `Gruppebeskeder` → `/custom_message_list`, `Ferieplanlægning` → `/holiday_weeks_list/`, `Abonnementsoptimering` → `/subscription_defragmentation/`, `Prisjustering` → `/price_adjustment_list/`
  - `Kartotek` (Registry) dropdown: `Kunder` → `/contact_list/`, `Abonnementer` → `/subscription_list`, `Fastprisaftaler` → `/fixed_prices_times_list/`, `Ordrer` → `/order_event_list`
  - `Rapportering` (Reporting) dropdown: `Grafer og nøgletal` → `/graph_reports`, `Rapporter` → `/report_download`, `Dagsprogram i PDF` → `/daycalendar_export`
  - `Hjælp` (Help) dropdown: `Hjælpecenter` → `https://help.fenster.dk`, `Kom godt i gang`, `Hjælpevideoer`, `Facebook gruppe`, `Samarbejdspartnere` → `/businesspartners/`, `Fenster quiz` → `/quiz/`, `Kontakt support` → `/support/`
  - Right side: company dropdown `KRLTFL ApS` with `Fenster konto` → `/account/`, `Skift password` → `/change_password/`, `Log ud` (Log out).
- **Page pattern**: single centered column; `<h1>` page title; content in stacked panels/cards with `<h3>`-style section headings; each form field is a label + control + small grey help text underneath; one big submit button at the bottom: `Gem alle ændringer` (Save all changes).
- **Global hidden dialogs present on all pages** (rendered in DOM, shown conditionally):
  - `Internet Explorer 11 er ikke understøttet` (IE11 not supported) with link `Åbn i Microsoft Edge`.
  - Subscription-upgrade modal `Denne funktion er ikke inkluderet i dit Fenster abonnement` (This feature is not included in your Fenster subscription) — shows required package (`Pro`), a price table (`Fenster pakke`, `Ekstra medarbejder, stk`, `Gratis admin. medarbejder`, `Total`, each with `kr/mdr` column), link to `https://partner.fenster.dk/priser/`, confirm checkbox `Jeg bekræfter, at jeg ønsker at opgradere ...`, buttons `Luk` / `Opgrader`; plus success modal `Opgradering gennemført` with `Ok` button.
- **Footer**: `Copyright © 2026` / `Powered by Fenster`. Intercom chat launcher bottom-right (`Open Intercom Messenger`).

---

## Generelt — General settings (`/settings`)

Page purpose: central account-wide operational settings — SMS approval, customer notifications, invoicing channel, "Afslut ordre" (Complete order) form presets, online booking, hourly prices and time/price-calculator customization. Single form; all changes saved with one submit button.

### Sections

1. `Fenster konto` (Fenster account)
2. `Diverse` (Miscellaneous)
3. `Notifikationer` (Notifications)
4. `Fakturering` (Invoicing)
5. `Afslut ordre` (Complete order)
6. `Online bestilling` (Online booking)
7. `Timepriser` (Hourly prices)
8. `Tilpasning af tids-/prisberegner` (Customization of time/price calculator)

### Fields

**Fenster konto**
- No fields. Intro text: `Indstillinger vedr. din Fenster konto, f.eks. virksomhedsoplysninger, dit Fenster abonnement, kapacitetsforbrug, betalingsoplysninger, fakturahistorik, mv.` (Settings regarding your Fenster account, e.g. company info, subscription, capacity usage, payment info, invoice history, etc.)

**Diverse**
- `Godkend brug af SMS` (Approve use of SMS) — action row, control is a button `Læs og godkend` (Read and approve) that opens the SMS-approval modal (see Actions). Help text: `Godkend at Fenster må afsende SMS'er og at du bliver opkrævet for dit forbrug på din Fenster faktura.`

**Notifikationer**
- Intro help: `Du kan sende notifikationer til dine kunder før og efter levering af din service. Indstillingerne gælder for alle ordretyper, med undtagelse af online ordrer, hvor der ikke sendes notifikation før og efter levering. Du kan overskrive indstillingerne på det enkelte kundeabonnement... Notifikationer sendes til kontakten på leveringsadressen.`
- `Send notifikationer via` (Send notifications via) — two checkboxes:
  - `SMS` (checkbox) — disabled/gated until SMS use approved; tooltip/help: `Brugen af SMS er ikke godkendt endnu. Gå til Indstillinger → Generelt og godkend brug af SMS`.
  - `E-mail` (checkbox).
- `Send notifikation før levering, når 'Kunden skal være tilstede'` (Send notification before delivery, when 'Customer must be present') — select. Full DOM label: `Vælg hvilken notifikation der skal sendes før levering, når en eller flere opgaver på ordren kræver [at kunden er tilstede]`. Options (value in code):
  - `Nej, send ikke` (No, do not send) = `NO` (current/default)
  - `Ja, med dato` (Yes, with date) = `DATE`
  - `Ja, med dato og tidsinterval (-1t → +2t)` = `DATETIME_INTERVAL_3H`
  - `Ja, med dato og tidsinterval (-1t → +1t)` = `DATETIME_INTERVAL_2H`
  - `Ja, med dato og klokkeslæt` (Yes, with date and time of day) = `DATETIME`
  - Help: `Vælg 'Nej', hvis du ikke vil sende notifikation før levering. Alternativt, vælg hvordan du vil oplyse om leveringstidspunkt, når opgaverne kræver, at kunden skal være tilstede.`
- `Vælg antal dage notifikationen skal sendes før levering, når en eller flere opgaver på ordren kræver [tilstedeværelse]` — number input, current value `3`. **Conditionally shown** (hidden while the select above is `Nej, send ikke`). Help: `Skriv hvor mange dage før leveringstidspunktet, at kunden skal modtage en notifikation...`
- `Send notifikation før levering, når 'Kunden ikke behøver at være tilstede'` (…when customer does NOT need to be present) — select with identical 5 options/values as above; current `Nej, send ikke`. Same style help text.
- `Vælg antal dage notifikationen skal sendes før levering, når ingen af opgaverne på ordren kræver [tilstedeværelse]` — number input, current value `3`. Conditionally shown like its sibling.
- `Send notifikation efter levering` (Send notification after delivery) — checkbox styled as toggle with `Ja` label; currently checked. Help: `Vælg om du ønsker at sende en notifikation til kunden efter levering, dvs. når ordrens leveringsstatus opdateres til udført (f.eks. når status meldes ind eller ordren afsluttes).`

**Fakturering**
- Intro: `Fenster kan sende faktura til dine kunder, forudsat du har aktiveret en integration til et regnskabsprogram, f.eks. Dinero.`
- `Afsend faktura via` (Send invoice via) — two checkboxes: `SMS` (gated by SMS approval, same tooltip as above) and `E-mail`. Help: `Faktura udstedes altid af Dinero. Herefter varetager Dinero afsendelse via email, mens Fenster varetager afsendelse via SMS til gældende SMS priser.`

**Afslut ordre** (Complete order presets)
- Intro: `Du kan vælge at lave standard forudindstillinger for felter på siden "Afslut ordre", således at du kan spare klik hver gang, du afslutter en ordre. Desuden kan du indstille TrustPilot AFS.`
- `Forudindstilling for 'Leveringsstatus'` (Preset for 'Delivery status') — radio group:
  - `Blank (ingen forudindstilling)` (Blank / no preset)
  - `Udført` (Completed)
  - `Anden status` (Other status)
  - Help: `Vælg hvordan sektionen "Leveringsstatus" på siden "Afslut ordre" skal forudindstilles som standard.`
- `Forudindstilling for 'Betaling og fakturering'` (Preset for 'Payment and invoicing') — radio group:
  - `Blank (ingen forudindstilling)`
  - `Send faktura - ubetalt` (Send invoice - unpaid)
  - `Send faktura - betalt kontant` (Send invoice - paid in cash)
  - `Send ikke faktura fra Fenster` (Do not send invoice from Fenster)
  - `Opret fakturakladde` (Create invoice draft)
  - `Registrer på et senere tidspunkt` (Register at a later time)
  - Help: `Vælg hvordan sektionen "Betaling og Fakturering" på siden "Afslut ordre" skal forudindstilles som standard.`
- `Forudindstilling for 'Betaling'` (Preset for 'Payment') — radio group, **present in DOM but not in the visible page text (conditionally displayed, presumably when no accounting integration / alternative mode)**:
  - `Blank (ingen forudindstilling)`
  - `Kontant` (Cash)
  - `MobilePay Get Paid`
  - `Ikke betalt på adressen` (Not paid at the address)
  - `Registrer på et senere tidspunkt`
  - Help: `Vælg hvordan sektionen "Betaling" på siden "Afslut ordre" skal forudindstilles som standard.`
- `Trustpilot AFS e-mail` — text input (currently empty). Help contains two external links: `Trustpilot AFS (Automatisk Feedback Service)` (→ Trustpilot support article) and `inde i Trustpilot` (→ `https://businessapp.b2b.trustpilot.com/invitations/eti-settings`). Full help: `Indtast din unikke Trustpilot email adresse, såfremt du vil aktivere Trustpilot AFS... Når du afslutter en ordre, beder Fenster Trustpilot om at sende en e-mail til kunden med anmodning om en anmeldelse...`

**Online bestilling** (Online booking)
- `Anvend online bestilling` (Use online booking) — checkbox/toggle `Ja`, currently checked. Help: `Gør det muligt for dine kunder at bestille vinduespudsning online via din bestillingsside. Husk også at aktivere online bestilling på de enkelte medarbejdere.`
- `Web-adresse` (Web address) — read-only text input, value `https://www.fenster.dk/krltfl`, flanked by two inline actions: `Følg adresse` (Follow address — opens the booking funnel) and `Kopier adresse` (Copy address — copies to clipboard, shows dismissible alert `Kopiert`). Help: `Web-adressen på bestillingsside, som dine kunder kan bruge. Du skal bruge adressen, hvis du f.eks. lægger en knap ind på din hjemmeside/facebook, eller som QR kode til en flyer.`
- `Bestillingsvarsel (timer)` (Booking notice, hours) — number input, current `24`. Help: `...bestemmer, hvor mange timer der min. skal være mellem bestillings- og leveringstidspunkt. Standardværdien er 24 timer`.
- `Send påmindelse om genbestilling` (Send re-order reminder) — checkbox/toggle `Ja`, currently checked. Help: `Sender en påmindelse til online kunder om at bestille igen efter X dage. Sendes kun pba online ordrer, ikke på baggrund af manuelle ordrer eller abonnementskunder.`
- `Send påmindelse antal dage efter afsluttet ordre` (Send reminder N days after completed order) — number input, current `60`. Help: `Antal dage der skal gå efter seneste ordre er afsluttet før påmindelse fremsendes til kunden.`
- `Deltag i online kundehenvisning` (Participate in online customer referral) — checkbox/toggle `Ja`, currently checked. Help: `Hvis en online kunde ligger uden for dit serviceområde, så henvises kunden til en anden Fenster Partner (i stedet for at blive afvist og gå tabt). Ligeledes vil du også modtage kundehenvisninger fra andre Fenster Partnere...`

**Timepriser** (Hourly prices)
- Intro: `Timepriser anvendes af Fenster til at estimere prisen på en ordre, f.eks. hvis du har valgt, at dine kunder kan bestille vinduespudsning online, eller hvis du vælger at gøre brug af prisberegneren, når du manuelt opretter en ordre i kalenderen.`
- `Timepris i Lokalområde` (Hourly price in Local area) — number input, current `600`; unit note `DKK inkl. moms og eks. kørsel` (DKK incl. VAT, excl. driving). One row per service area (this account has one area: "Lokalområde").
- Info alert: `Hvert af dine områder er indtegnet på et kort i Fenster. Hvis du ønsker at tilføje eller ændre dine områder (f.eks. navn eller størrelse), så kontakt Fenster Support.` — with link `Fenster Support` → `/support/`.

**Tilpasning af tids-/prisberegner** (Time/price calculator customization)
- No inputs; three explanatory paragraphs (calculator estimates duration/price of a task; technique/speed varies between window cleaners so it can be customized; fill in a questionnaire, takes ~10–15 min, Fenster Support applies changes and notifies by email).
- Link: `Klik for at åbne spørgeskemaet` (Click to open the questionnaire) → `https://forms.gle/bRydxsns8AFcNM62A`, followed by `(åbner i nyt vindue)`.

### Actions
- `Åbn Fenster konto side ...` (Open Fenster account page) — button-styled link → `/account/`.
- `Læs og godkend` (Read and approve) — opens modal `Godkend brug af SMS`:
  - Body: Fenster can send SMS on your behalf (notifications, invoices, subscription confirmations, ...); you must approve SMS use and accept being charged on your Fenster invoice; current SMS prices under `Din Fenster konto` (link → `/account/`); note that an SMS holds max 160 characters (SMS-technology limitation); `Hvis du ikke godkender, så kan du ikke sende SMS'er via Fenster.`
  - Buttons: `Luk` (Close) and submit `Godkend brug af SMS` (Approve use of SMS — its own small form/POST).
- `Følg adresse` / `Kopier adresse` (see Web-adresse above).
- `Gem alle ændringer` (Save all changes) — submit for the whole page form.

### Tables
- None.

### Notes
- All controls live in ONE `<form>` with hidden CSRF token inputs; a single submit persists everything.
- The two `Vælg antal dage ...` number fields are hidden until the corresponding "before delivery" select is set to a non-`NO` value.
- SMS checkboxes (notifications + invoicing) are disabled with an explanatory tooltip until SMS use is approved.

---

## Udseende — Appearance / booking funnel (`/funnel_settings`)

Page purpose: branding and content of the customer-facing online booking pages and outgoing emails — logo, colors, custom comment texts, terms & conditions, out-of-area message, and Google Ads conversion tracking.

### Sections
1. `Logo og grafik` (Logo and graphics)
2. `Farver` (Colors)
3. `Tekster og kommentarer` (Texts and comments)
4. `Handelsbetingelser` (Terms and conditions)
5. `Kører ikke på adressen` (We don't serve this address)
6. `Konverteringstracking` (Conversion tracking)

### Fields

**Logo og grafik**
- Intro: `Sæt indstillinger for logo og grafik her. Anvendes bl.a. på din bestillingsside og til dine e-mails, f.eks. ordrebekræftelse, abonnementsbekræftelse m.fl.`
- `Logo højde` (Logo height) — text input, current `60`. Help: `Dette angiver højden på dit logo i pixels. Anbefalet værdi ml. 50-150.`
- `Logo upload` — button `Vælg fil ...` (Choose file ...). NOT a native file input: it links to an external Fillout form `https://form.fillout.com/t/aBb3sTT4BTus?supplier=krltfl&supplier_email=...` (logo submitted to Fenster Support). Help: `Du kan anvende formaterne PNG, JPG og GIF. Logoet bør være mindre end 500 kilobytes... Efter upload lægger Fenster Support dit logo ind og giver dig besked via email.`
- `Nuværende logo` (Current logo) — label with a preview image of the currently installed logo.
- `Fjern grafik fra e-mails` (Remove graphics from e-mails) — checkbox/toggle `Ja`. Help: `Fenster indsætter normalt grafik i dine e-mails, f.eks. med en glad, hoppende dame, og lign. Du har mulighed for at fjerne denne grafik her.`

**Farver** (Colors) — each color is a pair: native color picker (`type="color"`) + hex text input, kept in sync.
- Intro: `Vælg farverne til din bestillingsside og til dine emails, f.eks. ordrebekræftelse, abonnementsbekræftelse m.fl.`
- `Top farve` (Top color) — current `#ffffff`. Help: background color at the top of the page where the logo sits; must match the logo.
- `Primær farve` (Primary color) — current `#6ec0e5`. Help: color of large buttons at the bottom of booking pages and all input borders; recommend a fairly dark color.
- `Sekundær farve` (Secondary color) — current `#dae8f1`. Help: color of the large summary box and active/selected inputs; recommend a fairly light color.
- `Tips o.a.` (Tips etc.) — current `#2484c6`. Help: color of small question marks and badges, e.g. the "billig kørsel" (cheap driving) badges when choosing a time slot; recommend an eye-catching color or same as primary.

**Tekster og kommentarer**
- `Pris-kommentar` (Price comment) — text input, currently empty. Help/example: `Eksempel: Prisen er inkl. materialer og gratis pudsning af altanglas, såfremt disse er nemt tilgængelige.`
- `Betalings-kommentar` (Payment comment) — text input, current value `Faktura fremsendes efter udført service`. Help/example: `Eksempel: Faktura fremsendes efter udført service.`
- Info alert: `Bemærk, at der er flere tekster, som kan tilpasses på bestillingssiderne, men det kun kan gøres med hjælp fra Fenster Support. Læs mere i Hjælpecenteret` — link `Hjælpecenteret` → `https://help.fenster.dk`.

**Handelsbetingelser** (Terms & conditions)
- Intro: terms must be accepted by customers when booking online; can also be attached to subscription confirmations; link `downloade en skabelon her` (download a template here) → `https://res.cloudinary.com/fenster/raw/upload/v1627213768/partner-resources/20210303_Skabelon_for_handelsbetingelser_ti2lw1.docx`; disclaimer that the terms are always the partner's responsibility.
- WYSIWYG rich-text editor (Trumbowyg-style): toolbar with unlabeled icon buttons (view-HTML, bold/italic/etc. formatting group of 4, a paragraph-format `combobox` with heading options values `1`,`2`,`3` and paragraph, list/link/etc. buttons ×6) plus a labeled `Se resultat` (See result) button that opens a preview modal `Handelsbetingelser`. Editor also exposes link-insert sub-controls (URL textbox + confirm/cancel links). Current content: `Udfyld venligst dine Salg og leveringsbetingelser her.` (placeholder-like content).

**Kører ikke på adressen** (Not serving the address)
- Intro: `Hvis kunden indtaster en adresse, som ligger uden for dit område, så vises denne besked. Undtaget hvis du deltager i "online kundehenvisning", så henvises kunden til en anden Fenster Partner, der kører på adressen.`
- Same WYSIWYG editor component as above (identical toolbar + `Se resultat`). Current content: `Beklager, men vi kører desværre ikke på din adresse` (Sorry, we unfortunately don't serve your address).

**Konverteringstracking** (Conversion tracking)
- Intro: `Her kan du opsætte integration til Google Adwords... tracke (få besked), når en kunde konverterer i Fenster, dvs. når en kunde gennemfører en online bestilling. Tal evt. med dit markedsføringsbureau.`
- `Google Ads Global Site Tag` — text input, empty. Help: `Eksempel: AW-123456789.`
- `Google Ads Conversion Label` — text input, empty. Help: `Eksempel: p2w8CJWe_ZkBEJrl1vIC`
- Info alert: for other third-party systems (Meta Pixel, Google Analytics) build your own "Tak for bestillingen" (thank-you) page and ask Fenster Support to redirect customers there after completing an online booking.

### Actions
- `Vælg fil ...` — external Fillout logo-upload form (new context).
- `Se resultat` (×2) — preview of the respective rich-text content in a modal.
- `Gem alle ændringer` — opens confirmation modal `Vil du gemme?` (Do you want to save?): body `Alle ændringer bliver synlige på bestillingssiderne med det samme. Er du sikker på, du vil gemme ændringerne?`, buttons `Nej` / `Ja` (No/Yes) + X close.

### Tables
- None.

### Notes
- Save is guarded by a Yes/No confirm dialog (unique to this page) because changes go live immediately on the public booking pages.
- Hidden inputs carry the two rich-text HTML payloads on submit.

---

## Brugere — Users (`/user_accounts`)

Page purpose: manage employee/user accounts — profile, calendar color, permissions, planning-related address, plus login-shortcut/password tooling — and create new users. Everything is one form saved by one button.

### Sections
1. One collapsible accordion panel per existing user, heading = full name (here: `Kristian Klercke`), with caret expand/collapse toggle (anchor targeting `#caret-right-empl-<id>` / `#caret-down-empl-<id>` / `#caret-content-empl-<id>`).
2. `Ny bruger` (New user) — same field set, used for creating a user.

### Fields (per user; identical set in the `Ny bruger` panel)
- `Brugernavn` (Username) — text. Current: `kristianklercke`.
- `Fornavn` (First name) — text. Current: `Kristian`.
- `Efternavn` (Last name) — text. Current: `Klercke`.
- `E-mail (valgfrit)` (E-mail, optional) — email input. Current: `k@klerckegroup.dk`.
- `Kalenderfarve` (Calendar color) — select; option label → hex value (an accompanying read-only `type="color"` swatch mirrors the selection):
  - (empty option)
  - `Blå` (Blue) = `#a4d5ee` (selected for existing user)
  - `Brungrøn` (Brown-green) = `#d8dcb8` (default in Ny bruger)
  - `Grøn` (Green) = `#b7e3d4`
  - `Lyserød` (Light pink) = `#f7d8d7`
  - `Lavendel` (Lavender) = `#e3e4ff`
  - `Beige` = `#fff2d5`
  - `Grå` (Grey) = `#d9d7cb`
  - `Lilla` (Purple) = `#bba8df`
  - `Tyrkis` (Turquoise) = `#a9f3e4`
  - `Lyselilla` (Light purple) = `#decfff`
  - `Fersken` (Peach) = `#ffcfa7`
  - `Gul` (Yellow) = `#fad875`
  - `Rosa` (Rose) = `#f9c7cb`
- `Aktiv kalender` (Active calendar) — rendered as a (read-only) text field showing `Ja`. Help: `Brugere med en aktiv kalender indgår i den automatiske planlægning.` (Users with an active calendar are included in automatic planning.)
- `Kan modtage online bestillinger` (Can receive online bookings) — select: `Ja` = `True` / `Nej` = `False`. Current: `Nej` for existing user; `Ja` default in Ny bruger. Help: `Brugeren kan modtage online bestillinger i sin kalender, forudsat at online booking er aktiveret for virksomheden`.
- `Hjemmeadresse` (Home address) — text (address autocomplete). Current: `Mølbjerg 9, 8700 Horsens`. Help: `Hjemmeadresse anvendes af den automatiske planlægning af første og sidste ordre på dagen.`
- `Adresser i dagsprogrammet åbnes som` (Addresses in the day program open as) — select: `Adressesøgning` (Address search) = `search` / `Rutevejledning` (Directions) = `dir` (current). Help: `Adresser i dagsprogrammet åbnes i Google maps enten som adressesøgning eller rutevejledning.`
- Permission checkboxes (each a `Ja`-labelled toggle, all currently checked):
  - `Portal admin (har alle rettigheder)` (Portal admin — has all rights). Help: `Brugeren kan gøre alt i Fenster uden begrænsninger. Bør derfor bruges særdeles varsomt.`
  - `Må se priser og omsætning` (May view prices and revenue). Help: `Brugeren har adgang til at se priser og omsætning i Fenster.`
  - `Må redigere order og abonnementer` (May edit orders and subscriptions — note typo "order" in the original). Help: `Brugeren kan redigere de abonnementer og ordrer, som brugeren har adgang til i kalender/dagsprogram.`
  - `Må håndtere betaling / fakturering` (May handle payment/invoicing). Help: `Ved at fjerne denne rettighed kan brugen ikke afslutte ordrer (håndtere betaling / fakturering), men kun melde en status på ordren.`
  - `Må ændre valgmulighed for betaling / fakturering` (May change payment/invoicing option). Help: `Ved at fjerne denne rettighed kan brugeren ikke selv ændre valgmulighed for betaling / fakturering, men er tvunget til at anvende den forudindstillede valgmulighed, eller melde en status på ordren.`
- `Login-genvej` (Login shortcut) — existing users only. Two links: `Åbn i nyt vindue` (Open in new window) → tokenized URL e.g. `https://www.fenster.dk/daycalendar/<token>`, and `Kopier login-genvej` (Copy login shortcut, clipboard + `Kopieret` alert). Help: `Login-genvejen anvendes til installation af app på f.eks. mobil. Følg instruks i hjælpevideo.`
- `Link til at ændre kodeord` (Link to change password) — existing users only. Link `Kopier link til at ændre kodeord` (copies reset link, `Kopieret` alert). Help: `...så du f.eks. kan sende til medarbejder, som har glemt sit kodeord`.
- `Installer Fenster på brugerens mobil` (Install Fenster on the user's phone) — existing users only. Button `Se og kopier vejledning` (View and copy instructions) opens modal (see Actions). Help: `Brug knappen til at kopiere en vejledning, som du efterfølgende kan sende til medarbejderen`.

### Actions
- `Opret ny bruger` (Create new user) — button in the `Ny bruger` panel; stages the new user. Info alert next to it lists: `Prisen for en ekstra bruger er 199 kr/mdr., som opkræves månedligt med mindre andet er aftalt.` / `Husk at indstille arbejdstider for brugeren, når denne er oprettet` / `Klik på 'Gem alle ændringer' for at oprette brugeren.`
- `Gem alle ændringer` — submits all user edits/creations.
- `Se og kopier vejledning` — modal `Vejledning til <navn>` (Instructions for <name>): greeting `Hej <navn>`, `Du er nu oprettet i Fenster med brugernavnet <brugernavn>.`, `Du skal indstille dit kodeord på dette link inden for 24 timer` (password-set link), then install steps list: 1) log in via `https://www.fenster.dk/login`, 2) watch video `installation på Mobil eller Tablet` (→ `https://help.fenster.dk/da/install-on-phone`, under Hjælp > Hjælpevideoer), 3) follow the video instructions (takes 2 min). Ends: after correct installation the user can log into Fenster without entering credentials. Buttons: `Kopier tekst` (Copy text, with `Kopieret` alert) and `Luk`.
- Reset-access confirmation modal `Bekræftelse` (Confirmation) exists in DOM: body `Er du sikker på, at du vil nulstille kodeord og login-genvej for brugeren? Dermed vil brugeren [miste adgang]...` + `Såfremt brugeren igen skal have adgang til Fenster, skal du oprette et nyt password til brugeren...`; buttons `Nulstil adgang` (Reset access) / `Luk`. (Triggered from a per-user reset action.)

### Tables
- None (accordion of user panels instead).

### Notes
- Each user panel is collapsible; new-user creation is a two-step flow (stage with `Opret ny bruger`, persist with `Gem alle ændringer`).
- Kalenderfarve select is accompanied by a disabled color swatch input showing the chosen hex.

---

## Arbejdstider — Working hours (`/working_hours/`)

Page purpose: define calendar opening hours per employee per weekday, plus two global toggles (auto-close on public holidays, flexible working time) that feed the automatic planning engine.

### Sections
1. `Generelle indstillinger` (General settings)
2. `Indstillinger per medarbejder` (Settings per employee) — one block per employee (here: `Kristian Klercke`).

### Fields

**Generelle indstillinger**
- `Luk automatisk kalenderen på helligdage` (Automatically close the calendar on public holidays) — checkbox/toggle `Ja`, currently checked. Help: `Hvis valgt, vil officielle danske helligdage automatisk være lukket i kalenderen, f.eks. 2. påskedag.`
- `Benyt fleksibel arbejdstid` (Use flexible working time) — checkbox/toggle `Ja`, currently checked. Help: `Fleksibel arbejdstid giver Fenster mulighed for at tage ekstra arbejdstid i brug sidst på dagen, såfremt det medfører en forholdsmæssig besparelse på kørslen, eller hvis ugen er fyldt op med ordrer. Fleksibel arbejdstid anbefales for de fleste...`

**Indstillinger per medarbejder** — intro: `Arbejdstiderne indstilles individuelt for hver medarbejder i virksomheden.` Per-employee weekly grid (see Tables).

### Tables
Per-employee working-hours grid; column headers:
- `Ugedag` (Weekday) — row label: `Mandag`, `Tirsdag`, `Onsdag`, `Torsdag`, `Fredag`, `Lørdag`, `Søndag` (Mon–Sun; 7 fixed rows).
- `Aktiv` (Active) — checkbox per day (Mon–Fri currently active with times; Sat/Sun rows have empty time fields).
- `Fra` (From) — time text input, e.g. `08:00`.
- `Til` (To) — time text input, e.g. `16:00`.
- `Flekstid` (Flex time) — select per day, options: (blank, selected by default), `+30 min` = `30`, `+1 time` = `60`, `+1½ time` = `90`, `+2 timer` = `120`, `+3 timer` = `180`, `+4 timer` = `240`, `+5 timer` = `300`, `+6 timer` = `360` (values are minutes).

### Actions
- `Gem alle ændringer` — single submit.

### Notes
- No row-level actions; the grid is pure form inputs with hidden id fields per day.
- The Flekstid column presumably only takes effect when the global `Benyt fleksibel arbejdstid` toggle is on.

---

## Planlægning — Planning (`/planning_settings/`)

Page purpose: settings that influence Fenster's automatic calendar/route planning — driving-time handling at day boundaries per employee and which task categories each employee may handle.

### Sections
1. `Generelle indstillinger` (General settings)
2. `Indstillinger per medarbejder` (Settings per employee) — one block per employee (here: `Kristian Klercke`).

### Fields

**Generelle indstillinger**
- `Benyt fleksibel arbejdstid` (Use flexible working time) — NOT an input here; a link `Gå til indstilling` (Go to setting) → `/working_hours/`. Same explanatory help text as on the Working hours page.

**Per employee**
- `Udelad kørsel før første ordre på dagen` (Omit driving before the first order of the day) — checkbox, currently checked. Help: `Vælg dette, hvis du vil undgå, at Fenster planlægger kørsel til første ordre inden for arbejdstiden`.
- `Udelad kørsel efter sidste ordre på dagen` (Omit driving after the last order of the day) — checkbox, currently checked. Help: `Vælg dette, hvis du vil undgå, at Fenster planlægger kørsel hjem fra sidste ordre inden for arbejdstiden`.
- `Tilstræb at starte dagen længst væk fra hjemmeadressen` (Aim to start the day furthest from the home address) — checkbox, currently checked. Help: `Vælg dette, hvis du ønsker at bruge de tidlige morgentimer på transport, f.eks hvis det er mørkt, når du kører hjemmefra...`
- `Tilladte opgavekategorier` (Allowed task categories) — multi-select dropdown (button currently showing `Alle` (All) + listbox). **Subscription-gated**: wrapper text `Opgavetyper per medarbejderere er ikke inkluderet i dit Fenster-abonnement: Pro` (requires the Pro package; the control is disabled and clicking triggers the upgrade modal). Options (15):
  - `Vinduespudsning` (Window cleaning)
  - `Rentvandsvask` (Pure-water washing)
  - `Tagrenderens` (Gutter cleaning)
  - `Overfladerens` (Surface cleaning)
  - `Algebehandling` (Algae treatment)
  - `Overfladebeskyttelse` (Surface protection)
  - `Privatrengøring` (Private/domestic cleaning)
  - `Ejendomsrengøring` (Property cleaning)
  - `Viceværtservice` (Caretaker service)
  - `Grøn service` (Green/garden service)
  - `Ukrudtsbekæmpelse` (Weed control)
  - `Skadedyrsbekæmpelse` (Pest control)
  - `Bilpleje` (Car care)
  - `Administrativt` (Administrative)
  - `Andet` (Other)
  - Help: `Vælg hvilke opgavekategorier, som medarbejderen kan håndtere. For at en ordre kan planlægges i en medarbejders kalender, skal medarbejderen kunne håndtere alle kategorier på ordren. Hvis du fastgør en ordre eller et abonnement til en bestemt medarbejder, så vil ordren blive planlagt til denne medarbejder uagtet de tilladte opgavekategorier.`

### Actions
- `Gå til indstilling` → `/working_hours/`.
- `Gem alle ændringer` — submit.

### Tables
- None.

### Notes
- Page intro text under the H1: `På denne side kan du foretage indstillinger, der påvirker Fensters automatiske kalenderplanlægning.`

---

## Rabatkoder — Discount codes (`/discount_codes`)

Page purpose: list and manage percentage discount codes that customers can apply during online booking.

### Sections
- Single list view under H1 `Rabatkoder`; intro: `Rabatkoder kan anvendes af kunder ved online bestilling.`

### Fields
- None on the list page itself.

### Actions
- `Opret ny rabatkode` (Create new discount code) — button-styled link → `/discount_code_add_new/`.
- Per-row delete icon in the `Slet` column (no rows currently, so icon not observed directly).

### Tables
Discount code table (bootstrap-table with loading state `Loading, please wait`); columns:
- `Rabatkode` (Discount code)
- `Procentsats` (Percentage)
- `Udløbsdato` (Expiry date)
- `Slet` (Delete) — row-level delete action
- Empty state: `No matching records found` (untranslated English default).

### Sub-page: Opret rabatkode (`/discount_code_add_new/`)
Minimal standalone page (no top navigation), H1 `Opret rabatkode` (Create discount code):
- `Rabatkode` — text input.
- `Procentsats` — number input.
- `Slutdato` (End date) — date picker: text input + calendar icon button (`event` material icon) opening a month-view calendar widget.
- Buttons: `Luk` (Close) — link back to `/discount_codes`; `Gem rabatkode` (Save discount code) — submit.

### Notes
- List table is client-initialized (bootstrap-table); data loads after page render.

---

## Standardopgaver — Standard tasks (`/standard_task_list/`)

Page purpose: searchable, paginated catalogue of all standard task types (used when building orders/subscriptions); partner can create custom ones, edit/deactivate non-system ones. Editing a standard task propagates everywhere it is used.

H1: `Oversigt over standardopgaver` (Overview of standard tasks). Intro: `Oversigten viser alle dine standardopgaver. Når du redigerer en standardopgave, så slår ændringen igennem alle steder, hvor standardopgaven er i brug.`

### Sections
- Toolbar (create button + search form) above one large table with pagination.

### Fields
- Search text input — placeholder `beskrivelse, kategori, bogstav` (description, category, letter) + submit button `Søg` (Search).
- Checkbox `Vis også deaktive standardopgaver` (Also show deactivated standard tasks).

### Actions
- `Opret ny standardopgave` (Create new standard task) — button, opens a create modal (fields not captured; expected: category select, description, "customer must be present" flag).
- Per row (leading action-icon cluster):
  - Expand caret (anchor `href="#"`) — expands row details.
  - Edit icon — tooltip `Rediger standardopgave` (Edit standard task); opens edit modal.
  - Deactivate icon — tooltip `Når en standardopgave deaktiveres, vil den ikke længere fremgå af søgelister, men vil forblive uændret [hvor den allerede er i brug]...` (When deactivated it no longer appears in search lists but remains unchanged where already in use).
  - System/base tasks are locked: tooltips `Denne standardopgave kan ikke redigeres` (cannot be edited) and `Denne standardopgave kan ikke deaktiveres` (cannot be deactivated). Locked rows observed: `Pudsning udvendig`, `Pudsning indvendig`, `Pudsning forsatsvinduer`, `Pudsning udvendig og indvendig`, `Pudsning indvendig og forsats`, `Pudsning udvendig, indvendig og forsats` (the core window-cleaning combos).
- Pagination: `forrige` (previous) / page numbers `1`, `2` / `næste` (next); URL pattern `?page=2&q=`.

### Tables
Columns:
- (unlabeled action column with the three icons above)
- `Kategori` (Category)
- `Beskrivelse` (Description)
- `Kunden skal være tilstede` (Customer must be present) — header wraps over two lines; header tooltip: `Anvendes bl.a. til at bestemme hvilken type notifikation, der skal sendes for ordrer, der indeholder [opgaven]...`; cell shows `Ja` or blank.

Full current dataset (146 rows over 2 pages), `Kategori` → `Beskrivelse` (rows marked **[Ja]** have `Kunden skal være tilstede` = Ja):

- `Vinduespudsning`: Pudsning udvendig; Pudsning indvendig **[Ja]**; Pudsning forsatsvinduer **[Ja]**; Afrensning af ruder; Polering af ridser; Pudsning af altanglas; Pudsning af andensalen; Pudsning af butiksvinduer; Pudsning af drivhus; Pudsning af døre; Pudsning af førstesalen; Pudsning af glasværn; Pudsning af kontor; Pudsning af kælderetagen; Pudsning af lyskasser; Pudsning af orangeri; Pudsning af ovenlysvinduer; Pudsning af spejle; Pudsning af stueetagen; Pudsning af udestue; Pudsning af veluxvinduer; Pudsning af vindfang; Pudsning af værksted; Pudsning udvendig og indvendig **[Ja]**; Pudsning indvendig og forsats **[Ja]**; Pudsning udvendig, indvendig og forsats **[Ja]**
- `Rentvandsvask`: Vask af drivhus; Vask af garage; Vask af kontor; Vask af orangeri; Vask af porte; Vask af skilte; Vask af solpaneler; Vask af udestue; Vask af vindfang; Vask af vinduesrammer; Vask af værksted; Vinduesvask, altanglas; Vinduesvask, andensalen; Vinduesvask, butiksvinduer; Vinduesvask, døre; Vinduesvask, forsatsvinduer **[Ja]**; Vinduesvask, førstesalen; Vinduesvask, glasværn; Vinduesvask, indvendig **[Ja]**; Vinduesvask, kælderetagen; Vinduesvask, lyskasser; Vinduesvask, ovenlysvinduer; Vinduesvask, stueetagen; Vinduesvask, udvendig; Vinduesvask, veluxvinduer
- `Tagrenderens`: Rensning af afløb; Rensning af brønde; Rensning af dræn; Rensning af nedløb; Rensning af tagrender
- `Overfladerens`: Afrensning af graffiti; Rensning af badebro; Rensning af bænke; Rensning af facade; Rensning af fliser; Rensning af gavl; Rensning af havemøbler; Rensning af indkørsel; Rensning af tag; Rensning af terrasse; Rensning af væg; Slibning af havemøbler; Slibning af terrasse
- `Algebehandling`: Algebehandling af badebro; …af bænke; …af facade; …af fliser; …af gavl; …af havemøbler; …af indkørsel; …af tag; …af terrasse; …af væg
- `Overfladebeskyttelse`: Anti-graffiti behandling; Imprægnering af badebro; …af bænke; …af facade; …af fliser; …af gavl; …af havemøbler; …af indkørsel; …af tag; …af terrasse; …af væg; Maling af tag; Påfyldning af fugesand
- `Privatrengøring`: Afkalkning af fliser; Afkalkning toilet/bad; Aftørring af borde og stole; Aftørring af flader; Aftørring af fodlister, døre og dørkarme; Aftørring af gelænder; Aftørring oven på skabe; Aftørring vindueskarme; Almindelig rengøring; Fjern spindelvæv; Flytterengøring; Gulvvask; Hovedrengøring; Håndværkerrengøring; Puds spejle og glasflader; Rengøring af brusere; Rengøring af fryser; Rengøring af køleskab; Rengøring af opvaskemaskine; Rengøring af ovn og microovn; Rengøring af toilet/bad; Rengøring af tørretumbler; Rengøring af vaskemaskine; Støvsugning; Trappevask; Tømning af papirkurve; Tømning af skraldespande
- `Ejendomsrengøring`: Flytterengøring; Måtteservice; Rengøring af elevator; Støvsugning af gulve; Støvsugning af trapper; Vask af gulve; Vask af trapper
- `Viceværtservice`: Feje belægning; Rundering af ejendom; Saltning; Snerydning; Stoppet afløb; Udskiftning af pærer; Vedligehold af indendørsarealer; Vedligehold af udendørsarealer
- `Grøn service`: Beplantning; Beskæring; Gødning; Hækklipning; Klip af græskanter; Opsamling af blade; Plæneklipning; Plænepleje; Træfældning; Ukrudtsbekæmpelse
- `Ukrudtsbekæmpelse`: Bekæmpelse af ukrudt, afbrænding; …, fliser; …, fortov; …, have; …, indkørsel; …, skuffejern; …, sprøjtearbejde; …, terrasse
- `Skadedyrsbekæmpelse`: Bekæmpelse af edderkopper; Bekæmpelse af hvepse; Bekæmpelse af insekter; Bekæmpelse af muldvarper; Bekæmpelse af myrer; Service af rottespærrer
- `Bilpleje`: Dækrens; Fælgrens; Hydrofobisk coating; Indvendig bilrengøring; Lakforsegling; Motorvask; Pleje af vinyl/læder; Pudsning af ruder, indvendigt; Rens af kabine; Støvsugning af bil; Udvendig bilrengøring
- `Administrativt`: Inspektion; Klargøring; Møde; Parkering; Tilbudsgivning

### Notes
- Rows are sorted by category (fixed category order matching the planning-page category list) then description.
- The create/edit modal contents were not captured (opens client-side; expected fields: Kategori select, Beskrivelse text, `Kunden skal være tilstede` checkbox).
- The `Vis også deaktive standardopgaver` checkbox re-filters the table; deactivated rows presumably render greyed with a reactivate icon.

---

## Regnskab — Accounting / Dinero integration (`/dinero_settings`)

Page purpose: read-only status page for the Dinero (Visma) accounting integration — shows the connected Dinero account, the chart-of-account numbers Fenster posts to, and connect/refresh/disconnect actions.

### Sections
1. `Dinero integration`
2. `Dinero kontoplan` (Dinero chart of accounts)

### Fields
- None editable; the page is informational plus two action links.

### Tables

**Dinero integration** — intro: `Fenster er forbundet til følgende Dinero-konto:` (Fenster is connected to the following Dinero account). Two-column key/value table, headers `Dinero indstilling` (Dinero setting) / `Dinero værdi` (Dinero value); rows:
- `Dinero firma ID` (company ID) → `639460`
- `Firmanavn` (Company name) → `KRLTFL ApS`
- `Brugernavn` (User name) → `Kristian Zanchetta Klercke`
- `Bruger-email` (User email) → `k@klerckegroup.dk`
- `Momsfritaget` (VAT exempt) → `Nej`

**Dinero kontoplan** — intro: `Fenster anvender følgende kontonumre fra din Dinero kontoplan:`. Three columns: `Dinero kontonr.` (account no.) / `Dinero kontonavn` (account name) / `Fenster brug` (Fenster usage); rows:
- `1000` / `Salg af varer/ydelser m/moms` / `Bogføring af afsendte fakturaer` (posting of sent invoices)
- `55040` / `Kontanter (kasse)` / `Bogføring af kontante betalinger` (posting of cash payments)
- `Ikke konfigureret` (Not configured) / `-` / `Bogføring af betalinger modtaget via MobilePay Get Paid (ikke det samme som MobilePay Integreret betaling)`

Below tables: `Kontakt support@fenster.dk, hvis du ønsker, at Fenster skal anvende andre kontonumre i din Dinero kontoplan.`

### Actions
- `Fjern forbindelsen til Dinero` (Remove the Dinero connection) — link → `/api/visma_oauth_remove`.
- `Genopfrisk forbindelsen til Dinero` (Refresh the Dinero connection) — link → Visma Connect OAuth authorize URL (`https://connect.visma.com/connect/authorize?client_id=isv_fenster_production&response_type=code&response_mode=form_post&scope=openid+profile+offline_access+email+dineropublicapi:read+dineropublicapi:write&redirect_uri=https://www.fenster.dk/api/visma_oauth_callback&...&ui_locales=da-DK+en-GB`).

### Notes
- Both tables are client-initialized bootstrap-tables (brief `Loading, please wait` state).
- Observed only in the "connected" state; when disconnected the page presumably shows a connect/authorize CTA using the same OAuth URL.
- OAuth flow: Visma Connect authorization-code flow with form_post response into `/api/visma_oauth_callback`; scopes include `dineropublicapi:read` + `dineropublicapi:write`.
