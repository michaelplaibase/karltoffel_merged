import { prisma } from "@/lib/db";
import { requireSession, unauthorized } from "@/lib/api-auth";

// Subscription report (CSV) — the "Hent rapport" button under "Hent abonnementer"
// on /reports/download. Exports all active subscriptions.

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export async function GET() {
  if ((await requireSession()) == null) return unauthorized();
  const subs = await prisma.subscription.findMany({
    where: { active: true },
    include: { tasks: true, contact: true },
    orderBy: { displayNo: "desc" },
  });

  const header = ["Abo. nr.", "Kunde", "Leveringsadresse", "Interval", "Opgaver", "Pris (inkl. moms)", "Fast medarb.", "Næste uge"];
  const rows = subs.map((s) => [
    s.displayNo, s.contact.name, s.deliveryAddress, s.baseInterval,
    s.tasks.map((t) => t.description).join(" | "),
    s.tasks.reduce((a, t) => a + t.price, 0),
    s.fixedEmployee, s.nextWeek ?? "",
  ]);

  const csv = "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(";")).join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="abonnementer.csv"`,
    },
  });
}
