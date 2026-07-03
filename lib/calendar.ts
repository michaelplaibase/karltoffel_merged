// Calendar / day-program mock data (Phase 2, UI-first). Values mirror the sample week
// observed in the portal (Uge 27, 2026). Category colors come from lib/categories.ts.

export type Employee = { id: number; name: string; color: string; active: boolean };

export const EMPLOYEES: Employee[] = [
  { id: 1535, name: "Kristian Klercke", color: "#a4d5ee", active: true },
];

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
};

export type WeekDay = { label: string; date: string; revenue: number; driving?: string };

export const WEEK_LABEL = "Jun. – Jul. 2026";
export const WEEK_NO = 27;

export const WEEK_DAYS: WeekDay[] = [
  { label: "man", date: "29", revenue: 2329, driving: "1 t 11 min" },
  { label: "tir", date: "30", revenue: 0 },
  { label: "ons", date: "1", revenue: 0 },
  { label: "tor", date: "2", revenue: 0 },
  { label: "fre", date: "3", revenue: 0 },
  { label: "lør", date: "4", revenue: 0 },
  { label: "søn", date: "5", revenue: 0 },
];

export const EVENTS: CalEvent[] = [
  { id: 1969863, day: 0, start: 8.5, end: 9.5, postal: "8660 Skanderborg", customer: "McDonald's Stilling", category: "Vinduespudsning", status: "afventer", type: "abonnement", lock: "fastlaast", employeeId: 1535 },
  { id: 1969944, day: 0, start: 9.93, end: 10.68, postal: "8700 Horsens", customer: "Nordic Sport Invest 2", category: "Viceværtservice", status: "afventer", type: "abonnement", lock: "delvist", employeeId: 1535 },
];

export const PLANNED = { weekLabel: "Uge 27", week: 2329, monthLabel: "Juni", month: 20849 };

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
};

export const DAY = {
  heading: "16. nov. 2026",
  relative: "mandag (uge 47)",
  revenueDay: 2898, revenueWeek: 2898, revenueMonth: 14849,
  driving: "1 t 14 min",
};

export const DAY_STOPS: DayStop[] = [
  { from: "08:30", to: "09:00", address: "Ørstedsvej 4, 8660 Skanderborg", customer: "McDonald's Stilling", price: 940, employee: "Kristian Klercke", source: "Abo. #235844" },
  { from: "09:44", to: "11:14", address: "Hospitalsgade 6, 8700 Horsens", customer: "Nordic Sport Invest 2", price: 811, employee: "Kristian Klercke", source: "Abo. #235837" },
  { from: "12:10", to: "12:40", address: "Vejlevej 120, 8700 Horsens", customer: "Bilhuset A/S", price: 620, employee: "Kristian Klercke", source: "Manuel ordre" },
];
