import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireSession, unauthorized } from "@/lib/api-auth";
import { signedViewUrl } from "@/lib/attachments";

// Session-gated visning af en PRIVAT blob: slår vedhæftningen op, signerer en
// korttids GET-URL og redirecter browseren dertil. Brug som:
//   <img  src="/api/attachments/123">
//   <video src="/api/attachments/123" controls preload="metadata">
// Kun indloggede kan hente den signerede URL (ruten ligger uden for middleware).
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }): Promise<Response> {
  if ((await requireSession()) == null) return unauthorized();

  const { id } = await ctx.params;
  const attId = Number(id);
  if (!Number.isInteger(attId) || attId <= 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const att = await prisma.attachment.findUnique({ where: { id: attId }, select: { pathname: true } });
  if (!att) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const url = await signedViewUrl(att.pathname);
    return NextResponse.redirect(url, 302);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
