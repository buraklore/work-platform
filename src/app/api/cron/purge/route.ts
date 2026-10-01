import { sql } from "drizzle-orm";
import { NextResponse, type NextRequest } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { adminDb } from "@/lib/db/admin";
import { cronSecret } from "@/lib/env";

/**
 * Daily retention job (pg_cron + pg_net call this; see README). Hard-deletes what was
 * soft-deleted more than 30 days ago and prunes dead invitations. Idempotent.
 */
function authorised(req: NextRequest): boolean {
  const secret = cronSecret();
  const header = req.headers.get("authorization") ?? "";
  if (!secret) return false;
  const expected = Buffer.from(`Bearer ${secret}`);
  const given = Buffer.from(header);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

async function run(req: NextRequest) {
  if (!authorised(req)) return NextResponse.json({ error: { code: "unauthorized" } }, { status: 401 });
  const db = adminDb();
  const result = await db.transaction(async (tx) => {
    const tasks = (await tx.execute(
      sql`delete from public.tasks where deleted_at < now() - interval '30 days' returning id`,
    )) as unknown as unknown[];
    const projects = (await tx.execute(
      sql`delete from public.projects where deleted_at < now() - interval '30 days' returning id`,
    )) as unknown as unknown[];
    const invites = (await tx.execute(
      sql`delete from public.invitations
           where (revoked_at is not null or expires_at < now()) and created_at < now() - interval '30 days' returning id`,
    )) as unknown as unknown[];
    const summary = { tasks: tasks.length, projects: projects.length, invitations: invites.length };
    await tx.execute(sql`insert into public.cron_runs (job, last_run_at, last_result) values ('purge', now(), ${JSON.stringify(summary)}::jsonb)
                         on conflict (job) do update set last_run_at = excluded.last_run_at, last_result = excluded.last_result`);
    return summary;
  });
  return NextResponse.json({ data: result });
}

export const GET = run;
export const POST = run;
