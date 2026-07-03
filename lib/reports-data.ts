// Live reporting data derived from the database (KPIs + monthly chart series).
// Kept in its own module (not lib/queries.ts) so the reporting pages own their
// aggregation. All amounts are DKK incl. VAT.
import { prisma } from "./db";

export type Kpi = { k: string; t: string; s?: string };
export type Series = { name: string; color: string; values: number[] };

// Static legend for the customer map (the map itself is a later enhancement).
export const MAP_LEGEND = {
  title: "Kort over kunder med omsætning de sidste 12 mdr.",
  property: ["Lejlighed", "Hus", "Rækkehus", "Ukendt"],
  revenue: ["$ 0-500 DKK", "$$ 500-1000 DKK", "$$$ 1000+ DKK"],
};

export type ChartData = { title: string; yLabel: string; labels: string[]; series: Series[] };
export type ReportData = {
  kpiCustomers: Kpi[];
  kpiRevenue: Kpi[];
  kpiSubs: Kpi[];
  charts: ChartData[];
};

const MONTHS_SHORT = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
const COLORS = { abo: "#257BB6", online: "#1CBD6B", manuel: "#FFB400", avg: "#9A6324" };
const dkk = (n: number) => `DKK ${n.toLocaleString("da-DK")}`;
const bucket = (sourceType: string) => (sourceType === "subscription" ? "abo" : sourceType === "online" ? "online" : "manuel");

/** Report data for the trailing 12 months ending at the month of `refISO`. */
export async function getReportData(refISO = "2026-07-15"): Promise<ReportData> {
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

  const monthIndex = (d: Date) => months.findIndex((m) => m.year === d.getUTCFullYear() && m.month === d.getUTCMonth());
  const priceOf = (o: (typeof orders)[number]) => o.tasks.reduce((a, t) => a + t.price, 0);

  const rev = { abo: Array(12).fill(0), online: Array(12).fill(0), manuel: Array(12).fill(0) } as Record<string, number[]>;
  const cnt = { abo: Array(12).fill(0), online: Array(12).fill(0), manuel: Array(12).fill(0) } as Record<string, number[]>;
  const monthlyTotal = Array(12).fill(0) as number[];
  const monthlyOrders = Array(12).fill(0) as number[];
  const customersByType = { abo: new Set<number>(), online: new Set<number>(), manuel: new Set<number>() } as Record<string, Set<number>>;
  const allCustomers = new Set<number>();

  for (const o of orders) {
    const mi = monthIndex(o.plannedAt);
    if (mi < 0) continue;
    const b = bucket(o.sourceType);
    const p = priceOf(o);
    rev[b][mi] += p; cnt[b][mi] += 1;
    monthlyTotal[mi] += p; monthlyOrders[mi] += 1;
    customersByType[b].add(o.contactId); allCustomers.add(o.contactId);
  }

  const totalRevenue = monthlyTotal.reduce((a, b) => a + b, 0);
  const revByType = (b: string) => rev[b].reduce((a, x) => a + x, 0);
  const avgOrderSize = months.map((_, i) => (monthlyOrders[i] ? Math.round(monthlyTotal[i] / monthlyOrders[i]) : 0));

  const kpiCustomers: Kpi[] = [
    { k: String(allCustomers.size), t: "Antal unikke kunder totalt", s: "Unikke kunder med omsætning i perioden" },
    { k: String(customersByType.abo.size), t: "Abonnementskunder", s: "Abonnementskunder med omsætning i perioden, inkl. stoppede abonnementer" },
    { k: String(customersByType.online.size), t: "Online kunder", s: "Kunder, der har bestilt online og har omsætning i perioden" },
    { k: String(customersByType.manuel.size), t: "Manuelt oprettede kunder", s: "Kunder med manuelle ordrer og omsætning i perioden" },
  ];
  const kpiRevenue: Kpi[] = [
    { k: dkk(totalRevenue), t: "Omsætning totalt", s: "Omsætning fra alle kundetyper i perioden" },
    { k: dkk(revByType("abo")), t: "Omsætning fra abonnementskunder", s: "Inkl. stoppede abonnementer" },
    { k: dkk(revByType("online")), t: "Omsætning fra online kunder", s: "Fra online ordrer i perioden" },
    { k: dkk(revByType("manuel")), t: "Omsætning fra manuelt oprettede kunder", s: "Fra manuelle ordrer i perioden" },
  ];
  const activeMonths = monthlyTotal.filter((x) => x > 0).length || 1;
  const kpiSubs: Kpi[] = [
    { k: dkk(Math.round(revByType("abo") / activeMonths)), t: "Gns. månedlig omsætning", s: "Gns. månedlig omsætning fra abonnementskunder" },
    { k: dkk(revByType("abo")), t: "Omsætning fra abonnementer i perioden", s: "I den viste 12-måneders periode" },
    { k: String(activeSubs), t: "Aktive abonnementer", s: "Samlet antal aktive abonnementer" },
    { k: String(customersByType.abo.size), t: "Abonnementskunder med omsætning", s: "I den viste periode" },
  ];

  const charts: ChartData[] = [
    {
      title: "Omsætning per kundetype", yLabel: "DKK (inkl. moms)", labels,
      series: [
        { name: "Abonnementskunder", color: COLORS.abo, values: rev.abo },
        { name: "Online kunder", color: COLORS.online, values: rev.online },
        { name: "Manuelle kunder", color: COLORS.manuel, values: rev.manuel },
      ],
    },
    {
      title: "Antal ordrer per kundetype", yLabel: "Antal ordrer", labels,
      series: [
        { name: "Abonnementskunder", color: COLORS.abo, values: cnt.abo },
        { name: "Online kunder", color: COLORS.online, values: cnt.online },
        { name: "Manuelle kunder", color: COLORS.manuel, values: cnt.manuel },
      ],
    },
    {
      title: "Gns. ordrestørrelse for planlagte ordrer", yLabel: "DKK (inkl. moms)", labels,
      series: [{ name: "Gns. ordrestørrelse", color: COLORS.avg, values: avgOrderSize }],
    },
  ];

  return { kpiCustomers, kpiRevenue, kpiSubs, charts };
}
