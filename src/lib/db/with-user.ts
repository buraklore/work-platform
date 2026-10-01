/**
 * Every query made on behalf of a user goes through withUser(): a transaction that
 * switches to the RLS-restricted `app_user` role and exposes the verified JWT claims
 * to Postgres (read by app.uid()). Without this, Drizzle would connect as `postgres`
 * and bypass Row Level Security entirely.
 */
import "server-only";
import { sql } from "drizzle-orm";
import { mapDbError, UnauthorizedError } from "@/lib/api/errors";
import { getDb, type Database } from "./client";

export type Claims = { sub: string; email?: string; role?: string } & Record<string, unknown>;
export type Tx = Parameters<Parameters<Database["transaction"]>[0]>[0];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function withUser<T>(claims: Claims | null | undefined, fn: (tx: Tx) => Promise<T>): Promise<T> {
  if (!claims || typeof claims.sub !== "string" || !UUID_RE.test(claims.sub)) {
    throw new UnauthorizedError();
  }
  try {
    return await getDb().transaction(async (tx) => {
      await tx.execute(
        sql`select set_config('request.jwt.claims', ${JSON.stringify(claims)}, true), set_config('role', 'app_user', true)`,
      );
      return fn(tx);
    });
  } catch (err) {
    // Constraint / trigger / RLS / limit errors become typed AppErrors for every caller.
    throw mapDbError(err) ?? err;
  }
}
