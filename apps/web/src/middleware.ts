import { NextRequest, NextResponse } from "next/server";

// Middleware runs on the edge runtime: keep this list in sync with
// SUPPORTED_LOCALES / LOCALE_COOKIE in @dsk/i18n (imported values inline to
// avoid pulling locale JSON into the edge bundle).
const LOCALES = ["en", "fr"];
const DEFAULT_LOCALE = "en";
const LOCALE_COOKIE = "dsk_locale";
const ONE_YEAR = 60 * 60 * 24 * 365;

/** Preference order: cookie > Accept-Language header > default. */
function negotiateLocale(request: NextRequest): string {
  const cookie = request.cookies.get(LOCALE_COOKIE)?.value;
  if (cookie && LOCALES.includes(cookie)) return cookie;

  const header = request.headers.get("accept-language") ?? "";
  for (const part of header.split(",")) {
    const code = part.split(";")[0]?.trim().slice(0, 2).toLowerCase();
    if (code && LOCALES.includes(code)) return code;
  }
  return DEFAULT_LOCALE;
}

/**
 * Locale routing: every page lives under /{locale}/...
 * API routes, Next internals and static assets are excluded.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const urlLocale = LOCALES.find(
    (l) => pathname === `/${l}` || pathname.startsWith(`/${l}/`)
  );

  if (urlLocale) {
    // URL is the source of truth: keep the preference cookie in sync so the
    // next locale-less visit lands on the same language.
    const response = NextResponse.next();
    if (request.cookies.get(LOCALE_COOKIE)?.value !== urlLocale) {
      response.cookies.set(LOCALE_COOKIE, urlLocale, { path: "/", maxAge: ONE_YEAR });
    }
    return response;
  }

  const url = request.nextUrl.clone();
  url.pathname = `/${negotiateLocale(request)}${pathname === "/" ? "" : pathname}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!api|_next|favicon.ico|.*\\..*).*)"],
};
