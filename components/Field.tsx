import type { SField } from "@/lib/settings-config";

// Renders one settings field. Two modes:
//  • display-only (no `name`) — used by the Funktioner pages that just show a config.
//  • editable (a `name` is passed) — used by SettingsForm; renders real inputs
//    whose values round-trip through the settings store (values arrive as string[]).
export function Control({ f, name, value }: { f: SField; name?: string; value?: string[] }) {
  const help = f.help ? <small className="form-text">{f.help}</small> : null;
  const v0 = value?.[0];

  if (name) {
    switch (f.t) {
      case "textarea":
        return <><textarea name={name} className="form-control" rows={5} defaultValue={v0 ?? f.val ?? ""} />{help}</>;
      case "select":
        return <><select name={name} className="form-control form-control-sm" defaultValue={v0 ?? f.val ?? ""}>{(f.opts ?? []).map((o, i) => <option key={i}>{o}</option>)}</select>{help}</>;
      case "checks":
        // Hidden sentinel keeps the key present even when every box is unchecked,
        // so "clear all" persists instead of reverting to the config default.
        return <><div style={{ paddingTop: 4 }}><input type="hidden" name={name} value="" />{(f.opts ?? []).map((o, i) => {
          const on = value ? value.includes(o) : (Array.isArray(f.on) ? f.on.includes(i) : false);
          return <label className="form-check-inline" key={i}><input type="checkbox" name={name} value={o} defaultChecked={on} /> {o}</label>;
        })}</div>{help}</>;
      case "radio":
        return <><div className="radio">{(f.opts ?? []).map((o, i) => {
          const on = value ? value[0] === o : (f.on === i);
          return <label className={`rad${on ? " on" : ""}`} key={i} style={{ cursor: "pointer", display: "flex", alignItems: "center", gap: 8 }}><input type="radio" name={name} value={o} defaultChecked={on} /> {o}</label>;
        })}</div>{help}</>;
      case "toggle": {
        const on = value ? value[value.length - 1] === "Ja" : (f.on === 1);
        return <><label style={{ display: "inline-flex", alignItems: "center", gap: 9, paddingTop: 4, fontWeight: 300 }}><input type="hidden" name={name} value="Nej" /><input type="checkbox" name={name} value="Ja" defaultChecked={on} /> Ja</label>{help}</>;
      }
      case "color":
        return <><div style={{ display: "flex", alignItems: "center", gap: 10 }}><input type="color" name={name} defaultValue={v0 ?? f.val ?? "#000000"} style={{ width: 54, height: 30, padding: 0, border: "1px solid var(--card-border)" }} /></div>{help}</>;
      default: // text / number / date
        return <><input name={name} className="form-control form-control-sm" type={f.t === "number" ? "number" : f.t === "date" ? "date" : "text"} defaultValue={v0 ?? f.val ?? ""} />{help}</>;
    }
  }

  // Display-only rendering.
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

export function Field({ f, name, value }: { f: SField; name?: string; value?: string[] }) {
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
      <label className="col-label">{f.l}</label>
      <div><Control f={f} name={name} value={value} /></div>
    </div>
  );
}
