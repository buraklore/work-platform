import { defineHandler } from "@/lib/api/handler";
import { authError } from "@/lib/auth/errors";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import { passwordUpdateSchema } from "@/features/auth/schemas";

export const POST = defineHandler({ rateLimit: "auth", input: passwordUpdateSchema }, async ({ input }) => {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.updateUser({ password: input.password });
  if (error) throw authError(error);
  return { ok: true };
});
