"use client";

import { useActionState } from "react";
import Link from "next/link";
import type { QuoteState } from "@/app/actions/quotes";

const kr = (n: number) => n.toLocaleString("da-DK") + " kr";

export default function QuoteComposer({
  to, subject, body, tasks, total, backHref, action,
}: {
  to: string;
  subject: string;
  body: string;
  tasks: { description: string; price: number }[];
  total: number;
  backHref: string;
  action: (state: QuoteState, formData: FormData) => Promise<QuoteState>;
}) {
  const [state, formAction, pending] = useActionState(action, {});

  return (
    <div className="container-1140" style={{ maxWidth: 900 }}>
      <div className="toolbar" style={{ justifyContent: "space-between" }}>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>Send tilbud</h1>
          <p className="page-desc" style={{ marginBottom: 0 }}>Teksten er udfyldt automatisk ud fra skabelonen. Du kan rette den til, før du sender.</p>
        </div>
        <Link href={backHref} className="btn btn-light">Gå tilbage</Link>
      </div>

      <div className="card">
        <div className="card-body">
          <form action={formAction}>
            <div className="f2">
              <label className="col-label">Modtager (e-mail)</label>
              <div>
                <input name="to" type="email" className="form-control" defaultValue={to} placeholder="kunde@eksempel.dk" autoComplete="off" />
                {!to ? <small className="form-text" style={{ color: "#8a5a10" }}>Kunden har ingen e-mailadresse — indtast en modtager.</small> : null}
              </div>
            </div>

            <div className="f2">
              <label className="col-label">Emne</label>
              <div><input name="subject" className="form-control" defaultValue={subject} /></div>
            </div>

            <div className="f2">
              <label className="col-label">Besked</label>
              <div>
                <textarea name="body" className="form-control" rows={16} defaultValue={body} />
                <small className="form-text">Du kan tilrette teksten før du sender.</small>
              </div>
            </div>

            {tasks.length ? (
              <div className="f2">
                <label className="col-label">Opgaver på tilbuddet</label>
                <div className="tasklines">
                  {tasks.map((t, i) => (
                    <div className="tl-row" key={i} style={{ gridTemplateColumns: "1fr auto" }}>
                      <span>{t.description}</span>
                      <span className="num">{kr(t.price)}</span>
                    </div>
                  ))}
                  <div className="tl-sum"><span>Samlet pris (inkl. moms)</span><b>{kr(total)}</b></div>
                </div>
              </div>
            ) : null}

            <hr className="section-hr" />
            <div className="row-actions" style={{ alignItems: "center", gap: 12 }}>
              <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Sender…" : "Send tilbud"}</button>
              <Link href={backHref} className="btn btn-light">Annullér</Link>
              {state.ok ? <span style={{ color: "var(--success)", fontSize: 13 }}>✓ {state.message}</span> : null}
              {state.error ? <span style={{ color: "#C4183C", fontSize: 13 }}>{state.error}</span> : null}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
