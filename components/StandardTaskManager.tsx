"use client";

// Standardopgaver CRUD: search (GET ?q=), "Vis også deaktive" toggle, a
// reveal-able create form, and a table of real StandardTask rows each with a
// deactivate/reactivate action (system tasks are locked).
import { useActionState, useState, useTransition } from "react";
import { CATEGORIES } from "@/lib/categories";
import { CatChip } from "@/components/ui";
import { createStandardTask, toggleStandardTask, type CatalogState } from "@/app/actions/catalog";

type Task = { id: number; category: string; description: string; letter: string; presence: boolean; isSystem: boolean; active: boolean };

export default function StandardTaskManager({ tasks, q, includeInactive }: { tasks: Task[]; q?: string; includeInactive: boolean }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<CatalogState, FormData>(async (p, fd) => {
    const r = await createStandardTask(p, fd);
    if (r.ok) setOpen(false);
    return r;
  }, {});
  const [togglePending, startToggle] = useTransition();
  const cats = Object.keys(CATEGORIES);

  return (
    <div className="container-1140" style={{ maxWidth: 900 }}>
      <p className="page-desc" style={{ marginTop: 4 }}>Oversigten viser alle dine standardopgaver. Når du redigerer en standardopgave, så slår ændringen igennem alle steder, hvor standardopgaven er i brug.</p>
      <div className="card">
        <div className="card-body">
          <h1 className="page-title">Oversigt over standardopgaver</h1>
          <div className="toolbar">
            <button className="btn btn-primary" onClick={() => setOpen((v) => !v)}>Opret ny standardopgave</button>
            <form className="searchbar" method="get">
              <input className="form-control" name="q" placeholder="beskrivelse, kategori, bogstav" defaultValue={q ?? ""} />
              {includeInactive ? <input type="hidden" name="inactive" value="1" /> : null}
              <button className="btn btn-light" type="submit">Søg</button>
            </form>
          </div>
          <label className="form-check-inline" style={{ marginBottom: 12 }}>
            <input type="checkbox" defaultChecked={includeInactive}
              onChange={(e) => { const sp = new URLSearchParams(); if (q) sp.set("q", q); if (e.currentTarget.checked) sp.set("inactive", "1"); window.location.search = sp.toString(); }} /> Vis også deaktive standardopgaver
          </label>

          <div className="table-wrap">
            <table className="data-table rowstack">
              <thead><tr><th style={{ width: 34 }} /><th>Kategori</th><th>Beskrivelse</th><th>Kunden skal være tilstede</th><th style={{ width: 120 }} /></tr></thead>
              <tbody>
                {tasks.length === 0 ? (
                  <tr><td colSpan={5} data-fullspan><div className="table-empty">Ingen standardopgaver fundet</div></td></tr>
                ) : tasks.map((t) => (
                  <tr key={t.id} style={{ opacity: t.active ? 1 : 0.5 }}>
                    <td><CatChip category={t.category} letter={t.letter || t.category[0]} /></td>
                    <td data-label="Kategori">{t.category}</td>
                    <td data-label="Beskrivelse">{t.description}{t.isSystem ? <span className="badge badge-soft-muted" style={{ marginLeft: 6 }}>system</span> : null}</td>
                    <td data-label="Kunden skal være tilstede">{t.presence ? "Ja" : ""}</td>
                    <td>{t.isSystem ? <span className="muted" style={{ fontSize: 12 }}>låst</span> : (
                      <button className="btn btn-sm btn-light" disabled={togglePending} onClick={() => startToggle(async () => { await toggleStandardTask(t.id); })}>
                        {t.active ? "Deaktiver" : "Reaktiver"}
                      </button>
                    )}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="help-note" style={{ marginTop: 10 }}>Systemopgaver er låst og kan hverken redigeres eller deaktiveres.</div>
        </div>
      </div>

      {open && (
        <div className="card">
          <div className="card-body">
            <h4 className="section-title">Opret ny standardopgave</h4>
            <form action={formAction}>
              <div className="f2"><label className="col-label">Kategori</label><div>
                <select name="category" className="form-control form-control-sm" defaultValue={cats[0]}>{cats.map((c) => <option key={c}>{c}</option>)}</select></div></div>
              <div className="f2"><label className="col-label">Beskrivelse</label><div><input name="description" className="form-control form-control-sm" /></div></div>
              <div className="f2"><label className="col-label">Kunden skal være tilstede</label><div>
                <label className="form-check-inline"><input type="checkbox" name="presence" /> Ja</label></div></div>
              {state.error ? <div className="help-note" style={{ color: "var(--danger, #C4183C)" }}>{state.error}</div> : null}
              <hr className="section-hr" />
              <div className="row-actions">
                <button type="button" className="btn btn-light" onClick={() => setOpen(false)}>Luk</button>
                <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Gemmer…" : "Opret standardopgave"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
