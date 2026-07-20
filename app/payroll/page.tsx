import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/api-auth";
import { getPayroll } from "@/lib/payroll";

export const metadata = { title: "Lønrapport · Karltoffel" };

const kr = (n: number) => n.toLocaleString("da-DK") + " kr";

export default async function PayrollPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const me = await getSessionUser();
  if (me == null) redirect("/login");
  if (!me.isAdmin) {
    return (
      <div className="container-1140" style={{ maxWidth: 900 }}>
        <div className="card"><div className="card-body">
          <h1 className="page-title">Lønrapport</h1>
          <div className="table-empty">Kun administratorer har adgang til lønrapporten.</div>
        </div></div>
      </div>
    );
  }

  const sp = await searchParams;
  const { fromISO, toISO, rows } = await getPayroll(sp.from, sp.to);

  return (
    <div className="container-1140">
      <h1 className="page-title">Lønrapport</h1>
      <p className="page-desc">
        Provision = medarbejderens sats × omsætning <b>ekskl. moms</b> af <b>udførte</b> ordrer i perioden (efter plandato).
        Priser er gemt inkl. 25 % moms, så grundlaget er pris ÷ 1,25. Fast løn vises som det manuelt satte månedsbeløb.
      </p>

      <div className="card">
        <div className="card-body">
          <form method="get" className="toolbar" style={{ gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
            <label>Fra<br /><input type="date" name="from" defaultValue={fromISO} className="form-control form-control-sm" /></label>
            <label>Til<br /><input type="date" name="to" defaultValue={toISO} className="form-control form-control-sm" /></label>
            <button type="submit" className="btn btn-primary btn-sm">Vis periode</button>
          </form>

          <div className="table-wrap">
            <table className="data-table stack">
              <thead>
                <tr>
                  <th>Medarbejder</th><th>Lønmodel</th><th>Udførte ordrer</th>
                  <th>Omsætning (inkl. moms)</th><th>Grundlag (ekskl. moms)</th><th>Provision / Fast løn</th>
                </tr>
              </thead>
              <tbody>
                {rows.length === 0 ? (
                  <tr><td colSpan={6} data-fullspan><div className="table-empty">Ingen brugere</div></td></tr>
                ) : rows.map((r) => (
                  <tr key={r.id}>
                    <td data-label="Medarbejder">{r.navn}</td>
                    <td data-label="Lønmodel">
                      {r.payModel === "akkord"
                        ? <span className="badge badge-soft-warning">Akkord {r.commissionPct}%</span>
                        : <span className="badge badge-soft-muted">Fast løn</span>}
                    </td>
                    <td className="num" data-label="Udførte ordrer">{r.antalOrdrer}</td>
                    <td className="num" data-label="Omsætning (inkl. moms)">{kr(r.omsaetning)}</td>
                    <td className="num" data-label="Grundlag (ekskl. moms)">{kr(r.omsaetningExMoms)}</td>
                    <td className="num" data-label="Provision / Fast løn">
                      {r.payModel === "akkord"
                        ? <b>{kr(r.provision ?? 0)}</b>
                        : (r.fastLoen != null ? <><b>{kr(r.fastLoen)}</b> /md</> : "—")}
                    </td>
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
