import TeamCalendarClient from "@/components/TeamCalendarClient";
import { getCalendarMonth, getCalendarWeek } from "@/lib/queries";
import { calendar2WeekNavigation } from "@/lib/calendar2-navigation";
import { todayCphISO, weekMondayToday } from "@/lib/calendar";
import { getSessionUser } from "@/lib/api-auth";
import { redirect } from "next/navigation";

export const metadata = { title: "Kalender · Karltoffel Business Manager" };

// Samme ordre-baserede ugeplan (buildWeekPlan) som /daycalendar og ordre-listerne
// bruger — ÉN kilde til sandhed for hvilke ordrer ligger på hvilken dag/hos hvem.
// Tidligere projekterede denne side direkte fra abonnementer (preview) og kunne afvige fra dagsprogrammet.

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ week?: string; view?: string; month?: string }> }) {
  const params = await searchParams;
  // Samme viewer-regel som /daycalendar: admin ser hele teamet, en almindelig
  // medarbejder kun sig selv. Uden viewer håndhævede kalenderen aldrig reglen.
  // getSessionUser er null for udløbne OG deaktiverede brugere — uden redirect
  // ville viewer=undefined betyde "vis alt" (eskaleret team-visning).
  const me = await getSessionUser();
  if (!me) redirect("/login");
  const viewer = { id: me.id, isAdmin: me.isAdmin };
  // Admin får den redigerbare kalender (kontekstmenu: lås/flyt/slet + "Genplanlæg
  // uge"). Medarbejdere får flytterettigheder (moveOnly): de kan flytte ordrer
  // til andre uger og låse/frigøre dem, men IKKE genplanlægge hele ugen eller
  // slette ordrer (samt "Mere …"-undermenuen med slet/notifikation). Selve
  // handlingerne håndhæves server-side af guardAction i app/actions/orders.ts.
  const readOnly = false;
  const moveOnly = !me.isAdmin;
  if (params.view === "month") {
    const monthParam = params.month && /^\d{4}-\d{2}$/.test(params.month)
      ? params.month
      : todayCphISO().slice(0, 7); // aktuell måned i Europe/Copenhagen, ikke UTC
    const month = await getCalendarMonth(monthParam, viewer);
    return <TeamCalendarClient mode="month" month={month} nav={{}} readOnly={readOnly} moveOnly={moveOnly} basePath="/calendar" />;
  }

  const navigation = calendar2WeekNavigation(params.week ?? weekMondayToday());
  const monday = navigation.monday;
  const week = await getCalendarWeek(monday, viewer);
  return (
    <TeamCalendarClient
      mode="week"
      week={week}
      nav={{ prevWeek: navigation.prevWeek, nextWeek: navigation.nextWeek, monthParam: navigation.monthParam }}
      readOnly={readOnly}
      moveOnly={moveOnly}
      basePath="/calendar"
    />
  );
}
