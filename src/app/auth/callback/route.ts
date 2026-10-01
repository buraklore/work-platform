import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import { safeNext } from "@/features/auth/schemas";

/** OAuth (PKCE) and email links land here; the session cookie is set by the Supabase client. */
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const next = safeNext(req.nextUrl.searchParams.get("next"), "/");
  if (!code) return NextResponse.redirect(new URL("/giris?hata=link", req.url));
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL("/giris?hata=link", req.url));
  return NextResponse.redirect(new URL(next, req.url));
}
