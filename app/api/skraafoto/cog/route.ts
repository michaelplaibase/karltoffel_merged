import { skraafotoToken, unconfigured, requireStaff, isAllowedUpstream } from "@/lib/skraafoto-proxy";
import type { NextRequest } from "next/server";

// GET /api/skraafoto/cog?u=<encoded Dataforsyningen COG-url>
// Range-proxy for selve skråfoto-billedet (COG). geotiff.js range-henter tiles
// herigennem; vi videresender Range-headeren og injicerer tokenet serverside.
// SSRF-værn: kun https mod *.dataforsyningen.dk. u'en kommer fra search-proxyens
// omskrevne href, men valideres alligevel (browseren kan pille ved query'en).
export const dynamic = "force-dynamic";

// Videregiv kun disse svar-headers (undgå at lække upstream-cookies o.l.).
const PASS = ["content-type", "content-length", "content-range", "accept-ranges", "etag", "last-modified"];

async function proxy(req: NextRequest, method: "GET" | "HEAD"): Promise<Response> {
  const denied = await requireStaff();
  if (denied) return denied;

  const token = skraafotoToken();
  if (!token) return unconfigured();

  const raw = req.nextUrl.searchParams.get("u") || "";
  let target: URL;
  try { target = new URL(raw); } catch { return new Response("bad url", { status: 400 }); }
  if (!isAllowedUpstream(target)) return new Response("host not allowed", { status: 400 });

  target.searchParams.delete("token");
  target.searchParams.set("token", token);

  const fwd: HeadersInit = {};
  const range = req.headers.get("range");
  if (range) (fwd as Record<string, string>).range = range;

  let upstream: Response;
  try { upstream = await fetch(target.toString(), { method, headers: fwd }); }
  catch { return new Response("upstream unreachable", { status: 502 }); }

  const headers = new Headers();
  for (const h of PASS) { const v = upstream.headers.get(h); if (v) headers.set(h, v); }
  if (!headers.has("accept-ranges")) headers.set("accept-ranges", "bytes");
  headers.set("cache-control", "private, max-age=86400");

  return new Response(method === "HEAD" ? null : upstream.body, { status: upstream.status, headers });
}

export function GET(req: NextRequest) { return proxy(req, "GET"); }
export function HEAD(req: NextRequest) { return proxy(req, "HEAD"); }
