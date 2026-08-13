import test from "node:test";
import assert from "node:assert/strict";
import { calendarJobDurationReason, planWeek, type Employee, type Job } from "../lib/planner";

const employee: Employee = {
  id: 7,
  name: "Planlægger",
  home: [55.86, 9.85],
  workStartMin: 8 * 60,
  workEndMin: 16 * 60,
  flexMin: 60,
  workdays: [0, 1, 2, 3, 4],
};

const job = (durationMin: number): Job => ({
  id: 1,
  contactId: 1,
  customer: "Testkunde",
  address: "Testvej 1, 8700 Horsens",
  postal: "8700 Horsens",
  category: "Test",
  durationMin,
  source: "Manuel",
  fixedEmployeeId: 7,
});

test("calendar duration validation reports invalid duration and daily overflow", () => {
  assert.equal(calendarJobDurationReason(job(0), employee), "invalid_duration");
  assert.equal(calendarJobDurationReason(job(Number.NaN), employee), "invalid_duration");
  assert.equal(calendarJobDurationReason(job(541), employee), "exceeds_daily_capacity");
  assert.equal(calendarJobDurationReason(job(540), employee), null);
});

test("planner never puts ordinary work on weekends", () => {
  const plan = planWeek([job(30)], "2026-08-10", [employee]);
  assert.ok(plan.days.every((day) => day.weekday >= 0 && day.weekday <= 4));
});
