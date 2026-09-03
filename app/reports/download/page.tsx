import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/api-auth";
import { todayCphISO } from "@/lib/calendar";

export const metadata = { title: "Rapporter · Karltoffel Business Manager" };

// Uden denne prerenderes siden ved BUILD (ingen request-time-API'er ⇒ statisk i
// Next' default-model), og default-datoerne fryser på deploy-dagen — tre uger
// efter et deploy foreslår felterne stadig deploy-månedens datoer.
export const dynamic = "force-dynamic";

/** Indeværende måneds første/sidste dag (dansk tid) som YYYY-MM-DD — rapportens
 *  default-periode. todayCphISO, ikke UTC: kl. 00-02 dansk tid er UTC-datoen i går. */
function monthRange(): { start: string; end: string } {
  const [y, m] = todayCphISO().split("-").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  const last = new Date(Date.UTC(y, m, 0)).getUTCDate();
  return { start: `${y}-${pad(m)}-01`, end: `${y}-${pad(m)}-${pad(last)}` };
}

export default async function ReportDownloadPage() {
  // Rapporterne (og CSV-endpoints'ene bag knapperne) er admin-flader — samme
  // besked som /payroll i stedet for et råt 403 fra API-ruten.
  const me = await getSessionUser();
  if (me == null) redirect("/login");
  if (!me.isAdmin) {
    return (
      <div className="container-1140" style={{ maxWidth: 760 }}>
        <div className="card"><div className="card-body">
          <h1 className="page-title">Rapporter</h1>
          <div className="table-empty">Kun administratorer har adgang til rapporterne.</div>
        </div></div>
      </div>
    );
  }

  const { start, end } = monthRange();
  return (
    <div className="container-1140" style={{ maxWidth: 760 }}>
      <h1 className="page-title">Rapporter</h1>

      <div className="card">
        <div className="card-body">
          <h4 className="section-title">Hent ordrerapport</h4>
          <p className="muted" style={{ marginBottom: 18 }}>Download ordrerapport i Excel-format for den valgte periode.</p>
          <form action="/api/reports/orders" method="get">
            <div className="f2">
              <label className="col-label">Startdato</label>
              <input className="form-control" type="date" name="start" defaultValue={start} />
            </div>
            <div className="f2">
              <label className="col-label">Slutdato</label>
              <input className="form-control" type="date" name="end" defaultValue={end} />
            </div>
            <hr className="section-hr" />
            <button className="btn btn-primary" type="submit">Hent rapport</button>
          </form>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <h4 className="section-title">Hent abonnementer</h4>
          <p className="muted" style={{ marginBottom: 18 }}>Download en rapport over alle dine aktive abonnementer i CSV-format.</p>
          <form action="/api/reports/subscriptions" method="get">
            <button className="btn btn-primary" type="submit">Hent rapport</button>
          </form>
        </div>
      </div>
    </div>
  );
}
