import { DHM_BASE, DHM_COVERAGES, skraafotoToken, unconfigured, requireStaff } from "@/lib/skraafoto-proxy";
import type { NextRequest } from "next/server";

// GET /api/skraafoto/dhm?coverage=dhm_terraen|dhm_overflade&bbox=..&width=..&height=..
// Proxy for Danmarks Højdemodel (WCS GetCoverage). Returnerer GeoTIFF-bytes;
// tokenet injiceres serverside. Bruges til terrænhøjde + nDSM-målingerne.
export const dynamic = "force-dynamic";

const BBOX_RE = /^-?\d+(\.\d+)?(,-?\d+(\.\d+)?){3}$/;

export async function GET(req: NextRequest) {
  const denied = await requireStaff();
  if (denied) return denied;

  const token = skraafotoToken();
  if (!token) return unconfigured();

  const sp = req.nextUrl.searchParams;
  const coverage = sp.get("coverage") || "";
  const bbox = sp.get("bbox") || "";
  const width = Math.max(1, Math.min(4096, parseInt(sp.get("width") || "0", 10) || 0));
  const height = Math.max(1, Math.min(4096, parseInt(sp.get("height") || "0", 10) || 0));
  if (!DHM_COVERAGES.has(coverage) || !BBOX_RE.test(bbox) || !width || !height) {
    return new Response(JSON.stringify({ error: "bad params" }), { status: 400, headers: { "content-type": "application/json" } });
  }

  // bbox er valideret af BBOX_RE (kun cifre/komma/minus/punktum) → rå kommaer,
  // som WCS-serveren forventer (samme form som sitets tilbudsmotor bruger).
  const url = DHM_BASE + "?SERVICE=WCS&VERSION=1.0.0&REQUEST=GetCoverage&COVERAGE=" + coverage +
    "&CRS=epsg:25832&RESPONSE_CRS=epsg:25832&FORMAT=GTiff&WIDTH=" + width + "&HEIGHT=" + height +
    "&BBOX=" + bbox + "&token=" + encodeURIComponent(token);

  let upstream: Response;
  try { upstream = await fetch(url); }
  catch { return new Response(JSON.stringify({ error: "upstream unreachable" }), { status: 502, headers: { "content-type": "application/json" } }); }
  if (!upstream.ok || !upstream.body) {
    return new Response(JSON.stringify({ error: "DHM " + upstream.status }), {
      status: upstream.status === 503 ? 502 : upstream.status,
      headers: { "content-type": "application/json" },
    });
  }

  return new Response(upstream.body, {
    status: 200,
    headers: {
      "content-type": upstream.headers.get("content-type") || "image/tiff",
      "cache-control": "private, max-age=86400",
    },
  });
}
