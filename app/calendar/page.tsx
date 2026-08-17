import TeamCalendarClient from "@/components/TeamCalendarClient";
import { getSubscriptionPreviewMonth, getSubscriptionPreviewWeek } from "@/lib/subscription-preview-calendar";
import { calendar2WeekNavigation } from "@/lib/calendar2-navigation";

export const metadata = { title: "Kalender · Karltoffel" };

const iso = (date: Date) => date.toISOString().slice(0, 10);

function mondayOf(date: Date): string {
  const weekday = (date.getUTCDay() + 6) % 7;
  return iso(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - weekday * 864e5));
}

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ week?: string; view?: string; month?: string }> }) {
  const params = await searchParams;
  if (params.view === "month") {
    const now = new Date();
    const monthParam = params.month && /^\d{4}-\d{2}$/.test(params.month)
      ? params.month
      : `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    const month = await getSubscriptionPreviewMonth(monthParam);
    return <TeamCalendarClient mode="month" month={month} nav={{}} readOnly basePath="/calendar" />;
  }

  const navigation = calendar2WeekNavigation(params.week ?? mondayOf(new Date()));
  const monday = navigation.monday;
  const week = await getSubscriptionPreviewWeek(monday);
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