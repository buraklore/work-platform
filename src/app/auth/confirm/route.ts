import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import { siteConfig } from "@/config/site";
import { nextFromRedirect } from "@/features/auth/schemas";

const TYPES = new Set<EmailOtpType>(["signup", "magiclink", "recovery", "invite", "email_change", "email"]);

/** Token-hash email links (see supabase/templates) — works across devices, unlike PKCE links. */
export async function GET(req: NextRequest) {
  const tokenHash = req.nextUrl.searchParams.get("token_hash");
  const type = req.nextUrl.searchParams.get("type") as EmailOtpType | null;
  const fallback = type === "recovery" ? "/sifre-yenile" : type === "signup" ? "/baslangic" : "/";
  const next = nextFromRedirect(req.nextUrl.searchParams.get("next"), siteConfig.url, fallback);
  if (!tokenHash || !type || !TYPES.has(type)) return NextResponse.redirect(new URL("/giris?hata=link", req.url));
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) return NextResponse.redirect(new URL("/giris?hata=link", req.url));
  return NextResponse.redirect(new URL(next, req.url));
}
