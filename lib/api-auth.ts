// Session guard for Node route handlers (app/api/*). NOT for middleware —
// this imports next/headers, which is unavailable on the Edge runtime.
import { cookies } from "next/headers";
import { verifySession, SESSION_COOKIE } from "@/lib/session";

/** Returns the logged-in userId, or null if the request has no valid session. */
export async function requireSession(): Promise<number | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return verifySession(token);
}

export function unauthorized(): Response {
  return new Response(JSON.stringify({ error: "Unauthorized" }), {
    status: 401,
    headers: { "content-type": "application/json" },
  });
}
