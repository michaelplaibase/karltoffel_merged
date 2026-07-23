"use client";

// Dinero kontoplan: the two chart-of-accounts numbers invoices/payments post to.
// Backed by saveDineroAccounts (admin-guarded server action).
import { useActionState } from "react";
import { saveDineroAccounts, type AccountsState } from "@/app/actions/dinero";

export default function DineroAccountsForm({
  salesAccountNumber,
  cashAccountNumber,
}: {
  salesAccountNumber: number;
  cashAccountNumber: number;
}) {
  const [state, formAction, pending] = useActionState<AccountsState, FormData>(
    (p, fd) => saveDineroAccounts(p, fd),
    {},
  );

  return (
    <form action={formAction}>
      <div className="f2">
        <label className="col-label">Salgskonto (afsendte fakturaer)</label>
        <div>
          <input name="salesAccountNumber" type="number" min="1" defaultValue={salesAccountNumber} className="form-control form-control-sm" />
          <small className="form-text field-help">Kontonr. i din Dinero kontoplan til bogføring af salg. Standard: 1000 (Salg af varer/ydelser m/moms).</small>
        </div>
      </div>
      <div className="f2">
        <label className="col-label">Indbetalingskonto (kontant betaling)</label>
        <div>
          <input name="cashAccountNumber" type="number" min="1" defaultValue={cashAccountNumber} className="form-control form-control-sm" />
          <small className="form-text field-help">Kontonr. til bogføring af kontante betalinger. Standard: 55040 (Kontanter/kasse). Bekræft, at nummeret findes i netop din organisations kontoplan.</small>
        </div>
      </div>
      {state.error ? <div className="help-note" style={{ color: "var(--danger, #C4183C)" }}>{state.error}</div> : null}
      {state.ok ? <div className="help-note" style={{ color: "var(--success, #2e7d32)" }}>Gemt.</div> : null}
      <hr className="section-hr" />
      <div className="row-actions">
        <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Gemmer…" : "Gem kontonumre"}</button>
      </div>
    </form>
  );
}
