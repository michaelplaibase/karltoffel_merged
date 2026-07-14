"use client";

// "Måneder på pause" — sæsonpause per opgave på et abonnement. Deler række-
// state med TaskLineEditor (løftet op i SubscriptionForm), så pausefelterne
// submittes via editorens skjulte inputs og round-tripper gennem server-
// action'ens formData.getAll-zip. Vinduet må krydse nytår (fx 31/10 → 30/03);
// månedsstriben viser wrap-bevidst hvilke måneder der er omfattet.
import { useState } from "react";
import type { TaskRow } from "@/components/TaskLineEditor";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Maj", "Jun", "Jul", "Aug", "Sep", "Okt", "Nov", "Dec"];

/** Måned (1-12) af en ISO-dato 'YYYY-MM-DD'; null hvis formen ikke passer. */
function monthOf(iso?: string): number | null {
  const m = iso?.match(/^\d{4}-(\d{2})-\d{2}$/);
  return m ? Number(m[1]) : null;
}

/** Er måned m (1-12) i pausevinduet? Wrap-bevidst: okt→mar dækker 10,11,12,1,2,3. */
function monthInWindow(m: number, start?: string, end?: string): boolean {
  const s = monthOf(start), e = monthOf(end);
  if (s == null || e == null) return false;
  return s <= e ? m >= s && m <= e : m >= s || m <= e;
}

export default function PauseSection({
  rows, setRows,
}: {
  rows: TaskRow[];
  setRows: React.Dispatch<React.SetStateAction<TaskRow[]>>;
}) {
  const [active, setActive] = useState(rows.some((r) => r.pauseActive === "1"));
  const [open, setOpen] = useState<Record<number, boolean>>({});

  const update = (i: number, patch: Partial<TaskRow>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const toggleSection = (on: boolean) => {
    setActive(on);
    // Slås sektionen fra, skal ingen opgaver forblive pauset i det skjulte —
    // datoerne bevares, så et gen-tilvalg husker vinduet.
    if (!on) setRows((rs) => rs.map((r) => (r.pauseActive === "1" ? { ...r, pauseActive: "0" } : r)));
  };

  const togglePause = (i: number, r: TaskRow, on: boolean) => {
    if (on && (!r.pauseStart || !r.pauseEnd)) {
      // Standardvindue: 31/10 i år → 30/03 næste år (vinterpause over nytår).
      const y = new Date().getFullYear();
      update(i, { pauseActive: "1", pauseStart: r.pauseStart || `${y}-10-31`, pauseEnd: r.pauseEnd || `${y + 1}-03-30`, pauseYearly: r.pauseYearly || "1" });
    } else {
      update(i, { pauseActive: on ? "1" : "0" });
    }
    if (on) setOpen((o) => ({ ...o, [i]: true }));
  };

  const services = rows.map((r, i) => ({ r, i })).filter(({ r }) => r.description.trim());

  return (
    <div className="card">
      <div className="card-header"><h4 className="section-title">Måneder på pause</h4></div>
      <div className="card-body tight">
        <label className="form-check-inline" style={{ marginRight: 0 }}>
          <input type="checkbox" checked={active} onChange={(e) => toggleSection(e.target.checked)} />
          Aktivér måneder på pause
        </label>
        {!active && (
          <small className="form-text field-help">
            Sæt enkelte opgaver på pause i en sæson (fx vinter) — der oprettes ingen ordrer for dem i vinduet.
          </small>
        )}
        {active && !services.length && (
          <small className="form-text field-help">Tilføj først opgaver på abonnementet ovenfor.</small>
        )}
        {active && services.map(({ r, i }) => {
          const paused = r.pauseActive === "1";
          const isOpen = !!open[i];
          return (
            <div key={i} className="pauserow">
              <div className="pauserow-head">
                <span className="pauserow-name">{r.description}</span>
                <label className="form-check-inline" style={{ marginRight: 0 }}>
                  <input type="checkbox" checked={paused} onChange={(e) => togglePause(i, r, e.target.checked)} />
                  Sæt på pause
                </label>
                <button
                  type="button" className="btn btn-light btn-sm" disabled={!paused}
                  onClick={() => setOpen((o) => ({ ...o, [i]: !o[i] }))}
                  title={isOpen ? "Skjul pausevindue" : "Vis pausevindue"}
                >
                  <i className={`bi bi-chevron-${isOpen ? "up" : "down"}`} />
                </button>
              </div>
              {paused && isOpen && (
                <div className="pauserow-body">
                  <div className="pausestrip" aria-label="Måneder i pausevinduet">
                    {MONTHS.map((name, mIdx) => (
                      <span key={name} className={`m${monthInWindow(mIdx + 1, r.pauseStart, r.pauseEnd) ? " on" : ""}`}>
                        {name}
                      </span>
                    ))}
                  </div>
                  <div className="grid-2" style={{ gap: 12, marginTop: 10 }}>
                    <div>
                      <label className="field-label">Start</label>
                      <input
                        type="date" value={r.pauseStart || ""} className="form-control form-control-sm"
                        onChange={(e) => update(i, { pauseStart: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className="field-label">Slut</label>
                      <input
                        type="date" value={r.pauseEnd || ""} className="form-control form-control-sm"
                        onChange={(e) => update(i, { pauseEnd: e.target.value })}
                      />
                    </div>
                  </div>
                  <div style={{ marginTop: 10 }}>
                    <label className="form-check-inline">
                      <input
                        type="radio" name={`pauseYearlyChoice-${i}`} checked={r.pauseYearly !== "0"}
                        onChange={() => update(i, { pauseYearly: "1" })}
                      />
                      Hvert år
                    </label>
                    <label className="form-check-inline">
                      <input
                        type="radio" name={`pauseYearlyChoice-${i}`} checked={r.pauseYearly === "0"}
                        onChange={() => update(i, { pauseYearly: "0" })}
                      />
                      Kun denne sæson
                    </label>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
