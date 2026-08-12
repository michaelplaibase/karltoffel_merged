import test from "node:test";
import assert from "node:assert/strict";
import { projectSubscriptionVisits } from "../lib/subscription-preview";

const task = (overrides: Partial<{
  id: number; category: string; description: string; price: number; durationMin: number;
  intervalMultiplier: string | null; startWeek: string | null; pauseActive: boolean;
  pauseStart: string | null; pauseEnd: string | null; pauseYearly: boolean;
}> = {}) => ({
  id: 10,
  category: "Vinduespolering",
  description: "Udvendig polering",
  price: 500,
  durationMin: 60,
  intervalMultiplier: "Hver gang",
  startWeek: null,
  pauseActive: false,
  pauseStart: null,
  pauseEnd: null,
  pauseYearly: true,
  ...overrides,
});

const subscription = (overrides: Record<string, unknown> = {}) => ({
  id: 1,
  displayNo: 101,
  contactId: 7,
  customer: "Testkunde",
  phone: "+45 12 34 56 78",
  deliveryAddress: "Testvej 1, 8000 Aarhus C",
  baseInterval: "Hver 1. uge",
  startWeek: "Uge 33",
  fixedWeekdays: "1",
  fixedEmployeeId: 3,
  tasks: [task()],
  ...overrides,
});

const project = (source: ReturnType<typeof subscription>[], referenceDate = "2026-08-10", horizonWeeks = 26) =>
  projectSubscriptionVisits(source, { referenceDate: new Date(`${referenceDate}T12:00:00Z`), horizonWeeks, holidays: [] });

const isoWeeks = (visits: ReturnType<typeof projectSubscriptionVisits>, taskId: number) => visits
  .filter((visit) => visit.tasks.some((item) => item.id === taskId))
  .map((visit) => visit.week);

test("accepterer rå uge, Uge-prefix og whitespace, men kun ISO-uge 1..53", () => {
  for (const startWeek of ["33", "Uge 33", "  Uge 33  ", " 33 "]) {
    assert.equal(project([subscription({ startWeek })], "2026-08-10", 1).length, 1, startWeek);
  }
  for (const startWeek of ["0", "54", "Uge 2x", "uge", ""]) {
    assert.equal(project([subscription({ startWeek })], "2026-08-10", 4).length, 0, startWeek);
  }
});

test("bruger opgavens valgte uge som første forekomst og faseanker", () => {
  const visits = project([subscription({
    tasks: [
      task({ id: 2, startWeek: "33", intervalMultiplier: "Hver 2. gang" }),
      task({ id: 4, startWeek: " Uge 33 ", intervalMultiplier: "Hver 4. gang" }),
      task({ id: 8, startWeek: "33", intervalMultiplier: "Hver 8. gang" }),
      task({ id: 34, startWeek: "34", intervalMultiplier: "Hver 2. gang" }),
    ],
  })], "2026-08-10", 17);

  assert.deepEqual(isoWeeks(visits, 2).slice(0, 3), ["2026-08-10", "2026-08-24", "2026-09-07"]);
  assert.deepEqual(isoWeeks(visits, 4).slice(0, 3), ["2026-08-10", "2026-09-07", "2026-10-05"]);
  assert.deepEqual(isoWeeks(visits, 8).slice(0, 3), ["2026-08-10", "2026-10-05", "2026-11-30"]);
  assert.deepEqual(isoWeeks(visits, 34).slice(0, 3), ["2026-08-17", "2026-08-31", "2026-09-14"]);
});

test("tidligere faseanker flyttes ikke, men preview returnerer kun fremtidige forekomster", () => {
  const visits = project([subscription({ tasks: [task({ id: 2, startWeek: "33", intervalMultiplier: "Hver 2. gang" })] })], "2026-08-17", 5);
  assert.deepEqual(isoWeeks(visits, 2), ["2026-08-24", "2026-09-07"]);
});

test("McDonald's-lignende fem-opgave fixture bevarer alle individuelle kadencer", () => {
  const tasks = [
    task({ id: 1, category: "Vinduer", description: "Facade", durationMin: 30, startWeek: "33" }),
    task({ id: 2, category: "Vinduer", description: "Indgang", durationMin: 20, startWeek: "33", intervalMultiplier: "Hver 2. gang" }),
    task({ id: 3, category: "Skilte", description: "Pylon", durationMin: 15, startWeek: "33", intervalMultiplier: "Hver 4. gang" }),
    task({ id: 4, category: "Solceller", description: "Tag", durationMin: 90, startWeek: "33", intervalMultiplier: "Hver 8. gang" }),
    task({ id: 5, category: "Vinduer", description: "Køkken", durationMin: 25, startWeek: "34", intervalMultiplier: "Hver 2. gang" }),
  ];
  const visits = project([subscription({ displayNo: 235818, customer: "McDonald's Lystrup", tasks })], "2026-08-10", 9);

  assert.deepEqual(visits[0].tasks.map(({ id, category, description, intervalMultiplier, durationMin }) =>
    ({ id, category, description, intervalMultiplier, durationMin })), tasks.slice(0, 4).map(({ id, category, description, intervalMultiplier, durationMin }) =>
    ({ id, category, description, intervalMultiplier, durationMin })));
  assert.deepEqual(isoWeeks(visits, 5), ["2026-08-17", "2026-08-31", "2026-09-14", "2026-09-28"]);
});

test("pause filtrerer kun opgaven, er inklusiv og fjerner besøget når alle opgaver er pauset", () => {
  const visits = project([subscription({ tasks: [
    task({ id: 1 }),
    task({ id: 2, pauseActive: true, pauseStart: "2026-08-17", pauseEnd: "2026-08-24", pauseYearly: false }),
  ] })], "2026-08-10", 4);
  assert.deepEqual(visits.map((visit) => [visit.week, visit.tasks.map(({ id }) => id)]), [
    ["2026-08-10", [1, 2]], ["2026-08-17", [1]], ["2026-08-24", [1]], ["2026-08-31", [1, 2]],
  ]);

  const allPaused = project([subscription({ tasks: [task({
    pauseActive: true, pauseStart: "2026-08-10", pauseEnd: "2026-08-31", pauseYearly: false,
  })] })], "2026-08-10", 4);
  assert.deepEqual(allPaused, []);
});

test("årlig pause virker inklusivt over nytår, mens absolut pause respekterer år", () => {
  const yearly = project([subscription({ startWeek: "53", tasks: [task({
    startWeek: "53", pauseActive: true, pauseStart: "2020-12-28", pauseEnd: "2021-01-10", pauseYearly: true,
  })] })], "2026-12-28", 3);
  assert.deepEqual(yearly.map(({ week }) => week), ["2027-01-11"]);

  const absolute = project([subscription({ startWeek: "53", tasks: [task({
    startWeek: "53", pauseActive: true, pauseStart: "2025-12-29", pauseEnd: "2026-01-11", pauseYearly: false,
  })] })], "2026-12-28", 1);
  assert.deepEqual(absolute.map(({ week }) => week), ["2026-12-28"]);
});

test("beregner kontinuerligt og årssikkert gennem ISO-uge 53", () => {
  const visits = project([subscription({ startWeek: "53", tasks: [task({ startWeek: "53", intervalMultiplier: "Hver 2. gang" })] })], "2026-12-28", 6);
  assert.deepEqual(visits.map(({ week }) => week), ["2026-12-28", "2027-01-11", "2027-01-25"]);
});

test("horizonWeeks tæller ugepositioner 0, 1 og 26", () => {
  assert.equal(project([subscription()], "2026-08-10", 0).length, 0);
  assert.deepEqual(project([subscription()], "2026-08-10", 1).map(({ week }) => week), ["2026-08-10"]);
  assert.equal(project([subscription()], "2026-08-10", 26).length, 26);
});

test("input forbliver uændret og preview kræver ingen write-klient", () => {
  const source = subscription({ tasks: [task(), task({ id: 2 })] });
  const before = structuredClone(source);
  project([source], "2026-08-10", 4);
  assert.deepEqual(source, before);
});
