import { getSessionUser } from "@/lib/api-auth";
import { redirect } from "next/navigation";
import { HOLIDAYS as H } from "@/lib/funktioner";
import { getHolidays } from "@/lib/queries";
import { weekOptions } from "@/lib/weeks";
import HolidayManager from "@/components/HolidayManager";

export const metadata = { title: "Ferieplanlægning · Karltoffel" };

export default async function HolidaysPage() {
  // Kun administratorer — funktionssiderne er admin-only (Thomas, 2026-08-31).
  const me = await getSessionUser();
  if (me == null) redirect("/login");
  if (!me.isAdmin) redirect("/calendar");
  const holidays = await getHolidays();
  const weekOpts = weekOptions(new Date(), 52, 1); // from next week, ~a year ahead
  return (
    <div className="container-1140" style={{ maxWidth: 900 }}>
      <h1 className="page-title">{H.title}</h1>

      <div className="card">
        <div className="card-body">
          <h4 className="section-title">Forklaring</h4>
          <p style={{ fontWeight: 500, color: "var(--heading)" }}>{H.warning}</p>
          <p className="muted">{H.body}</p>
          <p style={{ fontWeight: 500, marginTop: 14, marginBottom: 6 }}>Vær opmærksom på:</p>
          <ul className="muted" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7, fontSize: 13 }}>
            {H.bullets.map((b, i) => <li key={i}>{b}</li>)}
          </ul>
          <p style={{ fontWeight: 500, marginTop: 14, marginBottom: 6 }}>Eksempel:</p>
          <ul className="muted" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7, fontSize: 13 }}>
            {H.example.map((b, i) => <li key={i}>{b}</li>)}
          </ul>
        </div>
      </div>

      <HolidayManager holidays={holidays} weekOpts={weekOpts} saveLabel={H.saveLabel} />
    </div>
  );
}
