import "server-only";
import { eq, sql } from "drizzle-orm";
import type { Ctx } from "@/lib/api/handler";
import { profiles } from "@/lib/db/schema";
import { withUser } from "@/lib/db/with-user";
import { getMe } from "@/features/workspaces/server/service";

export async function updateProfile(
  ctx: Ctx,
  input: Partial<{ fullName: string; theme: "light" | "dark" | "system"; onboardingCompleted: boolean; acceptTerms: true }>,
) {
  await withUser(ctx.claims, async (tx) => {
    const patch: Partial<typeof profiles.$inferInsert> = {};
    if (input.fullName !== undefined) patch.fullName = input.fullName.trim();
    if (input.theme !== undefined) patch.theme = input.theme;
    if (Object.keys(patch).length > 0) await tx.update(profiles).set(patch).where(eq(profiles.id, ctx.userId));
    if (input.acceptTerms) {
      await tx.execute(
        sql`update public.profiles set terms_accepted_at = coalesce(terms_accepted_at, now()) where id = ${ctx.userId}::uuid`,
      );
    }
    if (input.onboardingCompleted) {
      await tx.execute(
        sql`update public.profiles set onboarding_completed_at = coalesce(onboarding_completed_at, now()) where id = ${ctx.userId}::uuid`,
      );
    }
  });
  return getMe(ctx);
}
