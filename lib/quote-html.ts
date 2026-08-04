// HTML-tilbudsmailen. Ren funktion — ingen DB, ingen I/O, så den kan unit-testes
// og kaldes fra både en server action og Slack-handleren.
//
// Layoutet er Karltoffels design, men bygget med <table> i stedet for flexbox.
// Grunden: Outlook på Windows renderer via Word, som ikke understøtter
// display:flex — designets pris-rækker ville falde sammen til én kolonne, og
// vw-enheder ignoreres helt. Tabeller + inline styles er det eneste, der ser
// ens ud i Outlook, Gmail, Apple Mail og mobilklienterne. Farver, radier,
// typografi og tekst er uændrede fra designet.
//
// Alt brugerdata skal gennem esc() — en kunde kan hedde noget med < eller &,
// og et navn må aldrig kunne lukke et attribut og injicere markup i mailen.

import { kr, erPakkeYdelse, linjeAar, type PricedService } from "@/lib/tilbudsmotor-pricing";

const C = {
  bg: "#EFE9DA",
  card: "#FFFFF0",
  brun: "#4C3718",
  brunLys: "#8A6931",
  gul: "#FFF87B",
  sort: "#1C140B",
  panel: "#F7F2E4",
  kant: "#E8DDC0",
} as const;

const FONT = "Arial,Helvetica,sans-serif";

export function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export type QuoteHtmlInput = {
  fornavn: string;
  adresse: string;
  services: PricedService[];
  /** Totalen der skal stå på tilbuddet, i kr inkl. moms. Sendes ind færdig-
   *  beregnet, så mailen aldrig regner sin egen pris ud — ét sted at regne. */
  total: number;
  /** Rabatlinjer mellem sum og total. SKAL med når total < summen af linjerne:
   *  ellers kan kunden lægge linjepriserne sammen og få et andet tal end
   *  totalen, og et tilbud der ikke kan regnes efter, er et tilbud der bliver
   *  ringet ind om. `beloeb` er positivt og vises som fradrag. */
  rabatter?: { label: string; beloeb: number }[];
  gyldigTil: string;
  pakkeNavn?: string;
  acceptUrl?: string;
  firma: { navn: string; telefon: string | null; email: string | null };
  momsInfo?: string;
};

/** En pris-række: ydelse til venstre, beløb til højre, med bundstreg.
 *  Uprisede linjer ("Indeholdt" / "Pris ved besøg") vises med tekst i stedet
 *  for et beløb — kunden skal kunne se at ydelsen er med, uden at tro den er
 *  gratis-i-tilgift. */
function linje(nr: number, s: PricedService): string {
  const aar = linjeAar(s);
  const beloeb = s.pris == null
    ? (erPakkeYdelse(s.id) ? "Indeholdt" : "Pris ved besøg")
    : kr(aar);
  const maengde = s.qty && s.enhed ? ` (${s.qty} ${esc(s.enhed)})` : "";
  return `<tr>
<td style="padding:9px 0;border-bottom:1px solid ${C.kant};color:${C.sort};font-family:${FONT};font-size:14.5px;font-weight:700;line-height:1.35;">${nr}. ${esc(s.navn)}${maengde}</td>
<td style="padding:9px 0;border-bottom:1px solid ${C.kant};color:${C.brun};font-family:${FONT};font-size:14.5px;font-weight:700;white-space:nowrap;text-align:right;">${beloeb}</td>
</tr>`;
}

function sektionsTitel(t: string, foerste: boolean): string {
  return `<tr><td colspan="2" style="padding:${foerste ? "0" : "20px"} 0 14px;color:${C.brunLys};font-family:${FONT};font-size:11px;font-weight:700;letter-spacing:1px;text-transform:uppercase;">${esc(t)}</td></tr>`;
}

export function renderQuoteHtml(i: QuoteHtmlInput): string {
  const pakke = i.services.filter((s) => erPakkeYdelse(s.id));
  const ekstra = i.services.filter((s) => !erPakkeYdelse(s.id));
  const pakkeNavn = i.pakkeNavn ?? "Villapakken";
  const moms = i.momsInfo ?? "Alle priser er inkl. moms.";

  // Delsum + rabatlinjer, så regnestykket kan følges fra linjer til total.
  // Vises kun når der FAKTISK er en rabat — ellers er delsum og total ens, og en
  // ekstra række ville blot støje.
  const rabatter = (i.rabatter ?? []).filter((r) => r.beloeb > 0);
  const delsum = i.services.reduce((a, s) => a + linjeAar(s), 0);
  const rabatRaekker = rabatter.length
    ? [
        `<tr>
<td style="padding:14px 0 9px;border-bottom:1px solid ${C.kant};color:${C.brun};font-family:${FONT};font-size:14px;font-weight:700;">Sum</td>
<td align="right" style="padding:14px 0 9px;border-bottom:1px solid ${C.kant};color:${C.brun};font-family:${FONT};font-size:14px;font-weight:700;white-space:nowrap;">${kr(delsum)}</td>
</tr>`,
        ...rabatter.map((r) => `<tr>
<td style="padding:9px 0;border-bottom:1px solid ${C.kant};color:${C.brunLys};font-family:${FONT};font-size:14px;font-weight:700;">${esc(r.label)}</td>
<td align="right" style="padding:9px 0;border-bottom:1px solid ${C.kant};color:${C.brunLys};font-family:${FONT};font-size:14px;font-weight:700;white-space:nowrap;">− ${kr(r.beloeb)}</td>
</tr>`),
      ].join("")
    : "";

  const raekker = [
    pakke.length ? sektionsTitel(`Pakke: ${pakkeNavn}`, true) : "",
    ...pakke.map((s, n) => linje(n + 1, s)),
    ekstra.length ? sektionsTitel("Ekstra ydelser til ekstra heldige karltofler", pakke.length === 0) : "",
    ...ekstra.map((s, n) => linje(n + 1, s)),
    rabatRaekker,
  ].join("");

  // Brødteksten må kun henvise til knappen, hvis knappen faktisk er der. Uden
  // acceptUrl ville kunden ellers lede efter noget, der ikke findes i mailen.
  const opfordring = i.acceptUrl
    ? "er du klar, klikker du bare &quot;Accepter tilbud&quot; nedenfor, så finder vi en dato."
    : "er du klar, svarer du blot på denne mail, så finder vi en dato.";

  const cta = i.acceptUrl
    ? `<tr><td align="center" style="padding:34px 0 8px;">
<a href="${esc(i.acceptUrl)}" style="display:inline-block;background:${C.gul};color:${C.brun};font-family:${FONT};font-weight:900;font-size:15px;letter-spacing:.5px;text-transform:uppercase;text-decoration:none;padding:16px 44px;border-radius:999px;">Accepter tilbud</a>
</td></tr>`
    : "";

  const kontakt = [i.firma.telefon, i.firma.email].filter(Boolean).map((v) => esc(String(v))).join(" · ");

  // Bemærk: <table> med width=600 + max-width:100% er den ramme der holder i
  // Outlook. role="presentation" holder skærmlæsere fra at læse layout-tabeller
  // op som datatabeller.
  return `<!DOCTYPE html>
<html lang="da">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light">
<title>Dit tilbud fra ${esc(i.firma.navn)}</title>
</head>
<body style="margin:0;padding:0;background:${C.bg};">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;">Dit tilbud på ${esc(i.adresse)} er klar til godkendelse.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.bg};margin:0;padding:0;">
<tr><td align="center" style="padding:40px 12px;">

<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:600px;max-width:100%;background:${C.card};border-radius:18px;overflow:hidden;">

<!-- Header -->
<tr><td style="padding:28px 40px;border-bottom:3px solid ${C.gul};">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="font-family:${FONT};font-weight:900;color:${C.brun};font-size:26px;letter-spacing:.5px;">${esc(i.firma.navn)}</td>
<td align="right" style="font-family:${FONT};font-weight:600;color:${C.brunLys};font-size:11px;letter-spacing:.5px;">HAVE- OG EJENDOMSSERVICE</td>
</tr></table>
</td></tr>

<!-- Hero -->
<tr><td style="background:${C.brun};padding:44px 40px 40px;">
<div style="font-family:${FONT};font-weight:700;color:${C.gul};font-size:13px;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:10px;">Dit tilbud er klar</div>
<h1 style="margin:0;font-family:${FONT};font-weight:900;color:${C.gul};font-size:38px;line-height:1.05;">Klar til at blive en heldig Karltoffel?</h1>
<p style="font-family:${FONT};font-weight:600;color:${C.card};font-size:16px;line-height:1.5;margin:16px 0 0;">Hej ${esc(i.fornavn)} — her er tilbuddet på ${esc(i.adresse)}, klar til godkendelse.</p>
</td></tr>

<!-- Brødtekst -->
<tr><td style="padding:36px 40px 8px;">
<div style="font-family:${FONT};font-weight:700;color:${C.sort};font-size:18px;margin-bottom:14px;">Hej ${esc(i.fornavn)}</div>
<div style="font-family:${FONT};font-weight:400;color:${C.brun};font-size:15px;line-height:1.6;margin-bottom:26px;">Tak for din henvendelse. Vi har sammensat et tilbud til dig ud fra det, du har efterspurgt. Se opgaverne og prisen nedenfor — ${opfordring}</div>

<!-- Prispanel -->
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${C.panel};border:1px solid ${C.kant};border-radius:14px;">
<tr><td style="padding:22px 26px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${raekker}
<tr>
<td style="padding:16px 0 0;border-top:2px solid ${C.brun};font-family:${FONT};font-weight:900;color:${C.brun};font-size:15px;text-transform:uppercase;letter-spacing:.5px;">Total</td>
<td align="right" style="padding:16px 0 0;border-top:2px solid ${C.brun};font-family:${FONT};font-weight:900;color:${C.brun};font-size:24px;white-space:nowrap;">${kr(i.total)}</td>
</tr>
<tr><td colspan="2" align="right" style="padding:6px 0 0;font-family:${FONT};color:${C.brunLys};font-size:12px;">${esc(moms)}</td></tr>
</table>
</td></tr>
</table>

<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
${cta}
<tr><td align="center" style="padding:14px 0 8px;font-family:${FONT};color:${C.brunLys};font-size:12.5px;">Tilbuddet er gyldigt til ${esc(i.gyldigTil)}.</td></tr>
</table>

</td></tr>

<!-- Footer -->
<tr><td align="center" style="background:${C.card};border-top:1px solid ${C.kant};padding:26px 40px 32px;">
<div style="font-family:${FONT};font-weight:900;color:${C.brun};font-size:18px;">${esc(i.firma.navn)}</div>
<div style="font-family:${FONT};color:${C.brunLys};font-size:12.5px;margin-top:8px;line-height:1.7;">${kontakt}<br>Fast haveservice til heldige karltofler</div>
</td></tr>

</table>
</td></tr>
</table>
</body>
</html>`;
}

/** Ren tekst-udgave. Skal ALTID med: klienter uden HTML viser den, og en mail
 *  med kun HTML-del rammer spamfiltre markant hårdere. */
export function renderQuoteText(i: QuoteHtmlInput): string {
  const pakke = i.services.filter((s) => erPakkeYdelse(s.id));
  const ekstra = i.services.filter((s) => !erPakkeYdelse(s.id));
  const linjer = (list: PricedService[]) =>
    list.map((s, n) => {
      const beloeb = s.pris == null ? (erPakkeYdelse(s.id) ? "Indeholdt" : "Pris ved besøg") : kr(linjeAar(s));
      const maengde = s.qty && s.enhed ? ` (${s.qty} ${s.enhed})` : "";
      return `${n + 1}. ${s.navn}${maengde} – ${beloeb}`;
    });

  const rabatter = (i.rabatter ?? []).filter((r) => r.beloeb > 0);
  const delsum = i.services.reduce((a, s) => a + linjeAar(s), 0);

  return [
    `Hej ${i.fornavn}`,
    ``,
    `Tak for din henvendelse. Her er tilbuddet på ${i.adresse}.`,
    ...(i.acceptUrl ? [] : [``, `Er du klar, svarer du blot på denne mail, så finder vi en dato.`]),
    ``,
    ...(pakke.length ? [`Pakke: ${i.pakkeNavn ?? "Villapakken"}`, ...linjer(pakke), ``] : []),
    ...(ekstra.length ? [`Ekstra ydelser:`, ...linjer(ekstra), ``] : []),
    ...(rabatter.length
      ? [`Sum: ${kr(delsum)}`, ...rabatter.map((r) => `${r.label}: − ${kr(r.beloeb)}`)]
      : []),
    `Total: ${kr(i.total)}`,
    i.momsInfo ?? "Alle priser er inkl. moms.",
    ``,
    `Tilbuddet er gyldigt til ${i.gyldigTil}.`,
    ...(i.acceptUrl ? [``, `Accepter tilbuddet her: ${i.acceptUrl}`] : []),
    ``,
    i.firma.navn,
    [i.firma.telefon, i.firma.email].filter(Boolean).join(" · "),
  ].join("\n");
}
