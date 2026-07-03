import { NextResponse } from "next/server";
import { planWeek, fmtTime, isoWeek } from "@/lib/planner";
import { getPlannerJobs } from "@/lib/queries";

// GET /api/plan?week=YYYY-MM-DD
// Runs the weekly auto-planner and returns the routed, time-slotted schedule.
// A nightly cron hits this (see vercel.json) to re-plan every week.
export async function GET(req: Request) {
  const url = new URL(req.url);
  const week = url.searchParams.get("week") || "2026-06-29";
  const jobs = await getPlannerJobs(week);
  const plan = planWeek(jobs, week);

  return NextResponse.json({
    week: `Uge ${isoWeek(week)} (${plan.weekMonday})`,
    plannedJobs: plan.days.reduce((n, d) => n + d.stops.length, 0),
    unplanned: plan.unplanned.map((j) => j.customer),
    days: plan.days.map((d) => ({
      employeeId: d.employeeId,
      weekday: ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"][d.weekday],
      driving: `${Math.floor(d.driveMin / 60)} t ${d.driveMin % 60} min`,
      serviceMin: d.serviceMin,
      stops: d.stops.map((s) => ({
        order: s.job.id,
        customer: s.job.customer,
        address: s.job.address,
        from: fmtTime(s.startMin),
        to: fmtTime(s.endMin),
        driveMin: s.driveMin,
        source: s.job.source,
      })),
    })),
  });
}
