// Shared ISO-week option helpers for the Funktioner forms (holiday planning,
// price adjustment, group messages). A week is identified by its Monday (UTC ISO
// date); the label is the Danish "Uge N, YYYY".
import { isoWeek } from "./planner";

export type WeekOption = { value: string; label: string };

function ymd(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}
/** Monday (UTC midnight) of the week containing `d`. */
export function mondayOf(d: Date): Date {
  const wd = (d.getUTCDay() + 6) % 7;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - wd * 864e5);
}

/** ISO-ugeåret for en mandag: året for ugens TORSDAG. Mandagens kalenderår er
 *  forkert ved årsskifte — fx er 2025-12-29 mandag i uge 1, 2026. */
export function isoWeekYear(mondayISO: string): number {
  return new Date(Date.parse(`${mondayISO}T00:00:00Z`) + 3 * 864e5).getUTCFullYear();
}

/** `count` week options starting `offsetWeeks` from the week of `ref`. */
export function weekOptions(ref: Date, count = 52, offsetWeeks = 0): WeekOption[] {
  const first = mondayOf(ref).getTime() + offsetWeeks * 7 * 864e5;
  return Array.from({ length: count }, (_, i) => {
    const iso = ymd(new Date(first + i * 7 * 864e5));
    return { value: iso, label: `Uge ${isoWeek(iso)}, ${isoWeekYear(iso)}` };
  });
}

/** "Uge N, YYYY" label for a Monday ISO date (YYYY = ISO-ugeåret). */
export function weekLabel(mondayISO: string): string {
  return `Uge ${isoWeek(mondayISO)}, ${isoWeekYear(mondayISO)}`;
}
