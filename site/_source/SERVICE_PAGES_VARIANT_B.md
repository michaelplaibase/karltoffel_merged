# Variant B — ydelsessider der skal have samme behandling

Fælles sektion ("Sådan klarer vi din <ydelse>", variant B) er implementeret på
**hækklipning** som reference: `/c/det-vi-ordner/haekklipning/`.

## Sider der skal have samme behandling (i `site/c/det-vi-ordner/`)

| # | Side | Rute |
|---|------|------|
| 1 | Vinduesvask | `/c/det-vi-ordner/vinduesvask/` |
| 2 | Tagrenderens | `/c/det-vi-ordner/tagrenderens/` |
| 3 | Fliserens | `/c/det-vi-ordner/fliserens/` |
| 4 | Algerens og algebehandling | `/c/det-vi-ordner/algerens-og-algebehandling-af-fliser-tag-og-facader/` |
| 5 | Beskæring | `/c/det-vi-ordner/beskaering/` |
| 6 | Græspleje | `/c/det-vi-ordner/graespleje/` |
| 7 | Robotplæneklipper-service | `/c/det-vi-ordner/robotplaeneklipper-service/` |
| 8 | Solcellevask | `/c/det-vi-ordner/solcellevask/` |
| 9 | Ukrudtsbekæmpelse | `/c/det-vi-ordner/ukrudtsbekaempelse/` |
| 10 | Vask hus & garage ned | `/c/det-vi-ordner/vask-hus-garage-ned/` |
| 11 | Bortskaffelse af haveaffald | `/c/det-vi-ordner/bortskaffelse-haveaffald/` |

Evt. senere (ikke klassisk ydelse): `/c/det-vi-ordner/gavekort/`.

## Fælles byggematerialer

- **CSS:** `/assets/css/service-variant-b.css` (klasser med `svb-`-præfiks, responsiv —
  to kolonner på desktop, stakket på mobil). Link den i `<head>` på hver side:
  `<link rel="stylesheet" href="/assets/css/service-variant-b.css?v=1">`
- **HTML-skabelon:** `site/_source/pages/snippets/service-variant-b.html` — indsæt
  sektionen mellem sidens tekstsektion og FAQ-sektionen, og erstat `{{SERVICE}}`,
  `{{FACTS}}`, `{{QUOTE}}` og `{{CTA}}`.

## Regler for hver side

1. Fakta-listen tilpasses ydelsen. Faste elementer fra skitsen (variant B):
   - højde-/omfangsgrænse svarende til "Høje hække op til 220 cm" (hækklipning)
   - en "special pris – aftales ved tilbuddet"-linje for kraftig tilbagebeskæring /
     tilsvarende speciale-opgaver
2. Kundecitat: placeholder-tekst "Karltoffel gør det nemt at være husejer" med
   caption "Kundecitat (placeholder)" — erstattes når rigtige kundecitater findes.
3. FAQ: tilføj spørgsmålet "Hvornår på året skal <ydelse>?" med pladsholder-svar
   ("Svaret på dette spørgsmål kommer fra teamet – fagligt svar tilpasses senere.").
   **Eksisterende FAQ-tekst må ikke ændres.** Nyt spørgsmål tilføjes IKKE i
   JSON-LD FAQPage-markeringen, før teamet har leveret det faglige svar.
4. CTA peger på `/#tilbudsmotor` som resten af sitet.
5. Bemærk: `site/_source/` er Bubble-råeksporter — de opdateres IKKE for denne
   sektion; kun de udleverede sider i `site/c/` + fælles CSS.
