"use client";

import { useState } from "react";

const PARTNERS = [
  { name: "Dinero", tag: "Regnskab", more: "Dinero er Fensters regnskabsintegration. Fakturaer, du sender fra systemet, bogføres automatisk i din Dinero-konto." },
  { name: "Nordic Glass Repair", tag: "Glasreparation", more: "Nordic Glass Repair reparerer ridser og skader i glas. Henvis kunder med beskadigede ruder direkte til dem." },
  { name: "Beckmann Vejledning", tag: "Rådgivning", more: "Beckmann tilbyder forretningsrådgivning til service- og håndværksvirksomheder, herunder prissætning og vækst." },
  { name: "Borgholt", tag: "Forsikring", more: "Borgholt formidler erhvervsforsikringer skræddersyet til vinduespudser- og servicevirksomheder." },
];

export default function PartnersPage() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div className="container-1140" style={{ maxWidth: 900 }}>
      <h1 className="page-title">Samarbejdspartnere</h1>
      <p className="page-desc">Fenster samarbejder med en række virksomheder, der kan hjælpe din forretning videre.</p>

      <div className="kpigrid">
        {PARTNERS.map((p, i) => (
          <div className="kpi" key={i}>
            <span className="badge badge-soft-muted" style={{ alignSelf: "flex-start" }}>{p.tag}</span>
            <div className="t" style={{ fontWeight: 600, fontSize: 16, margin: "6px 0" }}>{p.name}</div>
            <button className="btn btn-sm btn-outline-primary" style={{ alignSelf: "flex-start" }} onClick={() => setOpen(i)}>Læs mere...</button>
          </div>
        ))}
      </div>

      {open !== null && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3000, padding: 20 }} onClick={() => setOpen(null)}>
          <div className="card" style={{ maxWidth: 520, width: "100%" }} onClick={(e) => e.stopPropagation()}>
            <div className="card-header"><h4 className="section-title" style={{ margin: 0 }}>{PARTNERS[open].name}</h4></div>
            <div className="card-body">
              <p style={{ marginTop: 0 }}>{PARTNERS[open].more}</p>
              <div className="row-actions" style={{ justifyContent: "flex-end" }}>
                <button className="btn btn-light" onClick={() => setOpen(null)}>Luk</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
