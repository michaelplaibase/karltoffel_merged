"use client";
// Fraværsside (klient-delen): medarbejderen melder sygdom/ferie, admin ser
// godkendelses-kø og registrerer på vegne af andre.
import { useState, useTransition } from "react";
import { registerAbsenceAction, approveAbsenceAction, rejectAbsenceAction } from "@/app/actions/absence";

type Msg = { ok: boolean; text: string } | null;

const DA_DAG = new Intl.DateTimeFormat("da-DK", { weekday: "long", day: "numeric", month: "long" });

export function RegisterForm({ isAdmin }: { isAdmin: boolean }) {
  const [type, setType] = useState<"sygdom" | "ferie">("sygdom");
  const [date, setDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<Msg>(null);
  const [pending, start] = useTransition();

  const submit = () => {
    if (!date) { setMsg({ ok: false, text: "Vælg først en dato." }); return; }
    start(async () => {
      const r = await registerAbsenceAction(type, date, note, toDate || undefined);
      setMsg({ ok: r.ok, text: r.message });
      if (r.ok) { setNote(""); }
    });
  };

  return (
    <div className="card">
      <div className="card-body">
        <h4 className="section-title">{type === "sygdom" ? "Meld dig syg" : "Ansøg om ferie"}</h4>
        <div className="toolbar" style={{ gap: 10, alignItems: "flex-end", flexWrap: "wrap" }}>
          <label>
            Type<br />
            <select className="form-control form-control-sm" value={type} onChange={(e) => { setType(e.target.value as "sygdom" | "ferie"); setToDate(""); }}>
              <option value="sygdom">Sygdom (gælder straks)</option>
              <option value="ferie">Ferie (ansøgning — skal godkendes)</option>
            </select>
          </label>
          <label>
            {type === "ferie" ? "Fra dato" : "Dato"}<br />
            <input type="date" className="form-control form-control-sm" value={date} onChange={(e) => { setDate(e.target.value); if (toDate && e.target.value && toDate < e.target.value) setToDate(e.target.value); }} />
          </label>
          {type === "ferie" && (
            <label>
              Til dato (valgfri)<br />
              <input type="date" className="form-control form-control-sm" value={toDate} min={date || undefined} onChange={(e) => setToDate(e.target.value)} />
            </label>
          )}
          <label style={{ flex: 1, minWidth: 200 }}>
            Besked (valgfri)<br />
            <input className="form-control form-control-sm" value={note} onChange={(e) => setNote(e.target.value)} placeholder={type === "sygdom" ? "Fx løber jeg snart rundt igen" : "Fx sommerferie"} />
          </label>
          <button type="button" className="btn btn-primary btn-sm" disabled={pending} onClick={submit}>
            {pending ? "Sender…" : type === "sygdom" ? "Meld sygdom" : "Send ferieansøgning"}
          </button>
        </div>
        {msg && (
          <p style={{ marginTop: 10, color: msg.ok ? "var(--success, #4a7c2f)" : "var(--danger, #b3261e)" }}>{msg.text}</p>
        )}
        {type === "ferie" && !isAdmin && (
          <p className="muted" style={{ marginTop: 8, fontSize: 13 }}>
            Ferie er en ansøgning — den planlægger kalenderen først, når kontoret har godkendt den.
            Udfyld "Til dato", hvis du ønsker flere dage i træk (fx en hel ferieuge).
          </p>
        )}
      </div>
    </div>
  );
}