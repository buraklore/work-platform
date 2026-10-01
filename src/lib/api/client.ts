"use client";

/** Typed fetch wrapper for /api/v1. Errors surface as ApiError with a stable code. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details: Record<string, unknown> | null,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

type Method = "GET" | "POST" | "PATCH" | "DELETE";

export async function api<T>(path: string, init: { method?: Method; body?: unknown; signal?: AbortSignal } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/v1${path}`, {
      method: init.method ?? "GET",
      headers: init.body !== undefined ? { "Content-Type": "application/json" } : undefined,
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
      credentials: "same-origin",
      signal: init.signal,
    });
  } catch (err) {
    if ((err as Error)?.name === "AbortError") throw err;
    throw new ApiError(0, "network", "network", null);
  }
  const payload = (await res.json().catch(() => null)) as
    | { data: T }
    | { error: { code: string; message: string; details: Record<string, unknown> | null } }
    | null;
  if (!res.ok || !payload || "error" in payload) {
    const error = payload && "error" in payload ? payload.error : { code: "internal", message: "internal", details: null };
    if (res.status === 401 && typeof window !== "undefined" && !path.startsWith("/auth/")) {
      // Session expired: a full navigation drops all client state before the login page.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination
      window.location.assign(`/giris?next=${encodeURIComponent(window.location.pathname + window.location.search)}`);
    }
    throw new ApiError(res.status, error.code, error.message, error.details);
  }
  return payload.data;
}
