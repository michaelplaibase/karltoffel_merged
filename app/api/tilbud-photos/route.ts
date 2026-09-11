import { NextRequest, NextResponse } from "next/server";
import { put, getDownloadUrl } from "@vercel/blob";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/api-auth";

export const runtime = "nodejs";
export const maxDuration = 60;

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB pr. billede
const ALLOWED = ["image/jpeg", "image/png", "image/heic", "image/webp"];

/** POST /api/tilbud-photos?tilbudId=123&lineId=45 — upload ét foto til et tilbud.
 *  lineId udeladt = foto på hele tilbuddet. Genbruger KS-foto-mønsteret:
 *  privat Blob-store + kortsigtede download-URLs til klienten. */
export async function POST(req: NextRequest) {
  const userId = await requireSession();
  if (!userId) return NextResponse.json({ error: "Ikke logget ind" }, { status: 401 });

  const tilbudId = Number(req.nextUrl.searchParams.get("tilbudId"));
  if (!Number.isInteger(tilbudId) || tilbudId <= 0) {
    return NextResponse.json({ error: "Ugyldigt tilbud-id" }, { status: 400 });
  }
  const lineIdRaw = req.nextUrl.searchParams.get("lineId");
  let lineId: number | null = null;
  if (lineIdRaw) {
    lineId = Number(lineIdRaw);
    if (!Number.isInteger(lineId) || lineId <= 0) {
      return NextResponse.json({ error: "Ugyldigt linje-id" }, { status: 400 });
    }
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Ingen fil modtaget" }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "Billedet er for stort (maks 10 MB)" }, { status: 413 });
  if (file.type && !ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: "Understøttede formater: JPG, PNG, HEIC, WebP" }, { status: 415 });
  }

  const tilbud = await prisma.tilbud.findUnique({ where: { id: tilbudId }, select: { id: true } });
  if (!tilbud) return NextResponse.json({ error: "Tilbud findes ikke" }, { status: 404 });
  if (lineId != null) {
    const line = await prisma.tilbudLine.findFirst({ where: { id: lineId, tilbudId }, select: { id: true } });
    if (!line) return NextResponse.json({ error: "Opgavelinjen findes ikke på dette tilbud" }, { status: 404 });
  }

  try {
    const ext = file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase() : "jpg";
    const blob = await put(`tilbud/tilbud-${tilbudId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`, file, {
      access: "private",
      addRandomSuffix: true,
    });
    const photo = await prisma.tilbudPhoto.create({ data: { tilbudId, lineId, url: blob.url, pathname: blob.pathname } });
    return NextResponse.json({ ok: true, photo: { id: photo.id, lineId: photo.lineId, url: getDownloadUrl(blob.url) } });
  } catch (err) {
    console.error("[tilbud-photos] upload-fejl:", err instanceof Error ? err.message : err);
    const msg = err instanceof Error && String(err.message).includes("BLOB_READ_WRITE_TOKEN")
      ? "Billedlager er ikke konfigureret endnu"
      : "Upload fejlede — prøv igen.";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** GET /api/tilbud-photos?tilbudId=123 — fotos for ét tilbud. */
export async function GET(req: NextRequest) {
  const userId = await requireSession();
  if (!userId) return NextResponse.json({ error: "Ikke logget ind" }, { status: 401 });

  const tilbudId = Number(req.nextUrl.searchParams.get("tilbudId"));
  if (!Number.isInteger(tilbudId) || tilbudId <= 0) {
    return NextResponse.json({ error: "Ugyldigt tilbud-id" }, { status: 400 });
  }
  const rows = await prisma.tilbudPhoto.findMany({
    where: { tilbudId },
    orderBy: { createdAt: "desc" },
    select: { id: true, lineId: true, url: true, createdAt: true },
  });
  // Private store: DB-url er ikke offentlig — kortsigtede download-URLs.
  const photos = rows.map((p) => ({ ...p, url: getDownloadUrl(p.url) }));
  return NextResponse.json({ photos });
}