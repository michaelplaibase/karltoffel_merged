"use client";

import { useActionState } from "react";
import { recalculateDurations, type RecalcResult } from "@/app/actions/recalc-durations";

// Knap der genberegner ALLE TaskLine-varigheder ud fra den aktuelle minutpris
// (pris inkl. moms ÷ 1,25 ÷ minutpris). Kan trykkes flere gange — andet tryk
// uden ændringer siger blot "0 varigheder opdateret" (idempotent).
export default function RecalculateDurationsButton() {
  const [state, formAction, pending] = useActionState<RecalcResult, FormData>(async (prev, fd) => {
    void prev; void fd;
    return recalculateDurations();
  }, { ok: false, scanned: 0, changed: 0 });

  return (
    <div style={{ marginBottom: 16 }}>
      <form action={formAction}>
        <button type="submit" className="btn btn-light" disabled={pending}>
          {pending ? "Genberegner varigheder…" : "Genberegn varigheder"}
        </button>
      </form>
      {state.ok ? (
        <div className="help-note" style={{ marginTop: 8 }}>
          {state.scanned} linjer med pris gennemgået · {state.changed} varigheder opdateret.
        </div>
      ) : state.error ? (
        <div className="help-note" style={{ marginTop: 8, color: "#C4183C" }}>{state.error}</div>
      ) : null}
    </div>
  );
}
