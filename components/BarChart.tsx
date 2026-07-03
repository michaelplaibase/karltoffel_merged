// Self-contained SVG grouped-bar chart (the portal uses Plotly-style SVG charts).
// Server-rendered, no dependency — takes monthly series data and draws axes,
// gridlines, grouped bars and a legend. Replaces the old fixed-height CSS bars.
import type { ChartData } from "@/lib/reports-data";

const W = 720, H = 280;
const PAD = { top: 14, right: 14, bottom: 30, left: 56 };
const plotW = W - PAD.left - PAD.right;
const plotH = H - PAD.top - PAD.bottom;

/** Round a max up to a clean axis bound (1/2/5 × 10^n). */
function niceMax(v: number): number {
  if (v <= 0) return 1;
  const pow = Math.pow(10, Math.floor(Math.log10(v)));
  const n = v / pow;
  const step = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return step * pow;
}

export default function BarChart({ chart }: { chart: ChartData }) {
  const { labels, series } = chart;
  const groups = labels.length;
  const max = niceMax(Math.max(1, ...series.flatMap((s) => s.values)));
  const groupW = plotW / groups;
  const innerPad = groupW * 0.18;
  const barsW = groupW - innerPad * 2;
  const barW = barsW / series.length;

  const y = (val: number) => PAD.top + plotH - (val / max) * plotH;
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => Math.round(max * f));

  return (
    <div className="chartcard">
      <h3>{chart.title}</h3>
      <div className="chart-toggles">
        <span className="seg"><span className="on">Måned</span><span>Uge</span></span>
        <span className="seg"><span className="on">Søjle</span><span>Linje</span></span>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label={chart.title} style={{ display: "block" }}>
        {/* gridlines + y labels */}
        {ticks.map((t, i) => (
          <g key={i}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} stroke="#e9edf2" />
            <text x={PAD.left - 8} y={y(t) + 4} textAnchor="end" fontSize="11" fill="#8a97a6">
              {t.toLocaleString("da-DK")}
            </text>
          </g>
        ))}
        {/* axis */}
        <line x1={PAD.left} x2={PAD.left} y1={PAD.top} y2={PAD.top + plotH} stroke="#c9d3dd" />
        <line x1={PAD.left} x2={W - PAD.right} y1={PAD.top + plotH} y2={PAD.top + plotH} stroke="#c9d3dd" />

        {/* bars */}
        {labels.map((lab, gi) => {
          const gx = PAD.left + gi * groupW + innerPad;
          return (
            <g key={gi}>
              {series.map((s, si) => {
                const v = s.values[gi] ?? 0;
                const h = (v / max) * plotH;
                return (
                  <rect key={si} x={gx + si * barW + 1} y={PAD.top + plotH - h}
                    width={Math.max(barW - 2, 1)} height={h} fill={s.color} rx="1">
                    <title>{`${s.name} · ${lab}: ${v.toLocaleString("da-DK")}`}</title>
                  </rect>
                );
              })}
              <text x={PAD.left + gi * groupW + groupW / 2} y={H - 10} textAnchor="middle" fontSize="11" fill="#8a97a6">
                {lab}
              </text>
            </g>
          );
        })}
      </svg>

      <div className="axis-label">{chart.yLabel} · pr. måned</div>
      <div className="series-legend">
        {series.map((s, i) => (
          <span key={i}><span className="dot2" style={{ background: s.color }} />{s.name}</span>
        ))}
      </div>
    </div>
  );
}
