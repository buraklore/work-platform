/**
 * Every Route Handler is built with defineHandler(), which enforces — in order —
 * CSRF origin check → authentication → rate limit → input validation → handler →
 * error mapping. Handlers never repeat these steps by hand.
 */
import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSessionClaims } from "@/lib/auth/supabase-server";
import type { Claims } from "@/lib/db/with-user";
import { clientIp, enforceRateLimit, type LimitKind } from "@/lib/security/rate-limit";
import { AppError, ForbiddenError, mapDbError, UnauthorizedError, ValidationError } from "./errors";

export type Ctx = { claims: Claims; userId: string };

type Options<I> = {
  /** Default true. */
  auth?: boolean;
  /** Default: "mutation" for writes, "read" for GET. */
  rateLimit?: LimitKind | false;
  input?: z.ZodType<I>;
};

type Args<I, P> = { ctx: Ctx; input: I; params: P; req: NextRequest };
type PublicArgs<I, P> = { ctx: Ctx | null; input: I; params: P; req: NextRequest };

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function checkOrigin(req: NextRequest) {
  if (SAFE_METHODS.has(req.method)) return;
  const origin = req.headers.get("origin");
  if (!origin) throw new ForbiddenError("missing_origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  let originHost: string;
  try {
    originHost = new URL(origin).host;
  } catch {
    throw new ForbiddenError("bad_origin");
  }
  if (originHost !== host) throw new ForbiddenError("cross_origin");
}

async function readInput(req: NextRequest): Promise<unknown> {
  if (req.method === "GET" || req.method === "DELETE") {
    return Object.fromEntries(req.nextUrl.searchParams.entries());
  }
  const text = await req.text();
  if (!text) return {};
  try {
    return JSON.parse(text);
  } catch {
    throw new ValidationError("invalid_json");
  }
}

export function errorResponse(err: unknown): NextResponse {
  const mapped = err instanceof AppError ? err : mapDbError(err);
  if (mapped) {
    const headers: Record<string, string> = {};
    if (mapped.status === 429 && mapped.details?.retryAfter) headers["Retry-After"] = String(mapped.details.retryAfter);
    return NextResponse.json(
      { error: { code: mapped.code, message: mapped.message, details: mapped.details ?? null } },
      { status: mapped.status, headers },
    );
  }
  const requestId = crypto.randomUUID();
  console.error(JSON.stringify({ level: "error", requestId, error: String(err), stack: (err as Error)?.stack }));
  return NextResponse.json({ error: { code: "internal", message: "internal", details: { requestId } } }, { status: 500 });
}

export function defineHandler<I = Record<string, never>, P = Record<string, string>>(
  options: Options<I> & { auth: false },
  fn: (args: PublicArgs<I, P>) => Promise<unknown>,
): (req: NextRequest, context: { params: Promise<P> }) => Promise<NextResponse>;
export function defineHandler<I = Record<string, never>, P = Record<string, string>>(
  options: Options<I>,
  fn: (args: Args<I, P>) => Promise<unknown>,
): (req: NextRequest, context: { params: Promise<P> }) => Promise<NextResponse>;
export function defineHandler<I, P>(
  options: Options<I>,
  fn: (args: Args<I, P> & PublicArgs<I, P>) => Promise<unknown>,
) {
  return async (req: NextRequest, context: { params: Promise<P> }): Promise<NextResponse> => {
    try {
      checkOrigin(req);
      const requireAuth = options.auth !== false;
      const claims = await getSessionClaims().catch(() => null);
      if (requireAuth && !claims) throw new UnauthorizedError();
      const ctx: Ctx | null = claims ? { claims, userId: claims.sub } : null;

      const kind = options.rateLimit ?? (SAFE_METHODS.has(req.method) ? "read" : "mutation");
      if (kind) {
        const key = kind === "auth" || kind === "public" || !ctx ? `ip:${clientIp(req.headers)}` : `u:${ctx.userId}`;
        await enforceRateLimit(kind, key);
      }

      let input = {} as I;
      if (options.input) {
        const parsed = options.input.safeParse(await readInput(req));
        if (!parsed.success) {
          throw new ValidationError("invalid_input", {
            fields: parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
          });
        }
        input = parsed.data;
      }

      const params = (await context.params) ?? ({} as P);
      const data = await fn({ ctx: ctx as Ctx, input, params, req });
      if (data instanceof NextResponse) return data;
      return NextResponse.json({ data: data ?? null }, { status: req.method === "POST" ? 201 : 200 });
    } catch (err) {
      return errorResponse(err);
    }
  };
}
