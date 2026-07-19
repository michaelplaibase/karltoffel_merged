// Runnable smoke test for the booking engine's PURE slot-finder + duration
// estimator (no database). Run with:  npx tsx scripts/booking-smoke.ts
//
// Exercises findSlotInSchedule (capacity-based earliest-slot search over sample
// orders) and estimateLineDurations (price→duration + human-confirm flag).
import assert from "node:assert";
import { findSlotInSchedule, estimateLineDurations, BOOK_WORK_START_MIN } from "../lib/booking";

let passed = 0;
function ok(name: string, cond: boolean) {
  assert.ok(cond, `FAIL: ${name}`);
  passed++;
  console.log(`  ✓ ${name}`);
}

console.log("findSlotInSchedule:");

// 1. Empty schedule → first workday at 07:00.
{
  const s = findSlotInSchedule({ bookings: [], durationMin: 90, fromDateISO: "2026-07-20" }); // Mon
  ok("empty Monday → 07:00–08:30", !!s && s.dateISO === "2026-07-20" && s.startLabel === "07:00" && s.endLabel === "08:30");
}

// 2. Partly-loaded day → slot starts after existing load.
{
  const s = findSlotInSchedule({
    bookings: [{ dateISO: "2026-07-20", durationMin: 120 }], // 2h used → free from 09:00
    durationMin: 60,
    fromDateISO: "2026-07-20",
  });
  ok("120min used → next slot 09:00–10:00", !!s && s.startLabel === "09:00" && s.endLabel === "10:00");
}

// 3. Full day (>8h window) → rolls to the next workday.
{
  const s = findSlotInSchedule({
    bookings: [{ dateISO: "2026-07-20", durationMin: 60 * 8 }], // fills 07:00–15:00
    durationMin: 60,
    fromDateISO: "2026-07-20",
  });
  ok("full Monday → rolls to Tuesday", !!s && s.dateISO === "2026-07-21" && s.startLabel === "07:00");
}

// 4. Weekend is skipped (Sat 2026-07-25 start → Mon 2026-07-27).
{
  const s = findSlotInSchedule({ bookings: [], durationMin: 30, fromDateISO: "2026-07-25" });
  ok("Saturday start → Monday slot", !!s && s.weekday === 0 && s.dateISO === "2026-07-27");
}

// 5. Duration larger than the whole workday never fits.
{
  const s = findSlotInSchedule({ bookings: [], durationMin: 999, fromDateISO: "2026-07-20", daysToScan: 5 });
  ok("oversized job → no slot", s === null);
}

// 6. isOpen filter (e.g. holiday week) skips a day.
{
  const s = findSlotInSchedule({
    bookings: [],
    durationMin: 30,
    fromDateISO: "2026-07-20",
    isOpen: (d) => d !== "2026-07-20", // Monday closed
  });
  ok("holiday Monday closed → Tuesday", !!s && s.dateISO === "2026-07-21");
}

// 7. Workday-start constant sanity.
ok("workday starts 07:00", BOOK_WORK_START_MIN === 7 * 60);

// 7a. TRUE clock packing: a 90-min job on an empty day starts 07:00 …
{
  const s = findSlotInSchedule({ bookings: [], durationMin: 90, fromDateISO: "2026-07-20" });
  ok("first 90-min job → 07:00–08:30", !!s && s.startLabel === "07:00" && s.endLabel === "08:30");
}

// 7b. … and a second 90-min job, with the first now at a concrete startAt (07:00),
//     packs sequentially to 08:30 (not merely capacity-summed).
{
  const s = findSlotInSchedule({
    bookings: [{ dateISO: "2026-07-20", durationMin: 90, startMin: 7 * 60 }],
    durationMin: 90,
    fromDateISO: "2026-07-20",
  });
  ok("second 90-min job after fixed 07:00 → 08:30–10:00", !!s && s.startLabel === "08:30" && s.endLabel === "10:00");
}

// 7c. Gap-filling: a fixed job at 10:00 leaves 07:00–10:00 free for a 90-min job.
{
  const s = findSlotInSchedule({
    bookings: [{ dateISO: "2026-07-20", durationMin: 60, startMin: 10 * 60 }],
    durationMin: 90,
    fromDateISO: "2026-07-20",
  });
  ok("fixed 10:00 job → new 90-min fills 07:00 gap", !!s && s.startLabel === "07:00" && s.endLabel === "08:30");
}

// 7d. No overlap: a 4h job cannot fit the 07:00–10:00 gap before a fixed 10:00
//     job, so it lands after it (11:00).
{
  const s = findSlotInSchedule({
    bookings: [{ dateISO: "2026-07-20", durationMin: 60, startMin: 10 * 60 }], // 10:00–11:00
    durationMin: 240,
    fromDateISO: "2026-07-20",
  });
  ok("oversized-for-gap job → after fixed job 11:00", !!s && s.startLabel === "11:00" && s.endLabel === "15:00");
}

// 7e. Legacy date-only load + a fixed job stack correctly (front capacity then fixed).
{
  const s = findSlotInSchedule({
    bookings: [
      { dateISO: "2026-07-20", durationMin: 120 }, // legacy → reserves 07:00–09:00
      { dateISO: "2026-07-20", durationMin: 60, startMin: 9 * 60 }, // fixed 09:00–10:00
    ],
    durationMin: 60,
    fromDateISO: "2026-07-20",
  });
  ok("legacy 2h + fixed 09:00 → next slot 10:00", !!s && s.startLabel === "10:00" && s.endLabel === "11:00");
}

console.log("\nestimateLineDurations:");

// 8. Explicit durations are trusted; no confirmation needed.
{
  const r = estimateLineDurations([{ description: "Vinduespudsning", price: 500, durationMin: 45 }], 8.6);
  ok("explicit duration kept, not estimated", r.totalDurationMin === 45 && r.estimated === false);
}

// 9. Missing duration → derived from price, flagged for confirmation.
{
  // price 500 incl VAT → 400 excl → /8.6 ≈ 47 min
  const r = estimateLineDurations([{ description: "Fugerens", price: 500 }], 8.6);
  ok("missing duration derived from price", r.lines[0].durationMin === Math.round(400 / 8.6) && r.estimated === true);
}

// 10. No price + no duration → 30-min fallback, flagged.
{
  const r = estimateLineDurations([{ description: "Ukendt opgave" }], 8.6);
  ok("no price/duration → 30min fallback + estimated", r.lines[0].durationMin === 30 && r.estimated === true);
}

console.log(`\nAll ${passed} assertions passed ✅`);
