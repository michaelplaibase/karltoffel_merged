// Live reporting data derived from the database (KPIs + chart series).
// Kept in its own module (not lib/queries.ts) so the reporting pages own their
// aggregation. All amounts are DKK incl. VAT. Provides both a trailing-12-months
// and a year-to-date view (period toggle) and both monthly and weekly chart
// series (Måned/Uge toggle).
// "Omsætning" = KUN udførte ordrer (status "Udført"), samme definition som
// lønrapporten (lib/payroll.ts), så de to admin-flader kan afstemmes. Antal-/
// gns.-serierne dækker fortsat alle planlagte ordrer og siger det i titlen.
import { prisma } from "./db";
import { isoWeek } from "./planner";
import { todayCphISO } from "./calendar";

export type Kpi = { k: string; t: string; s?: string };
export type Series = { name: string; color: string; values: number[] };

export type ChartData = {
  title: string; yLabel: string;
  labels: string[]; series: Series[];           // monthly
  weekLabels: string[]; weekSeries: Series[];    // weekly
};
export type ReportData = {
  kpiCustomers: Kpi[]; kpiCustomersYtd: Kpi[];
  kpiRevenue: Kpi[]; kpiRevenueYtd: Kpi[];
  kpiSubs: Kpi[];
  charts: ChartData[];
};

const MONTHS_SHORT = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
const COLORS = { abo: "#257BB6", online: "#1CBD6B", manuel: "#FFB400", avg: "#9A6324" };
const dkk = (n: number) => `DKK ${n.toLocaleString("da-DK")}`;
const bucket = (sourceType: string) => (sourceType === "subscription" ? "abo" : sourceType === "online" ? "online" : "manuel");
const ymd = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
function mondayOf(d: Date): Date {
  const wd = (d.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - wd * 864e5);
}

type OrderRow = { plannedAt: Date; sourceType: string; contactId: number; tasks: { price: number }[] };
const priceOf = (o: OrderRow) => o.tasks.reduce((a, t) => a + t.price, 0);

/** Customer + revenue KPIs for a given set of orders (window). */
function kpisForOrders(orders: OrderRow[]): { customers: Kpi[]; revenue: Kpi[]; aboRevenue: number; aboCustomers: number; activeMonths: number } {
  const revByType = { abo: 0, online: 0, manuel: 0 } as Record<string, number>;
  const custByType = { abo: new Set<number>(), online: new Set<number>(), manuel: new Set<number>() } as Record<string, Set<number>>;
  const all = new Set<number>();
  const monthsSeen = new Set<string>();
  let total = 0;
  for (const o of orders) {
    const b = bucket(o.sourceType); const p = priceOf(o);
    revByType[b] += p; total += p;
    custByType[b].add(o.contactId); all.add(o.contactId);
    monthsSeen.add(`${o.plannedAt.getUTCFullYear()}-${o.plannedAt.getUTCMonth()}`);
  }
  const customers: Kpi[] = [
    { k: String(all.size), t: "Antal unikke kunder totalt", s: "Unikke kunder med omsætning (udførte ordrer) i perioden" },
    { k: String(custByType.abo.size), t: "Abonnementskunder", s: "Abonnementskunder med omsætning i perioden, inkl. stoppede abonnementer" },
    { k: String(custByType.online.size), t: "Online kunder", s: "Kunder, der har bestilt online og har omsætning i perioden" },
    { k: String(custByType.manuel.size), t: "Manuelt oprettede kunder", s: "Kunder med manuelle ordrer og omsætning i perioden" },
  ];
  const revenue: Kpi[] = [
    { k: dkk(total), t: "Omsætning totalt", s: "Udførte ordrer i perioden — afstemmelig med lønrapporten" },
    { k: dkk(revByType.abo), t: "Omsætning fra abonnementskunder", s: "Udførte ordrer, inkl. stoppede abonnementer" },
    { k: dkk(revByType.online), t: "Omsætning fra online kunder", s: "Fra udførte online ordrer i perioden" },
    { k: dkk(revByType.manuel), t: "Omsætning fra manuelt oprettede kunder", s: "Fra udførte manuelle ordrer i perioden" },
  ];
  return { customers, revenue, aboRevenue: revByType.abo, aboCustomers: custByType.abo.size, activeMonths: monthsSeen.size || 1 };
}

/** Report data for the trailing 12 months ending at the month of `refISO`
 *  (defaults to today in DANSK tid, so the window keeps moving forward — and
 *  kl. 00-02 dansk tid peger "i dag" ikke på gårsdagens UTC-dato). NB: siderne
 *  der kalder os SKAL være dynamiske (`export const dynamic = "force-dynamic"`),
 *  ellers evalueres denne default ved build og fryser vinduet på deploy-dagen. */
export async function getReportData(refISO = todayCphISO()): Promise<ReportData> {
  const ref = new Date(`${refISO}T00:00:00Z`);
  const months = Array.from({ length: 12 }, (_, i) => {
    const d = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() - (11 - i), 1));
    return { year: d.getUTCFullYear(), month: d.getUTCMonth() };
  });
  const labels = months.map((m) => MONTHS_SHORT[m.month]);
  const start = new Date(Date.UTC(months[0].year, months[0].month, 1));
  const end = new Date(Date.UTC(ref.getUTCFullYear(), ref.getUTCMonth() + 1, 1));

  const orders = await prisma.order.findMany({ where: { plannedAt: { gte: start, lt: end } }, include: { tasks: true } });
  const activeSubs = await prisma.subscription.count({ where: { active: true } });

  // Omsætning tæller KUN udførte ordrer — "Sprunget over", "Skal genplanlægges"
  // og fremtidige "Afventer levering" må ikke puste tallene op (lønrapporten
  // regner også kun "Udført", så de to flader stemmer overens).
  const completed = orders.filter((o) => o.status === "Udført");

  const monthIndex = (d: Date) => months.findIndex((m) => m.year === d.getUTCFullYear() && m.month === d.getUTCMonth());

  // Monthly series — omsætning fra udførte; antal/gns. fra alle planlagte.
  const rev = { abo: Array(12).fill(0), online: Array(12).fill(0), manuel: Array(12).fill(0) } as Record<string, number[]>;
  const cnt = { abo: Array(12).fill(0), online: Array(12).fill(0), manuel: Array(12).fill(0) } as Record<string, number[]>;
  const monthlyTotal = Array(12).fill(0) as number[];
  const monthlyOrders = Array(12).fill(0) as number[];
  for (const o of orders) {
    const mi = monthIndex(o.plannedAt); if (mi < 0) continue;
    const b = bucket(o.sourceType); const p = priceOf(o);
    cnt[b][mi] += 1; monthlyTotal[mi] += p; monthlyOrders[mi] += 1;
  }
  for (const o of completed) {
    const mi = monthIndex(o.plannedAt); if (mi < 0) continue;
    rev[bucket(o.sourceType)][mi] += priceOf(o);
  }
  const avgOrderSize = months.map((_, i) => (monthlyOrders[i] ? Math.round(monthlyTotal[i] / monthlyOrders[i]) : 0));

  // Weekly series — the trailing 13 weeks ending at ref.
  const WK = 13;
  const refMonday = mondayOf(ref);
  const weekMondays = Array.from({ length: WK }, (_, i) => new Date(refMonday.getTime() - (WK - 1 - i) * 7 * 864e5));
  const weekLabels = weekMondays.map((m) => `u${isoWeek(ymd(m))}`);
  const weekStart = weekMondays[0].getTime();
  const wIndex = (d: Date) => Math.round((mondayOf(d).getTime() - weekStart) / (7 * 864e5));
  const wrev = { abo: Array(WK).fill(0), online: Array(WK).fill(0), manuel: Array(WK).fill(0) } as Record<string, number[]>;
  const wcnt = { abo: Array(WK).fill(0), online: Array(WK).fill(0), manuel: Array(WK).fill(0) } as Record<string, number[]>;
  const wTotal = Array(WK).fill(0) as number[];
  const wOrders = Array(WK).fill(0) as number[];
  for (const o of orders) {
    const wi = wIndex(o.plannedAt); if (wi < 0 || wi >= WK) continue;
    const b = bucket(o.sourceType); const p = priceOf(o);
    wcnt[b][wi] += 1; wTotal[wi] += p; wOrders[wi] += 1;
  }
  for (const o of completed) {
    const wi = wIndex(o.plannedAt); if (wi < 0 || wi >= WK) continue;
    wrev[bucket(o.sourceType)][wi] += priceOf(o);
  }
  const wAvg = Array.from({ length: WK }, (_, i) => (wOrders[i] ? Math.round(wTotal[i] / wOrders[i]) : 0));

  // KPIs — 12-month vs year-to-date windows (kun udførte ordrer, jf. ovenfor).
  const twelve = kpisForOrders(completed);
  const jan1 = new Date(Date.UTC(ref.getUTCFullYear(), 0, 1));
  // HELE ref-dagen med: ref er dagens 00:00Z, mens plannedAt bærer et klokkeslæt
  // (10:00 UTC) — `<= ref` ville udelade dagens egne ordrer af "År til dato".
  const refEnd = new Date(ref.getTime() + 864e5);
  const ytdOrders = completed.filter((o) => o.plannedAt >= jan1 && o.plannedAt < refEnd);
  const ytd = kpisForOrders(ytdOrders);

  const kpiSubs: Kpi[] = [
    { k: dkk(Math.round(twelve.aboRevenue / twelve.activeMonths)), t: "Gns. månedlig omsætning", s: "Gns. månedlig omsætning fra abonnementskunder" },
    { k: dkk(twelve.aboRevenue), t: "Omsætning fra abonnementer i perioden", s: "I den viste 12-måneders periode" },
    { k: String(activeSubs), t: "Aktive abonnementer", s: "Samlet antal aktive abonnementer" },
    { k: String(twelve.aboCustomers), t: "Abonnementskunder med omsætning", s: "I den viste periode" },
  ];

  const charts: ChartData[] = [
    {
      title: "Omsætning per kundetype (udførte ordrer)", yLabel: "DKK (inkl. moms)", labels, weekLabels,
      series: [
        { name: "Abonnementskunder", color: COLORS.abo, values: rev.abo },
        { name: "Online kunder", color: COLORS.online, values: rev.online },
        { name: "Manuelle kunder", color: COLORS.manuel, values: rev.manuel },
      ],
      weekSeries: [
        { name: "Abonnementskunder", color: COLORS.abo, values: wrev.abo },
        { name: "Online kunder", color: COLORS.online, values: wrev.online },
        { name: "Manuelle kunder", color: COLORS.manuel, values: wrev.manuel },
      ],
    },
    {
      title: "Antal ordrer per kundetype (alle planlagte)", yLabel: "Antal ordrer", labels, weekLabels,
      series: [
        { name: "Abonnementskunder", color: COLORS.abo, values: cnt.abo },
        { name: "Online kunder", color: COLORS.online, values: cnt.online },
        { name: "Manuelle kunder", color: COLORS.manuel, values: cnt.manuel },
      ],
      weekSeries: [
        { name: "Abonnementskunder", color: COLORS.abo, values: wcnt.abo },
        { name: "Online kunder", color: COLORS.online, values: wcnt.online },
        { name: "Manuelle kunder", color: COLORS.manuel, values: wcnt.manuel },
      ],
    },
    {
      title: "Gns. ordrestørrelse for planlagte ordrer", yLabel: "DKK (inkl. moms)", labels, weekLabels,
      series: [{ name: "Gns. ordrestørrelse", color: COLORS.avg, values: avgOrderSize }],
      weekSeries: [{ name: "Gns. ordrestørrelse", color: COLORS.avg, values: wAvg }],
    },
  ];

  return {
    kpiCustomers: twelve.customers, kpiCustomersYtd: ytd.customers,
    kpiRevenue: twelve.revenue, kpiRevenueYtd: ytd.revenue,
    kpiSubs, charts,
  };
}
