"use client";

// Makes the config-driven settings "buttons" fields do something real. Behaviour
// is chosen from the button label: copy-to-clipboard (Kopier…), open a link
// (Følg…/Åbn … side), navigate (Gå til indstilling), or a stubbed confirmation
// toast for external integrations (Dinero, file upload) — every button responds.
import { useState } from "react";

const ONLINE_BOOKING_URL = "https://www.fenster.dk/krltfl";

function actionFor(label: string): { toast?: string; open?: string; navigate?: string; copy?: string } {
  const l = label.toLowerCase();
  if (l.startsWith("kopier")) return { copy: l.includes("adresse") ? ONLINE_BOOKING_URL : label, toast: "Kopieret til udklipsholderen." };
  if (l.startsWith("følg") || l.includes("side")) return { open: l.includes("konto") ? "/account" : ONLINE_BOOKING_URL };
  if (l.startsWith("gå til indstilling")) return { navigate: "/working-hours" };
  if (l.includes("genopfrisk")) return { toast: "Forbindelsen til Dinero er genopfrisket (simuleret)." };
  if (l.includes("fjern forbindelsen")) return { toast: "Forbindelsen til Dinero er afbrudt (simuleret)." };
  if (l.includes("vælg fil")) return { toast: "Filupload er ikke tilgængelig i denne interne klon." };
  if (l.includes("se resultat")) return { toast: "Forhåndsvisning åbnes (simuleret)." };
  return { toast: "Handling udført (simuleret)." };
}

export default function SettingsButtons({ btns }: { btns: [string, string][] }) {
  const [toast, setToast] = useState<string | null>(null);

  const onClick = async (label: string) => {
    const a = actionFor(label);
    if (a.navigate) { window.location.href = a.navigate; return; }
    if (a.open) { window.open(a.open, "_blank", "noopener,noreferrer"); return; }
    if (a.copy) { try { await navigator.clipboard.writeText(a.copy); } catch { /* clipboard may be blocked */ } }
    if (a.toast) { setToast(a.toast); setTimeout(() => setToast(null), 3000); }
  };

  return (
    <>
      <div className="row-actions">
        {btns.map(([txt, v], i) => (
          <button key={i} className={`btn btn-${v} btn-sm`} type="button" onClick={() => onClick(txt)}>{txt}</button>
        ))}
      </div>
      {toast && (
        <div onClick={() => setToast(null)} style={{ position: "fixed", bottom: 24, left: "50%", transform: "translateX(-50%)", background: "#212529", color: "#fff", padding: "10px 18px", borderRadius: 6, fontSize: 14, zIndex: 4000, boxShadow: "0 6px 24px rgba(0,0,0,.3)", cursor: "pointer" }}>{toast}</div>
      )}
    </>
  );
}
