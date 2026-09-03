// Business Manager — Medarbejderkalkulator: kostpris pr. time, dækning og
// break-even pr. medarbejder. Ren læseside; tal fra lib/business-manager.ts.
import { getSessionUser } from "@/lib/api-auth";
import { redirect } from "next/navigation";
import { getBusinessManager } from "@/lib/business-manager";

const kr = (n: number) => n.toLocaleString("da-DK") + " kr";

export default async function EmployeeCalcPage() {
  const me = await getSessionUser();
  if (!me) redirect("/login");
  if (!me.isAdmin) redirect("/");
  const data = await getBusinessManager();

  return (
    <div className="card">
      <div className="card-header">
        <h4 className="section-title">Medarbejderkalkulator — kostpris, dækning og break-even</h4>
      </div>
      <div className="card-body tight">
        <p className="page-desc" style={{ marginBottom: 8 }}>
          Kostpris = løn + faste udgifter + andel af biler og maskiner, fordelt ligeligt pr. medarbejder.
          Normtid er {data.hoursPerMonth} timer/md. Dækning = realiseret omsætning ekskl. moms af udførte
          ordrer i den aktuelle måned minus kostprisen.
        </p>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th data-label="Medarbejder">Medarbejder</th>
                <th data-label="Lønmodel">Lønmodel</th>
                <th data-label="Løn/md">Løn/md</th>
                <th data-label="Faste udgifter">Faste udgifter</th>
                <th data-label="Andel biler/maskiner">Biler/maskiner</th>
                <th data-label="Kostpris/md">Kostpris/md</th>
                <th data-label="Kostpris/time">Kostpris/time</th>
                <th data-label="Realiseret (ekskl. moms)">Realiseret</th>
                <th data-label="Dækning">Dækning</th>
                <th data-label="Break-even">Break-even</th>
              </tr>
            </thead>
            <tbody>
              {data.employees.length === 0 ? (
                <tr><td colSpan={10}><div className="table-empty">Ingen aktive medarbejdere.</div></td></tr>
              ) : data.employees.map((e) => (
                <tr key={e.id}>
                  <td data-label="Medarbejder">{e.navn}</td>
                  <td data-label="Lønmodel">{e.payModel === "akkord" ? `Akkord (est.)` : "Fast"}</td>
                  <td data-label="Løn/md" className="num">{kr(e.salaryMonthly)}</td>
                  <td data-label="Faste udgifter" className="num">{kr(e.fixedMonthlyCost)}</td>
                  <td data-label="Andel biler/maskiner" className="num">{kr(e.shareOfFleetMonthly)}</td>
                  <td data-label="Kostpris/md" className="num"><b>{kr(e.totalCostMonthly)}</b></td>
                  <td data-label="Kostpris/time" className="num">{kr(e.costPerHour)}</td>
                  <td data-label="Realiseret (ekskl. moms)" className="num">{kr(e.realisedRevenueExMoms)}</td>
                  <td data-label="Dækning" className="num" style={{ color: e.coverage != null && e.coverage < 0 ? "var(--danger, #C4183C)" : undefined }}>
                    {e.coverage != null ? <><b>{kr(e.coverage)}</b>{e.coveragePct != null ? ` (${e.coveragePct} %)` : ""}</> : "—"}
                  </td>
                  <td data-label="Break-even" className="num">{e.breakEvenHours} t/md · {kr(e.breakEvenPricePerHour)}/t</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
