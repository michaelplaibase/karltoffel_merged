# Fenster Partner Portal — E-mail & SMS message-template pages (spec)

Documented 2026-07-03 from the live logged-in portal (account: `KRLTFL ApS`). Base URL: `https://www.fenster.dk`.

## Navigation context

All 8 pages live under the top-nav menu `Indstillinger` (Settings) → submenu `E-mail og SMS skabeloner` (E-mail and SMS templates):

| Menu label (Danish) | English | Route |
|---|---|---|
| `Notifikation før levering` | Notification before delivery | `/email_and_sms_settings_before_delivery` |
| `Notifikation efter levering` | Notification after delivery | `/email_and_sms_settings_after_delivery` |
| `Abonnementsbekræftelse` | Subscription confirmation | `/email_and_sms_settings_subscription_confirmation` |
| `Abonnementsflytning` | Subscription move | `/email_and_sms_settings_subscription_defrag_notification` |
| `Ordrebekræftelse` | Order confirmation | `/email_and_sms_settings_order_confirmation` |
| `Påmindelse om genbestilling` | Reorder reminder | `/email_and_sms_settings_order_reminder` |
| `Fakturaafsendelse` | Invoice sending | `/email_and_sms_settings_invoice` |
| `Prisjustering` | Price adjustment | `/email_and_sms_settings_price_adjustment_notification` |

## Common template-editor structure (applies to pages 1–4 and 8)

Every editable template page uses the exact same layout — a single vertical form (POST to the same URL, hidden CSRF token `csrfmiddlewaretoken`):

- Page heading: `<h1>` `E-mail og SMS`, then `<h4>` with the page-specific title, then an intro paragraph.
- **No enable/disable toggles and no timing settings on these pages.** Whether the notification is sent (and how far in advance) is configured on `Indstillinger → Generelt` (`/settings`) — the intro text links there with the words `denne side` (this page).
- **No channel selector on these pages** — the single `Besked` text is used for BOTH e-mail and SMS. (Channel on/off per notification type is also on `/settings`.)
- Fields, in order:
  1. `E-mail emne` (E-mail subject) — plain `<input type=text>`. Help text: `Emnet på e-mailen. Maks 50 karakterer.` (The subject of the e-mail. Max 50 characters.) — no HTML `maxlength` attribute; limit is informational/server-side. Exception: the Abonnementsflytning page says `Maks 100 karakterer.`
  2. `Besked` (Message) — label suffixed with a link `(Se liste over variable felter, du kan anvende)` (See list of variable fields you can use). The link (`data-toggle="modal" data-target="#modal-tags"`) opens a Bootstrap modal titled `Liste over variable felter` listing the merge variables valid for that page (see per-page lists below). The editor is a **plain `<textarea rows="13">`** — NOT a WYSIWYG/rich-text editor, plain text with `{{variable}}` tokens. **There is no live preview.** Help text: `Beskeden, som sendes med notifikationen.` (The message sent with the notification.) / on defrag & price-adjustment pages: `Beskeden, som sendes til kunden.` (The message sent to the customer.)
  3. `Afsender på SMS` (SMS sender) — `<input type=text name="sms_sender">`, **rendered disabled** (read-only for the user). Current value: `Service SMS`. Help text: `Afsender på SMS. Kan være tekst eller dit mobilnummer. Maks 11 karakterer. Kontakt Fenster Support for at få feltet ændret (kræver Fenster Premium abonnement)` (SMS sender. Can be text or your mobile number. Max 11 characters. Contact Fenster Support to have the field changed (requires Fenster Premium subscription)) — `Fenster Support` links to `/support/`.
  4. `Send en test` (Send a test) section:
     - `<input type=text name="test_email" placeholder="Test e-mail">` — help: `Indtast en e-mail adresse for at afsende en test` (Enter an e-mail address to send a test)
     - Button `Send test e-mail` — `<button type=submit name="submit_mode" value="send_test_email">`
     - `<input type=text name="test_phone_number" placeholder="Test SMS">` — help: `Indtast et mobilnummer for at afsende en test` (Enter a mobile number to send a test)
     - Button `Send test SMS` — `<button type=submit name="submit_mode" value="send_test_sms">`. On this account the button is **disabled** and wrapped in a `<div>` with tooltip `Brugen af SMS er ikke godkendt endnu. Gå til Indstillinger → Generelt og godkend brug af SMS` (Use of SMS is not approved yet. Go to Settings → General and approve use of SMS) — i.e. the test-SMS button is gated on SMS approval in general settings.
  5. Button `Gem alle ændringer` (Save all changes) — `<button type=submit name="submit_mode" value="save">`, primary/full-width at bottom.
- The variable-list modal has a `×` close button (top right) and a `Tilbage` (Back) button at the bottom. Each variable entry shows the token, a description, and one or more `Eksempel:` (Example) lines.
- Global hidden modals present in the page shell (not specific to these pages): IE11-unsupported warning (`Internet Explorer 11 er ikke understøttet`), a subscription-upgrade modal (`Denne funktion er ikke inkluderet i dit Fenster abonnement` with a pricing table and `Luk` / `Opgrader` buttons), and an `Opgradering gennemført` confirmation modal.
- Footer: `Copyright © 2026` / `Powered by Fenster`. Intercom messenger bubble bottom-right.

## Master list of merge variables (union across all pages)

| Token | Description (Danish, verbatim) | Example shown | Appears on |
|---|---|---|---|
| `{{kunde_fornavn}}` | Dette er fornavnet på kunden, hvilket svarer til det første ord i navnefeltet(Hvis kunden er et firma benyttes første ord i att. navnefeltet) | Peter | all editable pages |
| `{{kunde_fuldt_navn}}` | Dette er det fulde navn på kunden, som indtastet i navnefeltet(Hvis kunden er et firma benyttes att. navnefeltet) | Peter Petersen | all editable pages |
| `{{leveringstidspunkt}}` | Dette er leveringstidspunktet for ordren, dvs. det tidspunkt, hvor kunden skal have service. Bemærk at teksten vil variere baseret på dine notifikationsindstillinger. | `mandag d. 23. januar` / `mandag d. 23. januar ca. kl. 09:15` / `mandag d. 23. januar ml. kl. 08:15-11:15` | before_delivery only |
| `{{leverings_adresse}}` | Dette er ordrens leveringsadresse (order pages) / Dette er abonnementets leveringsadresse (subscription pages) / Leveringsadresse for de berørte opgaver (price adjustment) | Fruebjergvej 3, 2100 København Ø | all editable pages |
| `{{opgave_liste}}` | Page-specific: before: "Dette er en liste over de opgaver, som skal udføres"; after/invoice: "…som er blevet udført på ordren"; subscription confirmation: "Dette er en nummereret liste af opgaver der er registreret på abonnementet"; price adjustment: "Dette er en liste over de opgaver, der bliver prisjusteret. Det anvendte format vælges, når du opretter prisjusteringen." | before/after: `* Pudsning udvendig * Pudsning indvendig`; subscription: `1) Pudsning udvendig - 350 kr - hver 8. uge  2) Pudsning indvendig - 200 kr - hver 24. uge  3) Vask af drivhus udvendigt - 275 kr - hver 52. uge`; price adj: `* Udvendig polering +25,00 kr.` / `* Udvendig polering, før 250 kr., ny pris 275 kr.` / `* Udvendig polering, ny pris 275 kr.` | before, after, subscription confirmation, price adjustment (+ invoice modal) |
| `{{dit_firmanavn}}` | Dette er navnet på din virksomhed | KRLTFL ApS | all editable pages |
| `{{dit_telefonnummer}}` | Dette er telefonnummeret på din virksomhed | 51202040 | all editable pages |
| `{{din_email}}` | Dette er e-mail adressen på din virksomhed | kristian@karltoffel.dk | all editable pages |
| `{{saetning_naeste_gang_uge_med_dato_interval}}` | Dette er en sætning, der fortæller hvilken uge, kunden skal have service næste gang (med dato interval) | Næste service er planlagt til uge 24 (d. 10. jun. - 17. jun.) | after_delivery (+ invoice modal) |
| `{{saetning_naeste_gang_uge_uden_dato_interval}}` | Dette er en sætning, der fortæller hvilken uge, kunden skal have service næste gang | Næste service er planlagt til uge 24 | after_delivery (+ invoice modal) |
| `{{pris_moms_info}}` | Dette er altid teksten "Alle priser er inkl. moms." | Alle priser er inkl. moms. | subscription confirmation |
| `{{naeste_gang_uge_med_dato_interval}}` | Dette er ugenummeret, hvor kunden skal have service næste gang (med dato interval) | uge 7 (d. 13. feb. - 20. feb.) | subscription confirmation, defrag |
| `{{naeste_gang_uge_uden_dato_interval}}` | Dette er ugenummeret, hvor kunden skal have service næste gang (uden dato interval) | uge 7 | subscription confirmation, defrag |
| `{{naeste_gang_opgaver}}` | Dette er numrene på opgaverne, der skal udføres ved næste besøg | opgave 1 og 3 | subscription confirmation |
| `{{næste_tre_uger_før_optimering}}` | Dette er de næste tre uger for aboennementet som det har været indtil nu, altså før optimeringen *(sic — typo "aboennementet" is verbatim)* | 32, 40, 48 | defrag |
| `{{næste_tre_uger_efter_optimering}}` | Dette er de næste tre uger for aboennementet som det bliver fremover, altså efter optimeringen | 34, 42, 50 | defrag |
| `{{flyttet_antal_uger}}` | Dette er antallet af uger aboennementet er blevet flyttet som en del af optimeringen | `2 uger frem` / `3 uger tilbage` | defrag |
| `{{ikrafttraedelse_dato}}` | Tidspunktet hvor prisjusteringen træder i kraft | 10. aug. 2026 | price adjustment |
| `{{ikrafttraedelse_uge_uden_ugedag}}` | Tidspunktet hvor prisjusteringen træder i kraft | uge 24 (2026) | price adjustment |
| `{{ikrafttraedelse_uge_med_ugedag}}` | Tidspunktet hvor prisjusteringen træder i kraft | mandag i uge 24 (2026) | price adjustment |

Note the token spelling is inconsistent by design: defrag tokens use Danish letters (`næste`, `før`) while others transliterate (`naeste_gang…`, `ikrafttraedelse…`, `saetning…`). Reproduce exactly.

---

## Notifikation før levering (`/email_and_sms_settings_before_delivery`)

### Purpose
Heading `Notifikation før levering` (Notification before delivery). Intro: `Med nedenstående felter kan du tilpasse teksten i de notifikationer, der sendes til kunderne på e-mail og/eller SMS før levering. Hvorvidt der skal afsendes notifikation og hvor lang tid i forvejen, kan du indstille på denne side.` (With the fields below you can customise the text of the notifications sent to customers by e-mail and/or SMS before delivery. Whether a notification is sent and how far in advance is configured on this page.) — `denne side` links to `/settings`. So: text is edited here; on/off + lead-time timing live in General settings.

### Fields
| Label | Input | name | Current value | Help text |
|---|---|---|---|---|
| `E-mail emne` | text | `notification_template_email_subject` | `Vi kommer og udfører service` | `Emnet på e-mailen. Maks 50 karakterer.` |
| `Besked (Se liste over variable felter, du kan anvende)` | textarea, rows=13, plain text (no WYSIWYG, no preview) | `notification_template` | see Default text | `Beskeden, som sendes med notifikationen.` |
| `Afsender på SMS` | text, **disabled** | `sms_sender` | `Service SMS` | `Afsender på SMS. Kan være tekst eller dit mobilnummer. Maks 11 karakterer. Kontakt Fenster Support for at få feltet ændret (kræver Fenster Premium abonnement)` |
| `Send en test` | text | `test_email` | placeholder `Test e-mail` | `Indtast en e-mail adresse for at afsende en test` |
| (same section) | text | `test_phone_number` | placeholder `Test SMS` | `Indtast et mobilnummer for at afsende en test` |

### Variables
`{{kunde_fornavn}}`, `{{kunde_fuldt_navn}}`, `{{leveringstidspunkt}}`, `{{leverings_adresse}}`, `{{opgave_liste}}` (here: "Dette er en liste over de opgaver, som skal udføres"), `{{dit_firmanavn}}`, `{{dit_telefonnummer}}`, `{{din_email}}`. (Full descriptions in master table.)

### Default text
Current template body (verbatim, 344 chars):
```
Kære {{kunde_fornavn}}

Vi kommer {{leveringstidspunkt}} og udfører følgende opgaver iht. aftale.

{{opgave_liste}}

Såfremt en eller flere opgaver kræver adgang til din bolig, bedes du være hjemme til at åbne eller på anden måde sørge for, at vi får adgang til at kunne udføre opgaven.

De bedste hilsner
{{dit_firmanavn}}
```

### Actions
- `Send test e-mail` — submit, `submit_mode=send_test_email`
- `Send test SMS` — submit, `submit_mode=send_test_sms`; **disabled** on this account with tooltip `Brugen af SMS er ikke godkendt endnu. Gå til Indstillinger → Generelt og godkend brug af SMS`
- `Gem alle ændringer` (Save all changes) — submit, `submit_mode=save`
- `Se liste over variable felter, du kan anvende` — opens modal `#modal-tags` (`Liste over variable felter`, close `×` / `Tilbage`)

### Notes
- One message body serves both e-mail and SMS; only the subject is e-mail-specific and only the sender name is SMS-specific.
- `{{leveringstidspunkt}}` wording adapts to notification settings (date only / approx time `ca. kl. 09:15` / time window `ml. kl. 08:15-11:15`).
- No maxlength attributes in HTML; the 50/11-char limits are enforced elsewhere.

---

## Notifikation efter levering (`/email_and_sms_settings_after_delivery`)

### Purpose
Heading `Notifikation efter levering` (Notification after delivery). Intro: `Med nedenstående felter kan du tilpasse teksten i de notifikationer, der sendes til kunderne på e-mail og/eller SMS efter levering har fundet sted, dvs. når en ordre meldes udført. Hvorvidt der skal afsendes notifikation kan du indstille på denne side.` (…sent after delivery has taken place, i.e. when an order is marked completed. Whether a notification is sent is configured on this page [link → `/settings`].) No timing setting mentioned (fires on order completion).

### Fields
Identical structure to page 1. Differences:
| Label | name | Current value |
|---|---|---|
| `E-mail emne` | `after_delivery_email_subject` | `Vi har udført service` |
| `Besked` | `after_delivery_template` (textarea rows=13) | see Default text |
| `Afsender på SMS` | `sms_sender` (disabled) | `Service SMS` |
| test fields | `test_email` / `test_phone_number` | placeholders `Test e-mail` / `Test SMS` |

### Variables
`{{kunde_fornavn}}`, `{{kunde_fuldt_navn}}`, `{{leverings_adresse}}`, `{{opgave_liste}}`, `{{dit_firmanavn}}`, `{{dit_telefonnummer}}`, `{{din_email}}`, `{{saetning_naeste_gang_uge_med_dato_interval}}`, `{{saetning_naeste_gang_uge_uden_dato_interval}}`. (No `{{leveringstidspunkt}}` here.)

### Default text
Current template body (verbatim, 203 chars):
```
Kære {{kunde_fornavn}}

Vi har netop udført service på adressen {{leverings_adresse}}. 

{{saetning_naeste_gang_uge_med_dato_interval}}

Tak fordi du er kunde hos os.

De bedste hilsner
{{dit_firmanavn}}
```

### Actions
Same as page 1: `Send test e-mail`, `Send test SMS` (disabled + SMS-approval tooltip), `Gem alle ændringer`, variable-list modal link.

### Notes
- The two `saetning_…` variables render a full sentence (e.g. `Næste service er planlagt til uge 24 (d. 10. jun. - 17. jun.)`) so the template can embed next-visit info without composing the sentence itself.

---

## Abonnementsbekræftelse (`/email_and_sms_settings_subscription_confirmation`)

### Purpose
Heading `Abonnementsbekræftelse` (Subscription confirmation). Intro: `Sendes til kunder (valgfrit) ved oprettelse eller redigering af et abonnement. Du kan i den forbindelse vælge at vedhæfte dine Handelsbetingelser til bekræftelsen, hvis du ønsker det.` (Sent to customers (optional) when a subscription is created or edited. You can optionally attach your Terms & Conditions to the confirmation.)

### Fields
This page uniquely has **two subject fields** (create vs. update) sharing one body:
| Label | Input | name | Current value | Help text |
|---|---|---|---|---|
| `E-mail emne (ved oprettelse)` (subject on creation) | text | `subscription_confirmation_create_email_subject` | `Tillykke med din nye aftale` | `Emnet på e-mailen. Maks 50 karakterer.` |
| `E-mail emne (ved opdatering)` (subject on update) | text | `subscription_confirmation_edit_email_subject` | `Vi har opdateret din aftale` | `Emnet på e-mailen. Maks 50 karakterer.` |
| `Besked (Se liste over variable felter, du kan anvende)` | textarea rows=13 | `subscription_confirmation_template` | see Default text | `Beskeden, som sendes med notifikationen.` |
| `Afsender på SMS` | text, disabled | `sms_sender` | `Service SMS` | (standard SMS-sender help) |
| `Send en test` | `test_email` / `test_phone_number` | | placeholders `Test e-mail` / `Test SMS` | (standard) |

### Variables
`{{kunde_fornavn}}`, `{{kunde_fuldt_navn}}`, `{{dit_firmanavn}}`, `{{dit_telefonnummer}}`, `{{din_email}}`, `{{leverings_adresse}}` (here: `Dette er abonnementets leveringsadresse`), `{{opgave_liste}}` (here: `Dette er en nummereret liste af opgaver der er registreret på abonnementet` — numbered, with price and interval per task, e.g. `1) Pudsning udvendig - 350 kr - hver 8. uge`), `{{pris_moms_info}}`, `{{naeste_gang_uge_med_dato_interval}}`, `{{naeste_gang_uge_uden_dato_interval}}`, `{{naeste_gang_opgaver}}`.

### Default text
Current template body (verbatim, 249 chars):
```
Kære {{kunde_fornavn}}

Vi har aftalt at udføre følgende opgaver:

{{opgave_liste}}

{{pris_moms_info}}.

Næste gang er planlagt til {{naeste_gang_uge_med_dato_interval}}, hvor vi udfører {{naeste_gang_opgaver}}.

De bedste hilsner
{{dit_firmanavn}}
```

### Actions
`Send test e-mail`, `Send test SMS` (disabled + tooltip), `Gem alle ændringer`, variable-list modal. Extra help text in the test section: `Vær opmærksom på, at dine Handelsbetingelser altid bliver vedhæftet, når du afsender en test, hvorimod du selv skal tilvælge at vedhæfte Handelsbetingelserne, når du opretter et abonnement.` (Note that your Terms & Conditions are always attached when sending a test, whereas you must explicitly opt in to attach them when creating a subscription.)

### Notes
- Sending is optional per subscription (chosen in the subscription create/edit flow), not toggled on this page.
- T&C attachment is opt-in per subscription; always attached on test sends.

---

## Abonnementsflytning (`/email_and_sms_settings_subscription_defrag_notification`)

### Purpose
Heading on page: `Besked om abonnementsflytning` (Message about subscription move) — menu label is `Abonnementsflytning`. Intro: `Sendes til kunder (valgfrit) ved optimering af abonnementers ugerytme.` (Sent to customers (optional) when optimising subscriptions' week rhythm.) Used by the `Abonnementsoptimering` feature (`/subscription_defragmentation/`).

### Fields
| Label | Input | name | Current value | Help text |
|---|---|---|---|---|
| `E-mail emne` | text | `subscription_defrag_notification_email_subject` | `Vi har ændret ugen for levering af service på dit abonnement` | `Emnet på e-mailen. Maks 100 karakterer.` (**100 here, not 50**) |
| `Besked (Se liste over variable felter, du kan anvende)` | textarea rows=13 | `subscription_defrag_notification_template` | see Default text | `Beskeden, som sendes til kunden.` |
| `Afsender på SMS` | text, disabled | `sms_sender` | `Service SMS` | (standard SMS-sender help) |
| `Send en test` | `test_email` / `test_phone_number` | | placeholders `Test e-mail` / `Test SMS` | (standard) |

### Variables
`{{kunde_fornavn}}`, `{{kunde_fuldt_navn}}`, `{{dit_firmanavn}}`, `{{dit_telefonnummer}}`, `{{din_email}}`, `{{leverings_adresse}}` (abonnementets), `{{næste_tre_uger_før_optimering}}`, `{{næste_tre_uger_efter_optimering}}`, `{{flyttet_antal_uger}}`, `{{naeste_gang_uge_med_dato_interval}}`, `{{naeste_gang_uge_uden_dato_interval}}`.

### Default text
Current template body (verbatim, 603 chars):
```
Kære {{kunde_fornavn}}

Vi har optimeret vores ruter for at begrænse kørslen og dermed passe bedre på miljøet. Derfor har vi været nødsaget til at flytte tidspunktet for levering af service på adressen {{leverings_adresse}}.

Før flytningen ville du modtage service i uge {{næste_tre_uger_før_optimering}}, osv. Nu vil du i stedet modtage service i uge {{næste_tre_uger_efter_optimering}}, osv. Dvs. tidspunktet er flyttet {{flyttet_antal_uger}}.

Næste gang er planlagt til {{naeste_gang_uge_med_dato_interval}}

Tak for forståelsen og tak fordi du er kunde hos os.

De bedste hilsner
{{dit_firmanavn}}
```

### Actions
`Send test e-mail`, `Send test SMS` (disabled + tooltip), `Gem alle ændringer`, variable-list modal.

### Notes
- Whether the message is sent is chosen per optimisation run (valgfrit) in the Abonnementsoptimering feature.
- Week-list variables render comma-separated week numbers (`32, 40, 48`); `{{flyttet_antal_uger}}` renders direction + count (`2 uger frem` / `3 uger tilbage`).

---

## Ordrebekræftelse (`/email_and_sms_settings_order_confirmation`)

### Purpose
Heading `Ordrebekræftelse` (Order confirmation). Intro: `Sendes til kunder ifm. online bestilling eller ved oprettelse/redigering af en manuel ordre.` (Sent to customers in connection with online ordering or when a manual order is created/edited.)

### Fields
None. The page body is only the two text paragraphs.

### Variables
None (no variable-list modal in the DOM).

### Default text
Not exposed. The page states: `På nuværende tidspunkt er det ikke muligt at tilpasse teksten for denne e-mail.` (At present it is not possible to customise the text of this e-mail.)

### Actions
None (no form, no buttons).

### Notes
- Placeholder/stub page: the order-confirmation e-mail exists as a system e-mail but its content is not editable. Rebuild as a static info page.

---

## Påmindelse om genbestilling (`/email_and_sms_settings_order_reminder`)

### Purpose
Heading `Påmindelse om genbestilling` (Reorder reminder). Intro: `Sendes til online kunder X dage efter senest afsluttede ordre. Sendes kun på baggrund af online ordrer (ikke manuelle ordrer eller abonnementskunder).` (Sent to online customers X days after the most recently completed order. Only triggered by online orders (not manual orders or subscription customers).)

### Fields
None on this page. (The "X dage" value is not configurable here; no timing field is shown.)

### Variables
None (no variable-list modal in the DOM).

### Default text
Not exposed. Page states: `På nuværende tidspunkt er det ikke muligt at tilpasse teksten for denne e-mail.` (At present it is not possible to customise the text of this e-mail.)

### Actions
None (no form, no buttons).

### Notes
- Stub page like Ordrebekræftelse. Trigger logic description ("X dage efter senest afsluttede ordre", online orders only) is the only documentation of behaviour.

---

## Fakturaafsendelse (`/email_and_sms_settings_invoice`)

### Purpose
Heading `Fakturaafsendelse` (Invoice sending). Full intro (verbatim): `Fenster kan sende faktura til dine kunder, når du afslutter en ordre, forudsat at du anvender et eksternt regnskabssystem, som Fenster kan integrere med, f.eks. Dinero. Selve fakturaen bliver ikke udstedt af Fenster, men af det eksterne regnskabssystem. Fenster vedhæfter blot fakturaen til beskeden og sender den til kunden.` (Fenster can send invoices to your customers when you complete an order, provided you use an external accounting system Fenster integrates with, e.g. Dinero. The invoice itself is not issued by Fenster but by the external accounting system. Fenster merely attaches the invoice to the message and sends it to the customer.)

`Hvis du anvender Dinero, så kan du tilpasse skabelonen / beskeden, der bliver sendt til kunden inde i Dinero. Log ind i Dinero og gå til Indstillinger > Sprog > Udsendelse > Fakturaudsendelse. Her kan du redigere teksten, som anvendes til både e-mail og SMS.` (If you use Dinero you can customise the template/message inside Dinero: Settings > Language > Sending > Invoice sending. That text is used for both e-mail and SMS.)

`Vær obs på, at det koster alm. SMS takst at sende faktura via SMS, og at længden på beskeden påvirker, hvor mange SMS'er, der forbruges per faktura.` (Note that sending an invoice by SMS costs the normal SMS rate, and message length affects how many SMS messages are consumed per invoice.)

### Fields
None — no form inputs, no textarea.

### Variables
No visible variable link, but a hidden `Liste over variable felter` modal IS present in the DOM (appears to be a shared/leftover include with the order-context set): `{{kunde_fornavn}}`, `{{kunde_fuldt_navn}}`, `{{leverings_adresse}}` (ordrens), `{{opgave_liste}}` (here described `Dette er en liste over de opgaver, som er blevet udført på ordren`), `{{dit_firmanavn}}`, `{{dit_telefonnummer}}`, `{{din_email}}`, `{{saetning_naeste_gang_uge_med_dato_interval}}`, `{{saetning_naeste_gang_uge_uden_dato_interval}}`. Not user-reachable — safe to omit in a rebuild.

### Default text
None — template lives in the external accounting system (Dinero).

### Actions
None (informational page only).

### Notes
- Invoice message content is delegated entirely to Dinero (or other integrated accounting system); Fenster only attaches and dispatches. Related settings page: `/dinero_settings` (Indstillinger → Regnskab).

---

## Prisjustering (`/email_and_sms_settings_price_adjustment_notification`)

### Purpose
Heading on page: `Besked om prisjustering` (Message about price adjustment) — menu label `Prisjustering`. Intro: `Sendes til kunder (hvis valgt for prisjusteringen), når en prisjustering igangsættes.` (Sent to customers (if selected for the price adjustment) when a price adjustment is initiated.) Used by the `Prisjustering` feature (`/price_adjustment_list/`).

### Fields
| Label | Input | name | Current value | Help text |
|---|---|---|---|---|
| `E-mail emne` | text | `price_adjustment_notification_email_subject` | `Opdatering af dine priser` | `Emnet på e-mailen. Maks 50 karakterer.` |
| `Besked (Se liste over variable felter, du kan anvende)` | textarea rows=13 | `price_adjustment_notification_template` | see Default text | `Beskeden, som sendes til kunden.` |
| `Afsender på SMS` | text, disabled | `sms_sender` | `Service SMS` | (standard SMS-sender help) |
| `Send en test` | `test_email` / `test_phone_number` | | placeholders `Test e-mail` / `Test SMS` | (standard) |

### Variables
`{{kunde_fornavn}}`, `{{kunde_fuldt_navn}}`, `{{dit_firmanavn}}`, `{{dit_telefonnummer}}`, `{{din_email}}`, `{{leverings_adresse}}` (here: `Leveringsadresse for de berørte opgaver` — delivery address of the affected tasks), `{{opgave_liste}}` (list of price-adjusted tasks; **the rendered format is chosen when creating the price adjustment**, examples: `* Udvendig polering +25,00 kr.` / `* Udvendig polering, før 250 kr., ny pris 275 kr.` / `* Udvendig polering, ny pris 275 kr.`), `{{ikrafttraedelse_dato}}` (e.g. `10. aug. 2026`), `{{ikrafttraedelse_uge_uden_ugedag}}` (e.g. `uge 24 (2026)`), `{{ikrafttraedelse_uge_med_ugedag}}` (e.g. `mandag i uge 24 (2026)`).

### Default text
Current template body (verbatim, 407 chars):
```
Kære {{kunde_fornavn}}

Vi ønsker at informere dig om, at dine priser justeres pr. {{ikrafttraedelse_dato}}, som følger: 

{{opgave_liste}}

Justeringen skyldes generelle omkostningsstigninger samt vores mål om fortsat at levere høj kvalitet og god service.

Har du spørgsmål, er du altid velkommen til at kontakte os.

Vi glæder os til at fortsætte samarbejdet med dig.

De bedste hilsner
{{dit_firmanavn}}
```

### Actions
`Send test e-mail` (`submit_mode=send_test_email`), `Send test SMS` (`submit_mode=send_test_sms`; disabled + SMS-approval tooltip), `Gem alle ændringer` (`submit_mode=save`), variable-list modal (`Liste over variable felter`, `×` / `Tilbage`).

### Notes
- Whether the notification is sent is chosen per price-adjustment run (hvis valgt for prisjusteringen), not on this page.
- Three alternative effective-date variables give the rebuild flexibility in how the effective date is phrased (exact date / week / weekday-in-week).

---

## Rebuild checklist (cross-page)

1. Five editable pages share one component: subject input(s) + plain textarea (rows 13) + disabled SMS-sender input + test-send section + save button. Three pages are static info stubs (order confirmation, order reminder, invoice).
2. Message body is channel-agnostic (one text for e-mail + SMS); no WYSIWYG, no live preview, no per-page enable toggles or timing fields — those live on `/settings` (before/after delivery) or per feature run (subscription confirmation / defrag / price adjustment).
3. Variable tokens use double curly braces `{{…}}`; the available set is context-dependent per page (see master table). Modal `Liste over variable felter` documents them with descriptions + examples.
4. Form posts distinguish action via `submit_mode` = `send_test_email` | `send_test_sms` | `save`; CSRF hidden field present.
5. SMS test button is disabled until SMS usage is approved under Indstillinger → Generelt; tooltip explains this. SMS sender name changes require Fenster Support + Premium plan.
6. Char limits are advisory in help text only (subject 50 chars — 100 on defrag page; SMS sender 11 chars); no HTML `maxlength`.
