"use client";

// "Generér kommende ordrer"-knap (Abonnementer). Bruger useActionState så der
// er synlig feedback: ventetilstand under generering + antal oprettede ordrer
// eller en fejlbesked bagefter. Tidligere var knappen stum — intet skete
// visuelt før en eventuel redirect, og fejl blev aldrig vist.
import { useActionState } from "react";
import { regenerateOrders, type GenerateOrdersState } from "@/app/actions/subscriptions";

const initial: GenerateOrdersState = {};

export default function GenerateOrdersButton() {
  const [state, formAction, pending] = useActionState(regenerateOrders, initial);
  return (
    <form action={formAction} style={{ display: "inline" }}>
      <button type="submit" className="btn btn-light" disabled={pending} title="Opret kommende ordrer for alle abonnementer">
        {pending ? "Genererer…" : "Generér kommende ordrer"}
      </button>
      {state.created !== undefined && (
        <span style={{ marginLeft: 8, color: "#2e7d5b" }}>
          {state.created} kommende {state.created === 1 ? "ordre" : "ordrer"} oprettet.
        </span>
      )}
      {state.error && <span style={{ marginLeft: 8, color: "#c2506e" }}>{state.error}</span>}
    </form>
  );
}
