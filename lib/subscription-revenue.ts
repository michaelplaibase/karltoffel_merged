// Abonnements-omsætningspanel — regner månedlig + årlig forventet omsætning
// ud fra de samme rytmeregler som ordregenereringen (lib/recurrence.ts):
// opgavens pris × frekvens = basisinterval × intervalmultipliker.
// "På anmodning"-opgaver og opgaver i deres pausevindue tæller ikke med
// (pause prækorrigeres uge for uge over et helt år, samme wrap-regler som
// isPausedOn i recurrence). Priser er inkl. moms i hele kr (TaskLine.price),
// så månedsbeløbet afrundes med øre via formateringen i panelet.
// Server-only (Node) — bruges af abonnementsoversigten.
import { prisma } from "./db";

const WEEKS_PER_YEAR = 52;
const MONTHS_PER_YEAR = 12;

/** "Hver uge" → 1, "Hver 2. uge" → 2, … (samme fallback som recurrence). */
function parseBaseInterval(label: string): number {
  const m = label.match(/Hver\s+(\d+)\.\s*uge/i);
  return m ? Math.max(1, Number(m[1])) : 1;
}

/** "Hver gang" → 1, "Hver 2. gang (hver 4. uge)" → 2, "På anmodning" → null. */
function parseMultiplier(label: string | null): number | null {
  if (!label) return 1;
  if (/anmodning/i.test(label)) return null;
  const m = label.match(/Hver\s+(\d+)\.\s*gang/i);
  return m ? Math.max(1, Number(m[1])) : 1;
}

/** Er `iso` (YYYY-MM-DD) inden for opgavens pausevindue (krydser gerne nytår)? */
function isPausedOn(t: { pauseActive: boolean; pauseStart: string | null; pauseEnd: string | null; pauseYearly: boolean }, iso: string): boolean {
  if (!t.pauseActive || !t.pauseStart || !t.pauseEnd) return false;
  const mmdd = iso.slice(5);
  if (t.pauseYearly) {
    const s = t.pauseStart.slice(5), e = t.pauseEnd.slice(5);
    return s <= e ? mmdd >= s && mmdd <= e : mmdd >= s || mmdd <= e;
  }
  return iso >= t.pauseStart && iso <= t.pauseEnd;
}

export type SubscriptionRevenue = {
  /** Antal aktive abonnementer (ikke afventende). */
  activeCount: number;
  /** Antal afventende abonnementer (pris endnu ikke bekræftet). */
  pendingCount: number;
  /** Månedlig forventet omsætning fra aktive abonnementer, kr inkl. moms. */
  monthlyKr: number;
  /** Årlig forventet omsætning fra aktive abonnementer, kr inkl. moms. */
  yearlyKr: number;
  /** Samme som monthlyKr for de afventende abonnementer (potentiale). */
  pendingMonthlyKr: number;
  /** Gennemsnitlig månedlig omsætning pr. aktivt abonnement (0 hvis ingen). */
  avgPerSubscriptionKr: number;
  /** Månedlig/årlig forventet omsætning pr. fast medarbejder, faldende sorteret. */
  byEmployee: {
    employee: string;
    monthlyKr: number;
    yearlyKr: number;
    salaryMonthlyKr: number | null;   // akkord: provision (kr/md, samme grundlag som lønrapporten); fast: fast månedsløn
    fixedMonthlyCostKr: number | null; // faste udgifter tastes pr. medarbejder under brugerstyring
  }[];
};

type SubRow = {
  baseInterval: string;
  fixedEmployee: string;
  tasks: {
    price: number;
    intervalMultiplier: string | null;
    pauseActive: boolean;
    pauseStart: string | null;
    pauseEnd: string | null;
    pauseYearly: boolean;
  }[];
};

/** Årlig omsætning for én abonnementsopgave, kr inkl. moms (0 ved pauser/på anmodning). */
function taskYearlyKr(sub: SubRow, t: SubRow["tasks"][number]): number {
  const m = parseMultiplier(t.intervalMultiplier);
  if (m == null) return 0; // "På anmodning" er ikke planlagt arbejde
  const stepWeeks = parseBaseInterval(sub.baseInterval) * m;
  // Andel af årets uger hvor opgaven KØRER (pausevinduer wrap-bevidst trukket fra).
  const today = new Date();
  const iso = (d: Date) => d.toISOString().slice(0, 10);
  let activeWeeks = 0;
  for (let w = 0; w < WEEKS_PER_YEAR; w++) {
    const d = new Date(Date.UTC(today.getUTCFullYear(), 0, 1) + w * 7 * 864e5);
    if (!isPausedOn(t, iso(d))) activeWeeks++;
  }
  return (t.price * activeWeeks) / stepWeeks;
}

function sumYearlyKr(subs: SubRow[]): number {
  return subs.reduce((sum, s) => sum + s.tasks.reduce((n, t) => n + taskYearlyKr(s, t), 0), 0);
}

export async function getSubscriptionRevenue(): Promise<SubscriptionRevenue> {
  const rows = await prisma.subscription.findMany({
    where: { OR: [{ active: true }, { pending: true }] },
    select: {
      pending: true,
      baseInterval: true,
      fixedEmployee: true,
      tasks: {
        select: { price: true, intervalMultiplier: true, pauseActive: true, pauseStart: true, pauseEnd: true, pauseYearly: true },
      },
    },
  });
  const active = rows.filter((r) => !r.pending);
  const pending = rows.filter((r) => r.pending);
  const yearlyKr = sumYearlyKr(active);
  const pendingYearlyKr = sumYearlyKr(pending);
  // Pr. fast medarbejder (samme rytmeregler) — "Ingen" grupperes som ikke-tildelt.
  const byEmployeeMap = new Map<string, number>();
  for (const sub of active) {
    const key = sub.fixedEmployee || "Ingen";
    byEmployeeMap.set(key, (byEmployeeMap.get(key) ?? 0) + sumYearlyKr([sub]));
  }

  // Løn + faste udgifter pr. medarbejder (User.payModel/monthlySalary/commissionPct/
  // fixedMonthlyCost, sat under brugerstyring). Akkord-provision omregnes til et
  // månedsniveau ud fra MEDARBEJDERENS forventede abonnementsomsætning (samme
  // grundlag som lønrapporten: omsætning ekskl. moms × sats).
  const MOMS = 1.25;
  const users = await prisma.user.findMany({
    where: { active: true },
    select: { firstName: true, lastName: true, payModel: true, commissionPct: true, monthlySalary: true, fixedMonthlyCost: true },
  });
  const payByName = new Map(users.map((u) => [`${u.firstName} ${u.lastName}`.trim(), u]));
  const DEFAULT_COMMISSION_PCT = 43;
  const byEmployee = [...byEmployeeMap.entries()]
    .map(([employee, empYearly]) => {
      const u = payByName.get(employee);
      const monthly = empYearly / MONTHS_PER_YEAR;
      let salary: number | null = null;
      if (u) {
        if (u.payModel === "akkord") salary = Math.round((monthly / MOMS) * (u.commissionPct ?? DEFAULT_COMMISSION_PCT)) / 100;
        else salary = u.monthlySalary;
      }
      return {
        employee,
        monthlyKr: monthly,
        yearlyKr: empYearly,
        salaryMonthlyKr: salary,
        fixedMonthlyCostKr: u?.fixedMonthlyCost ?? null,
      };
    })
    .sort((a, b) => b.monthlyKr - a.monthlyKr);
  return {
    activeCount: active.length,
    pendingCount: pending.length,
    monthlyKr: yearlyKr / MONTHS_PER_YEAR,
    yearlyKr,
    pendingMonthlyKr: pendingYearlyKr / MONTHS_PER_YEAR,
    avgPerSubscriptionKr: active.length ? yearlyKr / active.length / MONTHS_PER_YEAR : 0,
    byEmployee,
  };
}
