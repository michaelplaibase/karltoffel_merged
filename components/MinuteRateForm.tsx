"use client";

// Lille kort på /settings: redigerer virksomhedens minutpris (kr/min EKSKL.
// moms, gemt i øre på Company.minutePriceOere). Opgave-editoren bruger satsen
// til automatisk at beregne varighed ud fra prisen (inkl. moms).
import { useActionState } from "react";
import { saveMinuteRate } from "@/app/actions/settings";

export default function MinuteRateForm({ rate }: { rate: number }) {
  const [state, formAction, pending] = useActionState(saveMinuteRate, {});

  return (
    <div className="container-1140" style={{ maxWidth: 900 }}>
      <div className="card">
        <div className="card-header"><h4 className="section-title">Minutpris til varighedsberegning</h4></div>
        <div className="card-body tight">
          <form action={formAction}>
            <label className="field-label">Minutpris (kr/min)</label>
            <input
              name="minuteRate" type="text" inputMode="decimal"
              defaultValue={rate.toLocaleString("da-DK")} placeholder="8,6"
              className="form-control form-control-sm" style={{ maxWidth: 160 }}
            />
            <small className="form-text field-help">
              Kr. pr. minut EKSKL. moms. Bruges til automatisk at beregne varighed ud fra prisen (pris inkl. moms ÷ 1,25 ÷ minutpris).
            </small>
            <div className="row-actions" style={{ alignItems: "center", gap: 12, marginTop: 12 }}>
              <button className="btn btn-primary" type="submit" disabled={pending}>
                {pending ? "Gemmer…" : "Gem"}
              </button>
              {state.saved ? <span style={{ color: "var(--success)", fontSize: 13 }}>✓ Gemt</span> : null}
              {state.error ? <span style={{ color: "#c0392b", fontSize: 13 }}>{state.error}</span> : null}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
