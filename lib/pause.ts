// Sæsonpause ("Måneder på pause") — DELT, ren (pure) hjælpelogik for pause-
// vinduet, så ABONNEMENTETS opgave-generering (lib/recurrence.ts) og TILBUDDETS
// årshjul (lib/tilbud.mts) aldrig kan være uenige om, hvornår en opgave er på
// pause. Ingen prisma/DB — kan testes med node --test uden database.
//
// Feltmønsteret spejler TaskLine/TilbudLine pauseActive/pauseStart/pauseEnd/
// pauseYearly. Vinduet skrives som ISO-datoer 'YYYY-MM-DD' og MÅ krydse nytår
// (fx 31/10 → 30/03). pauseYearly=true gentager hvert år (kun måned/dag
// sammenlignes); false = "kun denne sæson" (absolutte ISO-datoer).

export type PauseTimings = {
  pauseActive: boolean;
  pauseStart: string | null;
  pauseEnd: string | null;
  pauseYearly: boolean;
};

/** Er ISO-datoen 'YYYY-MM-DD' inden for opgavens pausevindue? Wrap-bevidst
 *  (okt→mar dækker 10-12, 1-3). Uden aktive/gyddig pause → false. */
export function isPausedOnIso(t: PauseTimings, iso: string): boolean {
  if (!t.pauseActive || !t.pauseStart || !t.pauseEnd) return false;
  const mmdd = iso.slice(5); // 'MM-DD'
  if (t.pauseYearly) {
    const s = t.pauseStart.slice(5), e = t.pauseEnd.slice(5);
    return s <= e ? mmdd >= s && mmdd <= e : mmdd >= s || mmdd <= e;
  }
  return iso >= t.pauseStart && iso <= t.pauseEnd;
}

/** ISO-datoen 'YYYY-MM-DD' for MANDAGEN i år `year`'s ISO-uge `week`
 *  (1–53). Samme mandag-af-ISO-uge-matematik som lib/recurrence.ts, men ren —
 *  brugt af årshjulet til at koble et ugenummer på en konkret dato, så
 *  pausevinduet kan anvendes. */
export function isoMondayOfIsoWeek(year: number, week: number): string {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Weekday = (jan4.getUTCDay() + 6) % 7; // 0 = mandag
  const week1Monday = jan4.getTime() - jan4Weekday * 864e5;
  return new Date(week1Monday + (week - 1) * 7 * 864e5).toISOString().slice(0, 10);
}
