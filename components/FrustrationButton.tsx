"use client";

// Frustrationsknap — flydende uro-ikon synligt på alle sider (monteret i
// Shell.tsx). Åbner en modal: kort fejlbeskrivelse + valgfrit screenshot
// (filvalg — dækker "tag et skærmbillede og vedhæft det" på både mobil og
// desktop, uden at kræve Screen Capture API-adgang). Sendes til Michaels
// indbakke via app/actions/frustration.ts.
import { useActionState, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { submitFrustrationReport, type FrustrationReportState } from "@/app/actions/frustration";

export default function FrustrationButton() {
  const [open, setOpen] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const pathname = usePathname();
  const [state, formAction, pending] = useActionState<FrustrationReportState, FormData>(submitFrustrationReport, {});

  const close = () => {
    setOpen(false);
    setPreview(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  return (
    <>
      <button
        type="button"
        title="Meld en fejl / frustration"
        aria-label="Meld en fejl / frustration"
        onClick={() => setOpen(true)}
        style={{
          position: "fixed", bottom: 22, right: 22, zIndex: 2500,
          width: 52, height: 52, borderRadius: "50%", border: "none",
          background: "#C4183C", color: "#fff", fontSize: 22, cursor: "pointer",
          boxShadow: "0 6px 20px rgba(0,0,0,.25)", display: "flex", alignItems: "center", justifyContent: "center",
        }}
      >
        <i className="bi bi-exclamation-triangle-fill" />
      </button>

      {open && (
        <div
          role="dialog" aria-label="Meld en fejl"
          style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 4000, padding: 16 }}
          onClick={() => !pending && close()}
        >
          <div className="card" style={{ maxWidth: 460, width: "100%" }} onClick={(e) => e.stopPropagation()}>
            <div className="card-header"><h4 className="section-title" style={{ margin: 0 }}>Meld en fejl / frustration</h4></div>
            <div className="card-body tight">
              {state.sent ? (
                <>
                  <p style={{ margin: "0 0 12px" }}>Tak! Rapporten er sendt.</p>
                  <div className="row-actions" style={{ justifyContent: "flex-end" }}>
                    <button type="button" className="btn btn-primary" onClick={close}>Luk</button>
                  </div>
                </>
              ) : (
                <form action={formAction}>
                  <input type="hidden" name="page" value={pathname} />
                  <label className="field-label">Hvad gik skævt?</label>
                  <textarea name="message" required rows={4} className="form-control form-control-sm" placeholder="Beskriv kort, hvad du oplevede…" />

                  <label className="field-label" style={{ marginTop: 12 }}>Screenshot (valgfrit)</label>
                  <input
                    ref={fileRef} type="file" name="screenshot" accept="image/*"
                    className="form-control form-control-sm"
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      setPreview(f ? URL.createObjectURL(f) : null);
                    }}
                  />
                  {preview && (
                    <img src={preview} alt="Forhåndsvisning af screenshot" style={{ marginTop: 8, maxWidth: "100%", maxHeight: 160, borderRadius: 6, border: "1px solid var(--card-border)" }} />
                  )}

                  {state.error && <div style={{ color: "#c0392b", fontSize: 13, marginTop: 10 }}>{state.error}</div>}

                  <div className="row-actions" style={{ justifyContent: "flex-end", marginTop: 16 }}>
                    <button type="button" className="btn btn-light" disabled={pending} onClick={close}>Annuller</button>
                    <button type="submit" className="btn btn-primary" disabled={pending}>{pending ? "Sender…" : "Send rapport"}</button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
