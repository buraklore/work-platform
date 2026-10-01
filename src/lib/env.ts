/**
 * Environment access. Each getter validates only what its caller needs, so tests and
 * local tools run with a minimal env. `assertProductionEnv()` runs at server start
 * (src/instrumentation.ts) and refuses to boot a production server with gaps.
 */
import { z } from "zod";

const isProd = process.env.NODE_ENV === "production";

function read<T>(schema: z.ZodType<T>, values: Record<string, unknown>, label: string): T {
  const parsed = schema.safeParse(values);
  if (!parsed.success) {
    const keys = parsed.error.issues.map((i) => i.path.join(".")).join(", ");
    throw new Error(`Missing or invalid environment variables for ${label}: ${keys}. See .env.example.`);
  }
  return parsed.data;
}

export function databaseUrl(): string {
  return read(z.object({ DATABASE_URL: z.string().min(1) }), { DATABASE_URL: process.env.DATABASE_URL }, "database")
    .DATABASE_URL;
}

export function supabaseEnv() {
  const values = read(
    z.object({ url: z.string().url(), anonKey: z.string().min(20) }),
    { url: process.env.NEXT_PUBLIC_SUPABASE_URL, anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY },
    "Supabase",
  );
  return values;
}

export function upstashEnv(): { url: string; token: string } | null {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token) return { url, token };
  return null;
}

export function cronSecret(): string | null {
  return process.env.CRON_SECRET || null;
}

export function appleAuthEnabled(): boolean {
  return process.env.NEXT_PUBLIC_AUTH_APPLE_ENABLED === "true";
}

export function assertProductionEnv() {
  if (!isProd) return;
  read(
    z.object({
      DATABASE_URL: z.string().min(1),
      NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
      NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
      NEXT_PUBLIC_APP_URL: z.string().url(),
      UPSTASH_REDIS_REST_URL: z.string().url(),
      UPSTASH_REDIS_REST_TOKEN: z.string().min(10),
      CRON_SECRET: z.string().min(24),
    }),
    process.env,
    "production",
  );
}
