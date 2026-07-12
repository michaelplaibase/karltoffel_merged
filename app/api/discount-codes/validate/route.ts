import { prisma } from "@/lib/db";
import { underLimit, recordHit } from "@/lib/rate-limit";

// Public, read-only discount-code validation for the website's quote engine.
// No auth — middleware exempts /api, and the response reveals nothing beyond
// valid/percent. Rate-limited per IP, and CORS is deliberately wide open (*)
// so the browser can call it straight from the marketing site.

const CORS_JSON = {
  "content-type": "application/json",
  "Access-Control-Allow-Origin": "*",
};

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: CORS_JSON });
}

/** Midnat i dag (UTC). expiresAt gemmes som T00:00:00Z (se createDiscountCode
 *  i app/actions/catalog.ts), så med `gte` er en kode der udløber "i dag"
 *  stadig gyldig. */
const startOfTodayUTC = () => new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");

export async function GET(req: Request): Promise<Response> {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!underLimit(`disc:${ip}`, 60)) return json({ error: "Too many requests" }, 429);
  recordHit(`disc:${ip}`, 60_000);

  const code = (new URL(req.url).searchParams.get("code") ?? "").trim().slice(0, 40);

  // `code` har ikke @unique i skemaet → findFirst, case-ufølsomt.
  const hit = code
    ? await prisma.discountCode.findFirst({
        where: {
          code: { equals: code, mode: "insensitive" },
          OR: [{ expiresAt: null }, { expiresAt: { gte: startOfTodayUTC() } }],
        },
      })
    : null;

  return json({ valid: !!hit, percent: hit ? hit.percent : 0 });
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
    },
  });
}
