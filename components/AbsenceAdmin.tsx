"use client";
// Admin-delen af fraværssiden: godkend/afvis ferieansøgninger + registrér
// fravær på vegne af en medarbejder.
import { useState, useTransition } from "react";
import { approveAbsenceAction, rejectAbsenceAction, registerForEmployeeAction } from "@/app/actions/absence";

type Msg = { ok: boolean; text: string } | null;

export function PendingQueue({ items }: { items: { id: number; navn: string; type: string; dateISO: string; dato: string; note: string | null }[] }) {
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, start] = useTransition();
  if (!items.length) return null;
  const decide = (id: number, approve: boolean) => {
    start(async () => {
      const r = approve ? await approveAbsenceAction(id) : await rejectAbsenceAction(id);
      setMsg({ ok: r.ok, text: r.message });
    });
  };
  return (
    <div className="card">
      <div className="card-body">
        <h4 className="section-title">Ferieansøgninger, der venter på godkendelse</h4>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr><th>Medarbejder</th><th>Type</th><th>Dato</th><th>Besked</th><th></th></tr>
            </thead>
            <tbody>
              {items.map((i) => (
                <tr key={i.id}>
                  <td>{i.navn}</td>
                  <td>{i.type}</td>
                  <td>{i.dato}</td>
                  <td>{i.note ?? "—"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <button type="button" className="btn btn-primary btn-sm" disabled={pending} onClick={() => decide(i.id, true)}>Godkend</button>{" "}
                    <button type="button" className="btn btn-danger btn-sm" disabled={pending} onClick={() => decide(i.id, false)}>Afvis</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {msg && <p style={{ marginTop: 10, color: msg.ok ? "var(--success, #4a7c2f)" : "var(--danger, #b3261e)" }}>{msg.text}</p>}
      </div>
    </div>
  );
}

export function RegisterForEmployee({ employees }: { employees: { id: number; navn: string }[] }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<Msg>(null);
  return (
    <div className="card">
      <div className="card-body">
        <h4 className="section-title">Registrér fravær for en medarbejder</h4>
        <form action={(fd) => start(async () => { await registerForEmployeeAction(fd); setMsg({ ok: true, text: "Registreret — e-mail er sendt til kontoret." }); })}>
          <div className="toolbar" style={{ gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
            <label>
              Medarbejder<br />
              <select name="userId" className="form-control form-control-sm">
                {employees.map((e) => <option key={e.id} value={e.id}>{e.navn}</option>)}
              </select>
            </label>
            <label>
              Type<br />
              <select name="type" className="form-control form-control-sm">
                <option value="sygdom">Sygdom</option>
                <option value="ferie">Ferie</option>
              </select>
            </label>
            <label>
              Dato<br />
              <input type="date" name="date" required className="form-control form-control-sm" />
            </label>
            <label style={{ flex: 1, minWidth: 180 }}>
              Besked (valgfri)<br />
              <input name="note" className="form-control form-control-sm" />
            </label>
            <button type="submit" className="btn btn-primary btn-sm" disabled={pending}>
              {pending ? "Registrerer…" : "Registrér"}
            </button>
          </div>
        </form>
        {msg && <p style={{ marginTop: 10, color: msg.ok ? "var(--success, #4a7c2f)" : "var(--danger, #b3261e)" }}>{msg.text}</p>}
      </div>
    </div>
  );
}