import type { SField } from "@/lib/settings-config";

export function Control({ f }: { f: SField }) {
  const help = f.help ? <small className="form-text">{f.help}</small> : null;
  switch (f.t) {
    case "buttons":
      return <><div className="row-actions">{(f.btns ?? []).map(([txt, v], i) => <button key={i} className={`btn btn-${v} btn-sm`} type="button">{txt}</button>)}</div>{help}</>;
    case "toggle":
      return <><div style={{ display: "flex", alignItems: "center", gap: 10, paddingTop: 4 }}><span className={`toggle${f.on ? "" : " off"}`} /><span style={{ color: "var(--muted)", fontSize: 13 }}>{f.on ? "Ja" : "Nej"}</span></div>{help}</>;
    case "checks":
      return <><div style={{ paddingTop: 4 }}>{(f.opts ?? []).map((o, i) => {
        const on = Array.isArray(f.on) ? f.on.includes(i) : false;
        return <label className="form-check-inline" key={i}><input type="checkbox" defaultChecked={on} readOnly /> {o}</label>;
      })}</div>{help}</>;
    case "radio":
      return <><div className="radio">{(f.opts ?? []).map((o, i) => <div className={`rad${f.on === i ? " on" : ""}`} key={i}><span className="dot" /> {o}</div>)}</div>{help}</>;
    case "select":
      return <><select className="form-control form-control-sm" defaultValue={f.val ?? ""}>{(f.opts ?? []).map((o, i) => <option key={i}>{o}</option>)}</select>{help}</>;
    case "textarea":
      return <><textarea className="form-control" defaultValue={f.val ?? ""} rows={5} />{help}</>;
    case "color":
      return <><div style={{ display: "flex", alignItems: "center", gap: 10 }}><span className="swatch" style={{ width: 34, height: 28, background: f.val }} /><input className="form-control" style={{ maxWidth: 160 }} defaultValue={f.val ?? ""} readOnly /></div>{help}</>;
    case "static":
      return <><div className="form-static">{f.val}</div>{help}</>;
    default:
      return <><input className="form-control" type={f.t === "number" ? "number" : f.t === "date" ? "date" : "text"} defaultValue={f.val ?? ""} readOnly={f.ro} />{help}</>;
  }
}

export function Field({ f }: { f: SField }) {
  if (f.t === "note") return <div className="help-note" style={{ marginBottom: 16 }}>{f.val}</div>;
  if (f.t === "subtable") {
    return (
      <div style={{ marginBottom: 16 }}>
        {f.l ? <label style={{ marginBottom: 8 }}>{f.l}</label> : null}
        <div className="table-wrap">
          <table className="data-table">
            <thead><tr>{(f.cols ?? []).map((c, i) => <th key={i}>{c}</th>)}</tr></thead>
            <tbody>
              {(f.rows && f.rows.length) ? f.rows.map((r, ri) => <tr key={ri}>{r.map((c, ci) => <td key={ci}>{c}</td>)}</tr>)
                : <tr><td colSpan={(f.cols ?? []).length || 1}><div className="table-empty">{f.empty ?? "Ingen data"}</div></td></tr>}
            </tbody>
          </table>
        </div>
        {f.help ? <small className="form-text">{f.help}</small> : null}
      </div>
    );
  }
  return (
    <div className="f2">
      <label className="col-label">
        {f.l}
        {f.gate ? <span className="badge badge-soft-warning" style={{ marginLeft: 8, fontSize: 10, padding: "2px 7px" }}>Kræver {f.gate}</span> : null}
      </label>
      <div><Control f={f} /></div>
    </div>
  );
}
