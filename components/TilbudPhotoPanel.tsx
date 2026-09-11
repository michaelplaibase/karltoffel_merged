"use client";

// Foto-panel for Tilbud — samme tilgang som KS-fotos (OrderPhotoPanel): browser-
// skalering før upload, øjeblikkelig upload til /api/tilbud-photos, visning med
// kortsigtede download-URLs. Fotos kan knyttes til hele tilbuddet eller til én
// opgavelinje.
import { useRef, useState } from "react";

type Linje = { id: number; description: string };
type Foto = { id: number; lineId: number | null; url: string };

async function skalerFoerUpload(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const maxSide = 1600;
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
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
    return file;
  }
}

export default function TilbudPhotoPanel({ tilbudId, linjer, fotos }: {
  tilbudId: number;
  linjer: Linje[];
  fotos: { id: number; lineId: number | null; url: string }[];
}) {
  const [lista, setLista] = useState(fotos);
  const [fejl, setFejl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [mål, setMål] = useState<string>("0"); // "0" = hele tilbuddet
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(filer: FileList | null) {
    if (!filer?.length) return;
    setBusy(true); setFejl(null);
    try {
      for (const f of Array.from(filer)) {
        const skaleret = await skalerFoerUpload(f);
        const fd = new FormData();
        fd.append("file", skaleret);
        const q = `/api/tilbud-photos?tilbudId=${tilbudId}` + (mål !== "0" ? `&lineId=${mål}` : "");
        const res = await fetch(q, { method: "POST", body: fd });
        const json = await res.json();
        if (!res.ok) { setFejl(json.error ?? "Upload fejlede"); continue; }
        setLista((prev) => [{ id: json.photo.id, lineId: json.photo.lineId ?? null, url: json.photo.url }, ...prev]);
      }
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  const labelFor = (lineId: number | null) =>
    lineId == null ? "Hele tilbuddet" : linjer.find((l) => l.id === lineId)?.description ?? "Opgave";

  return (
    <div>
      <div className="row-actions" style={{ gap: 8, alignItems: "center" }}>
        <select className="form-control" style={{ maxWidth: 340 }} value={mål} onChange={(e) => setMål(e.target.value)}>
          <option value="0">Hele tilbuddet</option>
          {linjer.map((l) => <option key={l.id} value={String(l.id)}>{l.description}</option>)}
        </select>
        <input ref={inputRef} type="file" accept="image/*" multiple onChange={(e) => upload(e.target.files)} />
        {busy ? <span className="form-text">Uploader…</span> : null}
      </div>
      {fejl ? <p style={{ color: "#8a5a10" }}>{fejl}</p> : null}
      {lista.length > 0 ? (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, marginTop: 10 }}>
          {lista.map((f) => (
            <figure key={f.id} style={{ margin: 0, width: 150 }}>
              <img src={f.url} alt="Tilbudsfoto" style={{ width: 150, height: 100, objectFit: "cover", borderRadius: 4 }} />
              <figcaption className="form-text" style={{ fontSize: 11 }}>{labelFor(f.lineId)}</figcaption>
            </figure>
          ))}
        </div>
      ) : (
        <p className="form-text" style={{ marginTop: 10 }}>Ingen fotos endnu.</p>
      )}
    </div>
  );
}