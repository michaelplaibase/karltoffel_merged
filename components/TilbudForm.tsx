"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { TilbudState } from "@/app/actions/tilbud";
import { BASE_INTERVALS, tilbudLinjeAarsbelob, tilbudAarsbelobSum } from "@/lib/subscription-intervals";
import { bygAarshjul } from "@/lib/tilbud.mts";
import Aarshjul from "@/components/Aarshjul";

type Kontakt = { id: number; name: string; companyName: string | null; isCompany: boolean };
// Medarbejder-vælger pr. linje (intern — vises ikke for kunden). SAMME
// kildeliste som abonnements-formularen: getEmployeeOptions (aktive users).
export type TilbudEmployeeOption = { id: number; name: string };

const kr = (n: number) => n.toLocaleString("da-DK") + " kr";

export default function TilbudForm({ contacts, employees, action }: {
  contacts: Kontakt[];
  employees: TilbudEmployeeOption[];
  action: (state: TilbudState, formData: FormData) => Promise<TilbudState>;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const [nyKunde, setNyKunde] = useState(false);
  // Thomas, 2026-09-11 (korrektion 3): kundetype (privat vs. virksomhed) —
  // SAMME felt som Contact-modellen (isCompany) og kunde-kartotekets
  // KontaktForm (checkbox "Virksomhed", ikke afkrydset = Privat). Ved ny
  // kunde gemmes valget som isCompany på kontakten (se app/actions/tilbud.ts).
  // Ved VALG af eksisterende kunde vises kundens type låst — den kan ikke
  // ændres her, kun i kunde-kartoteket.
  const [nyVirksomhed, setNyVirksomhed] = useState(false);
  const [valgtKunde, setValgtKunde] = useState<Kontakt | null>(null);
  // Thomas, 2026-09-11 (korrektion): interval vælges PR. OPGAVELINJE — samme
  // muligheder som abonnementet (BASE_INTERVALS inkl. "1 gang om året").
  // Tilbud-niveau-feltet er beholdt som STANDARD/præ-valg for nye linjer.
  // Thomas, 2026-09-11 (korrektion 2): også en valgfri STARTUGE PR. OPGAVELINJE
  // — samme format som tilbud-niveau startuge ('Uge 29' / 'Uge 29, 2026').
  const [linjer, setLinjer] = useState<{ description: string; price: number; interval: string; startWeek: string; employee: string }[]>([
    { description: "", price: 0, interval: "", startWeek: "", employee: "" },
  ]);
  const [standardInterval, setStandardInterval] = useState("");
  // Ny linje arver tilbud-niveau startugen som standard, hvis den er udfyldt.
  const [standardStartWeek, setStandardStartWeek] = useState("");
  // Årsbeløb pr. linje + summen af linjerne med interval (engangsopgaver uden
  // interval tæller ikke med — samme beregning som abonnementet).
  const linjeAar = linjer.map(tilbudLinjeAarsbelob);
  const aarligt = tilbudAarsbelobSum(linjer);

  const opdaterLinje = (i: number, felt: "description" | "price" | "interval" | "startWeek" | "employee", vaerdi: string) => {
    setLinjer((prev) => prev.map((l, j) => (j === i ? { ...l, [felt]: felt === "price" ? Number(vaerdi) || 0 : vaerdi } : l)));
  };

  return (
    // Thomas, 2026-09-11 (feedback): formularen var for klem — opgave-linjerne
    // (pris/interval/startuge) blev klippet af i højre side. Bredere container
    // + opgave-sektionen spænder over FULDT kort-bredde (se globals.css:
    // .tl-row-tilbud + responsive breakpoints, stakker pænt på smal skærm).
    <div className="container-1140" style={{ maxWidth: 1100 }}>
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
                    <select
                      name="contactId"
                      className="form-control"
                      required
                      defaultValue=""
                      onChange={(e) => {
                        const id = Number(e.target.value);
                        setValgtKunde(contacts.find((c) => c.id === id) ?? null);
                      }}
                    >
                      <option value="" disabled>Vælg en kunde…</option>
                      {contacts.map((c) => (
                        <option key={c.id} value={c.id}>{c.companyName || c.name}</option>
                      ))}
                    </select>
                    {valgtKunde ? (
                      <small className="form-text" style={{ display: "block", marginTop: 6 }}>
                        Kundetype: <b>{valgtKunde.isCompany ? "Virksomhed" : "Privat"}</b> (låst — ændres kun i kunde-kartoteket)
                      </small>
                    ) : null}
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
                    {/* SAMME mønster som kunde-kartotekets KontaktForm:
                        checkbox "Virksomhed" — ikke afkrydset = Privat.
                        Gemmes som isCompany på kontakten ved oprettelse. */}
                    <label style={{ display: "inline-flex", alignItems: "center", gap: 9, fontWeight: 300 }}>
                      <input
                        type="checkbox"
                        name="newIsCompany"
                        value="1"
                        checked={nyVirksomhed}
                        onChange={(e) => setNyVirksomhed(e.target.checked)}
                      />
                      Virksomhed
                    </label>
                    <small className="form-text" style={{ display: "block" }}>
                      Ikke afkrydset = privatkunde (samme isCompany-felt som kunde-kartoteket).
                    </small>
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
                <input
                  name="startWeek"
                  className="form-control"
                  placeholder="Fx Uge 29 eller Uge 29, 2026"
                  value={standardStartWeek}
                  onChange={(e) => {
                    const v = e.target.value;
                    setStandardStartWeek(v);
                    // Thomas, 2026-09-11 (korrektion 2): nye/udfyldte linjer kan
                    // arve tilbud-niveau startugen som standard — tomme linje-
                    // startuger udfyldes, kan stadig rettes pr. linje.
                    setLinjer((prev) => prev.map((l) => (l.startWeek ? l : { ...l, startWeek: v })));
                  }}
                />
                <small className="form-text">Kommer med på tilbuddet og forudfylder abonnementet, hvis kunden siger ja — kan også sættes pr. opgavelinje herunder.</small>
              </div>
            </div>
            <div className="f2">
              <label className="col-label">Standard-interval for nye linjer (valgfri)</label>
              <div>
                {/* Thomas, 2026-09-11 (korrektion): intervallet vælges pr.
                    opgavelinje herunder — dette felt er kun et præ-valg, som nye
                    linjer starter med. SAMME muligheder som abonnements-
                    oprettelsen — konstanterne deles (lib/subscription-intervals),
                    så de aldrig afviger. */}
                <select
                  name="baseInterval"
                  className="form-control"
                  value={standardInterval}
                  onChange={(e) => {
                    const v = e.target.value;
                    setStandardInterval(v);
                    // Nye linjer arver standard-intervallet (valgfrit — kan
                    // ændres pr. linje).
                    setLinjer((prev) => prev.map((l) => (l.interval ? l : { ...l, interval: v })));
                  }}
                >
                  <option value="">Ikke sat (vælges pr. linje)</option>
                  {BASE_INTERVALS.map((iv) => (
                    <option key={iv} value={iv}>{iv}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="f2" style={{ gridColumn: "1 / -1" }}>
              <label className="col-label">Opgaver og priser</label>
              <div className="tasklines">
                {linjer.map((l, i) => (
                  <div className="tl-row tl-row-tilbud" key={i}>
                    <input
                      name="taskDescription"
                      className="form-control"
                      placeholder={i === 0 ? "Fx tagrender + nedløb" : ""}
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
                    {/* Valgfrit interval PR. LINJE — samme muligheder som
                        abonnementet (genbrugt BASE_INTERVALS). */}
                    <select
                      name="taskInterval"
                      className="form-control"
                      value={l.interval}
                      onChange={(e) => opdaterLinje(i, "interval", e.target.value)}
                      aria-label="Interval"
                    >
                      <option value="">Engangsopgave</option>
                      {BASE_INTERVALS.map((iv) => (
                        <option key={iv} value={iv}>{iv}</option>
                      ))}
                    </select>
                    {/* Thomas, 2026-09-11 (korrektion 2): valgfri STARTUGE PR.
                        LINJE — samme format som tilbud-niveau ('Uge 29' /
                        'Uge 29, 2026'); tom = arver tilbud-niveau startugen
                        ved konvertering. Påvirker IKKE årsbeløbet. */}
                    <input
                      name="taskStartWeek"
                      className="form-control"
                      value={l.startWeek}
                      onChange={(e) => opdaterLinje(i, "startWeek", e.target.value)}
                      placeholder="Startuge"
                      aria-label="Startuge (valgfri)"
                    />
                    {/* Thomas, 2026-09-11: valgfri MEDARBEJDER PR. LINJE —
                        ren INTERN data (vises IKKE på PDF'en, accept-siden
                        eller årshjulet). Overføres kun til opgaven, når
                        tilbuddet konverteres til abonnement. Samme kilde som
                        abonnements-formularen (aktive medarbejdere). */}
                    {/* Thomas, 2026-09-11 (korrektion 4): medarbejder-feltet
                        fik sin egen BREDE kolonne i .tl-row-tilbud + en synlig
                        label — selecten er altid med, så rækkens kolonner er
                        stabile (slet-knappen ryger aldrig ned på en ny række,
                        selv hvis listen over medarbejdere er tom). */}
                    <div className="tl-employee-cell">
                      <small className="tl-field-label">Medarbejder</small>
                      <select
                        name="taskEmployee"
                        className="form-control"
                        value={l.employee}
                        onChange={(e) => opdaterLinje(i, "employee", e.target.value)}
                        aria-label="Medarbejder (intern)"
                      >
                        <option value="">Vælges automatisk</option>
                        {employees.map((e) => (
                          <option key={e.id} value={e.id}>{e.name}</option>
                        ))}
                      </select>
                    </div>
                    <button
                      type="button"
                      className="btn btn-light"
                      onClick={() => setLinjer((prev) => (prev.length > 1 ? prev.filter((_, j) => j !== i) : prev))}
                      aria-label="Fjern linje"
                    >✕</button>
                    {/* Årsbeløb PR. LINJE — kun linjer med interval tæller med. */}
                    {linjeAar[i] != null ? (
                      <small className="form-text" style={{ gridColumn: "1 / -1", marginTop: -4 }}>
                        Årligt: {kr(linjeAar[i] as number)} ({l.interval.toLowerCase()}){l.employee ? " · Medarbejder: intern visning" : ""}
                      </small>
                    ) : null}
                  </div>
                ))}
                <button type="button" className="btn btn-outline-primary" onClick={() => setLinjer((p) => [...p, { description: "", price: 0, interval: standardInterval, startWeek: standardStartWeek, employee: "" }])}>
                  + Tilføj opgave
                </button>
                {/* Thomas, 2026-09-11: medarbejder-vælgeren er INTERN — gør det
                    eksplicit, så teamet ikke forventer den på PDF'en. */}
                {employees.length > 0 ? (
                  <small className="form-text">Medarbejder pr. linje er kun internt ({""}vises ikke på tilbuddet til kunden) — følger opgaven, når tilbuddet konverteres.</small>
                ) : null}
                {/* Thomas, 2026-09-11 (korrektion): Årsbeløbet er nu SUMMEN PR.
                    LINJE — hver linje med interval bidrager med pris × besøg pr.
                    år (52/uge-interval; 1 for "1 gang om året"). Linjer uden
                    interval er engangsopgaver og tæller ikke med. */}
                {aarligt != null ? (
                  <div className="tl-sum"><span>Årligt beløb (inkl. moms) — sum af linjerne med interval</span><b>{kr(aarligt)}</b></div>
                ) : null}
              </div>
            </div>

            {/* Thomas, 2026-09-11: ÅRSHJUL — live forhåndsvisning af alle besøg
                over året pr. uge (startuge + interval, samme matematik som
                PDF'en og accept-siden). Viser kun, når mindst én linje kan
                placeres (har startuge + titel). */}
            <div style={{ gridColumn: "1 / -1" }}>
              <Aarshjul uger={bygAarshjul(linjer)} overskrift="Årshjul — sådan ser kundens år ud" />
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