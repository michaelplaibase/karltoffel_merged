// Signed session token, using Web Crypto HMAC so it works in BOTH the Node
// runtime (server actions) and the Edge runtime (proxy/middleware). The token
// is `<version>.<userId>.<iat>.<exp>.<isAdmin>.<hmac(payload)>`; there is no
// server-side session store. Version "2" carries isAdmin in the signed payload
// so proxy/middleware kan håndhæve rollebegrænsningen uden Prisma/DB-adgang.
// Version "1" (uden version-felt og isAdmin) er IKKE gyldig længere — brugere
// med et gammelt token bliver blot bedt om at logge ind igen.
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

/** Signer en session for en bruger. isAdmin indgår i den signerede payload, så
 *  proxy/middleware kan filtrere medarbejder-sider uden databaseadgang. */
export async function signSession(userId: number, ttlSeconds: number = SESSION_TTL_SECONDS, isAdmin: boolean = false): Promise<string> {
  const iat = Math.floor(Date.now() / 1000);
  const exp = iat + ttlSeconds;
  const payload = `2.${userId}.${iat}.${exp}.${isAdmin ? 1 : 0}`;
  return `${payload}.${await hmac(payload)}`;
}

export type SessionClaims = { userId: number; isAdmin: boolean };

/** Returns the session claims (userId + isAdmin) if the token's signature is
 *  valid, the format version is current and it has not expired, else null.
 *  Gammel formatversion → null (brugeren logges bare ind igen). */
export async function verifySessionClaims(token: string | undefined): Promise<SessionClaims | null> {
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
  if (parts.length !== 5 || parts[0] !== "2") return null;
  const id = Number(parts[1]);
  const exp = Number(parts[3]);
  const isAdmin = parts[4] === "1";
  if (!Number.isFinite(id) || !Number.isFinite(exp)) return null;
  if (exp <= Math.floor(Date.now() / 1000)) return null;
  return { userId: id, isAdmin };
}

/** Returns the userId if the token's signature is valid and it has not expired, else null. */
export async function verifySession(token: string | undefined): Promise<number | null> {
  const claims = await verifySessionClaims(token);
  return claims?.userId ?? null;
}
