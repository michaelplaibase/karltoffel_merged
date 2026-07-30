// Server-side spejling af tilbudsmotorens prisberegning.
//
// KILDE: site/assets/js/tilbudsmotor.js, blokken mellem /*PRICING-START*/ og
// /*PRICING-END*/. Formlen er kopieret 1:1 — ikke "cirka det samme". Grunden:
// Kristian retter mængder inde fra Slack (hæk 80 m → 110 m), og det tilbud der
// sendes til kunden SKAL regne som den beregner kunden selv stod i. Afviger de
// to, sender vi et andet tal end kunden fik vist, og det er en regning vi ikke
// kan forsvare.
//
// Ændrer nogen i PRICING-blokken i tilbudsmotor.js, skal denne fil ændres i
// samme commit. Konstanterne står med samme navne som i motoren, så et diff er
// til at læse.

/** 3 % mængderabat pr. valgt service, loft 15 % (5+ services = fuld rabat). */
export const RABAT_PR_SERVICE = 3;
export const RABAT_MAX = 15;

/** Id'erne på Villapakkens 8 faste ydelser (pakke:true i PRODUCTS). Lead-
 *  payloadet bærer ikke `pakke`-flaget videre, så tilbudsmailen udleder
 *  gruppering herfra for at kunne dele listen i "Pakke" og "Ekstra ydelser".
 *  Holdes i sync med tilbudsmotor.js — et ukendt id lander blandt tilvalgene,
 *  hvilket er den ufarlige side at fejle på. */
export const PAKKE_IDS = new Set([
  "vinduer", "haek", "green", "alge", "tagrender", "robot", "husgarage", "service",
]);

export function erPakkeYdelse(id: string): boolean {
  return PAKKE_IDS.has(id);
}

/** En valgt service, som den ligger i Lead.payload (se parseTmPayload i
 *  app/api/leads/route.ts). `pris` er ENHEDSprisen inkl. moms; null betyder
 *  "Indeholdt" eller "Pris ved besøg" — linjen tæller i antallet, men 0 kr. */
export type PricedService = {
  id: string;
  navn: string;
  wm: string | null;
  qty: number;
  enhed: string;
  freq: number;
  pris: number | null;
};

export type Beregning = {
  aar: number;         // årssum efter mængderabat, før rabatkode
  aarBrutto: number;   // årssum før nogen rabat
  rabatPct: number;    // mængderabat i procent
  rabatKr: number;
  md: number;          // aar/12 — bemærk: FØR rabatkode, som i motoren
  snit: number;        // pris pr. besøg (aar/visits)
  count: number;       // antal valgte services (også uprisede)
  visits: number;      // højeste frekvens — ydelser bundtes på samme besøg
};

export function rabatPct(count: number): number {
  return Math.min(RABAT_MAX, RABAT_PR_SERVICE * count);
}

/** Mirror af beregn() i tilbudsmotor.js. Alle services i listen regnes som
 *  valgte (`on`) — payloadet indeholder kun de valgte. */
export function beregn(services: PricedService[]): Beregning {
  let brutto = 0, count = 0, visits = 0;
  for (const p of services) {
    count += 1;                                    // uprisede ("indeholdt") tæller også med
    if (p.freq > visits) visits = p.freq;           // ydelser bundtes på samme besøg
    if (p.pris != null && p.qty > 0) brutto += p.pris * p.qty * p.freq;
  }
  const pct = rabatPct(count);
  const aar = brutto * (1 - pct / 100);
  return {
    aar, aarBrutto: brutto, rabatPct: pct, rabatKr: brutto - aar,
    md: aar / 12, snit: visits > 0 ? aar / visits : 0, count, visits,
  };
}

/** Årspris pr. linje inkl. moms. null-pris → 0 kr (men linjen vises stadig). */
export function linjeAar(p: PricedService): number {
  return p.pris == null || !p.qty ? 0 : p.pris * p.qty * p.freq;
}

/** Rabatkoden er EKSTRA rabat oven i mængderabatten og trækkes fra årssummen
 *  EFTER mængderabat — samme rækkefølge som opdater() i motoren. `md` i
 *  lead-payloadet er bevidst FØR rabatkoden; det er motorens egen kontrakt, og
 *  vi ændrer den ikke her. */
export function medRabatkode(r: Beregning, kodePct: number): { aarNet: number; snitNet: number } {
  const pct = Math.max(0, Math.min(100, kodePct || 0));
  const aarNet = r.aar * (1 - pct / 100);
  return { aarNet, snitNet: r.visits > 0 ? aarNet / r.visits : 0 };
}

/** Læs Lead.payload (JSON-streng fra tilbudsmotoren) uden at kunne vælte.
 *  Ukendte/ugyldige rækker droppes, præcis som ved indtaget. */
export type LeadPayload = {
  kundetype: "privat" | "erhverv" | null;
  services: PricedService[];
  rabatkode: string | null;
  rabatOk: boolean;
  rabatPct: number | null;
  /** ISO-tidsstempel for hvornår tilbudsmailen blev sendt fra Slack. Sat =
   *  tilbuddet er ude, og "Godkend og send" afvises. Markeringen bor i
   *  payloadet frem for i Lead.status, fordi en ny statusværdi ville falde ud af
   *  det åbne-leads-sæt i lib/mcp-tools.ts og dermed skjule sendte tilbud i
   *  daily_overview. */
  tilbudSendtAt: string | null;
};

const n = (v: unknown): number => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : 0);
const s = (v: unknown): string => (typeof v === "string" ? v : "");

export function parseLeadPayload(raw: string | null): LeadPayload {
  const empty: LeadPayload = { kundetype: null, services: [], rabatkode: null, rabatOk: false, rabatPct: null, tilbudSendtAt: null };
  if (!raw) return empty;
  let o: Record<string, unknown>;
  try { o = JSON.parse(raw) as Record<string, unknown>; } catch { return empty; }
  if (!o || typeof o !== "object") return empty;

  const kt = s(o.kundetype);
  const services: PricedService[] = (Array.isArray(o.services) ? o.services : []).flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const r = row as Record<string, unknown>;
    const navn = s(r.navn);
    if (!navn) return [];
    return [{
      id: s(r.id) || "ukendt",
      navn,
      wm: s(r.wm) || null,
      qty: n(r.qty),
      enhed: s(r.enhed),
      freq: n(r.freq),
      pris: typeof r.pris === "number" && Number.isFinite(r.pris) && r.pris >= 0 ? r.pris : null,
    }];
  });

  return {
    kundetype: kt === "privat" || kt === "erhverv" ? kt : null,
    services,
    rabatkode: s(o.rabatkode) || null,
    rabatOk: o.rabatOk === true,
    rabatPct: typeof o.rabatPct === "number" && Number.isFinite(o.rabatPct) ? o.rabatPct : null,
    tilbudSendtAt: s(o.tilbudSendtAt) || null,
  };
}

/** Serialisér tilbage til Lead.payload-formatet, så en Slack-rettelse kan
 *  gemmes uden at tabe rabatkode/kundetype. Estimatet regnes om fra de
 *  (evt. rettede) mængder, så CRM-listen viser det samme som Slack. */
export function serializeLeadPayload(p: LeadPayload): string {
  const r = beregn(p.services);
  return JSON.stringify({
    kundetype: p.kundetype,
    services: p.services,
    estimat: {
      md: Math.round(r.md), snit: Math.round(r.snit), aar: Math.round(r.aar),
      aarBrutto: Math.round(r.aarBrutto), rabatPct: r.rabatPct, rabatKr: Math.round(r.rabatKr),
      visits: r.visits, count: r.count,
    },
    ...(p.rabatkode ? { rabatkode: p.rabatkode, rabatOk: p.rabatOk, rabatPct: p.rabatPct } : {}),
    ...(p.tilbudSendtAt ? { tilbudSendtAt: p.tilbudSendtAt } : {}),
  });
}

const DKK = new Intl.NumberFormat("da-DK", { maximumFractionDigits: 0 });

/** "1.200 kr" — samme format som resten af CRM'et (lib/quote-render.ts). */
export function kr(v: number): string {
  return DKK.format(Math.round(v)) + " kr";
}
