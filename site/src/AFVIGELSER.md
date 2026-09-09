# AFVIGELSER — blok- og indholdsafvigelser fundet ved skabelon-byg (2026-09-09)

Reglen fra opgaven: ved forskellige udgaver af samme blok bruges **forsidens udgave**, medmindre
output-fidelity (acceptkriteriet: diff mod dagens HTML må kun vise tilladte forskelle) kræver
parametrisering eller side-chunk. Alle fund er listet her.

**Sluttilstand**: header/footer/tilbudsmotor/floating-cta/ydelseskort/faq er skabeloner i
`src/partials/` med parametre; kun tre blokke kræver egen side-chunk: `tak` (header) samt
FAQ på `c/det-vi-ordner/gavekort` og `p/erhverv` (plus erhvervsmotoren som egen partial).

## Header
- **12 c/-sider**: CTA-knapper (desktop + drawer) peger `href="#tilbudsmotor"` (relativt) i stedet for forsidens `/#tilbudsmotor` → parametriseret som `{{CTA_HREF}}` i `partials/header.html` (forsidens markup ellers uændret).
- **p/det-vi-ordner, p/erhverv, p/om-karltoffel, c/…/gavekort, p/pakker-priser**: har `nav__item--active` på henholdsvis "Det vi ordner", "Erhverv", "Om Karltoffel", "Gavekort" og "Karltoffels Årshjul" → parametriseret som `nav_active` i sider.json (forsiden har intet aktivt punkt).
- **p/cookiepolitik + p/handelsbetingelser**: `<header class="header …">` UDEN `header--fixed` → parametriseret (`fixed: false`).
- **tak**: har en HELT EGEN header-udgave (kompakt nav, ingen drawer, ingen `header--fixed`) → gemt som side-chunk `sider/tak/header.html` (afviger fra forsidens skabelon).

## Footer
- **Kun forsiden** har em-paragraffen "Fast aftale og fleksible løsninger · …" → parametriseret (`em_paragraf`).
- **12 c/-sider + p/erhverv**: footerens "Få et tilbud"-link bruger `#tilbudsmotor` (uden skråstreg) → `{{CTA_HREF}}`.
- **404**: mangler Instagram- og LinkedIn-links (har kun Facebook) → `{{SOCIAL_IG}}`/`{{SOCIAL_LI}}`.
- **tak**: egen footer-udgave → side-chunk `sider/tak/footer.html`.
- Whitespace/indrykning varierer mellem siderne (forsidens multi-linje-formattering bruges som skabelon; whitespace-forskelle er tilladte).

## Tilbudsmotor
- Motor-blokken (inkl. venteliste-trin) findes i dag på: forsiden, 12 c/-sider (IKKE gavekort) og p/erhverv — bygges præcis dér.
- **12 c/-sider**: underteksten under "Hvad koster din have?" lyder "… giver dig **et estimat på prisen**, mens du venter." Forsiden og erhvervssiden er siden ensrettet til samme estimat-tekst (Anton 2026-09-10): "… giver dig et estimat på prisen, mens du venter."
- **p/erhverv**: har en helt anden motor (id `tilbudsmotor-privat`, anden h2, ingen venteliste, erhverv-flow) → egen partial `partials/tilbudsmotor-erhverv.html` (verbatim).
- Whitespace-forskelle (én tom linje i nogle c/-udgaver) — tilladt.

## Ydelseskort (prisdata → src/data/ydelser.json)
- **p/det-vi-ordner**: 2 kort viser pris UDEN "Fra" ("499 kr" på tagrenderens, "199 kr" på robotplæneklipper-service) → ensrettet til "Fra 499 kr"/"Fra 199 kr" (tilladt forskel).
- **p/det-vi-ordner**: "Fra 899" UDEN "kr" (facadevask) → "Fra 899 kr" (tilladt forskel).
- **Forside + p/det-vi-ordner**: "Fra 500 kr." MED punktum (gavekort) → "Fra 500 kr" (tilladt forskel).
- **Kortenes rækkefølge** varierer pr. side → bevaret via ordnet `kort`-liste pr. side i sider.json (valgt frem for raekkefoelge-feltet; raekkefoelge i ydelser.json = forsidens rækkefølge).
- **Kort_tekst** (den lille sætning på kortet) findes i dag KUN på forsiden (vinduesvask + græspleje) → ydelser.json indeholder teksten, og sider.json styrer visning med `vis_kort_tekst` (kun forsidens grid viser den, som i dag).
- **Priser på erhverv-siderne**: p/vicevaertsservice, p/ejendomsservice OG p/haveservice-horsens viser erhvervspriserne (tagrenderens 599, fliserens 599, solcellevask 599, facadevask 1.499) → disse 3 sider bruger `kontekst: erhverv`; forside + p/det-vi-ordner bruger `kontekst: privat`.

## FAQ
- FAQ-blokken (`.section__faq` + JSON-LD) findes på forsiden, 12 c/-sider og p/erhverv.
- **Forsiden**: kun de fælles spørgsmål (fakturering, servicefradrag, faste aftaler, enkelte opgaver, privat/erhverv) → FAQ-skabelonen er forsidens blok med `{{EKSTRA_SPM}}`.
- **c/-siderne**: har yderligere 3-4 ydelsesspecifikke spørgsmål FØR de fælles → gemt pr. side i `sider/<sti>/faq-ekstra.html` og indsat som variabel.
- **c/…/gavekort**: har KUN egne spørgsmål (ingen af de fælles) → egen FAQ-side-chunk.
- **p/erhverv**: har egne erhvervs-specifikke spørgsmål i den "fælles" sektion → egen FAQ-side-chunk.

## Floating-CTA
- **12 c/-sider**: `href="#tilbudsmotor"` (relativt) mod forsidens `/#tilbudsmotor` → `{{CTA_HREF}}` i partial.
- **tak**: har ingen floating-CTA → udelades pr. side (`floating_cta: null`).

## Head
- CSS-versioner ensrettes til forsidens: `style.css?v=5 → v=6` og `spacing.css?v=3 → v=4` på alle sider undtagen forsidens (tilladt forskel).
- Pr. side varierer: title, description, canonical, og:-tags, og:image, preload-billede/-format, ekstra CSS (service-redesign/404/erhverv), noindex (tak: øverst; 404: midt i CSS-blokken), Meta Pixel (mangler på tak), floating-cta.css (mangler på tak) → parametriseret/side-chunks.
- **tak**: ingen og:-tags → `og_html` tom.
- Custom `<style>`-blok findes kun på forsiden → side-chunk.

## Sidelisten (sider.json)
- 25 sider bygges: 23 indekserbare (/, 9 p/-sider, 13 c/-sider) + /tak (noindex) + /p/haekklipning-landing.
- **/p/forside** bygges IKKE (gammel forsidekopi) — erstattes af 308-redirect i vercel.json.
- **Afviger fra opgavens 24-liste: /p/haekklipning-landing findes og svarer 200, men er ikke nævnt i opgavens sideliste** — bygget uændret (intet noindex), men IKKE i sitemap.
- **/tak** bygges med noindex og får ingen sitemap-indgang. **/404.html** bygges med noindex, ingen sitemap-indgang.
- Sitemap: 23 URL'er med `<lastmod>2026-09-09</lastmod>`. sitemap_pages.xml + sitemap_blog.xml slettes (robots.txt pegede allerede på /sitemap.xml).
- c/-siderne har et fælles inline hero-bind-script i tail (identisk på alle 12) + forsidens/erhvervs tails er side-specifikke → tail gemmes som side-chunk (ikke opført som selvstændig komponent i opgaven).
