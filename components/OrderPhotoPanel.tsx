"use client";

// Kamera-panel for KS-fotos (Thomas 2026-09-03): tryk på foto-knappen på et
// dagsprogram-kort → <input type=file capture> åbner KAMERAET direkte på mobil/
// tablet. Billederne uploades straks til /api/photos og gemmes på ordren +
// kunden. Alle medarbejdere kan se og uploade.
import { useRef, useState } from "react";
import type { DayStop, DayUnplannedStop } from "@/lib/calendar";

type Photo = { id: number; createdAt: string; uploadedBy?: { firstName: string; lastName: string } | null };


/** Skalér billedet i browseren FØR upload: kamera-fotos er ofte 3-8 MB, hvilket
 *  overskrider Vercels request-body-grænse (~4,5 MB) og får uploaden til at fejle.
 *  Canvas-resize til maks 1600 px + JPEG 0.85 giver typisk 200-500 KB og er
 *  rigeligt til KS-dokumentation. */
async function skalerFoerUpload(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const maxSide = 1600;
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    // Konvertér ALLIGEVÉL til JPEG hvis filen er HEIC eller stor (HEIC kan ikke
    // vises i <img> og overskrider ofte body-grænsen; JPEG 0.85 er dokumentations-rigtigt):
    if (scale >= 1 && file.type !== "image/heic" && file.size < 3_500_000) return file;
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/jpeg", 0.85));
    if (!blob) return file;
    return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file; // fejl i skalering → prøv originalen alligevel
  }
}

export default function OrderPhotoPanel({ stop }: { stop: DayStop | DayUnplannedStop }) {
  const camRef = useRef<HTMLInputElement>(null);
  const galRef = useRef<HTMLInputElement>(null);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [busy, setBusy] = useState(0);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    try {
      const r = await fetch(`/api/photos?orderId=${stop.orderId}`);
      if (!r.ok) throw new Error();
      const d = await r.json();
      setPhotos(d.photos ?? []);
    } catch {
      setError("Kunne ikke hente fotos");
    }
    setLoaded(true);
  }

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    setBusy((b) => b + files.length);
    for (const f0 of Array.from(files)) {
      const f = await skalerFoerUpload(f0);
      const form = new FormData();
      form.append("file", f);
      try {
        const r = await fetch(`/api/photos?orderId=${stop.orderId}`, { method: "POST", body: form });
        const d = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(d.error ?? "Upload fejlede");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Upload fejlede");
      } finally {
        setBusy((b) => b - 1);
      }
    }
    await load();
    if (camRef.current) camRef.current.value = "";
    if (galRef.current) galRef.current.value = "";
  }

  return (
    <div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        {/* capture="environment" = åbn BAGKAMERAET direkte på mobil/tablet */}
        <input ref={camRef} type="file" accept="image/*" capture="environment" multiple hidden
          onChange={(e) => upload(e.target.files)} />
        <input ref={galRef} type="file" accept="image/*" multiple hidden
          onChange={(e) => upload(e.target.files)} />
        <button type="button" className="btn btn-outline-primary btn-sm" disabled={busy > 0}
          onClick={() => camRef.current?.click()}>
          <i className="bi bi-camera" /> {busy > 0 ? `Uploader… (${busy})` : "Tag foto"}
        </button>
        <button type="button" className="btn btn-outline-primary btn-sm" disabled={busy > 0}
          onClick={() => galRef.current?.click()}>
          <i className="bi bi-images" /> Vælg fra galleri
        </button>
        {!loaded && (
          <button type="button" className="btn btn-light btn-sm" onClick={load}>
            Vis gemte fotos ({photos.length === 0 ? "… " : ""})
          </button>
        )}
      </div>
      {error && <div style={{ color: "var(--danger, #C4183C)", fontSize: 12.5, marginTop: 6 }}>{error}</div>}
      {loaded && photos.length === 0 && (
        <div style={{ fontSize: 12.5, color: "var(--muted)", marginTop: 6 }}>Ingen KS-fotos på ordren endnu.</div>
      )}
      {photos.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 8 }}>
          {photos.map((p) => (
            <a key={p.id} href={`/api/photos/file?id=${p.id}`} target="_blank" rel="noopener noreferrer"
              title={`KS-foto${p.uploadedBy ? ` · ${p.uploadedBy.firstName} ${p.uploadedBy.lastName}` : ""}`}
              style={{ display: "block" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/api/photos/file?id=${p.id}`} alt="KS-foto"
                style={{ width: 88, height: 88, objectFit: "cover", borderRadius: 6, border: "1px solid var(--line, #ddd)" }} />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
