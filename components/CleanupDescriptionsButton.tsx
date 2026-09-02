"use client";

import { useActionState } from "react";
import { cleanupWorkmakerDescriptions, type CleanupResult } from "@/app/actions/cleanup-descriptions";

// Knap der fjerner WorkMaker-metadata fra alle opgavebeskrivelser og viser
// resultatet. Kan trykkes flere gange — andet tryk siger blot "0 fundet".
export default function CleanupDescriptionsButton() {
  const [state, formAction, pending] = useActionState<CleanupResult, FormData>(async (prev, fd) => {
    void prev; void fd;
    return cleanupWorkmakerDescriptions();
  }, { ok: false, scanned: 0, cleaned: 0, skipped: 0, samples: [] });

  return (
    <div style={{ marginBottom: 16 }}>
      <form action={formAction}>
        <button type="submit" className="btn btn-light" disabled={pending}>
          {pending ? "Rydder beskrivelser…" : "Ryd op i WorkMaker-tekst"}
        </button>
      </form>
      {state.ok ? (
        <div className="help-note" style={{ marginTop: 8 }}>
          {state.scanned} beskrivelser med WorkMaker-tekst fundet · {state.cleaned} ryddet · {state.skipped} kræver manuel gennemgang (kun WorkMaker-tekst, ingen rigtig beskrivelse).
          {state.samples.length > 0 && (
            <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
              {state.samples.map((s, i) => <li key={i} style={{ wordBreak: "break-all" }}>{s}</li>)}
            </ul>
          )}
        </div>
      ) : state.error ? (
        <div className="help-note" style={{ marginTop: 8, color: "#C4183C" }}>{state.error}</div>
      ) : null}
    </div>
  );
}
