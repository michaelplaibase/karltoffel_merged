// Årshjul-oversigt (Thomas, 2026-09-11): viser ALLE opgavernes besøg over
// året pr. uge, bygget med bygAarshjul(lib/tilbud.mts). Ren præsentations-
// komponent (ingen "use client", ingen server-APIs) — bruges i TilbudForm
// (live forhåndsvisning), på detaljesiden, på accept-siden /t/{token} og som
// forbillede for PDF-afsnittet i lib/tilbud-doc.mts.
// Karltoffel-brand: creme baggrund #FFFFF0, mørkbrun #4C3718 tekst, gul
// #FFF87B accent (jf. PDF'ens MOS/JORDNAER/FRITURE).
import type { AarshjulUge } from "@/lib/tilbud.mts";
import { LINJE_FARVE_TEKST } from "@/lib/tilbud.mts";

const CHIPS = "#8A6931";

export default function Aarshjul({ uger, overskrift }: { uger: AarshjulUge[]; overskrift?: string }) {
  if (!uger.length) return null;
  const naesteAar = uger.some((u) => u.opgaver.some((o) => o.naesteAar));
  // Legend (Thomas, 2026-09-15): unikke (titel, farve)-par i første
  // forekomst-rækkefølge — vises kun når der er flere opgaver.
  const legende: { titel: string; farve: string }[] = [];
  for (const u of uger) for (const o of u.opgaver) {
    if (!o.farve) continue;
    if (!legende.some((l) => l.titel === o.titel && l.farve === o.farve)) legende.push({ titel: o.titel, farve: o.farve });
  }
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
                  style={{ background: o.farve ?? "#4C3718", color: o.farve ? LINJE_FARVE_TEKST : "#FFF87B", borderRadius: 4, padding: "1px 6px", fontSize: 12, fontWeight: 600, border: o.farve ? "1px solid rgba(76, 55, 24, 0.25)" : undefined }}
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
      {legende.length > 1 ? (
        <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: "6px 12px", alignItems: "center" }}>
          {legende.map((l) => (
            <span key={l.titel + l.farve} style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12, color: "#4C3718" }}>
              <span style={{ width: 10, height: 10, borderRadius: 3, background: l.farve, border: "1px solid rgba(76, 55, 24, 0.25)", display: "inline-block" }} />
              {l.titel}
            </span>
          ))}
        </div>
      ) : null}
    </div>
  );
}
