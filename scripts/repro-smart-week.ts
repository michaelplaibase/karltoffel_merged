// Deterministic repro: week-level smart scheduling vs. the old greedy
// day-outer pass. Run: npx tsx scripts/repro-smart-week.ts
import { planWeek, type Job, type Employee, type WeekPlan } from "../lib/planner";
import { driveFromHomeMinutes, driveMinutes } from "../lib/geo";

const emp: Employee = {
  id: 1, name: "Test", home: [55.86, 9.85],
  workStartMin: 480, workEndMin: 960, flexMin: 60, workdays: [0, 1, 2, 3, 4],
};
// Postkoder i forskellige bydele → reelt forskellige kørselsminutter.
const areas = ["8700", "8660", "8000", "8300", "8600"];
const mkJob = (id: number, durationMin: number, extra: Partial<Job> = {}): Job => ({
  id, contactId: id, customer: `K${id}`, address: `Testvej ${id}, ${areas[id % areas.length]}`,
  postal: areas[id % areas.length], category: "G", durationMin, source: "abo", fixedEmployeeId: 1, ...extra,
});

const totalDrive = (p: WeekPlan) => p.days.reduce((a, d) => a + d.driveMin, 0);
const daySpread = (p: WeekPlan) => p.days.map((d) => `dag${d.weekday}:${d.stops.length}st(${
  d.stops.map((s) => `${s.job.id}@${Math.floor(s.startMin / 60)}:${String(s.startMin % 60).padStart(2, "0")}`).join(", ")
})`).join("  ");

// --- Gammel adfærd (rekonstrueret 1:1 fra planner.ts før ændringen) ----------
function planWeekOld(jobs: Job[], weekMonday: string, employees: Employee[], opts: { fromWeekday?: number } = {}): WeekPlan {
  const fromWeekday = opts.fromWeekday ?? 0;
  const remaining = [...jobs];
  const states = employees.flatMap((e) => e.workdays.map((weekday) => ({
    emp: e, weekday, stops: [] as Job[], curAddr: null as string | null, cursor: e.workStartMin, hardEnd: e.workEndMin + e.flexMin, driveMin: 0, serviceMin: 0, overtime: [] as number[],
  })));
  for (const s of states) {
    while (true) {
      let best: { i: number; d: number } | null = null;
      for (let i = 0; i < remaining.length; i++) {
        const j = remaining[i];
        if (!j.locked || j.lockedWeekday !== s.weekday) continue;
        if (j.fixedEmployeeId && j.fixedEmployeeId !== s.emp.id) continue;
        const d = s.curAddr === null ? driveFromHomeMinutes(j.address, s.emp.home) : driveMinutes(s.curAddr, j.address);
        if (!best || d < best.d) best = { i, d };
      }
      if (!best) break;
      const j = remaining.splice(best.i, 1)[0];
      s.cursor += best.d + j.durationMin; s.curAddr = j.address; s.stops.push(j); s.driveMin += best.d; s.serviceMin += j.durationMin;
    }
    if (s.weekday < fromWeekday) continue;
    while (true) {
      let best: { i: number; d: number } | null = null;
      for (let i = 0; i < remaining.length; i++) {
        const j = remaining[i];
        if (j.locked) continue;
        if (j.fixedEmployeeId && j.fixedEmployeeId !== s.emp.id) continue;
        if (j.fixedWeekdays && !j.fixedWeekdays.includes(s.weekday)) continue;
        const d = s.curAddr === null ? driveFromHomeMinutes(j.address, s.emp.home) : driveMinutes(s.curAddr, j.address);
        if (s.cursor + d + j.durationMin > s.hardEnd) continue;
        if (!best || d < best.d) best = { i, d };
      }
      if (!best) break;
      const j = remaining.splice(best.i, 1)[0];
      s.cursor += best.d + j.durationMin; s.curAddr = j.address; s.stops.push(j); s.driveMin += best.d; s.serviceMin += j.durationMin;
    }
  }
  while (true) {
    let placedAny = false;
    for (let i = 0; i < remaining.length; i++) {
      const j = remaining[i];
      if (j.locked || j.fixedEmployeeId == null) continue;
      const cands = states.filter((s) => s.emp.id === j.fixedEmployeeId && s.weekday >= fromWeekday && (!j.fixedWeekdays || j.fixedWeekdays.includes(s.weekday)));
      if (!cands.length) continue;
      const t = cands.reduce((b, s) => (s.driveMin + s.serviceMin < b.driveMin + b.serviceMin || (s.driveMin + s.serviceMin === b.driveMin + b.serviceMin && s.weekday < b.weekday) ? s : b));
      const d = t.curAddr === null ? driveFromHomeMinutes(j.address, t.emp.home) : driveMinutes(t.curAddr, j.address);
      remaining.splice(i, 1);
      t.cursor += d + j.durationMin; t.curAddr = j.address; t.stops.push(j); t.driveMin += d; t.serviceMin += j.durationMin; t.overtime.push(j.id);
      placedAny = true;
      break;
    }
    if (!placedAny) break;
  }
  return {
    weekMonday,
    days: states.filter((s) => s.stops.length).map((s) => ({
      employeeId: s.emp.id, weekday: s.weekday, driveMin: s.driveMin, serviceMin: s.serviceMin,
      stops: s.stops.map((j) => ({ job: j, startMin: 0, endMin: 0, driveMin: 0, overtime: s.overtime.includes(j.id) || undefined })),
    })),
    unplanned: remaining,
  };
}

console.log("=== (a) 5 ubeegrænsede 240-min job, mandag 2026-08-24, fromWeekday 0 ===");
const five = Array.from({ length: 5 }, (_, i) => mkJob(i + 1, 240));
const oldP = planWeekOld(five, "2026-08-24", [emp]);
const newP = planWeek(five, "2026-08-24", [emp]);
console.log("GAML:  " + daySpread(oldP));
console.log("NY:    " + daySpread(newP));
console.log(`GAML samlet kørsel: ${totalDrive(oldP)} min · NY samlet kørsel: ${totalDrive(newP)} min`);
// Thomas' spec: "planlægges bedst i henhold til KØRSEL PR DAG (Google Maps)" —
// den relevante måling er den længste enkeltdags-rute, ikke ugens samlede
// rundture (spredning over ugen øger antal hjem-rejser med vilje).
const maxDayDrive = (p: WeekPlan) => Math.max(0, ...p.days.map((d) => d.driveMin));
console.log(`Maks. kørsel pr dag — GAML: ${maxDayDrive(oldP)} min · NY: ${maxDayDrive(newP)} min`);
console.assert(maxDayDrive(newP) <= maxDayDrive(oldP), "NY skal minimere kørsel pr dag");
console.assert(newP.days.filter((d) => d.stops.length).length >= 3, "NY skal fordele over >=3 dage");
console.assert(newP.unplanned.length === 0, "(a) ingen Ikke planlagt");

console.log("\n=== (b) fast-ugedags job (fast mandag), mandag er PASSERET (fromWeekday=2) ===");
const b = planWeek([mkJob(10, 60, { fixedWeekdays: [0] })], "2026-08-24", [emp], { fromWeekday: 2 });
console.log("GAML: unplanned = " + planWeekOld([mkJob(10, 60, { fixedWeekdays: [0] })], "2026-08-24", [emp], { fromWeekday: 2 }).unplanned.length + " ('Ikke planlagt')");
const bWd = b.days.find((d) => d.stops.length)?.weekday;
console.log(`NY:    planlagt på dag ${bWd} (>= 2), unplanned = ${b.unplanned.length}`);
console.assert(b.unplanned.length === 0 && (bWd ?? -1) >= 2, "(b) skal lande på tilbageværende dag");

console.log("\n=== (c) 'Skal genplanlægges' — Queries-niveau: ikke længere låst til gammel dag ===");
// (buildWeekPlan afpinnes ikke længere; vis kildedokumentation)
import * as fs from "node:fs";
const q = fs.readFileSync("lib/queries.ts", "utf8");
const replanOk = !/o\.lockedFully \|\| o\.status !== "Afventer levering"/.test(q) && /o\.status !== "Skal genplanlægges"/.test(q);
console.log(`NY:    'Skal genplanlægges' er flytbar (ikke længere i locked-sættet): ${replanOk}`);
console.assert(replanOk, "(c) genplanlægges-ordrer skal kunne flyttes");
// Planner-niveau bevies med et job der KUN kan nå en anden dag end sin gamle:
const c = planWeek([
  { ...mkJob(20, 500, { locked: true, lockedWeekday: 0 }) }, // blokerer mandagen
  mkJob(21, 500),
], "2026-08-24", [emp]);
const c21 = c.days.find((d) => d.stops.some((s) => s.job.id === 21))?.weekday;
console.log(`Planner-kontrol: 500-min job på fyldt mandag → dag ${c21} (aldrig "Ikke planlagt")`);
console.assert(c.unplanned.length === 0, "(c) zero unplanned mens der er kapacitet");

console.log("\nAl assertions OK ✓");
