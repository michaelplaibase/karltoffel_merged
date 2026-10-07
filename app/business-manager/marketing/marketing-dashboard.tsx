"use client";

import { useEffect, useMemo, useState } from "react";

type Channel = {
  name: string; spend: number; impressions: number; clicks: number; leads: number;
  customers: number; revenue: number; roas: number | null; cpl: number | null;
  conversionRate: number | null; bounceRate: number | null; source: string;
};
type DashboardData = {
  status: "demo" | "live" | "partial"; updatedAt: string; from: string; to: string;
  channels: Channel[]; totals: Omit<Channel, "name" | "source">;
  notes: string[];
};
const kr = (n: number) => new Intl.NumberFormat("da-DK", { style: "currency", currency: "DKK", maximumFractionDigits: 0 }).format(n);
const number = (n: number) => new Intl.NumberFormat("da-DK", { maximumFractionDigits: 0 }).format(n);
const pct = (n: number | null) => n == null ? "—" : `${n.toLocaleString("da-DK", { maximumFractionDigits: 1 })} %`;

export default function MarketingDashboard() {
  const [days, setDays] = useState(30);
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const from = useMemo(() => { const d = new Date(); d.setDate(d.getDate() - days + 1); return d.toISOString().slice(0, 10); }, [days]);
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => {
    const load = async () => {
      setBusy(true); setError("");
      try {
        const r = await fetch(`/api/business-manager/marketing?from=${from}&to=${new Date().toISOString().slice(0, 10)}`, { cache: "no-store" });
        const body = await r.json();
        if (!r.ok) throw new Error(body.error || "Kunne ikke hente marketingdata");
        setData(body as DashboardData);
      } catch (e) { setError(e instanceof Error ? e.message : "Ukendt fejl"); }
      finally { setBusy(false); }
    };
    const handle = window.setTimeout(() => void load(), 0);
    const timer = window.setInterval(() => void load(), 5 * 60 * 1000);
    return () => { window.clearTimeout(handle); window.clearInterval(timer); };
  }, [from, refreshKey]);
  const refresh = () => setRefreshKey(key => key + 1);

  const metrics = data ? [
    ["Spend", kr(data.totals.spend), "Annonceforbrug i perioden"],
    ["Leads", number(data.totals.leads), "CRM-leads med registreret kilde"],
    ["Pris pr. lead", data.totals.cpl == null ? "—" : kr(data.totals.cpl), "Spend divideret med attribuerede leads"],
    ["Konverteringsrate", pct(data.totals.conversionRate), "Klik til attribueret CRM-lead"],
    ["ROAS", data.totals.roas == null ? "—" : `${data.totals.roas.toLocaleString("da-DK", { maximumFractionDigits: 2 })}×`, "Kun når tilskrevet omsætning foreligger"],
    ["Nye kunder", number(data.totals.customers), "Konverterede CRM-leads i perioden"],
  ] : [];

  return <section className="marketing-dashboard" aria-busy={busy}>
    <style>{styles}</style>
    <div className="md-head"><div><h2>Marketingperformance</h2><p>Google Ads, Meta og website — med synlig datadækning.</p></div>
      <div className="md-controls"><label>Periode <select value={days} onChange={e => setDays(Number(e.target.value))}><option value={7}>Seneste 7 dage</option><option value={30}>Seneste 30 dage</option><option value={90}>Seneste 90 dage</option></select></label><button type="button" className="md-refresh" onClick={refresh} disabled={busy}>{busy ? "Opdaterer…" : "Opdatér nu"}</button></div>
    </div>
    <div className={`md-status ${data?.status === "live" ? "is-live" : "is-demo"}`}><span className="md-dot" />{data?.status === "live" ? "Live data" : data?.status === "partial" ? "Delvise live data" : "Demo — syntetiske tal"}<span className="md-updated">{data ? `Sidst opdateret ${new Date(data.updatedAt).toLocaleString("da-DK")}` : "Indlæser…"} · Automatisk opdatering hvert 5. minut</span></div>
    {error && <div className="md-error" role="alert">{error}</div>}
    <div className="md-kpis">{metrics.map(([label, value, detail]) => <article className="md-kpi" key={label}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>)}</div>
    <div className="md-grid">
      <article className="card md-panel"><div className="md-panel-head"><h3>Kanaloverblik</h3><span>{data ? `${data.from} — ${data.to}` : ""}</span></div><div className="md-table-wrap"><table className="md-table"><thead><tr><th>Kanal</th><th>Spend</th><th>Visninger</th><th>Klik</th><th>Leads</th><th>CPL</th><th>Konv.</th><th>ROAS</th></tr></thead><tbody>{(data?.channels ?? []).map(c => <tr key={c.name}><td><b>{c.name}</b><small>{c.source}</small></td><td>{kr(c.spend)}</td><td>{number(c.impressions)}</td><td>{number(c.clicks)}</td><td>{number(c.leads)}</td><td>{c.cpl == null ? "—" : kr(c.cpl)}</td><td>{pct(c.conversionRate)}</td><td>{c.roas == null ? "—" : `${c.roas.toLocaleString("da-DK", { maximumFractionDigits: 2 })}×`}</td></tr>)}</tbody></table></div></article>
      <article className="card md-panel"><h3>Attribution og kvalitet</h3><div className="md-quality"><div><span>Website-afvisningsprocent</span><strong>{data?.totals.bounceRate == null ? "Afventer GA4" : pct(data.totals.bounceRate)}</strong></div><div><span>Tilskrevet omsætning</span><strong>{data ? kr(data.totals.revenue) : "—"}</strong></div><div><span>CLV</span><strong>Afventer kunde-/omsætningskobling</strong></div></div><p className="md-footnote">ROAS og CLV vises først som faktiske nøgletal, når platformsklik kan kobles sikkert til reelle kunder og omsætning. Ingen estimater præsenteres som realiserede resultater.</p></article>
    </div>
    <article className="card md-panel md-notes"><h3>Datadækning og næste skridt</h3><ul>{(data?.notes ?? ["Henter datastatus…"]).map((n, i) => <li key={i}>{n}</li>)}</ul></article>
  </section>;
}
const styles = `
.marketing-dashboard{--md-ink:#2a2118;--md-muted:#736c5a;--md-border:#e8e3d8;color:var(--md-ink)}.md-head{display:flex;align-items:flex-end;justify-content:space-between;gap:16px;margin:10px 0 20px}.md-head h2{margin:0 0 5px}.md-head p{margin:0;color:var(--md-muted)}.md-controls{display:flex;align-items:flex-end;gap:10px}.md-controls label{display:grid;gap:4px;font-size:12px;color:var(--md-muted)}.md-controls select,.md-refresh{min-height:40px;border:1px solid #cfc7b4;border-radius:8px;padding:8px 12px;background:#fff;color:var(--md-ink);font:inherit}.md-refresh{background:#4c3718;color:#fff;border-color:#4c3718;cursor:pointer}.md-refresh:disabled{opacity:.65}.md-status{display:flex;align-items:center;gap:8px;padding:11px 14px;border:1px solid var(--md-border);border-radius:10px;background:#fff;margin-bottom:14px;font-weight:600;font-size:14px}.md-status.is-live{border-color:#b5e2ca;background:#f3fbf6}.md-status.is-demo{background:#fffaf0}.md-dot{width:9px;height:9px;border-radius:50%;background:#d89819}.is-live .md-dot{background:#1cbd6b}.md-updated{font-weight:400;color:var(--md-muted);margin-left:auto;font-size:12px}.md-error{padding:10px 14px;color:#8b1e34;background:#fff0f1;border-radius:8px;margin-bottom:14px}.md-kpis{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin-bottom:14px}.md-kpi{background:#fff;border:1px solid var(--md-border);border-radius:12px;padding:17px;display:flex;flex-direction:column;gap:6px;min-height:112px}.md-kpi>span{color:var(--md-muted);font-size:13px}.md-kpi strong{font-size:25px;line-height:1.15}.md-kpi small{color:var(--md-muted);font-size:11px}.md-grid{display:grid;grid-template-columns:minmax(0,1.7fr) minmax(280px,1fr);gap:14px}.md-panel{padding:18px;margin-bottom:14px;background:#fff;border:1px solid var(--md-border);border-radius:12px}.md-panel h3{font-size:17px;margin:0 0 14px}.md-panel-head{display:flex;justify-content:space-between;gap:10px;align-items:baseline}.md-panel-head span{font-size:12px;color:var(--md-muted)}.md-table-wrap{overflow-x:auto}.md-table{width:100%;border-collapse:collapse;font-size:13px;white-space:nowrap}.md-table th,.md-table td{padding:11px 9px;text-align:right;border-bottom:1px solid #eeeae2}.md-table th:first-child,.md-table td:first-child{text-align:left}.md-table th{font-size:11px;color:var(--md-muted);font-weight:600}.md-table td:first-child small{display:block;color:var(--md-muted);font-size:10px}.md-quality{display:grid;gap:0}.md-quality>div{display:grid;gap:5px;padding:12px 0;border-bottom:1px solid #eeeae2}.md-quality span{font-size:12px;color:var(--md-muted)}.md-quality strong{font-size:15px}.md-footnote,.md-notes{font-size:12px;color:var(--md-muted);line-height:1.6}.md-notes ul{margin:0;padding-left:18px}.md-notes li{margin:6px 0}@media(max-width:900px){.md-grid{grid-template-columns:1fr}}@media(max-width:600px){.md-head{align-items:stretch;flex-direction:column}.md-controls{justify-content:space-between}.md-controls label{flex:1}.md-controls select{width:100%}.md-updated{display:block;margin:4px 0 0;font-size:11px}.md-status{display:block}.md-dot{display:inline-block;vertical-align:middle;margin-right:6px}.md-kpis{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.md-kpi{padding:12px;min-height:100px}.md-kpi strong{font-size:21px}.md-panel{padding:14px}.md-table{min-width:720px}}`;
