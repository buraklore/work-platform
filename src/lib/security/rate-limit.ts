import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { RateLimitError } from "@/lib/api/errors";
import { upstashEnv } from "@/lib/env";

export type LimitKind = "auth" | "authEmail" | "mutation" | "search" | "invite" | "upload" | "ai" | "public" | "read";

type Window = `${number} ${"s" | "m" | "h"}`;
const RULES: Record<LimitKind, { tokens: number; window: Window }> = {
  // Per IP: generous, because a whole office often shares one public IP.
  auth: { tokens: 30, window: "1 m" },
  // Per email address: the real brute-force / mail-bombing guard.
  authEmail: { tokens: 5, window: "1 m" },
  mutation: { tokens: 120, window: "1 m" },
  search: { tokens: 60, window: "1 m" },
  invite: { tokens: 20, window: "1 h" },
  upload: { tokens: 30, window: "1 m" },
  ai: { tokens: 10, window: "1 m" },
  public: { tokens: 60, window: "1 m" },
  read: { tokens: 600, window: "1 m" },
};

let limiters: Map<LimitKind, Ratelimit> | null | undefined;
let warned = false;

function getLimiters(): Map<LimitKind, Ratelimit> | null {
  if (limiters !== undefined) return limiters;
  const env = upstashEnv();
  if (!env) {
    // Production refuses to start without Upstash (src/lib/env.ts). In development
    // requests are not limited, and we say so once.
    if (!warned && process.env.NODE_ENV !== "test") {
      console.warn("[rate-limit] UPSTASH_REDIS_REST_URL/TOKEN not set — rate limiting disabled (development only).");
      warned = true;
    }
    limiters = null;
    return limiters;
  }
  const redis = new Redis({ url: env.url, token: env.token });
  limiters = new Map(
    (Object.keys(RULES) as LimitKind[]).map((kind) => [
      kind,
      new Ratelimit({
        redis,
        limiter: Ratelimit.slidingWindow(RULES[kind].tokens, RULES[kind].window),
        prefix: `rl:${kind}`,
        analytics: false,
      }),
    ]),
  );
  return limiters;
}

export async function enforceRateLimit(kind: LimitKind, key: string): Promise<void> {
  const map = getLimiters();
  if (!map) return;
  const result = await map.get(kind)!.limit(key);
  if (!result.success) {
    throw new RateLimitError(Math.max(1, Math.ceil((result.reset - Date.now()) / 1000)));
  }
}

/** Second, per-address limit for login / sign-up / password and magic-link emails. */
export async function enforceEmailRateLimit(email: string): Promise<void> {
  await enforceRateLimit("authEmail", `email:${email.trim().toLocaleLowerCase("en-US")}`);
}

export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return headers.get("x-real-ip") ?? "unknown";
}
