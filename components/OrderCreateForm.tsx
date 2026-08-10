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
  /** Medarbejdere ordren kan tildeles. Tomt/udeladt felt = "Vælges automatisk"
   *  (nat-planneren tildeler nærmeste medarbejder). */
  employees: { id: number; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(action, {});

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
          <select name="week" defaultValue={weekOptions[0]?.value} className="form-control form-control-sm">
            {weekOptions.map((w) => <option key={w.value} value={w.value}>{w.label}</option>)}
          </select>
          <small className="form-text field-help">Ordren planlægges automatisk i den valgte uge.</small>

          <label className="field-label" style={{ marginTop: 12 }}>Medarbejder</label>
          <select name="employeeId" defaultValue="" className="form-control form-control-sm">
            <option value="">Vælges automatisk (nærmeste ledige)</option>
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
