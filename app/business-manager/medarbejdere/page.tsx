// Business Manager — Omsætning & medarbejdere: SLÅET SAMMEN (Thomas,
// 2026-09-03). Én tabel pr. medarbejder: forventet abonnementsomsætning (md/år),
// realiseret omsætning, løn, faste udgifter, andel af biler/maskiner, kostpris,
// dækning og break-even. KPI'er øverst = det gamle Omsætningsoverblik.
import { getSessionUser } from "@/lib/api-auth";
import { redirect } from "next/navigation";
import { getBusinessManager } from "@/lib/business-manager";

const kr = (n: number) => n.toLocaleString("da-DK") + " kr";
const krOre = (n: number) => n.toLocaleString("da-DK", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " kr";

export const dynamic = "force-dynamic";

export default async function EmployeeCalcPage() {
  const me = await getSessionUser();
  if (!me) redirect("/login");
  if (!me.isAdmin) redirect("/");
  const data = await getBusinessManager();

  const subMonthlyTotal = data.employees.reduce((a, e) => a + e.subMonthlyKr, 0);
  const subYearlyTotal = data.employees.reduce((a, e) => a + e.subYearlyKr, 0);

  return (
    <>
      <div className="bm-kpis">
        <div className="revenue-kpi">
          <span className="revenue-kpi-label">Forventet abonnementsomsætning / md (inkl. moms)</span>
          <span className="revenue-kpi-value">{krOre(subMonthlyTotal)}</span>
        </div>
        <div className="revenue-kpi">
          <span className="revenue-kpi-label">Forventet abonnementsomsætning / år (inkl. moms)</span>
          <span className="revenue-kpi-value">{krOre(subYearlyTotal)}</span>
        </div>
        <div className="revenue-kpi">
          <span className="revenue-kpi-label">Realiseret i månedens ordrer (inkl. moms)</span>
          <span className="revenue-kpi-value">{kr(data.realised.revenueInclVat)}</span>
        </div>
        <div className="revenue-kpi">
          <span className="revenue-kpi-label">Realiseret år til dato (inkl. moms)</span>
          <span className="revenue-kpi-value">{kr(data.realised.revenueInclVatYear)}</span>
        </div>
        <div className="revenue-kpi">
          <span className="revenue-kpi-label">Selskabets omkostninger / md</span>
          <span className="revenue-kpi-value">{kr(data.companyMonthlyCost)}</span>
        </div>
        <div className="revenue-kpi">
          <span className="revenue-kpi-label">Biler + maskiner / md</span>
          <span className="revenue-kpi-value">{kr(data.fleetMonthlyTotal)}</span>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h4 className="section-title">Pr. medarbejder — omsætning, kostpris, dækning og break-even</h4>
        </div>
        <div className="card-body tight">
          <p className="page-desc" style={{ marginBottom: 8 }}>
            Abonnementsomsætning er forventet pr. rytme over 52 uger ("På anmodning" og pauser er
            fratrukket). Løn hentes fra Lønrapporten, og Realiseret/md gælder LØNPERIODEN 21. i
            forrige måned → 20. i denne — samme periode som lønnen. Kostpris = løn + faste udgifter
            + andel af biler og maskiner (en tildelt bil lægges ind i sin medarbejders tal; resten
            fordeles ligeligt). Dækning = realiseret omsætning ekskl. moms i perioden minus kostprisen.
          </p>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th data-label="Medarbejder">Medarbejder</th>
                  <th data-label="Abo/md">Abo/md</th>
                  <th data-label="Abo/år">Abo/år</th>
                  <th data-label="Lønmodel">Lønmodel</th>
                  <th data-label="Løn/md">Løn/md</th>
                  <th data-label="Faste udgifter">Faste udgifter</th>
                  <th data-label="Biler/maskiner">Biler/maskiner</th>
                  <th data-label="Kostpris/md">Kostpris/md</th>
                  <th data-label="Kostpris/time">Kostpris/time</th>
                  <th data-label="Realiseret/md (ekskl. moms)">Realiseret/md</th>
                  <th data-label="Realiseret/år (inkl. moms)">Realiseret/år</th>
                  <th data-label="Dækning">Dækning</th>
                  <th data-label="Resultat/md">Resultat/md</th>
                  <th data-label="Resultat %">Resultat %</th>
                  <th data-label="Break-even">Break-even</th>
                </tr>
              </thead>
              <tbody>
                {data.employees.length === 0 ? (
                  <tr><td colSpan={15}><div className="table-empty">Ingen aktive medarbejdere.</div></td></tr>
                ) : data.employees.map((e) => (
                  <tr key={e.id}>
                    <td data-label="Medarbejder">{e.navn}</td>
                    <td data-label="Abo/md" className="num">{krOre(e.subMonthlyKr)}</td>
                    <td data-label="Abo/år" className="num">{krOre(e.subYearlyKr)}</td>
                    <td data-label="Lønmodel">{e.payModel === "akkord" ? "Akkord (est.)" : "Fast"}</td>
                    <td data-label="Løn/md" className="num">{kr(e.salaryMonthly)}</td>
                    <td data-label="Faste udgifter" className="num">{kr(e.fixedMonthlyCost)}</td>
                    <td data-label="Biler/maskiner" className="num">{kr(e.shareOfFleetMonthly)}</td>
                    <td data-label="Kostpris/md" className="num"><b>{kr(e.totalCostMonthly)}</b></td>
                    <td data-label="Kostpris/time" className="num">{kr(e.costPerHour)}</td>
                    <td data-label="Realiseret/md (ekskl. moms)" className="num">{kr(e.realisedRevenueExMoms)}</td>
                    <td data-label="Realiseret/år (inkl. moms)" className="num">{kr(e.realisedRevenueYear)}</td>
                    <td data-label="Dækning" className="num" style={{ color: e.coverage != null && e.coverage < 0 ? "var(--danger, #C4183C)" : undefined }}>
                      {e.coverage != null ? <><b>{kr(e.coverage)}</b>{e.coveragePct != null ? ` (${e.coveragePct} %)` : ""}</> : "—"}
                    </td>
                    <td data-label="Resultat/md" className="num" style={{ color: e.resultatMd != null && e.resultatMd < 0 ? "var(--danger, #C4183C)" : e.resultatMd != null ? "var(--success, #2e7d32)" : undefined }}>
                      {e.resultatMd != null ? <b>{kr(e.resultatMd)}</b> : "—"}
                    </td>
                    <td data-label="Resultat %" className="num" style={{ color: e.resultatPct != null && e.resultatPct < 0 ? "var(--danger, #C4183C)" : undefined }}>
                      {e.resultatPct != null ? `${e.resultatPct > 0 ? "+" : ""}${e.resultatPct} %` : "—"}
                    </td>
                    <td data-label="Break-even" className="num">{e.breakEvenHours} t/md · {kr(e.breakEvenPricePerHour)}/t</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
