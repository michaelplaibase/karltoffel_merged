// Tilbud-afsendelse (Thomas, 2026-09-11): generer branded PDF med opgavelinjer,
// priser og fotos, og send den fra hej@karltoffel.dk som vedhæftning — samme
// mønster som månedsrapporten (lib/maanedrapport-send.ts): private Blob-fotos
// hentes server-side med get() og indlejres som base64 data-URI, mailen går via
// sendGmail, og alt er indpakket i try/catch så ét fejlende foto aldrig stopper
// afsendelsen.
import { prisma } from "@/lib/db";
import { sendGmail } from "@/lib/gmail";
import { get } from "@vercel/blob";
import { renderTilbudDocument } from "./tilbud-doc.mts";
import { buildTilbudPdfData, tilbudTotal, type TilbudPdfData } from "./tilbud.mts";

/** Hent et privat Blob-foto som base64 data-URI (månedsrapport-mønsteret). */
async function blobSomDataUri(pathname: string): Promise<string | null> {
  try {
    const blobResult = await get(pathname, { access: "private" });
    if (!blobResult || blobResult.statusCode !== 200) return null;
    const chunks: Buffer[] = [];
    const reader = blobResult.stream.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(Buffer.from(value));
    }
    const buf = Buffer.concat(chunks);
    const ct = blobResult.headers.get("content-type") ?? "image/jpeg";
    return `data:${ct};base64,${buf.toString("base64")}`;
  } catch (e) {
    console.error("[tilbud] foto-hentning fejlede:", pathname, e instanceof Error ? e.message : e);
    return null; // spring fotoet over — tilbuddet skal ikke fejle pga. ét billede
  }
}

/** Byg PDF-data for et tilbud (linjer + fotos). returnerer null hvis tilbudet ikke findes. */
export async function byggTilbudPdfData(tilbudId: number): Promise<TilbudPdfData | null> {
  const tilbud = await prisma.tilbud.findUnique({
    where: { id: tilbudId },
    include: {
      contact: { select: { name: true, companyName: true, att: true } },
      lines: { orderBy: { sort: "asc" }, select: { id: true, description: true, price: true } },
      photos: { orderBy: { createdAt: "asc" }, select: { lineId: true, pathname: true } },
    },
  });
  if (!tilbud) return null;

  const data = buildTilbudPdfData({
    contact: tilbud.contact,
    title: tilbud.title,
    note: tilbud.note,
    startWeek: tilbud.startWeek,
    baseInterval: tilbud.baseInterval,
    lines: tilbud.lines,
  });

  // Fotos: lineId null → forside; ellers bundet til linjen (samme index som linjer).
  for (const p of tilbud.photos) {
    const uri = await blobSomDataUri(p.pathname);
    if (!uri) continue;
    if (p.lineId == null) {
      data.fotosForside.push(uri);
    } else {
      const idx = tilbud.lines.findIndex((l) => l.id === p.lineId);
      if (idx >= 0) data.fotosPerLinje[idx].push(uri);
    }
  }
  return data;
}

export type SendTilbudResult = { ok: true } | { ok: false; error: string };

/** Send tilbuddet til kunden fra hej@karltoffel.dk med PDF vedhæftet.
 *  Må KUN kaldes når kontakt har en e-mail. Sætter status 'sendt'. */
export async function sendTilbudMail(args: {
  tilbudId: number;
  to: string;
  besked: string;
}): Promise<SendTilbudResult> {
  const data = await byggTilbudPdfData(args.tilbudId);
  if (!data) return { ok: false, error: "Tilbuddet blev ikke fundet." };
  if (!data.linjer.length) return { ok: false, error: "Tilbuddet har ingen opgavelinjer." };

  const pdfBuffer = await renderTilbudDocument(data);
  const periodeNavn = data.titel.toLowerCase().replace(/\s+/g, "-");
  await sendGmail({
    to: args.to,
    subject: `${data.titel} — Karltoffel`,
    text: args.besked,
    html: args.besked.split("\n").map((s) => `<p>${escapeHtml(s)}</p>`).join(""),
    attachments: [
      {
        filename: `karltoffel-${periodeNavn}.pdf`,
        contentBase64: Buffer.from(pdfBuffer).toString("base64"),
        contentType: "application/pdf",
      },
    ],
  });
  await prisma.tilbud.update({
    where: { id: args.tilbudId },
    data: { status: "sendt", sentAt: new Date(), sentTo: args.to },
  });
  return { ok: true };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Standard-mailtekst til tilbuddet. */
export function tilbudMailBesked(data: { hilsenNavn: string; titel: string; samlet: number }): string {
  return (
    `Hej ${data.hilsenNavn}!\n\n` +
    `Vedhæftet finder du vores ${data.titel.toLowerCase()} med priserne på opgaverne ` +
    `(samlet ${data.samlet.toLocaleString("da-DK")} kr. inkl. moms).\n\n` +
    `Vil du sige ja, kan du klikke "Godkend tilbud" i mailen — så noterer vi det direkte i vores system. ` +
    `Du kan også bare ringe eller skrive til os.\n\n` +
    `Vi hører gerne fra dig!\n\nMvh Karltoffel`
  );
}

/** Genbrugelig helper: priser på tilbudslinjer til visning (listet side). */
export function tilbudPrisOversigt(linjer: { description: string; price: number }[]): { lines: { description: string; price: number }[]; total: number } {
  return { lines: linjer, total: tilbudTotal(linjer) };
}