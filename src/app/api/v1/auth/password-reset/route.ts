import { enforceEmailRateLimit } from "@/lib/security/rate-limit";
import { defineHandler } from "@/lib/api/handler";
import { authError } from "@/lib/auth/errors";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import { siteConfig } from "@/config/site";
import { resetSchema } from "@/features/auth/schemas";

export const POST = defineHandler({ auth: false, rateLimit: "auth", input: resetSchema }, async ({ input }) => {
  await enforceEmailRateLimit(input.email);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.resetPasswordForEmail(input.email, {
    redirectTo: `${siteConfig.url}/auth/callback?next=/sifre-yenile`,
  });
  if (error && error.status === 429) throw authError(error);
  return { ok: true }; // no account enumeration
});
