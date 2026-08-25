"use client";

// "Planlagte ferier" table + reveal-able "Opret ferie" form. Create persists a
// real HolidayWeek (which closes the planner for those weeks); each row can be
// deleted with a confirm.
import { useActionState, useState } from "react";
import { createHoliday, deleteHoliday, type ActionState } from "@/app/actions/funktioner";
import type { WeekOption } from "@/lib/weeks";
import ConfirmButton from "@/components/ConfirmButton";

type Holiday = { id: number; period: string; editableUntil: string };

export default function HolidayManager({ holidays, weekOpts, saveLabel }: { holidays: Holiday[]; weekOpts: WeekOption[]; saveLabel: string }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<ActionState, FormData>(async (p, fd) => {
    const r = await createHoliday(p, fd);
    if (r.ok) setOpen(false);
    return r;
  }, {});

  return (
    <>
      <div className="card">
        <div className="card-body">
          <h4 className="section-title">Planlagte ferier</h4>
          <div className="toolbar"><button className="btn btn-outline-primary" onClick={() => setOpen((v) => !v)}>Opret ny ferie</button></div>
          {state.message ? <div className="help-note" style={{ color: "var(--success)" }}>{state.message}</div> : null}
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Ferienr.</th><th>Ferieperiode (inklusiv)</th><th style={{ width: 120 }} /></tr></thead>
              <tbody>
                {holidays.length === 0 ? (
                  <tr><td colSpan={3}><div className="table-empty">Ingen planlagte ferier</div></td></tr>
                ) : holidays.map((h) => (
                  <tr key={h.id}>
                    <td className="num">{h.id}</td>
                    <td>{h.period}</td>
                    <td>
                      {/* To-trins bekræftelse som ved alle andre destruktive handlinger */}
                      <ConfirmButton
                        action={deleteHoliday.bind(null, h.id)}
                        label="Slet" title="Slet ferie"
                        body={`Slet ferien (${h.period})? Ugerne åbnes igen for planlægning, og kommende abonnementsbesøg lægges i dem.`}
                        confirmLabel="Slet ferie"
                      />
                    </td>
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
