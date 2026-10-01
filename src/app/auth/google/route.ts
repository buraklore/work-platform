import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import { clientIp, enforceRateLimit } from "@/lib/security/rate-limit";
import { siteConfig } from "@/config/site";
import { safeNext } from "@/features/auth/schemas";

export async function GET(req: NextRequest) {
  try {
    await enforceRateLimit("auth", `ip:${clientIp(req.headers)}`);
  } catch {
    return NextResponse.redirect(new URL("/giris?hata=rate_limited", req.url));
  }
  const next = safeNext(req.nextUrl.searchParams.get("next"), "/");
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${siteConfig.url}/auth/callback?next=${encodeURIComponent(next)}` },
  });
  if (error || !data.url) return NextResponse.redirect(new URL("/giris?hata=oauth", req.url));
  return NextResponse.redirect(data.url);
}
