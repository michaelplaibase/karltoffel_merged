"use client";

// Brugerstyring (kun admin): liste over rigtige brugere + reveal-bar opret-formular,
// inline-redigering af lønmodel (fast løn / akkord) per bruger, og per-række
// handlinger: Rediger (/users/[id]/edit) og Deaktivér/Genaktivér (soft-delete).
import { useActionState, useState, useTransition } from "react";
import { createUser, updateUserPay, deactivateUser, reactivateUser, type UserState } from "@/app/actions/users";
import type { UserRow } from "@/lib/users";
import RowMenu, { type RowMenuItem } from "@/components/RowMenu";

// Inline lønmodel-editor per bruger.
function PayEditor({ u }: { u: UserRow }) {
  const [model, setModel] = useState<"fast" | "akkord">(u.payModel);
  const [belob, setBelob] = useState<string>(
    u.payModel === "akkord" ? String(u.commissionPct ?? 43) : (u.monthlySalary != null ? String(u.monthlySalary) : "")
  );
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState(false);
  return (
    <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
      <select value={model} className="form-control form-control-sm" style={{ width: "auto" }}
        onChange={(e) => { setModel(e.target.value as "fast" | "akkord"); setSaved(false); }}>
        <option value="fast">Fast løn</option>
        <option value="akkord">Akkord</option>
      </select>
      <input type="number" min="0" value={belob} placeholder={model === "akkord" ? "%" : "kr/md"}
        className="form-control form-control-sm" style={{ width: 92 }}
        onChange={(e) => { setBelob(e.target.value); setSaved(false); }} />
      <span className="help-note" style={{ margin: 0 }}>{model === "akkord" ? "%" : "kr/md"}</span>
      <button type="button" className="btn btn-sm btn-light" disabled={pending}
        onClick={() => start(async () => { await updateUserPay(u.id, model, belob === "" ? null : Number(belob)); setSaved(true); })}>
        {pending ? "…" : saved ? "Gemt ✓" : "Gem"}
      </button>
    </div>
  );
}

export default function UserManager({ users, meId, includeInactive }: { users: UserRow[]; meId: number; includeInactive: boolean }) {
  const [open, setOpen] = useState(false);
  const [createPay, setCreatePay] = useState<"fast" | "akkord">("fast");
  const [state, formAction, pending] = useActionState<UserState, FormData>(async (p, fd) => {
    const r = await createUser(p, fd);
    if (r.ok) setOpen(false);
    return r;
  }, {});
  // getUsers returnerer altid ALLE aktive brugere, så tælleren er korrekt uanset toggle.
  const activeAdmins = users.filter((u) => u.rolle === "admin" && u.active).length;

  return (
    <div className="container-1140">
      <p className="page-desc" style={{ marginTop: 4 }}>
        Administrér brugere. Kun administratorer kan oprette, redigere og deaktivere profiler (administrator eller medarbejder) og sætte lønmodel.
      </p>
      <div className="card">
        <div className="card-body">
          <h1 className="page-title">Brugere</h1>
          <div className="toolbar">
            <button className="btn btn-primary" onClick={() => setOpen((v) => !v)}>Opret ny bruger</button>
          </div>
          <label className="form-check-inline" style={{ marginBottom: 12 }}>
            <input type="checkbox" defaultChecked={includeInactive}
              onChange={(e) => { const sp = new URLSearchParams(); if (e.currentTarget.checked) sp.set("inactive", "1"); window.location.search = sp.toString(); }} /> Vis deaktiverede brugere
          </label>
          <div className="table-wrap">
            <table className="data-table rowstack">
              <thead>
                <tr><th>Navn</th><th>Brugernavn</th><th>Rolle</th><th>Login</th><th>Lønmodel</th><th style={{ width: 44 }} /></tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr><td colSpan={6} data-fullspan><div className="table-empty">Ingen brugere fundet</div></td></tr>
                ) : users.map((u) => {
                  // Deaktivering/degradering er låst for dig selv og for den sidste aktive admin.
                  const locked = u.id === meId || (u.rolle === "admin" && u.active && activeAdmins <= 1);
                  const items: RowMenuItem[] = [{ label: "Rediger", href: `/users/${u.id}/edit` }];
                  if (!u.active) {
                    items.push({ label: "Genaktivér", action: () => reactivateUser(u.id) });
                  } else if (!locked) {
                    items.push({
                      label: "Deaktivér", danger: true,
                      action: () => deactivateUser(u.id),
                      confirm: {
                        title: "Deaktivér bruger",
                        body: `Er du sikker på, at du vil deaktivere ${u.navn}? Brugeren kan ikke længere logge ind og forsvinder fra kalender og medarbejder-vælgere.`,
                        confirmLabel: "Deaktivér",
                        note: "Brugeren slettes ikke — historik (ordrer, løn, tidsposter) bevares, og profilen kan genaktiveres.",
                      },
                    });
                  }
                  return (
                    <tr key={u.id} style={{ opacity: u.active ? 1 : 0.5 }}>
                      <td data-label="Navn">{u.navn}</td>
                      <td data-label="Brugernavn">{u.username}</td>
                      <td data-label="Rolle">
                        {u.rolle === "admin"
                          ? <span className="badge badge-soft-warning">Administrator</span>
                          : <span className="badge badge-soft-muted">Medarbejder</span>}
                      </td>
                      <td data-label="Login">
                        {!u.active
                          ? <span className="badge badge-soft-danger">Deaktiveret</span>
                          : u.kanLogge
                            ? <span className="badge badge-soft-success">Aktiv</span>
                            : <span className="badge badge-soft-muted">Intet kodeord</span>}
                      </td>
                      <td data-label="Lønmodel"><PayEditor u={u} /></td>
                      <td><RowMenu items={items} /></td>
                    </tr>
                  );
                })}
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
              <div className="f2"><label className="col-label">Lønmodel</label><div>
                <select name="payModel" className="form-control form-control-sm" value={createPay} onChange={(e) => setCreatePay(e.target.value as "fast" | "akkord")}>
                  <option value="fast">Fast løn</option>
                  <option value="akkord">Akkord (provision)</option>
                </select>
              </div></div>
              <div className="f2"><label className="col-label">{createPay === "akkord" ? "Provisionssats (%)" : "Fast løn (kr/md)"}</label><div>
                <input name="belob" type="number" min="0" className="form-control form-control-sm" placeholder={createPay === "akkord" ? "fx 43" : "fx 32000"} />
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
