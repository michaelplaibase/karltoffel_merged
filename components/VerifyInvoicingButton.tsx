"use client";

import { useActionState } from "react";
import { verifyInvoicing, type VerifyResult } from "@/app/actions/invoicing-verify";

// Knap der verificerer /fakturering-linjerne mod Dinero og viser resultatet.
export default function VerifyInvoicingButton() {
  const [state, formAction, pending] = useActionState<VerifyResult, FormData>(async (prev, fd) => {
    void prev; void fd;
    return verifyInvoicing();
  }, { ok: false, checked: 0, corrected: 0, entries: [] });

  return (
    <div style={{ marginBottom: 16 }}>
      <form action={formAction}>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Opdaterer fakturastatus…" : "Opdatér fakturastatus"}
        </button>
      </form>
      {state.ok ? (
        <div className="help-note" style={{ marginTop: 8 }}>
          Tjekket {state.checked} ordrer · {state.corrected} afvigelser rettet.
          {state.entries.filter((e) => e.corrected || e.error).length > 0 && (
            <ul style={{ margin: "6px 0 0", paddingLeft: 18 }}>
              {state.entries.filter((e) => e.corrected || e.error).map((e) => (
                <li key={e.orderId}>
                  Ordre #{e.orderId}: {e.error ? e.error : e.dineroStatus}
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : state.error ? (
        <div className="help-note" style={{ marginTop: 8, color: "#C4183C" }}>{state.error}</div>
      ) : null}
    </div>
  );
}
