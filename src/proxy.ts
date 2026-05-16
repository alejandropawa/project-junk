import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Next.js 16 „Proxy” — reîmprospătează cookie-urile de sesiune Supabase înainte
 * de randarea pe server (echivalentul vechiului `middleware.ts`).
 *
 * Folosim `getClaims()` (verificare JWT, refresh când e aproape de expirare),
 * nu `getSession()` din cookie nevalidat.
 *
 * Rutele `/cont` cer claims valide; redirectionarea pastreaza cookie-urile refresh-uite.
 */
const PUBLIC_FILE_EXTENSION_RE = /\/[^/]+\.[^/]+$/;

function isAuthRedirectBypassPath(pathname: string): boolean {
  return (
    pathname.startsWith("/api/") ||
    pathname === "/api" ||
    pathname.startsWith("/auth/callback") ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    PUBLIC_FILE_EXTENSION_RE.test(pathname)
  );
}

export function isProtectedAccountPath(pathname: string): boolean {
  if (isAuthRedirectBypassPath(pathname)) return false;
  return pathname === "/cont" || pathname.startsWith("/cont/");
}

function redirectToAuthWithCookies(
  request: NextRequest,
  refreshedResponse: NextResponse,
): NextResponse {
  const loginUrl = request.nextUrl.clone();
  const originalPath = `${request.nextUrl.pathname}${request.nextUrl.search}`;

  loginUrl.pathname = "/autentificare";
  loginUrl.search = "";
  loginUrl.searchParams.set("next", originalPath);

  const redirectResponse = NextResponse.redirect(loginUrl);
  refreshedResponse.cookies.getAll().forEach((cookie) => {
    redirectResponse.cookies.set(cookie);
  });

  return redirectResponse;
}

export async function proxy(request: NextRequest) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  const protectsAccountPath = isProtectedAccountPath(request.nextUrl.pathname);

  if (!url || !anonKey) {
    if (protectsAccountPath) {
      return redirectToAuthWithCookies(
        request,
        NextResponse.next({ request: { headers: request.headers } }),
      );
    }
    return NextResponse.next({ request: { headers: request.headers } });
  }

  let supabaseResponse = NextResponse.next({
    request: { headers: request.headers },
  });

  const supabase = createServerClient(url, anonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({
          request: { headers: request.headers },
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  const { data, error } = await supabase.auth.getClaims();
  const hasValidClaims = !error && Boolean(data?.claims?.sub);

  if (protectsAccountPath && !hasValidClaims) {
    return redirectToAuthWithCookies(request, supabaseResponse);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
