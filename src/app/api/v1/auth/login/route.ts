import { enforceEmailRateLimit } from "@/lib/security/rate-limit";
import { defineHandler } from "@/lib/api/handler";
import { authError } from "@/lib/auth/errors";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import { loginSchema } from "@/features/auth/schemas";

export const POST = defineHandler({ auth: false, rateLimit: "auth", input: loginSchema }, async ({ input }) => {
  await enforceEmailRateLimit(input.email);
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email: input.email, password: input.password });
  if (error) throw authError(error);
  return { ok: true };
});
