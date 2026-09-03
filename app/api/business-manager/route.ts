// Business Manager API (API-først, Thomas 2026-09-03): JSON-læsning af hele
// regnemotoren. Admin-only (session). GET /api/business-manager?year=&month=
// eller ?from=YYYY-MM-DD&to=YYYY-MM-DD.
import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/api-auth";
import { getBusinessManager } from "@/lib/business-manager";

export async function GET(req: Request) {
  const me = await getSessionUser();
  if (!me) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!me.isAdmin) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const url = new URL(req.url);
  const num = (k: string) => {
    const v = Number(url.searchParams.get(k));
    return Number.isFinite(v) && v > 0 ? v : undefined;
  };
  const fromISO = url.searchParams.get("from") ?? undefined;
  const toISO = url.searchParams.get("to") ?? undefined;

  const data = await getBusinessManager({
    year: num("year"),
    month: num("month"),
    fromISO: fromISO && /^\d{4}-\d{2}-\d{2}$/.test(fromISO) ? fromISO : undefined,
    toISO: toISO && /^\d{4}-\d{2}-\d{2}$/.test(toISO) ? toISO : undefined,
  });
  return NextResponse.json(data);
}
