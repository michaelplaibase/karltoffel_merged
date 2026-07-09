"use client";

// Brugerstyring (kun admin): liste over rigtige brugere + en reveal-bar
// opret-formular. Admins kan oprette både admin- og medarbejder-profiler.
// Spejler mønstret fra DiscountCodeManager (formular + tabel via server action).
import { useActionState, useState } from "react";
import { createUser, type UserState } from "@/app/actions/users";
import type { UserRow } from "@/lib/users";

export default function UserManager({ users }: { users: UserRow[] }) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState<UserState, FormData>(async (p, fd) => {
    const r = await createUser(p, fd);
    if (r.ok) setOpen(false);
    return r;
  }, {});

  return (
    <div className="container-1140" style={{ maxWidth: 900 }}>
      <p className="page-desc" style={{ marginTop: 4 }}>
        Administrér brugere. Kun administratorer kan oprette nye profiler — enten som administrator eller som medarbejder.
      </p>
      <div className="card">
        <div className="card-body">
          <h1 className="page-title">Brugere</h1>
          <div className="toolbar">
            <button className="btn btn-primary" onClick={() => setOpen((v) => !v)}>Opret ny bruger</button>
          </div>
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr><th>Navn</th><th>Brugernavn</th><th>E-mail</th><th>Rolle</th><th>Login</th></tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr><td colSpan={5}><div className="table-empty">Ingen brugere fundet</div></td></tr>
                ) : users.map((u) => (
                  <tr key={u.id}>
                    <td>{u.navn}</td>
                    <td>{u.username}</td>
                    <td>{u.email || "—"}</td>
                    <td>
                      {u.rolle === "admin"
                        ? <span className="badge badge-soft-warning">Administrator</span>
                        : <span className="badge badge-soft-muted">Medarbejder</span>}
                    </td>
                    <td>
                      {u.kanLogge
                        ? <span className="badge badge-soft-success">Aktiv</span>
                        : <span className="badge badge-soft-muted">Intet kodeord</span>}
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
            <h4 className="section-title">Opret bruger</h4>
            <form action={formAction}>
              <div className="f2"><label className="col-label">Fornavn</label><div><input name="firstName" className="form-control form-control-sm" autoComplete="off" /></div></div>
              <div className="f2"><label className="col-label">Efternavn</label><div><input name="lastName" className="form-control form-control-sm" autoComplete="off" /></div></div>
              <div className="f2"><label className="col-label">Brugernavn</label><div><input name="username" className="form-control form-control-sm" autoComplete="off" placeholder="fx annebruun" /></div></div>
              <div className="f2"><label className="col-label">E-mail (valgfri)</label><div><input name="email" type="email" className="form-control form-control-sm" autoComplete="off" /></div></div>
              <div className="f2"><label className="col-label">Adgangskode</label><div><input name="password" type="password" className="form-control form-control-sm" autoComplete="new-password" placeholder="Mindst 8 tegn" /></div></div>
              <div className="f2"><label className="col-label">Rolle</label><div>
                <select name="rolle" className="form-control form-control-sm" defaultValue="medarbejder">
                  <option value="medarbejder">Medarbejder</option>
                  <option value="admin">Administrator (kan oprette brugere)</option>
                </select>
              </div></div>
              {state.error ? <div className="help-note" style={{ color: "var(--danger, #C4183C)" }}>{state.error}</div> : null}
              <hr className="section-hr" />
              <div className="row-actions">
                <button type="button" className="btn btn-light" onClick={() => setOpen(false)}>Luk</button>
                <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Opretter…" : "Opret bruger"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
