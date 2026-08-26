"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { OrderCreateState } from "@/app/actions/orders";
import ContactPicker, { type ContactOption } from "@/components/ContactPicker";
import TaskLineEditor from "@/components/TaskLineEditor";

export type WeekOption = { value: string; label: string };

export default function OrderCreateForm({
  action, contacts, weekOptions, initialContactId, minuteRate, employees,
}: {
  action: (state: OrderCreateState, formData: FormData) => Promise<OrderCreateState>;
  contacts: ContactOption[];
  weekOptions: WeekOption[];
  initialContactId?: number;
  /** Minutpris (kr/min ekskl. moms) — auto-beregner varighed ud fra prisen. */
  minuteRate: number;
  /** Medarbejdere ordren kan tildeles (aktive, laveste bruger-id først). Tomt
   *  valg = ordren tildeles FØRSTE aktive medarbejder (createOrder-fallback,
   *  app/actions/orders.ts) — planneren omfordeler ALDRIG mellem medarbejdere,
   *  så dropdown-teksten skal love præcis det og ikke "nærmeste ledige". */
  employees: { id: number; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(action, {});
  // React 19 nulstiller ukontrollerede felter når server-action'en returnerer
  // (også ved valideringsfejl). Uge/medarbejder-selects prefiller derfor fra
  // state.values, så valgene ikke stille ruller tilbage til defaults.
  const v = state.values;

  return (
    <form action={formAction}>
      <div className="card">
        <div className="card-header"><h4 className="section-title">Kunde</h4></div>
        <div className="card-body tight">
          <label className="field-label">Fakturerings- og leveringsadresse</label>
          <ContactPicker contacts={contacts} initialId={initialContactId} />
        </div>
      </div>

      <div className="card">
        <div className="card-header"><h4 className="section-title">Opgaver på ordren</h4></div>
        <div className="card-body tight">
          <TaskLineEditor minuteRate={minuteRate} />
        </div>
      </div>

      <div className="card">
        <div className="card-header"><h4 className="section-title">Planlægning i kalender</h4></div>
        <div className="card-body tight">
          <label className="field-label">Uge</label>
          <select name="week" defaultValue={v?.week ?? weekOptions[0]?.value} className="form-control form-control-sm">
            {weekOptions.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
          </select>
          <small className="form-text field-help">Ordren planlægges automatisk i den valgte uge.</small>

          <label className="field-label" style={{ marginTop: 12 }}>Medarbejder</label>
          <select name="employeeId" defaultValue={v?.employeeId ?? ""} className="form-control form-control-sm">
            {/* Ærlig tekst: tomt valg tildeler altid FØRSTE aktive medarbejder —
                der findes ingen "nærmeste ledige"-fordeling i planneren. */}
            <option value="">{employees.length ? `Tildeles ${employees[0].name} (automatisk)` : "Vælges automatisk"}</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <small className="form-text field-help">Kun den valgte medarbejder ser ordren i sit dagsprogram.</small>
        </div>
      </div>

      {state.error && <div style={{ color: "#c0392b", fontSize: 13, marginBottom: 10 }}>{state.error}</div>}

      <div className="savebar">
        <Link href="/orders" className="btn btn-light">Luk</Link>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Opretter…" : "Opret ordre"}
        </button>
      </div>
    </form>
  );
}
