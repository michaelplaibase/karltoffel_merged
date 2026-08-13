import { NextRequest, NextResponse } from "next/server";
import { requireSession, unauthorized } from "@/lib/api-auth";
import { getSubscriptionOrderAudit } from "@/lib/subscription-order-audit";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if ((await requireSession()) == null) return unauthorized();
  const rawWeeks = Number(request.nextUrl.searchParams.get("weeks") ?? 26);
  const horizonWeeks = Number.isInteger(rawWeeks) && rawWeeks >= 1 && rawWeeks <= 104 ? rawWeeks : 26;
  const rawFrom = request.nextUrl.searchParams.get("from");
  const parsedFrom = rawFrom && /^\d{4}-\d{2}-\d{2}$/.test(rawFrom) ? new Date(`${rawFrom}T00:00:00Z`) : new Date();
  const referenceDate = Number.isNaN(parsedFrom.getTime()) ? new Date() : parsedFrom;
  return NextResponse.json(await getSubscriptionOrderAudit(referenceDate, horizonWeeks), {
    headers: { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache" },
  });
}
