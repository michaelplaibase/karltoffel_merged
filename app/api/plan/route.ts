import { NextResponse } from "next/server";
import { planWeek, isoWeek } from "@/lib/planner";
import { getPlannerJobs } from "@/lib/queries";
import { generateAllSubscriptionOrders } from "@/lib/recurrence";
import { requireSession, unauthorized } from "@/lib/api-auth";

// GET /api/plan?week=YYYY-MM-DD
// The nightly cron (see vercel.json) hits this to (1) materialise upcoming
// subscription orders and (2) re-plan the requested week. Generation is
// idempotent, so extra calls are harmless.
//
// Access: either the Vercel cron (Authorization: Bearer <CRON_SECRET>) or a
// logged-in user. The response is stats-only — no customer names/addresses.
/** Constant-time string compare (avoids leaking the secret via compare timing). */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") || "";
  const isCron = !!cronSecret && auth.startsWith("Bearer ") && safeEqual(auth.slice(7), cronSecret);
  if (!isCron && (await requireSession()) == null) return unauthorized();

  const url = new URL(req.url);
  const week = url.searchParams.get("week") || "2026-06-29";
  const generated = await generateAllSubscriptionOrders();
  const jobs = await getPlannerJobs(week);
  const plan = planWeek(jobs, week);

  return NextResponse.json({
    week: `Uge ${isoWeek(week)} (${plan.weekMonday})`,
    generatedOrders: generated,
    plannedJobs: plan.days.reduce((n, d) => n + d.stops.length, 0),
    unplanned: plan.unplanned.length,
    days: plan.days.map((d) => ({
      employeeId: d.employeeId,
      weekday: ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"][d.weekday],
      driving: `${Math.floor(d.driveMin / 60)} t ${d.driveMin % 60} min`,
      serviceMin: d.serviceMin,
      stops: d.stops.length,
    })),
  });
}
