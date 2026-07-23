// GET /api/dinero/connect — start the Visma Connect OAuth flow (admin only).
// Signs a short-lived state (HMAC, encodes the admin's id) and redirects to
// Visma's authorize endpoint. Self-guards: middleware excludes /api.
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getSessionUser } from "@/lib/api-auth";
import { envConfigured, signState, buildAuthorizeUrl, redirectUriFor } from "@/lib/dinero";

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const user = await getSessionUser();
  if (!user) return NextResponse.redirect(new URL("/login", origin));
  if (!user.isAdmin) return NextResponse.redirect(new URL("/accounting?fejl=admin", origin));
  if (!envConfigured()) return NextResponse.redirect(new URL("/accounting?fejl=config", origin));

  const url = buildAuthorizeUrl(redirectUriFor(origin), signState(user.id));
  return NextResponse.redirect(url);
}
