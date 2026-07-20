"use client";

// "Send gruppebesked" form. Kundegruppe/Dato/Uge/Medarbejder + message fields are
// real named inputs. "Vis liste over modtagere" resolves and lists the actual
// recipients from the DB; "Send besked til kundegruppen" confirms then sends
// (delivery stubbed). Test-send reuses the template test action.
import { useRef, useState, useTransition } from "react";
import { GROUP_MESSAGES as G } from "@/lib/funktioner";
import type { WeekOption } from "@/lib/weeks";
import { resolveRecipients, sendGroupMessage, type Recipient } from "@/app/actions/funktioner";
import { sendTestMessage } from "@/app/actions/templates";

export default function GroupMessageForm({ weekOpts, employees }: { weekOpts: WeekOption[]; employees: string[] }) {
  const formRef = useRef<HTMLFormElement>(null);
  const [group, setGroup] = useState(G.fields[0].opts?.[0] ?? "");
  const [date, setDate] = useState("");
  const [week, setWeek] = useState(weekOpts[0]?.value ?? "");
  const [pending, start] = useTransition();
  const [recipients, setRecipients] = useState<Recipient[] | null>(null);
  const [confirm, setConfirm] = useState(false);
  const [result, setResult] = useState<{ ok?: boolean; error?: string; message?: string } | null>(null);
  const [testMsg, setTestMsg] = useState<{ ok: boolean; message: string } | null>(null);
  const [testEmail, setTestEmail] = useState("");
  const [testSms, setTestSms] = useState("");

  const showRecipients = () => start(async () => setRecipients(await resolveRecipients(group, date, week)));
  const doSend = () => start(async () => {
    const fd = new FormData(formRef.current!);
    const r = await sendGroupMessage({}, fd);
    setResult(r); setConfirm(false);
  });

  return (
    <div className="card">
      <div className="card-body">
        <h4 className="section-title">{G.createTitle}</h4>
        <p className="muted" style={{ marginBottom: 20 }}>{G.createIntro}</p>

        <form ref={formRef}>
          <div className="f2"><label className="col-label">Kundegruppe</label><div>
            <select name="group" className="form-control form-control-sm" value={group} onChange={(e) => setGroup(e.target.value)}>
              {(G.fields[0].opts ?? []).map((o) => <option key={o}>{o}</option>)}
            </select><small className="form-text">Vælg hvilken gruppe af kunder, der skal modtage beskeden</small></div></div>

          <div className="f2"><label className="col-label">Dato</label><div>
            <input name="date" type="date" className="form-control form-control-sm" value={date} onChange={(e) => setDate(e.target.value)} />
            <small className="form-text">Anvendes for dato-baserede kundegrupper</small></div></div>

          <div className="f2"><label className="col-label">Uge</label><div>
            <select name="week" className="form-control form-control-sm" value={week} onChange={(e) => setWeek(e.target.value)}>
              {weekOpts.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select><small className="form-text">Anvendes for uge-baserede kundegrupper</small></div></div>

          <div className="f2"><label className="col-label">Medarbejder</label><div>
            <select name="employee" className="form-control form-control-sm" defaultValue="Alle medarbejdere">
              {["Alle medarbejdere", ...employees].map((o) => <option key={o}>{o}</option>)}
            </select></div></div>

          <div className="f2"><label className="col-label">Send besked som</label><div>
            <select name="channel" className="form-control form-control-sm">
              {["Både SMS og e-mail", "Kun som SMS", "Kun som e-mail", "Som e-mail, hvis kunden har en email-adr., ellers som SMS"].map((o) => <option key={o}>{o}</option>)}
            </select></div></div>

          <div className="f2"><label className="col-label">E-mail emne</label><div>
            <input name="subject" className="form-control form-control-sm" /><small className="form-text">(anvendes ikke til SMS)</small></div></div>

          <div className="f2"><label className="col-label">Besked</label><div>
            <textarea name="body" className="form-control" rows={6} /><small className="form-text">Beskeden, som skal sendes</small></div></div>

          <div className="f2"><label className="col-label">Afsender på SMS</label><div>
            <input name="sender" className="form-control form-control-sm" defaultValue="Service SMS" /><small className="form-text">Maks 11 karakterer.</small></div></div>

          <div className="f2"><label className="col-label">Send en test</label><div style={{ display: "grid", gap: 8 }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
              <input className="form-control" placeholder="Test e-mail" value={testEmail} onChange={(e) => setTestEmail(e.target.value)} />
              <button type="button" className="btn btn-outline-primary" disabled={pending} onClick={() => start(async () => setTestMsg(await sendTestMessage("email", testEmail)))}>Send test e-mail</button>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8 }}>
              <input className="form-control" placeholder="Test SMS" value={testSms} onChange={(e) => setTestSms(e.target.value)} />
              <button type="button" className="btn btn-light" disabled={pending} onClick={() => start(async () => setTestMsg(await sendTestMessage("sms", testSms)))}>Send test SMS</button>
            </div>
            {testMsg ? <small className="form-text" style={{ color: testMsg.ok ? "var(--success)" : "var(--danger, #C4183C)" }}>{testMsg.message}</small> : null}
          </div></div>

          <hr className="section-hr" />
          <div className="row-actions" style={{ alignItems: "center", gap: 12 }}>
            <button type="button" className="btn btn-primary" disabled={pending} onClick={() => setConfirm(true)}>{G.sendLabel}</button>
            <button type="button" className="btn btn-outline-secondary" disabled={pending} onClick={showRecipients}>Vis liste over modtagere</button>
            {result?.ok ? <span style={{ color: "var(--success)", fontSize: 13 }}>{result.message}</span> : null}
            {result?.error ? <span style={{ color: "var(--danger, #C4183C)", fontSize: 13 }}>{result.error}</span> : null}
          </div>
        </form>
      </div>

      {recipients && (
        <Modal title={`Oversigt over modtagere (${recipients.length})`} onClose={() => setRecipients(null)}>
          {recipients.length === 0 ? <p className="muted">Ingen modtagere matcher den valgte kundegruppe.</p> : (
            <div className="table-wrap" style={{ maxHeight: "50vh", overflow: "auto" }}>
              <table className="data-table rowstack"><thead><tr><th>Navn</th><th>E-mail</th><th>Telefon</th></tr></thead>
                <tbody>{recipients.map((r, i) => <tr key={i}><td data-label="Navn">{r.name}</td><td data-label="E-mail">{r.email || "—"}</td><td data-label="Telefon">{r.phone || "—"}</td></tr>)}</tbody>
              </table>
            </div>
          )}
        </Modal>
      )}

      {confirm && (
        <Modal title="Bekræftelse" onClose={() => setConfirm(false)}>
          <p style={{ margin: 0 }}>Er du sikker på, at du vil sende beskeden til kundegruppen?</p>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 18 }}>
            <button type="button" className="btn btn-light" disabled={pending} onClick={() => setConfirm(false)}>Luk</button>
            <button type="button" className="btn btn-primary" disabled={pending} onClick={doSend}>{pending ? "Sender…" : G.sendLabel}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, children, onClose }: { title: string; children: React.ReactNode; onClose: () => void }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 3000, padding: 20 }} onClick={onClose}>
      <div className="card" style={{ maxWidth: 620, width: "100%", maxHeight: "82vh", overflow: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div className="card-header"><h4 className="section-title" style={{ margin: 0 }}>{title}</h4></div>
        <div className="card-body">{children}</div>
      </div>
    </div>
  );
}
