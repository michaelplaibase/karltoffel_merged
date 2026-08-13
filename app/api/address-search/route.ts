import { NextRequest, NextResponse } from "next/server";
import { requireSession, unauthorized } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  if ((await requireSession()) == null) return unauthorized();
  const text = request.nextUrl.searchParams.get("text")?.trim() ?? "";
  if (text.length < 3 || text.length > 160) {
    return NextResponse.json({ fund: [] }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  }

  const upstream = new URL("https://adressevaelger.dk/husnumre/soeg");
  upstream.searchParams.set("token", process.env.ADDRESS_FINDER_TOKEN?.trim() || "adressevaelger123");
  upstream.searchParams.set("maksimum", "6");
  upstream.searchParams.set("tekst", text);
  try {
    const response = await fetch(upstream, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(8_000),
      cache: "no-store",
    });
    if (!response.ok) {
      return NextResponse.json({ error: "address_lookup_failed" }, { status: 502, headers: { "Cache-Control": "no-store, max-age=0" } });
    }
    return NextResponse.json(await response.json(), { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch {
    return NextResponse.json({ error: "address_lookup_failed" }, { status: 502, headers: { "Cache-Control": "no-store, max-age=0" } });
  }
}
