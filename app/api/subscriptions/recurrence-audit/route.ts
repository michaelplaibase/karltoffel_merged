import { NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/api-auth";
import { auditSubscriptionOrderConsistency } from "@/lib/subscription-order-consistency";

export const dynamic = "force-dynamic";

/** Admin-only, read-only global audit. Applying remediation is deliberately not exposed over HTTP. */
export async function GET(req: Request) {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (!user.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const url = new URL(req.url);
  const horizon = Number(url.searchParams.get("horizonWeeks") ?? 26);
  const plan = await auditSubscriptionOrderConsistency({ horizonWeeks: Number.isFinite(horizon) ? Math.min(104, Math.max(1, horizon)) : 26 });
  return NextResponse.json({
    mode: "dry-run", readOnly: true, generatedAt: new Date().toISOString(),
    summary: { expected: plan.expected.length, create: plan.creates.length, update: plan.updates.length, delete: plan.deletes.length, ignored: plan.ignoredOrders, changes: plan.changes },
    changes: {
      create: plan.creates.map(x => ({ subscriptionId: x.subscriptionId, sourceWeek: x.sourceWeek })),
      update: plan.updates.map(x => ({ orderId: x.orderId, subscriptionId: x.subscriptionId, sourceWeek: x.sourceWeek, lockedFully: x.lockedFully, preservesManualMove: true })),
      delete: plan.deletes,
    },
  }, { headers: { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache" } });
}
