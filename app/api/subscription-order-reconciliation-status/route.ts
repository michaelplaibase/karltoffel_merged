import { NextResponse } from "next/server";
import { getSessionUser, unauthorized } from "@/lib/api-auth";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return unauthorized();
  if (!user.isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  const runs = await prisma.orderReconciliationRun.findMany({
    select: {
      id: true, snapshotHash: true, planHash: true, status: true,
      plan: true, createdOrderIds: true, createdAt: true, appliedAt: true, rolledBackAt: true,
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({
    readOnly: true,
    count: runs.length,
    runs: runs.map((run) => {
      const plan = JSON.parse(run.plan) as { summary?: Record<string, number>; actions?: unknown[] };
      const createdOrderIds = JSON.parse(run.createdOrderIds) as number[];
      return {
        id: run.id,
        snapshotHash: run.snapshotHash,
        planHash: run.planHash,
        status: run.status,
        summary: plan.summary ?? null,
        actionCount: plan.actions?.length ?? null,
        createdOrderCount: createdOrderIds.length,
        createdAt: run.createdAt,
        appliedAt: run.appliedAt,
        rolledBackAt: run.rolledBackAt,
      };
    }),
  }, { headers: { "Cache-Control": "no-store, max-age=0", Pragma: "no-cache" } });
}
