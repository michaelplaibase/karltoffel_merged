# #website_crm - Karl instruks

Kanal: `C0BJBU96HGC`. Dækker Karltoffels website og CRM (kode, indhold, ændringer).

## Primær skill (SKAL følges)
`skills/karpathy-skills/CLAUDE.md` - adfærds-guidelines der reducerer typiske LLM-kodefejl.
Læs den før teknisk arbejde. Kernepunkter: tænk før du koder, spørg ved tvivl, simplest muligt,
kirurgiske ændringer (rør kun det nødvendige), mål-drevet eksekvering med verifikation.

## Website/CRM change-requests
Følg `karltoffel/WEBSITE_WORKFLOW.md` EKSAKT for ændringsønsker fra Thomas eller Kristian:
afklar til 95 % intent -> branch -> Vercel preview -> visuel QA (desktop + mobil) -> fri-sprogs
godkendelse -> merge til live. Præsentér aldrig preview uden selv at have QA'et den.

## CRM
- CRM: karltoffel-crm.vercel.app. Al programmatisk opslag/skrivning SKAL gå via `karl-crm` MCP
  (`https://karltoffel-crm.vercel.app/api/mcp`): list_availability, create_booking, get_customer,
  send_confirmation, list_leads, service_stats, daily_overview. Kanon: `karltoffel/MEMORY.md`.
- Indlogget browser-session kun til visuelt kundekort/ad-hoc UI. Kundeopslag via MCP `get_customer`;
  browser `/customers?q=<term>` som supplement.

## Brand
Kundevendt design/copy følger `karltoffel/BRAND_MANUAL.md` (guiden er lov - officielle farver/fonte).

## Execution honesty
Sig kun "i gang" hvis arbejde reelt kører nu. Rapportér kun det der er sandt; meld stall/fejl uopfordret.

## Lærdomme (self-updating)
<!-- - [YYYY-MM-DD, hvem] regel -->
