// Business Manager — Lead-beregner (Thomas, 2026-09-03): styr på nye kunder
// (privat / virksomhed / fastpris) med AUTOMATISK månedlig + årlig indtjening fra
// CRM'et, manuel marketing-indtastning pr. kanal (SEO, Meta, Sociale medier, …)
// og CAC = marketingforbrug ÷ antal nye kunder.
import { prisma } from "@/lib/db";
import { getSessionUser } from "@/lib/api-auth";
import { redirect } from "next/navigation";
import { getLeadCalc, LEAD_SOURCES } from "@/lib/lead-calc";
import { registerAcquisitionForm, saveMarketingSpend, deleteAcquisition } from "@/app/actions/lead-calc";

const kr = (n: number) => n.toLocaleString("da-DK", { maximumFractionDigits: 0 }) + " kr";
const MD = ["Januar", "Februar", "Marts", "April", "Maj", "Juni", "Juli", "August", "September", "Oktober", "November", "December"];

export const dynamic = "force-dynamic";

export default async function LeadsPage({ searchParams }: { searchParams: Promise<{ year?: string; month?: string }> }) {
  const me = await getSessionUser();
  if (!me) redirect("/login");
  if (!me.isAdmin) redirect("/");

  const now = new Date();
  const sp = await searchParams;
  const year = Number(sp.year) || now.getFullYear();
  const month = Number(sp.month) || now.getMonth() + 1;
  const fromISO = `${year}-${String(month).padStart(2, "0")}-01`;
  const toISO = `${year}-${String(month).padStart(2, "0")}-${new Date(Date.UTC(year, month, 0)).getUTCDate()}`;

  const [calc, customers, spends] = await Promise.all([
    getLeadCalc(fromISO, toISO),
    prisma.contact.findMany({ select: { id: true, name: true, isCompany: true }, orderBy: { name: "asc" } }),
    prisma.marketingSpend.findMany({ where: { companyId: 1, year }, orderBy: [{ channel: "asc" }, { month: "asc" }] }),
  ]);

  return (
    <>
      <div className="bm-kpis">
        <div className="revenue-kpi">
          <span className="revenue-kpi-label">Nye kunder — {MD[month - 1]} {year}</span>
          <span className="revenue-kpi-value">{calc.rows.length}</span>
        </div>
        <div className="revenue-kpi">
          <span className="revenue-kpi-label">Ny indtjening / md (inkl. moms)</span>
          <span className="revenue-kpi-value">{kr(calc.byCategory.reduce((a, c) => a + c.monthlyKr, 0))}</span>
        </div>
        <div className="revenue-kpi">
          <span className="revenue-kpi-label">Ny indtjening / år (inkl. moms)</span>
          <span className="revenue-kpi-value">{kr(calc.byCategory.reduce((a, c) => a + c.yearlyKr, 0))}</span>
        </div>
        <div className="revenue-kpi">
          <span className="revenue-kpi-label">Marketingforbrug (manuel)</span>
          <span className="revenue-kpi-value">{kr(calc.marketingTotal)}</span>
        </div>
        <div className="revenue-kpi">
          <span className="revenue-kpi-label">CAC — omkostning pr. ny kunde</span>
          <span className="revenue-kpi-value">{calc.cac != null ? kr(calc.cac) : "—"}</span>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><h4 className="section-title">Nye kunder pr. kategori</h4></div>
        <div className="card-body tight">
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Kategori</th><th>Antal</th><th>Indtjening/md</th><th>Indtjening/år</th></tr></thead>
              <tbody>
                {calc.byCategory.length === 0 ? (
                  <tr><td colSpan={4}><div className="table-empty">Ingen nye kunder i {MD[month - 1]} {year} endnu. Nye kunder ryger automatisk hertil, når de oprettes — eller når de får abonnement/fastpris.</div></td></tr>
                ) : calc.byCategory.map((c) => (
                  <tr key={c.category}>
                    <td data-label="Kategori">{c.category === "privat" ? "Privat" : c.category === "virksomhed" ? "Virksomhed" : "Fastprisaftale"}</td>
                    <td data-label="Antal" className="num">{c.count}</td>
                    <td data-label="Indtjening/md" className="num"><b>{kr(c.monthlyKr)}</b></td>
                    <td data-label="Indtjening/år" className="num">{kr(c.yearlyKr)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><h4 className="section-title">Kanaler & CAC — hvor kommer kunderne fra, og hvad koster de?</h4></div>
        <div className="card-body tight">
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Kanal</th><th>Nye kunder</th><th>Indtjening/md</th><th>Marketing (manuel)</th><th>CAC pr. kunde</th></tr></thead>
              <tbody>
                {calc.bySource.length === 0 ? (
                  <tr><td colSpan={5}><div className="table-empty">Ingen data — registrér nye kunder med kanal (SEO, Meta, Sociale medier, …) nedenfor.</div></td></tr>
                ) : calc.bySource.map((s) => (
                  <tr key={s.source}>
                    <td data-label="Kanal">{s.source}</td>
                    <td data-label="Nye kunder" className="num">{s.count}</td>
                    <td data-label="Indtjening/md" className="num">{kr(s.monthlyKr)}</td>
                    <td data-label="Marketing (manuel)" className="num">{kr(s.marketingKr)}</td>
                    <td data-label="CAC pr. kunde" className="num"><b>{s.cac != null ? kr(s.cac) : "—"}</b></td>
                  </tr>
                ))}
                {calc.rows.length > 0 && (
                  <tr>
                    <td data-label="Kanal"><b>I alt</b></td>
                    <td data-label="Nye kunder" className="num"><b>{calc.rows.length}</b></td>
                    <td data-label="Indtjening/md" className="num"><b>{kr(calc.bySource.reduce((a, s) => a + s.monthlyKr, 0))}</b></td>
                    <td data-label="Marketing (manuel)" className="num"><b>{kr(calc.marketingTotal)}</b></td>
                    <td data-label="CAC pr. kunde" className="num"><b>{calc.cac != null ? kr(calc.cac) : "—"}</b></td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-header"><h4 className="section-title">Nye kunder — {MD[month - 1]} {year} ({calc.rows.length})</h4></div>
        <div className="card-body tight">
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Kunde</th><th>Kategori</th><th>Kanal</th><th>Startet</th><th>Indtjening/md</th><th>Indtjening/år</th><th /></tr></thead>
              <tbody>
                {calc.rows.length === 0 ? (
                  <tr><td colSpan={7}><div className="table-empty">Ingen nye kunder denne måned.</div></td></tr>
                ) : calc.rows.map((r) => (
                  <tr key={r.acquisitionId}>
                    <td data-label="Kunde">{r.name}</td>
                    <td data-label="Kategori">{r.category === "privat" ? "Privat" : r.category === "virksomhed" ? "Virksomhed" : "Fastpris"}</td>
                    <td data-label="Kanal">{r.source}</td>
                    <td data-label="Startet">{r.startedAtISO}</td>
                    <td data-label="Indtjening/md" className="num"><b>{kr(r.monthlyKr)}</b></td>
                    <td data-label="Indtjening/år" className="num">{kr(r.yearlyKr)}</td>
                    <td>
                      <form action={deleteAcquisition.bind(null, r.acquisitionId)}>
                        <button className="btn btn-sm btn-light" type="submit">Fjern</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16, marginBottom: 16 }}>
        <div className="card">
          <div className="card-header"><h4 className="section-title">Registrér erhvervelse manuelt</h4></div>
          <div className="card-body">
            <form action={registerAcquisitionForm}>
              <div className="f2"><label>Kunde</label><div>
                <select name="contactId" className="form-control form-control-sm" required>
                  <option value="">— Vælg kunde —</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div></div>
              <div className="f2"><label>Kategori</label><div>
                <select name="category" className="form-control form-control-sm" required>
                  <option value="privat">Privat</option>
                  <option value="virksomhed">Virksomhed</option>
                  <option value="fastpris">Fastprisaftale</option>
                </select>
              </div></div>
              <div className="f2"><label>Kanal</label><div>
                <input name="source" list="lead-sources" className="form-control form-control-sm" placeholder="fx Meta" />
                <datalist id="lead-sources">
                  {LEAD_SOURCES.map((s) => <option key={s} value={s} />)}
                </datalist>
                <small className="form-text field-help">Standardvalg: SEO, Meta, Sociale medier, Anbefaling, Direkte — fritekst tilladt.</small>
              </div></div>
              <div className="f2"><label>Startet (dato)</label><div><input name="startedAt" type="date" defaultValue={`${year}-${String(month).padStart(2, "0")}-01`} className="form-control form-control-sm" /></div></div>
              <div className="row-actions"><button className="btn btn-primary" type="submit">Registrér</button></div>
            </form>
          </div>
        </div>

        <div className="card">
          <div className="card-header"><h4 className="section-title">Marketingforbrug — {MD[month - 1]} {year}</h4></div>
          <div className="card-body">
            <form action={saveMarketingSpend}>
              <input type="hidden" name="year" value={year} />
              <input type="hidden" name="month" value={month} />
              <div className="f2"><label>Kanal</label><div>
                <input name="channel" list="lead-sources" className="form-control form-control-sm" placeholder="fx SEO" required />
              </div></div>
              <div className="f2"><label>Beløb brugt (kr)</label><div><input name="amount" type="number" min="0" className="form-control form-control-sm" placeholder="fx 5000" required /></div></div>
              <div className="row-actions"><button className="btn btn-primary" type="submit">Gem forbrug</button></div>
            </form>
            {spends.length > 0 && (
              <>
                <hr className="section-hr" />
                <div style={{ fontSize: 13 }}>
                  <b>Tastet ind for {year}:</b>
                  <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
                    {spends.map((s) => (
                      <li key={s.id}>{s.channel} — {MD[s.month - 1]}: {kr(s.amount)}</li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
