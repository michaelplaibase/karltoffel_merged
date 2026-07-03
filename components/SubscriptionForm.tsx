"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { SubscriptionState } from "@/app/actions/subscriptions";
import ContactPicker, { type ContactOption } from "@/components/ContactPicker";
import TaskLineEditor, { type TaskRow } from "@/components/TaskLineEditor";

const BASE_INTERVALS = [
  "Hver uge", "Hver 2. uge", "Hver 3. uge", "Hver 4. uge", "Hver 5. uge", "Hver 6. uge",
  "Hver 8. uge", "Hver 10. uge", "Hver 12. uge", "Hver 13. uge", "Hver 16. uge",
  "Hver 24. uge", "Hver 26. uge", "Hver 36. uge", "Hver 48. uge", "Hver 52. uge",
];

export type SubscriptionInitial = {
  contactId: number; baseInterval: string; startWeek: string; fixedEmployee: string; tasks: TaskRow[];
};

export default function SubscriptionForm({
  action, contacts, employees, initial, title, submitLabel,
}: {
  action: (state: SubscriptionState, formData: FormData) => Promise<SubscriptionState>;
  contacts: ContactOption[];
  employees: string[];
  initial?: SubscriptionInitial;
  title: string;
  submitLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const baseOptions = initial?.baseInterval && !BASE_INTERVALS.includes(initial.baseInterval)
    ? [initial.baseInterval, ...BASE_INTERVALS] : BASE_INTERVALS;

  return (
    <form action={formAction}>
      <div className="toolbar" style={{ justifyContent: "space-between" }}>
        <h1 className="page-title">{title}</h1>
        <Link href="/subscriptions" className="btn btn-light">Gå tilbage</Link>
      </div>

      <div className="card">
        <div className="card-header"><h4 className="section-title">Kunde</h4></div>
        <div className="card-body tight">
          <label className="field-label">Fakturerings- og leveringsadresse</label>
          <ContactPicker contacts={contacts} initialId={initial?.contactId} />
        </div>
      </div>

      <div className="card">
        <div className="card-header"><h4 className="section-title">Opgaver på abonnementet</h4></div>
        <div className="card-body tight">
          <div className="grid-2" style={{ marginBottom: 12 }}>
            <div>
              <label className="field-label">Basis-interval</label>
              <select name="baseInterval" defaultValue={initial?.baseInterval ?? "Hver 2. uge"} className="form-control form-control-sm">
                {baseOptions.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Startuge</label>
              <input name="startWeek" defaultValue={initial?.startWeek ?? ""} placeholder="Uge 29" className="form-control form-control-sm" />
            </div>
          </div>
          <TaskLineEditor mode="subscription" initial={initial?.tasks} />
        </div>
      </div>

      <div className="card">
        <div className="card-header"><h4 className="section-title">Særlige betingelser for planlægning</h4></div>
        <div className="card-body tight">
          <label className="field-label">Medarbejder</label>
          <select name="fixedEmployee" defaultValue={initial?.fixedEmployee ?? "Ingen"} className="form-control form-control-sm">
            {employees.map((e) => <option key={e} value={e}>{e === "Ingen" ? "Vælges automatisk" : e}</option>)}
          </select>
        </div>
      </div>

      {state.error && <div style={{ color: "#c0392b", fontSize: 13, marginBottom: 10 }}>{state.error}</div>}

      <div className="savebar">
        <Link href="/subscriptions" className="btn btn-light">Luk</Link>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Gemmer…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
