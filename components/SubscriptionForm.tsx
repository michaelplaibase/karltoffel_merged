"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { SubscriptionState } from "@/app/actions/subscriptions";
import ContactPicker, { type ContactOption } from "@/components/ContactPicker";
import TaskLineEditor, { blankTaskRow, type TaskRow } from "@/components/TaskLineEditor";
import PauseSection from "@/components/PauseSection";

export type EmployeeOption = { id: number; name: string };

// BASE_INTERVALS lever i lib/subscription-intervals.ts — samme konstanter som
// tilbud-formularen (Thomas, 2026-09-11: intervallerne må ALDRIG afvige).
import { BASE_INTERVALS } from "@/lib/subscription-intervals";

export type SubscriptionInitial = {
  contactId: number; baseInterval: string; startWeek: string; fixedEmployee: string;
  // TaskRow inkluderer de valgfri pausefelter (pauseActive/pauseStart/pauseEnd/
  // pauseYearly i strengform) — redigeringssiden prefiller dem fra
  // getSubscriptionEditData; opret-siden lader dem stå tomme (pause slået fra).
  tasks: TaskRow[];
};

export default function SubscriptionForm({
  action, contacts, employees, employeeOptions, initial, title, submitLabel, danger, minuteRate,
}: {
  action: (state: SubscriptionState, formData: FormData) => Promise<SubscriptionState>;
  contacts: ContactOption[];
  employees: string[];
  /** Medarbejdere med id til per-opgave tildeling (Medarbejder-kolonnen i
   *  opgavetabellen). Udelades den, vises kolonnen ikke. */
  employeeOptions?: EmployeeOption[];
  initial?: SubscriptionInitial;
  title: string;
  submitLabel: string;
  danger?: React.ReactNode;
  /** Minutpris (kr/min ekskl. moms) — auto-beregner varighed ud fra prisen. */
  minuteRate: number;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  // Opgaverækkerne er løftet herop, så TaskLineEditor og PauseSection deler
  // samme state (pause redigeres i sit eget kort, men submittes via editorens
  // skjulte felter — én række, ét sæt felter, indeks-flugt bevaret).
  const [rows, setRows] = useState<TaskRow[]>(initial?.tasks?.length ? initial.tasks : [blankTaskRow()]);
  // React 19 resetter ukontrollerede felter til deres defaultValue når en
  // form-action afvikles — ved valideringsfejl ekkoer serveren derfor de
  // indsendte værdier tilbage i state.values, som prefiller felterne igen.
  const v = state.values;
  const baseInterval = v?.baseInterval ?? initial?.baseInterval ?? "Hver 2. uge";
  const baseOptions = !BASE_INTERVALS.includes(baseInterval) ? [baseInterval, ...BASE_INTERVALS] : BASE_INTERVALS;
  // En gemt fast medarbejder, der er deaktiveret (mangler i den aktive liste),
  // skal stadig kunne SES og bevares — ellers falder browseren stille tilbage
  // til første option ("Ingen"), og tilknytningen mistes ved næste gem.
  const savedEmployee = initial?.fixedEmployee;
  const inactiveEmployee = savedEmployee && savedEmployee !== "Ingen" && !employees.includes(savedEmployee) ? savedEmployee : null;

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
              <select name="baseInterval" defaultValue={baseInterval} className="form-control form-control-sm">
                {baseOptions.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <div>
              <label className="field-label">Startuge</label>
              <input name="startWeek" defaultValue={v?.startWeek ?? initial?.startWeek ?? ""} placeholder="Uge 29" className="form-control form-control-sm" />
            </div>
          </div>
          <TaskLineEditor mode="subscription" rows={rows} setRows={setRows} minuteRate={minuteRate} employees={employeeOptions} />
        </div>
      </div>

      <div className="card">
        <div className="card-header"><h4 className="section-title">Særlige betingelser for planlægning</h4></div>
        <div className="card-body tight">
          <label className="field-label">Medarbejder</label>
          <select name="fixedEmployee" defaultValue={v?.fixedEmployee ?? initial?.fixedEmployee ?? "Ingen"} className="form-control form-control-sm">
            {inactiveEmployee && <option value={inactiveEmployee}>Nuværende: {inactiveEmployee} (deaktiveret)</option>}
            {employees.map((e) => <option key={e} value={e}>{e === "Ingen" ? "Vælges automatisk" : e}</option>)}
          </select>
        </div>
      </div>

      <PauseSection rows={rows} setRows={setRows} />

      {state.error && <div style={{ color: "#c0392b", fontSize: 13, marginBottom: 10 }}>{state.error}</div>}

      <div className="savebar">
        <Link href="/subscriptions" className="btn btn-light">Luk</Link>
        {danger}
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Gemmer…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
