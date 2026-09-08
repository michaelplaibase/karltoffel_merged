// Per-opgave medarbejder-aftale (Thomas, 2026-09-07): en abonnements-opgave kan
// være bundet til en bestemt medarbejder (TaskLine.employeeId), mens andre
// opgaver på samme besøg følger den almindelige tildeling. Ren funktion —
// tager id'er ind og returnerer et besøgs-employeeId, som generatoren
// (lib/recurrence.ts) bruger til den materialiserede ordre.
//
// Aftale: er ALLE opgaver på besøget bundet til SAMME medarbejder, bliver det
// besøgets medarbejder (en ren af-vikling af abonnementets faste medarbejder).
// Er nogen opgaver bundet til forskellige/ingen, kan besøget ikke have ÉN
// medarbejder uden at drukne de andres tildeling — ordren står uden (null) og
// planlægges af den normale ugeplanlægger, hvor de enkelte linjers binding
// vises på kortene/dagsprogrammet.

export type TaskEmployeeLike = { employeeId: number | null };

/** Besøgets medarbejder ud fra opgavelinjernes per-opgave bindinger.
 *  - alle satte employeeIds ens → dét id
 *  - ingen satte → null (besøget følger den almindelige planlægning)
 *  - blandede (forskellige eller delvist satte) → null */
export function visitEmployeeIdFromTasks(tasks: TaskEmployeeLike[]): number | null {
  let picked: number | null = null;
  for (const t of tasks) {
    if (t.employeeId == null) return null; // mindst én ubundet → ingen besøgs-binding
    if (picked == null) picked = t.employeeId;
    else if (picked !== t.employeeId) return null; // to forskellige → ingen besøgs-binding
  }
  return picked;
}
