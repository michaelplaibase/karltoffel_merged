"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { TilbudState } from "@/app/actions/tilbud";
import { BASE_INTERVALS, aarsbelob } from "@/lib/subscription-intervals";

type Kontakt = { id: number; name: string; companyName: string | null };

const kr = (n: number) => n.toLocaleString("da-DK") + " kr";

export default function TilbudForm({ contacts, action }: {
  contacts: Kontakt[];
  action: (state: TilbudState, formData: FormData) => Promise<TilbudState>;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [nyKunde, setNyKunde] = useState(false);
  const [linjer, setLinjer] = useState<{ description: string; price: number }[]>([{ description: "", price: 0 }]);
  const [interval, setInterval] = useState("");
  const total = linjer.reduce((a, l) => a + (Number(l.price) || 0), 0);
  const aarligt = aarsbelob(interval, total); // null når interval er tom

  const opdaterLinje = (i: number, felt: "description" | "price", vaerdi: string) => {
    setLinjer((prev) => prev.map((l, j) => (j === i ? { ...l, [felt]: felt === "price" ? Number(vaerdi) || 0 : vaerdi } : l)));
  };

  return (
    <div className="container-1140" style={{ maxWidth: 900 }}>
      <div className="toolbar" style={{ justifyContent: "space-between" }}>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>Nyt tilbud</h1>
          <p className="page-desc" style={{ marginBottom: 0 }}>Vælg kunden, tilføj opgaver med priser — fotos tilføjes på tilbuddet bagefter.</p>
        </div>
        <Link href="/tilbud" className="btn btn-light">Gå tilbage</Link>
      </div>

      <div className="card">
        <div className="card-body">
          <form action={formAction}>
            <div className="f2">
              <label className="col-label">Kunde</label>
              <div>
                {nyKunde ? (
                  <label style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input type="checkbox" checked={nyKunde} onChange={(e) => setNyKunde(e.target.checked)} />
                    <span>Opret ny kunde i samme flow</span>
                  </label>
                ) : (
                  <>
                    <select name="contactId" className="form-control" required defaultValue="">
                      <option value="" disabled>Vælg en kunde…</option>
                      {contacts.map((c) => (
                        <option key={c.id} value={c.id}>{c.companyName || c.name}</option>
                      ))}
                    </select>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 6 }}>
                      <input type="checkbox" checked={nyKunde} onChange={(e) => setNyKunde(e.target.checked)} />
                      <span>Opret ny kunde i samme flow</span>
                    </label>
                  </>
                )}
              </div>
            </div>

            {nyKunde ? (
              <>
                <input type="hidden" name="newCustomer" value="1" />
                <div className="f2">
                  <label className="col-label">Kundetype</label>
                  <div>
                    <select name="newIsCompany" className="form-control" defaultValue="0">
                      <option value="0">Privat</option>
                      <option value="1">Virksomhed</option>
                    </select>
                  </div>
                </div>
                <div className="f2">
                  <label className="col-label">Navn</label>
                  <div><input name="newName" required className="form-control" placeholder="Navn eller firmanavn" /></div>
                </div>
                <div className="f2">
                  <label className="col-label">Adresse</label>
                  <div><input name="newAddress" required className="form-control" placeholder="Ørnedvej 4, 8660 Skanderborg" /></div>
                </div>
                <div className="f2">
                  <label className="col-label">E-mail</label>
                  <div><input name="newEmail" type="email" className="form-control" placeholder="kunde@eksempel.dk" /></div>
                </div>
                <div className="f2">
                  <label className="col-label">Telefon</label>
                  <div><input name="newPhone" className="form-control" /></div>
                </div>
              </>
            ) : null}

            <div className="f2">
              <label className="col-label">Titel</label>
              <div><input name="title" className="form-control" placeholder="Tilbud på fast ejendomsservice" defaultValue="Tilbud" /></div>
            </div>
            <div className="f2">
              <label className="col-label">Intro-tekst (valgfri)</label>
              <div>
                <textarea name="note" className="form-control" rows={3} placeholder="Kommer med på tilbuddet og i mailen til kunden." />
              </div>
            </div>

            <div className="f2">
              <label className="col-label">Startuge (valgfri)</label>
              <div>
                <input name="startWeek" className="form-control" placeholder="Fx Uge 29 eller Uge 29, 2026" />
                <small className="form-text">Kommer med på tilbuddet og forudfylder abonnementet, hvis kunden siger ja.</small>
              </div>
            </div>
            <div className="f2">
              <label className="col-label">Interval (valgfri)</label>
              <div>
                {/* SAMME muligheder som abonnements-oprettelsen — konstanterne
                    deles (lib/subscription-intervals), så de aldrig afviger. */}
                <select
                  name="baseInterval"
                  className="form-control"
                  value={interval}
                  onChange={(e) => setInterval(e.target.value)}
                >
                  <option value="">Ikke sat (vælges ved konvertering)</option>
                  {BASE_INTERVALS.map((iv) => (
                    <option key={iv} value={iv}>{iv}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="f2">
              <label className="col-label">Opgaver og priser</label>
              <div className="tasklines">
                {linjer.map((l, i) => (
                  <div className="tl-row" key={i} style={{ gridTemplateColumns: "1fr 140px auto" }}>
                    <input
                      name="taskDescription"
                      className="form-control"
                      placeholder={i === 0 ? "Fx Tagrenderens + nedløbskontrol" : ""}
                      value={l.description}
                      onChange={(e) => opdaterLinje(i, "description", e.target.value)}
                    />
                    <input
                      name="taskPrice"
                      type="number"
                      min={0}
                      className="form-control num"
                      value={l.price || ""}
                      onChange={(e) => opdaterLinje(i, "price", e.target.value)}
                      placeholder="Pris"
                    />
                    <button
                      type="button"
                      className="btn btn-light"
                      onClick={() => setLinjer((prev) => (prev.length > 1 ? prev.filter((_, j) => j !== i) : prev))}
                      aria-label="Fjern linje"
                    >✕</button>
                  </div>
                ))}
                <button type="button" className="btn btn-outline-primary" onClick={() => setLinjer((p) => [...p, { description: "", price: 0 }])}>
                  + Tilføj opgave
                </button>
                {/* Thomas, 2026-09-11: intet 'samlet beløb' — i stedet det
                    ÅRLIGE beløb når intervallet er sat (pris pr. gang × besøg
                    pr. år, samme beregning som abonnementet). */}
                {aarligt != null ? (
                  <div className="tl-sum"><span>Årligt beløb (inkl. moms)</span><b>{kr(aarligt)}</b></div>
                ) : null}
              </div>
            </div>

            <hr className="section-hr" />
            {state.error ? <p style={{ color: "#8a5a10" }}>{state.error}</p> : null}
            <div className="row-actions" style={{ alignItems: "center", gap: 12 }}>
              <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Opretter…" : "Opret tilbud"}</button>
              <span className="form-text">Du kan rette alt — og tilføje fotos — på tilbuddet bagefter.</span>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}