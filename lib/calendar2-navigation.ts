import { isoWeek } from "./planner";

const iso = (date: Date) => date.toISOString().slice(0, 10);

export function mondayOfISO(value: string, fallback = new Date()): string {
  const date = /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T00:00:00Z`) : fallback;
  const weekday = (date.getUTCDay() + 6) % 7;
  return iso(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - weekday * 864e5));
}

export function shiftCalendarWeek(mondayISO: string, days: number): string {
  const date = new Date(`${mondayISO}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return iso(date);
}

export function calendar2WeekNavigation(value: string) {
  const monday = mondayOfISO(value);
  return { monday, weekNo: isoWeek(monday), prevWeek: shiftCalendarWeek(monday, -7), nextWeek: shiftCalendarWeek(monday, 7), monthParam: monday.slice(0, 7) };
}
