// Ugedage-begrænsning på abonnements-opgaver (TaskLine.weekdays).
//
// Format: digit-streng "0"-"6", 0=mandag … 6=søndag (samme konvention som
// Subscription.fixedWeekdays og plannerens Job.fixedWeekdays). null/tom streng
// = ingen begrænsning — opgaven må køre alle ugedage.
//
// Ren funktion — deles af server-action'en (persist), generatoren (recurrence.ts),
// kalender-forespørgslerne (queries.ts) og preview-projektionen
// (subscription-preview.ts), så alle steder fortolker felteret ens.

export const WEEKDAYS_DA = ["Mandag", "Tirsdag", "Onsdag", "Torsdag", "Fredag", "Lørdag", "Søndag"] as const;
export const WEEKDAYS_DA_SHORT = ["Man", "Tir", "Ons", "Tor", "Fre", "Lør", "Søn"] as const;

/** Fortolk en digit-streng ("013") som ugedags-indekser [0,1,3]. Invalidere
 *  tegn ignoreres. Tom/null → undefined (ingen begrænsning). */
export function parseWeekdayDigits(value: string | null | undefined): number[] | undefined {
  if (!value) return undefined;
  const days = [...value].map(Number).filter((d) => Number.isInteger(d) && d >= 0 && d <= 6);
  return days.length ? [...new Set(days)].sort((a, b) => a - b) : undefined;
}

/** Serielagring: [0,1,3] → "013". Tom liste → null (ingen begrænsning). */
export function weekdayDigits(days: readonly number[] | undefined | null): string | null {
  if (!days?.length) return null;
  return [...new Set(days)].sort((a, b) => a - b).join("");
}

/**
 * Effektive planlægnings-ugedage for et BESØG (ordre/job), når enkelte
 * opgaver har deres egen ugedags-begrænsning:
 *  - Udgangspunkt er abonnementets fixedWeekdays (kan være undefined = alle dage).
 *  - Hver opgave med en begrænsning indsnævrer mængden (skæring).
 *  - Tom skæring (modstridende konfiguration, fx to opgaver med hver sin dag)
 *    falder tilbage til foreningen af opgave-begrænsningerne — planlægning må
 *    aldrig blive umulig på grund af en konfigurationsfejl.
 *  - Ingen begrænsninger nogen steder → undefined (alle hverdage tilladt).
 */
export function effectiveVisitWeekdays(
  subscriptionFixed: string | null | undefined,
  taskWeekdays: readonly (string | null | undefined)[],
): number[] | undefined {
  let effective = parseWeekdayDigits(subscriptionFixed);
  const taskSets: number[][] = [];
  for (const tw of taskWeekdays) {
    const set = parseWeekdayDigits(tw);
    if (set) taskSets.push(set);
  }
  if (!taskSets.length) return effective;
  for (const set of taskSets) {
    effective = effective ? effective.filter((d) => set.includes(d)) : set;
  }
  if (effective?.length) return effective;
  // Tom skæring — konfigurationsfejl: foreningen er den mindst restriktive
  // (og dermed mindst skadelige) fortolkning.
  return [...new Set(taskSets.flat())].sort((a, b) => a - b);
}
