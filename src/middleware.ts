import createMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { routing } from "@/lib/i18n/routing";
import { SESSION_COOKIE_NAME } from "@/lib/firebase/session-cookie-name";

const intlMiddleware = createMiddleware(routing);

/**
 * Composed middleware (research.md §9, §32):
 *  1. `/admin/*` — a cheap session-cookie *presence* pre-filter only
 *     (defense layer 1 of 3). It redirects an obviously-unauthenticated
 *     visitor to /login early, but it never decides authorization itself —
 *     every admin Server Action/Route Handler/layout re-verifies the
 *     session and role server-side via the Admin SDK (layer 2), and the
 *     admin UI hides controls client-side only as UX (layer 3).
 *  2. `/offline` (T196, research.md §25) — passed through untouched. It
 *     must stay a single, stable, non-locale-prefixed URL so the service
 *     worker can precache and serve it as the navigation fallback while
 *     genuinely offline; a locale redirect here would make that precached
 *     entry a 307 (Workbox's precache install step rejects a redirected
 *     response as a failure, which otherwise leaves the whole service
 *     worker stuck "installing" forever).
 *  3. Everything else (the storefront) — next-intl locale detection/
 *     redirect: NEXT_LOCALE cookie, else Accept-Language, else "en".
 *     `/admin/*` and `/api/*` are intentionally never locale-prefixed.
 */
export default function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/admin")) {
    const hasSessionCookie = request.cookies.has(SESSION_COOKIE_NAME);
    if (!hasSessionCookie) {
      const loginUrl = new URL("/en/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  if (pathname === "/offline") {
    return NextResponse.next();
  }

  return intlMiddleware(request);
}

export const config = {
  matcher: [
    "/admin/:path*",
    "/((?!api|_next|_vercel|.*\\..*).*)",
  ],
};
