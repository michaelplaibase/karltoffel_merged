"use client";

// Reusable task-line editor (the "Opgaver" formset). Rows submit via repeated
// field names (taskDescription/taskCategory/taskPrice/taskDuration, plus
// taskInterval/taskNextWeek in subscription mode) that the server action reads
// with formData.getAll, aligned by index. Used by order create and the
// subscription editor.
import { Fragment, useState } from "react";
import {
  CATEGORIES, chipBackground, chipTextColor, EGEN_KATEGORI, isNewCategoryName,
} from "@/lib/categories";
import { MOMS } from "@/lib/data";
import { WEEKDAYS_DA_SHORT, weekdayDigits } from "@/lib/task-weekdays";

export type TaskRow = {
  description: string; price: string; duration: string; category: string;
  interval?: string; nextWeek?: string;
  // "Måneder på pause" (kun abonnementer) — strengform til form-submit:
  // pauseActive/pauseYearly er '1'/'0', datoerne ISO 'YYYY-MM-DD'.
  pauseActive?: string; pauseStart?: string; pauseEnd?: string; pauseYearly?: string;
  // Ugedage (kun abonnementer): digit-streng "0"–"6", 0=mandag … 6=søndag,
  // fx "0" = kun mandag. Tom/undefined = alle ugedage.
  weekdays?: string;
  // Per-opgave medarbejder (kun abonnementer): "" = vælges automatisk, ellers
  // bruger-id som streng. Gemmes som TaskLine.employeeId.
  employee?: string;
};

const CAT_NAMES = Object.keys(CATEGORIES);
const INTERVALS = [
  "Hver gang", "Hver 2. gang", "Hver 3. gang", "Hver 4. gang", "Hver 5. gang",
  "Hver 6. gang", "Hver 8. gang", "Hver 12. gang", "På anmodning",
];
export const blankTaskRow = (): TaskRow => ({ description: "", price: "", duration: "", category: "Vinduespudsning", interval: "Hver gang", nextWeek: "" });
const blank = blankTaskRow;
const timepris = (r: TaskRow) => {
  const p = Number(r.price) || 0, d = Number(r.duration) || 0;
  return d > 0 ? Math.round((p / d) * 60) : 0;
};

export default function TaskLineEditor({
  initial, mode = "order", rows: controlledRows, setRows: controlledSetRows, minuteRate, employees,
}: {
  initial?: TaskRow[];
  mode?: "order" | "subscription";
  /** Valgfri kontrolleret tilstand: giver forælderen ejerskab over rækkerne, så
   *  fx PauseSection kan dele samme state. Udelades de, styrer editoren selv
   *  (som hidtil — OrderCreateForm/FixedPriceForm er uændrede). */
  rows?: TaskRow[];
  setRows?: React.Dispatch<React.SetStateAction<TaskRow[]>>;
  /** Minutpris (kr/min EKSKL. moms, fra Company.minutePriceOere). Angives den,
   *  auto-udfyldes varigheden når prisen tastes: (pris inkl. moms / 1,25) ÷
   *  minutpris, afrundet (min. 1 min). Varigheden kan stadig rettes manuelt —
   *  en manuel rettelse står, indtil prisen ændres igen. */
  minuteRate?: number;
  /** Medarbejdere (id + navn) til per-opgave tildeling (kun abonnement-mode).
   *  Udelades den, vises kolonnen ikke (ordre-/fastpris-formularer uændrede). */
  employees?: { id: number; name: string }[];
}) {
  const sub = mode === "subscription";
  const empList = sub ? employees ?? [] : [];
  const showEmp = empList.length > 0;
  // Beskrivelsesfeltet ligger som en hel bred linje UNDER opgaverækken
  // (Thomas 2026-09-10: "aflangt i bunden") — colSpan = alle kolonner.
  const descColSpan = 4 + (sub ? 3 : 0) + (showEmp ? 1 : 0);
  const [ownRows, setOwnRows] = useState<TaskRow[]>(initial?.length ? initial : [blank()]);
  const rows = controlledRows ?? ownRows;
  const setRows = controlledSetRows ?? setOwnRows;
  // En gemt per-opgave medarbejder, der er deaktiveret (ikke i listen), skal
  // stadig kunne SES og bevares — samme mønster som fixedEmployee i SubscriptionForm.
  const savedEmpById = new Map(empList.map((e) => [String(e.id), e]));
  const inactiveEmpIds = [...new Set(rows.map((r) => r.employee).filter((v) => v && !savedEmpById.has(v)))] as string[];
  // Egen kategori (Thomas 2026-09-10): hver række kan have sin egen fritekst-
  // kategori ud over de 15 faste. Dropdown viser "Egen kategori…" som sidste
  // punkt; vælges den, erstattes dropdownen af et tekstfelt (med chip foran).
  // Gemte fritekst-kategorier vises i dropdownen, så de kan genvælges —
  // ellers ville en gemt række med "Min kategori" falde tilbage til index 0.
  const savedCatNames = [...new Set(rows.map((r) => r.category).filter(isNewCategoryName)) as Set<string>];
  const update = (i: number, patch: Partial<TaskRow>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const add = () => setRows((rs) => [...rs, blank()]);
  const remove = (i: number) => setRows((rs) => (rs.length > 1 ? rs.filter((_, j) => j !== i) : rs));

  const sum = rows.reduce((a, r) => a + (Number(r.price) || 0), 0);
  const dur = rows.reduce((a, r) => a + (Number(r.duration) || 0), 0);

  // In subscription mode a persisted interval may not be in the short list
  // (e.g. "Hver gang (hver 2. uge)"); make sure it's still selectable.
  const intervalOptions = (r: TaskRow) =>
    r.interval && !INTERVALS.includes(r.interval) ? [r.interval, ...INTERVALS] : INTERVALS;

  return (
    <div>
      {/* Hver opgave = ÉN samlet boks (Thomas 2026-09-10: "alle felter i samme
          boks"): beskrivelsen ligger ØVERST i boksen og felterne under — ingen
          tabel-linjer eller skillestreger imellem. Felt-navne (taskDescription,
          taskCategory osv.) er uændrede, så server actions virker som før. */}
      {rows.map((r, i) => {
        const egen = r.category === EGEN_KATEGORI;
        return (
          <div key={i} className="task-card">
            <textarea
              name="taskDescription" value={r.description} rows={2}
              onChange={(e) => {
                update(i, { description: e.target.value });
                e.target.style.height = "auto";
                e.target.style.height = `${e.target.scrollHeight}px`;
              }}
              ref={(el) => {
                if (el) { el.style.height = "auto"; el.style.height = `${el.scrollHeight}px`; }
              }}
              className="form-control form-control-sm task-desc" placeholder="Opgavebeskrivelse"
            />
            {sub && (
              // "Måneder på pause": skjulte felter (IKKE checkbokse) der ALTID
              // submittes for hver række, så formData.getAll-zippet i
              // server-action'en holder indeks-flugt med taskDescription.
              <>
                <input type="hidden" name="taskPauseActive" value={r.pauseActive || "0"} />
                <input type="hidden" name="taskPauseStart" value={r.pauseStart || ""} />
                <input type="hidden" name="taskPauseEnd" value={r.pauseEnd || ""} />
                <input type="hidden" name="taskPauseYearly" value={r.pauseYearly || "1"} />
              </>
            )}
            <div className="task-card-fields">
              <span className="task-field" data-label="Kategori" style={{ minWidth: 170, flex: "1 1 160px" }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span className="catchip" style={{ background: chipBackground(r.category), color: chipTextColor(r.category), flexShrink: 0 }}>
                    {(r.category[0] ?? "A").toUpperCase()}
                  </span>
                  {egen ? (
                    // Egen kategori valgt: fritekstfelt i stedet for dropdown.
                    <input
                      type="text" value={r.category === EGEN_KATEGORI ? "" : r.category}
                      onChange={(e) => update(i, { category: e.target.value })}
                      className="form-control form-control-sm" style={{ flex: 1, minWidth: 0 }}
                      placeholder="Skriv kategori…" autoFocus
                    />
                  ) : (
                    <select
                      name="taskCategory" value={r.category}
                      onChange={(e) => update(i, { category: e.target.value })}
                      className="form-control form-control-sm" style={{ flex: 1, minWidth: 0 }}
                    >
                      {CAT_NAMES.map((c) => <option key={c} value={c}>{c}</option>)}
                      {savedCatNames.map((c) => <option key={c} value={c}>{c}</option>)}
                      <option value={EGEN_KATEGORI}>Egen kategori…</option>
                    </select>
                  )}
                </span>
              </span>
              <span className="task-field" data-label="Pris (inkl. moms)" style={{ minWidth: 130 }}>
                <input name="taskPrice" type="number" min="0" value={r.price}
                  onChange={(e) => {
                    // Pris tastet → auto-beregn varighed fra minutprisen (ekskl.
                    // moms). Tom/0/ugyldig pris rører ikke varigheden.
                    const v = e.target.value;
                    const n = Number(v);
                    const patch: Partial<TaskRow> = { price: v };
                    if (minuteRate && minuteRate > 0 && n > 0) {
                      patch.duration = String(Math.max(1, Math.round((n / (1 + MOMS)) / minuteRate)));
                    }
                    update(i, patch);
                  }} className="form-control form-control-sm num" />
                {Number(r.price) > 0 && (
                  <small className="form-text field-help">
                    {(Number(r.price) / (1 + MOMS)).toLocaleString("da-DK", { maximumFractionDigits: 2 })} kr. ekskl. moms
                  </small>
                )}
              </span>
              <span className="task-field" data-label="Varighed (min.)" style={{ minWidth: 110 }}>
                <input name="taskDuration" type="number" min="0" value={r.duration}
                  onChange={(e) => update(i, { duration: e.target.value })} className="form-control form-control-sm num" />
                {Number(r.duration) > 0 && (
                  <small className="form-text field-help">
                    ≈ {(Number(r.duration) / 60).toLocaleString("da-DK", { maximumFractionDigits: 1 })} t
                  </small>
                )}
              </span>
              {sub && (
                <span className="task-field" data-label="Interval" style={{ minWidth: 150 }}>
                  <select name="taskInterval" value={r.interval ?? "Hver gang"}
                    onChange={(e) => update(i, { interval: e.target.value })} className="form-control form-control-sm">
                    {intervalOptions(r).map((o) => <option key={o} value={o}>{o}</option>)}
                  </select>
                </span>
              )}
              {sub && (
                <span className="task-field" data-label="Næste gang" style={{ minWidth: 100 }}>
                  <input name="taskNextWeek" value={r.nextWeek ?? ""} placeholder="Uge 29"
                    onChange={(e) => update(i, { nextWeek: e.target.value })} className="form-control form-control-sm" />
                </span>
              )}
              {showEmp && (
                // Per-opgave medarbejder: tom = vælges automatisk.
                <span className="task-field" data-label="Medarbejder" style={{ minWidth: 150 }}>
                  <select
                    name="taskEmployee" value={r.employee ?? ""}
                    onChange={(e) => update(i, { employee: e.target.value })}
                    className="form-control form-control-sm"
                  >
                    <option value="">Vælges automatisk</option>
                    {empList.map((e) => <option key={e.id} value={String(e.id)}>{e.name}</option>)}
                    {inactiveEmpIds.includes(r.employee ?? "") && (
                      <option value={r.employee!}>Nuværende: ID {r.employee} (deaktiveret)</option>
                    )}
                  </select>
                </span>
              )}
              {sub && (
                // Ugedage: små checkbokse (mandag–søndag) + skjult felt der ALTID
                // submittes (checkboxes forskubber ellers getAll-zippet).
                <span className="task-field" data-label="Ugedage">
                  <div role="group" aria-label={`Ugedage for ${r.description || "opgaven"}`} style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {WEEKDAYS_DA_SHORT.map((name, day) => {
                      const selected = (r.weekdays ?? "").includes(String(day));
                      return (
                        <label key={day} title={name} style={{ display: "inline-flex", alignItems: "center", gap: 2, fontSize: 12, cursor: "pointer" }}>
                          <input
                            type="checkbox"
                            checked={selected}
                            onChange={(e) => {
                              const cur = new Set([...(r.weekdays ?? "")].map(Number).filter((d) => d >= 0 && d <= 6));
                              if (e.target.checked) cur.add(day); else cur.delete(day);
                              update(i, { weekdays: weekdayDigits([...cur]) ?? "" });
                            }}
                          />
                          {name}
                        </label>
                      );
                    })}
                  </div>
                  <input type="hidden" name="taskWeekdays" value={r.weekdays ?? ""} />
                </span>
              )}
              <span className="task-field task-remove" data-label="">
                <button type="button" onClick={() => remove(i)} className="btn btn-light btn-sm" title="Fjern opgave">
                  <i className="bi bi-trash" />
                </button>
              </span>
            </div>
            {timepris(r) > 0 && <small className="form-text field-help" style={{ margin: "2px 12px 8px" }}>Timepris {timepris(r)} kr/t</small>}
          </div>
        );
      })}
      <div className="task-sum-row">
        <span className="muted">Sum</span>
        <span style={{ fontWeight: 600 }}>{sum.toLocaleString("da-DK")} kr</span>
        <span style={{ fontWeight: 600 }}>{dur} min</span>
      </div>
      {minuteRate != null && minuteRate > 0 && (
        <small className="form-text field-help" style={{ display: "block", marginTop: 4 }}>
          Varighed beregnes ud fra prisen ekskl. moms ÷ {minuteRate.toLocaleString("da-DK")} kr/min.
        </small>
      )}
      <button type="button" onClick={add} className="btn btn-outline-primary btn-sm" style={{ marginTop: 8 }}>
        Tilføj opgave
      </button>
    </div>
  );
}
