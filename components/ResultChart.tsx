"use client";

// Resultat-graf (Thomas, 2026-09-03): søjler for omsætning og omkostninger pr.
// måned + resultatlinje, så man kan se om det kører op eller ned. Ren SVG —
// intet chart-bibliotek, ingen data bag login ud af CRM'et.
import { useState } from "react";

type Row = { label: string; revenue: number; cost: number; result: number };

const kr = (n: number) => Math.round(n).toLocaleString("da-DK") + " kr";

export default function ResultChart({ data }: { data: Row[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 860, H = 260, PAD_L = 56, PAD_B = 24, PAD_T = 14;
  const innerW = W - PAD_L - 8, innerH = H - PAD_B - PAD_T;
  const max = Math.max(1, ...data.map((d) => Math.max(d.revenue, d.cost)));
  const bw = innerW / data.length;
  const y = (v: number) => PAD_T + innerH - (v / max) * innerH;

  const gridVals = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const hasData = data.some((d) => d.revenue > 0 || d.cost > 0);

  return (
    <div style={{ overflowX: "auto" }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", minWidth: 640, height: "auto" }} role="img" aria-label="Omsætning, omkostninger og resultat pr. måned">
        {gridVals.map((v, i) => (
          <g key={i}>
            <line x1={PAD_L} x2={W - 8} y1={y(v)} y2={y(v)} stroke="var(--light, #eee)" strokeWidth={1} />
            <text x={PAD_L - 6} y={y(v) + 4} textAnchor="end" fontSize={10} fill="var(--muted, #888)">{kr(v)}</text>
          </g>
        ))}
        {data.map((d, i) => {
          const x0 = PAD_L + i * bw;
          const c1 = x0 + bw * 0.18, c2 = x0 + bw * 0.52;
          const w = bw * 0.3;
          const active = hover === i;
          return (
            <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
              <rect x={x0} y={PAD_T} width={bw} height={innerH} fill={active ? "rgba(0,0,0,0.04)" : "transparent"} />
              <rect x={c1} y={y(d.revenue)} width={w} height={Math.max(1, innerH + PAD_T - y(d.revenue))} rx={3} fill="#AE8642" />
              <rect x={c2} y={y(d.cost)} width={w} height={Math.max(1, innerH + PAD_T - y(d.cost))} rx={3} fill="#1C140B" />
              {d.result !== 0 && (
                <circle cx={(c1 + c2) / 2 + w / 2} cy={y(Math.max(0, d.result))} r={active ? 5 : 3.5}
                  fill={d.result >= 0 ? "#616711" : "#C4183C"} />
              )}
              <text x={x0 + bw / 2} y={H - 8} textAnchor="middle" fontSize={10} fill={active ? "var(--heading, #1C140B)" : "var(--muted, #888)"}>{d.label}</text>
            </g>
          );
        })}
      </svg>
      <div style={{ display: "flex", gap: 18, fontSize: 12.5, color: "var(--muted, #888)", marginTop: 4, flexWrap: "wrap" }}>
        <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#AE8642", borderRadius: 2, marginRight: 6 }} />Omsætning (ekskl. moms)</span>
        <span><span style={{ display: "inline-block", width: 10, height: 10, background: "#1C140B", borderRadius: 2, marginRight: 6 }} />Omkostninger</span>
        <span><span style={{ display: "inline-block", width: 8, height: 8, background: "#616711", borderRadius: 99, marginRight: 6 }} />Resultat (rød = minus)</span>
        {!hasData && <span style={{ fontStyle: "italic" }}>Ingen udførte ordrer i år endnu.</span>}
      </div>
      {hover != null && (
        <div style={{ marginTop: 8, fontSize: 13, fontWeight: 600 }}>
          {data[hover].label}: omsætning {kr(data[hover].revenue)} · omkostninger {kr(data[hover].cost)} · resultat{" "}
          <span style={{ color: data[hover].result >= 0 ? "var(--success, #2e7d32)" : "var(--danger, #C4183C)" }}>{kr(data[hover].result)}</span>
        </div>
      )}
    </div>
  );
}
