// Business Manager — Økonomiovervågning: budget pr. måned + budget vs.
// realiseret med afvigelser. Budget tastes pr. måned (omsætning inkl. moms,
// omkostninger ekskl. løn — løn og flåde beregnes af systemet).
import { getSessionUser } from "@/lib/api-auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getBusinessManager } from "@/lib/business-manager";
import { saveBudget } from "@/app/actions/business-manager";

const kr = (n: number) => n.toLocaleString("da-DK") + " kr";
const MD = ["Januar", "Februar", "Marts", "April", "Maj", "Juni", "Juli", "August", "September", "Oktober", "November", "December"];

export default async function EconomyPage({ searchParams }: { searchParams: Promise<{ year?: string; month?: string }> }) {
  const me = await getSessionUser();
  if (!me) redirect("/login");
  if (!me.isAdmin) redirect("/");

  const now = new Date();
  const sp = await searchParams;
  const year = Number(sp.year) || now.getFullYear();
  const month = Number(sp.month) || now.getMonth() + 1;
  const [budgets, data] = await Promise.all([
    prisma.budget.findMany({ where: { companyId: 1, year }, orderBy: { month: "asc" } }),
    getBusinessManager({ year, month }),
  ]);
  const thisBudget = budgets.find((b) => b.month === month);

  return (
    <>
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><h4 className="section-title">Budget vs. realiseret — {MD[month - 1]} {year}</h4></div>
        <div className="card-body tight">
          {data.budget ? (
            <div className="table-wrap">
              <table className="data-table">
                <thead><tr><th></th><th>Budget</th><th>Realiseret</th><th>Afvigelse</th></tr></thead>
                <tbody>
                  {data.deviations.map((d) => (
                    <tr key={d.key}>
                      <td data-label="Linje">{d.label}</td>
                      <td data-label="Budget" className="num">{kr(d.budget)}</td>
                      <td data-label="Realiseret" className="num">{kr(d.actual)}</td>
                      <td data-label="Afvigelse" className="num" style={{ color: d.diff < 0 ? "var(--danger, #C4183C)" : "var(--success, #2e7d32)" }}>
                        {d.diff > 0 ? "+" : ""}{kr(d.diff)} ({d.diffPct > 0 ? "+" : ""}{d.diffPct} %)
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="table-empty">Intet budget for {MD[month - 1]} {year} — udfyld formularen nedenfor.</div>
          )}
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><h4 className="section-title">Sæt budget — {MD[month - 1]} {year}</h4></div>
        <div className="card-body">
          <form action={saveBudget}>
            <input type="hidden" name="year" value={year} />
            <input type="hidden" name="month" value={month} />
            <div className="f2">
              <label>Måned</label>
              <div>
                <select name="m" className="form-control form-control-sm" defaultValue={month} disabled>
                  {MD.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
                </select>
              </div>
            </div>
            <div className="f2"><label>Budgetteret omsætning (kr, inkl. moms)</label><div><input name="revenueBudget" type="number" min="0" defaultValue={thisBudget?.revenueBudget ?? ""} className="form-control form-control-sm" placeholder="fx 250000" /></div></div>
            <div className="f2"><label>Budgetterede omkostninger (kr, UDEN løn — løn og biler/maskiner beregnes automatisk)</label><div><input name="costBudget" type="number" min="0" defaultValue={thisBudget?.costBudget ?? ""} className="form-control form-control-sm" placeholder="fx 30000" /></div></div>
            <div className="f2"><label>Bemærkning</label><div><input name="note" className="form-control form-control-sm" /></div></div>
            <div className="row-actions"><button className="btn btn-primary" type="submit">Gem budget</button></div>
          </form>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><h4 className="section-title">Årets budgetter ({year})</h4></div>
        <div className="card-body tight">
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Måned</th><th>Omsætningsbudget</th><th>Omkostningsbudget</th></tr></thead>
              <tbody>
                {budgets.length === 0 ? (
                  <tr><td colSpan={3}><div className="table-empty">Ingen budgetter for {year} endnu.</div></td></tr>
                ) : budgets.map((b) => (
                  <tr key={b.id}>
                    <td data-label="Måned">{MD[b.month - 1]}</td>
                    <td data-label="Omsætningsbudget" className="num">{kr(b.revenueBudget)}</td>
                    <td data-label="Omkostningsbudget" className="num">{kr(b.costBudget)}</td>
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
