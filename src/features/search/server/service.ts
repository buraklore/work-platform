import "server-only";
import { sql } from "drizzle-orm";
import type { Ctx } from "@/lib/api/handler";
import { withUser } from "@/lib/db/with-user";
import { trNormalize } from "@/lib/text/tr";
import { requireWorkspaceTx } from "@/features/workspaces/server/service";
import type { SearchResults } from "../types";

function likePattern(q: string): string {
  return `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/**
 * Turkish-aware search: both sides go through tr_normalize (İ/ı/ş/ç… folded), matched
 * as a substring (trigram index) so suffixes never block a hit ("rapor" finds
 * "raporları"), with word_similarity as a typo-tolerant fallback. RLS limits results
 * to what the user may see.
 */
export async function search(ctx: Ctx, workspaceId: string, rawQuery: string): Promise<SearchResults> {
  const q = trNormalize(rawQuery.trim()).slice(0, 100);
  if (q.length < 2) return { tasks: [], projects: [], people: [] };
  const pattern = likePattern(q);
  return withUser(ctx.claims, async (tx) => {
    const ws = await requireWorkspaceTx(tx, ctx.userId, workspaceId);
    const taskRows = (await tx.execute(sql`
      select t.id, t.title, t.project_id as "projectId", p.name as "projectName", p.color as "projectColor",
             (t.completed_at is not null) as completed
        from public.tasks t join public.projects p on p.id = t.project_id
       where t.workspace_id = ${workspaceId}::uuid and t.deleted_at is null and p.deleted_at is null
         and (public.tr_normalize(t.title) like ${pattern} or ${q} <% public.tr_normalize(t.title))
       order by (public.tr_normalize(t.title) like ${`${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`}) desc,
                (t.completed_at is null) desc,
                word_similarity(${q}, public.tr_normalize(t.title)) desc,
                t.updated_at desc
       limit 8`)) as unknown as SearchResults["tasks"];
    const projectRows = (await tx.execute(sql`
      select p.id, p.name, p.color, p.is_personal as "isPersonal"
        from public.projects p
       where p.workspace_id = ${workspaceId}::uuid and p.deleted_at is null
         and (public.tr_normalize(p.name) like ${pattern} or ${q} <% public.tr_normalize(p.name))
       order by word_similarity(${q}, public.tr_normalize(p.name)) desc
       limit 5`)) as unknown as SearchResults["projects"];
    const people =
      ws.role === "guest"
        ? []
        : ((await tx.execute(sql`
      select pr.id as "userId", pr.full_name as "fullName", pr.email, pr.avatar_url as "avatarUrl"
        from public.workspace_members m join public.profiles pr on pr.id = m.user_id
       where m.workspace_id = ${workspaceId}::uuid
         and (public.tr_normalize(pr.full_name) like ${pattern} or public.tr_normalize(pr.email) like ${pattern})
       limit 5`)) as unknown as SearchResults["people"]);
    return { tasks: taskRows, projects: projectRows, people };
  });
}
