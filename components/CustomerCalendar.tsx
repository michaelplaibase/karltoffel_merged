"use client";
// Aftalekalender pr. kunde (Thomas, 2026-09-10): års-overblik med farvekodede
// datoer for kundens planlagte opgaver — moderne udgave af det gamle system.
// Read-only, ingen skrivning. Klik på en dato viser opgaverne for den dag.
import Link from "next/link";
import { useMemo, useState } from "react";
import { CLOSED_STATUSES } from "@/lib/invoice-status";

export type CalDay = {
  date: string; // yyyy-mm-dd
  orderIds: number[];
  status: string;
  tasks: string[]; // "Kategori · beskrivelse"
  employee: string;
};

const MONTHS = ["januar", "februar", "marts", "april", "maj", "juni", "juli", "august", "september", "oktober", "november", "december"];
const WEEKDAYS = ["man", "tir", "ons", "tor", "fre", "lør", "søn"];

function pad(n: number) { return String(n).padStart(2, "0"); }

/** Mandag-ugenummer (ISO 8601) for en UTC-dato — ren beregning, ingen lib-afhængighed. */
function isoWeekNumber(y: number, m0: number, d: number) {
  const t = new Date(Date.UTC(y, m0, d));
  const day = (t.getUTCDay() + 6) % 7;
  t.setUTCDate(t.getUTCDate() - day + 3); // skift til ugens torsdag
  const firstThursday = new Date(Date.UTC(t.getUTCFullYear(), 0, 4));
  const fday = (firstThursday.getUTCDay() + 6) % 7;
  firstThursday.setUTCDate(firstThursday.getUTCDate() - fday + 3);
  return 1 + Math.round((t.getTime() - firstThursday.getTime()) / (7 * 864e5));
}

/** Farve for en dag — moderne, rolig udgave af det gamle farvesystem. */
function dayColor(days: CalDay[] | undefined) {
  if (!days || days.length === 0) return null;
  const st = days[0].status;
  if (st === "Sprunget over") return "#FDE1E1"; // annulleret
  if (st === "Udført" || st === "Afsluttet") return "#DDF3E5"; // færdigmeldt
  return "#FFF0B3"; // planlagt
}

export default function CustomerCalendar({ days, contactName }: { days: CalDay[]; contactName: string }) {
  const byDate = useMemo(() => {
    const m = new Map<string, CalDay[]>();
    for (const d of days) {
      const arr = m.get(d.date) || [];
      arr.push(d);
      m.set(d.date, arr);
    }
    return m;
  }, [days]);
  const [selected, setSelected] = useState<string | null>(null);
  const sel = selected ? byDate.get(selected) : undefined;

  const dates = useMemo(() => [...byDate.keys()].sort(), [byDate]);
  const minYear = dates.length ? Number(dates[0].slice(0, 4)) : new Date().getUTCFullYear();
  const [year, setYear] = useState(minYear);

  const grids = useMemo(() => {
    const out: { month: string; weeks: (number | null)[][] }[] = [];
    for (let m0 = 0; m0 < 12; m0++) {
      const first = new Date(Date.UTC(year, m0, 1));
      const startOffset = (first.getUTCDay() + 6) % 7; // man = 0
      const dim = new Date(Date.UTC(year, m0 + 1, 0)).getUTCDate();
      const cells: (number | null)[] = Array(startOffset).fill(null);
      for (let d = 1; d <= dim; d++) cells.push(d);
      while (cells.length % 7 !== 0) cells.push(null);
      const weeks: (number | null)[][] = [];
      for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
      out.push({ month: MONTHS[m0], weeks });
    }
    return out;
  }, [year]);

  const yearDays = days.filter((d) => d.date.startsWith(String(year)));
  const legend = [
    { c: "#FFF0B3", t: "Opgave planlagt" },
    { c: "#DDF3E5", t: "Opgave færdigmeldt" },
    { c: "#FDE1E1", t: "Opgave sprunget over" },
  ];

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10, marginBottom: 14 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <button className="btn btn-light btn-sm" onClick={() => setYear(year - 1)} aria-label="Forrige år">« {year - 1}</button>
          <h4 className="section-title" style={{ margin: 0, fontSize: 20 }}>{year} — {contactName}</h4>
          <button className="btn btn-light btn-sm" onClick={() => setYear(year + 1)} aria-label="Næste år">{year + 1} »</button>
          {String(new Date().getFullYear()) !== String(year) ? (
            <button className="btn btn-outline-primary btn-sm" onClick={() => setYear(new Date().getFullYear())}>I år</button>
          ) : null}
        </div>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", fontSize: 12.5 }}>
          {legend.map((l) => (
            <span key={l.t} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <span style={{ width: 14, height: 14, borderRadius: 4, background: l.c, display: "inline-block", border: "1px solid rgba(0,0,0,.08)" }} />
              {l.t}
            </span>
          ))}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(230px, 1fr))", gap: 14 }}>
        {grids.map((g) => (
          <div key={g.month} className="cal2-month">
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 6 }}>{g.month.charAt(0).toUpperCase() + g.month.slice(1)}</div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5, tableLayout: "fixed" }}>
              <thead>
                <tr>
                  <th style={{ padding: "2px 0", color: "var(--secondary, #777)", fontWeight: 600 }}>uge</th>
                  {WEEKDAYS.map((w) => <th key={w} style={{ padding: "2px 0", color: "var(--secondary, #777)", fontWeight: 600 }}>{w}</th>)}
                </tr>
              </thead>
              <tbody>
                {g.weeks.map((week, wi) => {
                  const weekNo = isoWeekNumber(year, MONTHS.indexOf(g.month), week.find((c) => c !== null) ?? 1);
                  return (
                    <tr key={wi}>
                      <td style={{ textAlign: "right", paddingRight: 5, color: "#999", fontSize: 10 }}>{weekNo}</td>
                      {week.map((cell, ci) => {
                        if (cell === null) return <td key={ci} style={{ padding: 0, height: 22 }} />;
                        const date = `${year}-${pad(MONTHS.indexOf(g.month) + 1)}-${pad(cell)}`;
                        const ds = byDate.get(date);
                        const bg = dayColor(ds);
                        const isToday = date === new Date().toISOString().slice(0, 10);
                        return (
                          <td key={ci} style={{ padding: 1 }}>
                            <div
                              title={ds ? undefined : undefined}
                              onClick={ds ? () => setSelected(date) : undefined}
                              onKeyDown={ds ? (e) => { if (e.key === "Enter" || e.key === " ") setSelected(date); } : undefined}
                              role={ds ? "button" : undefined}
                              tabIndex={ds ? 0 : undefined}
                              style={{
                                height: 22, display: "flex", alignItems: "center", justifyContent: "center",
                                borderRadius: 6, background: bg ?? "transparent",
                                border: isToday ? "2px solid var(--primary, #2b7a3d)" : (selected === date ? "2px solid var(--primary, #2b7a3d)" : bg ? "1px solid rgba(0,0,0,.06)" : "1px solid transparent"),
                                fontWeight: ds ? 700 : 400,
                                cursor: ds ? "pointer" : "default",
                              }}
                            >
                              {cell}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      <p className="muted" style={{ fontSize: 12, marginTop: 12, marginBottom: 0 }}>
        Klik på en farvet dato i kalenderen ovenfor for at se opgaverne for den dag · {yearDays.length} planlagte datoer i {year}
      </p>

      {sel ? (
        <div style={{ marginTop: 12, border: "1px solid var(--line, #e2e0d8)", borderRadius: 10, padding: "12px 16px", background: "var(--light, #faf8f2)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <b style={{ fontSize: 14 }}>
              {new Date(`${sel[0].date}T12:00:00Z`).toLocaleDateString("da-DK", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </b>
            <button className="btn btn-light btn-sm" onClick={() => setSelected(null)}>Luk</button>
          </div>
          {sel.map((d) => (
            <div key={d.orderIds[0]} style={{ borderTop: "1px solid var(--line, #e2e0d8)", padding: "8px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap" }}>
                <div>
                  {d.tasks.map((t, i) => <div key={i} style={{ fontSize: 13.5 }}>{t}</div>)}
                  <div className="muted" style={{ fontSize: 12 }}>Medarbejder: {d.employee || "Ikke tildelt"}</div>
                </div>
                <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                  <span style={{
                    fontSize: 11, padding: "2px 8px", borderRadius: 20,
                    background: d.status === "Sprunget over" ? "#FDE1E1" : CLOSED_STATUSES.has(d.status) ? "#DDF3E5" : "#FFF0B3",
                    fontWeight: 600, whiteSpace: "nowrap",
                  }}>{d.status}</span>
                  {d.orderIds.map((oid) => (
                    <Link key={oid} href={`/calendar?week=${d.date}`} className="btn btn-outline-primary btn-sm" style={{ fontSize: 11, padding: "2px 8px" }}>
                      Vis i ugekalender
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
