import { Field } from "@/components/Field";
import { GROUP_MESSAGES as G } from "@/lib/funktioner";

export const metadata = { title: "Gruppebeskeder · Karltoffel" };

export default function GroupMessagesPage() {
  return (
    <div className="container-1140" style={{ maxWidth: 900 }}>
      <h1 className="page-title">{G.title}</h1>
      <p className="page-desc">{G.purpose}</p>

      <div className="card">
        <div className="card-body">
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr>{G.historyCols.map((c, i) => <th key={i}>{c}</th>)}</tr></thead>
              <tbody><tr><td colSpan={G.historyCols.length}><div className="table-empty">{G.historyEmpty}</div></td></tr></tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <h4 className="section-title">{G.createTitle}</h4>
          <p className="muted" style={{ marginBottom: 20 }}>{G.createIntro}</p>
          {G.fields.map((f, i) => <Field key={i} f={f} />)}
          <hr className="section-hr" />
          <div className="row-actions">
            <button className="btn btn-primary">{G.sendLabel}</button>
            <button className="btn btn-outline-secondary">Vis liste over modtagere</button>
          </div>
        </div>
      </div>
    </div>
  );
}
