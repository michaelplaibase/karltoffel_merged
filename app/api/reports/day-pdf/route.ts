import { getDayProgram } from "@/lib/queries";
import { WEEK_MONDAY } from "@/lib/calendar";
import { requireSession, unauthorized } from "@/lib/api-auth";
import type { NextRequest } from "next/server";

// "Hent dagsprogram" (PDF) on /reports/day-pdf. Builds a minimal, valid single-
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
// from string length stay correct.
function buildPdf(lines: string[]): string {
  const body = lines.map((l, i) => (i === 0 ? "" : "T* ") + `(${esc(fold(l))}) Tj`).join("\n");
  const content = `BT\n/F1 11 Tf\n15 TL\n40 800 Td\n${body}\nET`;
  const objects = [
    "<</Type/Catalog/Pages 2 0 R>>",
    "<</Type/Pages/Kids[3 0 R]/Count 1>>",
    "<</Type/Page/Parent 2 0 R/MediaBox[0 0 595 842]/Resources<</Font<</F1 5 0 R>>>>/Contents 4 0 R>>",
    `<</Length ${content.length}>>\nstream\n${content}\nendstream`,
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
  if ((await requireSession()) == null) return unauthorized();
  const sp = req.nextUrl.searchParams;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.get("date") ?? "") ? sp.get("date")! : WEEK_MONDAY;
  const employee = sp.get("employee") || "Alle medarbejdere";
  const day = await getDayProgram(date);

  const lines = [
    `Dagsprogram - ${day.heading} (${day.relative})`,
    `Medarbejder: ${employee}`,
    `Planlagt omsaetning: kr. ${day.revenueDay.toLocaleString("da-DK")}   Koersel: ${day.driving}`,
    "",
    ...(day.stops.length
      ? day.stops.flatMap((s) => [
          `${s.from}-${s.to}  ${s.customer}  (kr. ${s.price.toLocaleString("da-DK")})`,
          `        ${s.address}`,
          `        ${s.tasks.map((t) => t.description).join(", ")}`,
        ])
      : ["Ingen planlagte ordrer denne dag."]),
  ];

  return new Response(buildPdf(lines), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="dagsprogram_${date}.pdf"`,
    },
  });
}
