/** Application errors carry a stable machine code; the UI maps codes to Turkish copy. */
export class AppError extends Error {
  constructor(
    public readonly code: string,
    public readonly status: number,
    message?: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message ?? code);
    this.name = "AppError";
  }
}

export class UnauthorizedError extends AppError {
  constructor() {
    super("unauthorized", 401);
  }
}
export class ForbiddenError extends AppError {
  constructor(message = "forbidden") {
    super("forbidden", 403, message);
  }
}
/** Also used for resources in other workspaces — never reveal that they exist. */
export class NotFoundError extends AppError {
  constructor(message = "not_found") {
    super("not_found", 404, message);
  }
}
export class ValidationError extends AppError {
  constructor(message = "validation", details?: Record<string, unknown>) {
    super("validation", 422, message, details);
  }
}
export class ConflictError extends AppError {
  constructor(message = "conflict") {
    super("conflict", 409, message);
  }
}
export class LimitError extends AppError {
  constructor(limit: string) {
    super("limit", 409, `limit:${limit}`, { limit });
  }
}
export class InviteError extends AppError {
  constructor(reason: string) {
    super("invite", 410, `invite:${reason}`, { reason });
  }
}
export class RateLimitError extends AppError {
  constructor(retryAfterSeconds: number) {
    super("rate_limited", 429, "rate_limited", { retryAfter: retryAfterSeconds });
  }
}

type PgLikeError = { code?: string; message?: string };

function pgError(err: unknown): PgLikeError | null {
  let current: unknown = err;
  for (let i = 0; i < 4 && current; i++) {
    const candidate = current as PgLikeError & { cause?: unknown };
    if (typeof candidate.code === "string" && /^[0-9A-Z]{5}$/.test(candidate.code)) return candidate;
    current = candidate.cause;
  }
  return null;
}

/** Translate Postgres errors raised by constraints, triggers, RLS and our SQL functions. */
export function mapDbError(err: unknown): AppError | null {
  if (err instanceof AppError) return err;
  const pg = pgError(err);
  if (!pg) return null;
  const message = pg.message ?? "";
  if (message.startsWith("limit:")) return new LimitError(message.slice(6));
  if (message.startsWith("invite:")) return new InviteError(message.slice(7));
  switch (pg.code) {
    case "P0002": // not found raised by our functions
    case "23503": // FK to a row you cannot see / does not exist
    case "22P02": // malformed uuid
      return new NotFoundError();
    case "42501": // RLS rejection — do not reveal existence
      return message === "forbidden" || message.includes("only") || message.includes("owner")
        ? new ForbiddenError(message)
        : new NotFoundError();
    case "28000":
      return new UnauthorizedError();
    case "23505":
      return new ConflictError();
    case "23514":
    case "23502":
    case "22001":
      return new ValidationError(message);
    default:
      return null;
  }
}
