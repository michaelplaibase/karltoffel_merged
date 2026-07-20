"use client";

// "Planlagte ferier" table + reveal-able "Opret ferie" form. Create persists a
// real HolidayWeek (which closes the planner for those weeks); each row can be
// deleted with a confirm.
import { useActionState, useState, useTransition } from "react";
import { createHoliday, deleteHoliday, type ActionState } from "@/app/actions/funktioner";
import type { WeekOption } from "@/lib/weeks";

type Holiday = { id: number; period: string; editableUntil: string };

export default function HolidayManager({ holidays, weekOpts, saveLabel }: { holidays: Holiday[]; weekOpts: WeekOption[]; saveLabel: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(async (p, fd) => {
    const r = await createHoliday(p, fd);
    if (r.ok) setOpen(false);
    return r;
  }, {});
  const [delPending, startDel] = useTransition();

  return (
    <>
      <div className="card">
        <div className="card-body">
          <h4 className="section-title">Planlagte ferier</h4>
          <div className="toolbar"><button className="btn btn-outline-primary" onClick={() => setOpen((v) => !v)}>Opret ny ferie</button></div>
          {state.message ? <div className="help-note" style={{ color: "var(--success)" }}>{state.message}</div> : null}
          <div className="table-wrap">
            <table className="data-table stack">
              <thead><tr><th>Ferienr.</th><th>Ferieperiode (inklusiv)</th><th>Kan redigeres til og med</th><th style={{ width: 90 }} /></tr></thead>
              <tbody>
                {holidays.length === 0 ? (
                  <tr><td colSpan={4} data-fullspan><div className="table-empty">Ingen planlagte ferier</div></td></tr>
                ) : holidays.map((h) => (
                  <tr key={h.id}>
                    <td className="num" data-label="Ferienr.">{h.id}</td>
                    <td data-label="Ferieperiode (inklusiv)">{h.period}</td>
                    <td data-label="Kan redigeres til og med">{h.editableUntil}</td>
                    <td><button className="btn btn-sm btn-light" disabled={delPending}
                      onClick={() => startDel(async () => { await deleteHoliday(h.id); })}
                      style={{ color: "var(--danger, #C4183C)" }}>Slet</button></td>
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
            <h4 className="section-title">Opret ferie</h4>
            <form action={formAction}>
              <div className="f2">
                <label className="col-label">Startuge</label>
                <select name="startWeek" className="form-control form-control-sm" defaultValue={weekOpts[0]?.value}>
                  {weekOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="f2">
                <label className="col-label">Slutuge</label>
                <select name="endWeek" className="form-control form-control-sm" defaultValue={weekOpts[0]?.value}>
                  {weekOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              {state.error ? <div className="help-note" style={{ color: "var(--danger, #C4183C)" }}>{state.error}</div> : null}
              <hr className="section-hr" />
              <div className="row-actions">
                <button type="button" className="btn btn-light" onClick={() => setOpen(false)}>Luk</button>
                <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Gemmer…" : saveLabel}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
