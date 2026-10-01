import { AppError, RateLimitError } from "@/lib/api/errors";

/** Supabase Auth error → stable code the UI translates. Never echo raw provider text. */
export function authError(error: { code?: string; status?: number; message?: string }): AppError {
  const code = error.code ?? "";
  if (error.status === 429 || code.startsWith("over_")) return new RateLimitError(60);
  const known = new Set([
    "invalid_credentials",
    "email_not_confirmed",
    "user_already_exists",
    "email_exists",
    "weak_password",
    "same_password",
    "otp_expired",
    "signup_disabled",
  ]);
  return new AppError("auth", 400, known.has(code) ? code : "auth_failed");
}
