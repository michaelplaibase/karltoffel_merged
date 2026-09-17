// PDF-renderering for Tilbud — EGEN .mts-fil, samme ESM-fældes-undvigelse som
// lib/maanedrapport-doc.mts (@react-pdf/renderer er ESM-only, repoet er CJS).
// Layoutet genbruger månedsrapportens brandede look: Jordnær header-bar med gul
// Karltoffel-markør, Friture-hero, Snaga-overskrifter, gul accent-streg,
// prislinjer + samlet kort, foto-gitter og MULD-afslutningsboks.
import { Document, Page, Text, View, StyleSheet, Image, Font, pdf } from "@react-pdf/renderer";
import { SNAGA_BLACK, HANKEN_REGULAR, HANKEN_SEMIBOLD } from "./maanedrapport-fonts";
import type { TilbudPdfData } from "./tilbud.mts";
import { bygAarshjul, linjeFarve, LINJE_FARVE_TEKST } from "./tilbud.mts";
import { tilbudMomsOgIalt, krMoms } from "./vat";

import * as ReactNS from "react";
const e = ReactNS.createElement;

Font.register({ family: "Snaga", src: SNAGA_BLACK });
Font.register({
  family: "Hanken",
  fonts: [
    { src: HANKEN_REGULAR },
    { src: HANKEN_SEMIBOLD, fontWeight: 600 },
  ],
});

const FRITURE = "#FFF87B";
const JORDNAER = "#4C3718";
const MOS = "#FFFFF0";
const MULD = "#1C140B";
const RISTET = "#8A6931";

const kr = (n: number) => n.toLocaleString("da-DK") + " kr.";

const S = StyleSheet.create({
  page: { backgroundColor: MOS, fontFamily: "Hanken", color: JORDNAER },
  headerBar: { backgroundColor: JORDNAER, padding: "14pt 20pt", flexDirection: "row", alignItems: "center" },
  logoBlob: { width: 26, height: 20, backgroundColor: FRITURE, borderRadius: 8, marginRight: 10 },
  logoText: { fontFamily: "Snaga", fontSize: 18, color: FRITURE },
  hero: { backgroundColor: FRITURE, margin: "16pt 20pt 0 20pt", padding: 18, borderRadius: 4 },
  heroTitle: { fontFamily: "Snaga", fontSize: 24, color: JORDNAER },
  heroSub: { fontSize: 12, fontWeight: 600, marginTop: 6, color: JORDNAER },
  footer: { position: "absolute", bottom: 0, left: 0, right: 0, backgroundColor: JORDNAER, padding: "8pt 20pt", flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  footerSlogan: { fontFamily: "Snaga", fontSize: 8.5, color: FRITURE },
  footerContact: { fontSize: 7.5, color: MOS },
  section: { marginHorizontal: 20, marginTop: 14 },
  sectionTitle: { fontFamily: "Snaga", fontSize: 13, color: JORDNAER },
  sectionRule: { backgroundColor: FRITURE, height: 2.2, width: 150, marginTop: 3, marginBottom: 6 },
  lineRow: { flexDirection: "row", justifyContent: "space-between", fontSize: 10, marginBottom: 4 },
  lineName: { fontSize: 10, maxWidth: 380 },
  lineFrekvens: { fontSize: 8, color: RISTET, marginTop: 2 },
  linePrice: { fontSize: 10, fontWeight: 600 },
  totalBox: { backgroundColor: FRITURE, borderRadius: 4, padding: "10pt 12pt", marginTop: 10, marginHorizontal: 20 },
  photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  photo: { width: 145, height: 98, borderRadius: 3, backgroundColor: "#AE8642" },
  note: { marginHorizontal: 20, marginTop: 12, fontSize: 10.5, lineHeight: 1.5 },
  momsNote: { fontSize: 8.5, marginTop: 6, marginHorizontal: 20, color: RISTET },
});

function footerEl(key: string) {
  return e(View, { key, style: S.footer, fixed: true },
    e(Text, { style: S.footerSlogan }, "Mindre bøvl. Mere overskud."),
    e(Text, { style: S.footerContact }, "karltoffel.dk · 22 22 38 33 · hej@karltoffel.dk"),
  );
}

function photoGridEl(fotos: string[]) {
  if (!fotos.length) return null;
  return e(View, { style: S.photoGrid, wrap: false },
    fotos.map((u, j) => e(Image, { key: j, style: S.photo, src: u })),
  );
}

// Årshjul-afsnit (Thomas, 2026-09-11): hele årets besøg pr. uge som simple
// gul- chips med opgave-initialer — [] når ingen linjer kan placeres.
function aarshjulAfsnit(linjer: TilbudPdfData["linjer"]) {
  const uger = bygAarshjul(linjer);
  if (!uger.length) return [];
  const naesteAar = uger.some((u) => u.opgaver.some((o) => o.naesteAar));
  return [
    e(View, { style: S.section, wrap: false },
      e(Text, { style: S.sectionTitle }, "Årshjul — årets besøg pr. uge"),
      e(View, { style: S.sectionRule }),
      e(Text, { style: { fontSize: 8.5, color: RISTET, marginBottom: 5 } },
        "Bogstaverne er opgavernes initialer." +
        (naesteAar ? " (→) = besøg, der falder i det følgende år (ugerne ruller over 52)." : "")),
      e(View, { style: { flexDirection: "row", flexWrap: "wrap", gap: 5 } },
        uger.map((u) =>
          e(View, { key: u.uge, style: { backgroundColor: FRITURE, borderRadius: 3, padding: "4pt 6pt", maxWidth: "30%" } },
            e(Text, { style: { fontSize: 8.5, fontWeight: 600, fontFamily: "Hanken" } }, `Uge ${u.uge}`),
            // Thomas, 2026-09-15: hver opgave er sin egen chip i LINJENS farve
            // (samme linjeFarve(index) som formularen/accept-siden), så man
            // straks ser, hvilke uger der hører til hvilken opgave.
            e(View, { style: { flexDirection: "row", flexWrap: "wrap", gap: 3, marginTop: 2 } },
              u.opgaver.map((o, i) =>
                e(Text, { key: i, style: { fontSize: 9, color: LINJE_FARVE_TEKST, fontWeight: 600, backgroundColor: o.farve ?? JORDNAER, borderRadius: 2, padding: "1pt 4pt", maxWidth: 90 } },
                  o.kort + (o.naesteAar ? "→" : ""))),
            ),
          ),
        ),
      ),
      // Legend (Thomas, 2026-09-15): farve + opgavenavn — kun når der er mere
      // end én linje, så farverne kan kobles til opgaverne.
      linjer.length > 1
        ? e(View, { style: { flexDirection: "column", gap: 2, marginTop: 6 }, wrap: false },
            linjer.map((l, i) =>
              e(View, { key: i, style: { flexDirection: "row", alignItems: "center", gap: 5 } },
                e(View, { style: { width: 8, height: 8, borderRadius: 2, backgroundColor: linjeFarve(i) } }),
                e(Text, { style: { fontSize: 8.5, color: JORDNAER } }, l.description),
              ),
            ),
          )
        : null,
    ),
  ];
}

function TilbudDoc({ data }: { data: TilbudPdfData }) {
  const antalFotos = data.fotosForside.length + data.fotosPerLinje.reduce((n, f) => n + f.length, 0);
  return e(Document, null,
    e(Page, { key: "forside", size: "A4", style: S.page },
      e(View, { style: S.headerBar },
        e(View, { style: S.logoBlob }),
        e(Text, { style: S.logoText }, "KARLTOFFEL"),
      ),
      e(View, { style: S.hero },
        e(Text, { style: S.heroTitle }, data.titel),
        e(Text, { style: S.heroSub }, `Til ${data.kundeNavn}`),
      // Thomas, 2026-09-15: kundens adresse diskret under kundenavnet
      // ("Til Regionshospitalet Brædstrup / Svendborgvej 62, 5700 Svendborg").
      data.kundeAdresse
        ? e(Text, { style: { ...S.heroSub, fontSize: 10, fontWeight: 400, marginTop: 2 } }, data.kundeAdresse)
        : null,
      ),
      e(Text, { style: { marginHorizontal: 20, marginTop: 14, fontSize: 10.5, lineHeight: 1.5 } },
        `Hej ${data.hilsenNavn}! Her er vores tilbud på opgaverne. Du kan se priserne på hver opgave` +
        (data.aarsbelob != null ? ` og det årlige beløb nederst.` : `.`),
      ),
      data.startWeek || data.baseInterval
        ? e(Text, { style: { marginHorizontal: 20, marginTop: 8, fontSize: 10.5, fontWeight: 600 } },
            [data.startWeek ? `Start: ${data.startWeek}` : null, data.baseInterval ? `Interval: ${data.baseInterval}` : null]
              .filter(Boolean).join(" · "))
        : null,
      data.note
        ? e(Text, { style: S.note }, data.note)
        : null,
      antalFotos > 0 && data.fotosForside.length
        ? e(View, { style: S.section, wrap: false },
            e(Text, { style: S.sectionTitle }, "Billeder fra opgaven"),
            e(View, { style: S.sectionRule }),
            photoGridEl(data.fotosForside))
        : null,
      // Opgavelinjer + samlet pris
      e(View, { style: S.section, wrap: false },
        e(Text, { style: S.sectionTitle }, "Opgaver og priser"),
        e(View, { style: S.sectionRule }),
        data.linjer.map((l, i) =>
          e(View, { key: i, style: S.lineRow, wrap: false },
            // Thomas, 2026-09-11 (korrektion): hver linje viser titel, pris OG
            // frekvens — nemt og overskueligt for kunden ("Vinduespudsning —
            // 566 kr. pr. gang — hver 6. uge"). Engangsopgaver uden interval
            // vises uden frekvenslinje.
            e(View, { style: { flex: 1 } },
              // Thomas, 2026-09-15: farve-markering pr. linjerække — samme
              // farve som linjens chips i årshjulet nedenfor.
              e(View, { style: { flexDirection: "row", alignItems: "center", gap: 5 } },
                e(View, { style: { width: 7, height: 7, borderRadius: 2, backgroundColor: linjeFarve(i), marginTop: 1 } }),
                e(Text, { style: S.lineName }, l.description),
              ),
              l.interval ? e(Text, { style: S.lineFrekvens }, l.interval.toLowerCase()) : null,
              // Thomas, 2026-09-11 (korrektion 2): diskret startuge pr. linje
              // ("Starter uge 29") — kun når linjen har en startuge.
              l.startWeek ? e(Text, { style: S.lineFrekvens }, `Starter ${l.startWeek.charAt(0).toLowerCase()}${l.startWeek.slice(1)}`) : null,
            ),
            e(Text, { style: S.linePrice },
              // Thomas, 2026-09-17 (korrektion 2): hver linje viser BÅDE prisen
              // u. moms OG inkl. moms for PRIVATE kunder (fx "566 kr. pr. gang
              // (u. moms) / 707,50 kr. pr. gang (inkl. moms)"); virksomheder
              // bibeholder kun prisen u. moms (momsen i bunden).
              data.isCompany
                ? `${kr(l.price)} pr. gang (u. moms)`
                : `${kr(l.price)} pr. gang (u. moms) / ${krMoms(tilbudMomsOgIalt(l.price).ialt)} pr. gang (inkl. moms)`),
          ),
        ),
      ),
      // ÅRSHJUL (Thomas, 2026-09-11): hele årets besøg pr. uge — sendes SAMMEN
      // MED TILBUDET. Simpel tabel pr. uge med opgave-initialer; samme data
      // (bygAarshjul) som formularen og accept-siden, så tallene aldrig afviger.
      ...aarshjulAfsnit(data.linjer),
      // Bundlinje: ÅRLIGT beløb når intervallet er sat (Thomas, 2026-09-11 —
      // det gamle 'samlet beløb' er fjernet). Uden interval: kun momsnoden.
      // Thomas, 2026-09-15: priser u. moms — moms (25%) + ialt inkl. moms i
      // bunden. Samme lib/vat-funktion som alle andre flader, så tallene
      // aldrig afviger.
      e(View, { style: S.totalBox, wrap: false },
        data.aarsbelob != null
          ? (() => {
              const m = tilbudMomsOgIalt(data.aarsbelob);
              return [
                e(Text, { key: "ekskl", style: { fontSize: 11, fontWeight: 600 } }, `Årligt beløb: ${krMoms(m.ekskl)} (u. moms)`),
                e(Text, { key: "moms", style: { fontSize: 9.5, marginTop: 3 } }, `Moms (25%): ${krMoms(m.moms)}`),
                e(Text, { key: "ialt", style: { fontSize: 11, fontWeight: 600, marginTop: 3 } }, `Ialt inkl. moms: ${krMoms(m.ialt)}`),
              ];
            })()
          : null,
        e(Text, { style: { fontSize: 8.5, marginTop: data.aarsbelob != null ? 3 : 0, color: RISTET } },
          "Alle priser er u. moms. Tilbuddet er gældende i 30 dage."),
      ),
      e(View, { style: { backgroundColor: MULD, borderRadius: 4, padding: 12, margin: "12pt 20pt 0 20pt" }, wrap: false },
        e(Text, { style: { fontFamily: "Snaga", fontSize: 11, color: FRITURE } }, "Vil du sige ja?"),
        e(Text, { style: { fontSize: 8.5, color: MOS, marginTop: 4 } },
          "Klik \"Godkend tilbud\" i mailen, eller ring på 22 22 38 33 — så tager vi resten."),
      ),
      footerEl("footer1"),
    ),
    // Evt. ekstra fotosider: én side pr. linje med fotos (forside viser øvrige fotos)
    ...data.fotosPerLinje
      .map((fotos, i) => ({ fotos, linje: data.linjer[i] }))
      .filter((x) => x.fotos.length > 0)
      .map((x, i) =>
        e(Page, { key: `linje-${i}`, size: "A4", style: S.page },
          e(View, { style: S.headerBar },
            e(View, { style: S.logoBlob }),
            e(Text, { style: S.logoText }, "KARLTOFFEL"),
          ),
          e(View, { style: S.section, wrap: false },
            e(Text, { style: S.sectionTitle }, "Billeder"),
            e(View, { style: S.sectionRule }),
            e(Text, { style: { fontSize: 10 } }, x.linje.description),
          ),
          photoGridEl(x.fotos),
          footerEl(`footer-l-${i}`),
        ),
      ),
  );
}

/** Render dokumentet til Uint8Array (toBuffer() giver en ReadableStream). */
export async function renderTilbudDocument(data: TilbudPdfData): Promise<Uint8Array> {
  const doc = e(TilbudDoc as unknown as ReactNS.FC<{ data: TilbudPdfData }>, { data });
  const stream = (await pdf(doc as never).toBuffer()) as unknown as NodeJS.ReadableStream;
  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    stream.on("data", (c: Buffer) => chunks.push(Buffer.from(c)));
    stream.on("end", () => resolve());
    stream.on("error", reject);
  });
  return new Uint8Array(Buffer.concat(chunks));
}