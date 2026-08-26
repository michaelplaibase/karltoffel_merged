import { getDayProgram } from "@/lib/queries";
import { todayCphISO } from "@/lib/calendar";
import { getSessionUser, unauthorized } from "@/lib/api-auth";
import { prisma } from "@/lib/db";
import type { NextRequest } from "next/server";

// "Hent dagsprogram" (PDF) on /reports/day-pdf. Builds a minimal, valid multi-
// page PDF by hand (no external dependency) listing the day's routed stops.

function esc(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}
/** Fold to Latin-1/ASCII so the built-in Helvetica renders it (æøå → ae/oe/aa). */
function fold(s: string): string {
  return s
    .replace(/æ/g, "ae").replace(/ø/g, "oe").replace(/å/g, "aa")
    .replace(/Æ/g, "Ae").replace(/Ø/g, "Oe").replace(/Å/g, "Aa")
    .replace(/[^\x20-\x7e]/g, " ");
}

// Returns the PDF as an all-ASCII string (fold() strips non-ASCII), so it is
// byte-identical whether encoded as latin1 or utf-8 and the xref offsets computed
// from string length stay correct. Paginerer ved LINES_PER_PAGE — én side kan
// kun rumme ~53 linjer (y=800, 15 pt leading), og lange dage blev før klippet tavst.
const LINES_PER_PAGE = 48;
function buildPdf(allLines: string[]): string {
  const chunks: string[][] = [];
  for (let i = 0; i < allLines.length; i += LINES_PER_PAGE) chunks.push(allLines.slice(i, i + LINES_PER_PAGE));
  if (!chunks.length) chunks.push([]);
  const n = chunks.length;
  // Objektnumre: 1 Catalog, 2 Pages, 3..2+n Page, 3+n..2+2n Contents, 3+2n Font.
  const fontId = 3 + 2 * n;
  const objects: string[] = [
    "<</Type/Catalog/Pages 2 0 R>>",
    `<</Type/Pages/Kids[${Array.from({ length: n }, (_, k) => `${3 + k} 0 R`).join(" ")}]/Count ${n}>>`,
    ...Array.from({ length: n }, (_, k) =>
      `<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Resources<</Font<</F1 ${fontId} 0 R>>>>/Contents ${3 + n + k} 0 R>>`),
    ...chunks.map((chunk, k) => {
      const lines = k === 0 ? chunk : [`(fortsat - side ${k + 1}/${n})`, "", ...chunk];
      const body = lines.map((l, i) => (i === 0 ? "" : "T* ") + `(${esc(fold(l))}) Tj`).join("\n");
      const content = `BT\n/F1 11 Tf\n15 TL\n40 800 Td\n${body}\nET`;
      return `<</Length ${content.length}>>\nstream\n${content}\nendstream`;
    }),
    "<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [];
  objects.forEach((o, i) => { offsets.push(pdf.length); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
  const xref = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.forEach((off) => { pdf += `${String(off).padStart(10, "0")} 00000 n \n`; });
  pdf += `trailer\n<</Size ${objects.length + 1}/Root 1 0 R>>\nstartxref\n${xref}\n%%EOF`;
  return pdf;
}

export async function GET(req: NextRequest) {
  // getSessionUser (ikke kun requireSession): deaktiverede brugere skal afvises,
  // og viewer-reglen ("en medarbejder ser kun sine egne opgaver") skal håndhæves
  // her som på /daycalendar — før kunne enhver hente HELE teamets dagsprogram.
  const me = await getSessionUser();
  if (me == null) return unauthorized();
  const sp = req.nextUrl.searchParams;
  const rawDate = sp.get("date") ?? "";
  const date = /^\d{4}-\d{2}-\d{2}$/.test(rawDate) && !Number.isNaN(Date.parse(`${rawDate}T00:00:00Z`))
    ? rawDate
    : todayCphISO();
  const day = await getDayProgram(date, { id: me.id, isAdmin: me.isAdmin });

  // Medarbejder-filter: kun admin kan vælge (id, ikke fritekst); en almindelig
  // medarbejder får altid sit eget program. Uden valg: hele dagen ("Alle").
  const employeeIdRaw = sp.get("employeeId") ?? "";
  const employeeId = me.isAdmin && /^\d+$/.test(employeeIdRaw) ? Number(employeeIdRaw) : null;
  const chosen = employeeId != null
    ? await prisma.user.findUnique({ where: { id: employeeId }, select: { firstName: true, lastName: true } })
    : null;
  const chosenName = chosen ? `${chosen.firstName} ${chosen.lastName}` : null;
  const heading = me.isAdmin ? (chosenName ?? "Alle medarbejdere") : `${me.firstName} ${me.lastName}`;
  const stops = chosenName ? day.stops.filter((s) => s.employee === chosenName) : day.stops;
  const unplanned = chosenName ? day.unplanned.filter((s) => s.employee === chosenName) : day.unplanned;

  const lines = [
    `Dagsprogram - ${day.heading} (${day.relative})`,
    `Medarbejder: ${heading}`,
    // Kørsel er kun retvisende uden medarbejder-filter (aggregatet dækker alle viste).
    `Planlagt omsaetning: kr. ${stops.reduce((a, s) => a + s.price, 0).toLocaleString("da-DK")}${chosenName ? "" : `   Koersel: ${day.driving}`}`,
    "",
    ...(stops.length
      ? stops.flatMap((s) => [
          `${s.from}-${s.to}  ${s.customer}  (kr. ${s.price.toLocaleString("da-DK")})`,
          `        ${s.address}`,
          `        ${s.tasks.map((t) => t.description).join(", ")}`,
        ])
      : ["Ingen planlagte ordrer denne dag."]),
    // Ordrer der hører til dagen, men ikke kunne ruteplanlægges — skal med i
    // det printede program, så papirudgaven viser det samme som skærmen.
    ...(unplanned.length
      ? [
          "",
          `Ikke planlagt denne dag (${unplanned.length}):`,
          ...unplanned.flatMap((s) => [
            `${s.customer}  (kr. ${s.price.toLocaleString("da-DK")})  -  ${s.reason}`,
            `        ${s.address}`,
          ]),
        ]
      : []),
  ];

  return new Response(buildPdf(lines), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="dagsprogram_${date}.pdf"`,
    },
  });
}
