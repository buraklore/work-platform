import { defineHandler } from "@/lib/api/handler";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";

export const POST = defineHandler({ auth: false, rateLimit: false }, async () => {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  return { ok: true };
});
