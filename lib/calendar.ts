// Calendar / day-program view types + static layout config.
// The DATA (events, per-day revenue/driving, day program) is produced from the
// database by the auto-planner — see getCalendarWeek / getDayProgram in
// lib/queries.ts. This module only holds the presentational constants and the
// shapes the calendar UI renders.

export type Employee = { id: number; name: string; color: string; active: boolean };

export type CalStatus = "afsluttet" | "afventer" | "ikke_afsluttet" | "mislykket";
export type CalType = "abonnement" | "online" | "manuel";
export type LockState = "fastlaast" | "delvist" | "frigjort";

export type CalEvent = {
  id: number;
  day: number;      // 0 = Monday … 6 = Sunday
  start: number;    // decimal hours, e.g. 8.5 = 08:30
  end: number;
  postal: string;   // "8660 Skanderborg"
  customer: string; // site / customer name
  category: string; // drives the type icon letter/colour
  status: CalStatus;
  type: CalType;
  lock: LockState;
  employeeId: number;
  contactId: number;            // → /customers/{contactId}
  subscriptionNo: number | null; // source "Abo. nr." → /subscriptions/{no} (null for manual/online)
};

export type WeekDay = { label: string; date: string; revenue: number; driving?: string };

/** A job the auto-planner could not place on the board this week. */
export type UnplannedJob = {
  id: number; postal: string; customer: string; category: string;
  status: CalStatus; contactId: number; subscriptionNo: number | null;
  reason: "unassigned" | "overflow"; // no employee vs. didn't fit the week
};

export type CalendarWeek = {
  weekNo: number;
  weekLabel: string;
  monday: string;
  employees: Employee[];
  days: WeekDay[];
  events: CalEvent[];
  unplanned: UnplannedJob[];
  planned: { weekLabel: string; week: number; monthLabel: string; month: number };
};

// ---------- Month view ----------
export type MonthChip = {
  id: number; weekday: number;            // 0=Mon..6=Sun within its week
  employeeId: number; label: string;      // customer (fallback postal)
  postal: string; category: string; status: CalStatus; contactId: number;
};
export type MonthDay = {
  dateISO: string; dateNum: number; weekday: number; // 0..6
  inMonth: boolean; isToday: boolean; chips: MonthChip[];
};
export type MonthWeek = { weekNo: number; monday: string; holiday: boolean; days: MonthDay[] }; // days length 7 Mon..Sun
export type MonthCell = { count: number; revenue: number };
export type MonthMatrixRow = { employeeId: number; cells: MonthCell[]; total: MonthCell };
export type CalendarMonth = {
  year: number; monthIdx: number; monthLabel: string;   // monthLabel e.g. "Juli 2026"
  monthParam: string;                                    // "YYYY-MM" of this month
  prevMonth: string; nextMonth: string;                  // "YYYY-MM" for nav
  employees: Employee[];                                 // the lib/calendar Employee shape (id,name,color,active)
  weeks: MonthWeek[];                                    // variant A date grid (4-6 weeks)
  weekNos: number[];                                     // variant B columns
  matrix: MonthMatrixRow[];                              // variant B rows, ONE per employee (same order as employees)
  colTotals: MonthCell[];                                // per-week totals (aligned to weekNos)
  grandTotal: MonthCell;
};

// The demo week the calendar/day-program open on (Monday of ISO week 27, 2026).
export const WEEK_MONDAY = "2026-06-29";

// working-hours window shown on the grid (business hours)
export const WORK_START = 8;   // 08:00
export const WORK_END = 16;    // 16:00
export const GRID_START = 6;   // grid first row
export const GRID_END = 20;    // grid last row

export const LEGEND = {
  planning: [
    { label: "Helt fastlåst", color: "#3a3a3a", fill: "#efefef" },
    { label: "Delvist frigjort", color: "#7f8fa4", fill: "#eef2f6" },
    { label: "Helt frigjort", color: "#c4d2dd", fill: "#f7f8fb" },
  ],
  status: [
    { label: "Afsluttet", color: "#1CBD6B", fill: "#e4f5ec" },
    { label: "Ikke afsluttet", color: "#5A6169", fill: "#eef1f5" },
    { label: "Mislykket planl.", color: "#C4183C", fill: "#fbe8e8" },
    { label: "Afventer planl.", color: "#257BB6", fill: "#e8f3fb" },
  ],
  type: ["Abonnement", "Online", "Manuel"],
  notification: ["Deaktiveret", "Planlagt", "Afsendt", "Fejl", "Kun dato", "Dato og klokkeslæt"],
  other: ["Arbejdstid", "Fleksibel arbejdstid", "Lukketid", "Kørsel"],
};

// ---------- Day program ----------
export type DayStop = {
  from: string; to: string;
  address: string; customer: string; price: number;
  employee: string; source: string;
  orderId: number;
  contactId: number;
  subscriptionNo: number | null;
  status: string;
  tasks: { category: string; letter: string; description: string; price: number; durationMin: number }[];
  comment: string;
  addressNote: string;
};

export type DayProgram = {
  heading: string;
  relative: string;
  dateISO: string;      // the day shown (for ‹ / › navigation)
  weekMonday: string;   // Monday of the shown week (for "Gå til ugen i kalender")
  prevISO: string;
  nextISO: string;
  revenueDay: number; revenueWeek: number; revenueMonth: number;
  driving: string;
  stops: DayStop[];
};

/** Map an order source label ("Abo. #…", "Online ordre", …) to the calendar type. */
export function sourceType(src: string): CalType {
  if (src.startsWith("Abo")) return "abonnement";
  if (src.startsWith("Online")) return "online";
  return "manuel";
}
