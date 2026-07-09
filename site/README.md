# Karltoffel — tro lokal kopi (pixel-perfect)

En 1:1 lokal rekonstruktion af **hele** **[karltoffel.dk](https://karltoffel.dk/)**
— forsiden **og alle 22 undersider** (23 sider i alt).

Formålet er, at der praktisk talt ikke skal være synlig forskel, hvis man åbner
originalen og denne kopi side om side. Derfor er den originale HTML, CSS og
JavaScript bevaret **ordret** — der er *kun* ændret på URL'er, så alle assets
(billeder, fonte, scripts) og **al intern navigation** peger lokalt i stedet for
på live-domænet.

Bygget af bureauet **bubble.dk** (den oprindelige side). Denne mappe er en
statisk kopi til lokal visning/arkivering.

### Sider i kopien (23)

| Sti | Side |
|-----|------|
| `/` | Forsiden (pakke-slider + tilbudsformular fjernet efter ønske) |
| `/p/forside/` | Forside-dublet (spejler `/`) |
| `/p/det-vi-ordner/` · `/p/pakker-priser/` · `/p/erhverv/` · `/p/om-karltoffel/` · `/p/faa-et-tilbud/` | Hovedsider |
| `/p/handelsbetingelser/` · `/p/cookiepolitik/` | Juridiske sider |
| `/c/det-vi-ordner/<ydelse>/` | 14 service-sider (græspleje, hækklipning, vinduesvask, fliserens, tagrenderens, algerens, beskæring, robotplæneklipper-service, soignering-af-bede, solcellevask, ukrudtsbekæmpelse, vask-hus-garage-ned, bortskaffelse-haveaffald, gavekort) |

> **Vigtigt om servering:** Siden bruger rod-relative stier (`/assets/…`, `/p/…`,
> `/c/…`) og gemmer hver underside som `<sti>/index.html`. Den **skal derfor
> serveres fra denne mappes rod** (se nedenfor) — så oversætter serveren selv fx
> `/p/om-karltoffel` → `/p/om-karltoffel/index.html`. At åbne en underside direkte
> som `file://` virker ikke for navigationen.

---

## Projektstruktur

```
karltoffel/
├── index.html                     # Forsiden (original markup, lokale stier)
├── p/                             # Tekst-/hovedsider (hver som <navn>/index.html)
│   ├── forside/  det-vi-ordner/  pakker-priser/  erhverv/
│   ├── om-karltoffel/  faa-et-tilbud/
│   └── handelsbetingelser/  cookiepolitik/
├── c/det-vi-ordner/              # 14 service-sider (hver som <ydelse>/index.html)
│   ├── graespleje/  haekklipning/  vinduesvask/  fliserens/  …
├── assets/
│   ├── css/
│   │   ├── main.min.css           # Cookie-widget + små hjælpe-styles (uændret)
│   │   ├── style.css              # Hovedstylesheet, 614 KB (url()'er omskrevet til lokale)
│   │   ├── typekit.css            # Adobe-font "snaga-unicase-display" (self-hostet)
│   │   └── hanken-grotesk.css     # Google-font "Hanken Grotesk" (self-hostet)
│   ├── js/
│   │   └── script.js              # Sidens JS inkl. Swiper-sliders (uændret)
│   ├── fonts/
│   │   ├── typekit/               # snaga-unicase-display (3 vægte, woff2)
│   │   ├── google/                # Hanken Grotesk (woff2)
│   │   └── fontawesome/6.6.0/     # FontAwesome (brands + sharp, woff2 + ttf)
│   └── img/
│       ├── design/                # Logoer, favicon, texture, ikoner (8 filer)
│       └── thumb/                  # 157 side-/sektions-/kortbilleder (webp, responsive varianter)
├── _source/                       # Urørte originalfiler + build-scripts (kan slettes)
│   ├── index_raw.html             # Original forside-HTML
│   ├── pages/                     # Rå HTML for alle undersider
│   ├── sitemap*.xml               # Sitemaps brugt til at finde alle sider
│   ├── *.with-offerform / *.with-packages .bak   # Forside-backups før sektioner blev fjernet
│   ├── build_mirror.py            # Byggede forsiden + delte assets/fonte
│   └── build_pages.py             # Crawlede + byggede alle undersider
└── .claude/launch.json            # Dev-server-config til lokal preview
```

---

## Sådan kører du siden lokalt

Siden er 100 % statisk — den kræver ingen build. Den skal blot serveres over
HTTP (åbn den *ikke* som `file://`, da browsere blokerer nogle assets/fetch der).

**Med Python (indbygget på macOS):**
```bash
cd karltoffel
python3 -m http.server 8099
# åbn derefter http://localhost:8099
```

**Med Node (hvis du foretrækker det):**
```bash
npx serve -l 8099 .
# eller
npx http-server -p 8099 .
```

Det er alt. Ingen `npm install`, ingen bundling, intet build-trin.

---

## Build

Der er **intet build-trin** — filerne serveres, som de er.

Vil du gendanne kopien fra bunden (fx hvis originalen er opdateret), køres de to
medfølgende scripts i rækkefølge:

```bash
python3 _source/build_mirror.py   # forsiden + delte CSS/JS/fonte/billeder
python3 _source/build_pages.py    # crawler alle undersider (via sitemap) + deres billeder
```

De henter al HTML/CSS/JS, downloader alle billeder og fonte, self-hoster dem og
omskriver samtlige URL'er (assets **og** intern navigation) til lokale stier.
(Kræver `curl` og `python3` — begge findes som standard på macOS.)

---

## Deployment

Da det er en ren statisk side, kan den lægges på en hvilken som helst
static-host. Upload indholdet af mappen (uden `_source/` og `.claude/`, som ikke
skal med i produktion):

| Platform | Kommando / fremgangsmåde |
|----------|--------------------------|
| **Netlify** | Træk mappen ind i Netlify Drop, eller `netlify deploy --dir=. --prod` |
| **Vercel** | `vercel --prod` (framework preset: *Other*) |
| **GitHub Pages** | Push mappen til en `gh-pages`-branch; sæt Pages til roden |
| **Cloudflare Pages** | Opret projekt → upload mappen som "Direct Upload" |
| **Egen server (nginx/Apache)** | Kopiér mappen til web-roden; ingen konfiguration nødvendig |

Caching-tip: `assets/`-mappen kan caches aggressivt (immutable), mens
`index.html` bør have kort/ingen cache.

---

## Vigtige noter om nøjagtighed

- **Fonte:** `snaga-unicase-display` (Adobe Typekit) og `Hanken Grotesk`
  (Google Fonts) er downloadet og self-hostet, så siden ser identisk ud og
  virker offline. FontAwesome er ligeledes lokal.
- **DM Sans:** Originalen refererer til `DM Sans` som brødtekst-font, men
  loader den aldrig (ingen `@font-face` eller link nogen steder i den originale
  kildekode). Den falder derfor tilbage til systemets sans-serif. Kopien
  gengiver dette **præcist** ved bevidst *ikke* at tilføje DM Sans — ellers
  ville kopien afvige fra originalen.
- **Fjernet på forsiden (efter ønske):** To ting er bevidst fjernet fra `/` (og
  dublet `/p/forside/`):
  1. Tilbudsformular-sektionen ("Vil du også være en heldig karltoffel?",
     `section--type-offer-form`, `#form_3`).
  2. Pakke-slideren med de 13 pakke-kort **+** navigations-pilene under dem
     (`packages-slider-container`). Overskriften "Mindre bøvl. Mere overskud" og
     gavekort-banneret er bevaret.

  Begge snit er rene (tag-balancerede) og siden fungerer uændret. Backups:
  `_source/index.with-offerform.html.bak` og `_source/index.with-packages.html.bak`.
  De **selvstændige** `/p/pakker-priser/`- og `/p/faa-et-tilbud/`-sider har stadig
  hhv. pakker og formular (kun forsidens versioner er fjernet).
- **Navigationslinks:** Al intern navigation (menu, footer, service-kort,
  breadcrumbs) peger nu **lokalt** (`/p/…`, `/c/…`) og åbner de kopierede sider.
  Kun eksterne links (facebook, bubble.dk, skat.dk) og SEO-metadata (`og:url`,
  `og:image`, JSON-LD) peger stadig på live-domænet — som det skal være.
- **Eksterne tjenester (kræver internet):** Cookie-samtykke-banneret
  (cookie-script.com) indlæses stadig fra sit CDN — præcis som på originalen.
  Googles reCAPTCHA loades på de sider der har en formular (fx `/p/faa-et-tilbud/`).
  Alt andet virker offline.

---

## Verificeret

Hele kopien er kørt lokalt og kontrolleret — **alle 23 sider**:

- ✅ Alle 23 sider loader; **0 manglende asset-filer** og **0 brudte billeder**
  (kontrolleret både på disk og i browser)
- ✅ **0 døde interne links** — alle 22 unikke link-mål har en lokal side
- ✅ Ende-til-ende navigation testet: klik på forsidens service-kort →
  `/c/det-vi-ordner/vinduesvask/` loader korrekt
- ✅ Swiper-sliders aktive på alle sider; mobil drawer-menu åbner/lukker
- ✅ Snaga-display-font renderer korrekt (overskrifter/logo)
- ✅ Ingen JavaScript-konsolfejl på nogen testet side
