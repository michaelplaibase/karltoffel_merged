// Business Manager 1.0 — regnemotor (Thomas, 2026-09-03).
// Datadrevet: læser medarbejdere (User), biler (Vehicle), maskiner (Machine),
// budget (Budget) og realiserede tal (udførte/fakturerede ordrer) og beregner
// kostpris pr. time, dækningsbidrag, break-even, budget vs. realiseret og
// afvigelser. Alle beløb i hele kr; timer pr. md som konvention 160 (FTE).
// API-først: alt her kan kaldes fra app/api/business-manager (JSON) og fra
// server-side pages. Node-only (prisma).
import { prisma } from "./db";
import { MOMS } from "./data";
import { getSubscriptionRevenue } from "./subscription-revenue";

export const HOURS_PER_MONTH = 160; // standardnorm: 1 fuldtidsmedarbejder

/** Antal forløbne måneder i et år (til årsresultat "til dato"). */
export function monthsElapsedIn(year: number, now = new Date()): number {
  if (year < now.getFullYear()) return 12;
  if (year > now.getFullYear()) return 0;
  return now.getMonth() + 1;
}

/** Maskinens månedlige afskrivning: indkøbspris / levetid / 12 (0 hvis udefineret). */
export function machineDepreciationMonthly(m: { purchasePrice: number; lifetimeYears: number }): number {
  if (!m.purchasePrice || !m.lifetimeYears || m.lifetimeYears <= 0) return 0;
  return Math.round(m.purchasePrice / m.lifetimeYears / 12);
}

export function vehicleMonthlyCost(v: {
  leaseMonthly: number; insuranceMonthly: number; fuelMonthly: number; serviceMonthly: number; otherMonthly: number;
}): number {
  return v.leaseMonthly + v.insuranceMonthly + v.fuelMonthly + v.serviceMonthly + v.otherMonthly;
}

export function machineMonthlyCost(m: { purchasePrice: number; lifetimeYears: number; serviceMonthly: number; otherMonthly: number }): number {
  return machineDepreciationMonthly(m) + m.serviceMonthly + m.otherMonthly;
}

export type EmployeeCalc = {
  id: number;
  navn: string;
  payModel: "fast" | "akkord";
  subMonthlyKr: number;       // forventet abonnementsomsætning/md (inkl. moms)
  subYearlyKr: number;        // forventet abonnementsomsætning/år (inkl. moms)
  salaryMonthly: number;      // fast løn ELLER akkord-provision på normtid (estimat)
  fixedMonthlyCost: number;   // faste udgifter (voucher, transport osv.)
  shareOfFleetMonthly: number; // biler (tildelt + fordelt) + maskiner fordelt ligeligt
  totalCostMonthly: number;   // samlede månedlige omkostninger
  costPerHour: number;        // kostpris pr. time (total / normtid)
  realisedRevenueMonth: number; // realiseret omsætning inkl. moms (udførte ordrer, DENNE MÅNED)
  realisedRevenueExMoms: number;
  realisedRevenueYear: number;  // realiseret omsætning inkl. moms (udførte ordrer, ÅR til dato)
  coverage: number | null;    // dækningsbidrag kr/md (realiseret ekskl. moms − kostpris), null uden data
  coveragePct: number | null;
  resultatMd: number | null;   // resultat denne måned (ekskl. moms − kostpris), null uden ordrer
  resultatYear: number | null; // resultat år til dato (ekskl. moms − kostpris × måneder forløbet)
  resultatPct: number | null;  // resultat/md som % af omsætningen
  breakEvenHours: number;     // timer pr. md der skal sælges for at kostpris er dækket (bruger timetilknytning)
  breakEvenPricePerHour: number; // Timepris (ekskl. moms) der skal til ved normtid
};

export type BusinessManagerData = {
  hoursPerMonth: number;
  employees: EmployeeCalc[];
  vehicles: { id: number; name: string; active: boolean; monthly: number }[];
  machines: { id: number; name: string; active: boolean; monthly: number; depreciation: number }[];
  fleetMonthlyTotal: number;  // alle aktive biler + maskiner
  companyMonthlyCost: number; // medarbejdere + flåde
  realised: { fromISO: string; toISO: string; revenueInclVat: number; revenueExVat: number; hours: number; revenueInclVatYear: number };
  budget: { year: number; month: number; revenueBudget: number; costBudget: number } | null;
  deviations: Deviation[];
  suggestions: string[];
  companyResultat: { md: number; mdPct: number | null; year: number; yearPct: number | null };
  monthly: { label: string; revenue: number; cost: number; result: number }[];
};

export type Deviation = {
  key: string;
  label: string;
  budget: number;
  actual: number;
  diff: number;      // actual − budget
  diffPct: number;   // diff / budget × 100 (null-safe → 0 ved budget 0)
};

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

export async function getBusinessManager(opts?: { fromISO?: string; toISO?: string; year?: number; month?: number }): Promise<BusinessManagerData> {
  const now = new Date();
  const year = opts?.year ?? now.getFullYear();
  const month = opts?.month ?? now.getMonth() + 1;
  const fromISO = opts?.fromISO ?? iso(new Date(year, month - 1, 1));
  const toISO = opts?.toISO ?? iso(new Date(year, month - 1 + 1, 0)); // sidste dag i måneden

  const fromD = new Date(`${fromISO}T00:00:00.000Z`);
  const toD = new Date(`${toISO}T23:59:59.999Z`);

  const [users, vehicles, machines, orders, ordersYear, budgetRow, subs] = await Promise.all([
    prisma.user.findMany({
      where: { active: true },
      select: { id: true, firstName: true, lastName: true, payModel: true, commissionPct: true, monthlySalary: true, fixedMonthlyCost: true },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
    prisma.vehicle.findMany({ where: { active: true } }),
    prisma.machine.findMany({ where: { active: true } }),
    prisma.order.findMany({
      where: { status: "Udført", plannedAt: { gte: fromD, lte: toD } },
      select: { employeeId: true, tasks: { select: { price: true, durationMin: true } } },
    }),
    prisma.order.findMany({
      where: { status: "Udført", plannedAt: { gte: new Date(Date.UTC(year, 0, 1)), lte: toD } },
      select: { employeeId: true, plannedAt: true, tasks: { select: { price: true } } },
    }),
    prisma.budget.findUnique({
      where: { companyId_year_month: { companyId: 1, year, month } },
    }).catch(() => null),
    prisma.subscription.findMany({
      where: { active: true, pending: false },
      select: { fixedEmployee: true, baseInterval: true, tasks: { select: { price: true, intervalMultiplier: true, pauseActive: true, pauseStart: true, pauseEnd: true, pauseYearly: true } } },
    }),
  ]);

  // Abonnementsomsætning pr. fast medarbejder: hentes fra lib/subscription-revenue
  // (SAMME kilde som det gamle Omsætningsoverblik — tallene er dermed identiske).
  const subRev = await getSubscriptionRevenue();
  const subMonthlyByName = new Map(subRev.byEmployee.map((e) => [e.employee, e.monthlyKr]));
  const subYearlyByName = new Map(subRev.byEmployee.map((e) => [e.employee, e.yearlyKr]));

  const monthsElapsed = monthsElapsedIn(year);
  const nEmployees = Math.max(1, users.length);
  const machinesMonthly = machines.reduce((a, m) => a + machineMonthlyCost(m), 0);
  const machinesPerEmployee = Math.round(machinesMonthly / nEmployees);

  // Biler: en bil med tildelt medarbejder myntes på DEN medarbejder; ellers
  // fordeles den ligeligt på alle aktive (samme som maskiner).
  const unassignedVehicleMonthly = vehicles
    .filter((v) => v.userId == null)
    .reduce((a, v) => a + vehicleMonthlyCost(v), 0);
  const unassignedPerEmployee = Math.round(unassignedVehicleMonthly / nEmployees);
  const assignedVehicleByUser = new Map<number, number>();
  for (const v of vehicles) {
    if (v.userId == null) continue;
    assignedVehicleByUser.set(v.userId, (assignedVehicleByUser.get(v.userId) ?? 0) + vehicleMonthlyCost(v));
  }
  const fleetFor = (userId: number) =>
    (assignedVehicleByUser.get(userId) ?? 0) + unassignedPerEmployee + machinesPerEmployee;
  const fleetMonthly = vehicles.reduce((a, v) => a + vehicleMonthlyCost(v), 0) + machinesMonthly;

  // Realiseret pr. medarbejder (udførte ordrer i perioden) + timer.
  const realByEmp = new Map<number, { revenue: number; minutes: number; orders: number }>();
  let totalRevenue = 0;
  let totalMinutes = 0;
  for (const o of orders) {
    const revenue = o.tasks.reduce((a, t) => a + t.price, 0);
    const minutes = o.tasks.reduce((a, t) => a + (t.durationMin || 0), 0);
    totalRevenue += revenue;
    totalMinutes += minutes;
    if (o.employeeId == null) continue;
    const cur = realByEmp.get(o.employeeId) ?? { revenue: 0, minutes: 0, orders: 0 };
    cur.revenue += revenue; cur.minutes += minutes; cur.orders += 1;
    realByEmp.set(o.employeeId, cur);
  }

  const yearByEmp = new Map<number, number>();
  let yearTotal = 0;
  for (const o of ordersYear) {
    const rev = o.tasks.reduce((a, t) => a + t.price, 0);
    yearTotal += rev;
    if (o.employeeId == null) continue;
    yearByEmp.set(o.employeeId, (yearByEmp.get(o.employeeId) ?? 0) + rev);
  }

  const employees: EmployeeCalc[] = users.map((u) => {
    const payModel = u.payModel === "akkord" ? "akkord" : "fast";
    const salaryMonthly = payModel === "fast"
      ? (u.monthlySalary ?? 0)
      : Math.round((HOURS_PER_MONTH * 300 * (u.commissionPct ?? 43)) / 100); // akkord-estimat: 300 kr/time ekskl. moms × sats på normtid
    const fixedMonthlyCost = u.fixedMonthlyCost ?? 0;
    const shareOfFleetMonthly = fleetFor(u.id);
    const totalCostMonthly = salaryMonthly + fixedMonthlyCost + shareOfFleetMonthly;
    const r = realByEmp.get(u.id);
    const realisedEx = r ? Math.round(r.revenue / (1 + MOMS)) : 0;
    const coverage = r ? realisedEx - totalCostMonthly : null;
    return {
      id: u.id,
      navn: `${u.firstName} ${u.lastName}`.trim(),
      payModel,
      subYearlyKr: subYearlyByName.get(`${u.firstName} ${u.lastName}`.trim()) ?? 0,
      subMonthlyKr: subMonthlyByName.get(`${u.firstName} ${u.lastName}`.trim()) ?? 0,
      salaryMonthly,
      fixedMonthlyCost,
      shareOfFleetMonthly,
      totalCostMonthly,
      costPerHour: Math.round(totalCostMonthly / HOURS_PER_MONTH),
      realisedRevenueMonth: r?.revenue ?? 0,
      realisedRevenueExMoms: realisedEx,
      realisedRevenueYear: yearByEmp.get(u.id) ?? 0,
      coverage,
      coveragePct: r && realisedEx > 0 ? Math.round((coverage! / realisedEx) * 100) : null,
      resultatMd: r ? realisedEx - totalCostMonthly : null,
      resultatYear: (r || yearByEmp.get(u.id)) ? Math.round(yearByEmp.get(u.id) ?? 0) / (1 + MOMS) - totalCostMonthly * monthsElapsed : null,
      resultatPct: r && realisedEx > 0 ? Math.round(((realisedEx - totalCostMonthly) / realisedEx) * 100) : null,
      breakEvenHours: totalCostMonthly > 0 && r && r.minutes > 0
        ? Math.ceil(totalCostMonthly / (realisedEx / (r.minutes / 60)))
        : (totalCostMonthly > 0 ? Math.ceil(totalCostMonthly / 300) : 0),
      breakEvenPricePerHour: Math.round(totalCostMonthly / HOURS_PER_MONTH / 0.8), // 20 % dækningsmål → timepris ekskl. moms
    };
  });

  const realised = {
    fromISO, toISO,
    revenueInclVat: totalRevenue,
    revenueExVat: Math.round(totalRevenue / (1 + MOMS)),
    hours: Math.round((totalMinutes / 60) * 10) / 10,
    revenueInclVatYear: yearTotal,
  };

  const companyMonthlyCost = employees.reduce((a, e) => a + e.totalCostMonthly, 0);
  const companyResultatMd = realised.revenueExVat - companyMonthlyCost;
  const companyResultatYear = Math.round(realised.revenueInclVatYear / (1 + MOMS)) - companyMonthlyCost * monthsElapsed;

  const revenueBudget = budgetRow?.revenueBudget ?? 0;
  const costBudget = budgetRow?.costBudget ?? 0;
  const deviations: Deviation[] = [];
  if (budgetRow) {
    deviations.push({
      key: "revenue", label: "Omsætning (inkl. moms)",
      budget: revenueBudget, actual: realised.revenueInclVat,
      diff: realised.revenueInclVat - revenueBudget,
      diffPct: revenueBudget > 0 ? Math.round(((realised.revenueInclVat - revenueBudget) / revenueBudget) * 100) : 0,
    });
    deviations.push({
      key: "cost", label: "Omkostninger (løn + flåde)",
      budget: costBudget, actual: companyMonthlyCost,
      diff: companyMonthlyCost - costBudget,
      diffPct: costBudget > 0 ? Math.round(((companyMonthlyCost - costBudget) / costBudget) * 100) : 0,
    });
    deviations.push({
      key: "coverage", label: "Dækningsbidrag",
      budget: revenueBudget - costBudget, actual: realised.revenueExVat - companyMonthlyCost,
      diff: (realised.revenueExVat - companyMonthlyCost) - (revenueBudget - costBudget),
      diffPct: (revenueBudget - costBudget) > 0
        ? Math.round((((realised.revenueExVat - companyMonthlyCost) - (revenueBudget - costBudget)) / (revenueBudget - costBudget)) * 100)
        : 0,
    });
  }

  // Månedsserie til grafer: realiseret omsætning (ekskl. moms) pr. måned i det
  // viste år fra udførte ordrer; omkostninger = nutidens niveau (lønnene i CRM
  // er aktuelle — historiske løndata findes ikke).
  const monthRevenue = new Array(12).fill(0) as number[];
  for (const o of ordersYear) {
    const m = new Date(o.plannedAt).getUTCMonth();
    monthRevenue[m] += o.tasks.reduce((a, t) => a + t.price, 0);
  }
  const MONTH_LABELS = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
  const monthly = MONTH_LABELS.map((label, i) => {
    const revenueExVat = Math.round(monthRevenue[i] / (1 + MOMS));
    return {
      label,
      revenue: revenueExVat,
      cost: companyMonthlyCost,
      result: revenueExVat - companyMonthlyCost,
    };
  });

  // --- Beslutningsforslag (regelbaseret, AI kan udvides) ---
  const suggestions: string[] = [];
  for (const e of employees) {
    if (e.coverage != null && e.coverage < 0) {
      suggestions.push(`${e.navn} koster mere end vedkommende tjener ind i perioden (dækning ${e.coverage.toLocaleString("da-DK")} kr/md). Overvej flere opgaver, højere timepris eller færre faste udgifter.`);
    } else if (e.coverage != null && e.coveragePct != null && e.coveragePct < 20) {
      suggestions.push(`${e.navn}s dækningsgrad er kun ${e.coveragePct} % — under de 20 %, der typisk skal til for at bære risiko og ferie.`);
    }
  }
  const hoursTotal = employees.reduce((a, e) => a + e.realisedRevenueMonth, 0);
  if (realised.hours > 0 && realised.revenueExVat / realised.hours < 250) {
    suggestions.push(`Timeindtægten (ekskl. moms) er i snit ${Math.round(realised.revenueExVat / realised.hours)} kr/time i perioden — under 250 kr/times tommelfingerregel. Tjek priser og fremdrift.`);
  }
  if (budgetRow && deviations[0] && deviations[0].diff < 0) {
    suggestions.push(`Omsætningen ligger ${Math.abs(deviations[0].diff).toLocaleString("da-DK")} kr under budget for ${String(month).padStart(2, "0")}-${year} (${deviations[0].diffPct} %).`);
  }
  if (suggestions.length === 0) suggestions.push("Ingen advarsler — tallene ser sunde ud i perioden.");

  return {
    hoursPerMonth: HOURS_PER_MONTH,
    employees,
    vehicles: vehicles.map((v) => ({ id: v.id, name: v.name, active: v.active, monthly: vehicleMonthlyCost(v) })),
    machines: machines.map((m) => ({ id: m.id, name: m.name, active: m.active, monthly: machineMonthlyCost(m), depreciation: machineDepreciationMonthly(m) })),
    fleetMonthlyTotal: fleetMonthly,
    companyMonthlyCost,
    realised,
    budget: budgetRow ? { year, month, revenueBudget, costBudget } : null,
    deviations,
    suggestions,
    companyResultat: {
      md: companyResultatMd,
      mdPct: realised.revenueExVat > 0 ? Math.round((companyResultatMd / realised.revenueExVat) * 100) : null,
      year: companyResultatYear,
      yearPct: monthsElapsed > 0 ? Math.round((companyResultatYear / Math.max(1, Math.round(realised.revenueInclVatYear / (1 + MOMS)))) * 100) : null,
    },
    monthly,
  };
}
