import { getEmployeeOptions } from "@/lib/queries";
import { getSessionUser } from "@/lib/api-auth";
import { todayCphISO } from "@/lib/calendar";
import { redirect } from "next/navigation";

export const metadata = { title: "Dagsprogram i PDF · Karltoffel Business Manager" };

export default async function DayPdfPage() {
  const me = await getSessionUser();
  if (!me) redirect("/login");
  // Dagens dato i DANSK tid — serverens UTC-dato er en dag bagud efter midnat.
  const today = todayCphISO();
  // Rigtige medarbejdere fra databasen (før: én hardkodet attrap-option).
  // Kun admin kan vælge — en medarbejder får altid sit eget program.
  const options = me.isAdmin ? await getEmployeeOptions() : [];
  return (
    <div className="container-1140" style={{ maxWidth: 760 }}>
      <h1 className="page-title">Dagsprogram</h1>
      <div className="card">
        <div className="card-body">
          <h4 className="section-title">Hent dagsprogram i PDF</h4>
          <p className="muted" style={{ marginBottom: 18 }}>Download dagsprogram i PDF-format for den valgte medarbejder og dato.</p>
          <form action="/api/reports/day-pdf" method="get">
            <div className="f2">
              <label className="col-label">Medarbejder</label>
              {me.isAdmin ? (
                <select className="form-control form-control-sm" name="employeeId" defaultValue="">
                  <option value="">Alle medarbejdere</option>
                  {options.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              ) : (
                <input className="form-control form-control-sm" value={`${me.firstName} ${me.lastName}`} disabled />
              )}
            </div>
            <div className="f2">
              <label className="col-label">Dato</label>
              <input className="form-control" type="date" name="date" defaultValue={today} />
            </div>
            <hr className="section-hr" />
            <button className="btn btn-primary" type="submit">Hent dagsprogram</button>
          </form>
        </div>
      </div>
    </div>
  );
}
