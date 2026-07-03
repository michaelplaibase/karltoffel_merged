import { Field } from "@/components/Field";
import { HOLIDAYS as H } from "@/lib/funktioner";

export const metadata = { title: "Ferieplanlægning · Karltoffel" };

export default function HolidaysPage() {
  return (
    <div className="container-1140" style={{ maxWidth: 900 }}>
      <h1 className="page-title">{H.title}</h1>

      <div className="card">
        <div className="card-body">
          <h4 className="section-title">Forklaring</h4>
          <p style={{ fontWeight: 500, color: "var(--heading)" }}>{H.warning}</p>
          <p className="muted">{H.body}</p>
          <p style={{ fontWeight: 500, marginTop: 14, marginBottom: 6 }}>Vær opmærksom på:</p>
          <ul className="muted" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7, fontSize: 13 }}>
            {H.bullets.map((b, i) => <li key={i}>{b}</li>)}
          </ul>
          <p style={{ fontWeight: 500, marginTop: 14, marginBottom: 6 }}>Eksempel:</p>
          <ul className="muted" style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7, fontSize: 13 }}>
            {H.example.map((b, i) => <li key={i}>{b}</li>)}
          </ul>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <h4 className="section-title">Planlagte ferier</h4>
          <div className="toolbar"><button className="btn btn-outline-primary">Opret ny ferie</button></div>
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr>{H.historyCols.map((c, i) => <th key={i}>{c}</th>)}</tr></thead>
              <tbody><tr><td colSpan={H.historyCols.length}><div className="table-empty">{H.historyEmpty}</div></td></tr></tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <h4 className="section-title">{H.createTitle}</h4>
          {H.fields.map((f, i) => <Field key={i} f={f} />)}
          <hr className="section-hr" />
          <div className="row-actions">
            <button className="btn btn-light">Luk</button>
            <button className="btn btn-primary">{H.saveLabel}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
