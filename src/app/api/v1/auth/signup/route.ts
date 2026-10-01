import { enforceEmailRateLimit } from "@/lib/security/rate-limit";
import { defineHandler } from "@/lib/api/handler";
import { authError } from "@/lib/auth/errors";
import { createSupabaseServerClient } from "@/lib/auth/supabase-server";
import { track } from "@/lib/db/audit";
import { withUser } from "@/lib/db/with-user";
import { siteConfig } from "@/config/site";
import { safeNext, signupSchema } from "@/features/auth/schemas";
import { sql } from "drizzle-orm";

export const POST = defineHandler({ auth: false, rateLimit: "auth", input: signupSchema }, async ({ input }) => {
  await enforceEmailRateLimit(input.email);
  const supabase = await createSupabaseServerClient();
  const next = safeNext(input.next, "/baslangic");
  const { data, error } = await supabase.auth.signUp({
    email: input.email,
    password: input.password,
    options: {
      // terms_accepted: recorded as profiles.terms_accepted_at by the auth.users trigger (KVKK).
      data: { full_name: input.fullName, terms_accepted: true },
      emailRedirectTo: `${siteConfig.url}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  if (error) throw authError(error);
  // Supabase returns a user with no identities when the email is already registered
  // (enumeration protection) — the UI shows the same "check your inbox" message.
  if (data.user && (data.user.identities?.length ?? 0) > 0) {
    await withUser({ sub: data.user.id }, async (tx) => {
      if (input.marketingConsent) {
        await tx.execute(sql`update public.profiles set marketing_consent_at = now() where id = ${data.user!.id}::uuid`);
      }
      await track(tx, { userId: data.user!.id, name: "signup", props: { method: "password" } });
    });
  }
  return { needsConfirmation: !data.session };
});
