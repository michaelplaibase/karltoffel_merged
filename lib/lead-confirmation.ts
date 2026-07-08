// Bekræftelsesmail til kunden efter et lead fra tilbudsmotoren ("Hvad koster
// din have?"). Renderes OG afsendes fra CRM'et (ikke sitet), fordi CRM'et ejer
// kunderejsen: samme sted logger vi en "email_sent"-hændelse på tidslinjen med
// det nøjagtige indhold, så en medarbejder kan se præcis hvad kunden modtog.
//
// Env: LEAD_CALL_ETA_MINUTES — "vi kontakter dig inden for X min" når der ikke
// er booket et konkret opkalds-slot. Default 15 (matcher tak-siden på sitet).

export type ConfirmationService = {
  navn: string;
  qty?: number;
  enhed?: string;
  freq?: number;
  pris?: number | null;
  pakke?: boolean;
};

export type ConfirmationInput = {
  name: string;
  address?: string | null;
  kundetype?: string | null; // "privat" | "erhverv" | null
  services: ConfirmationService[];
  estimat?: { aar?: number; visits?: number } | null;
  /** CRM'ets kalender-slot: "booked 2026-07-08T15:15:00" eller null. */
  call?: string | null;
  now?: Date;
};

export type RenderedEmail = { subject: string; html: string; text: string };

const DEFAULT_ETA_MIN = 15;
const DKK0 = new Intl.NumberFormat("da-DK", { maximumFractionDigits: 0 });
const kr = (n: number) => DKK0.format(Math.round(Number(n) || 0)) + " kr";
const antal = (n: number) => DKK0.format(Math.round(Number(n) || 0));

function esc(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function fornavn(navn: string): string {
  const n = (navn || "").trim();
  return n ? n.split(/\s+/)[0] : "";
}

/* ---------- ETA: hvornår ringer vi? ---------- */
const DAGE = ["søndag", "mandag", "tirsdag", "onsdag", "torsdag", "fredag", "lørdag"];

/** "YYYY-MM-DD" for et tidspunkt aflæst i dansk vægur-tid (Europe/Copenhagen),
 *  så "i dag/i morgen" er korrekt selv når serveren kører i UTC. */
function isoDatoIKobenhavn(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Copenhagen", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(date);
}

/** "booked 2026-07-08T15:15:00" → "Vi ringer til dig i dag ca. kl. 15:15." (ellers null). */
export function ringTekstFraSlot(call: string | null | undefined, now?: Date): string | null {
  const m = /^booked (\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(String(call ?? ""));
  if (!m) return null;
  const y = +m[1], mo = +m[2], d = +m[3], klok = `${m[4]}:${m[5]}`;
  const naa = now ?? new Date();
  const slotDato = `${m[1]}-${m[2]}-${m[3]}`;
  const iDag = isoDatoIKobenhavn(naa);
  // "i morgen" = dagen efter den danske kalenderdato (ikke +24t vægur-ms —
  // ellers rammer vi forkert på de to sommertids-skiftedøgn på 23/25 timer).
  const [iy, im, id] = iDag.split("-").map(Number);
  const iMorgen = new Date(Date.UTC(iy, im - 1, id + 1)).toISOString().slice(0, 10);
  let dag: string;
  if (slotDato === iDag) dag = "i dag";
  else if (slotDato === iMorgen) dag = "i morgen";
  else dag = "på " + DAGE[new Date(Date.UTC(y, mo - 1, d, 12)).getUTCDay()];
  return `Vi ringer til dig ${dag} ca. kl. ${klok}.`;
}

function etaMinutter(): number {
  const min = parseInt(process.env.LEAD_CALL_ETA_MINUTES ?? "", 10);
  return Number.isFinite(min) && min > 0 ? min : DEFAULT_ETA_MIN;
}

export function etaTekst(call: string | null | undefined, now?: Date): string {
  return ringTekstFraSlot(call, now)
    ?? `Vi regner med at kontakte dig inden for ca. ${etaMinutter()} minutter i vores åbningstid.`;
}

/* ---------- Valgte services → menneskelæselige linjer ---------- */
function serviceDetalje(s: ConfirmationService): string {
  const freq = Math.max(1, Math.round(Number(s.freq) || 1));
  const qty = Math.round(Number(s.qty) || 0);
  const enhed = (s.enhed || "").trim();
  if (s.pris == null) return s.pakke ? "indeholdt i pakken" : "pris ved besøg";
  if (!qty) return "pris efter antal";
  const maengde = enhed ? `${antal(qty)} ${enhed} · ` : "";
  return `${maengde}${freq}× om året`;
}

/* ---------- Render ---------- */
export function renderLeadConfirmation(input: ConfirmationInput): RenderedEmail {
  const fn = fornavn(input.name);
  const hilsen = fn ? `Hej ${fn}` : "Hej";
  const adresse = (input.address || "").trim();
  const ktLabel = input.kundetype === "erhverv" ? "Erhverv" : input.kundetype === "privat" ? "Privat" : "";
  const services = Array.isArray(input.services) ? input.services : [];
  const eta = etaTekst(input.call, input.now);

  // Pris pr. besøg udledes af årsestimat / antal besøg (payloaden gemmer ikke snit).
  const aar = Number(input.estimat?.aar) || 0;
  const visits = Math.round(Number(input.estimat?.visits) || 0);
  const snit = visits > 0 ? aar / visits : 0;
  const estimatLinje = snit > 0 && visits > 0
    ? `Estimeret pris: ca. ${kr(snit)} pr. besøg ved ${visits} besøg om året.`
    : "";
  const adrLinje = adresse + (ktLabel ? ` · ${ktLabel}` : "");

  const subject = "Tak for din forespørgsel – vi ringer snart";

  /* --- Plain-text (altid med som fallback OG som det vi viser på tidslinjen) --- */
  const t: string[] = [`${hilsen},`, "", 'Tak for din forespørgsel via "Hvad koster din have?".', eta, ""];
  if (adrLinje) t.push(`Adresse: ${adrLinje}`);
  if (services.length) {
    t.push("", "Det du har valgt:");
    services.forEach((s) => t.push(`  • ${s.navn} — ${serviceDetalje(s)}`));
  } else {
    t.push("", "Du har ikke valgt nogen ydelser endnu — vi sammensætter løsningen sammen med dig, når vi ringer.");
  }
  if (estimatLinje) {
    t.push("", estimatLinje, "(Vejledende estimat ud fra automatiske opmålinger — den endelige pris aftaler vi ved besøget.)");
  }
  t.push("", "Har du spørgsmål inden da, er du velkommen til at svare på denne mail.", "", "De bedste hilsner", "Karltoffel", "karltoffel.dk");
  const text = t.join("\n");

  /* --- HTML (inline styles; ydre tabel centrerer i Outlook) --- */
  const servicesHtml = services.length
    ? `<ul style="margin:0;padding:0;list-style:none;">${services.map((s) =>
        `<li style="padding:10px 0;border-bottom:1px solid #eee;">` +
          `<span style="font-weight:600;color:#1a1a1a;">${esc(s.navn)}</span>` +
          `<span style="color:#666;"> — ${esc(serviceDetalje(s))}</span></li>`).join("")}</ul>`
    : `<p style="margin:0;color:#444;">Du har ikke valgt nogen ydelser endnu — vi sammensætter løsningen sammen med dig, når vi ringer.</p>`;

  const estimatHtml = estimatLinje
    ? `<p style="margin:18px 0 4px;font-weight:600;color:#1a1a1a;">${esc(estimatLinje)}</p>` +
      `<p style="margin:0;font-size:13px;color:#888;">Vejledende estimat ud fra automatiske opmålinger — den endelige pris aftaler vi ved besøget.</p>`
    : "";

  const adrHtml = adrLinje ? `<p style="margin:0 0 14px;color:#888;font-size:14px;">${esc(adrLinje)}</p>` : "";

  const html =
`<!DOCTYPE html><html lang="da"><head><meta charset="utf-8">` +
`<meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head>` +
`<body style="margin:0;padding:0;background:#f0f0ee;">` +
`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#f0f0ee;"><tr>` +
`<td align="center" style="padding:24px 16px;">` +
`<table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:560px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1a1a1a;text-align:left;"><tr><td>` +
  `<div style="background:#FFF87B;border-radius:16px 16px 0 0;padding:22px 24px;">` +
    `<div style="font-size:20px;font-weight:800;color:#1a1a1a;letter-spacing:-0.02em;">Karltoffel</div>` +
    `<div style="font-size:13px;color:#5a5a2a;">Mindre bøvl. Mere overskud.</div></div>` +
  `<div style="background:#ffffff;border-radius:0 0 16px 16px;padding:26px 24px;">` +
    `<p style="margin:0 0 14px;font-size:17px;">${esc(hilsen)},</p>` +
    `<p style="margin:0 0 6px;color:#333;">Tak for din forespørgsel via <b>&bdquo;Hvad koster din have?&ldquo;</b>.</p>` +
    `<p style="margin:0 0 20px;font-size:16px;font-weight:600;color:#1a1a1a;">${esc(eta)}</p>` +
    adrHtml +
    `<div style="font-size:13px;color:#888;margin:0 0 6px;text-transform:uppercase;letter-spacing:0.04em;">Det du har valgt</div>` +
    servicesHtml + estimatHtml +
    `<p style="margin:24px 0 0;color:#333;">Har du spørgsmål inden da, er du velkommen til at svare på denne mail.</p>` +
    `<p style="margin:18px 0 0;color:#1a1a1a;">De bedste hilsner<br><b>Karltoffel</b><br>` +
      `<a href="https://karltoffel.dk" style="color:#7a7a2a;">karltoffel.dk</a></p></div>` +
  `<p style="text-align:center;color:#aaa;font-size:12px;margin:16px 0 0;">Du modtager denne mail, fordi du bad om et tilbud på karltoffel.dk.</p>` +
`</td></tr></table></td></tr></table></body></html>`;

  return { subject, html, text };
}
