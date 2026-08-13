import test from "node:test";
import assert from "node:assert/strict";
import { calendar2WeekNavigation } from "../lib/calendar2-navigation";
import { previewSuggestionText } from "../lib/calendar2-presentation";
import { planCalendar2Horizon, type Calendar2Employee, type Calendar2Series, type TravelMatrix } from "../lib/calendar2-routing";

const employee: Calendar2Employee = { id: 7, name: "Michael", homeAddress: "Hjem", workStartMin: 480, workEndMin: 960, flexMin: 0, workdays: [0, 1, 2, 3, 4] };
const matrix: TravelMatrix = { addresses: ["Hjem", "A", "B"], durations: [[0,0,0],[0,0,0],[0,0,0]], provider: "oracle-fixture", capturedAt: "2026-08-10T00:00:00Z" };
const series = (seriesId: number, durationMin: number): Calendar2Series => ({ seriesId, sourceStartWeek: "2026-08-10", occurrences: [{ sourceWeek: "2026-08-10", job: { id: seriesId, contactId: seriesId, customer: String(seriesId), address: seriesId === 235828 ? "A" : "B", postal: "8000", category: "Test", durationMin, source: `Abo. #${seriesId}`, fixedWeekdays: [0], fixedEmployeeId: 7 } }] });

test("calendar-2 query 2026-08-17 viser uge 34 med præcis uge 33 og 35 navigation", () => {
  assert.deepEqual(calendar2WeekNavigation("2026-08-17"), { monday: "2026-08-17", weekNo: 34, prevWeek: "2026-08-10", nextWeek: "2026-08-24", monthParam: "2026-08" });
});

test("forslagstekst findes kun ved faktisk flyttet dag eller uge", () => {
  assert.equal(previewSuggestionText({ sourceWeek: "2026-08-10", previewWeek: "2026-08-10", sourceWeekdayOverridden: false, reason: null }), null);
  assert.equal(previewSuggestionText({ sourceWeek: "2026-08-10", previewWeek: "2026-08-10", sourceWeekdayOverridden: true, reason: "capacity_overflow_rebalanced" }), "Automatisk forslag · kilde 2026-08-10 · preview 2026-08-10 · ugedag flyttet");
  assert.equal(previewSuggestionText({ sourceWeek: "2026-08-10", previewWeek: "2026-08-17", sourceWeekdayOverridden: false, reason: "capacity_deferred_to_next_week" }), "Automatisk forslag · kilde 2026-08-10 · preview 2026-08-17 · uge flyttet");
});

test("data-invalid uge33-serier bevares som synlige unplanned med eksakte reasons", () => {
  const result = planCalendar2Horizon([series(235828, 0), series(235865, 481)], "2026-08-10", 26, [employee], matrix);
  assert.deepEqual(result.unplanned.map((item) => [item.seriesId, item.sourceWeek, item.reason]), [[235828, "2026-08-10", "invalid_duration"]]);
  assert.equal(result.placements.find((item) => item.seriesId === 235865)?.previewWeek, "2026-08-10");
});

test("canonical horizon giver samme previewfase uanset hvilken uge UI efterspørger", () => {
  const blocker: Calendar2Series = { seriesId: 1, sourceStartWeek: "2026-08-10", occurrences: [{ sourceWeek: "2026-08-10", job: { id: 1, contactId: 1, customer: "blok", address: "A", postal: "8000", category: "Test", durationMin: 480, source: "Abo. #1", fixedWeekdays: [0], fixedEmployeeId: 7 } }] };
  const target: Calendar2Series = { seriesId: 235866, sourceStartWeek: "2026-08-10", occurrences: [{ sourceWeek: "2026-08-10", job: { id: 2, contactId: 2, customer: "mål", address: "B", postal: "8000", category: "Test", durationMin: 60, source: "Abo. #235866", fixedWeekdays: [0], fixedEmployeeId: 7 } }] };
  const canonical = planCalendar2Horizon([blocker, target], "2026-08-10", 26, [{ ...employee, workdays: [0] }], matrix);
  const placement = canonical.placements.find((item) => item.seriesId === 235866);
  assert.equal(placement?.previewWeek, "2026-08-17");
  assert.equal(canonical.weeks.find((item) => item.weekMonday === "2026-08-10")?.plan.weekMonday, "2026-08-10");
  assert.equal(canonical.weeks.find((item) => item.weekMonday === "2026-08-17")?.plan.weekMonday, "2026-08-17");
});
