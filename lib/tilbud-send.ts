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
      lines: { orderBy: { sort: "asc" }, select: { id: true, description: true, price: true, interval: true, startWeek: true } },
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
 *  Må KUN kaldes når kontakt har en e-mail. Sætter status 'sendt'.
 *  Thomas, 2026-09-12 (fejlretning): mailen indeholder nu det offentlige
 *  godkend-link (/t/<token>) som absolut URL — både i tekst og som klikbar
 *  Karltoffel-stilet knap i HTML — så kunden faktisk kan godkende fra mailen. */
export async function sendTilbudMail(args: {
  tilbudId: number;
  to: string;
  besked: string;
}): Promise<SendTilbudResult> {
  const data = await byggTilbudPdfData(args.tilbudId);
  if (!data) return { ok: false, error: "Tilbuddet blev ikke fundet." };
  if (!data.linjer.length) return { ok: false, error: "Tilbuddet har ingen opgavelinjer." };

  const tilbud = await prisma.tilbud.findUnique({
    where: { id: args.tilbudId },
    select: { acceptToken: true },
  });
  const godkendUrl = tilbud?.acceptToken ? `${crmBaseUrl()}/t/${tilbud.acceptToken}` : null;
  const besked = args.besked;
  // Sikkerhedsgreb: hvis linket er blevet redigeret væk i tekstfeltet,
  // tilføjes det altid igen — kunden skal aldrig få en mail uden link.
  const tekst = godkendUrl && !besked.includes(godkendUrl) ? `${besked}\n\nGodkend tilbud her: ${godkendUrl}` : besked;

  const pdfBuffer = await renderTilbudDocument(data);
  const periodeNavn = data.titel.toLowerCase().replace(/\s+/g, "-");
  await sendGmail({
    to: args.to,
    subject: `${data.titel} — Karltoffel`,
    text: tekst,
    html: htmlFraBesked(tekst, godkendUrl),
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

/** Besked → HTML: linjer som afsnit + det offentlige godkend-link som en
 *  klikbar Karltoffel-stilet knap (gul baggrund #FFF87B, mørk tekst #4C3718). */
function htmlFraBesked(besked: string, godkendUrl: string | null): string {
  const afsnit = besked
    .split("\n")
    .map((s) => `<p style="margin:0 0 12px;">${escapeHtml(s)}</p>`)
    .join("");
  const knap = godkendUrl
    ? `<p style="margin:16px 0;">` +
      `<a href="${escapeHtml(godkendUrl)}" ` +
      `style="display:inline-block;background:#FFF87B;color:#4C3718;font-weight:700;` +
      `padding:12px 24px;border-radius:8px;text-decoration:none;">Godkend tilbud her</a></p>` +
      `<p style="margin:0;color:#6b6b6b;font-size:13px;">` +
      `Virker knappen ikke? Kopiér dette link ind i din browser:<br>${escapeHtml(godkendUrl)}</p>`
    : "";
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#1a1a1a;">${afsnit}${knap}</div>`;
}

/** Standard-mailtekst: se lib/tilbud-mail-besked.ts (ren modul, testbar). */
export { tilbudMailBesked, crmBaseUrl } from "./tilbud-mail-besked";
import { tilbudMailBesked, crmBaseUrl } from "./tilbud-mail-besked";

/** Genbrugelig helper: priser på tilbudslinjer til visning (listet side). */
export function tilbudPrisOversigt(linjer: { description: string; price: number }[]): { lines: { description: string; price: number }[]; total: number } {
  return { lines: linjer, total: tilbudTotal(linjer) };
}