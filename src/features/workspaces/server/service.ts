import "server-only";
import { randomBytes } from "node:crypto";
import { and, asc, eq, isNull, sql } from "drizzle-orm";
import type { Ctx } from "@/lib/api/handler";
import { ForbiddenError, NotFoundError } from "@/lib/api/errors";
import { limitsFor } from "@/config/plans";
import { track } from "@/lib/db/audit";
import { profiles, workspaceMembers, workspaces } from "@/lib/db/schema";
import { withUser, type Tx } from "@/lib/db/with-user";
import { trSlugify } from "@/lib/text/tr";
import type { Me, UseCase, WorkspaceSummary, WorkspaceUsage } from "../types";

export async function listWorkspacesTx(tx: Tx, userId: string): Promise<WorkspaceSummary[]> {
  const rows = await tx
    .select({ id: workspaces.id, name: workspaces.name, slug: workspaces.slug, role: workspaceMembers.role, plan: workspaces.plan })
    .from(workspaces)
    .innerJoin(workspaceMembers, and(eq(workspaceMembers.workspaceId, workspaces.id), eq(workspaceMembers.userId, userId)))
    .where(isNull(workspaces.deletedAt))
    .orderBy(asc(workspaces.createdAt));
  return rows;
}

export async function getMe(ctx: Ctx): Promise<Me> {
  return withUser(ctx.claims, async (tx) => {
    const [profile] = await tx.select().from(profiles).where(eq(profiles.id, ctx.userId));
    if (!profile) throw new NotFoundError();
    return {
      id: profile.id,
      email: profile.email,
      fullName: profile.fullName,
      avatarUrl: profile.avatarUrl,
      theme: profile.theme as Me["theme"],
      lastWorkspaceId: profile.lastWorkspaceId,
      termsAccepted: profile.termsAcceptedAt !== null,
      workspaces: await listWorkspacesTx(tx, ctx.userId),
    };
  });
}

/** Resolve a workspace by slug for the current user, or 404 (also for other tenants). */
export async function getWorkspaceBySlugTx(tx: Tx, userId: string, slug: string): Promise<WorkspaceSummary> {
  const [row] = await tx
    .select({ id: workspaces.id, name: workspaces.name, slug: workspaces.slug, role: workspaceMembers.role, plan: workspaces.plan })
    .from(workspaces)
    .innerJoin(workspaceMembers, and(eq(workspaceMembers.workspaceId, workspaces.id), eq(workspaceMembers.userId, userId)))
    .where(and(eq(workspaces.slug, slug), isNull(workspaces.deletedAt)));
  if (!row) throw new NotFoundError();
  return row;
}

export async function getWorkspaceBySlug(ctx: Ctx, slug: string) {
  return withUser(ctx.claims, (tx) => getWorkspaceBySlugTx(tx, ctx.userId, slug));
}

export async function requireWorkspaceTx(tx: Tx, userId: string, workspaceId: string): Promise<WorkspaceSummary> {
  const [row] = await tx
    .select({ id: workspaces.id, name: workspaces.name, slug: workspaces.slug, role: workspaceMembers.role, plan: workspaces.plan })
    .from(workspaces)
    .innerJoin(workspaceMembers, and(eq(workspaceMembers.workspaceId, workspaces.id), eq(workspaceMembers.userId, userId)))
    .where(and(eq(workspaces.id, workspaceId), isNull(workspaces.deletedAt)));
  if (!row) throw new NotFoundError();
  return row;
}

function slugFor(name: string): string {
  const base = trSlugify(name).replace(/^-+|-+$/g, "") || "ekip";
  // 24 bits: two teams with the same name practically never collide on the unique slug.
  const suffix = randomBytes(3).toString("hex");
  return `${base.slice(0, 40)}-${suffix}`.replace(/^-+/, "");
}

export async function createWorkspace(ctx: Ctx, input: { name: string; useCase?: UseCase | null }): Promise<WorkspaceSummary> {
  return withUser(ctx.claims, async (tx) => {
    const id = crypto.randomUUID();
    const slug = slugFor(input.name);
    await tx.execute(
      sql`select app.create_workspace(${id}::uuid, ${input.name}, ${slug}, ${input.useCase ?? null}, ${limitsFor("free").ownedWorkspaces})`,
    );
    await track(tx, { userId: ctx.userId, workspaceId: id, name: "workspace_created", props: { useCase: input.useCase ?? "none" } });
    return requireWorkspaceTx(tx, ctx.userId, id);
  });
}

export async function updateWorkspace(ctx: Ctx, workspaceId: string, input: { name: string }) {
  return withUser(ctx.claims, async (tx) => {
    const ws = await requireWorkspaceTx(tx, ctx.userId, workspaceId);
    if (ws.role !== "owner" && ws.role !== "admin") throw new ForbiddenError();
    await tx.update(workspaces).set({ name: input.name.trim() }).where(eq(workspaces.id, workspaceId));
    return requireWorkspaceTx(tx, ctx.userId, workspaceId);
  });
}

export async function rememberWorkspace(ctx: Ctx, workspaceId: string) {
  return withUser(ctx.claims, async (tx) => {
    await requireWorkspaceTx(tx, ctx.userId, workspaceId);
    await tx.update(profiles).set({ lastWorkspaceId: workspaceId }).where(eq(profiles.id, ctx.userId));
  });
}

export async function getUsageTx(tx: Tx, workspaceId: string): Promise<WorkspaceUsage> {
  const rows = (await tx.execute(
    sql`select members, guests, projects, active_tasks as "activeTasks" from app.workspace_usage(${workspaceId}::uuid)`,
  )) as unknown as WorkspaceUsage[];
  return rows[0]!;
}

export async function getUsage(ctx: Ctx, workspaceId: string) {
  return withUser(ctx.claims, async (tx) => {
    const ws = await requireWorkspaceTx(tx, ctx.userId, workspaceId);
    return { plan: ws.plan, usage: await getUsageTx(tx, workspaceId), limits: limitsFor(ws.plan) };
  });
}
