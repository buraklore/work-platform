import { z } from "zod";

export const zEmail = z.string().trim().email().max(254);
export const zPassword = z.string().min(8).max(72);

export const signupSchema = z.object({
  fullName: z.string().trim().min(1).max(120),
  email: zEmail,
  password: zPassword,
  acceptTerms: z.literal(true),
  marketingConsent: z.boolean().optional(),
  next: z.string().max(300).optional(),
});
export const loginSchema = z.object({ email: zEmail, password: z.string().min(1).max(72) });
export const magicLinkSchema = z.object({ email: zEmail, next: z.string().max(300).optional() });
export const resetSchema = z.object({ email: zEmail });
export const passwordUpdateSchema = z.object({ password: zPassword });

/** Only same-site relative paths are allowed as post-auth redirects. */
export function safeNext(value: string | null | undefined, fallback = "/"): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}

/**
 * Email templates pass Supabase's `{{ .RedirectTo }}` — an absolute URL, usually
 * `<site>/auth/callback?next=/davet/…`. Turn it back into the in-app path we meant,
 * accepting only our own origin.
 */
export function nextFromRedirect(raw: string | null | undefined, siteUrl: string, fallback = "/"): string {
  if (raw && /^https?:\/\//i.test(raw)) {
    try {
      const url = new URL(raw);
      if (url.origin !== new URL(siteUrl).origin) return fallback;
      raw = url.pathname === "/auth/callback" ? url.searchParams.get("next") : `${url.pathname}${url.search}`;
    } catch {
      return fallback;
    }
  }
  return safeNext(raw, fallback);
}
