# Gavekort — setup (fase 0: MobilePay, manuel betaling)

Sådan fungerer gavekorts-salget lige nu, og hvad der skal gøres manuelt.

## Flowet (fase 0)

1. Kunden designer kortet på [karltoffel.dk/c/det-vi-ordner/gavekort](https://karltoffel.dk/c/det-vi-ordner/gavekort): vælg design, skriv besked direkte på kort-previewet, udfyld modtager/afsender (inkl. **eget mobilnummer**) og vælg beløb (500/1.000/2.000 eller frit, min. 500 kr.).
2. Kunden trykker **"Send betalingsanmodning"** → ordren gemmes i CRM (status *Afventer betaling*) og der kommer en Slack-notifikation med alle oplysninger.
3. **MANUELT:** Send en MobilePay-betalingsanmodning på beløbet fra **MobilePay Business-appen** til kundens mobilnummer (står i Slack-beskeden og i CRM under *Gavekort*).
4. Når betalingen er indfriet: åbn CRM → **Gavekort** (/giftcards) → tryk **"Markér som betalt"** → gavekortskoden (format `KT-XXXX-XXXX-XXXX`) genereres automatisk og pinges i Slack.
5. **MANUELT:** Send gavekortet pr. mail til modtageren (besked + kode + download-link/PDF) og tryk **"Markér som sendt"** i CRM.

Der er INGEN automatisk betaling, SMS eller print-selv i fase 0.

## Slack

Notifikationerne bruger den eksisterende Slack-bot (`SLACK_BOT_TOKEN` i CRM-projektets env — samme som lead-flowet). Ny bestilling og betalt-bekræftelse postes til `SLACK_GIFTCARD_CHANNEL` hvis sat, ellers samme kanal som leads.

## CRM-side

**/giftcards** (kun admin): liste over alle ordrer med status, kode og knapperne *Markér som betalt* / *Markér som sendt* / *Annuller*.

## Senere: automatisk Stripe-integration (forberedt, ikke aktiv)

Når/om vi vil automatisere betalingen, er koden forberedt:

- `GiftCardOrder`-modellen har Stripe-felter (`stripeSessionId`, `stripePaymentIntentId`).
- `POST /api/giftcards/webhook` (event: `checkout.session.completed`) og `GET /api/giftcards/confirm` er implementeret men dvaler: de svarer 503 indtil env-nøglerne er sat.

Sådan aktiveres den:

1. Opret Stripe-konto på [stripe.com](https://stripe.com) til Karltoffel (CVR **40941894**).
2. Hent test-nøglerne (Developers → API keys) og sæt `STRIPE_SECRET_KEY` på Vercel-projektet **karltoffel-crm**.
3. Opret webhook-endpoint: `https://<crm-domain>/api/giftcards/webhook` med eventet **`checkout.session.completed`** og sæt signing secret som `STRIPE_WEBHOOK_SECRET`.
4. Aktivér **MobilePay, Apple Pay og Google Pay** under *Payment methods* i Stripe-dashboardet.
5. Sæt `NEXT_PUBLIC_SITE_URL=https://karltoffel.dk` og peg sitets `window.GK_CRM_URL`/betal-knap på Stripe-flowet.
6. Ved launch: skift til live-nøglerne i samme env-variabler.
