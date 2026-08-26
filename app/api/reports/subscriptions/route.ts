import { prisma } from "@/lib/db";
import { getSessionUser, unauthorized } from "@/lib/api-auth";

// Subscription report (CSV) — the "Hent rapport" button under "Hent abonnementer"
// on /reports/download. Exports all active subscriptions.
// Admin-only: eksporten dækker ALLE kunders navne og adresser (samme produkt-
// regel som lønrapporten/kalenderen — en medarbejder ser kun eget).

function csvCell(v: string | number): string {
  let s = String(v);
  // Excel-formel-injektion: brugerindtastede celler (kundenavn/adresse/opgaver)
  // der starter med = + - eller @ prefikses med apostrof, så Excel læser dem som
  // tekst — tal fra vores egne felter kan ikke bære formler og røres ikke.
  if (typeof v === "string" && /^[=+\-@]/.test(s)) s = `'${s}`;
  return /[",\n\r;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function forbidden(): Response {
  return new Response(JSON.stringify({ error: "Kun administratorer har adgang til rapporter." }), {
    status: 403,
    headers: { "content-type": "application/json" },
  });
}

export async function GET() {
  const me = await getSessionUser();
  if (me == null) return unauthorized();
  if (!me.isAdmin) return forbidden();
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
