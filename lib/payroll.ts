// Lønrapport: per medarbejder, omsætning af UDFØRTE ordrer i en periode
// (filtreret på plandato), og provision for akkord-folk. Node-only.
import { prisma } from "@/lib/db";

export type PayrollRow = {
  id: number;
  navn: string;
  payModel: "fast" | "akkord";
  antalOrdrer: number;
  omsaetning: number;        // kr, inkl. moms (sum af TaskLine.price)
  commissionPct: number | null;
  provision: number | null;  // akkord: omsætning × pct
  fastLoen: number | null;   // fast: manuelt månedsbeløb
};

export type Payroll = { fromISO: string; toISO: string; rows: PayrollRow[] };

const iso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const valid = (s?: string) => /^\d{4}-\d{2}-\d{2}$/.test(s ?? "");

export async function getPayroll(fromISO?: string, toISO?: string): Promise<Payroll> {
  const now = new Date();
  const from = valid(fromISO) ? fromISO! : iso(new Date(now.getFullYear(), now.getMonth(), 1));
  const to = valid(toISO) ? toISO! : iso(now);
  const fromD = new Date(`${from}T00:00:00Z`);
  const toD = new Date(`${to}T23:59:59.999Z`);

  const users = await prisma.user.findMany({
    orderBy: [{ isAdmin: "desc" }, { username: "asc" }],
    select: { id: true, firstName: true, lastName: true, payModel: true, commissionPct: true, monthlySalary: true },
  });

  // Kun udførte ordrer med en tildelt medarbejder i perioden.
  const orders = await prisma.order.findMany({
    where: { status: "Udført", employeeId: { not: null }, plannedAt: { gte: fromD, lte: toD } },
    select: { employeeId: true, tasks: { select: { price: true } } },
  });

  const agg = new Map<number, { antal: number; oms: number }>();
  for (const o of orders) {
    const eid = o.employeeId as number;
    const oms = o.tasks.reduce((a, t) => a + t.price, 0);
    const cur = agg.get(eid) ?? { antal: 0, oms: 0 };
    cur.antal += 1;
    cur.oms += oms;
    agg.set(eid, cur);
  }

  const rows: PayrollRow[] = users.map((u) => {
    const a = agg.get(u.id) ?? { antal: 0, oms: 0 };
    const model = u.payModel === "akkord" ? "akkord" : "fast";
    const pct = u.commissionPct ?? 40;
    return {
      id: u.id,
      navn: `${u.firstName} ${u.lastName}`.trim(),
      payModel: model,
      antalOrdrer: a.antal,
      omsaetning: a.oms,
      commissionPct: model === "akkord" ? pct : null,
      provision: model === "akkord" ? Math.round((a.oms * pct) / 100) : null,
      fastLoen: model === "fast" ? u.monthlySalary : null,
    };
  });

  return { fromISO: from, toISO: to, rows };
}
