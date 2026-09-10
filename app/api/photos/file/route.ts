import { NextRequest, NextResponse } from "next/server";
import { get } from "@vercel/blob";
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

  const photo = await prisma.orderPhoto.findUnique({ where: { id }, select: { pathname: true } });
  if (!photo) return NextResponse.json({ error: "Foto findes ikke" }, { status: 404 });

  // Privat Blob-store: hent SERVER-SIDE med SDK'ens get() (bruger BLOB-tokenet) —
  // en rå fetch af URL'en fejler, da private blobs kræver signatur.
  let blobResult: Awaited<ReturnType<typeof get>> = null;
  try {
    blobResult = await get((photo as { pathname: string }).pathname, { access: "private" });
  } catch (e) {
    console.error("[photos/file] get() fejlede:", e instanceof Error ? e.message : e);
    return NextResponse.json({ error: "Kunne ikke hente foto" }, { status: 502 });
  }
  if (!blobResult || !blobResult.stream) {
    return NextResponse.json({ error: "Kunne ikke hente foto" }, { status: 502 });
  }
  const headers = new Headers();
  headers.set("content-type", (blobResult as { contentType?: string }).contentType ?? "image/jpeg");
  headers.set("cache-control", "private, max-age=3600");
  return new NextResponse(blobResult.stream as unknown as ReadableStream, { status: 200, headers });
}
