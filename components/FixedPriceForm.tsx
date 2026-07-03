"use client";

import Link from "next/link";
import { useActionState } from "react";
import type { FixedPriceState } from "@/app/actions/fixed-prices";
import ContactPicker, { type ContactOption } from "@/components/ContactPicker";
import TaskLineEditor, { type TaskRow } from "@/components/TaskLineEditor";

export type FixedPriceInitial = { contactId: number; tasks: TaskRow[] };

export default function FixedPriceForm({
  action, contacts, initial, title, submitLabel, danger,
}: {
  action: (state: FixedPriceState, formData: FormData) => Promise<FixedPriceState>;
  contacts: ContactOption[];
  initial?: FixedPriceInitial;
  title: string;
  submitLabel: string;
  danger?: React.ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <form action={formAction}>
      <div className="toolbar" style={{ justifyContent: "space-between" }}>
        <h1 className="page-title">{title}</h1>
        <Link href="/fixed-prices" className="btn btn-light">Gå tilbage</Link>
      </div>

      <div className="card">
        <div className="card-header"><h4 className="section-title">Leveringsadresse</h4></div>
        <div className="card-body tight">
          <label className="field-label">Leveringsadresse</label>
          <ContactPicker contacts={contacts} initialId={initial?.contactId} />
          <p className="muted" style={{ margin: "10px 0 0" }}>
            En fastprisaftale indeholder en eller flere opgaver, der er knyttet til en leveringsadresse.
            Den anvendes for kunder, der ikke har et abonnement, f.eks., hvis man opretter en manuel ordre
            i kalenderen, eller hvis kunden afgiver en online bestilling.
          </p>
        </div>
      </div>

      <div className="card">
        <div className="card-header"><h4 className="section-title">Pris og varighed</h4></div>
        <div className="card-body tight">
          <TaskLineEditor mode="order" initial={initial?.tasks} />
        </div>
      </div>

      {state.error && <div style={{ color: "#c0392b", fontSize: 13, marginBottom: 10 }}>{state.error}</div>}

      <div className="savebar">
        <Link href="/fixed-prices" className="btn btn-light">Luk</Link>
        {danger}
        <button type="submit" className="btn btn-primary" disabled={pending}>
          {pending ? "Gemmer…" : submitLabel}
        </button>
      </div>
    </form>
  );
}
