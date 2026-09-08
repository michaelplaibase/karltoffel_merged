"use client";

// "Ret startuger og generér ordrer"-knap (Abonnementer, admin-only): kører
// fixStaleFutureWeeks (app/actions/fix-stale-weeks.ts) og viser rapporten.
import { useActionState } from "react";
import { fixStaleFutureWeeks, type FixStaleResult } from "@/app/actions/fix-stale-weeks";

const initial: FixStaleResult = { ok: true, scanned: 0, fixed: 0, details: [] };

async function run(_prev: FixStaleResult, _formData: FormData): Promise<FixStaleResult> {
  return fixStaleFutureWeeks();
}

export default function FixStaleWeeksButton() {
  const [state, formAction, pending] = useActionState(run, initial);
  return (
    <form action={formAction} style={{ display: "inline" }}>
      <button type="submit" className="btn btn-light" disabled={pending}
        title="Rykker fremtids-årstilte startuger tilbage til nu og genererer de manglende ordrer">
        {pending ? "Retter…" : "Ret manglende ordrer"}
      </button>
      {state.fixed > 0 && (
        <div style={{ marginTop: 8 }}>
          <b style={{ color: "#2e7d5b" }}>{state.fixed} abonnement(er) rettet:</b>
          <ul style={{ margin: "4px 0 0 18px", padding: 0 }}>
            {state.details.map((d, i) => <li key={i} className="muted">{d}</li>)}
          </ul>
        </div>
      )}
      {state.fixed === 0 && state.ok && !pending && (
        <span style={{ marginLeft: 8, color: "#2e7d5b" }}>Ingen abonnementer behøver rettelse.</span>
      )}
      {state.error && <span style={{ marginLeft: 8, color: "#c2506e" }}>{state.error}</span>}
    </form>
  );
}
