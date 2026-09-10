import { NextRequest, NextResponse } from "next/server";
import { getDownloadUrl } from "@vercel/blob";
import { requireSession } from "@/lib/api-auth";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

/** GET /api/photos/file?id=123 — streamer et KS-foto fra den PRIVATE Blob-store
 *  til indloggede medarbejdere (thumbnail + fuldt billede i browseren). Guard:
 *  kræver login + id skal findes i OrderPhoto. getDownloadUrl giver en signeret
 *  URL som serveren fetch'er og streamer videre med inline content-type, så
 *  <img>-visning og klik-åbning virker trods privat store. */
export async function GET(req: NextRequest) {
  const userId = await requireSession();
  if (!userId) return NextResponse.json({ error: "Ikke logget ind" }, { status: 401 });

  const id = Number(req.nextUrl.searchParams.get("id"));
  if (!Number.isInteger(id) || id <= 0) {
    return NextResponse.json({ error: "Ugyldigt id" }, { status: 400 });
  }

  const photo = await prisma.orderPhoto.findUnique({ where: { id }, select: { url: true } });
  if (!photo) return NextResponse.json({ error: "Foto findes ikke" }, { status: 404 });

  const upstream = await fetch(getDownloadUrl(photo.url));
  if (!upstream.ok || !upstream.body) {
    return NextResponse.json({ error: "Kunne ikke hente foto" }, { status: 502 });
  }
  const headers = new Headers();
  headers.set("content-type", upstream.headers.get("content-type") ?? "image/jpeg");
  headers.set("cache-control", "private, max-age=3600");
  return new NextResponse(upstream.body, { status: 200, headers });
}
