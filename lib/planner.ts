// ============================================================================
// Weekly route planner — the "auto-scheduler" that Karltoffel runs every night.
// Given the jobs due in a week and each employee's working hours + home base,
// it packs jobs into days and orders each day's stops by nearest-neighbour to
// minimise driving, producing time-slotted, employee-assigned visits.
//
// This is a deterministic first-cut greedy optimiser (no external routing API).
// Constraints honoured: working hours (+ optional flex), per-job fixed weekday
// and fixed employee, service duration, and driving time between stops.
// ============================================================================

import { driveMinutes, driveFromHomeMinutes, HOME, type LatLng } from "./geo";

export type Job = {
  id: number;
  contactId: number;
  customer: string;
  address: string;
  postal: string;
  category: string;
  durationMin: number;
  source: string;
  fixedWeekdays?: number[]; // 0=Mon … 6=Sun; undefined = any working day
  fixedEmployeeId?: number;
  locked?: boolean;         // "Helt fastlåst" — planner may not move it to another day
  lockedWeekday?: number;   // the day it is pinned to (0=Mon)
};

export type Employee = {
  id: number;
  name: string;
  home: LatLng;
  workStartMin: number; // minutes from midnight, e.g. 480 = 08:00
  workEndMin: number;   // e.g. 960 = 16:00
  flexMin: number;      // extra minutes allowed at end of day
  workdays: number[];   // e.g. [0,1,2,3,4] Mon–Fri
};

export type Stop = {
  job: Job;
  startMin: number;
  endMin: number;
  driveMin: number; // driving to reach this stop
  overtime?: boolean; // placeret UD OVER arbejdstid+flex (fallback frem for "Ikke planlagt")
};

export type DayPlan = {
  employeeId: number;
  weekday: number; // 0=Mon
  stops: Stop[];
  driveMin: number;
  serviceMin: number;
};

export type WeekPlan = {
  weekMonday: string; // ISO date
  days: DayPlan[];
  unplanned: Job[];
};

const DEFAULT_EMPLOYEE: Employee = {
  id: 1535, name: "Kristian Klercke", home: HOME,
  workStartMin: 8 * 60, workEndMin: 16 * 60, flexMin: 60, workdays: [0, 1, 2, 3, 4],
};

/** ISO week number of a Monday-date string (yyyy-mm-dd). */
export function isoWeek(mondayISO: string): number {
  const d = new Date(mondayISO + "T00:00:00Z");
  const day = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - day + 3);
  const firstThu = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
  const firstDay = (firstThu.getUTCDay() + 6) % 7;
  firstThu.setUTCDate(firstThu.getUTCDate() - firstDay + 3);
  return 1 + Math.round((d.getTime() - firstThu.getTime()) / (7 * 864e5));
}

/**
 * Core scheduler. Greedy: for each workday, start at home and repeatedly append
 * the nearest still-unscheduled job that fits before end-of-day (incl. flex),
 * respecting the job's fixed weekday/employee. Moves to the next day when full.
 */
export function planWeek(
  jobs: Job[],
  weekMonday: string,
  employees: Employee[] = [DEFAULT_EMPLOYEE],
  opts: { fromWeekday?: number } = {}
): WeekPlan {
  // Dagsbevidsthed: i indeværende uge må NYE placeringer kun ske fra og med
  // i dag (fromWeekday) — før blev en ordre født onsdag lagt på den allerede
  // passerede mandag, hvor ingen så den. Låste/udførte ordrer (pass 1) beholder
  // deres dag: de ER sket / er aftalt med kunden.
  const fromWeekday = opts.fromWeekday ?? 0;
  const remaining = [...jobs];
  const states: { emp: Employee; day: DayPlan; st: { curAddr: string | null; cursor: number }; hardEnd: number }[] = [];

  for (const emp of employees) {
    for (const weekday of emp.workdays) {
      const day: DayPlan = { employeeId: emp.id, weekday, stops: [], driveMin: 0, serviceMin: 0 };
      const st = { curAddr: null as string | null, cursor: emp.workStartMin };
      const hardEnd = emp.workEndMin + emp.flexMin;
      states.push({ emp, day, st, hardEnd });

      const drive = (j: Job) => (st.curAddr === null ? driveFromHomeMinutes(j.address, emp.home) : driveMinutes(st.curAddr, j.address));
      const place = (idx: number, d: number) => {
        const j = remaining.splice(idx, 1)[0];
        const start = st.cursor + d;
        const end = start + j.durationMin;
        day.stops.push({ job: j, startMin: start, endMin: end, driveMin: d });
        day.driveMin += d;
        day.serviceMin += j.durationMin;
        st.cursor = end;
        st.curAddr = j.address;
      };

      // Pass 1: locked orders are pinned to this weekday (respecting fixed
      // employee). They keep their day even if they overrun working hours;
      // route them nearest-first, then fill the rest of the day around them.
      // eslint-disable-next-line no-constant-condition
      while (true) {
        let best: { idx: number; drive: number } | null = null;
        for (let i = 0; i < remaining.length; i++) {
          const j = remaining[i];
          if (!j.locked || j.lockedWeekday !== weekday) continue;
          if (j.fixedEmployeeId && j.fixedEmployeeId !== emp.id) continue;
          const d = drive(j);
          if (!best || d < best.drive) best = { idx: i, drive: d };
        }
        if (!best) break;
        place(best.idx, best.drive);
      }
    }
  }

  // Fælles hjælpere til uge-niveau placering (pass 2+3).
  const driveTo = (s: (typeof states)[number], j: Job) =>
    s.st.curAddr === null ? driveFromHomeMinutes(j.address, s.emp.home) : driveMinutes(s.st.curAddr, j.address);
  const fitsCapacity = (s: (typeof states)[number], j: Job, d: number) =>
    s.day.weekday >= fromWeekday && s.st.cursor + d + j.durationMin <= s.hardEnd;
  const placeOnState = (idx: number, s: (typeof states)[number], d: number) => {
    const j = remaining.splice(idx, 1)[0];
    const start = s.st.cursor + d;
    const end = start + j.durationMin;
    s.day.stops.push({ job: j, startMin: start, endMin: end, driveMin: d });
    s.day.driveMin += d;
    s.day.serviceMin += j.durationMin;
    s.st.cursor = end;
    s.st.curAddr = j.address;
  };
  /** Billigste mulige dag for jobbet blandt `weekdays` (undefined = alle
   *  tilbageværende dage): minimal (dagsbelastning + marginal kørsel), ved
   *  lighed laveste ugedag. Deterministisk. */
  const bestStateFor = (j: Job, weekdays?: number[]) => {
    let best: { s: (typeof states)[number]; d: number; cost: number } | null = null;
    for (const s of states) {
      if (j.fixedEmployeeId != null && j.fixedEmployeeId !== s.emp.id) continue;
      if (s.day.weekday < fromWeekday) continue;
      if (weekdays && !weekdays.includes(s.day.weekday)) continue;
      const d = driveTo(s, j);
      if (!fitsCapacity(s, j, d)) continue;
      const cost = s.day.driveMin + s.day.serviceMin + d;
      if (!best || cost < best.cost || (cost === best.cost && s.day.weekday < best.s.day.weekday)) {
        best = { s, d, cost };
      }
    }
    return best;
  };
  const deferredAnchors = new Set<number>();
  const anchorIdx = () =>
    remaining.findIndex((j) => !j.locked && !deferredAnchors.has(j.id) && j.fixedWeekdays && j.fixedWeekdays.length > 0);

  // Pass 2a — FASTE UGEDAGE ER ANKRE (McDonald's-princippet): abonnementer med
  // faste ugedage placeres FØRST på den billigste af deres faste dage, så alt
  // andet planlægges omkring dem. Andre job MÅ dele ankredagen, hvis der er
  // plads (kapacitetstjekket inkl. kørsel i bestStateFor). Ankre hvis faste
  // dage alle er passeret/fulde udskydes til 2b (fortrukne, ikke blokerende).
  for (let idx = anchorIdx(); idx !== -1; idx = anchorIdx()) {
    const j = remaining[idx];
    const best = bestStateFor(j, j.fixedWeekdays);
    if (best) placeOnState(idx, best.s, best.d);
    else deferredAnchors.add(j.id);
  }

  // Pass 2b — UGE-NIVEAU FORDDELING: hvert resterende job lægges på den
  // tilbageværende dag (>= fromWeekday, respektér medarbejder-binding og
  // kapacitet inkl. kørsel), hvor (dagsbelastning + marginal kørsel) er
  // mindst — i stedet for den gamle grådhed "pak mandag først". Faste ugedage
  // er FORTRUKNE, ikke blokerende: et job, hvis faste dag er passeret/fuld,
  // lander her på den bedste tilbageværende dag — aldrig "Ikke planlagt".
  for (let i = 0; i < remaining.length; ) {
    const j = remaining[i];
    if (j.locked) { i++; continue; } // kun pass 1-placerede (ingen dag matchede)
    const best = bestStateFor(j); // fixedWeekdays er allerede prøvet i 2a — fortrukne, ikke krav
    if (best) placeOnState(i, best.s, best.d);
    else i++; // ingen dag har plads → overarbejds-fallback nedenfor
  }

  // Ruteoptimering pr. dag: kør hver dags stop i deterministisk
  // nærmeste-nabo-rækkefølge fra hjemmet og genberegn tider/kørsel —
  // uge-niveau placeringen vælger DAGENE, denne passer RÆKKEFØLGEN.
  const resequenceDay = (s: (typeof states)[number]) => {
    if (s.day.stops.length < 2) return;
    let cur: string | null = null;
    let cursor = s.emp.workStartMin;
    let driveMin = 0;
    let serviceMin = 0;
    const pool = [...s.day.stops];
    const out: Stop[] = [];
    while (pool.length) {
      let bi = 0, bd = Infinity;
      for (let i = 0; i < pool.length; i++) {
        const d = cur === null ? driveFromHomeMinutes(pool[i].job.address, s.emp.home) : driveMinutes(cur, pool[i].job.address);
        if (d < bd) { bd = d; bi = i; }
      }
      const stop = pool.splice(bi, 1)[0];
      const start = cursor + bd;
      const end = start + stop.job.durationMin;
      out.push({ job: stop.job, startMin: start, endMin: end, driveMin: bd, overtime: stop.overtime });
      driveMin += bd;
      serviceMin += stop.job.durationMin;
      cursor = end;
      cur = stop.job.address;
    }
    s.day.stops = out;
    s.day.driveMin = driveMin;
    s.day.serviceMin = serviceMin;
    s.st.cursor = cursor;
    s.st.curAddr = cur;
  };
  for (const s of states) resequenceDay(s);

  // Pass 3 — OVERARBEJDS-FALLBACK (Michaels beslutning efter uge 35-hændelsen):
  // en ordre, hvis bundne medarbejder ikke har plads inden for arbejdstiden på
  // NOGEN tilbageværende dag, må ikke ende som "Ikke planlagt" — den lægges som
  // overarbejde på medarbejderens tilladte dag med FÆRREST samlede minutter
  // (kørsel+service). Faste ugedage er fortrukne, ikke blokerende (et job hvis
  // faste dag er passeret skal stadig planlægges), og låste ordrer uden match
  // eller ubundne ordrer forbliver ærligt uplacerede.
  // eslint-disable-next-line no-constant-condition
  while (true) {
    let placedAny = false;
    for (let i = 0; i < remaining.length; i++) {
      const j = remaining[i];
      if (j.locked || j.fixedEmployeeId == null) continue;
      const candidates = states.filter(
        (s) => s.emp.id === j.fixedEmployeeId && s.day.weekday >= fromWeekday
      );
      if (!candidates.length) continue;
      const target = candidates.reduce((best, s) => {
        const load = s.day.driveMin + s.day.serviceMin;
        const bestLoad = best.day.driveMin + best.day.serviceMin;
        return load < bestLoad || (load === bestLoad && s.day.weekday < best.day.weekday) ? s : best;
      });
      const d = driveTo(target, j);
      remaining.splice(i, 1);
      const start = target.st.cursor + d;
      const end = start + j.durationMin;
      target.day.stops.push({ job: j, startMin: start, endMin: end, driveMin: d, overtime: true });
      target.day.driveMin += d;
      target.day.serviceMin += j.durationMin;
      target.st.cursor = end;
      target.st.curAddr = j.address;
      placedAny = true;
      break; // genstart scanningen: belastningen har ændret sig
    }
    if (!placedAny) break;
  }
  for (const s of states) resequenceDay(s);

  return { weekMonday, days: states.map((s) => s.day).filter((d) => d.stops.length), unplanned: remaining };
}

export const fmtTime = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/** UTC-tidsstempel for et stops starttid: `weekday` (0=man) dage efter ugens
 *  mandag + `startMin` minutter efter midnat — den persisterede form af
 *  planlæggerens beregnede tid (se planAndPersistWeek i lib/queries.ts). */
export function stopInstant(weekMonday: string, weekday: number, startMin: number): Date {
  return new Date(Date.parse(`${weekMonday}T00:00:00Z`) + weekday * 864e5 + startMin * 60000);
}
