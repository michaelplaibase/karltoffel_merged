import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/api-auth";
import { getReportData, type Kpi } from "@/lib/reports-data";
import BarChart from "@/components/BarChart";
import KpiSection from "@/components/KpiSection";

export const metadata = { title: "Grafer og nøgletal · Karltoffel" };

// Uden denne prerenderes siden ved BUILD (ingen request-time-API'er ⇒ statisk i
// Next' default-model), og KPI'er/grafer fryser på deploy-tidspunktet — i dev
// ser alt korrekt ud, så fejlen ses først i produktion.
export const dynamic = "force-dynamic";

function KpiCards({ items }: { items: Kpi[] }) {
  return (
    <div className="kpigrid">
      {items.map((c, i) => (
        <div className="kpi" key={i}>
          <div className="k">{c.k}</div>
          <div className="t">{c.t}</div>
          {c.s ? <div className="s">{c.s}</div> : null}
        </div>
      ))}
    </div>
  );
}

export default async function GraphReportsPage() {
  // Samme produktregel som lønrapporten og kalenderen (Michael, 2026-08-10: en
  // medarbejder skal kun se sine EGNE opgaver): rapporterne dækker ALLE kunders
  // navne og omsætning og er derfor kun for administratorer.
  const me = await getSessionUser();
  if (me == null) redirect("/login");
  if (!me.isAdmin) {
    return (
      <div className="container-1140" style={{ maxWidth: 900 }}>
        <div className="card"><div className="card-body">
          <h1 className="page-title">Grafer og nøgletal</h1>
          <div className="table-empty">Kun administratorer har adgang til rapporterne.</div>
        </div></div>
      </div>
    );
  }

  const { kpiCustomers, kpiCustomersYtd, kpiRevenue, kpiRevenueYtd, kpiSubs, charts } = await getReportData();

  return (
    <div className="container-1140">
      <h1 className="page-title">Grafer og nøgletal</h1>

      <KpiSection title="Antal kunder" twelve={kpiCustomers} ytd={kpiCustomersYtd} />
      <KpiSection title="Omsætning" twelve={kpiRevenue} ytd={kpiRevenueYtd} />

      <div className="report-head"><h4 className="section-title">Abonnementskunder</h4></div>
      <KpiCards items={kpiSubs} />

      {charts.map((c, i) => <BarChart chart={c} key={i} />)}
    </div>
  );
}
