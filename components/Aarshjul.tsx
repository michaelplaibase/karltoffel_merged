// Årshjul-oversigt (Thomas, 2026-09-11): viser ALLE opgavernes besøg over
// året pr. uge, bygget med bygAarshjul(lib/tilbud.mts). Ren præsentations-
// komponent (ingen "use client", ingen server-APIs) — bruges i TilbudForm
// (live forhåndsvisning), på detaljesiden, på accept-siden /t/{token} og som
// forbillede for PDF-afsnittet i lib/tilbud-doc.mts.
// Karltoffel-brand: creme baggrund #FFFFF0, mørkbrun #4C3718 tekst, gul
// #FFF87B accent (jf. PDF'ens MOS/JORDNAER/FRITURE).
import type { AarshjulUge } from "@/lib/tilbud.mts";

const CHIPS = "#8A6931";

export default function Aarshjul({ uger, overskrift }: { uger: AarshjulUge[]; overskrift?: string }) {
  if (!uger.length) return null;
  const naesteAar = uger.some((u) => u.opgaver.some((o) => o.naesteAar));
  return (
    <div style={{ background: "#FFFFF0", border: "1px solid #e8e0c8", borderRadius: 8, padding: "12px 14px", marginTop: 12 }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", flexWrap: "wrap", gap: 6 }}>
        <b style={{ color: "#4C3718" }}>{overskrift ?? "Årshjul — årets besøg pr. uge"}</b>
        <span style={{ fontSize: 12, color: CHIPS }}>
          {uger.reduce((n, u) => n + u.opgaver.length, 0)} besøg over 12 måneder
        </span>
      </div>
      <div style={{ marginTop: 8, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 6 }}>
        {uger.map((u) => (
          <div key={u.uge} style={{ background: "#FFF87B", borderRadius: 6, padding: "6px 8px" }}>
            <div style={{ fontWeight: 700, fontSize: 13, color: "#4C3718" }}>Uge {u.uge}</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 3 }}>
              {u.opgaver.map((o, i) => (
                <span
                  key={i}
                  title={o.titel}
                  style={{ background: "#4C3718", color: "#FFF87B", borderRadius: 4, padding: "1px 6px", fontSize: 12, fontWeight: 600 }}
                >
                  {o.kort}
                  {o.naesteAar ? "→" : ""}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>
      <div style={{ fontSize: 12, color: CHIPS, marginTop: 8 }}>
        Bogstaverne er opgavernes initialer (hold musen/tryk for titlen).
        {naesteAar ? " Pilen (→) markerer besøg, der falder i det følgende år (ugerne ruller over 52)." : null}
      </div>
    </div>
  );
}
