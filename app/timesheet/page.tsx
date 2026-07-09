import { redirect } from "next/navigation";
import { requireSession } from "@/lib/api-auth";
import { getTimesheet } from "@/lib/timesheet";

export const metadata = { title: "Timeregistrering · Karltoffel" };

export default async function TimesheetPage() {
  const userId = await requireSession();
  if (userId == null) redirect("/login");
  const { isAdmin, rows } = await getTimesheet(userId);

  return (
    <div className="container-1140">
      <h1 className="page-title">Timeregistrering</h1>
      <p className="page-desc">
        {isAdmin
          ? "Check ind/ud-registreringer for alle medarbejdere."
          : "Dine egne check ind/ud-registreringer."}
      </p>

      <div className="card">
        <div className="card-body">
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  {isAdmin && <th>Medarbejder</th>}
                  <th>Dato</th><th>Ind</th><th>Ud</th><th>Varighed</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={isAdmin ? 5 : 4}><div className="table-empty">Ingen registreringer endnu</div></td></tr>
                ) : rows.map((r) => (
                  <tr key={r.id}>
                    {isAdmin && <td>{r.navn}</td>}
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
    </div>
  );
}
