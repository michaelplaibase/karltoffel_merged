"use client";

import { useActionState } from "react";
import { login } from "@/app/actions/auth";

export default function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState(login, {});

  return (
    <div className="card form-card" style={{ maxWidth: 420 }}>
      <div className="card-header header-primary">
        <h3>Log ind på Karltoffel</h3>
      </div>
      <div className="card-body">
        <form action={formAction}>
          {/* Dybt link afbrudt af udløbet session — login sender videre dertil. */}
          {next ? <input type="hidden" name="next" value={next} /> : null}
          <div className="f2">
            <label>Brugernavn</label>
            {/* React 19 resetter ukontrollerede felter efter en form-action —
                state.values ekkoer brugernavnet, så det overlever en fejl. */}
            <input name="username" defaultValue={state.values?.username ?? ""} className="form-control form-control-sm" autoComplete="username" autoFocus />
          </div>
          <div className="f2">
            <label>Adgangskode</label>
            <input name="password" type="password" className="form-control form-control-sm" autoComplete="current-password" />
          </div>
          <div className="f2">
            <label>Husk mig</label>
            <label className="form-check-inline" style={{ marginTop: 6 }}>
              <input type="checkbox" name="remember" defaultChecked={state.values?.remember ?? true} /> Hold mig logget ind i 30 dage
            </label>
          </div>

          {state.error && <div style={{ color: "#c0392b", fontSize: 13, margin: "4px 0 8px" }}>{state.error}</div>}

          <div className="savebar">
            <span className="field-help" />
            <button type="submit" className="btn btn-primary" disabled={pending}>
              {pending ? "Logger ind…" : "Log ind"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
