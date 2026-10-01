/**
 * Applies supabase/migrations/*.sql in order to DATABASE_URL (local development / CI).
 * In a real Supabase project use `supabase db push` instead — same files.
 *   pnpm db:migrate            → apply pending migrations
 *   pnpm db:migrate --shim     → also install the local auth-schema shim first
 */
import "dotenv/config";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import postgres from "postgres";

export async function migrate(url: string, opts: { shim?: boolean; quiet?: boolean } = {}) {
  const sql = postgres(url, { max: 1, onnotice: () => {} });
  try {
    if (opts.shim) {
      await sql.unsafe(readFileSync(path.join(process.cwd(), "tests/setup/supabase-shim.sql"), "utf8"));
    }
    await sql.unsafe(`create schema if not exists app;
      create table if not exists app.local_migrations (name text primary key, applied_at timestamptz not null default now())`);
    const dir = path.join(process.cwd(), "supabase/migrations");
    const files = readdirSync(dir).filter((f) => f.endsWith(".sql")).sort();
    const applied = new Set((await sql<{ name: string }[]>`select name from app.local_migrations`).map((r) => r.name));
    for (const file of files) {
      if (applied.has(file)) continue;
      await sql.begin(async (tx) => {
        await tx.unsafe(readFileSync(path.join(dir, file), "utf8"));
        await tx`insert into app.local_migrations (name) values (${file})`;
      });
      if (!opts.quiet) console.log(`applied ${file}`);
    }
  } finally {
    await sql.end();
  }
}

if (process.argv[1]?.endsWith("db-migrate.ts")) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set");
  migrate(url, { shim: process.argv.includes("--shim") }).catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
