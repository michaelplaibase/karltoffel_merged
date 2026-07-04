"use client";

// "Kør optimering" runs a real analysis of how active subscriptions spread across
// their start weeks and proposes moving a few from the busiest week to the
// lightest. "Flyt abonnementer" applies the moves for real (updates the
// subscriptions + regenerates their future orders); customer notification stubbed.
import { useState, useTransition } from "react";
import { computeOptimization, applyOptimization, type OptimizationResult } from "@/app/actions/funktioner";

export default function OptimizationRunner({ dialogNote }: { dialogNote: string }) {
  const [pending, start] = useTransition();
  const [res, setRes] = useState<OptimizationResult | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [done, setDone] = useState<string | null>(null);

  const run = () => start(async () => { setDone(null); setRes(await computeOptimization()); });
  const apply = () => start(async () => {
    if (!res) return;
    const r = await applyOptimization(res.proposals.map((p) => p.pk), res.proposals[0]?.toWeek ?? 0);
    setConfirm(false); setDone(r.message ?? r.error ?? null); setRes(await computeOptimization());
  });

  const maxCount = Math.max(1, ...(res?.loads ?? []).map((l) => l.count));

  return (
    <div className="card">
      <div className="card-body">
        <h4 className="section-title">Optimeringspotentiale</h4>
        <div className="row-actions" style={{ marginBottom: 12 }}>
          <button className="btn btn-primary" type="button" disabled={pending} onClick={run}>{pending ? "Beregner…" : "Kør optimering"}</button>
        </div>

        {done ? <div className="help-note" style={{ color: "var(--success)" }}>{done}</div> : null}

        {res && (
          <>
            <p className="muted" style={{ fontSize: 13 }}>Nuværende fordeling af {res.loads.reduce((a, l) => a + l.count, 0)} aktive abonnementer på startuger (spredning: {res.spread}):</p>
            <div style={{ display: "flex", gap: 6, alignItems: "flex-end", height: 80, margin: "8px 0 16px" }}>
              {res.loads.map((l) => (
                <div key={l.week} style={{ textAlign: "center", fontSize: 11, color: "var(--muted)" }}>
                  <div style={{ width: 26, height: (l.count / maxCount) * 60, background: "var(--primary)", borderRadius: "2px 2px 0 0", margin: "0 auto" }} title={`Uge ${l.week}: ${l.count}`} />
                  <div>u{l.week}</div><div>{l.count}</div>
                </div>
              ))}
            </div>

            {res.proposals.length ? (
              <>
                <div className="help-note"><b>Forslag ({res.proposals.length})</b><div style={{ marginTop: 6 }}>Flyt følgende abonnementer for at jævne arbejdsbyrden ud:</div></div>
                <div className="table-wrap" style={{ marginTop: 8 }}>
                  <table className="data-table"><thead><tr><th>Abo. nr.</th><th>Kunde</th><th>Fra uge</th><th>Til uge</th></tr></thead>
                    <tbody>{res.proposals.map((p) => <tr key={p.pk}><td className="num">{p.displayNo}</td><td>{p.customer}</td><td className="num">{p.fromWeek}</td><td className="num">{p.toWeek}</td></tr>)}</tbody>
                  </table>
                </div>
                <div className="row-actions" style={{ marginTop: 12 }}>
                  <button className="btn btn-primary" type="button" disabled={pending} onClick={() => setConfirm(true)}>Flyt abonnementer</button>
                </div>
              </>
            ) : <div className="help-note" style={{ marginTop: 8 }}>Ingen forslag — abonnementerne er allerede jævnt fordelt.</div>}
          </>
        )}

        <div className="help-note" style={{ marginTop: 12 }}>{dialogNote}</div>
      </div>

      {confirm && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3000, padding: 20 }} onClick={() => !pending && setConfirm(false)}>
          <div className="card" style={{ maxWidth: 520, width: "100%" }} onClick={(e) => e.stopPropagation()}>
            <div className="card-body">
              <h4 className="section-title">Bekræft flytning af abonnementer</h4>
              <div className="f2"><label className="col-label">Giv kunderne besked</label><div>
                <select className="form-control form-control-sm" defaultValue="Både SMS og e-mail">
                  {["Både SMS og e-mail", "Kun som SMS", "Kun som e-mail", "Som e-mail, hvis kunden har en email-adr., ellers som SMS", "Giv ikke besked"].map((o) => <option key={o}>{o}</option>)}
                </select></div></div>
              <p style={{ color: "#c0392b", fontSize: 13 }}>Denne handling kan ikke fortrydes.</p>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 8 }}>
                <button type="button" className="btn btn-light" disabled={pending} onClick={() => setConfirm(false)}>Luk</button>
                <button type="button" className="btn btn-primary" disabled={pending} onClick={apply}>{pending ? "Flytter…" : "Flyt abonnementer"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
