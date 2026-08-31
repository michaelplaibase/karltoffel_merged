"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { FixedPriceScheduleState } from "@/app/actions/fixed-prices";

// Planlæg en fastprisaftale som ENKELTOPGAVE i kalenderen (uden interval) —
// samme planlægningskort som OrderCreateForm (dato + medarbejder), men uden
// kunde-/opgavevælgere: aftalen bestemmer allerede kunde og opgavelinjer.
export default function FixedPriceScheduleForm({
  action,
  employees,
  todayISO,
  agreementLabel,
}: {
  action: (state: FixedPriceScheduleState, formData: FormData) => Promise<FixedPriceScheduleState>;
  employees: { id: number; name: string }[];
  todayISO: string;
  agreementLabel: string;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const v = state.values;

  return (
    <form action={formAction}>
      <div className="card">
        <div className="card-header"><h4 className="section-title">Aftale</h4></div>
        <div className="card-body tight">
          <p style={{ margin: 0 }}>{agreementLabel}</p>
          <small className="form-text field-help">
            Aftalens opgavelinjer kopieres til ordren. Ingen gentagelse — opgaven planlægges én gang.
          </small>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><h4 className="section-title">Planlægning i kalender</h4></div>
        <div className="card-body tight">
          <label className="field-label">Dato</label>
          <input
            type="date"
            name="date"
            defaultValue={v?.date ?? todayISO}
            className="form-control form-control-sm"
            required
          />
          <small className="form-text field-help">Dagen opgaven skal udføres (dansk kalenderdato).</small>

          <label className="field-label" style={{ marginTop: 12 }}>Medarbejder</label>
          <select name="employeeId" defaultValue={v?.employeeId ?? ""} className="form-control form-control-sm">
            {/* Ærlig tekst, som i OrderCreateForm: tomt valg tildeler altid
                FØRSTE aktive medarbejder — der findes ingen "nærmeste ledige". */}
            <option value="">{employees.length ? `Tildeles ${employees[0].name} (automatisk)` : "Vælges automatisk"}</option>
            {employees.map((e) => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
          <small className="form-text field-help">Kun den valgte medarbejder ser ordren i sit dagsprogram.</small>
        </div>
      </div>

      {state.error && <div style={{ color: "#c0392b", fontSize: 13, marginBottom: 10 }}>{state.error}</div>}

      <div className="savebar">
        <Link href="/fixed-prices" className="btn btn-light">Luk</Link>
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Planlægger…" : "Planlæg i kalender"}
        </button>
      </div>
    </form>
  );
}
