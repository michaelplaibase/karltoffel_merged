// Lead-beregner-motor (Thomas, 2026-09-03). Henter automatisk alle kunde-
// erhvervelser (LeadAcquisition) og beregner månedlig/årlig indtjening pr.
// kunde fra CRM-data: abonnementer (samme rytme-regler som omsætningspanelet)
// og fastprisaftaler (årspris ÷ 12 som md-gns). MarketingSpend tastes manuelt
// pr. kanal pr. måned; CAC = forbrug pr. kanal ÷ antal nye kunder fra kanalen.
import { prisma } from "./db";
import { MOMS } from "./data";

const WEEKS_PER_YEAR = 52;
const MONTHS_PER_YEAR = 12;

function parseBaseInterval(label: string): number {
  const m = label.match(/Hver\s+(\d+)\.\s*uge/i);
  return m ? Math.max(1, Number(m[1])) : 1;
}
function parseMultiplier(label: string | null): number {
  if (!label) return 1;
  if (/anmodning/i.test(label)) return 0;
  const m = label.match(/Hver\s+(\d+)\.\s*gang/i);
  return m ? Math.max(1, Number(m[1])) : 1;
}
function pausedOn(t: { pauseActive: boolean; pauseStart: string | null; pauseEnd: string | null }, iso: string): boolean {
  return !!(t.pauseActive && t.pauseStart && t.pauseEnd && iso >= t.pauseStart && iso <= t.pauseEnd);
}

/** Årlig omsætning for ét abonnement, kr inkl. moms (0 ved "På anmodning"). */
function subYearlyKr(sub: { baseInterval: string; tasks: { price: number; intervalMultiplier: string | null; pauseActive: boolean; pauseStart: string | null; pauseEnd: string | null }[] }): number {
  let yearly = 0;
  for (const t of sub.tasks) {
    const mult = parseMultiplier(t.intervalMultiplier);
    if (mult === 0) continue;
    const stepWeeks = parseBaseInterval(sub.baseInterval) * mult;
    const visits = WEEKS_PER_YEAR / stepWeeks;
    yearly += t.price * visits;
  }
  return yearly;
}

export type LeadRow = {
  acquisitionId: number;
  contactId: number;
  name: string;
  isCompany: boolean;
  category: "privat" | "virksomhed" | "fastpris";
  source: string;
  startedAtISO: string;
  monthlyKr: number;   // forventet indtjening pr. md (inkl. moms)
  yearlyKr: number;    // forventet indtjening pr. år (inkl. moms)
};

export type LeadCalc = {
  rows: LeadRow[];
  byCategory: { category: string; count: number; monthlyKr: number; yearlyKr: number }[];
  bySource: { source: string; count: number; monthlyKr: number; yearlyKr: number; marketingKr: number; cac: number | null }[];
  marketingTotal: number;
  cac: number | null;              // samlet CAC: total marketing ÷ antal nye i perioden
  avgMonthlyKrNewCustomers: number; // ny kunde gns. indtjening/md
};

/** Ægte "ny kunde"-periode: fra ISO-dato (inkl.) til ISO-dato (inkl.). */
export async function getLeadCalc(fromISO: string, toISO: string): Promise<LeadCalc> {
  const fromD = new Date(`${fromISO}T00:00:00.000Z`);
  const toD = new Date(`${toISO}T23:59:59.999Z`);

  const [acqs, subs, fixedPrices, spends] = await Promise.all([
    prisma.leadAcquisition.findMany({
      where: { companyId: 1, startedAt: { gte: fromD, lte: toD } },
      include: { contact: { select: { id: true, name: true, isCompany: true } } },
      orderBy: { startedAt: "desc" },
    }),
    prisma.subscription.findMany({
      where: { active: true, pending: false, contact: { acquisitions: { some: {} } } },
      select: { contactId: true, baseInterval: true, tasks: { select: { price: true, intervalMultiplier: true, pauseActive: true, pauseStart: true, pauseEnd: true } } },
    }),
    prisma.fixedPriceAgreement.findMany({
      where: { contact: { acquisitions: { some: {} } } },
      select: { contactId: true, tasks: { select: { price: true } } },
    }),
    prisma.marketingSpend.findMany({
      where: { companyId: 1, year: { gte: new Date(`${fromISO}T00:00:00Z`).getUTCFullYear() } },
    }),
  ]);

  // Indtjening pr. kontakt: abo (md/år) + fastpris (år-estimat ÷ 12)
  const monthlyByContact = new Map<number, number>();
  const yearlyByContact = new Map<number, number>();
  for (const s of subs) {
    const y = subYearlyKr(s);
    yearlyByContact.set(s.contactId, (yearlyByContact.get(s.contactId) ?? 0) + y);
  }
  for (const f of fixedPrices) {
    const yearTotal = f.tasks.reduce((a, t) => a + t.price, 0) * (52 / 4); // FASTPRIS: t.price = pr. besøg (4-ugers cyklus)
    yearlyByContact.set(f.contactId, (yearlyByContact.get(f.contactId) ?? 0) + yearTotal);
  }
  for (const [cid, y] of yearlyByContact) monthlyByContact.set(cid, y / MONTHS_PER_YEAR);

  const rows: LeadRow[] = acqs.map((a) => ({
    acquisitionId: a.id,
    contactId: a.contactId,
    name: a.contact.name,
    isCompany: a.contact.isCompany,
    category: a.category as LeadRow["category"],
    source: a.source,
    startedAtISO: a.startedAt.toISOString().slice(0, 10),
    monthlyKr: Math.round((monthlyByContact.get(a.contactId) ?? 0) * 100) / 100,
    yearlyKr: Math.round((yearlyByContact.get(a.contactId) ?? 0) * 100) / 100,
  }));

  const byCategoryMap = new Map<string, { count: number; monthlyKr: number; yearlyKr: number }>();
  const bySourceMap = new Map<string, { count: number; monthlyKr: number; yearlyKr: number }>();
  for (const r of rows) {
    const c = byCategoryMap.get(r.category) ?? { count: 0, monthlyKr: 0, yearlyKr: 0 };
    c.count++; c.monthlyKr += r.monthlyKr; c.yearlyKr += r.yearlyKr;
    byCategoryMap.set(r.category, c);
    const s = bySourceMap.get(r.source) ?? { count: 0, monthlyKr: 0, yearlyKr: 0 };
    s.count++; s.monthlyKr += r.monthlyKr; s.yearlyKr += r.yearlyKr;
    bySourceMap.set(r.source, s);
  }

  // Marketing-forbrug i periodens år pr. kanal (periode = én måned i praksis:
  // fanen bruger månedsvisning). Sum de måneder der ligger i [fromISO, toISO].
  const year = new Date(`${fromISO}T00:00:00Z`).getUTCFullYear();
  const spendByChannel = new Map<string, number>();
  for (const sp of spends) {
    const start = new Date(Date.UTC(year, sp.month - 1, 1));
    const end = new Date(Date.UTC(year, sp.month, 0, 23, 59, 59));
    if (end < fromD || start > toD) continue;
    spendByChannel.set(sp.channel, (spendByChannel.get(sp.channel) ?? 0) + sp.amount);
  }

  const marketingTotal = [...spendByChannel.values()].reduce((a, b) => a + b, 0);
  const cac = rows.length > 0 ? Math.round(marketingTotal / rows.length) : null;

  const bySource = [...bySourceMap.entries()].map(([source, s]) => {
    const mkt = spendByChannel.get(source) ?? 0;
    return {
      source,
      count: s.count,
      monthlyKr: Math.round(s.monthlyKr * 100) / 100,
      yearlyKr: Math.round(s.yearlyKr * 100) / 100,
      marketingKr: mkt,
      cac: s.count > 0 ? Math.round(mkt / s.count) : null,
    };
  }).sort((a, b) => b.count - a.count);

  return {
    rows,
    byCategory: ["privat", "virksomhed", "fastpris"]
      .filter((c) => byCategoryMap.has(c))
      .map((c) => {
        const s = byCategoryMap.get(c)!;
        return { category: c, count: s.count, monthlyKr: Math.round(s.monthlyKr * 100) / 100, yearlyKr: Math.round(s.yearlyKr * 100) / 100 };
      }),
    bySource,
    marketingTotal,
    cac,
    avgMonthlyKrNewCustomers: rows.length > 0 ? Math.round(rows.reduce((a, r) => a + r.monthlyKr, 0) / rows.length) : 0,
  };
}

/** Kanaler (Thomas, 2026-09-03): fritekst muligt, disse er standardvalgene. */
export const LEAD_SOURCES = ["SEO", "Meta", "Sociale medier", "Anbefaling", "Direkte", "Andet"] as const;

/** Lead → Lead-beregner-kanal: mapper emnets utm-data (gemt af /api/leads)
 *  til en af standardkanalerne, med fornuftig fald-tilbage. Bruges ved
 *  konvertering (app/actions/leads.ts), så CAC pr. kanal bliver rigtig.
 *  intet utm / ukendt → fald tilbage til "Direkte" hhv. "Andet". */
export function leadTilKanal(lead: { source: string | null; utm: string | null }): string {
  let utm: Record<string, string> | null = null;
  try { utm = lead.utm ? JSON.parse(lead.utm) : null; } catch { utm = null; }
  const src = String(utm?.source || "").toLowerCase();
  const med = String(utm?.medium || "").toLowerCase();
  if (src === "meta" || src === "facebook" || src === "fb" || src === "instagram" || med === "social-paid") return "Meta";
  if (med === "cpc" || med === "ppc" || med === "paidsearch" || med === "paid") return "Andet";   /* betalt søgning */
  if (src === "google" || src === "seo" || med === "organic") return "SEO";
  if (src === "newsletter" || src === "email" || med === "email") return "Sociale medier";
  if (src === "referral" || src === "anbefaling") return "Anbefaling";
  if (!src && !med) return "Direkte";
  return "Andet";
}

/** Valg af kategori for en ny kunde (auto-forslag ud fra CRM-data). */
export function suggestCategory(hasSubscription: boolean, hasFixedPrice: boolean, isCompany: boolean): "privat" | "virksomhed" | "fastpris" {
  if (hasFixedPrice) return "fastpris";
  if (isCompany) return "virksomhed";
  return "privat";
}
