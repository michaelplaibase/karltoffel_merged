import Link from "next/link";
import { DAY, DAY_STOPS } from "@/lib/calendar";
import { money } from "@/components/ui";

export const metadata = { title: "Dagsprogram · Karltoffel" };

export default function DayCalendarPage() {
  return (
    <div className="container-1140">
      <div className="daycal-toolbar">
        <button className="calbtn">‹</button>
        <h1 className="title">{DAY.heading}</h1>
        <span className="badge badge-soft-muted">{DAY.relative}</span>
        <button className="calbtn">›</button>
        <span style={{ flex: 1 }} />
        <Link href="/calendar" className="btn btn-light btn-sm">Gå til ugen i kalender</Link>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="daycal-summary">
            <span>Planlagt omsætning (dag/uge/måned): <b>Kr. {DAY.revenueDay.toLocaleString("da-DK")} / {DAY.revenueWeek.toLocaleString("da-DK")} / {DAY.revenueMonth.toLocaleString("da-DK")}</b></span>
            <span>Planlagt kørsel: <b>{DAY.driving}</b></span>
          </div>

          {DAY_STOPS.map((s, i) => (
            <div className="daycal-stop" key={i}>
              <div>
                <div className="when">{s.from} - {s.to}</div>
                <a className="maplink" href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(s.address)}`} target="_blank" rel="noopener noreferrer">
                  <i className="bi bi-geo-alt-fill" /> {s.address}
                </a>
                <div style={{ fontWeight: 600, marginTop: 2 }}>{s.customer} · <span className="num">{money(s.price)}</span></div>
                <div className="daycal-icons">
                  <span><i className="bi bi-list-task" /> opgaver</span>
                  <span><i className="bi bi-image" /> fotos</span>
                  <span><i className="bi bi-info-circle" /> bemærkninger</span>
                  <span><i className="bi bi-card-checklist" /> ordrehistorik</span>
                  <span><i className="bi bi-bell" /> notifikation</span>
                </div>
              </div>
              <div className="row-actions">
                <button className="btn btn-primary btn-sm">Afslut ordre</button>
                <button className="btn btn-light btn-sm">Rediger ordre</button>
                <button className="btn btn-light btn-sm">Rediger abo.</button>
                <button className="btn btn-light btn-sm">Mere ▾</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
