// "I dag"-beregninger skal følge Europe/Copenhagen, ikke UTC.
import { test } from "node:test";
import assert from "node:assert/strict";
import { weekMondayToday, todayCphISO } from "../lib/calendar";

test("weekMondayToday bruger Copenhagen-dato ved midnat-1 (tirsdag 22:30 UTC = onsdag 00:30 CPH)", () => {
  using _t = mockTimers("2026-08-25T22:30:00Z"); // CPH: onsdag 26. aug 2026
  assert.equal(todayCphISO(), "2026-08-26");
  assert.equal(weekMondayToday(), "2026-08-24"); // mandag i samme ISO-uge
});

test("weekMondayToday ved søndag aften forbliver i den igangværende uge", () => {
  using _t = mockTimers("2026-08-30T21:00:00Z"); // CPH: søndag 30. aug 23:00
  assert.equal(todayCphISO(), "2026-08-30");
  assert.equal(weekMondayToday(), "2026-08-24");
});

function mockTimers(iso: string): Disposable {
  // node:test mock.timers kræver import; lille wrapper så tests bliver korte.
  const t = mockClock(iso);
  return { [Symbol.dispose]: () => t.reset() };
}

import { mock } from "node:test";
function mockClock(iso: string) {
  mock.timers.enable({ apis: ["Date"], now: new Date(iso) });
  return mock.timers;
}
