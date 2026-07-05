"use client";

// Rabatkoder CRUD: reveal-able create form + a table of real DiscountCode rows,
// each deletable. Backed by the DiscountCode model.
import { useActionState, useState, useTransition } from "react";
import { createDiscountCode, deleteDiscountCode, type CatalogState } from "@/app/actions/catalog";

type Code = { id: number; code: string; percent: number; expiresAt: string };

export default function DiscountCodeManager({ codes }: { codes: Code[] }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<CatalogState, FormData>(async (p, fd) => {
    const r = await createDiscountCode(p, fd);
    if (r.ok) setOpen(false);
    return r;
  }, {});
  const [delPending, startDel] = useTransition();

  return (
    <div className="container-1140" style={{ maxWidth: 900 }}>
      <p className="page-desc" style={{ marginTop: 4 }}>Vis og administrer procentvise rabatkoder, som kunder kan anvende ved online bestilling.</p>
      <div className="card">
        <div className="card-body">
          <h1 className="page-title">Rabatkoder</h1>
          <div className="help-note" style={{ marginBottom: 16 }}>Rabatkoder kan anvendes af kunder ved online bestilling.</div>
          <div className="toolbar"><button className="btn btn-primary" onClick={() => setOpen((v) => !v)}>Opret ny rabatkode</button></div>
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Rabatkode</th><th>Procentsats</th><th>Udløbsdato</th><th style={{ width: 80 }}>Slet</th></tr></thead>
              <tbody>
                {codes.length === 0 ? (
                  <tr><td colSpan={4}><div className="table-empty">Ingen rabatkoder fundet</div></td></tr>
                ) : codes.map((c) => (
                  <tr key={c.id}>
                    <td>{c.code}</td><td className="num">{c.percent}%</td><td>{c.expiresAt || "—"}</td>
                    <td><button className="btn btn-sm btn-light" disabled={delPending} style={{ color: "var(--danger, #C4183C)" }}
                      onClick={() => startDel(async () => { await deleteDiscountCode(c.id); })}>Slet</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {open && (
        <div className="card">
          <div className="card-body">
            <h4 className="section-title">Opret rabatkode</h4>
            <form action={formAction}>
              <div className="f2"><label className="col-label">Rabatkode</label><div><input name="code" className="form-control form-control-sm" /></div></div>
              <div className="f2"><label className="col-label">Procentsats</label><div><input name="percent" type="number" min="1" max="100" className="form-control form-control-sm" /></div></div>
              <div className="f2"><label className="col-label">Slutdato</label><div><input name="expiresAt" type="date" className="form-control form-control-sm" /></div></div>
              {state.error ? <div className="help-note" style={{ color: "var(--danger, #C4183C)" }}>{state.error}</div> : null}
              <hr className="section-hr" />
              <div className="row-actions">
                <button type="button" className="btn btn-light" onClick={() => setOpen(false)}>Luk</button>
                <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Gemmer…" : "Gem rabatkode"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
