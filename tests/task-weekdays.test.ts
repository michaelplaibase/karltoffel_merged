// Ugedage på abonnements-opgaver: parsing, serielagring, effektive
// besøgsdage og preview-integration (opgave med kun mandadg ⇒ kun mandag).
import { test } from "node:test";
import assert from "node:assert/strict";
import { parseWeekdayDigits, weekdayDigits, effectiveVisitWeekdays, WEEKDAYS_DA } from "../lib/task-weekdays";
import { projectSubscriptionVisits, type PreviewSubscription } from "../lib/subscription-preview";

test("parseWeekdayDigits: digit-streng → indekser, tom → undefined", () => {
  assert.deepEqual(parseWeekdayDigits("0"), [0]);
  assert.deepEqual(parseWeekdayDigits("013"), [0, 1, 3]);
  assert.deepEqual(parseWeekdayDigits("30"), [0, 3]); // sorteres
  assert.deepEqual(parseWeekdayDigits("113"), [1, 3]); // deduplikeres
  assert.equal(parseWeekdayDigits(""), undefined);
  assert.equal(parseWeekdayDigits(null), undefined);
  assert.equal(parseWeekdayDigits("xyz9"), undefined); // ugyldige tegn kasseres
});

test("weekdayDigits: liste → streng, tom → null", () => {
  assert.equal(weekdayDigits([0]), "0");
  assert.equal(weekdayDigits([3, 0, 1]), "013");
  assert.equal(weekdayDigits([]), null);
  assert.equal(weekdayDigits(undefined), null);
});

test("WEEKDAYS_DA er de danske navne i planner-konvention (0=mandag)", () => {
  assert.deepEqual([...WEEKDAYS_DA], ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag", "Søndag"]);
});

test("effectiveVisitWeekdays: opgavebegrænsning skærer abonnementets dage", () => {
  // Kun opgavebegrænsning:
  assert.deepEqual(effectiveVisitWeekdays(null, ["0"]), [0]);
  // Opgave skærer subscriptionens "1234560" ned til mandadg:
  assert.deepEqual(effectiveVisitWeekdays("1234560", ["0"]), [0]);
  // Opgave uden begrænsning rører ikke subscriptionens dage:
  assert.deepEqual(effectiveVisitWeekdays("1234560", [null]), [0, 1, 2, 3, 4, 5, 6]);
  // To begrænsninger skæres sammen:
  assert.deepEqual(effectiveVisitWeekdays(null, ["012", "12"]), [1, 2]);
  // Tom skæring (modstridende) → foreningen (planlægning må aldrig blive umulig):
  assert.deepEqual(effectiveVisitWeekdays(null, ["0", "1"]), [0, 1]);
  // Ingen begrænsninger → undefined:
  assert.equal(effectiveVisitWeekdays(null, [null, undefined]), undefined);
});

const sub = (tasks: PreviewSubscription["tasks"]): PreviewSubscription => ({
  id: 1, displayNo: 235801, contactId: 1, customer: "Test Kundebier", phone: null,
  deliveryAddress: "Testvej 1, 8700 Horsens", baseInterval: "Hver uge", startWeek: "Uge 30",
  fixedWeekdays: null, fixedEmployeeId: null, active: true, tasks,
});

test("preview: opgave med weekdays '0' giver besøg der kun må planlægges mandag", () => {
  const visits = projectSubscriptionVisits(
    [sub([{ id: 1, category: "Vinduespudsning", description: "Vinduer", price: 200, durationMin: 30,
      intervalMultiplier: null, startWeek: null, pauseActive: false, pauseStart: null, pauseEnd: null,
      pauseYearly: true, weekdays: "0" }])],
    { referenceDate: new Date("2026-08-03T00:00:00Z"), horizonWeeks: 4, holidays: [] },
  );
  assert.ok(visits.length >= 2);
  for (const v of visits) assert.deepEqual(v.fixedWeekdays, [0]);
});

test("preview: opgave uden ugedage efterlader visitens dage ubegrænsede", () => {
  const visits = projectSubscriptionVisits(
    [sub([{ id: 1, category: "Vinduespudsning", description: "Vinduer", price: 200, durationMin: 30,
      intervalMultiplier: null, startWeek: null, pauseActive: false, pauseStart: null, pauseEnd: null,
      pauseYearly: true }])],
    { referenceDate: new Date("2026-08-03T00:00:00Z"), horizonWeeks: 2, holidays: [] },
  );
  assert.ok(visits.length >= 1);
  assert.equal(visits[0].fixedWeekdays, undefined);
});
