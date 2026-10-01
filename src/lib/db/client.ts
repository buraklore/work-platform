/**
 * Raw connection. Imported ONLY by with-user.ts (RLS-scoped access) and admin.ts
 * (privileged access). Enforced by ESLint no-restricted-imports and a test.
 */
import "server-only";
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { databaseUrl } from "@/lib/env";
import * as schema from "./schema";

export type Database = PostgresJsDatabase<typeof schema>;

const globalForDb = globalThis as unknown as { __appDb?: Database; __appSql?: postgres.Sql };

export function getDb(): Database {
  if (!globalForDb.__appDb) {
    const client = postgres(databaseUrl(), {
      // Supabase transaction pooler (port 6543) does not support prepared statements.
      prepare: false,
      max: Number(process.env.DB_POOL_MAX ?? 3),
      idle_timeout: 20,
      onnotice: () => {},
    });
    globalForDb.__appSql = client;
    globalForDb.__appDb = drizzle(client, { schema });
  }
  return globalForDb.__appDb;
}

/** For tests: close the pool. */
export async function closeDb() {
  await globalForDb.__appSql?.end({ timeout: 5 });
  globalForDb.__appDb = undefined;
  globalForDb.__appSql = undefined;
}
