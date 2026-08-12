import test from "node:test";
import assert from "node:assert/strict";
import {
  calendar2MatrixAuditHash,
  createCalendar2Routing,
  planCalendar2Week,
  type Calendar2Employee,
  type Calendar2Job,
  type TravelMatrix,
} from "../lib/calendar2-routing";

const employee = (overrides: Partial<Calendar2Employee> = {}): Calendar2Employee => ({
  id: 7, name: "Rute Test", homeAddress: "Hjemvej 1, 8700 Horsens", workStartMin: 480,
  workEndMin: 960, flexMin: 60, workdays: [0, 1, 2, 3, 4], ...overrides,
});
const job = (id: number, address: string, overrides: Partial<Calendar2Job> = {}): Calendar2Job => ({
  id, contactId: id, customer: `Kunde ${id}`, address, postal: address, category: "Test",
  durationMin: 60, source: `Abo. #${id}`, fixedEmployeeId: 7, ...overrides,
});
const matrix = (addresses: string[], durations: number[][]): TravelMatrix => ({
  addresses, durations, provider: "test-matrix", capturedAt: "2026-08-12T00:00:00.000Z",
});

test("geocoder bruger fuld adresse, skelner samme postnummer og cacher deduplikeret", async () => {
  const calls: string[] = [];
  const fetcher: typeof fetch = async (input) => {
    const url = new URL(String(input)); calls.push(url.searchParams.get("q") ?? "");
    const q = url.searchParams.get("q") ?? "";
    const lat = q.includes("Gade 1") ? "55.1" : "55.2";
    return new Response(JSON.stringify([{ lat, lon: "9.9", display_name: q }]), { status: 200 });
  };
  const routing = createCalendar2Routing({ fetcher, sleep: async () => {}, now: () => 1 });
  const a = await routing.geocode("Gade 1, 8700 Horsens");
  const b = await routing.geocode("Gade 2, 8700 Horsens");
  const again = await routing.geocode("Gade 1, 8700 Horsens");
  assert.notDeepEqual(a.coordinate, b.coordinate);
  assert.deepEqual(again.coordinate, a.coordinate);
  assert.equal(calls.length, 2);
  assert.ok(calls.every((q) => q.includes("Danmark")));
});

test("ukendt postnummer falder aldrig tilbage til Horsens og geocode-fejl er eksplicit", async () => {
  const routing = createCalendar2Routing({
    fetcher: async () => new Response("[]", { status: 200 }), sleep: async () => {}, now: () => 1,
  });
  const result = await routing.geocode("Ukendtvej 9, 9999 Ukendt");
  assert.equal(result.status, "unverified_address");
  assert.equal(result.coordinate, null);
});

test("geocoder retryer begrænset og cacher ikke en transient fejl permanent", async () => {
  let calls = 0;
  const routing = createCalendar2Routing({
    fetcher: async () => {
      calls++;
      if (calls <= 2) throw new Error("network");
      return new Response(JSON.stringify([{ lat: "55.8", lon: "9.8" }]));
    }, sleep: async () => {}, now: () => 1,
  });
  assert.equal((await routing.geocode("Fejlvej 1, 8990 Fårup")).status, "unverified_address");
  assert.equal((await routing.geocode("Fejlvej 1, 8990 Fårup")).status, "verified");
  assert.equal(calls, 3);
});

test("matrix bruger OSRM-varigheder og deduplikerer samme koordinatsæt", async () => {
  let calls = 0;
  const fetcher: typeof fetch = async (input) => {
    const url = String(input);
    if (url.includes("nominatim")) return new Response(JSON.stringify([{ lat: url.includes("Hjem") ? "55.0" : url.includes("A 1") ? "55.1" : "55.2", lon: "9.0", display_name: "verified" }]));
    calls++;
    return new Response(JSON.stringify({ code: "Ok", durations: [[0, 600, 900], [600, 0, 300], [900, 300, 0]] }));
  };
  const routing = createCalendar2Routing({ fetcher, sleep: async () => {}, now: () => 1 });
  const first = await routing.buildMatrix(["Hjem 1", "A 1", "B 1"]);
  const second = await routing.buildMatrix(["Hjem 1", "A 1", "B 1"]);
  assert.deepEqual(first.matrix?.durations, [[0, 10, 15], [10, 0, 5], [15, 5, 0]]);
  assert.deepEqual(second.matrix, first.matrix);
  assert.equal(calls, 1);
});

test("én fejlet geocode udelukker kun adressen fra den verificerede matrix", async () => {
  const fetcher: typeof fetch = async (input) => {
    const url = String(input);
    if (url.includes("nominatim")) return new Response(url.includes("Fejl") ? "[]" : JSON.stringify([{ lat: url.includes("Hjem") ? "55.0" : "55.1", lon: "9.0" }]));
    return new Response(JSON.stringify({ code: "Ok", durations: [[0, 300], [300, 0]] }));
  };
  const routing = createCalendar2Routing({ fetcher, sleep: async () => {}, now: () => 1 });
  const result = await routing.buildMatrix(["Hjem", "Gyldig", "Fejl"]);
  assert.deepEqual(result.matrix?.addresses, ["Hjem", "Gyldig"]);
  assert.deepEqual(result.matrix?.durations, [[0, 5], [5, 0]]);
  assert.equal(result.geocodes.find((item) => item.normalizedAddress === "Fejl")?.status, "unverified_address");
});

test("null i ét matrixben forgifter kun ruter som kræver benet", async () => {
  const fetcher: typeof fetch = async (input) => {
    const url = String(input);
    if (url.includes("nominatim")) return new Response(JSON.stringify([{ lat: url.includes("Hjem") ? "55.0" : url.includes("A") ? "55.1" : "55.2", lon: "9.0" }]));
    return new Response(JSON.stringify({ code: "Ok", durations: [[0, 300, null], [300, 0, null], [null, null, 0]] }));
  };
  const routing = createCalendar2Routing({ fetcher, sleep: async () => {}, now: () => 1 });
  const result = await routing.buildMatrix(["Hjem", "A", "B"]);
  const plan = planCalendar2Week([job(1, "A"), job(2, "B")], "2026-08-10", [employee({ homeAddress: "Hjem" })], result.matrix!);
  assert.deepEqual(plan.days.flatMap((day) => day.stops.map((stop) => stop.job.id)), [1]);
  assert.equal(plan.unplanned.find((item) => item.job.id === 2)?.reason, "unverified_route");
});

test("matrix-requestfejl caches ikke og kan isoleres mellem medarbejdermatricer", async () => {
  let matrixCalls = 0;
  const fetcher: typeof fetch = async (input) => {
    const url = String(input);
    if (url.includes("nominatim")) return new Response(JSON.stringify([{ lat: url.includes("H1") ? "55.0" : url.includes("A") ? "55.1" : url.includes("H2") ? "56.0" : "56.1", lon: "9.0" }]));
    matrixCalls++;
    if (matrixCalls === 1) throw new Error("osrm down");
    return new Response(JSON.stringify({ code: "Ok", durations: [[0, 300], [300, 0]] }));
  };
  const routing = createCalendar2Routing({ fetcher, sleep: async () => {}, now: () => 1 });
  assert.equal((await routing.buildMatrix(["H1", "A"])).matrix, null);
  assert.ok((await routing.buildMatrix(["H2", "B"])).matrix);
  assert.ok((await routing.buildMatrix(["H1", "A"])).matrix);
  assert.equal(matrixCalls, 3);
});

test("isoleret matrix bevarer succesfuld medarbejderrute når en anden request fejler", async () => {
  let matrixCalls = 0;
  const fetcher: typeof fetch = async (input) => {
    const url = String(input);
    if (url.includes("nominatim")) return new Response(JSON.stringify([{ lat: url.includes("H1") ? "55.0" : url.includes("A") ? "55.1" : url.includes("H2") ? "56.0" : "56.1", lon: "9.0" }]));
    matrixCalls++;
    if (matrixCalls === 1) throw new Error("osrm down");
    return new Response(JSON.stringify({ code: "Ok", durations: [[0, 300], [300, 0]] }));
  };
  const routing = createCalendar2Routing({ fetcher, sleep: async () => {}, now: () => 1 });
  const result = await routing.buildIsolatedMatrix([["H1", "A"], ["H2", "B"]]);
  const employees = [employee({ id: 1, homeAddress: "H1" }), employee({ id: 2, homeAddress: "H2" })];
  const jobs = [job(1, "A", { fixedEmployeeId: 1 }), job(2, "B", { fixedEmployeeId: 2 })];
  const plan = planCalendar2Week(jobs, "2026-08-10", employees, result.matrix!);
  assert.equal(plan.unplanned.find((item) => item.job.id === 1)?.reason, "unverified_route");
  assert.deepEqual(plan.days.flatMap((day) => day.stops.map((stop) => stop.job.id)), [2]);
});

test("ukendt medarbejder er unassigned og manglende hjem er unverified_address", () => {
  const m = matrix(["H", "A"], [[0, 5], [5, 0]]);
  const unknown = planCalendar2Week([job(1, "A", { fixedEmployeeId: 999 })], "2026-08-10", [employee()], m);
  assert.equal(unknown.unplanned[0].reason, "unassigned");
  const noHome = planCalendar2Week([job(1, "A")], "2026-08-10", [employee({ homeAddress: null })], m);
  assert.equal(noHome.unplanned[0].reason, "unverified_address");
});

test("fixedWeekdays og weekend respekteres auditerbart", () => {
  const m = matrix(["Hjemvej 1, 8700 Horsens", "A"], [[0, 5], [5, 0]]);
  const plan = planCalendar2Week([job(1, "A", { fixedWeekdays: [2] })], "2026-08-10", [employee()], m);
  assert.equal(plan.days[0].weekday, 2);
  assert.deepEqual(plan.days[0].stops[0].audit.fixedWeekdays, [2]);
  assert.ok(plan.days.every((day) => day.weekday < 5));
  const weekendOnly = planCalendar2Week([job(2, "A", { fixedWeekdays: [5] })], "2026-08-10", [employee()], m);
  assert.equal(weekendOnly.unplanned[0].reason, "fixed_weekday_unavailable");
});

test("kapacitet inkluderer hjem til første, matrixben og retur hjem", () => {
  const emp = employee({ workStartMin: 480, workEndMin: 600, flexMin: 0, workdays: [0] });
  const m = matrix([emp.homeAddress!, "A"], [[0, 40], [40, 0]]);
  const plan = planCalendar2Week([job(1, "A", { durationMin: 60 })], "2026-08-10", [emp], m);
  assert.equal(plan.days.length, 0);
  assert.equal(plan.unplanned[0].reason, "overflow");
});

test("ruten er deterministisk, nearest-feasible og reproducerbar fra matrix", () => {
  const home = employee().homeAddress!;
  const m = matrix([home, "A", "B"], [[0, 20, 5], [20, 0, 4], [5, 4, 0]]);
  const jobs = [job(1, "A", { durationMin: 10 }), job(2, "B", { durationMin: 10 })];
  const a = planCalendar2Week(jobs, "2026-08-10", [employee({ workdays: [0] })], m);
  const b = planCalendar2Week(jobs, "2026-08-10", [employee({ workdays: [0] })], m);
  assert.deepEqual(a, b);
  assert.deepEqual(a.days[0].stops.map((s) => s.job.id), [2, 1]);
  assert.deepEqual(a.days[0].travelLegs.map((l) => l.minutes), [5, 4, 20]);
  assert.equal(a.audit.optimizationContract, "deterministic-nearest-feasible-not-global-optimum");
  assert.equal(a.audit.matrixProvider, "test-matrix");
});

test("matrixfejl bliver eksplicit unverified_route og aldrig overflow", () => {
  const home = employee().homeAddress!;
  const unavailable = matrix([home, "A"], [[0, Number.POSITIVE_INFINITY], [Number.POSITIVE_INFINITY, 0]]);
  unavailable.provider = "unverified";
  const plan = planCalendar2Week([job(1, "A")], "2026-08-10", [employee()], unavailable);
  assert.equal(plan.unplanned[0].reason, "unverified_route");
});

test("ugyldig jobadresse bliver eksplicit unverified_address", () => {
  const m = matrix([employee().homeAddress!], [[0]]);
  const plan = planCalendar2Week([job(1, "Mangler")], "2026-08-10", [employee()], m);
  assert.equal(plan.unplanned[0].reason, "unverified_address");
});

test("alle adresser kan være unverificerede uden falsk rute eller overflow", async () => {
  const routing = createCalendar2Routing({ fetcher: async () => new Response("[]"), sleep: async () => {}, now: () => 1 });
  const result = await routing.buildMatrix(["Hjem", "A"]);
  assert.equal(result.matrix, null);
  const plan = planCalendar2Week([job(1, "A")], "2026-08-10", [employee({ homeAddress: "Hjem" })], matrix([], []));
  assert.equal(plan.unplanned[0].reason, "unverified_address");
});

test("matrix revisionsspor binder punkter og varigheder deterministisk", () => {
  const points = [
    { index: 0, lat: 55.1, lon: 9.1, kind: "employee_home" as const, stableRef: "employee:7" },
    { index: 1, lat: 55.2, lon: 9.2, kind: "job" as const, stableRef: "subscription:42" },
  ];
  const durations = [[0, 5], [6, 0]];
  const first = calendar2MatrixAuditHash({ version: "calendar2-route-audit-v1", provider: "osrm-table", matrixPoints: points, matrixDurations: durations, timestamp: "2026-08-12T00:00:00Z" });
  const later = calendar2MatrixAuditHash({ version: "calendar2-route-audit-v1", provider: "osrm-table", matrixPoints: points, matrixDurations: durations, timestamp: "2026-08-13T00:00:00Z" });
  assert.equal(first, later, "timestamp må ikke påvirke den kanoniske hash");
  assert.notEqual(first, calendar2MatrixAuditHash({ version: "calendar2-route-audit-v1", provider: "osrm-table", matrixPoints: [{ ...points[0], lat: 55.11 }, points[1]], matrixDurations: durations, timestamp: "2026-08-12T00:00:00Z" }));
  assert.notEqual(first, calendar2MatrixAuditHash({ version: "calendar2-route-audit-v1", provider: "osrm-table", matrixPoints: points, matrixDurations: [[0, 7], [6, 0]], timestamp: "2026-08-12T00:00:00Z" }));
});
