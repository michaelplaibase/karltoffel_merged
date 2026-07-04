// Signed session token, using Web Crypto HMAC so it works in BOTH the Node
// runtime (server actions) and the Edge runtime (middleware). The token is
// `<userId>.<iat>.<exp>.<hmac(payload)>`; there is no server-side session store.
// IMPORTANT: keep this file Edge-safe — Web Crypto only, no node:crypto,
// no @prisma/client, no next/headers.
export const SESSION_COOKIE = "kt_session";

/** Session lifetime in seconds (7 days). The login cookie maxAge must match. */
export const SESSION_TTL_SECONDS = 604800;

const SECRET = (() => {
  const s = process.env.SESSION_SECRET;
  // Enforce a strong secret at RUNTIME in production, but not during `next build`
  // (which sets NODE_ENV=production and evaluates modules) so CI/build without the
  // prod secret still compiles. The signing key is never exercised during build.
  const isBuild = process.env.NEXT_PHASE === "phase-production-build";
  if (process.env.NODE_ENV === "production" && !isBuild) {
    if (!s || s.length < 32) {
      throw new Error("SESSION_SECRET must be set to at least 32 random characters in production.");
    }
    return s;
  }
  return s || "karltoffel-dev-secret-change-me";
})();

const enc = new TextEncoder();

function b64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function hmac(data: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(SECRET), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(data));
  return b64url(new Uint8Array(sig));
}

export async function signSession(userId: number, ttlSeconds: number = SESSION_TTL_SECONDS): Promise<string> {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + ttlSeconds;
  const payload = `${userId}.${iat}.${exp}`;
  return `${payload}.${await hmac(payload)}`;
}

/** Returns the userId if the token's signature is valid and it has not expired, else null. */
export async function verifySession(token: string | undefined): Promise<number | null> {
  if (!token) return null;
  const i = token.lastIndexOf(".");
  if (i < 0) return null;
  const payload = token.slice(0, i);
  const sig = token.slice(i + 1);
  const expected = await hmac(payload);
  if (sig.length !== expected.length) return null;
  let diff = 0;
  for (let j = 0; j < sig.length; j++) diff |= sig.charCodeAt(j) ^ expected.charCodeAt(j);
  if (diff !== 0) return null;
  const parts = payload.split(".");
  if (parts.length !== 3) return null;
  const id = Number(parts[0]);
  const exp = Number(parts[2]);
  if (!Number.isFinite(id) || !Number.isFinite(exp)) return null;
  if (exp <= Math.floor(Date.now() / 1000)) return null;
  return id;
}
