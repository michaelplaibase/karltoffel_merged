// Vedhæftninger (billeder/videoer) på ordrer/abonnementer.
//
// Bytes ligger i Vercel Blob (privat, region fra1/EU). Klienten uploader DIREKTE
// til Blob (bytes går aldrig gennem serveren — server-actions maxer ved 1 MB,
// funktioner ved ~4,5 MB). I DB gemmes kun url + pathname + metadata (Attachment).
// Visning af en privat blob sker via en korttids-signeret URL (signedViewUrl),
// serveret bag en session-gated proxy (app/api/attachments/[id]).
import { issueSignedToken, presignUrl, del } from "@vercel/blob";

export type AttachmentKind = "image" | "video";

// Størrelses- og typegrænser (v1).
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024; // 10 MB
export const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100 MB (~1–2 min telefonvideo)
export const IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"];
export const VIDEO_TYPES = ["video/mp4", "video/quicktime", "video/webm"];
export const ALLOWED_TYPES = [...IMAGE_TYPES, ...VIDEO_TYPES];

export function kindForContentType(ct: string): AttachmentKind | null {
  if (IMAGE_TYPES.includes(ct)) return "image";
  if (VIDEO_TYPES.includes(ct)) return "video";
  return null;
}

/** Reference fra klienten (én pr. uploadet fil), båret som skjult JSON-felt i
 *  formularen — så det rider med den eksisterende FormData/server-action-flow. */
export type UploadedRef = {
  url: string;
  pathname: string;
  contentType: string;
  sizeBytes: number;
  originalName?: string;
};

/** Parse det skjulte "attachments"-felt (JSON-array) til validerede refs. Fejler
 *  aldrig hårdt — ugyldige poster droppes, så en dårlig payload ikke vælter gemning. */
export function parseAttachmentRefs(raw: FormDataEntryValue | null): UploadedRef[] {
  if (typeof raw !== "string" || !raw.trim()) return [];
  let arr: unknown;
  try { arr = JSON.parse(raw); } catch { return []; }
  if (!Array.isArray(arr)) return [];
  const out: UploadedRef[] = [];
  for (const x of arr) {
    if (!x || typeof x !== "object") continue;
    const o = x as Record<string, unknown>;
    const url = typeof o.url === "string" ? o.url : "";
    const pathname = typeof o.pathname === "string" ? o.pathname : "";
    const contentType = typeof o.contentType === "string" ? o.contentType : "";
    const sizeBytes = Number(o.sizeBytes) || 0;
    if (!url || !pathname || !kindForContentType(contentType)) continue;
    out.push({
      url, pathname, contentType, sizeBytes,
      originalName: typeof o.originalName === "string" ? o.originalName.slice(0, 200) : undefined,
    });
  }
  return out;
}

/** Prisma nested-create data til et forældre-objekts `attachments`-relation. */
export function attachmentCreateData(refs: UploadedRef[]) {
  return refs.map((r, i) => ({
    url: r.url,
    pathname: r.pathname,
    contentType: r.contentType,
    kind: kindForContentType(r.contentType) as AttachmentKind,
    sizeBytes: r.sizeBytes,
    originalName: r.originalName ?? null,
    sort: i,
  }));
}

/** Korttids-signeret GET-URL til en privat blob (til <img>/<video src>). Kaster
 *  hvis BLOB_READ_WRITE_TOKEN mangler — kalderen bør fange og vise en fallback. */
export async function signedViewUrl(pathname: string, ttlMs = 60 * 60 * 1000): Promise<string> {
  const validUntil = Date.now() + ttlMs;
  const token = await issueSignedToken({ pathname, operations: ["get"], validUntil });
  const { presignedUrl } = await presignUrl(token, {
    operation: "get",
    pathname,
    access: "private",
    validUntil,
  });
  return presignedUrl;
}

/** Slet blob-objektet i storen (kald efter DB-rækken er fjernet). Best-effort —
 *  forældreløse blobs fanges af en senere GC-sweep. */
export async function deleteBlob(pathname: string): Promise<void> {
  try { await del(pathname); } catch { /* ignoreret med vilje */ }
}
