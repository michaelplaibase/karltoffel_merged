"use client";

// Kamera-panel for KS-fotos (Thomas 2026-09-03): tryk på foto-knappen på et
// dagsprogram-kort → <input type=file capture> åbner KAMERAET direkte på mobil/
// tablet. Billederne uploades straks til /api/photos og gemmes på ordren +
// kunden. Alle medarbejdere kan se og uploade.
import { useRef, useState } from "react";
import type { DayStop, DayUnplannedStop } from "@/lib/calendar";

type Photo = { id: number; url: string; createdAt: string; uploadedBy?: { firstName: string; lastName: string } | null };

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
    for (const f of Array.from(files)) {
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
            <a key={p.id} href={p.url} target="_blank" rel="noopener noreferrer"
              title={`KS-foto${p.uploadedBy ? ` · ${p.uploadedBy.firstName} ${p.uploadedBy.lastName}` : ""}`}
              style={{ display: "block" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.url} alt="KS-foto"
                style={{ width: 88, height: 88, objectFit: "cover", borderRadius: 6, border: "1px solid var(--line, #ddd)" }} />
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
