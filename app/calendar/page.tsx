import TeamCalendarClient from "@/components/TeamCalendarClient";
import { getSubscriptionPreviewMonth, getSubscriptionPreviewWeek } from "@/lib/subscription-preview-calendar";
import { calendar2WeekNavigation } from "@/lib/calendar2-navigation";

export const metadata = { title: "Kalender · Karltoffel" };

function mondayOf(date: Date): string {
  // Ugedag/dato beregnes i Europe/Copenhagen, ikke UTC (undgå forkert uge ved
  // midnat-1 og søndag aften).
  const cph = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Copenhagen", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
  const [y, m, d] = cph.split("-").map(Number);
  const weekday = (new Date(Date.UTC(y, m - 1, d)).getUTCDay() + 6) % 7;
  return new Date(Date.UTC(y, m - 1, d - weekday)).toISOString().slice(0, 10);
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