import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Claims } from "@/lib/db/with-user";
import { supabaseEnv } from "@/lib/env";

export async function createSupabaseServerClient() {
  // cookies() first: it marks the route as dynamic, so nothing that reads a session is prerendered.
  const cookieStore = await cookies();
  const { url, anonKey } = supabaseEnv();
  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (list) => {
        try {
          for (const { name, value, options } of list) cookieStore.set(name, value, options);
        } catch {
          // Called from a Server Component: cookies are read-only there; the proxy refreshes them.
        }
      },
    },
  });
}

/** Verified claims of the signed-in user (JWT signature checked), or null. */
export async function getSessionClaims(): Promise<Claims | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims || typeof data.claims.sub !== "string") return null;
  return data.claims as unknown as Claims;
}
