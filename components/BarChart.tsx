"use client";

// Self-contained SVG chart (the portal uses Plotly-style SVG charts). Client
// component so the Måned/Uge (monthly vs weekly series) and Søjle/Linje (grouped
// bars vs line) toggles work. No dependency — draws axes, gridlines and marks.
import { useState, type ReactNode } from "react";
import type { ChartData } from "@/lib/reports-data";

/** Tastaturbetjenbar segment-knap (Måned/Uge, Søjle/Linje, Sidste 12 mdr/ÅTD):
 *  en rigtig <button> med aria-pressed, så Tab + Enter/Space og skærmlæser-
 *  semantik følger med — rene <span onClick> kan aldrig fokuseres. Stylet
 *  inline, da .seg-CSS'en kun rammer spans. Deles med KpiSection. */
export function SegButton({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      className={on ? "on" : ""}
      aria-pressed={on}
      onClick={onClick}
      style={{
        font: "inherit", padding: "4px 11px", cursor: "pointer",
        border: 0, borderLeft: "1px solid var(--card-border)", marginLeft: -1,
        background: on ? "var(--primary)" : "#fff", color: on ? "#fff" : "var(--muted)",
      }}
    >
      {children}
    </button>
  );
}

const W = 720, H = 280;
const PAD = { top: 14, right: 14, bottom: 30, left: 56 };
const plotW = W - PAD.left - PAD.right;
const plotH = H - PAD.top - PAD.bottom;

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

export default function BarChart({ chart }: { chart: ChartData }) {
  const [gran, setGran] = useState<"month" | "week">("month");
  const [mode, setMode] = useState<"bar" | "line">("bar");
  const labels = gran === "month" ? chart.labels : chart.weekLabels;
  const series = gran === "month" ? chart.series : chart.weekSeries;

  const groups = labels.length;
  const max = niceMax(Math.max(1, ...series.flatMap((s) => s.values)));
  const groupW = plotW / groups;
  const innerPad = groupW * 0.18;
  const barsW = groupW - innerPad * 2;
  const barW = barsW / series.length;

  const y = (val: number) => PAD.top + plotH - (val / max) * plotH;
  const cx = (gi: number) => PAD.left + gi * groupW + groupW / 2;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f));

  return (
    <div className="chartcard">
      <h3>{chart.title}</h3>
      <div className="chart-toggles">
        <span className="seg">
          <SegButton on={gran === "month"} onClick={() => setGran("month")}>Måned</SegButton>
          <SegButton on={gran === "week"} onClick={() => setGran("week")}>Uge</SegButton>
        </span>
        <span className="seg">
          <SegButton on={mode === "bar"} onClick={() => setMode("bar")}>Søjle</SegButton>
          <SegButton on={mode === "line"} onClick={() => setMode("line")}>Linje</SegButton>
        </span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={chart.title} style={{ display: "block" }}>
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="#e9edf2" />
            <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#8a97a6">{t.toLocaleString("da-DK")}</text>
          </g>
        ))}
        <line x1={PAD.left} x2={PAD.left} y1={PAD.top} y2={PAD.top + plotH} stroke="#c9d3dd" />
        <line x1={PAD.left} x2={W - PAD.right} y1={PAD.top + plotH} y2={PAD.top + plotH} stroke="#c9d3dd" />

        {mode === "bar"
          ? labels.map((lab, gi) => {
              const gx = PAD.left + gi * groupW + innerPad;
              return (
                <g key={gi}>
                  {series.map((s, si) => {
                    const v = s.values[gi] ?? 0;
                    const h = (v / max) * plotH;
                    return (
                      <rect key={si} x={gx + si * barW + 1} y={PAD.top + plotH - h} width={Math.max(barW - 2, 1)} height={h} fill={s.color} rx="1">
                        <title>{`${s.name} · ${lab}: ${v.toLocaleString("da-DK")}`}</title>
                      </rect>
                    );
                  })}
                </g>
              );
            })
          : series.map((s, si) => (
              <g key={si}>
                <polyline fill="none" stroke={s.color} strokeWidth="2" points={s.values.map((v, gi) => `${cx(gi)},${y(v)}`).join(" ")} />
                {s.values.map((v, gi) => (
                  <circle key={gi} cx={cx(gi)} cy={y(v)} r="2.5" fill={s.color}><title>{`${s.name} · ${labels[gi]}: ${v.toLocaleString("da-DK")}`}</title></circle>
                ))}
              </g>
            ))}

        {labels.map((lab, gi) => (
          <text key={gi} x={cx(gi)} y={H - 10} textAnchor="middle" fontSize="11" fill="#8a97a6">{lab}</text>
        ))}
      </svg>

      <div className="axis-label">{chart.yLabel} · pr. {gran === "month" ? "måned" : "uge"}</div>
      <div className="series-legend">
        {series.map((s, i) => (
          <span key={i}><span className="dot2" style={{ background: s.color }} />{s.name}</span>
        ))}
      </div>
    </div>
  );
}
