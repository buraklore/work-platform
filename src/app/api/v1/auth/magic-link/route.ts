import { enforceEmailRateLimit } from "@/lib/security/rate-limit";
import { defineHandler } from "@/lib/api/handler";
import { authError } from "@/lib/auth/errors";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import { siteConfig } from "@/config/site";
import { magicLinkSchema, safeNext } from "@/features/auth/schemas";

export const POST = defineHandler({ auth: false, rateLimit: "auth", input: magicLinkSchema }, async ({ input }) => {
  await enforceEmailRateLimit(input.email);
  const supabase = await createSupabaseServerClient();
  const next = safeNext(input.next, "/");
  const { error } = await supabase.auth.signInWithOtp({
    email: input.email,
    options: { emailRedirectTo: `${siteConfig.url}/auth/callback?next=${encodeURIComponent(next)}`, shouldCreateUser: false },
  });
  if (error && error.status === 429) throw authError(error);
  return { ok: true }; // same answer whether or not the address exists
});
