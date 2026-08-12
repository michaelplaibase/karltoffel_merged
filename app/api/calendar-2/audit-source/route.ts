import { NextResponse } from "next/server";
import { requireSession, unauthorized } from "@/lib/api-auth";
import { getCalendar2AuditSource } from "@/lib/calendar2-audit-source";

export const dynamic = "force-dynamic";

export async function GET() {
  if ((await requireSession()) == null) return unauthorized();
  return NextResponse.json(await getCalendar2AuditSource(), {
    headers: { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache" },
  });
}