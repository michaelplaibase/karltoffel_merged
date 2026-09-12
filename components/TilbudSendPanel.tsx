"use client";

// Send-panel for Tilbud — samme mønster som QuoteComposer: emne/besked er
// forudfyldt fra skabelonen og kan rettes inden afsendelse (kontrollerede felter,
// så indtastningen overlever en fejl-retur under React 19 form-reset).
import { useActionState, useState } from "react";
import type { TilbudState } from "@/app/actions/tilbud";

export default function TilbudSendPanel({ tilbudId, to, besked, action }: {
  tilbudId: number;
  to: string;
  besked: string;
  action: (state: TilbudState, formData: FormData) => Promise<TilbudState>;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [toValue, setToValue] = useState(to);
  const [beskedValue, setBeskedValue] = useState(besked);

  return (
    <form action={formAction}>
      <input type="hidden" name="tilbudId" value={tilbudId} />
      <div className="f2">
        <label className="col-label">Modtager (e-mail)</label>
        <div>
          <input name="to" type="email" required className="form-control" value={toValue} onChange={(e) => setToValue(e.target.value)} placeholder="kunde@eksempel.dk" autoComplete="off" />
          {!to ? <small className="form-text" style={{ color: "#8a5a10" }}>Kunden har ingen e-mailadresse — indtast en modtager.</small> : null}
        </div>
      </div>
      <div className="f2">
        <label className="col-label">Besked</label>
        <div>
          <textarea name="besked" className="form-control" rows={10} value={beskedValue} onChange={(e) => setBeskedValue(e.target.value)} />
          <small className="form-text">PDF'en med opgaver, priser og billeder vedhæftes automatisk. Afsendes fra hej@karltoffel.dk.</small>
        </div>
      </div>
      {state.error ? <p style={{ color: "#8a5a10" }}>{state.error}</p> : null}
      {state.message ? <p style={{ color: "#3cb44b" }}>{state.message}</p> : null}
      <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Sender…" : "Send tilbud til kunden"}</button>
    </form>
  );
}