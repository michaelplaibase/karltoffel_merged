// Business Manager — Dashboard (overblik: kostpris, flåde, budget-afvigelser,
// beslutningsforslag). Ren læseside; regnestykkerne bor i lib/business-manager.ts.
import { getSessionUser } from "@/lib/api-auth";
import { redirect } from "next/navigation";
import { getBusinessManager } from "@/lib/business-manager";
import ResultChart from "@/components/ResultChart";

const kr = (n: number) => n.toLocaleString("da-DK") + " kr";

export const dynamic = "force-dynamic";

export default async function BusinessManagerDashboard({ searchParams }: { searchParams: Promise<{ year?: string; month?: string }> }) {
  const me = await getSessionUser();
  if (!me) redirect("/login");
  if (!me.isAdmin) redirect("/");

  const sp = await searchParams;
  const now = new Date();
  const year = Number(sp.year) || now.getFullYear();
  const month = Number(sp.month) || now.getMonth() + 1;
  const data = await getBusinessManager({ year, month });

  return (
    <>
      <div className="bm-kpis">
        <div className="revenue-kpi">
          <span className="revenue-kpi-label">Realiseret omsætning (inkl. moms)</span>
          <span className="revenue-kpi-value">{kr(data.realised.revenueInclVat)}</span>
        </div>
        <div className="revenue-kpi">
          <span className="revenue-kpi-label">Selskabets omkostninger / md</span>
          <span className="revenue-kpi-value">{kr(data.companyMonthlyCost)}</span>
        </div>
        <div className="revenue-kpi">
          <span className="revenue-kpi-label">Biler + maskiner / md</span>
          <span className="revenue-kpi-value">{kr(data.fleetMonthlyTotal)}</span>
        </div>
        <div className="revenue-kpi">
          <span className="revenue-kpi-label">Timer solgt i perioden</span>
          <span className="revenue-kpi-value">{data.realised.hours.toLocaleString("da-DK")} t</span>
        </div>
        <div className="revenue-kpi">
          <span className="revenue-kpi-label">Resultat — måned</span>
          <span className="revenue-kpi-value" style={{ color: data.companyResultat.md < 0 ? "var(--danger, #C4183C)" : "var(--success, #2e7d32)" }}>
            {kr(data.companyResultat.md)}{data.companyResultat.mdPct != null ? ` (${data.companyResultat.mdPct > 0 ? "+" : ""}${data.companyResultat.mdPct} %)` : ""}
          </span>
        </div>
        <div className="revenue-kpi">
          <span className="revenue-kpi-label">Resultat — år til dato</span>
          <span className="revenue-kpi-value" style={{ color: data.companyResultat.year < 0 ? "var(--danger, #C4183C)" : "var(--success, #2e7d32)" }}>
            {kr(data.companyResultat.year)}{data.companyResultat.yearPct != null ? ` (${data.companyResultat.yearPct > 0 ? "+" : ""}${data.companyResultat.yearPct} %)` : ""}
          </span>
        </div>
        <div className="revenue-kpi">
          <span className="revenue-kpi-label">Dækningsgrad — måned</span>
          <span className="revenue-kpi-value">{data.companyCoverage.mdPct != null ? `${data.companyCoverage.mdPct} %` : "—"}</span>
        </div>
        <div className="revenue-kpi">
          <span className="revenue-kpi-label">Dækningsgrad — år til dato</span>
          <span className="revenue-kpi-value">{data.companyCoverage.yearPct != null ? `${data.companyCoverage.yearPct} %` : "—"}</span>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><h4 className="section-title">Årets udvikling — omsætning, omkostninger og resultat pr. måned</h4></div>
        <div className="card-body">
          <ResultChart data={data.monthly} />
        </div>
      </div>

      {data.budget ? (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header"><h4 className="section-title">Afvigelser — {String(month).padStart(2, "0")}/{year}</h4></div>
          <div className="card-body tight">
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th></th><th>Budget</th><th>Realiseret</th><th>Afvigelse</th></tr></thead>
                <tbody>
                  {data.deviations.map((d) => (
                    <tr key={d.key}>
                      <td>{d.label}</td>
                      <td className="num">{kr(d.budget)}</td>
                      <td className="num">{kr(d.actual)}</td>
                      <td className="num" style={{ color: d.diff < 0 ? "var(--danger, #C4183C)" : "var(--success, #2e7d32)" }}>
                        {d.diff > 0 ? "+" : ""}{kr(d.diff)} ({d.diffPct > 0 ? "+" : ""}{d.diffPct} %)
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-body"><div className="table-empty">
            Intet budget er sat for {String(month).padStart(2, "0")}/{year} — sæt det under <b>Økonomiovervågning</b>, så afvigelserne kommer frem.
          </div></div>
        </div>
      )}

      <div className="card">
        <div className="card-header"><h4 className="section-title">Beslutningsforslag</h4></div>
        <div className="card-body tight">
          <ul style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
            {data.suggestions.map((s, i) => <li key={i}>{s}</li>)}
          </ul>
        </div>
      </div>
    </>
  );
}
