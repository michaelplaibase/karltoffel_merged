import TeamCalendarClient from "@/components/TeamCalendarClient";
import { getSubscriptionPreviewMonth, getSubscriptionPreviewWeek } from "@/lib/subscription-preview-calendar";

export const metadata = { title: "Kalender 2 · Forhåndsvisning · Karltoffel" };

const iso = (date: Date) => date.toISOString().slice(0, 10);

function mondayOf(date: Date): string {
  const weekday = (date.getUTCDay() + 6) % 7;
  return iso(new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - weekday * 864e5));
}

function shift(mondayISO: string, days: number): string {
  const date = new Date(`${mondayISO}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return iso(date);
}

export default async function CalendarPreviewPage({ searchParams }: { searchParams: Promise<{ week?: string; view?: string; month?: string }> }) {
  const params = await searchParams;
  if (params.view === "month") {
    const now = new Date();
    const monthParam = params.month && /^\d{4}-\d{2}$/.test(params.month)
      ? params.month
      : `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}`;
    const month = await getSubscriptionPreviewMonth(monthParam);
    return <TeamCalendarClient mode="month" month={month} nav={{}} readOnly basePath="/calendar-2" previewLabel="Forhåndsvisning" />;
  }

  const monday = params.week && /^\d{4}-\d{2}-\d{2}$/.test(params.week)
    ? mondayOf(new Date(`${params.week}T00:00:00Z`))
    : mondayOf(new Date());
  const week = await getSubscriptionPreviewWeek(monday);
  return (
    <TeamCalendarClient
      mode="week"
      week={week}
      nav={{ prevWeek: shift(monday, -7), nextWeek: shift(monday, 7), monthParam: monday.slice(0, 7) }}
      readOnly
      basePath="/calendar-2"
      previewLabel="Forhåndsvisning"
    />
  );
}
