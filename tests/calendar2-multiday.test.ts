import test from "node:test";
import assert from "node:assert/strict";
import { planCalendar2Horizon, type Calendar2Employee, type Calendar2Series, type TravelMatrix } from "../lib/calendar2-routing";

const emp: Calendar2Employee = { id: 7, name: "Kristian", homeAddress: "Hjem", workStartMin: 480, workEndMin: 960, flexMin: 60, workdays: [0,1,2,3,4] };
const matrix: TravelMatrix = { addresses: ["Hjem","A","B"], durations: [[0,10,10],[10,0,5],[10,5,0]], provider: "test-osrm", capturedAt: "2026-01-01T00:00:00Z" };
const series = (id:number, sourceWeek:string, durationMin:number, address="A", tasks?: { id:string; durationMin:number|null }[]): Calendar2Series => ({ seriesId:id, sourceStartWeek:sourceWeek, occurrences:[{ sourceWeek, job:{ id, contactId:id, customer:`K${id}`, address, postal:"8700", category:"Test", durationMin, source:`Abo. #${id}`, fixedWeekdays:[4], fixedEmployeeId:7, sourceTasks:tasks } }] });
const stops = (r:ReturnType<typeof planCalendar2Horizon>) => r.weeks.flatMap(w => w.plan.days.flatMap(d => d.stops.map(s => ({week:w.weekMonday, day:d, stop:s}))));

test("1276 minutters source task fortsætter fredag til mindst tre lovlige arbejdsdage", () => {
  const result = planCalendar2Horizon([series(1,"2026-08-10",1276)], "2026-08-10", 26, [emp], matrix);
  const parts = stops(result).filter(x => x.stop.job.id === 1);
  assert.ok(parts.length >= 3);
  assert.deepEqual(parts.map(p => [p.week,p.day.weekday]).slice(0,2), [["2026-08-10",4],["2026-08-17",0]]);
  assert.equal(parts.reduce((n,p)=>n+p.stop.job.durationMin,0),1276);
  assert.deepEqual(parts.map(p=>p.stop.audit.segmentIndex), parts.map((_,i)=>i+1));
  assert.ok(parts.every(p => p.stop.endMin + p.day.returnHomeMin <= 1020));
  assert.ok(parts.every(p => p.day.travelLegs.at(-1)?.kind === "return_home"));
});

test("splitter ved source task-grænser før en task segmenteres og default 0 bliver 60", () => {
  const input = series(2,"2026-08-10",0,"A",[{id:"t1",durationMin:400},{id:"t2",durationMin:0},{id:"t3",durationMin:600}]);
  input.occurrences[0].job.fixedWeekdays=[0];
  const result=planCalendar2Horizon([input],"2026-08-10",26,[emp],matrix);
  const parts=stops(result).filter(x=>x.stop.job.id===2);
  const byTask=Map.groupBy(parts,p=>p.stop.audit.sourceTaskId);
  assert.equal([...byTask.get("t1")!].reduce((n,p)=>n+p.stop.job.durationMin,0),400);
  assert.equal([...byTask.get("t2")!].reduce((n,p)=>n+p.stop.job.durationMin,0),60);
  assert.equal([...byTask.get("t3")!].reduce((n,p)=>n+p.stop.job.durationMin,0),600);
  assert.ok((byTask.get("t3")?.length ?? 0)>=2);
  assert.equal(result.unplanned.length,0);
});

test("senere job kaskaderer efter continuation og horizon exhaustion er eksplicit", () => {
  const long=series(1,"2026-08-10",828); long.occurrences[0].job.fixedWeekdays=[0];
  const later=series(2,"2026-08-10",60,"B"); later.occurrences[0].job.fixedWeekdays=[0];
  const result=planCalendar2Horizon([long,later],"2026-08-10",26,[emp],matrix);
  const laterStop=stops(result).find(x=>x.stop.job.id===2)!;
  assert.ok(laterStop.week > "2026-08-10" || laterStop.day.weekday > 0);
  const laterPlacement=result.placements.find(p=>p.seriesId===2)!;
  assert.ok(laterPlacement.previewWeek >= "2026-08-10");
  const tiny=planCalendar2Horizon([series(3,"2026-08-14",1276)],"2026-08-10",1,[emp],matrix);
  assert.equal(tiny.unplanned[0]?.reason,"no_capacity_in_horizon");
  assert.ok((tiny.unplanned[0]?.remainingMinutes ?? 0)>0);
  assert.ok((tiny.unplanned[0]?.remainingTaskIds?.length ?? 0)>0);
});

test("multiday planning er deterministisk og bevarer medarbejderen", () => {
  const input=[series(1,"2026-08-10",828),series(2,"2026-08-10",828,"B")];
  const a=planCalendar2Horizon(input,"2026-08-10",26,[emp],matrix);
  const b=planCalendar2Horizon(structuredClone(input),"2026-08-10",26,[emp],matrix);
  assert.deepEqual(a,b);
  assert.ok(stops(a).every(x=>x.day.employeeId===7 && x.day.weekday<5));
});

test("task-grænser bevares uden at spilde restkapacitet samme arbejdsdag", () => {
  const input = series(4,"2026-08-10",460,"A",[{id:"t1",durationMin:400},{id:"t2",durationMin:60}]);
  input.occurrences[0].job.fixedWeekdays=[0];
  const result=planCalendar2Horizon([input],"2026-08-10",26,[emp],matrix);
  const parts=stops(result).filter(x=>x.stop.job.id===4);
  assert.deepEqual(parts.map(p=>[p.week,p.day.weekday,p.stop.audit.sourceTaskId,p.stop.job.durationMin]),[
    ["2026-08-10",0,"t1",400],
    ["2026-08-10",0,"t2",60],
  ]);
});

test("continuation og rephase springer blokerede ferieuger over", () => {
  const input=series(5,"2026-08-10",828); input.occurrences[0].job.fixedWeekdays=[4];
  const result=planCalendar2Horizon([input],"2026-08-10",4,[emp],matrix,{blockedWeeks:new Set(["2026-08-17"])});
  const parts=stops(result).filter(x=>x.stop.job.id===5);
  assert.deepEqual(parts.map(p=>[p.week,p.day.weekday]),[["2026-08-10",4],["2026-08-24",0]]);
  assert.equal(result.weeks.find(w=>w.weekMonday==="2026-08-17")?.plan.days.length,0);
});

test("cascade maskerer ikke en ugyldig adresse som horizon-kapacitet", () => {
  const result=planCalendar2Horizon([series(6,"2026-08-10",600,"Ukendt",[{id:"t",durationMin:600}])],"2026-08-10",26,[emp],matrix);
  assert.equal(result.seriesAudit[0]?.reason,"unverified_address");
  assert.equal(result.unplanned[0]?.reason,"unverified_address");
});
