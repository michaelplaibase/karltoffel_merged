import { STAC_BASE, skraafotoToken, unconfigured, requireStaff } from "@/lib/skraafoto-proxy";
import type { NextRequest } from "next/server";

// POST /api/skraafoto/search — proxy for Dataforsyningens STAC skråfoto /search.
// Injicerer tokenet serverside og OMSKRIVER COG-asset-hrefs til vores egen
// cog-proxy, så browseren hverken ser tokenet i STAC-kaldet eller i billed-URL'en.
export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const denied = await requireStaff();
  if (denied) return denied;

  const token = skraafotoToken();
  if (!token) return unconfigured();

  let body: unknown;
  try { body = await req.json(); } catch { return new Response(JSON.stringify({ error: "Invalid JSON" }), { status: 400, headers: { "content-type": "application/json" } }); }
  if (!body || typeof body !== "object") return new Response(JSON.stringify({ error: "Invalid body" }), { status: 400, headers: { "content-type": "application/json" } });

  let upstream: Response;
  try {
    upstream = await fetch(STAC_BASE + "/search?token=" + encodeURIComponent(token), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
  } catch {
    return new Response(JSON.stringify({ error: "upstream unreachable" }), { status: 502, headers: { "content-type": "application/json" } });
  }
  if (!upstream.ok) {
    // Videregiv statuskoden (401/403/…) så klient/console kan diagnosticere token-fejl.
    return new Response(JSON.stringify({ error: "STAC " + upstream.status }), {
      status: upstream.status === 503 ? 502 : upstream.status,
      headers: { "content-type": "application/json" },
    });
  }

  let json: { features?: Array<{ assets?: { data?: { href?: string } } }> };
  try { json = await upstream.json(); } catch { return new Response(JSON.stringify({ error: "bad upstream json" }), { status: 502, headers: { "content-type": "application/json" } }); }

  // Omskriv hver COG-href → vores cog-proxy (uden token). Browseren får en
  // tokenløs, self-origin URL som geotiff.js kan range-hente igennem.
  for (const f of json.features || []) {
    const href = f?.assets?.data?.href;
    if (typeof href === "string") {
      try {
        const target = new URL(href);
        target.searchParams.delete("token");
        f.assets!.data!.href = "/api/skraafoto/cog?u=" + encodeURIComponent(target.toString());
      } catch { /* uparsbar href → lad den stå (renderCOG fejler pænt) */ }
    }
  }

  return new Response(JSON.stringify(json), { headers: { "content-type": "application/json" } });
}
