import TeamCalendarClient from "@/components/TeamCalendarClient";
import { getCalendarMonth, getCalendarWeek } from "@/lib/queries";
import { calendar2WeekNavigation } from "@/lib/calendar2-navigation";
import { todayCphISO, weekMondayToday } from "@/lib/calendar";

export const metadata = { title: "Kalender · Karltoffel" };

// Samme ordre-baserede ugeplan (buildWeekPlan) som /daycalendar og ordre-listerne
// bruger — ÉN kilde til sandhed for hvilke ordrer ligger på hvilken dag/hos hvem.
// Tidligere projekterede denne side direkte fra abonnementer (preview) og kunne afvige fra dagsprogrammet.

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ week?: string; view?: string; month?: string }> }) {
  const params = await searchParams;
  if (params.view === "month") {
    const monthParam = params.month && /^\d{4}-\d{2}$/.test(params.month)
      ? params.month
      : todayCphISO().slice(0, 7); // aktuell måned i Europe/Copenhagen, ikke UTC
    const month = await getCalendarMonth(monthParam);
    return <TeamCalendarClient mode="month" month={month} nav={{}} readOnly basePath="/calendar" />;
  }

  const navigation = calendar2WeekNavigation(params.week ?? weekMondayToday());
  const monday = navigation.monday;
  const week = await getCalendarWeek(monday);
  return (
    <TeamCalendarClient
      mode="week"
      week={week}
      nav={{ prevWeek: navigation.prevWeek, nextWeek: navigation.nextWeek, monthParam: navigation.monthParam }}
      readOnly
      basePath="/calendar"
    />
  );
}
