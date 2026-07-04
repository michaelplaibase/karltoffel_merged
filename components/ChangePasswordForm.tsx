"use client";

import { useActionState } from "react";
import { changePassword, type ChangePasswordState } from "@/app/actions/auth";

export default function ChangePasswordForm() {
  const [state, formAction, pending] = useActionState<ChangePasswordState, FormData>(changePassword, {});
  return (
    <form action={formAction}>
      <div className="f2"><label className="col-label">Nuværende adgangskode</label><div><input name="old" type="password" className="form-control form-control-sm" autoComplete="current-password" /></div></div>
      <div className="f2"><label className="col-label">Ny adgangskode</label><div><input name="new" type="password" className="form-control form-control-sm" autoComplete="new-password" /></div></div>
      <div className="f2"><label className="col-label">Gentag ny adgangskode</label><div><input name="confirm" type="password" className="form-control form-control-sm" autoComplete="new-password" /></div></div>
      {state.error ? <div className="help-note" style={{ color: "var(--danger, #C4183C)" }}>{state.error}</div> : null}
      {state.ok ? <div className="help-note" style={{ color: "var(--success)" }}>✓ Din adgangskode er ændret.</div> : null}
      <hr className="section-hr" />
      <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Skifter…" : "Skift password"}</button>
    </form>
  );
}
