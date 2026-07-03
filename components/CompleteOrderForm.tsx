"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { CompleteOrderState } from "@/app/actions/orders";

const DELIVERY: [string, string][] = [
  ["udfoert", "Udført"],
  ["skip", "Ikke udført, spring over"],
  ["replan", "Ikke udført, skal genplanlægges"],
  ["other", "Anden status"],
];

const PAYMENT = [
  "Send faktura - ubetalt",
  "Send faktura - betalt kontant",
  "Send ikke faktura fra Fenster",
  "Opret fakturakladde",
  "Registrer på et senere tidspunkt",
];

const radioRow: React.CSSProperties = { display: "flex", alignItems: "center", gap: 9, fontWeight: 300, padding: "3px 0" };

export default function CompleteOrderForm({
  action, initialComment, initialAddressNote, backUrl,
}: {
  action: (state: CompleteOrderState, formData: FormData) => Promise<CompleteOrderState>;
  initialComment: string;
  initialAddressNote: string;
  backUrl: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction}>
      <input type="hidden" name="backUrl" value={backUrl} />

      <div className="card">
        <div className="card-header"><h4 className="section-title">Leveringsstatus</h4></div>
        <div className="card-body tight">
          {DELIVERY.map(([value, label]) => (
            <label key={value} style={radioRow}>
              <input type="radio" name="leveringsstatus" value={value} /> {label}
            </label>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-header"><h4 className="section-title">Betaling og fakturering</h4></div>
        <div className="card-body tight">
          <p className="muted" style={{ margin: "0 0 8px" }}>Vælg om der skal faktureres via Dinero</p>
          {PAYMENT.map((label, i) => (
            <label key={i} style={radioRow}>
              <input type="radio" name="betaling" value={label} /> {label}
            </label>
          ))}
        </div>
      </div>

      <div className="card">
        <div className="card-header"><h4 className="section-title">Ordrekommentar</h4></div>
        <div className="card-body tight">
          <textarea name="comment" defaultValue={initialComment} className="form-control form-control-sm" rows={3} />
          <small className="form-text field-help">Tilføj valgfri, intern kommentar vedr. denne ordre, f.eks. en kommentar om leveringen.</small>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><h4 className="section-title">Adressebemærkning</h4></div>
        <div className="card-body tight">
          <textarea name="addressNote" defaultValue={initialAddressNote} className="form-control form-control-sm" rows={3} />
          <small className="form-text field-help">Opdater valgfrit, internt notat, der relaterer sig til leveringsadressen og som er godt at huske til næste besøg hos kunden.</small>
        </div>
      </div>

      {state.error && <div style={{ color: "#c0392b", fontSize: 13, marginBottom: 10 }}>{state.error}</div>}

      <div className="savebar">
        <Link href={backUrl} className="btn btn-light">Tilbage</Link>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Afslutter…" : "Afslut ordre"}
        </button>
      </div>
    </form>
  );
}
