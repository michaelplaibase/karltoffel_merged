"use client";

// 3-step price-adjustment wizard. Step 1 collects percent/rounding/scope; "Gå
// videre" computes the affected task lines (real query) and advances to step 2
// (preview old→new prices); step 3 confirms and applies the change for real
// (updates the task-line prices).
import { useState, useTransition } from "react";
import { money } from "@/components/ui";
import { computePriceAdjustment, applyPriceAdjustment, type PriceAdj } from "@/app/actions/funktioner";

const STEPS = ["Indstillinger", "Tilpas opgaver", "Bekræft og sæt i gang"];
const ROUNDING = ["Ingen afrunding", "50 øre", "1 kr.", "2 kr.", "5 kr.", "Slut på 9,00 kr.", "Slut på 9,95 kr.", "10 kr."];
const SCOPE = ["Juster både abonnementer og fastprisaftaler", "Juster kun abonnementer", "Juster kun fastprisaftaler"];

export default function PriceAdjustmentWizard() {
  const [step, setStep] = useState(0);
  const [percent, setPercent] = useState("5");
  const [rounding, setRounding] = useState(ROUNDING[0]);
  const [scope, setScope] = useState(SCOPE[0]);
  const [adj, setAdj] = useState<PriceAdj[]>([]);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const next = () => start(async () => {
    setError(null);
    const p = Number(percent);
    if (!Number.isFinite(p) || p === 0) { setError("Angiv en procentsats forskellig fra 0."); return; }
    const result = await computePriceAdjustment(p, scope, rounding);
    if (!result.length) { setError("Ingen opgaver matcher det valgte kundegrundlag."); return; }
    setAdj(result); setStep(1);
  });

  const apply = () => start(async () => {
    const r = await applyPriceAdjustment(adj.map((a) => ({ taskId: a.taskId, newPrice: a.newPrice })));
    if (r.error) { setError(r.error); return; }
    setDone(r.message ?? "Prisjustering gennemført."); setStep(2);
  });

  return (
    <div className="card">
      <div className="card-body">
        <div className="steps">
          {STEPS.map((s, i) => <span key={i} className={`step${i === step ? " on" : ""}`}><span className="n">{i + 1}</span>{s}</span>)}
        </div>

        {step === 0 && (
          <>
            <h4 className="section-title">Indstillinger</h4>
            <div className="f2"><label className="col-label">Procentuel justering (%)</label><div>
              <input type="number" className="form-control form-control-sm" value={percent} onChange={(e) => setPercent(e.target.value)} style={{ maxWidth: 140 }} />
              <small className="form-text">F.eks. 5 for en 5% stigning, -3 for et fald.</small></div></div>
            <div className="f2"><label className="col-label">Afrunding</label><div>
              <select className="form-control form-control-sm" value={rounding} onChange={(e) => setRounding(e.target.value)}>{ROUNDING.map((o) => <option key={o}>{o}</option>)}</select></div></div>
            <div className="f2"><label className="col-label">Aftaletype</label><div>
              <select className="form-control form-control-sm" value={scope} onChange={(e) => setScope(e.target.value)}>{SCOPE.map((o) => <option key={o}>{o}</option>)}</select></div></div>
            {error ? <div className="help-note" style={{ color: "var(--danger, #C4183C)" }}>{error}</div> : null}
            <hr className="section-hr" />
            <button className="btn btn-primary" type="button" disabled={pending} onClick={next}>{pending ? "Beregner…" : "Gå videre"}</button>
          </>
        )}

        {step === 1 && (
          <>
            <h4 className="section-title">Tilpas opgaver</h4>
            <p className="muted" style={{ fontSize: 13 }}>{adj.length} opgaver justeres med {percent}% ({rounding.toLowerCase()}):</p>
            <div className="table-wrap" style={{ maxHeight: "46vh", overflow: "auto" }}>
              <table className="data-table rowstack"><thead><tr><th>Opgave</th><th>Type</th><th>Før</th><th>Efter</th></tr></thead>
                <tbody>{adj.map((a) => <tr key={a.taskId}><td data-label="Opgave">{a.description}</td><td data-label="Type">{a.kind}</td><td className="num" data-label="Før">{money(a.oldPrice)}</td><td className="num" data-label="Efter">{money(a.newPrice)}</td></tr>)}</tbody>
              </table>
            </div>
            {error ? <div className="help-note" style={{ color: "var(--danger, #C4183C)" }}>{error}</div> : null}
            <hr className="section-hr" />
            <div className="row-actions">
              <button className="btn btn-light" type="button" onClick={() => setStep(0)}>Tilbage</button>
              <button className="btn btn-primary" type="button" disabled={pending} onClick={apply}>{pending ? "Gennemfører…" : "Gennemfør prisjustering (kan ikke fortrydes)"}</button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h4 className="section-title">Bekræft og sæt i gang</h4>
            <div className="help-note" style={{ color: "var(--success)" }}>{done}</div>
            <hr className="section-hr" />
            <button className="btn btn-light" type="button" onClick={() => { setStep(0); setDone(null); setAdj([]); }}>Ny prisjustering</button>
          </>
        )}
      </div>
    </div>
  );
}
