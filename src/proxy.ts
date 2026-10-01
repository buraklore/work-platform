/**
 * Runs before every page render: refreshes the Supabase session cookie and routes
 * signed-out visitors away from the app (and signed-in ones away from auth pages).
 * API routes authenticate themselves via defineHandler().
 */
import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const AUTH_PAGES = ["/giris", "/kayit", "/sifremi-unuttum"];
const PUBLIC_PREFIXES = ["/auth/", "/davet/", "/yasal/", "/sifre-yenile"];

export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response; // misconfigured env surfaces on the page itself

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list, headers) => {
        for (const { name, value } of list) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of list) response.cookies.set(name, value, options);
        for (const [k, v] of Object.entries(headers ?? {})) response.headers.set(k, v);
      },
    },
  });
  const { data } = await supabase.auth.getClaims();
  const signedIn = Boolean(data?.claims?.sub);
  const path = request.nextUrl.pathname;

  const isAuthPage = AUTH_PAGES.includes(path);
  const isPublic = isAuthPage || PUBLIC_PREFIXES.some((p) => path.startsWith(p));

  if (!signedIn && !isPublic) {
    const target = new URL("/giris", request.url);
    if (path !== "/") target.searchParams.set("next", path + request.nextUrl.search);
    return withCookies(NextResponse.redirect(target), response);
  }
  if (signedIn && isAuthPage) {
    return withCookies(NextResponse.redirect(new URL("/", request.url)), response);
  }
  return response;
}

function withCookies(target: NextResponse, source: NextResponse) {
  for (const cookie of source.cookies.getAll()) target.cookies.set(cookie);
  return target;
}

export const config = {
  matcher: ["/((?!api/|_next/static|_next/image|favicon.ico|icon|apple-icon|manifest.webmanifest|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)"],
};
