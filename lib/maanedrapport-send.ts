// Månedrapport-afsendelse (Thomas 2026-09-09, godkendt): efter samlefaktura-mailen
// den 20. sendes en Karltoffel-mail med månedsrapport-PDF'en som vedhæftning.
// Kun erhvervskunder. Fejler rapporten, er fakturaen allerede sendt — fakturering
// må ALDRIG blokere på rapporten (try/catch omkring alt her).
import { prisma } from "@/lib/db";
import { sendGmail } from "@/lib/gmail";
import { get } from "@vercel/blob";
import {
  genererMaanedrapportPdf, formatBesogDato, contactErIPilot,
} from "@/lib/maanedrapport.mts";
import type { RapportData } from "@/lib/maanedrapport-types";

const CLOSED_STATUSES = ["Afsluttet", "Udført", "Sprunget over"];

/** Rapport-perioden for et cron-tidspunkt: forrige kalendermåned (dansk tid). */
export function rapportPeriode(now: Date): { year: number; month: number; period: string } {
  const lokal = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Copenhagen", year: "numeric", month: "2-digit",
  }).format(now); // "YYYY-MM"
  const [y, m] = lokal.split("-").map((x) => parseInt(x, 10));
  const py = m === 1 ? y - 1 : y;
  const pm = m === 1 ? 12 : m - 1;
  return { year: py, month: pm, period: `${py}-${String(pm).padStart(2, "0")}` };
}

/** Send månedsrapport til én erhvervskunde. Returnerer status for loggen. */
export async function sendMaanedrapportTilKontakt(args: {
  contactId: number;
  period: string; // "YYYY-MM"
  pilotEnv: string | undefined;
}): Promise<"sent" | "skipped_no_email" | "skipped_pilot" | "failed"> {
  const { contactId, period, pilotEnv } = args;

  // GDPR + pilot + dobbelt-send: tre hårde værns FØR noget genereres.
  if (!contactErIPilot(contactId, pilotEnv)) return "skipped_pilot";
  const already = await prisma.monthlyReportLog.findUnique({
    where: { contactId_period: { contactId, period } },
    select: { id: true },
  });
  if (already) return "skipped_no_email"; // allerede behandlet — aldrig dobbelt

  const contact = await prisma.contact.findUnique({
    where: { id: contactId },
    select: { name: true, email: true, att: true, companyName: true, isCompany: true },
  });
  if (!contact) return "failed";
  if (!contact.email) {
    await prisma.monthlyReportLog.create({ data: { contactId, period, status: "skipped_no_email" } }).catch(() => {});
    return "skipped_no_email";
  }

  try {
    const [yy, mm] = period.split("-").map(Number);
    const { start, end } = { start: periodeStart(yy, mm), end: periodeSlut(yy, mm) };

    const orders = await prisma.order.findMany({
      where: {
        contactId,
        plannedAt: { gte: start, lt: end },
        status: { in: CLOSED_STATUSES },
      },
      include: {
        tasks: { select: { category: true, description: true } },
      },
      orderBy: { plannedAt: "asc" },
    });

    // GDPR-hårdt filter: fotos kun via contactId — ALDRIG via orderId-listen alene.
    const photos = await prisma.orderPhoto.findMany({
      where: { contactId },
      orderBy: { createdAt: "asc" },
      select: { orderId: true, url: true, pathname: true },
    });
    // Privat Blob-store: hent bytes server-side med SDK'ens get() (BLOB-token) og
    // indlejr som base64 data-URI — en rå URL i PDF'en fejler (private store).
    const fotosByOrder = new Map<number, string[]>();
    for (const p of photos) {
      try {
        const blobResult = await get(p.pathname, { access: "private" });
        if (!blobResult || blobResult.statusCode !== 200) continue;
        // stream → Buffer
        const chunks: Buffer[] = [];
        const reader = blobResult.stream.getReader();
        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(Buffer.from(value));
        }
        const buf = Buffer.concat(chunks);
        const ct = blobResult.headers.get("content-type") ?? "image/jpeg";
        const dataUri = `data:${ct};base64,${buf.toString("base64")}`;
        const list = fotosByOrder.get(p.orderId) ?? [];
        list.push(dataUri);
        fotosByOrder.set(p.orderId, list);
      } catch (e) {
        console.error("[maanedrapport] foto-hentning fejlede:", p.pathname, e instanceof Error ? e.message : e);
        // spring fotoet over — rapporten skal ikke fejle pga. ét billede
      }
    }

    const data: RapportData = {
      kundeNavn: contact.companyName || contact.name || "Kunden",
      maanedLabel: maanedLabelDa(yy, mm),
      hilsenNavn: (contact.att || contact.name || "kunde").split(" ")[0],
      besoeg: orders.map((o) => ({
        datoTekst: formatBesogDato(o.plannedAt),
        opgaver: o.tasks.map((t) => (t.description ? `${t.category} — ${t.description}` : t.category)),
        fotos: fotosByOrder.get(o.id) ?? [],
      })),
    };

    const pdfBuffer = await genererMaanedrapportPdf(data);
    await sendGmail({
      to: contact.email,
      subject: `Månedsrapport ${maanedLabelDa(yy, mm)} — Karltoffel`,
      text: `Hej ${data.hilsenNavn}! Vedhæftet finder du månedsrapporten for ${maanedLabelDa(yy, mm)} med billeder fra månedens besøg. God fornøjelse — vi ses næste gang. Mvh Karltoffel`,
      html: `<p>Hej ${data.hilsenNavn}!</p><p>Vedhæftet finder du <b>månedsrapporten for ${maanedLabelDa(yy, mm)}</b> med billeder og en oversigt over månedens besøg.</p><p>God fornøjelse — vi ses næste gang.<br/>Mvh Karltoffel</p>`,
      attachments: [
        { filename: `karltoffel-maanedsrapport-${period}.pdf`, contentBase64: Buffer.from(pdfBuffer).toString("base64"), contentType: "application/pdf" },
      ],
    });
    await prisma.monthlyReportLog.create({ data: { contactId, period, status: "sent" } });
    return "sent";
  } catch (e) {
    console.error("[maanedrapport] fejlede for kontakt", contactId, period, e);
    try {
      await prisma.monthlyReportLog.upsert({
        where: { contactId_period: { contactId, period } },
        update: { status: "failed" },
        create: { contactId, period, status: "failed" },
      });
    } catch {}
    return "failed";
  }
}

function periodeStart(year: number, month: number): Date {
  const p2 = (n: number) => String(n).padStart(2, "0");
  return new Date(`${year}-${p2(month)}-01T00:00:00+02:00`);
}
function periodeSlut(year: number, month: number): Date {
  const p2 = (n: number) => String(n).padStart(2, "0");
  const nm = month === 12 ? `${year + 1}-01-01` : `${year}-${p2(month + 1)}-01`;
  return new Date(`${nm}T00:00:00+02:00`);
}
function maanedLabelDa(year: number, month: number): string {
  return new Intl.DateTimeFormat("da-DK", { month: "long", timeZone: "Europe/Copenhagen" })
    .format(new Date(Date.UTC(year, month - 1, 15)))
    .replace(/^./, (c) => c.toUpperCase()) + ` ${year}`;
}

/** Kør rapporter for ALLE erhvervskunder (kaldes fra cron-flowet d. 20. efter samlefakturaerne). */
export async function runMaanedrapporter(now: Date = new Date()): Promise<{ sent: number; skipped_no_email: number; skipped_pilot: number; failed: number }> {
  const pilotEnv = process.env.MAANEDSRAPPORT_PILOT_CONTACTS;
  const stats = { sent: 0, skipped_no_email: 0, skipped_pilot: 0, failed: 0 };
  const { period } = rapportPeriode(now);
  const erhverv = await prisma.contact.findMany({
    where: { isCompany: true },
    select: { id: true },
  });
  for (const c of erhverv) {
    if (!contactErIPilot(c.id, pilotEnv)) { stats.skipped_pilot++; continue; }
    const status = await sendMaanedrapportTilKontakt({ contactId: c.id, period, pilotEnv });
    if (status === "skipped_pilot") stats.skipped_pilot++;
    else stats[status]++;
  }
  return stats;
}
