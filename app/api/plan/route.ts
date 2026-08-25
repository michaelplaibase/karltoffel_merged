import { NextResponse } from "next/server";
import { isoWeek } from "@/lib/planner";
import { planAndPersistWeek } from "@/lib/queries";
import { generateAllSubscriptionOrders } from "@/lib/recurrence";
import { requireSession, unauthorized } from "@/lib/api-auth";
import { weekMondayToday } from "@/lib/calendar";

// GET /api/plan?week=YYYY-MM-DD
// The nightly cron (see vercel.json) hits this to (1) materialise upcoming
// subscription orders and (2) re-plan. With ?week only that single week is
// planned; UDEN ?week (cron-tilfældet) planlægges indeværende + de næste 25
// uger — samme horisont som genereringen (DEFAULT_HORIZON_WEEKS = 26 i
// lib/recurrence.ts). Ellers persisteredes kun DENNE uges rutede dag/tid, og
// ordrelisterne viste placeholder-mandagen for alle senere uger, mens
// kalenderen viste den rutede ugedag. Generation is idempotent, so extra
// calls are harmless.
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
  const weekParam = url.searchParams.get("week");
  const generated = await generateAllSubscriptionOrders();

  if (weekParam) {
    // Enkelt-uge (manuel kørsel/debug): uændret adfærd og respons-form.
    // Samme pipeline som kalenderen (buildWeekPlan) — og persister det beregnede
    // dag/tidspunkt/medarbejder på ordren, så lister/PDF/påmindelser matcher.
    const wp = await planAndPersistWeek(weekParam);
    const plan = wp.plan;
    return NextResponse.json({
      week: `Uge ${isoWeek(weekParam)} (${plan.weekMonday})`,
      generatedOrders: generated,
      plannedJobs: plan.days.reduce((n, d) => n + d.stops.length, 0),
      unplanned: wp.unplanned.length,
      days: plan.days.map((d) => ({
        employeeId: d.employeeId,
        weekday: ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"][d.weekday],
        driving: `${Math.floor(d.driveMin / 60)} t ${d.driveMin % 60} min`,
        serviceMin: d.serviceMin,
        stops: d.stops.length,
      })),
    });
  }

  // Nat-cronen (uden ?week): planlæg + persister HELE genererings-horisonten,
  // startende fra DENNE uge (ikke en frossen demo-uge).
  const start = weekMondayToday();
  const weeks: { week: string; plannedJobs: number; unplanned: number }[] = [];
  for (let i = 0; i < HORIZON_WEEKS; i++) {
    const monday = addWeeksISO(start, i);
    const wp = await planAndPersistWeek(monday);
    weeks.push({
      week: `Uge ${isoWeek(monday)} (${monday})`,
      plannedJobs: wp.plan.days.reduce((n, d) => n + d.stops.length, 0),
      unplanned: wp.unplanned.length,
    });
  }
  return NextResponse.json({
    generatedOrders: generated,
    weeksPlanned: weeks.length,
    plannedJobs: weeks.reduce((n, w) => n + w.plannedJobs, 0),
    unplanned: weeks.reduce((n, w) => n + w.unplanned, 0),
    weeks,
  });
}

/** Samme horisont som ordre-genereringen (DEFAULT_HORIZON_WEEKS, lib/recurrence.ts). */
const HORIZON_WEEKS = 26;

/** Mandag `n` uger efter `mondayISO` (yyyy-mm-dd, UTC-stabilt). */
function addWeeksISO(mondayISO: string, n: number): string {
  const d = new Date(Date.parse(`${mondayISO}T00:00:00Z`) + n * 7 * 864e5);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
