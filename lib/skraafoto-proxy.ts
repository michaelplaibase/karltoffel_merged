// Server-side helpers for the skråfoto-proxy routes (app/api/skraafoto/*).
// The Dataforsyningen-token lever KUN her på serveren — det sendes aldrig til
// browseren. Browseren rammer /api/skraafoto/* (same-origin), og vi videresender
// serverside med tokenet. Dermed er referer/domæne-lås på tokenet irrelevant, og
// tokenet kan (og bør) være uden domæne-binding.
//
// Kun importeret af route-handlers (server) — aldrig fra klient-komponenter.
import { requireSession, unauthorized } from "@/lib/api-auth";

export const STAC_BASE = "https://api.dataforsyningen.dk/rest/skraafoto_api/v2";
export const DHM_BASE = "https://api.dataforsyningen.dk/dhm_wcs_DAF";
export const DHM_COVERAGES = new Set(["dhm_terraen", "dhm_overflade"]);

/** Tokenet fra miljøet, trimmet (guard mod whitespace/newline fra env-panelet). */
export function skraafotoToken(): string {
  return (process.env.DATAFORSYNINGEN_TOKEN || "").trim();
}

/** 503 når tokenet ikke er sat — klienten viser "ikke konfigureret". */
export function unconfigured(): Response {
  return new Response(JSON.stringify({ error: "unconfigured" }), {
    status: 503,
    headers: { "content-type": "application/json" },
  });
}

/** Guard: kun indloggede medarbejdere må bruge proxyen (middleware fritager /api,
 *  så hver rute skal selv tjekke sessionen — ellers kunne enhver tømme tokenet). */
export async function requireStaff(): Promise<Response | null> {
  if ((await requireSession()) == null) return unauthorized();
  return null;
}

/** SSRF-værn: kun https mod Dataforsyningen må proxies videre. */
export function isAllowedUpstream(u: URL): boolean {
  const h = u.hostname.toLowerCase();
  return u.protocol === "https:" && (h === "dataforsyningen.dk" || h.endsWith(".dataforsyningen.dk"));
}
