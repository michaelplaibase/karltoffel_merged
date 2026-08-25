import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySession, SESSION_COOKIE } from "@/lib/session";

// Gate the whole app behind login (like the real portal). Everything except the
// login page, API routes and static assets requires a valid session cookie.
export async function middleware(req: NextRequest) {
  const userId = await verifySession(req.cookies.get(SESSION_COOKIE)?.value);
  if (userId) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  // Gem den ønskede side (sti + query) som ?next=, så login-action'en kan sende
  // brugeren videre til det dybe link i stedet for altid at lande på /calendar.
  const next = req.nextUrl.pathname + req.nextUrl.search;
  url.search = next && next !== "/" ? "?next=" + encodeURIComponent(next) : "";
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!login|api|_next/static|_next/image|favicon.ico).*)"],
};
