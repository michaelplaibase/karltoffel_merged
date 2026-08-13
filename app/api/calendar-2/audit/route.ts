import { NextRequest, NextResponse } from "next/server";
import { requireSession, unauthorized } from "@/lib/api-auth";
import { getCalendar2HorizonAudit } from "@/lib/subscription-preview-calendar";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if ((await requireSession()) == null) return unauthorized();
  const rawWeeks = Number(request.nextUrl.searchParams.get("weeks") ?? 26);
  const weeks = Number.isInteger(rawWeeks) ? Math.min(26, Math.max(1, rawWeeks)) : 26;
  return NextResponse.json(await getCalendar2HorizonAudit(weeks), {
    headers: { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache" },
  });
}
