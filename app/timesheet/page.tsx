import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/api-auth";
import { getTimesheet } from "@/lib/timesheet";

export const metadata = { title: "Timeregistrering · Karltoffel" };

export default async function TimesheetPage() {
  const me = await getSessionUser();
  if (me == null) redirect("/login");
  // Kun administratorer — Funktionsmenuen er admin-only (Thomas, 2026-08-31).
  if (!me.isAdmin) redirect("/calendar");
  // Én sektion PR. medarbejder (admin) hhv. kun egne registreringer — hentet
  // med en grænse pr. bruger, så historikken ikke skrumper med antallet af ansatte.
  const { isAdmin, groups } = await getTimesheet(me.id);
  const harRækker = groups.some((g) => g.rows.length > 0);

  return (
    <div className="container-1140">
      <h1 className="page-title">Timeregistrering</h1>
      <p className="page-desc">
        {isAdmin
          ? "Check ind/ud-registreringer pr. medarbejder (seneste 100 pr. person)."
          : "Dine egne check ind/ud-registreringer."}
      </p>

      {!harRækker ? (
        <div className="card">
          <div className="card-body">
            <div className="table-empty">Ingen registreringer endnu</div>
          </div>
        </div>
      ) : (
        groups.filter((g) => g.rows.length > 0).map((g) => (
          <div className="card" key={g.userId}>
            <div className="card-body">
              {isAdmin && <h4 className="section-title">{g.navn}</h4>}
              <div className="table-wrap">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Dato</th><th>Ind</th><th>Ud</th><th>Varighed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {g.rows.map((r) => (
                      <tr key={r.id}>
                        <td>{r.dato}</td>
                        <td className="num">{r.ind}</td>
                        <td className="num">{r.ud ?? <span className="badge badge-soft-success">Åben</span>}</td>
                        <td className="num">{r.varighed}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
