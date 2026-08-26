"use client";

// Frustrationsknap — flydende uro-ikon synligt på alle sider (monteret i
// Shell.tsx). Åbner en modal: kort fejlbeskrivelse + valgfrit screenshot
// (filvalg — dækker "tag et skærmbillede og vedhæft det" på både mobil og
// desktop, uden at kræve Screen Capture API-adgang). Sendes til Michaels
// indbakke via app/actions/frustration.ts.
//
// Screenshots nedskaleres/komprimeres client-side til under ~900 KB, fordi
// server actions' requests er begrænset til 1 MB i denne Next-version — et
// råt telefon-screenshot (1–4 MB) ville ellers dø i frameworket, før den
// venlige fejlbesked overhovedet kunne vises.
import { useActionState, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { submitFrustrationReport, type FrustrationReportState } from "@/app/actions/frustration";

// Skal matche MAX_SCREENSHOT_BYTES i app/actions/frustration.ts.
const MAX_SCREENSHOT_BYTES = 900 * 1024;

/** Nedskaler/komprimer et billede til under grænsen via canvas. Billeder, der
 *  allerede er små nok, returneres urørt. null = kunne ikke komme under
 *  grænsen (eller filen er ikke et billede) — så vises en fejl FØR submit. */
async function downscaleScreenshot(file: File): Promise<File | null> {
  if (file.size <= MAX_SCREENSHOT_BYTES) return file;
  try {
    const bmp = await createImageBitmap(file);
    // Prøv faldende opløsning og JPEG-kvalitet, til vi er under grænsen.
    for (const maxDim of [1600, 1280, 1000, 800]) {
      const scale = Math.min(1, maxDim / Math.max(bmp.width, bmp.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(bmp.width * scale));
      canvas.height = Math.max(1, Math.round(bmp.height * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) return null;
      ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height);
      for (const quality of [0.8, 0.65, 0.5]) {
        const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", quality));
        if (blob && blob.size <= MAX_SCREENSHOT_BYTES) {
          return new File([blob], "screenshot.jpg", { type: "image/jpeg" });
        }
      }
    }
  } catch {
    // Ikke et billede, eller canvas fejlede — fald igennem til null.
  }
  return null;
}

/** Selve modalen. Monteres KUN mens den er åben — så nulstilles action-state,
 *  preview og filvalg automatisk ved luk, og knappen kan bruges igen og igen
 *  pr. sideindlæsning (state.sent hang ellers fast, fordi Shell-instansen
 *  overlever alle client-navigationer). */
function ReportModal({ pathname, onClose }: { pathname: string; onClose: () => void }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [shot, setShot] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [state, formAction, pending] = useActionState<FrustrationReportState, FormData>(submitFrustrationReport, {});

  const onFileChange = async (f: File | undefined) => {
    setPreview(null);
    setShot(null);
    setFileError(null);
    if (!f) return;
    setProcessing(true);
    const scaled = await downscaleScreenshot(f);
    setProcessing(false);
    if (!scaled) {
      // Venlig fejl FØR indsendelse — beskrivelsen står urørt i formularen.
      setFileError("Billedet kan ikke komprimeres til under ca. 900 KB — vælg et mindre billede, eller fjern det og send uden screenshot.");
      return;
    }
    setShot(scaled);
    setPreview(URL.createObjectURL(scaled));
  };

  return (
    <div
      role="dialog" aria-label="Meld en fejl"
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.4)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 4000, padding: 16 }}
      onClick={() => !pending && onClose()}
    >
      <div className="card" style={{ maxWidth: 460, width: "100%" }} onClick={(e) => e.stopPropagation()}>
        <div className="card-header"><h4 className="section-title" style={{ margin: 0 }}>Meld en fejl / frustration</h4></div>
        <div className="card-body tight">
          {state.sent ? (
            <>
              <p style={{ margin: "0 0 12px" }}>Tak! Rapporten er sendt.</p>
              <div className="row-actions" style={{ justifyContent: "flex-end" }}>
                <button type="button" className="btn btn-primary" onClick={onClose}>Luk</button>
              </div>
            </>
          ) : (
            <form
              action={(fd) => {
                if (fileError) return; // bæltet til seleerne: submit-knappen er også disabled
                // Erstat det rå filvalg med den komprimerede udgave.
                if (shot) fd.set("screenshot", shot);
                else fd.delete("screenshot");
                formAction(fd);
              }}
            >
              <input type="hidden" name="page" value={pathname} />
              <label className="field-label">Hvad gik skævt?</label>
              <textarea name="message" required rows={4} className="form-control form-control-sm" placeholder="Beskriv kort, hvad du oplevede…" />

              <label className="field-label" style={{ marginTop: 12 }}>Screenshot (valgfrit)</label>
              <input
                ref={fileRef} type="file" name="screenshot" accept="image/*"
                className="form-control form-control-sm"
                onChange={(e) => onFileChange(e.target.files?.[0])}
              />
              {processing && <div className="help-note" style={{ marginTop: 8 }}>Komprimerer billedet…</div>}
              {preview && (
                // eslint-disable-next-line @next/next/no-img-element -- lokal blob-URL-preview; next/image kan ikke optimere den
                <img src={preview} alt="Forhåndsvisning af screenshot" style={{ marginTop: 8, maxWidth: "100%", maxHeight: 160, borderRadius: 6, border: "1px solid var(--card-border)" }} />
              )}

              {fileError && <div style={{ color: "#c0392b", fontSize: 13, marginTop: 10 }}>{fileError}</div>}
              {state.error && <div style={{ color: "#c0392b", fontSize: 13, marginTop: 10 }}>{state.error}</div>}

              <div className="row-actions" style={{ justifyContent: "flex-end", marginTop: 16 }}>
                <button type="button" className="btn btn-light" disabled={pending} onClick={onClose}>Annuller</button>
                <button type="submit" className="btn btn-primary" disabled={pending || processing || fileError != null}>{pending ? "Sender…" : "Send rapport"}</button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export default function FrustrationButton() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

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

      {open && <ReportModal pathname={pathname} onClose={() => setOpen(false)} />}
    </>
  );
}
