import { getCalendarWeek, getCalendarMonth } from "@/lib/queries";
import TeamCalendarClient from "@/components/TeamCalendarClient";

export const metadata = { title: "Kalender · Karltoffel" };

const iso = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;

/** Monday (UTC) of the ISO week containing `d`. */
function mondayOf(d: Date): string {
  const wd = (d.getUTCDay() + 6) % 7;
  return iso(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()) - wd * 864e5));
}
function shift(mondayISO: string, days: number): string {
  const d = new Date(`${mondayISO}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return iso(d);
}

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ week?: string; view?: string; month?: string }> }) {
  const sp = await searchParams;

  if (sp.view === "month") {
    const now = new Date();
    const anchor = sp.month && /^\d{4}-\d{2}$/.test(sp.month)
      ? sp.month
      : `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    const month = await getCalendarMonth(anchor);
    return <TeamCalendarClient mode="month" month={month} nav={{}} />;
  }

  const monday = sp.week && /^\d{4}-\d{2}-\d{2}$/.test(sp.week)
    ? mondayOf(new Date(`${sp.week}T00:00:00Z`))
    : mondayOf(new Date());

  const week = await getCalendarWeek(monday);
  return (
    <TeamCalendarClient
      mode="week"
      week={week}
      nav={{ prevWeek: shift(monday, -7), nextWeek: shift(monday, 7), monthParam: monday.slice(0, 7) }}
    />
  );
}
