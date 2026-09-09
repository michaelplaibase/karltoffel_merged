import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { prisma } from "@/lib/db";
import { requireSession } from "@/lib/api-auth";

export const runtime = "nodejs";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB pr. billede
const ALLOWED = ["image/jpeg", "image/png", "image/heic", "image/webp"];

/** POST /api/photos?orderId=123 — upload ét KS-foto fra kameraet.
 *  Alle indloggede medarbejdere må uploade (Thomas 2026-09-03). */
export async function POST(req: NextRequest) {
  const userId = await requireSession();
  if (!userId) return NextResponse.json({ error: "Ikke logget ind" }, { status: 401 });

  const orderId = Number(req.nextUrl.searchParams.get("orderId"));
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return NextResponse.json({ error: "Ugyldigt ordre-id" }, { status: 400 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Ingen fil modtaget" }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "Billedet er for stort (maks 10 MB)" }, { status: 413 });
  }
  if (file.type && !ALLOWED.includes(file.type)) {
    return NextResponse.json({ error: "Understøttede formater: JPG, PNG, HEIC, WebP" }, { status: 415 });
  }

  const order = await prisma.order.findUnique({ where: { id: orderId }, select: { contactId: true } });
  if (!order) return NextResponse.json({ error: "Ordre findes ikke" }, { status: 404 });

  try {
    const ext = file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase() : "jpg";
    const blob = await put(`ks/order-${orderId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`, file, {
      access: "public",
      addRandomSuffix: true,
    });

    const photo = await prisma.orderPhoto.create({
      data: {
        orderId,
        contactId: order.contactId,
        uploadedById: userId,
        url: blob.url,
        pathname: blob.pathname,
        kind: "ks",
      },
    });
    return NextResponse.json({ ok: true, photo: { id: photo.id, url: photo.url } });
  } catch (err) {
    const msg = err instanceof Error && String(err.message).includes("BLOB_READ_WRITE_TOKEN")
      ? "Billedlager er ikke konfigureret endnu"
      : "Upload fejlede";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

/** GET /api/photos?orderId=123 — fotos for én ordre. */
export async function GET(req: NextRequest) {
  const userId = await requireSession();
  if (!userId) return NextResponse.json({ error: "Ikke logget ind" }, { status: 401 });

  const orderId = Number(req.nextUrl.searchParams.get("orderId"));
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return NextResponse.json({ error: "Ugyldigt ordre-id" }, { status: 400 });
  }
  const photos = await prisma.orderPhoto.findMany({
    where: { orderId },
    orderBy: { createdAt: "desc" },
    select: { id: true, url: true, createdAt: true, uploadedBy: { select: { firstName: true, lastName: true } } },
  });
  return NextResponse.json({ photos });
}
