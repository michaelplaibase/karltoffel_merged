// Simpel in-memory IP-baseret rate-limit til site-API'erne (Vercel serverless).
//
// Første skridt: tæller kald pr. IP i et Map pr. funktionsinstans. Vercel
// serverless er pr. instans og kortlivet, så det er ikke en hård global grænse
// — men det stopper de typiske gentagne misbrug (hammer på samme IP via samme
// varme instans) og er bedst-effort beskyttelse indtil evt. Upstash/KV senere.
// Ingen ekstern afhængighed; ingen blocking I/O.
const WINDOW_MS = 60_000;

const buckets = new Map(); // key: ip -> { start, count }

function prune(now) {
  if (buckets.size < 5_000) return;
  for (const [k, v] of buckets) {
    if (now - v.start > WINDOW_MS) buckets.delete(k);
  }
}

/**
 * Returnerer { ok, retryAfterS } — ok=false betyder "429 nu".
 * Brug:  const rl = rateLimit(req); if (!rl.ok) { ... 429 ... }
 */
function rateLimit(req, limit = 10) {
  const now = Date.now();
  const ip =
    ((req.headers["x-forwarded-for"] || "").split(",")[0].trim()) ||
    req.socket?.remoteAddress ||
    "unknown";
  let b = buckets.get(ip);
  if (!b || now - b.start > WINDOW_MS) {
    b = { start: now, count: 0 };
    buckets.set(ip, b);
  }
  b.count += 1;
  prune(now);
  return {
    ok: b.count <= limit,
    retryAfterS: Math.max(1, Math.ceil((WINDOW_MS - (now - b.start)) / 1000)),
  };
}

/** Svarer 429 og returnerer true, hvis klienten har overskredet grænsen. */
function tooManyRequests(req, res, limit = 10) {
  const rl = rateLimit(req, limit);
  if (rl.ok) return false;
  res.setHeader("Retry-After", rl.retryAfterS);
  res.status(429).json({ error: "For mange kald — prøv igen om lidt" });
  return true;
}

module.exports = { rateLimit, tooManyRequests };
