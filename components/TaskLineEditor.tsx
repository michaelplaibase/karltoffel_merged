"use client";

// Reusable task-line editor (the "Opgaver" formset). Rows submit via repeated
// field names (taskDescription/taskCategory/taskPrice/taskDuration, plus
// taskInterval/taskNextWeek in subscription mode) that the server action reads
// with formData.getAll, aligned by index. Used by order create and the
// subscription editor.
import { useState } from "react";
import { CATEGORIES, categoryColor } from "@/lib/categories";

export type TaskRow = {
  description: string; price: string; duration: string; category: string;
  interval?: string; nextWeek?: string;
  // "Måneder på pause" (kun abonnementer) — strengform til form-submit:
  // pauseActive/pauseYearly er '1'/'0', datoerne ISO 'YYYY-MM-DD'.
  pauseActive?: string; pauseStart?: string; pauseEnd?: string; pauseYearly?: string;
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
  initial, mode = "order", rows: controlledRows, setRows: controlledSetRows,
}: {
  initial?: TaskRow[];
  mode?: "order" | "subscription";
  /** Valgfri kontrolleret tilstand: giver forælderen ejerskab over rækkerne, så
   *  fx PauseSection kan dele samme state. Udelades de, styrer editoren selv
   *  (som hidtil — OrderCreateForm/FixedPriceForm er uændrede). */
  rows?: TaskRow[];
  setRows?: React.Dispatch<React.SetStateAction<TaskRow[]>>;
}) {
  const sub = mode === "subscription";
  const [ownRows, setOwnRows] = useState<TaskRow[]>(initial?.length ? initial : [blank()]);
  const rows = controlledRows ?? ownRows;
  const setRows = controlledSetRows ?? setOwnRows;
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
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Opgavebeskrivelse</th>
              <th style={{ width: 170 }}>Kategori</th>
              <th style={{ width: 140 }}>Pris (inkl. moms)</th>
              <th style={{ width: 120 }}>Varighed (min.)</th>
              {sub && <th style={{ width: 190 }}>Interval</th>}
              {sub && <th style={{ width: 110 }}>Næste gang</th>}
              <th style={{ width: 40 }} />
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                <td>
                  <input
                    name="taskDescription" value={r.description}
                    onChange={(e) => update(i, { description: e.target.value })}
                    className="form-control form-control-sm" placeholder="Fremsøg eller opret ny opgave"
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
                  {timepris(r) > 0 && <small className="form-text field-help">Timepris {timepris(r)} kr/t</small>}
                </td>
                <td>
                  <span className="catchip" style={{ background: categoryColor(r.category), marginRight: 6 }}>
                    {(r.category[0] ?? "A").toUpperCase()}
                  </span>
                  <select
                    name="taskCategory" value={r.category}
                    onChange={(e) => update(i, { category: e.target.value })}
                    className="form-control form-control-sm" style={{ display: "inline-block", width: "auto" }}
                  >
                    {CAT_NAMES.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </td>
                <td>
                  <input name="taskPrice" type="number" min="0" value={r.price}
                    onChange={(e) => update(i, { price: e.target.value })} className="form-control form-control-sm num" />
                </td>
                <td>
                  <input name="taskDuration" type="number" min="0" value={r.duration}
                    onChange={(e) => update(i, { duration: e.target.value })} className="form-control form-control-sm num" />
                </td>
                {sub && (
                  <td>
                    <select name="taskInterval" value={r.interval ?? "Hver gang"}
                      onChange={(e) => update(i, { interval: e.target.value })} className="form-control form-control-sm">
                      {intervalOptions(r).map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </td>
                )}
                {sub && (
                  <td>
                    <input name="taskNextWeek" value={r.nextWeek ?? ""} placeholder="Uge 29"
                      onChange={(e) => update(i, { nextWeek: e.target.value })} className="form-control form-control-sm" />
                  </td>
                )}
                <td>
                  <button type="button" onClick={() => remove(i)} className="btn btn-light btn-sm" title="Fjern opgave">
                    <i className="bi bi-trash" />
                  </button>
                </td>
              </tr>
            ))}
            <tr>
              <td style={{ textAlign: "right", fontWeight: 600 }}>Sum</td>
              <td />
              <td className="num" style={{ fontWeight: 600 }}>{sum.toLocaleString("da-DK")} kr</td>
              <td className="num" style={{ fontWeight: 600 }}>{dur}</td>
              {sub && <td />}
              {sub && <td />}
              <td />
            </tr>
          </tbody>
        </table>
      </div>
      <button type="button" onClick={add} className="btn btn-outline-primary btn-sm" style={{ marginTop: 8 }}>
        Tilføj opgave
      </button>
    </div>
  );
}
