"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import type { TilbudState } from "@/app/actions/tilbud";
import { BASE_INTERVALS, tilbudLinjeAarsbelob, tilbudAarsbelobSum } from "@/lib/subscription-intervals";
import { bygAarshjul, linjeFarve } from "@/lib/tilbud.mts";
import { tilbudMomsOgIalt, krMoms } from "@/lib/vat";
import { LEAD_SOURCES } from "@/lib/lead-sources.mts";
// Thomas, 2026-09-18: kategori PR. OPGAVELINJE — SAMME kategori-liste/farver
// som abonnementets TaskLineEditor (CATEGORIES + "Egen kategori" fra
// lib/categories.ts), så tilbuds-kategorierne aldrig afviger fra abonnementet.
import { CATEGORIES, chipBackground, chipTextColor, EGEN_KATEGORI, isNewCategoryName } from "@/lib/categories";
import Aarshjul from "@/components/Aarshjul";

const CAT_NAMES = Object.keys(CATEGORIES);

type Kontakt = { id: number; name: string; companyName: string | null; isCompany: boolean };
// Medarbejder-vælger pr. linje (intern — vises ikke for kunden). SAMME
// kildeliste som abonnements-formularen: getEmployeeOptions (aktive users).
export type TilbudEmployeeOption = { id: number; name: string };

// Thomas, 2026-09-17: edit-mode. Når `initial` er givet, forudfylder
// formularen et EKSISTERENDE tilbud (fra /tilbud/[id]/edit) og sender
// ændringerne til `updateTilbud` i stedet for at oprette et nyt.
export type TilbudInitial = {
  id: number;
  contactId: number;
  contactName: string;
  title: string;
  note: string | null;
  startWeek: string | null;
  baseInterval: string | null;
  leadSource: string | null;
  lines: { id: number; description: string; price: number; category: string; interval: string | null; startWeek: string | null; employee: string; pauseActive: boolean; pauseStart: string | null; pauseEnd: string | null; pauseYearly: boolean }[];
};

type TilbudLinje = {
  id: number | null;
  description: string;
  price: number;
  interval: string;
  startWeek: string;
  employee: string;
  category: string;
  egenKategoriTekst: string;
  // Thomas, 2026-09-18: sæsonpause pr. linje (intern — vises ikke for
  // kunden; påvirker teamets årshjul + konverteres til TaskLine-pause).
  pauseActive: boolean;
  pauseStart: string;
  pauseEnd: string;
  pauseYearly: boolean;
};

const NY_LINJE = {
  id: null as number | null,
  description: "", price: 0, interval: "", startWeek: "", employee: "",
  category: "Andet", egenKategoriTekst: "",
  pauseActive: false, pauseStart: "", pauseEnd: "", pauseYearly: true,
};

// Måneder (1-12) + wrap-bevidst "er måned i pausevinduet" — samme visning som
// abonnementsformularens PauseSection (okt→mar dækker 10,11,12,1,2,3).
const MÅNEDER = ["Jan", "Feb", "Mar", "Apr", "Maj", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"];
function maanedAf(iso?: string): number | null {
  const m = iso?.match(/^\d{4}-(\d{2})-\d{2}$/);
  return m ? Number(m[1]) : null;
}
function maanedIVindue(m: number, start?: string, end?: string): boolean {
  const s = maanedAf(start), e = maanedAf(end);
  if (s == null || e == null) return false;
  return s <= e ? m >= s && m <= e : m >= s || m <= e;
}

const kr = (n: number) => n.toLocaleString("da-DK") + " kr";

export default function TilbudForm({ contacts, employees, action, initial }: {
  contacts: Kontakt[];
  employees: TilbudEmployeeOption[];
  action: (state: TilbudState, formData: FormData) => Promise<TilbudState>;
  initial?: TilbudInitial | null;
}) {
  const rediger = !!initial;
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
  // Thomas, 2026-09-17: `id` bærer den EKSISTERENDE TilbudLine-id i edit-mode
  // (null = ny linje), så updateTilbud kan opdatere linjerne på plads (fx
  // bevarer linjefotos) i stedet for at slette + genoprette.
  const [linjer, setLinjer] = useState<TilbudLinje[]>(
    initial?.lines?.length
      ? initial.lines.map((l) => ({ id: l.id, description: l.description, price: l.price, interval: l.interval ?? "", startWeek: l.startWeek ?? "", employee: l.employee ?? "", category: l.category || "Andet", egenKategoriTekst: "", pauseActive: l.pauseActive, pauseStart: l.pauseStart ?? "", pauseEnd: l.pauseEnd ?? "", pauseYearly: l.pauseYearly }))
      : [{ ...NY_LINJE }],
  );
  const [standardInterval, setStandardInterval] = useState(initial?.baseInterval ?? "");
  // Ny linje arver tilbud-niveau startugen som standard, hvis den er udfyldt.
  const [standardStartWeek, setStandardStartWeek] = useState(initial?.startWeek ?? "");
  // Årsbeløb pr. linje + summen af linjerne med interval (engangsopgaver uden
  // interval tæller ikke med — samme beregning som abonnementet).
  const linjeAar = linjer.map(tilbudLinjeAarsbelob);
  const aarligt = tilbudAarsbelobSum(linjer);
  // Thomas, 2026-09-15: priser angives U. moms — moms (25%) lægges til i
  // bunden. ÉN delt funktion (lib/vat), så tallene aldrig afviger fra
  // detaljesiden, PDF'en og accept-siden.
  const momsBund = aarligt != null ? tilbudMomsOgIalt(aarligt) : null;

  const opdaterLinje = (i: number, felt: "description" | "price" | "interval" | "startWeek" | "employee" | "category" | "egenKategoriTekst", vaerdi: string) => {
    setLinjer((prev) => prev.map((l, j) => (j === i ? { ...l, [felt]: felt === "price" ? Number(vaerdi) || 0 : vaerdi } : l)));
  };
  // Thomas, 2026-09-18: sæsonpause pr. linje — genbruger abonnementsformularens
  // mønster (PauseSection): slå pausen til sætter et standardvindue (31/10 i år
  // → 30/03 næste år), slå den fra nulstiller kun pauseActive (datoer bevares).
  const opdaterPause = (i: number, patch: Partial<TilbudLinje>) =>
    setLinjer((prev) => prev.map((l, j) => (j === i ? { ...l, ...patch } : l)));
  const saetPause = (i: number, on: boolean) => {
    if (!on) { opdaterPause(i, { pauseActive: false }); return; }
    const y = new Date().getFullYear();
    const cur = linjer[i];
    opdaterPause(i, {
      pauseActive: true,
      pauseStart: cur.pauseStart || `${y}-10-31`,
      pauseEnd: cur.pauseEnd || `${y + 1}-03-30`,
      pauseYearly: cur.pauseYearly,
    });
  };
  // Egen kategori (Thomas 2026-09-10): gemte fritekst-kategorier vises i
  // dropdownen, så de kan genvælges (samme mønster som abonnementets
  // TaskLineEditor) — en gemt række med "Min kategori" falder ikke tilbage til index 0.
  const savedCatNames = [...new Set(linjer.map((l) => l.category).filter(isNewCategoryName))] as string[];

  return (
    // Thomas, 2026-09-11 (feedback): formularen var for klem — opgave-linjerne
    // (pris/interval/startuge) blev klippet af i højre side. Bredere container
    // + opgave-sektionen spænder over FULDT kort-bredde (se globals.css:
    // .tl-row-tilbud + responsive breakpoints, stakker pænt på smal skærm).
    <div className="container-1140" style={{ maxWidth: 1100 }}>
      <div className="toolbar" style={{ justifyContent: "space-between" }}>
        <div>
          <h1 className="page-title" style={{ margin: 0 }}>{rediger ? "Ret tilbud" : "Nyt tilbud"}</h1>
          <p className="page-desc" style={{ marginBottom: 0 }}>
            {rediger
              ? "Redigér tilbuddet — ændringerne gemmes på dette tilbud. Bemærk: redigeres et SENDT tilbud, nulstilles det til udkast, og kunden skal have det opdaterede tilbud tilsendt igen (nyt godkend-link)."
              : "Vælg kunden, tilføj opgaver med priser — fotos tilføjes på tilbuddet bagefter."}
          </p>
        </div>
        <Link href="/tilbud" className="btn btn-light">Gå tilbage</Link>
      </div>

      <div className="card">
        <div className="card-body">
          <form action={formAction}>
            {/* Thomas, 2026-09-17: edit-mode markerer hvilket tilbud der rettes.
                Kunden er LÅST i edit-mode (kan kun ændres via kunde-kartoteket). */}
            {rediger ? <input type="hidden" name="tilbudId" value={String(initial?.id ?? "")} /> : null}
            <div className="f2">
              <label className="col-label">Kunde</label>
              <div>
                {rediger ? (
                  <>
                    <input type="hidden" name="contactId" value={String(initial?.contactId ?? "")} />
                    <p className="page-desc" style={{ marginBottom: 0 }}>{initial?.contactName ?? ""} (kan ikke ændres her)</p>
                    <small className="form-text">Ændres kun i kunde-kartoteket — tilbuddet holdes på den samme kunde.</small>
                  </>
                ) : (
                <>
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
                </>
                )}
              </div>
            </div>

            {!rediger && nyKunde ? (
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

            {/* Thomas, 2026-09-12: valgfri LEAD-KILDE — samme liste som
                lead-beregnerens LEAD_SOURCES (lib/lead-sources.mts). Ren
                INTERN data: gemmes på Tilbud.leadSource og vises IKKE på
                PDF/accept-side. Ved konvertering ryger kilden automatisk videre
                til LeadAcquisition.source, så kunden tæller under den rigtige
                kanal i Business Manager → Leads. */}
            <div className="f2">
              <label className="col-label">Lead-kilde (valgfri)</label>
              <div>
                <select name="leadSource" className="form-control" defaultValue="">
                  <option value="">Ikke sat</option>
                  {LEAD_SOURCES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <small className="form-text">
                  Hvor kunden kommer fra (SEO, Meta osv.) — kun internt. Tæller med i lead-beregneren, når tilbuddet konverteres til abonnement.
                </small>
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
                    {/* Thomas, 2026-09-17: bær den EKSISTERENDE TilbudLine-id
                        (tom = ny linje), så updateTilbud opdaterer linjen på
                        plads og bevarer evt. linjefotos. */}
                    <input type="hidden" name="taskId" value={l.id != null ? String(l.id) : ""} />
                    {/* Thomas, 2026-09-18: sæsonpause pr. linje — hidden-felter
                        submittes ALTID (også upausede), så positionsvise zip i
                        readLines aldrig forskubbes. Samme felter som
                        abonnementets TaskLine-pause. */}
                    <input type="hidden" name="taskPauseActive" value={l.pauseActive ? "1" : "0"} />
                    <input type="hidden" name="taskPauseStart" value={l.pauseStart || ""} />
                    <input type="hidden" name="taskPauseEnd" value={l.pauseEnd || ""} />
                    <input type="hidden" name="taskPauseYearly" value={l.pauseYearly ? "1" : "0"} />
                    {/* Opgavebeskrivelsen fylder en FULD linje; slet-knappen
                        ligger i SAMME række mod højre, så hver linje har sin
                        slet-knap ensartet (øverst til højre) i stedet for at
                        blive skubbet ned i bunden af felt-rækken. */}
                    <div className="tl-desc">
                      {/* farve-prik pr. linje — samme farve som linjens chips
                          i årshjulet nedenfor (linjeFarve(i)). */}
                      <span
                        aria-hidden
                        title={`Linjens farve i årshjulet`}
                        style={{ flexShrink: 0, width: 12, height: 12, borderRadius: 4, background: linjeFarve(i), border: `1px solid rgba(76, 55, 24, 0.25)`, marginTop: 8, display: "inline-block" }}
                      />
                      <textarea
                        name="taskDescription"
                        className="form-control"
                        rows={4}
                        placeholder={i === 0 ? "Fx tagrender + nedløb" : ""}
                        value={l.description}
                        onChange={(e) => opdaterLinje(i, "description", e.target.value)}
                      />
                      <button
                        type="button"
                        className="btn btn-light"
                        onClick={() => setLinjer((prev) => (prev.length > 1 ? prev.filter((_, j) => j !== i) : prev))}
                        aria-label="Fjern linje"
                      >✕</button>
                    </div>
                    {/* Parametrene (Pris/Kategori/Interval/Startuge/Medarbejder)
                        ligger nu i et ensartet felt-grid med etiket OVER hvert
                        felt — i stedet for en klemt række med niveauer på kryds
                        og tværs. Felterne fylder hver deres kolonne og stakker
                        pænt på smallere skærme (auto-fit). */}
                    <div className="tl-param-grid">
                      <div className="tl-param-field">
                        <small className="tl-field-label">Pris (u. moms)</small>
                        <input
                          name="taskPrice"
                          type="number"
                          min={0}
                          className="form-control num"
                          value={l.price || ""}
                          onChange={(e) => opdaterLinje(i, "price", e.target.value)}
                          placeholder="0,00"
                        />
                      </div>
                      {/* Thomas, 2026-09-18: valgfri KATEGORI PR. LINJE — SAMME
                          kategori-dropdown/fritekst som abonnementets
                          TaskLineEditor (CATEGORIES + "Egen kategori" fra
                          lib/categories.ts), så tilbud og abonnement aldrig
                          afviger. Følger med til opgaven ved konvertering
                          (i stedet for altid "Andet"). */}
                      <div className="tl-param-field">
                        <small className="tl-field-label">Kategori</small>
                        {l.category === EGEN_KATEGORI ? (
                          <span style={{ display: "flex", gap: 6, alignItems: "center", width: "100%", minWidth: 0 }}>
                            <input
                              type="text"
                              value={l.egenKategoriTekst ?? ""}
                              onChange={(e) => opdaterLinje(i, "egenKategoriTekst", e.target.value)}
                              className="form-control"
                              placeholder="Skriv kategori…"
                              aria-label="Egen kategori"
                              style={{ flex: "1 1 0", minWidth: 0 }}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const t = (l.egenKategoriTekst ?? "").trim();
                                if (t) { opdaterLinje(i, "category", t); opdaterLinje(i, "egenKategoriTekst", ""); }
                              }}
                              className="btn btn-primary btn-sm"
                              title="Brug denne kategori"
                            >OK</button>
                          </span>
                        ) : (
                          <span style={{ display: "flex", alignItems: "center", gap: 6, width: "100%", minWidth: 0 }}>
                            <span
                              className="catchip"
                              style={{ background: chipBackground(l.category), color: chipTextColor(l.category), flexShrink: 0 }}
                            >{(l.category[0] ?? "A").toUpperCase()}</span>
                            <select
                              name="taskCategory"
                              className="form-control"
                              value={l.category}
                              onChange={(e) => opdaterLinje(i, "category", e.target.value)}
                              aria-label="Kategori"
                              style={{ flex: "1 1 0", minWidth: 0 }}
                            >
                              {CAT_NAMES.map((c) => <option key={c} value={c}>{c}</option>)}
                              {savedCatNames.map((c) => <option key={c} value={c}>{c}</option>)}
                              <option value={EGEN_KATEGORI}>Egen kategori…</option>
                            </select>
                          </span>
                        )}
                      </div>
                      {/* Valgfrit interval PR. LINJE — samme muligheder som
                          abonnementet (genbrugt BASE_INTERVALS). */}
                      <div className="tl-param-field">
                        <small className="tl-field-label">Interval</small>
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
                      </div>
                      {/* Thomas, 2026-09-11 (korrektion 2): valgfri STARTUGE PR.
                          LINJE — samme format som tilbud-niveau ('Uge 29' /
                          'Uge 29, 2026'); tom = arver tilbud-niveau startugen
                          ved konvertering. Påvirker IKKE årsbeløbet. */}
                      <div className="tl-param-field">
                        <small className="tl-field-label">Startuge</small>
                        <input
                          name="taskStartWeek"
                          className="form-control"
                          value={l.startWeek}
                          onChange={(e) => opdaterLinje(i, "startWeek", e.target.value)}
                          placeholder="Fx Uge 29"
                          aria-label="Startuge (valgfri)"
                        />
                      </div>
                      {/* Thomas, 2026-09-11: valgfri MEDARBEJDER PR. LINJE —
                          ren INTERN data (vises IKKE på PDF'en, accept-siden
                          eller årshjulet). Overføres kun til opgaven, når
                          tilbuddet konverteres til abonnement. Samme kilde som
                          abonnements-formularen (aktive medarbejdere). */}
                      <div className="tl-param-field">
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
                    </div>
                    {/* Thomas, 2026-09-18: SÆSONPAUSE PR. LINJE — intern (vises
                        ikke for kunden; teamets årshjul udelader pausebesøg), og
                        pausen følger opgaven ved konvertering til abonnement.
                        Samme betjening/følelse som abonnementsformularens
                        PauseSection ("Måneder på pause"). */}
                    <div className="pauserow" style={{ marginTop: 10 }}>
                      <div className="pauserow-head">
                        <span className="pauserow-name" style={{ fontWeight: 400, fontSize: 13 }}>
                          Sæsonpause
                          {l.pauseActive ? <span className="badge badge-soft-muted" style={{ marginLeft: 8 }}>På pause</span> : null}
                        </span>
                        <label className="form-check-inline" style={{ marginRight: 0 }}>
                          <input
                            type="checkbox"
                            checked={l.pauseActive}
                            onChange={(e) => saetPause(i, e.target.checked)}
                          />
                          Sæt på pause
                        </label>
                      </div>
                      {l.pauseActive ? (
                        <div className="pauserow-body">
                          <div className="pausestrip" aria-label="Måneder i pausevinduet">
                            {MÅNEDER.map((navn, mIdx) => (
                              <span key={navn} className={`m${maanedIVindue(mIdx + 1, l.pauseStart, l.pauseEnd) ? " on" : ""}`}>
                                {navn}
                              </span>
                            ))}
                          </div>
                          <div className="grid-2" style={{ gap: 12, marginTop: 10 }}>
                            <div>
                              <label className="field-label">Pause fra</label>
                              <input
                                type="date"
                                className="form-control form-control-sm"
                                value={l.pauseStart || ""}
                                onChange={(e) => opdaterPause(i, { pauseStart: e.target.value })}
                              />
                            </div>
                            <div>
                              <label className="field-label">Pause til</label>
                              <input
                                type="date"
                                className="form-control form-control-sm"
                                value={l.pauseEnd || ""}
                                onChange={(e) => opdaterPause(i, { pauseEnd: e.target.value })}
                              />
                            </div>
                          </div>
                          <div style={{ marginTop: 10 }}>
                            <label className="form-check-inline" style={{ marginRight: 14 }}>
                              <input
                                type="radio"
                                name={`pauseYearlyChoice-${i}`}
                                checked={l.pauseYearly}
                                onChange={() => opdaterPause(i, { pauseYearly: true })}
                              />
                              Hvert år
                            </label>
                            <label className="form-check-inline">
                              <input
                                type="radio"
                                name={`pauseYearlyChoice-${i}`}
                                checked={!l.pauseYearly}
                                onChange={() => opdaterPause(i, { pauseYearly: false })}
                              />
                              Kun denne sæson
                            </label>
                          </div>
                        </div>
                      ) : (
                        <small className="form-text" style={{ display: "block", marginTop: 4 }}>
                          Sæt opgaven på pause i et vindue (fx vinter) — der vises ingen besøg for den i teamets årshjul i perioden.
                        </small>
                      )}
                    </div>
                    {/* Årsbeløb PR. LINJE — kun linjer med interval tæller med. */}
                    {linjeAar[i] != null ? (
                      <small className="form-text">
                        Årligt (u. moms): {kr(linjeAar[i] as number)} ({l.interval.toLowerCase()}){l.employee ? " · Medarbejder: intern visning" : ""}
                      </small>
                    ) : null}
                  </div>
                ))}
                <button type="button" className="btn btn-outline-primary" onClick={() => setLinjer((p) => [...p, { ...NY_LINJE, interval: standardInterval, startWeek: standardStartWeek }])}>
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
                {momsBund ? (
                  <div className="tl-sum" style={{ flexDirection: "column", alignItems: "flex-end", gap: 3 }}>
                    <span>Årligt beløb (u. moms) — sum af linjerne med interval</span>
                    <b>{kr(momsBund.ekskl)}</b>
                    <span>Moms (25%): {krMoms(momsBund.moms)}</span>
                    <b>Ialt inkl. moms: {krMoms(momsBund.ialt)}</b>
                  </div>
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
              <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? (rediger ? "Gemmer…" : "Opretter…") : (rediger ? "Gem ændringer" : "Opret tilbud")}</button>
              <span className="form-text">{rediger ? "Ændringerne gemmes på dette tilbud. Fotos administreres på detaljesiden bagefter." : "Du kan rette alt — og tilføje fotos — på tilbuddet bagefter."}</span>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}