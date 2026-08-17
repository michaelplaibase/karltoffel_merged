# Karltoffel CRM — Kalenderunificering: STATUS (implementering før kodeændring)

**Status:** IMPLEMENTERET OG VERIFICERET
**Dato:** 17. august 2026
**Ansvarlig:** Frontend Developer-specialist

## Opgave

Gør Kalender 2 (subskriptionspreview-kalenderen) til **den eneste kalender** i Karltoffel
CRM. Den gamle kalender fjernes helt fra navigationen, og Kalender 2 bliver den primære
`/calendar`-rute.

## Nuværende tilstand (kortlægning)

| Rute | Fil | Indhold |
| ---- | --- | ------- |
| `/calendar` | `app/calendar/page.tsx` (46 l.) | GAMLE kalender. Bruger `getCalendarWeek`/`getCalendarMonth` fra `@/lib/queries` + `TeamCalendarClient`. Skal **erstattes**. |
| `/calendar-2` | `app/calendar-2/page.tsx` (38 l.) | KALENDER 2. Bruger `getSubscriptionPreviewWeek`/`getSubscriptionPreviewMonth` fra `@/lib/subscription-preview-calendar` + `calendar2WeekNavigation` fra `@/lib/calendar2-navigation`. Renderer `TeamCalendarClient` med `readOnly basePath="/calendar-2" previewLabel="Forhåndsvisning"`. Skal **blive** `/calendar`. |

Brugerfladekomponent: `components/TeamCalendarClient.tsx` — klientkomponent, der tegner
både uge- og månedsvisning. Bygger prev/next/week-navigation ud fra `basePath`-proppen
(default `"/calendar"`). Har en read-only-banner med en badge, der viser
`props.previewLabel ?? "Forhåndsvisning"` (linje 416).

Navigation: `lib/nav.ts` — `TOP_NAV` har i dag **to** punkter under menuen "Kalender":
`Kalender → /calendar` og `Kalender 2 → /calendar-2`.

## Ændringer der gennemføres

1. **`app/calendar/page.tsx`** — Omskrives til Kalender 2-logikken. Importerer
   `getSubscriptionPreviewWeek`/`getSubscriptionPreviewMonth` + `calendar2WeekNavigation`.
   Renderer `TeamCalendarClient` med `readOnly` og `basePath="/calendar"`. Fjerner
   `previewLabel="Forhåndsvisning"`. Metadata: `{ title: "Kalender · Karltoffel" }`.
   Derved vises subskriptionspreview-kalenderen på `/calendar`, og prev/next
   uge/måned-navigation peger på `/calendar?...`.

2. **`components/TeamCalendarClient.tsx`** — Fjerner `previewLabel` fra Props-typen (begge
   variant-unioner) og erstatter default-badgen `?? "Forhåndsvisning"` (linje 416) med et
   neutralt label (`Kalender`). Ingen anden kallant bruger `previewLabel` efter ændringen.

3. **`lib/nav.ts`** — Fjerner punktet `{ label: "Kalender 2", en: "Calendar preview",
   href: "/calendar-2" }`. Menuen "Kalender" får kun eet punkt: `Kalender → /calendar`.

4. **`app/calendar-2/page.tsx`** — Slettes (hele mappen `app/calendar-2/`), så
   `/calendar-2`-ruten ikke længere eksisterer. Bemærk: `app/api/calendar-2/...`
   audit-rutes og den underliggende logik i `lib/` bevares (er refereret af tests og er
   infrastruktur for selve Kalender 2-datapipelinen).

5. **`tests/calendar-preview-readonly.test.ts`** — Linje 36 aflæser
   `app/calendar-2/page.tsx`; opdateres til at pege på `app/calendar/page.tsx`, så
   read-only-sikkerhedstesten stadig vurderer den aktivt brugte side.

## Afklaringer

- Kalender 2 forbliver funktionelt **read-only** (en projektion af aktive abonnementer;
  der oprettes/ændres ikke ordrer, opgaver eller abonnementer). Opgavens krav 1-5 handler
  om navngivning og routing, ikke om at gøre projection-bredden redigerbar. Derfor bevares
  `readOnly`-flaget, men den visuelle "Forhåndsvisning"-identitet fjernes.
- `getCalendarWeek`/`getCalendarMonth` i `lib/queries.ts` bliver ubrugte eksporter, men
  fjernes **ikke** her (lav risiko, da de kan refereres af andet; at rydde dem er en
  separat oprydning uden for opgavens scope).
- `.next/types/*` er build-artefakter og regenereres af `next build`.

## Verifikation (udført)

- `npm run test` — **99/99 tests passer**, inkl. opdateret `calendar-preview-readonly.test.ts`.
- `npm run lint` — De ændrede filer (`app/calendar/page.tsx`,
  `components/TeamCalendarClient.tsx`, `lib/nav.ts`, `tests/calendar-preview-readonly.test.ts`)
  lint-kører rent (exit 0). Reet havde i forvejen ubundne fejl/advarsler i andre filer
  (f.eks. `scripts/plan-from-audit-snapshot.ts` og bundlade filer), som ikke er berørt af
  denne ændring.
- `npx next typegen && npx tsc --noEmit` — **exit 0**, TypeScript compilerer rent.
- `npx next build` — kompilerer og TypeScript-tjek består. Bygget fejler kun i
  prerendering af en urelateret side (`/account`) fordi den lokale database ikke kører på
  `localhost:5433` (infrastrukturbarriere, ikke en kodefejl fra denne ændring).
- Side-ruten `/calendar-2` er fjernet fra de regenererede `.next/types`; de eneste
  tilbageværende `/calendar-2`-entryer er API-handlerne (`/api/calendar-2/audit*`), som
  bevares som infrastruktur.