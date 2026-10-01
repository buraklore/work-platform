import "server-only";
import { redirect } from "next/navigation";
import type { Ctx } from "@/lib/api/handler";
import { getSessionClaims } from "./supabase-server";

/** For Server Components / pages: the signed-in user's context, or a redirect to login. */
export async function requireSession(next?: string): Promise<Ctx> {
  const claims = await getSessionClaims();
  if (!claims) redirect(next ? `/giris?next=${encodeURIComponent(next)}` : "/giris");
  return { claims, userId: claims.sub };
}

export async function optionalSession(): Promise<Ctx | null> {
  const claims = await getSessionClaims().catch(() => null);
  return claims ? { claims, userId: claims.sub } : null;
}
