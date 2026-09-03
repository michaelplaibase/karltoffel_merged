"use client";

import Link from "next/link";
import { useState } from "react";
import { useActionState } from "react";
import type { CompleteOrderState } from "@/app/actions/orders";

const radioRow: React.CSSProperties = { display: "flex", alignItems: "center", gap: 9, fontWeight: 300, padding: "3px 0" };

type Mode = "faerdig" | "flyt" | "aflys" | null;

const choiceBtn = (active: boolean): React.CSSProperties => ({
  display: "block",
  width: "100%",
  textAlign: "left",
  padding: "14px 16px",
  marginBottom: 10,
  borderRadius: 10,
  border: active ? "2px solid #4C3718" : "2px solid #ddd",
  background: active ? "#FFF87B" : "#fff",
  fontSize: 16,
  fontWeight: 600,
  cursor: "pointer",
});

export default function CompleteOrderForm({
  completeAction, moveAction, backUrl, paymentPreselect,
}: {
  completeAction: (state: CompleteOrderState, formData: FormData) => Promise<CompleteOrderState>;
  /** Server action der flytter opgaven til en valgt dag (bound med orderId + backUrl). */
  moveAction: (formData: FormData) => Promise<void>;
  backUrl: string;
  /** Kundens/global forudindstilling for betaling — bruges som skjult default ved
   *  ét-tryk færdigmeld, så faktureringen stadig følger de almindelige regler. */
  paymentPreselect?: string;
}) {
  const [mode, setMode] = useState<Mode>(null);
  const [state, formAction, pending] = useActionState(completeAction, {});
  const v = state.values;

  return (
    <>
      {/* Skjult felter for hoved-formularen — udfyldes pr. valgt handling */}
      <form action={formAction}>
        <input type="hidden" name="backUrl" value={backUrl} />
        <input type="hidden" name="leveringsstatus" value={mode === "aflys" ? "skip" : "udfoert"} />
        {/* Ét-tryk færdigmeld bruger kundens/global standard for fakturering */}
        {mode === "faerdig" && paymentPreselect ? (
          <input type="hidden" name="betaling" value={paymentPreselect} />
        ) : null}

        <div className="card">
          <div className="card-header"><h4 className="section-title">Hvad vil du gøre?</h4></div>
          <div className="card-body tight">
            <button type="button" className="btn" style={choiceBtn(mode === "faerdig")} onClick={() => setMode(mode === "faerdig" ? null : "faerdig")}>
              ✅ Færdigmeld opgave
            </button>
            <button type="button" className="btn" style={choiceBtn(mode === "flyt")} onClick={() => setMode(mode === "flyt" ? null : "flyt")}>
              📅 Flyt opgave til anden dag
            </button>
            <button type="button" className="btn" style={choiceBtn(mode === "aflys")} onClick={() => setMode(mode === "aflys" ? null : "aflys")}>
              ❌ Aflys opgave
            </button>

            {mode === "faerdig" && (
              <div style={{ marginTop: 6 }}>
                <p className="muted" style={{ margin: "0 0 10px" }}>
                  Opgaven lukkes som udført med de almindelige indstillinger.
                </p>
                <button type="submit" className="btn btn-primary" disabled={pending}>
                  {pending ? "Færdigmelder…" : "Færdigmeld nu"}
                </button>
              </div>
            )}

            {mode === "aflys" && (
              <div style={{ marginTop: 6 }}>
                <label htmlFor="aflysAarsag" style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Hvorfor aflyses opgaven?</label>
                <textarea
                  id="aflysAarsag"
                  name="comment"
                  className="form-control form-control-sm"
                  rows={2}
                  required
                  defaultValue={v?.comment ?? ""}
                  placeholder="F.eks.: Kunden aflyste, sygdom, vejrlig…"
                />
                <button type="submit" className="btn btn-danger" style={{ marginTop: 10 }} disabled={pending}>
                  {pending ? "Aflyser…" : "Aflys opgave"}
                </button>
              </div>
            )}
          </div>
        </div>
      </form>

      {mode === "flyt" && (
        <form action={moveAction}>
          <input type="hidden" name="backUrl" value={backUrl} />
          <div className="card">
            <div className="card-header"><h4 className="section-title">Flyt til anden dag</h4></div>
            <div className="card-body tight">
              <label htmlFor="newDate" style={{ display: "block", fontWeight: 600, marginBottom: 6 }}>Vælg ny dato</label>
              <input id="newDate" name="newDate" type="date" required className="form-control form-control-sm" style={{ maxWidth: 220 }} />
              <button type="submit" className="btn btn-primary" style={{ marginTop: 10, display: "block" }}>
                Flyt opgave
              </button>
            </div>
          </div>
        </form>
      )}

      {state.error && mode !== "flyt" && <div style={{ color: "#c0392b", fontSize: 13, margin: "10px 0" }}>{state.error}</div>}

      <div className="savebar">
        <Link href={backUrl} className="btn btn-light">Tilbage</Link>
      </div>
    </>
  );
}
