import { prisma } from "@/lib/db";
import { requireSession, unauthorized } from "@/lib/api-auth";
import type { NextRequest } from "next/server";

// Order report (CSV, Excel-openable) for a date range — the "Hent rapport"
// button on /reports/download. Streams a UTF-8 BOM CSV as a file download.

function csvCell(v: string | number): string {
  const s = String(v);
  return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
function ymd(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export async function GET(req: NextRequest) {
  if ((await requireSession()) == null) return unauthorized();
  const sp = req.nextUrl.searchParams;
  const startStr = sp.get("start");
  const endStr = sp.get("end");
  const start = startStr ? new Date(`${startStr}T00:00:00Z`) : new Date(Date.UTC(1970, 0, 1));
  const end = endStr ? new Date(`${endStr}T23:59:59Z`) : new Date(Date.UTC(2100, 0, 1));

  const orders = await prisma.order.findMany({
    where: { plannedAt: { gte: start, lte: end } },
    include: { tasks: true, contact: true, subscription: true },
    orderBy: { plannedAt: "asc" },
  });

  const header = ["Ordrenr", "Leveringsdato", "Kunde", "Leveringsadresse", "Opgaver", "Pris (inkl. moms)", "Status", "Kilde"];
  const rows = orders.map((o) => [
    o.id, ymd(o.plannedAt), o.contact.name, o.deliveryAddress,
    o.tasks.map((t) => t.description).join(" | "),
    o.tasks.reduce((a, t) => a + t.price, 0),
    o.status,
    o.subscription ? `Abo. #${o.subscription.displayNo}` : o.sourceType === "online" ? "Online ordre" : o.sourceType === "fixed" ? "Fastprisaftale" : "Manuel ordre",
  ]);

  const csv = "﻿" + [header, ...rows].map((r) => r.map(csvCell).join(";")).join("\r\n");
  const fname = `ordrerapport_${startStr ?? "alle"}_${endStr ?? "alle"}.csv`;
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${fname}"`,
    },
  });
}
