import Link from "next/link";
import { getDayProgram } from "@/lib/queries";
import { weekMondayToday } from "@/lib/calendar";
import DayStopCard from "@/components/DayStopCard";
import { requireSession } from "@/lib/api-auth";
import { getOpenTimeEntry, cphTime } from "@/lib/timesheet";
import CheckInOut from "@/components/CheckInOut";

export const metadata = { title: "Dagsprogram · Karltoffel" };

export default async function DayCalendarPage({ searchParams }: { searchParams: Promise<{ date?: string }> }) {
  const sp = await searchParams;
  const date = /^\d{4}-\d{2}-\d{2}$/.test(sp.date ?? "") ? sp.date! : weekMondayToday();
  const day = await getDayProgram(date);
  const userId = await requireSession();
  const open = userId != null ? await getOpenTimeEntry(userId) : null;

  return (
    <div className="container-1140">
      <CheckInOut checkedIn={!!open} sinceLabel={open ? cphTime(open.checkIn) : null} />
      <div className="daycal-toolbar">
        <Link href={`/daycalendar?date=${day.prevISO}`} className="calbtn">‹</Link>
        <h1 className="title">{day.heading}</h1>
        <span className="badge badge-soft-muted">{day.relative}</span>
        <Link href={`/daycalendar?date=${day.nextISO}`} className="calbtn">›</Link>
        <span style={{ flex: 1 }} />
        <Link href={`/calendar?week=${day.weekMonday}`} className="btn btn-light btn-sm">Gå til ugen i kalender</Link>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="daycal-summary">
            <span>Planlagt omsætning (dag/uge/måned): <b>Kr. {day.revenueDay.toLocaleString("da-DK")} / {day.revenueWeek.toLocaleString("da-DK")} / {day.revenueMonth.toLocaleString("da-DK")}</b></span>
            <span>Planlagt kørsel: <b>{day.driving}</b></span>
          </div>

          {day.stops.length === 0 ? (
            <div className="table-empty">Ingen planlagte ordrer denne dag</div>
          ) : day.stops.map((s) => <DayStopCard key={s.orderId} stop={s} weekMonday={day.weekMonday} />)}
        </div>
      </div>
    </div>
  );
}
