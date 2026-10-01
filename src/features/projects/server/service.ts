import "server-only";
import { and, asc, desc, eq, isNotNull, isNull, sql } from "drizzle-orm";
import { limitsFor } from "@/config/plans";
import type { Ctx } from "@/lib/api/handler";
import { ForbiddenError, LimitError, NotFoundError, ValidationError } from "@/lib/api/errors";
import { logActivity, track } from "@/lib/db/audit";
import {
  profiles,
  projectMembers,
  projectStatuses,
  projects,
  tasks,
  type ProjectRole,
  type ProjectView,
  type ProjectVisibility,
  type StatusCategory,
} from "@/lib/db/schema";
import { iso } from "@/lib/db/time";
import { withUser, type Tx } from "@/lib/db/with-user";
import { keyBetween } from "@/lib/positions";
import { trCompare } from "@/lib/text/tr";
import { requireWorkspaceTx } from "@/features/workspaces/server/service";
import type { ProjectAccess, ProjectDetail, ProjectSummary, Status } from "../types";

const SUMMARY_SELECT = sql`
  select p.id, p.workspace_id as "workspaceId", p.name, p.color, p.visibility, p.is_personal as "isPersonal",
         p.is_sample as "isSample", p.archived_at as "archivedAt", p.position,
         app.project_access(p.id) as access,
         (select count(*)::int from public.tasks t
           where t.project_id = p.id and t.deleted_at is null and t.parent_task_id is null and t.completed_at is null) as "openCount",
         (select count(*)::int from public.tasks t
           where t.project_id = p.id and t.deleted_at is null and t.parent_task_id is null and t.completed_at is not null) as "doneCount"
    from public.projects p`;

type SummaryRow = Omit<ProjectSummary, "archivedAt"> & { archivedAt: unknown };
const toSummary = (r: SummaryRow): ProjectSummary => ({ ...r, archivedAt: iso(r.archivedAt) });

export async function listProjectsTx(tx: Tx, workspaceId: string): Promise<ProjectSummary[]> {
  const rows = (await tx.execute(
    sql`${SUMMARY_SELECT} where p.workspace_id = ${workspaceId}::uuid and p.deleted_at is null
        order by p.is_personal desc, p.archived_at nulls first, p.position, p.created_at`,
  )) as unknown as SummaryRow[];
  return rows.map(toSummary);
}

export async function listProjects(ctx: Ctx, workspaceId: string) {
  return withUser(ctx.claims, async (tx) => {
    await requireWorkspaceTx(tx, ctx.userId, workspaceId);
    return listProjectsTx(tx, workspaceId);
  });
}

/** Loads a live project visible to the user; 404 otherwise (incl. other tenants). */
export async function requireProjectTx(tx: Tx, projectId: string, opts: { includeDeleted?: boolean } = {}) {
  const rows = (await tx.execute(
    sql`${SUMMARY_SELECT} where p.id = ${projectId}::uuid ${opts.includeDeleted ? sql`` : sql`and p.deleted_at is null`}`,
  )) as unknown as SummaryRow[];
  const row = rows[0];
  if (!row || !row.access) throw new NotFoundError();
  return toSummary(row);
}

/** Bringing a project back (unarchive / undelete) counts against the active project limit too. */
async function assertProjectSlotTx(tx: Tx, workspaceId: string, userId: string) {
  const ws = await requireWorkspaceTx(tx, userId, workspaceId);
  const limit = limitsFor(ws.plan).projects;
  if (limit === null) return;
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext('projects:' || ${workspaceId}))`);
  const [row] = (await tx.execute(
    sql`select projects from app.workspace_usage(${workspaceId}::uuid)`,
  )) as unknown as Array<{ projects: number }>;
  if ((row?.projects ?? 0) >= limit) throw new LimitError("projects");
}

function assertAccess(access: ProjectAccess, needed: "admin" | "write") {
  if (needed === "admin" && access !== "admin") throw new ForbiddenError();
  if (needed === "write" && access === "viewer") throw new ForbiddenError();
}

export async function listStatusesTx(tx: Tx, projectId: string): Promise<Status[]> {
  return tx
    .select({
      id: projectStatuses.id,
      name: projectStatuses.name,
      category: projectStatuses.category,
      color: projectStatuses.color,
      position: projectStatuses.position,
    })
    .from(projectStatuses)
    .where(eq(projectStatuses.projectId, projectId))
    .orderBy(asc(projectStatuses.position), asc(projectStatuses.createdAt));
}

export async function getProject(ctx: Ctx, projectId: string): Promise<ProjectDetail> {
  return withUser(ctx.claims, async (tx) => {
    const summary = await requireProjectTx(tx, projectId);
    const [extra] = await tx
      .select({ description: projects.description, defaultView: projects.defaultView })
      .from(projects)
      .where(eq(projects.id, projectId));
    const members = await tx
      .select({
        userId: projectMembers.userId,
        role: projectMembers.role,
        fullName: profiles.fullName,
        email: profiles.email,
        avatarUrl: profiles.avatarUrl,
      })
      .from(projectMembers)
      .innerJoin(profiles, eq(profiles.id, projectMembers.userId))
      .where(eq(projectMembers.projectId, projectId));
    return {
      ...summary,
      description: extra!.description,
      defaultView: extra!.defaultView,
      statuses: await listStatusesTx(tx, projectId),
      members: members.sort((a, b) => trCompare(a.fullName || a.email, b.fullName || b.email)),
    };
  });
}

export async function createProject(
  ctx: Ctx,
  workspaceId: string,
  input: { name: string; color: string; visibility: ProjectVisibility; description?: string },
): Promise<ProjectSummary> {
  return withUser(ctx.claims, async (tx) => {
    const ws = await requireWorkspaceTx(tx, ctx.userId, workspaceId);
    if (ws.role === "guest") throw new ForbiddenError();
    const [last] = await tx
      .select({ position: projects.position })
      .from(projects)
      .where(and(eq(projects.workspaceId, workspaceId), isNull(projects.deletedAt)))
      .orderBy(desc(projects.position))
      .limit(1);
    const id = crypto.randomUUID();
    await tx.execute(
      sql`select app.create_project(${id}::uuid, ${workspaceId}::uuid, ${input.name}, ${input.color},
            ${input.visibility}::public.project_visibility, ${input.description ?? ""},
            ${keyBetween(last?.position ?? null, null)}, ${limitsFor(ws.plan).projects})`,
    );
    await logActivity(tx, { workspaceId, actorId: ctx.userId, verb: "project.created", projectId: id, data: {} });
    await track(tx, { userId: ctx.userId, workspaceId, name: "project_created", props: { visibility: input.visibility } });
    return requireProjectTx(tx, id);
  });
}

export async function updateProject(
  ctx: Ctx,
  projectId: string,
  input: Partial<{
    name: string;
    color: string;
    visibility: ProjectVisibility;
    description: string;
    defaultView: ProjectView;
    archived: boolean;
  }>,
) {
  return withUser(ctx.claims, async (tx) => {
    const project = await requireProjectTx(tx, projectId);
    const onlyView = Object.keys(input).every((k) => k === "defaultView");
    assertAccess(project.access, onlyView ? "write" : "admin");
    if (project.isPersonal && (input.visibility || input.archived !== undefined)) {
      throw new ValidationError("personal_project");
    }
    if (input.archived === false && project.archivedAt) {
      await assertProjectSlotTx(tx, project.workspaceId, ctx.userId);
    }
    const patch: Partial<typeof projects.$inferInsert> = {};
    if (input.name !== undefined) patch.name = input.name.trim();
    if (input.color !== undefined) patch.color = input.color;
    if (input.visibility !== undefined) patch.visibility = input.visibility;
    if (input.description !== undefined) patch.description = input.description;
    if (input.defaultView !== undefined) patch.defaultView = input.defaultView;
    if (input.archived !== undefined) patch.archivedAt = input.archived ? new Date().toISOString() : null;
    if (Object.keys(patch).length > 0) {
      await tx.update(projects).set(patch).where(eq(projects.id, projectId));
    }
    if (input.archived !== undefined) {
      await logActivity(tx, {
        workspaceId: project.workspaceId,
        actorId: ctx.userId,
        verb: input.archived ? "project.archived" : "project.unarchived",
        projectId,
      });
    }
    return requireProjectTx(tx, projectId);
  });
}

export async function deleteProject(ctx: Ctx, projectId: string) {
  return withUser(ctx.claims, async (tx) => {
    const project = await requireProjectTx(tx, projectId);
    assertAccess(project.access, "admin");
    if (project.isPersonal) throw new ValidationError("personal_project");
    await tx.update(projects).set({ deletedAt: new Date().toISOString() }).where(eq(projects.id, projectId));
    await logActivity(tx, { workspaceId: project.workspaceId, actorId: ctx.userId, verb: "project.deleted", projectId });
  });
}

export async function restoreProject(ctx: Ctx, projectId: string) {
  return withUser(ctx.claims, async (tx) => {
    const project = await requireProjectTx(tx, projectId, { includeDeleted: true });
    assertAccess(project.access, "admin");
    const [row] = await tx.select({ deletedAt: projects.deletedAt }).from(projects).where(eq(projects.id, projectId));
    if (!row?.deletedAt) return project;
    if (!project.archivedAt && !project.isPersonal) await assertProjectSlotTx(tx, project.workspaceId, ctx.userId);
    await tx.update(projects).set({ deletedAt: null }).where(eq(projects.id, projectId));
    await logActivity(tx, { workspaceId: project.workspaceId, actorId: ctx.userId, verb: "project.restored", projectId });
    return requireProjectTx(tx, projectId);
  });
}

// ── Statuses ───────────────────────────────────────────────────────────────

async function requireStatusTx(tx: Tx, statusId: string) {
  const [row] = await tx
    .select({ id: projectStatuses.id, projectId: projectStatuses.projectId, category: projectStatuses.category })
    .from(projectStatuses)
    .where(eq(projectStatuses.id, statusId));
  if (!row) throw new NotFoundError();
  const project = await requireProjectTx(tx, row.projectId);
  return { status: row, project };
}

export async function createStatus(
  ctx: Ctx,
  projectId: string,
  input: { name: string; category: StatusCategory; color: string },
): Promise<Status> {
  return withUser(ctx.claims, async (tx) => {
    const project = await requireProjectTx(tx, projectId);
    assertAccess(project.access, "admin");
    const existing = await listStatusesTx(tx, projectId);
    if (existing.length >= 12) throw new ValidationError("too_many_statuses");
    // New statuses go before the first "done" status so "done" stays last.
    const firstDone = existing.findIndex((s) => s.category === "done");
    const before = firstDone > 0 ? existing[firstDone - 1]!.position : firstDone === 0 ? null : existing.at(-1)?.position ?? null;
    const after = firstDone >= 0 ? existing[firstDone]!.position : null;
    const [row] = await tx
      .insert(projectStatuses)
      .values({ projectId, name: input.name.trim(), category: input.category, color: input.color, position: keyBetween(before, after) })
      .returning();
    return { id: row!.id, name: row!.name, category: row!.category, color: row!.color, position: row!.position };
  });
}

function assertCategoriesCovered(statuses: Array<{ category: StatusCategory }>) {
  if (!statuses.some((s) => s.category === "todo") || !statuses.some((s) => s.category === "done")) {
    throw new ValidationError("status_categories_required");
  }
}

export async function updateStatus(
  ctx: Ctx,
  statusId: string,
  input: Partial<{ name: string; category: StatusCategory; color: string; position: string }>,
) {
  return withUser(ctx.claims, async (tx) => {
    const { project } = await requireStatusTx(tx, statusId);
    assertAccess(project.access, "admin");
    if (input.category) {
      const all = await listStatusesTx(tx, project.id);
      assertCategoriesCovered(all.map((s) => (s.id === statusId ? { category: input.category! } : s)));
    }
    const patch: Partial<typeof projectStatuses.$inferInsert> = {};
    if (input.name !== undefined) patch.name = input.name.trim();
    if (input.category !== undefined) patch.category = input.category;
    if (input.color !== undefined) patch.color = input.color;
    if (input.position !== undefined) patch.position = input.position;
    await tx.update(projectStatuses).set(patch).where(eq(projectStatuses.id, statusId));
    if (input.category) {
      // Re-evaluate completed_at for tasks in this status (trigger fires on status_id updates).
      await tx.execute(sql`update public.tasks set status_id = status_id where status_id = ${statusId}::uuid`);
    }
    return listStatusesTx(tx, project.id);
  });
}

export async function deleteStatus(ctx: Ctx, statusId: string, moveToStatusId: string) {
  return withUser(ctx.claims, async (tx) => {
    const { project } = await requireStatusTx(tx, statusId);
    assertAccess(project.access, "admin");
    const all = await listStatusesTx(tx, project.id);
    const target = all.find((s) => s.id === moveToStatusId);
    if (!target || moveToStatusId === statusId) throw new ValidationError("invalid_target_status");
    assertCategoriesCovered(all.filter((s) => s.id !== statusId));
    await tx.update(tasks).set({ statusId: moveToStatusId }).where(eq(tasks.statusId, statusId));
    await tx.delete(projectStatuses).where(eq(projectStatuses.id, statusId));
    return listStatusesTx(tx, project.id);
  });
}

// ── Project members ────────────────────────────────────────────────────────

export async function addProjectMember(ctx: Ctx, projectId: string, input: { userId: string; role: ProjectRole }) {
  return withUser(ctx.claims, async (tx) => {
    const project = await requireProjectTx(tx, projectId);
    assertAccess(project.access, "admin");
    if (project.isPersonal) throw new ValidationError("personal_project");
    await tx
      .insert(projectMembers)
      .values({ projectId, userId: input.userId, role: input.role })
      .onConflictDoUpdate({ target: [projectMembers.projectId, projectMembers.userId], set: { role: input.role } });
  });
}

export async function removeProjectMember(ctx: Ctx, projectId: string, userId: string) {
  return withUser(ctx.claims, async (tx) => {
    const project = await requireProjectTx(tx, projectId);
    assertAccess(project.access, "admin");
    if (project.isPersonal) throw new ValidationError("personal_project");
    const admins = await tx
      .select({ userId: projectMembers.userId })
      .from(projectMembers)
      .where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.role, "admin")));
    if (admins.length === 1 && admins[0]!.userId === userId && project.visibility === "private") {
      throw new ValidationError("last_project_admin");
    }
    await tx.delete(projectMembers).where(and(eq(projectMembers.projectId, projectId), eq(projectMembers.userId, userId)));
  });
}

export async function personalProjectIdTx(tx: Tx, workspaceId: string, userId: string): Promise<string> {
  const [row] = await tx
    .select({ id: projects.id })
    .from(projects)
    .where(and(eq(projects.workspaceId, workspaceId), eq(projects.createdBy, userId), eq(projects.isPersonal, true)));
  if (!row) throw new NotFoundError();
  return row.id;
}

export async function listDeletedProjects(ctx: Ctx, workspaceId: string) {
  return withUser(ctx.claims, async (tx) => {
    await requireWorkspaceTx(tx, ctx.userId, workspaceId);
    const rows = await tx
      .select({ id: projects.id, name: projects.name, deletedAt: projects.deletedAt })
      .from(projects)
      .where(and(eq(projects.workspaceId, workspaceId), isNotNull(projects.deletedAt)))
      .orderBy(desc(projects.deletedAt));
    return rows.map((r) => ({ ...r, deletedAt: iso(r.deletedAt) }));
  });
}
