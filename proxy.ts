import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { verifySessionClaims, SESSION_COOKIE } from "@/lib/session";

// Gate the whole app behind login (like the real portal). Everything except the
// login page, API routes and static assets requires a valid session cookie.
// Derudover håndhæves rollebegrænsningen: medarbejdere (isAdmin=false) må KUN
// se kalender, dagsprogram, kunde-kartoteket, dagsprogram-i-PDF og konto-sider.
// isAdmin læses fra det signerede session-token (format v2) — uden DB-adgang.
// NB: proxy kan ikke se Prisma, så en deaktiveret brugers token er stadig
// gyldig her i op til 30 dage; siderne og guardAction/guardAdminAction slår
// stadig brugeren op i databasen og håndhæver active/isAdmin server-side.

// Stipræfikser medarbejdere må tilgå (plus /login og API-ruter via matcher'en).
const MEDARBEJDER_ALLOWED = [
  "/calendar",
  "/daycalendar",
  "/leads",
  "/customers",
  "/subscriptions",
  "/fixed-prices",
  "/orders",
  "/reports/day-pdf",
  "/account",
  "/change-password",
  "/logout",
];

export async function proxy(req: NextRequest) {
  const claims = await verifySessionClaims(req.cookies.get(SESSION_COOKIE)?.value);

  // Ikke indlogget (eller forældet token-format) → til login med ?next= så
  // login-action'en kan sende brugeren videre til det dybe link.
  if (!claims) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    const next = req.nextUrl.pathname + req.nextUrl.search;
    url.search = next && next !== "/" ? "?next=" + encodeURIComponent(next) : "";
    return NextResponse.redirect(url);
  }

  // Medarbejdere må kun de tilladte områder — alt andet sender vi stille til
  // kalenderen i stedet for en 403-side.
  if (!claims.isAdmin) {
    const path = req.nextUrl.pathname;
    const allowed = MEDARBEJDER_ALLOWED.some((p) => path === p || path.startsWith(p + "/"));
    if (!allowed) {
      return NextResponse.redirect(new URL("/calendar", req.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!login|api|_next/static|_next/image|favicon.ico).*)"],
};
