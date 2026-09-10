// PDF-renderering for månedsrapporten — EGEN .mts-fil (tvinger ESM under tsx/node),
// fordi @react-pdf/renderer er ESM-only og dette repo er CJS: require() fejler med
// ERR_PACKAGE_PATH_NOT_EXPORTED for '@react-pdf/hyphenate/en-us'. Dynamic import af
// en ESM-pakke fra CJS virker — men kun hvis DENNE fil selv er ESM (.mts).
// JSX er ikke tilladt i .mts → elementer bygges med React.createElement (h = e).
import { Document, Page, Text, View, StyleSheet, Image, Font, pdf } from "@react-pdf/renderer";
import { SNAGA_BLACK, HANKEN_REGULAR, HANKEN_SEMIBOLD } from "./maanedrapport-fonts";
import { SERVICES } from "./maanedrapport.mts";
import type { RapportData } from "./maanedrapport-types";

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

// Brand-farver (BRAND_MANUAL.md — kanoniske)
const FRITURE = "#FFF87B";
const JORDNAER = "#4C3718";
const MOS = "#FFFFF0";
const MULD = "#1C140B";
const CREME = "#FFFFF0";

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
  footerContact: { fontSize: 7.5, color: CREME },
  section: { marginHorizontal: 20, marginTop: 14 },
  visitDate: { fontFamily: "Snaga", fontSize: 13, color: JORDNAER },
  visitRule: { backgroundColor: FRITURE, height: 2.2, width: 150, marginTop: 3, marginBottom: 6 },
  task: { fontSize: 9.5, marginBottom: 2 },
  photoGrid: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  photo: { width: 145, height: 98, borderRadius: 3, backgroundColor: "#AE8642" },
  noPhotoNote: { fontSize: 8.5, marginTop: 6, color: "#8A6931" },
  salesTitle: { fontFamily: "Snaga", fontSize: 13, color: JORDNAER },
  salesIntro: { fontSize: 8.5, marginTop: 6, lineHeight: 1.4 },
  serviceCard: { backgroundColor: FRITURE, borderRadius: 3, padding: "5pt 6pt", width: "48.5%", marginBottom: 6 },
  serviceName: { fontSize: 8.5, fontWeight: 600, color: JORDNAER },
  serviceSub: { fontSize: 7.5, color: JORDNAER, marginTop: 1 },
});

function MonthlyReportDoc({ data }: { data: RapportData }) {
  const antalFotos = data.besoeg.reduce((n: number, b) => n + b.fotos.length, 0);
  const antalBesog = data.besoeg.length;
  const maanedNavn = data.maanedLabel.split(" ")[0].toLowerCase();
  const footer = e(View, { key: "footer", style: S.footer, fixed: true },
    e(Text, { style: S.footerSlogan }, "Mindre bøvl. Mere overskud."),
    e(Text, { style: S.footerContact }, "karltoffel.dk · 22 22 38 33 · hej@karltoffel.dk"),
  );
  return e(Document, null,
    // FORSIDE
    e(Page, { key: "forside", size: "A4", style: S.page },
      e(View, { style: S.headerBar },
        e(View, { style: S.logoBlob }),
        e(Text, { style: S.logoText }, "KARLTOFFEL"),
      ),
      e(View, { style: S.hero },
        e(Text, { style: S.heroTitle }, "Månedsrapport"),
        e(Text, { style: S.heroSub }, `${data.maanedLabel} · ${data.kundeNavn}`),
      ),
      e(Text, { style: { marginHorizontal: 20, marginTop: 16, fontSize: 10.5, lineHeight: 1.5 } },
        `Hej ${data.hilsenNavn}! Her er et lille overblik over, hvad vi har foretaget os hos jer i ${maanedNavn}. ` +
        (antalBesog > 0 ? `Vi har været ${antalBesog} gang${antalBesog === 1 ? "" : "e"} — og som du kan se på billederne, er vi godt tilfredse med resultatet.` : "Nedenfor kan du se, hvad vi har lavet."),
      ),
      e(View, { style: { backgroundColor: FRITURE, borderRadius: 4, padding: "10pt 12pt", marginTop: 12, marginHorizontal: 20 } },
        e(Text, { style: { fontSize: 10, fontWeight: 600 } }, `${antalBesog} besøg · ${antalFotos} fotos · Alt udført som aftalt`),
        e(Text, { style: { fontSize: 8.5, marginTop: 3, color: "#8A6931" } }, "Alle opgaver er kvalitetstjekket af holdet efter endt arbejde."),
      ),
      footer,
    ),
    // BESØG + SALG + AFSLUTNING
    e(Page, { key: "indhold", size: "A4", style: S.page },
      data.besoeg.map((b, i) =>
        e(View, { key: i, style: S.section, wrap: false },
          e(Text, { style: S.visitDate }, b.datoTekst),
          e(View, { style: S.visitRule }),
          b.opgaver.map((o, j) => e(Text, { key: j, style: S.task }, "· " + o)),
          b.fotos.length > 0
            ? e(View, { style: S.photoGrid, wrap: false },
                b.fotos.map((u, j) => e(Image, { key: j, style: S.photo, src: u })))
            : e(Text, { style: S.noPhotoNote }, "Vi tog ikke billeder ved dette besøg — men alt er som det skal være."),
        ),
      ),
      // SALGSSEKTION — "Alt det, vi kan hjælpe med"
      e(View, { style: S.section, wrap: false },
        e(Text, { style: S.salesTitle }, "Alt det, vi kan hjælpe med"),
        e(View, { style: S.visitRule }),
        e(Text, { style: S.salesIntro },
          "Ud over det, I allerede får, står vi klar til det meste. Ét opkald — så klarer vi resten. Mindre bøvl for jer, mere overskud til det, I er bedst til."),
        e(View, { style: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", marginTop: 8 } },
          SERVICES.map(([navn, und]: [string, string], i: number) =>
            e(View, { key: i, style: S.serviceCard, wrap: false },
              e(Text, { style: S.serviceName }, navn),
              e(Text, { style: S.serviceSub }, und),
            ),
          ),
        ),
      ),
      // AFSLUTNING
      e(View, { style: { backgroundColor: MULD, borderRadius: 4, padding: 12, margin: "10pt 20pt 0 20pt" }, wrap: false },
        e(Text, { style: { fontFamily: "Snaga", fontSize: 11, color: FRITURE } }, "Spørgsmål?"),
        e(Text, { style: { fontSize: 8.5, color: CREME, marginTop: 4 } }, "Ring på 22 22 38 33 eller skriv til hej@karltoffel.dk — vi svarer hurtigt."),
      ),
      footer,
    ),
  );
}

/** Render dokumentet til Uint8Array (toBuffer() giver en ReadableStream). */
export async function renderMaanedrapportDocument(data: RapportData): Promise<Uint8Array> {
  const doc = e(MonthlyReportDoc as unknown as ReactNS.FC<{ data: RapportData }>, { data });
  const stream = (await pdf(doc as never).toBuffer()) as unknown as NodeJS.ReadableStream;
  const chunks: Buffer[] = [];
  await new Promise<void>((resolve, reject) => {
    stream.on("data", (c: Buffer) => chunks.push(Buffer.from(c)));
    stream.on("end", () => resolve());
    stream.on("error", reject);
  });
  return new Uint8Array(Buffer.concat(chunks));
}
