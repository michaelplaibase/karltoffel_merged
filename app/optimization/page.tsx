import { OPTIMIZATION as O } from "@/lib/funktioner";

export const metadata = { title: "Abonnementsoptimering · Karltoffel" };

export default function OptimizationPage() {
  return (
    <div className="container-1140" style={{ maxWidth: 900 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
        <h1 className="page-title" style={{ margin: 0 }}>{O.title}</h1>
        <span className="badge badge-soft-warning">Kræver {O.gate}</span>
      </div>

      <div className="card" style={{ marginTop: 18 }}>
        <div className="card-body">
          <h4 className="section-title">Introduktion</h4>
          {O.intro.map((p, i) => <p key={i} className="muted" style={{ marginBottom: 10 }}>{p}</p>)}
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <h4 className="section-title">Optimeringspotentiale</h4>
          <div className="help-note" style={{ borderLeftColor: "var(--warning)", background: "#fff3dc", color: "#7a5b12" }}>
            <b>{O.disabledTitle}</b>
            <div style={{ marginTop: 6 }}>{O.disabledMsg}</div>
          </div>
          <div className="help-note" style={{ marginTop: 12 }}>{O.dialogNote}</div>
        </div>
      </div>
    </div>
  );
}
